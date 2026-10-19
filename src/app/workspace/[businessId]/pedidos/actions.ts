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

/**
 * Server Action: Registrar el pago de un pedido operativo.
 * Requiere permiso `sales.create`, `orders.update` o permisos de owner.
 */
export async function registerRestaurantOrderPaymentAction(
  businessId: string,
  orderId: string,
  paymentMethod?: string
): Promise<{ success: boolean; error?: string }> {
  let auth = await verifyWorkspaceAction(businessId, "orders.update");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "sales.create");
  }

  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para registrar pagos en este negocio." };
  }

  const { registerRestaurantOrderPayment } = await import("@/lib/restaurant/restaurant-service");
  const result = await registerRestaurantOrderPayment(businessId, orderId, paymentMethod, auth.context.userId);

  if (result.success) {
    revalidatePath(`/workspace/${businessId}/pedidos`);
    revalidatePath(`/workspace/${businessId}/pedidos/${orderId}`);
    revalidatePath(`/workspace/${businessId}/ventas`);
    revalidatePath(`/workspace/${businessId}/pos`);
  }

  return { success: result.success, error: result.error };
}

