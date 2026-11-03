-- ==============================================================================
-- NEGOVA SaaS - Migración Versionada: Crédito a Clientes y Cuentas por Cobrar [CLI-002]
-- Archivo: supabase/migrations/20261030070000_customer_credit_and_accounts_receivable.sql
-- Fecha: 2026-10-30
--
-- Objetivos:
-- 1. Añadir columnas credit_limit y credit_used a public.customers.
-- 2. Crear tabla public.accounts_receivable para gestionar cuentas por cobrar.
-- 3. Crear tabla public.customer_payments para registrar abonos de clientes.
-- 4. Configurar índices de rendimiento y políticas RLS multi-tenant por business_id.
-- ==============================================================================

-- 1. Añadir campos de crédito a public.customers
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
    ADD COLUMN IF NOT EXISTS credit_used NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (credit_used >= 0);

CREATE INDEX IF NOT EXISTS idx_customers_business_credit_limit
    ON public.customers(business_id, credit_limit)
    WHERE credit_limit > 0;

CREATE INDEX IF NOT EXISTS idx_customers_business_credit_used
    ON public.customers(business_id, credit_used)
    WHERE credit_used > 0;

-- 2. Tabla de Cuentas por Cobrar (public.accounts_receivable)
CREATE TABLE IF NOT EXISTS public.accounts_receivable (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.restaurant_orders(id) ON DELETE SET NULL,
    sale_document_id UUID REFERENCES public.business_sale_documents(id) ON DELETE SET NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    balance NUMERIC(14,2) NOT NULL CHECK (balance >= 0),
    due_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue', 'cancelled')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounts_receivable_business_id
    ON public.accounts_receivable(business_id);

CREATE INDEX IF NOT EXISTS idx_accounts_receivable_customer_id
    ON public.accounts_receivable(business_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_accounts_receivable_status_due
    ON public.accounts_receivable(business_id, status, due_date);

-- 3. Tabla de Abonos / Pagos de Clientes (public.customer_payments)
CREATE TABLE IF NOT EXISTS public.customer_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    receivable_id UUID NOT NULL REFERENCES public.accounts_receivable(id) ON DELETE CASCADE,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL DEFAULT 'cash',
    payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    reference TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_payments_business_id
    ON public.customer_payments(business_id);

CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_id
    ON public.customer_payments(business_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_payments_receivable_id
    ON public.customer_payments(receivable_id);

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para public.accounts_receivable
DROP POLICY IF EXISTS "accounts_receivable_tenant_select" ON public.accounts_receivable;
CREATE POLICY "accounts_receivable_tenant_select"
    ON public.accounts_receivable
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = accounts_receivable.business_id
              AND bu.user_id = (SELECT auth.uid())
              AND bu.status = 'active'
        )
    );

DROP POLICY IF EXISTS "accounts_receivable_tenant_insert" ON public.accounts_receivable;
CREATE POLICY "accounts_receivable_tenant_insert"
    ON public.accounts_receivable
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = accounts_receivable.business_id
              AND bu.user_id = (SELECT auth.uid())
              AND bu.status = 'active'
        )
    );

DROP POLICY IF EXISTS "accounts_receivable_tenant_update" ON public.accounts_receivable;
CREATE POLICY "accounts_receivable_tenant_update"
    ON public.accounts_receivable
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = accounts_receivable.business_id
              AND bu.user_id = (SELECT auth.uid())
              AND bu.status = 'active'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = accounts_receivable.business_id
              AND bu.user_id = (SELECT auth.uid())
              AND bu.status = 'active'
        )
    );

DROP POLICY IF EXISTS "accounts_receivable_tenant_delete" ON public.accounts_receivable;
CREATE POLICY "accounts_receivable_tenant_delete"
    ON public.accounts_receivable
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = accounts_receivable.business_id
              AND bu.user_id = (SELECT auth.uid())
              AND bu.status = 'active'
        )
    );

-- Políticas RLS para public.customer_payments
DROP POLICY IF EXISTS "customer_payments_tenant_select" ON public.customer_payments;
CREATE POLICY "customer_payments_tenant_select"
    ON public.customer_payments
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = customer_payments.business_id
              AND bu.user_id = (SELECT auth.uid())
              AND bu.status = 'active'
        )
    );

DROP POLICY IF EXISTS "customer_payments_tenant_insert" ON public.customer_payments;
CREATE POLICY "customer_payments_tenant_insert"
    ON public.customer_payments
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = customer_payments.business_id
              AND bu.user_id = (SELECT auth.uid())
              AND bu.status = 'active'
        )
    );
