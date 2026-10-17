-- Migración SQL para el módulo de Facturación
-- Migrando desde platform_settings JSON a PostgreSQL tables.

DROP TABLE IF EXISTS public.platform_invoices CASCADE;

CREATE TABLE public.platform_invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
    business_name TEXT NOT NULL,
    business_slug TEXT NOT NULL,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    plan_id TEXT NOT NULL,
    plan_name TEXT NOT NULL,
    billing_interval TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    currency TEXT NOT NULL DEFAULT 'COP',
    status TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    payment_reference TEXT,
    issued_at TIMESTAMPTZ NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    notes TEXT,
    pdf_url TEXT,
    pdf_storage_path TEXT,
    last_email_sent_at TIMESTAMPTZ,
    last_sent_to_email TEXT,
    billing_period TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotencia para no duplicar facturas del mismo periodo
ALTER TABLE public.platform_invoices ADD CONSTRAINT platform_invoices_subscription_period_key UNIQUE (subscription_id, billing_period);

-- Indices para escalabilidad
CREATE INDEX IF NOT EXISTS idx_platform_invoices_business_id ON public.platform_invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_platform_invoices_subscription_id ON public.platform_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_platform_invoices_status ON public.platform_invoices(status);
CREATE INDEX IF NOT EXISTS idx_platform_invoices_issued_at ON public.platform_invoices(issued_at);
