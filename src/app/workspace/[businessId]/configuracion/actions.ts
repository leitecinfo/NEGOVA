"use server";

import { revalidatePath } from "next/cache";
import { saveBusinessDocumentConfig } from "@/lib/documents/document-service";
import { BusinessDocumentConfig } from "@/lib/documents/types";
import { createClient } from "@/lib/supabase/server";
import { ensureNegovaBucket, STORAGE_PATHS } from "@/lib/storage/supabase-storage";
import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import { logAuditAction } from "@/lib/audit/audit-service";

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
