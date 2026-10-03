-- ==============================================================================
-- NEGOVA MVP - Script 04: Índices de Rendimiento y Restricciones
-- Motor: PostgreSQL 15+ / Supabase
-- ==============================================================================

-- 1. Restricción única de consecutivo de pedido por negocio
DO $$ BEGIN
    ALTER TABLE public.orders ADD CONSTRAINT uq_orders_business_number UNIQUE (business_id, order_number);
EXCEPTION
    WHEN duplicate_table THEN null;
    WHEN duplicate_object THEN null;
END $$;

-- 2. Índices para la Cola de Pedidos (Operación de alta concurrencia)
CREATE INDEX IF NOT EXISTS idx_orders_business_status_created 
ON public.orders (business_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_business_created 
ON public.orders (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_customer 
ON public.orders (customer_id);

-- 3. Índices para Catálogo y Menú Digital
CREATE INDEX IF NOT EXISTS idx_products_business_available 
ON public.products (business_id, is_available);

CREATE INDEX IF NOT EXISTS idx_products_category 
ON public.products (category_id, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_categories_business_sort 
ON public.categories (business_id, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_businesses_slug 
ON public.businesses (slug);

-- 4. Índices para Ítems y Pagos
CREATE INDEX IF NOT EXISTS idx_order_items_order 
ON public.order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_product 
ON public.order_items (product_id);

CREATE INDEX IF NOT EXISTS idx_payments_order 
ON public.payments (order_id);

CREATE INDEX IF NOT EXISTS idx_payments_business_created 
ON public.payments (business_id, created_at DESC);

-- 5. Índices para Clientes y Gastos
CREATE INDEX IF NOT EXISTS idx_customers_business_phone 
ON public.customers (business_id, phone);

CREATE INDEX IF NOT EXISTS idx_expenses_business_date 
ON public.expenses (business_id, expense_date DESC);

-- 6. Índices para Historial y Domicilios
CREATE INDEX IF NOT EXISTS idx_order_status_history_order 
ON public.order_status_history (order_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_deliveries_status 
ON public.deliveries (status);
