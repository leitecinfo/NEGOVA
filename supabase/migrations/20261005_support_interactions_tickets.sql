-- Migración SQL para el módulo de Soporte
-- Migrando desde platform_settings JSON a PostgreSQL tables.

-- CREATE TABLES
CREATE TABLE IF NOT EXISTS public.support_interactions (
    id TEXT PRIMARY KEY,
    interaction_number TEXT UNIQUE NOT NULL,
    business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
    business_name TEXT NOT NULL,
    business_slug TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    contact_phone TEXT,
    contact_email TEXT,
    channel TEXT NOT NULL,
    category TEXT NOT NULL,
    subject TEXT NOT NULL,
    summary TEXT NOT NULL,
    outcome TEXT NOT NULL,
    ticket_id TEXT,
    ticket_number TEXT,
    agent_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    agent_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.support_tickets (
    id TEXT PRIMARY KEY,
    ticket_number TEXT UNIQUE NOT NULL,
    business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
    business_name TEXT NOT NULL,
    business_slug TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    contact_email TEXT,
    contact_phone TEXT,
    origin_channel TEXT NOT NULL,
    interaction_id TEXT REFERENCES public.support_interactions(id) ON DELETE SET NULL,
    interaction_number TEXT,
    category TEXT NOT NULL,
    priority TEXT NOT NULL,
    status TEXT NOT NULL,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    assigned_agent_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    assigned_agent_name TEXT,
    internal_notes TEXT,
    client_resolution TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ
);

-- ADD INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_support_interactions_business_id ON public.support_interactions(business_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_business_id ON public.support_tickets(business_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_interactions_created_at ON public.support_interactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets(created_at DESC);

-- NOTE: We are NOT enabling RLS yet as per instructions ("RLS queda como fase posterior").
