-- ==============================================================================
-- NEGOVA SaaS - Migración Versionada: Tabla de Registro de Mermas (Spoilage)
-- Archivo: supabase/migrations/20261030020000_spoilage_records_schema.sql
-- Tarea: [CAT-007]
-- Fecha: 2026-10-30
-- 
-- Objetivos:
-- 1. Crear tabla 'public.spoilage_records' para registrar mermas y pérdidas de productos e ingredientes.
-- 2. Definir claves foráneas, restricciones de integridad y tipos de causa.
-- 3. Crear índices de rendimiento por negocio, fecha y producto.
-- 4. Habilitar Row Level Security (RLS) con aislamiento estricto por 'business_id'.
-- ==============================================================================

-- 1. Crear tabla public.spoilage_records
CREATE TABLE IF NOT EXISTS public.spoilage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    item_type TEXT NOT NULL CHECK (item_type IN ('product', 'ingredient')),
    item_id UUID NOT NULL,
    item_name TEXT NOT NULL,
    cause TEXT NOT NULL CHECK (cause IN ('expired', 'damaged', 'spilled', 'stolen', 'other')),
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    total_cost NUMERIC NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
    notes TEXT,
    registered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Índices de Rendimiento
CREATE INDEX IF NOT EXISTS idx_spoilage_records_business_id 
    ON public.spoilage_records(business_id);

CREATE INDEX IF NOT EXISTS idx_spoilage_records_business_date 
    ON public.spoilage_records(business_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_spoilage_records_item_id 
    ON public.spoilage_records(item_id);

CREATE INDEX IF NOT EXISTS idx_spoilage_records_location_id 
    ON public.spoilage_records(location_id);

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE public.spoilage_records ENABLE ROW LEVEL SECURITY;

-- 4. Política RLS para Service Role (Bypass para operaciones seguras de backend)
DROP POLICY IF EXISTS "service_role_all_spoilage_records" ON public.spoilage_records;
CREATE POLICY "service_role_all_spoilage_records" ON public.spoilage_records
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 5. Políticas RLS para Usuarios Autenticados (Aislamiento multi-tenant por negocio)
DROP POLICY IF EXISTS "tenant_spoilage_records_read" ON public.spoilage_records;
CREATE POLICY "tenant_spoilage_records_read" ON public.spoilage_records
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = spoilage_records.business_id
              AND bu.user_id = (SELECT auth.uid())
              AND bu.status = 'active'
        )
    );

DROP POLICY IF EXISTS "tenant_spoilage_records_write" ON public.spoilage_records;
CREATE POLICY "tenant_spoilage_records_write" ON public.spoilage_records
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = spoilage_records.business_id
              AND bu.user_id = (SELECT auth.uid())
              AND bu.status = 'active'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = spoilage_records.business_id
              AND bu.user_id = (SELECT auth.uid())
              AND bu.status = 'active'
        )
    );

COMMENT ON TABLE public.spoilage_records IS 'Registro de mermas y pérdidas de inventario de productos e ingredientes con motivo, costo y trazabilidad.';

