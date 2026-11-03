-- ==============================================================================
-- NEGOVA SaaS - Migración Versionada: Módulo de Reservas [RES-001]
-- Archivo: supabase/migrations/20261101180000_reservations_schema.sql
-- Fase: 6 | Módulo: Reservas | Prioridad: P2
-- Fecha: 2026-11-01
-- 
-- Objetivos:
-- 1. Crear tabla 'public.reservations' para gestión integral de reservas de mesas y salas.
-- 2. Soporte para comensales (party_size), fecha, hora, sala (room_id) y mesa (table_id).
-- 3. Estados: pending, confirmed, checked_in, seated, cancelled, no_show, completed.
-- 4. Orígenes: direct, phone, web, whatsapp, walk_in.
-- 5. Requerimientos especiales, alergias, notas internas y facturación opcional (min_spend / deposit).
-- 6. Habilitar RLS multi-tenant estricto vinculado a 'public.business_users'.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    party_size INTEGER NOT NULL DEFAULT 2 CHECK (party_size > 0),
    date DATE NOT NULL,
    time TIME NOT NULL,
    room_id UUID REFERENCES public.restaurant_rooms(id) ON DELETE SET NULL,
    table_id UUID REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'checked_in', 'seated', 'cancelled', 'no_show', 'completed')),
    origin TEXT NOT NULL DEFAULT 'direct' CHECK (origin IN ('direct', 'phone', 'web', 'whatsapp', 'walk_in')),
    special_requests TEXT,
    allergies TEXT,
    notes TEXT,
    min_spend NUMERIC(14, 2) DEFAULT 0,
    deposit_amount NUMERIC(14, 2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de consulta frecuente para vistas de calendario, lista y ocupación
CREATE INDEX IF NOT EXISTS idx_reservations_business_date
    ON public.reservations(business_id, date);

CREATE INDEX IF NOT EXISTS idx_reservations_business_status
    ON public.reservations(business_id, status);

CREATE INDEX IF NOT EXISTS idx_reservations_room_id
    ON public.reservations(room_id);

CREATE INDEX IF NOT EXISTS idx_reservations_table_id
    ON public.reservations(table_id);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad Multi-Tenant
DROP POLICY IF EXISTS "tenant_reservations_read" ON public.reservations;
CREATE POLICY "tenant_reservations_read" ON public.reservations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = reservations.business_id
            AND bu.user_id = auth.uid()
            AND bu.status = 'active'
        )
    );

DROP POLICY IF EXISTS "tenant_reservations_insert" ON public.reservations;
CREATE POLICY "tenant_reservations_insert" ON public.reservations
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = reservations.business_id
            AND bu.user_id = auth.uid()
            AND bu.status = 'active'
        )
    );

DROP POLICY IF EXISTS "tenant_reservations_update" ON public.reservations;
CREATE POLICY "tenant_reservations_update" ON public.reservations
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = reservations.business_id
            AND bu.user_id = auth.uid()
            AND bu.status = 'active'
        )
    );

DROP POLICY IF EXISTS "tenant_reservations_delete" ON public.reservations;
CREATE POLICY "tenant_reservations_delete" ON public.reservations
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = reservations.business_id
            AND bu.user_id = auth.uid()
            AND bu.status = 'active'
        )
    );

