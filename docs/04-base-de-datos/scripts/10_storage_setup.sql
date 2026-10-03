-- ==============================================================================
-- NEGOVA SaaS - Script 10: Configuración de Supabase Storage & Buckets
-- Bucket: negova-storage (Público con carpetas estructuradas)
-- ==============================================================================

-- 1. Crear el bucket raíz público si no existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'negova-storage',
    'negova-storage',
    true,
    10485760, -- 10MB
    ARRAY[
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/webp',
        'image/gif',
        'image/svg+xml'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760;

-- 2. Políticas de Seguridad (RLS) para storage.objects
-- A. Lectura pública de cualquier archivo del bucket negova-storage
CREATE POLICY "Permitir lectura publica en negova-storage"
ON storage.objects FOR SELECT
USING (bucket_id = 'negova-storage');

-- B. Permitir subida y actualización a usuarios autenticados dentro de su carpeta de avatar
CREATE POLICY "Permitir a usuarios gestionar su propio avatar"
ON storage.objects FOR ALL
TO authenticated
USING (
    bucket_id = 'negova-storage' 
    AND (storage.foldername(name))[1] = 'avatars' 
    AND (storage.foldername(name))[2] = 'users' 
    AND (storage.foldername(name))[3] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'negova-storage' 
    AND (storage.foldername(name))[1] = 'avatars' 
    AND (storage.foldername(name))[2] = 'users' 
    AND (storage.foldername(name))[3] = auth.uid()::text
);

-- C. Permitir a administradores (service_role) control total de todas las carpetas
-- (Nota: service_role bypasa RLS automáticamente en Supabase)
