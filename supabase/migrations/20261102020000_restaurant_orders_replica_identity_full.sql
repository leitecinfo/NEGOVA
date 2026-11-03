-- ==============================================================================
-- NEGOVA SaaS - Replica Identity FULL para restaurant_orders
-- Garantiza que los eventos UPDATE de Supabase Realtime incluyan todas las columnas
-- necesarias (incluyendo business_id y status) para filtrado y notificaciones en vivo.
-- ==============================================================================

ALTER TABLE public.restaurant_orders REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'restaurant_orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_orders;
    END IF;
END $$;

