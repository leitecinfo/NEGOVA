-- ==============================================================================
-- NEGOVA SaaS - Script 11: Configuración Global de la Plataforma (Platform Settings)
-- Tabla: platform_settings (Almacena políticas globales, canales, seguridad y alertas)
-- ==============================================================================

-- 1. Crear tabla platform_settings si no existe
CREATE TABLE IF NOT EXISTS public.platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT,
    updated_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Índice para búsquedas rápidas por clave
CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON public.platform_settings (key);

-- 3. Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_platform_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_platform_settings_updated_at ON public.platform_settings;
CREATE TRIGGER tr_platform_settings_updated_at
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW
EXECUTE FUNCTION update_platform_settings_updated_at();

-- 4. Habilitar RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- 5. Eliminar políticas previas si existían
DROP POLICY IF EXISTS "Permitir lectura de configuracion a administradores" ON public.platform_settings;
DROP POLICY IF EXISTS "Permitir escritura de configuracion a super_admin" ON public.platform_settings;
DROP POLICY IF EXISTS "platform_settings_read" ON public.platform_settings;
DROP POLICY IF EXISTS "platform_settings_write" ON public.platform_settings;

-- 6. Políticas de Acceso:
-- A. Lectura permitida a usuarios autenticados del panel
CREATE POLICY "platform_settings_read"
ON public.platform_settings FOR SELECT
TO authenticated
USING (true);

-- B. Escritura (INSERT/UPDATE/DELETE) permitida a super_admin
CREATE POLICY "platform_settings_write"
ON public.platform_settings FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.platform_role = 'super_admin'
    )
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.platform_role = 'super_admin'
    )
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
);
