import { createClient } from "@/lib/supabase/server";
import { StaffMember } from "./types";

/**
 * Consulta y unifica todo el personal operativo y usuarios del negocio para asignación de responsables.
 * Incluye:
 * - Empleados registrados en el módulo de personal/nómina (business_employees) con sus cargos reales.
 * - Usuarios con cuenta activa del negocio (business_users) con sus roles asignados (Propietario, Cajero, etc.).
 * - Unifica por user_id evitando duplicados.
 * - Marca y posiciona al usuario autenticado actual como primera opción por defecto.
 */
export async function getWorkspaceStaff(
  businessId: string,
  currentUserId?: string
): Promise<StaffMember[]> {
  try {
    const supabase = await createClient();

    // 1. Obtener empleados activos del negocio
    const { data: employees, error: empErr } = await supabase
      .from("business_employees")
      .select("id, user_id, first_name, last_name, job_title, status, phone, email")
      .eq("business_id", businessId)
      .eq("status", "active")
      .order("first_name", { ascending: true });

    if (empErr) {
      console.warn("[getWorkspaceStaff] Advertencia al consultar business_employees:", empErr.message);
    }

    // 2. Obtener usuarios vinculados al negocio en business_users con sus roles
    const { data: bUsers, error: buErr } = await supabase
      .from("business_users")
      .select(`
        user_id,
        status,
        roles:role_id (id, name, code),
        profiles:user_id (id, full_name, phone, avatar_url)
      `)
      .eq("business_id", businessId)
      .eq("status", "active");

    if (buErr) {
      console.warn("[getWorkspaceStaff] Advertencia al consultar business_users:", buErr.message);
    }

    const staffMap = new Map<string, StaffMember>();

    // A. Mapear usuarios del negocio
    for (const bu of (bUsers || []) as any[]) {
      const uId = bu.user_id;
      const profile = Array.isArray(bu.profiles) ? bu.profiles[0] : bu.profiles;
      const roleObj = Array.isArray(bu.roles) ? bu.roles[0] : bu.roles;
      const roleName = roleObj?.name || "";

      const name = profile?.full_name?.trim() || "Usuario";
      staffMap.set(uId, {
        id: uId,
        userId: uId,
        name,
        email: null,
        phone: profile?.phone || null,
        avatarUrl: profile?.avatar_url || null,
        roles: roleName ? [roleName] : [],
        isCurrentUser: currentUserId === uId,
      });
    }

    // B. Mapear empleados de nómina/personal
    for (const emp of (employees || []) as any[]) {
      const empName = `${emp.first_name || ""} ${emp.last_name || ""}`.trim() || "Empleado";

      // Extraer cargos desde job_title (ej: "Mesero, Domiciliario" -> ["Mesero", "Domiciliario"])
      const rawCargos = (emp.job_title || "")
        .split(/[,/]/)
        .map((c: string) => c.trim())
        .filter(Boolean);

      if (emp.user_id && staffMap.has(emp.user_id)) {
        const existing = staffMap.get(emp.user_id)!;
        // Unir roles del sistema con cargos del módulo de personal sin duplicados
        const combinedRoles = Array.from(new Set([...existing.roles, ...rawCargos]));
        existing.employeeId = emp.id;
        existing.roles = combinedRoles;
        if (empName && (!existing.name || existing.name === "Usuario")) {
          existing.name = empName;
        }
      } else {
        // Empleado sin cuenta de usuario en el sistema (ej. cocinero o auxiliar)
        staffMap.set(emp.id, {
          id: emp.id,
          employeeId: emp.id,
          userId: emp.user_id || null,
          name: empName,
          phone: emp.phone || null,
          roles: rawCargos,
          isCurrentUser: Boolean(currentUserId && emp.user_id === currentUserId),
        });
      }
    }

    // C. Ordenar: usuario actual primero, luego orden alfabético
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
