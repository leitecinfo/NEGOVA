-- ==============================================================================
-- NEGOVA SaaS - Migración Versionada: Editor de Zonas de Entrega [DOM-001]
-- Archivo: supabase/migrations/20261030120000_delivery_zones_schema.sql
-- Fase: 7 | Módulo: Domicilios | Prioridad: P1
-- Fecha: 2026-10-30
-- 
-- Objetivos:
-- 1. Crear tabla 'public.delivery_zones' (zonas geográficas de reparto con tarifas y tiempos).
-- 2. Añadir columna 'delivery_zone_id' a 'public.restaurant_orders' para trazabilidad.
-- 3. Índices de rendimiento multi-tenant y claves foráneas en cascada.
-- 4. Habilitar Row Level Security (RLS) multi-tenant estricto mediante 'public.business_users'.
-- ==============================================================================

-- 1. Tabla de Zonas de Entrega
CREATE TABLE IF NOT EXISTS public.delivery_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    tariff NUMERIC NOT NULL DEFAULT 0 CHECK (tariff >= 0),
    min_order NUMERIC NOT NULL DEFAULT 0 CHECK (min_order >= 0),
    estimated_time_min INT NOT NULL DEFAULT 30 CHECK (estimated_time_min >= 0),
    priority INT NOT NULL DEFAULT 1,
    color TEXT NOT NULL DEFAULT '#ED500A',
    geometry JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_delivery_zones_name_per_business UNIQUE (business_id, name)
);

-- Índices en public.delivery_zones
CREATE INDEX IF NOT EXISTS idx_delivery_zones_business_id
    ON public.delivery_zones(business_id);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_status
    ON public.delivery_zones(business_id, status);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_priority
    ON public.delivery_zones(business_id, priority DESC);

-- 2. Añadir columna delivery_zone_id en restaurant_orders si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'restaurant_orders' 
        AND column_name = 'delivery_zone_id'
    ) THEN
        ALTER TABLE public.restaurant_orders
            ADD COLUMN delivery_zone_id UUID REFERENCES public.delivery_zones(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_restaurant_orders_delivery_zone_id
    ON public.restaurant_orders(delivery_zone_id);

-- 3. Habilitar Row Level Security (RLS) en delivery_zones
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad Multi-Tenant
DROP POLICY IF EXISTS "tenant_delivery_zones_read" ON public.delivery_zones;
CREATE POLICY "tenant_delivery_zones_read" ON public.delivery_zones
    FOR SELECT
    USING (
        business_id IN (
            SELECT bu.business_id 
            FROM public.business_users bu 
            WHERE bu.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "tenant_delivery_zones_write" ON public.delivery_zones;
CREATE POLICY "tenant_delivery_zones_write" ON public.delivery_zones
    FOR ALL
    USING (
        business_id IN (
            SELECT bu.business_id 
            FROM public.business_users bu 
            WHERE bu.user_id = auth.uid()
        )
    )
    WITH CHECK (
        business_id IN (
            SELECT bu.business_id 
            FROM public.business_users bu 
            WHERE bu.user_id = auth.uid()
        )
    );

-- 4. Permisos de roles para PostgREST
GRANT ALL ON TABLE public.delivery_zones TO authenticated, service_role;
