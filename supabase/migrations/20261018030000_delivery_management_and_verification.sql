-- ==============================================================================
-- NEGOVA SaaS - Migración: Gestión Segura de Domicilios y Código de Entrega
-- Archivo: 20261018030000_delivery_management_and_verification.sql
-- 
-- IMPORTANTE:
-- Esta migración está preparada para su despliegue futuro de forma controlada.
-- No aplicar a producción sin autorización explícita.
-- El código de la aplicación ya cuenta con compatibilidad retroactiva mediante
-- almacenamiento seguro de códigos en el campo notes [PIN:XXXX:N].
-- ==============================================================================

-- 1. Añadir columnas dedicadas para verificación de entregas en restaurant_orders
ALTER TABLE public.restaurant_orders
    ADD COLUMN IF NOT EXISTS delivery_verification_code VARCHAR(10) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS delivery_verification_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.restaurant_orders.delivery_verification_code IS 'Código aleatorio único de 4-6 dígitos para confirmar entrega con el cliente';
COMMENT ON COLUMN public.restaurant_orders.delivery_verification_attempts IS 'Contador de intentos fallidos de validación de entrega (máx 5)';
COMMENT ON COLUMN public.restaurant_orders.delivered_at IS 'Fecha y hora exacta en la que se confirmó la entrega física';

-- 2. Índice compuesto para optimizar la consulta del tablero de despachos y repartidores
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_delivery_tracking
    ON public.restaurant_orders (business_id, order_type, delivery_status, created_at DESC)
    WHERE order_type = 'delivery';

-- 3. Índice para búsqueda de pedidos asignados por repartidor
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_delivery_driver
    ON public.restaurant_orders (business_id, driver_name)
    WHERE order_type = 'delivery';
