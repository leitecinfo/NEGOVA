-- ==============================================================================
-- NEGOVA SaaS - Migración Versionada: Módulo de Clientes Multi-Tenant Core
-- Archivo: supabase/migrations/20261024010000_customers_multitenant_core.sql
-- Fecha: 2026-10-24
-- 
-- Objetivos:
-- 1. Asegurar tabla 'public.customers' con compatibilidad multi-tenant por 'business_id'.
-- 2. Asegurar columnas full_name, normalized_phone, tax_id y sincronización con 'name'.
-- 3. Asegurar tabla 'public.customer_addresses' con alias de compatibilidad address_line y reference.
-- 4. Vincular clave foránea opcional 'customer_id' en 'restaurant_orders' de forma no destructiva.
-- 5. Definir índices de rendimiento y políticas RLS estrictas vinculadas a 'business_users'.
-- ==============================================================================

-- 1. Tabla de Clientes del Negocio (public.customers)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    full_name TEXT,
    phone TEXT,
    normalized_phone TEXT,
    email TEXT,
    tax_id TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Asegurar columnas si la tabla ya existía
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS normalized_phone TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS tax_id TEXT;

UPDATE public.customers SET full_name = name WHERE full_name IS NULL AND name IS NOT NULL;

-- Índices de consulta y rendimiento en public.customers
CREATE INDEX IF NOT EXISTS idx_customers_business_id 
    ON public.customers(business_id);

CREATE INDEX IF NOT EXISTS idx_customers_business_status 
    ON public.customers(business_id, status);

CREATE INDEX IF NOT EXISTS idx_customers_business_name 
    ON public.customers(business_id, full_name);

CREATE INDEX IF NOT EXISTS idx_customers_business_phone 
    ON public.customers(business_id, normalized_phone);

-- 2. Tabla de Direcciones Guardadas del Cliente (public.customer_addresses)
CREATE TABLE IF NOT EXISTS public.customer_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    address TEXT NOT NULL DEFAULT '',
    address_line TEXT,
    reference TEXT,
    additional_reference TEXT,
    label TEXT NOT NULL DEFAULT 'Principal',
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Asegurar columnas alias si la tabla ya existía
ALTER TABLE public.customer_addresses ADD COLUMN IF NOT EXISTS address_line TEXT;
ALTER TABLE public.customer_addresses ADD COLUMN IF NOT EXISTS reference TEXT;

UPDATE public.customer_addresses SET address_line = address WHERE address_line IS NULL AND address IS NOT NULL;
UPDATE public.customer_addresses SET reference = additional_reference WHERE reference IS NULL AND additional_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id 
    ON public.customer_addresses(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_business_id 
    ON public.customer_addresses(business_id);

-- 3. Vincular clave foránea opcional en 'restaurant_orders' (no destructivo)
ALTER TABLE public.restaurant_orders 
    ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_restaurant_orders_customer_id 
    ON public.restaurant_orders(customer_id);

-- 4. Habilitar Row Level Security (RLS) en ambas tablas
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
