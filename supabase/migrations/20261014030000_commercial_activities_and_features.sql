-- Migration: 20261014030000_commercial_activities_and_features.sql
-- Description: Implementa soporte formal para actividades comerciales (sell_products, provide_services, manage_appointments)
--              y flexibiliza el tipo de negocio en la tabla businesses para admitir verticales específicas.

-- 1. Convertir business_type a TEXT para admitir tipos específicos (fast_food, barbershop, retail, etc.) sin restricciones rígidas de enum
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'businesses' AND column_name = 'business_type' AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE public.businesses ALTER COLUMN business_type TYPE text USING business_type::text;
    ALTER TABLE public.businesses ALTER COLUMN business_type SET DEFAULT 'fast_food';
  END IF;
END $$;

-- 2. Añadir columna commercial_activities si no existe
ALTER TABLE public.businesses 
  ADD COLUMN IF NOT EXISTS commercial_activities text[] NOT NULL DEFAULT ARRAY['sell_products']::text[];

-- 3. Añadir columna settings si no existe
ALTER TABLE public.businesses 
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 4. Asegurar que las filas existentes tengan al menos la actividad por defecto
UPDATE public.businesses
SET commercial_activities = ARRAY['sell_products']::text[]
WHERE commercial_activities IS NULL OR array_length(commercial_activities, 1) IS NULL;

-- 5. Comentario explicativo en la tabla businesses
COMMENT ON COLUMN public.businesses.commercial_activities IS 'Actividades comerciales activas: sell_products, provide_services, manage_appointments';
COMMENT ON COLUMN public.businesses.settings IS 'Configuración y preferencias JSONB del tenant (gastronomía, overrides de módulos, etc.)';
