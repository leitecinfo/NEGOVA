-- ============================================================================
-- MIGRACIÓN: AUTENTICACIÓN EN DOS PASOS (2FA / MFA) Y CÓDIGOS DE RESPALDO [CONF-004]
-- Fecha: 2026-11-01
-- ============================================================================

-- 1. Agregar columnas de control 2FA a public.users si no existen
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_2fa_enabled'
    ) THEN
        ALTER TABLE public.users ADD COLUMN is_2fa_enabled BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'two_factor_factor_id'
    ) THEN
        ALTER TABLE public.users ADD COLUMN two_factor_factor_id TEXT DEFAULT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'two_factor_verified_at'
    ) THEN
        ALTER TABLE public.users ADD COLUMN two_factor_verified_at TIMESTAMPTZ DEFAULT NULL;
    END IF;
END $$;

-- 2. Tabla para Códigos de Respaldo (Recovery Codes)
CREATE TABLE IF NOT EXISTS public.user_mfa_recovery_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    code_hash TEXT NOT NULL,
    used_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices de consulta rápida y búsqueda de códigos activos
CREATE INDEX IF NOT EXISTS idx_user_mfa_recovery_codes_user_unused 
    ON public.user_mfa_recovery_codes(user_id) 
    WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_mfa_recovery_codes_hash 
    ON public.user_mfa_recovery_codes(user_id, code_hash);

-- 3. Habilitar RLS en user_mfa_recovery_codes
ALTER TABLE public.user_mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios autenticados pueden consultar sus propios códigos
DROP POLICY IF EXISTS "Users can view their own recovery codes status" ON public.user_mfa_recovery_codes;
CREATE POLICY "Users can view their own recovery codes status"
    ON public.user_mfa_recovery_codes
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Política: El rol de servicio tiene acceso total
DROP POLICY IF EXISTS "Service role has full access to recovery codes" ON public.user_mfa_recovery_codes;
CREATE POLICY "Service role has full access to recovery codes"
    ON public.user_mfa_recovery_codes
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 4. Comentarios descriptivos
COMMENT ON TABLE public.user_mfa_recovery_codes IS 'Códigos de respaldo de un solo uso para recuperación de autenticación 2FA/TOTP';
COMMENT ON COLUMN public.user_mfa_recovery_codes.code_hash IS 'Hash SHA-256 del código de respaldo generado para el usuario';
COMMENT ON COLUMN public.user_mfa_recovery_codes.used_at IS 'Fecha y hora en que se consumió el código de respaldo. NULL si no se ha usado.';
