"use server";

import { revalidatePath } from "next/cache";
import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import {
  getDianBillingConfig,
  saveDianBillingConfig,
  sendTestInvoiceToDian,
  getElectronicDocumentsList,
} from "@/lib/dian/dian-service";
import {
  DianBillingConfig,
  ElectronicInvoiceRecord,
} from "@/lib/dian/types";

/**
 * Server Action: Consulta la configuración de facturación electrónica DIAN [DIAN-001].
 */
export async function getDianBillingConfigAction(
  businessId: string
): Promise<{ success: boolean; data?: DianBillingConfig; config?: DianBillingConfig; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "business_settings.view");
  if (!auth.success) {
    return {
      success: false,
      error: auth.error || "No autorizado para consultar la facturación electrónica.",
    };
  }

  try {
    const data = await getDianBillingConfig(businessId);
    return { success: true, data, config: data };
  } catch (err: any) {
    console.error("[getDianBillingConfigAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al obtener la configuración DIAN.",
    };
  }
}

/**
 * Server Action: Guarda la configuración de facturación electrónica DIAN [DIAN-001].
 */
export async function saveDianBillingConfigAction(
  businessId: string,
  input: Partial<DianBillingConfig>
): Promise<{ success: boolean; data?: DianBillingConfig; config?: DianBillingConfig; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "business_settings.update");
  if (!auth.success) {
    return {
      success: false,
      error: auth.error || "No autorizado para modificar la facturación electrónica.",
    };
  }

  try {
    const result = await saveDianBillingConfig(businessId, input, auth.context?.userId);
    if (result.success && result.config) {
      try {
        revalidatePath(`/workspace/${businessId}/configuracion/facturacion-electronica`);
      } catch {}
      return { success: true, data: result.config, config: result.config };
    }
    return { success: false, error: result.error || "No fue posible guardar la configuración." };
  } catch (err: any) {
    console.error("[saveDianBillingConfigAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al guardar la configuración DIAN.",
    };
  }
}

/**
 * Server Action: Emite una factura de prueba en modo Habilitación DIAN [DIAN-001].
 */
export async function sendTestInvoiceToDianAction(
  businessId: string
): Promise<{
  success: boolean;
  invoice?: ElectronicInvoiceRecord;
  message?: string;
  error?: string;
}> {
  const auth = await verifyWorkspaceAction(businessId, "business_settings.update");
  if (!auth.success) {
    return {
      success: false,
      error: auth.error || "No autorizado para enviar pruebas a la DIAN.",
    };
  }

  try {
    const result = await sendTestInvoiceToDian(businessId, auth.context?.userId);
    if (result.success) {
      try {
        revalidatePath(`/workspace/${businessId}/configuracion/facturacion-electronica`);
      } catch {}
    }
    return result;
  } catch (err: any) {
    console.error("[sendTestInvoiceToDianAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al enviar la factura de prueba a la DIAN.",
    };
  }
}

/**
 * Server Action: Consulta el listado de facturas y notas electrónicas emitidas [DIAN-001].
 */
export async function getElectronicDocumentsListAction(
  businessId: string,
  filters: { status?: string; type?: string; documentType?: string; search?: string; page?: number; pageSize?: number } = {}
): Promise<{
  success: boolean;
  data?: {
    documents: ElectronicInvoiceRecord[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  documents?: ElectronicInvoiceRecord[];
  total?: number;
  error?: string;
}> {
  const auth = await verifyWorkspaceAction(businessId, "sales.view");
  if (!auth.success) {
    return {
      success: false,
      error: auth.error || "No autorizado para consultar documentos electrónicos.",
    };
  }

  try {
    const data = await getElectronicDocumentsList(businessId, filters);
    return { success: true, data, documents: data.documents, total: data.total };
  } catch (err: any) {
    console.error("[getElectronicDocumentsListAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al consultar documentos electrónicos.",
    };
  }
}
