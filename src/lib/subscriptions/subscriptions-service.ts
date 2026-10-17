/**
 * NEGOVA Subscriptions Management Backend Service
 * 
 * FUENTE ÚNICA DE VERDAD PARA GESTIÓN DE SUSCRIPCIONES:
 * 1. Plan (src/config/plans.ts) -> Suscripción (src/lib/subscriptions/) -> Negocio (src/lib/businesses/)
 * 2. Unifica el cálculo de vigencias, días restantes, periodos de prueba y renovaciones.
 * 3. Utilizado tanto por el módulo global /admin/suscripciones como por el detalle /admin/negocios/[id].
 * 4. Registro forense inmutable en `public.audit_logs`.
 */

import {
  NEGOVA_PLANS,
  PlanId,
  BillingInterval,
  calculatePeriodDates,
  calculateRemainingDays,
  getVigenciaStatusBadge,
  formatVigenciaDuration,
  formatVigenciaDate,
  VigenciaBadgeInfo,
  PlanLimits,
  COMMERCIAL_PLANS_LIST,
} from "@/config/plans";

export type SubscriptionStatus =
  | "active"
  | "trial"
  | "suspended"
  | "past_due"
  | "canceled"
  | "inactive";

export interface SubscriptionOwnerSummary {
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
}

export interface SubscriptionModel {
  id: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  businessType: string;
  businessStatus: string;
  owner: SubscriptionOwnerSummary | null;
  planId: PlanId;
  planName: string;
  planCode: string;
  price: number; // Precio de lista del plan
  planPrice: number; // Precio regular del plan
  currentPrice: number; // Precio actual durante el periodo ($0 COP si está en prueba)
  currency: string;
  billingInterval: BillingInterval;
  contractDuration: number;
  durationFormatted: string;
  monthsContracted: number;
  status: SubscriptionStatus;
  startedAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  remainingDays: number;
  trialRemainingDays: number | null;
  isExpired: boolean;
  isTrial: boolean;
  vigenciaBadge: VigenciaBadgeInfo;
  limits: PlanLimits;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionFilterParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  planId?: string;
  billingInterval?: string;
  sortBy?: "business_name" | "current_period_end" | "created_at" | "remaining_days";
  sortDirection?: "asc" | "desc";
}

export interface SubscriptionKPIs {
  total: number;
  active: number;
  trial: number;
  expiringSoon: number;
  suspendedOrPastDue: number;
  monthlyEstimatedRevenue: number;
}

export interface SubscriptionsListResult {
  subscriptions: SubscriptionModel[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  kpis: SubscriptionKPIs;
}

/**
 * Cliente Supabase con Service Role para operaciones seguras de backend
 */
async function getSupabaseAdminClient() {
  const { createClient: createAdminClient } = await import("@supabase/supabase-js");
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
 * Normaliza un código de plan a PlanId canónico
 */
export function resolveCanonicalPlanId(planCodeOrId: string | null | undefined): PlanId {
  if (!planCodeOrId) return "inicio";
  const lower = planCodeOrId.toLowerCase();
  if (lower.includes("negocio")) return "negocio";
  if (lower.includes("crece")) return "crece";
  return "inicio";
}

/**
 * 1. OBTENER LISTA PAGINADA Y FILTRADA DE SUSCRIPCIONES GLOBALES CON KPIS
 */
export async function getSubscriptionsList(
  params: SubscriptionFilterParams = {}
): Promise<SubscriptionsListResult> {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.max(1, Math.min(100, params.pageSize || 15));
  const search = params.search?.trim().toLowerCase();
  const statusFilter = params.status?.trim().toLowerCase();
  const planFilter = params.planId?.trim().toLowerCase();
  const intervalFilter = params.billingInterval?.trim().toLowerCase();

  try {
    const adminClient = await getSupabaseAdminClient();

    // 1. Consultar todos los negocios y sus suscripciones
    const { data: businesses, error: bizErr } = await adminClient
      .from("businesses")
      .select("id, name, slug, business_type, status, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (bizErr) throw bizErr;

    const businessList = businesses || [];
    const businessIds = businessList.map((b) => b.id);

    // 2. Consultar suscripciones existentes
    let subscriptionsData: any[] = [];
    if (businessIds.length > 0) {
      const { data: subs, error: subsErr } = await adminClient
        .from("subscriptions")
        .select("*")
        .in("business_id", businessIds);

      if (!subsErr && subs) {
        subscriptionsData = subs;
      }
    }

    // 3. Consultar propietarios de negocios (roles con código 'owner')
    const { data: owners, error: ownersErr } = await adminClient
      .from("business_users")
      .select(`
        business_id,
        user_id,
        roles!inner(code),
        users:user_id(id, email, profiles(full_name, avatar_url, phone))
      `)
      .in("business_id", businessIds)
      .eq("roles.code", "owner");

    if (ownersErr) {
      console.warn("[getSubscriptionsList ownersErr]:", ownersErr);
    }

    const ownerMap = new Map<string, SubscriptionOwnerSummary>();
    (owners || []).forEach((row: any) => {
      const u = row.users;
      const profile = Array.isArray(u?.profiles) ? u.profiles[0] : u?.profiles;
      ownerMap.set(row.business_id, {
        userId: u?.id || row.user_id,
        fullName: profile?.full_name || u?.email?.split("@")[0] || "Propietario",
        email: u?.email || "",
        phone: profile?.phone || null,
        avatarUrl: profile?.avatar_url || null,
      });
    });

    // 4. Mapear cada negocio a un modelo de suscripción completo
    const subByBiz = new Map<string, any>();
    subscriptionsData.forEach((s) => subByBiz.set(s.business_id, s));

    const now = new Date();

    const allModels: SubscriptionModel[] = businessList.map((biz) => {
      const sub = subByBiz.get(biz.id);
      const planId = resolveCanonicalPlanId(sub?.plan_id || sub?.plan_code || "inicio");
      const canonicalPlan = NEGOVA_PLANS[planId] || NEGOVA_PLANS.inicio;

      const rawStatus = (sub?.status || (biz.status === "trial" ? "trial" : biz.status) || "active") as SubscriptionStatus;
      const isTrial = rawStatus === "trial" || biz.status === "trial" || Boolean(sub?.trial_ends_at && new Date(sub.trial_ends_at) > now);
      const subStatus: SubscriptionStatus = isTrial ? "trial" : rawStatus;

      // Fechas de vigencia
      let periodStart = sub?.current_period_start || sub?.trial_starts_at || biz.created_at || now.toISOString();
      let periodEnd = sub?.current_period_end;
      let trialEnd = sub?.trial_ends_at;

      if (!periodEnd) {
        // Fallback canónico: 30 días si trial, o 1 mes si activo
        const defaultDates = calculatePeriodDates(biz.created_at || now, "monthly", 1);
        periodEnd = defaultDates.endDate;
        if (isTrial && !trialEnd) {
          trialEnd = defaultDates.endDate;
        }
      }

      if (isTrial && !trialEnd) {
        trialEnd = periodEnd;
      }

      const targetEndForDays = isTrial && trialEnd ? trialEnd : periodEnd;
      const remainingDays = calculateRemainingDays(targetEndForDays, now);
      const trialRemainingDays = isTrial ? remainingDays : null;
      const isExpired = remainingDays <= 0;

      const vigenciaBadge = getVigenciaStatusBadge(remainingDays, subStatus, isTrial);

      const monthsContracted = sub?.months_contracted || (sub?.billing_interval === "annual" ? 12 : 1);
      const billingInterval: BillingInterval =
        sub?.billing_interval === "annual" || monthsContracted >= 12 ? "annual" : "monthly";

      const planPrice = billingInterval === "annual"
        ? canonicalPlan.pricing.annualTotal
        : canonicalPlan.pricing.monthly;
      const currentPrice = isTrial ? 0 : planPrice;

      return {
        id: sub?.id || `sub-${biz.id}`,
        businessId: biz.id,
        businessName: biz.name,
        businessSlug: biz.slug,
        businessType: biz.business_type,
        businessStatus: biz.status,
        owner: ownerMap.get(biz.id) || null,
        planId,
        planName: canonicalPlan.name,
        planCode: canonicalPlan.code,
        price: planPrice,
        planPrice,
        currentPrice,
        currency: "COP",
        billingInterval,
        contractDuration: billingInterval === "annual" ? Math.round(monthsContracted / 12) : monthsContracted,
        durationFormatted: isTrial ? "Prueba 30 días" : formatVigenciaDuration(billingInterval, monthsContracted),
        monthsContracted,
        status: subStatus,
        startedAt: sub?.started_at || biz.created_at || null,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        trialStartsAt: sub?.trial_starts_at || biz.created_at || null,
        trialEndsAt: trialEnd,
        remainingDays,
        trialRemainingDays,
        isExpired,
        isTrial,
        vigenciaBadge,
        limits: canonicalPlan.limits,
        createdAt: sub?.created_at || biz.created_at,
        updatedAt: sub?.updated_at || biz.updated_at,
      };
    });

    // 5. Calcular KPIs Globales
    let totalRevenue = 0;
    let activeCount = 0;
    let trialCount = 0;
    let expiringCount = 0;
    let suspendedCount = 0;

    allModels.forEach((m) => {
      if (m.status === "active") {
        activeCount++;
        totalRevenue += m.billingInterval === "annual"
          ? NEGOVA_PLANS[m.planId].pricing.annualMonthlyEquivalent
          : NEGOVA_PLANS[m.planId].pricing.monthly;
      }
      if (m.isTrial || m.status === "trial") {
        trialCount++;
      }
      if (m.remainingDays > 0 && m.remainingDays <= 15 && m.status !== "suspended") {
        expiringCount++;
      }
      if (m.status === "suspended" || m.status === "past_due" || m.isExpired) {
        suspendedCount++;
      }
    });

    const kpis: SubscriptionKPIs = {
      total: allModels.length,
      active: activeCount,
      trial: trialCount,
      expiringSoon: expiringCount,
      suspendedOrPastDue: suspendedCount,
      monthlyEstimatedRevenue: totalRevenue,
    };

    // 6. Aplicar Filtros en memoria
    let filtered = allModels;

    if (search) {
      filtered = filtered.filter(
        (m) =>
          m.businessName.toLowerCase().includes(search) ||
          m.businessSlug.toLowerCase().includes(search) ||
          m.owner?.fullName.toLowerCase().includes(search) ||
          m.owner?.email.toLowerCase().includes(search) ||
          m.planName.toLowerCase().includes(search)
      );
    }

    if (statusFilter && statusFilter !== "all") {
      if (statusFilter === "expiring_soon") {
        filtered = filtered.filter((m) => m.remainingDays > 0 && m.remainingDays <= 15);
      } else if (statusFilter === "trial") {
        filtered = filtered.filter((m) => m.isTrial || m.status === "trial");
      } else {
        filtered = filtered.filter((m) => m.status === statusFilter);
      }
    }

    if (planFilter && planFilter !== "all") {
      filtered = filtered.filter((m) => m.planId === planFilter);
    }

    if (intervalFilter && intervalFilter !== "all") {
      filtered = filtered.filter((m) => m.billingInterval === intervalFilter);
    }

    // 7. Ordenamiento
    const sortBy = params.sortBy || "created_at";
    const dir = params.sortDirection === "asc" ? 1 : -1;

    filtered.sort((a, b) => {
      if (sortBy === "business_name") {
        return a.businessName.localeCompare(b.businessName) * dir;
      }
      if (sortBy === "remaining_days") {
        return (a.remainingDays - b.remainingDays) * dir;
      }
      if (sortBy === "current_period_end") {
        const timeA = a.currentPeriodEnd ? new Date(a.currentPeriodEnd).getTime() : 0;
        const timeB = b.currentPeriodEnd ? new Date(b.currentPeriodEnd).getTime() : 0;
        return (timeA - timeB) * dir;
      }
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return (timeA - timeB) * dir;
    });

    // 8. Paginación
    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const offset = (page - 1) * pageSize;
    const paginated = filtered.slice(offset, offset + pageSize);

    return {
      subscriptions: paginated,
      totalCount,
      page,
      pageSize,
      totalPages,
      kpis,
    };
  } catch (err) {
    console.error("[getSubscriptionsList Error]:", err);
    return {
      subscriptions: [],
      totalCount: 0,
      page: 1,
      pageSize,
      totalPages: 1,
      kpis: {
        total: 0,
        active: 0,
        trial: 0,
        expiringSoon: 0,
        suspendedOrPastDue: 0,
        monthlyEstimatedRevenue: 0,
      },
    };
  }
}

/**
 * 2. OBTENER DETALLE DE UNA SUSCRIPCIÓN POR ID O BUSINESS ID
 */
export async function getSubscriptionDetail(
  subscriptionOrBusinessId: string
): Promise<SubscriptionModel | null> {
  const result = await getSubscriptionsList({ pageSize: 100 });
  const found = result.subscriptions.find(
    (s) => s.id === subscriptionOrBusinessId || s.businessId === subscriptionOrBusinessId
  );
  return found || null;
}

/**
 * 3. RENOVAR O EXTENDER VIGENCIA DE SUSCRIPCIÓN (FUENTE ÚNICA DE VERDAD)
 * 
 * Si la suscripción actual sigue vigente (end > now), extiende la fecha agregando los meses contratados.
 * Si ya venció o está inactiva, calcula los meses a partir de la fecha actual (now).
 * Reactiva el comercio automáticamente si estaba suspendido o inactivo.
 */
export async function renewOrExtendSubscription(
  businessIdOrSubId: string,
  months: number = 1,
  planId?: PlanId,
  actorId?: string
): Promise<{ success: boolean; error?: string; periodEnd?: string }> {
  try {
    const adminClient = await getSupabaseAdminClient();

    // 1. Determinar si recibimos un business_id o un subscription_id
    let businessId = businessIdOrSubId;
    const { data: subById } = await adminClient
      .from("subscriptions")
      .select("id, business_id, current_period_end, plan_id, status")
      .eq("id", businessIdOrSubId)
      .maybeSingle();

    if (subById?.business_id) {
      businessId = subById.business_id;
    }

    // 2. Verificar existencia del negocio
    const { data: business } = await adminClient
      .from("businesses")
      .select("id, name, slug, status")
      .eq("id", businessId)
      .single();

    if (!business) {
      return { success: false, error: "Comercio no encontrado para renovar suscripción." };
    }

    // 3. Consultar suscripción actual más reciente
    const { data: currentSub } = await adminClient
      .from("subscriptions")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const now = new Date();
    let baseStartDate = now;
    if (currentSub?.current_period_end) {
      const currentEnd = new Date(currentSub.current_period_end);
      if (currentEnd > now) {
        // Extender a partir del vencimiento actual si aún no ha expirado
        baseStartDate = currentEnd;
      }
    }

    const isAnnual = months >= 12;
    const interval: BillingInterval = isAnnual ? "annual" : "monthly";
    const durationCount = isAnnual ? Math.max(1, Math.round(months / 12)) : months;

    const { startDate: periodStart, endDate: periodEnd } = calculatePeriodDates(
      baseStartDate,
      interval,
      durationCount
    );

    // Resolver plan comercial
    let planIdToUse = currentSub?.plan_id || "inicio";
    if (planId && NEGOVA_PLANS[planId]) {
      const { data: planRow } = await adminClient
        .from("plans")
        .select("id")
        .ilike("code", `%${planId}%`)
        .limit(1)
        .maybeSingle();
      planIdToUse = planRow?.id || planId;
    }

    const payload = {
      plan_id: planIdToUse,
      status: "active",
      billing_interval: interval,
      months_contracted: months,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      trial_ends_at: null,
      updated_at: new Date().toISOString(),
    };

    let updatedSubId = currentSub?.id;

    if (currentSub) {
      const { error: updErr } = await adminClient
        .from("subscriptions")
        .update(payload)
        .eq("id", currentSub.id);
      if (updErr) throw updErr;
    } else {
      const { data: newSub, error: insErr } = await adminClient
        .from("subscriptions")
        .insert({
          business_id: businessId,
          ...payload,
          started_at: periodStart,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      updatedSubId = newSub?.id;
    }

    // 4. Si el negocio no estaba en estado "active", reactivarlo
    if (business.status !== "active") {
      await adminClient
        .from("businesses")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", businessId);
    }

    // 5. Registrar en auditoría forense
    const { logAuditAction } = await import("@/lib/audit/audit-service");
    await logAuditAction({
      action: "update",
      entityType: "subscription",
      entityId: updatedSubId || businessId,
      businessId,
      userId: actorId || null,
      oldData: currentSub ? { period_end: currentSub.current_period_end, status: currentSub.status } : null,
      newData: { period_start: periodStart, period_end: periodEnd, months_added: months, plan: planIdToUse },
      metadata: {
        original_action: "renew_subscription",
        event: "subscription.renewed",
        months_added: months,
        period_start: periodStart,
        period_end: periodEnd,
        renewed_by: actorId || "system",
      },
    });

    // 6. Generar factura automáticamente (Idempotente)
    try {
      const canonicalPlan = resolveCanonicalPlanId(planIdToUse);
      const planConfig = NEGOVA_PLANS[canonicalPlan];
      let amount = interval === "annual" ? planConfig.pricing.annualTotal : planConfig.pricing.monthly;

      if (interval === "annual") {
        try {
          const { getAnnualDiscountConfig } = await import("@/lib/subscriptions/annual-discount-service");
          const discountCfg = await getAnnualDiscountConfig();
          if (discountCfg.isEnabled) {
            amount = amount - (amount * discountCfg.percentage / 100);
          }
        } catch (e) {}
      }

      const { createInvoiceForSubscription } = await import("@/lib/billing/billing-service");
      await createInvoiceForSubscription({
        subscriptionId: updatedSubId || businessId,
        businessId: business.id,
        businessName: business.name,
        businessSlug: business.slug,
        planId: planIdToUse,
        planName: planConfig.name,
        billingInterval: interval,
        amount: amount,
        isTrial: false,
        issuedAt: new Date(periodStart).toISOString(),
        dueDate: new Date(periodEnd).toISOString(),
      });
    } catch (invErr) {
      console.warn("[Invoice Generation warning]:", invErr);
    }

    return { success: true, periodEnd };
  } catch (err: any) {
    console.error("[renewOrExtendSubscription Error]:", err);
    return { success: false, error: err.message || "Error al extender la suscripción." };
  }
}

/**
 * 4. CAMBIAR ESTADO DE LA SUSCRIPCIÓN (ACTIVAR / SUSPENDER / CANCELAR)
 */
export async function changeSubscriptionStatus(
  subscriptionId: string,
  newStatus: SubscriptionStatus,
  reason?: string,
  actorId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = await getSupabaseAdminClient();

    const { data: sub } = await adminClient
      .from("subscriptions")
      .select("id, business_id, status, plan_id")
      .eq("id", subscriptionId)
      .single();

    if (!sub) {
      return { success: false, error: "Suscripción no encontrada." };
    }

    const oldStatus = sub.status;
    if (oldStatus === newStatus) {
      return { success: true };
    }

    // Actualizar suscripción
    const { error: updErr } = await adminClient
      .from("subscriptions")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscriptionId);

    if (updErr) throw updErr;

    // Sincronizar estado en el negocio si es suspended o active
    if (newStatus === "suspended" || newStatus === "active") {
      await adminClient
        .from("businesses")
        .update({
          status: newStatus === "suspended" ? "suspended" : "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.business_id);
    }

    // Registrar auditoría
    const { logAuditAction } = await import("@/lib/audit/audit-service");
    await logAuditAction({
      action: "status_change",
      entityType: "subscription",
      entityId: subscriptionId,
      businessId: sub.business_id,
      userId: actorId || null,
      oldData: { status: oldStatus },
      newData: { status: newStatus, reason: reason || null },
      metadata: {
        original_action: "suspend_subscription",
        event: "subscription.status_changed",
        actor: actorId || "system",
        reason,
      },
    });

    return { success: true };
  } catch (err: any) {
    console.error("[changeSubscriptionStatus Error]:", err);
    return { success: false, error: err.message || "Error al cambiar estado de suscripción." };
  }
}

/**
 * 5. CAMBIAR PLAN DE LA SUSCRIPCIÓN (UPGRADE / DOWNGRADE)
 */
export async function changeSubscriptionPlan(
  subscriptionId: string,
  newPlanId: PlanId,
  actorId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = await getSupabaseAdminClient();

    if (!NEGOVA_PLANS[newPlanId]) {
      return { success: false, error: "Plan inválido seleccionado." };
    }

    const { data: sub } = await adminClient
      .from("subscriptions")
      .select("id, business_id, plan_id, status")
      .eq("id", subscriptionId)
      .single();

    if (!sub) {
      return { success: false, error: "Suscripción no encontrada." };
    }

    // Resolver ID en tabla plans si existe
    let planIdToUse = newPlanId;
    const { data: planRow } = await adminClient
      .from("plans")
      .select("id")
      .ilike("code", `%${newPlanId}%`)
      .limit(1)
      .maybeSingle();

    if (planRow) planIdToUse = planRow.id;

    const { error: updErr } = await adminClient
      .from("subscriptions")
      .update({
        plan_id: planIdToUse,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscriptionId);

    if (updErr) throw updErr;

    // Registrar auditoría
    const { logAuditAction } = await import("@/lib/audit/audit-service");
    await logAuditAction({
      action: "update",
      entityType: "subscription",
      entityId: subscriptionId,
      businessId: sub.business_id,
      userId: actorId || null,
      oldData: { plan_id: sub.plan_id },
      newData: { plan_id: newPlanId },
      metadata: {
        original_action: "change_subscription_plan",
        event: "subscription.plan_changed",
        new_plan: newPlanId,
        actor: actorId || "system",
      },
    });

    return { success: true };
  } catch (err: any) {
    console.error("[changeSubscriptionPlan Error]:", err);
    return { success: false, error: err.message || "Error al cambiar de plan." };
  }
}
