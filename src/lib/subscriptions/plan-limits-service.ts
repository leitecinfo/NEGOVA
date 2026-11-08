import { createClient as createAdminClient } from "@supabase/supabase-js";
import { CENTRALIZED_PLAN_EMPLOYEE_LIMITS, getPlanMaxEmployees, NEGOVA_PLANS } from "@/config/plans";
// Dynamic import of createClient inside getSupabase to avoid next/headers leakage

export type LimitedResource =
  | "products"
  | "employees"
  | "locations"
  | "registers"
  | "recipes"
  | "sales"
  | "customers";

export interface ResourceLimits {
  products: number;
  employees: number;
  locations: number;
  registers: number;
  recipes: number;
  sales: number;
  customers: number;
}

export const RESOURCE_LABELS: Record<LimitedResource, string> = {
  products: "productos",
  employees: "usuarios",
  locations: "ubicaciones/sucursales",
  registers: "cajas registradoras",
  recipes: "recetas",
  sales: "documentos de venta del mes",
  customers: "clientes",
};

/**
 * Matriz de límites canónicos por plan [SUB-001]
 * Sincronizada con la fuente única de verdad en @/config/plans.ts
 * -1 representa capacidad ilimitada.
 */
export const PLAN_RESOURCE_LIMITS: Record<string, ResourceLimits> = {
  starter: {
    products: 50,
    employees: CENTRALIZED_PLAN_EMPLOYEE_LIMITS.inicio.maxMembers,
    locations: 1,
    registers: 1,
    recipes: 20,
    sales: 300,
    customers: 100,
  },
  inicio: {
    products: 50,
    employees: CENTRALIZED_PLAN_EMPLOYEE_LIMITS.inicio.maxMembers,
    locations: 1,
    registers: 1,
    recipes: 20,
    sales: 300,
    customers: 100,
  },
  professional: {
    products: 200,
    employees: CENTRALIZED_PLAN_EMPLOYEE_LIMITS.crece.maxMembers,
    locations: 3,
    registers: 5,
    recipes: 200,
    sales: 3000,
    customers: 1000,
  },
  crece: {
    products: 200,
    employees: CENTRALIZED_PLAN_EMPLOYEE_LIMITS.crece.maxMembers,
    locations: 3,
    registers: 5,
    recipes: 200,
    sales: 3000,
    customers: 1000,
  },
  avanzado: {
    products: 200,
    employees: CENTRALIZED_PLAN_EMPLOYEE_LIMITS.crece.maxMembers,
    locations: 3,
    registers: 5,
    recipes: 200,
    sales: 3000,
    customers: 1000,
  },
  enterprise: {
    products: -1,
    employees: CENTRALIZED_PLAN_EMPLOYEE_LIMITS.negocio.maxMembers,
    locations: -1,
    registers: -1,
    recipes: -1,
    sales: -1,
    customers: -1,
  },
  negocio: {
    products: 3000,
    employees: CENTRALIZED_PLAN_EMPLOYEE_LIMITS.negocio.maxMembers,
    locations: 1,
    registers: 10,
    recipes: 500,
    sales: 10000,
    customers: 5000,
  },
  pro: {
    products: 3000,
    employees: CENTRALIZED_PLAN_EMPLOYEE_LIMITS.negocio.maxMembers,
    locations: 1,
    registers: 10,
    recipes: 500,
    sales: 10000,
    customers: 5000,
  },
};

export interface CheckPlanLimitResult {
  allowed: boolean;
  resource: LimitedResource;
  resourceLabel: string;
  currentCount: number;
  maxLimit: number;
  isUnlimited: boolean;
  planCode: string;
  planName: string;
  error?: string;
}

export interface ResourceUsageItem {
  resource: LimitedResource;
  label: string;
  current: number;
  limit: number;
  isUnlimited: boolean;
  percentage: number;
}

export interface BusinessPlanOverview {
  planCode: string;
  planName: string;
  resources: Record<LimitedResource, ResourceUsageItem>;
}

async function getSupabase() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (serviceKey && supabaseUrl) {
    return createAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  const { createClient } = await import("@/lib/supabase/server");
  return await createClient();
}

/**
 * Normaliza cualquier identificador o código de plan a la clave canónica del sistema.
 */
export function normalizePlanCode(rawPlan?: string | null): { code: string; name: string } {
  if (!rawPlan) {
    return { code: "starter", name: "Starter" };
  }

  const p = rawPlan.toLowerCase().trim();

  if (
    p.includes("enterprise") ||
    p.includes("negocio") ||
    p.includes("unlimited") ||
    p === "enterprise" ||
    p === "negocio"
  ) {
    return { code: "enterprise", name: "Enterprise" };
  }

  if (
    p.includes("professional") ||
    p.includes("pro") ||
    p.includes("crece") ||
    p.includes("avanzado") ||
    p === "professional" ||
    p === "crece" ||
    p === "avanzado"
  ) {
    return { code: "professional", name: "Profesional" };
  }

  return { code: "starter", name: "Starter" };
}

/**
 * Obtiene el plan activo y límites configurados de un comercio.
 */
export async function getBusinessPlan(businessId: string): Promise<{
  planCode: string;
  planName: string;
  limits: ResourceLimits;
}> {
  const supabase = await getSupabase();

  try {
    const subQuery = supabase.from("subscriptions");
    if (!subQuery || typeof subQuery.select !== "function") {
      const fallback = normalizePlanCode("starter");
      return {
        planCode: fallback.code,
        planName: fallback.name,
        limits: PLAN_RESOURCE_LIMITS.starter,
      };
    }

    let subQueryChain: any = subQuery
      .select("plan_id, status, plans(code, name, limits)")
      .eq("business_id", businessId);

    if (typeof subQueryChain.in === "function") {
      subQueryChain = subQueryChain.in("status", ["active", "trial", "trialing", "past_due"]);
    }
    if (typeof subQueryChain.order === "function") {
      subQueryChain = subQueryChain.order("created_at", { ascending: false });
    }
    if (typeof subQueryChain.limit === "function") {
      subQueryChain = subQueryChain.limit(1);
    }

    const { data: sub } = await (typeof subQueryChain.maybeSingle === "function"
      ? subQueryChain.maybeSingle()
      : subQueryChain);

    if (sub) {
      const rawPlans = sub.plans as any;
      const planData = Array.isArray(rawPlans) ? rawPlans[0] : rawPlans;
      const codeOrId = planData?.code || sub.plan_id || "";
      const normalized = normalizePlanCode(codeOrId);

      const limits =
        PLAN_RESOURCE_LIMITS[normalized.code] || PLAN_RESOURCE_LIMITS.starter;

      return {
        planCode: normalized.code,
        planName: planData?.name || normalized.name,
        limits,
      };
    }
  } catch (err) {
    console.warn("[getBusinessPlan] Error consultando suscripción:", err);
  }

  const fallback = normalizePlanCode("starter");
  return {
    planCode: fallback.code,
    planName: fallback.name,
    limits: PLAN_RESOURCE_LIMITS.starter,
  };
}

/**
 * Helper resiliente para contar filas de forma segura en entornos de prueba y producción.
 */
async function countRows(
  supabase: any,
  table: string,
  applyFilter: (q: any) => any
): Promise<number> {
  try {
    const q = supabase.from(table);
    if (!q || typeof q.select !== "function") return 0;
    const base = q.select("id", { count: "exact", head: true });
    const filtered = applyFilter(base);
    const { count, error } = await filtered;
    return error ? 0 : count || 0;
  } catch {
    return 0;
  }
}

/**
 * Conteo canónico de usuarios activos en un negocio [SUB-USER-COUNT].
 * 
 * Regla de negocio oficial:
 * 1. El propietario ocupa un cupo.
 * 2. Los colaboradores / auxiliares activos vinculados al negocio ocupan cupos.
 * 3. Total de usuarios ocupados = Propietario (1) + Colaboradores activos (N).
 * 4. Invitaciones pendientes ('invited'), cuentas desactivadas ('inactive') o suspendidas ('suspended')
 *    NO se contabilizan como usuarios activos.
 * 5. Cuentas globales desactivadas en public.users NO se contabilizan como usuarios activos.
 * 6. Estricto aislamiento por business_id: nunca contabiliza usuarios de otros negocios.
 */
export async function getBusinessActiveUserCount(businessId: string): Promise<number> {
  const supabase = await getSupabase();
  try {
    const firstEq = supabase
      .from("business_users")
      .select("id, users!inner(id, status)", { count: "exact", head: true })
      .eq("business_id", businessId);

    const secondEq = typeof (firstEq as any)?.eq === "function"
      ? (firstEq as any).eq("status", "active")
      : firstEq;

    const finalQuery = typeof (secondEq as any)?.eq === "function"
      ? (secondEq as any).eq("users.status", "active")
      : secondEq;

    const { count, error } = await finalQuery;

    if (error) {
      console.warn("[getBusinessActiveUserCount] Fallback a conteo de business_users activos:", error);
      const { count: fallbackCount } = await supabase
        .from("business_users")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("status", "active");
      return fallbackCount || 1;
    }

    return count ?? 1;
  } catch (err) {
    console.warn("[getBusinessActiveUserCount] Fallback por error:", err);
    return 1;
  }
}

/**
 * Obtiene el conteo actual de un recurso específico para el comercio.
 */
export async function getResourceCurrentCount(
  businessId: string,
  resource: LimitedResource
): Promise<number> {
  const supabase = await getSupabase();

  switch (resource) {
    case "products": {
      // Regla de Negocio [AUD-005]: Solo los artículos y servicios comerciales consumen cupo del plan.
      // Las materias primas, insumos y materiales internos (product_type === 'ingredient') no se contabilizan.
      try {
        const base = supabase
          .from("products")
          .select("id, metadata", { count: "exact", head: true })
          .eq("business_id", businessId)
          .neq("status", "archived");

        const q = typeof (base as any).or === "function"
          ? (base as any).or("metadata->>product_type.neq.ingredient,metadata->>product_type.is.null")
          : base;

        const { count, error, data } = await q;
        if (!error && typeof count === "number") {
          return count;
        }
        if (Array.isArray(data)) {
          return data.filter((p: any) => (p.metadata as any)?.product_type !== "ingredient").length;
        }
      } catch {
        // Continuar al fallback resiliente
      }

      try {
        const { data: allProds } = await supabase
          .from("products")
          .select("id, metadata")
          .eq("business_id", businessId)
          .neq("status", "archived");

        if (Array.isArray(allProds)) {
          return allProds.filter((p: any) => (p.metadata as any)?.product_type !== "ingredient").length;
        }
      } catch {
        // Ignorar
      }
      return 0;
    }

    case "employees":
      return getBusinessActiveUserCount(businessId);

    case "locations":
      return countRows(supabase, "locations", (q) =>
        q.eq("business_id", businessId).eq("is_active", true)
      );

    case "registers":
      return countRows(supabase, "cash_registers", (q) =>
        q.eq("business_id", businessId).eq("is_active", true)
      );

    case "recipes":
      return countRows(supabase, "recipes", (q) =>
        q.eq("business_id", businessId).neq("status", "archived")
      );

    case "sales": {
      // Conteo de ventas en el mes calendario actual (UTC)
      const now = new Date();
      const firstDayOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

      return countRows(supabase, "business_sale_documents", (q) =>
        q.eq("business_id", businessId).neq("status", "cancelled").gte("created_at", firstDayOfMonth)
      );
    }

    case "customers":
      return countRows(supabase, "customers", (q) =>
        q.eq("business_id", businessId).neq("status", "archived")
      );

    default:
      return 0;
  }
}

/**
 * Valida si el comercio tiene capacidad para crear un recurso dado según su plan activo.
 */
export async function checkPlanLimit(
  businessId: string,
  resource: LimitedResource
): Promise<CheckPlanLimitResult> {
  const planInfo = await getBusinessPlan(businessId);
  const resourceLabel = RESOURCE_LABELS[resource];
  const maxLimit = planInfo.limits[resource] ?? -1;
  const isUnlimited = maxLimit === -1 || maxLimit === Infinity;

  const currentCount = await getResourceCurrentCount(businessId, resource);

  if (isUnlimited) {
    return {
      allowed: true,
      resource,
      resourceLabel,
      currentCount,
      maxLimit,
      isUnlimited: true,
      planCode: planInfo.planCode,
      planName: planInfo.planName,
    };
  }

  const allowed = currentCount < maxLimit;

  if (!allowed) {
    const userBreakdown =
      resource === "employees"
        ? ` (1 propietario + ${Math.max(0, maxLimit - 1)} colaboradores adicionales)`
        : "";

    return {
      allowed: false,
      resource,
      resourceLabel,
      currentCount,
      maxLimit,
      isUnlimited: false,
      planCode: planInfo.planCode,
      planName: planInfo.planName,
      error: `Has alcanzado el límite de ${resourceLabel} en tu plan (${planInfo.planName}). Límite: ${maxLimit}${userBreakdown}. Mejora tu plan para continuar.`,
    };
  }

  return {
    allowed: true,
    resource,
    resourceLabel,
    currentCount,
    maxLimit,
    isUnlimited: false,
    planCode: planInfo.planCode,
    planName: planInfo.planName,
  };
}

/**
 * Lanza una excepción inmediata si el comercio excedió la cuota de su plan para el recurso.
 */
export async function assertPlanLimit(
  businessId: string,
  resource: LimitedResource
): Promise<void> {
  const result = await checkPlanLimit(businessId, resource);
  if (!result.allowed) {
    throw new Error(
      result.error ||
        `Has alcanzado el límite de ${result.resourceLabel} en tu plan. Mejora tu plan para continuar.`
    );
  }
}

/**
 * Devuelve un resumen completo del uso y límites de todos los recursos del comercio.
 */
export async function getBusinessPlanOverview(
  businessId: string
): Promise<BusinessPlanOverview> {
  const planInfo = await getBusinessPlan(businessId);
  const resourcesList: LimitedResource[] = [
    "products",
    "employees",
    "locations",
    "registers",
    "recipes",
    "sales",
    "customers",
  ];

  const resourcesRecord = {} as Record<LimitedResource, ResourceUsageItem>;

  await Promise.all(
    resourcesList.map(async (resKey) => {
      const current = await getResourceCurrentCount(businessId, resKey);
      const limit = planInfo.limits[resKey] ?? -1;
      const isUnlimited = limit === -1 || limit === Infinity;
      const percentage = isUnlimited
        ? 0
        : limit > 0
        ? Math.min(100, Math.round((current / limit) * 100))
        : 100;

      resourcesRecord[resKey] = {
        resource: resKey,
        label: RESOURCE_LABELS[resKey],
        current,
        limit,
        isUnlimited,
        percentage,
      };
    })
  );

  return {
    planCode: planInfo.planCode,
    planName: planInfo.planName,
    resources: resourcesRecord,
  };
}
