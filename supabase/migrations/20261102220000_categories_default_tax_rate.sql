-- ==============================================================================
-- NEGOVA SaaS - Migración: Impuesto por defecto en Categorías
-- Permite asignar un impuesto por defecto a categorías para herencia en productos
-- ==============================================================================

-- 1. Añadir columna default_tax_rate a public.categories
ALTER TABLE public.categories
    ADD COLUMN IF NOT EXISTS default_tax_rate NUMERIC DEFAULT NULL
    CHECK (default_tax_rate IS NULL OR (default_tax_rate >= 0 AND default_tax_rate <= 100));

-- 2. Índice para consultas y filtros por tasa impositiva
CREATE INDEX IF NOT EXISTS idx_categories_business_tax
    ON public.categories(business_id, default_tax_rate);
