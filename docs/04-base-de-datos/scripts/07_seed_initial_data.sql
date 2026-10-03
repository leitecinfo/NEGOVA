-- ==============================================================================
-- NEGOVA MVP - Script 07: Datos Iniciales de Semilla (Seed Data)
-- Motor: PostgreSQL 15+ / Supabase
-- ==============================================================================

-- 1. Insertar Roles del Sistema
INSERT INTO public.roles (id, name, description)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'PROPIETARIO', 'Control total administrativo, financiero y operativo del negocio'),
    ('22222222-2222-2222-2222-222222222222', 'PERSONAL', 'Acceso operativo a cola de pedidos, cocina, disponibilidad y registro de cobros')
ON CONFLICT (name) DO UPDATE 
SET description = EXCLUDED.description;

-- 2. Insertar Permisos Granulares
INSERT INTO public.permissions (name, description)
VALUES
    ('orders.view', 'Ver lista y detalle de pedidos'),
    ('orders.create', 'Crear pedidos manuales'),
    ('orders.update_status', 'Cambiar estado operativo del pedido'),
    ('products.view', 'Consultar catálogo de productos'),
    ('products.create', 'Crear nuevos productos'),
    ('products.update', 'Editar productos y precios'),
    ('products.toggle_availability', 'Conmutar disponibilidad rápida (Disponible/Agotado)'),
    ('customers.view', 'Consultar directorio de clientes'),
    ('finances.view', 'Ver métricas de ventas y balances'),
    ('expenses.view', 'Ver listado de gastos'),
    ('expenses.create', 'Registrar egresos operativos'),
    ('users.manage', 'Administrar usuarios y permisos'),
    ('business.manage', 'Editar configuración y tarifas del negocio')
ON CONFLICT (name) DO NOTHING;

-- 3. Asignar Todos los Permisos al Rol PROPIETARIO
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '11111111-1111-1111-1111-111111111111', id 
FROM public.permissions
ON CONFLICT DO NOTHING;

-- 4. Asignar Permisos Operativos al Rol PERSONAL
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '22222222-2222-2222-2222-222222222222', id 
FROM public.permissions
WHERE name IN (
    'orders.view',
    'orders.create',
    'orders.update_status',
    'products.view',
    'products.toggle_availability',
    'customers.view'
)
ON CONFLICT DO NOTHING;

-- 5. Insertar Negocio Piloto de Validación (Camarones, La Guajira)
INSERT INTO public.businesses (
    id,
    name,
    slug,
    description,
    logo_url,
    phone,
    address,
    status
) VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Restaurante El Piloto Camarones',
    'el-piloto-camarones',
    'Comidas rápidas tradicionales con el mejor sabor de La Guajira',
    'https://images.unsplash.com/photo-1550547660-d9450f859349?w=300',
    '3001234567',
    'Calle Principal # 4-20, Camarones, La Guajira',
    'ACTIVE'
) ON CONFLICT (slug) DO NOTHING;

-- 6. Insertar Categorías del Menú de Prueba
INSERT INTO public.categories (id, business_id, name, sort_order, status)
VALUES 
    ('cccccccc-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Hamburguesas', 1, 'ACTIVE'),
    ('cccccccc-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Salchipapas', 2, 'ACTIVE'),
    ('cccccccc-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Bebidas', 3, 'ACTIVE')
ON CONFLICT DO NOTHING;

-- 7. Insertar Productos de Prueba
INSERT INTO public.products (
    business_id,
    category_id,
    name,
    description,
    price,
    is_available,
    sort_order
) VALUES 
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-1111-1111-1111-111111111111', 'Hamburguesa Clásica', 'Carne artesanal 150g, queso, lechuga, tomate y salsas de la casa', 15000.00, true, 1),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-1111-1111-1111-111111111111', 'Hamburguesa Especial Doble', 'Doble carne artesanal, tocineta, doble queso y huevo frito', 22000.00, true, 2),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-2222-2222-2222-222222222222', 'Salchipapa Tradicional', 'Papa criolla o francesa, salchicha manguera, queso costeño rallado', 14000.00, true, 1),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-2222-2222-2222-222222222222', 'Salchipapa Salvaje', 'Papas, salchicha, pollo desmechado, carne asada, tocineta y ripio', 24000.00, true, 2),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-3333-3333-3333-333333333333', 'Gaseosa 400ml', 'Variedad de sabores bien fría', 4000.00, true, 1),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-3333-3333-3333-333333333333', 'Jugo Natural en Agua', 'Corozo, maracuyá o lulo', 5000.00, true, 2)
ON CONFLICT DO NOTHING;
