import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  UserCheck,
  Truck,
  Receipt,
  Store,
  Package,
  Boxes,
  ShoppingCart,
  Wallet,
  Landmark,
  TrendingUp,
  TrendingDown,
  CreditCard,
  FileText,
  BarChart3,
  Bell,
  Headphones,
  Settings,
  User,
  UtensilsCrossed,
  LayoutGrid,
  BookOpen,
  ChefHat,
  Bike,
  Calendar,
  CalendarCheck2,
  Globe,
  Flame,
  Printer,
  Scale,
  HelpCircle,
  type LucideIcon,
  ShoppingBag,
} from "lucide-react";
import { AppNavSection, AppNavItem } from "../components/layout/navigation-types";
import {
  CommercialActivity,
  PlanFeatureKey,
  getDefaultActivitiesForBusinessType,
  hasCommercialActivity,
  getCatalogModuleLabel,
} from "./commercial-activities";

export type { AppNavSection, AppNavItem };

export type WorkspaceModuleStatus = "implemented" | "under_construction" | "not_applicable";
export type WorkspaceModuleLevel = "core" | "specific" | "global";

export interface WorkspaceModuleDefinition {
  id: string;
  label: string;
  shortDescription: string;
  group: string;
  groupLabel: string;
  icon: LucideIcon;
  href: string; // URL base o relativa
  level: WorkspaceModuleLevel;
  status: WorkspaceModuleStatus;
  compatibleBusinessTypes?: string[];
  requiredActivity?: CommercialActivity;
  minRoleLevel?: "owner" | "auxiliar";
  showInMenu: boolean;
  underConstructionDetails?: {
    summary: string;
    plannedFeatures: string[];
    category: string;
  };
}

export const GASTRONOMY_BUSINESS_TYPES = [
  "restaurant",
  "restaurante",
  "fast_food",
  "fast_food_restaurant",
  "comida_rapida",
  "pizzeria",
  "bakery",
  "panaderia",
  "cafe",
  "cafeteria",
  "bar",
  "ice_cream",
  "heladeria",
  "liquor_store",
  "gastronomy",
  "gastronomy_other",
  "food_truck",
];

/**
 * Grupos canónicos de navegación reorganizados para el Workspace (5 áreas clave).
 */
export const WORKSPACE_NAV_GROUPS = [
  { id: "operacion", label: "Operación" },
  { id: "ventas", label: "Ventas" },
  { id: "catalogo", label: "Productos" },
  { id: "gestion", label: "Gestión del negocio" },
  { id: "administracion", label: "Administración" },
  { id: "cuenta", label: "Cuenta" },
] as const;

// Alias retrocompatibles para pruebas y dependencias previas
export const CORE_WORKSPACE_GROUPS = WORKSPACE_NAV_GROUPS;
export const GASTRONOMY_WORKSPACE_GROUPS = [] as const;

export function isGastronomyBusiness(businessType?: string | null): boolean {
  if (!businessType) return false;
  const normalized = businessType.trim().toLowerCase();
  return GASTRONOMY_BUSINESS_TYPES.includes(normalized);
}

/**
 * CATÁLOGO CENTRALIZADO DE MÓDULOS DE WORKSPACE (NEGOVA)
 * Estructurado en las 5 secciones de trabajo cotidiano del negocio.
 */
export const WORKSPACE_MODULES_CATALOG: WorkspaceModuleDefinition[] = [
  // ==========================================
  // 1. OPERACIÓN
  // ==========================================
  {
    id: "dashboard",
    label: "Inicio",
    shortDescription: "Resumen del negocio y accesos frecuentes.",
    group: "operacion",
    groupLabel: "Operación",
    icon: LayoutDashboard,
    href: "",
    level: "core",
    status: "implemented",
    showInMenu: true,
  },
  {
    id: "pos",
    label: "Vender",
    shortDescription: "Iniciar ventas, seleccionar productos y registrar cobros.",
    group: "operacion",
    groupLabel: "Operación",
    icon: Store,
    href: "pos",
    level: "core",
    status: "implemented",
    showInMenu: true,
  },
  // ==========================================
  // 2. VENTAS
  // ==========================================
  {
    id: "ventas",
    label: "Historial",
    shortDescription: "Historial de ventas y cotizaciones.",
    group: "ventas",
    groupLabel: "Ventas",
    icon: Receipt,
    href: "ventas",
    level: "core",
    status: "implemented",
    showInMenu: true,
  },
  {
    id: "caja",
    label: "Caja",
    shortDescription: "Control de cajas, turnos y arqueos.",
    group: "ventas",
    groupLabel: "Ventas",
    icon: Landmark,
    href: "caja",
    level: "core",
    status: "implemented",
    showInMenu: true,
  },

  {
    id: "pedidos",
    label: "Pedidos",
    shortDescription: "Consultar y gestionar el ciclo operativo de pedidos.",
    group: "operacion",
    groupLabel: "Operación",
    icon: ShoppingBag,
    href: "pedidos",
    level: "specific",
    status: "implemented",
    compatibleBusinessTypes: GASTRONOMY_BUSINESS_TYPES,
    showInMenu: true,
  },
  {
    id: "domicilios",
    label: "Domicilios",
    shortDescription: "Despacho, repartidores y control de entregas.",
    group: "operacion",
    groupLabel: "Operación",
    icon: Bike,
    href: "domicilios",
    level: "specific",
    status: "implemented",
    compatibleBusinessTypes: GASTRONOMY_BUSINESS_TYPES,
    showInMenu: true,
  },
  {
    id: "mesas",
    label: "Mesas",
    shortDescription: "Disponibilidad, rotación y seguimiento de mesas.",
    group: "operacion",
    groupLabel: "Operación",
    icon: LayoutGrid,
    href: "mesas",
    level: "specific",
    status: "implemented",
    compatibleBusinessTypes: GASTRONOMY_BUSINESS_TYPES,
    showInMenu: true,
  },
  {
    id: "reservas",
    label: "Reservas",
    shortDescription: "Calendario, asignación de mesas y control de comensales.",
    group: "operacion",
    groupLabel: "Operación",
    icon: CalendarCheck2,
    href: "reservas",
    level: "specific",
    status: "implemented",
    compatibleBusinessTypes: GASTRONOMY_BUSINESS_TYPES,
    showInMenu: true,
  },
  {
    id: "citas",
    label: "Citas y turnos",
    shortDescription: "Programación y agenda de turnos para servicios.",
    group: "operacion",
    groupLabel: "Operación",
    icon: Calendar,
    href: "modulo/citas",
    level: "specific",
    status: "under_construction",
    requiredActivity: "manage_appointments",
    showInMenu: true,
    underConstructionDetails: {
      category: "Gestión de Citas y Agenda",
      summary:
        "Agenda de atención para negocios que ofrecen servicios con programación previa (barberías, estética, salud).",
      plannedFeatures: [
        "Calendario visual por colaborador o puesto de atención.",
        "Reserva de citas para servicios del catálogo.",
        "Alertas y recordatorios automáticos.",
        "Integración directa con el punto de venta y cobro del servicio prestado.",
      ],
    },
  },

  // ==========================================
  // 2. PRODUCTOS
  // ==========================================
  {
    id: "productos",
    label: "Productos",
    shortDescription: "Crear, editar, activar, desactivar y consultar catálogo de productos.",
    group: "catalogo",
    groupLabel: "Productos",
    icon: Package,
    href: "productos",
    level: "core",
    status: "implemented",
    showInMenu: true,
  },
  {
    id: "inventario",
    label: "Inventario",
    shortDescription: "Control de existencias, ajustes de stock y valorización.",
    group: "catalogo",
    groupLabel: "Productos",
    icon: Boxes,
    href: "inventario",
    level: "core",
    status: "implemented",
    showInMenu: true,
  },
  {
    id: "recetas",
    label: "Recetas",
    shortDescription: "Fichas técnicas, ingredientes, escandallos y costos de preparación.",
    group: "catalogo",
    groupLabel: "Productos",
    icon: ChefHat,
    href: "recetas",
    level: "core",
    status: "implemented",
    showInMenu: true,
  },
  {
    id: "compras",
    label: "Compras",
    shortDescription: "Recepción de mercancías, compras de insumos y registro de facturas.",
    group: "catalogo",
    groupLabel: "Productos",
    icon: ShoppingCart,
    href: "compras",
    level: "core",
    status: "implemented",
    showInMenu: true,
  },
  {
    id: "proveedores",
    label: "Proveedores",
    shortDescription: "Directorio de proveedores, insumos, órdenes y condiciones comerciales.",
    group: "catalogo",
    groupLabel: "Productos",
    icon: Truck,
    href: "proveedores",
    level: "core",
    status: "implemented",
    showInMenu: true,
  },
  {
    id: "menu-digital",
    label: "Presencia digital",
    shortDescription: "Personalizar y publicar la carta y catálogo público con enlace web y QR.",
    group: "catalogo",
    groupLabel: "Productos",
    icon: Globe,
    href: "presencia-digital",
    level: "core",
    status: "implemented",
    compatibleBusinessTypes: GASTRONOMY_BUSINESS_TYPES,
    showInMenu: false,
  },

  // ==========================================
  // 3. GESTIÓN DEL NEGOCIO
  // ==========================================
  {
    id: "clientes",
    label: "Clientes",
    shortDescription: "Directorio de clientes frecuentes, historial de compras y direcciones.",
    group: "gestion",
    groupLabel: "Gestión del negocio",
    icon: UserCheck,
    href: "clientes",
    level: "core",
    status: "implemented",
    showInMenu: true,
  },
  {
    id: "gastos",
    label: "Gastos",
    shortDescription: "Registrar y consultar gastos operacionales y de producción.",
    group: "gestion",
    groupLabel: "Gestión del negocio",
    icon: Wallet,
    href: "gastos",
    level: "core",
    status: "implemented",
    showInMenu: true,
  },
  {
    id: "finanzas",
    label: "Finanzas",
    shortDescription: "Consultar ingresos, egresos y resultados.",
    group: "gestion",
    groupLabel: "Gestión del negocio",
    icon: TrendingUp,
    href: "modulo/finanzas",
    level: "core",
    status: "under_construction",
    showInMenu: true,
    underConstructionDetails: {
      category: "Inteligencia Financiera",
      summary:
        "Radiografía económica del comercio: balance de ingresos vs. egresos, márgenes operativos y estimación de utilidades.",
      plannedFeatures: [
        "Estado de resultados simplificado en tiempo real.",
        "Cálculo de margen bruto y punto de equilibrio operacional.",
        "Proyección de liquidez para obligaciones inmediatas.",
        "Métricas e indicadores financieros clave.",
      ],
    },
  },
  {
    id: "documentos",
    label: "Documentos",
    shortDescription: "Gestionar los documentos comerciales disponibles.",
    group: "gestion",
    groupLabel: "Gestión del negocio",
    icon: FileText,
    href: "configuracion?tab=comprobantes",
    level: "core",
    status: "implemented",
    minRoleLevel: "owner",
    showInMenu: true,
  },
  {
    id: "reportes",
    label: "Reportes",
    shortDescription: "Dashboard de KPIs de ventas y métricas clave.",
    group: "gestion",
    groupLabel: "Gestión del negocio",
    icon: BarChart3,
    href: "dashboard",
    level: "core",
    status: "implemented",
    showInMenu: true,
  },

  // ==========================================
  // 4. ADMINISTRACIÓN
  // ==========================================
  {
    id: "usuarios",
    label: "Empleados",
    shortDescription: "Gestionar las personas que tienen acceso al negocio.",
    group: "administracion",
    groupLabel: "Administración",
    icon: Users,
    href: "usuarios",
    level: "core",
    status: "implemented",
    minRoleLevel: "owner",
    showInMenu: true,
  },
  {
    id: "nomina",
    label: "Nómina",
    shortDescription: "Liquidación y gestión de turnos y pagos a colaboradores.",
    group: "administracion",
    groupLabel: "Administración",
    icon: Wallet,
    href: "nomina",
    level: "core",
    status: "implemented",
    minRoleLevel: "owner",
    showInMenu: true,
  },
  {
    id: "roles",
    label: "Roles y permisos",
    shortDescription: "Administrar los accesos, si el usuario tiene autorización.",
    group: "administracion",
    groupLabel: "Administración",
    icon: ShieldCheck,
    href: "roles",
    level: "core",
    status: "implemented",
    minRoleLevel: "owner",
    showInMenu: true,
  },
  {
    id: "configuracion",
    label: "Configuración del negocio",
    shortDescription: "Datos generales y preferencias del negocio.",
    group: "administracion",
    groupLabel: "Administración",
    icon: Settings,
    href: "configuracion",
    level: "core",
    status: "implemented",
    minRoleLevel: "owner",
    showInMenu: true,
  },

  // ==========================================
  // 5. CUENTA
  // ==========================================
  {
    id: "notificaciones",
    label: "Notificaciones",
    shortDescription: "Consultar avisos.",
    group: "cuenta",
    groupLabel: "Cuenta",
    icon: Bell,
    href: "notificaciones",
    level: "core",
    status: "implemented",
    showInMenu: true,
  },
  {
    id: "perfil",
    label: "Mi perfil",
    shortDescription: "Gestionar la cuenta personal del usuario.",
    group: "cuenta",
    groupLabel: "Cuenta",
    icon: User,
    href: "perfil",
    level: "core",
    status: "implemented",
    showInMenu: true,
  },
  {
    id: "soporte",
    label: "Soporte",
    shortDescription: "Mesa de ayuda y asistencia técnica de NEGOVA.",
    group: "cuenta",
    groupLabel: "Cuenta",
    icon: Headphones,
    href: "soporte",
    level: "core",
    status: "implemented",
    showInMenu: true,
  },

  // ==========================================
  // MÓDULOS DE CATÁLOGO EXTENDIDO (FUERA DE MENÚ PRINCIPAL)
  // Se mantienen para permitir rutas existentes y resolución de páginas informativas
  // ==========================================
  {
    id: "reportes_gastos",
    label: "Reportes de Gastos y Compras",
    shortDescription: "Supervisión de egresos operativos, órdenes de compra y obligaciones con proveedores.",
    group: "gestion",
    groupLabel: "Gestión del negocio",
    icon: TrendingDown,
    href: "reportes/gastos",
    level: "core",
    status: "implemented",
    showInMenu: false,
  },
  {
    id: "reportes_domicilios",
    label: "Reporte de Domicilios",
    shortDescription: "Tiempos de entrega, ranking de repartidores y análisis por zonas.",
    group: "gestion",
    groupLabel: "Gestión del negocio",
    icon: Bike,
    href: "reportes/domicilios",
    level: "specific",
    status: "implemented",
    compatibleBusinessTypes: GASTRONOMY_BUSINESS_TYPES,
    showInMenu: false,
  },
  {
    id: "reportes_horas_pico",
    label: "Análisis de Horas Pico",
    shortDescription: "Mapa de calor de concurrencia y facturación por día y hora para optimizar turnos y abastecimiento.",
    group: "gestion",
    groupLabel: "Gestión del negocio",
    icon: Flame,
    href: "reportes/horas-pico",
    level: "core",
    status: "implemented",
    showInMenu: false,
  },
  {
    id: "reportes_recetas",
    label: "Reporte de Recetas y Costos",
    shortDescription: "Escandallo de recetas, márgenes brutos, consumo de ingredientes y alertas de agotamiento.",
    group: "gestion",
    groupLabel: "Gestión del negocio",
    icon: ChefHat,
    href: "reportes/recetas",
    level: "specific",
    status: "implemented",
    compatibleBusinessTypes: GASTRONOMY_BUSINESS_TYPES,
    showInMenu: false,
  },
  {
    id: "cuentas",
    label: "Cuentas por cobrar y pagar",
    shortDescription: "Control de cartera de clientes y compromisos con proveedores.",
    group: "gestion",
    groupLabel: "Gestión del negocio",
    icon: CreditCard,
    href: "modulo/cuentas",
    level: "core",
    status: "under_construction",
    showInMenu: false,
    underConstructionDetails: {
      category: "Cartera y Obligaciones",
      summary: "Monitoreo centralizado de cartera y cuentas pendientes de pago.",
      plannedFeatures: [
        "Control de créditos concedidos.",
        "Registro de abonos y comprobantes.",
      ],
    },
  },
  {
    id: "personal",
    label: "Personal y nómina",
    shortDescription: "Gestión de trabajadores y novedades laborales.",
    group: "administracion",
    groupLabel: "Administración",
    icon: Users,
    href: "personal",
    level: "core",
    status: "implemented",
    minRoleLevel: "owner",
    showInMenu: false,
  },

  {
    id: "menu",
    label: "Menú gastronómico",
    shortDescription: "Carta gastronómica y combos.",
    group: "operacion",
    groupLabel: "Operación",
    icon: BookOpen,
    href: "modulo/menu",
    level: "specific",
    status: "under_construction",
    compatibleBusinessTypes: GASTRONOMY_BUSINESS_TYPES,
    showInMenu: false,
  },
  {
    id: "cocina",
    label: "Cocina (KDS)",
    shortDescription: "Pantalla de cocina y preparación de comandas en tiempo real.",
    group: "operacion",
    groupLabel: "Operación",
    icon: ChefHat,
    href: "cocina",
    level: "specific",
    status: "implemented",
    compatibleBusinessTypes: GASTRONOMY_BUSINESS_TYPES,
    showInMenu: true,
  },
  {
    id: "despacho",
    label: "Despacho o entrega",
    shortDescription: "Asignación de repartos y domicilios.",
    group: "operacion",
    groupLabel: "Operación",
    icon: Bike,
    href: "modulo/despacho",
    level: "specific",
    status: "under_construction",
    compatibleBusinessTypes: GASTRONOMY_BUSINESS_TYPES,
    showInMenu: false,
  },
  {
    id: "configuracion_impresion",
    label: "Impresoras y Estaciones",
    shortDescription: "Configuración de impresoras térmicas, comandas y cajón monedero.",
    group: "administracion",
    groupLabel: "Administración",
    icon: Printer,
    href: "configuracion/impresion",
    level: "core",
    status: "implemented",
    minRoleLevel: "owner",
    showInMenu: false,
  },
  {
    id: "configuracion_unidades",
    label: "Unidades y Conversiones",
    shortDescription: "Configuración de unidades de medida y equivalencias de masa, volumen y unidades.",
    group: "administracion",
    groupLabel: "Administración",
    icon: Scale,
    href: "configuracion/unidades",
    level: "core",
    status: "implemented",
    minRoleLevel: "owner",
    showInMenu: false,
  },
  {
    id: "configuracion_notificaciones",
    label: "Plantillas de Notificación",
    shortDescription: "Plantillas editables de WhatsApp y Email para pedidos QR, domicilios, stock y caja.",
    group: "administracion",
    groupLabel: "Administración",
    icon: Bell,
    href: "configuracion/notificaciones",
    level: "core",
    status: "implemented",
    minRoleLevel: "owner",
    showInMenu: false,
  },
  {
    id: "configuracion_seguridad",
    label: "Seguridad y 2FA",
    shortDescription: "Autenticación en dos pasos (TOTP), códigos de respaldo y políticas de seguridad.",
    group: "administracion",
    groupLabel: "Administración",
    icon: ShieldCheck,
    href: "configuracion/seguridad",
    level: "core",
    status: "implemented",
    minRoleLevel: "owner",
    showInMenu: false,
  },
  {
    id: "configuracion_pagina_enlaces",
    label: "Página de Enlaces (Bio Links)",
    shortDescription: "Página pública tipo Linktree para Instagram, TikTok y WhatsApp con tu menú digital.",
    group: "administracion",
    groupLabel: "Administración",
    icon: Globe,
    href: "configuracion/pagina-enlaces",
    level: "core",
    status: "implemented",
    minRoleLevel: "owner",
    showInMenu: false,
  },
  {
    id: "configuracion_facturacion_electronica",
    label: "Facturación Electrónica DIAN",
    shortDescription: "Configuración de emisor, resolución DIAN, CUFE y proveedor electrónico.",
    group: "administracion",
    groupLabel: "Administración",
    icon: FileText,
    href: "configuracion/facturacion-electronica",
    level: "core",
    status: "implemented",
    minRoleLevel: "owner",
    showInMenu: false,
  },
  {
    id: "ayuda",
    label: "Centro de Ayuda",
    shortDescription: "Guías interactivas, preguntas frecuentes y soporte técnico oficial.",
    group: "soporte",
    groupLabel: "Soporte",
    icon: HelpCircle,
    href: "ayuda",
    level: "core",
    status: "implemented",
    minRoleLevel: "auxiliar",
    showInMenu: true,
  },
];

/**
 * Obtener definición de módulo por su ID
 */
export function getWorkspaceModuleById(moduleId: string): WorkspaceModuleDefinition | undefined {
  return WORKSPACE_MODULES_CATALOG.find((m) => m.id === moduleId);
}

/**
 * Genera la estructura de secciones de navegación para el Sidebar de Workspace.
 * Agrupa los módulos en las 5 secciones canónicas y respeta permisos y verticales.
 */
export function buildWorkspaceNavSections(
  businessId: string,
  options: {
    businessType?: string | null;
    commercialActivities?: CommercialActivity[];
    planId?: string;
    enabledFeatures?: PlanFeatureKey[];
    isOwner?: boolean;
    roleCode?: string;
  } = {}
): AppNavSection[] {
  const activities =
    options.commercialActivities && options.commercialActivities.length > 0
      ? options.commercialActivities
      : getDefaultActivitiesForBusinessType(options.businessType);

  const hasProducts = hasCommercialActivity(activities, "sell_products");
  const hasServices = hasCommercialActivity(activities, "provide_services");
  const hasAppointments = hasCommercialActivity(activities, "manage_appointments") && hasServices;

  const isGastro = isGastronomyBusiness(options.businessType) && hasProducts;
  const isAuxiliar =
    options.roleCode === "auxiliar" ||
    (options.isOwner === false &&
      !["super_admin", "admin", "owner"].includes(options.roleCode || ""));
  const isOwnerOrPlatformAdmin = !isAuxiliar;

  const sections: AppNavSection[] = [];

  for (const grp of WORKSPACE_NAV_GROUPS) {
    const groupModules = WORKSPACE_MODULES_CATALOG.filter((m) => {
      if (m.group !== grp.id || !m.showInMenu) return false;

      // Filtrar módulo de catálogo si no tiene ni productos ni servicios
      if (m.id === "productos" && !hasProducts && !hasServices) {
        return false;
      }

      // Filtrar módulos de productos físicos si el negocio no vende productos
      if (
        (m.id === "inventario" || m.id === "recetas" || m.id === "compras" || m.id === "proveedores") &&
        !hasProducts
      ) {
        return false;
      }

      // Filtrar módulo de citas si el negocio no gestiona citas o no ofrece servicios
      if (m.id === "citas" && !hasAppointments) {
        return false;
      }

      // Filtrar módulos gastronómicos operativos si no es gastronómico o no vende productos
      if (
        m.compatibleBusinessTypes &&
        m.compatibleBusinessTypes.length > 0 &&
        !m.compatibleBusinessTypes.includes("*")
      ) {
        if (!isGastro) return false;
      }

      // Filtrar por actividad comercial requerida explícita
      if (m.requiredActivity && !hasCommercialActivity(activities, m.requiredActivity)) {
        return false;
      }

      // Filtrar módulos que requieren permisos/rol administrativo del dueño (owner)
      if (m.minRoleLevel === "owner" && !isOwnerOrPlatformAdmin) {
        return false;
      }

      return true;
    });

    if (groupModules.length === 0) continue;

    const items: AppNavItem[] = groupModules.map((mod) => {
      const targetHref = mod.href
        ? `/workspace/${businessId}/${mod.href}`
        : `/workspace/${businessId}`;

      // Etiqueta dinámica adaptada para catálogo
      let label = mod.label;
      if (mod.id === "productos") {
        label = getCatalogModuleLabel(activities, options.businessType);
      }

      return {
        id: mod.id,
        label,
        href: targetHref,
        icon: mod.icon,
        section: grp.id,
        description: mod.shortDescription,
        exactMatch: mod.id === "dashboard",
        allowed: true,
      };
    });

    sections.push({
      id: grp.id,
      label: grp.label,
      items,
    });
  }

  return sections;
}

/**
 * Obtiene el identificador del módulo predeterminado para el acceso rápido del encabezado
 * según la vertical del negocio y sus actividades comerciales habilitadas.
 */
export function getDefaultQuickAccessModuleId(
  businessType?: string | null,
  commercialActivities?: CommercialActivity[]
): string {
  // 1. Restaurantes y gastronomía: Pedidos
  if (isGastronomyBusiness(businessType)) {
    return "pedidos";
  }

  const activities =
    commercialActivities && commercialActivities.length > 0
      ? commercialActivities
      : getDefaultActivitiesForBusinessType(businessType);

  // 2. Servicios con citas / barberías / salones: Citas
  if (hasCommercialActivity(activities, "manage_appointments")) {
    return "citas";
  }

  // 3. Comercio general / retail / tiendas: Ventas
  return "ventas";
}

/**
 * Resuelve el elemento de navegación (AppNavItem) para el acceso rápido del encabezado.
 * Garantiza que el módulo seleccionado o de respaldo esté realmente habilitado y autorizado para el usuario.
 */
export function resolveQuickAccessItem(
  sections: AppNavSection[],
  configuredModuleId?: string | null,
  businessType?: string | null,
  commercialActivities?: CommercialActivity[]
): AppNavItem | null {
  const allItems = sections.flatMap((s) => s.items);
  if (allItems.length === 0) return null;

  // 1. Si el propietario configuró una preferencia y el módulo está habilitado y permitido
  if (configuredModuleId) {
    const configuredItem = allItems.find((i) => i.id === configuredModuleId);
    if (configuredItem && configuredItem.allowed !== false) {
      return configuredItem;
    }
  }

  // 2. Si no hay preferencia o no es válida, intentar con el predeterminado de la vertical
  const defaultId = getDefaultQuickAccessModuleId(businessType, commercialActivities);
  const defaultItem = allItems.find((i) => i.id === defaultId);
  if (defaultItem && defaultItem.allowed !== false) {
    return defaultItem;
  }

  // 3. Respaldo seguro: buscar 'ventas', luego 'pos', luego 'pedidos' o el primer módulo permitido
  const fallbackVentas = allItems.find((i) => i.id === "ventas" && i.allowed !== false);
  if (fallbackVentas) return fallbackVentas;

  const fallbackPos = allItems.find((i) => i.id === "pos" && i.allowed !== false);
  if (fallbackPos) return fallbackPos;

  const fallbackPedidos = allItems.find((i) => i.id === "pedidos" && i.allowed !== false);
  if (fallbackPedidos) return fallbackPedidos;

  return allItems.find((i) => i.allowed !== false) || null;
}
