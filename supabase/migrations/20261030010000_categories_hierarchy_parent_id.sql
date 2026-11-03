-- ==============================================================================
-- NEGOVA SaaS - Migración: Subcategorías y Jerarquía de Catálogo
-- Tarea: [CAT-001]
-- Objetivo: Permitir categorías padre e hijo (máximo 2 niveles)
-- ==============================================================================

-- 1. Añadir columna parent_category_id a public.categories
ALTER TABLE public.categories
    ADD COLUMN IF NOT EXISTS parent_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- 2. Índices para optimizar consultas jerárquicas y aislamiento por negocio
CREATE INDEX IF NOT EXISTS idx_categories_parent_category_id
    ON public.categories(parent_category_id);

CREATE INDEX IF NOT EXISTS idx_categories_business_parent
    ON public.categories(business_id, parent_category_id);

-- 3. Restricción para evitar que una categoría sea su propio padre
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_categories_not_self_parent'
    ) THEN
        ALTER TABLE public.categories
            ADD CONSTRAINT chk_categories_not_self_parent
            CHECK (parent_category_id IS NULL OR parent_category_id <> id);
    END IF;
END $$;
