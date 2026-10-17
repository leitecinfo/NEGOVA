"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  PlatformFullConfig,
  DEFAULT_PLATFORM_CONFIG,
} from "@/types/config/platform-config";

/**
 * Validador de permisos de Superadministrador para acciones de plataforma
 */
async function verifySuperAdminSession() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("No autenticado. Inicie sesión para continuar.");
  }

  // Verificar rol en tabla users o metadatos de autenticación
  const { data: dbUser } = await supabase
    .from("users")
    .select("platform_role, status")
    .eq("id", user.id)
    .maybeSingle();

  const authRole = user.app_metadata?.role || user.user_metadata?.role;
  const userRole =
    dbUser?.platform_role === "super_admin" || dbUser?.platform_role === "admin"
      ? dbUser.platform_role
      : authRole === "super_admin" || authRole === "admin"
        ? authRole
        : (dbUser?.platform_role || "customer");

  const userStatus = dbUser?.status || "active";

  if (userRole !== "super_admin" || userStatus !== "active") {
    throw new Error("Acceso denegado. Se requiere rol de Superadministrador activo para modificar la configuración de plataforma.");
  }

  return { user, dbUser };
}

/**
 * Obtener la configuración actual de la plataforma
 */
export async function getPlatformConfiguration(): Promise<PlatformFullConfig> {
  try {
    let supabase: any;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { createClient: createAdminClient } = await import("@supabase/supabase-js");
      supabase = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
    } else {
      supabase = await createClient();
    }
    
    // Leer de la tabla platform_settings por su clave 'core_config'
    const { data: configRow, error } = await supabase
      .from("platform_settings")
      .select("value, updated_at, updated_by")
      .eq("key", "core_config")
      .maybeSingle();

    if (!error && configRow?.value && typeof configRow.value === "object") {
      return {
        ...DEFAULT_PLATFORM_CONFIG,
        ...(configRow.value as Partial<PlatformFullConfig>),
        updatedAt: configRow.updated_at,
        updatedBy: configRow.updated_by,
      };
    }
  } catch (err) {
    console.warn("No se pudo leer platform_settings, utilizando valores por defecto:", err);
  }

  return DEFAULT_PLATFORM_CONFIG;
}

/**
 * Guardar sección de configuración de la plataforma con registro en auditoría
 */
export async function updatePlatformConfigSection<T extends keyof PlatformFullConfig>(
  sectionKey: T,
  sectionData: PlatformFullConfig[T]
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const { user } = await verifySuperAdminSession();

    // 1. Validación defensiva de datos recibidos
    if (!sectionKey || typeof sectionKey !== "string") {
      return { success: false, error: "Clave de sección no válida." };
    }

    const ALLOWED_SECTIONS: (keyof PlatformFullConfig)[] = [
      "general",
      "seguridad",
      "usuariosAcceso",
      "facturacion",
      "planesLimites",
      "auditoria",
    ];

    if (!ALLOWED_SECTIONS.includes(sectionKey)) {
      return { success: false, error: `Sección '${String(sectionKey)}' no reconocida para configuración de plataforma.` };
    }

    if (!sectionData || typeof sectionData !== "object" || Array.isArray(sectionData)) {
      return { success: false, error: "Los datos de la sección deben ser un objeto válido y no nulo." };
    }

    const currentFullConfig = await getPlatformConfiguration();
    const previousSectionData = currentFullConfig[sectionKey];

    const updatedFullConfig: PlatformFullConfig = {
      ...currentFullConfig,
      [sectionKey]: sectionData,
      updatedAt: new Date().toISOString(),
      updatedBy: user.email || user.id,
    };

    // 2. Persistir en la tabla platform_settings
    let clientToUse: any;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { createClient: createAdminClient } = await import("@supabase/supabase-js");
      clientToUse = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
    } else {
      clientToUse = await createClient();
    }

    const { error: upsertError } = await clientToUse
      .from("platform_settings")
      .upsert(
        {
          key: "core_config",
          value: updatedFullConfig,
          description: "Configuración global de la plataforma NEGOVA",
          updated_at: new Date().toISOString(),
          updated_by: user.email || user.id,
        },
        { onConflict: "key" }
      );

    if (upsertError) {
      console.error("Error al persistir en platform_settings:", upsertError);
      return {
        success: false,
        error: `Error al persistir la configuración en la base de datos: ${upsertError.message || "Error desconocido"}`,
      };
    }

    // 3. Registrar evento en auditoría administrativa (Plataforma: business_id = null)
    try {
      const { logAuditAction } = await import("@/lib/audit/audit-service");
      await logAuditAction({
        businessId: null,
        userId: user.id,
        action: "update",
        entityType: "platform_settings",
        entityId: "core_config",
        metadata: {
          original_action: "update_platform_config",
          section: sectionKey,
          previous_values: previousSectionData,
          changes: sectionData,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (auditErr) {
      // Comportamiento no bloqueante: se registra el error en consola para no perder trazabilidad
      console.error("Error no bloqueante al registrar auditoría de platform_settings:", auditErr);
    }

    revalidatePath("/admin/configuracion");
    return {
      success: true,
      message: `La sección '${sectionKey}' de la plataforma ha sido guardada exitosamente.`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error inesperado al guardar la configuración.";
    return {
      success: false,
      error: message,
    };
  }
}
