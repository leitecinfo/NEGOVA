import { createClient } from "@/lib/supabase/server";
import {
  UserListFilters,
  UserListResult,
  UserModel,
  UserStatus,
  BusinessMembershipDetail,
  toDbMembershipStatus,
  fromDbUserStatus,
} from "./users-service";
import { PLATFORM_ROLES_CATALOG, BUSINESS_ROLES_CATALOG } from "./permissions";

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
 * Consulta paginada y filtrada del directorio de usuarios de un negocio específico.
 * Estrictamente aislado por businessId.
 */
export async function getWorkspaceUsersList(businessId: string, filters: UserListFilters = {}): Promise<UserListResult> {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.max(1, Math.min(100, filters.pageSize || 10));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const adminClient = await getSupabaseAdminClient();

  // 1. Obtener SÓLO las membresías del negocio actual
  let buQuery = adminClient
    .from("business_users")
    .select("user_id", { count: "exact" })
    .eq("business_id", businessId);
    
  if (filters.status && filters.status !== "all") {
    buQuery = buQuery.eq("status", toDbMembershipStatus(filters.status));
  }
  
  if (filters.roleCode && filters.roleCode !== "all") {
    // Si queremos filtrar por rol en DB... aunque luego lo hacemos en memoria.
  }

  const { data: businessUsersIdData, error: buErr } = await buQuery;
  
  if (buErr) {
    throw new Error(`Error al consultar membresías del negocio: ${buErr.message}`);
  }

  const userIdsInBusiness = (businessUsersIdData || []).map(bu => bu.user_id);
  
  if (userIdsInBusiness.length === 0) {
    return {
      users: [],
      total: 0,
      page,
      pageSize,
      totalPages: 1,
      stats: { total: 0, platformCount: 0, businessCount: 0, activeCount: 0, disabledCount: 0 },
    };
  }

  // 2. Obtener usuarios de public.users
  const { data: dbUsers, error: usersErr } = await adminClient
    .from("users")
    .select(`
      id,
      email,
      platform_role,
      status,
      last_login_at,
      created_at,
      updated_at
    `)
    .in("id", userIdsInBusiness)
    .order("created_at", { ascending: false });

  if (usersErr) {
    throw new Error(`Error al consultar usuarios del negocio: ${usersErr.message}`);
  }

  // 3. Consultar perfiles (nombres, teléfonos, avatares)
  const { data: profiles } = await adminClient
    .from("profiles")
    .select("id, full_name, phone, avatar_url, bio")
    .in("id", userIdsInBusiness);

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  // 4. Consultar membresías de negocios con datos del negocio y del rol
  const { data: businessUsersDetails } = await adminClient
    .from("business_users")
    .select(`
      id,
      user_id,
      business_id,
      role_id,
      status,
      invited_at,
      joined_at,
      businesses!inner(id, name, slug),
      roles(id, code, name, scope)
    `)
    .eq("business_id", businessId) // ESTRICTO
    .in("user_id", userIdsInBusiness);

  const membershipsMap = new Map<string, BusinessMembershipDetail[]>();
  (businessUsersDetails || []).forEach((bu: any) => {
    const existing = membershipsMap.get(bu.user_id) || [];
    existing.push({
      membershipId: bu.id,
      businessId: bu.business_id,
      businessName: bu.businesses?.name || "Negocio",
      businessSlug: bu.businesses?.slug || "",
      roleId: bu.role_id,
      roleCode: bu.roles?.code || "auxiliar",
      roleName: bu.roles?.name || "Auxiliar",
      status: fromDbUserStatus(bu.status),
      invitedAt: bu.invited_at,
      joinedAt: bu.joined_at,
    });
    membershipsMap.set(bu.user_id, existing);
  });

  // 5. Consultar identidades de Supabase Auth
  const { data: authData } = await adminClient.auth.admin.listUsers();
  const authUsersMap = new Map((authData?.users || []).map((au) => [au.id, au]));

  // 6. Mapear y clasificar
  let mappedUsers: UserModel[] = (dbUsers || []).map((u) => {
    const profile = profileMap.get(u.id);
    const memberships = membershipsMap.get(u.id) || [];
    const authUser = authUsersMap.get(u.id);
    
    // Todos son tipo 'business' dentro del scope del workspace, pero mantenemos compatibilidad del tipo UserModel
    const type = "business"; 
    
    // El rol primario en este contexto es el rol de este negocio
    const primaryRoleCode = memberships[0]?.roleCode || "auxiliar";
    const roleMeta = BUSINESS_ROLES_CATALOG.find(r => r.code === primaryRoleCode) || { name: primaryRoleCode, badgeColor: "bg-slate-500/10 text-slate-600" };

    const resolvedStatus = fromDbUserStatus(memberships[0]?.status || u.status);

    return {
      id: u.id,
      email: u.email || authUser?.email || "",
      fullName: profile?.full_name || authUser?.user_metadata?.full_name || u.email?.split("@")[0] || "Usuario",
      phone: profile?.phone || authUser?.user_metadata?.phone || null,
      avatarUrl: profile?.avatar_url || null,
      bio: profile?.bio || null,
      type,
      platformRole: u.platform_role || "customer",
      status: resolvedStatus,
      mustChangePassword: Boolean((u as any).must_change_password || authUser?.user_metadata?.must_change_password),
      lastLoginAt: u.last_login_at || authUser?.last_sign_in_at || null,
      createdAt: u.created_at || authUser?.created_at || new Date().toISOString(),
      updatedAt: u.updated_at || authUser?.updated_at || new Date().toISOString(),
      businessMemberships: memberships,
      primaryRole: {
        code: primaryRoleCode,
        name: roleMeta.name,
        scope: "business",
        badgeColor: roleMeta.badgeColor,
      },
    };
  });

  // 7. Filtrar por búsqueda en memoria si aplica
  if (filters.search && filters.search.trim() !== "") {
    const s = filters.search.toLowerCase().trim();
    mappedUsers = mappedUsers.filter(
      (u) =>
        u.fullName.toLowerCase().includes(s) ||
        u.email.toLowerCase().includes(s) ||
        (u.phone && u.phone.includes(s))
    );
  }

  // Filtrado por rol de negocio
  if (filters.roleCode && filters.roleCode !== "all") {
    mappedUsers = mappedUsers.filter((u) => u.primaryRole.code === filters.roleCode);
  }

  // 8. Estadísticas
  const total = mappedUsers.length;
  const platformCount = 0; // En Workspace solo mostramos Business
  const businessCount = total;
  const activeCount = mappedUsers.filter((u) => u.status === "active").length;
  const disabledCount = mappedUsers.filter((u) => u.status === "disabled" || u.status === "inactive").length;

  // 9. Paginar en memoria
  const paginatedUsers = mappedUsers.slice(from, to + 1);
  const totalPages = Math.ceil(total / pageSize) || 1;

  return {
    users: paginatedUsers,
    total,
    page,
    pageSize,
    totalPages,
    stats: {
      total,
      platformCount,
      businessCount,
      activeCount,
      disabledCount,
    },
  };
}
