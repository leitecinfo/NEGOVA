import { getSupabaseAdminClient } from "@/lib/auth/users-service";
import { StaffMember } from "./types";
import { getBusinessEmployeeCargos } from "@/lib/auth/cargos-service";

/**
 * Consulta y unifica todo el personal operativo y usuarios del negocio para asignación de responsables.
 * Utiliza cliente administrativo para acceder de forma segura a perfiles de colaboradores del comercio.
 * Incluye:
 * - Usuarios con cuenta activa del negocio (business_users) con sus perfiles reales y roles/cargos.
 * - Cargos operativos asignados (Mesero, Cajero, Cocinero, Domiciliario, etc.) [CARGOS-001].
 * - Correos electrónicos y teléfonos para distinguir entre múltiples auxiliares.
 * - Empleados registrados en el módulo de personal/nómina (business_employees) con sus cargos reales.
 * - Unifica por user_id evitando duplicados.
 * - Marca y posiciona al usuario autenticado actual como primera opción por defecto.
 */
export async function getWorkspaceStaff(
  businessId: string,
  currentUserId?: string
): Promise<StaffMember[]> {
  try {
    const supabase = await getSupabaseAdminClient();

    // 1. Obtener empleados activos del módulo de personal/nómina (business_employees)
    const { data: employees, error: empErr } = await supabase
      .from("business_employees")
      .select("id, user_id, first_name, last_name, job_title, status, phone, email")
      .eq("business_id", businessId)
      .eq("status", "active")
      .order("first_name", { ascending: true });

    if (empErr) {
      console.warn("[getWorkspaceStaff] Advertencia al consultar business_employees:", empErr.message);
    }

    // 2. Obtener usuarios activos vinculados al negocio en business_users con sus roles
    const { data: bUsers, error: buErr } = await supabase
      .from("business_users")
      .select(`
        user_id,
        status,
        role_id,
        roles:role_id (id, name, code)
      `)
      .eq("business_id", businessId)
      .eq("status", "active");

    if (buErr) {
      console.warn("[getWorkspaceStaff] Advertencia al consultar business_users:", buErr.message);
    }

    const userIds = (bUsers || [])
      .map((bu: any) => bu.user_id)
      .filter((uid: any): uid is string => Boolean(uid));

    // 2.1 Obtener perfiles reales de usuarios (nombre completo, teléfono, avatar)
    const profileMap = new Map<string, any>();
    if (userIds.length > 0) {
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, phone, avatar_url")
        .in("id", userIds);

      if (!profErr && profiles) {
        profiles.forEach((p: any) => profileMap.set(p.id, p));
      }
    }

    // 2.2 Obtener emails para identificación clara (distinguir entre varios auxiliares)
    const userEmailsMap = new Map<string, string>();
    try {
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      if (authUsers?.users) {
        authUsers.users.forEach((u) => {
          if (u.email) userEmailsMap.set(u.id, u.email);
        });
      }
    } catch {
      // Fallback opcional a public.users
      const { data: dbUsers } = await supabase
        .from("users")
        .select("id, email")
        .in("id", userIds);
      if (dbUsers) {
        dbUsers.forEach((u: any) => {
          if (u.email) userEmailsMap.set(u.id, u.email);
        });
      }
    }

    // 2.3 Obtener cargos operativos específicos (Mesero, Cajero, Domiciliario, Cocinero...) [CARGOS-001]
    let userCargosMap: Record<string, string[]> = {};
    try {
      userCargosMap = await getBusinessEmployeeCargos(businessId, userIds);
    } catch (cErr) {
      console.warn("[getWorkspaceStaff] Advertencia al consultar cargos operativos:", cErr);
    }

    const staffMap = new Map<string, StaffMember>();

    // A. Mapear usuarios del negocio con sus nombres reales, roles del sistema y cargos operativos
    for (const bu of (bUsers || []) as any[]) {
      const uId = bu.user_id;
      if (!uId) continue;

      const profile = profileMap.get(uId);
      const email = userEmailsMap.get(uId) || null;
      const roleObj = Array.isArray(bu.roles) ? bu.roles[0] : bu.roles;
      const roleName = roleObj?.name || "";
      const operativeCargos = userCargosMap[uId] || [];

      // Combinar cargos operativos asignados con el rol base del sistema
      const combinedRoles = Array.from(
        new Set([...operativeCargos, ...(roleName ? [roleName] : [])])
      );

      // Si no tiene nombre completo en perfil, usar prefijo del email antes de recurrir a "Usuario"
      const fallbackName = email ? email.split("@")[0] : `Usuario ${uId.slice(0, 4)}`;
      const name = profile?.full_name?.trim() || fallbackName;

      staffMap.set(uId, {
        id: uId,
        userId: uId,
        name,
        email,
        phone: profile?.phone || null,
        avatarUrl: profile?.avatar_url || null,
        roles: combinedRoles.length > 0 ? combinedRoles : ["Personal"],
        isCurrentUser: currentUserId === uId,
      });
    }

    // B. Mapear empleados de nómina/personal (business_employees)
    for (const emp of (employees || []) as any[]) {
      const empName = `${emp.first_name || ""} ${emp.last_name || ""}`.trim() || "Empleado";

      // Extraer cargos desde job_title (ej: "Mesero, Domiciliario" -> ["Mesero", "Domiciliario"])
      const rawCargos = (emp.job_title || "")
        .split(/[,/]/)
        .map((c: string) => c.trim())
        .filter(Boolean);

      if (emp.user_id && staffMap.has(emp.user_id)) {
        const existing = staffMap.get(emp.user_id)!;
        existing.employeeId = emp.id;
        existing.roles = Array.from(new Set([...existing.roles, ...rawCargos]));
        if (emp.phone && !existing.phone) existing.phone = emp.phone;
        if (emp.email && !existing.email) existing.email = emp.email;
        if (empName && (!existing.name || existing.name.startsWith("Usuario"))) {
          existing.name = empName;
        }
      } else {
        // Empleado sin cuenta de usuario en el sistema
        staffMap.set(emp.id, {
          id: emp.id,
          employeeId: emp.id,
          userId: emp.user_id || null,
          name: empName,
          email: emp.email || null,
          phone: emp.phone || null,
          roles: rawCargos.length > 0 ? rawCargos : ["Personal"],
          isCurrentUser: Boolean(currentUserId && emp.user_id === currentUserId),
        });
      }
    }

    // C. Asegurar que el usuario autenticado actual esté en la lista si tiene sesión en este negocio
    if (currentUserId && !staffMap.has(currentUserId)) {
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("id, full_name, phone, avatar_url")
        .eq("id", currentUserId)
        .maybeSingle();

      const email = userEmailsMap.get(currentUserId) || null;
      const fallbackName = email ? email.split("@")[0] : "Usuario Actual";

      staffMap.set(currentUserId, {
        id: currentUserId,
        userId: currentUserId,
        name: myProfile?.full_name?.trim() || fallbackName,
        email,
        phone: myProfile?.phone || null,
        avatarUrl: myProfile?.avatar_url || null,
        roles: ["Administrador"],
        isCurrentUser: true,
      });
    }

    // D. Ordenar: usuario actual primero, luego alfabéticamente por nombre
    const staffList = Array.from(staffMap.values());
    staffList.sort((a, b) => {
      if (a.isCurrentUser) return -1;
      if (b.isCurrentUser) return 1;
      return a.name.localeCompare(b.name, "es");
    });

    return staffList;
  } catch (err) {
    console.error("[getWorkspaceStaff] Error crítico:", err);
    return [];
  }
}
