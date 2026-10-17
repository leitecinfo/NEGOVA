-- ==============================================================================
-- NEGOVA - Migración de ampliación de configuración documental y de negocio
-- Motor: PostgreSQL 15+ / Supabase
-- Añade campos de contacto (WhatsApp, Departamento, Código Postal) y
-- políticas específicas de comprobantes (Observaciones, Cambios y Devoluciones, Garantía).
-- ==============================================================================

DO $$
BEGIN
  -- 1. Campos de contacto y ubicación
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'business_document_configs' AND column_name = 'whatsapp'
  ) THEN
    ALTER TABLE public.business_document_configs ADD COLUMN whatsapp TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'business_document_configs' AND column_name = 'department'
  ) THEN
    ALTER TABLE public.business_document_configs ADD COLUMN department TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'business_document_configs' AND column_name = 'postal_code'
  ) THEN
    ALTER TABLE public.business_document_configs ADD COLUMN postal_code TEXT;
  END IF;

  -- 2. Campos de políticas y textos de comprobantes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'business_document_configs' AND column_name = 'document_observations'
  ) THEN
    ALTER TABLE public.business_document_configs ADD COLUMN document_observations TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'business_document_configs' AND column_name = 'return_policy'
  ) THEN
    ALTER TABLE public.business_document_configs ADD COLUMN return_policy TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'business_document_configs' AND column_name = 'warranty_policy'
  ) THEN
    ALTER TABLE public.business_document_configs ADD COLUMN warranty_policy TEXT;
  END IF;
END $$;
