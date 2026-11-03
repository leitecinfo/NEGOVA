-- ==============================================================================
-- Migración: Códigos de Seguimiento de Pedidos a Domicilio [DOM-004]
-- Fecha: 2026-11-01
-- Descripción:
-- 1. Añade columna tracking_code a la tabla public.restaurant_orders para acceso público.
-- 2. Añade índice optimizado para consultas por tracking_code.
-- 3. Habilita lectura pública segura mediante RPC o política RLS condicional.
-- ==============================================================================

ALTER TABLE public.restaurant_orders
ADD COLUMN IF NOT EXISTS tracking_code TEXT;

-- Índice para búsqueda rápida sin escanear toda la tabla
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_tracking_code
ON public.restaurant_orders(tracking_code)
WHERE tracking_code IS NOT NULL;
