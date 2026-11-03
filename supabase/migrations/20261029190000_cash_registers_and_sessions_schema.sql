-- ==============================================================================
-- NEGOVA SaaS - Migración Versionada: Módulo de Cajas, Turnos y Movimientos
-- Archivo: supabase/migrations/20261029190000_cash_registers_and_sessions_schema.sql
-- Tarea: [CAJ-001]
-- Fecha: 2026-10-29
-- 
-- Objetivos:
-- 1. Crear tabla 'public.cash_registers' (cajas físicas o lógicas por negocio).
-- 2. Crear tabla 'public.cash_sessions' (turnos o sesiones operativas de caja).
-- 3. Crear tabla 'public.cash_movements' (trazabilidad de entradas, salidas, ventas y gastos).
-- 4. Restricción única parcial: Garantizar exactamente MÁXIMO 1 sesión abierta por caja a la vez.
-- 5. Claves foráneas, índices de rendimiento y eliminación en cascada.
-- 6. Habilitar Row Level Security (RLS) con aislamiento estricto por 'business_id'.
-- 7. Trigger automático para asegurar caja predeterminada en nuevos comercios.
-- 8. Migración de datos: Crear 'Caja Principal' para todos los negocios existentes.
-- ==============================================================================

-- 1. Tabla de Cajas (public.cash_registers)
CREATE TABLE IF NOT EXISTS public.cash_registers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices en public.cash_registers
CREATE INDEX IF NOT EXISTS idx_cash_registers_business_id 
    ON public.cash_registers(business_id);

CREATE INDEX IF NOT EXISTS idx_cash_registers_location_id 
    ON public.cash_registers(location_id);

CREATE INDEX IF NOT EXISTS idx_cash_registers_business_active 
    ON public.cash_registers(business_id, is_active);

-- 2. Tabla de Sesiones / Turnos de Caja (public.cash_sessions)
CREATE TABLE IF NOT EXISTS public.cash_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    register_id UUID NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    opened_by UUID REFERENCES public.business_users(id) ON DELETE SET NULL,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    initial_amount NUMERIC NOT NULL DEFAULT 0,
    closed_by UUID REFERENCES public.business_users(id) ON DELETE SET NULL,
    closed_at TIMESTAMPTZ,
    final_amount_counted NUMERIC,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices en public.cash_sessions
CREATE INDEX IF NOT EXISTS idx_cash_sessions_register_id 
    ON public.cash_sessions(register_id);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_business_id 
    ON public.cash_sessions(business_id);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_status 
    ON public.cash_sessions(business_id, status);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_opened_at 
    ON public.cash_sessions(business_id, opened_at DESC);

-- Restricción crítica: Solo puede existir 1 sesión abierta por caja a la vez (Partial Unique Index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_sessions_single_open_per_register 
    ON public.cash_sessions(register_id) 
    WHERE (status = 'open');

-- 3. Tabla de Movimientos de Caja (public.cash_movements)
CREATE TABLE IF NOT EXISTS public.cash_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('sale_cash', 'sale_card', 'sale_digital', 'expense', 'entry', 'withdrawal')),
    amount NUMERIC NOT NULL,
    reference_id UUID, -- order_id, sale_id, expense_id
    reference_type TEXT, -- 'order' | 'sale' | 'expense' | 'manual' | 'adjustment'
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices en public.cash_movements
CREATE INDEX IF NOT EXISTS idx_cash_movements_session_id 
    ON public.cash_movements(session_id);

CREATE INDEX IF NOT EXISTS idx_cash_movements_business_id 
    ON public.cash_movements(business_id);

CREATE INDEX IF NOT EXISTS idx_cash_movements_reference 
    ON public.cash_movements(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_cash_movements_created_at 
    ON public.cash_movements(business_id, created_at DESC);

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS para Service Role (Bypass completo para operaciones autorizadas del backend)
DROP POLICY IF EXISTS "service_role_all_cash_registers" ON public.cash_registers;
CREATE POLICY "service_role_all_cash_registers" ON public.cash_registers
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_cash_sessions" ON public.cash_sessions;
CREATE POLICY "service_role_all_cash_sessions" ON public.cash_sessions
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_cash_movements" ON public.cash_movements;
CREATE POLICY "service_role_all_cash_movements" ON public.cash_movements
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 6. Políticas RLS para Usuarios Autenticados (Aislamiento estricto por tenant business_id)

-- Cajas (public.cash_registers)
DROP POLICY IF EXISTS "tenant_cash_registers_read" ON public.cash_registers;
CREATE POLICY "tenant_cash_registers_read" ON public.cash_registers
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = cash_registers.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    );

DROP POLICY IF EXISTS "tenant_cash_registers_write" ON public.cash_registers;
CREATE POLICY "tenant_cash_registers_write" ON public.cash_registers
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = cash_registers.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = cash_registers.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    );

-- Sesiones de Caja (public.cash_sessions)
DROP POLICY IF EXISTS "tenant_cash_sessions_read" ON public.cash_sessions;
CREATE POLICY "tenant_cash_sessions_read" ON public.cash_sessions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = cash_sessions.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    );

DROP POLICY IF EXISTS "tenant_cash_sessions_write" ON public.cash_sessions;
CREATE POLICY "tenant_cash_sessions_write" ON public.cash_sessions
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = cash_sessions.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = cash_sessions.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    );

-- Movimientos de Caja (public.cash_movements)
DROP POLICY IF EXISTS "tenant_cash_movements_read" ON public.cash_movements;
CREATE POLICY "tenant_cash_movements_read" ON public.cash_movements
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = cash_movements.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    );

DROP POLICY IF EXISTS "tenant_cash_movements_write" ON public.cash_movements;
CREATE POLICY "tenant_cash_movements_write" ON public.cash_movements
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = cash_movements.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = cash_movements.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    );

-- 7. Trigger para creación automática de 'Caja Principal' en nuevos comercios
CREATE OR REPLACE FUNCTION public.handle_new_business_default_cash_register()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.cash_registers (
        id,
        business_id,
        name,
        location_id,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        NEW.id,
        'Caja Principal',
        (
            SELECT l.id FROM public.locations l 
            WHERE l.business_id = NEW.id 
            ORDER BY (l.type = 'point_of_sale') DESC, l.created_at ASC 
            LIMIT 1
        ),
        true,
        now(),
        now()
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_business_default_cash_register ON public.businesses;
CREATE TRIGGER trg_business_default_cash_register
    AFTER INSERT ON public.businesses
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_business_default_cash_register();

-- 8. Migración de Datos Existentes (Idempotente)
-- Crear 'Caja Principal' para todos los comercios existentes que no posean ninguna caja registrada
INSERT INTO public.cash_registers (
    id,
    business_id,
    name,
    location_id,
    is_active,
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid(),
    b.id,
    'Caja Principal',
    (
        SELECT l.id FROM public.locations l 
        WHERE l.business_id = b.id 
        ORDER BY (l.type = 'point_of_sale') DESC, l.created_at ASC 
        LIMIT 1
    ),
    true,
    now(),
    now()
FROM public.businesses b
WHERE NOT EXISTS (
    SELECT 1 FROM public.cash_registers cr WHERE cr.business_id = b.id
);
