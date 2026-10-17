"use server";

import { verifyUserPermission } from "@/lib/auth/authorization";
import {
  BUSINESS_ROLES_CATALOG,
  DEFAULT_ROLE_PERMISSIONS_MAP,
  RoleModel,
  getDefaultPermissionsForRoleAndBusinessType,
  isPermissionCompatibleWithBusinessType,
} from "@/lib/auth/permissions";

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
 * SERVER ACTION: OBTENER ROLES Y PERMISOS DEL ESPACIO DE TRABAJO
 * Estrictamente limitado al negocio actual y solo a los roles canónicos de negocio: 'owner' y 'auxiliar',
 * adaptando los permisos según el vertical/tipo de negocio del comercio.
 */
export async function getWorkspaceRolesAction(
  businessId: string
): Promise<{ success: boolean; data?: RoleModel[]; businessType?: string; error?: string }> {
  try {
    // 1. Validar autorización multi-tenant server-side
    await verifyUserPermission("business_users.view", { businessId });

    // Validar formato UUID para evitar inyecciones o parámetros inválidos
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      businessId
    );
    if (!isUuid) {
      return { success: false, error: "Identificador de negocio inválido." };
    }

    const adminClient = await getSupabaseAdminClient();

    // 2. Consultar información del negocio para conocer su vertical
    const { data: businessData } = await adminClient
      .from("businesses")
      .select("id, name, business_type")
      .eq("id", businessId)
      .maybeSingle();

    const businessType = businessData?.business_type || "restaurant";

    // 3. Consultar conteo de usuarios por rol ÚNICAMENTE dentro de este negocio
    const { data: businessMembers, error: membersErr } = await adminClient
      .from("business_users")
      .select("role_id, status, roles(id, code, name)")
      .eq("business_id", businessId);

    if (membersErr) {
      console.error("[getWorkspaceRolesAction members query error]:", membersErr);
    }

    const userCountByRoleCode: Record<string, number> = {
      owner: 0,
      auxiliar: 0,
    };

    (businessMembers || []).forEach((bm: any) => {
      const code = bm.roles?.code;
      if (code === "owner") {
        userCountByRoleCode.owner = (userCountByRoleCode.owner || 0) + 1;
      } else if (code === "auxiliar" || code === "business_admin" || code === "supervisor" || code === "seller" || code === "cashier") {
        // En el alcance canónico de Workspace, todos los empleados operativos corresponden a Auxiliar
        userCountByRoleCode.auxiliar = (userCountByRoleCode.auxiliar || 0) + 1;
      }
    });

    // 4. Consultar roles y permisos reales en la base de datos
    let dbRoles: any[] = [];
    try {
      const { data: rolesData } = await adminClient
        .from("roles")
        .select(`
          id,
          code,
          name,
          description,
          scope,
          type,
          is_system_role,
          status,
          created_at,
          updated_at,
          role_permissions(permission_id, permissions(code))
        `)
        .eq("scope", "business")
        .in("code", ["owner", "auxiliar"]);

      if (rolesData && rolesData.length > 0) {
        dbRoles = rolesData;
      }
    } catch (dbErr) {
      console.warn("[getWorkspaceRolesAction DB fallback]:", dbErr);
    }

    // 5. Mapear estrictamente los 2 roles permitidos: 'owner' y 'auxiliar' contextualizados al tipo de negocio
    const canonicalBusinessRoles = BUSINESS_ROLES_CATALOG.filter(
      (r) => r.code === "owner" || r.code === "auxiliar"
    );

    const rolesList: RoleModel[] = canonicalBusinessRoles.map((catalogItem) => {
      const dbMatch = dbRoles.find((r) => r.code === catalogItem.code);

      let permissionCodes: string[] = [];
      if (dbMatch?.role_permissions && dbMatch.role_permissions.length > 0) {
        permissionCodes = dbMatch.role_permissions
          .map((rp: any) => rp.permissions?.code)
          .filter((code: string) => isPermissionCompatibleWithBusinessType(code, businessType));
      }

      // Si no tiene permisos asociados en BD o es owner, usar la matriz por defecto adaptada al tipo de negocio
      if (permissionCodes.length === 0) {
        permissionCodes = getDefaultPermissionsForRoleAndBusinessType(catalogItem.code, businessType);
      }

      return {
        id: dbMatch?.id || catalogItem.code,
        code: catalogItem.code,
        name: catalogItem.name,
        description: dbMatch?.description || catalogItem.description,
        scope: "business",
        type: "system",
        businessId,
        isSystemRole: true,
        status: "active",
        userCount: userCountByRoleCode[catalogItem.code] || 0,
        permissionCount: permissionCodes.length,
        permissions: permissionCodes,
        createdAt: dbMatch?.created_at || new Date().toISOString(),
        updatedAt: dbMatch?.updated_at || new Date().toISOString(),
      };
    });

    return {
      success: true,
      data: rolesList,
      businessType,
    };
  } catch (err: any) {
    console.error("[getWorkspaceRolesAction Error]:", err);
    return {
      success: false,
      error: err?.message || "Error al obtener los roles del negocio.",
    };
  }
}

/**
 * PROTECCIÓN SERVER-SIDE: Mutaciones prohibidas en Workspace
 */
export async function updateWorkspaceRoleAction(): Promise<{
  success: boolean;
  error: string;
}> {
  return {
    success: false,
    error:
      "Operación no permitida: Los roles de sistema de NEGOVA son inmutables para garantizar la integridad operativa y fiscal del negocio.",
  };
}
