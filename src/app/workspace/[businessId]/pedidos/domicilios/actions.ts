"use server";

import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import {
  getBusinessDeliveryOrders,
  assignDriverToOrder,
  dispatchDeliveryOrder,
  confirmDeliveryWithException,
  getOperationalDeliveryDrivers,
  createOperationalDeliveryDriver,
  toggleOperationalDeliveryDriverStatus,
  OperationalDeliveryDriver,
} from "@/lib/delivery/delivery-service";
import { RestaurantOrderWithDetails } from "@/lib/restaurant/types";
import { revalidatePath } from "next/cache";

/**
 * Server Action: Obtiene las entregas a domicilio del negocio
 */
export async function getBusinessDeliveryOrdersAction(
  businessId: string,
  options?: {
    driverName?: string;
    deliveryStatus?: string;
    onlyActive?: boolean;
  }
): Promise<{ success: boolean; data?: RestaurantOrderWithDetails[]; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "orders.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ver pedidos." };
  }

  try {
    const data = await getBusinessDeliveryOrders(businessId, options);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al obtener pedidos a domicilio." };
  }
}

/**
 * Server Action: Asigna un domiciliario a una comanda
 */
export async function assignDriverToOrderAction(
  businessId: string,
  orderId: string,
  driverName: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "orders.update");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para actualizar pedidos." };
  }

  const result = await assignDriverToOrder(businessId, orderId, driverName, auth.context.userId);
  if (result.success) {
    revalidatePath(`/workspace/${businessId}/pedidos`);
    revalidatePath(`/workspace/${businessId}/pedidos/domicilios`);
    revalidatePath(`/workspace/${businessId}/pedidos/${orderId}`);
  }
  return result;
}

/**
 * Server Action: Marca la orden como despachada / en camino
 */
export async function dispatchDeliveryOrderAction(
  businessId: string,
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "orders.update");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para actualizar pedidos." };
  }

  const result = await dispatchDeliveryOrder(businessId, orderId, auth.context.userId);
  if (result.success) {
    revalidatePath(`/workspace/${businessId}/pedidos`);
    revalidatePath(`/workspace/${businessId}/pedidos/domicilios`);
    revalidatePath(`/workspace/${businessId}/pedidos/${orderId}`);
  }
  return result;
}

/**
 * Server Action: Confirmar entrega mediante procedimiento de excepción
 */
export async function confirmDeliveryWithExceptionAction(
  businessId: string,
  orderId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "orders.update");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para actualizar pedidos." };
  }

  const result = await confirmDeliveryWithException(businessId, orderId, reason, auth.context.userId);
  if (result.success) {
    revalidatePath(`/workspace/${businessId}/pedidos`);
    revalidatePath(`/workspace/${businessId}/pedidos/domicilios`);
    revalidatePath(`/workspace/${businessId}/pedidos/${orderId}`);
  }
  return result;
}

/**
 * Server Action: Consulta los repartidores operativos (no consumen cupo facturable)
 */
export async function getOperationalDriversAction(
  businessId: string
): Promise<{ success: boolean; drivers?: OperationalDeliveryDriver[]; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "orders.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ver repartidores." };
  }

  try {
    const drivers = await getOperationalDeliveryDrivers(businessId);
    return { success: true, drivers };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar repartidores." };
  }
}

/**
 * Server Action: Crear nuevo repartidor operativo con PIN
 */
export async function createOperationalDriverAction(
  businessId: string,
  name: string,
  phone?: string | null
): Promise<{ success: boolean; driver?: OperationalDeliveryDriver; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "orders.manage");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para gestionar repartidores." };
  }

  const result = await createOperationalDeliveryDriver(businessId, name, phone, auth.context.userId);
  if (result.success) {
    revalidatePath(`/workspace/${businessId}/pedidos/domicilios`);
  }
  return result;
}

/**
 * Server Action: Habilitar o revocar acceso de un repartidor operativo
 */
export async function toggleDriverStatusAction(
  businessId: string,
  driverId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "orders.manage");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para gestionar repartidores." };
  }

  const result = await toggleOperationalDeliveryDriverStatus(businessId, driverId, isActive, auth.context.userId);
  if (result.success) {
    revalidatePath(`/workspace/${businessId}/pedidos/domicilios`);
  }
  return result;
}
