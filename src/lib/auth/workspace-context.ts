import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "./authorization";
import { PlanId, PlanLimits, NEGOVA_PLANS } from "@/config/plans";
import {
  CommercialActivity,
  PlanFeatureKey,
  getDefaultActivitiesForBusinessType,
  normalizeCommercialActivities,
  getEnabledFeaturesForBusiness,
} from "@/config/commercial-activities";

export interface WorkspaceUserContext {
  userId: string;
  userEmail: string;
  businessId: string;
  businessName: string;
  businessStatus: string;
  businessSlug?: string;
  businessCurrency?: string;
  businessTimezone?: string;
  businessType?: string;
  commercialActivities: CommercialActivity[];
  planId: PlanId;
  enabledFeatures: PlanFeatureKey[];
  planLimits: PlanLimits;
  businessSettings?: Record<string, unknown>;
  roleCode: string;
  roleName: string;
  isOwner: boolean;
  isSuperAdmin: boolean;
  isPlatformAdmin?: boolean;
}

/**
 * Resuelve el plan comercial y límites a partir de las suscripciones en base de datos.
 */
async function resolveBusinessPlan(
  supabaseAdmin: any,
  businessId: string
): Promise<{ planId: PlanId; limits: PlanLimits }> {
  try {
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("plan_id, status, plans(id, code, name, limits)")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let planId: PlanId = "inicio";
    const rawCode = (sub?.plans as any)?.code?.toLowerCase() || "";
    const rawName = (sub?.plans as any)?.name?.toLowerCase() || "";
    if (rawCode.includes("crece") || rawName.includes("crece")) {
      planId = "crece";
    } else if (rawCode.includes("negocio") || rawName.includes("negocio")) {
      planId = "negocio";
    }

    const canonical = NEGOVA_PLANS[planId];
    return {
      planId,
      limits: canonical.limits,
    };
  } catch (err) {
    return {
      planId: "inicio",
      limits: NEGOVA_PLANS.inicio.limits,
    };
  }
}


/**
 * Obtener el business_id activo de un usuario a partir de public.business_users.
 * Retorna null si no tiene membresía activa o si el comercio está suspendido/inactivo.
 */
export async function getUserActiveBusinessId(userId: string): Promise<string | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
  if (!isUuid) return null;

  try {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Buscar membresía activa en business_users
    const { data: memberships } = await supabaseAdmin
      .from("business_users")
      .select("business_id, status, businesses(id, status)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!memberships || memberships.length === 0) {
      return null;
    }

    // Priorizar membresías activas
    for (const membership of memberships) {
      if (membership.status !== "inactive" && membership.status !== "disabled" && membership.business_id) {
        const rawBiz = membership.businesses as any;
        const biz = Array.isArray(rawBiz) ? rawBiz[0] : rawBiz;

        if (biz && biz.status !== "inactive" && biz.status !== "suspended") {
          return membership.business_id;
        }

        // Si el join no trajo el status, consultar directamente businesses
        if (!biz) {
          const { data: directBiz } = await supabaseAdmin
            .from("businesses")
            .select("id, status")
            .eq("id", membership.business_id)
            .maybeSingle();

          if (directBiz && directBiz.status !== "inactive" && directBiz.status !== "suspended") {
            return directBiz.id;
          }
        }
      }
    }

    return null;
  } catch (err) {
    console.error("[getUserActiveBusinessId] Error al consultar negocio del usuario:", err);
    return null;
  }
}

/**
 * Validar y obtener el contexto de Workspace para Server Components (Páginas).
 * Si no está autenticado, no existe el negocio, no es miembro o no tiene permisos,
 * redirige de forma segura fuera del recurso.
 */
export async function requireWorkspaceSession(
  businessId: string,
  requiredPermission: string = "business_settings.view"
): Promise<WorkspaceUserContext> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login?error=session_required");
  }

  // Validar formato UUID para evitar inyecciones o identificadores corruptos
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(businessId);
  if (!isUuid) {
    redirect("/login?error=invalid_business");
  }

  const { createClient: createAdminClient } = await import("@supabase/supabase-js");
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // 1. Validar existencia y estado operacional del negocio
  const { data: business, error: bizError } = await supabaseAdmin
    .from("businesses")
    .select("id, name, status, slug, currency, timezone, business_type, commercial_activities, settings")
    .eq("id", businessId)
    .maybeSingle();

  if (bizError || !business) {
    redirect("/login?error=business_not_found");
  }

  if (business.status === "inactive" || business.status === "suspended") {
    redirect("/login?error=business_inactive");
  }

  const businessType = business.business_type || "fast_food";
  const commercialActivities = normalizeCommercialActivities(
    business.commercial_activities || getDefaultActivitiesForBusinessType(businessType)
  );
  const planInfo = await resolveBusinessPlan(supabaseAdmin, businessId);
  const enabledFeatures = getEnabledFeaturesForBusiness({
    businessType,
    commercialActivities,
    planId: planInfo.planId,
  });

  // 2. Verificar rol en plataforma (Super Administrador de NEGOVA tiene acceso administrativo)
  const { data: dbUser } = await supabaseAdmin
    .from("users")
    .select("id, platform_role, status")
    .eq("id", user.id)
    .maybeSingle();

  const isSuperAdmin = dbUser?.platform_role === "super_admin";

  // 3. Verificar membresía directa del usuario en business_users
  const { data: membership } = await supabaseAdmin
    .from("business_users")
    .select("id, status, role_id, roles(id, code, name)")
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .maybeSingle();

  const rawRoleData = membership?.roles as any;
  const roleData = Array.isArray(rawRoleData) ? rawRoleData[0] : rawRoleData;
  const roleCode = roleData?.code || "";
  const roleName = roleData?.name || (isSuperAdmin ? "Super Administrador" : "Sin Rol");
  const isOwner = roleCode === "owner";

  let isDelegatedSupport = false;

  // Si no es miembro activo del negocio:
  if (!membership || membership.status !== "active") {
    if (isSuperAdmin) {
      // El Super Administrador de plataforma cuenta con acceso administrativo general
      isDelegatedSupport = true;
    } else if (["admin", "soporte"].includes(dbUser?.platform_role)) {
      let isGrantValid = false;
      try {
        let requiredScope: "orders_read" | "sales_read" | "inventory_read" | "finance_read" | "settings_read" = "settings_read";
        if (requiredPermission?.startsWith("sales.")) requiredScope = "sales_read";
        else if (requiredPermission?.startsWith("orders.")) requiredScope = "orders_read";
        else if (requiredPermission?.startsWith("inventory.") || requiredPermission?.startsWith("products.")) requiredScope = "inventory_read";
        else if (requiredPermission?.startsWith("finance.") || requiredPermission?.startsWith("expenses.")) requiredScope = "finance_read";

        const { validateActiveGrant } = await import("@/lib/support/delegated-access-service");
        const grantCheck = await validateActiveGrant({
          businessId,
          adminUserId: user.id,
          requiredScope,
        });
        isGrantValid = Boolean(grantCheck?.valid);
      } catch (grantErr) {
        console.error("[validateActiveGrant error]:", grantErr);
        isGrantValid = false;
      }

      if (isGrantValid) {
        isDelegatedSupport = true;
      } else {
        redirect("/login?error=workspace_unauthorized_no_grant");
      }
    } else {
      redirect("/login?error=workspace_unauthorized");
    }
  }

  // 4. Verificar compatibilidad de actividades comerciales, vertical y permisos RBAC
  if (requiredPermission && requiredPermission !== "none") {
    // 4.1 Validar actividad comercial requerida
    if (requiredPermission.startsWith("products.") || requiredPermission.startsWith("inventory.")) {
      if (!commercialActivities.includes("sell_products")) {
        redirect(`/login?error=workspace_forbidden_activity`);
      }
    } else if (requiredPermission.startsWith("services.")) {
      if (!commercialActivities.includes("provide_services")) {
        redirect(`/login?error=workspace_forbidden_activity`);
      }
    } else if (requiredPermission.startsWith("appointments.")) {
      if (!commercialActivities.includes("manage_appointments") || !commercialActivities.includes("provide_services")) {
        redirect(`/login?error=workspace_forbidden_activity`);
      }
    } else if (requiredPermission.startsWith("sales.")) {
      if (!planInfo.limits.canUsePos) {
        redirect(`/login?error=workspace_plan_upgrade_pos`);
      }
    }

    const { isPermissionCompatibleWithBusinessType } = await import("./permissions");
    if (!isPermissionCompatibleWithBusinessType(requiredPermission, businessType)) {
      redirect(`/login?error=workspace_forbidden_vertical`);
    }

    if (!isOwner && !isSuperAdmin) {
      const allowed = await hasPermission(user.id, requiredPermission, {
        scope: "business",
        businessId,
      });

      if (!allowed) {
        redirect(`/login?error=workspace_forbidden`);
      }
    }
  }

  return {
    userId: user.id,
    userEmail: user.email || "",
    businessId: business.id,
    businessName: business.name,
    businessStatus: business.status,
    businessSlug: business.slug || "",
    businessCurrency: business.currency || "COP",
    businessTimezone: business.timezone || "America/Bogota",
    businessType,
    commercialActivities,
    planId: planInfo.planId,
    enabledFeatures,
    planLimits: planInfo.limits,
    businessSettings: (business.settings as Record<string, unknown>) || {},
    roleCode,
    roleName,
    isOwner,
    isSuperAdmin,
    isPlatformAdmin: dbUser?.platform_role === "super_admin" || dbUser?.platform_role === "admin",
  };
}

/**
 * Validar autorización estricta para Server Actions de Workspace.
 * Devuelve un objeto con éxito/error sin provocar redirecciones HTTP imprevistas.
 */
export async function verifyWorkspaceAction(
  businessId: string,
  requiredPermission: string = "business_settings.update"
): Promise<{
  success: boolean;
  error?: string;
  context?: WorkspaceUserContext;
}> {
  // 1. Validar formato UUID antes de cualquier operación
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(businessId);
  if (!isUuid) {
    return { success: false, error: "Identificador de negocio inválido." };
  }

  try {
    let user;
    try {
      const supabase = await createClient();
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !authUser) {
        return { success: false, error: "No autenticado. Por favor inicie sesión." };
      }
      user = authUser;
    } catch {
      return { success: false, error: "Sesión no autenticada o fuera de contexto." };
    }

    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: business, error: bizError } = await supabaseAdmin
      .from("businesses")
      .select("id, name, status, business_type, commercial_activities, settings")
      .eq("id", businessId)
      .maybeSingle();

    if (bizError || !business) {
      return { success: false, error: "El comercio especificado no existe." };
    }

    if (business.status === "inactive" || business.status === "suspended") {
      return { success: false, error: "El comercio se encuentra inactivo o suspendido." };
    }

    const businessType = business.business_type || "fast_food";
    const commercialActivities = normalizeCommercialActivities(
      business.commercial_activities || getDefaultActivitiesForBusinessType(businessType)
    );
    const planInfo = await resolveBusinessPlan(supabaseAdmin, businessId);
    const enabledFeatures = getEnabledFeaturesForBusiness({
      businessType,
      commercialActivities,
      planId: planInfo.planId,
    });

    const { data: dbUser } = await supabaseAdmin
      .from("users")
      .select("platform_role")
      .eq("id", user.id)
      .maybeSingle();

    const isSuperAdmin = dbUser?.platform_role === "super_admin";

    const { data: membership } = await supabaseAdmin
      .from("business_users")
      .select("id, status, role_id, roles(id, code, name)")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .maybeSingle();

    const rawRoleData = membership?.roles as any;
    const roleData = Array.isArray(rawRoleData) ? rawRoleData[0] : rawRoleData;
    const roleCode = roleData?.code || (isSuperAdmin ? "super_admin" : "");
    const roleName = roleData?.name || (isSuperAdmin ? "Super Administrador" : "");
    const isOwner = roleCode === "owner";

    if (!membership || membership.status !== "active") {
      return {
        success: false,
        error: "Acceso denegado: no tienes una membresía activa en este comercio.",
      };
    }

    // 2. Validación de actividades comerciales, vertical y permisos RBAC
    if (requiredPermission && requiredPermission !== "none") {
      if (requiredPermission.startsWith("products.") || requiredPermission.startsWith("inventory.")) {
        if (!commercialActivities.includes("sell_products")) {
          return {
            success: false,
            error: "La venta de productos no está habilitada en la configuración de este comercio.",
          };
        }
      } else if (requiredPermission.startsWith("services.")) {
        if (!commercialActivities.includes("provide_services")) {
          return {
            success: false,
            error: "La prestación de servicios no está habilitada en la configuración de este comercio.",
          };
        }
      } else if (requiredPermission.startsWith("appointments.")) {
        if (!commercialActivities.includes("manage_appointments") || !commercialActivities.includes("provide_services")) {
          return {
            success: false,
            error: "La gestión de citas no está habilitada en la configuración de este comercio.",
          };
        }
      } else if (requiredPermission.startsWith("sales.")) {
        if (!planInfo.limits.canUsePos) {
          return {
            success: false,
            error: "El punto de venta (POS) no está habilitado en el plan de este comercio.",
          };
        }
      }

      const { isPermissionCompatibleWithBusinessType } = await import("./permissions");
      if (!isPermissionCompatibleWithBusinessType(requiredPermission, businessType)) {
        return {
          success: false,
          error: "Operación no disponible o incompatible con el tipo de negocio del comercio.",
        };
      }

      if (!isOwner) {
        const allowed = await hasPermission(user.id, requiredPermission, {
          scope: "business",
          businessId,
        });

        if (!allowed) {
          return {
            success: false,
            error: "Permisos insuficientes para realizar esta operación en el comercio.",
          };
        }
      }
    }

    return {
      success: true,
      context: {
        userId: user.id,
        userEmail: user.email || "",
        businessId: business.id,
        businessName: business.name,
        businessStatus: business.status,
        businessType,
        commercialActivities,
        planId: planInfo.planId,
        enabledFeatures,
        planLimits: planInfo.limits,
        businessSettings: (business.settings as Record<string, unknown>) || {},
        roleCode,
        roleName,
        isOwner,
        isSuperAdmin,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Error al verificar autorización de workspace.",
    };
  }
}
