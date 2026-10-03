"use server";

import { revalidatePath } from "next/cache";
import { saveBusinessDocumentConfig } from "@/lib/documents/document-service";
import { BusinessDocumentConfig } from "@/lib/documents/types";
import { createClient } from "@/lib/supabase/server";
import { ensureNegovaBucket, STORAGE_PATHS } from "@/lib/storage/supabase-storage";

export async function updateDocumentConfigAction(
  businessId: string,
  config: Partial<BusinessDocumentConfig>
) {
  try {
    const res = await saveBusinessDocumentConfig(businessId, config);
    if (res.success) {
      revalidatePath(`/workspace/${businessId}/configuracion/documentos`);
      return { success: true };
    }
    return { success: false, error: res.error };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al actualizar configuración." };
  }
}

export async function uploadBusinessLogoAction(
  businessId: string,
  formData: FormData
) {
  try {
    const file = formData.get("logo") as File;
    if (!file) return { success: false, error: "No se proporcionó ningún archivo." };

    const supabase = await createClient();
    
    // Validar sesión / Permisos si es necesario (el middleware y RLS deben cubrirlo)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "No autorizado." };

    // Validar bucket
    await ensureNegovaBucket(supabase);

    // Preparar archivo
    const fileExt = file.name.split(".").pop();
    const fileName = `logo-${Date.now()}.${fileExt}`;
    const filePath = STORAGE_PATHS.businessLogoFile(businessId, fileName);

    // Subir a Storage
    const { error: uploadError } = await supabase.storage
      .from("negova-storage")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    // Obtener URL Pública
    const { data: publicUrlData } = supabase.storage
      .from("negova-storage")
      .getPublicUrl(filePath);

    if (!publicUrlData.publicUrl) {
      return { success: false, error: "No se pudo generar la URL pública." };
    }

    // Actualizar config
    const res = await saveBusinessDocumentConfig(businessId, { logoUrl: publicUrlData.publicUrl });
    
    if (res.success) {
      revalidatePath(`/workspace/${businessId}/configuracion/documentos`);
      return { success: true, url: publicUrlData.publicUrl };
    }
    
    return { success: false, error: res.error };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al subir logotipo." };
  }
}
