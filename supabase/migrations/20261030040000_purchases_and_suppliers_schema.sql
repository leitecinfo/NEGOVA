-- ==============================================================================
-- NEGOVA SaaS - Migración: Directorio de Proveedores, Compras y Cuentas por Pagar
-- Tareas: PROV-001 y PROV-002
-- Tablas:
--   - public.suppliers
--   - public.purchases
--   - public.purchase_items
--   - public.accounts_payable
--   - public.purchase_sequences
-- ==============================================================================

-- 1. TABLA DE PROVEEDORES (suppliers)
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    tax_id TEXT, -- NIT / Cédula / RUT
    payment_terms_days INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_business_status ON public.suppliers(business_id, status);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers(business_id, name);

-- RLS para suppliers
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_tenant_isolation" ON public.suppliers;
CREATE POLICY "suppliers_tenant_isolation"
ON public.suppliers
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

DROP POLICY IF EXISTS "service_role_all_suppliers" ON public.suppliers;
CREATE POLICY "service_role_all_suppliers"
ON public.suppliers
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 2. TABLA DE SECUENCIAS DE COMPRAS (purchase_sequences)
CREATE TABLE IF NOT EXISTS public.purchase_sequences (
    business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
    current_number INTEGER NOT NULL DEFAULT 0 CHECK (current_number >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_purchase_sequences" ON public.purchase_sequences;
CREATE POLICY "service_role_all_purchase_sequences"
ON public.purchase_sequences
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Función atómica para generar el siguiente número de compra (COMP-XXXXX)
CREATE OR REPLACE FUNCTION public.get_next_purchase_number(p_business_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_next_num INTEGER;
    v_code TEXT;
BEGIN
    INSERT INTO public.purchase_sequences (business_id, current_number, updated_at)
    VALUES (p_business_id, 1, now())
    ON CONFLICT (business_id)
    DO UPDATE SET 
        current_number = public.purchase_sequences.current_number + 1,
        updated_at = now()
    RETURNING current_number INTO v_next_num;

    v_code := 'COMP-' || LPAD(v_next_num::TEXT, 5, '0');
    RETURN v_code;
END;
$$;

-- 3. TABLA DE COMPRAS (purchases)
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    purchase_number TEXT NOT NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    invoice_number TEXT,
    purchase_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    subtotal NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    total NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    payment_type TEXT NOT NULL DEFAULT 'cash' CHECK (payment_type IN ('cash', 'credit')),
    payment_method TEXT NOT NULL DEFAULT 'cash', -- 'cash', 'transfer', 'card', 'other'
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(business_id, purchase_number)
);

CREATE INDEX IF NOT EXISTS idx_purchases_business_date ON public.purchases(business_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON public.purchases(business_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON public.purchases(business_id, status);

-- RLS para purchases
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchases_tenant_isolation" ON public.purchases;
CREATE POLICY "purchases_tenant_isolation"
ON public.purchases
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

DROP POLICY IF EXISTS "service_role_all_purchases" ON public.purchases;
CREATE POLICY "service_role_all_purchases"
ON public.purchases
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 4. TABLA DE ÍTEMS DE COMPRA (purchase_items)
CREATE TABLE IF NOT EXISTS public.purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    item_name TEXT NOT NULL,
    quantity NUMERIC(15,4) NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    total_cost NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    is_inventory_item BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON public.purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON public.purchase_items(business_id, product_id);

-- RLS para purchase_items
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchase_items_tenant_isolation" ON public.purchase_items;
CREATE POLICY "purchase_items_tenant_isolation"
ON public.purchase_items
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

DROP POLICY IF EXISTS "service_role_all_purchase_items" ON public.purchase_items;
CREATE POLICY "service_role_all_purchase_items"
ON public.purchase_items
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 5. TABLA DE CUENTAS POR PAGAR (accounts_payable)
CREATE TABLE IF NOT EXISTS public.accounts_payable (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    total_amount NUMERIC(15,2) NOT NULL CHECK (total_amount >= 0),
    paid_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    balance NUMERIC(15,2) NOT NULL CHECK (balance >= 0),
    due_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partially_paid', 'paid', 'overdue', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounts_payable_due_date ON public.accounts_payable(business_id, due_date);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_status ON public.accounts_payable(business_id, status);

-- RLS para accounts_payable
ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;

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

