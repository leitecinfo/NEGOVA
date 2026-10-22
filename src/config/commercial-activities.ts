/**
 * NEGOVA — ARQUITECTURA DE ACTIVIDADES COMERCIALES Y FUNCIONALIDADES
 * 
 * Separa formalmente:
 * 1. Tipo de Negocio (business_type): Identidad y sector del negocio (fast_food, barbershop, retail, etc.)
 * 2. Actividades Comerciales (commercial_activities): Lo que el negocio realmente hace (vender productos, prestar servicios, agendar citas)
 * 3. Funcionalidades por Plan (plan_features): Lo que la suscripción permite usar (POS, inventario, reportes avanzados, etc.)
 */

import { PlanId, NEGOVA_PLANS } from "./plans";

// ============================================================================
// 1. ACTIVIDADES COMERCIALES (COMMERCIAL ACTIVITIES)
// ============================================================================

export type CommercialActivity =
  | "sell_products"         // Venta de productos físicos o gastronómicos
  | "provide_services"      // Prestación de servicios profesionales/técnicos
  | "manage_appointments";  // Gestión de citas y agenda (coherente con servicios)

export interface CommercialActivityDefinition {
  id: CommercialActivity;
  label: string;
  description: string;
  iconName: string;
  requiresServiceContext?: boolean; // Para citas: requiere que 'provide_services' esté habilitado
}

export const COMMERCIAL_ACTIVITIES: Record<CommercialActivity, CommercialActivityDefinition> = {
  sell_products: {
    id: "sell_products",
    label: "Venta de productos",
    description: "Comercialización de artículos físicos, insumos, alimentos o preparaciones gastronómicas.",
    iconName: "Package",
  },
  provide_services: {
    id: "provide_services",
    label: "Prestación de servicios",
    description: "Atención por servicios profesionales, estética, reparaciones, consultoría o mano de obra.",
    iconName: "Sparkles",
  },
  manage_appointments: {
    id: "manage_appointments",
    label: "Gestión de citas y reservas",
    description: "Programación de turnos y agenda para los servicios ofrecidos por el comercio.",
    iconName: "Calendar",
    requiresServiceContext: true,
  },
};

// ============================================================================
// 2. FUNCIONALIDADES DEL SISTEMA (PLAN FEATURES)
// ============================================================================

export type PlanFeatureKey =
  | "products"            // Catálogo de productos
  | "services"            // Catálogo y tarifas de servicios
  | "appointments"        // Agenda de citas
  | "pos"                 // Punto de venta y emisión de recibos
  | "inventory"           // Control de existencias, kardex y alertas
  | "variants_modifiers"  // Modificadores de cocina y variantes de producto
  | "advanced_reports"    // Informes financieros y analítica avanzada
  | "credit_and_debts"    // Control de fiados y cartera
  | "multiple_roles"      // Asignación de roles personalizados
  | "ai_assistant";       // Consultas al asistente inteligente NEGOVA AI

export interface PlanFeatureDefinition {
  key: PlanFeatureKey;
  name: string;
  description: string;
  requiredActivity?: CommercialActivity; // Actividad comercial necesaria para activar el módulo
}

export const PLAN_FEATURES: Record<PlanFeatureKey, PlanFeatureDefinition> = {
  products: {
    key: "products",
    name: "Catálogo de productos",
    description: "Gestión de productos, categorías, precios y fotos.",
    requiredActivity: "sell_products",
  },
  services: {
    key: "services",
    name: "Gestión de servicios",
    description: "Registro de servicios, tarifas y duraciones estimadas.",
    requiredActivity: "provide_services",
  },
  appointments: {
    key: "appointments",
    name: "Gestión de citas",
    description: "Agenda y programación de turnos vinculada a los servicios.",
    requiredActivity: "manage_appointments",
  },
  pos: {
    key: "pos",
    name: "Punto de Venta (POS)",
    description: "Cobro rápido, comandas, recibos de venta y caja.",
  },
  inventory: {
    key: "inventory",
    name: "Inventario y existencias",
    description: "Kardex, stock mínimo, alertas de reposición y costeo.",
    requiredActivity: "sell_products",
  },
  variants_modifiers: {
    key: "variants_modifiers",
    name: "Variantes y adicionales",
    description: "Opciones de preparación, adicionales de cocina, tallas o presentaciones.",
    requiredActivity: "sell_products",
  },
  advanced_reports: {
    key: "advanced_reports",
    name: "Reportes avanzados",
    description: "Márgenes, rentabilidad por producto/servicio y exportación a Excel/PDF.",
  },
  credit_and_debts: {
    key: "credit_and_debts",
    name: "Control de fiados",
    description: "Cartera de clientes, cuentas por cobrar y abonos.",
  },
  multiple_roles: {
    key: "multiple_roles",
    name: "Roles personalizados",
    description: "Permisos granulares para múltiples colaboradores.",
  },
  ai_assistant: {
    key: "ai_assistant",
    name: "NEGOVA AI",
    description: "Consultas en lenguaje natural sobre ventas y productos.",
  },
};

// ============================================================================
// 3. MATRIZ DE FUNCIONALIDADES POR PLAN
// ============================================================================

export const PLAN_FEATURES_MATRIX: Record<PlanId, Record<PlanFeatureKey, boolean>> = {
  inicio: {
    products: true,
    services: true,
    appointments: true,
    pos: true,
    inventory: true,           // Existencias básicas
    variants_modifiers: true,  // Permitido para gastronomía y operaciones básicas
    advanced_reports: false,
    credit_and_debts: false,
    multiple_roles: false,
    ai_assistant: false,
  },
  crece: {
    products: true,
    services: true,
    appointments: true,
    pos: true,
    inventory: true,
    variants_modifiers: true,
    advanced_reports: true,
    credit_and_debts: true,
    multiple_roles: false,
    ai_assistant: true,
  },
  negocio: {
    products: true,
    services: true,
    appointments: true,
    pos: true,
    inventory: true,
    variants_modifiers: true,
    advanced_reports: true,
    credit_and_debts: true,
    multiple_roles: true,
    ai_assistant: true,
  },
};

// ============================================================================
// 4. INFERENCIA Y CONFIGURACIÓN PREDETERMINADA SEGÚN TIPO DE NEGOCIO
// ============================================================================

/**
 * Determina las actividades comerciales predeterminadas según el tipo de negocio.
 * Garantiza que:
 * - Restaurante / comida rápida -> solo vender productos.
 * - Tienda / comercio minorista -> solo vender productos.
 * - Barbería / salón de belleza / spa -> prestar servicios y citas.
 * - Odontología / salud -> prestar servicios y citas.
 * - Híbrido -> explícitamente configurable sin forzar dos cuentas separadas.
 */
export function getDefaultActivitiesForBusinessType(businessType?: string | null): CommercialActivity[] {
  if (!businessType) return ["sell_products"];
  const b = businessType.trim().toLowerCase();

  // 1. Servicios con cita (Barberías, peluquerías, spas, odontología, estética, consultorías)
  if (
    b.includes("barber") ||
    b.includes("peluquer") ||
    b.includes("salon") ||
    b.includes("spa") ||
    b.includes("odontol") ||
    b.includes("dentist") ||
    b.includes("estetic") ||
    b.includes("belleza") ||
    b.includes("health") ||
    b.includes("salud") ||
    b.includes("consult") ||
    b.includes("technical_service") ||
    b.includes("talleres") ||
    b.includes("automotive") ||
    b === "service" ||
    b.startsWith("service_")
  ) {
    return ["provide_services", "manage_appointments"];
  }

  // 2. Gastronómicos (Exclusivamente venta de productos gastronómicos)
  if (
    b.includes("rest") ||
    b.includes("food") ||
    b.includes("comida") ||
    b.includes("gastronom") ||
    b.includes("cafe") ||
    b === "bar" ||
    b.includes("gastrobar") ||
    b.includes("pizz") ||
    b.includes("baker") ||
    b.includes("panad") ||
    b.includes("helad") ||
    b.includes("ice_cream") ||
    b.includes("liquor")
  ) {
    return ["sell_products"];
  }

  // 3. Comercio minorista (Exclusivamente venta de productos)
  if (
    b.includes("retail") ||
    b.includes("tienda") ||
    b.includes("ferret") ||
    b.includes("hardware") ||
    b.includes("moda") ||
    b.includes("fashion") ||
    b.includes("pharmacy") ||
    b.includes("farmacia") ||
    b.includes("stationery") ||
    b.includes("papeleria") ||
    b.includes("minimarket") ||
    b.includes("supermarket") ||
    b.includes("pets")
  ) {
    return ["sell_products"];
  }

  // Fallback estándar
  return ["sell_products"];
}

// ============================================================================
// 5. EVALUACIÓN Y VALIDACIÓN DE ACCESO A FUNCIONALIDADES
// ============================================================================

export interface BusinessFeatureContext {
  businessType: string;
  commercialActivities: CommercialActivity[];
  planId: PlanId;
  featureOverrides?: Partial<Record<PlanFeatureKey, boolean>>;
}

/**
 * Valida si una actividad comercial está habilitada en el negocio.
 */
export function hasCommercialActivity(
  activities: CommercialActivity[] | undefined | null,
  activity: CommercialActivity
): boolean {
  if (!activities || !Array.isArray(activities)) return false;
  return activities.includes(activity);
}

/**
 * Normaliza y valida una lista de actividades comerciales.
 * Si contiene 'manage_appointments', garantiza la coherencia asegurando que 'provide_services' esté activo.
 */
export function normalizeCommercialActivities(
  activities: CommercialActivity[] | undefined | null
): CommercialActivity[] {
  if (!activities || !Array.isArray(activities) || activities.length === 0) {
    return ["sell_products"];
  }

  const unique = Array.from(new Set(activities));

  // Regla de coherencia: Si tiene citas pero no servicios, se añade servicios
  if (unique.includes("manage_appointments") && !unique.includes("provide_services")) {
    unique.push("provide_services");
  }

  return unique;
}

/**
 * Evalúa si una funcionalidad está activa para un negocio teniendo en cuenta:
 * 1. La actividad comercial del negocio (¿el negocio realiza esta actividad?).
 * 2. El plan de suscripción contratado (¿el plan incluye esta función?).
 * 3. Sobrescrituras o complementos autorizados para el comercio.
 */
export function isFeatureAllowedForBusiness(
  ctx: BusinessFeatureContext,
  featureKey: PlanFeatureKey
): {
  allowed: boolean;
  reason?: "activity_disabled" | "plan_upgrade_required" | "ok";
  message?: string;
} {
  const featDef = PLAN_FEATURES[featureKey];
  if (!featDef) {
    return { allowed: false, reason: "activity_disabled", message: "Funcionalidad no reconocida." };
  }

  // 1. Validar actividad comercial requerida
  if (featDef.requiredActivity) {
    const hasActivity = hasCommercialActivity(ctx.commercialActivities, featDef.requiredActivity);
    if (!hasActivity) {
      const actDef = COMMERCIAL_ACTIVITIES[featDef.requiredActivity];
      return {
        allowed: false,
        reason: "activity_disabled",
        message: `Esta función requiere habilitar la actividad comercial «${actDef?.label || featDef.requiredActivity}» en los ajustes del negocio.`,
      };
    }
  }

  // Citas requieren coherencia con servicios
  if (featureKey === "appointments") {
    if (!hasCommercialActivity(ctx.commercialActivities, "provide_services")) {
      return {
        allowed: false,
        reason: "activity_disabled",
        message: "La gestión de citas forma parte de una solución de servicios y requiere habilitar «Prestación de servicios».",
      };
    }
  }

  // 2. Comprobar sobrescritura explícita
  if (ctx.featureOverrides && ctx.featureOverrides[featureKey] !== undefined) {
    if (ctx.featureOverrides[featureKey] === true) {
      return { allowed: true, reason: "ok" };
    }
    return {
      allowed: false,
      reason: "plan_upgrade_required",
      message: "Esta funcionalidad está restringida para este comercio.",
    };
  }

  // 3. Validar plan de suscripción
  const planMatrix = PLAN_FEATURES_MATRIX[ctx.planId] || PLAN_FEATURES_MATRIX.inicio;
  const isIncludedInPlan = Boolean(planMatrix[featureKey]);

  if (!isIncludedInPlan) {
    const planName = NEGOVA_PLANS[ctx.planId]?.name || ctx.planId;
    return {
      allowed: false,
      reason: "plan_upgrade_required",
      message: `Esta funcionalidad no está incluida en tu plan actual (${planName}). Mejora tu plan para acceder a ella.`,
    };
  }

  return { allowed: true, reason: "ok" };
}

/**
 * Obtiene el conjunto de funcionalidades habilitadas para un negocio.
 */
export function getEnabledFeaturesForBusiness(ctx: BusinessFeatureContext): PlanFeatureKey[] {
  const allFeatures = Object.keys(PLAN_FEATURES) as PlanFeatureKey[];
  return allFeatures.filter((f) => isFeatureAllowedForBusiness(ctx, f).allowed);
}

/**
 * Obtiene la etiqueta del catálogo según las actividades habilitadas:
 * - Solo productos -> "Productos" (o "Menú" si es gastronómico)
 * - Solo servicios -> "Servicios"
 * - Ambos (híbrido) -> "Productos y servicios"
 */
export function getCatalogModuleLabel(
  activities: CommercialActivity[],
  businessType?: string | null
): string {
  const hasProd = hasCommercialActivity(activities, "sell_products");
  const hasServ = hasCommercialActivity(activities, "provide_services");

  if (hasProd && hasServ) {
    return "Productos y servicios";
  }
  if (hasServ) {
    return "Servicios";
  }

  // Solo productos / inventario
  return "Inventario";
}
