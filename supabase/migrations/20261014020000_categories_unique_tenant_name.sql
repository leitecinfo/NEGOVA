-- Migration: 20261014020000_categories_unique_tenant_name.sql
-- Enforce unique category names per business for non-archived categories

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_business_name_unique
ON public.categories (business_id, LOWER(TRIM(name)))
WHERE status != 'archived';
