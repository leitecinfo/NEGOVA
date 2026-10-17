-- ==============================================================================
-- NEGOVA: Migración para Sistema de Acceso Administrativo Controlado (Delegated Access)
-- Tablas: public.admin_access_grants, public.admin_access_logs
-- Enums, Índices, Restricciones y Políticas RLS
-- ==============================================================================

-- 1. Tipos enumerados
DO $$ BEGIN
  CREATE TYPE public.admin_grant_channel AS ENUM ('in_app', 'manual_whatsapp');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.admin_grant_status AS ENUM ('pending', 'approved', 'rejected', 'expired', 'revoked');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.admin_grant_scope AS ENUM (
    'orders_read',
    'sales_read',
    'inventory_read',
    'finance_read',
    'settings_read'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Tabla de Solicitudes y Concesiones de Acceso Delegado
CREATE TABLE IF NOT EXISTS public.admin_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id TEXT NOT NULL REFERENCES public.support_tickets(id) ON DELETE RESTRICT,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  grant_channel public.admin_grant_channel NOT NULL DEFAULT 'in_app',
  status public.admin_grant_status NOT NULL DEFAULT 'pending',
  scope public.admin_grant_scope NOT NULL,
  target_resource_type TEXT NOT NULL DEFAULT 'general',
  target_resource_id TEXT,
  reason TEXT NOT NULL,
  whatsapp_evidence_ref TEXT,
  verified_phone TEXT,
  duration_hours INTEGER NOT NULL DEFAULT 2,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  revoke_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Restricción: Duración máxima permitida de 8 horas
  CONSTRAINT chk_grant_duration_limit CHECK (duration_hours >= 1 AND duration_hours <= 8),

  -- Restricción: Validez temporal coherente cuando el estado es aprobado
  CONSTRAINT chk_grant_validity CHECK (
    (status = 'approved' AND valid_from IS NOT NULL AND valid_until IS NOT NULL AND valid_until > valid_from) OR
    (status IN ('pending', 'rejected', 'revoked', 'expired'))
  ),

  -- Restricción: Canal WhatsApp requiere evidencia documentada y teléfono
  CONSTRAINT chk_whatsapp_evidence CHECK (
    (grant_channel = 'manual_whatsapp' AND whatsapp_evidence_ref IS NOT NULL AND verified_phone IS NOT NULL) OR
    (grant_channel = 'in_app')
  )
);

-- Índices de búsqueda optimizada
CREATE INDEX IF NOT EXISTS idx_admin_grants_lookup 
  ON public.admin_access_grants(business_id, status, valid_until);

CREATE INDEX IF NOT EXISTS idx_admin_grants_ticket 
  ON public.admin_access_grants(ticket_id);

CREATE INDEX IF NOT EXISTS idx_admin_grants_requester 
  ON public.admin_access_grants(requested_by);

-- 3. Tabla de Logs de Auditoría Forense de Lectura
CREATE TABLE IF NOT EXISTS public.admin_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES public.admin_access_grants(id) ON DELETE RESTRICT,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  resource_name TEXT NOT NULL,
  accessed_record_id TEXT,
  query_filters JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de consulta de auditoría
CREATE INDEX IF NOT EXISTS idx_admin_access_logs_grant 
  ON public.admin_access_logs(grant_id, accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_access_logs_business 
  ON public.admin_access_logs(business_id, accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_access_logs_admin 
  ON public.admin_access_logs(admin_user_id, accessed_at DESC);

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE public.admin_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_access_logs ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS para admin_access_grants
DROP POLICY IF EXISTS admin_grants_select_policy ON public.admin_access_grants;
CREATE POLICY admin_grants_select_policy ON public.admin_access_grants
  FOR SELECT
  USING (
    -- Personal de plataforma (super_admin, admin, soporte)
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() 
        AND (u.platform_role::text IN ('super_admin', 'admin', 'soporte') OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin', 'admin', 'soporte'))
    )
    OR
    -- Exclusivo: Propietario (owner) del negocio
    EXISTS (
      SELECT 1 FROM public.business_users bu
      JOIN public.roles r ON r.id = bu.role_id
      WHERE bu.user_id = auth.uid() 
        AND bu.business_id = admin_access_grants.business_id
        AND bu.status = 'active'
        AND r.code = 'owner'
    )
  );

DROP POLICY IF EXISTS admin_grants_insert_policy ON public.admin_access_grants;
CREATE POLICY admin_grants_insert_policy ON public.admin_access_grants
  FOR INSERT
  WITH CHECK (
    -- Solo personal de plataforma puede crear solicitudes o registrar WhatsApp
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() 
        AND (u.platform_role::text IN ('super_admin', 'admin', 'soporte') OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin', 'admin', 'soporte'))
    )
  );

DROP POLICY IF EXISTS admin_grants_update_policy ON public.admin_access_grants;
CREATE POLICY admin_grants_update_policy ON public.admin_access_grants
  FOR UPDATE
  USING (
    -- Personal de plataforma (para revocar o registrar)
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() 
        AND (u.platform_role::text IN ('super_admin', 'admin', 'soporte') OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin', 'admin', 'soporte'))
    )
    OR
    -- Exclusivo: Dueño del negocio (para aprobar, rechazar o revocar su negocio)
    EXISTS (
      SELECT 1 FROM public.business_users bu
      JOIN public.roles r ON r.id = bu.role_id
      WHERE bu.user_id = auth.uid() 
        AND bu.business_id = admin_access_grants.business_id
        AND bu.status = 'active'
        AND r.code = 'owner'
    )
  );

-- 6. Políticas RLS para admin_access_logs (Inmutable)
DROP POLICY IF EXISTS admin_logs_select_policy ON public.admin_access_logs;
CREATE POLICY admin_logs_select_policy ON public.admin_access_logs
  FOR SELECT
  USING (
    -- Superadmin, admin o soporte
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() 
        AND (u.platform_role::text IN ('super_admin', 'admin', 'soporte') OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin', 'admin', 'soporte'))
    )
    OR
    -- Exclusivo: Dueño del negocio consultado
    EXISTS (
      SELECT 1 FROM public.business_users bu
      JOIN public.roles r ON r.id = bu.role_id
      WHERE bu.user_id = auth.uid() 
        AND bu.business_id = admin_access_logs.business_id
        AND bu.status = 'active'
        AND r.code = 'owner'
    )
  );

DROP POLICY IF EXISTS admin_logs_insert_policy ON public.admin_access_logs;
CREATE POLICY admin_logs_insert_policy ON public.admin_access_logs
  FOR INSERT
  WITH CHECK (
    -- Solo personal autenticado de plataforma
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() 
        AND (u.platform_role::text IN ('super_admin', 'admin', 'soporte') OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin', 'admin', 'soporte'))
    )
  );
