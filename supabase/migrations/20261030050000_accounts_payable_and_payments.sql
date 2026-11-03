-- ==============================================================================
-- NEGOVA SaaS - Migración: Cuentas por Pagar y Pagos a Proveedores
-- Tarea: PROV-003 (Paso 20/85, Prioridad P1)
-- ==============================================================================

-- 1. Asegurar tabla de Cuentas por Pagar (public.accounts_payable)
CREATE TABLE IF NOT EXISTS public.accounts_payable (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    purchase_id UUID REFERENCES public.purchases(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    total_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    paid_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    balance NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    due_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'partially_paid', 'paid', 'overdue', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Compatibilidad: si accounts_payable ya existía con total_amount, asegurar columna amount
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'accounts_payable' 
          AND column_name = 'amount'
    ) THEN
        ALTER TABLE public.accounts_payable ADD COLUMN amount NUMERIC(15,2) NOT NULL DEFAULT 0;
        UPDATE public.accounts_payable SET amount = total_amount WHERE amount = 0 AND total_amount > 0;
    END IF;
END $$;

-- Índices para accounts_payable
CREATE INDEX IF NOT EXISTS idx_accounts_payable_business_id ON public.accounts_payable(business_id);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_supplier_id ON public.accounts_payable(business_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_due_date ON public.accounts_payable(business_id, due_date);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_status ON public.accounts_payable(business_id, status);

-- 2. TABLA DE HISTORIAL DE PAGOS A PROVEEDOR (account_payable_payments)
CREATE TABLE IF NOT EXISTS public.account_payable_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    account_payable_id UUID NOT NULL REFERENCES public.accounts_payable(id) ON DELETE CASCADE,
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL DEFAULT 'cash', -- 'cash', 'transfer', 'card', 'other'
    payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    reference TEXT, -- Comprobante, voucher, número de transferencia
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para account_payable_payments
CREATE INDEX IF NOT EXISTS idx_ap_payments_business_id ON public.account_payable_payments(business_id);
CREATE INDEX IF NOT EXISTS idx_ap_payments_account_id ON public.account_payable_payments(account_payable_id);
CREATE INDEX IF NOT EXISTS idx_ap_payments_date ON public.account_payable_payments(business_id, payment_date DESC);

-- 3. POLÍTICAS ROW LEVEL SECURITY (RLS) MULTI-TENANT
ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_payable_payments ENABLE ROW LEVEL SECURITY;

-- RLS accounts_payable
DROP POLICY IF EXISTS "accounts_payable_tenant_isolation" ON public.accounts_payable;
CREATE POLICY "accounts_payable_tenant_isolation"
ON public.accounts_payable
FOR ALL
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

DROP POLICY IF EXISTS "service_role_all_accounts_payable" ON public.accounts_payable;
CREATE POLICY "service_role_all_accounts_payable"
ON public.accounts_payable
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- RLS account_payable_payments
DROP POLICY IF EXISTS "ap_payments_tenant_isolation" ON public.account_payable_payments;
CREATE POLICY "ap_payments_tenant_isolation"
ON public.account_payable_payments
FOR ALL
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

DROP POLICY IF EXISTS "service_role_all_ap_payments" ON public.account_payable_payments;
CREATE POLICY "service_role_all_ap_payments"
ON public.account_payable_payments
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

