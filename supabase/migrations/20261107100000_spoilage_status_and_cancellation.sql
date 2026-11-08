-- ==============================================================================
-- NEGOVA SaaS - Migración Versionada: Soporte para Estado y Anulación de Mermas
-- Archivo: supabase/migrations/20261107100000_spoilage_status_and_cancellation.sql
-- Fecha: 2026-11-07
-- 
-- Objetivos:
-- 1. Añadir columnas 'status', 'cancelled_at', 'cancelled_by', 'cancellation_reason' y 'updated_at' a public.spoilage_records.
-- 2. Asegurar que el estado por defecto sea 'active' con restricción CHECK ('active', 'cancelled').
-- 3. Crear índice para optimizar consultas de mermas vigentes y anuladas por negocio.
-- ==============================================================================

-- 1. Añadir columnas de estado, anulación y auditoría a public.spoilage_records
ALTER TABLE public.spoilage_records
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. Índice de consulta para mermas por estado y fecha
CREATE INDEX IF NOT EXISTS idx_spoilage_records_business_status 
    ON public.spoilage_records(business_id, status, date DESC);

COMMENT ON COLUMN public.spoilage_records.status IS 'Estado de la merma: active (vigente y descontada del stock) o cancelled (anulada con existencias revertidas).';
COMMENT ON COLUMN public.spoilage_records.cancellation_reason IS 'Motivo justificado del proceso de anulación de la merma.';

