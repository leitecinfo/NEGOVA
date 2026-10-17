"use server";

import { revalidatePath } from "next/cache";
import { saveBusinessDocumentConfig } from "@/lib/documents/document-service";
import { BusinessDocumentConfig } from "@/lib/documents/types";
import { createClient } from "@/lib/supabase/server";
import { ensureNegovaBucket, STORAGE_PATHS } from "@/lib/storage/supabase-storage";
import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import { logAuditAction } from "@/lib/audit/audit-service";

export async function updateDocumentConfigAction(
  businessId: string,
  config: Partial<BusinessDocumentConfig>
) {
  try {
    // 1. Validar autorización estricta del workspace (usuario autenticado, membresía y rol owner)
    const auth = await verifyWorkspaceAction(businessId, "business_settings.update");
    if (!auth.success) {
      return { success: false, error: auth.error || "No autorizado." };
    }

    // 2. Persistir en la base de datos PostgreSQL
    const res = await saveBusinessDocumentConfig(businessId, config);
    if (!res.success) {
      return { success: false, error: res.error || "No fue posible guardar la configuración." };
    }

    // 3. Registrar auditoría forense (No bloqueante)
    try {
      await logAuditAction({
        userId: auth.context?.userId,
        action: "update",
        entityType: "business_document_config",
        entityId: businessId,
        businessId: businessId,
        businessName: auth.context?.businessName,
        metadata: {
          original_action: "update_business_document_config",
          updated_fields: Object.keys(config),
        },
      });
    } catch (auditErr) {
      console.error("[updateDocumentConfigAction] Error al registrar auditoría:", auditErr);
    }

    revalidatePath(`/workspace/${businessId}/configuracion`);
    revalidatePath(`/workspace/${businessId}/configuracion/documentos`);

    return { success: true, config: res.config };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al actualizar configuración." };
  }
}

export async function uploadBusinessLogoAction(
  businessId: string,
  formData: FormData
) {
  try {
    // 1. Validar autorización estricta del workspace
    const auth = await verifyWorkspaceAction(businessId, "business_settings.update");
    if (!auth.success) {
      return { success: false, error: auth.error || "No autorizado." };
    }

    const file = formData.get("logo") as File;
    if (!file) return { success: false, error: "No se proporcionó ningún archivo." };

    const supabase = await createClient();

    // 2. Validar bucket de almacenamiento
    await ensureNegovaBucket(supabase);

    // 3. Preparar archivo y ruta segura aislada por tenant
    const fileExt = file.name.split(".").pop();
    const fileName = `logo-${Date.now()}.${fileExt}`;
    const filePath = STORAGE_PATHS.businessLogoFile(businessId, fileName);

    // 4. Subir a Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("negova-storage")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      return { success: false, error: `Error de almacenamiento: ${uploadError.message}` };
    }

    // 5. Obtener URL Pública
    const { data: publicUrlData } = supabase.storage
      .from("negova-storage")
      .getPublicUrl(filePath);

    if (!publicUrlData.publicUrl) {
      return { success: false, error: "No se pudo generar la URL pública del logotipo." };
    }

    // 6. Actualizar configuración en base de datos
    const res = await saveBusinessDocumentConfig(businessId, { logoUrl: publicUrlData.publicUrl });
    if (!res.success) {
      return { success: false, error: res.error || "No se pudo vincular el logo a la configuración." };
    }

    // 7. Registrar evento en auditoría central (No bloqueante)
    try {
      await logAuditAction({
        userId: auth.context?.userId,
        action: "update",
        entityType: "business_document_config",
        entityId: businessId,
        businessId: businessId,
        businessName: auth.context?.businessName,
        metadata: {
          original_action: "update_business_logo",
          file_name: fileName,
        },
      });
    } catch (auditErr) {
      console.error("[uploadBusinessLogoAction] Error al registrar auditoría:", auditErr);
    }

    revalidatePath(`/workspace/${businessId}/configuracion`);
    revalidatePath(`/workspace/${businessId}/configuracion/documentos`);

    return { success: true, url: publicUrlData.publicUrl };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al subir logotipo." };
  }
}

