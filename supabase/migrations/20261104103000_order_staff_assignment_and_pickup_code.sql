-- ==============================================================================
-- NEGOVA SaaS — Migración: Asignación de Responsables y Gestión de Pedidos Para Recoger
-- Archivo: supabase/migrations/20261104100000_order_staff_assignment_and_pickup_code.sql
-- Fecha: 2026-11-04
--
-- Objetivos:
-- 1. Soporte para responsable del pedido (assigned_staff_id, assigned_staff_name, assigned_staff_role).
-- 2. Soporte para código de recogida seguro en pedidos "takeout" (pickup_code, pickup_attempts, pickup_confirmed_at, pickup_confirmed_by).
-- 3. Aislamiento multi-tenant estricto e índices de consulta operativa.
-- ==============================================================================

-- 1. Añadir columnas de responsable y código de recogida a restaurant_orders
ALTER TABLE public.restaurant_orders
    ADD COLUMN IF NOT EXISTS assigned_staff_id UUID DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS assigned_staff_name TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS assigned_staff_role TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS pickup_code VARCHAR(10) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS pickup_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS pickup_confirmed_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS pickup_confirmed_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.restaurant_orders.assigned_staff_id IS 'ID del empleado o usuario asignado como responsable del pedido';
COMMENT ON COLUMN public.restaurant_orders.assigned_staff_name IS 'Nombre snapshot del responsable asignado';
COMMENT ON COLUMN public.restaurant_orders.assigned_staff_role IS 'Cargo snapshot del responsable asignado';
COMMENT ON COLUMN public.restaurant_orders.pickup_code IS 'Código numérico de 4 dígitos generado por el servidor para confirmar recogida';
COMMENT ON COLUMN public.restaurant_orders.pickup_attempts IS 'Contador de intentos fallidos de validación de recogida (máx 5)';
COMMENT ON COLUMN public.restaurant_orders.pickup_confirmed_at IS 'Fecha y hora en que se confirmó físicamente la recogida en el local';
COMMENT ON COLUMN public.restaurant_orders.pickup_confirmed_by IS 'Usuario que validó y confirmó la recogida del pedido';

-- 2. Índices para optimizar consultas por responsable y pedidos para recoger
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_staff
    ON public.restaurant_orders (business_id, assigned_staff_id)
    WHERE assigned_staff_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_restaurant_orders_pickup
    ON public.restaurant_orders (business_id, order_type, status)
    WHERE order_type = 'takeout';
