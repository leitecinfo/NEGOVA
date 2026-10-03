"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  PLATFORM_ROLES_CATALOG,
  BUSINESS_ROLES_CATALOG,
  DEFAULT_ROLE_PERMISSIONS_MAP,
  RoleModel,
  RoleScope,
  RoleType,
} from "@/lib/auth/permissions";
import {
  verifyUserPermission,
  validateSuperAdminIntegrity,
} from "@/lib/auth/authorization";

/**
 * Obtener listado completo de roles con conteo real de usuarios y permisos
 */
export async function getRolesListAction(filters?: {
  scope?: RoleScope;
  type?: RoleType;
  search?: string;
}): Promise<{ success: boolean; data: RoleModel[]; error?: string }> {
  try {
    const supabase = await createClient();

    // 1. Intentar consultar roles desde la base de datos
    let dbRoles: any[] = [];
    try {
      const { data, error } = await supabase
        .from("roles")
        .select(`
          id,
          code,
          name,
          description,
          scope,
          type,
          business_id,
          is_system_role,
          status,
          created_at,
          updated_at,
          role_permissions(permission_id, permissions(code))
        `)
        .order("created_at", { ascending: true });

      if (!error && data && data.length > 0) {
        dbRoles = data;
      }
    } catch {
      // Continuar con fallback canónico si la tabla no está creada
    }

    // 2. Si la base de datos no tiene roles aún, usar el catálogo canónico tipado
    let rolesList: RoleModel[] = [];

    if (dbRoles.length > 0) {
      rolesList = dbRoles.map((r: any) => {
        const permCodes = (r.role_permissions || [])
          .map((rp: any) => rp.permissions?.code)
          .filter(Boolean);

        return {
          id: r.id,
          code: r.code,
          name: r.name,
          description: r.description || "",
          scope: r.scope,
          type: r.type,
          businessId: r.business_id,
          isSystemRole: r.is_system_role ?? (r.type === "system"),
          status: r.status || "active",
          permissionCount: permCodes.length > 0 ? permCodes.length : (DEFAULT_ROLE_PERMISSIONS_MAP[r.code]?.length || 0),
          permissions: permCodes.length > 0 ? permCodes : (DEFAULT_ROLE_PERMISSIONS_MAP[r.code] || []),
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        };
      });
    } else {
      // Construir a partir del catálogo
      const allCatalog = [...PLATFORM_ROLES_CATALOG, ...BUSINESS_ROLES_CATALOG];
      rolesList = allCatalog.map((c, idx) => ({
        id: c.code, // Fallback ID
        code: c.code,
        name: c.name,
        description: c.description,
        scope: c.scope,
        type: c.type,
        isSystemRole: c.isSystemImmutable,
        status: "active",
        permissionCount: DEFAULT_ROLE_PERMISSIONS_MAP[c.code]?.length || 0,
        permissions: DEFAULT_ROLE_PERMISSIONS_MAP[c.code] || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
    }

    // 3. Obtener conteo real de usuarios asignados por rol
    try {
      // Usuarios de plataforma
      const { data: platformUsers } = await supabase
        .from("users")
        .select("platform_role");

      // Usuarios de negocio
      const { data: businessMembers } = await supabase
        .from("business_users")
        .select("role_id, roles(code)");

      const userCountsByCode: Record<string, number> = {};

      if (platformUsers) {
        platformUsers.forEach((u: any) => {
          if (u.platform_role) {
            userCountsByCode[u.platform_role] = (userCountsByCode[u.platform_role] || 0) + 1;
          }
        });
      }

      if (businessMembers) {
        businessMembers.forEach((bm: any) => {
          const roleCode = bm.roles?.code;
          if (roleCode) {
            userCountsByCode[roleCode] = (userCountsByCode[roleCode] || 0) + 1;
          }
        });
      }

      rolesList = rolesList.map((r) => ({
        ...r,
        userCount: userCountsByCode[r.code] || 0,
      }));
    } catch {
      // Ignorar fallo de conteo
    }

    // 4. Aplicar filtros si se especificaron
    let filtered = rolesList;
    if (filters?.scope) {
      filtered = filtered.filter((r) => r.scope === filters.scope);
    }
    if (filters?.type) {
      filtered = filtered.filter((r) => r.type === filters.type);
    }
    if (filters?.search?.trim()) {
      const q = filters.search.toLowerCase().trim();
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
      );
    }

    return { success: true, data: filtered };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al obtener roles.";
    return { success: false, data: [], error: msg };
  }
}

/**
 * Obtener el detalle de un rol específico con usuarios asignados y permisos
 */
export async function getRoleDetailAction(roleIdOrCode: string): Promise<{
  success: boolean;
  role?: RoleModel;
  assignedUsers?: Array<{
    id: string;
    email: string;
    fullName?: string;
    status: string;
    joinedAt?: string;
  }>;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // 1. Consultar rol en la base de datos
    let roleData: any = null;
    try {
      const { data } = await supabase
        .from("roles")
        .select(`
          id,
          code,
          name,
          description,
          scope,
          type,
          business_id,
          is_system_role,
          status,
          created_at,
          updated_at,
          role_permissions(permission_id, permissions(code))
        `)
        .or(`id.eq.${roleIdOrCode},code.eq.${roleIdOrCode}`)
        .maybeSingle();

      roleData = data;
    } catch {
      // fallback
    }

    let role: RoleModel;
    let assignedPermissionCodes: string[] = [];

    if (roleData) {
      assignedPermissionCodes = (roleData.role_permissions || [])
        .map((rp: any) => rp.permissions?.code)
        .filter(Boolean);

      if (assignedPermissionCodes.length === 0) {
        assignedPermissionCodes = DEFAULT_ROLE_PERMISSIONS_MAP[roleData.code] || [];
      }

      role = {
        id: roleData.id,
        code: roleData.code,
        name: roleData.name,
        description: roleData.description || "",
        scope: roleData.scope,
        type: roleData.type,
        businessId: roleData.business_id,
        isSystemRole: roleData.is_system_role ?? (roleData.type === "system"),
        status: roleData.status || "active",
        permissionCount: assignedPermissionCodes.length,
        permissions: assignedPermissionCodes,
        createdAt: roleData.created_at,
        updatedAt: roleData.updated_at,
      };
    } else {
      // Fallback a catálogo canónico
      const allCatalog = [...PLATFORM_ROLES_CATALOG, ...BUSINESS_ROLES_CATALOG];
      const match = allCatalog.find((c) => c.code === roleIdOrCode);
      if (!match) {
        return { success: false, error: "El rol solicitado no existe." };
      }

      assignedPermissionCodes = DEFAULT_ROLE_PERMISSIONS_MAP[match.code] || [];
      role = {
        id: match.code,
        code: match.code,
        name: match.name,
        description: match.description,
        scope: match.scope,
        type: match.type,
        isSystemRole: match.isSystemImmutable,
        status: "active",
        permissionCount: assignedPermissionCodes.length,
        permissions: assignedPermissionCodes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // 2. Consultar usuarios asignados reales
    const assignedUsers: Array<{
      id: string;
      email: string;
      fullName?: string;
      status: string;
      joinedAt?: string;
    }> = [];

    try {
      if (role.scope === "platform") {
        const { data: usersData } = await supabase
          .from("users")
          .select("id, email, status, created_at, profiles(full_name)")
          .eq("platform_role", role.code)
          .limit(25);

        if (usersData) {
          usersData.forEach((u: any) => {
            assignedUsers.push({
              id: u.id,
              email: u.email || "",
              fullName: u.profiles?.full_name || undefined,
              status: u.status || "active",
              joinedAt: u.created_at,
            });
          });
        }
      } else {
        // Ámbito negocio: buscar en business_users
        const { data: bUsers } = await supabase
          .from("business_users")
          .select("user_id, status, created_at, users(email, profiles(full_name)), roles!inner(code)")
          .eq("roles.code", role.code)
          .limit(25);

        if (bUsers) {
          bUsers.forEach((bu: any) => {
            assignedUsers.push({
              id: bu.user_id,
              email: bu.users?.email || "",
              fullName: bu.users?.profiles?.full_name || undefined,
              status: bu.status || "active",
              joinedAt: bu.created_at,
            });
          });
        }
      }
    } catch {
      // Ignorar fallo de consulta de usuarios
    }

    role.userCount = assignedUsers.length;

    return {
      success: true,
      role,
      assignedUsers,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al obtener detalle del rol.";
    return { success: false, error: msg };
  }
}

/**
 * Actualizar los permisos asociados a un rol
 */
export async function updateRolePermissionsAction(
  roleIdOrCode: string,
  newPermissionCodes: string[]
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // 1. Validar autorización de super_admin en servidor
    const { userId } = await verifyUserPermission("roles.manage");
    const supabase = await createClient();

    // 2. Obtener el rol destino
    let roleRow: any = null;
    try {
      const { data } = await supabase
        .from("roles")
        .select("id, code, name, scope, type")
        .or(`id.eq.${roleIdOrCode},code.eq.${roleIdOrCode}`)
        .maybeSingle();

      roleRow = data;
    } catch {
      // fallback
    }

    const roleCode = roleRow?.code || roleIdOrCode;
    const roleId = roleRow?.id;

    // 3. Validar integridad de super_admin (no quitar permisos críticos)
    const integrityCheck = await validateSuperAdminIntegrity(
      roleId || roleCode,
      roleCode,
      newPermissionCodes
    );
    if (!integrityCheck.valid) {
      return { success: false, error: integrityCheck.error };
    }

    // 4. Si la tabla roles y role_permissions existe en la BD, persistir cambios
    if (process.env.SUPABASE_SERVICE_ROLE_KEY && roleId) {
      const { createClient: createAdminClient } = await import("@supabase/supabase-js");
      const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Obtener los IDs de los permisos correspondientes a los códigos seleccionados
      const { data: permissionsRows } = await supabaseAdmin
        .from("permissions")
        .select("id, code")
        .in("code", newPermissionCodes);

      if (permissionsRows) {
        // Borrar asociaciones previas
        await supabaseAdmin
          .from("role_permissions")
          .delete()
          .eq("role_id", roleId);

        // Insertar nuevas asociaciones
        if (permissionsRows.length > 0) {
          const insertPayload = permissionsRows.map((p) => ({
            role_id: roleId,
            permission_id: p.id,
          }));

          await supabaseAdmin.from("role_permissions").insert(insertPayload);
        }
      }

      // Registrar en audit_logs
      try {
        await supabaseAdmin.from("audit_logs").insert({
          user_id: userId,
          action: "role.permissions.updated",
          details: {
            roleCode,
            roleId,
            permissionsCount: newPermissionCodes.length,
            permissions: newPermissionCodes,
            timestamp: new Date().toISOString(),
          },
        });
      } catch {
        // Ignorar si audit_logs no está disponible
      }
    }

    // 5. Revalidar rutas administrativas
    revalidatePath("/admin/roles");
    revalidatePath(`/admin/roles/${roleIdOrCode}`);

    return {
      success: true,
      message: `La matriz de permisos del rol '${roleRow?.name || roleCode}' ha sido actualizada exitosamente (${newPermissionCodes.length} permisos asignados).`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error inesperado al guardar los permisos.";
    return { success: false, error: msg };
  }
}

/**
 * Actualizar metadata descriptiva del rol
 */
export async function updateRoleMetadataAction(
  roleIdOrCode: string,
  data: { name?: string; description?: string }
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const { userId } = await verifyUserPermission("roles.manage");
    const supabase = await createClient();

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { createClient: createAdminClient } = await import("@supabase/supabase-js");
      const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      await supabaseAdmin
        .from("roles")
        .update({
          ...(data.description !== undefined ? { description: data.description } : {}),
          updated_at: new Date().toISOString(),
        })
        .or(`id.eq.${roleIdOrCode},code.eq.${roleIdOrCode}`);

      // Registrar auditoría
      try {
        await supabaseAdmin.from("audit_logs").insert({
          user_id: userId,
          action: "role.updated",
          details: {
            roleIdOrCode,
            changes: data,
            timestamp: new Date().toISOString(),
          },
        });
      } catch {
        // ignorar
      }
    }

    revalidatePath("/admin/roles");
    revalidatePath(`/admin/roles/${roleIdOrCode}`);

    return {
      success: true,
      message: "Información del rol actualizada exitosamente.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al actualizar información del rol.";
    return { success: false, error: msg };
  }
}
