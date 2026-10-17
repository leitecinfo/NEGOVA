"use server";

import { revalidatePath } from "next/cache";
import { verifyUserPermission } from "@/lib/auth/authorization";
import {
  getUsersList,
  getUserDetail,
  createUser,
  updateUserProfile,
  changeUserRole,
  changeUserStatus,
  resetUserPassword,
  checkBusinessPlanUserCapacity,
  assignUserToBusiness,
  removeUserFromBusiness,
  deleteUser,
  getEligibleBusinessUsers,
  getBusinessesOptions,
  UserListFilters,
  UserListResult,
  UserModel,
  CreateUserInput,
  UserStatus,
} from "@/lib/auth/users-service";
import {
  PLATFORM_ROLES_CATALOG,
  BUSINESS_ROLES_CATALOG,
} from "@/lib/auth/permissions";

/**
 * 1. SERVER ACTION: OBTENER LISTADO DE USUARIOS PAGINADO Y FILTRADO
 */
export async function getUsersListAction(
  filters: UserListFilters = {}
): Promise<{ success: boolean; data?: UserListResult; error?: string }> {
  try {
    await verifyUserPermission("users.view");
    const result = await getUsersList(filters);
    return { success: true, data: result };
  } catch (err: any) {
    console.error("[getUsersListAction Error]:", err);
    return {
      success: false,
      error: err.message || "Error de autorización al consultar el directorio de usuarios.",
    };
  }
}

/**
 * 2. SERVER ACTION: OBTENER DETALLE DE UN USUARIO (CON PERMISOS Y AUDITORÍA)
 */
export async function getUserDetailAction(
  userId: string
): Promise<{
  success: boolean;
  data?: {
    user: UserModel;
    effectivePermissions: string[];
    auditLogs: any[];
  };
  error?: string;
}> {
  try {
    await verifyUserPermission("users.view");
    const result = await getUserDetail(userId);
    return { success: true, data: result };
  } catch (err: any) {
    console.error("[getUserDetailAction Error]:", err);
    return {
      success: false,
      error: err.message || "No fue posible obtener el detalle del usuario.",
    };
  }
}

/**
 * 3. SERVER ACTION: CREAR USUARIO (PLATAFORMA O NEGOCIO)
 */
export async function createUserAction(
  input: CreateUserInput
): Promise<{
  success: boolean;
  user?: UserModel;
  temporaryPassword?: string;
  error?: string;
}> {
  try {
    const actor = await verifyUserPermission("users.create");
    const result = await createUser(input, actor.userId);

    if (result.success && result.user) {
      revalidatePath("/admin/usuarios");
      revalidatePath("/admin/notificaciones");

      try {
        const { createPlatformNotification } = await import("@/lib/notifications/notifications-service");
        const typeLabel = result.user.type === "platform" ? "Equipo NEGOVA" : "Usuario de Negocio";
        await createPlatformNotification({
          type: "user_created",
          title: "Nuevo usuario registrado",
          message: `Se dio de alta a ${result.user.fullName} (${result.user.email}) con rol '${result.user.primaryRole.name}' en ${typeLabel}.`,
          link: `/admin/usuarios/${result.user.id}`,
          metadata: {
            userId: result.user.id,
            fullName: result.user.fullName,
            email: result.user.email,
            role: result.user.primaryRole.name,
            type: result.user.type,
          },
        });
      } catch (notifErr) {
        console.error("Error creating notification:", notifErr);
      }
    }

    return result;
  } catch (err: any) {
    console.error("[createUserAction Error]:", err);
    return {
      success: false,
      error: err.message || "Acceso denegado: No cuenta con permisos para dar de alta usuarios.",
    };
  }
}

/**
 * 4. SERVER ACTION: ACTUALIZAR DATOS DE PERFIL
 */
export async function updateUserProfileAction(
  userId: string,
  data: { fullName: string; phone?: string; bio?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await verifyUserPermission("users.update");
    const result = await updateUserProfile(userId, data, actor.userId);

    if (result.success) {
      revalidatePath("/admin/usuarios");
      revalidatePath(`/admin/usuarios/${userId}`);
    }

    return result;
  } catch (err: any) {
    console.error("[updateUserProfileAction Error]:", err);
    return {
      success: false,
      error: err.message || "No fue posible actualizar los datos del usuario.",
    };
  }
}

/**
 * 5. SERVER ACTION: CAMBIAR ROL DE USUARIO
 */
export async function changeUserRoleAction(
  userId: string,
  newRoleCode: string,
  businessId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await verifyUserPermission("users.update");
    const result = await changeUserRole(userId, newRoleCode, businessId, actor.userId);

    if (result.success) {
      revalidatePath("/admin/usuarios");
      revalidatePath(`/admin/usuarios/${userId}`);
    }

    return result;
  } catch (err: any) {
    console.error("[changeUserRoleAction Error]:", err);
    return {
      success: false,
      error: err.message || "No fue posible modificar el rol del usuario.",
    };
  }
}

/**
 * 6. SERVER ACTION: CAMBIAR ESTADO (ACTIVAR / DESHABILITAR / BLOQUEAR)
 */
export async function changeUserStatusAction(
  userId: string,
  newStatus: UserStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await verifyUserPermission("users.disable");
    const result = await changeUserStatus(userId, newStatus, actor.userId);

    if (result.success) {
      revalidatePath("/admin/usuarios");
      revalidatePath(`/admin/usuarios/${userId}`);
    }

    return result;
  } catch (err: any) {
    console.error("[changeUserStatusAction Error]:", err);
    return {
      success: false,
      error: err.message || "No fue posible modificar el estado del usuario.",
    };
  }
}

/**
 * 7. SERVER ACTION: RESTABLECER CONTRASEÑA TEMPORAL
 */
export async function resetUserPasswordAction(
  userId: string,
  customPassword?: string
): Promise<{ success: boolean; temporaryPassword?: string; error?: string }> {
  try {
    const actor = await verifyUserPermission("users.update");
    const result = await resetUserPassword(userId, customPassword, actor.userId);

    if (result.success) {
      revalidatePath(`/admin/usuarios/${userId}`);
    }

    return result;
  } catch (err: any) {
    console.error("[resetUserPasswordAction Error]:", err);
    return {
      success: false,
      error: err.message || "No fue posible restablecer la contraseña.",
    };
  }
}

/**
 * 8. SERVER ACTION: OBTENER OPCIONES DE NEGOCIOS Y ROLES PARA FORMULARIOS
 */
export async function getBusinessesAndRolesOptionsAction(): Promise<{
  success: boolean;
  businesses: Array<{ id: string; name: string; slug: string; status: string }>;
  platformRoles: typeof PLATFORM_ROLES_CATALOG;
  businessRoles: typeof BUSINESS_ROLES_CATALOG;
  error?: string;
}> {
  try {
    await verifyUserPermission("users.view");

    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceKey || !supabaseUrl) {
      throw new Error("Credenciales administrativas no configuradas.");
    }

    const adminClient = createAdminClient(supabaseUrl, serviceKey);

    const { data: businesses, error: bErr } = await adminClient
      .from("businesses")
      .select("id, name, slug, status")
      .order("name", { ascending: true });

    if (bErr) throw bErr;

    return {
      success: true,
      businesses: businesses || [],
      platformRoles: PLATFORM_ROLES_CATALOG,
      businessRoles: BUSINESS_ROLES_CATALOG,
    };
  } catch (err: any) {
    console.error("[getBusinessesAndRolesOptionsAction Error]:", err);
    return {
      success: false,
      businesses: [],
      platformRoles: PLATFORM_ROLES_CATALOG,
      businessRoles: BUSINESS_ROLES_CATALOG,
      error: err.message,
    };
  }
}

/**
 * 9. SERVER ACTION: CONSULTAR CAPACIDAD DEL PLAN PARA UN NEGOCIO
 */
export async function checkBusinessPlanCapacityAction(
  businessId: string
): Promise<{
  success: boolean;
  capacity?: {
    canAddUser: boolean;
    currentUsers: number;
    maxUsers: number;
    planName: string;
    planCode: string;
  };
  error?: string;
}> {
  try {
    await verifyUserPermission("users.view");
    const capacity = await checkBusinessPlanUserCapacity(businessId);
    return { success: true, capacity };
  } catch (err: any) {
    console.error("[checkBusinessPlanCapacityAction Error]:", err);
    return { success: false, error: err.message };
  }
}

/**
 * 10. SERVER ACTION: ASIGNAR USUARIO A UN NEGOCIO (CREAR O ACTUALIZAR MEMBRESÍA)
 */
export async function assignUserToBusinessAction(
  userId: string,
  businessId: string,
  roleCode: string
): Promise<{ success: boolean; membershipId?: string; error?: string }> {
  try {
    const actor = await verifyUserPermission("users.update");
    const result = await assignUserToBusiness(userId, businessId, roleCode, actor.userId);

    if (result.success) {
      revalidatePath("/admin/usuarios");
      revalidatePath(`/admin/usuarios/${userId}`);
      revalidatePath("/admin/negocios");
      revalidatePath(`/admin/negocios/${businessId}`);
    }

    return result;
  } catch (err: any) {
    console.error("[assignUserToBusinessAction Error]:", err);
    return { success: false, error: err.message || "No fue posible vincular el usuario al negocio." };
  }
}

/**
 * 11. SERVER ACTION: DESVINCULAR USUARIO DE UN NEGOCIO (ELIMINAR MEMBRESÍA)
 */
export async function removeUserFromBusinessAction(
  membershipId: string,
  userId?: string,
  businessId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await verifyUserPermission("users.update");
    const result = await removeUserFromBusiness(membershipId, actor.userId);

    if (result.success) {
      revalidatePath("/admin/usuarios");
      if (userId) revalidatePath(`/admin/usuarios/${userId}`);
      revalidatePath("/admin/negocios");
      if (businessId) revalidatePath(`/admin/negocios/${businessId}`);
    }

    return result;
  } catch (err: any) {
    console.error("[removeUserFromBusinessAction Error]:", err);
    return { success: false, error: err.message || "No fue posible desvincular el usuario del negocio." };
  }
}

/**
 * 12. SERVER ACTION: OBTENER USUARIOS ELEGIBLES PARA NEGOCIOS
 */
export async function getEligibleBusinessUsersAction(): Promise<{
  success: boolean;
  users: Array<{ id: string; fullName: string; email: string; phone?: string | null }>;
  error?: string;
}> {
  try {
    await verifyUserPermission("users.view");
    const users = await getEligibleBusinessUsers();
    return { success: true, users };
  } catch (err: any) {
    console.error("[getEligibleBusinessUsersAction Error]:", err);
    return { success: false, users: [], error: err.message };
  }
}

/**
 * 13. SERVER ACTION: ELIMINAR USUARIO PERMANENTEMENTE (SOLO SUPERADMIN)
 */
export async function deleteUserAction(
  userId: string,
  confirmEmail?: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await verifyUserPermission("users.delete");
    const result = await deleteUser(userId, confirmEmail, actor.userId, reason);

    if (result.success) {
      revalidatePath("/admin/usuarios");
      revalidatePath("/admin/negocios");
      revalidatePath("/admin/notificaciones");
    }

    return result;
  } catch (err: any) {
    console.error("[deleteUserAction Error]:", err);
    return {
      success: false,
      error: err.message || "Acceso denegado: Se requieren permisos de Super Administrador para eliminar usuarios.",
    };
  }
}

/**
 * 14. SERVER ACTION: OBTENER DETALLE DE PERMISOS DE UN USUARIO (ADMIN DE PLATAFORMA)
 */
export async function getAdminUserPermissionsDetailAction(
  businessId: string,
  targetUserId: string
) {
  try {
    await verifyUserPermission("users.view");
    const { getUserEffectivePermissionsDetail } = await import("@/lib/auth/user-permissions-service");
    const detail = await getUserEffectivePermissionsDetail(businessId, targetUserId);
    return { success: true, data: detail };
  } catch (err: any) {
    console.error("[getAdminUserPermissionsDetailAction Error]:", err);
    return {
      success: false,
      error: err.message || "Error al consultar los permisos del usuario.",
    };
  }
}

/**
 * 15. SERVER ACTION: GUARDAR PERMISOS INDIVIDUALES PERSONALIZADOS (ADMIN DE PLATAFORMA)
 */
export async function saveAdminUserCustomPermissionsAction(
  businessId: string,
  targetUserId: string,
  grantedPermissions: string[],
  revokedPermissions: string[]
): Promise<{
  success: boolean;
  error?: string;
  effectivePermissions?: string[];
}> {
  try {
    const actor = await verifyUserPermission("users.update");

    // Seguridad: Un admin no puede modificar sus propios permisos (auto-escalada de privilegios)
    if (actor.userId === targetUserId) {
      return {
        success: false,
        error: "No puedes modificar tus propios permisos de usuario.",
      };
    }

    const { saveUserCustomPermissions } = await import("@/lib/auth/user-permissions-service");
    const result = await saveUserCustomPermissions({
      businessId,
      targetUserId,
      actorUserId: actor.userId,
      grantedPermissions,
      revokedPermissions,
    });

    if (result.success) {
      revalidatePath(`/admin/usuarios/${targetUserId}`);
      revalidatePath(`/admin/usuarios`);
    }

    return result;
  } catch (err: any) {
    console.error("[saveAdminUserCustomPermissionsAction Error]:", err);
    return {
      success: false,
      error: err.message || "Error al modificar los permisos del usuario.",
    };
  }
}

