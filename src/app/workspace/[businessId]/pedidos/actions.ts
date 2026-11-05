"use server";

import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import {
  getRestaurantOrdersList,
  getRestaurantOrdersSummary,
  getRestaurantOrderWithDetails,
  updateRestaurantOrderStatus,
  cancelRestaurantOrder,
} from "@/lib/restaurant/restaurant-service";
import {
  RestaurantOrderFilterParams,
  RestaurantOrdersListResult,
  RestaurantOrdersSummary,
  RestaurantOrderWithDetails,
} from "@/lib/restaurant/types";
import { revalidatePath } from "next/cache";

/**
 * Server Action: Consultar listado filtrado y paginado de pedidos.
 * Valida sesión multi-tenant y permiso `orders.view`.
 */
export async function getRestaurantOrdersListAction(
  businessId: string,
  params: Omit<RestaurantOrderFilterParams, "businessId">
): Promise<{ success: boolean; data?: RestaurantOrdersListResult; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "orders.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ver pedidos en este comercio." };
  }

  try {
    const data = await getRestaurantOrdersList({
      businessId,
      ...params,
    });
    return { success: true, data };
  } catch (err: any) {
    console.error("[getRestaurantOrdersListAction] Error:", err);
    return { success: false, error: err?.message || "Error al obtener la lista de pedidos." };
  }
}

/**
 * Server Action: Consultar el resumen cuantitativo de pedidos por estado.
 */
export async function getRestaurantOrdersSummaryAction(
  businessId: string
): Promise<{ success: boolean; data?: RestaurantOrdersSummary; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "orders.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ver pedidos en este comercio." };
  }

  try {
    const data = await getRestaurantOrdersSummary(businessId);
    return { success: true, data };
  } catch (err: any) {
    console.error("[getRestaurantOrdersSummaryAction] Error:", err);
    return { success: false, error: err?.message || "Error al obtener el resumen de pedidos." };
  }
}

/**
 * Server Action: Transicionar de estado operativo un pedido existente.
 * Valida permiso `orders.update` o permisos de owner.
 */
export async function updateRestaurantOrderStatusAction(
  businessId: string,
  orderId: string,
  newStatus: string
): Promise<{ success: boolean; order?: RestaurantOrderWithDetails; error?: string }> {
  let auth = await verifyWorkspaceAction(businessId, "orders.update");
  if (!auth.success) {
    // Si el usuario es owner o tiene permisos de administración
    auth = await verifyWorkspaceAction(businessId, "orders.manage");
  }

  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para modificar el estado de pedidos." };
  }

  const result = await updateRestaurantOrderStatus(businessId, orderId, newStatus, auth.context.userId);

  if (result.success) {
    revalidatePath(`/workspace/${businessId}/pedidos`);
    revalidatePath(`/workspace/${businessId}/pedidos/${orderId}`);
    revalidatePath(`/workspace/${businessId}/mesas`);
    revalidatePath(`/workspace/${businessId}/pos`);
    revalidatePath(`/workspace/${businessId}/ventas`);
  }

  return result;
}

/**
 * Server Action: Cancelar operativamente un pedido.
 * Requiere permiso explícito `orders.cancel` o rol de owner.
 */
export async function cancelRestaurantOrderAction(
  businessId: string,
  orderId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "orders.cancel");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para cancelar pedidos en este comercio." };
  }

  const result = await cancelRestaurantOrder(businessId, orderId, reason, auth.context.userId);

  if (result.success) {
    revalidatePath(`/workspace/${businessId}/pedidos`);
    revalidatePath(`/workspace/${businessId}/pedidos/${orderId}`);
    revalidatePath(`/workspace/${businessId}/mesas`);
    revalidatePath(`/workspace/${businessId}/pos`);
    revalidatePath(`/workspace/${businessId}/ventas`);
  }

  return result;
}

import type { ProcessOrderPaymentInput } from "@/lib/restaurant/types";

/**
 * Server Action: Registrar el pago de un pedido operativo.
 * Soporta pago único y pagos divididos con descuentos y propinas [POS-002].
 * Requiere permiso `sales.create`, `orders.update` o permisos de owner.
 */
export async function registerRestaurantOrderPaymentAction(
  businessId: string,
  orderId: string,
  paymentData?: string | ProcessOrderPaymentInput
): Promise<{ success: boolean; error?: string; documentId?: string; documentNumber?: string }> {
  let auth = await verifyWorkspaceAction(businessId, "orders.update");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "sales.create");
  }

  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para registrar pagos en este negocio." };
  }

  const { registerRestaurantOrderPayment } = await import("@/lib/restaurant/restaurant-service");
  const result = await registerRestaurantOrderPayment(businessId, orderId, paymentData, auth.context.userId);

  if (result.success) {
    revalidatePath(`/workspace/${businessId}/pedidos`);
    revalidatePath(`/workspace/${businessId}/pedidos/${orderId}`);
    revalidatePath(`/workspace/${businessId}/ventas`);
    revalidatePath(`/workspace/${businessId}/pos`);
    revalidatePath(`/workspace/${businessId}/clientes`);
    revalidatePath(`/workspace/${businessId}/cajas`);
  }

  return {
    success: result.success,
    error: result.error,
    documentId: result.document?.id,
    documentNumber: result.document?.documentNumber || result.document?.document_number,
  };
}

/**
 * Server Action: Obtiene el detalle de un pedido específico por ID.
 */
export async function getRestaurantOrderAction(
  businessId: string,
  orderId: string
) {
  let auth = await verifyWorkspaceAction(businessId, "orders.view");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "sales.view");
  }

  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ver este pedido." };
  }

  const { getRestaurantOrderWithDetails } = await import("@/lib/restaurant/restaurant-service");
  const order = await getRestaurantOrderWithDetails(businessId, orderId);

  if (!order) {
    return { success: false, error: "Pedido no encontrado." };
  }

  return { success: true, order };
}

/**
 * Server Action: Generar y descargar el comprobante en PDF de un pedido.
 */
export async function downloadOrderPdfAction(
  businessId: string,
  orderId: string
): Promise<{
  success: boolean;
  base64?: string;
  filename?: string;
  error?: string;
}> {
  let auth = await verifyWorkspaceAction(businessId, "orders.view");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "sales.view");
  }

  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para descargar este comprobante." };
  }

  try {
    const { getRestaurantOrderWithDetails } = await import("@/lib/restaurant/restaurant-service");
    const { getBusinessDocumentConfig } = await import("@/lib/documents/document-service");
    const { generateBusinessSalePdf } = await import("@/lib/pdf/pdf-engine");

    const order = await getRestaurantOrderWithDetails(businessId, orderId);
    if (!order) {
      return { success: false, error: "Pedido no encontrado." };
    }

    const config = await getBusinessDocumentConfig(businessId).catch(() => ({} as any));

    const pdfResult = generateBusinessSalePdf({
      documentNumber: `ORD-${order.order_number}`,
      documentTitle: "ORDEN DE PEDIDO / COMANDA",
      businessId,
      tradeName: config.tradeName,
      legalName: config.legalName,
      taxId: config.taxId,
      phone: config.phone,
      whatsapp: config.whatsapp,
      email: config.email,
      address: config.address,
      city: config.city,
      customerName: order.customer_name || "Público General",
      customerPhone: order.customer_phone || undefined,
      customerAddress: order.delivery_address || undefined,
      issuedAt: order.created_at,
      items: (order.items || []).map((it) => ({
        description: it.product_name,
        quantity: it.quantity,
        unitPrice: it.unit_price,
        total: it.subtotal,
      })),
      subtotal: order.subtotal,
      total: order.total,
      currency: "COP",
      notes: order.notes || undefined,
      thankYouNote: config.thankYouNote,
      footerText: config.footerText,
    });

    return {
      success: true,
      base64: pdfResult.base64,
      filename: pdfResult.filename,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al generar PDF del pedido." };
  }
}

/**
 * Server Action: Confirmar la recogida física de un pedido "Para recoger" mediante código de 4 dígitos [POS-RECOGIDA]
 */
export async function verifyAndConfirmPickupAction(
  businessId: string,
  orderId: string,
  code: string
): Promise<{ success: boolean; error?: string; remainingAttempts?: number; isConfirmed?: boolean }> {
  let auth = await verifyWorkspaceAction(businessId, "orders.update");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "orders.manage");
  }

  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para confirmar la entrega de pedidos." };
  }

  try {
    const { verifyAndConfirmPickup } = await import("@/lib/orders/pickup-verification-service");
    const result = await verifyAndConfirmPickup(
      businessId,
      orderId,
      code,
      auth.context.userId,
      auth.context.userEmail?.split("@")[0] || "Personal"
    );

    if (result.success) {
      revalidatePath(`/workspace/${businessId}/pedidos`);
      revalidatePath(`/workspace/${businessId}/pos`);
    }

    return result;
  } catch (err: any) {
    console.error("[verifyAndConfirmPickupAction] Error:", err);
    return { success: false, error: err?.message || "Error al validar el código de recogida." };
  }
}

/**
 * Server Action: Consultar código de recogida para personal autorizado [POS-RECOGIDA]
 */
export async function getPickupCodeAction(
  businessId: string,
  orderId: string
): Promise<{ success: boolean; code?: string | null; attempts?: number; isLocked?: boolean; isConfirmed?: boolean; error?: string }> {
  let auth = await verifyWorkspaceAction(businessId, "orders.view");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "orders.manage");
  }

  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para consultar este pedido." };
  }

  try {
    const { getRestaurantOrderWithDetails } = await import("@/lib/restaurant/restaurant-service");
    const { extractPickupVerificationDetails } = await import("@/lib/orders/pickup-verification-service");

    const order = await getRestaurantOrderWithDetails(businessId, orderId);
    if (!order) {
      return { success: false, error: "Pedido no encontrado." };
    }

    const details = extractPickupVerificationDetails(order);
    return {
      success: true,
      code: details.code,
      attempts: details.attempts,
      isLocked: details.isLocked,
      isConfirmed: details.isConfirmed,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar código de recogida." };
  }
}



