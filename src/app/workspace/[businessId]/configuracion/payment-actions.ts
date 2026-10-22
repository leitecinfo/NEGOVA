"use server";

import { revalidatePath } from "next/cache";
import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import {
  getBusinessPaymentMethods,
  saveBusinessPaymentMethod,
  uploadPaymentMethodQr,
  deletePaymentMethodQr,
} from "@/lib/payments/payment-methods-service";
import { PaymentMethodCode, BusinessPaymentMethodConfig } from "@/lib/payments/types";
import { logAuditAction } from "@/lib/audit/audit-service";

/**
 * Server Action: Consulta los métodos de pago configurados para el comercio.
 */
export async function getPaymentMethodsAction(businessId: string): Promise<{
  success: boolean;
  methods?: Record<PaymentMethodCode, BusinessPaymentMethodConfig>;
  error?: string;
}> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "business_settings.view");
    if (!auth.success) {
      return { success: false, error: auth.error || "No autorizado para consultar métodos de pago." };
    }

    const methods = await getBusinessPaymentMethods(businessId);
    return { success: true, methods };
  } catch (err: any) {
    console.error("[getPaymentMethodsAction] Error:", err);
    return { success: false, error: err?.message || "Error al consultar métodos de pago." };
  }
}

/**
 * Server Action: Guarda los datos de cobro de un método específico.
 * Restringido estrictamente al propietario autorizado del comercio.
 */
export async function savePaymentMethodAction(
  businessId: string,
  methodCode: PaymentMethodCode,
  data: {
    isEnabled?: boolean;
    accountHolder?: string | null;
    destinationType?: any;
    destinationValue?: string | null;
    instructions?: string | null;
    breBKeyType?: any;
    qrUrl?: string | null;
    qrStoragePath?: string | null;
  }
): Promise<{ success: boolean; config?: BusinessPaymentMethodConfig; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "business_settings.update");
    if (!auth.success || !auth.context) {
      return { success: false, error: auth.error || "No autorizado para modificar configuración." };
    }

    if (!auth.context.isOwner) {
      return { success: false, error: "Solo el propietario del negocio puede modificar los métodos y datos de cobro." };
    }

    const res = await saveBusinessPaymentMethod(businessId, methodCode, data);

    if (!res.success) {
      return { success: false, error: res.error };
    }

    try {
      await logAuditAction({
        businessId,
        userId: auth.context.userId || null,
        action: "update_payment_method",
        entityType: "payment_method",
        entityId: methodCode,
        metadata: {
          methodCode,
          isEnabled: res.config?.isEnabled,
          isConfigured: res.config?.isConfigured,
        },
      });
    } catch (auditErr) {
      console.warn("[savePaymentMethodAction] Error al registrar auditoría:", auditErr);
    }

    revalidatePath(`/workspace/${businessId}/configuracion`);
    return { success: true, config: res.config };
  } catch (err: any) {
    console.error("[savePaymentMethodAction] Error:", err);
    return { success: false, error: err?.message || "Error inesperado al guardar método de pago." };
  }
}

/**
 * Server Action: Activa o desactiva un método de cobro.
 * Impide activar métodos con datos incompletos.
 */
export async function togglePaymentMethodAction(
  businessId: string,
  methodCode: PaymentMethodCode,
  isEnabled: boolean
): Promise<{ success: boolean; config?: BusinessPaymentMethodConfig; error?: string }> {
  return savePaymentMethodAction(businessId, methodCode, { isEnabled });
}

/**
 * Server Action: Carga la imagen de QR para una entidad (Bre-B u otras).
 */
export async function uploadPaymentQrAction(
  businessId: string,
  methodCode: PaymentMethodCode,
  formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "business_settings.update");
    if (!auth.success || !auth.context) {
      return { success: false, error: auth.error || "No autorizado para modificar configuración." };
    }

    if (!auth.context.isOwner) {
      return { success: false, error: "Solo el propietario del negocio puede modificar el QR de cobro." };
    }

    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof File)) {
      return { success: false, error: "Archivo de imagen ausente." };
    }

    const res = await uploadPaymentMethodQr(businessId, methodCode, file);
    if (!res.success) {
      return { success: false, error: res.error };
    }

    revalidatePath(`/workspace/${businessId}/configuracion`);
    return { success: true, url: res.url };
  } catch (err: any) {
    console.error("[uploadPaymentQrAction] Error:", err);
    return { success: false, error: err?.message || "Error al subir imagen de QR." };
  }
}

/**
 * Server Action: Elimina la imagen de QR de una entidad.
 */
export async function removePaymentQrAction(
  businessId: string,
  methodCode: PaymentMethodCode
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "business_settings.update");
    if (!auth.success || !auth.context) {
      return { success: false, error: auth.error || "No autorizado para modificar configuración." };
    }

    if (!auth.context.isOwner) {
      return { success: false, error: "Solo el propietario del negocio puede eliminar el QR de cobro." };
    }

    const res = await deletePaymentMethodQr(businessId, methodCode);
    if (!res.success) {
      return { success: false, error: res.error };
    }

    revalidatePath(`/workspace/${businessId}/configuracion`);
    return { success: true };
  } catch (err: any) {
    console.error("[removePaymentQrAction] Error:", err);
    return { success: false, error: err?.message || "Error al eliminar imagen de QR." };
  }
}
