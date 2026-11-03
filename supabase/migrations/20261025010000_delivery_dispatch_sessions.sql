-- ==============================================================================
-- NEGOVA SaaS - Migración: Sesiones Criptográficas Seguras para Domiciliarios Externos
-- Archivo: 20261025010000_delivery_dispatch_sessions.sql
--
-- IMPORTANTE:
-- Esta migración está preparada para su despliegue futuro de forma controlada.
-- NO aplicar a producción sin autorización explícita.
-- El código de la aplicación implementa compatibilidad y fallback mediante
-- almacenamiento seguro de sesiones (con token_hash SHA-256) en businesses.settings->delivery_sessions.
-- ==============================================================================

-- 1. Tabla de sesiones de despacho para domiciliarios externos (sin cuentas de usuario ni consumo de licencias)
CREATE TABLE IF NOT EXISTS public.delivery_dispatch_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    driver_id VARCHAR(100) NOT NULL,
    driver_name VARCHAR(255) NOT NULL,
    driver_phone VARCHAR(50),
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ,
    last_accessed_at TIMESTAMPTZ
);

COMMENT ON TABLE public.delivery_dispatch_sessions IS 'Sesiones de acceso efímero y seguro para repartidores externos mediante token criptográfico hash SHA-256';
COMMENT ON COLUMN public.delivery_dispatch_sessions.token_hash IS 'Hash SHA-256 en hexadecimal del token emitido. El token original nunca se guarda en texto plano';
COMMENT ON COLUMN public.delivery_dispatch_sessions.expires_at IS 'Fecha y hora en la que expira automáticamente la autorización de consulta y entrega';

-- 2. Índices de optimización de búsqueda
CREATE INDEX IF NOT EXISTS idx_delivery_dispatch_sessions_token_hash
    ON public.delivery_dispatch_sessions (token_hash)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_delivery_dispatch_sessions_business_driver
    ON public.delivery_dispatch_sessions (business_id, driver_id, created_at DESC);

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE public.delivery_dispatch_sessions ENABLE ROW LEVEL SECURITY;

-- 4. Política para usuarios autenticados con membresía en el negocio (Workspace)
DROP POLICY IF EXISTS "business_members_manage_delivery_sessions" ON public.delivery_dispatch_sessions;
CREATE POLICY "business_members_manage_delivery_sessions"
    ON public.delivery_dispatch_sessions
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = delivery_dispatch_sessions.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = delivery_dispatch_sessions.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    );

-- 5. Política para rol administrativo / service_role
DROP POLICY IF EXISTS "service_role_all_delivery_dispatch_sessions" ON public.delivery_dispatch_sessions;
CREATE POLICY "service_role_all_delivery_dispatch_sessions"
    ON public.delivery_dispatch_sessions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
