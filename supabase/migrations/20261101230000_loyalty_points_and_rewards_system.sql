-- ==============================================================================
-- NEGOVA SaaS - Migración Versionada: Sistema de Puntos de Fidelización [FID-001]
-- Archivo: supabase/migrations/20261101230000_loyalty_points_and_rewards_system.sql
-- Fecha: 2026-11-01
--
-- Objetivos:
-- 1. Crear tabla public.loyalty_points (balance acumulado por cliente y negocio).
-- 2. Crear tabla public.loyalty_transactions (historial de acumulaciones, redenciones y ajustes).
-- 3. Crear índices de alto rendimiento y habilitar Row Level Security (RLS) multi-tenant.
-- 4. Crear funciones RPC PostgreSQL para acumulación y redención atómica a prueba de condiciones de carrera.
-- ==============================================================================

-- 1. Tabla de Balance de Puntos de Fidelización (public.loyalty_points)
CREATE TABLE IF NOT EXISTS public.loyalty_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    points_balance INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
    total_earned INTEGER NOT NULL DEFAULT 0 CHECK (total_earned >= 0),
    total_redeemed INTEGER NOT NULL DEFAULT 0 CHECK (total_redeemed >= 0),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_loyalty_points_business_customer UNIQUE (business_id, customer_id)
);

-- 2. Tabla de Transacciones e Historial de Puntos (public.loyalty_transactions)
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    points INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('earned', 'redeemed', 'adjusted', 'expired')),
    reference_id TEXT,
    reference_type TEXT NOT NULL DEFAULT 'order' CHECK (reference_type IN ('order', 'sale_document', 'manual', 'reward')),
    description TEXT,
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Índices de Rendimiento
CREATE INDEX IF NOT EXISTS idx_loyalty_points_business_customer
    ON public.loyalty_points(business_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer
    ON public.loyalty_transactions(business_id, customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_reference
    ON public.loyalty_transactions(business_id, reference_id)
    WHERE reference_id IS NOT NULL;

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS para service_role (Servidor / RPC)
DROP POLICY IF EXISTS "service_role_all_loyalty_points" ON public.loyalty_points;
CREATE POLICY "service_role_all_loyalty_points" ON public.loyalty_points
    TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_loyalty_transactions" ON public.loyalty_transactions;
CREATE POLICY "service_role_all_loyalty_transactions" ON public.loyalty_transactions
    TO service_role USING (true) WITH CHECK (true);

-- 6. Políticas RLS para authenticated (Multi-Tenant por business_id)
DROP POLICY IF EXISTS "loyalty_points_tenant_select" ON public.loyalty_points;
CREATE POLICY "loyalty_points_tenant_select"
    ON public.loyalty_points
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = loyalty_points.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    );

DROP POLICY IF EXISTS "loyalty_transactions_tenant_select" ON public.loyalty_transactions;
CREATE POLICY "loyalty_transactions_tenant_select"
    ON public.loyalty_transactions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = loyalty_transactions.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    );

-- 7. Funciones RPC Transaccionales Atómicas
-- 7.1 Acumulación atómica de puntos
CREATE OR REPLACE FUNCTION public.accumulate_loyalty_points_rpc(
    p_business_id UUID,
    p_customer_id UUID,
    p_points INTEGER,
    p_reference_id TEXT DEFAULT NULL,
    p_reference_type TEXT DEFAULT 'order',
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_balance INTEGER;
    v_total_earned INTEGER;
    v_txn_id UUID;
BEGIN
    IF p_points <= 0 THEN
        RAISE EXCEPTION 'INVALID_POINTS: Los puntos a acumular deben ser mayores a cero.';
    END IF;

    -- Upsert atómico en loyalty_points
    INSERT INTO public.loyalty_points (
        business_id,
        customer_id,
        points_balance,
        total_earned,
        total_redeemed,
        updated_at
    )
    VALUES (
        p_business_id,
        p_customer_id,
        p_points,
        p_points,
        0,
        now()
    )
    ON CONFLICT (business_id, customer_id)
    DO UPDATE SET
        points_balance = loyalty_points.points_balance + p_points,
        total_earned = loyalty_points.total_earned + p_points,
        updated_at = now()
    RETURNING points_balance, total_earned INTO v_new_balance, v_total_earned;

    -- Registro en transacciones
    INSERT INTO public.loyalty_transactions (
        business_id,
        customer_id,
        points,
        type,
        reference_id,
        reference_type,
        description,
        balance_after
    )
    VALUES (
        p_business_id,
        p_customer_id,
        p_points,
        'earned',
        p_reference_id,
        p_reference_type,
        COALESCE(p_description, 'Acumulación por compra'),
        v_new_balance
    )
    RETURNING id INTO v_txn_id;

    RETURN jsonb_build_object(
        'success', true,
        'points_added', p_points,
        'points_balance', v_new_balance,
        'total_earned', v_total_earned,
        'transaction_id', v_txn_id
    );
END;
$$;

-- 7.2 Redención atómica de puntos con bloqueo FOR UPDATE
CREATE OR REPLACE FUNCTION public.redeem_loyalty_points_rpc(
    p_business_id UUID,
    p_customer_id UUID,
    p_points INTEGER,
    p_reference_id TEXT DEFAULT NULL,
    p_reference_type TEXT DEFAULT 'order',
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance INTEGER;
    v_new_balance INTEGER;
    v_total_redeemed INTEGER;
    v_txn_id UUID;
BEGIN
    IF p_points <= 0 THEN
        RAISE EXCEPTION 'INVALID_POINTS: Los puntos a redimir deben ser mayores a cero.';
    END IF;

    -- Bloqueo pesimista del registro del cliente para evitar doble gasto
    SELECT points_balance, total_redeemed
    INTO v_current_balance, v_total_redeemed
    FROM public.loyalty_points
    WHERE business_id = p_business_id AND customer_id = p_customer_id
    FOR UPDATE;

    IF v_current_balance IS NULL THEN
        RAISE EXCEPTION 'CUSTOMER_HAS_NO_LOYALTY_ACCOUNT: El cliente no tiene cuenta de puntos registrada.';
    END IF;

    IF v_current_balance < p_points THEN
        RAISE EXCEPTION 'INSUFFICIENT_LOYALTY_POINTS: Saldo insuficiente. Saldo actual: %, Puntos requeridos: %', v_current_balance, p_points;
    END IF;

    -- Actualización de balance
    UPDATE public.loyalty_points
    SET
        points_balance = points_balance - p_points,
        total_redeemed = total_redeemed + p_points,
        updated_at = now()
    WHERE business_id = p_business_id AND customer_id = p_customer_id
    RETURNING points_balance, total_redeemed INTO v_new_balance, v_total_redeemed;

    -- Registro en transacciones (negativo para redención)
    INSERT INTO public.loyalty_transactions (
        business_id,
        customer_id,
        points,
        type,
        reference_id,
        reference_type,
        description,
        balance_after
    )
    VALUES (
        p_business_id,
        p_customer_id,
        -p_points,
        'redeemed',
        p_reference_id,
        p_reference_type,
        COALESCE(p_description, 'Redención de puntos en compra'),
        v_new_balance
    )
    RETURNING id INTO v_txn_id;

    RETURN jsonb_build_object(
        'success', true,
        'points_redeemed', p_points,
        'points_balance', v_new_balance,
        'total_redeemed', v_total_redeemed,
        'transaction_id', v_txn_id
    );
END;
$$;

