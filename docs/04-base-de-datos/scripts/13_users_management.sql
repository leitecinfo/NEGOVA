-- ==============================================================================
-- NEGOVA SaaS - Script 13: Módulo de Gestión de Usuarios y Membresías (Multi-Tenant)
-- Motor: PostgreSQL 15+ / Supabase
-- ==============================================================================

-- 1. Agregar columna must_change_password a public.users si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'must_change_password'
    ) THEN
        ALTER TABLE public.users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- 2. Asegurar índices de alto rendimiento para búsquedas y filtros en users
CREATE INDEX IF NOT EXISTS idx_users_platform_role ON public.users(platform_role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_email_trgm ON public.users USING gin (email gin_trgm_ops);

-- 3. Índices en profiles y business_users
CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm ON public.profiles USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_business_users_status ON public.business_users(status);
CREATE INDEX IF NOT EXISTS idx_business_users_role_id ON public.business_users(role_id);
CREATE INDEX IF NOT EXISTS idx_business_users_business_user ON public.business_users(business_id, user_id);

-- 4. Triggers de actualización de updated_at para users y profiles
DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. Función de ayuda para validar que nunca se elimine o desactive al último super_admin
CREATE OR REPLACE FUNCTION public.check_last_super_admin_protection()
RETURNS TRIGGER AS $$
DECLARE
    active_super_admins_count INTEGER;
BEGIN
    -- Si se intenta cambiar el rol o desactivar un super_admin
    IF (OLD.platform_role = 'super_admin' AND (NEW.platform_role <> 'super_admin' OR NEW.status <> 'active')) THEN
        SELECT COUNT(*) INTO active_super_admins_count
        FROM public.users
        WHERE platform_role = 'super_admin' AND status = 'active' AND id <> OLD.id;

        IF active_super_admins_count = 0 THEN
            RAISE EXCEPTION 'Operación denegada: No es posible desactivar o degradar al único Super Administrador activo del sistema.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_last_super_admin ON public.users;
CREATE TRIGGER trg_protect_last_super_admin
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.check_last_super_admin_protection();

COMMENT ON TABLE public.users IS 'Identidades de usuario de NEGOVA Core sincronizadas con Supabase Auth';
COMMENT ON COLUMN public.users.must_change_password IS 'Indica si el usuario debe actualizar su contraseña temporal en su próximo inicio de sesión';
