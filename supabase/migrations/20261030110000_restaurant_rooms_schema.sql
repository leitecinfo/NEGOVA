-- ==============================================================================
-- NEGOVA SaaS - Migración Versionada: Salas de Restaurante [MES-001]
-- Archivo: supabase/migrations/20261030110000_restaurant_rooms_schema.sql
-- Fase: 6 | Módulo: Mesas | Prioridad: P1
-- Fecha: 2026-10-30
-- 
-- Objetivos:
-- 1. Crear tabla 'public.restaurant_rooms' (salas/ambientes físicos de restaurante: Terraza, Interior, Barra, etc.).
-- 2. Añadir columna 'room_id REFERENCES public.restaurant_rooms(id)' a 'public.restaurant_tables'.
-- 3. Índices de rendimiento y claves foráneas en cascada.
-- 4. Habilitar Row Level Security (RLS) multi-tenant estricto mediante 'public.business_users'.
-- ==============================================================================

-- 1. Tabla de Salas de Restaurante
CREATE TABLE IF NOT EXISTS public.restaurant_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_restaurant_rooms_name_per_business UNIQUE (business_id, name)
);

-- Índices en public.restaurant_rooms
CREATE INDEX IF NOT EXISTS idx_restaurant_rooms_business_id
    ON public.restaurant_rooms(business_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_rooms_location_id
    ON public.restaurant_rooms(location_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_rooms_status
    ON public.restaurant_rooms(business_id, status);

-- 2. Añadir columna room_id en restaurant_tables si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'restaurant_tables' 
        AND column_name = 'room_id'
    ) THEN
        ALTER TABLE public.restaurant_tables
            ADD COLUMN room_id UUID REFERENCES public.restaurant_rooms(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_restaurant_tables_room_id
    ON public.restaurant_tables(room_id);

-- 3. Habilitar Row Level Security (RLS) en restaurant_rooms
ALTER TABLE public.restaurant_rooms ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad Multi-Tenant
DROP POLICY IF EXISTS "tenant_rooms_read" ON public.restaurant_rooms;
CREATE POLICY "tenant_rooms_read" ON public.restaurant_rooms
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = restaurant_rooms.business_id
            AND bu.user_id = auth.uid()
            AND bu.status = 'active'
        )
    );

DROP POLICY IF EXISTS "tenant_rooms_insert" ON public.restaurant_rooms;
CREATE POLICY "tenant_rooms_insert" ON public.restaurant_rooms
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = restaurant_rooms.business_id
            AND bu.user_id = auth.uid()
            AND bu.status = 'active'
        )
    );

DROP POLICY IF EXISTS "tenant_rooms_update" ON public.restaurant_rooms;
CREATE POLICY "tenant_rooms_update" ON public.restaurant_rooms
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = restaurant_rooms.business_id
            AND bu.user_id = auth.uid()
            AND bu.status = 'active'
        )
    );

DROP POLICY IF EXISTS "tenant_rooms_delete" ON public.restaurant_rooms;
CREATE POLICY "tenant_rooms_delete" ON public.restaurant_rooms
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = restaurant_rooms.business_id
            AND bu.user_id = auth.uid()
            AND bu.status = 'active'
        )
    );

DROP POLICY IF EXISTS "service_role_all_restaurant_rooms" ON public.restaurant_rooms;
CREATE POLICY "service_role_all_restaurant_rooms" ON public.restaurant_rooms
    FOR ALL
    USING (true)
    WITH CHECK (true);

