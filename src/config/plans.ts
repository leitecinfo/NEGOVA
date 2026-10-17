/**
 * FUENTE ÚNICA DE VERDAD: DEFINICIÓN DE PLANES Y LÍMITES DE NEGOVA
 * 
 * REGLA FUNDAMENTAL:
 * NEGOVA solamente ofrece lo que puede garantizar, soportar técnicamente,
 * mantener con la infraestructura disponible (Supabase) y escalar con honestidad.
 * 
 * DECISIONES DE ARQUITECTURA Y PRODUCTO:
 * 1. Almacenamiento (Storage): NO se ofrece como cuota comercial arbitraria (ej. 50 GB)
 *    mientras la infraestructura opere sobre niveles iniciales. Se excluyen promesas de gigabytes.
 * 2. Plan Enterprise: NO se comercializa en esta etapa. No inventar capacidades empresariales
 *    ficticias sin SLA o infraestructura dedicada.
 * 3. Recursos "Ilimitados": PROHIBIDOS. Todos los límites reflejan capacidades reales y soportables.
 * 4. Integraciones externas (WhatsApp API, SMS Gateway, API pública): NO se prometen en planes
 *    mientras no estén operativas e integradas con backend real.
 */

export type PlanId = "inicio" | "crece" | "negocio";
export type BillingInterval = "monthly" | "annual";

export interface PlanPricing {
  monthly: number;
  monthlyFormatted: string;
  annualMonthlyEquivalent: number;
  annualMonthlyFormatted: string;
  annualTotal: number;
  annualTotalFormatted: string;
  currency: "COP";
  billingNote: string;
}

export interface PlanLimits {
  maxUsers: number;
  maxProducts: number;
  maxBranches: number;
  canUsePos: boolean;
  canUseAiAssistant: boolean;
  canUseMultipleRoles: boolean;
  canUseCreditAndDebts: boolean;
  canUseAdvancedReports: boolean;
  supportLevel: "standard" | "priority" | "direct";
}

export interface PlanFeatureCategory {
  category: string;
  items: string[];
}

export interface CommercialPlan {
  id: PlanId;
  code: string;
  name: string;
  concept: string;
  tagline: string;
  description: string;
  pricing: PlanPricing;
  limits: PlanLimits;
  featureGroups: PlanFeatureCategory[];
  ctaText: string;
  isRecommended?: boolean;
  badgeText?: string;
  trialBadge?: string;
  trialDays?: number;
  color: string;
  status: "active" | "planned" | "deprecated";
  aiHighlight?: {
    title: string;
    description: string;
    sampleQuestions?: string[];
  };
}

export interface ComparisonFeature {
  name: string;
  inicio: boolean;
  crece: boolean;
  negocio: boolean;
  category: string;
  notes?: string;
}

/**
 * Formatea valores monetarios en pesos colombianos (COP)
 */
export function formatCOP(amount: number): string {
  return `$${Math.round(amount).toLocaleString("es-CO")}`;
}

/**
 * Calcula dinámicamente la estructura de precios de un plan
 * aplicando o no el porcentaje de descuento por facturación anual configurado.
 */
export function calculatePlanPricing(
  monthlyPrice: number,
  discountPercentage: number = 0,
  isDiscountEnabled: boolean = false
): PlanPricing {
  const effectiveDiscount = isDiscountEnabled && discountPercentage > 0 ? discountPercentage : 0;
  const annualMonthlyEquivalent = Math.round(monthlyPrice * (1 - effectiveDiscount / 100));
  const annualTotal = annualMonthlyEquivalent * 12;

  return {
    monthly: monthlyPrice,
    monthlyFormatted: formatCOP(monthlyPrice),
    annualMonthlyEquivalent,
    annualMonthlyFormatted: formatCOP(annualMonthlyEquivalent),
    annualTotal,
    annualTotalFormatted: formatCOP(annualTotal),
    currency: "COP",
    billingNote: "COP / mes",
  };
}

/**
 * Catálogo Canónico de Planes Oficiales de NEGOVA (Precios Base)
 */
export const NEGOVA_PLANS: Record<PlanId, CommercialPlan> = {
  inicio: {
    id: "inicio",
    code: "PLAN-INICIO-V1",
    name: "Inicio",
    concept: "Pon orden.",
    tagline: "Resuelve las necesidades básicas de tu negocio para operar sin enredos.",
    description: "Para pequeños comercios y negocios que quieren dejar atrás los cuadernos y organizar su operación diaria.",
    pricing: calculatePlanPricing(29900),
    limits: {
      maxUsers: 2,
      maxProducts: 200,
      maxBranches: 1,
      canUsePos: true,
      canUseAiAssistant: false,
      canUseMultipleRoles: false,
      canUseCreditAndDebts: false,
      canUseAdvancedReports: false,
      supportLevel: "standard",
    },
    trialDays: 30,
    trialBadge: "30 DÍAS GRATIS",
    ctaText: "Comenzar con Inicio",
    color: "#3B82F6",
    status: "active",
    featureGroups: [
      {
        category: "Ventas y caja",
        items: [
          "Hasta 2 usuarios de acceso (Dueño y 1 colaborador)",
          "Registro rápido de ventas",
          "Registro de gastos diarios",
          "Control básico de apertura y cierre de caja",
          "Comprobantes simples de venta",
        ],
      },
      {
        category: "Inventario y productos",
        items: [
          "Catálogo de hasta 200 productos",
          "Control básico de existencias",
          "Alertas de stock bajo",
        ],
      },
      {
        category: "Clientes y reportes",
        items: [
          "Directorio básico de clientes",
          "Reportes básicos de ventas del día y mes",
          "Acceso web desde celular y computador",
        ],
      },
    ],
  },

  crece: {
    id: "crece",
    code: "PLAN-CRECE-V1",
    name: "Crece",
    concept: "Entiende tu negocio.",
    tagline: "No solamente registras lo que ocurre. Entiendes lo que está pasando.",
    description: "Para negocios con movimiento constante que necesitan control de fiados, compras y estadísticas claras.",
    pricing: calculatePlanPricing(59900),
    limits: {
      maxUsers: 3,
      maxProducts: 1000,
      maxBranches: 1,
      canUsePos: true,
      canUseAiAssistant: true,
      canUseMultipleRoles: false,
      canUseCreditAndDebts: true,
      canUseAdvancedReports: true,
      supportLevel: "priority",
    },
    isRecommended: true,
    badgeText: "MÁS ELEGIDO",
    ctaText: "Elegir Crece",
    color: "#ED500A",
    status: "active",
    featureGroups: [
      {
        category: "Todo lo de Inicio, más:",
        items: [
          "Hasta 3 usuarios de acceso",
          "Catálogo ampliado de hasta 1.000 productos",
          "Inventario con variantes y categorías",
          "Control de fiados y cuentas por cobrar a clientes",
          "Gestión de compras y registro de proveedores",
          "Arqueos de caja detallados por turno",
          "Estadísticas y comparativas de ventas por período",
          "Soporte prioritario",
        ],
      },
    ],
    aiHighlight: {
      title: "Asistente Inteligente de Negocio (NEGOVA AI)",
      description: "Consultas en lenguaje natural sobre la operación del negocio:",
      sampleQuestions: [
        "¿Cuál fue mi producto más vendido esta semana?",
        "¿Qué productos están cerca de agotarse?",
      ],
    },
  },

  negocio: {
    id: "negocio",
    code: "PLAN-NEGOCIO-V1",
    name: "Negocio",
    concept: "Operación completa.",
    tagline: "Más personas, más movimiento, más control.",
    description: "Para comercios consolidados con varios colaboradores que requieren roles, permisos y métricas avanzadas.",
    pricing: calculatePlanPricing(99900),
    limits: {
      maxUsers: 6,
      maxProducts: 3000,
      maxBranches: 1,
      canUsePos: true,
      canUseAiAssistant: true,
      canUseMultipleRoles: true,
      canUseCreditAndDebts: true,
      canUseAdvancedReports: true,
      supportLevel: "direct",
    },
    ctaText: "Elegir Negocio",
    color: "#10B981",
    status: "active",
    featureGroups: [
      {
        category: "Todo lo de Crece, más:",
        items: [
          "Hasta 6 colaboradores con roles y permisos específicos",
          "Catálogo extendido de hasta 3.000 productos",
          "Múltiples turnos y puntos de cobro dentro del local",
          "Reportes avanzados de márgenes y rentabilidad",
          "Consultas avanzadas con NEGOVA AI",
          "Acompañamiento y soporte directo",
        ],
      },
    ],
    aiHighlight: {
      title: "IA Operativa para Equipos",
      description: "Supervisión inteligente de ventas por colaborador y análisis de rentabilidad.",
    },
  },
};

/**
 * Array ordenado para renderizar tarjetas en pricing, landing y onboarding
 */
export const COMMERCIAL_PLANS_LIST: CommercialPlan[] = [
  NEGOVA_PLANS.inicio,
  NEGOVA_PLANS.crece,
  NEGOVA_PLANS.negocio,
];

/**
 * Obtiene el listado de planes comerciales aplicando una configuración de descuento anual opcional.
 */
export function getCommercialPlans(discountConfig?: { isEnabled: boolean; percentage: number }): CommercialPlan[] {
  const isDiscount = Boolean(discountConfig?.isEnabled && (discountConfig?.percentage || 0) > 0);
  const pct = isDiscount ? (discountConfig?.percentage || 0) : 0;

  return COMMERCIAL_PLANS_LIST.map((plan) => ({
    ...plan,
    pricing: calculatePlanPricing(plan.pricing.monthly, pct, isDiscount),
  }));
}

/**
 * Matriz de Funcionalidades Comparativas
 * Solo incluye características reales y soportadas por el producto.
 */
export const COMPARISON_FEATURES: ComparisonFeature[] = [
  // Ventas y Caja
  { name: "Registro ágil de ventas", inicio: true, crece: true, negocio: true, category: "Ventas y Caja" },
  { name: "Registro de gastos diarios", inicio: true, crece: true, negocio: true, category: "Ventas y Caja" },
  { name: "Control de apertura y cierre de caja", inicio: true, crece: true, negocio: true, category: "Ventas y Caja" },
  { name: "Arqueos de caja por turno", inicio: false, crece: true, negocio: true, category: "Ventas y Caja" },

  // Inventario y Catálogo
  { name: "Catálogo de productos", inicio: true, crece: true, negocio: true, category: "Inventario y Catálogo" },
  { name: "Control de existencias y alertas de bajo stock", inicio: true, crece: true, negocio: true, category: "Inventario y Catálogo" },
  { name: "Variantes de productos (tallas, sabores, presentaciones)", inicio: false, crece: true, negocio: true, category: "Inventario y Catálogo" },
  { name: "Registro de compras y proveedores", inicio: false, crece: true, negocio: true, category: "Inventario y Catálogo" },

  // Clientes y Cuentas
  { name: "Directorio de clientes", inicio: true, crece: true, negocio: true, category: "Clientes y Cuentas" },
  { name: "Control de fiados y cuentas por cobrar", inicio: false, crece: true, negocio: true, category: "Clientes y Cuentas" },
  { name: "Historial de abonos por cliente", inicio: false, crece: true, negocio: true, category: "Clientes y Cuentas" },

  // Reportes y Analítica
  { name: "Reportes básicos diarios y mensuales", inicio: true, crece: true, negocio: true, category: "Reportes e Inteligencia" },
  { name: "Estadísticas y productos más vendidos", inicio: false, crece: true, negocio: true, category: "Reportes e Inteligencia" },
  { name: "Reportes avanzados de márgenes y rendimiento", inicio: false, crece: false, negocio: true, category: "Reportes e Inteligencia" },

  // Equipo y Roles
  { name: "Usuarios incluidos", inicio: true, crece: true, negocio: true, category: "Equipo y Roles", notes: "Inicio: 2 | Crece: 3 | Negocio: 6" },
  { name: "Roles y permisos para colaboradores", inicio: false, crece: false, negocio: true, category: "Equipo y Roles" },

  // Plataforma y Soporte
  { name: "Acceso web desde celular y computador", inicio: true, crece: true, negocio: true, category: "Plataforma" },
  { name: "Asistente inteligente NEGOVA AI", inicio: false, crece: true, negocio: true, category: "Plataforma" },
  { name: "Soporte y acompañamiento", inicio: true, crece: true, negocio: true, category: "Plataforma", notes: "Inicio: Estándar | Crece: Prioritario | Negocio: Directo" },
];

/**
 * ============================================================================
 * UTILIDADES CANÓNICAS DE VIGENCIA Y SUSCRIPCIONES
 * ============================================================================
 */

export interface VigenciaPeriodDates {
  startDate: string;
  endDate: string;
  monthsContracted: number;
  durationFormatted: string;
}

export interface VigenciaBadgeInfo {
  label: string;
  text: string;
  color: string;
  badgeVariant: "emerald" | "amber" | "red" | "gray";
  isUrgent: boolean;
  isExpired: boolean;
}

/**
 * Formatea la duración contratada legible (ej. "6 meses", "1 mes", "2 años", "1 año")
 */
export function formatVigenciaDuration(
  billingInterval: BillingInterval,
  monthsContracted: number
): string {
  if (billingInterval === "annual" || (monthsContracted >= 12 && monthsContracted % 12 === 0)) {
    const years = Math.max(1, Math.round(monthsContracted / 12));
    return `${years} ${years === 1 ? "año" : "años"}`;
  }
  return `${monthsContracted} ${monthsContracted === 1 ? "mes" : "meses"}`;
}

/**
 * Calcula las fechas canónicas de inicio y vencimiento según la modalidad y cantidad contratada.
 * - Mensual + N meses: N meses calendario a partir de la fecha de inicio.
 * - Anual + N años: N * 12 meses calendario a partir de la fecha de inicio.
 */
export function calculatePeriodDates(
  startedAt: Date | string = new Date(),
  interval: BillingInterval = "monthly",
  contractDuration: number = 1
): VigenciaPeriodDates {
  const start = new Date(startedAt);
  const qty = Math.max(1, contractDuration);
  const totalMonths = interval === "annual" ? qty * 12 : qty;

  const end = new Date(start);
  end.setMonth(end.getMonth() + totalMonths);

  const durationFormatted = formatVigenciaDuration(interval, totalMonths);

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    monthsContracted: totalMonths,
    durationFormatted,
  };
}

/**
 * Calcula dinámicamente los días restantes entre una fecha objetivo y la fecha actual.
 * Retorna un entero positivo, 0 si vence hoy, o negativo si ya expiró.
 */
export function calculateRemainingDays(
  targetDate: Date | string | null | undefined,
  fromDate: Date | string = new Date()
): number {
  if (!targetDate) return 0;
  const target = new Date(targetDate);
  const from = new Date(fromDate);
  if (isNaN(target.getTime()) || isNaN(from.getTime())) return 0;

  const diffMs = target.getTime() - from.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Genera el estado visual y semáforo progresivo de vigencia según los días restantes:
 * - > 15 días: Normal (Verde / Emerald)
 * - 6 a 15 días: Advertencia (Naranja / Amber)
 * - 1 a 5 días: Crítico (Rojo / Red)
 * - <= 0 días: Vencido (Rojo / Gray)
 */
export function getVigenciaStatusBadge(
  remainingDays: number,
  status: string = "active",
  isTrial: boolean = false
): VigenciaBadgeInfo {
  if (status === "suspended" || status === "inactive") {
    return {
      label: status === "suspended" ? "Suspendido" : "Inactivo",
      text: status === "suspended" ? "Operación suspendida" : "Negocio desactivado",
      color: "text-slate-500 dark:text-slate-400",
      badgeVariant: "gray",
      isUrgent: false,
      isExpired: true,
    };
  }

  if (isTrial) {
    if (remainingDays <= 0) {
      return {
        label: "Prueba vencida",
        text: "Período de prueba finalizado",
        color: "text-red-600 dark:text-red-400",
        badgeVariant: "red",
        isUrgent: true,
        isExpired: true,
      };
    }

    if (remainingDays <= 5) {
      return {
        label: `${remainingDays} día${remainingDays === 1 ? "" : "s"} de prueba`,
        text: "Prueba por vencer",
        color: "text-red-600 dark:text-red-400",
        badgeVariant: "red",
        isUrgent: true,
        isExpired: false,
      };
    }

    if (remainingDays <= 15) {
      return {
        label: `${remainingDays} días de prueba`,
        text: "Prueba gratuita activa",
        color: "text-amber-600 dark:text-amber-400",
        badgeVariant: "amber",
        isUrgent: false,
        isExpired: false,
      };
    }

    return {
      label: `${remainingDays} días de prueba`,
      text: "Prueba gratuita activa (30 días)",
      color: "text-amber-600 dark:text-amber-400",
      badgeVariant: "amber",
      isUrgent: false,
      isExpired: false,
    };
  }

  if (remainingDays <= 0) {
    return {
      label: "Vencido (0 días)",
      text: "Suscripción vencida",
      color: "text-red-600 dark:text-red-400",
      badgeVariant: "red",
      isUrgent: true,
      isExpired: true,
    };
  }

  if (remainingDays <= 5) {
    return {
      label: `${remainingDays} día${remainingDays === 1 ? "" : "s"}`,
      text: "Vencimiento inminente",
      color: "text-red-600 dark:text-red-400",
      badgeVariant: "red",
      isUrgent: true,
      isExpired: false,
    };
  }

  if (remainingDays <= 15) {
    return {
      label: `${remainingDays} días`,
      text: "Próximo a vencer",
      color: "text-amber-600 dark:text-amber-400",
      badgeVariant: "amber",
      isUrgent: false,
      isExpired: false,
    };
  }

  return {
    label: `${remainingDays} días`,
    text: "Vigencia activa",
    color: "text-emerald-600 dark:text-emerald-400",
    badgeVariant: "emerald",
    isUrgent: false,
    isExpired: false,
  };
}

/**
 * Formateador de fecha legible (DD/MM/AAAA)
 */
export function formatVigenciaDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Sin registrar";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Fecha inválida";

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}
