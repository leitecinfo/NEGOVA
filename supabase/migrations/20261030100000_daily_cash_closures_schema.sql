-- ==============================================================================
-- NEGOVA SaaS - Migración Versionada: Cierre del Día con Reconciliación [CAJ-004]
-- Archivo: supabase/migrations/20261030100000_daily_cash_closures_schema.sql
-- Fase: 6 | Módulo: Cajas | Prioridad: P1
-- Fecha: 2026-10-30
-- 
-- Objetivos:
-- 1. Crear tabla inmutable 'public.daily_cash_closures' para almacenar el Cierre Z del día.
-- 2. Métricas de canales: Total ventas, Mostrador, Mesas, Domicilios, Online.
-- 3. Reconciliación por método de pago: Total sistema, total contado, diferencias calculadas.
-- 4. Inmutabilidad estricta: Una vez guardado el cierre, no puede modificarse ni eliminarse.
-- 5. Restricción única: Máximo 1 cierre por fecha por comercio (business_id, closure_date).
-- 6. Row Level Security (RLS) multi-tenant con aislamiento por negocio.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.daily_cash_closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    closure_date DATE NOT NULL,
    total_sales NUMERIC NOT NULL DEFAULT 0,
    counter_sales NUMERIC NOT NULL DEFAULT 0,
    tables_sales NUMERIC NOT NULL DEFAULT 0,
    delivery_sales NUMERIC NOT NULL DEFAULT 0,
    online_sales NUMERIC NOT NULL DEFAULT 0,
    total_system NUMERIC NOT NULL DEFAULT 0,
    total_counted NUMERIC NOT NULL DEFAULT 0,
    total_difference NUMERIC NOT NULL DEFAULT 0,
    payment_methods_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
    observations TEXT,
    closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    closed_by_name TEXT,
    is_locked BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_daily_cash_closures_business_date UNIQUE (business_id, closure_date)
);

-- Índices de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_daily_cash_closures_business_id
    ON public.daily_cash_closures(business_id);

CREATE INDEX IF NOT EXISTS idx_daily_cash_closures_date
    ON public.daily_cash_closures(business_id, closure_date DESC);

-- Habilitar RLS
ALTER TABLE public.daily_cash_closures ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad Multi-Tenant
DROP POLICY IF EXISTS "daily_cash_closures_select_policy" ON public.daily_cash_closures;
CREATE POLICY "daily_cash_closures_select_policy" ON public.daily_cash_closures
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = daily_cash_closures.business_id
            AND bu.user_id = auth.uid()
            AND bu.status = 'active'
        )
    );

DROP POLICY IF EXISTS "daily_cash_closures_insert_policy" ON public.daily_cash_closures;
CREATE POLICY "daily_cash_closures_insert_policy" ON public.daily_cash_closures
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = daily_cash_closures.business_id
            AND bu.user_id = auth.uid()
            AND bu.status = 'active'
        )
    );

-- Inmutabilidad estricta: Prevenir UPDATE y DELETE en cierres guardados
DROP POLICY IF EXISTS "daily_cash_closures_update_prevent_policy" ON public.daily_cash_closures;
CREATE POLICY "daily_cash_closures_update_prevent_policy" ON public.daily_cash_closures
    FOR UPDATE
    USING (false);

DROP POLICY IF EXISTS "daily_cash_closures_delete_prevent_policy" ON public.daily_cash_closures;
CREATE POLICY "daily_cash_closures_delete_prevent_policy" ON public.daily_cash_closures
    FOR DELETE
    USING (false);

-- Trigger de inmutabilidad a nivel de base de datos
CREATE OR REPLACE FUNCTION public.fn_prevent_daily_closure_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Un cierre de caja del día ya guardado es inmutable y no puede modificarse ni eliminarse.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_daily_closure_modification ON public.daily_cash_closures;
CREATE TRIGGER trg_prevent_daily_closure_modification
    BEFORE UPDATE OR DELETE ON public.daily_cash_closures
    FOR EACH ROW
    WHEN (OLD.is_locked = true)
    EXECUTE FUNCTION public.fn_prevent_daily_closure_modification();

