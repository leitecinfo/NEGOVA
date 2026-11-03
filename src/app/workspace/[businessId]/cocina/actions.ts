"use server";

import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import {
  getKdsOrders,
  updateRestaurantOrderStatus,
  getKdsAlertConfig,
  saveKdsAlertConfig,
  getKdsOpenTickets,
} from "@/lib/restaurant/restaurant-service";
import {
  RestaurantOrderWithDetails,
  KdsTimeAlertConfig,
  KdsOpenTicketsResponse,
} from "@/lib/restaurant/types";
import { revalidatePath } from "next/cache";

/**
 * Server Action: Consultar órdenes activas para el Monitor de Cocina (KDS).
 * Requiere permiso multi-tenant `orders.view`.
 */
export async function getKdsOrdersAction(
  businessId: string
): Promise<{ success: boolean; data?: RestaurantOrderWithDetails[]; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "orders.view");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para ver el monitor de cocina.",
    };
  }

  try {
    const data = await getKdsOrders(businessId);
    return { success: true, data };
  } catch (err: any) {
    console.error("[getKdsOrdersAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al obtener las comandas de cocina.",
    };
  }
}

/**
 * Server Action: Cambiar estado operativo de una orden en cocina (KDS).
 * Flujo: received -> in_preparation -> ready -> delivered.
 * Requiere permiso multi-tenant `orders.update`.
 */
export async function updateKdsOrderStatusAction(
  businessId: string,
  orderId: string,
  newStatus: string
): Promise<{
  success: boolean;
  order?: RestaurantOrderWithDetails;
  error?: string;
}> {
  const auth = await verifyWorkspaceAction(businessId, "orders.update");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para actualizar el estado del pedido.",
    };
  }

  const result = await updateRestaurantOrderStatus(
    businessId,
    orderId,
    newStatus,
    auth.context.userId
  );

  if (result.success) {
    revalidatePath(`/workspace/${businessId}/cocina`);
    revalidatePath(`/workspace/${businessId}/pedidos`);
    revalidatePath(`/workspace/${businessId}/pedidos/${orderId}`);
    revalidatePath(`/workspace/${businessId}/mesas`);
  }

  return result;
}

/**
 * Server Action: Consultar configuración de umbrales KDS [KDS-002].
 * Requiere permiso multi-tenant `orders.view`.
 */
export async function getKdsAlertConfigAction(
  businessId: string
): Promise<{ success: boolean; config?: KdsTimeAlertConfig; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "orders.view");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para ver la configuración de cocina.",
    };
  }

  try {
    const config = await getKdsAlertConfig(businessId);
    return { success: true, config };
  } catch (err: any) {
    console.error("[getKdsAlertConfigAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al obtener la configuración de alertas de cocina.",
    };
  }
}

/**
 * Server Action: Actualizar configuración de umbrales KDS [KDS-002].
 * Requiere permiso multi-tenant `orders.update`.
 */
export async function saveKdsAlertConfigAction(
  businessId: string,
  config: KdsTimeAlertConfig
): Promise<{ success: boolean; config?: KdsTimeAlertConfig; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "orders.update");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para modificar los umbrales de cocina.",
    };
  }

  const result = await saveKdsAlertConfig(businessId, config);

  if (result.success) {
    revalidatePath(`/workspace/${businessId}/cocina`);
    revalidatePath(`/workspace/${businessId}/pedidos`);
  }

  return result;
}

/**
 * Server Action: Consultar tickets abiertos (no cobrados) para la vista KDS [KDS-003].
 * Requiere permiso multi-tenant `orders.view`.
 */
export async function getKdsOpenTicketsAction(
  businessId: string
): Promise<{ success: boolean; data?: KdsOpenTicketsResponse; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "orders.view");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para consultar tickets abiertos.",
    };
  }

  try {
    const data = await getKdsOpenTickets(businessId);
    return { success: true, data };
  } catch (err: any) {
    console.error("[getKdsOpenTicketsAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al obtener la lista de tickets abiertos.",
    };
  }
}


