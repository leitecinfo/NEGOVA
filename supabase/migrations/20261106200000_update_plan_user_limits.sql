-- ============================================================================
-- MIGRACIÓN: Actualización de Límites Oficiales de Usuarios por Plan [SUB-003]
-- 
-- Nuevos límites comerciales acordados:
-- - Plan Inicio: 4 usuarios totales (1 propietario + 3 colaboradores adicionales)
-- - Plan Crece (Avanzado): 6 usuarios totales (1 propietario + 5 colaboradores adicionales)
-- - Plan Negocio: 10 usuarios totales (1 propietario + 9 colaboradores adicionales)
-- ============================================================================

-- 1. Actualizar tabla public.plans (campo JSONB limits)
UPDATE public.plans
SET 
  limits = jsonb_set(
    COALESCE(limits, '{}'::jsonb),
    '{maxUsers}',
    '4'::jsonb
  ),
  updated_at = timezone('utc'::text, now())
WHERE code IN ('PLAN-INICIO-V1', 'inicio', 'starter');

UPDATE public.plans
SET 
  limits = jsonb_set(
    COALESCE(limits, '{}'::jsonb),
    '{maxUsers}',
    '6'::jsonb
  ),
  updated_at = timezone('utc'::text, now())
WHERE code IN ('PLAN-CRECE-V1', 'crece', 'professional', 'avanzado');

UPDATE public.plans
SET 
  limits = jsonb_set(
    COALESCE(limits, '{}'::jsonb),
    '{maxUsers}',
    '10'::jsonb
  ),
  updated_at = timezone('utc'::text, now())
WHERE code IN ('PLAN-NEGOCIO-V1', 'negocio', 'enterprise', 'pro');

-- 2. Actualizar tabla public.plan_limits si la tabla existe en el entorno
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'plan_limits') THEN
    UPDATE public.plan_limits
    SET employees_limit = 4, products_limit = 200, updated_at = timezone('utc'::text, now())
    WHERE plan_code IN ('inicio', 'starter');

    UPDATE public.plan_limits
    SET employees_limit = 6, products_limit = 1000, updated_at = timezone('utc'::text, now())
    WHERE plan_code IN ('crece', 'professional', 'avanzado');

    UPDATE public.plan_limits
    SET employees_limit = 10, products_limit = 3000, updated_at = timezone('utc'::text, now())
    WHERE plan_code IN ('negocio', 'enterprise', 'pro');
  END IF;
END $$;

