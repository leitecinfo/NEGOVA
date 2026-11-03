-- ==============================================================================
-- NEGOVA SaaS - Migración: Esquema de Cotizaciones y Correlativos Atómicos
-- Tarea: [POS-004]
-- Objetivo: Permitir emitir cotizaciones con numeración propia y vigencia configurable,
--           sin afectar inventario ni caja hasta su posterior conversión a venta en POS.
-- ==============================================================================

-- 1. Tabla de secuencias correlativas de cotizaciones por comercio y año
CREATE TABLE IF NOT EXISTS public.quotation_sequences (
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    current_number INTEGER NOT NULL DEFAULT 0 CHECK (current_number >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (business_id, year)
);

CREATE INDEX IF NOT EXISTS idx_quotation_sequences_business_year 
    ON public.quotation_sequences(business_id, year);

ALTER TABLE public.quotation_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_quotation_sequences" ON public.quotation_sequences;
CREATE POLICY "service_role_all_quotation_sequences"
    ON public.quotation_sequences
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 2. Función RPC para obtener el siguiente número correlativo de cotización (COT-YYYY-XXXX)
CREATE OR REPLACE FUNCTION public.get_next_quotation_number(
    p_business_id UUID,
    p_year INTEGER
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_next_val INTEGER;
    v_doc_number TEXT;
BEGIN
    -- Bloqueo atómico por fila (upsert concurrente seguro)
    INSERT INTO public.quotation_sequences (business_id, year, current_number, updated_at)
    VALUES (p_business_id, p_year, 1, now())
    ON CONFLICT (business_id, year)
    DO UPDATE SET
        current_number = public.quotation_sequences.current_number + 1,
        updated_at = now()
    RETURNING current_number INTO v_next_val;

    -- Formato estándar: COT-2026-0001
    v_doc_number := 'COT-' || p_year::TEXT || '-' || lpad(v_next_val::TEXT, 4, '0');
    RETURN v_doc_number;
END;
$$;

-- 3. Tabla principal de Cotizaciones
CREATE TABLE IF NOT EXISTS public.quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    quotation_number TEXT NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL DEFAULT 'Cliente General',
    customer_phone TEXT,
    customer_email TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    discount_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
    tax_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
    total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    currency TEXT NOT NULL DEFAULT 'COP',
    valid_until TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'expired', 'cancelled')),
    converted_order_id UUID REFERENCES public.restaurant_orders(id) ON DELETE SET NULL,
    converted_at TIMESTAMPTZ,
    notes TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (business_id, quotation_number)
);

-- 4. Índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_quotations_business 
    ON public.quotations(business_id);

CREATE INDEX IF NOT EXISTS idx_quotations_business_created 
    ON public.quotations(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quotations_business_status 
    ON public.quotations(business_id, status);

CREATE INDEX IF NOT EXISTS idx_quotations_customer 
    ON public.quotations(customer_id);

CREATE INDEX IF NOT EXISTS idx_quotations_valid_until 
    ON public.quotations(valid_until);

-- 5. Habilitar RLS en public.quotations
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_quotations" ON public.quotations;
CREATE POLICY "service_role_all_quotations"
    ON public.quotations
    FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "business_users_manage_quotations" ON public.quotations;
CREATE POLICY "business_users_manage_quotations"
    ON public.quotations
    FOR ALL
    USING (
        business_id IN (
            SELECT bu.business_id 
            FROM public.business_users bu 
            WHERE bu.user_id = auth.uid() 
              AND bu.status = 'active'
        )
    )
    WITH CHECK (
        business_id IN (
            SELECT bu.business_id 
            FROM public.business_users bu 
            WHERE bu.user_id = auth.uid() 
              AND bu.status = 'active'
        )
    );
