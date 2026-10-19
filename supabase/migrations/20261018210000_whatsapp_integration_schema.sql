-- ==============================================================================
-- NEGOVA SaaS - Migración: Infraestructura Base para WhatsApp IA (Lote 1 - Hardened)
-- Tablas:
--   1. public.business_whatsapp_configs (Configuración operativa multi-tenant de número Meta)
--   2. public.business_whatsapp_secrets (Aislamiento criptográfico de secretos accesible solo por service_role)
--   3. public.whatsapp_conversations (Conversaciones por negocio con máquina de estados)
--   4. public.whatsapp_incoming_events (Cola persistente duradera, deduplicación y recuperación)
--   5. public.whatsapp_messages (Historial unificado de mensajes)
-- RPC:
--   - public.claim_whatsapp_incoming_events (Reclamación atómica con FOR UPDATE SKIP LOCKED y recuperación de zombies)
-- Estado: Preparado para revisión local. NO aplicar en Supabase Cloud sin autorización explícita.
-- ==============================================================================

-- 1. CONFIGURACIÓN OPERATIVA DE NÚMEROS META POR NEGOCIO (Seguro para lectura por personal autenticado)
CREATE TABLE IF NOT EXISTS public.business_whatsapp_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    phone_number_id TEXT NOT NULL,
    waba_id TEXT,
    display_phone_number TEXT,
    verified_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'disconnected', 'suspended')),
    ai_enabled BOOLEAN NOT NULL DEFAULT true,
    ai_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_business_whatsapp_business UNIQUE (business_id),
    CONSTRAINT uq_business_whatsapp_phone_number UNIQUE (phone_number_id)
);

-- 2. AISLAMIENTO ESTRICTO DE SECRETOS CRIPTOGRÁFICOS DE WHATSAPP
-- REQUISITO RLS-01: Los tokens cifrados y de verificación se aíslan de las configuraciones operativas.
-- Acceso EXCLUSIVO para service_role (Servidor backend). Bloqueado por completo para authenticated, anon y public.
CREATE TABLE IF NOT EXISTS public.business_whatsapp_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    encrypted_access_token TEXT NOT NULL,
    token_key_id TEXT NOT NULL DEFAULT 'v1',
    webhook_verify_token TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_business_whatsapp_secrets_business UNIQUE (business_id)
);

-- Migración segura e idempotente si la tabla previa contenía columnas de secretos
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'business_whatsapp_configs' 
          AND column_name = 'encrypted_access_token'
    ) THEN
        INSERT INTO public.business_whatsapp_secrets (business_id, encrypted_access_token, token_key_id, webhook_verify_token)
        SELECT business_id, encrypted_access_token, COALESCE(token_key_id, 'v1'), webhook_verify_token
        FROM public.business_whatsapp_configs
        WHERE encrypted_access_token IS NOT NULL
        ON CONFLICT (business_id) DO NOTHING;

        ALTER TABLE public.business_whatsapp_configs DROP COLUMN IF EXISTS encrypted_access_token;
        ALTER TABLE public.business_whatsapp_configs DROP COLUMN IF EXISTS token_key_id;
        ALTER TABLE public.business_whatsapp_configs DROP COLUMN IF EXISTS webhook_verify_token;
    END IF;
END $$;

-- 3. CONVERSACIONES DE WHATSAPP (MÁQUINA DE ESTADOS INDEPENDIENTE)
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_phone TEXT NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'ai_active' CHECK (status IN ('ai_active', 'human_pending', 'human_active', 'closed')),
    unread_messages_count INTEGER NOT NULL DEFAULT 0,
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_message_preview TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_whatsapp_conv_business_phone UNIQUE (business_id, customer_phone),
    CONSTRAINT uq_whatsapp_conv_id_business UNIQUE (id, business_id)
);

-- 4. COLA PERSISTENTE DE EVENTOS ENTRANTES (DEDUPLICACIÓN E IDEMPOTENCIA)
CREATE TABLE IF NOT EXISTS public.whatsapp_incoming_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    phone_number_id TEXT NOT NULL,
    meta_message_id TEXT,
    sender_phone TEXT NOT NULL,
    event_type TEXT NOT NULL DEFAULT 'message',
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    locked_at TIMESTAMPTZ,
    locked_by TEXT,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. HISTORIAL DE MENSAJES DE WHATSAPP (BLINDADO CON CLAVE FORÁNEA COMPUESTA MULTI-TENANT)
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    business_id UUID NOT NULL,
    meta_message_id TEXT,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    sender_role TEXT NOT NULL CHECK (sender_role IN ('customer', 'ai', 'human_agent', 'system')),
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'interactive', 'audio', 'document', 'location', 'order')),
    content TEXT NOT NULL,
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_whatsapp_messages_conversation_tenant
        FOREIGN KEY (conversation_id, business_id)
        REFERENCES public.whatsapp_conversations(id, business_id)
        ON DELETE CASCADE
);

-- ============================================================
-- 6. ÍNDICES DE ALTO RENDIMIENTO Y DEDUPLICACIÓN
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_phone ON public.business_whatsapp_configs(phone_number_id, status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_secrets_business ON public.business_whatsapp_secrets(business_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conv_business_status ON public.whatsapp_conversations(business_id, status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conv_last_msg ON public.whatsapp_conversations(business_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conv ON public.whatsapp_messages(conversation_id, created_at ASC);

-- Índices parciales especializados de cola (Solo indexan filas vivas pendientes o en procesamiento)
CREATE INDEX IF NOT EXISTS idx_whatsapp_events_pending_queue
    ON public.whatsapp_incoming_events(next_attempt_at ASC, created_at ASC)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_whatsapp_events_recovery_queue
    ON public.whatsapp_incoming_events(locked_at ASC, created_at ASC)
    WHERE status = 'processing';

-- Índices únicos parciales para deduplicación estricta de wamid de Meta
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_events_meta_msg
    ON public.whatsapp_incoming_events(business_id, meta_message_id)
    WHERE meta_message_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_meta_msg
    ON public.whatsapp_messages(meta_message_id)
    WHERE meta_message_id IS NOT NULL;

-- ============================================================
-- 7. TRIGGERS DE updated_at
-- ============================================================

DROP TRIGGER IF EXISTS trg_business_whatsapp_configs_updated ON public.business_whatsapp_configs;
CREATE TRIGGER trg_business_whatsapp_configs_updated
    BEFORE UPDATE ON public.business_whatsapp_configs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_business_whatsapp_secrets_updated ON public.business_whatsapp_secrets;
CREATE TRIGGER trg_business_whatsapp_secrets_updated
    BEFORE UPDATE ON public.business_whatsapp_secrets
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_whatsapp_conversations_updated ON public.whatsapp_conversations;
CREATE TRIGGER trg_whatsapp_conversations_updated
    BEFORE UPDATE ON public.whatsapp_conversations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_whatsapp_incoming_events_updated ON public.whatsapp_incoming_events;
CREATE TRIGGER trg_whatsapp_incoming_events_updated
    BEFORE UPDATE ON public.whatsapp_incoming_events
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7.1 Trigger para impedir la modificación de business_id en whatsapp_conversations
CREATE OR REPLACE FUNCTION public.prevent_whatsapp_conversation_business_id_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.business_id IS DISTINCT FROM OLD.business_id THEN
        RAISE EXCEPTION 'No está permitido modificar el business_id de una conversación';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_whatsapp_conversation_business_id_change ON public.whatsapp_conversations;
CREATE TRIGGER trg_prevent_whatsapp_conversation_business_id_change
    BEFORE UPDATE OF business_id ON public.whatsapp_conversations
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_whatsapp_conversation_business_id_change();


-- ============================================================
-- 8. OPERACIÓN ATÓMICA DE RECLAMACIÓN Y RECUPERACIÓN DE COLA (RPC)
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_whatsapp_incoming_events(
    p_worker_id TEXT,
    p_batch_size INT DEFAULT 5,
    p_lock_timeout_seconds INT DEFAULT 300
)
RETURNS SETOF public.whatsapp_incoming_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_batch_size integer := greatest(1, least(coalesce(p_batch_size, 5), 100));
    v_timeout_seconds integer := greatest(30, least(coalesce(p_lock_timeout_seconds, 300), 86400));
    v_lock_threshold timestamptz := now() - (v_timeout_seconds || ' seconds')::interval;
BEGIN
    -- Validar que el identificador del worker sea obligatorio y no vacío
    IF p_worker_id IS NULL OR trim(p_worker_id) = '' THEN
        RAISE EXCEPTION 'El parámetro p_worker_id es obligatorio y no puede estar vacío';
    END IF;

    -- 1. Enviar a dead_letter eventos en processing cuyo bloqueo expiró o es nulo y ya agotaron sus intentos
    UPDATE public.whatsapp_incoming_events
    SET status = 'dead_letter',
        locked_by = NULL,
        locked_at = NULL,
        last_error = coalesce(last_error, '') || ' [Expiró el bloqueo del worker y se agotaron los intentos]',
        updated_at = now()
    WHERE status = 'processing'
      AND (locked_at < v_lock_threshold OR locked_at IS NULL)
      AND attempts >= max_attempts;

    -- 2. Seleccionar y reclamar atómicamente con FOR UPDATE SKIP LOCKED
    RETURN QUERY
    WITH candidate_events AS (
        SELECT id, status
        FROM public.whatsapp_incoming_events
        WHERE (status = 'pending' AND next_attempt_at <= now())
           OR (status = 'processing' AND (locked_at < v_lock_threshold OR locked_at IS NULL) AND attempts < max_attempts)
        ORDER BY created_at ASC
        LIMIT v_batch_size
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.whatsapp_incoming_events e
    SET status = 'processing',
        locked_at = now(),
        locked_by = trim(p_worker_id),
        attempts = CASE WHEN c.status = 'processing' THEN e.attempts + 1 ELSE e.attempts END,
        updated_at = now()
    FROM candidate_events c
    WHERE e.id = c.id
    RETURNING e.*;
END;
$$;

-- Permisos estrictos para la RPC: Solo service_role
REVOKE ALL ON FUNCTION public.claim_whatsapp_incoming_events(TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_incoming_events(TEXT, INT, INT) TO service_role;

-- ============================================================
-- 9. PERMISOS Y POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.business_whatsapp_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_whatsapp_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_incoming_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- 9.1 Permisos de Postgres (Defensa en profundidad más allá de RLS)
REVOKE ALL ON public.business_whatsapp_secrets FROM authenticated, anon, public;
GRANT ALL ON public.business_whatsapp_secrets TO service_role;

REVOKE ALL ON public.business_whatsapp_configs FROM anon, public;
GRANT SELECT, UPDATE ON public.business_whatsapp_configs TO authenticated;
GRANT ALL ON public.business_whatsapp_configs TO service_role;

REVOKE ALL ON public.whatsapp_conversations FROM anon, public;
GRANT SELECT, UPDATE ON public.whatsapp_conversations TO authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;

REVOKE ALL ON public.whatsapp_incoming_events FROM authenticated, anon, public;
GRANT ALL ON public.whatsapp_incoming_events TO service_role;

REVOKE ALL ON public.whatsapp_messages FROM anon, public;
GRANT SELECT ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;

-- 9.2 Políticas para service_role (Servidor, Webhooks y Worker)
DROP POLICY IF EXISTS "service_role_all_whatsapp_configs" ON public.business_whatsapp_configs;
CREATE POLICY "service_role_all_whatsapp_configs" ON public.business_whatsapp_configs
    TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_whatsapp_secrets" ON public.business_whatsapp_secrets;
CREATE POLICY "service_role_all_whatsapp_secrets" ON public.business_whatsapp_secrets
    TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_whatsapp_conversations" ON public.whatsapp_conversations;
CREATE POLICY "service_role_all_whatsapp_conversations" ON public.whatsapp_conversations
    TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_whatsapp_incoming_events" ON public.whatsapp_incoming_events;
CREATE POLICY "service_role_all_whatsapp_incoming_events" ON public.whatsapp_incoming_events
    TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_whatsapp_messages" ON public.whatsapp_messages;
CREATE POLICY "service_role_all_whatsapp_messages" ON public.whatsapp_messages
    TO service_role USING (true) WITH CHECK (true);

-- 9.3 Políticas para authenticated (Aislamiento Multi-Tenant estricto)
DROP POLICY IF EXISTS "tenant_whatsapp_configs_read" ON public.business_whatsapp_configs;
CREATE POLICY "tenant_whatsapp_configs_read" ON public.business_whatsapp_configs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = business_whatsapp_configs.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'::public.membership_status
        )
    );

DROP POLICY IF EXISTS "tenant_whatsapp_configs_admin_update" ON public.business_whatsapp_configs;
CREATE POLICY "tenant_whatsapp_configs_admin_update" ON public.business_whatsapp_configs
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            JOIN public.roles r ON r.id = bu.role_id
            WHERE bu.business_id = business_whatsapp_configs.business_id
              AND bu.user_id = auth.uid()
              AND r.code IN ('owner', 'business_admin')
              AND bu.status = 'active'::public.membership_status
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            JOIN public.roles r ON r.id = bu.role_id
            WHERE bu.business_id = business_whatsapp_configs.business_id
              AND bu.user_id = auth.uid()
              AND r.code IN ('owner', 'business_admin')
              AND bu.status = 'active'::public.membership_status
        )
    );

DROP POLICY IF EXISTS "tenant_whatsapp_conversations_read" ON public.whatsapp_conversations;
CREATE POLICY "tenant_whatsapp_conversations_read" ON public.whatsapp_conversations
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = whatsapp_conversations.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'::public.membership_status
        )
    );

DROP POLICY IF EXISTS "tenant_whatsapp_conversations_update" ON public.whatsapp_conversations;
CREATE POLICY "tenant_whatsapp_conversations_update" ON public.whatsapp_conversations
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            JOIN public.roles r ON r.id = bu.role_id
            WHERE bu.business_id = whatsapp_conversations.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'::public.membership_status
              AND (
                  r.code IN ('owner', 'business_admin', 'supervisor')
                  OR public.user_has_permission(whatsapp_conversations.business_id, 'orders.manage')
                  OR public.user_has_permission(whatsapp_conversations.business_id, 'support.manage')
              )
        )
    )
    WITH CHECK (
        business_id = whatsapp_conversations.business_id
        AND EXISTS (
            SELECT 1 FROM public.business_users bu
            JOIN public.roles r ON r.id = bu.role_id
            WHERE bu.business_id = whatsapp_conversations.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'::public.membership_status
              AND (
                  r.code IN ('owner', 'business_admin', 'supervisor')
                  OR public.user_has_permission(whatsapp_conversations.business_id, 'orders.manage')
                  OR public.user_has_permission(whatsapp_conversations.business_id, 'support.manage')
              )
        )
    );

DROP POLICY IF EXISTS "tenant_whatsapp_messages_read" ON public.whatsapp_messages;
CREATE POLICY "tenant_whatsapp_messages_read" ON public.whatsapp_messages
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = whatsapp_messages.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'::public.membership_status
        )
    );

-- ============================================================
-- 10. PLAN DE ROLLBACK (REVERSIBILIDAD ESTRICTA Y ORDENADA)
-- ============================================================
-- DROP POLICY IF EXISTS "tenant_whatsapp_messages_read" ON public.whatsapp_messages;
-- DROP POLICY IF EXISTS "tenant_whatsapp_conversations_update" ON public.whatsapp_conversations;
-- DROP POLICY IF EXISTS "tenant_whatsapp_conversations_read" ON public.whatsapp_conversations;
-- DROP POLICY IF EXISTS "tenant_whatsapp_configs_admin_update" ON public.business_whatsapp_configs;
-- DROP POLICY IF EXISTS "tenant_whatsapp_configs_read" ON public.business_whatsapp_configs;
-- DROP POLICY IF EXISTS "service_role_all_whatsapp_messages" ON public.whatsapp_messages;
-- DROP POLICY IF EXISTS "service_role_all_whatsapp_incoming_events" ON public.whatsapp_incoming_events;
-- DROP POLICY IF EXISTS "service_role_all_whatsapp_conversations" ON public.whatsapp_conversations;
-- DROP POLICY IF EXISTS "service_role_all_whatsapp_secrets" ON public.business_whatsapp_secrets;
-- DROP POLICY IF EXISTS "service_role_all_whatsapp_configs" ON public.business_whatsapp_configs;
-- DROP FUNCTION IF EXISTS public.claim_whatsapp_incoming_events(TEXT, INT, INT);
-- DROP TRIGGER IF EXISTS trg_prevent_whatsapp_conversation_business_id_change ON public.whatsapp_conversations;
-- DROP FUNCTION IF EXISTS public.prevent_whatsapp_conversation_business_id_change();
-- DROP TRIGGER IF EXISTS trg_whatsapp_incoming_events_updated ON public.whatsapp_incoming_events;
-- DROP TRIGGER IF EXISTS trg_whatsapp_conversations_updated ON public.whatsapp_conversations;
-- DROP TRIGGER IF EXISTS trg_business_whatsapp_secrets_updated ON public.business_whatsapp_secrets;
-- DROP TRIGGER IF EXISTS trg_business_whatsapp_configs_updated ON public.business_whatsapp_configs;
-- DROP TABLE IF EXISTS public.whatsapp_messages RESTRICT;
-- DROP TABLE IF EXISTS public.whatsapp_incoming_events RESTRICT;
-- DROP TABLE IF EXISTS public.whatsapp_conversations RESTRICT;
-- DROP TABLE IF EXISTS public.business_whatsapp_secrets RESTRICT;
-- DROP TABLE IF EXISTS public.business_whatsapp_configs RESTRICT;
-- DROP TYPE IF EXISTS public.whatsapp_message_direction;
-- DROP TYPE IF EXISTS public.whatsapp_event_status;
-- DROP TYPE IF EXISTS public.whatsapp_event_type;
-- DROP TYPE IF EXISTS public.whatsapp_conversation_status;
-- DROP TYPE IF EXISTS public.whatsapp_config_status;

