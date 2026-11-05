/**
 * SERVICIO DE CARGOS Y ETIQUETAS OPERATIVAS PARA EMPLEADOS [CARGOS-001]
 * 
 * Separa explícitamente:
 * - Rol: Perfil de permisos y seguridad (owner, admin, auxiliar).
 * - Permisos: Acciones granulares sobre los módulos del workspace.
 * - Cargo: Función operativa del empleado en la dinámica diaria del negocio
 *          (Cajero, Mesero, Cocinero, Domiciliario, Vendedor, Barbero, etc.).
 * 
 * Soporte Multi-Vertical: Restaurantes, Cafeterías, Barberías, Spas, Retail y Servicios.
 * Un empleado puede desempeñar múltiples cargos simultáneamente (ej: Cajero + Mesero).
 */

export interface CargoItem {
  id: string;
  name: string;
  color?: string;
  isCustom?: boolean;
}

/**
 * Catálogo Canónico de Cargos Predeterminados para Comercio y Gastronomía
 */
export const DEFAULT_PRESET_CARGOS: string[] = [
  "Cajero",
  "Mesero",
  "Cocinero",
  "Domiciliario",
  "Vendedor",
  "Barbero",
  "Peluquero",
  "Administrador operativo",
];

/**
 * Paleta de estilos visuales semánticos de NEGOVA según el nombre del cargo
 */
export function getCargoBadgeStyles(cargoName: string): {
  badgeClass: string;
  dotColor: string;
} {
  const norm = cargoName.toLowerCase().trim();

  if (norm.includes("cajer")) {
    return {
      badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      dotColor: "bg-emerald-500",
    };
  }
  if (norm.includes("meser")) {
    return {
      badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      dotColor: "bg-amber-500",
    };
  }
  if (norm.includes("cocin") || norm.includes("chef") || norm.includes("parrill")) {
    return {
      badgeClass: "bg-[#ED500A]/10 text-[#ED500A] border-[#ED500A]/20",
      dotColor: "bg-[#ED500A]",
    };
  }
  if (norm.includes("domicil") || norm.includes("repart") || norm.includes("mensajer")) {
    return {
      badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
      dotColor: "bg-sky-500",
    };
  }
  if (norm.includes("vended") || norm.includes("asesor") || norm.includes("mostrador")) {
    return {
      badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      dotColor: "bg-purple-500",
    };
  }
  if (norm.includes("barber") || norm.includes("estil")) {
    return {
      badgeClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
      dotColor: "bg-violet-500",
    };
  }
  if (norm.includes("peluquer") || norm.includes("manicur") || norm.includes("spa")) {
    return {
      badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      dotColor: "bg-rose-500",
    };
  }
  if (norm.includes("admin") || norm.includes("superv") || norm.includes("gerent")) {
    return {
      badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
      dotColor: "bg-indigo-500",
    };
  }

  // Estilo neutro para cargos personalizados
  return {
    badgeClass: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
    dotColor: "bg-slate-400",
  };
}

async function getAdminClient() {
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
 * Obtiene todos los cargos disponibles para el negocio:
 * Combina los presets canónicos con los cargos personalizados creados por el comercio.
 */
export async function getBusinessAvailableCargos(businessId: string): Promise<string[]> {
  try {
    const admin = await getAdminClient();

    // 1. Intentar consultar desde la tabla business_cargos si existe
    const { data: dbCargos, error } = await admin
      .from("business_cargos")
      .select("name")
      .eq("business_id", businessId)
      .order("name", { ascending: true });

    if (!error && dbCargos && dbCargos.length > 0) {
      const names = dbCargos.map((c) => c.name.trim());
      // Combinar con presets garantizando unicidad
      const set = new Set([...DEFAULT_PRESET_CARGOS, ...names]);
      return Array.from(set);
    }

    // 2. Fallback resiliente: consultar desde businesses.settings->'available_cargos'
    const { data: business } = await admin
      .from("businesses")
      .select("settings")
      .eq("id", businessId)
      .maybeSingle();

    const customCargos: string[] = Array.isArray(business?.settings?.available_cargos)
      ? business.settings.available_cargos
      : [];

    const set = new Set([...DEFAULT_PRESET_CARGOS, ...customCargos]);
    return Array.from(set);
  } catch (err) {
    console.warn("[getBusinessAvailableCargos Warning]:", err);
    return [...DEFAULT_PRESET_CARGOS];
  }
}

/**
 * Obtiene los cargos asignados a los empleados de un negocio en una sola consulta.
 * Retorna un mapa: { [userId: string]: string[] }
 */
export async function getBusinessEmployeeCargos(
  businessId: string,
  userIds?: string[]
): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};
  if (userIds && userIds.length === 0) return result;

  try {
    const admin = await getAdminClient();

    // 1. Intentar consultar desde la tabla relacional business_user_cargos
    let query = admin
      .from("business_user_cargos")
      .select(`
        user_id,
        business_cargos (
          name
        )
      `)
      .eq("business_id", businessId);

    if (userIds && userIds.length > 0) {
      query = query.in("user_id", userIds);
    }

    const { data: relData, error: relErr } = await query;

    if (!relErr && relData && relData.length > 0) {
      for (const row of relData) {
        const uid = row.user_id;
        const cName = (row.business_cargos as any)?.name;
        if (uid && cName) {
          if (!result[uid]) result[uid] = [];
          if (!result[uid].includes(cName)) {
            result[uid].push(cName);
          }
        }
      }
      return result;
    }

    // 2. Fallback resiliente: consultar desde businesses.settings->'employee_cargos'
    const { data: business } = await admin
      .from("businesses")
      .select("settings")
      .eq("id", businessId)
      .maybeSingle();

    const storedMap = business?.settings?.employee_cargos || {};
    if (typeof storedMap === "object" && storedMap !== null) {
      for (const [uid, list] of Object.entries(storedMap)) {
        if (Array.isArray(list)) {
          if (!userIds || userIds.includes(uid)) {
            result[uid] = list.filter((item): item is string => typeof item === "string");
          }
        }
      }
    }

    return result;
  } catch (err) {
    console.warn("[getBusinessEmployeeCargos Warning]:", err);
    return result;
  }
}

/**
 * Obtiene los cargos de un empleado individual.
 */
export async function getUserCargos(businessId: string, userId: string): Promise<string[]> {
  const map = await getBusinessEmployeeCargos(businessId, [userId]);
  return map[userId] || [];
}

/**
 * Guarda o actualiza los cargos operativos asignados a un empleado dentro de un comercio.
 */
export async function saveUserCargos(
  businessId: string,
  userId: string,
  cargos: string[]
): Promise<{ success: boolean; cargos: string[]; error?: string }> {
  try {
    const admin = await getAdminClient();
    const cleanCargos = Array.from(new Set(cargos.map((c) => c.trim()).filter(Boolean)));

    // 1. Guardar en tabla relacional si está disponible
    try {
      // Asegurar que cada cargo exista en business_cargos
      for (const cName of cleanCargos) {
        await admin
          .from("business_cargos")
          .upsert(
            { business_id: businessId, name: cName },
            { onConflict: "business_id,name" }
          );
      }

      // Obtener los IDs de los cargos
      const { data: cargoRows } = await admin
        .from("business_cargos")
        .select("id, name")
        .eq("business_id", businessId)
        .in("name", cleanCargos);

      if (cargoRows && cargoRows.length > 0) {
        // Eliminar asignaciones anteriores
        await admin
          .from("business_user_cargos")
          .delete()
          .eq("business_id", businessId)
          .eq("user_id", userId);

        // Insertar nuevas asignaciones
        const inserts = cargoRows.map((cr) => ({
          business_id: businessId,
          user_id: userId,
          cargo_id: cr.id,
        }));

        await admin.from("business_user_cargos").insert(inserts);
      } else if (cleanCargos.length === 0) {
        await admin
          .from("business_user_cargos")
          .delete()
          .eq("business_id", businessId)
          .eq("user_id", userId);
      }
    } catch (dbErr) {
      console.warn("[saveUserCargos DB Table Notice]: Continuing with JSONB sync fallback.", dbErr);
    }

    // 2. Dual-Sync en businesses.settings->'employee_cargos' para resiliencia garantizada
    const { data: business } = await admin
      .from("businesses")
      .select("settings")
      .eq("id", businessId)
      .maybeSingle();

    const currentSettings = business?.settings || {};
    const currentEmployeeCargos = currentSettings.employee_cargos || {};

    const updatedEmployeeCargos = {
      ...currentEmployeeCargos,
      [userId]: cleanCargos,
    };

    await admin
      .from("businesses")
      .update({
        settings: {
          ...currentSettings,
          employee_cargos: updatedEmployeeCargos,
        },
      })
      .eq("id", businessId);

    return { success: true, cargos: cleanCargos };
  } catch (err: any) {
    console.error("[saveUserCargos Error]:", err);
    return {
      success: false,
      cargos: [],
      error: err.message || "Error al guardar cargos del empleado.",
    };
  }
}

/**
 * Agrega un nuevo cargo operativo personalizado para el catálogo del negocio.
 */
export async function addBusinessCustomCargo(
  businessId: string,
  cargoName: string
): Promise<{ success: boolean; cargo: string; error?: string }> {
  const cleanName = cargoName.trim();
  if (!cleanName) {
    return { success: false, cargo: "", error: "El nombre del cargo no puede estar vacío." };
  }

  try {
    const admin = await getAdminClient();

    // 1. Guardar en business_cargos si la tabla existe
    try {
      await admin
        .from("business_cargos")
        .upsert(
          { business_id: businessId, name: cleanName },
          { onConflict: "business_id,name" }
        );
    } catch (e) {
      console.warn("[addBusinessCustomCargo DB Notice]: Using JSONB fallback.", e);
    }

    // 2. Dual-Sync en businesses.settings->'available_cargos'
    const { data: business } = await admin
      .from("businesses")
      .select("settings")
      .eq("id", businessId)
      .maybeSingle();

    const currentSettings = business?.settings || {};
    const customCargos: string[] = Array.isArray(currentSettings.available_cargos)
      ? currentSettings.available_cargos
      : [];

    if (!customCargos.includes(cleanName) && !DEFAULT_PRESET_CARGOS.includes(cleanName)) {
      customCargos.push(cleanName);
    }

    await admin
      .from("businesses")
      .update({
        settings: {
          ...currentSettings,
          available_cargos: customCargos,
        },
      })
      .eq("id", businessId);

    return { success: true, cargo: cleanName };
  } catch (err: any) {
    console.error("[addBusinessCustomCargo Error]:", err);
    return {
      success: false,
      cargo: cleanName,
      error: err.message || "No fue posible registrar el nuevo cargo.",
    };
  }
}

