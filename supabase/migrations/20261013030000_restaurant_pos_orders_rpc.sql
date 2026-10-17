-- ==============================================================================
-- NEGOVA SaaS - Migración Incremental: Etapa 3 (Función RPC Transaccional POS)
-- Función: public.create_restaurant_pos_order
-- Garantiza: Atomicidad total (sin DELETE compensatorio), Concurrencia segura (Advisory Locks),
-- e Idempotencia con detección de discrepancia de contenido (Payload Hash).
-- ==============================================================================

-- 1. Asegurar columna idempotency_hash en restaurant_orders
ALTER TABLE public.restaurant_orders 
ADD COLUMN IF NOT EXISTS idempotency_hash TEXT;

-- 2. Índice para consultas de verificación de idempotencia
CREATE INDEX IF NOT EXISTS idx_orders_idempotency_hash 
ON public.restaurant_orders(business_id, idempotency_hash) 
WHERE idempotency_hash IS NOT NULL;

-- 3. Función RPC atómica para registro de pedidos y comandas POS
CREATE OR REPLACE FUNCTION public.create_restaurant_pos_order(
    p_business_id UUID,
    p_order_type TEXT,
    p_channel_origin TEXT,
    p_subtotal NUMERIC,
    p_delivery_fee NUMERIC,
    p_total NUMERIC,
    p_items JSONB,
    p_table_id UUID DEFAULT NULL,
    p_customer_name TEXT DEFAULT NULL,
    p_customer_phone TEXT DEFAULT NULL,
    p_delivery_address TEXT DEFAULT NULL,
    p_delivery_reference TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL,
    p_idempotency_hash TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order_id UUID;
    v_order_number INTEGER;
    v_order_total NUMERIC;
    v_existing_hash TEXT;
    v_item RECORD;
    v_table_exists BOOLEAN;
BEGIN
    -- 0. Verificación estricta de seguridad multi-tenant y prevención de suplantación de identidad
    -- Si la función es invocada por un usuario autenticado directo (JWT vía PostgREST),
    -- se valida su membresía activa en el negocio y se fuerza p_user_id al UID real de la sesión.
    IF auth.role() = 'authenticated' THEN
        p_user_id := auth.uid();

        IF NOT EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = p_business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        ) THEN
            RAISE EXCEPTION 'UNAUTHORIZED: El usuario autenticado no pertenece a este negocio o su membresía está inactiva.';
        END IF;
    ELSIF p_user_id IS NOT NULL THEN
        -- Si es invocado mediante service_role en el servidor con p_user_id explícito,
        -- verificar como defensa en profundidad que el usuario pertenezca al negocio con membresía activa
        -- o sea super_admin en la plataforma, previniendo suplantación de created_by.
        IF NOT EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = p_business_id
              AND bu.user_id = p_user_id
              AND bu.status = 'active'
        ) AND NOT EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = p_user_id
              AND u.platform_role = 'super_admin'
        ) THEN
            RAISE EXCEPTION 'UNAUTHORIZED: El usuario asignado en created_by no pertenece a este negocio o está inactivo.';
        END IF;
    END IF;

    -- 1. Validaciones básicas de negocio y destino
    IF p_business_id IS NULL THEN
        RAISE EXCEPTION 'BUSINESS_REQUIRED: Se requiere un business_id válido.';
    END IF;

    -- Validar que el comercio exista y se encuentre en estado operacional (no inactivo ni suspendido)
    IF NOT EXISTS (
        SELECT 1 FROM public.businesses b
        WHERE b.id = p_business_id
          AND b.status NOT IN ('inactive', 'suspended')
    ) THEN
        RAISE EXCEPTION 'BUSINESS_UNAVAILABLE: El negocio no existe o se encuentra inactivo/suspendido.';
    END IF;

    IF p_order_type NOT IN ('dine_in', 'takeout', 'delivery') THEN
        RAISE EXCEPTION 'INVALID_ORDER_TYPE: Destino inválido. Debe ser dine_in, takeout o delivery.';
    END IF;

    IF p_channel_origin NOT IN ('in_person', 'whatsapp') THEN
        RAISE EXCEPTION 'INVALID_CHANNEL: Canal inválido. Debe ser in_person o whatsapp.';
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'EMPTY_ITEMS: El pedido debe contener al menos un producto.';
    END IF;

    -- Validar mesa en dine_in
    IF p_order_type = 'dine_in' THEN
        IF p_table_id IS NULL THEN
            RAISE EXCEPTION 'TABLE_REQUIRED: Para consumo en mesa debes seleccionar una mesa.';
        END IF;

        SELECT EXISTS (
            SELECT 1 FROM public.restaurant_tables
            WHERE id = p_table_id AND business_id = p_business_id
        ) INTO v_table_exists;

        IF NOT v_table_exists THEN
            RAISE EXCEPTION 'TABLE_NOT_FOUND: La mesa seleccionada no pertenece a este negocio o no existe.';
        END IF;
    END IF;

    -- Validar entrega a domicilio
    IF p_order_type = 'delivery' THEN
        IF trim(COALESCE(p_customer_name, '')) = '' THEN
            RAISE EXCEPTION 'CUSTOMER_NAME_REQUIRED: Para pedidos a domicilio debes ingresar el nombre del destinatario.';
        END IF;
        IF trim(COALESCE(p_delivery_address, '')) = '' THEN
            RAISE EXCEPTION 'DELIVERY_ADDRESS_REQUIRED: Para pedidos a domicilio debes ingresar la dirección de entrega.';
        END IF;
    END IF;

    -- 2. Manejo de idempotencia antes de inserción (reintento secuencial)
    IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) != '' THEN
        SELECT id, order_number, total, idempotency_hash
        INTO v_order_id, v_order_number, v_order_total, v_existing_hash
        FROM public.restaurant_orders
        WHERE business_id = p_business_id AND idempotency_key = p_idempotency_key;

        IF v_order_id IS NOT NULL THEN
            -- Clave encontrada: verificar que el hash del contenido coincida
            IF p_idempotency_hash IS NOT NULL AND v_existing_hash IS NOT NULL AND v_existing_hash != p_idempotency_hash THEN
                RAISE EXCEPTION 'IDEMPOTENCY_PAYLOAD_MISMATCH: Clave de idempotencia reutilizada con contenido de pedido diferente.';
            END IF;

            RETURN jsonb_build_object(
                'success', true,
                'order_id', v_order_id,
                'order_number', v_order_number,
                'total', v_order_total,
                'is_duplicate', true
            );
        END IF;
    END IF;

    -- 3. Bloqueo transaccional por tenant para número correlativo seguro frente a concurrencia
    -- pg_advisory_xact_lock serializa la generación del consecutivo únicamente para este business_id
    PERFORM pg_advisory_xact_lock(hashtext('negova_order_number_' || p_business_id::TEXT));

    SELECT COALESCE(MAX(order_number), 0) + 1
    INTO v_order_number
    FROM public.restaurant_orders
    WHERE business_id = p_business_id;

    -- 4. Inserción atómica del encabezado (restaurant_orders) con manejo seguro de carrera por idempotency_key
    BEGIN
        INSERT INTO public.restaurant_orders (
            business_id,
            order_number,
            status,
            order_type,
            channel_origin,
            subtotal,
            delivery_fee,
            total,
            notes,
            table_id,
            customer_name,
            customer_phone,
            delivery_address,
            delivery_reference,
            payment_status,
            idempotency_key,
            idempotency_hash,
            created_by
        ) VALUES (
            p_business_id,
            v_order_number,
            'received',
            p_order_type,
            p_channel_origin,
            p_subtotal,
            p_delivery_fee,
            p_total,
            p_notes,
            CASE WHEN p_order_type = 'dine_in' THEN p_table_id ELSE NULL END,
            CASE WHEN p_order_type = 'delivery' THEN trim(p_customer_name) ELSE NULL END,
            CASE WHEN p_order_type = 'delivery' THEN trim(p_customer_phone) ELSE NULL END,
            CASE WHEN p_order_type = 'delivery' THEN trim(p_delivery_address) ELSE NULL END,
            CASE WHEN p_order_type = 'delivery' THEN trim(p_delivery_reference) ELSE NULL END,
            'pending',
            p_idempotency_key,
            p_idempotency_hash,
            p_user_id
        ) RETURNING id, order_number, total INTO v_order_id, v_order_number, v_order_total;

    EXCEPTION WHEN unique_violation THEN
        -- Si dos peticiones simultáneas con la misma clave compitieron, una perdió la carrera aquí.
        IF p_idempotency_key IS NOT NULL THEN
            SELECT id, order_number, total, idempotency_hash
            INTO v_order_id, v_order_number, v_order_total, v_existing_hash
            FROM public.restaurant_orders
            WHERE business_id = p_business_id AND idempotency_key = p_idempotency_key;

            IF v_order_id IS NOT NULL THEN
                IF p_idempotency_hash IS NOT NULL AND v_existing_hash IS NOT NULL AND v_existing_hash != p_idempotency_hash THEN
                    RAISE EXCEPTION 'IDEMPOTENCY_PAYLOAD_MISMATCH: Clave de idempotencia reutilizada con contenido de pedido diferente.';
                END IF;

                RETURN jsonb_build_object(
                    'success', true,
                    'order_id', v_order_id,
                    'order_number', v_order_number,
                    'total', v_order_total,
                    'is_duplicate', true
                );
            END IF;
        END IF;
        RAISE;
    END;

    -- 5. Inserción atómica de líneas del pedido (restaurant_order_items)
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id UUID,
        product_name TEXT,
        quantity INTEGER,
        unit_price NUMERIC,
        subtotal NUMERIC,
        notes TEXT,
        modifiers JSONB
    ) LOOP
        INSERT INTO public.restaurant_order_items (
            business_id,
            order_id,
            product_id,
            product_name,
            quantity,
            unit_price,
            subtotal,
            notes,
            modifiers
        ) VALUES (
            p_business_id,
            v_order_id,
            v_item.product_id,
            v_item.product_name,
            v_item.quantity,
            v_item.unit_price,
            v_item.subtotal,
            v_item.notes,
            COALESCE(v_item.modifiers, '[]'::jsonb)
        );
    END LOOP;

    -- 6. Retorno exitoso
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'total', v_order_total,
        'is_duplicate', false
    );
END;
$$;

-- 4. Permisos de ejecución:
-- Se revoca de PUBLIC. Se concede a authenticated y service_role para permitir que PostgREST indexe
-- la función en su schema cache. La seguridad multi-tenant y la prevención de suplantación están blindadas
-- internamente en la cabecera de la función (auth.role() = 'authenticated' => p_user_id := auth.uid() y validación bu.status = 'active').
REVOKE ALL ON FUNCTION public.create_restaurant_pos_order FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_restaurant_pos_order TO authenticated, service_role;
