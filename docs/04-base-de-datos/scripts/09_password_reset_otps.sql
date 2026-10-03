-- ==============================================================================
-- NEGOVA - Script 09: Tabla de Códigos OTP para Recuperación de Contraseña
-- Motor: PostgreSQL 15+ / Supabase
-- ==============================================================================

-- 1. Crear tabla para almacenar los códigos OTP
CREATE TABLE IF NOT EXISTS public.password_reset_otps (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    email text NOT NULL,
    code text NOT NULL,
    attempts integer DEFAULT 0,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;

-- 3. Definir políticas de seguridad (nadie puede leer/escribir directo por REST, solo Service Role)
-- Al no crear políticas públicas, por defecto toda petición REST de usuarios anónimos o autenticados será denegada.
-- Las Server Actions usarán el cliente administrativo de Supabase (Service Role) para interactuar de forma segura.

-- 4. Crear índice para búsquedas rápidas por correo y expiración
CREATE INDEX IF NOT EXISTS idx_reset_otps_email_expires 
ON public.password_reset_otps (email, expires_at);
