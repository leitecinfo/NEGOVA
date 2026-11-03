-- ==============================================================================
-- NEGOVA SaaS - Migración Versionada: Control de Canales de Venta por Producto
-- Archivo: supabase/migrations/20261030030000_products_sales_channels.sql
-- Tarea: [CAT-005]
-- Dependencias: [CAT-004]
-- Fecha: 2026-10-29
--
-- Objetivos resueltos:
-- 1. Agregar columnas 'available_in_pos', 'available_in_qr' y 'available_online'
--    a la tabla 'public.products' (por defecto true).
-- 2. Sincronizar valores existentes desde 'metadata' (incluyendo compatibilidad
--    con 'show_in_qr_menu').
-- 3. Crear índices optimizados para consultas de filtrado por canal en POS y QR.
-- 4. Habilitar replicación en tiempo real (supabase_realtime) para 'public.products'
--    permitiendo que cambios de canales se reflejen instantáneamente sin recargar.
-- ==============================================================================

-- 1. Añadir columnas de disponibilidad por canal de venta
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS available_in_pos BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS available_in_qr BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS available_online BOOLEAN NOT NULL DEFAULT true;

-- 2. Backfill desde metadata existente (respetando configuraciones previas o show_in_qr_menu)
UPDATE public.products
SET
    available_in_pos = CASE
        WHEN metadata ? 'available_in_pos' AND jsonb_typeof(metadata->'available_in_pos') = 'boolean'
            THEN (metadata->>'available_in_pos')::boolean
        ELSE available_in_pos
    END,
    available_in_qr = CASE
        WHEN metadata ? 'available_in_qr' AND jsonb_typeof(metadata->'available_in_qr') = 'boolean'
            THEN (metadata->>'available_in_qr')::boolean
        WHEN metadata ? 'show_in_qr_menu' AND jsonb_typeof(metadata->'show_in_qr_menu') = 'boolean'
            THEN (metadata->>'show_in_qr_menu')::boolean
        ELSE available_in_qr
    END,
    available_online = CASE
        WHEN metadata ? 'available_online' AND jsonb_typeof(metadata->'available_online') = 'boolean'
            THEN (metadata->>'available_online')::boolean
        ELSE available_online
    END,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'available_in_pos', CASE
            WHEN metadata ? 'available_in_pos' AND jsonb_typeof(metadata->'available_in_pos') = 'boolean'
                THEN (metadata->>'available_in_pos')::boolean
            ELSE true
        END,
        'available_in_qr', CASE
            WHEN metadata ? 'available_in_qr' AND jsonb_typeof(metadata->'available_in_qr') = 'boolean'
                THEN (metadata->>'available_in_qr')::boolean
            WHEN metadata ? 'show_in_qr_menu' AND jsonb_typeof(metadata->'show_in_qr_menu') = 'boolean'
                THEN (metadata->>'show_in_qr_menu')::boolean
            ELSE true
        END,
        'available_online', CASE
            WHEN metadata ? 'available_online' AND jsonb_typeof(metadata->'available_online') = 'boolean'
                THEN (metadata->>'available_online')::boolean
            ELSE true
        END
    );

-- 3. Índices de rendimiento para consultas filtradas por canal
CREATE INDEX IF NOT EXISTS idx_products_business_available_pos
    ON public.products (business_id, status, available_in_pos);

CREATE INDEX IF NOT EXISTS idx_products_business_available_qr
    ON public.products (business_id, status, is_available, available_in_qr);

CREATE INDEX IF NOT EXISTS idx_products_business_available_online
    ON public.products (business_id, status, is_available, available_online);

-- 4. Habilitar publicación Realtime para 'public.products' de forma idempotente
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = 'products'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
        END IF;
    END IF;
END
$$;
