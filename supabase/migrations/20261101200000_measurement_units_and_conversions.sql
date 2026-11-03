-- ==============================================================================
-- NEGOVA SaaS - Migración Versionada: Unidades de Medida y Conversiones [CONF-001]
-- Archivo: supabase/migrations/20261101200000_measurement_units_and_conversions.sql
-- Fase: 9 | Módulo: Configuración | Prioridad: P2
-- Fecha: 2026-11-01
-- 
-- Objetivos:
-- 1. Crear tabla 'public.measurement_units' para gestión de unidades y factores de conversión.
-- 2. Soporte para tipos: 'weight', 'volume', 'length', 'count'.
-- 3. Unidades base predeterminadas: kg, litro, metro, unidad.
-- 4. Conversiones: factor numérico respecto a la unidad base de su tipo.
-- 5. Función y trigger para inicializar automáticamente las unidades base al crear un negocio.
-- 6. Habilitar RLS multi-tenant estricto vinculado a 'public.business_users'.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.measurement_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    abbreviation TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('weight', 'volume', 'length', 'count')),
    is_base BOOLEAN NOT NULL DEFAULT false,
    conversion_factor NUMERIC(15, 6) NOT NULL DEFAULT 1.0 CHECK (conversion_factor > 0),
    base_unit_id UUID REFERENCES public.measurement_units(id) ON DELETE SET NULL,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_measurement_units_business_abbreviation UNIQUE (business_id, abbreviation)
);

CREATE INDEX IF NOT EXISTS idx_measurement_units_business_id
    ON public.measurement_units(business_id);

CREATE INDEX IF NOT EXISTS idx_measurement_units_business_type
    ON public.measurement_units(business_id, type);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.measurement_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_measurement_units_read" ON public.measurement_units;
CREATE POLICY "tenant_measurement_units_read" ON public.measurement_units
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = measurement_units.business_id
            AND bu.user_id = auth.uid()
            AND bu.status = 'active'
        )
    );

DROP POLICY IF EXISTS "tenant_measurement_units_insert" ON public.measurement_units;
CREATE POLICY "tenant_measurement_units_insert" ON public.measurement_units
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = measurement_units.business_id
            AND bu.user_id = auth.uid()
            AND bu.status = 'active'
        )
    );

DROP POLICY IF EXISTS "tenant_measurement_units_update" ON public.measurement_units;
CREATE POLICY "tenant_measurement_units_update" ON public.measurement_units
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = measurement_units.business_id
            AND bu.user_id = auth.uid()
            AND bu.status = 'active'
        )
    );

DROP POLICY IF EXISTS "tenant_measurement_units_delete" ON public.measurement_units;
CREATE POLICY "tenant_measurement_units_delete" ON public.measurement_units
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = measurement_units.business_id
            AND bu.user_id = auth.uid()
            AND bu.status = 'active'
        )
    );

-- Función para inicializar unidades base para un comercio
CREATE OR REPLACE FUNCTION public.seed_business_measurement_units(p_business_id UUID)
RETURNS VOID AS $$
DECLARE
    v_kg_id UUID;
    v_lt_id UUID;
    v_m_id UUID;
    v_un_id UUID;
BEGIN
    -- 1. Peso: Base kg
    INSERT INTO public.measurement_units (business_id, name, abbreviation, type, is_base, conversion_factor, is_system)
    VALUES (p_business_id, 'Kilogramo', 'kg', 'weight', true, 1.0, true)
    ON CONFLICT (business_id, abbreviation) DO NOTHING
    RETURNING id INTO v_kg_id;

    IF v_kg_id IS NULL THEN
        SELECT id INTO v_kg_id FROM public.measurement_units WHERE business_id = p_business_id AND abbreviation = 'kg';
    END IF;

    -- Peso: Gramo (0.001 kg)
    INSERT INTO public.measurement_units (business_id, name, abbreviation, type, is_base, conversion_factor, base_unit_id, is_system)
    VALUES (p_business_id, 'Gramo', 'g', 'weight', false, 0.001, v_kg_id, true)
    ON CONFLICT (business_id, abbreviation) DO NOTHING;

    -- 2. Volumen: Base lt
    INSERT INTO public.measurement_units (business_id, name, abbreviation, type, is_base, conversion_factor, is_system)
    VALUES (p_business_id, 'Litro', 'lt', 'volume', true, 1.0, true)
    ON CONFLICT (business_id, abbreviation) DO NOTHING
    RETURNING id INTO v_lt_id;

    IF v_lt_id IS NULL THEN
        SELECT id INTO v_lt_id FROM public.measurement_units WHERE business_id = p_business_id AND abbreviation = 'lt';
    END IF;

    -- Volumen: Mililitro (0.001 lt)
    INSERT INTO public.measurement_units (business_id, name, abbreviation, type, is_base, conversion_factor, base_unit_id, is_system)
    VALUES (p_business_id, 'Mililitro', 'ml', 'volume', false, 0.001, v_lt_id, true)
    ON CONFLICT (business_id, abbreviation) DO NOTHING;

    -- 3. Longitud: Base m
    INSERT INTO public.measurement_units (business_id, name, abbreviation, type, is_base, conversion_factor, is_system)
    VALUES (p_business_id, 'Metro', 'm', 'length', true, 1.0, true)
    ON CONFLICT (business_id, abbreviation) DO NOTHING
    RETURNING id INTO v_m_id;

    IF v_m_id IS NULL THEN
        SELECT id INTO v_m_id FROM public.measurement_units WHERE business_id = p_business_id AND abbreviation = 'm';
    END IF;

    -- Longitud: Centímetro (0.01 m)
    INSERT INTO public.measurement_units (business_id, name, abbreviation, type, is_base, conversion_factor, base_unit_id, is_system)
    VALUES (p_business_id, 'Centímetro', 'cm', 'length', false, 0.01, v_m_id, true)
    ON CONFLICT (business_id, abbreviation) DO NOTHING;

    -- 4. Conteo: Base un
    INSERT INTO public.measurement_units (business_id, name, abbreviation, type, is_base, conversion_factor, is_system)
    VALUES (p_business_id, 'Unidad', 'un', 'count', true, 1.0, true)
    ON CONFLICT (business_id, abbreviation) DO NOTHING
    RETURNING id INTO v_un_id;

    IF v_un_id IS NULL THEN
        SELECT id INTO v_un_id FROM public.measurement_units WHERE business_id = p_business_id AND abbreviation = 'un';
    END IF;

    -- Conteo: Porción (1.0 un)
    INSERT INTO public.measurement_units (business_id, name, abbreviation, type, is_base, conversion_factor, base_unit_id, is_system)
    VALUES (p_business_id, 'Porción', 'porc', 'count', false, 1.0, v_un_id, true)
    ON CONFLICT (business_id, abbreviation) DO NOTHING;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para inicializar automáticamente unidades base al crear un negocio
CREATE OR REPLACE FUNCTION public.trg_seed_business_units()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.seed_business_measurement_units(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_business_created_seed_units ON public.businesses;
CREATE TRIGGER trg_business_created_seed_units
AFTER INSERT ON public.businesses
FOR EACH ROW
EXECUTE FUNCTION public.trg_seed_business_units();
