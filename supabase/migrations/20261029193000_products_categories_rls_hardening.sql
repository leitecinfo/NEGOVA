-- ==============================================================================
-- NEGOVA SaaS - Migración Correctiva / Hardening: RLS Catálogo (Products y Categories)
-- Tarea: [SEC-001]
-- 
-- Objetivos:
-- 1. Garantizar que Row Level Security (RLS) esté habilitado y forzado en 'categories' y 'products'.
-- 2. Eliminar cualquier política anónima heredada o permisiva ('categories_anon_view', 'products_anon_view').
-- 3. Restringir políticas 'service_role' exclusivamente al rol 'service_role'.
-- 4. Optimizar las políticas de 'authenticated' utilizando '(SELECT auth.uid())' para evitar
--    re-evaluaciones por fila según las mejores prácticas de Supabase / PostgreSQL.
-- 5. Crear índices de soporte en 'business_users' para acelerar la comprobación de pertenencia.
-- 
-- Idempotencia y Reversibilidad:
-- - Todos los DROP usan IF EXISTS.
-- - Todos los CREATE INDEX usan IF NOT EXISTS.
-- - Las políticas se recrean de forma segura sin pérdida de datos.
-- ==============================================================================

-- 1. Asegurar habilitación de RLS en ambas entidades del Core
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas heredadas o permisivas que puedan exponer datos a PUBLIC o anon
DROP POLICY IF EXISTS "categories_anon_view" ON public.categories;
DROP POLICY IF EXISTS "products_anon_view" ON public.products;
DROP POLICY IF EXISTS "categories_members_all" ON public.categories;
DROP POLICY IF EXISTS "products_members_all" ON public.products;

-- 3. Re-asegurar políticas exclusivas para service_role (Server Actions y Workers)
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

-- 4. Políticas RLS de Aislamiento Tenant para Categorías (public.categories)
DROP POLICY IF EXISTS "tenant_categories_read" ON public.categories;
CREATE POLICY "tenant_categories_read" ON public.categories
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = categories.business_id
              AND bu.user_id = (SELECT auth.uid())
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
              AND bu.user_id = (SELECT auth.uid())
              AND bu.status = 'active'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = categories.business_id
              AND bu.user_id = (SELECT auth.uid())
              AND bu.status = 'active'
        )
    );

-- 5. Políticas RLS de Aislamiento Tenant para Productos (public.products)
DROP POLICY IF EXISTS "tenant_products_read" ON public.products;
CREATE POLICY "tenant_products_read" ON public.products
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = products.business_id
              AND bu.user_id = (SELECT auth.uid())
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
              AND bu.user_id = (SELECT auth.uid())
              AND bu.status = 'active'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = products.business_id
              AND bu.user_id = (SELECT auth.uid())
              AND bu.status = 'active'
        )
    );

-- 6. Índices de soporte y aceleración de consultas multi-tenant
CREATE INDEX IF NOT EXISTS idx_cat_business 
    ON public.categories(business_id);

CREATE INDEX IF NOT EXISTS idx_prod_business_cat 
    ON public.products(business_id, category_id);

CREATE INDEX IF NOT EXISTS idx_categories_business_status 
    ON public.categories(business_id, status);

CREATE INDEX IF NOT EXISTS idx_products_business_status 
    ON public.products(business_id, status);

-- Índice compuesto para acelerar el subquery EXISTS en cada evaluación de RLS
CREATE INDEX IF NOT EXISTS idx_business_users_tenant_auth 
    ON public.business_users(user_id, business_id, status);

