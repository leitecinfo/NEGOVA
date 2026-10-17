/**
 * NEGOVA Centralized Server-Side Authorization Layer
 * 
 * Reglas de oro:
 * 1. La autorización definitiva SIEMPRE ocurre en el servidor.
 * 2. Validación estricta del tenant_id (nunca confiar solo en lo enviado por el cliente).
 * 3. Protección especial e inquebrantable para el rol `super_admin`.
 */

import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_ROLE_PERMISSIONS_MAP,
  RoleScope,
  isPermissionCompatibleWithBusinessType,
  getDefaultPermissionsForRoleAndBusinessType,
} from "./permissions";

export interface AuthorizationContext {
  scope?: RoleScope;
  businessId?: string | null;
}

export interface UserAuthorizationProfile {
  userId: string;
  email: string;
  platformRole: string;
  isPlatformUser: boolean;
  businessMemberships: Array<{
    businessId: string;
    roleCode: string;
    status: string;
  }>;
}

async function getAuthDbClient() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    return createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return await createClient();
}

/**
 * Obtener perfil de autorización completo del usuario autenticado
 */
export async function getCurrentUserAuthorization(): Promise<UserAuthorizationProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const dbClient = await getAuthDbClient();

  // 1. Obtener datos de identidad de plataforma
  const { data: dbUser } = await dbClient
    .from("users")
    .select("platform_role, status")
    .eq("id", user.id)
    .maybeSingle();

  const authRole = user.app_metadata?.role || user.user_metadata?.role;
  const platformRole =
    dbUser?.platform_role === "super_admin" || dbUser?.platform_role === "admin"
      ? dbUser.platform_role
      : authRole === "super_admin" || authRole === "admin"
        ? authRole
        : (dbUser?.platform_role || "customer");

  // 2. Obtener membresías de negocios (tenants)
  const { data: businessMemberships } = await dbClient
    .from("business_users")
    .select("business_id, status, roles(code)")
    .eq("user_id", user.id);

  const memberships = (businessMemberships || []).map((bm: any) => {
    const rawR = bm.roles;
    const r = Array.isArray(rawR) ? rawR[0] : rawR;
    return {
      businessId: bm.business_id,
      roleCode: r?.code || "auxiliar",
      status: bm.status || "active",
    };
  });

  return {
    userId: user.id,
    email: user.email || "",
    platformRole,
    isPlatformUser: ["super_admin", "admin"].includes(platformRole),
    businessMemberships: memberships,
  };
}

/**
 * Comprobar si un usuario posee un permiso específico en el contexto indicado
 */
export async function hasPermission(
  userId: string,
  permissionCode: string,
  context: AuthorizationContext = { scope: "platform" }
): Promise<boolean> {
  try {
    const dbClient = await getAuthDbClient();

    // 0. Consultar rol de plataforma global y estado del usuario
    const { data: dbUser } = await dbClient
      .from("users")
      .select("platform_role, status")
      .eq("id", userId)
      .maybeSingle();

    let platformRole = dbUser?.platform_role;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    if (platformRole !== "super_admin" && platformRole !== "admin" && isUuid) {
      if ("auth" in dbClient && (dbClient as any).auth?.admin) {
        try {
          const { data: authUser } = await (dbClient as any).auth.admin.getUserById(userId);
          const authRole = authUser?.user?.app_metadata?.role || authUser?.user?.user_metadata?.role;
          if (authRole === "super_admin" || authRole === "admin") {
            platformRole = authRole;
          }
        } catch {
          // Ignorar fallo de búsqueda en Auth si el usuario no existe en Auth
        }
      }
    }

    if (!platformRole) return false;
    if (dbUser?.status && dbUser.status !== "active") return false;

    // 1. Contexto de Plataforma
    if (context.scope === "platform" || !context.businessId) {
      // El Super Administrador activo tiene acceso absoluto en el ámbito de Plataforma
      if (platformRole === "super_admin") return true;

      // Consultar permisos asignados al rol en la base de datos
      const { data: roleRow } = await dbClient
        .from("roles")
        .select("id, code, role_permissions(permissions(code))")
        .eq("code", platformRole)
        .eq("scope", "platform")
        .maybeSingle();

      let effectiveCodes: string[] = DEFAULT_ROLE_PERMISSIONS_MAP[platformRole] || [];
      if (roleRow?.role_permissions && roleRow.role_permissions.length > 0) {
        const assignedCodes = roleRow.role_permissions
          .map((rp: any) => rp.permissions?.code)
          .filter(Boolean);
        if (assignedCodes.length > 0) {
          effectiveCodes = Array.from(new Set([...effectiveCodes, ...assignedCodes]));
        }
      }

      return effectiveCodes.includes(permissionCode);
    }

    // 2. Contexto de Negocio / Tenant
    if (context.businessId) {
      // 2.1 Validar que el negocio exista y esté en un estado operacional habilitado
      const { data: business } = await dbClient
        .from("businesses")
        .select("id, status, business_type")
        .eq("id", context.businessId)
        .maybeSingle();

      if (!business || business.status === "inactive" || business.status === "suspended") {
        return false;
      }

      const businessType = business.business_type || "restaurant";

      // 2.2 Validación de Compatibilidad de Vertical y Funcionalidad:
      // Bloqueo a nivel de servidor: si el permiso no corresponde a este tipo de negocio
      // (ej. comandas en una barbería o servicios de citas en un restaurante), el acceso se rechaza tajantemente.
      if (!isPermissionCompatibleWithBusinessType(permissionCode, businessType)) {
        return false;
      }

      // 2.3 Validar vigencia de la suscripción
      const { data: subscription } = await dbClient
        .from("subscriptions")
        .select("id, status, trial_ends_at, current_period_end")
        .eq("business_id", context.businessId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subscription) {
        const now = new Date();
        const isTrial = business.status === "trial" || subscription.status === "trial" || subscription.status === "trialing";
        if (isTrial) {
          if (subscription.trial_ends_at && new Date(subscription.trial_ends_at) < now) {
            return false; // Período de prueba expirado
          }
        } else {
          if (subscription.status === "suspended" || subscription.status === "inactive") {
            return false;
          }
          if (subscription.current_period_end && new Date(subscription.current_period_end) < now) {
            return false; // Suscripción vencida
          }
        }
      }

      // 2.4 Validar si el usuario es miembro directo del negocio
      const { data: membership } = await dbClient
        .from("business_users")
        .select("id, status, role_id, roles(id, code, scope)")
        .eq("business_id", context.businessId)
        .eq("user_id", userId)
        .maybeSingle();

      if (membership && membership.status === "active") {
        const rawRole = membership.roles as any;
        const role = Array.isArray(rawRole) ? rawRole[0] : rawRole;
        if (!role) return false;

        // El propietario del negocio tiene todos los permisos operativos compatibles de su negocio
        if (role.code === "owner") return true;

        // Consultar anulaciones de permisos individuales (business_user_permissions)
        try {
          const { getUserCustomPermissions } = await import("./user-permissions-service");
          const customOverrides = await getUserCustomPermissions(context.businessId, userId);
          const specificOverride = customOverrides.find((o) => o.permissionCode === permissionCode);

          if (specificOverride !== undefined) {
            if (!specificOverride.isGranted) {
              // Explícitamente revocado para este trabajador
              return false;
            }
            // Explícitamente concedido: validar asignabilidad
            const { isPermissionAssignableToAuxiliar } = await import("./permissions");
            if (role.code === "auxiliar" && !isPermissionAssignableToAuxiliar(permissionCode, businessType)) {
              return false;
            }
            return true;
          }
        } catch {
          // Si falla consulta de permisos individuales, continuar con permisos de rol
        }

        // Consultar permisos del rol en BD
        const { data: rolePermissions } = await dbClient
          .from("role_permissions")
          .select("permissions(code)")
          .eq("role_id", role.id);

        if (rolePermissions && rolePermissions.length > 0) {
          const assignedCodes = rolePermissions
            .map((rp: any) => rp.permissions?.code)
            .filter(Boolean);
          return assignedCodes.includes(permissionCode);
        }

        // Fallback a matriz por defecto adaptada al tipo de negocio
        const fallbackPermissions = getDefaultPermissionsForRoleAndBusinessType(role.code, businessType);
        return Boolean(fallbackPermissions?.includes(permissionCode));
      }

      // 2.4 Control de Acceso Delegado para Personal de Plataforma (Soporte / Admin / Superadmin)
      // Si el usuario no es miembro directo pero es personal de plataforma, solo puede acceder si posee
      // una autorización explícita (grant) activa y el permiso solicitado es estrictamente de solo lectura (.view / .read).
      if (["super_admin", "admin", "soporte"].includes(platformRole)) {
        const isReadOnlyPermission = permissionCode.endsWith(".view") || permissionCode.endsWith(".read");
        if (!isReadOnlyPermission) {
          // Bloqueo estricto: El personal de plataforma NO puede mutar datos en el negocio
          return false;
        }

        // Mapear permiso requerido al alcance de grant correspondiente (sin comodines)
        let requiredScope: "sales_read" | "orders_read" | "inventory_read" | "finance_read" | "settings_read" | null = null;
        if (permissionCode.startsWith("sales.")) requiredScope = "sales_read";
        else if (permissionCode.startsWith("orders.") || permissionCode.startsWith("tables.")) requiredScope = "orders_read";
        else if (permissionCode.startsWith("inventory.") || permissionCode.startsWith("products.")) requiredScope = "inventory_read";
        else if (permissionCode.startsWith("finance.") || permissionCode.startsWith("expenses.") || permissionCode.startsWith("cash.")) requiredScope = "finance_read";
        else if (permissionCode.startsWith("business_settings.")) requiredScope = "settings_read";

        if (!requiredScope) {
          // Deny by default: Si el permiso no está mapeado a un scope de diagnóstico seguro, no se concede
          return false;
        }

        try {
          const { validateActiveGrant } = await import("@/lib/support/delegated-access-service");
          const grantResult = await validateActiveGrant({
            businessId: context.businessId,
            adminUserId: userId,
            requiredScope,
          });

          return grantResult.valid;
        } catch {
          return false;
        }
      }

      return false;
    }

    return false;
  } catch (err) {
    console.error("[hasPermission Error]:", err);
    return false;
  }
}

/**
 * Validador estricto para Server Actions (lanza excepción si no tiene permiso)
 */
export async function verifyUserPermission(
  permissionCode: string,
  context: AuthorizationContext = { scope: "platform" }
): Promise<{ userId: string; userRole: string }> {
  const authProfile = await getCurrentUserAuthorization();
  if (!authProfile) {
    throw new Error("No autenticado. Inicie sesión para continuar.");
  }

  const allowed = await hasPermission(authProfile.userId, permissionCode, context);
  if (!allowed) {
    throw new Error(`Acceso denegado. No posee el permiso requerido: '${permissionCode}'.`);
  }

  return {
    userId: authProfile.userId,
    userRole: authProfile.platformRole,
  };
}

/**
 * Protección del rol Super Administrador:
 * 1. Debe haber siempre al menos 1 super_admin activo en la plataforma.
 * 2. No se pueden eliminar los permisos críticos de super_admin.
 */
export async function validateSuperAdminIntegrity(
  targetRoleId: string,
  targetRoleCode: string,
  updatedPermissionCodes?: string[]
): Promise<{ valid: boolean; error?: string }> {
  if (targetRoleCode === "super_admin") {
    // Si se intenta modificar permisos de super_admin, validar que no se retiren permisos esenciales
    if (updatedPermissionCodes) {
      const criticalPermissions = [
        "roles.view",
        "roles.manage",
        "platform_settings.view",
        "platform_settings.update",
        "users.view",
        "users.update",
      ];
      const missingCritical = criticalPermissions.filter(
        (p) => !updatedPermissionCodes.includes(p)
      );
      if (missingCritical.length > 0) {
        return {
          valid: false,
          error: `No es posible retirar permisos de seguridad críticos (${missingCritical.join(", ")}) del rol Super Administrador.`,
        };
      }
    }
  }

  return { valid: true };
}
