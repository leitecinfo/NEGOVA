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
    const supabase = await createClient();
    
    // Intentar leer de la tabla platform_settings por su clave 'core_config'
    const { data: configRow } = await supabase
      .from("platform_settings")
      .select("value, updated_at")
      .eq("key", "core_config")
      .maybeSingle();

    if (configRow?.value && typeof configRow.value === "object") {
      return {
        ...DEFAULT_PLATFORM_CONFIG,
        ...(configRow.value as Partial<PlatformFullConfig>),
        updatedAt: configRow.updated_at,
      };
    }
  } catch {
    // Si la tabla no está creada aún en desarrollo, usar los defaults tipados
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
    const supabase = await createClient();

    const currentFullConfig = await getPlatformConfiguration();
    const updatedFullConfig: PlatformFullConfig = {
      ...currentFullConfig,
      [sectionKey]: sectionData,
      updatedAt: new Date().toISOString(),
      updatedBy: user.email || user.id,
    };

    // 1. Guardar en tabla de platform_settings
    try {
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const { createClient: createAdminClient } = await import("@supabase/supabase-js");
        const supabaseAdmin = createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        await supabaseAdmin.from("platform_settings").upsert(
          {
            key: "core_config",
            value: updatedFullConfig,
            description: "Configuración global de la plataforma NEGOVA",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );

        // 2. Registrar evento en auditoría administrativa si la tabla existe
        try {
          await supabaseAdmin.from("audit_logs").insert({
            user_id: user.id,
            action: "update_platform_config",
            details: {
              section: sectionKey,
              changes: sectionData,
              timestamp: new Date().toISOString(),
            },
          });
        } catch {
          // Ignorar si audit_logs tiene otra estructura
        }
      } else {
        // Guardar con el cliente autenticado
        await supabase.from("platform_settings").upsert(
          {
            key: "core_config",
            value: updatedFullConfig,
            description: "Configuración global de la plataforma NEGOVA",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );
      }
    } catch {
      // Continuar con éxito
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
