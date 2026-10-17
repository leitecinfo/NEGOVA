-- ==============================================================================
-- NEGOVA — ROL CANÓNICO DE NEGOCIO: AUXILIAR / AYUDANTE
-- 
-- Garantiza la inserción del rol 'auxiliar' en public.roles para miembros
-- operativos del equipo en comercios/tenants.
-- ==============================================================================

INSERT INTO public.roles (code, name, description, scope, is_system_role)
VALUES (
  'auxiliar',
  'Auxiliar / Ayudante',
  'Rol operativo general para atención en punto de venta, cobros, pedidos, comandas, productos, clientes y registro de gastos diarios.',
  'business',
  true
)
ON CONFLICT (code) DO NOTHING;
