-- ==============================================================================
-- NEGOVA SaaS — Migración: PIN de Autorización para Operaciones Sensibles y Auditoría
-- Fase: 4 | Módulo: Empleados [EMP-002]
-- 1. Soporte para PIN seguro (hash) en business_users y business_employees
-- 2. Aseguramiento e índices en audit_logs para registrar autorizaciones de operaciones sensibles
-- ==============================================================================

-- 1. Agregar columnas de PIN en business_users
ALTER TABLE public.business_users
    ADD COLUMN IF NOT EXISTS security_pin_hash TEXT,
    ADD COLUMN IF NOT EXISTS security_pin_updated_at TIMESTAMPTZ;

-- 2. Agregar columnas de PIN en business_employees
ALTER TABLE public.business_employees
    ADD COLUMN IF NOT EXISTS security_pin_hash TEXT,
    ADD COLUMN IF NOT EXISTS security_pin_updated_at TIMESTAMPTZ;

-- 3. Índices de búsqueda para validación rápida de PIN por negocio
CREATE INDEX IF NOT EXISTS idx_business_users_security_pin
    ON public.business_users(business_id)
    WHERE security_pin_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_employees_security_pin
    ON public.business_employees(business_id)
    WHERE security_pin_hash IS NOT NULL;

-- 4. Asegurar la tabla audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity TEXT,
    entity_id TEXT,
    details JSONB,
    authorized_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    authorized_by_employee_id UUID REFERENCES public.business_employees(id) ON DELETE SET NULL,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Asegurar columnas si audit_logs ya existía previamente
ALTER TABLE public.audit_logs
    ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS action TEXT,
    ADD COLUMN IF NOT EXISTS entity TEXT,
    ADD COLUMN IF NOT EXISTS entity_id TEXT,
    ADD COLUMN IF NOT EXISTS details JSONB,
    ADD COLUMN IF NOT EXISTS authorized_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS authorized_by_employee_id UUID REFERENCES public.business_employees(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS ip_address TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Índices en audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_business_action
    ON public.audit_logs(business_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_authorized_by
    ON public.audit_logs(authorized_by)
    WHERE authorized_by IS NOT NULL;

-- 5. RLS en audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'audit_logs' AND policyname = 'audit_logs_tenant_select'
    ) THEN
        CREATE POLICY "audit_logs_tenant_select"
            ON public.audit_logs
            FOR SELECT
            TO authenticated
            USING (
                business_id IN (
                    SELECT bu.business_id 
                    FROM public.business_users bu 
                    WHERE bu.user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'audit_logs' AND policyname = 'audit_logs_tenant_insert'
    ) THEN
        CREATE POLICY "audit_logs_tenant_insert"
            ON public.audit_logs
            FOR INSERT
            TO authenticated
            WITH CHECK (
                business_id IN (
                    SELECT bu.business_id 
                    FROM public.business_users bu 
                    WHERE bu.user_id = auth.uid()
                )
            );
    END IF;
END $$;
