-- ==============================================================================
-- NEGOVA SaaS - Migración: Asegurar columna created_by e índices para reportes de empleados
-- Tarea: [REP-003]
-- ==============================================================================

-- 1. Asegurar columna created_by en business_sale_documents si no existe
ALTER TABLE public.business_sale_documents
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Índice para consultas aceleradas por negocio y empleado emisor
CREATE INDEX IF NOT EXISTS idx_bsd_created_by
    ON public.business_sale_documents(business_id, created_by);

-- 3. Índice para consultas temporales con estado en documentos de venta
CREATE INDEX IF NOT EXISTS idx_bsd_business_date_status
    ON public.business_sale_documents(business_id, issued_at DESC, status);

