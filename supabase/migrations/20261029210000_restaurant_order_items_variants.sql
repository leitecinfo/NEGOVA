-- ==============================================================================
-- NEGOVA SaaS - Migración Versionada: Soporte de Variantes en Líneas de Pedido
-- Archivo: supabase/migrations/20261029210000_restaurant_order_items_variants.sql
-- Tarea: [CAT-002]
-- Dependencias: [STOCK-001], [CAT-001]
-- Fecha: 2026-10-29
--
-- Objetivos resueltos:
-- 1. Agregar columnas 'variant_id' y 'variant_name' a 'public.restaurant_order_items'
--    para almacenar de forma inmutable la presentación/tamaño seleccionada en el POS.
-- 2. Actualizar el RPC 'create_restaurant_pos_order' para desempaquetar 'variant_id' y
--    'variant_name' desde 'p_items' e insertarlos en 'public.restaurant_order_items'.
-- 3. Crear índice parcial en 'restaurant_order_items(variant_id)' para análisis de ventas por variante.
-- ==============================================================================

-- 1. Alterar tabla restaurant_order_items
ALTER TABLE public.restaurant_order_items
    ADD COLUMN IF NOT EXISTS variant_id TEXT,
    ADD COLUMN IF NOT EXISTS variant_name TEXT;

-- 2. Índice para consultas y reportes de variantes
CREATE INDEX IF NOT EXISTS idx_rest_order_items_variant
    ON public.restaurant_order_items(business_id, variant_id)
    WHERE variant_id IS NOT NULL;

-- 3. Actualizar función RPC atómica
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
    v_table_status TEXT;
    v_product_rec RECORD;
    v_current_stock NUMERIC;
    v_new_stock NUMERIC;
    v_default_location_id UUID;
BEGIN
    -- 0. Verificación estricta de seguridad multi-tenant y prevención de accesos anónimos
    IF auth.role() = 'anon' THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Las solicitudes anónimas no tienen autorización para registrar comandas.';
    END IF;

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
    ELSIF auth.role() = 'service_role' THEN
        -- Si es invocado mediante service_role en el servidor con p_user_id explícito,
        -- verificar como defensa en profundidad que el usuario pertenezca al negocio con membresía activa
        -- o sea super_admin en la plataforma, previniendo suplantación de created_by.
        IF p_user_id IS NOT NULL THEN
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
    ELSE
        RAISE EXCEPTION 'UNAUTHORIZED: Contexto de ejecución no autorizado para registrar pedidos.';
    END IF;

    -- 1. Validaciones básicas de negocio y destino
    IF p_business_id IS NULL THEN
        RAISE EXCEPTION 'BUSINESS_REQUIRED: Se requiere un business_id válido.';
    END IF;

    -- Validar que el comercio exista y se encuentre en estado operacional (no inactivo ni suspendido)
    IF NOT EXISTS (
        SELECT 1 FROM public.businesses b
        WHERE b.id = p_business_id AND b.status IN ('active', 'trial', 'operational')
    ) THEN
        RAISE EXCEPTION 'INVALID_BUSINESS: El comercio no existe o no se encuentra activo para operar.';
    END IF;

    IF p_order_type NOT IN ('dine_in', 'takeout', 'delivery') THEN
        RAISE EXCEPTION 'INVALID_ORDER_TYPE: Tipo de pedido desconocido (%).', p_order_type;
    END IF;

    IF p_channel_origin NOT IN ('in_person', 'whatsapp', 'phone', 'digital_menu') THEN
        RAISE EXCEPTION 'INVALID_CHANNEL: Canal de recepción no válido (%).', p_channel_origin;
    END IF;

    -- Validación estricta para consumo en local
    IF p_order_type = 'dine_in' THEN
        IF p_table_id IS NULL THEN
            RAISE EXCEPTION 'TABLE_REQUIRED: Un pedido para consumo en mesa debe especificar una mesa.';
        END IF;

        -- Validar existencia y pertenencia de la mesa al mismo tenant
        SELECT status INTO v_table_status
        FROM public.restaurant_tables
        WHERE id = p_table_id AND business_id = p_business_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'TABLE_NOT_FOUND: La mesa especificada no existe en este establecimiento.';
        END IF;

        IF v_table_status = 'maintenance' THEN
            RAISE EXCEPTION 'TABLE_UNAVAILABLE: La mesa seleccionada se encuentra actualmente en mantenimiento.';
        END IF;
    END IF;

    -- Validación estricta para domicilios
    IF p_order_type = 'delivery' THEN
        IF p_delivery_address IS NULL OR length(trim(p_delivery_address)) = 0 THEN
            RAISE EXCEPTION 'ADDRESS_REQUIRED: Los pedidos a domicilio requieren una dirección de entrega.';
        END IF;
    END IF;

    -- 2. Validación de coherencia de montos numéricos
    IF p_subtotal IS NULL OR p_subtotal < 0 THEN
        RAISE EXCEPTION 'INVALID_SUBTOTAL: El subtotal debe ser mayor o igual a cero.';
    END IF;

    IF p_delivery_fee IS NULL OR p_delivery_fee < 0 THEN
        RAISE EXCEPTION 'INVALID_DELIVERY_FEE: La tarifa de domicilio no puede ser negativa.';
    END IF;

    IF p_total IS NULL OR p_total < 0 THEN
        RAISE EXCEPTION 'INVALID_TOTAL: El total general debe ser mayor o igual a cero.';
    END IF;

    IF p_total <> (p_subtotal + p_delivery_fee) THEN
        RAISE EXCEPTION 'AMOUNT_MISMATCH: El total (%) no coincide con la suma de subtotal (%) y domicilio (%).',
            p_total, p_subtotal, p_delivery_fee;
    END IF;

    -- Validar que vengan ítems válidos
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'EMPTY_ITEMS: El pedido debe contener al menos un producto.';
    END IF;

    -- 3. Verificación de Idempotencia por Tenant
    IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
        SELECT id, order_number, total, idempotency_hash
        INTO v_order_id, v_order_number, v_order_total, v_existing_hash
        FROM public.restaurant_orders
        WHERE business_id = p_business_id
          AND idempotency_key = p_idempotency_key
        LIMIT 1;

        IF FOUND THEN
            -- Si la clave ya existe pero el contenido es diferente, alertar de conflicto de payload
            IF p_idempotency_hash IS NOT NULL AND v_existing_hash IS NOT NULL AND v_existing_hash <> p_idempotency_hash THEN
                RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: La clave de idempotencia fue reutilizada con datos de comanda diferentes.';
            END IF;

            -- Retornar el pedido existente idéntico de forma segura e idempotente
            RETURN jsonb_build_object(
                'success', true,
                'order_id', v_order_id,
                'order_number', v_order_number,
                'total', v_order_total,
                'is_duplicate', true
            );
        END IF;
    END IF;

    -- 4. Serialización estricta por tenant para numeración de comanda correlativa y continua
    PERFORM pg_advisory_xact_lock(hashtext('biz_order_seq_' || p_business_id::TEXT));

    SELECT COALESCE(MAX(order_number), 0) + 1
    INTO v_order_number
    FROM public.restaurant_orders
    WHERE business_id = p_business_id;

    -- 5. Creación de la cabecera del Pedido (restaurant_orders)
    BEGIN
        INSERT INTO public.restaurant_orders (
            business_id,
            order_number,
            order_type,
            channel_origin,
            table_id,
            customer_name,
            customer_phone,
            delivery_address,
            delivery_reference,
            subtotal,
            delivery_fee,
            total,
            status,
            payment_status,
            notes,
            idempotency_key,
            idempotency_hash,
            created_by
        ) VALUES (
            p_business_id,
            v_order_number,
            p_order_type,
            p_channel_origin,
            p_table_id,
            trim(p_customer_name),
            trim(p_customer_phone),
            trim(p_delivery_address),
            trim(p_delivery_reference),
            p_subtotal,
            p_delivery_fee,
            p_total,
            'pending',
            'pending',
            trim(p_notes),
            p_idempotency_key,
            p_idempotency_hash,
            p_user_id
        )
        RETURNING id, total INTO v_order_id, v_order_total;
    EXCEPTION
        WHEN unique_violation THEN
            -- Fallback concurrente si la restricción única de idempotency_key disparó en milisegundos idénticos
            IF p_idempotency_key IS NOT NULL THEN
                SELECT id, order_number, total
                INTO v_order_id, v_order_number, v_order_total
                FROM public.restaurant_orders
                WHERE business_id = p_business_id
                  AND idempotency_key = p_idempotency_key
                LIMIT 1;

                IF FOUND THEN
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

    -- 6. Inserción atómica de líneas del pedido (restaurant_order_items) con variant_id y variant_name
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id UUID,
        product_name TEXT,
        quantity INTEGER,
        unit_price NUMERIC,
        subtotal NUMERIC,
        notes TEXT,
        modifiers JSONB,
        variant_id TEXT,
        variant_name TEXT
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
            modifiers,
            variant_id,
            variant_name
        ) VALUES (
            p_business_id,
            v_order_id,
            v_item.product_id,
            v_item.product_name,
            v_item.quantity,
            v_item.unit_price,
            v_item.subtotal,
            v_item.notes,
            COALESCE(v_item.modifiers, '[]'::jsonb),
            v_item.variant_id,
            v_item.variant_name
        );
    END LOOP;

    -- 7. [STOCK-001] Descuento atómico de existencias dentro de la misma transacción
    -- Descuenta tanto en products.metadata (retrocompatibilidad) como en inventory_stock (INV-001)
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id UUID,
        product_name TEXT,
        quantity INTEGER,
        unit_price NUMERIC,
        subtotal NUMERIC,
        notes TEXT,
        modifiers JSONB
    ) LOOP
        -- Bloquear y consultar el producto para evitar condiciones de carrera en el stock
        SELECT id, metadata INTO v_product_rec
        FROM public.products
        WHERE id = v_item.product_id AND business_id = p_business_id
        FOR UPDATE;

        IF v_product_rec.id IS NOT NULL AND (
            (v_product_rec.metadata->>'track_stock') = 'true' OR 
            (v_product_rec.metadata->'track_stock') = 'true'::jsonb
        ) THEN
            -- 7.1. Descuento en products.metadata
            v_current_stock := COALESCE(
                CASE 
                    WHEN (v_product_rec.metadata->>'stock_quantity') ~ '^-?[0-9]+(\.[0-9]+)?$' 
                    THEN (v_product_rec.metadata->>'stock_quantity')::numeric 
                    ELSE 0 
                END, 
                0
            );
            v_new_stock := GREATEST(0, v_current_stock - v_item.quantity);

            UPDATE public.products
            SET metadata = jsonb_set(metadata, '{stock_quantity}', to_jsonb(v_new_stock)),
                updated_at = now()
            WHERE id = v_item.product_id AND business_id = p_business_id;

            -- 7.2. Descuento en inventory_stock (INV-001)
            IF v_default_location_id IS NULL THEN
                SELECT id INTO v_default_location_id
                FROM public.locations
                WHERE business_id = p_business_id
                ORDER BY (type = 'point_of_sale') DESC, created_at ASC
                LIMIT 1;
            END IF;

            IF v_default_location_id IS NOT NULL THEN
                UPDATE public.inventory_stock
                SET quantity = GREATEST(0, quantity - v_item.quantity),
                    updated_at = now()
                WHERE product_id = v_item.product_id
                  AND location_id = v_default_location_id
                  AND business_id = p_business_id;

                -- Registrar movimiento en kardex de inventario
                INSERT INTO public.inventory_movements (
                    id,
                    business_id,
                    product_id,
                    location_id,
                    movement_type,
                    quantity,
                    unit_cost,
                    total_cost,
                    reference_id,
                    reference_type,
                    notes,
                    created_by,
                    created_at
                ) VALUES (
                    gen_random_uuid(),
                    p_business_id,
                    v_item.product_id,
                    v_default_location_id,
                    'sale',
                    v_item.quantity,
                    NULL,
                    NULL,
                    v_order_id,
                    'sale',
                    'Descuento automático por pedido #' || v_order_number::TEXT,
                    p_user_id,
                    now()
                );
            END IF;
        END IF;
    END LOOP;

    -- 8. Si el pedido es para mesa, reflejar ocupación y comanda activa dentro de la misma transacción atómica
    IF p_order_type = 'dine_in' AND p_table_id IS NOT NULL THEN
        UPDATE public.restaurant_tables
        SET status = 'occupied',
            current_order_id = v_order_id,
            updated_at = now()
        WHERE id = p_table_id AND business_id = p_business_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'TABLE_UPDATE_FAILED: No se pudo actualizar el estado de la mesa asignada.';
        END IF;
    END IF;

    -- 9. Retorno exitoso
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'total', v_order_total,
        'is_duplicate', false
    );
END;
$$;

REVOKE ALL ON FUNCTION public.create_restaurant_pos_order FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_restaurant_pos_order TO authenticated, service_role;
