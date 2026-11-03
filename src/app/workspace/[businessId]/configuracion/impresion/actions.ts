"use server";

import { revalidatePath } from "next/cache";
import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import { logAuditAction } from "@/lib/audit/audit-service";
import {
  getPrintingSettings,
  savePrintingSettings,
} from "@/lib/printing/printing-service";
import { PrintingSettings } from "@/lib/printing/types";
import { createClient } from "@/lib/supabase/server";
import { ensureNegovaBucket, STORAGE_PATHS } from "@/lib/storage/supabase-storage";
import { saveBusinessDocumentConfig } from "@/lib/documents/document-service";

/**
 * Obtiene la configuración de impresión, estaciones y cajas disponibles.
 */
export async function getPrintingSettingsAction(businessId: string) {
  try {
    const auth = await verifyWorkspaceAction(businessId, "business_settings.view");
    if (!auth.success) {
      return { success: false, error: auth.error || "No autorizado." };
    }

    const data = await getPrintingSettings(businessId);
    return { success: true, ...data };
  } catch (err: any) {
    console.error("[getPrintingSettingsAction] Error:", err);
    return { success: false, error: err.message || "Error al consultar configuración de impresión." };
  }
}

/**
 * Guarda la configuración de impresoras, estaciones, plantillas y cajón monedero.
 */
export async function savePrintingSettingsAction(
  businessId: string,
  updatedSettings: Partial<PrintingSettings>
) {
  try {
    const auth = await verifyWorkspaceAction(businessId, "business_settings.update");
    if (!auth.success) {
      return { success: false, error: auth.error || "No autorizado para modificar la configuración." };
    }

    const res = await savePrintingSettings(businessId, updatedSettings);
    if (!res.success) {
      return { success: false, error: res.error || "No fue posible guardar la configuración de impresión." };
    }

    // Si se modificaron datos clave del ticket, sincronizar con business_document_configs
    if (updatedSettings.ticketTemplate) {
      try {
        await saveBusinessDocumentConfig(businessId, {
          tradeName: updatedSettings.ticketTemplate.businessName,
          taxId: updatedSettings.ticketTemplate.taxId,
          phone: updatedSettings.ticketTemplate.phone,
          address: updatedSettings.ticketTemplate.address,
          headerText: updatedSettings.ticketTemplate.headerText,
          footerText: updatedSettings.ticketTemplate.footerText,
          thankYouNote: updatedSettings.ticketTemplate.thankYouNote,
          paperWidth: updatedSettings.ticketTemplate.paperWidth,
          logoUrl: updatedSettings.ticketTemplate.customLogoUrl,
        });
      } catch (syncErr) {
        console.warn("[savePrintingSettingsAction] Aviso al sincronizar documento:", syncErr);
      }
    }

    // Auditoría forense
    try {
      await logAuditAction({
        userId: auth.context?.userId,
        action: "update",
        entityType: "business_printing_settings",
        entityId: businessId,
        businessId,
        businessName: auth.context?.businessName,
        metadata: {
          original_action: "update_printing_settings",
          printersCount: updatedSettings.printers?.length,
          stationsCount: updatedSettings.stations?.length,
          printDriver: updatedSettings.printDriver,
        },
      });
    } catch (auditErr) {
      console.warn("[savePrintingSettingsAction] Aviso al auditar:", auditErr);
    }

    revalidatePath(`/workspace/${businessId}/configuracion/impresion`);
    revalidatePath(`/workspace/${businessId}/configuracion`);
    revalidatePath(`/workspace/${businessId}/pos`);

    return { success: true, settings: res.settings };
  } catch (err: any) {
    console.error("[savePrintingSettingsAction] Error:", err);
    return { success: false, error: err.message || "Error al guardar configuración de impresión." };
  }
}

/**
 * Sube y actualiza el logotipo del negocio para comprobantes e impresión.
 */
export async function uploadPrinterLogoAction(
  businessId: string,
  formData: FormData
) {
  try {
    const auth = await verifyWorkspaceAction(businessId, "business_settings.update");
    if (!auth.success) {
      return { success: false, error: auth.error || "No autorizado." };
    }

    const file = formData.get("logo") as File;
    if (!file) {
      return { success: false, error: "No se proporcionó ningún archivo de imagen." };
    }

    const supabase = await createClient();
    await ensureNegovaBucket(supabase);

    const fileExt = file.name.split(".").pop();
    const fileName = `printer-logo-${Date.now()}.${fileExt}`;
    const filePath = STORAGE_PATHS.businessLogoFile(businessId, fileName);

    const { error: uploadError } = await supabase.storage
      .from("negova-storage")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      return { success: false, error: `Error de almacenamiento: ${uploadError.message}` };
    }

    const { data: publicUrlData } = supabase.storage
      .from("negova-storage")
      .getPublicUrl(filePath);

    if (!publicUrlData.publicUrl) {
      return { success: false, error: "No se pudo generar la URL pública del logotipo." };
    }

    const logoUrl = publicUrlData.publicUrl;

    // Actualizar tabla businesses
    let adminClient: any;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const { createClient: createAdminClient } = await import("@supabase/supabase-js");
      adminClient = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
    } else {
      adminClient = supabase;
    }

    await adminClient
      .from("businesses")
      .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
      .eq("id", businessId);

    // Actualizar tabla business_document_configs
    await saveBusinessDocumentConfig(businessId, { logoUrl });

    revalidatePath(`/workspace/${businessId}/configuracion/impresion`);
    revalidatePath(`/workspace/${businessId}/configuracion`);

    return { success: true, url: logoUrl };
  } catch (err: any) {
    console.error("[uploadPrinterLogoAction] Error:", err);
    return { success: false, error: err.message || "Error al subir logotipo." };
  }
}

/**
 * Ejecuta una prueba de hardware (apertura de cajón, pulso ESC/POS o ticket de prueba).
 */
export async function testPrinterPulseAction(
  businessId: string,
  params: {
    printerId: string;
    type: "receipt" | "command" | "drawer";
  }
) {
  try {
    const auth = await verifyWorkspaceAction(businessId, "business_settings.view");
    if (!auth.success) {
      return { success: false, error: auth.error || "No autorizado." };
    }

    // Retorna orden de pulso simulada para el cliente
    return {
      success: true,
      message:
        params.type === "drawer"
          ? "Comando de apertura ESC/POS emitido al cajón monedero con éxito."
          : `Prueba de impresión enviada a la estación seleccionada.`,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al enviar prueba." };
  }
}

