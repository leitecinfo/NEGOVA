/**
 * NEGOVA Authorization & Access Control Engine (RBAC Multi-Tenant)
 * 
 * Separación estricta de dos universos de roles:
 * 1. PLATFORM ROLES (Panel Interno NEGOVA Core): super_admin, staff, support, finance, technical_support, auditor
 * 2. BUSINESS ROLES (Workspace de Negocio/Tenant): owner, admin, supervisor, seller, cashier
 */

// =====================================================================
// 1. ÁMBITOS Y TIPOS GENERALES
// =====================================================================

export type RoleScope = "platform" | "business";
export type RoleType = "system" | "custom";
export type RoleStatus = "active" | "inactive";

export type PlatformRoleCode = "super_admin" | "admin";

export type BusinessRoleCode =
  | "owner"
  | "auxiliar"
  | "business_admin"
  | "supervisor"
  | "seller"
  | "cashier";

export type RoleCode = PlatformRoleCode | BusinessRoleCode | string;

export interface RoleModel {
  id: string;
  code: RoleCode;
  name: string;
  description: string;
  scope: RoleScope;
  type: RoleType;
  businessId?: string | null;
  isSystemRole: boolean;
  status: RoleStatus;
  userCount?: number;
  permissionCount?: number;
  permissions?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// =====================================================================
// 2. CATÁLOGO DE ROLES INTERNOS DE PLATAFORMA
// =====================================================================

export interface RoleDefinitionMeta {
  code: string;
  name: string;
  description: string;
  scope: RoleScope;
  type: RoleType;
  badgeColor: string;
  isSystemImmutable: boolean;
}

export const PLATFORM_ROLES_CATALOG: RoleDefinitionMeta[] = [
  {
    code: "super_admin",
    name: "Super Administrador",
    description: "Dueño y administrador principal de NEGOVA. Control total y absoluto sobre la infraestructura, comercios, finanzas, auditoría y políticas.",
    scope: "platform",
    type: "system",
    badgeColor: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",
    isSystemImmutable: true,
  },
  {
    code: "admin",
    name: "Administrador",
    description: "Administrador interno de NEGOVA con permisos administrativos delegados para gestión operativa, soporte y comercios.",
    scope: "platform",
    type: "system",
    badgeColor: "bg-[#ED500A]/10 text-[#ED500A] border-[#ED500A]/20 dark:text-orange-400",
    isSystemImmutable: true,
  },
];

// =====================================================================
// 3. CATÁLOGO DE ROLES DE NEGOCIO / TENANT (CANÓNICO MVP)
// =====================================================================

export const BUSINESS_ROLES_CATALOG: RoleDefinitionMeta[] = [
  {
    code: "owner",
    name: "Dueño / Propietario",
    description: "Máxima autoridad dentro del negocio. Posee todos los permisos de administración, finanzas, productos, ventas y gestión total del comercio.",
    scope: "business",
    type: "system",
    badgeColor: "bg-[#ED500A]/10 text-[#ED500A] border-[#ED500A]/20",
    isSystemImmutable: true,
  },
  {
    code: "auxiliar",
    name: "Auxiliar / Ayudante",
    description: "Rol operativo general para atención en punto de venta, cobros, pedidos, comandas, productos, clientes y registro de gastos diarios.",
    scope: "business",
    type: "system",
    badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
    isSystemImmutable: true,
  },
];

// =====================================================================
// 4. ESQUEMA DE PERMISOS MODULARES (RESOURCE.ACTION)
// =====================================================================

export interface PermissionDefinition {
  code: string;
  name: string;
  description: string;
}

export interface PermissionModuleGroup {
  moduleId: string;
  moduleName: string;
  description: string;
  scope: RoleScope;
  permissions: PermissionDefinition[];
}

export const ALL_PERMISSION_MODULES: PermissionModuleGroup[] = [
  // --- ÁMBITO PLATAFORMA ---
  {
    moduleId: "usuarios",
    moduleName: "Usuarios de Plataforma",
    description: "Cuentas internas del panel de control y perfiles administrativos",
    scope: "platform",
    permissions: [
      { code: "users.view", name: "Ver Usuarios Internos", description: "Consultar directorio y perfiles del personal administrativo de NEGOVA" },
      { code: "users.create", name: "Crear / Invitar Usuarios", description: "Emitir invitaciones y dar de alta personal interno" },
      { code: "users.update", name: "Editar Usuarios Internos", description: "Modificar datos de perfil y asignación de roles" },
      { code: "users.disable", name: "Desactivar Usuarios", description: "Suspender o inhabilitar temporalmente cuentas de personal" },
      { code: "users.delete", name: "Eliminar Usuarios", description: "Eliminar permanentemente cuentas de personal interno" },
    ],
  },
  {
    moduleId: "negocios",
    moduleName: "Negocios (Tenants)",
    description: "Directorio global de empresas y comercios registrados",
    scope: "platform",
    permissions: [
      { code: "businesses.view", name: "Ver Negocios", description: "Consultar directorio global y métricas de comercios registrados" },
      { code: "businesses.create", name: "Crear Negocio", description: "Dar de alta un nuevo comercio en la plataforma" },
      { code: "businesses.update", name: "Editar Negocio", description: "Actualizar información legal, comercial y fiscal de comercios" },
      { code: "businesses.suspend", name: "Suspender Negocio", description: "Inhabilitar el acceso operativo de un comercio por mora o sanción" },
      { code: "businesses.delete", name: "Eliminar Negocio", description: "Archivar o dar de baja definitiva a un comercio" },
    ],
  },
  {
    moduleId: "suscripciones",
    moduleName: "Suscripciones de Comercios",
    description: "Ciclos de facturación y planes activos de cada negocio",
    scope: "platform",
    permissions: [
      { code: "subscriptions.view", name: "Ver Suscripciones", description: "Consultar estados de pago, ciclos activos y fechas de corte" },
      { code: "subscriptions.create", name: "Activar Suscripción", description: "Generar suscripciones manuales o promocionales" },
      { code: "subscriptions.update", name: "Modificar Suscripción", description: "Realizar upgrades o downgrades de planes de comercios" },
      { code: "subscriptions.cancel", name: "Cancelar Suscripción", description: "Dar de baja la suscripción activa de un comercio" },
    ],
  },
  {
    moduleId: "planes",
    moduleName: "Catálogo Canónico de Planes",
    description: "Catálogo comercial y matriz de cuotas operativas de NEGOVA",
    scope: "platform",
    permissions: [
      { code: "plans.view", name: "Ver Catálogo de Planes", description: "Consultar catálogo oficial de planes y cuotas operativas" },
    ],
  },
  {
    moduleId: "facturacion",
    moduleName: "Facturación de Plataforma",
    description: "Finanzas de NEGOVA, pasarelas de pago y balances",
    scope: "platform",
    permissions: [
      { code: "billing.view", name: "Ver Finanzas de Plataforma", description: "Consultar balances de cobros y facturación de la plataforma" },
      { code: "billing.manage", name: "Gestionar Pasarelas y Cobros", description: "Administrar pasarelas de pago, registros manuales y cobros" },
    ],
  },
  {
    moduleId: "soporte",
    moduleName: "Soporte y Mesa de Ayuda",
    description: "Atención de incidencias y tickets de ayuda de comercios",
    scope: "platform",
    permissions: [
      { code: "support.view", name: "Ver Tickets de Soporte", description: "Consultar solicitudes y reportes de problemas de los comercios" },
      { code: "support.manage", name: "Atender y Resolver Tickets", description: "Interactuar, responder y cambiar estado de solicitudes de ayuda" },
    ],
  },
  {
    moduleId: "auditoria",
    moduleName: "Auditoría y Trazabilidad",
    description: "Registro forense de eventos de seguridad y cambios del sistema",
    scope: "platform",
    permissions: [
      { code: "audit.view", name: "Ver Logs de Auditoría", description: "Inspeccionar registros cronológicos de eventos y seguridad" },
      { code: "audit.export", name: "Exportar Auditoría", description: "Descargar registros de trazabilidad en formatos estructurados" },
    ],
  },
  {
    moduleId: "configuracion",
    moduleName: "Configuración de Plataforma",
    description: "Políticas globales, seguridad de infraestructura y parámetros",
    scope: "platform",
    permissions: [
      { code: "platform_settings.view", name: "Ver Configuración Global", description: "Consultar políticas de seguridad, retención y parámetros Core" },
      { code: "platform_settings.update", name: "Modificar Configuración Global", description: "Actualizar políticas institucionales y de sesión de la plataforma" },
    ],
  },
  {
    moduleId: "roles",
    moduleName: "Roles y Permisos de Plataforma",
    description: "Control de acceso basado en roles (RBAC) para el personal",
    scope: "platform",
    permissions: [
      { code: "roles.view", name: "Ver Roles y Permisos", description: "Consultar matriz de roles y capacidades de acceso" },
      { code: "roles.manage", name: "Administrar Roles y Permisos", description: "Modificar matriz de permisos y crear roles personalizados" },
    ],
  },

  // --- ÁMBITO NEGOCIO (TENANT) ---
  {
    moduleId: "ventas",
    moduleName: "Ventas & Facturación POS",
    description: "Puntos de venta, facturación rápida y comprobantes",
    scope: "business",
    permissions: [
      { code: "sales.view", name: "Ver Ventas y Facturas", description: "Consultar historial de ventas y recibos emitidos en el negocio" },
      { code: "sales.create", name: "Emitir Venta / Cobro POS", description: "Registrar nuevas ventas en punto de venta y generar comprobantes" },
      { code: "sales.update", name: "Modificar Venta", description: "Editar órdenes de venta abiertas antes de facturar" },
      { code: "sales.cancel", name: "Anular Venta / Devolución", description: "Cancelar ventas ya facturadas o procesar notas de crédito" },
    ],
  },
  {
    moduleId: "pedidos",
    moduleName: "Pedidos y Comandas",
    description: "Comandas de cocina, órdenes de mesas y despachos",
    scope: "business",
    permissions: [
      { code: "orders.view", name: "Ver Pedidos", description: "Visualizar estado de comandas y órdenes activas en cocina/despacho" },
      { code: "orders.create", name: "Crear Pedido", description: "Tomar comandas y crear órdenes de mesas o domicilios" },
      { code: "orders.update", name: "Actualizar Pedido", description: "Cambiar estado de preparación o despacho de pedidos" },
      { code: "orders.cancel", name: "Cancelar Pedido", description: "Anular comanda antes de su preparación" },
      { code: "orders.manage", name: "Gestión Avanzada de Comandas", description: "Reasignar mesas, dividir cuentas y gestionar turnos" },
    ],
  },
  {
    moduleId: "productos",
    moduleName: "Catálogo de Productos y Menú",
    description: "Artículos, categorías, precios y variantes",
    scope: "business",
    permissions: [
      { code: "products.view", name: "Ver Catálogo de Productos", description: "Consultar productos, categorías, precios y variantes" },
      { code: "products.create", name: "Crear Producto", description: "Dar de alta nuevos artículos en el catálogo del negocio" },
      { code: "products.update", name: "Editar Producto", description: "Modificar precios, descripciones, recetas y estados de productos" },
      { code: "products.delete", name: "Eliminar Producto", description: "Retirar productos y categorías del inventario" },
    ],
  },
  {
    moduleId: "clientes",
    moduleName: "Clientes y Cuentas por Cobrar",
    description: "Directorio de clientes, cartera y fiados",
    scope: "business",
    permissions: [
      { code: "customers.view", name: "Ver Clientes", description: "Consultar directorio de clientes y estado de carteras de crédito" },
      { code: "customers.create", name: "Registrar Cliente", description: "Dar de alta nuevos clientes y datos de contacto" },
      { code: "customers.update", name: "Editar Cliente", description: "Actualizar información y límites de crédito" },
      { code: "customers.delete", name: "Eliminar Cliente", description: "Eliminar registros de clientes inactivos" },
    ],
  },
  {
    moduleId: "inventario",
    moduleName: "Inventario y Stock",
    description: "Existencias, compras, entradas y mermas",
    scope: "business",
    permissions: [
      { code: "inventory.view", name: "Ver Inventario", description: "Consultar existencias y niveles de stock de materias primas" },
      { code: "inventory.create", name: "Registrar Entrada de Stock", description: "Ingresar compras de proveedores y materias primas" },
      { code: "inventory.update", name: "Editar Existencias", description: "Modificar costos y umbrales mínimos de stock" },
      { code: "inventory.adjust", name: "Ajustar Inventario / Mermas", description: "Realizar arqueos de inventario físico y registrar bajas" },
    ],
  },
  {
    moduleId: "gastos",
    moduleName: "Gastos y Egresos Operativos",
    description: "Control de pagos, compras menores y caja chica",
    scope: "business",
    permissions: [
      { code: "expenses.view", name: "Ver Gastos", description: "Consultar egresos y pagos operativos del negocio" },
      { code: "expenses.create", name: "Registrar Gasto", description: "Crear comprobantes de egreso y compras menores" },
      { code: "expenses.update", name: "Editar Gasto", description: "Modificar categorías e importes de egresos" },
      { code: "expenses.delete", name: "Eliminar Gasto", description: "Anular registros de egresos no autorizados" },
    ],
  },
  {
    moduleId: "empleados",
    moduleName: "Empleados y Accesos del Negocio",
    description: "Colaboradores, roles en tienda y asignaciones",
    scope: "business",
    permissions: [
      { code: "business_users.view", name: "Ver Empleados", description: "Consultar colaboradores y roles asignados en el comercio" },
      { code: "business_users.create", name: "Invitar Empleado", description: "Incorporar cajeros, meseros y supervisores al negocio" },
      { code: "business_users.update", name: "Editar Empleado", description: "Cambiar roles y horarios de trabajo de empleados" },
      { code: "business_users.disable", name: "Desactivar Empleado", description: "Suspender el acceso de un empleado al comercio" },
    ],
  },
  {
    moduleId: "configuracion_negocio",
    moduleName: "Configuración del Comercio",
    description: "Datos del local, impresoras de comandas y medios de pago",
    scope: "business",
    permissions: [
      { code: "business_settings.view", name: "Ver Configuración de Negocio", description: "Consultar datos de sucursales, impresoras y reglas" },
      { code: "business_settings.update", name: "Modificar Configuración de Negocio", description: "Actualizar datos fiscales, logo y métodos de cobro del comercio" },
    ],
  },
  {
    moduleId: "reportes",
    moduleName: "Reportes y Métricas del Negocio",
    description: "Balances de caja, ventas por periodo y exportaciones",
    scope: "business",
    permissions: [
      { code: "reports.view", name: "Ver Reportes y Métricas", description: "Consultar balances de caja, ventas por periodo y productos top" },
      { code: "reports.export", name: "Exportar Reportes Financieros", description: "Descargar cierres contables y reportes en Excel/PDF" },
    ],
  },
];

// =====================================================================
// 5. MATRIZ CANÓNICA DE PERMISOS POR DEFECTO
// =====================================================================

export const DEFAULT_ROLE_PERMISSIONS_MAP: Record<string, string[]> = {
  // Plataforma NEGOVA (Interno Core)
  super_admin: [
    "users.view", "users.create", "users.update", "users.disable", "users.delete",
    "businesses.view", "businesses.create", "businesses.update", "businesses.suspend", "businesses.delete",
    "subscriptions.view", "subscriptions.create", "subscriptions.update", "subscriptions.cancel",
    "plans.view",
    "billing.view", "billing.manage",
    "support.view", "support.manage",
    "audit.view", "audit.export",
    "platform_settings.view", "platform_settings.update",
    "roles.view", "roles.manage"
  ],
  admin: [
    "users.view", "users.create", "users.update",
    "businesses.view", "businesses.create", "businesses.update",
    "subscriptions.view",
    "plans.view",
    "billing.view",
    "support.view", "support.manage",
    "audit.view",
    "roles.view",
    "platform_settings.view"
  ],

  // Negocio (Tenants - Canónicos MVP)
  owner: [
    "sales.view", "sales.create", "sales.update", "sales.cancel",
    "orders.view", "orders.create", "orders.update", "orders.cancel", "orders.manage",
    "products.view", "products.create", "products.update", "products.delete",
    "customers.view", "customers.create", "customers.update", "customers.delete",
    "inventory.view", "inventory.create", "inventory.update", "inventory.adjust",
    "expenses.view", "expenses.create", "expenses.update", "expenses.delete",
    "business_users.view", "business_users.create", "business_users.update", "business_users.disable",
    "business_settings.view", "business_settings.update",
    "reports.view", "reports.export"
  ],
  auxiliar: [
    "sales.view", "sales.create", "sales.update",
    "orders.view", "orders.create", "orders.update",
    "products.view", "products.create", "products.update",
    "customers.view", "customers.create", "customers.update",
    "inventory.view", "inventory.create",
    "expenses.view", "expenses.create",
    "reports.view"
  ],

  // Fallbacks de compatibilidad para registros previos
  business_admin: [
    "sales.view", "sales.create", "sales.update", "sales.cancel",
    "orders.view", "orders.create", "orders.update", "orders.cancel", "orders.manage",
    "products.view", "products.create", "products.update",
    "customers.view", "customers.create", "customers.update",
    "inventory.view", "inventory.create", "inventory.update", "inventory.adjust",
    "expenses.view", "expenses.create", "expenses.update",
    "business_users.view", "business_users.create", "business_users.update",
    "business_settings.view",
    "reports.view", "reports.export"
  ],
  supervisor: [
    "sales.view", "sales.create", "sales.update", "sales.cancel",
    "orders.view", "orders.create", "orders.update", "orders.cancel", "orders.manage",
    "products.view",
    "customers.view", "customers.create", "customers.update",
    "inventory.view", "inventory.create", "inventory.adjust",
    "expenses.view", "expenses.create",
    "business_users.view",
    "reports.view"
  ],
  seller: [
    "sales.view", "sales.create",
    "orders.view", "orders.create", "orders.update",
    "products.view",
    "customers.view", "customers.create", "customers.update"
  ],
  cashier: [
    "sales.view", "sales.create",
    "orders.view", "orders.create",
    "products.view",
    "customers.view", "customers.create"
  ]
};

// =====================================================================
// 6. EVALUACIÓN DE PERMISOS SÍNCRONA / CLIENT-SAFE
// =====================================================================

export function hasPlatformPermission(
  roleCode: string | null | undefined,
  permissionCode: string,
  customRolePermissions?: string[]
): boolean {
  if (!roleCode) return false;
  if (roleCode === "super_admin") return true;

  // Si se pasan los permisos cargados de la base de datos para ese rol
  if (customRolePermissions && Array.isArray(customRolePermissions)) {
    return customRolePermissions.includes(permissionCode);
  }

  // De lo contrario consultar la matriz canónica por defecto
  const rolePermissions = DEFAULT_ROLE_PERMISSIONS_MAP[roleCode];
  if (!rolePermissions) return false;
  return rolePermissions.includes(permissionCode);
}
