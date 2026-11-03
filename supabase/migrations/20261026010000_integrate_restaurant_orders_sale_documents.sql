-- ==============================================================================
-- NEGOVA SaaS - Migración: Integración restaurant_orders con business_sale_documents
-- Tarea: [INT-001]
-- Objetivo: Vincular pedidos operativos al completar pago con documentos comerciales de venta
-- ==============================================================================

-- 1. Añadir FK opcional restaurant_order_id en business_sale_documents
ALTER TABLE public.business_sale_documents
    ADD COLUMN IF NOT EXISTS restaurant_order_id UUID REFERENCES public.restaurant_orders(id) ON DELETE SET NULL;

-- 2. Índice único condicional: garantiza que un pedido de restaurante solo genere UN documento de venta por negocio
CREATE UNIQUE INDEX IF NOT EXISTS idx_bsd_restaurant_order_unique
    ON public.business_sale_documents(business_id, restaurant_order_id)
    WHERE restaurant_order_id IS NOT NULL;

-- 3. Índice para búsquedas rápidas por restaurant_order_id
CREATE INDEX IF NOT EXISTS idx_bsd_restaurant_order
    ON public.business_sale_documents(restaurant_order_id);

-- 4. Estrategia para pedidos históricos completados:
--    Para cada restaurant_order con payment_status = 'paid' que no tenga documento en business_sale_documents,
--    se genera de forma determinista y secuencial su comprobante de venta oficial.
DO $$
DECLARE
    r RECORD;
    v_doc_number TEXT;
    v_year INTEGER;
    v_doc_id TEXT;
    v_items JSONB;
BEGIN
    FOR r IN 
        SELECT ro.* 
        FROM public.restaurant_orders ro
        LEFT JOIN public.business_sale_documents bsd 
               ON bsd.business_id = ro.business_id 
              AND bsd.restaurant_order_id = ro.id
        WHERE ro.payment_status = 'paid'
          AND bsd.id IS NULL
        ORDER BY ro.created_at ASC
    LOOP
        v_year := EXTRACT(YEAR FROM COALESCE(r.created_at, now()))::INTEGER;

        -- Generar número correlativo con la función RPC existente si está disponible
        BEGIN
            v_doc_number := public.get_next_business_document_number(r.business_id, v_year);
        EXCEPTION WHEN OTHERS THEN
            v_doc_number := 'DOC-' || v_year::TEXT || '-ORD-' || lpad(r.order_number::TEXT, 4, '0');
        END;

        v_doc_id := 'doc-' || substr(r.business_id::text, 1, 6) || '-' || extract(epoch from COALESCE(r.created_at, now()))::bigint || '-' || r.order_number;

        -- Construir snapshot de ítems desde restaurant_order_items
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', roi.id,
                'productId', roi.product_id,
                'description', roi.product_name,
                'quantity', roi.quantity,
                'unitPrice', roi.unit_price,
                'discount', 0,
                'total', roi.subtotal
            )
        )
        INTO v_items
        FROM public.restaurant_order_items roi
        WHERE roi.order_id = r.id;

        IF v_items IS NULL THEN
            v_items := '[]'::jsonb;
        END IF;

        IF COALESCE(r.delivery_fee, 0) > 0 THEN
            v_items := v_items || jsonb_build_array(
                jsonb_build_object(
                    'id', 'fee-' || r.id::text,
                    'description', 'Costo de Domicilio / Envío',
                    'quantity', 1,
                    'unitPrice', r.delivery_fee,
                    'discount', 0,
                    'total', r.delivery_fee
                )
            );
        END IF;

        INSERT INTO public.business_sale_documents (
            id,
            business_id,
            restaurant_order_id,
            document_number,
            document_type,
            customer_name,
            customer_phone,
            customer_address,
            items,
            subtotal,
            discount_total,
            tax_total,
            total,
            currency,
            payment_method,
            status,
            issued_at,
            notes,
            created_at,
            updated_at
        ) VALUES (
            v_doc_id,
            r.business_id,
            r.id,
            v_doc_number,
            'order',
            COALESCE(NULLIF(trim(r.customer_name), ''), 'Consumidor Final'),
            r.customer_phone,
            r.delivery_address,
            v_items,
            r.subtotal,
            0,
            0,
            r.total,
            'COP',
            'cash',
            CASE WHEN r.status = 'cancelled' THEN 'cancelled' ELSE 'paid' END,
            COALESCE(r.created_at, now()),
            r.notes,
            COALESCE(r.created_at, now()),
            now()
        )
        ON CONFLICT (business_id, document_number) DO NOTHING;
    END LOOP;
END $$;
