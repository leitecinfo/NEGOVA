-- ==============================================================================
-- NEGOVA MVP - Script 01: Extensiones y Tipos de Datos Enumerados
-- Motor: PostgreSQL 15+ / Supabase
-- ==============================================================================

-- 1. Habilitar extensión para generación de UUID v4 y funciones criptográficas
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Enumerados para el CORE
DO $$ BEGIN
    CREATE TYPE business_status_enum AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_status_enum AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE business_user_status_enum AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE expense_category_enum AS ENUM ('SUPPLIES', 'SERVICES', 'PAYROLL', 'MAINTENANCE', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Enumerados para el VERTICAL RESTAURANTE
DO $$ BEGIN
    CREATE TYPE category_status_enum AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_channel_enum AS ENUM ('WHATSAPP', 'DIGITAL', 'IN_PERSON');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status_enum AS ENUM ('RECEIVED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_type_enum AS ENUM ('PICKUP', 'DELIVERY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status_enum AS ENUM ('PENDING', 'PARCIALLY_PAID', 'PAID');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_concept_enum AS ENUM ('PRODUCTS', 'DELIVERY', 'TOTAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method_enum AS ENUM ('CASH', 'TRANSFER', 'CARD', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_record_status_enum AS ENUM ('PENDING', 'PAID', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE delivery_status_enum AS ENUM ('PENDING', 'IN_PROGRESS', 'DELIVERED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
