-- Migration: 20261105100000_modifiers_commercial_type_and_description.sql
-- Descripción: Agrega soporte para descripción y modalidad comercial (Adicional, Reemplazo, Tamaño legacy)
--              a la tabla public.product_option_groups, así como índices y constraints correspondientes.

-- 1. Agregar columnas a public.product_option_groups si no existen
ALTER TABLE public.product_option_groups
ADD COLUMN IF NOT EXISTS description TEXT NULL;

ALTER TABLE public.product_option_groups
ADD COLUMN IF NOT EXISTS commercial_type TEXT NOT NULL DEFAULT 'additional';

-- 2. Asegurar constraint de validación para commercial_type
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_product_option_groups_commercial_type'
    ) THEN
        ALTER TABLE public.product_option_groups
        ADD CONSTRAINT chk_product_option_groups_commercial_type
        CHECK (commercial_type IN ('additional', 'replacement', 'size'));
    END IF;
END $$;

-- 3. Crear índice para optimizar consultas por negocio y modalidad
CREATE INDEX IF NOT EXISTS idx_product_option_groups_biz_commercial_type
ON public.product_option_groups(business_id, commercial_type);

-- ============================================================================
-- DOCUMENTACIÓN DE IMPACTO, SEGURIDAD Y REVERSIÓN:
-- Impacto:
--   - Compatible con registros previos mediante DEFAULT 'additional'.
--   - No bloquea lecturas concurrentes ni transacciones de pedidos.
--   - Permite clasificar formalmente Adicionales vs Reemplazos en la base relacional.
-- Seguridad:
--   - Protegido por las políticas RLS existentes de aislamiento por business_id.
-- Reversión (Rollback):
--   ALTER TABLE public.product_option_groups DROP CONSTRAINT IF EXISTS chk_product_option_groups_commercial_type;
--   DROP INDEX IF EXISTS idx_product_option_groups_biz_commercial_type;
--   ALTER TABLE public.product_option_groups DROP COLUMN IF EXISTS commercial_type;
--   ALTER TABLE public.product_option_groups DROP COLUMN IF EXISTS description;
-- ============================================================================

