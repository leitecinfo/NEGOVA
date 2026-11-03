"use server";

import {
  authenticateDriverPin,
  getBusinessDeliveryOrders,
  verifyAndConfirmDelivery,
  assignDriverToOrder,
  dispatchDeliveryOrder,
} from "@/lib/delivery/delivery-service";

/**
 * Autentica al domiciliario mediante su PIN operativo de 6 dígitos.
 * No consume licencias de usuario ni genera cuentas convencionales.
 */
export async function loginDriverAction(businessId: string, pin: string) {
  try {
    const res = await authenticateDriverPin(businessId, pin);
    if (!res.success || !res.driver) {
      return { success: false, error: res.error || "PIN incorrecto" };
    }

    return {
      success: true,
      driver: {
        id: res.driver.id,
        name: res.driver.name,
        phone: res.driver.phone || null,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al autenticar domiciliario." };
  }
}

/**
 * Obtiene los pedidos asignados o listos para el domiciliario,
 * validando siempre el PIN en el servidor en cada invocación.
 */
export async function getDriverOrdersAction(
  businessId: string,
  pin: string,
  filterMode: "my_orders" | "available" | "all" = "my_orders"
) {
  try {
    const auth = await authenticateDriverPin(businessId, pin);
    if (!auth.success || !auth.driver) {
      return { success: false, error: "Sesión de reparto inválida o PIN revocado.", orders: [] };
    }

    const driver = auth.driver;
    const allDeliveryOrders = await getBusinessDeliveryOrders(businessId, { onlyActive: true });

    // Filtrar según el modo solicitado:
    let filtered = allDeliveryOrders;

    if (filterMode === "my_orders") {
      // Pedidos asignados específicamente a este domiciliario
      filtered = allDeliveryOrders.filter((o) => o.driver_name === driver.name);
    } else if (filterMode === "available") {
      // Pedidos listos o recibidos sin domiciliario asignado
      filtered = allDeliveryOrders.filter((o) => !o.driver_name && o.delivery_status !== "delivered");
    } else {
      // Ver pedidos asignados al domiciliario o sin asignar
      filtered = allDeliveryOrders.filter(
        (o) => o.driver_name === driver.name || (!o.driver_name && o.delivery_status !== "delivered")
      );
    }

    // Por seguridad, censurar el código de entrega esperado para que el domiciliario
    // deba pedírselo al cliente físicamente en la puerta y no pueda leerlo en la interfaz
    const sanitizedOrders = filtered.map((o) => ({
      ...o,
      delivery_verification_code: undefined, // Ocultar código esperado
      hasVerificationCode: Boolean(o.delivery_verification_code),
    }));

    return {
      success: true,
      driver: { id: driver.id, name: driver.name },
      orders: sanitizedOrders,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al cargar pedidos.", orders: [] };
  }
}

/**
 * Toma / autoasigna un pedido disponible al domiciliario y lo pone en camino
 */
export async function takeDeliveryOrderAction(businessId: string, pin: string, orderId: string) {
  try {
    const auth = await authenticateDriverPin(businessId, pin);
    if (!auth.success || !auth.driver) {
      return { success: false, error: "No autorizado." };
    }

    // 1. Asignar al conductor
    const assignRes = await assignDriverToOrder(businessId, orderId, auth.driver.name);
    if (!assignRes.success) {
      return { success: false, error: assignRes.error };
    }

    // 2. Despachar a camino
    const dispatchRes = await dispatchDeliveryOrder(businessId, orderId);
    if (!dispatchRes.success) {
      return { success: false, error: dispatchRes.error };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al tomar el pedido." };
  }
}

/**
 * Valida el código de 4 dígitos proporcionado por el cliente al recibir la comida
 */
export async function verifyAndCompleteDeliveryAction(
  businessId: string,
  pin: string,
  orderId: string,
  enteredCode: string
): Promise<{ success: boolean; error?: string; remainingAttempts?: number }> {
  try {
    const auth = await authenticateDriverPin(businessId, pin);
    if (!auth.success || !auth.driver) {
      return { success: false, error: "Sesión expirada o no autorizada." };
    }

    const res = await verifyAndConfirmDelivery(
      businessId,
      orderId,
      enteredCode,
      auth.driver.name
    );

    return res;
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al verificar la entrega." };
  }
}

/**
 * Server Action pública: Consulta pedidos asignados mediante token criptográfico seguro
 * No expone datos de pedidos ajenos ni teléfonos en logs
 */
export async function getDriverOrdersByTokenAction(token: string) {
  try {
    const { getDriverOrdersBySessionToken } = await import("@/lib/delivery/delivery-service");
    return await getDriverOrdersBySessionToken(token);
  } catch (err: any) {
    return {
      success: false,
      error: "No se pudieron obtener las órdenes asignadas.",
      pendingOrders: [],
      completedOrders: [],
    };
  }
}

/**
 * Server Action pública: Confirma entrega de pedido mediante token criptográfico seguro
 * Mantiene la separación estricta entre entrega física y estado de pago
 */
export async function confirmDeliveryByTokenAction(
  token: string,
  orderId: string,
  enteredCode?: string
): Promise<{ success: boolean; error?: string; remainingAttempts?: number }> {
  try {
    const { confirmDeliveryOrderBySessionToken } = await import("@/lib/delivery/delivery-service");
    return await confirmDeliveryOrderBySessionToken(token, orderId, enteredCode);
  } catch (err: any) {
    return {
      success: false,
      error: "Error al registrar la entrega.",
    };
  }
}



/**
 * Server Action: Permite al domiciliario autorizar una entrega con motivo justificado
 * si el cliente perdió su código o no tiene batería [DOM-006]
 */
export async function confirmDeliveryWithExceptionByDriverAction(
  businessId: string,
  pin: string,
  orderId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateDriverPin(businessId, pin);
    if (!auth.success || !auth.driver) {
      return { success: false, error: "PIN inválido o no autorizado." };
    }

    if (!reason || reason.trim().length < 4) {
      return { success: false, error: "Debes ingresar un motivo válido (mínimo 4 caracteres)." };
    }

    const { confirmDeliveryWithException } = await import("@/lib/delivery/delivery-service");
    const result = await confirmDeliveryWithException(
      businessId,
      orderId,
      `Excepción reportada en app de reparto por domiciliario ${auth.driver.name}: ${reason.trim()}`
    );

    return result;
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al procesar la excepción de entrega." };
  }
}

/**
 * Server Action: Reporta una novedad o incidencia directamente desde el portal móvil del repartidor [DOM-006]
 */
export async function reportDeliveryIssueByDriverAction(
  businessId: string,
  pin: string,
  orderId: string,
  issueType: any,
  notes: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateDriverPin(businessId, pin);
    if (!auth.success || !auth.driver) {
      return { success: false, error: "PIN inválido o no autorizado." };
    }

    if (!notes || notes.trim().length < 3) {
      return { success: false, error: "Por favor describe el detalle de la novedad." };
    }

    const { reportDeliveryIssue } = await import("@/lib/delivery/delivery-service");
    const result = await reportDeliveryIssue(
      businessId,
      orderId,
      issueType,
      notes.trim(),
      auth.driver.name
    );

    return result;
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al reportar la novedad." };
  }
}
