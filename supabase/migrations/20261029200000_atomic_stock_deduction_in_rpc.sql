-- ==============================================================================
-- NEGOVA SaaS - Migración Versionada: Descuento de Stock Atómico en RPC PostgreSQL
-- Archivo: supabase/migrations/20261029200000_atomic_stock_deduction_in_rpc.sql
-- Tarea: [STOCK-001]
-- Dependencias: [INV-001], [PERM-001]
-- Fecha: 2026-10-29
-- 
-- Objetivos resueltos:
-- 1. Incorporar el descuento de existencias dentro de la transacción de 'create_restaurant_pos_order'.
-- 2. Descontar tanto en 'public.inventory_stock' (esquema normalizado INV-001) como en 'products.metadata'
--    para mantener retrocompatibilidad total con interfaces legacy.
-- 3. Registrar el movimiento en 'public.inventory_movements' (Kardex inmutable) con tipo 'sale'.
-- 4. Garantizar atomicidad estricta: Si la creación del pedido o cualquiera de sus líneas falla,
--    el stock NO se modifica (rollback total). Si el stock se descuenta, el pedido existe en BD.
-- 5. Manejo idempotente: Si un pedido reintenta con idempotency_key, no descuenta stock duplicado.
-- ==============================================================================

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
        WHERE b.id = p_business_id
          AND b.status NOT IN ('inactive', 'suspended')
    ) THEN
        RAISE EXCEPTION 'BUSINESS_UNAVAILABLE: El negocio no existe o se encuentra inactivo/suspendido.';
    END IF;

    IF p_order_type NOT IN ('dine_in', 'takeout', 'delivery') THEN
        RAISE EXCEPTION 'INVALID_ORDER_TYPE: Destino inválido. Debe ser dine_in, takeout o delivery.';
    END IF;

    IF p_channel_origin NOT IN ('in_person', 'whatsapp', 'digital_menu') THEN
        RAISE EXCEPTION 'INVALID_CHANNEL: Canal inválido. Debe ser in_person, whatsapp o digital_menu.';
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'EMPTY_ITEMS: El pedido debe contener al menos un producto.';
    END IF;

    -- 2. Manejo de idempotencia antes de bloqueos o inserciones (reintento secuencial)
    -- Si la clave de idempotencia ya fue procesada, devolvemos el pedido existente de inmediato
    -- sin intentar volver a descontar existencias ni alterar el stock.
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

    -- 3. Validaciones específicas según destino del pedido
    -- Validar mesa en dine_in con bloqueo pesimista contra concurrencia
    IF p_order_type = 'dine_in' THEN
        IF p_table_id IS NULL THEN
            RAISE EXCEPTION 'TABLE_REQUIRED: Para consumo en mesa debes seleccionar una mesa.';
        END IF;

        -- Bloquear la fila de la mesa dentro de la transacción para serializar y evitar condiciones de carrera concurrentes
        SELECT status INTO v_table_status
        FROM public.restaurant_tables
        WHERE id = p_table_id AND business_id = p_business_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'TABLE_NOT_FOUND: La mesa seleccionada no pertenece a este negocio o no existe.';
        END IF;

        IF v_table_status != 'available' THEN
            -- Defensa en profundidad: Si la mesa se ocupó mientras esperábamos el bloqueo de fila,
            -- verificar si fue ocupada por una petición concurrente con ESTA MISMA clave de idempotencia
            IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) != '' THEN
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

            RAISE EXCEPTION 'TABLE_NOT_AVAILABLE: La mesa seleccionada ya se encuentra ocupada o en atención.';
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

    -- 4. Bloqueo transaccional por tenant para número correlativo seguro frente a concurrencia
    PERFORM pg_advisory_xact_lock(hashtext('negova_order_number_' || p_business_id::TEXT));

    SELECT COALESCE(MAX(order_number), 0) + 1
    INTO v_order_number
    FROM public.restaurant_orders
    WHERE business_id = p_business_id;

    -- 5. Inserción atómica del encabezado (restaurant_orders)
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
            CASE WHEN p_order_type IN ('delivery', 'takeout') THEN NULLIF(trim(p_customer_name), '') ELSE NULL END,
            CASE WHEN p_order_type IN ('delivery', 'takeout') THEN NULLIF(trim(p_customer_phone), '') ELSE NULL END,
            CASE WHEN p_order_type = 'delivery' THEN NULLIF(trim(p_delivery_address), '') ELSE NULL END,
            CASE WHEN p_order_type = 'delivery' THEN NULLIF(trim(p_delivery_reference), '') ELSE NULL END,
            'pending',
            p_idempotency_key,
            p_idempotency_hash,
            p_user_id
        ) RETURNING id, order_number, total INTO v_order_id, v_order_number, v_order_total;

    EXCEPTION WHEN unique_violation THEN
        -- Si dos peticiones simultáneas compitieron con la misma clave
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

    -- 6. Inserción atómica de líneas del pedido (restaurant_order_items)
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
