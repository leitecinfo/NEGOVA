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


/**
 * Server Action: Actualiza información de un repartidor operativo (o regenera su PIN) [DOM-006]
 */
export async function updateOperationalDriverAction(
  businessId: string,
  driverId: string,
  updates: {
    name?: string;
    phone?: string | null;
    regeneratePin?: boolean;
    pin?: string;
  }
): Promise<{ success: boolean; driver?: OperationalDeliveryDriver; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "orders.manage");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para gestionar repartidores." };
  }

  const { updateOperationalDeliveryDriver } = await import("@/lib/delivery/delivery-service");
  const result = await updateOperationalDeliveryDriver(businessId, driverId, updates, auth.context.userId);

  if (result.success) {
    revalidatePath(`/workspace/${businessId}/domicilios`);
    revalidatePath(`/workspace/${businessId}/pedidos/domicilios`);
  }

  return result;
}

/**
 * Server Action: Obtiene la sesión de caja activa para realizar liquidaciones de domiciliarios [DOM-006]
 */
export async function getActiveCashSessionForLiquidationAction(businessId: string): Promise<{
  success: boolean;
  session?: { id: string; registerId: string; registerName?: string; openedAt: string } | null;
  error?: string;
}> {
  const auth = await verifyWorkspaceAction(businessId, "orders.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización." };
  }

  try {
    const { getActiveCashSession } = await import("@/lib/cash/cash-service");
    const active = await getActiveCashSession(businessId);
    if (!active) {
      return { success: true, session: null };
    }

    return {
      success: true,
      session: {
        id: active.id,
        registerId: active.registerId,
        openedAt: active.openedAt,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al verificar caja activa." };
  }
}

/**
 * Server Action: Liquida el dinero en efectivo recaudado por un domiciliario ingresándolo a la caja activa [DOM-006]
 */
export async function liquidateDriverCashAction(
  businessId: string,
  input: {
    driverId: string;
    driverName: string;
    amount: number;
    sessionId: string;
    notes?: string | null;
    orderIds?: string[];
  }
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "orders.manage");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para liquidar recaudos." };
  }

  const { liquidateDriverCash } = await import("@/lib/delivery/delivery-service");
  const result = await liquidateDriverCash(businessId, input, auth.context.userId);

  if (result.success) {
    revalidatePath(`/workspace/${businessId}/domicilios`);
    revalidatePath(`/workspace/${businessId}/pedidos/domicilios`);
    revalidatePath(`/workspace/${businessId}/cajas`);
  }

  return result;
}

/**
 * Server Action: Reporta una novedad o incidencia en una orden de delivery [DOM-006]
 */
export async function reportDeliveryIssueAction(
  businessId: string,
  orderId: string,
  issueType: any,
  notes: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "orders.update");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para actualizar pedidos." };
  }

  const { reportDeliveryIssue } = await import("@/lib/delivery/delivery-service");
  const result = await reportDeliveryIssue(
    businessId,
    orderId,
    issueType,
    notes,
    "Operador",
    auth.context.userId
  );

  if (result.success) {
    revalidatePath(`/workspace/${businessId}/domicilios`);
    revalidatePath(`/workspace/${businessId}/pedidos/domicilios`);
  }

  return result;
}


// ==========================================
// Zonas de Cobertura y Tarifas [DOM-001, DOM-006]
// ==========================================

import type {
  DeliveryZone,
  CreateDeliveryZoneInput,
  UpdateDeliveryZoneInput,
  DeliveryBusinessConfig,
} from "@/lib/delivery/types";

/**
 * Server Action: Consulta las zonas de cobertura del negocio
 */
export async function getDeliveryZonesAction(
  businessId: string
): Promise<{ success: boolean; data?: DeliveryZone[]; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "orders.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización." };
  }

  try {
    const { getDeliveryZones } = await import("@/lib/delivery/delivery-service");
    const data = await getDeliveryZones(businessId);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al obtener zonas." };
  }
}

/**
 * Server Action: Crea una nueva zona de cobertura
 */
export async function createDeliveryZoneAction(
  businessId: string,
  input: CreateDeliveryZoneInput
): Promise<{ success: boolean; data?: DeliveryZone; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "orders.manage");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización." };
  }

  try {
    const { createDeliveryZone } = await import("@/lib/delivery/delivery-service");
    const res = await createDeliveryZone(businessId, input);
    revalidatePath(`/workspace/${businessId}/domicilios`);
    revalidatePath(`/workspace/${businessId}/pedidos/domicilios`);
    return { success: res.success, data: res.zone, error: res.error };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al crear zona." };
  }
}

/**
 * Server Action: Actualiza una zona de cobertura existente
 */
export async function updateDeliveryZoneAction(
  businessId: string,
  input: UpdateDeliveryZoneInput
): Promise<{ success: boolean; data?: DeliveryZone; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "orders.manage");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización." };
  }

  try {
    const { updateDeliveryZone } = await import("@/lib/delivery/delivery-service");
    const res = await updateDeliveryZone(businessId, input);
    revalidatePath(`/workspace/${businessId}/domicilios`);
    revalidatePath(`/workspace/${businessId}/pedidos/domicilios`);
    return { success: res.success, data: res.zone, error: res.error };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al actualizar zona." };
  }
}

/**
 * Server Action: Elimina una zona de cobertura
 */
export async function deleteDeliveryZoneAction(
  businessId: string,
  zoneId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "orders.manage");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización." };
  }

  try {
    const { deleteDeliveryZone } = await import("@/lib/delivery/delivery-service");
    const res = await deleteDeliveryZone(businessId, zoneId);
    revalidatePath(`/workspace/${businessId}/domicilios`);
    revalidatePath(`/workspace/${businessId}/pedidos/domicilios`);
    return res;
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al eliminar zona." };
  }
}

// ==========================================
// Configuración de Tarifas y Reglas [DOM-006]
// ==========================================

/**
 * Server Action: Consulta la configuración global de delivery del comercio
 */
export async function getDeliveryConfigAction(
  businessId: string
): Promise<{ success: boolean; config?: DeliveryBusinessConfig; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "orders.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización." };
  }

  try {
    const { getDeliveryBusinessConfig } = await import("@/lib/delivery/delivery-service");
    const config = await getDeliveryBusinessConfig(businessId);
    return { success: true, config };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al obtener configuración de delivery." };
  }
}

/**
 * Server Action: Actualiza la configuración global de delivery del comercio
 */
export async function updateDeliveryConfigAction(
  businessId: string,
  updates: Partial<DeliveryBusinessConfig>
): Promise<{ success: boolean; config?: DeliveryBusinessConfig; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "orders.manage");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización." };
  }

  try {
    const { updateDeliveryBusinessConfig } = await import("@/lib/delivery/delivery-service");
    const res = await updateDeliveryBusinessConfig(businessId, updates, auth.context.userId);
    if (res.success) {
      revalidatePath(`/workspace/${businessId}/domicilios`);
      revalidatePath(`/workspace/${businessId}/pedidos/domicilios`);
    }
    return res;
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al actualizar configuración de delivery." };
  }
}

// ==========================================
// Integraciones Externas (Rappi / Justo)
// ==========================================

/**
 * Server Action: Consulta integraciones externas
 */
export async function getDeliveryIntegrationsAction(businessId: string): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  const auth = await verifyWorkspaceAction(businessId, "orders.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización." };
  }

  return {
    success: true,
    data: {
      rappi: { enabled: false, storeId: "", webhookConfigured: false },
      justo: { enabled: false, apiKey: "", webhookConfigured: false },
    },
  };
}

/**
 * Server Action: Guarda credenciales de integración
 */
export async function saveDeliveryIntegrationCredentialsAction(
  businessId: string,
  provider: string,
  credentials: any,
  enabled?: boolean,
  autoAccept?: boolean
): Promise<{ success: boolean; config?: any; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "orders.manage");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización." };
  }

  return {
    success: true,
    config: {
      provider,
      ...credentials,
      enabled: Boolean(enabled),
      autoAccept: Boolean(autoAccept),
    },
  };
}

/**
 * Server Action: Simula webhook entrante
 */
export async function simulateDeliveryWebhookAction(
  businessId: string,
  provider: string
): Promise<{ success: boolean; orderId?: string; orderNumber?: number; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "orders.manage");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización." };
  }

  return { success: true, orderNumber: 999 };
}
