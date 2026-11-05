-- ==============================================================================
-- MIGRACIÓN: CARGOS Y FUNCIONES OPERATIVAS MULTIVERTICALES PARA EMPLEADOS DE NEGOVA
-- Archivo: supabase/migrations/20261104100000_business_employee_cargos.sql
-- Propósito:
--   1. Crear catálogo de cargos operativos por negocio (aislamiento multi-tenant estricto).
--   2. Permitir asignación de uno o múltiples cargos por empleado.
--   3. Separar conceptual y técnicamente:
--      * Rol: Perfil de permisos y seguridad (owner, admin, auxiliar, etc.)
--      * Permisos: Acciones granulares sobre módulos del sistema.
--      * Cargo: Etiqueta operativa de la función del día a día (Cajero, Mesero,
--               Cocinero, Domiciliario, Vendedor, Barbero, etc.)
--   4. Mantener compatibilidad 100% con empleados existentes (cargos son opcionales).
-- ==============================================================================

-- 1. Tabla de Catálogo de Cargos por Negocio
CREATE TABLE IF NOT EXISTS public.business_cargos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#ED500A',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_business_cargo_name UNIQUE (business_id, name)
);

COMMENT ON TABLE public.business_cargos IS 'Catálogo de cargos operativos personalizados o predeterminados por negocio.';
COMMENT ON COLUMN public.business_cargos.business_id IS 'Identificador del comercio propietario del cargo (Aislamiento Multi-Tenant).';
COMMENT ON COLUMN public.business_cargos.name IS 'Nombre visible del cargo (ej. Cajero, Mesero, Barbero, Cocinero, etc.).';
COMMENT ON COLUMN public.business_cargos.color IS 'Color hexadecimal o token de diseño para renderizado de badges en la UI.';

-- 2. Tabla Intermedia: Asignación de Cargos a Empleados (Relación N:M)
CREATE TABLE IF NOT EXISTS public.business_user_cargos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cargo_id UUID NOT NULL REFERENCES public.business_cargos(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_business_user_cargo UNIQUE (business_id, user_id, cargo_id)
);

COMMENT ON TABLE public.business_user_cargos IS 'Relación de asignación de múltiples cargos operativos a un empleado dentro de un comercio.';
COMMENT ON COLUMN public.business_user_cargos.user_id IS 'ID del empleado (auth.users).';
COMMENT ON COLUMN public.business_user_cargos.cargo_id IS 'ID del cargo operativo asignado.';

-- 3. Índices de Rendimiento para Búsquedas Rápidas
CREATE INDEX IF NOT EXISTS idx_business_cargos_business_id 
    ON public.business_cargos (business_id);

CREATE INDEX IF NOT EXISTS idx_business_user_cargos_lookup 
    ON public.business_user_cargos (business_id, user_id);

CREATE INDEX IF NOT EXISTS idx_business_user_cargos_cargo_id 
    ON public.business_user_cargos (cargo_id);

-- 4. Habilitar Seguridad a Nivel de Fila (Row Level Security - RLS)
ALTER TABLE public.business_cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_user_cargos ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS para public.business_cargos
-- A. Lectura: Cualquier miembro activo del comercio puede consultar los cargos disponibles
DROP POLICY IF EXISTS "business_cargos_select_policy" ON public.business_cargos;
CREATE POLICY "business_cargos_select_policy"
    ON public.business_cargos
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = public.business_cargos.business_id
              AND bu.user_id = auth.uid()
              AND bu.status != 'inactive'
        )
    );

-- B. Escritura / Modificación: Solo el Propietario o usuarios autorizados del comercio pueden gestionar cargos
DROP POLICY IF EXISTS "business_cargos_manage_policy" ON public.business_cargos;
CREATE POLICY "business_cargos_manage_policy"
    ON public.business_cargos
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            JOIN public.roles r ON r.id = bu.role_id
            WHERE bu.business_id = public.business_cargos.business_id
              AND bu.user_id = auth.uid()
              AND bu.status != 'inactive'
              AND r.code IN ('owner', 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            JOIN public.roles r ON r.id = bu.role_id
            WHERE bu.business_id = public.business_cargos.business_id
              AND bu.user_id = auth.uid()
              AND bu.status != 'inactive'
              AND r.code IN ('owner', 'admin')
        )
    );

-- 6. Políticas RLS para public.business_user_cargos
-- A. Lectura: Miembros del comercio pueden ver los cargos asignados al equipo
DROP POLICY IF EXISTS "business_user_cargos_select_policy" ON public.business_user_cargos;
CREATE POLICY "business_user_cargos_select_policy"
    ON public.business_user_cargos
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = public.business_user_cargos.business_id
              AND bu.user_id = auth.uid()
              AND bu.status != 'inactive'
        )
    );

-- B. Asignación / Desasignación: Administradores u Owners del comercio
DROP POLICY IF EXISTS "business_user_cargos_manage_policy" ON public.business_user_cargos;
CREATE POLICY "business_user_cargos_manage_policy"
    ON public.business_user_cargos
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            JOIN public.roles r ON r.id = bu.role_id
            WHERE bu.business_id = public.business_user_cargos.business_id
              AND bu.user_id = auth.uid()
              AND bu.status != 'inactive'
              AND r.code IN ('owner', 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            JOIN public.roles r ON r.id = bu.role_id
            WHERE bu.business_id = public.business_user_cargos.business_id
              AND bu.user_id = auth.uid()
              AND bu.status != 'inactive'
              AND r.code IN ('owner', 'admin')
        )
    );

