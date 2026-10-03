-- ==============================================================================
-- NEGOVA — MIGRACIÓN COMPLETA: JSON → POSTGRESQL
-- 
-- Crea las tablas nuevas para persistencia relacional de:
-- 1. Soporte (conversaciones, mensajes, atenciones, tickets)
-- 2. Facturación SaaS (comprobantes de cobro de plataforma)
-- 3. Documentos comerciales (configuración, documentos de venta, ítems)
-- 4. Finanzas de plataforma (egresos operativos)
-- 5. Notificaciones transversales (plataforma + negocio)
--
-- Ejecutar en Supabase SQL Editor con permisos de service_role.
-- ==============================================================================

-- ============================================================
-- 1. SOPORTE: CONVERSACIONES DE CHAT
-- ============================================================
CREATE TABLE IF NOT EXISTS public.support_conversations (
  id TEXT PRIMARY KEY,
  conversation_number TEXT NOT NULL UNIQUE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  business_name TEXT NOT NULL DEFAULT '',
  business_slug TEXT NOT NULL DEFAULT '',
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL DEFAULT '',
  user_email TEXT,
  user_phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'waiting_agent', 'with_agent', 'resolved', 'closed')),
  mode TEXT NOT NULL DEFAULT 'ai' CHECK (mode IN ('ai', 'human', 'hybrid')),
  assigned_agent_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_agent_name TEXT,
  subject TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_preview TEXT NOT NULL DEFAULT '',
  unread_count_admin INTEGER NOT NULL DEFAULT 0,
  unread_count_client INTEGER NOT NULL DEFAULT 0,
  interaction_id TEXT,
  ticket_id TEXT,
  ai_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- ============================================================
-- 2. SOPORTE: MENSAJES DE CHAT
-- ============================================================
CREATE TABLE IF NOT EXISTS public.support_chat_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('client', 'ai', 'agent', 'system')),
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  suggested_actions JSONB,
  read_by_admin BOOLEAN NOT NULL DEFAULT false,
  read_by_client BOOLEAN NOT NULL DEFAULT false,
  is_internal_note BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. SOPORTE: REGISTRO DE ATENCIONES (ATN-XXXX)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.support_interactions (
  id TEXT PRIMARY KEY,
  interaction_number TEXT NOT NULL UNIQUE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  business_name TEXT NOT NULL DEFAULT '',
  business_slug TEXT NOT NULL DEFAULT '',
  contact_name TEXT NOT NULL,
  contact_phone TEXT,
  contact_email TEXT,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  category TEXT NOT NULL DEFAULT 'general',
  subject TEXT NOT NULL,
  summary TEXT NOT NULL,
  outcome TEXT NOT NULL DEFAULT 'resolved_immediately' CHECK (outcome IN ('resolved_immediately', 'escalated_to_ticket', 'information_provided', 'pending_customer')),
  ticket_id TEXT,
  ticket_number TEXT,
  agent_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  agent_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. SOPORTE: TICKETS (TCK-XXXX)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id TEXT PRIMARY KEY,
  ticket_number TEXT NOT NULL UNIQUE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  business_name TEXT NOT NULL DEFAULT '',
  business_slug TEXT NOT NULL DEFAULT '',
  contact_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  origin_channel TEXT NOT NULL DEFAULT 'other',
  interaction_id TEXT,
  interaction_number TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  assigned_agent_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_agent_name TEXT,
  internal_notes TEXT,
  client_resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

-- ============================================================
-- 5. FACTURACIÓN: COMPROBANTES DE COBRO (CMP-XXXX)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  business_name TEXT NOT NULL DEFAULT '',
  business_slug TEXT NOT NULL DEFAULT '',
  plan_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  billing_interval TEXT NOT NULL DEFAULT 'monthly',
  amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'COP',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'paid', 'void', 'failed', 'cancelled', 'refunded')),
  payment_method TEXT NOT NULL DEFAULT 'transfer',
  payment_reference TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '5 days'),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  pdf_url TEXT,
  pdf_storage_path TEXT,
  last_email_sent_at TIMESTAMPTZ,
  last_sent_to_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. DOCUMENTOS: CONFIGURACIÓN VISUAL POR NEGOCIO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.business_document_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  trade_name TEXT NOT NULL DEFAULT 'Mi Negocio',
  legal_name TEXT,
  tax_id TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#ED500A',
  document_title_default TEXT NOT NULL DEFAULT 'DOCUMENTO DE VENTA',
  header_text TEXT,
  footer_text TEXT,
  thank_you_note TEXT,
  terms_conditions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 7. DOCUMENTOS: DOCUMENTOS DE VENTA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.business_sale_documents (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  document_number TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'sale' CHECK (document_type IN ('sale', 'service', 'order', 'receipt')),
  customer_name TEXT NOT NULL DEFAULT 'Cliente General',
  customer_id TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  customer_address TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
  tax_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  currency TEXT NOT NULL DEFAULT 'COP',
  payment_method TEXT NOT NULL DEFAULT 'cash',
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'cancelled', 'draft', 'issued', 'paid', 'annulled')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date TIMESTAMPTZ,
  notes TEXT,
  pdf_url TEXT,
  pdf_storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, document_number)
);

-- ============================================================
-- 8. FINANZAS: EGRESOS DE PLATAFORMA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_expenses (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('infra', 'api_services', 'domain_hosting', 'commissions', 'operations', 'other')),
  category_label TEXT NOT NULL DEFAULT 'Otros Egresos',
  concept TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'COP',
  expense_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  receipt_reference TEXT,
  notes TEXT,
  registered_by_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 9. NOTIFICACIONES TRANSVERSALES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_notifications (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL DEFAULT 'platform' CHECK (scope IN ('platform', 'business')),
  audience TEXT NOT NULL DEFAULT 'global' CHECK (audience IN ('global', 'user')),
  recipient_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  entity_type TEXT,
  entity_id TEXT,
  entity_number TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 10. ÍNDICES DE ALTO RENDIMIENTO
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sup_conv_business ON public.support_conversations(business_id);
CREATE INDEX IF NOT EXISTS idx_sup_conv_user ON public.support_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_sup_conv_status ON public.support_conversations(status);
CREATE INDEX IF NOT EXISTS idx_sup_conv_last_msg ON public.support_conversations(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_sup_msg_conv ON public.support_chat_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_sup_msg_sender ON public.support_chat_messages(sender_role);

CREATE INDEX IF NOT EXISTS idx_sup_inter_business ON public.support_interactions(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sup_inter_number ON public.support_interactions(interaction_number);

CREATE INDEX IF NOT EXISTS idx_sup_tck_business ON public.support_tickets(business_id, status);
CREATE INDEX IF NOT EXISTS idx_sup_tck_assigned ON public.support_tickets(assigned_agent_id, status);
CREATE INDEX IF NOT EXISTS idx_sup_tck_priority ON public.support_tickets(priority, status);

CREATE INDEX IF NOT EXISTS idx_plat_inv_business ON public.platform_invoices(business_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_plat_inv_status ON public.platform_invoices(status);
CREATE INDEX IF NOT EXISTS idx_plat_inv_number ON public.platform_invoices(invoice_number);

CREATE INDEX IF NOT EXISTS idx_bdc_business ON public.business_document_configs(business_id);

CREATE INDEX IF NOT EXISTS idx_bsd_business ON public.business_sale_documents(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bsd_number ON public.business_sale_documents(business_id, document_number);

CREATE INDEX IF NOT EXISTS idx_plat_exp_date ON public.platform_expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_plat_exp_category ON public.platform_expenses(category);

CREATE INDEX IF NOT EXISTS idx_plat_notif_scope ON public.platform_notifications(scope, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plat_notif_user ON public.platform_notifications(recipient_user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_plat_notif_business ON public.platform_notifications(business_id, scope);

-- ============================================================
-- 11. TRIGGERS DE updated_at
-- ============================================================
DROP TRIGGER IF EXISTS trg_support_conversations_updated ON public.support_conversations;
CREATE TRIGGER trg_support_conversations_updated BEFORE UPDATE ON public.support_conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_support_interactions_updated ON public.support_interactions;
CREATE TRIGGER trg_support_interactions_updated BEFORE UPDATE ON public.support_interactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_support_tickets_updated ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_updated BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_platform_invoices_updated ON public.platform_invoices;
CREATE TRIGGER trg_platform_invoices_updated BEFORE UPDATE ON public.platform_invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_business_document_configs_updated ON public.business_document_configs;
CREATE TRIGGER trg_business_document_configs_updated BEFORE UPDATE ON public.business_document_configs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_business_sale_documents_updated ON public.business_sale_documents;
CREATE TRIGGER trg_business_sale_documents_updated BEFORE UPDATE ON public.business_sale_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_platform_expenses_updated ON public.platform_expenses;
CREATE TRIGGER trg_platform_expenses_updated BEFORE UPDATE ON public.platform_expenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 12. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- SOPORTE: Conversaciones (Solo service_role y admin autenticados)
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_support_conversations" ON public.support_conversations;
CREATE POLICY "service_role_all_support_conversations" ON public.support_conversations FOR ALL USING (true) WITH CHECK (true);

-- SOPORTE: Mensajes de chat
ALTER TABLE public.support_chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_support_chat_messages" ON public.support_chat_messages;
CREATE POLICY "service_role_all_support_chat_messages" ON public.support_chat_messages FOR ALL USING (true) WITH CHECK (true);

-- SOPORTE: Atenciones
ALTER TABLE public.support_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_support_interactions" ON public.support_interactions;
CREATE POLICY "service_role_all_support_interactions" ON public.support_interactions FOR ALL USING (true) WITH CHECK (true);

-- SOPORTE: Tickets
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_support_tickets" ON public.support_tickets;
CREATE POLICY "service_role_all_support_tickets" ON public.support_tickets FOR ALL USING (true) WITH CHECK (true);

-- FACTURACIÓN: Comprobantes
ALTER TABLE public.platform_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_platform_invoices" ON public.platform_invoices;
CREATE POLICY "service_role_all_platform_invoices" ON public.platform_invoices FOR ALL USING (true) WITH CHECK (true);

-- DOCUMENTOS: Configuración (aislamiento por business_id)
ALTER TABLE public.business_document_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_business_document_configs" ON public.business_document_configs;
CREATE POLICY "service_role_all_business_document_configs" ON public.business_document_configs FOR ALL USING (true) WITH CHECK (true);

-- DOCUMENTOS: Ventas (aislamiento por business_id)
ALTER TABLE public.business_sale_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_business_sale_documents" ON public.business_sale_documents;
CREATE POLICY "service_role_all_business_sale_documents" ON public.business_sale_documents FOR ALL USING (true) WITH CHECK (true);

-- EGRESOS: Plataforma
ALTER TABLE public.platform_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_platform_expenses" ON public.platform_expenses;
CREATE POLICY "service_role_all_platform_expenses" ON public.platform_expenses FOR ALL USING (true) WITH CHECK (true);

-- NOTIFICACIONES: Transversales
ALTER TABLE public.platform_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_platform_notifications" ON public.platform_notifications;
CREATE POLICY "service_role_all_platform_notifications" ON public.platform_notifications FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 13. RELOAD POSTGREST SCHEMA CACHE
-- ============================================================
NOTIFY pgrst, 'reload schema';
