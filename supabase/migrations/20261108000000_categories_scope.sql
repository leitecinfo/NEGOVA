-- ==============================================================================
-- NEGOVA SaaS - Migración Local: Clasificación de Categorías por Alcance (Scope)
-- Archivo: supabase/migrations/20261108000000_categories_scope.sql
-- Tarea: [CAT-SCOPE-001]
-- Fecha: 2026-11-08
--
-- Objetivos resueltos:
-- 1. Agregar columna 'scope' a 'public.categories' con valores ('commercial', 'internal', 'both').
-- 2. Clasificar categorías existentes: por defecto 'commercial'. Categorías que contengan
--    'ingrediente', 'insumo' o 'materia prima' se inicializan en 'internal'.
-- 3. Crear índice para optimizar consultas de filtrado por tenant y alcance.
-- 4. No alterar relaciones foráneas existentes ni integridad referencial con 'products'.
-- ==============================================================================

-- 1. Añadir columna scope con valor por defecto 'commercial'
ALTER TABLE public.categories
    ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'commercial'
    CHECK (scope IN ('commercial', 'internal', 'both'));

-- 2. Clasificar retrospectivamente categorías existentes basadas en su nombre
UPDATE public.categories
SET scope = 'internal'
WHERE scope = 'commercial'
  AND (
      lower(name) LIKE '%ingrediente%'
      OR lower(name) LIKE '%insumo%'
      OR lower(name) LIKE '%materia prima%'
      OR lower(name) LIKE '%empaque%'
  );

-- 3. Crear índice optimizado para consultas multi-tenant por negocio y alcance
CREATE INDEX IF NOT EXISTS idx_categories_business_scope
    ON public.categories(business_id, scope);

