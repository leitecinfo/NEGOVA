-- ==============================================================================
-- NEGOVA SaaS - Migración Versionada: Gastos Operativos y de Producción [GAS-001 & GAS-002]
-- Archivo: supabase/migrations/20261030080000_expenses_and_production_costs_schema.sql
-- Fecha: 2026-10-30
--
-- Objetivos:
-- 1. Asegurar la estructura integral de public.expenses con diferenciación operativa vs producción.
-- 2. Añadir campos para vinculación a materias primas/ingredientes (product_id, update_product_cost).
-- 3. Configurar índices de rendimiento y políticas RLS multi-tenant por business_id.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    concept TEXT NOT NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
    category TEXT NOT NULL DEFAULT 'Otros Operativos',
    expense_type TEXT NOT NULL DEFAULT 'operational' CHECK (expense_type IN ('operational', 'production')),
    description TEXT,
    expense_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    payment_method TEXT DEFAULT 'efectivo',
    receipt_number TEXT,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    unit_cost NUMERIC(14,2),
    quantity NUMERIC(14,3),
    update_product_cost BOOLEAN DEFAULT false,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Asegurar columnas si la tabla ya existía previamente
ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS expense_type TEXT NOT NULL DEFAULT 'operational',
    ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'efectivo',
    ADD COLUMN IF NOT EXISTS receipt_number TEXT,
    ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(14,3),
    ADD COLUMN IF NOT EXISTS update_product_cost BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- Índices de consulta frecuente
CREATE INDEX IF NOT EXISTS idx_expenses_business_id
    ON public.expenses(business_id);

CREATE INDEX IF NOT EXISTS idx_expenses_business_type_date
    ON public.expenses(business_id, expense_type, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_business_category
    ON public.expenses(business_id, category);

CREATE INDEX IF NOT EXISTS idx_expenses_business_product
    ON public.expenses(business_id, product_id)
    WHERE product_id IS NOT NULL;

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "expenses_select_policy" ON public.expenses;
    DROP POLICY IF EXISTS "expenses_insert_policy" ON public.expenses;
    DROP POLICY IF EXISTS "expenses_update_policy" ON public.expenses;
    DROP POLICY IF EXISTS "expenses_delete_policy" ON public.expenses;
END $$;

CREATE POLICY "expenses_select_policy"
    ON public.expenses
    FOR SELECT
    USING (
        business_id IN (
            SELECT bu.business_id
            FROM public.business_users bu
            WHERE bu.user_id = auth.uid() AND bu.is_active = true
        )
    );

CREATE POLICY "expenses_insert_policy"
    ON public.expenses
    FOR INSERT
    WITH CHECK (
        business_id IN (
            SELECT bu.business_id
            FROM public.business_users bu
            WHERE bu.user_id = auth.uid() AND bu.is_active = true
        )
    );

CREATE POLICY "expenses_update_policy"
    ON public.expenses
    FOR UPDATE
    USING (
        business_id IN (
            SELECT bu.business_id
            FROM public.business_users bu
            WHERE bu.user_id = auth.uid() AND bu.is_active = true
        )
    )
    WITH CHECK (
        business_id IN (
            SELECT bu.business_id
            FROM public.business_users bu
            WHERE bu.user_id = auth.uid() AND bu.is_active = true
        )
    );

CREATE POLICY "expenses_delete_policy"
    ON public.expenses
    FOR DELETE
    USING (
        business_id IN (
            SELECT bu.business_id
            FROM public.business_users bu
            WHERE bu.user_id = auth.uid() AND bu.is_active = true
        )
    );

