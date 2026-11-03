"use server";

import { revalidatePath } from "next/cache";
import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import {
  getBusinessLinksPageConfig,
  saveBusinessLinksPageConfig,
  getDefaultPredefinedLinks,
} from "@/lib/links/links-service";
import {
  BusinessLinksPageConfig,
  UpdateLinksPageInput,
} from "@/lib/links/types";

/**
 * Server Action: Consulta la configuración de la página de enlaces del comercio [CONF-005].
 */
export async function getBusinessLinksPageConfigAction(
  businessId: string
): Promise<{ success: boolean; data?: BusinessLinksPageConfig; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "business_settings.view");
  if (!auth.success) {
    return {
      success: false,
      error: auth.error || "No autorizado para consultar la página de enlaces.",
    };
  }

  try {
    const data = await getBusinessLinksPageConfig(businessId);
    return { success: true, data };
  } catch (err: any) {
    console.error("[getBusinessLinksPageConfigAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al obtener la configuración de enlaces.",
    };
  }
}

/**
 * Server Action: Guarda y actualiza la configuración de la página de enlaces [CONF-005].
 */
export async function saveBusinessLinksPageConfigAction(
  businessId: string,
  input: UpdateLinksPageInput
): Promise<{ success: boolean; data?: BusinessLinksPageConfig; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "business_settings.update");
  if (!auth.success) {
    return {
      success: false,
      error: auth.error || "No autorizado para modificar la página de enlaces.",
    };
  }

  try {
    const result = await saveBusinessLinksPageConfig(businessId, input, auth.context?.userId);
    if (result.success && result.config) {
      revalidatePath(`/workspace/${businessId}/configuracion/pagina-enlaces`);
      revalidatePath(`/links/${result.config.slug}`);
      revalidatePath(`/negocio/${result.config.slug}`);
      return { success: true, data: result.config };
    }
    return { success: false, error: result.error || "No fue posible guardar la configuración." };
  } catch (err: any) {
    console.error("[saveBusinessLinksPageConfigAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al guardar la página de enlaces.",
    };
  }
}

/**
 * Server Action: Restaura los 5 enlaces predeterminados (Menú, Domicilio, WhatsApp, Instagram, Maps) [CONF-005].
 */
export async function resetPredefinedLinksAction(
  businessId: string
): Promise<{ success: boolean; data?: BusinessLinksPageConfig; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "business_settings.update");
  if (!auth.success) {
    return {
      success: false,
      error: auth.error || "No autorizado para modificar la página de enlaces.",
    };
  }

  try {
    const current = await getBusinessLinksPageConfig(businessId);
    const defaultLinks = getDefaultPredefinedLinks({
      id: businessId,
      name: current.businessName,
      slug: current.slug,
    });

    const result = await saveBusinessLinksPageConfig(
      businessId,
      { links: defaultLinks },
      auth.context?.userId
    );

    if (result.success && result.config) {
      revalidatePath(`/workspace/${businessId}/configuracion/pagina-enlaces`);
      revalidatePath(`/links/${result.config.slug}`);
      revalidatePath(`/negocio/${result.config.slug}`);
      return { success: true, data: result.config };
    }
    return { success: false, error: result.error || "No fue posible restaurar los enlaces." };
  } catch (err: any) {
    console.error("[resetPredefinedLinksAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al restaurar los enlaces por defecto.",
    };
  }
}
