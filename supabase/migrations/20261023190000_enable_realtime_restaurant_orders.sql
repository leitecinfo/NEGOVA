-- ==============================================================================
-- NEGOVA SaaS - Habilitar Supabase Realtime para restaurant_orders
-- Permite que los clientes suscritos al Workspace reciban eventos INSERT de nuevos pedidos
-- ==============================================================================

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
