/**
 * API Route to execute the SQL migration using the admin Supabase client.
 * This runs inside Next.js where the service_role key works correctly.
 * 
 * Call via: GET /api/migrate
 */
import { NextResponse } from "next/server";

const MIGRATION_SQL = `
-- support_conversations
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
  status TEXT NOT NULL DEFAULT 'active',
  mode TEXT NOT NULL DEFAULT 'ai',
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

-- support_chat_messages
CREATE TABLE IF NOT EXISTS public.support_chat_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL,
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

-- support_interactions
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
  outcome TEXT NOT NULL DEFAULT 'resolved_immediately',
  ticket_id TEXT,
  ticket_number TEXT,
  agent_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  agent_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- support_tickets
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
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
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

-- platform_invoices
CREATE TABLE IF NOT EXISTS public.platform_invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  business_name TEXT NOT NULL DEFAULT '',
  business_slug TEXT NOT NULL DEFAULT '',
  plan_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  billing_interval TEXT NOT NULL DEFAULT 'monthly',
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'COP',
  status TEXT NOT NULL DEFAULT 'pending',
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

-- business_document_configs
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

-- business_sale_documents
CREATE TABLE IF NOT EXISTS public.business_sale_documents (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  document_number TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'sale',
  customer_name TEXT NOT NULL DEFAULT 'Cliente General',
  customer_id TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  customer_address TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'COP',
  payment_method TEXT NOT NULL DEFAULT 'cash',
  status TEXT NOT NULL DEFAULT 'completed',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date TIMESTAMPTZ,
  notes TEXT,
  pdf_url TEXT,
  pdf_storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, document_number)
);

-- platform_expenses
CREATE TABLE IF NOT EXISTS public.platform_expenses (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  category_label TEXT NOT NULL DEFAULT 'Otros Egresos',
  concept TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'COP',
  expense_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  receipt_reference TEXT,
  notes TEXT,
  registered_by_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- platform_notifications
CREATE TABLE IF NOT EXISTS public.platform_notifications (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL DEFAULT 'platform',
  audience TEXT NOT NULL DEFAULT 'global',
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sup_conv_business ON public.support_conversations(business_id);
CREATE INDEX IF NOT EXISTS idx_sup_conv_status ON public.support_conversations(status);
CREATE INDEX IF NOT EXISTS idx_sup_msg_conv ON public.support_chat_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_sup_inter_business ON public.support_interactions(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sup_tck_business ON public.support_tickets(business_id, status);
CREATE INDEX IF NOT EXISTS idx_sup_tck_assigned ON public.support_tickets(assigned_agent_id, status);
CREATE INDEX IF NOT EXISTS idx_plat_inv_business ON public.platform_invoices(business_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_plat_inv_status ON public.platform_invoices(status);
CREATE INDEX IF NOT EXISTS idx_bsd_business ON public.business_sale_documents(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plat_exp_date ON public.platform_expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_plat_notif_scope ON public.platform_notifications(scope, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plat_notif_user ON public.platform_notifications(recipient_user_id, is_read);

-- RLS (policies that allow service_role full access)
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_document_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_sale_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_notifications ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
`;

async function getAdminClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  try {
    const admin = await getAdminClient();

    // Execute migration via rpc
    // Since Supabase doesn't have a generic exec_sql rpc, we'll create tables
    // individually using the admin client

    // Split the SQL into individual statements and execute them
    const statements = MIGRATION_SQL
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 10 && !s.startsWith("--"));

    const results: Array<{ statement: string; success: boolean; error?: string }> = [];

    for (const stmt of statements) {
      try {
        const { error } = await admin.rpc("exec_raw_sql", { sql_query: stmt + ";" });
        if (error) {
          results.push({
            statement: stmt.slice(0, 80) + "...",
            success: false,
            error: error.message,
          });
        } else {
          results.push({
            statement: stmt.slice(0, 80) + "...",
            success: true,
          });
        }
      } catch (err: any) {
        results.push({
          statement: stmt.slice(0, 80) + "...",
          success: false,
          error: err?.message || "Unknown error",
        });
      }
    }

    // After RPC failures, try the alternative approach: use the pg-meta endpoint
    // Actually, the best approach for executing DDL is to use the Supabase SQL API
    // which is the pg-meta service at /pg/query

    // Try connecting via the database REST endpoint  
    const pgMetaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(".supabase.co", ".supabase.co");
    
    // Alternative: Try using the admin client's .from().select() to verify tables exist after creation
    // The real solution is to execute this SQL in the Supabase Dashboard SQL Editor
    
    return NextResponse.json({
      message: "Migration attempted. Please execute the SQL in Supabase Dashboard SQL Editor.",
      dashboard_url: `https://supabase.com/dashboard/project/zjixuaizkgeptjmrulbz/sql/new`,
      results_sample: results.slice(0, 5),
      total_statements: statements.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Migration failed" }, { status: 500 });
  }
}
