-- ==============================================================================
-- NEGOVA SaaS - Migración: Etapa 3 (Pedidos y Comandas POS, Destinos y Mesas)
-- Tablas: restaurant_tables, restaurant_orders, restaurant_order_items
-- Garantiza: aislamiento multi-tenant estricto (business_id), RLS, idempotencia y snapshots
-- ==============================================================================

-- 1. Tabla de Mesas del Negocio (restaurant_tables)
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name_or_number TEXT NOT NULL,
    capacity INTEGER DEFAULT 4,
    status TEXT NOT NULL DEFAULT 'available',
    current_order_id UUID,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla de Pedidos y Comandas Multicanal (restaurant_orders)
CREATE TABLE IF NOT EXISTS public.restaurant_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    order_number INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'received',
    order_type TEXT NOT NULL,           -- 'dine_in' (Mesa), 'takeout' (Para llevar), 'delivery' (Domicilio)
    channel_origin TEXT NOT NULL,       -- 'in_person' (Presencial), 'whatsapp' (WhatsApp)
    subtotal NUMERIC NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    delivery_fee NUMERIC NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
    total NUMERIC NOT NULL DEFAULT 0 CHECK (total >= 0),
    notes TEXT,
    table_id UUID REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_phone TEXT,
    delivery_address TEXT,
    delivery_reference TEXT,
    delivery_status TEXT,
    driver_name TEXT,
    payment_status TEXT NOT NULL DEFAULT 'pending',
    idempotency_key TEXT,
    idempotency_hash TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Foreign key diferida para current_order_id en restaurant_tables
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_restaurant_tables_current_order'
    ) THEN
        ALTER TABLE public.restaurant_tables
            ADD CONSTRAINT fk_restaurant_tables_current_order
            FOREIGN KEY (current_order_id) REFERENCES public.restaurant_orders(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Tabla de Detalle de Ítems del Pedido (restaurant_order_items)
CREATE TABLE IF NOT EXISTS public.restaurant_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.restaurant_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,         -- Snapshot histórico congelado
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC NOT NULL CHECK (unit_price >= 0), -- Snapshot histórico unitario
    subtotal NUMERIC NOT NULL CHECK (subtotal >= 0),     -- Snapshot histórico subtotal línea
    notes TEXT,
    modifiers JSONB DEFAULT '[]'::jsonb, -- Snapshot histórico de complementos seleccionados
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_order_items ENABLE ROW LEVEL SECURITY;

-- 5. Políticas para service_role (Servidor / Worker)
DROP POLICY IF EXISTS "service_role_all_restaurant_tables" ON public.restaurant_tables;
CREATE POLICY "service_role_all_restaurant_tables" ON public.restaurant_tables
    TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_restaurant_orders" ON public.restaurant_orders;
CREATE POLICY "service_role_all_restaurant_orders" ON public.restaurant_orders
    TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_restaurant_order_items" ON public.restaurant_order_items;
CREATE POLICY "service_role_all_restaurant_order_items" ON public.restaurant_order_items
    TO service_role USING (true) WITH CHECK (true);

-- 6. Políticas de aislamiento por tenant para authenticated (Multi-Tenant - Lectura estricta)
-- Las inserciones deben realizarse exclusivamente vía la RPC transaccional create_restaurant_pos_order
-- utilizando service_role tras la debida validación RBAC, previniendo bypass de precios y reglas de negocio.
-- restaurant_tables
DROP POLICY IF EXISTS "tenant_tables_read" ON public.restaurant_tables;
CREATE POLICY "tenant_tables_read" ON public.restaurant_tables
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = restaurant_tables.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    );

-- restaurant_orders
DROP POLICY IF EXISTS "tenant_orders_read" ON public.restaurant_orders;
CREATE POLICY "tenant_orders_read" ON public.restaurant_orders
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = restaurant_orders.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    );

-- Eliminadas expresamente políticas de INSERT/UPDATE/DELETE para authenticated en restaurant_orders:
-- Las mutaciones son canalizadas obligatoriamente por el backend y la función RPC atómica.
DROP POLICY IF EXISTS "tenant_orders_insert" ON public.restaurant_orders;

-- restaurant_order_items
DROP POLICY IF EXISTS "tenant_order_items_read" ON public.restaurant_order_items;
CREATE POLICY "tenant_order_items_read" ON public.restaurant_order_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = restaurant_order_items.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    );

-- Eliminadas expresamente políticas de INSERT/UPDATE/DELETE para authenticated en restaurant_order_items:
-- Las líneas y modificadores solo pueden ser persistidos atómicamente junto al encabezado por la RPC.
DROP POLICY IF EXISTS "tenant_order_items_insert" ON public.restaurant_order_items;

-- 7. Índices de optimización de consultas e integridad referencial
CREATE INDEX IF NOT EXISTS idx_tables_business_status ON public.restaurant_tables(business_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_business_status_created ON public.restaurant_orders(business_id, status, created_at DESC);
-- Índice único estricto para consecutivos por tenant: previene colisiones a nivel de motor de almacenamiento
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_business_number ON public.restaurant_orders(business_id, order_number);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.restaurant_order_items(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency ON public.restaurant_orders(business_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
