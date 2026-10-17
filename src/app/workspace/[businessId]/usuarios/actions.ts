"use server";

import { verifyUserPermission } from "@/lib/auth/authorization";
import { getWorkspaceUsersList } from "@/lib/auth/workspace-users-service";
import { UserListFilters, UserListResult, CreateUserInput, checkBusinessPlanUserCapacity, createUser, UserModel } from "@/lib/auth/users-service";
import { getBusinessesAndRolesOptionsAction } from "@/app/admin/usuarios/actions";
import { revalidatePath } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/auth/users-service";

/**
 * SERVER ACTION: OBTENER LISTADO DE USUARIOS DEL NEGOCIO
 */
export async function getWorkspaceUsersListAction(
  businessId: string,
  filters: UserListFilters = {}
): Promise<{ success: boolean; data?: UserListResult; error?: string }> {
  try {
    // 1. Verificar autorización multi-tenant para ver empleados del negocio
    await verifyUserPermission("business_users.view", { businessId });
    
    // 2. Obtener usuarios filtrados por negocio usando el servicio aislado
    const result = await getWorkspaceUsersList(businessId, filters);
    
    return { success: true, data: result };
  } catch (err: any) {
    console.error("[getWorkspaceUsersListAction Error]:", err);
    return {
      success: false,
      error: err.message || "Error de autorización al consultar los usuarios del negocio.",
    };
  }
}

/**
 * SERVER ACTION: CAMBIAR ESTADO DE UN USUARIO DENTRO DEL NEGOCIO (Activar / Deshabilitar / Bloquear)
 */
export async function changeWorkspaceUserStatusAction(
  businessId: string,
  userId: string,
  newStatus: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await verifyUserPermission("business_users.disable", { businessId });

    if (actor.userId === userId && newStatus !== "active") {
      return {
        success: false,
        error: "No puedes deshabilitar ni bloquear tu propia cuenta.",
      };
    }

    const adminClient = await getSupabaseAdminClient();

    // 1. Verificar que el usuario pertenezca a este negocio
    const { data: bu, error: buErr } = await adminClient
      .from("business_users")
      .select("id, role_id, status, roles(code)")
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .maybeSingle();

    if (buErr || !bu) {
      return {
        success: false,
        error: "El usuario no pertenece a este comercio.",
      };
    }

    // Proteger: un auxiliar no puede deshabilitar al owner
    const targetRoleCode = (bu.roles as any)?.code;
    if (targetRoleCode === "owner") {
      const { data: actorBu } = await adminClient
        .from("business_users")
        .select("roles(code)")
        .eq("business_id", businessId)
        .eq("user_id", actor.userId)
        .maybeSingle();

      const actorRoleCode = (actorBu?.roles as any)?.code;
      if (actorRoleCode !== "owner" && actor.userRole !== "super_admin") {
        return {
          success: false,
          error: "No tienes permisos para modificar el estado del propietario del negocio.",
        };
      }
    }

    const validStatuses = ["active", "disabled", "blocked", "inactive", "suspended"];
    if (!validStatuses.includes(newStatus)) {
      return {
        success: false,
        error: "Estado no válido.",
      };
    }

    const { toDbUserStatus, toDbMembershipStatus } = await import("@/lib/auth/users-service");
    const dbStatus = toDbUserStatus(newStatus);
    const memStatus = toDbMembershipStatus(newStatus);

    // 2. Actualizar estado en business_users
    const { error: updBuErr } = await adminClient
      .from("business_users")
      .update({
        status: memStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bu.id);

    if (updBuErr) {
      console.error("[changeWorkspaceUserStatusAction Bu Update Error]:", updBuErr);
      return { success: false, error: "Error al actualizar la membresía del usuario." };
    }

    // 3. Actualizar estado en public.users
    const { error: updUserErr } = await adminClient
      .from("users")
      .update({
        status: dbStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updUserErr) {
      console.warn("[changeWorkspaceUserStatusAction User Update Warning]:", updUserErr);
    }

    // 4. Registrar auditoría
    const { logAuditAction } = await import("@/lib/audit/audit-service");
    await logAuditAction({
      businessId,
      userId: actor.userId,
      action: "status_change",
      entityType: "user",
      entityId: userId,
      oldData: { status: bu.status },
      newData: { status: newStatus },
      metadata: {
        original_action: "change_workspace_user_status",
        event: newStatus === "active" ? "workspace.user.enabled" : "workspace.user.disabled",
        target_user_id: userId,
      },
    });

    revalidatePath(`/workspace/${businessId}/usuarios`);

    return { success: true };
  } catch (err: any) {
    console.error("[changeWorkspaceUserStatusAction Error]:", err);
    return { success: false, error: err.message || "Error al modificar estado del usuario." };
  }
}

/**
 * SERVER ACTION: RESTABLECER CONTRASEÑA DE UN USUARIO DEL NEGOCIO
 */
export async function resetWorkspaceUserPasswordAction(
  businessId: string,
  userId: string,
  customPassword?: string
): Promise<{ success: boolean; temporaryPassword?: string; error?: string }> {
  try {
    const actor = await verifyUserPermission("business_users.disable", { businessId });

    const adminClient = await getSupabaseAdminClient();

    // Validar pertenencia al negocio
    const { data: bu } = await adminClient
      .from("business_users")
      .select("id")
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!bu) {
      return { success: false, error: "El usuario no pertenece a este comercio." };
    }

    const { resetUserPassword } = await import("@/lib/auth/users-service");
    const result = await resetUserPassword(userId, customPassword, actor.userId);

    if (result.success) {
      revalidatePath(`/workspace/${businessId}/usuarios`);
    }

    return result;
  } catch (err: any) {
    console.error("[resetWorkspaceUserPasswordAction Error]:", err);
    return { success: false, error: err.message || "Error al restablecer la contraseña." };
  }
}

/**
 * SERVER ACTION: DESVINCULAR USUARIO DEL NEGOCIO
 */
export async function removeWorkspaceUserAction(
  businessId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await verifyUserPermission("business_users.disable", { businessId });

    if (actor.userId === userId) {
      return { success: false, error: "No puedes desvincularte a ti mismo del negocio." };
    }

    const adminClient = await getSupabaseAdminClient();

    const { data: bu } = await adminClient
      .from("business_users")
      .select("id, roles(code)")
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!bu) {
      return { success: false, error: "Membresía no encontrada." };
    }

    if ((bu.roles as any)?.code === "owner") {
      return { success: false, error: "No es posible desvincular al dueño principal del comercio." };
    }

    const { removeUserFromBusiness } = await import("@/lib/auth/users-service");
    const result = await removeUserFromBusiness(bu.id, actor.userId);

    if (result.success) {
      revalidatePath(`/workspace/${businessId}/usuarios`);
    }

    return result;
  } catch (err: any) {
    console.error("[removeWorkspaceUserAction Error]:", err);
    return { success: false, error: err.message || "Error al desvincular usuario." };
  }
}

/**
 * SERVER ACTION: OBTENER ROLES Y EMPRESAS (REUTILIZADO DE ADMIN, PERO SOLO ROLES DE NEGOCIO SE USARAN)
 */
export async function getWorkspaceRolesOptionsAction(businessId: string) {
  try {
    await verifyUserPermission("business_users.view", { businessId });
    // Se reutiliza la acción de admin, el cliente filtrará para usar solo roles de negocio
    return await getBusinessesAndRolesOptionsAction();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * SERVER ACTION: CREAR USUARIO EN EL NEGOCIO (Respetando límites de plan)
 */
export async function createWorkspaceUserAction(
  businessId: string,
  input: Omit<CreateUserInput, "businessId" | "type">
): Promise<{ success: boolean; user?: UserModel; temporaryPassword?: string; error?: string }> {
  try {
    const actor = await verifyUserPermission("business_users.create", { businessId });

    // Protección estricta server-side: no se permite registrar un nuevo Owner ni ningún rol ajeno a Auxiliar
    if (input.roleCode !== "auxiliar") {
      return {
        success: false,
        error: "Rol no permitido. En el espacio de trabajo únicamente se permite invitar empleados con rol Auxiliar.",
      };
    }

    const capacity = await checkBusinessPlanUserCapacity(businessId);
    if (!capacity.canAddUser) {
      return {
        success: false,
        error: `Límite de usuarios alcanzado para tu plan actual (${capacity.planName}). Límite: ${capacity.maxUsers} usuarios.`,
      };
    }

    const result = await createUser(
      {
        ...input,
        type: "business",
        businessId,
      },
      actor.userId
    );

    if (result.success) {
      revalidatePath(`/workspace/${businessId}/usuarios`);
      return result;
    }

    return { success: false, error: result.error || "No fue posible crear el usuario." };
  } catch (err: any) {
    console.error("[createWorkspaceUserAction Error]:", err);
    return { success: false, error: err.message || "Error al intentar crear el usuario." };
  }
}

/**
 * SERVER ACTION: OBTENER PERMISOS EFECTIVOS Y DESGLOSE MODULAR DE UN TRABAJADOR
 */
export async function getUserPermissionsAction(
  businessId: string,
  userId: string
) {
  try {
    const { getCurrentUserAuthorization, verifyUserPermission } = await import("@/lib/auth/authorization");
    const authProfile = await getCurrentUserAuthorization();
    if (!authProfile) {
      throw new Error("No autenticado. Inicie sesión para continuar.");
    }

    const isPlatformAdmin = ["super_admin", "admin"].includes(authProfile.platformRole);
    if (!isPlatformAdmin) {
      await verifyUserPermission("business_users.view", { businessId });
    }

    const { getUserEffectivePermissionsDetail } = await import("@/lib/auth/user-permissions-service");
    const detail = await getUserEffectivePermissionsDetail(businessId, userId);
    return { success: true, data: detail };
  } catch (err: any) {
    console.error("[getUserPermissionsAction Error]:", err);
    return { success: false, error: err.message || "Error al consultar permisos del usuario." };
  }
}

/**
 * SERVER ACTION: GUARDAR PERMISOS INDIVIDUALES PERSONALIZADOS
 */
export async function saveUserPermissionsAction(
  businessId: string,
  targetUserId: string,
  grantedPermissions: string[],
  revokedPermissions: string[]
) {
  try {
    const { getCurrentUserAuthorization, verifyUserPermission } = await import("@/lib/auth/authorization");
    const authProfile = await getCurrentUserAuthorization();
    if (!authProfile) {
      throw new Error("No autenticado. Inicie sesión para continuar.");
    }

    const isPlatformAdmin = ["super_admin", "admin"].includes(authProfile.platformRole);
    if (!isPlatformAdmin) {
      await verifyUserPermission("business_users.update", { businessId });
    }

    const { saveUserCustomPermissions } = await import("@/lib/auth/user-permissions-service");
    
    const result = await saveUserCustomPermissions({
      businessId,
      targetUserId,
      actorUserId: authProfile.userId,
      grantedPermissions,
      revokedPermissions,
    });

    if (result.success) {
      revalidatePath(`/workspace/${businessId}/usuarios`);
      revalidatePath(`/workspace/${businessId}/usuarios/${targetUserId}`);
    }

    return result;
  } catch (err: any) {
    console.error("[saveUserPermissionsAction Error]:", err);
    return { success: false, error: err.message || "Error al guardar permisos del usuario." };
  }
}
