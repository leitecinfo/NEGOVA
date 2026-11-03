-- ==============================================================================
-- NEGOVA SaaS - Migración Versionada: Configuración de Impuestos (IVA/Impoconsumo)
-- Archivo: supabase/migrations/20261029220000_products_taxes_schema.sql
-- Tarea: [CAT-004]
-- Dependencias: [CAT-002], [STOCK-001]
-- Fecha: 2026-10-29
--
-- Objetivos resueltos:
-- 1. Agregar columnas 'tax_percentage' y 'tax_included_in_price' a 'public.products'.
-- 2. Agregar columna 'tax_total' a 'public.restaurant_orders'.
-- 3. Agregar columnas 'tax_percentage', 'tax_included_in_price' y 'tax_amount' a
--    'public.restaurant_order_items'.
-- 4. Actualizar la función atómica 'create_restaurant_pos_order' para recibir p_tax_total,
--    validar totales con o sin impuestos incluidos y registrar el desglose por línea.
-- ==============================================================================

-- 1. Campos tributarios en la tabla de productos
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS tax_percentage NUMERIC DEFAULT 0 CHECK (tax_percentage >= 0 AND tax_percentage <= 100),
    ADD COLUMN IF NOT EXISTS tax_included_in_price BOOLEAN DEFAULT true;

-- 2. Campos de impuestos en órdenes y pedidos
ALTER TABLE public.restaurant_orders
    ADD COLUMN IF NOT EXISTS tax_total NUMERIC DEFAULT 0 CHECK (tax_total >= 0);

-- 3. Campos de desglose tributario en líneas de comanda
ALTER TABLE public.restaurant_order_items
    ADD COLUMN IF NOT EXISTS tax_percentage NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tax_included_in_price BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0;

-- 4. Actualización del RPC de pedidos para soportar p_tax_total y desglose por línea
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
    p_user_id UUID DEFAULT NULL,
    p_tax_total NUMERIC DEFAULT 0
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
    v_safe_tax_total NUMERIC;
BEGIN
    v_safe_tax_total := COALESCE(p_tax_total, 0);

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

    IF NOT EXISTS (
        SELECT 1 FROM public.businesses b
        WHERE b.id = p_business_id AND b.status IN ('active', 'trial')
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
    -- Soporta impuestos incluidos en precio (p_total = p_subtotal + p_delivery_fee)
    -- e impuestos adicionales agregados al checkout (p_total = p_subtotal + p_delivery_fee + p_tax_total)
    IF p_subtotal IS NULL OR p_subtotal < 0 THEN
        RAISE EXCEPTION 'INVALID_SUBTOTAL: El subtotal debe ser mayor o igual a cero.';
    END IF;

    IF p_delivery_fee IS NULL OR p_delivery_fee < 0 THEN
        RAISE EXCEPTION 'INVALID_DELIVERY_FEE: La tarifa de domicilio no puede ser negativa.';
    END IF;

    IF p_total IS NULL OR p_total < 0 THEN
        RAISE EXCEPTION 'INVALID_TOTAL: El total general debe ser mayor o igual a cero.';
    END IF;

    IF p_total <> (p_subtotal + p_delivery_fee) AND p_total <> (p_subtotal + p_delivery_fee + v_safe_tax_total) THEN
        RAISE EXCEPTION 'AMOUNT_MISMATCH: El total (%) no coincide con la suma de subtotal (%) y domicilio (%) [impuestos: %].',
            p_total, p_subtotal, p_delivery_fee, v_safe_tax_total;
    END IF;

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
            IF p_idempotency_hash IS NOT NULL AND v_existing_hash IS NOT NULL AND v_existing_hash <> p_idempotency_hash THEN
                RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: La clave de idempotencia fue reutilizada con datos de comanda diferentes.';
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
            tax_total,
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
            v_safe_tax_total,
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

    -- 6. Inserción atómica de líneas del pedido con desglose tributario y variantes
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id UUID,
        product_name TEXT,
        quantity INTEGER,
        unit_price NUMERIC,
        subtotal NUMERIC,
        notes TEXT,
        modifiers JSONB,
        variant_id TEXT,
        variant_name TEXT,
        tax_percentage NUMERIC,
        tax_included_in_price BOOLEAN,
        tax_amount NUMERIC
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
            variant_name,
            tax_percentage,
            tax_included_in_price,
            tax_amount
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
            v_item.variant_name,
            COALESCE(v_item.tax_percentage, 0),
            COALESCE(v_item.tax_included_in_price, true),
            COALESCE(v_item.tax_amount, 0)
        );
    END LOOP;

    -- 7. [STOCK-001] Descuento atómico de existencias dentro de la misma transacción
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id UUID,
        product_name TEXT,
        quantity INTEGER,
        unit_price NUMERIC,
        subtotal NUMERIC,
        notes TEXT,
        modifiers JSONB
    ) LOOP
        SELECT id, metadata INTO v_product_rec
        FROM public.products
        WHERE id = v_item.product_id AND business_id = p_business_id
        FOR UPDATE;

        IF v_product_rec.id IS NOT NULL AND (
            (v_product_rec.metadata->>'track_stock') = 'true' OR 
            (v_product_rec.metadata->'track_stock') = 'true'::jsonb
        ) THEN
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

    -- 8. Si el pedido es para mesa, reflejar ocupación y comanda activa
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
