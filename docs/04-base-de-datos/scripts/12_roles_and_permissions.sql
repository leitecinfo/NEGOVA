-- ==============================================================================
-- NEGOVA SaaS - Script 12: Sistema Integral de Roles y Permisos (RBAC Multi-Tenant)
-- Ámbitos: Platform (Interno Core) y Business (Tenants / Comercios)
-- ==============================================================================

-- 1. Tipos ENUM para Ámbito y Tipo de Rol (si no existen)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_scope') THEN
        CREATE TYPE public.role_scope AS ENUM ('platform', 'business');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_type') THEN
        CREATE TYPE public.role_type AS ENUM ('system', 'custom');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_status') THEN
        CREATE TYPE public.role_status AS ENUM ('active', 'inactive');
    END IF;
END $$;

-- 2. Tabla: roles
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    scope public.role_scope NOT NULL DEFAULT 'business',
    type public.role_type NOT NULL DEFAULT 'system',
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    is_system_role BOOLEAN NOT NULL DEFAULT false,
    status public.role_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de roles
CREATE INDEX IF NOT EXISTS idx_roles_scope ON public.roles(scope);
CREATE INDEX IF NOT EXISTS idx_roles_code ON public.roles(code);
CREATE INDEX IF NOT EXISTS idx_roles_business_id ON public.roles(business_id);

-- 3. Tabla: permissions
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE, -- Formato: resource.action (ej: users.create, sales.view)
    name TEXT NOT NULL,
    description TEXT,
    module TEXT NOT NULL,
    scope public.role_scope NOT NULL DEFAULT 'platform',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de permisos
CREATE INDEX IF NOT EXISTS idx_permissions_code ON public.permissions(code);
CREATE INDEX IF NOT EXISTS idx_permissions_module ON public.permissions(module);
CREATE INDEX IF NOT EXISTS idx_permissions_scope ON public.permissions(scope);

-- 4. Tabla asociativa: role_permissions
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON public.role_permissions(permission_id);

-- 5. Trigger para updated_at en roles
CREATE OR REPLACE FUNCTION update_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_roles_updated_at ON public.roles;
CREATE TRIGGER tr_roles_updated_at
BEFORE UPDATE ON public.roles
FOR EACH ROW
EXECUTE FUNCTION update_roles_updated_at();

-- 6. Habilitar RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- 7. Políticas de Acceso RLS:
-- A. Roles: Lectura a todos los autenticados
DROP POLICY IF EXISTS "roles_read_policy" ON public.roles;
CREATE POLICY "roles_read_policy" ON public.roles
FOR SELECT TO authenticated USING (true);

-- B. Roles: Escritura permitida a super_admin de plataforma
DROP POLICY IF EXISTS "roles_write_super_admin" ON public.roles;
CREATE POLICY "roles_write_super_admin" ON public.roles
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.platform_role = 'super_admin'
    )
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.platform_role = 'super_admin'
    )
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
);

-- C. Permissions: Lectura a todos los autenticados
DROP POLICY IF EXISTS "permissions_read_policy" ON public.permissions;
CREATE POLICY "permissions_read_policy" ON public.permissions
FOR SELECT TO authenticated USING (true);

-- D. Role Permissions: Lectura a todos los autenticados
DROP POLICY IF EXISTS "role_permissions_read_policy" ON public.role_permissions;
CREATE POLICY "role_permissions_read_policy" ON public.role_permissions
FOR SELECT TO authenticated USING (true);

-- E. Role Permissions: Escritura permitida a super_admin
DROP POLICY IF EXISTS "role_permissions_write_super_admin" ON public.role_permissions;
CREATE POLICY "role_permissions_write_super_admin" ON public.role_permissions
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.platform_role = 'super_admin'
    )
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.platform_role = 'super_admin'
    )
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
);

-- ==============================================================================
-- 8. SEEDS: ROLES DEL SISTEMA (PLATFORM & BUSINESS)
-- ==============================================================================

-- A. ROLES DE PLATAFORMA (Internos Core)
INSERT INTO public.roles (code, name, description, scope, type, is_system_role, status)
VALUES
    ('super_admin', 'Super Administrador', 'Control total y absoluto sobre la infraestructura, comercios, finanzas, auditoría y políticas de NEGOVA.', 'platform', 'system', true, 'active'),
    ('staff', 'Personal Staff', 'Gestión operativa de comercios, soporte de primer nivel y asistencia a clientes de la plataforma.', 'platform', 'system', true, 'active'),
    ('support', 'Soporte al Cliente', 'Atención de incidencias, tickets de soporte y consulta técnica para asistencia a los comercios.', 'platform', 'system', true, 'active'),
    ('finance', 'Finanzas y Facturación', 'Gestión de cobros, conciliaciones, facturación y control de suscripciones de la plataforma.', 'platform', 'system', true, 'active'),
    ('technical_support', 'Soporte Técnico', 'Diagnóstico de incidencias, revisión de logs y soporte técnico avanzado a la plataforma.', 'platform', 'system', true, 'active'),
    ('auditor', 'Auditor de Cumplimiento', 'Acceso de solo lectura para inspección de registros forenses, eventos de seguridad y trazabilidad.', 'platform', 'system', true, 'active')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    scope = EXCLUDED.scope,
    type = EXCLUDED.type,
    is_system_role = EXCLUDED.is_system_role;

-- B. ROLES DE NEGOCIO (Tenants / Comercios)
INSERT INTO public.roles (code, name, description, scope, type, is_system_role, status)
VALUES
    ('owner', 'Propietario del Negocio', 'Máxima autoridad dentro del comercio. Gestiona plan, empleados, finanzas, productos y ventas.', 'business', 'system', true, 'active'),
    ('admin', 'Administrador de Comercio', 'Administración de la operación diaria, inventario, precios, compras y personal del negocio.', 'business', 'system', true, 'active'),
    ('supervisor', 'Supervisor de Turno / Caja', 'Supervisión operativa, arqueos de caja, anulaciones de venta y autorización de descuentos.', 'business', 'system', true, 'active'),
    ('seller', 'Vendedor / Asesor', 'Atención a clientes en sala de ventas, emisión de cotizaciones y pedidos.', 'business', 'system', true, 'active'),
    ('cashier', 'Cajero de POS', 'Punto de venta, cobro ágil de comandas, recepción de pagos en efectivo/tarjeta y emisión de tickets.', 'business', 'system', true, 'active')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    scope = EXCLUDED.scope,
    type = EXCLUDED.type,
    is_system_role = EXCLUDED.is_system_role;

-- ==============================================================================
-- 9. SEEDS: CATÁLOGO DE PERMISOS (RESOURCE.ACTION)
-- ==============================================================================

-- A. PERMISOS DE PLATAFORMA
INSERT INTO public.permissions (code, name, description, module, scope)
VALUES
    -- Módulo: Usuarios de Plataforma
    ('users.view', 'Ver Usuarios Internos', 'Consultar directorio y perfiles del personal administrativo de NEGOVA', 'usuarios', 'platform'),
    ('users.create', 'Crear / Invitar Usuarios', 'Emitir invitaciones y dar de alta personal interno', 'usuarios', 'platform'),
    ('users.update', 'Editar Usuarios Internos', 'Modificar datos de perfil y asignación de roles', 'usuarios', 'platform'),
    ('users.disable', 'Desactivar Usuarios', 'Suspender o inhabilitar temporalmente cuentas de personal', 'usuarios', 'platform'),
    ('users.delete', 'Eliminar Usuarios', 'Eliminar permanentemente cuentas de personal interno', 'usuarios', 'platform'),

    -- Módulo: Negocios (Tenants)
    ('businesses.view', 'Ver Negocios', 'Consultar directorio global y métricas de los comercios registrados', 'negocios', 'platform'),
    ('businesses.create', 'Crear Negocio', 'Dar de alta un nuevo comercio en la plataforma', 'negocios', 'platform'),
    ('businesses.update', 'Editar Negocio', 'Actualizar información legal, comercial y fiscal de comercios', 'negocios', 'platform'),
    ('businesses.suspend', 'Suspender Negocio', 'Inhabilitar el acceso operativo de un comercio por mora o sanción', 'negocios', 'platform'),
    ('businesses.delete', 'Eliminar Negocio', 'Archivar o dar de baja definitiva a un comercio', 'negocios', 'platform'),

    -- Módulo: Suscripciones
    ('subscriptions.view', 'Ver Suscripciones', 'Consultar estados de pago, ciclos activos y fechas de corte', 'suscripciones', 'platform'),
    ('subscriptions.create', 'Activar Suscripción', 'Generar suscripciones manuales o promocionales', 'suscripciones', 'platform'),
    ('subscriptions.update', 'Modificar Suscripción', 'Realizar upgrades o downgrades de planes de comercios', 'suscripciones', 'platform'),
    ('subscriptions.cancel', 'Cancelar Suscripción', 'Dar de baja la suscripción activa de un comercio', 'suscripciones', 'platform'),

    -- Módulo: Planes y Límites
    ('plans.view', 'Ver Catálogo de Planes', 'Consultar matriz de precios, tiers y cuotas operativas', 'planes', 'platform'),
    ('plans.create', 'Crear Plan', 'Definir nuevos paquetes comerciales en el catálogo', 'planes', 'platform'),
    ('plans.update', 'Editar Límites / Precios', 'Modificar cuotas de productos, usuarios y precios de planes', 'planes', 'platform'),
    ('plans.delete', 'Archivar Plan', 'Retirar planes del catálogo comercial público', 'planes', 'platform'),

    -- Módulo: Facturación de Plataforma
    ('billing.view', 'Ver Finanzas de Plataforma', 'Consultar balances de cobros y facturación de la plataforma', 'facturacion', 'platform'),
    ('billing.manage', 'Gestionar Pasarelas y Cobros', 'Administrar pasarelas de pago, registros manuales y cobros', 'facturacion', 'platform'),

    -- Módulo: Soporte
    ('support.view', 'Ver Tickets de Soporte', 'Consultar solicitudes y reportes de problemas de los comercios', 'soporte', 'platform'),
    ('support.manage', 'Atender y Resolver Tickets', 'Interactuar, responder y cambiar estado de solicitudes de ayuda', 'soporte', 'platform'),

    -- Módulo: Auditoría
    ('audit.view', 'Ver Logs de Auditoría', 'Inspeccionar registros cronológicos de eventos y seguridad', 'auditoria', 'platform'),
    ('audit.export', 'Exportar Auditoría', 'Descargar registros de trazabilidad en formatos estructurados', 'auditoria', 'platform'),

    -- Módulo: Configuración de Plataforma
    ('platform_settings.view', 'Ver Configuración Global', 'Consultar políticas de seguridad, retención y parámetros Core', 'configuracion', 'platform'),
    ('platform_settings.update', 'Modificar Configuración Global', 'Actualizar políticas institucionales y de sesión de la plataforma', 'configuracion', 'platform'),

    -- Módulo: Roles y Permisos de Plataforma
    ('roles.view', 'Ver Roles y Permisos', 'Consultar matriz de roles y capacidades de acceso', 'roles', 'platform'),
    ('roles.manage', 'Administrar Roles y Permisos', 'Modificar matriz de permisos y crear roles personalizados', 'roles', 'platform')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    module = EXCLUDED.module,
    scope = EXCLUDED.scope;

-- B. PERMISOS DE NEGOCIO (Comercios)
INSERT INTO public.permissions (code, name, description, module, scope)
VALUES
    -- Módulo: Ventas & POS
    ('sales.view', 'Ver Ventas y Facturas', 'Consultar historial de ventas y recibos emitidos en el negocio', 'ventas', 'business'),
    ('sales.create', 'Emitir Venta / Cobro POS', 'Registrar nuevas ventas en punto de venta y generar comprobantes', 'ventas', 'business'),
    ('sales.update', 'Modificar Venta', 'Editar órdenes de venta abiertas antes de facturar', 'ventas', 'business'),
    ('sales.cancel', 'Anular Venta / Devolución', 'Cancelar ventas ya facturadas o procesar notas de crédito', 'ventas', 'business'),

    -- Módulo: Pedidos y Comandas
    ('orders.view', 'Ver Pedidos', 'Visualizar estado de comandas y órdenes activas en cocina/despacho', 'pedidos', 'business'),
    ('orders.create', 'Crear Pedido', 'Tomar comandas y crear órdenes de mesas o domicilios', 'pedidos', 'business'),
    ('orders.update', 'Actualizar Pedido', 'Cambiar estado de preparación o despacho de pedidos', 'pedidos', 'business'),
    ('orders.cancel', 'Cancelar Pedido', 'Anular comanda antes de su preparación', 'pedidos', 'business'),
    ('orders.manage', 'Gestión Avanzada de Comandas', 'Reasignar mesas, dividir cuentas y gestionar turnos', 'pedidos', 'business'),

    -- Módulo: Productos y Menú
    ('products.view', 'Ver Catálogo de Productos', 'Consultar productos, categorías, precios y variantes', 'productos', 'business'),
    ('products.create', 'Crear Producto', 'Dar de alta nuevos artículos en el catálogo del negocio', 'productos', 'business'),
    ('products.update', 'Editar Producto', 'Modificar precios, descripciones, recetas y estados de productos', 'productos', 'business'),
    ('products.delete', 'Eliminar Producto', 'Retirar productos y categorías del inventario', 'productos', 'business'),

    -- Módulo: Clientes y Fiados
    ('customers.view', 'Ver Clientes', 'Consultar directorio de clientes y estado de carteras de crédito', 'clientes', 'business'),
    ('customers.create', 'Registrar Cliente', 'Dar de alta nuevos clientes y datos de contacto', 'clientes', 'business'),
    ('customers.update', 'Editar Cliente', 'Actualizar información y límites de crédito', 'clientes', 'business'),
    ('customers.delete', 'Eliminar Cliente', 'Eliminar registros de clientes inactivos', 'clientes', 'business'),

    -- Módulo: Inventario y Stock
    ('inventory.view', 'Ver Inventario', 'Consultar existencias y niveles de stock de materias primas', 'inventario', 'business'),
    ('inventory.create', 'Registrar Entrada de Stock', 'Ingresar compras de proveedores y materias primas', 'inventario', 'business'),
    ('inventory.update', 'Editar Existencias', 'Modificar costos y umbrales mínimos de stock', 'inventario', 'business'),
    ('inventory.adjust', 'Ajustar Inventario / Mermas', 'Realizar arqueos de inventario físico y registrar bajas', 'inventario', 'business'),

    -- Módulo: Gastos Operativos
    ('expenses.view', 'Ver Gastos', 'Consultar egresos y pagos operativos del negocio', 'gastos', 'business'),
    ('expenses.create', 'Registrar Gasto', 'Crear comprobantes de egreso y compras menores', 'gastos', 'business'),
    ('expenses.update', 'Editar Gasto', 'Modificar categorías e importes de egresos', 'gastos', 'business'),
    ('expenses.delete', 'Eliminar Gasto', 'Anular registros de egresos no autorizados', 'gastos', 'business'),

    -- Módulo: Empleados del Negocio
    ('business_users.view', 'Ver Empleados', 'Consultar colaboradores y roles asignados en el comercio', 'empleados', 'business'),
    ('business_users.create', 'Invitar Empleado', 'Incorporar cajeros, meseros y supervisores al negocio', 'empleados', 'business'),
    ('business_users.update', 'Editar Empleado', 'Cambiar roles y horarios de trabajo de empleados', 'empleados', 'business'),
    ('business_users.disable', 'Desactivar Empleado', 'Suspender el acceso de un empleado al comercio', 'empleados', 'business'),

    -- Módulo: Configuración del Negocio
    ('business_settings.view', 'Ver Configuración de Negocio', 'Consultar datos de sucursales, impresoras y reglas', 'configuracion_negocio', 'business'),
    ('business_settings.update', 'Modificar Configuración de Negocio', 'Actualizar datos fiscales, logo y métodos de cobro del comercio', 'configuracion_negocio', 'business'),
-- 9. ASIGNACIÓN DE PERMISOS PREDETERMINADOS (ROLE_PERMISSIONS)
-- ==============================================================================

-- A. Asignar TODOS los permisos de plataforma a 'super_admin'
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'super_admin' AND p.scope = 'platform'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- B. Asignar permisos delegados a 'admin' (Plataforma - 14 Permisos)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'admin' AND p.code IN (
    'users.view', 'users.create', 'users.update',
    'businesses.view', 'businesses.create', 'businesses.update',
    'subscriptions.view',
    'plans.view',
    'billing.view',
    'support.view', 'support.manage',
    'audit.view',
    'roles.view',
    'platform_settings.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- C. Asignar TODOS los permisos de negocio a 'owner'
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'owner' AND p.scope = 'business'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- D. Asignar permisos a 'business_admin' de negocio
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'business_admin' AND p.code IN (
    'sales.view', 'sales.create', 'sales.update', 'sales.cancel',
    'orders.view', 'orders.create', 'orders.update', 'orders.cancel', 'orders.manage',
    'products.view', 'products.create', 'products.update',
    'customers.view', 'customers.create', 'customers.update',
    'inventory.view', 'inventory.create', 'inventory.update', 'inventory.adjust',
    'expenses.view', 'expenses.create', 'expenses.update',
    'business_users.view', 'business_users.create', 'business_users.update',
    'business_settings.view',
    'reports.view', 'reports.export'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- E. Asignar permisos a 'supervisor' de negocio
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'supervisor' AND p.code IN (
    'sales.view', 'sales.create', 'sales.update', 'sales.cancel',
    'orders.view', 'orders.create', 'orders.update', 'orders.cancel', 'orders.manage',
    'products.view',
    'customers.view', 'customers.create', 'customers.update',
    'inventory.view', 'inventory.create', 'inventory.adjust',
    'expenses.view', 'expenses.create',
    'business_users.view',
    'reports.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- F. Asignar permisos a 'seller' (Vendedor)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'seller' AND p.code IN (
    'sales.view', 'sales.create',
    'orders.view', 'orders.create', 'orders.update',
    'products.view',
    'customers.view', 'customers.create', 'customers.update'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- G. Asignar permisos a 'cashier' (Cajero POS)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'cashier' AND p.code IN (
    'sales.view', 'sales.create',
    'orders.view', 'orders.create',
    'products.view',
    'customers.view', 'customers.create'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;
