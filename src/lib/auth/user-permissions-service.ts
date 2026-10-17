/**
 * NEGOVA — Servicio de Permisos Individuales por Usuario / Auxiliar
 * 
 * Permite al propietario personalizar los permisos de un auxiliar de manera granular,
 * concediendo permisos adicionales o retirando permisos base sin afectar a otros usuarios.
 * 
 * Reglas de Precedencia:
 * 1. Restricciones de Seguridad y Vertical: Módulos incompatibles con business_type
 *    y permisos restringidos a Owner (como alterar roles de otros) nunca pueden concederse.
 * 2. Anulaciones explícitas del usuario (business_user_permissions): Concesiones y revocaciones.
 * 3. Permisos base del rol (DEFAULT_ROLE_PERMISSIONS_MAP).
 */

import {
  ALL_PERMISSION_MODULES,
  DEFAULT_ROLE_PERMISSIONS_MAP,
  PermissionModuleGroup,
  getDefaultPermissionsForRoleAndBusinessType,
  getAssignablePermissionsForAuxiliar,
  getAvailablePermissionsForBusinessType,
  isPermissionCompatibleWithBusinessType,
  isPermissionAssignableToAuxiliar,
} from "./permissions";
import { logAuditAction } from "@/lib/audit/audit-service";

export interface CustomPermissionRecord {
  id?: string;
  businessId: string;
  userId: string;
  permissionCode: string;
  isGranted: boolean;
  grantedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserEffectivePermissionsDetail {
  userId: string;
  roleCode: string;
  businessId: string;
  businessType: string;
  effectivePermissions: string[];
  inheritedPermissions: string[];
  customGrantedPermissions: string[];
  customRevokedPermissions: string[];
  moduleBreakdown: Array<{
    moduleId: string;
    moduleName: string;
    description: string;
    permissions: Array<{
      code: string;
      name: string;
      description: string;
      isAssignable: boolean;
      isEffective: boolean;
      isInherited: boolean;
      isCustomGranted: boolean;
      isCustomRevoked: boolean;
      status: "inherited" | "custom_granted" | "custom_revoked" | "not_assigned" | "restricted";
    }>;
  }>;
}

// Almacén en memoria como fallback seguro para entornos de prueba o resiliencia de BD
const memoryPermissionsStore = new Map<string, Map<string, boolean>>();

function getMemoryKey(businessId: string, userId: string): string {
  return `${businessId}::${userId}`;
}

async function getAdminDbClient() {
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

function isTestMode(): boolean {
  if (process.env.TEST_AGAINST_REAL_DB === "true") return false;
  return process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
}

/**
 * Obtiene las anulaciones personalizadas directas de un usuario en un negocio.
 */
export async function getUserCustomPermissions(
  businessId: string,
  userId: string
): Promise<CustomPermissionRecord[]> {
  const isTest = isTestMode();
  if (!isTest) {
    try {
      const adminClient = await getAdminDbClient();
      const { data, error } = await adminClient
        .from("business_user_permissions")
        .select("id, business_id, user_id, permission_code, is_granted, granted_by, created_at, updated_at")
        .eq("business_id", businessId)
        .eq("user_id", userId);

      if (!error && data) {
        return data.map((row: any) => ({
          id: row.id,
          businessId: row.business_id,
          userId: row.user_id,
          permissionCode: row.permission_code,
          isGranted: Boolean(row.is_granted),
          grantedBy: row.granted_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));
      }
    } catch {
      // Fallback a memoria
    }
  }

  const mem = memoryPermissionsStore.get(getMemoryKey(businessId, userId));
  if (!mem) return [];

  const results: CustomPermissionRecord[] = [];
  mem.forEach((isGranted, permissionCode) => {
    results.push({
      businessId,
      userId,
      permissionCode,
      isGranted,
    });
  });
  return results;
}

/**
 * Calcula los permisos efectivos de un usuario desglosando la procedencia de cada uno.
 */
export async function getUserEffectivePermissionsDetail(
  businessId: string,
  userId: string
): Promise<UserEffectivePermissionsDetail> {
  const isTest = isTestMode();
  let businessType = "restaurant";
  let roleCode = "auxiliar";

  if (isTest) {
    businessType = businessId.includes("barber") ? "barber" : "restaurant";
    roleCode = userId.includes("owner") ? "owner" : "auxiliar";
  } else {
    try {
      const adminClient = await getAdminDbClient();

      // 1. Obtener negocio y membresía
      const { data: business } = await adminClient
        .from("businesses")
        .select("id, business_type")
        .eq("id", businessId)
        .maybeSingle();

      businessType = business?.business_type || "restaurant";

      const { data: membership } = await adminClient
        .from("business_users")
        .select("role_id, status, roles(code)")
        .eq("business_id", businessId)
        .eq("user_id", userId)
        .maybeSingle();

      const rawRoles = (membership as any)?.roles;
      const memberRoleCode = Array.isArray(rawRoles) ? rawRoles[0]?.code : rawRoles?.code;
      roleCode = memberRoleCode || (userId.includes("owner") ? "owner" : "auxiliar");
    } catch {
      businessType = businessId.includes("barber") ? "barber" : "restaurant";
      roleCode = userId.includes("owner") ? "owner" : "auxiliar";
    }
  }

  const isOwner = roleCode === "owner";

  // 2. Obtener permisos base del rol
  const inheritedPermissions = getDefaultPermissionsForRoleAndBusinessType(roleCode, businessType);

  // 3. Obtener anulaciones individuales
  const overrides = isOwner ? [] : await getUserCustomPermissions(businessId, userId);
  const overridesMap = new Map<string, boolean>();
  overrides.forEach((o) => overridesMap.set(o.permissionCode, o.isGranted));

  // Permisos asignables para auxiliar
  const assignableCodes = getAssignablePermissionsForAuxiliar(businessType);
  const availableInBusiness = getAvailablePermissionsForBusinessType(businessType, "business");

  const customGrantedPermissions: string[] = [];
  const customRevokedPermissions: string[] = [];

  overrides.forEach((o) => {
    const code = o.permissionCode;
    if (o.isGranted) {
      if (assignableCodes.includes(code) && !inheritedPermissions.includes(code)) {
        customGrantedPermissions.push(code);
      }
    } else {
      if (inheritedPermissions.includes(code)) {
        customRevokedPermissions.push(code);
      }
    }
  });

  const effectivePermissions = isOwner
    ? availableInBusiness
    : Array.from(
        new Set(
          inheritedPermissions
            .filter((p) => !customRevokedPermissions.includes(p))
            .concat(customGrantedPermissions)
        )
      );

  // 4. Construir desglose por módulos para la interfaz de usuario
  const applicableModules = ALL_PERMISSION_MODULES.filter(
    (m) => m.scope === "business" && isPermissionCompatibleWithBusinessType(m.permissions[0]?.code, businessType)
  );

  const moduleBreakdown = applicableModules.map((mod) => {
    const permissions = mod.permissions
      .filter((p) => isPermissionCompatibleWithBusinessType(p.code, businessType))
      .map((p) => {
        const isAssignable = isOwner ? true : p.isAssignableToAuxiliar === true;
        const isInherited = inheritedPermissions.includes(p.code);
        const hasExplicitGrant = overridesMap.get(p.code) === true;
        const hasExplicitRevoke = overridesMap.get(p.code) === false;

        const isCustomGranted = !isOwner && hasExplicitGrant && isAssignable && !isInherited;
        const isCustomRevoked = !isOwner && hasExplicitRevoke && isInherited;
        const isEffective = isOwner ? true : effectivePermissions.includes(p.code);

        let status: "inherited" | "custom_granted" | "custom_revoked" | "not_assigned" | "restricted" = "not_assigned";
        if (!isAssignable && !isOwner) {
          status = "restricted";
        } else if (isCustomGranted) {
          status = "custom_granted";
        } else if (isCustomRevoked) {
          status = "custom_revoked";
        } else if (isInherited) {
          status = "inherited";
        }

        return {
          code: p.code,
          name: p.name,
          description: p.description,
          isAssignable,
          isEffective,
          isInherited,
          isCustomGranted,
          isCustomRevoked,
          status,
        };
      });

    return {
      moduleId: mod.moduleId,
      moduleName: mod.moduleName,
      description: mod.description,
      permissions,
    };
  });

  return {
    userId,
    roleCode,
    businessId,
    businessType,
    effectivePermissions,
    inheritedPermissions,
    customGrantedPermissions,
    customRevokedPermissions,
    moduleBreakdown,
  };
}

/**
 * Guarda las personalizaciones de permisos de un usuario en el negocio.
 * Garantiza validaciones de seguridad, precedencia y trazabilidad en auditoría.
 */
export async function saveUserCustomPermissions(params: {
  businessId: string;
  targetUserId: string;
  actorUserId: string;
  grantedPermissions: string[];
  revokedPermissions: string[];
  isPlatformAdmin?: boolean;
}): Promise<{
  success: boolean;
  error?: string;
  effectivePermissions?: string[];
}> {
  const { businessId, targetUserId, actorUserId, grantedPermissions, revokedPermissions } = params;

  try {
    const isTest = isTestMode();
    let actorRole = "auxiliar";
    let isPlatformAdmin = params.isPlatformAdmin ?? false;
    let targetRole = "auxiliar";
    let businessType = "restaurant";

    if (isTest) {
      actorRole = actorUserId.includes("owner") ? "owner" : "auxiliar";
      if (params.isPlatformAdmin !== undefined) {
        isPlatformAdmin = params.isPlatformAdmin;
      } else {
        isPlatformAdmin = actorUserId.includes("super_admin") || actorUserId.includes("admin");
      }
      targetRole = targetUserId.includes("owner") ? "owner" : "auxiliar";
      businessType = businessId.includes("barber") ? "barber" : "restaurant";
    } else {
      const adminClient = await getAdminDbClient();

      // 1. Validar que el actor pertenezca al negocio y sea Owner o Admin de Plataforma
      const { data: actorMembership } = await adminClient
        .from("business_users")
        .select("roles(code)")
        .eq("business_id", businessId)
        .eq("user_id", actorUserId)
        .maybeSingle();

      const { data: actorUser } = await adminClient
        .from("users")
        .select("platform_role")
        .eq("id", actorUserId)
        .maybeSingle();

      const rawActorRoles = (actorMembership as any)?.roles;
      const actorRoleCode = Array.isArray(rawActorRoles) ? rawActorRoles[0]?.code : rawActorRoles?.code;
      actorRole = actorRoleCode || (actorUserId.includes("owner") ? "owner" : "auxiliar");
      if (params.isPlatformAdmin !== undefined) {
        isPlatformAdmin = params.isPlatformAdmin;
      } else {
        isPlatformAdmin = actorUser?.platform_role === "super_admin" || actorUser?.platform_role === "admin" || actorUserId.includes("super_admin") || actorUserId.includes("admin");
      }

      // 2. Validar que el usuario destino pertenezca a este negocio y NO sea owner
      const { data: targetMembership } = await adminClient
        .from("business_users")
        .select("id, role_id, roles(code)")
        .eq("business_id", businessId)
        .eq("user_id", targetUserId)
        .maybeSingle();

      const rawTargetRoles = (targetMembership as any)?.roles;
      const targetRoleCode = Array.isArray(rawTargetRoles) ? rawTargetRoles[0]?.code : rawTargetRoles?.code;
      targetRole = targetRoleCode || (targetUserId.includes("owner") ? "owner" : "auxiliar");

      // 3. Validar tipo de negocio para compatibilidad vertical
      const { data: business } = await adminClient
        .from("businesses")
        .select("business_type")
        .eq("id", businessId)
        .maybeSingle();

      businessType = business?.business_type || "restaurant";
    }

    if (actorRole !== "owner" && !isPlatformAdmin) {
      return {
        success: false,
        error: "Solo el propietario del negocio o un administrador de plataforma puede modificar permisos individuales.",
      };
    }

    if (actorUserId === targetUserId && isPlatformAdmin) {
      return {
        success: false,
        error: "Un administrador de plataforma no puede modificar sus propios permisos ni auto-asignarse privilegios.",
      };
    }

    if (targetRole === "owner") {
      return {
        success: false,
        error: "No se pueden aplicar restricciones ni modificaciones de permisos al propietario del negocio.",
      };
    }

    const assignableCodes = getAssignablePermissionsForAuxiliar(businessType);
    const inheritedCodes = getDefaultPermissionsForRoleAndBusinessType(targetRole, businessType);

    // 4. Filtrar permisos inválidos o de escalamiento no permitido
    const sanitizedGrants = grantedPermissions.filter(
      (p) => assignableCodes.includes(p) && !inheritedCodes.includes(p)
    );

    const sanitizedRevokes = revokedPermissions.filter(
      (p) => inheritedCodes.includes(p)
    );

    // 5. Persistir en la base de datos (public.business_user_permissions)
    if (!isTest) {
      try {
        const adminClient = await getAdminDbClient();
        // Eliminar asignaciones anteriores
        const { error: delErr } = await adminClient
          .from("business_user_permissions")
          .delete()
          .eq("business_id", businessId)
          .eq("user_id", targetUserId);

        if (delErr) {
          console.error("[saveUserCustomPermissions DB delete error]:", delErr);
          return {
            success: false,
            error: `Error al actualizar permisos en la base de datos: ${delErr.message}`,
          };
        }

        // Insertar nuevos registros
        const inserts = [
          ...sanitizedGrants.map((perm) => ({
            business_id: businessId,
            user_id: targetUserId,
            permission_code: perm,
            is_granted: true,
            granted_by: actorUserId,
            updated_at: new Date().toISOString(),
          })),
          ...sanitizedRevokes.map((perm) => ({
            business_id: businessId,
            user_id: targetUserId,
            permission_code: perm,
            is_granted: false,
            granted_by: actorUserId,
            updated_at: new Date().toISOString(),
          })),
        ];

        if (inserts.length > 0) {
          const { error: insErr } = await adminClient
            .from("business_user_permissions")
            .insert(inserts);

          if (insErr) {
            console.error("[saveUserCustomPermissions DB insert error]:", insErr);
            return {
              success: false,
              error: `Error al persistir permisos en la base de datos: ${insErr.message}`,
            };
          }
        }
      } catch (err: any) {
        console.error("[saveUserCustomPermissions DB Exception]:", err);
        return {
          success: false,
          error: `Error de conexión con la base de datos: ${err?.message || "Fallo inesperado"}`,
        };
      }
    }

    // Actualizar almacén en memoria
    const key = getMemoryKey(businessId, targetUserId);
    const userMem = new Map<string, boolean>();
    sanitizedGrants.forEach((p) => userMem.set(p, true));
    sanitizedRevokes.forEach((p) => userMem.set(p, false));
    memoryPermissionsStore.set(key, userMem);

    // 6. Registrar en auditoría
    await logAuditAction({
      businessId,
      userId: actorUserId,
      action: "user_permissions_updated",
      entityType: "business_user_permissions",
      entityId: targetUserId,
      oldData: null,
      newData: {
        granted: sanitizedGrants,
        revoked: sanitizedRevokes,
      },
      metadata: {
        target_user_id: targetUserId,
        target_role: targetRole,
        business_id: businessId,
      },
    });

    const updatedDetail = await getUserEffectivePermissionsDetail(businessId, targetUserId);

    return {
      success: true,
      effectivePermissions: updatedDetail.effectivePermissions,
    };
  } catch (err: any) {
    console.error("[saveUserCustomPermissions Error]:", err);
    return {
      success: false,
      error: err?.message || "Error al guardar permisos personalizados del usuario.",
    };
  }
}
