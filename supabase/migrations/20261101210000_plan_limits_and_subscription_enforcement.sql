-- ============================================================================
-- MIGRACIÓN: Tabla plan_limits y Reglas de Capacidad de Suscripción [SUB-001]
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.plan_limits (
  plan_code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  products_limit INTEGER NOT NULL DEFAULT 50, -- -1 = ilimitado
  employees_limit INTEGER NOT NULL DEFAULT 3,
  locations_limit INTEGER NOT NULL DEFAULT 1,
  registers_limit INTEGER NOT NULL DEFAULT 1,
  recipes_limit INTEGER NOT NULL DEFAULT 20,
  sales_limit_per_month INTEGER NOT NULL DEFAULT 300,
  customers_limit INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'plan_limits' AND policyname = 'plan_limits_select_all'
  ) THEN
    CREATE POLICY plan_limits_select_all ON public.plan_limits
      FOR SELECT
      TO public, authenticated
      USING (true);
  END IF;
END $$;

-- Semilla canónica de límites de planes
INSERT INTO public.plan_limits (
  plan_code,
  name,
  products_limit,
  employees_limit,
  locations_limit,
  registers_limit,
  recipes_limit,
  sales_limit_per_month,
  customers_limit
)
VALUES
  -- STARTER / INICIO
  ('starter', 'Starter', 50, 3, 1, 1, 20, 300, 100),
  ('inicio', 'Inicio', 50, 3, 1, 1, 20, 300, 100),
  -- PROFESSIONAL / CRECE
  ('professional', 'Profesional', 500, 15, 3, 5, 200, 3000, 1000),
  ('crece', 'Crece', 500, 15, 3, 5, 200, 3000, 1000),
  -- ENTERPRISE / NEGOCIO / PRO (Ilimitado)
  ('enterprise', 'Enterprise', -1, -1, -1, -1, -1, -1, -1),
  ('negocio', 'Negocio', -1, -1, -1, -1, -1, -1, -1),
  ('pro', 'Pro', -1, -1, -1, -1, -1, -1, -1)
ON CONFLICT (plan_code) DO UPDATE SET
  name = EXCLUDED.name,
  products_limit = EXCLUDED.products_limit,
  employees_limit = EXCLUDED.employees_limit,
  locations_limit = EXCLUDED.locations_limit,
  registers_limit = EXCLUDED.registers_limit,
  recipes_limit = EXCLUDED.recipes_limit,
  sales_limit_per_month = EXCLUDED.sales_limit_per_month,
  customers_limit = EXCLUDED.customers_limit,
  updated_at = timezone('utc'::text, now());
