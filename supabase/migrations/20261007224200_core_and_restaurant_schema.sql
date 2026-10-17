-- ==============================================================================
-- NEGOVA SaaS - Migración: Core Genérico + Vertical Restaurante
-- Tablas Genéricas: categories, products, expenses, payments
-- Tablas Restaurante: restaurant_tables, restaurant_orders, restaurant_order_items
-- ==============================================================================

-- 1. Entidades Genéricas del Core (Extensibles a cualquier comercio)

CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    price NUMERIC NOT NULL,
    status TEXT DEFAULT 'active',
    is_available BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    concept TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    category TEXT,
    description TEXT,
    expense_date DATE NOT NULL,
    status TEXT DEFAULT 'completed',
    created_by UUID, -- Assuming mapped to business_users or auth later
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    reference_type TEXT NOT NULL,
    reference_id UUID NOT NULL,
    amount NUMERIC NOT NULL,
    payment_method TEXT NOT NULL,
    status TEXT DEFAULT 'completed',
    reference TEXT,
    paid_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Entidades Específicas del Vertical Restaurante (Confinadas a gastronomía)

CREATE TABLE IF NOT EXISTS public.restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name_or_number TEXT NOT NULL,
    capacity INTEGER,
    status TEXT DEFAULT 'available',
    current_order_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.restaurant_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    order_number INTEGER NOT NULL,
    status TEXT DEFAULT 'received',
    order_type TEXT NOT NULL,
    channel_origin TEXT NOT NULL,
    subtotal NUMERIC NOT NULL DEFAULT 0,
    delivery_fee NUMERIC DEFAULT 0,
    total NUMERIC NOT NULL DEFAULT 0,
    notes TEXT,
    table_id UUID REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_phone TEXT,
    delivery_address TEXT,
    delivery_reference TEXT,
    delivery_status TEXT,
    driver_name TEXT,
    payment_status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add foreign key constraint after order table is created
ALTER TABLE public.restaurant_tables
    ADD CONSTRAINT fk_current_order FOREIGN KEY (current_order_id) REFERENCES public.restaurant_orders(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.restaurant_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.restaurant_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC NOT NULL,
    subtotal NUMERIC NOT NULL,
    notes TEXT,
    modifiers JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Habilitar RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_order_items ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS (Service role by default has access. Adjust as necessary if app uses service role or anon/authenticated with business_id checks)

CREATE POLICY "service_role_all_categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_products" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_payments" ON public.payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_restaurant_tables" ON public.restaurant_tables FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_restaurant_orders" ON public.restaurant_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_restaurant_order_items" ON public.restaurant_order_items FOR ALL USING (true) WITH CHECK (true);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_cat_business ON public.categories(business_id);
CREATE INDEX IF NOT EXISTS idx_prod_business_cat ON public.products(business_id, category_id);
CREATE INDEX IF NOT EXISTS idx_exp_business_date ON public.expenses(business_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_pay_business_ref ON public.payments(business_id, reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_rest_tables_business ON public.restaurant_tables(business_id);
CREATE INDEX IF NOT EXISTS idx_rest_orders_business_status ON public.restaurant_orders(business_id, status);
CREATE INDEX IF NOT EXISTS idx_rest_order_items_order ON public.restaurant_order_items(order_id);
