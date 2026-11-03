"use server";

import { getPublicOrderTracking, PublicOrderTrackingDTO } from "@/lib/delivery/tracking-service";

/**
 * Server Action pública para consultar el estado actualizado de un pedido a domicilio.
 * - Sin autenticación requerida.
 * - Acceso indexado y validado mediante trackingCode (TRK-XXXXXX).
 * - Cero exposición de datos sensibles.
 */
export async function getOrderTrackingAction(
  trackingCode: string
): Promise<{
  success: boolean;
  tracking?: PublicOrderTrackingDTO | null;
  error?: string;
}> {
  try {
    const data = await getPublicOrderTracking(trackingCode);
    if (!data) {
      return {
        success: false,
        tracking: null,
        error: "Código de seguimiento no encontrado.",
      };
    }

    return {
      success: true,
      tracking: data,
    };
  } catch (err: any) {
    return {
      success: false,
      tracking: null,
      error: err?.message || "Error al consultar el seguimiento.",
    };
  }
}
