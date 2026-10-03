/**
 * NEGOVA Users & Membership Backend Service
 * 
 * Reglas de Arquitectura:
 * 1. Separación estricta de contextos (Plataforma vs Negocios).
 * 2. Validación de cuotas de usuarios según el plan activo del negocio.
 * 3. Protección inquebrantable del rol Super Administrador.
 * 4. Manejo seguro de contraseñas temporales y flags must_change_password.
 * 5. Registro forense de auditoría en todas las operaciones críticas.
 */

import { createClient } from "@/lib/supabase/server";
import {
  PLATFORM_ROLES_CATALOG,
  BUSINESS_ROLES_CATALOG,
  DEFAULT_ROLE_PERMISSIONS_MAP,
  RoleScope,
} from "./permissions";
import { NEGOVA_PLANS, PlanId } from "@/config/plans";

export type UserType = "platform" | "business";
export type UserStatus = "active" | "invited" | "disabled" | "blocked" | "inactive" | "suspended";

export interface BusinessMembershipDetail {
  membershipId: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  status: string;
  invitedAt: string | null;
  joinedAt: string | null;
}

export interface UserModel {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  bio: string | null;
  type: UserType;
  platformRole: string | null;
  status: UserStatus;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  businessMemberships: BusinessMembershipDetail[];
  primaryRole: {
    code: string;
    name: string;
    scope: RoleScope;
    badgeColor: string;
  };
  effectivePermissions?: string[];
}

export interface UserListFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  scope?: "all" | "platform" | "business";
  status?: string;
  roleCode?: string;
  businessId?: string;
}

export interface UserListResult {
  users: UserModel[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: {
    total: number;
    platformCount: number;
    businessCount: number;
    activeCount: number;
    disabledCount: number;
  };
}

export interface CreateUserInput {
  email: string;
  fullName: string;
  phone?: string;
  type: UserType;
  status?: UserStatus;
  roleCode: string;
  businessId?: string;
  password?: string;
  mustChangePassword?: boolean;
}

/**
 * Obtener cliente administrativo Supabase (Service Role) con privilegios de gestión
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
 * Obtener badge de estilo para un código de rol
 */
function getRoleBadge(code: string, scope: RoleScope): { name: string; badgeColor: string } {
  if (scope === "platform") {
    const found = PLATFORM_ROLES_CATALOG.find((r) => r.code === code);
    if (found) return { name: found.name, badgeColor: found.badgeColor };
  } else {
    const found = BUSINESS_ROLES_CATALOG.find((r) => r.code === code);
    if (found) return { name: found.name, badgeColor: found.badgeColor };
  }

  return {
    name: code,
    badgeColor: "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400",
  };
}

/**
 * 1. CONSULTA PAGINADA Y FILTRADA DEL DIRECTORIO DE USUARIOS
 */
export async function getUsersList(filters: UserListFilters = {}): Promise<UserListResult> {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.max(1, Math.min(100, filters.pageSize || 10));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const adminClient = await getSupabaseAdminClient();

  // 1. Obtener todos los perfiles de usuarios sincronizados
  let query = adminClient
    .from("users")
    .select(`
      id,
      email,
      platform_role,
      status,
      last_login_at,
      created_at,
      updated_at
    `, { count: "exact" });

  // Filtrado por estado si se especifica
  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  // Filtrado por rol de plataforma si se busca un rol específico
  if (filters.roleCode && filters.scope === "platform") {
    query = query.eq("platform_role", filters.roleCode);
  }

  // Ordenar por fecha de creación descendente
  query = query.order("created_at", { ascending: false });

  const { data: dbUsers, error: usersErr, count: totalCount } = await query;

  if (usersErr) {
    console.error("[getUsersList Error]:", usersErr);
    throw new Error(`Error al consultar usuarios: ${usersErr.message}`);
  }

  const userIds = (dbUsers || []).map((u) => u.id);

  // 2. Consultar perfiles (nombres, teléfonos, avatares)
  const { data: profiles } = await adminClient
    .from("profiles")
    .select("id, full_name, phone, avatar_url, bio")
    .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  // 3. Consultar membresías de negocios con datos del negocio y del rol
  const { data: businessUsers } = await adminClient
    .from("business_users")
    .select(`
      id,
      user_id,
      business_id,
      role_id,
      status,
      invited_at,
      joined_at,
      businesses(id, name, slug),
      roles(id, code, name, scope)
    `)
    .in("user_id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  // Mapear membresías por user_id
  const membershipsMap = new Map<string, BusinessMembershipDetail[]>();
  (businessUsers || []).forEach((bu: any) => {
    const existing = membershipsMap.get(bu.user_id) || [];
    existing.push({
      membershipId: bu.id,
      businessId: bu.business_id,
      businessName: bu.businesses?.name || "Negocio",
      businessSlug: bu.businesses?.slug || "",
      roleId: bu.role_id,
      roleCode: bu.roles?.code || "auxiliar",
      roleName: bu.roles?.name || "Auxiliar",
      status: bu.status || "active",
      invitedAt: bu.invited_at,
      joinedAt: bu.joined_at,
    });
    membershipsMap.set(bu.user_id, existing);
  });

  // 4. Consultar identidades de Supabase Auth para resolver metadatos de roles
  const { data: authData } = await adminClient.auth.admin.listUsers();
  const authUsersMap = new Map((authData?.users || []).map((au) => [au.id, au]));

  // 5. Mapear y clasificar cada usuario
  let mappedUsers: UserModel[] = (dbUsers || []).map((u) => {
    const profile = profileMap.get(u.id);
    const memberships = membershipsMap.get(u.id) || [];
    const authUser = authUsersMap.get(u.id);
    const authRole = authUser?.app_metadata?.role || authUser?.user_metadata?.role;

    const resolvedPlatformRole =
      u.platform_role === "super_admin" || u.platform_role === "admin"
        ? u.platform_role
        : authRole === "super_admin" || authRole === "admin"
          ? authRole
          : (u.platform_role || "customer");

    const isPlatform = ["super_admin", "admin"].includes(resolvedPlatformRole);

    const type: UserType = isPlatform ? "platform" : "business";
    const primaryRoleCode = isPlatform
      ? resolvedPlatformRole
      : memberships[0]?.roleCode || "auxiliar";
    const roleMeta = getRoleBadge(primaryRoleCode, isPlatform ? "platform" : "business");

    return {
      id: u.id,
      email: u.email || authUser?.email || "",
      fullName: profile?.full_name || authUser?.user_metadata?.full_name || u.email?.split("@")[0] || "Usuario",
      phone: profile?.phone || authUser?.user_metadata?.phone || null,
      avatarUrl: profile?.avatar_url || null,
      bio: profile?.bio || null,
      type,
      platformRole: resolvedPlatformRole,
      status: (u.status || "active") as UserStatus,
      mustChangePassword: Boolean((u as any).must_change_password || authUser?.user_metadata?.must_change_password),
      lastLoginAt: u.last_login_at || authUser?.last_sign_in_at || null,
      createdAt: u.created_at || authUser?.created_at || new Date().toISOString(),
      updatedAt: u.updated_at || authUser?.updated_at || new Date().toISOString(),
      businessMemberships: memberships,
      primaryRole: {
        code: primaryRoleCode,
        name: roleMeta.name,
        scope: isPlatform ? "platform" : "business",
        badgeColor: roleMeta.badgeColor,
      },
    };
  });

  // 5. Filtrar por búsqueda en memoria si aplica (nombre, email, teléfono)
  if (filters.search && filters.search.trim() !== "") {
    const s = filters.search.toLowerCase().trim();
    mappedUsers = mappedUsers.filter(
      (u) =>
        u.fullName.toLowerCase().includes(s) ||
        u.email.toLowerCase().includes(s) ||
        (u.phone && u.phone.includes(s)) ||
        u.businessMemberships.some((bm) => bm.businessName.toLowerCase().includes(s))
    );
  }

  // 6. Filtrar por ámbito (Plataforma vs Negocio)
  if (filters.scope === "platform") {
    mappedUsers = mappedUsers.filter((u) => u.type === "platform");
  } else if (filters.scope === "business") {
    mappedUsers = mappedUsers.filter((u) => u.type === "business");
  }

  // 7. Filtrar por negocio específico
  if (filters.businessId && filters.businessId !== "all") {
    mappedUsers = mappedUsers.filter((u) =>
      u.businessMemberships.some((bm) => bm.businessId === filters.businessId)
    );
  }

  // 8. Estadísticas globales del conjunto
  const total = mappedUsers.length;
  const platformCount = mappedUsers.filter((u) => u.type === "platform").length;
  const businessCount = mappedUsers.filter((u) => u.type === "business").length;
  const activeCount = mappedUsers.filter((u) => u.status === "active").length;
  const disabledCount = mappedUsers.filter((u) => u.status === "disabled" || u.status === "inactive").length;

  // Paginación sobre el conjunto filtrado
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

/**
 * 2. CONSULTAR DETALLE DE UN USUARIO (CON PERMISOS EFECTIVOS Y AUDITORÍA)
 */
export async function getUserDetail(userId: string): Promise<{
  user: UserModel;
  effectivePermissions: string[];
  auditLogs: any[];
}> {
  const adminClient = await getSupabaseAdminClient();

  // 1. Consultar usuario base
  const { data: dbUser, error: userErr } = await adminClient
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (userErr || !dbUser) {
    throw new Error(`Usuario con ID ${userId} no encontrado.`);
  }

  // 2. Consultar perfil
  const { data: profile } = await adminClient
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  // 3. Consultar membresías de negocios con rol y datos de negocio
  const { data: businessUsers } = await adminClient
    .from("business_users")
    .select(`
      id,
      business_id,
      role_id,
      status,
      invited_at,
      joined_at,
      businesses(id, name, slug, status, logo_url),
      roles(id, code, name, scope)
    `)
    .eq("user_id", userId);

  const memberships: BusinessMembershipDetail[] = (businessUsers || []).map((bu: any) => ({
    membershipId: bu.id,
    businessId: bu.business_id,
    businessName: bu.businesses?.name || "Negocio",
    businessSlug: bu.businesses?.slug || "",
    roleId: bu.role_id,
    roleCode: bu.roles?.code || "auxiliar",
    roleName: bu.roles?.name || "Auxiliar",
    status: bu.status || "active",
    invitedAt: bu.invited_at,
    joinedAt: bu.joined_at,
  }));

  // Consultar metadatos en Supabase Auth
  const { data: authUserData } = await adminClient.auth.admin.getUserById(userId);
  const authUser = authUserData?.user;
  const authRole = authUser?.app_metadata?.role || authUser?.user_metadata?.role;

  const resolvedPlatformRole =
    dbUser.platform_role === "super_admin" || dbUser.platform_role === "admin"
      ? dbUser.platform_role
      : authRole === "super_admin" || authRole === "admin"
        ? authRole
        : (dbUser.platform_role || "customer");

  const isPlatform = ["super_admin", "admin"].includes(resolvedPlatformRole);
  const type: UserType = isPlatform ? "platform" : "business";
  const primaryRoleCode = isPlatform ? resolvedPlatformRole : memberships[0]?.roleCode || "auxiliar";
  const roleMeta = getRoleBadge(primaryRoleCode, isPlatform ? "platform" : "business");

  // 4. Calcular Permisos Efectivos
  let effectivePermissions: string[] = [];
  if (isPlatform) {
    if (primaryRoleCode === "super_admin") {
      effectivePermissions = DEFAULT_ROLE_PERMISSIONS_MAP["super_admin"] || [];
    } else {
      // Consultar permisos del rol en BD
      const { data: roleRow } = await adminClient
        .from("roles")
        .select("role_permissions(permissions(code))")
        .eq("code", primaryRoleCode)
        .eq("scope", "platform")
        .maybeSingle();

      if (roleRow?.role_permissions && roleRow.role_permissions.length > 0) {
        effectivePermissions = roleRow.role_permissions
          .map((rp: any) => rp.permissions?.code)
          .filter(Boolean);
      } else {
        effectivePermissions = DEFAULT_ROLE_PERMISSIONS_MAP[primaryRoleCode] || [];
      }
    }
  } else if (memberships.length > 0) {
    const roleId = memberships[0].roleId;
    const { data: rolePermissions } = await adminClient
      .from("role_permissions")
      .select("permissions(code)")
      .eq("role_id", roleId);

    if (rolePermissions && rolePermissions.length > 0) {
      effectivePermissions = rolePermissions
        .map((rp: any) => rp.permissions?.code)
        .filter(Boolean);
    } else {
      effectivePermissions = DEFAULT_ROLE_PERMISSIONS_MAP[primaryRoleCode] || [];
    }
  }

  // 5. Consultar logs de auditoría relacionados a este usuario
  const { data: logs } = await adminClient
    .from("audit_logs")
    .select("*")
    .or(`user_id.eq.${userId},entity_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(20);

  const userModel: UserModel = {
    id: dbUser.id,
    email: dbUser.email || authUser?.email || "",
    fullName: profile?.full_name || authUser?.user_metadata?.full_name || dbUser.email?.split("@")[0] || "Usuario",
    phone: profile?.phone || authUser?.user_metadata?.phone || null,
    avatarUrl: profile?.avatar_url || null,
    bio: profile?.bio || null,
    type,
    platformRole: resolvedPlatformRole,
    status: (dbUser.status || "active") as UserStatus,
    mustChangePassword: Boolean(authUser?.user_metadata?.must_change_password),
    lastLoginAt: dbUser.last_login_at || authUser?.last_sign_in_at || null,
    createdAt: dbUser.created_at || authUser?.created_at || new Date().toISOString(),
    updatedAt: dbUser.updated_at || authUser?.updated_at || new Date().toISOString(),
    businessMemberships: memberships,
    primaryRole: {
      code: primaryRoleCode,
      name: roleMeta.name,
      scope: isPlatform ? "platform" : "business",
      badgeColor: roleMeta.badgeColor,
    },
    effectivePermissions,
  };

  return {
    user: userModel,
    effectivePermissions,
    auditLogs: logs || [],
  };
}

/**
 * 3. VALIDACIÓN DE CUOTA DE USUARIOS DE UN NEGOCIO SEGÚN PLAN ACTIVO
 */
export async function checkBusinessPlanUserCapacity(businessId: string): Promise<{
  canAddUser: boolean;
  currentUsers: number;
  maxUsers: number;
  planName: string;
  planCode: string;
}> {
  const adminClient = await getSupabaseAdminClient();

  // 1. Obtener suscripción activa del negocio
  const { data: subscription } = await adminClient
    .from("subscriptions")
    .select(`
      id,
      status,
      plan_id,
      plans(id, code, name, limits)
    `)
    .eq("business_id", businessId)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 2. Determinar plan y límites desde la fuente central de verdad (src/config/plans.ts)
  let planKey: PlanId = "inicio";
  let planName = "Plan Inicio";
  let maxUsers = 1;

  if (subscription?.plans) {
    const planObj = subscription.plans as any;
    const codeLower = (planObj.code || "").toLowerCase();
    if (codeLower.includes("crece")) {
      planKey = "crece";
    } else if (codeLower.includes("negocio")) {
      planKey = "negocio";
    } else {
      planKey = "inicio";
    }
    const configPlan = NEGOVA_PLANS[planKey];
    planName = configPlan?.name || planObj.name || "Inicio";
    maxUsers = configPlan?.limits?.maxUsers || (planObj.limits?.maxUsers ?? 1);
  } else {
    // Si no tiene suscripción registrada, aplica tier base (Inicio)
    const basePlan = NEGOVA_PLANS.inicio;
    planName = basePlan.name;
    maxUsers = basePlan.limits.maxUsers;
  }

  // 3. Contar miembros actuales en el negocio
  const { count: currentUsers } = await adminClient
    .from("business_users")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .neq("status", "inactive");

  const totalMembers = currentUsers || 0;
  const canAddUser = totalMembers < maxUsers;

  return {
    canAddUser,
    currentUsers: totalMembers,
    maxUsers,
    planName,
    planCode: planKey,
  };
}

/**
 * Genera una contraseña temporal segura que cumple con todas las políticas de complejidad
 * (mínimo 14 caracteres, mayúsculas, minúsculas, números y caracteres especiales).
 */
export function generateSecurePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%&*";
  const allChars = upper + lower + numbers + symbols;

  const sample = [
    upper[Math.floor(Math.random() * upper.length)],
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    lower[Math.floor(Math.random() * lower.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];

  while (sample.length < 14) {
    sample.push(allChars[Math.floor(Math.random() * allChars.length)]);
  }

  for (let i = sample.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sample[i], sample[j]] = [sample[j], sample[i]];
  }

  return sample.join("");
}

/**
 * 4. CREACIÓN DE USUARIO MANUAL (SUPABASE AUTH + PROFILE + MEMBERSHIP)
 */
export async function createUser(
  input: CreateUserInput,
  actorId?: string
): Promise<{ success: boolean; user?: UserModel; temporaryPassword?: string; error?: string }> {
  try {
    const adminClient = await getSupabaseAdminClient();

    // 1. Sanitizar y validar email
    const email = input.email.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return { success: false, error: "El correo electrónico proporcionado no es válido." };
    }

    const fullName = input.fullName.trim();
    if (!fullName || fullName.length < 2) {
      return { success: false, error: "El nombre completo debe tener al menos 2 caracteres." };
    }

    // 2. Comprobar si el email ya existe en public.users
    const { data: existingUser } = await adminClient
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      return {
        success: false,
        error: "Ya existe un usuario registrado con este correo electrónico.",
      };
    }

    // 3. Validar Rol y Ámbito
    let roleRow: any = null;
    if (input.type === "platform") {
      // Solo roles de plataforma
      const validPlatformRoles = PLATFORM_ROLES_CATALOG.map((r) => r.code);
      if (!validPlatformRoles.includes(input.roleCode as any)) {
        return {
          success: false,
          error: `El rol '${input.roleCode}' no es válido para una cuenta de Plataforma NEGOVA.`,
        };
      }

      // Protección contra escalación de privilegios: solo super_admin puede crear super_admin
      if (input.roleCode === "super_admin" && actorId) {
        const { data: actorUser } = await adminClient
          .from("users")
          .select("platform_role, status")
          .eq("id", actorId)
          .maybeSingle();

        if (actorUser?.platform_role !== "super_admin" || actorUser?.status !== "active") {
          return {
            success: false,
            error: "Acceso denegado: Únicamente un Super Administrador activo puede dar de alta a otro Super Administrador.",
          };
        }
      }
    } else {
      // Usuario de Negocio -> Validar que el rol pertenezca al catálogo de negocio
      const validBusinessRoles = BUSINESS_ROLES_CATALOG.map((r) => r.code);
      if (!validBusinessRoles.includes(input.roleCode as any)) {
        return {
          success: false,
          error: `El rol '${input.roleCode}' no es válido para un usuario de negocio.`,
        };
      }
    }

    // 4. Generar o recibir contraseña temporal
    let temporaryPassword = input.password?.trim();
    if (!temporaryPassword || temporaryPassword.length < 8) {
      temporaryPassword = generateSecurePassword();
    }

    const mustChangePassword = input.mustChangePassword !== false; // Por defecto true

    // 5. Crear Identidad en Supabase Auth Admin
    const { data: authCreated, error: authErr } = await adminClient.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone: input.phone || null,
        role: input.roleCode,
        must_change_password: mustChangePassword,
      },
      app_metadata: {
        role: input.roleCode,
      },
    });

    if (authErr || !authCreated?.user) {
      console.error("[Auth Admin createUser Error]:", authErr);
      return {
        success: false,
        error: authErr?.message || "No fue posible crear la identidad del usuario en Supabase Auth.",
      };
    }

    const newUserId = authCreated.user.id;

    // 6. Insertar / Actualizar registro en public.users
    const platformRole = input.type === "platform" ? input.roleCode : "customer";
    const userStatus = input.status || "active";

    const { error: userUpsertErr } = await adminClient
      .from("users")
      .upsert({
        id: newUserId,
        email,
        platform_role: platformRole,
        status: userStatus,
        must_change_password: mustChangePassword,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (userUpsertErr) {
      console.error("[public.users Upsert Error]:", userUpsertErr);
    }

    // 7. Insertar registro en public.profiles
    const { error: profileErr } = await adminClient
      .from("profiles")
      .upsert({
        id: newUserId,
        full_name: fullName,
        phone: input.phone || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (profileErr) {
      console.error("[public.profiles Upsert Error]:", profileErr);
    }

    // 8. Registrar Auditoría Forense
    try {
      await adminClient.from("audit_logs").insert({
        user_id: actorId || null,
        action: "create",
        entity_type: "user",
        entity_id: newUserId,
        new_data: {
          email,
          fullName,
          type: input.type,
          roleCode: input.roleCode,
          status: userStatus,
          mustChangePassword,
        },
        metadata: {
          event: "user.created",
          created_by_actor: actorId || "system",
        },
      });
    } catch (auditErr) {
      console.warn("[Audit Log non-fatal error]:", auditErr);
    }

    // Obtener modelo final para respuesta
    const detail = await getUserDetail(newUserId);

    return {
      success: true,
      user: detail.user,
      temporaryPassword,
    };
  } catch (err: any) {
    console.error("[createUser Exception]:", err);
    return {
      success: false,
      error: err?.message || "Ocurrió un error inesperado al procesar la creación de usuario.",
    };
  }
}

/**
 * 5. ACTUALIZAR PERFIL DE USUARIO (DATOS GENERALES)
 */
export async function updateUserProfile(
  userId: string,
  data: { fullName: string; phone?: string; bio?: string },
  actorId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = await getSupabaseAdminClient();

    const fullName = data.fullName.trim();
    if (!fullName) {
      return { success: false, error: "El nombre completo es requerido." };
    }

    // Actualizar profiles
    const { error: pErr } = await adminClient
      .from("profiles")
      .update({
        full_name: fullName,
        phone: data.phone || null,
        bio: data.bio || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (pErr) throw pErr;

    // Actualizar metadata de Supabase Auth
    await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: { full_name: fullName, phone: data.phone || null },
    });

    // Auditoría
    await adminClient.from("audit_logs").insert({
      user_id: actorId || null,
      action: "update",
      entity_type: "user",
      entity_id: userId,
      new_data: { fullName, phone: data.phone, bio: data.bio },
      metadata: { event: "user.updated" },
    });

    return { success: true };
  } catch (err: any) {
    console.error("[updateUserProfile Error]:", err);
    return { success: false, error: err.message || "Error al actualizar perfil." };
  }
}

/**
 * 6. CAMBIAR ROL DE USUARIO (PLATAFORMA O NEGOCIO)
 */
export async function changeUserRole(
  userId: string,
  newRoleCode: string,
  businessId?: string,
  actorId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = await getSupabaseAdminClient();

    // 1. Obtener usuario actual
    const { data: dbUser } = await adminClient
      .from("users")
      .select("platform_role, status")
      .eq("id", userId)
      .single();

    if (!dbUser) {
      return { success: false, error: "Usuario no encontrado." };
    }

    // 2. Si es cambio de rol de plataforma
    if (PLATFORM_ROLES_CATALOG.some((r) => r.code === newRoleCode)) {
      // Protección contra escalación de privilegios: solo super_admin puede otorgar super_admin o modificar un super_admin
      if (actorId && (newRoleCode === "super_admin" || dbUser.platform_role === "super_admin")) {
        const { data: actorUser } = await adminClient
          .from("users")
          .select("platform_role, status")
          .eq("id", actorId)
          .maybeSingle();

        if (actorUser?.platform_role !== "super_admin" || actorUser?.status !== "active") {
          return {
            success: false,
            error: "Acceso denegado: Únicamente un Super Administrador activo puede otorgar o modificar el rol Super Administrador.",
          };
        }
      }

      // Validar protección de último super_admin
      if (dbUser.platform_role === "super_admin" && newRoleCode !== "super_admin") {
        const { count } = await adminClient
          .from("users")
          .select("id", { count: "exact", head: true })
          .eq("platform_role", "super_admin")
          .eq("status", "active")
          .neq("id", userId);

        if (!count || count === 0) {
          return {
            success: false,
            error: "Operación rechazada: No es posible retirar el rol al único Super Administrador activo de NEGOVA.",
          };
        }
      }

      try {
        await adminClient
          .from("users")
          .update({
            platform_role: newRoleCode,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);
      } catch (dbErr) {
        console.warn("[users update non-fatal]:", dbErr);
      }

      await adminClient.auth.admin.updateUserById(userId, {
        user_metadata: { role: newRoleCode },
        app_metadata: { role: newRoleCode },
      });

      // Auditoría
      await adminClient.from("audit_logs").insert({
        user_id: actorId || null,
        action: "permission_change",
        entity_type: "user",
        entity_id: userId,
        old_data: { platform_role: dbUser.platform_role },
        new_data: { platform_role: newRoleCode },
        metadata: { event: "user.role.changed", scope: "platform" },
      });

      return { success: true };
    }

    // 3. Si es cambio de rol de negocio
    if (businessId) {
      const { data: dbRole } = await adminClient
        .from("roles")
        .select("id, code, name")
        .eq("code", newRoleCode)
        .eq("scope", "business")
        .maybeSingle();

      if (!dbRole) {
        return { success: false, error: `El rol de negocio '${newRoleCode}' no existe.` };
      }

      // Validar membresía existente
      const { data: bu } = await adminClient
        .from("business_users")
        .select("id, role_id")
        .eq("business_id", businessId)
        .eq("user_id", userId)
        .single();

      if (!bu) {
        return { success: false, error: "El usuario no cuenta con membresía en este negocio." };
      }

      await adminClient
        .from("business_users")
        .update({
          role_id: dbRole.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bu.id);

      // Auditoría
      await adminClient.from("audit_logs").insert({
        business_id: businessId,
        user_id: actorId || null,
        action: "permission_change",
        entity_type: "membership",
        entity_id: bu.id,
        new_data: { roleCode: newRoleCode, roleId: dbRole.id },
        metadata: { event: "user.membership.role_updated" },
      });

      return { success: true };
    }

    return { success: false, error: "Parámetros de cambio de rol inválidos." };
  } catch (err: any) {
    console.error("[changeUserRole Error]:", err);
    return { success: false, error: err.message || "Error al cambiar rol." };
  }
}

/**
 * 7. CAMBIAR ESTADO DE CUENTA (ACTIVAR / DESHABILITAR / BLOQUEAR)
 */
export async function changeUserStatus(
  userId: string,
  newStatus: UserStatus,
  actorId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = await getSupabaseAdminClient();

    const { data: dbUser } = await adminClient
      .from("users")
      .select("platform_role, status")
      .eq("id", userId)
      .single();

    if (!dbUser) {
      return { success: false, error: "Usuario no encontrado." };
    }

    // Proteger último super_admin de ser deshabilitado o bloqueado
    if (dbUser.platform_role === "super_admin" && newStatus !== "active") {
      const { count } = await adminClient
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("platform_role", "super_admin")
        .eq("status", "active")
        .neq("id", userId);

      if (!count || count === 0) {
        return {
          success: false,
          error: "Operación rechazada: No es posible deshabilitar o suspender al único Super Administrador activo.",
        };
      }
    }

    // Actualizar estado en public.users
    await adminClient
      .from("users")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    // Auditoría
    const eventName =
      newStatus === "active"
        ? "user.enabled"
        : newStatus === "blocked"
        ? "user.blocked"
        : "user.disabled";

    await adminClient.from("audit_logs").insert({
      user_id: actorId || null,
      action: "status_change",
      entity_type: "user",
      entity_id: userId,
      old_data: { status: dbUser.status },
      new_data: { status: newStatus },
      metadata: { event: eventName },
    });

    return { success: true };
  } catch (err: any) {
    console.error("[changeUserStatus Error]:", err);
    return { success: false, error: err.message || "Error al actualizar estado del usuario." };
  }
}

/**
 * 8. RESTABLECER CONTRASEÑA TEMPORAL Y ACTIVAR MUST_CHANGE_PASSWORD
 */
export async function resetUserPassword(
  userId: string,
  customPassword?: string,
  actorId?: string
): Promise<{ success: boolean; temporaryPassword?: string; error?: string }> {
  try {
    const adminClient = await getSupabaseAdminClient();

    let temporaryPassword = customPassword?.trim();
    if (!temporaryPassword || temporaryPassword.length < 8) {
      temporaryPassword = generateSecurePassword();
    }

    // Actualizar en Supabase Auth
    const { error: authErr } = await adminClient.auth.admin.updateUserById(userId, {
      password: temporaryPassword,
      user_metadata: { must_change_password: true },
    });

    if (authErr) throw authErr;

    // Actualizar flag en public.users
    await adminClient
      .from("users")
      .update({
        must_change_password: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    // Auditoría
    await adminClient.from("audit_logs").insert({
      user_id: actorId || null,
      action: "update",
      entity_type: "user",
      entity_id: userId,
      metadata: { event: "user.password_reset_requested" },
    });

    return { success: true, temporaryPassword };
  } catch (err: any) {
    console.error("[resetUserPassword Error]:", err);
    return { success: false, error: err.message || "Error al restablecer contraseña." };
  }
}

/**
 * 9. ASIGNAR USUARIO A UN NEGOCIO (MEMBRESÍA EXPLÍCITA EN BUSINESS_USERS)
 */
export async function assignUserToBusiness(
  userId: string,
  businessId: string,
  roleCode: string,
  actorId?: string
): Promise<{ success: boolean; membershipId?: string; error?: string }> {
  try {
    const adminClient = await getSupabaseAdminClient();

    // 1. Validar existencia del usuario
    const { data: dbUser } = await adminClient
      .from("users")
      .select("id, platform_role, status")
      .eq("id", userId)
      .single();

    if (!dbUser) {
      return { success: false, error: "El usuario seleccionado no existe." };
    }

    // Regla de arquitectura: Usuarios de plataforma no participan en relaciones de negocio
    if (dbUser.platform_role === "super_admin" || dbUser.platform_role === "admin") {
      return {
        success: false,
        error: "Los usuarios de Plataforma NEGOVA (Super Admin / Admin) no pueden ser asignados a comercios como miembros de equipo.",
      };
    }

    // 2. Validar existencia del negocio
    const { data: business } = await adminClient
      .from("businesses")
      .select("id, name, status")
      .eq("id", businessId)
      .single();

    if (!business) {
      return { success: false, error: "El negocio seleccionado no existe." };
    }

    // 3. Validar rol de ámbito negocio
    const { data: dbRole } = await adminClient
      .from("roles")
      .select("id, code, name, scope")
      .eq("code", roleCode)
      .eq("scope", "business")
      .maybeSingle();

    if (!dbRole) {
      return { success: false, error: `El rol '${roleCode}' no es un rol válido para un negocio.` };
    }

    // 4. Validar si ya tiene membresía en este negocio
    const { data: existingBu } = await adminClient
      .from("business_users")
      .select("id, role_id")
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .maybeSingle();

    // 5. Validar capacidad del plan (si no es propietario o si es nuevo miembro)
    if (!existingBu && roleCode !== "owner") {
      const capacity = await checkBusinessPlanUserCapacity(businessId);
      if (!capacity.canAddUser) {
        return {
          success: false,
          error: `Límite de usuarios alcanzado para ${business.name}. El plan '${capacity.planName}' permite hasta ${capacity.maxUsers} usuario(s) (${capacity.currentUsers} en uso).`,
        };
      }
    }

    let membershipId: string;

    if (existingBu) {
      // Actualizar rol y reactivar si estaba inactiva
      await adminClient
        .from("business_users")
        .update({
          role_id: dbRole.id,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingBu.id);

      membershipId = existingBu.id;
    } else {
      // Insertar nueva membresía
      const { data: insBu, error: insErr } = await adminClient
        .from("business_users")
        .insert({
          business_id: businessId,
          user_id: userId,
          role_id: dbRole.id,
          status: "active",
          joined_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insErr || !insBu) {
        throw new Error(insErr?.message || "No fue posible crear la membresía.");
      }

      membershipId = insBu.id;
    }

    // Registrar auditoría
    try {
      await adminClient.from("audit_logs").insert({
        business_id: businessId,
        user_id: actorId || null,
        action: existingBu ? "update" : "create",
        entity_type: "membership",
        entity_id: membershipId,
        new_data: { userId, businessId, roleCode, roleId: dbRole.id },
        metadata: {
          event: existingBu ? "business.membership_updated" : "business.membership_assigned",
          role: roleCode,
          business_name: business.name,
        },
      });
    } catch {
      // Auditoría no fatal
    }

    return { success: true, membershipId };
  } catch (err: any) {
    console.error("[assignUserToBusiness Error]:", err);
    return { success: false, error: err.message || "Error al asignar usuario al negocio." };
  }
}

/**
 * 10. DESVINCULAR USUARIO DE UN NEGOCIO (ELIMINAR MEMBRESÍA EN BUSINESS_USERS)
 */
export async function removeUserFromBusiness(
  membershipId: string,
  actorId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = await getSupabaseAdminClient();

    // Consultar datos de la membresía antes de eliminar
    const { data: bu } = await adminClient
      .from("business_users")
      .select("id, user_id, business_id, role_id, roles(code)")
      .eq("id", membershipId)
      .single();

    if (!bu) {
      return { success: false, error: "Membresía no encontrada." };
    }

    // Eliminar registro de business_users
    const { error: delErr } = await adminClient
      .from("business_users")
      .delete()
      .eq("id", membershipId);

    if (delErr) throw delErr;

    // Registrar auditoría
    try {
      await adminClient.from("audit_logs").insert({
        business_id: bu.business_id,
        user_id: actorId || null,
        action: "delete",
        entity_type: "membership",
        entity_id: membershipId,
        old_data: { userId: bu.user_id, businessId: bu.business_id, roleId: bu.role_id },
        metadata: { event: "business.membership_removed" },
      });
    } catch {
      // Auditoría no fatal
    }

    return { success: true };
  } catch (err: any) {
    console.error("[removeUserFromBusiness Error]:", err);
    return { success: false, error: err.message || "Error al desvincular usuario del negocio." };
  }
}

/**
 * 11. OBTENER LISTA DE USUARIOS ELEGIBLES PARA SER ASIGNADOS A NEGOCIOS
 * (Excluye a los usuarios de plataforma: super_admin y admin)
 */
export async function getEligibleBusinessUsers(): Promise<
  Array<{ id: string; fullName: string; email: string; phone?: string | null }>
> {
  try {
    const adminClient = await getSupabaseAdminClient();

    const { data: users, error } = await adminClient
      .from("users")
      .select("id, email, platform_role, status, profiles(full_name, phone)")
      .not("platform_role", "in", '("super_admin","admin")')
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    return (users || []).map((u: any) => ({
      id: u.id,
      fullName: u.profiles?.full_name || u.email?.split("@")[0] || "Usuario",
      email: u.email || "",
      phone: u.profiles?.phone || null,
    }));
  } catch (err) {
    console.error("[getEligibleBusinessUsers Error]:", err);
    return [];
  }
}

/**
 * 12. OBTENER LISTA DE COMERCIOS DISPONIBLES PARA ASIGNACIÓN
 */
export async function getBusinessesOptions(): Promise<
  Array<{ id: string; name: string; slug: string; status: string }>
> {
  try {
    const adminClient = await getSupabaseAdminClient();

    const { data: businesses, error } = await adminClient
      .from("businesses")
      .select("id, name, slug, status")
      .order("name", { ascending: true })
      .limit(200);

    if (error) throw error;

    return (businesses || []).map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      status: b.status || "trial",
    }));
  } catch (err) {
    console.error("[getBusinessesOptions Error]:", err);
    return [];
  }
}

