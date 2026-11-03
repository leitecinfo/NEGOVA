-- ==============================================================================
-- NEGOVA SaaS - Migración: Recetas y Fichas Técnicas de Productos [REC-002]
-- Tablas:
--   - public.recipes
--   - public.recipe_ingredients
-- ==============================================================================

-- 1. TABLA DE RECETAS (recipes)
CREATE TABLE IF NOT EXISTS public.recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    portions INTEGER NOT NULL DEFAULT 1 CHECK (portions > 0),
    prep_time_minutes INTEGER CHECK (prep_time_minutes >= 0),
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un producto puede tener máximo 1 receta activa por negocio
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_recipe_per_product 
ON public.recipes(business_id, product_id) 
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_recipes_business_product ON public.recipes(business_id, product_id);
CREATE INDEX IF NOT EXISTS idx_recipes_status ON public.recipes(business_id, status);

-- RLS para recipes
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recipes_tenant_isolation" ON public.recipes;
CREATE POLICY "recipes_tenant_isolation"
ON public.recipes
FOR ALL
USING (
    business_id IN (
        SELECT bu.business_id 
        FROM public.business_users bu 
        WHERE bu.user_id = auth.uid() AND bu.status = 'active'
    )
)
WITH CHECK (
    business_id IN (
        SELECT bu.business_id 
        FROM public.business_users bu 
        WHERE bu.user_id = auth.uid() AND bu.status = 'active'
    )
);

DROP POLICY IF EXISTS "service_role_all_recipes" ON public.recipes;
CREATE POLICY "service_role_all_recipes"
ON public.recipes
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 2. TABLA DE INGREDIENTES DE RECETA (recipe_ingredients)
CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity NUMERIC(15,4) NOT NULL CHECK (quantity > 0),
    unit TEXT NOT NULL,
    is_optional BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON public.recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient ON public.recipe_ingredients(ingredient_id);

-- RLS para recipe_ingredients
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recipe_ingredients_tenant_isolation" ON public.recipe_ingredients;
CREATE POLICY "recipe_ingredients_tenant_isolation"
ON public.recipe_ingredients
FOR ALL
USING (
    recipe_id IN (
        SELECT r.id 
        FROM public.recipes r
        JOIN public.business_users bu ON bu.business_id = r.business_id
        WHERE bu.user_id = auth.uid() AND bu.status = 'active'
    )
)
WITH CHECK (
    recipe_id IN (
        SELECT r.id 
        FROM public.recipes r
        JOIN public.business_users bu ON bu.business_id = r.business_id
        WHERE bu.user_id = auth.uid() AND bu.status = 'active'
    )
);

DROP POLICY IF EXISTS "service_role_all_recipe_ingredients" ON public.recipe_ingredients;
CREATE POLICY "service_role_all_recipe_ingredients"
ON public.recipe_ingredients
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

