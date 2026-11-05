/**
 * SERVICIO DE GESTIÓN Y ASIGNACIÓN DE RESPONSABLES DE PEDIDOS [POS-RESPONSABLE]
 * 
 * Reglas de Negocio:
 * 1. Aislamiento Multi-Tenant Estricto: Solo retorna y valida personas pertenecientes al negocio actual.
 * 2. Unificación de Miembros: Incluye usuarios del comercio (propietario, administradores, cajeros)
 *    y trabajadores/empleados registrados en el módulo de personal.
 * 3. Etiquetas de Cargos Operativos: Utiliza los cargos reales asignados en el negocio.
 *    Si una persona tiene múltiples cargos (ej. Mesero y Domiciliario), los expone como etiquetas.
 * 4. Selección Predeterminada: El usuario autenticado es preseleccionado por defecto.
 * 5. Separación Creador vs Responsable: El creador (created_by) se mantiene inmutable
 *    y el responsable asignado se almacena en assigned_staff_id, assigned_staff_name y assigned_staff_role.
 */

import { getDbClient } from "@/lib/restaurant/restaurant-service";

export interface OrderResponsibleStaff {
  id: string; // ID único (user_id o employee_id)
  userId: string | null;
  employeeId: string | null;
  name: string;
  email: string | null;
  cargos: string[];
  avatarUrl: string | null;
  isCurrentUser?: boolean;
}

/**
 * Consulta todos los miembros y empleados activos del negocio para asignación de pedidos.
 */
export async function getOrderResponsibleStaff(
  businessId: string,
  currentUserId?: string | null
): Promise<OrderResponsibleStaff[]> {
  const supabase = await getDbClient();
  const staffMap = new Map<string, OrderResponsibleStaff>();

  // 1. Obtener empleados activos de la tabla 'business_employees'
  try {
    const { data: employees, error: empErr } = await supabase
      .from("business_employees")
      .select("id, user_id, first_name, last_name, job_title, status")
      .eq("business_id", businessId)
      .eq("status", "active");

    if (!empErr && employees) {
      for (const emp of employees) {
        const fullName = `${emp.first_name || ""} ${emp.last_name || ""}`.trim() || "Trabajador";
        
        // Desglosar cargos desde job_title si contiene múltiples separados por coma, pleca o guión
        const rawCargos = (emp.job_title || "")
          .split(/[,/|;]+/)
          .map((c: string) => c.trim())
          .filter(Boolean);

        const key = emp.user_id || emp.id;
        staffMap.set(key, {
          id: emp.user_id || emp.id,
          userId: emp.user_id || null,
          employeeId: emp.id,
          name: fullName,
          email: null,
          cargos: rawCargos,
          avatarUrl: null,
          isCurrentUser: Boolean(currentUserId && emp.user_id === currentUserId),
        });
      }
    }
  } catch (err) {
    console.warn("[getOrderResponsibleStaff] Advertencia consultando business_employees:", err);
  }

  // 2. Obtener cargos desde 'business_user_cargos' si existen
  try {
    const { data: userCargos, error: ucErr } = await supabase
      .from("business_user_cargos")
      .select("user_id, business_cargos(name)")
      .eq("business_id", businessId);

    if (!ucErr && userCargos) {
      for (const uc of userCargos) {
        const cargoName = (uc.business_cargos as any)?.name;
        if (cargoName && staffMap.has(uc.user_id)) {
          const item = staffMap.get(uc.user_id)!;
          if (!item.cargos.includes(cargoName)) {
            item.cargos.push(cargoName);
          }
        }
      }
    }
  } catch {
    // Si la tabla no existe aún, ignorar defensivamente
  }

  // 3. Obtener usuarios miembros de 'business_users' (Propietario, Admin, Cajeros, etc.)
  try {
    const { data: businessUsers, error: buErr } = await supabase
      .from("business_users")
      .select(`
        user_id,
        status,
        roles(code, name)
      `)
      .eq("business_id", businessId)
      .neq("status", "inactive");

    if (!buErr && businessUsers && businessUsers.length > 0) {
      const userIds = businessUsers.map((bu: any) => bu.user_id).filter(Boolean);

      // Obtener perfiles para nombres reales
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      for (const bu of businessUsers) {
        const uid = bu.user_id;
        const profile = profileMap.get(uid);
        const roleName = (bu.roles as any)?.name || (bu.roles as any)?.code || "";
        const roleCode = (bu.roles as any)?.code || "";

        // Traducir código de rol a cargo legible si aplica
        let roleCargo = roleName;
        if (roleCode === "owner") roleCargo = "Propietario";
        else if (roleCode === "admin") roleCargo = "Administrador";
        else if (roleCode === "cajero") roleCargo = "Cajero";
        else if (roleCode === "mesero" || roleCode === "waiter") roleCargo = "Mesero";

        if (staffMap.has(uid)) {
          // Ya existía como empleado, añadir avatar y rol si no está presente
          const existing = staffMap.get(uid)!;
          if (profile?.avatar_url && !existing.avatarUrl) {
            existing.avatarUrl = profile.avatar_url;
          }
          if (roleCargo && !existing.cargos.includes(roleCargo)) {
            existing.cargos.unshift(roleCargo);
          }
          if (currentUserId && uid === currentUserId) {
            existing.isCurrentUser = true;
          }
        } else {
          // Usuario de negocio sin ficha en business_employees
          const fullName = profile?.full_name?.trim() || "Usuario del Negocio";
          const cargos = roleCargo ? [roleCargo] : [];
          staffMap.set(uid, {
            id: uid,
            userId: uid,
            employeeId: null,
            name: fullName,
            email: null,
            cargos,
            avatarUrl: profile?.avatar_url || null,
            isCurrentUser: Boolean(currentUserId && uid === currentUserId),
          });
        }
      }
    }
  } catch (err) {
    console.warn("[getOrderResponsibleStaff] Advertencia consultando business_users:", err);
  }

  // Convertir a array y ordenar: primero el usuario actual, luego alfabéticamente
  const staffList = Array.from(staffMap.values()).sort((a, b) => {
    if (a.isCurrentUser) return -1;
    if (b.isCurrentUser) return 1;
    return a.name.localeCompare(b.name, "es");
  });

  return staffList;
}

/**
 * Valida en servidor que un responsable asignado pertenezca legítimamente al negocio.
 */
export async function validateOrderResponsible(
  businessId: string,
  staffId?: string | null,
  staffName?: string | null
): Promise<{ isValid: boolean; resolvedName?: string; resolvedRole?: string }> {
  if (!staffId && !staffName) {
    return { isValid: true };
  }

  const staffList = await getOrderResponsibleStaff(businessId);
  
  if (staffId) {
    const match = staffList.find((s) => s.id === staffId || s.userId === staffId || s.employeeId === staffId);
    if (match) {
      return {
        isValid: true,
        resolvedName: match.name,
        resolvedRole: match.cargos[0] || undefined,
      };
    }
  }

  if (staffName) {
    const matchName = staffList.find((s) => s.name.trim().toLowerCase() === staffName.trim().toLowerCase());
    if (matchName) {
      return {
        isValid: true,
        resolvedName: matchName.name,
        resolvedRole: matchName.cargos[0] || undefined,
      };
    }
  }

  return { isValid: false };
}

