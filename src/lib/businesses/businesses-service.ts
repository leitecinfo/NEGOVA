/**
 * NEGOVA Businesses & Tenant Management Backend Service
 * 
 * Reglas de Arquitectura:
 * 1. Separación estricta de ámbitos (Platform vs Business).
 * 2. Un negocio representa un Tenant raíz en el ecosistema NEGOVA.
 * 3. Asociación de propietario con rol `owner` en `public.business_users`.
 * 4. Integración con límites y planes canónicos desde `src/config/plans.ts`.
 * 5. Registro forense inmutable en `public.audit_logs`.
 * 6. Validación de matriz de transiciones de estados operacionales.
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
} from "@/config/plans";

export * from "./types";
import {
  BusinessCategory,
  BusinessType,
  BusinessStatus,
  BusinessModel,
  BusinessPlanSummary,
  BusinessOwnerSummary,
  BusinessUserMembership,
  BusinessListFilters,
  BusinessListResult,
  CreateBusinessInput,
  UpdateBusinessInput,
  BUSINESS_CATEGORIES,
  BUSINESS_TYPE_LABELS,
  BUSINESS_STATUS_LABELS,
  VALID_STATUS_TRANSITIONS,
  getCategoryFromBusinessType,
  generateSlug,
} from "./types";

/**
 * Obtener cliente administrativo Supabase (Service Role) con privilegios de backend
 */
async function getSupabaseAdminClient() {
  const { createClient: createAdminClient } = await import("@supabase/supabase-js");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceKey || !supabaseUrl) {
    throw new Error("Credenciales administrativas de Supabase no configuradas.");
  }

  return createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Helper unificado para mapear la suscripción al modelo BusinessPlanSummary
 * garantizando resolución canónica de plan (Inicio, Crece, Negocio),
 * cálculo dinámico de vigencia, días restantes y duración contratada.
 */
function mapSubscriptionToPlanSummary(
  sub: any,
  businessStatus: string = "active",
  businessCreatedAt: string = new Date().toISOString()
): BusinessPlanSummary {
  let planId: PlanId = "inicio";
  const p = sub?.plans as any;
  const rawCode = (p?.code || sub?.plan_id || "").toLowerCase();
  const rawName = (p?.name || "").toLowerCase();

  if (rawCode.includes("crece") || rawName.includes("crece")) {
    planId = "crece";
  } else if (rawCode.includes("negocio") || rawName.includes("negocio")) {
    planId = "negocio";
  } else {
    planId = "inicio";
  }

  const canonical = NEGOVA_PLANS[planId];
  const planName = canonical.name;
  const planCode = canonical.code;
  const currency = p?.currency || "COP";
  const maxUsers = canonical.limits.maxUsers;
  const maxProducts = canonical.limits.maxProducts;

  const isTrial =
    businessStatus === "trial" ||
    sub?.status === "trialing" ||
    sub?.status === "trial" ||
    Boolean(sub?.trial_ends_at && new Date(sub.trial_ends_at) > new Date());

  const startedAt = sub?.started_at || businessCreatedAt;
  const currentPeriodStart = sub?.current_period_start || sub?.trial_starts_at || startedAt;

  let currentPeriodEnd = sub?.current_period_end || null;
  let trialEndsAt = sub?.trial_ends_at || null;

  if (!currentPeriodEnd) {
    const d = new Date(startedAt);
    d.setMonth(d.getMonth() + 1);
    currentPeriodEnd = d.toISOString();
  }

  if (isTrial && !trialEndsAt) {
    const d = new Date(startedAt);
    d.setDate(d.getDate() + 30);
    trialEndsAt = d.toISOString();
  }

  let billingInterval: BillingInterval = "monthly";
  let monthsContracted = 1;
  let contractDuration = 1;

  if (currentPeriodStart && currentPeriodEnd) {
    const startD = new Date(currentPeriodStart);
    const endD = new Date(currentPeriodEnd);
    const diffDays = Math.round(
      (endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays >= 300) {
      billingInterval = "annual";
      contractDuration = Math.max(1, Math.round(diffDays / 365.25));
      monthsContracted = contractDuration * 12;
    } else {
      billingInterval = "monthly";
      contractDuration = Math.max(1, Math.round(diffDays / 30.4375));
      monthsContracted = contractDuration;
    }
  }

  const durationFormatted = isTrial ? "Prueba 30 días" : formatVigenciaDuration(billingInterval, monthsContracted);
  const targetDate = isTrial && trialEndsAt ? trialEndsAt : currentPeriodEnd;
  const remainingDays = calculateRemainingDays(targetDate);
  const trialRemainingDays = isTrial ? remainingDays : null;
  const isExpired = remainingDays <= 0;

  const subscriptionStatus = isTrial
    ? "trial"
    : isExpired && businessStatus === "active"
    ? "past_due"
    : (sub?.status || businessStatus);

  const vigenciaBadge = getVigenciaStatusBadge(remainingDays, subscriptionStatus, isTrial);
  const planPrice = billingInterval === "annual" ? canonical.pricing.annualTotal : canonical.pricing.monthly;
  const currentPrice = isTrial ? 0 : planPrice;

  return {
    planId,
    name: planName,
    code: planCode,
    status: subscriptionStatus,
    price: planPrice,
    planPrice,
    currentPrice,
    currency,
    maxUsers,
    maxProducts,
    billingInterval,
    monthsContracted,
    contractDuration,
    durationFormatted,
    startedAt,
    currentPeriodStart,
    currentPeriodEnd,
    trialStartsAt: isTrial ? startedAt : null,
    trialEndsAt,
    remainingDays,
    trialRemainingDays,
    isExpired,
    isTrial,
    vigenciaBadge,
  };
}

/**
 * 1. CONSULTA PAGINADA Y FILTRADA DEL DIRECTORIO DE NEGOCIOS (TENANTS)
 */
export async function getBusinessesList(filters: BusinessListFilters = {}): Promise<BusinessListResult> {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.max(1, Math.min(100, filters.pageSize || 10));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const adminClient = await getSupabaseAdminClient();

  // 1. Obtener listado de negocios
  let query = adminClient
    .from("businesses")
    .select("*", { count: "exact" });

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.businessType && filters.businessType !== "all") {
    query = query.eq("business_type", filters.businessType);
  }

  const sortBy = filters.sortBy || "created_at";
  const ascending = filters.sortOrder === "asc";
  query = query.order(sortBy, { ascending });

  const { data: dbBusinesses, error: bErr, count: totalCount } = await query;

  if (bErr) {
    console.error("[getBusinessesList Error]:", bErr);
    throw new Error(`Error al consultar negocios: ${bErr.message}`);
  }

  const businessIds = (dbBusinesses || []).map((b) => b.id);

  // 2. Consultar membresías de propietarios y usuarios asociados
  const { data: businessUsers } = await adminClient
    .from("business_users")
    .select(`
      id,
      business_id,
      user_id,
      role_id,
      status,
      users(id, email, profiles(full_name, phone, avatar_url)),
      roles(id, code, name)
    `)
    .in("business_id", businessIds.length > 0 ? businessIds : ["00000000-0000-0000-0000-000000000000"]);

  // Mapear propietarios y conteo de miembros por negocio
  const ownerMap = new Map<string, BusinessOwnerSummary>();
  const userCountMap = new Map<string, number>();

  (businessUsers || []).forEach((bu: any) => {
    const bizId = bu.business_id;
    userCountMap.set(bizId, (userCountMap.get(bizId) || 0) + 1);

    if (bu.roles?.code === "owner" || !ownerMap.has(bizId)) {
      if (bu.users) {
        ownerMap.set(bizId, {
          userId: bu.users.id,
          fullName: bu.users.profiles?.full_name || bu.users.email?.split("@")[0] || "Propietario",
          email: bu.users.email || "",
          phone: bu.users.profiles?.phone || null,
          avatarUrl: bu.users.profiles?.avatar_url || null,
        });
      }
    }
  });



  // 3. Consultar suscripciones activas
  const { data: subscriptions } = await adminClient
    .from("subscriptions")
    .select(`
      id,
      business_id,
      plan_id,
      status,
      started_at,
      current_period_start,
      current_period_end,
      trial_ends_at,
      plans(id, code, name, price, currency, limits)
    `)
    .in("business_id", businessIds.length > 0 ? businessIds : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: false });

  const subMap = new Map<string, any>();
  (subscriptions || []).forEach((sub: any) => {
    if (!subMap.has(sub.business_id)) {
      subMap.set(sub.business_id, sub);
    }
  });

  // 4. Mapear modelos finales
  let mappedBusinesses: BusinessModel[] = (dbBusinesses || []).map((b) => {
    const owner = ownerMap.get(b.id) || null;
    const userCount = userCountMap.get(b.id) || 0;
    const sub = subMap.get(b.id);
    const plan: BusinessPlanSummary = mapSubscriptionToPlanSummary(sub, b.status, b.created_at);

    return {
      id: b.id,
      name: b.name,
      slug: b.slug,
      businessType: (b.business_type || "restaurant") as BusinessType,
      description: b.description || null,
      logoUrl: b.logo_url || null,
      phone: b.phone || null,
      email: b.email || null,
      address: b.address || null,
      city: b.city || null,
      department: b.department || null,
      country: b.country || "CO",
      status: (b.status || "trial") as BusinessStatus,
      timezone: b.timezone || "America/Bogota",
      currency: b.currency || "COP",
      createdAt: b.created_at || new Date().toISOString(),
      updatedAt: b.updated_at || new Date().toISOString(),
      owner,
      plan,
      userCount,
    };
  });

  // 5. Filtro de búsqueda en memoria sobre los campos mapeados (nombre, slug, email, teléfono, ciudad, propietario)
  if (filters.search && filters.search.trim() !== "") {
    const s = filters.search.toLowerCase().trim();
    mappedBusinesses = mappedBusinesses.filter(
      (b) =>
        b.name.toLowerCase().includes(s) ||
        b.slug.toLowerCase().includes(s) ||
        (b.email && b.email.toLowerCase().includes(s)) ||
        (b.phone && b.phone.includes(s)) ||
        (b.city && b.city.toLowerCase().includes(s)) ||
        (b.owner && b.owner.fullName.toLowerCase().includes(s)) ||
        (b.owner && b.owner.email.toLowerCase().includes(s))
    );
  }

  // 6. Estadísticas globales
  const total = mappedBusinesses.length;
  const activeCount = mappedBusinesses.filter((b) => b.status === "active").length;
  const trialCount = mappedBusinesses.filter((b) => b.status === "trial").length;
  const suspendedCount = mappedBusinesses.filter((b) => b.status === "suspended").length;
  const inactiveCount = mappedBusinesses.filter((b) => b.status === "inactive").length;

  const paginated = mappedBusinesses.slice(from, to + 1);
  const totalPages = Math.ceil(total / pageSize) || 1;

  return {
    businesses: paginated,
    total,
    page,
    pageSize,
    totalPages,
    stats: {
      total,
      activeCount,
      trialCount,
      suspendedCount,
      inactiveCount,
    },
  };
}

/**
 * 2. CONSULTAR DETALLE COMPLETO DE UN NEGOCIO (TENANT)
 */
export async function getBusinessDetail(businessId: string): Promise<{
  business: BusinessModel;
  memberships: BusinessUserMembership[];
  auditLogs: any[];
}> {
  const adminClient = await getSupabaseAdminClient();

  // 1. Obtener registro de negocio
  const { data: dbBusiness, error: bErr } = await adminClient
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .single();

  if (bErr || !dbBusiness) {
    throw new Error(`Negocio con ID ${businessId} no encontrado.`);
  }

  // 2. Consultar miembros del equipo (business_users)
  const { data: dbUsers } = await adminClient
    .from("business_users")
    .select(`
      id,
      business_id,
      user_id,
      role_id,
      status,
      invited_at,
      joined_at,
      users(id, email, profiles(full_name, phone, avatar_url)),
      roles(id, code, name)
    `)
    .eq("business_id", businessId);

  let owner: BusinessOwnerSummary | null = null;
  const memberships: BusinessUserMembership[] = (dbUsers || []).map((bu: any) => {
    const fullName = bu.users?.profiles?.full_name || bu.users?.email?.split("@")[0] || "Usuario";
    const roleCode = bu.roles?.code || "auxiliar";
    const roleName = bu.roles?.name || "Auxiliar";

    if (roleCode === "owner" && !owner) {
      owner = {
        userId: bu.users?.id || bu.user_id,
        fullName,
        email: bu.users?.email || "",
        phone: bu.users?.profiles?.phone || null,
        avatarUrl: bu.users?.profiles?.avatar_url || null,
      };
    }

    return {
      id: bu.id,
      userId: bu.user_id,
      fullName,
      email: bu.users?.email || "",
      phone: bu.users?.profiles?.phone || null,
      avatarUrl: bu.users?.profiles?.avatar_url || null,
      roleId: bu.role_id,
      roleCode,
      roleName,
      status: bu.status || "active",
      invitedAt: bu.invited_at,
      joinedAt: bu.joined_at,
    };
  });

  // 3. Consultar suscripción y plan activo
  const { data: sub } = await adminClient
    .from("subscriptions")
    .select(`
      id,
      plan_id,
      status,
      started_at,
      trial_ends_at,
      current_period_start,
      current_period_end,
      plans(id, code, name, price, currency, limits)
    `)
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const plan: BusinessPlanSummary = mapSubscriptionToPlanSummary(sub, dbBusiness.status, dbBusiness.created_at);

  // 4. Consultar eventos de auditoría forense relacionados al negocio
  const { data: logs } = await adminClient
    .from("audit_logs")
    .select("*")
    .or(`business_id.eq.${businessId},entity_id.eq.${businessId}`)
    .order("created_at", { ascending: false })
    .limit(25);

  const businessModel: BusinessModel = {
    id: dbBusiness.id,
    name: dbBusiness.name,
    slug: dbBusiness.slug,
    businessType: (dbBusiness.business_type || "restaurant") as BusinessType,
    description: dbBusiness.description || null,
    logoUrl: dbBusiness.logo_url || null,
    phone: dbBusiness.phone || null,
    email: dbBusiness.email || null,
    address: dbBusiness.address || null,
    city: dbBusiness.city || null,
    department: dbBusiness.department || null,
    country: dbBusiness.country || "CO",
    status: (dbBusiness.status || "trial") as BusinessStatus,
    timezone: dbBusiness.timezone || "America/Bogota",
    currency: dbBusiness.currency || "COP",
    createdAt: dbBusiness.created_at || new Date().toISOString(),
    updatedAt: dbBusiness.updated_at || new Date().toISOString(),
    owner,
    plan,
    userCount: memberships.length,
  };

  return {
    business: businessModel,
    memberships,
    auditLogs: logs || [],
  };
}

/**
 * 3. CREAR NUEVO NEGOCIO / TENANT
 */
export async function createBusiness(
  input: CreateBusinessInput,
  actorId?: string
): Promise<{ success: boolean; business?: BusinessModel; error?: string }> {
  try {
    const adminClient = await getSupabaseAdminClient();

    // 1. Sanitización y validaciones básicas
    const name = input.name?.trim();
    if (!name || name.length < 2) {
      return { success: false, error: "El nombre del negocio debe tener al menos 2 caracteres." };
    }

    // 2. Validación obligatoria del Plan Comercial Canónico
    const planKey = input.planId;
    if (!planKey || !NEGOVA_PLANS[planKey]) {
      return { success: false, error: "Debes seleccionar un plan comercial válido (Inicio, Crece o Negocio)." };
    }

    // 3. Validación obligatoria del Propietario (Owner)
    const ownerUserId = input.ownerUserId?.trim();
    if (!ownerUserId) {
      return { success: false, error: "El negocio requiere un propietario asignado obligatoriamente." };
    }

    const { data: ownerUser } = await adminClient
      .from("users")
      .select("id, email, platform_role, status, profiles(full_name)")
      .eq("id", ownerUserId)
      .maybeSingle();

    if (!ownerUser) {
      return { success: false, error: "El usuario seleccionado como propietario no existe." };
    }

    if (["super_admin", "admin"].includes(ownerUser.platform_role)) {
      return { success: false, error: "Los usuarios de plataforma no pueden ser asignados como propietarios de negocio." };
    }

    let slug = input.slug?.trim() ? generateSlug(input.slug) : generateSlug(name);
    if (!slug) {
      slug = `negocio-${Date.now()}`;
    }

    // Validar unicidad de slug
    const { data: existingSlug } = await adminClient
      .from("businesses")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existingSlug) {
      slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const businessType = input.businessType || "restaurant";
    const status = input.status || "trial";

    // 4. Insertar en public.businesses
    const { data: newBusiness, error: insErr } = await adminClient
      .from("businesses")
      .insert({
        name,
        slug,
        business_type: businessType,
        description: input.description?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim().toLowerCase() || null,
        address: input.address?.trim() || null,
        city: input.city?.trim() || null,
        department: input.department?.trim() || null,
        country: input.country?.trim() || "CO",
        status,
        timezone: "America/Bogota",
        currency: "COP",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insErr || !newBusiness) {
      console.error("[createBusiness Insert Error]:", insErr);
      return { success: false, error: insErr?.message || "No fue posible registrar el negocio." };
    }

    const newBusinessId = newBusiness.id;

    // 5. Crear membresía del Propietario en public.business_users
    const { data: ownerRole } = await adminClient
      .from("roles")
      .select("id")
      .eq("code", "owner")
      .limit(1)
      .maybeSingle();

    const ownerRoleId = ownerRole ? ownerRole.id : "owner";

    const { error: memberErr } = await adminClient.from("business_users").insert({
      business_id: newBusinessId,
      user_id: ownerUserId,
      role_id: ownerRoleId,
      status: "active",
      joined_at: new Date().toISOString(),
    });

    if (memberErr) {
      console.error("[createBusiness Member Error]:", memberErr);
    }

    // 6. Asignar Plan y Suscripción Inicial en public.subscriptions
    const { data: planRow } = await adminClient
      .from("plans")
      .select("id")
      .ilike("code", `%${planKey}%`)
      .limit(1)
      .maybeSingle();

    if (!planRow || !planRow.id) {
      throw new Error(`No se pudo resolver el UUID real del plan comercial: ${planKey}. La base de datos no contiene este plan.`);
    }

    const planIdToUse = planRow.id;
    const billingInterval: BillingInterval = input.billingInterval || "monthly";
    const contractDuration = input.contractDuration || input.monthsContracted || 1;
    const startDateInput = input.startDate ? new Date(input.startDate) : new Date();
    const isTrial = status === "trial";

    const { startDate, endDate } = calculatePeriodDates(startDateInput, billingInterval, contractDuration);
    const trialDays = NEGOVA_PLANS[planKey].trialDays || 30;
    const trialEndsAt = new Date(startDateInput);
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

    const subscriptionStatus = isTrial ? "trialing" : "active";

    const { error: subErr } = await adminClient.from("subscriptions").insert({
      business_id: newBusinessId,
      plan_id: planIdToUse,
      status: subscriptionStatus,
      started_at: startDate,
      current_period_start: startDate,
      current_period_end: endDate,
      trial_ends_at: isTrial ? trialEndsAt.toISOString() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (subErr) {
      console.error("[createBusiness Subscription Error]:", subErr);
      throw new Error(`Fallo al registrar la suscripción inicial: ${subErr.message}`);
    }

    // 7. Registrar evento en auditoría
    try {
      await adminClient.from("audit_logs").insert({
        business_id: newBusinessId,
        user_id: actorId || null,
        action: "create",
        entity_type: "business",
        entity_id: newBusinessId,
        new_data: {
          name,
          slug,
          businessType,
          status,
          planId: planKey,
          subscriptionStatus,
        },
        metadata: {
          event: "business.created",
          created_by_actor: actorId || "system",
          plan_assigned: planKey,
        },
      });
    } catch (auditErr) {
      console.warn("[Audit Log non-fatal error]:", auditErr);
    }

    const detail = await getBusinessDetail(newBusinessId);

    // 8. Enviar correo automático de bienvenida si tenemos el correo
    if (ownerUser.email) {
      try {
        // Idempotencia: Verificar si ya se envió el correo
        const { data: existingEmailLog } = await adminClient
          .from("audit_logs")
          .select("id")
          .eq("action", "notify")
          .eq("entity_type", "email")
          .eq("entity_id", newBusinessId)
          .contains("metadata", { event: "email.welcome_sent" })
          .maybeSingle();

        if (!existingEmailLog) {
          const { sendWelcomeBusinessEmail } = await import("@/lib/email/resend");
          let ownerName = "Propietario";
          if (ownerUser.profiles && (ownerUser.profiles as any).full_name) {
            ownerName = (ownerUser.profiles as any).full_name;
          } else {
            ownerName = ownerUser.email.split("@")[0];
          }

          const emailRes = await sendWelcomeBusinessEmail({
            to: ownerUser.email,
            businessName: name,
            ownerName: ownerName,
          });

          if (!emailRes.success) {
            console.error(`[Welcome Email Failed]: ${emailRes.error}`);
            try {
              await adminClient.from("audit_logs").insert({
                business_id: newBusinessId,
                action: "notify",
                entity_type: "email",
                entity_id: newBusinessId,
                metadata: { event: "email.welcome_failed", error: emailRes.error, email: ownerUser.email },
              });
            } catch {}
          } else {
             try {
              await adminClient.from("audit_logs").insert({
                business_id: newBusinessId,
                action: "notify",
                entity_type: "email",
                entity_id: newBusinessId,
                metadata: { event: "email.welcome_sent", email: ownerUser.email },
              });
            } catch {}
          }
        }
      } catch (emailErr) {
        console.error(`[Welcome Email Exception]:`, emailErr);
      }
    }

    return {
      success: true,
      business: detail.business,
    };
  } catch (err: any) {
    console.error("[createBusiness Exception]:", err);
    return {
      success: false,
      error: err.message || "Error inesperado al crear el negocio.",
    };
  }
}

/**
 * 4. ACTUALIZAR INFORMACIÓN DEL NEGOCIO
 */
export async function updateBusiness(
  businessId: string,
  input: UpdateBusinessInput,
  actorId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = await getSupabaseAdminClient();

    const { data: currentBusiness } = await adminClient
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .single();

    if (!currentBusiness) {
      return { success: false, error: "El negocio no existe." };
    }

    // Si se modifica el slug, validar unicidad
    let finalSlug = currentBusiness.slug;
    if (input.slug && input.slug.trim() !== "" && input.slug !== currentBusiness.slug) {
      finalSlug = generateSlug(input.slug);
      const { data: conflict } = await adminClient
        .from("businesses")
        .select("id")
        .eq("slug", finalSlug)
        .neq("id", businessId)
        .maybeSingle();

      if (conflict) {
        return { success: false, error: `El slug '${finalSlug}' ya está en uso por otro negocio.` };
      }
    }

    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    if (input.name) updatePayload.name = input.name.trim();
    if (input.slug) updatePayload.slug = finalSlug;
    if (input.businessType) updatePayload.business_type = input.businessType;
    if (input.description !== undefined) updatePayload.description = input.description?.trim() || null;
    if (input.phone !== undefined) updatePayload.phone = input.phone?.trim() || null;
    if (input.email !== undefined) updatePayload.email = input.email?.trim().toLowerCase() || null;
    if (input.address !== undefined) updatePayload.address = input.address?.trim() || null;
    if (input.city !== undefined) updatePayload.city = input.city?.trim() || null;
    if (input.department !== undefined) updatePayload.department = input.department?.trim() || null;
    if (input.country !== undefined) updatePayload.country = input.country?.trim() || "CO";
    if (input.timezone) updatePayload.timezone = input.timezone;
    if (input.currency) updatePayload.currency = input.currency;

    const { error: updErr } = await adminClient
      .from("businesses")
      .update(updatePayload)
      .eq("id", businessId);

    if (updErr) throw updErr;

    // Si se actualizó el propietario
    if (input.ownerUserId) {
      const { data: ownerRole } = await adminClient
        .from("roles")
        .select("id")
        .eq("code", "owner")
        .eq("scope", "business")
        .maybeSingle();

      if (ownerRole) {
        // Desasignar rol owner anterior en este negocio si existía
        const { data: prevOwners } = await adminClient
          .from("business_users")
          .select("id, user_id")
          .eq("business_id", businessId)
          .eq("role_id", ownerRole.id);

        for (const prev of prevOwners || []) {
          if (prev.user_id !== input.ownerUserId) {
            // Cambiar su rol a business_admin o eliminar
            await adminClient
              .from("business_users")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", prev.id);
          }
        }

        // Upsert nueva membresía de propietario
        await adminClient.from("business_users").upsert(
          {
            business_id: businessId,
            user_id: input.ownerUserId,
            role_id: ownerRole.id,
            status: "active",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "business_id,user_id" }
        );
      }
    }

    // Auditoría
    await adminClient.from("audit_logs").insert({
      business_id: businessId,
      user_id: actorId || null,
      action: "update",
      entity_type: "business",
      entity_id: businessId,
      old_data: currentBusiness,
      new_data: updatePayload,
      metadata: { event: "business.updated" },
    });

    return { success: true };
  } catch (err: any) {
    console.error("[updateBusiness Error]:", err);
    return { success: false, error: err.message || "Error al actualizar información del negocio." };
  }
}

/**
 * 5. CAMBIAR ESTADO OPERACIONAL DEL NEGOCIO (ACTIVAR / SUSPENDER / DESACTIVAR)
 */
export async function changeBusinessStatus(
  businessId: string,
  newStatus: BusinessStatus,
  reason?: string,
  actorId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = await getSupabaseAdminClient();

    const { data: business } = await adminClient
      .from("businesses")
      .select("id, name, status")
      .eq("id", businessId)
      .single();

    if (!business) {
      return { success: false, error: "Negocio no encontrado." };
    }

    const currentStatus = (business.status || "trial") as BusinessStatus;
    if (currentStatus === newStatus) {
      return { success: true };
    }

    // Validar matriz de transiciones
    const allowed = VALID_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      return {
        success: false,
        error: `Transición de estado no permitida: de '${currentStatus}' a '${newStatus}'.`,
      };
    }

    // Validar que para pasar a estado "active" el comercio cuente con un Propietario (Owner) asignado
    if (newStatus === "active") {
      const { data: ownerMembership } = await adminClient
        .from("business_users")
        .select("id, roles!inner(code)")
        .eq("business_id", businessId)
        .eq("roles.code", "owner")
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (!ownerMembership) {
        return {
          success: false,
          error: "Operación rechazada: Para activar operacionalmente este comercio, debes asignarle un Propietario (Owner) primero.",
        };
      }
    }

    // Actualizar estado en businesses
    const { error: updErr } = await adminClient
      .from("businesses")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", businessId);

    if (updErr) throw updErr;

    // Registrar en auditoría forense
    const eventName =
      newStatus === "active"
        ? "business.activated"
        : newStatus === "suspended"
        ? "business.suspended"
        : "business.deactivated";

    await adminClient.from("audit_logs").insert({
      business_id: businessId,
      user_id: actorId || null,
      action: "status_change",
      entity_type: "business",
      entity_id: businessId,
      old_data: { status: currentStatus },
      new_data: { status: newStatus, reason: reason || null },
      metadata: { event: eventName, changed_by_actor: actorId || "system" },
    });

    return { success: true };
  } catch (err: any) {
    console.error("[changeBusinessStatus Error]:", err);
    return { success: false, error: err.message || "Error al modificar estado del negocio." };
  }
}

/**
 * 6. OBTENER LISTA DE CANDIDATOS A PROPIETARIOS PARA FORMULARIOS
 */
export async function getAvailableOwnersList(): Promise<
  Array<{ id: string; fullName: string; email: string }>
> {
  try {
    const adminClient = await getSupabaseAdminClient();

    // 1. Consultar usuarios activos
    const { data: users, error: usersErr } = await adminClient
      .from("users")
      .select("id, email, platform_role, status")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(200);

    if (usersErr) {
      console.error("[getAvailableOwnersList usersErr]:", usersErr);
      return [];
    }

    // 2. Filtrar únicamente usuarios de negocio (excluyendo platform admins)
    const businessUsers = (users || []).filter(
      (u) => !["super_admin", "admin"].includes(u.platform_role)
    );

    if (businessUsers.length === 0) {
      return [];
    }

    const userIds = businessUsers.map((u) => u.id);

    // 3. Consultar nombres de perfiles
    const { data: profiles, error: profErr } = await adminClient
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    if (profErr) {
      console.warn("[getAvailableOwnersList profErr]:", profErr);
    }

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));

    return businessUsers.map((u) => ({
      id: u.id,
      fullName: profileMap.get(u.id) || u.email?.split("@")[0] || "Usuario",
      email: u.email || "",
    }));
  } catch (err) {
    console.error("[getAvailableOwnersList Error]:", err);
    return [];
  }
}

/**
 * 7. ELIMINAR NEGOCIO / TENANT PERMANENTEMENTE
 */
export async function deleteBusiness(
  businessId: string,
  actorId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = await getSupabaseAdminClient();

    // 1. Verificar existencia
    const { data: business } = await adminClient
      .from("businesses")
      .select("id, name, slug, status")
      .eq("id", businessId)
      .single();

    if (!business) {
      return { success: false, error: "Negocio no encontrado." };
    }

    // 2. Eliminar dependencias directas en cascada segura
    await adminClient.from("business_users").delete().eq("business_id", businessId);
    await adminClient.from("subscriptions").delete().eq("business_id", businessId);

    // 3. Eliminar de la tabla businesses
    const { error: delErr } = await adminClient
      .from("businesses")
      .delete()
      .eq("id", businessId);

    if (delErr) throw delErr;

    // 4. Registrar evento en auditoría forense
    try {
      await adminClient.from("audit_logs").insert({
        business_id: null,
        user_id: actorId || null,
        action: "delete",
        entity_type: "business",
        entity_id: businessId,
        old_data: { id: business.id, name: business.name, slug: business.slug, status: business.status },
        metadata: {
          event: "business.deleted",
          deleted_by_actor: actorId || "system",
        },
      });
    } catch (auditErr) {
      console.warn("[Audit Log non-fatal error]:", auditErr);
    }

    return { success: true };
  } catch (err: any) {
    console.error("[deleteBusiness Error]:", err);
    return { success: false, error: err.message || "Error al eliminar el negocio." };
  }
}

/**
 * 8. RENOVAR O EXTENDER VIGENCIA DE SUSCRIPCIÓN (GESTIÓN MANUAL)
 * Delegada dinámicamente a la fuente canónica de Suscripciones (src/lib/subscriptions/subscriptions-service.ts)
 */
export async function renewOrExtendSubscription(
  businessId: string,
  months: number = 1,
  planId?: PlanId,
  actorId?: string
): Promise<{ success: boolean; error?: string; periodEnd?: string }> {
  const { renewOrExtendSubscription: renewFn } = await import(
    "@/lib/subscriptions/subscriptions-service"
  );
  return await renewFn(businessId, months, planId, actorId);
}



