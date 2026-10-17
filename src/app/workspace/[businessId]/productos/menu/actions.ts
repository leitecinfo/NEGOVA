"use server";

import { revalidatePath } from "next/cache";
import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import * as menuService from "@/lib/menu/menu-service";
import {
  BusinessDigitalMenu,
  DigitalMenuModality,
  DigitalMenuTemplateId,
  DigitalMenuCustomSettings,
} from "@/lib/menu/types";

export async function getDigitalMenuAction(
  businessId: string
): Promise<{ success: boolean; data?: BusinessDigitalMenu; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "products.view");
    if (!auth.success) return { success: false, error: auth.error };

    const menu = await menuService.getOrCreateDigitalMenu(businessId);
    return { success: true, data: menu };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Error al consultar la configuración del menú digital.",
    };
  }
}

export async function saveDigitalMenuConfigAction(
  businessId: string,
  payload: {
    modality?: DigitalMenuModality;
    template_id?: DigitalMenuTemplateId;
    custom_settings?: Partial<DigitalMenuCustomSettings>;
    is_published?: boolean;
  }
): Promise<{ success: boolean; data?: BusinessDigitalMenu; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "products.update");
    if (!auth.success) return { success: false, error: auth.error };

    const res = await menuService.saveDigitalMenuConfig(businessId, payload);
    if (!res.success) {
      return { success: false, error: res.error };
    }

    revalidatePath(`/workspace/${businessId}/productos/menu`);
    revalidatePath(`/workspace/${businessId}/productos`);
    return { success: true, data: res.data };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Error al guardar configuración del menú.",
    };
  }
}

export async function uploadDigitalMenuFileAction(
  businessId: string,
  formData: FormData
): Promise<{ success: boolean; data?: BusinessDigitalMenu; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "products.update");
    if (!auth.success) return { success: false, error: auth.error };

    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof File)) {
      return { success: false, error: "No se proporcionó ningún archivo válido." };
    }

    const res = await menuService.uploadDigitalMenuFileSafe(businessId, file);
    if (!res.success) {
      return { success: false, error: res.error };
    }

    revalidatePath(`/workspace/${businessId}/productos/menu`);
    return { success: true, data: res.data };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Error al subir el archivo del menú digital.",
    };
  }
}

export async function removeDigitalMenuFileAction(
  businessId: string
): Promise<{ success: boolean; data?: BusinessDigitalMenu; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "products.update");
    if (!auth.success) return { success: false, error: auth.error };

    const res = await menuService.removeDigitalMenuFileSafe(businessId);
    if (!res.success) {
      return { success: false, error: res.error };
    }

    revalidatePath(`/workspace/${businessId}/productos/menu`);
    return { success: true, data: res.data };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Error al retirar el archivo del menú digital.",
    };
  }
}

export async function togglePublishDigitalMenuAction(
  businessId: string,
  isPublished: boolean
): Promise<{ success: boolean; data?: BusinessDigitalMenu; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "products.update");
    if (!auth.success) return { success: false, error: auth.error };

    const res = await menuService.togglePublishDigitalMenu(businessId, isPublished);
    if (!res.success) {
      return { success: false, error: res.error };
    }

    revalidatePath(`/workspace/${businessId}/productos/menu`);
    return { success: true, data: res.data };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Error al cambiar estado de publicación.",
    };
  }
}
