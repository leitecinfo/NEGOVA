-- ==============================================================================
-- NEGOVA SaaS - Migración: Descuento atómico de ingredientes al vender [REC-003]
-- Archivo: supabase/migrations/20261030060000_recipe_ingredients_sale_deduction.sql
-- Tarea: [REC-003] (Paso 24/85, Prioridad P1)
-- Dependencias: [REC-002], [STOCK-001], [INV-001]
--
-- Objetivos resueltos:
-- 1. Cuando se vende un producto con receta activa:
--    - Descontar ingredientes obligatorios proporcionalmente:
--      descuento = cantidad_vendida * (cantidad_ingrediente / porciones)
--    - Crear registro en inventory_movements (tipo 'sale') para cada ingrediente
--    - Validar existencias antes de deducir: si falta stock de algún ingrediente obligatorio,
--      abortar la transacción con: 'Existencias insuficientes para «X». Disponibles: Y u, requeridas: Z u'
-- 2. Ingredientes opcionales (is_optional = true): NO se descuentan automáticamente ni bloquean la venta.
-- 3. Productos sin receta activa: mantienen el descuento directo de stock del producto (STOCK-001).
-- ==============================================================================

DROP FUNCTION IF EXISTS public.create_restaurant_pos_order(uuid, text, text, numeric, numeric, numeric, jsonb, uuid, text, text, text, text, text, text, text, uuid);

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

    -- Variables para escandallo y recetas [REC-003]
    v_recipe_rec RECORD;
    v_ing_rec RECORD;
    v_recipe_portions INTEGER;
    v_target_location_id UUID;
    v_required_qty NUMERIC;
    v_avail_qty NUMERIC;
    v_ingredient_cost NUMERIC;
    v_disp_avail TEXT;
    v_disp_req TEXT;
BEGIN
    v_safe_tax_total := COALESCE(p_tax_total, 0);

    -- 0. Verificación estricta de seguridad multi-tenant y prevención de accesos anónimos
    IF auth.role() = 'anon' THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Las solicitudes anónimas no tienen autorización para registrar comandas.';
    END IF;

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

    IF p_order_type = 'delivery' THEN
        IF p_delivery_address IS NULL OR length(trim(p_delivery_address)) = 0 THEN
            RAISE EXCEPTION 'ADDRESS_REQUIRED: Los pedidos a domicilio requieren una dirección de entrega.';
        END IF;
    END IF;

    -- 2. Validación de coherencia de montos
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

    -- 4. Serialización estricta por tenant para numeración de comanda correlativa
    PERFORM pg_advisory_xact_lock(hashtext('biz_order_seq_' || p_business_id::TEXT));

    SELECT COALESCE(MAX(order_number), 0) + 1
    INTO v_order_number
    FROM public.restaurant_orders
    WHERE business_id = p_business_id;

    -- 5. Creación de la cabecera del Pedido
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
            'received',
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

    -- 6. Inserción atómica de líneas del pedido
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

    -- Ubicación por defecto de salida para el negocio
    SELECT id INTO v_default_location_id
    FROM public.locations
    WHERE business_id = p_business_id
    ORDER BY (type = 'point_of_sale') DESC, created_at ASC
    LIMIT 1;

    -- =========================================================================
    -- 7. [REC-003] FASE 1: VALIDACIÓN DE EXISTENCIAS (TODO O NADA)
    -- =========================================================================
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id UUID,
        product_name TEXT,
        quantity INTEGER
    ) LOOP
        -- Verificar si el producto tiene receta activa
        SELECT r.id, r.portions, r.location_id
        INTO v_recipe_rec
        FROM public.recipes r
        WHERE r.product_id = v_item.product_id
          AND r.business_id = p_business_id
          AND r.status = 'active'
        LIMIT 1;

        IF v_recipe_rec.id IS NOT NULL THEN
            -- Caso con receta: validar existencias de cada ingrediente obligatorio
            v_recipe_portions := GREATEST(1, COALESCE(v_recipe_rec.portions, 1));
            v_target_location_id := COALESCE(v_recipe_rec.location_id, v_default_location_id);

            FOR v_ing_rec IN (
                SELECT 
                    ri.ingredient_id,
                    ri.quantity AS ingredient_qty,
                    ri.unit,
                    ri.is_optional,
                    p.name AS ingredient_name,
                    p.metadata AS ingredient_meta
                FROM public.recipe_ingredients ri
                JOIN public.products p ON p.id = ri.ingredient_id
                WHERE ri.recipe_id = v_recipe_rec.id
                ORDER BY ri.sort_order ASC
            ) LOOP
                -- Regla de Negocio: Los ingredientes opcionales NO bloquean la venta
                IF v_ing_rec.is_optional IS TRUE THEN
                    CONTINUE;
                END IF;

                -- Cantidad requerida = cantidad_vendida * (cantidad_ingrediente / porciones)
                v_required_qty := (v_item.quantity::numeric * v_ing_rec.ingredient_qty::numeric) / v_recipe_portions::numeric;

                -- Consultar stock actual del ingrediente en ubicación
                v_avail_qty := NULL;
                IF v_target_location_id IS NOT NULL THEN
                    SELECT quantity INTO v_avail_qty
                    FROM public.inventory_stock
                    WHERE business_id = p_business_id
                      AND product_id = v_ing_rec.ingredient_id
                      AND location_id = v_target_location_id;
                END IF;

                IF v_avail_qty IS NULL THEN
                    v_avail_qty := COALESCE(
                        CASE 
                            WHEN (v_ing_rec.ingredient_meta->>'stock_quantity') ~ '^-?[0-9]+(\.[0-9]+)?$' 
                            THEN (v_ing_rec.ingredient_meta->>'stock_quantity')::numeric 
                            ELSE 0 
                        END, 
                        0
                    );
                END IF;

                IF v_avail_qty < v_required_qty THEN
                    -- Formatear números limpios (ej: '0.3', '1')
                    v_disp_avail := CASE 
                        WHEN v_avail_qty = 0 THEN '0' 
                        ELSE TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM v_avail_qty::numeric::text)) 
                    END;
                    v_disp_req := CASE 
                        WHEN v_required_qty = 0 THEN '0' 
                        ELSE TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM v_required_qty::numeric::text)) 
                    END;

                    RAISE EXCEPTION 'Existencias insuficientes para «%». Disponibles: % %, requeridas: % %',
                        v_ing_rec.ingredient_name,
                        v_disp_avail,
                        v_ing_rec.unit,
                        v_disp_req,
                        v_ing_rec.unit;
                END IF;
            END LOOP;
        END IF;
    END LOOP;

    -- =========================================================================
    -- 7. [REC-003] FASE 2: DESCUENTO ATÓMICO Y REGISTRO EN KARDEX
    -- =========================================================================
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id UUID,
        product_name TEXT,
        quantity INTEGER
    ) LOOP
        -- Verificar si el producto tiene receta activa
        SELECT r.id, r.portions, r.location_id
        INTO v_recipe_rec
        FROM public.recipes r
        WHERE r.product_id = v_item.product_id
          AND r.business_id = p_business_id
          AND r.status = 'active'
        LIMIT 1;

        IF v_recipe_rec.id IS NOT NULL THEN
            -- CASO 1: Producto CON receta -> Descontar ingredientes obligatorios proporcionalmente
            v_recipe_portions := GREATEST(1, COALESCE(v_recipe_rec.portions, 1));
            v_target_location_id := COALESCE(v_recipe_rec.location_id, v_default_location_id);

            FOR v_ing_rec IN (
                SELECT 
                    ri.ingredient_id,
                    ri.quantity AS ingredient_qty,
                    ri.unit,
                    ri.is_optional,
                    p.name AS ingredient_name,
                    p.metadata AS ingredient_meta
                FROM public.recipe_ingredients ri
                JOIN public.products p ON p.id = ri.ingredient_id
                WHERE ri.recipe_id = v_recipe_rec.id
                ORDER BY ri.sort_order ASC
            ) LOOP
                -- Regla de Negocio: Los ingredientes opcionales NO se descuentan automáticamente
                IF v_ing_rec.is_optional IS TRUE THEN
                    CONTINUE;
                END IF;

                v_required_qty := (v_item.quantity::numeric * v_ing_rec.ingredient_qty::numeric) / v_recipe_portions::numeric;

                -- Obtener costo unitario del ingrediente
                SELECT cost INTO v_ingredient_cost
                FROM public.inventory_stock
                WHERE business_id = p_business_id
                  AND product_id = v_ing_rec.ingredient_id
                  AND location_id = v_target_location_id;

                IF v_ingredient_cost IS NULL THEN
                    v_ingredient_cost := COALESCE(
                        CASE 
                            WHEN (v_ing_rec.ingredient_meta->>'cost') ~ '^-?[0-9]+(\.[0-9]+)?$' 
                            THEN (v_ing_rec.ingredient_meta->>'cost')::numeric 
                            ELSE 0 
                        END, 
                        0
                    );
                END IF;

                -- Descontar de inventory_stock
                IF v_target_location_id IS NOT NULL THEN
                    UPDATE public.inventory_stock
                    SET quantity = quantity - v_required_qty,
                        updated_at = now()
                    WHERE business_id = p_business_id
                      AND product_id = v_ing_rec.ingredient_id
                      AND location_id = v_target_location_id;

                    IF NOT FOUND THEN
                        INSERT INTO public.inventory_stock (
                            id,
                            business_id,
                            product_id,
                            location_id,
                            quantity,
                            cost,
                            created_at,
                            updated_at
                        ) VALUES (
                            gen_random_uuid(),
                            p_business_id,
                            v_ing_rec.ingredient_id,
                            v_target_location_id,
                            -v_required_qty,
                            v_ingredient_cost,
                            now(),
                            now()
                        );
                    END IF;
                END IF;

                -- Descontar de products.metadata (stock consolidado del ingrediente)
                v_current_stock := COALESCE(
                    CASE 
                        WHEN (v_ing_rec.ingredient_meta->>'stock_quantity') ~ '^-?[0-9]+(\.[0-9]+)?$' 
                        THEN (v_ing_rec.ingredient_meta->>'stock_quantity')::numeric 
                        ELSE 0 
                    END, 
                    0
                );
                v_new_stock := GREATEST(0, v_current_stock - v_required_qty);

                UPDATE public.products
                SET metadata = jsonb_set(metadata, '{stock_quantity}', to_jsonb(v_new_stock)),
                    updated_at = now()
                WHERE id = v_ing_rec.ingredient_id AND business_id = p_business_id;

                -- Registrar movimiento en Kardex para el ingrediente
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
                    v_ing_rec.ingredient_id,
                    v_target_location_id,
                    'sale',
                    v_required_qty,
                    v_ingredient_cost,
                    v_ingredient_cost * v_required_qty,
                    v_order_id,
                    'sale',
                    'Descuento por receta de ' || v_item.product_name || ' (pedido #' || v_order_number::TEXT || ')',
                    p_user_id,
                    now()
                );
            END LOOP;

        ELSE
            -- CASO 2: Producto SIN receta -> Descuento directo de stock del producto (STOCK-001)
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

REVOKE ALL ON FUNCTION public.create_restaurant_pos_order(uuid, text, text, numeric, numeric, numeric, jsonb, uuid, text, text, text, text, text, text, text, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_restaurant_pos_order(uuid, text, text, numeric, numeric, numeric, jsonb, uuid, text, text, text, text, text, text, text, uuid, numeric) TO authenticated, service_role;
