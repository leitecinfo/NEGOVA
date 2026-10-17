-- ==============================================================================
-- NEGOVA SaaS - Migración: Menú Digital para Negocios
-- Tabla business_digital_menus con políticas RLS y soporte para
-- 3 modalidades: plantillas prediseñadas, personalizado y archivo propio (PDF/Imagen)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.business_digital_menus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    is_published BOOLEAN NOT NULL DEFAULT true,
    modality TEXT NOT NULL DEFAULT 'template', -- 'template' | 'custom' | 'file'
    template_id TEXT NOT NULL DEFAULT 'urbana', -- 'urbana' | 'elegante' | 'comercial' | 'visual'
    custom_settings JSONB NOT NULL DEFAULT '{
        "primaryColor": "#ED500A",
        "secondaryColor": "#10141d",
        "accentColor": "#F59E0B",
        "fontFamily": "sans",
        "fontSize": "md",
        "layoutStyle": "grid",
        "showDescriptions": true,
        "showPhotos": true,
        "showPrices": true,
        "showContactInfo": true,
        "showAddress": true
    }'::jsonb,
    file_url TEXT,
    file_storage_path TEXT,
    file_type TEXT, -- 'pdf' | 'image'
    file_name TEXT,
    file_size_bytes BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_business_digital_menus_business UNIQUE (business_id)
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.business_digital_menus ENABLE ROW LEVEL SECURITY;

-- 1. Acceso total para service_role
DROP POLICY IF EXISTS "service_role_all_digital_menus" ON public.business_digital_menus;
CREATE POLICY "service_role_all_digital_menus" ON public.business_digital_menus
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 2. Lectura pública (anónimos y autenticados) si el menú está publicado
DROP POLICY IF EXISTS "public_read_published_digital_menus" ON public.business_digital_menus;
CREATE POLICY "public_read_published_digital_menus" ON public.business_digital_menus
    FOR SELECT TO anon, authenticated
    USING (is_published = true);

-- 3. Lectura de administración para usuarios autorizados del negocio
DROP POLICY IF EXISTS "tenant_digital_menus_read" ON public.business_digital_menus;
CREATE POLICY "tenant_digital_menus_read" ON public.business_digital_menus
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = business_digital_menus.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    );

-- 4. Escritura / edición para usuarios autorizados del negocio
DROP POLICY IF EXISTS "tenant_digital_menus_write" ON public.business_digital_menus;
CREATE POLICY "tenant_digital_menus_write" ON public.business_digital_menus
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = business_digital_menus.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_users bu
            WHERE bu.business_id = business_digital_menus.business_id
              AND bu.user_id = auth.uid()
              AND bu.status = 'active'
        )
    );

-- Índices de consulta y rendimiento
CREATE INDEX IF NOT EXISTS idx_digital_menus_business ON public.business_digital_menus(business_id);
CREATE INDEX IF NOT EXISTS idx_digital_menus_published ON public.business_digital_menus(business_id, is_published);
