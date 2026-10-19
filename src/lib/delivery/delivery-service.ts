/**
 * SERVICIO DE GESTIÓN DE DOMICILIOS, REPARTIDORES OPERATIVOS Y VERIFICACIÓN
 * 
 * Reglas de Arquitectura:
 * 1. Aislamiento Multi-Tenant Estricto: Todas las operaciones validan explícitamente el `businessId`.
 * 2. Facturación por usuario protegida: Los repartidores operativos se gestionan como identidades
 *    de despacho en la configuración del comercio (JSONB), SIN crear usuarios convencionales
 *    en `business_users`. No consumen cupos del plan ni alteran el modelo de suscripción.
 * 3. Código de entrega seguro: Cada domicilio genera un código aleatorio de 4 dígitos asociado
 *    únicamente a esa orden, con límite de 5 intentos fallidos contra ataques de fuerza bruta.
 * 4. Separación de Entrega y Pago: Confirmar una entrega NO altera automáticamente el estado de pago.
 */

import { getDbClient } from "@/lib/restaurant/restaurant-service";
import { logAuditAction } from "@/lib/audit/audit-service";
import { RestaurantOrderWithDetails } from "@/lib/restaurant/types";

export interface OperationalDeliveryDriver {
  id: string;
  name: string;
  phone?: string | null;
  accessPin: string; // PIN numérico de 6 dígitos
  isActive: boolean;
  createdAt: string;
  lastAccessAt?: string | null;
}

export interface DeliveryVerificationInfo {
  code: string | null;
  attempts: number;
  cleanNotes: string | null;
  isLocked: boolean;
}

/**
 * 1. Extrae el código de verificación y contador de intentos desde las notas del pedido
 * Formato del tag: [PIN:1234:0] -> código "1234", 0 intentos
 */
export function extractDeliveryVerification(notes?: string | null): DeliveryVerificationInfo {
  if (!notes) {
    return { code: null, attempts: 0, cleanNotes: null, isLocked: false };
  }

  const pinMatch = notes.match(/\[PIN:([0-9A-Z]{4,6})(?::(\d+))?\]/i);
  if (!pinMatch) {
    return { code: null, attempts: 0, cleanNotes: notes, isLocked: false };
  }

  const code = pinMatch[1];
  const attempts = pinMatch[2] ? parseInt(pinMatch[2], 10) : 0;
  const isLocked = attempts >= 5;
  const cleanNotes = notes.replace(/\[PIN:[0-9A-Z]{4,6}(?::\d+)?\]/gi, "").trim() || null;

  return { code, attempts, cleanNotes, isLocked };
}

/**
 * 2. Codifica el código de verificación y los intentos en el texto de notas
 */
export function encodeDeliveryVerification(
  baseNotes: string | null | undefined,
  code: string,
  attempts: number = 0
): string {
  const clean = baseNotes ? baseNotes.replace(/\[PIN:[0-9A-Z]{4,6}(?::\d+)?\]/gi, "").trim() : "";
  const tag = `[PIN:${code}:${attempts}]`;
  return clean ? `${clean} ${tag}` : tag;
}

/**
 * 3. Consulta la lista de repartidores operativos configurados en el negocio
 */
export async function getOperationalDeliveryDrivers(
  businessId: string
): Promise<OperationalDeliveryDriver[]> {
  const supabase = await getDbClient();
  const { data: biz, error } = await supabase
    .from("businesses")
    .select("settings")
    .eq("id", businessId)
    .maybeSingle();

  if (error || !biz) {
    console.warn("[getOperationalDeliveryDrivers] Error al consultar settings:", error);
    return [];
  }

  const drivers: OperationalDeliveryDriver[] = (biz.settings as any)?.delivery_drivers || [];
  return drivers;
}

/**
 * 4. Crea un nuevo repartidor operativo con PIN de 6 dígitos (sin consumir licencias)
 */
export async function createOperationalDeliveryDriver(
  businessId: string,
  name: string,
  phone?: string | null,
  actorId?: string
): Promise<{ success: boolean; driver?: OperationalDeliveryDriver; error?: string }> {
  if (!name.trim()) {
    return { success: false, error: "El nombre del domiciliario es obligatorio." };
  }

  const supabase = await getDbClient();
  const { data: biz, error } = await supabase
    .from("businesses")
    .select("settings")
    .eq("id", businessId)
    .single();

  if (error || !biz) {
    return { success: false, error: "Negocio no encontrado." };
  }

  const existingDrivers: OperationalDeliveryDriver[] = (biz.settings as any)?.delivery_drivers || [];

  // Generar PIN aleatorio de 6 dígitos que no colisione
  let pin = "";
  let isUnique = false;
  for (let i = 0; i < 10; i++) {
    pin = String(Math.floor(100000 + Math.random() * 900000));
    if (!existingDrivers.some((d) => d.accessPin === pin)) {
      isUnique = true;
      break;
    }
  }

  if (!isUnique) {
    pin = String(Date.now()).slice(-6);
  }

  const newDriver: OperationalDeliveryDriver = {
    id: crypto.randomUUID(),
    name: name.trim(),
    phone: phone?.trim() || null,
    accessPin: pin,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  const updatedDrivers = [...existingDrivers, newDriver];
  const updatedSettings = {
    ...(biz.settings || {}),
    delivery_drivers: updatedDrivers,
  };

  const { error: saveErr } = await supabase
    .from("businesses")
    .update({
      settings: updatedSettings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", businessId);

  if (saveErr) {
    return { success: false, error: "No se pudo registrar el domiciliario en la configuración." };
  }

  await logAuditAction({
    businessId,
    userId: actorId,
    action: "create",
    entityType: "delivery_driver",
    entityId: newDriver.id,
    description: `Creado acceso operativo para domiciliario: ${newDriver.name}`,
    metadata: { driverName: newDriver.name, driverId: newDriver.id },
  });

  return { success: true, driver: newDriver };
}

/**
 * 5. Cambia el estado de activación o revoca un domiciliario operativo
 */
export async function toggleOperationalDeliveryDriverStatus(
  businessId: string,
  driverId: string,
  isActive: boolean,
  actorId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getDbClient();
  const { data: biz, error } = await supabase
    .from("businesses")
    .select("settings")
    .eq("id", businessId)
    .single();

  if (error || !biz) {
    return { success: false, error: "Negocio no encontrado." };
  }

  const existingDrivers: OperationalDeliveryDriver[] = (biz.settings as any)?.delivery_drivers || [];
  const driverIndex = existingDrivers.findIndex((d) => d.id === driverId);

  if (driverIndex === -1) {
    return { success: false, error: "Domiciliario no encontrado en este negocio." };
  }

  existingDrivers[driverIndex].isActive = isActive;
  const updatedSettings = {
    ...(biz.settings || {}),
    delivery_drivers: existingDrivers,
  };

  const { error: saveErr } = await supabase
    .from("businesses")
    .update({
      settings: updatedSettings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", businessId);

  if (saveErr) {
    return { success: false, error: "No se pudo actualizar el estado del domiciliario." };
  }

  await logAuditAction({
    businessId,
    userId: actorId,
    action: isActive ? "activate" : "deactivate",
    entityType: "delivery_driver",
    entityId: driverId,
    description: `${isActive ? "Habilitado" : "Revocado"} acceso de domiciliario: ${existingDrivers[driverIndex].name}`,
    metadata: { driverId, isActive },
  });

  return { success: true };
}

/**
 * 6. Autentica a un domiciliario por PIN sin crear sesión de usuario de plataforma
 */
export async function authenticateDriverPin(
  businessId: string,
  pin: string
): Promise<{ success: boolean; driver?: OperationalDeliveryDriver; error?: string }> {
  const cleanPin = pin.trim();
  if (!cleanPin) {
    return { success: false, error: "Ingresa tu PIN de acceso operativo." };
  }

  const drivers = await getOperationalDeliveryDrivers(businessId);
  const matched = drivers.find((d) => d.accessPin === cleanPin);

  if (!matched) {
    return { success: false, error: "PIN incorrecto o no registrado para este comercio." };
  }

  if (!matched.isActive) {
    return { success: false, error: "Tu acceso de domiciliario se encuentra inactivo o revocado por el negocio." };
  }

  return { success: true, driver: matched };
}

/**
 * 7. Consulta los pedidos de domicilio con soporte para vista operativa y vista de repartidor
 */
export async function getBusinessDeliveryOrders(
  businessId: string,
  options?: {
    driverName?: string;
    deliveryStatus?: string;
    onlyActive?: boolean;
  }
): Promise<RestaurantOrderWithDetails[]> {
  const supabase = await getDbClient();

  let query = supabase
    .from("restaurant_orders")
    .select(`
      *,
      restaurant_order_items (
        id,
        order_id,
        product_id,
        product_name,
        quantity,
        unit_price,
        subtotal,
        notes,
        modifiers
      )
    `)
    .eq("business_id", businessId)
    .eq("order_type", "delivery")
    .order("created_at", { ascending: false });

  if (options?.deliveryStatus && options.deliveryStatus !== "all") {
    query = query.eq("delivery_status", options.deliveryStatus);
  }

  if (options?.driverName) {
    query = query.eq("driver_name", options.driverName);
  }

  if (options?.onlyActive) {
    query = query.neq("status", "cancelled");
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error("[getBusinessDeliveryOrders] Error al consultar pedidos de entrega:", error);
    return [];
  }

  return data.map((order: any) => {
    const verification = extractDeliveryVerification(order.notes);
    const items = (order.restaurant_order_items || []).map((it: any) => ({
      id: it.id,
      order_id: it.order_id,
      business_id: order.business_id,
      product_id: it.product_id,
      product_name: it.product_name,
      quantity: it.quantity,
      unit_price: Number(it.unit_price),
      subtotal: Number(it.subtotal),
      notes: it.notes,
      modifiers: it.modifiers,
      created_at: it.created_at || order.created_at,
      updated_at: it.updated_at || order.updated_at,
    }));

    return {
      id: order.id,
      business_id: order.business_id,
      order_number: order.order_number,
      status: order.status,
      order_type: order.order_type,
      channel_origin: order.channel_origin,
      subtotal: Number(order.subtotal || 0),
      delivery_fee: Number(order.delivery_fee || 0),
      total: Number(order.total || 0),
      notes: verification.cleanNotes,
      table_id: order.table_id || null,
      customer_name: order.customer_name || null,
      customer_phone: order.customer_phone || null,
      delivery_address: order.delivery_address || null,
      delivery_reference: order.delivery_reference || null,
      delivery_status: order.delivery_status || "pending",
      driver_name: order.driver_name || null,
      delivery_verification_code: verification.code,
      delivery_verification_attempts: verification.attempts,
      payment_status: order.payment_status || "pending",
      idempotency_key: order.idempotency_key || null,
      idempotency_hash: order.idempotency_hash || null,
      created_by: order.created_by || null,
      created_at: order.created_at,
      updated_at: order.updated_at,
      items,
      itemsCount: items.reduce((acc: number, it: any) => acc + it.quantity, 0),
      tableName: null,
      deliveryVerificationCode: verification.code,
      deliveryVerificationAttempts: verification.attempts,
    };
  });
}

/**
 * 8. Asigna un domiciliario a un pedido y cambia su estado de despacho
 */
export async function assignDriverToOrder(
  businessId: string,
  orderId: string,
  driverName: string,
  actorId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getDbClient();

  const { data: order, error: findErr } = await supabase
    .from("restaurant_orders")
    .select("id, business_id, order_number, status, delivery_status")
    .eq("id", orderId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (findErr || !order) {
    return { success: false, error: "Pedido no encontrado o no pertenece a este negocio." };
  }

  if (order.status === "cancelled") {
    return { success: false, error: "No se puede asignar un repartidor a un pedido cancelado." };
  }

  const { error: updateErr } = await supabase
    .from("restaurant_orders")
    .update({
      driver_name: driverName.trim() || null,
      delivery_status: "assigned",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("business_id", businessId);

  if (updateErr) {
    return { success: false, error: updateErr.message || "Error al asignar el domiciliario." };
  }

  await logAuditAction({
    businessId,
    userId: actorId,
    action: "assign",
    entityType: "order_delivery",
    entityId: orderId,
    description: `Asignado domiciliario «${driverName}» al pedido #${order.order_number}`,
    metadata: { orderId, orderNumber: order.order_number, driverName },
  });

  return { success: true };
}

/**
 * 9. Marca el pedido como despachado / en camino
 */
export async function dispatchDeliveryOrder(
  businessId: string,
  orderId: string,
  actorId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getDbClient();

  const { data: order, error: findErr } = await supabase
    .from("restaurant_orders")
    .select("id, business_id, order_number, status")
    .eq("id", orderId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (findErr || !order) {
    return { success: false, error: "Pedido no encontrado." };
  }

  if (order.status === "cancelled") {
    return { success: false, error: "No se puede despachar un pedido cancelado." };
  }

  const { error: updateErr } = await supabase
    .from("restaurant_orders")
    .update({
      delivery_status: "on_the_way",
      status: order.status === "received" ? "in_preparation" : order.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("business_id", businessId);

  if (updateErr) {
    return { success: false, error: "Error al actualizar estado de despacho." };
  }

  await logAuditAction({
    businessId,
    userId: actorId,
    action: "dispatch",
    entityType: "order_delivery",
    entityId: orderId,
    description: `Despachado pedido #${order.order_number} a domicilio (En camino)`,
    metadata: { orderId, orderNumber: order.order_number },
  });

  return { success: true };
}

/**
 * 10. Verifica el código de entrega del cliente y confirma la entrega de forma segura
 * 
 * Reglas:
 * - Valida coincidencia exacta de código.
 * - Protege contra fuerza bruta: tras 5 intentos fallidos se bloquea y requiere excepción del negocio.
 * - NO altera el estado de pago: entrega y cobro son dos dimensiones comerciales separadas.
 */
export async function verifyAndConfirmDelivery(
  businessId: string,
  orderId: string,
  enteredCode: string,
  driverName?: string,
  actorId?: string
): Promise<{ success: boolean; error?: string; remainingAttempts?: number }> {
  const supabase = await getDbClient();

  const { data: order, error: findErr } = await supabase
    .from("restaurant_orders")
    .select("id, business_id, order_number, status, delivery_status, notes, payment_status")
    .eq("id", orderId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (findErr || !order) {
    return { success: false, error: "Pedido no encontrado o no pertenece a este comercio." };
  }

  if (order.status === "cancelled") {
    return { success: false, error: "Este pedido se encuentra cancelado. No es posible entregarlo." };
  }

  if (order.delivery_status === "delivered" || order.status === "delivered") {
    return { success: false, error: "Este pedido ya fue entregado y verificado anteriormente." };
  }

  const verification = extractDeliveryVerification(order.notes);

  if (!verification.code) {
    // Si la orden no tenía código generado previamente, permitir confirmación directa con auditoría
    const { error: updateErr } = await supabase
      .from("restaurant_orders")
      .update({
        delivery_status: "delivered",
        status: "delivered",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("business_id", businessId);

    if (updateErr) {
      return { success: false, error: "No se pudo confirmar la entrega." };
    }

    await logAuditAction({
      businessId,
      userId: actorId,
      action: "deliver",
      entityType: "order_delivery",
      entityId: orderId,
      description: `Pedido #${order.order_number} entregado sin código preconfigurado por ${driverName || "repartidor"}`,
      metadata: { orderId, driverName },
    });

    return { success: true };
  }

  if (verification.isLocked) {
    return {
      success: false,
      error: "Se ha superado el límite de intentos (5). Comunícate con el negocio para autorizar la entrega mediante el procedimiento de excepción.",
      remainingAttempts: 0,
    };
  }

  const cleanInput = enteredCode.trim();

  // Comprobación segura del código
  if (cleanInput !== verification.code) {
    const newAttempts = verification.attempts + 1;
    const updatedNotes = encodeDeliveryVerification(verification.cleanNotes, verification.code, newAttempts);

    await supabase
      .from("restaurant_orders")
      .update({
        notes: updatedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("business_id", businessId);

    const remaining = Math.max(0, 5 - newAttempts);

    await logAuditAction({
      businessId,
      userId: actorId,
      action: "verify_failed",
      entityType: "order_delivery",
      entityId: orderId,
      description: `Intento fallido de verificación de entrega en pedido #${order.order_number} (Intento ${newAttempts}/5)`,
      metadata: { orderId, attempt: newAttempts, driverName },
    });

    if (remaining === 0) {
      return {
        success: false,
        error: "Has superado el número máximo de intentos permitidos (5). La entrega ha sido bloqueada y requiere autorización manual del negocio.",
        remainingAttempts: 0,
      };
    }

    return {
      success: false,
      error: `Código de verificación incorrecto. Te quedan ${remaining} intento(s).`,
      remainingAttempts: remaining,
    };
  }

  // Código correcto: marcar como entregado conservando el historial
  const finalNotes = verification.cleanNotes
    ? `${verification.cleanNotes} | Entrega verificada con código`
    : "Entrega verificada con código";

  const { error: confirmErr } = await supabase
    .from("restaurant_orders")
    .update({
      delivery_status: "delivered",
      status: "delivered",
      notes: finalNotes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("business_id", businessId);

  if (confirmErr) {
    return { success: false, error: "Error al registrar la confirmación de entrega en la base de datos." };
  }

  await logAuditAction({
    businessId,
    userId: actorId,
    action: "deliver",
    entityType: "order_delivery",
    entityId: orderId,
    description: `Pedido #${order.order_number} entregado y verificado exitosamente por ${driverName || "repartidor"}`,
    metadata: { orderId, driverName, orderNumber: order.order_number },
  });

  return { success: true };
}

/**
 * 11. Procedimiento de excepción: confirmación autorizada por el negocio si el cliente extravió el código
 */
export async function confirmDeliveryWithException(
  businessId: string,
  orderId: string,
  reason: string,
  actorId?: string
): Promise<{ success: boolean; error?: string }> {
  if (!reason.trim() || reason.trim().length < 4) {
    return { success: false, error: "Debes ingresar un motivo válido para la autorización de excepción (mínimo 4 caracteres)." };
  }

  const supabase = await getDbClient();

  const { data: order, error: findErr } = await supabase
    .from("restaurant_orders")
    .select("id, business_id, order_number, status, delivery_status, notes")
    .eq("id", orderId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (findErr || !order) {
    return { success: false, error: "Pedido no encontrado." };
  }

  if (order.status === "cancelled") {
    return { success: false, error: "No es posible entregar un pedido cancelado." };
  }

  const verification = extractDeliveryVerification(order.notes);
  const updatedNotes = verification.cleanNotes
    ? `${verification.cleanNotes} | Excepción de entrega: ${reason.trim()}`
    : `Excepción de entrega: ${reason.trim()}`;

  const { error: updateErr } = await supabase
    .from("restaurant_orders")
    .update({
      delivery_status: "delivered",
      status: "delivered",
      notes: updatedNotes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("business_id", businessId);

  if (updateErr) {
    return { success: false, error: "No fue posible registrar la entrega por excepción." };
  }

  await logAuditAction({
    businessId,
    userId: actorId,
    action: "deliver_exception",
    entityType: "order_delivery",
    entityId: orderId,
    description: `Autorizada entrega por excepción en pedido #${order.order_number}. Motivo: ${reason.trim()}`,
    metadata: { orderId, orderNumber: order.order_number, reason: reason.trim() },
  });

  return { success: true };
}
