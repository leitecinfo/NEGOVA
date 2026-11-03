-- ==============================================================================
-- NEGOVA SaaS - Migración Versionada: Módulo de Inventario Normalizado por Ubicación
-- Archivo: supabase/migrations/20261029180000_inventory_locations_and_stock_schema.sql
-- Tarea: [INV-001]
-- Fecha: 2026-10-29
-- 
-- Objetivos:
-- 1. Crear tabla 'public.locations' (ubicaciones de inventario por negocio).
-- 2. Crear tabla 'public.inventory_stock' (existencias por producto y ubicación).
-- 3. Crear tabla 'public.inventory_movements' (kardex de movimientos de inventario).
-- 4. Definir restricciones, índices de rendimiento y claves foráneas en cascada.
-- 5. Habilitar Row Level Security (RLS) con aislamiento estricto por 'business_id'.
-- 6. Trigger automático para asegurar que cada nuevo negocio tenga al menos una ubicación 'point_of_sale'.
-- 7. Migración de datos:
--    a. Crear ubicación 'point_of_sale' por defecto para todos los negocios existentes sin ubicación.
--    b. Migrar el stock de productos con 'metadata.track_stock = true' hacia 'inventory_stock'
--       respetando backward compatibility (sin eliminar metadata).
-- ==============================================================================

-- 1. Tabla de Ubicaciones (public.locations)
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('point_of_sale', 'warehouse', 'branch')),
    address TEXT,
    is_visible_in_menu BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices en public.locations
CREATE INDEX IF NOT EXISTS idx_locations_business_id 
    ON public.locations(business_id);

CREATE INDEX IF NOT EXISTS idx_locations_business_active 
    ON public.locations(business_id, is_active);

-- 2. Tabla de Stock por Ubicación (public.inventory_stock)
CREATE TABLE IF NOT EXISTS public.inventory_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    quantity NUMERIC NOT NULL DEFAULT 0,
    min_stock NUMERIC NOT NULL DEFAULT 0,
    cost NUMERIC NOT NULL DEFAULT 0, -- costo promedio
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT inventory_stock_product_location_key UNIQUE(product_id, location_id)
);

-- Índices en public.inventory_stock
CREATE INDEX IF NOT EXISTS idx_inventory_stock_business_id 
    ON public.inventory_stock(business_id);

CREATE INDEX IF NOT EXISTS idx_inventory_stock_product_id 
    ON public.inventory_stock(product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_stock_location_id 
    ON public.inventory_stock(location_id);

-- 3. Tabla de Movimientos de Inventario (public.inventory_movements)
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('entry', 'exit', 'adjustment', 'transfer_in', 'transfer_out', 'sale', 'spoilage')),
    quantity NUMERIC NOT NULL,
    unit_cost NUMERIC,
    total_cost NUMERIC,
    reference_id UUID, -- orden, compra, etc.
    reference_type TEXT CHECK (reference_type IS NULL OR reference_type IN ('sale', 'purchase', 'adjustment', 'transfer')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices en public.inventory_movements
CREATE INDEX IF NOT EXISTS idx_inventory_movements_business_id 
    ON public.inventory_movements(business_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id 
    ON public.inventory_movements(product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_location_id 
    ON public.inventory_movements(location_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at 
    ON public.inventory_movements(business_id, created_at DESC);

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS para Service Role (Bypass completo para operaciones autorizadas del backend)
DROP POLICY IF EXISTS "service_role_all_locations" ON public.locations;
CREATE POLICY "service_role_all_locations" ON public.locations
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_inventory_stock" ON public.inventory_stock;
CREATE POLICY "service_role_all_inventory_stock" ON public.inventory_stock
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_inventory_movements" ON public.inventory_movements;
CREATE POLICY "service_role_all_inventory_movements" ON public.inventory_movements
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 6. Políticas RLS para Usuarios Autenticados (Aislamiento estricto por tenant business_id)

-- Ubicaciones (public.locations)
DROP POLICY IF EXISTS "tenant_locations_read" ON public.locations;
CREATE POLICY "tenant_locations_read" ON public.locations
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = locations.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    );

DROP POLICY IF EXISTS "tenant_locations_write" ON public.locations;
CREATE POLICY "tenant_locations_write" ON public.locations
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = locations.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = locations.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    );

-- Stock (public.inventory_stock)
DROP POLICY IF EXISTS "tenant_inventory_stock_read" ON public.inventory_stock;
CREATE POLICY "tenant_inventory_stock_read" ON public.inventory_stock
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = inventory_stock.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    );

DROP POLICY IF EXISTS "tenant_inventory_stock_write" ON public.inventory_stock;
CREATE POLICY "tenant_inventory_stock_write" ON public.inventory_stock
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = inventory_stock.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = inventory_stock.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    );

-- Movimientos de Inventario (public.inventory_movements)
DROP POLICY IF EXISTS "tenant_inventory_movements_read" ON public.inventory_movements;
CREATE POLICY "tenant_inventory_movements_read" ON public.inventory_movements
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = inventory_movements.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    );

DROP POLICY IF EXISTS "tenant_inventory_movements_write" ON public.inventory_movements;
CREATE POLICY "tenant_inventory_movements_write" ON public.inventory_movements
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = inventory_movements.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = inventory_movements.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    );

-- 7. Trigger para creación automática de ubicación 'point_of_sale' en nuevos comercios
CREATE OR REPLACE FUNCTION public.handle_new_business_default_location()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.locations (
        id,
        business_id,
        name,
        type,
        address,
        is_visible_in_menu,
        is_active,
        created_at
    ) VALUES (
        gen_random_uuid(),
        NEW.id,
        'Punto Principal',
        'point_of_sale',
        NEW.address,
        true,
        true,
        now()
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_business_default_location ON public.businesses;
CREATE TRIGGER trg_business_default_location
    AFTER INSERT ON public.businesses
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_business_default_location();

-- 8. Migración de Datos Existentes (Idempotente)
-- 8.1. Crear ubicación tipo 'point_of_sale' para cada negocio que no tenga ubicación registrada
INSERT INTO public.locations (
    id,
    business_id,
    name,
    type,
    address,
    is_visible_in_menu,
    is_active,
    created_at
)
SELECT 
    gen_random_uuid(),
    b.id,
    'Punto Principal',
    'point_of_sale',
    b.address,
    true,
    true,
    now()
FROM public.businesses b
WHERE NOT EXISTS (
    SELECT 1 FROM public.locations l WHERE l.business_id = b.id
);

-- 8.2. Migrar stock inicial de productos con track_stock = true hacia inventory_stock
-- Los datos en metadata permanecen intactos para compatibilidad retroactiva.
WITH default_locations AS (
    SELECT DISTINCT ON (business_id) id AS location_id, business_id
    FROM public.locations
    ORDER BY business_id, (type = 'point_of_sale') DESC, created_at ASC
)
INSERT INTO public.inventory_stock (
    id,
    business_id,
    product_id,
    location_id,
    quantity,
    min_stock,
    cost,
    updated_at
)
SELECT
    gen_random_uuid(),
    p.business_id,
    p.id,
    dl.location_id,
    COALESCE(
        CASE 
            WHEN (p.metadata->>'stock_quantity') IS NOT NULL 
                 AND (p.metadata->>'stock_quantity') ~ '^-?[0-9]+(\.[0-9]+)?$' 
            THEN (p.metadata->>'stock_quantity')::numeric 
            ELSE 0 
        END, 
        0
    ),
    COALESCE(
        CASE 
            WHEN (p.metadata->>'min_stock') IS NOT NULL 
                 AND (p.metadata->>'min_stock') ~ '^-?[0-9]+(\.[0-9]+)?$' 
            THEN (p.metadata->>'min_stock')::numeric 
            ELSE 0 
        END, 
        0
    ),
    0,
    now()
FROM public.products p
JOIN default_locations dl ON dl.business_id = p.business_id
WHERE (
    (p.metadata->>'track_stock') = 'true'
    OR (p.metadata->'track_stock') = 'true'::jsonb
)
ON CONFLICT (product_id, location_id) DO NOTHING;

