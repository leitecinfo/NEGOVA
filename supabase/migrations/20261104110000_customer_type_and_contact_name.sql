-- ==============================================================================
-- NEGOVA SaaS — Migración: Diferenciación Persona Natural y Empresa en Clientes
-- Archivo: supabase/migrations/20261104110000_customer_type_and_contact_name.sql
-- ==============================================================================

ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS customer_type TEXT NOT NULL DEFAULT 'individual',
    ADD COLUMN IF NOT EXISTS contact_name TEXT DEFAULT NULL;

COMMENT ON COLUMN public.customers.customer_type IS 'Tipo de cliente: individual (Persona Natural) o business (Empresa)';
COMMENT ON COLUMN public.customers.contact_name IS 'Nombre de la persona de contacto o representante para clientes tipo Empresa';

CREATE INDEX IF NOT EXISTS idx_customers_type
    ON public.customers (business_id, customer_type);

