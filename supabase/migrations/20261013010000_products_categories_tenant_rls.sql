-- ==============================================================================
-- NEGOVA SaaS - Migración: Catálogo de Productos, Categorías y Políticas RLS
-- Garantiza la creación de tablas, índices y aislamiento estricto por tenant (business_id)
-- ==============================================================================

-- 1. Asegurar existencia de las tablas del Core (si no existen previamente)
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

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 3. Corregir y restringir políticas heredadas a service_role exclusivamente
-- (Evita que apliquen a PUBLIC por omisión de la cláusula TO)
DROP POLICY IF EXISTS "service_role_all_categories" ON public.categories;
CREATE POLICY "service_role_all_categories" ON public.categories
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_products" ON public.products;
CREATE POLICY "service_role_all_products" ON public.products
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 4. Políticas RLS para Categorías (public.categories)
DROP POLICY IF EXISTS "tenant_categories_read" ON public.categories;
CREATE POLICY "tenant_categories_read" ON public.categories
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = categories.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    );

DROP POLICY IF EXISTS "tenant_categories_write" ON public.categories;
CREATE POLICY "tenant_categories_write" ON public.categories
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = categories.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = categories.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    );

-- 5. Políticas RLS para Productos (public.products)
DROP POLICY IF EXISTS "tenant_products_read" ON public.products;
CREATE POLICY "tenant_products_read" ON public.products
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = products.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    );

DROP POLICY IF EXISTS "tenant_products_write" ON public.products;
CREATE POLICY "tenant_products_write" ON public.products
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = products.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = products.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    );

-- 6. Índices para optimización de rendimiento y búsquedas multi-tenant
CREATE INDEX IF NOT EXISTS idx_cat_business ON public.categories(business_id);
CREATE INDEX IF NOT EXISTS idx_prod_business_cat ON public.products(business_id, category_id);
CREATE INDEX IF NOT EXISTS idx_categories_business_status ON public.categories(business_id, status);
CREATE INDEX IF NOT EXISTS idx_products_business_status ON public.products(business_id, status);
