"use server";

import { revalidatePath } from "next/cache";
import { saveBusinessDocumentConfig } from "@/lib/documents/document-service";
import { BusinessDocumentConfig } from "@/lib/documents/types";
import { createClient } from "@/lib/supabase/server";
import { ensureNegovaBucket, STORAGE_PATHS } from "@/lib/storage/supabase-storage";
import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import { logAuditAction } from "@/lib/audit/audit-service";
import { WORKSPACE_MODULES_CATALOG } from "@/config/workspace-navigation";

/**
 * Actualiza la configuración global del negocio / tenant en PostgreSQL.
 * Valida autorización server-side con rol 'owner' o permiso 'business_settings.update'.
 */
export async function updateWorkspaceConfigAction(
  businessId: string,
  config: Partial<BusinessDocumentConfig>
): Promise<{ success: boolean; config?: BusinessDocumentConfig; error?: string }> {
  try {
    // 1. Validar autorización estricta del workspace
    const auth = await verifyWorkspaceAction(businessId, "business_settings.update");
    if (!auth.success) {
      return { success: false, error: auth.error || "No autorizado para modificar la configuración." };
    }

    // 2. Persistir en la tabla especializada business_document_configs
    const res = await saveBusinessDocumentConfig(businessId, config);
    if (!res.success) {
      return { success: false, error: res.error || "No fue posible guardar la configuración." };
    }

    // 3. Sincronizar campos maestros en la tabla businesses (si aplica)
    try {
      let adminClient: any;
      if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const { createClient: createAdminClient } = await import("@supabase/supabase-js");
        adminClient = createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );
      } else {
        adminClient = await createClient();
      }

      const bizUpdateData: Record<string, any> = {};
      if (config.tradeName) bizUpdateData.name = config.tradeName;
      if (config.phone) bizUpdateData.phone = config.phone;
      if (config.email) bizUpdateData.email = config.email;
      if (config.address) bizUpdateData.address = config.address;
      if (config.city !== undefined) bizUpdateData.city = config.city || null;
      if (config.department !== undefined) bizUpdateData.department = config.department || null;
      if (config.logoUrl !== undefined) bizUpdateData.logo_url = config.logoUrl;

      if (Object.keys(bizUpdateData).length > 0) {
        bizUpdateData.updated_at = new Date().toISOString();
        await adminClient
          .from("businesses")
          .update(bizUpdateData)
          .eq("id", businessId);
      }
    } catch (syncErr) {
      console.warn("[updateWorkspaceConfigAction] Aviso no bloqueante al sincronizar tabla businesses:", syncErr);
    }

    // 4. Registrar evento en auditoría forense (No bloqueante)
    try {
      await logAuditAction({
        userId: auth.context?.userId,
        action: "update",
        entityType: "business_settings",
        entityId: businessId,
        businessId: businessId,
        businessName: auth.context?.businessName,
        metadata: {
          original_action: "update_workspace_config",
          updated_fields: Object.keys(config),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (auditErr) {
      console.warn("[updateWorkspaceConfigAction] Aviso al registrar auditoría:", auditErr);
    }

    // 5. Revalidar cachés de rutas
    revalidatePath(`/workspace/${businessId}`);
    revalidatePath(`/workspace/${businessId}/configuracion`);
    revalidatePath(`/workspace/${businessId}/configuracion/documentos`);

    return { success: true, config: res.config };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al actualizar la configuración del negocio." };
  }
}

/**
 * Carga y actualiza el logotipo del negocio en Supabase Storage en la ruta aislada del tenant.
 */
export async function uploadWorkspaceLogoAction(
  businessId: string,
  formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // 1. Validar autorización estricta del workspace
    const auth = await verifyWorkspaceAction(businessId, "business_settings.update");
    if (!auth.success) {
      return { success: false, error: auth.error || "No autorizado para subir archivos de marca." };
    }

    const file = formData.get("logo") as File;
    if (!file) return { success: false, error: "No se proporcionó ningún archivo de imagen." };

    if (!file.type.startsWith("image/")) {
      return { success: false, error: "El archivo debe ser una imagen válida (PNG, JPG, WEBP)." };
    }

    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return { success: false, error: "El archivo supera el tamaño máximo permitido de 5MB." };
    }

    let adminClient: any;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const { createClient: createAdminClient } = await import("@supabase/supabase-js");
      adminClient = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
    } else {
      adminClient = await createClient();
    }

    // 2. Validar bucket de almacenamiento
    await ensureNegovaBucket(adminClient);

    // 3. Generar ruta aislada por tenant
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "png";
    const fileName = `logo-${Date.now()}.${fileExt}`;
    const filePath = STORAGE_PATHS.businessLogoFile(businessId, fileName);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4. Subir a Supabase Storage
    const { error: uploadError } = await adminClient.storage
      .from("negova-storage")
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      return { success: false, error: `Error de almacenamiento: ${uploadError.message}` };
    }

    // 5. Obtener URL pública
    const { data: publicUrlData } = adminClient.storage
      .from("negova-storage")
      .getPublicUrl(filePath);

    if (!publicUrlData.publicUrl) {
      return { success: false, error: "No se pudo generar la URL pública del logotipo." };
    }

    const publicUrl = publicUrlData.publicUrl;

    // 6. Actualizar en business_document_configs y businesses
    await saveBusinessDocumentConfig(businessId, { logoUrl: publicUrl });

    try {
      await adminClient
        .from("businesses")
        .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
        .eq("id", businessId);
    } catch (bizErr) {
      console.warn("[uploadWorkspaceLogoAction] Aviso al actualizar logo en businesses:", bizErr);
    }

    // 7. Auditoría centralizada
    try {
      await logAuditAction({
        userId: auth.context?.userId,
        action: "update",
        entityType: "business_settings",
        entityId: businessId,
        businessId: businessId,
        businessName: auth.context?.businessName,
        metadata: {
          original_action: "upload_business_logo",
          file_name: fileName,
          logo_url: publicUrl,
        },
      });
    } catch (auditErr) {
      console.warn("[uploadWorkspaceLogoAction] Aviso al registrar auditoría:", auditErr);
    }

    revalidatePath(`/workspace/${businessId}`);
    revalidatePath(`/workspace/${businessId}/configuracion`);
    revalidatePath(`/workspace/${businessId}/configuracion/documentos`);

    return { success: true, url: publicUrl };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al subir logotipo del negocio." };
  }
}

/**
 * Elimina el logotipo actual del negocio.
 * Vacía logo_url en business_document_configs y businesses.
 */
export async function removeWorkspaceLogoAction(
  businessId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "business_settings.update");
    if (!auth.success) {
      return { success: false, error: auth.error || "No autorizado para modificar la identidad visual." };
    }

    // 1. Limpiar en business_document_configs
    await saveBusinessDocumentConfig(businessId, { logoUrl: null });

    // 2. Limpiar en businesses
    let adminClient: any;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const { createClient: createAdminClient } = await import("@supabase/supabase-js");
      adminClient = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
    } else {
      adminClient = await createClient();
    }

    await adminClient
      .from("businesses")
      .update({ logo_url: null, updated_at: new Date().toISOString() })
      .eq("id", businessId);

    // 3. Auditoría
    try {
      await logAuditAction({
        userId: auth.context?.userId,
        action: "update",
        entityType: "business_settings",
        entityId: businessId,
        businessId,
        businessName: auth.context?.businessName,
        metadata: { original_action: "remove_business_logo" },
      });
    } catch (auditErr) {
      console.warn("[removeWorkspaceLogoAction] Aviso al registrar auditoría:", auditErr);
    }

    revalidatePath(`/workspace/${businessId}`);
    revalidatePath(`/workspace/${businessId}/configuracion`);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al eliminar logotipo del negocio." };
  }
}

/**
 * Actualiza las actividades comerciales del negocio.
 * Aplica normalización (coherencia citas ↔ servicios) y garantiza al menos una actividad activa.
 */
export async function updateCommercialActivitiesAction(
  businessId: string,
  activities: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "business_settings.update");
    if (!auth.success) {
      return { success: false, error: auth.error || "No autorizado para modificar las actividades comerciales." };
    }

    // Solo el propietario o super administrador puede reconfigurar las actividades del comercio
    if (!auth.context?.isOwner && !auth.context?.isSuperAdmin) {
      return { success: false, error: "Solo el propietario del negocio puede modificar las actividades comerciales." };
    }

    // 1. Filtrar únicamente actividades comerciales válidas y reconocidas por NEGOVA
    const validActivities = ["sell_products", "provide_services", "manage_appointments"] as const;
    const sanitized = (activities || []).filter((a): a is typeof validActivities[number] =>
      validActivities.includes(a as any)
    );

    // 2. Regla de coherencia estricta: Si se deshabilitan los servicios, la gestión de citas NO puede permanecer activa
    const hasServices = sanitized.includes("provide_services");
    const normalized = sanitized.filter((a) => {
      if (a === "manage_appointments" && !hasServices) {
        return false;
      }
      return true;
    });

    // 3. Validación: No es posible dejar el negocio sin actividades comerciales
    if (normalized.length === 0) {
      return { success: false, error: "El negocio debe tener al menos una actividad comercial activa." };
    }

    let adminClient: any;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const { createClient: createAdminClient } = await import("@supabase/supabase-js");
      adminClient = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
    } else {
      adminClient = await createClient();
    }

    const { error: updateError } = await adminClient
      .from("businesses")
      .update({
        commercial_activities: normalized,
        updated_at: new Date().toISOString(),
      })
      .eq("id", businessId);

    if (updateError) {
      return { success: false, error: "No fue posible actualizar las actividades comerciales." };
    }

    // Auditoría
    try {
      await logAuditAction({
        userId: auth.context?.userId,
        action: "update",
        entityType: "business_settings",
        entityId: businessId,
        businessId,
        businessName: auth.context?.businessName,
        metadata: {
          original_action: "update_commercial_activities",
          activities_before: auth.context?.commercialActivities,
          activities_after: normalized,
        },
      });
    } catch (auditErr) {
      console.warn("[updateCommercialActivitiesAction] Aviso al registrar auditoría:", auditErr);
    }

    revalidatePath(`/workspace/${businessId}`);
    revalidatePath(`/workspace/${businessId}/configuracion`);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al actualizar las actividades comerciales." };
  }
}

/**
 * Actualiza las preferencias operativas del POS guardadas en businesses.settings.
 * Realiza un merge parcial estricto con lista blanca para no sobrescribir otras secciones del jsonb
 * y evitar que el cliente se autoconceda funciones de pago o eluda restricciones.
 */
export async function updateBusinessSettingsAction(
  businessId: string,
  settingsPatch: { pos?: Record<string, unknown> }
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "business_settings.update");
    if (!auth.success) {
      return { success: false, error: auth.error || "No autorizado para modificar las preferencias del negocio." };
    }

    // Solo el propietario o super administrador puede modificar las preferencias
    if (!auth.context?.isOwner && !auth.context?.isSuperAdmin) {
      return { success: false, error: "Solo el propietario puede modificar las preferencias del negocio." };
    }

    // Validaciones estrictas de las preferencias del POS
    const pos = settingsPatch.pos;
    if (pos !== undefined) {
      if (pos.receiptCopies !== undefined) {
        const copies = Number(pos.receiptCopies);
        if (isNaN(copies) || copies < 1 || copies > 3) {
          return { success: false, error: "El número de copias del comprobante debe estar entre 1 y 3." };
        }
      }
      const validPaymentMethods = ["cash", "transfer", "card"];
      if (pos.defaultPaymentMethod !== undefined && !validPaymentMethods.includes(pos.defaultPaymentMethod as string)) {
        return { success: false, error: "Método de pago predeterminado no válido." };
      }
    }

    let adminClient: any;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const { createClient: createAdminClient } = await import("@supabase/supabase-js");
      adminClient = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
    } else {
      adminClient = await createClient();
    }

    // Obtener settings existentes
    const { data: currentBiz } = await adminClient
      .from("businesses")
      .select("settings")
      .eq("id", businessId)
      .maybeSingle();

    const currentSettings = (currentBiz?.settings as Record<string, unknown>) || {};
    
    // Lista blanca estricta para evitar inyección de claves ajenas (ej. featureOverrides, plan)
    const existingPos = (typeof currentSettings.pos === "object" && currentSettings.pos !== null)
      ? (currentSettings.pos as Record<string, unknown>)
      : {};

    const safePosSettings: Record<string, unknown> = { ...existingPos };

    if (pos) {
      if (typeof pos.printReceipt === "boolean") {
        safePosSettings.printReceipt = pos.printReceipt;
      }
      if (typeof pos.receiptCopies === "number") {
        safePosSettings.receiptCopies = pos.receiptCopies;
      }
      if (typeof pos.defaultPaymentMethod === "string" && ["cash", "transfer", "card"].includes(pos.defaultPaymentMethod)) {
        safePosSettings.defaultPaymentMethod = pos.defaultPaymentMethod;
      }
      if (typeof pos.askCustomerName === "boolean") {
        safePosSettings.askCustomerName = pos.askCustomerName;
      }
    }

    // Merge seguro: conserva todas las demás claves de businesses.settings intactas
    const mergedSettings: Record<string, unknown> = {
      ...currentSettings,
      pos: safePosSettings,
    };

    const { error: updateError } = await adminClient
      .from("businesses")
      .update({ settings: mergedSettings, updated_at: new Date().toISOString() })
      .eq("id", businessId);

    if (updateError) {
      return { success: false, error: "No fue posible guardar las preferencias del negocio." };
    }

    // Auditoría
    try {
      await logAuditAction({
        userId: auth.context?.userId,
        action: "update",
        entityType: "business_settings",
        entityId: businessId,
        businessId,
        businessName: auth.context?.businessName,
        metadata: { original_action: "update_business_settings", patch: settingsPatch },
      });
    } catch (auditErr) {
      console.warn("[updateBusinessSettingsAction] Aviso al registrar auditoría:", auditErr);
    }

    revalidatePath(`/workspace/${businessId}`);
    revalidatePath(`/workspace/${businessId}/configuracion`);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al guardar preferencias del negocio." };
  }
}

/**
 * Actualiza el módulo de acceso rápido del encabezado en businesses.settings.headerQuickAccess.
 * Solo el propietario autorizado del negocio puede modificar esta preferencia.
 * Valida que el moduleId pertenezca al catálogo oficial de módulos de NEGOVA.
 */
export async function updateHeaderQuickAccessAction(
  businessId: string,
  moduleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "business_settings.update");
    if (!auth.success) {
      return { success: false, error: auth.error || "No autorizado para modificar la configuración." };
    }

    // Solo el propietario o super administrador puede modificar el acceso rápido
    if (!auth.context?.isOwner && !auth.context?.isSuperAdmin) {
      return { success: false, error: "Solo el propietario del negocio puede modificar el acceso rápido del encabezado." };
    }

    // Lista blanca estricta: validar que el moduleId pertenezca al catálogo oficial
    const validModule = WORKSPACE_MODULES_CATALOG.find((m) => m.id === moduleId);
    if (!validModule) {
      return { success: false, error: "El módulo seleccionado no es válido en el catálogo de NEGOVA." };
    }

    let adminClient: any;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const { createClient: createAdminClient } = await import("@supabase/supabase-js");
      adminClient = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
    } else {
      adminClient = await createClient();
    }

    // Obtener settings existentes
    const { data: currentBiz } = await adminClient
      .from("businesses")
      .select("settings")
      .eq("id", businessId)
      .maybeSingle();

    const currentSettings = (currentBiz?.settings as Record<string, unknown>) || {};

    // Merge seguro: conserva intactas todas las demás claves de businesses.settings
    const mergedSettings: Record<string, unknown> = {
      ...currentSettings,
      headerQuickAccess: validModule.id,
    };

    const { error: updateError } = await adminClient
      .from("businesses")
      .update({ settings: mergedSettings, updated_at: new Date().toISOString() })
      .eq("id", businessId);

    if (updateError) {
      return { success: false, error: "No fue posible guardar el acceso rápido del encabezado." };
    }

    // Auditoría
    try {
      await logAuditAction({
        userId: auth.context?.userId,
        action: "update",
        entityType: "business_settings",
        entityId: businessId,
        businessId,
        businessName: auth.context?.businessName,
        metadata: {
          original_action: "update_header_quick_access",
          header_quick_access: validModule.id,
        },
      });
    } catch (auditErr) {
      console.warn("[updateHeaderQuickAccessAction] Aviso al registrar auditoría:", auditErr);
    }

    revalidatePath(`/workspace/${businessId}`);
    revalidatePath(`/workspace/${businessId}/configuracion`);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al actualizar el acceso rápido del encabezado." };
  }
}

/**
 * Actualiza la configuración comercial de domicilios (activación y tarifa fija en COP).
 * - Restringido exclusivamente al propietario (isOwner) o superAdmin.
 * - Valida importes monetarios válidos (>= 0 y dentro de rangos normales).
 * - Persiste en businesses.settings.delivery y sincroniza business_digital_menus.
 * - Registra evento en auditoría forense y revalida rutas de workspace.
 */
export async function updateDeliverySettingsAction(
  businessId: string,
  payload: {
    enabled: boolean;
    fee: number;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "business_settings.update");
    if (!auth.success) {
      return { success: false, error: auth.error || "No autorizado para modificar la configuración." };
    }

    // Solo el propietario o super administrador puede modificar la tarifa y servicio de domicilio
    if (!auth.context?.isOwner && !auth.context?.isSuperAdmin) {
      return {
        success: false,
        error: "Solo el propietario del negocio puede modificar la configuración de domicilios.",
      };
    }

    // Validaciones estrictas de datos
    if (typeof payload.enabled !== "boolean") {
      return { success: false, error: "El estado de activación del servicio debe ser booleano." };
    }

    if (
      typeof payload.fee !== "number" ||
      isNaN(payload.fee) ||
      payload.fee < 0 ||
      payload.fee > 10_000_000
    ) {
      return {
        success: false,
        error: "La tarifa de domicilio debe ser un valor monetario válido entre 0 y $10.000.000 COP.",
      };
    }

    const roundedFee = Math.round(payload.fee);

    let adminClient: any;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const { createClient: createAdminClient } = await import("@supabase/supabase-js");
      adminClient = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
    } else {
      adminClient = await createClient();
    }

    // 1. Obtener settings actuales de businesses para merge seguro
    const { data: currentBiz, error: fetchBizError } = await adminClient
      .from("businesses")
      .select("settings")
      .eq("id", businessId)
      .maybeSingle();

    if (fetchBizError) {
      return { success: false, error: "No fue posible consultar la configuración actual del negocio." };
    }

    const currentSettings = (currentBiz?.settings as Record<string, unknown>) || {};
    const mergedSettings: Record<string, unknown> = {
      ...currentSettings,
      delivery: {
        enabled: payload.enabled,
        fee: roundedFee,
      },
    };

    const { error: updateBizError } = await adminClient
      .from("businesses")
      .update({
        settings: mergedSettings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", businessId);

    if (updateBizError) {
      return { success: false, error: "No fue posible guardar la configuración de domicilios en el negocio." };
    }

    // 2. Sincronizar business_digital_menus (si existe el registro)
    try {
      const { data: currentMenu } = await adminClient
        .from("business_digital_menus")
        .select("custom_settings")
        .eq("business_id", businessId)
        .maybeSingle();

      if (currentMenu) {
        const mergedCustomSettings = {
          ...(currentMenu.custom_settings || {}),
          deliveryEnabled: payload.enabled,
          deliveryFee: roundedFee,
        };
        await adminClient
          .from("business_digital_menus")
          .update({
            custom_settings: mergedCustomSettings,
            updated_at: new Date().toISOString(),
          })
          .eq("business_id", businessId);
      }
    } catch (menuSyncErr) {
      console.warn("[updateDeliverySettingsAction] Aviso al sincronizar menú digital:", menuSyncErr);
    }

    // 3. Auditoría forense
    try {
      await logAuditAction({
        userId: auth.context?.userId,
        action: "update",
        entityType: "business_settings",
        entityId: businessId,
        businessId,
        businessName: auth.context?.businessName,
        metadata: {
          original_action: "update_delivery_settings",
          delivery_enabled: payload.enabled,
          delivery_fee: roundedFee,
        },
      });
    } catch (auditErr) {
      console.warn("[updateDeliverySettingsAction] Aviso al registrar auditoría:", auditErr);
    }

    // 4. Revalidar rutas
    revalidatePath(`/workspace/${businessId}`);
    revalidatePath(`/workspace/${businessId}/configuracion`);

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Error al actualizar la configuración de domicilios.",
    };
  }
}


