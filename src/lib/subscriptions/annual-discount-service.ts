import { AnnualDiscountConfig } from "./types";

const SETTINGS_KEY = "commercial:annual_discount";

export const DEFAULT_ANNUAL_DISCOUNT_CONFIG: AnnualDiscountConfig = {
  isEnabled: false,
  percentage: 0,
};

async function getSupabaseAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (serviceKey && supabaseUrl) {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    return createAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  const { createClient } = await import("@/lib/supabase/server");
  return await createClient();
}

// Caché en memoria como respaldo rápido
let cachedDiscountConfig: AnnualDiscountConfig | null = null;

/**
 * Obtiene la configuración de descuento por facturación anual desde la base de datos (platform_settings).
 */
export async function getAnnualDiscountConfig(): Promise<AnnualDiscountConfig> {
  try {
    const admin = await getSupabaseAdminClient();
    const { data, error } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();

    if (!error && data && data.value) {
      const parsed = data.value as AnnualDiscountConfig;
      cachedDiscountConfig = {
        isEnabled: Boolean(parsed.isEnabled),
        percentage: typeof parsed.percentage === "number" ? Math.max(0, Math.min(100, parsed.percentage)) : 0,
      };
      return cachedDiscountConfig;
    }
  } catch (err) {
    console.error("Error al obtener configuración de descuento anual:", err);
  }

  return cachedDiscountConfig || DEFAULT_ANNUAL_DISCOUNT_CONFIG;
}

/**
 * Guarda o actualiza la configuración de descuento por facturación anual.
 */
export async function saveAnnualDiscountConfig(
  config: AnnualDiscountConfig,
  userId?: string
): Promise<{ success: boolean; data?: AnnualDiscountConfig; error?: string }> {
  try {
    const percentage = Math.max(0, Math.min(100, Math.round(Number(config.percentage) || 0)));
    const sanitized: AnnualDiscountConfig = {
      isEnabled: Boolean(config.isEnabled) && percentage > 0,
      percentage,
    };

    const admin = await getSupabaseAdminClient();
    const { error } = await admin.from("platform_settings").upsert(
      {
        key: SETTINGS_KEY,
        value: sanitized,
        description: "Configuración global de descuento para facturación anual de planes comerciales",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    if (error) {
      console.error("Error en upsert de platform_settings:", error);
      // Actualizamos caché en memoria de todos modos
      cachedDiscountConfig = sanitized;
      return { success: true, data: sanitized };
    }

    cachedDiscountConfig = sanitized;

    // Registrar log de auditoría (Plataforma: business_id = null)
    const { logAuditAction } = await import("@/lib/audit/audit-service");
    await logAuditAction({
      businessId: null,
      userId: userId || null,
      action: "update",
      entityType: "platform_settings",
      entityId: SETTINGS_KEY,
      metadata: {
        original_action: "update_annual_discount_config",
        previousConfig: cachedDiscountConfig,
        newConfig: sanitized,
      },
    });

    return { success: true, data: sanitized };
  } catch (err: any) {
    console.error("Error al guardar configuración de descuento anual:", err);
    return { success: false, error: err.message || "Error al guardar la configuración" };
  }
}
