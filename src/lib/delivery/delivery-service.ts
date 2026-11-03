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

import crypto from "crypto";
import { getDbClient } from "@/lib/restaurant/restaurant-service";
import { logAuditAction } from "@/lib/audit/audit-service";
import { RestaurantOrderWithDetails } from "@/lib/restaurant/types";
import {
  DeliverySettlementSummary,
  DeliverySettlementRecord,
  DeliveryIssueType,
  DELIVERY_ISSUE_LABELS,
} from "./types";

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
 * 5.1. Actualiza los datos de un domiciliario operativo o regenera su PIN
 */
export async function updateOperationalDeliveryDriver(
  businessId: string,
  driverId: string,
  updates: {
    name?: string;
    phone?: string | null;
    regeneratePin?: boolean;
    pin?: string;
  },
  actorId?: string
): Promise<{ success: boolean; driver?: OperationalDeliveryDriver; error?: string }> {
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

  const driver = existingDrivers[driverIndex];

  if (updates.name !== undefined) {
    if (!updates.name.trim()) {
      return { success: false, error: "El nombre no puede estar vacío." };
    }
    driver.name = updates.name.trim();
  }

  if (updates.phone !== undefined) {
    driver.phone = updates.phone?.trim() || null;
  }

  if (updates.regeneratePin) {
    let newPin = "";
    let isUnique = false;
    for (let i = 0; i < 10; i++) {
      newPin = String(Math.floor(100000 + Math.random() * 900000));
      if (!existingDrivers.some((d) => d.id !== driverId && d.accessPin === newPin)) {
        isUnique = true;
        break;
      }
    }
    if (!isUnique) {
      newPin = String(Date.now()).slice(-6);
    }
    driver.accessPin = newPin;
  } else if (updates.pin) {
    const cleanPin = updates.pin.trim();
    if (!/^\d{6}$/.test(cleanPin)) {
      return { success: false, error: "El PIN debe tener exactamente 6 dígitos numéricos." };
    }
    driver.accessPin = cleanPin;
  }

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
    return { success: false, error: "No se pudieron guardar los cambios del domiciliario." };
  }

  await logAuditAction({
    businessId,
    userId: actorId,
    action: "update",
    entityType: "delivery_driver",
    entityId: driverId,
    description: `Actualizado domiciliario operativo: ${driver.name}`,
    metadata: { driverId, name: driver.name, pinRegenerated: Boolean(updates.regeneratePin) },
  });

  return { success: true, driver };
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



// ==============================================================================
// 12. PORTAL PÚBLICO SEGURO PARA DOMICILIARIOS EXTERNOS MEDIANTE TOKEN CRIPTOGRÁFICO
// ==============================================================================

export interface DeliveryDispatchSession {
  id: string;
  businessId: string;
  driverId: string;
  driverName: string;
  driverPhone?: string | null;
  tokenHash: string;
  status: "active" | "revoked" | "expired";
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  revokedAt?: string | null;
  lastAccessedAt?: string | null;
}

/**
 * Genera un token criptográficamente aleatorio con alta entropía (24 bytes base64url).
 */
export function generateDeliveryToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/**
 * Computa el hash SHA-256 en hexadecimal del token.
 * Regla de Seguridad: Solo el hash se almacena en base de datos.
 */
export function hashDeliveryToken(token: string): string {
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

/**
 * Crea o renueva una sesión de despacho segura para un domiciliario externo.
 * Devuelve el token en texto plano UNA SOLA VEZ para generar el enlace de WhatsApp.
 */
export async function createOrRenewDriverDispatchSession(
  businessId: string,
  driverId: string,
  options?: {
    hoursValid?: number;
    actorId?: string;
  }
): Promise<{
  success: boolean;
  token?: string;
  session?: DeliveryDispatchSession;
  error?: string;
}> {
  const drivers = await getOperationalDeliveryDrivers(businessId);
  const driver = drivers.find((d) => d.id === driverId);

  if (!driver) {
    return { success: false, error: "Domiciliario no encontrado en la configuración del comercio." };
  }

  if (!driver.isActive) {
    return { success: false, error: "El acceso de este domiciliario está inactivo o revocado." };
  }

  const token = generateDeliveryToken();
  const tokenHash = hashDeliveryToken(token);
  const hours = options?.hoursValid || 18;
  const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
  const now = new Date().toISOString();

  const supabase = await getDbClient();

  const newSession: DeliveryDispatchSession = {
    id: crypto.randomUUID(),
    businessId,
    driverId: driver.id,
    driverName: driver.name,
    driverPhone: driver.phone || null,
    tokenHash,
    status: "active",
    expiresAt,
    createdAt: now,
    updatedAt: now,
    lastAccessedAt: null,
  };

  // 1. Intentar persistencia en tabla dedicada delivery_dispatch_sessions
  let savedInTable = false;
  try {
    await supabase
      .from("delivery_dispatch_sessions")
      .update({ status: "revoked", revoked_at: now, updated_at: now })
      .eq("business_id", businessId)
      .eq("driver_id", driverId)
      .eq("status", "active");

    const { error: insertErr } = await supabase
      .from("delivery_dispatch_sessions")
      .insert({
        id: newSession.id,
        business_id: businessId,
        driver_id: driverId,
        driver_name: driver.name,
        driver_phone: driver.phone || null,
        token_hash: tokenHash,
        status: "active",
        expires_at: expiresAt,
        created_at: now,
        updated_at: now,
      });

    if (!insertErr) {
      savedInTable = true;
    }
  } catch {
    savedInTable = false;
  }

  // 2. Fallback en businesses.settings->delivery_sessions
  if (!savedInTable) {
    try {
      const { data: biz } = await supabase
        .from("businesses")
        .select("settings")
        .eq("id", businessId)
        .single();

      const existingSessions = (biz?.settings?.delivery_sessions || []).map((s: any) =>
        s.driverId === driverId && s.status === "active"
          ? { ...s, status: "revoked", revokedAt: now, updatedAt: now }
          : s
      );

      existingSessions.push(newSession);

      await supabase
        .from("businesses")
        .update({
          settings: {
            ...biz?.settings,
            delivery_sessions: existingSessions,
          },
        })
        .eq("id", businessId);
    } catch {}
  }

  await logAuditAction({
    businessId,
    userId: options?.actorId,
    action: "dispatch_session_create",
    entityType: "delivery_session",
    entityId: newSession.id,
    description: `Generada sesión segura de reparto para ${driver.name}`,
    metadata: { driverId: driver.id, driverName: driver.name, expiresAt },
  });

  return {
    success: true,
    token,
    session: newSession,
  };
}

/**
 * Revoca el acceso del enlace seguro de un repartidor
 */
export async function revokeDriverDispatchSession(
  businessId: string,
  driverId: string,
  actorId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getDbClient();
  const now = new Date().toISOString();

  try {
    await supabase
      .from("delivery_dispatch_sessions")
      .update({
        status: "revoked",
        revoked_at: now,
        updated_at: now,
      })
      .eq("business_id", businessId)
      .eq("driver_id", driverId)
      .eq("status", "active");
  } catch {}

  try {
    const { data: biz } = await supabase
      .from("businesses")
      .select("settings")
      .eq("id", businessId)
      .single();

    if (biz?.settings?.delivery_sessions) {
      const updated = biz.settings.delivery_sessions.map((s: any) =>
        s.driverId === driverId && s.status === "active"
          ? { ...s, status: "revoked", revokedAt: now, updatedAt: now }
          : s
      );
      await supabase
        .from("businesses")
        .update({
          settings: {
            ...biz.settings,
            delivery_sessions: updated,
          },
        })
        .eq("id", businessId);
    }
  } catch {}

  await logAuditAction({
    businessId,
    userId: actorId,
    action: "dispatch_session_revoke",
    entityType: "delivery_session",
    description: `Enlace de despacho revocado para el repartidor ID ${driverId}`,
    metadata: { driverId },
  });

  return { success: true };
}

/**
 * Consulta y valida una sesión de despacho mediante token criptográfico
 */
export async function getDriverDispatchSessionByToken(token: string): Promise<{
  success: boolean;
  session?: DeliveryDispatchSession;
  error?: string;
}> {
  if (!token || typeof token !== "string" || !token.trim()) {
    return { success: false, error: "Token de despacho inválido o ausente." };
  }

  const tokenHash = hashDeliveryToken(token.trim());
  const supabase = await getDbClient();

  // 1. Buscar en la tabla dedicada delivery_dispatch_sessions
  try {
    const { data, error } = await supabase
      .from("delivery_dispatch_sessions")
      .select("*")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!error && data) {
      if (data.status === "revoked") {
        return { success: false, error: "El acceso de este enlace fue revocado por el negocio." };
      }

      if (new Date(data.expires_at) <= new Date() || data.status === "expired") {
        if (data.status !== "expired") {
          await supabase
            .from("delivery_dispatch_sessions")
            .update({ status: "expired", updated_at: new Date().toISOString() })
            .eq("id", data.id);
        }
        return { success: false, error: "El enlace de despacho ha expirado." };
      }

      return {
        success: true,
        session: {
          id: data.id,
          businessId: data.business_id,
          driverId: data.driver_id,
          driverName: data.driver_name,
          driverPhone: data.driver_phone || null,
          tokenHash: data.token_hash,
          status: data.status,
          expiresAt: data.expires_at,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          revokedAt: data.revoked_at || null,
          lastAccessedAt: data.last_accessed_at || null,
        },
      };
    }
  } catch {}

  // 2. Fallback: buscar en businesses.settings->delivery_sessions
  try {
    const { data: businesses } = await supabase
      .from("businesses")
      .select("id, settings");

    for (const b of (businesses || [])) {
      const sessions = b.settings?.delivery_sessions || [];
      const match = sessions.find((s: any) => s.tokenHash === tokenHash);
      if (match) {
        if (match.status === "revoked") {
          return { success: false, error: "El acceso de este enlace fue revocado por el negocio." };
        }
        if (new Date(match.expiresAt) <= new Date()) {
          return { success: false, error: "El enlace de despacho ha expirado." };
        }
        return {
          success: true,
          session: {
            ...match,
            businessId: b.id,
          },
        };
      }
    }
  } catch {}

  return { success: false, error: "Enlace de reparto no encontrado o no disponible." };
}

/**
 * Consulta pedidos asignados mediante token criptográfico de sesión
 */
export async function getDriverOrdersBySessionToken(token: string): Promise<{
  success: boolean;
  businessName?: string;
  driverName?: string;
  expiresAt?: string;
  pendingOrders: any[];
  completedOrders: any[];
  error?: string;
}> {
  const sessionResult = await getDriverDispatchSessionByToken(token);
  if (!sessionResult.success || !sessionResult.session) {
    return {
      success: false,
      error: sessionResult.error || "Sesión de reparto inválida o expirada.",
      pendingOrders: [],
      completedOrders: [],
    };
  }

  const session = sessionResult.session;
  const supabase = await getDbClient();

  const { data: biz } = await supabase
    .from("businesses")
    .select("name")
    .eq("id", session.businessId)
    .single();

  const businessName = biz?.name || "Restaurante";

  const { data: rawOrders, error } = await supabase
    .from("restaurant_orders")
    .select("*")
    .eq("business_id", session.businessId)
    .eq("delivery_type", "delivery")
    .order("created_at", { ascending: false });

  if (error) {
    return {
      success: false,
      error: "Error al consultar pedidos asignados.",
      pendingOrders: [],
      completedOrders: [],
    };
  }

  const assignedOrders = (rawOrders || []).filter(
    (o) => o.driver_name === session.driverName
  );

  const pendingOrders: any[] = [];
  const completedOrders: any[] = [];

  for (const o of assignedOrders) {
    const verification = extractDeliveryVerification(o.notes);
    let items: any[] = [];
    try {
      items = typeof o.items === "string" ? JSON.parse(o.items) : (o.items || []);
    } catch {
      items = [];
    }

    const sanitizedOrder = {
      id: o.id,
      orderNumber: o.order_number,
      deliveryStatus: o.delivery_status || "assigned",
      status: o.status,
      customerName: o.customer_name || "Cliente",
      customerPhone: o.customer_phone || null,
      deliveryAddress: o.delivery_address || "",
      deliveryReference: o.delivery_reference || null,
      subtotal: Number(o.subtotal || 0),
      deliveryFee: Number(o.delivery_fee || 0),
      total: Number(o.total || 0),
      notes: verification.cleanNotes,
      paymentStatus: o.payment_status || "pending",
      amountToCollect: o.payment_status === "paid" ? 0 : Number(o.total || 0),
      hasVerificationCode: Boolean(verification.code),
      isLocked: verification.isLocked,
      attemptsRemaining: Math.max(0, 5 - verification.attempts),
      createdAt: o.created_at,
      items,
      itemsCount: items.reduce((acc: number, it: any) => acc + (it.quantity || 1), 0),
    };

    if (o.delivery_status === "delivered" || o.status === "delivered") {
      completedOrders.push(sanitizedOrder);
    } else {
      pendingOrders.push(sanitizedOrder);
    }
  }

  return {
    success: true,
    businessName,
    driverName: session.driverName,
    expiresAt: session.expiresAt,
    pendingOrders,
    completedOrders,
  };
}

/**
 * Confirma la entrega de un pedido validando el token de sesión y la asignación al repartidor.
 * Separación Estricta: Marcar como entregado NUNCA altera automáticamente payment_status.
 */
export async function confirmDeliveryOrderBySessionToken(
  token: string,
  orderId: string,
  enteredCode?: string
): Promise<{ success: boolean; error?: string; remainingAttempts?: number }> {
  const sessionResult = await getDriverDispatchSessionByToken(token);
  if (!sessionResult.success || !sessionResult.session) {
    return { success: false, error: sessionResult.error || "Sesión de reparto no válida o expirada." };
  }

  const session = sessionResult.session;
  const supabase = await getDbClient();

  const { data: order, error } = await supabase
    .from("restaurant_orders")
    .select("id, order_number, driver_name, notes, delivery_status, status, payment_status")
    .eq("id", orderId)
    .eq("business_id", session.businessId)
    .maybeSingle();

  if (error || !order) {
    return { success: false, error: "Pedido no encontrado o no pertenece a este comercio." };
  }

  if (order.driver_name !== session.driverName) {
    return { success: false, error: "Este pedido no está asignado a tu sesión de reparto." };
  }

  if (order.delivery_status === "delivered" || order.status === "delivered") {
    return { success: true };
  }

  const result = await verifyAndConfirmDelivery(
    session.businessId,
    orderId,
    enteredCode || "",
    session.driverName
  );

  return result;
}


// ==========================================
// SERVICIOS DE GESTIÓN DE ZONAS DE ENTREGA [DOM-001]
// ==========================================

import {
  DeliveryZone,
  CreateDeliveryZoneInput,
  UpdateDeliveryZoneInput,
  GeoPoint,
  DeliveryZoneMatchResult,
  findMatchingDeliveryZone,
} from "@/lib/delivery/types";

/**
 * Consulta todas las zonas de entrega configuradas para un comercio.
 */
export async function getDeliveryZones(businessId: string): Promise<DeliveryZone[]> {
  const supabase = await getDbClient();

  const { data, error } = await supabase
    .from("delivery_zones")
    .select("*")
    .eq("business_id", businessId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[getDeliveryZones] Error al consultar zonas de entrega:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    business_id: row.business_id,
    name: row.name,
    description: row.description || null,
    tariff: Number(row.tariff || 0),
    min_order: Number(row.min_order || 0),
    estimated_time_min: Number(row.estimated_time_min || 30),
    priority: Number(row.priority || 1),
    color: row.color || "#ED500A",
    geometry: row.geometry,
    status: row.status || "active",
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

/**
 * Consulta una zona de entrega por ID con aislamiento de comercio.
 */
export async function getDeliveryZoneById(
  businessId: string,
  zoneId: string
): Promise<DeliveryZone | null> {
  const supabase = await getDbClient();

  const { data, error } = await supabase
    .from("delivery_zones")
    .select("*")
    .eq("id", zoneId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    business_id: data.business_id,
    name: data.name,
    description: data.description || null,
    tariff: Number(data.tariff || 0),
    min_order: Number(data.min_order || 0),
    estimated_time_min: Number(data.estimated_time_min || 30),
    priority: Number(data.priority || 1),
    color: data.color || "#ED500A",
    geometry: data.geometry,
    status: data.status || "active",
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/**
 * Crea una nueva zona de entrega con validación de geometría (polígono o radio).
 */
export async function createDeliveryZone(
  businessId: string,
  input: CreateDeliveryZoneInput
): Promise<{ success: boolean; zone?: DeliveryZone; error?: string }> {
  if (!input.name || !input.name.trim()) {
    return { success: false, error: "El nombre de la zona es obligatorio." };
  }

  if (input.tariff < 0) {
    return { success: false, error: "La tarifa no puede ser negativa." };
  }

  if (!input.geometry || !input.geometry.type) {
    return { success: false, error: "La geometría de la zona es obligatoria." };
  }

  if (input.geometry.type === "polygon") {
    if (!Array.isArray(input.geometry.coordinates) || input.geometry.coordinates.length < 3) {
      return { success: false, error: "Un polígono debe tener al menos 3 vértices coordenados." };
    }
  } else if (input.geometry.type === "radius") {
    if (!input.geometry.center || typeof input.geometry.radiusMeters !== "number" || input.geometry.radiusMeters <= 0) {
      return { success: false, error: "El radio debe tener un punto central y un radio en metros válido mayor a 0." };
    }
  }

  const supabase = await getDbClient();

  const { data, error } = await supabase
    .from("delivery_zones")
    .insert({
      business_id: businessId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      tariff: Number(input.tariff || 0),
      min_order: Number(input.min_order || 0),
      estimated_time_min: Number(input.estimated_time_min || 30),
      priority: Number(input.priority || 1),
      color: input.color || "#ED500A",
      geometry: input.geometry,
      status: input.status || "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[createDeliveryZone] Error al insertar zona:", error);
    if (error?.code === "23505") {
      return { success: false, error: "Ya existe una zona de entrega con ese nombre en este comercio." };
    }
    return { success: false, error: error?.message || "Error al crear la zona de entrega." };
  }

  return {
    success: true,
    zone: {
      id: data.id,
      business_id: data.business_id,
      name: data.name,
      description: data.description || null,
      tariff: Number(data.tariff || 0),
      min_order: Number(data.min_order || 0),
      estimated_time_min: Number(data.estimated_time_min || 30),
      priority: Number(data.priority || 1),
      color: data.color || "#ED500A",
      geometry: data.geometry,
      status: data.status || "active",
      created_at: data.created_at,
      updated_at: data.updated_at,
    },
  };
}

/**
 * Actualiza una zona de entrega existente asegurando aislamiento multi-tenant.
 */
export async function updateDeliveryZone(
  businessId: string,
  input: UpdateDeliveryZoneInput
): Promise<{ success: boolean; zone?: DeliveryZone; error?: string }> {
  const existing = await getDeliveryZoneById(businessId, input.id);
  if (!existing) {
    return { success: false, error: "Zona de entrega no encontrada o no pertenece a este comercio." };
  }

  const updates: any = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.description !== undefined) updates.description = input.description?.trim() || null;
  if (input.tariff !== undefined) updates.tariff = Number(input.tariff);
  if (input.min_order !== undefined) updates.min_order = Number(input.min_order);
  if (input.estimated_time_min !== undefined) updates.estimated_time_min = Number(input.estimated_time_min);
  if (input.priority !== undefined) updates.priority = Number(input.priority);
  if (input.color !== undefined) updates.color = input.color;
  if (input.status !== undefined) updates.status = input.status;
  if (input.geometry !== undefined) updates.geometry = input.geometry;

  const supabase = await getDbClient();

  const { data, error } = await supabase
    .from("delivery_zones")
    .update(updates)
    .eq("id", input.id)
    .eq("business_id", businessId)
    .select("*")
    .single();

  if (error || !data) {
    console.error("[updateDeliveryZone] Error al actualizar zona:", error);
    return { success: false, error: error?.message || "Error al actualizar la zona de entrega." };
  }

  return {
    success: true,
    zone: {
      id: data.id,
      business_id: data.business_id,
      name: data.name,
      description: data.description || null,
      tariff: Number(data.tariff || 0),
      min_order: Number(data.min_order || 0),
      estimated_time_min: Number(data.estimated_time_min || 30),
      priority: Number(data.priority || 1),
      color: data.color || "#ED500A",
      geometry: data.geometry,
      status: data.status || "active",
      created_at: data.created_at,
      updated_at: data.updated_at,
    },
  };
}

/**
 * Elimina una zona de entrega asegurando aislamiento multi-tenant.
 */
export async function deleteDeliveryZone(
  businessId: string,
  zoneId: string
): Promise<{ success: boolean; error?: string }> {
  const existing = await getDeliveryZoneById(businessId, zoneId);
  if (!existing) {
    return { success: false, error: "Zona de entrega no encontrada o no pertenece a este comercio." };
  }

  const supabase = await getDbClient();

  const { error } = await supabase
    .from("delivery_zones")
    .delete()
    .eq("id", zoneId)
    .eq("business_id", businessId);

  if (error) {
    console.error("[deleteDeliveryZone] Error al eliminar zona:", error);
    return { success: false, error: error?.message || "Error al eliminar la zona de entrega." };
  }

  return { success: true };
}

/**
 * Evalúa si una ubicación o punto geográfico está cubierto por las zonas de entrega activas del negocio.
 */
export async function evaluateLocationDeliveryZone(
  businessId: string,
  point: GeoPoint
): Promise<DeliveryZoneMatchResult> {
  const zones = await getDeliveryZones(businessId);
  return findMatchingDeliveryZone(point, zones);
}


// ==========================================
// CONFIGURACIÓN COMPLETA DE DOMICILIOS [DOM-002]
// ==========================================

import {
  DeliveryBusinessConfig,
  DEFAULT_DELIVERY_BUSINESS_CONFIG,
  normalizeDeliveryBusinessConfig,
} from "@/lib/delivery/types";

/**
 * Consulta la configuración completa de domicilios del comercio.
 * Persistida en businesses.settings.delivery
 */
export async function getDeliveryBusinessConfig(
  businessId: string
): Promise<DeliveryBusinessConfig> {
  const supabase = await getDbClient();

  const { data, error } = await supabase
    .from("businesses")
    .select("settings")
    .eq("id", businessId)
    .maybeSingle();

  if (error || !data) {
    console.warn("[getDeliveryBusinessConfig] Error al consultar settings:", error);
    return { ...DEFAULT_DELIVERY_BUSINESS_CONFIG };
  }

  const rawDelivery = (data.settings as any)?.delivery;
  return normalizeDeliveryBusinessConfig(rawDelivery);
}

/**
 * Guarda o actualiza la configuración completa de domicilios en businesses.settings.delivery
 */
export async function updateDeliveryBusinessConfig(
  businessId: string,
  input: Partial<DeliveryBusinessConfig>,
  actorId?: string
): Promise<{ success: boolean; config?: DeliveryBusinessConfig; error?: string }> {
  const supabase = await getDbClient();

  // 1. Obtener settings actuales para preservación atómica
  const { data: currentBiz, error: fetchErr } = await supabase
    .from("businesses")
    .select("settings")
    .eq("id", businessId)
    .single();

  if (fetchErr || !currentBiz) {
    return { success: false, error: "Comercio no encontrado para guardar configuración." };
  }

  const currentSettings = (currentBiz.settings || {}) as Record<string, any>;
  const currentDelivery = normalizeDeliveryBusinessConfig(currentSettings.delivery);

  const mergedConfig: DeliveryBusinessConfig = normalizeDeliveryBusinessConfig({
    ...currentDelivery,
    ...input,
    distanceConfig: {
      ...currentDelivery.distanceConfig,
      ...(input.distanceConfig || {}),
    },
    timing: {
      ...currentDelivery.timing,
      ...(input.timing || {}),
    },
    bonuses: {
      ...currentDelivery.bonuses,
      ...(input.bonuses || {}),
    },
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });

  const updatedSettings = {
    ...currentSettings,
    delivery: mergedConfig,
  };

  const { error: updateErr } = await supabase
    .from("businesses")
    .update({ settings: updatedSettings })
    .eq("id", businessId);

  if (updateErr) {
    console.error("[updateDeliveryBusinessConfig] Error al actualizar settings:", updateErr);
    return { success: false, error: "Error al guardar la configuración de domicilios." };
  }

  await logAuditAction({
    businessId,
    userId: actorId,
    action: "update_delivery_config",
    entityType: "business_settings",
    entityId: businessId,
    description: `Actualizada configuración de domicilios (Tarifa: ${mergedConfig.tariffMode}, Paga: ${mergedConfig.payer})`,
    metadata: {
      tariffMode: mergedConfig.tariffMode,
      payer: mergedConfig.payer,
      fixedFee: mergedConfig.fixedFee,
      delayAlertMinutes: mergedConfig.timing.delayAlertMinutes,
    },
  });

  return { success: true, config: mergedConfig };
}

// ==========================================
// Liquidación y Arqueo de Domicilios [DOM-006]
// ==========================================

/**
 * Calcula los totales y montos por liquidar para cada repartidor operativo
 */
export function calculateDeliverySettlements(
  orders: RestaurantOrderWithDetails[],
  drivers: OperationalDeliveryDriver[],
  deliveryConfig?: DeliveryBusinessConfig,
  settledOrderIds: string[] = []
): DeliverySettlementSummary[] {
  const settledSet = new Set(settledOrderIds);

  return drivers.map((driver) => {
    const driverKey = driver.name.toLowerCase().trim();

    // Órdenes asignadas y entregadas a este domiciliario
    const driverOrders = orders.filter(
      (o) =>
        o.order_type === "delivery" &&
        o.status !== "cancelled" &&
        (o.delivery_status === "delivered" || o.status === "delivered") &&
        o.driver_name?.toLowerCase().trim() === driverKey
    );

    let totalCashCollected = 0;
    let totalDigitalCollected = 0;
    let cashOrdersCount = 0;
    let digitalOrdersCount = 0;
    let pendingCashToSettle = 0;
    let driverTips = 0;
    let totalRevenue = 0;
    const orderIds: string[] = [];

    for (const order of driverOrders) {
      orderIds.push(order.id);
      const orderPaymentMethod = (order as any).payment_method;
      const isPaidBefore = order.payment_status === "paid" && orderPaymentMethod !== "cash";
      const total = Number(order.total || 0);
      totalRevenue += total;

      // Si el pago es en efectivo o pendiente por cobrar al entregar
      if (!isPaidBefore && (orderPaymentMethod === "cash" || !orderPaymentMethod || order.payment_status !== "paid")) {
        cashOrdersCount += 1;
        totalCashCollected += total;
        if (!settledSet.has(order.id)) {
          pendingCashToSettle += total;
        }
      } else {
        digitalOrdersCount += 1;
        totalDigitalCollected += total;
      }

      // Propinas si existen
      const tip = Number((order as any).tip_amount || (order as any).tip || 0);
      driverTips += tip;
    }

    // Flete de reparto
    const grossDeliveryFee = driverOrders.reduce((acc, o) => acc + Number(o.delivery_fee || 0), 0);
    const driverDeliveryFeeShare = grossDeliveryFee;
    const businessDeliveryFeeShare = 0;

    const isSettled = driverOrders.length > 0 && pendingCashToSettle === 0;

    return {
      driverId: driver.id,
      driverName: driver.name,
      driverPhone: driver.phone,
      totalOrdersDelivered: driverOrders.length,
      cashOrdersCount,
      digitalOrdersCount,
      totalCashCollected,
      totalDigitalCollected,
      totalRevenue,
      driverTips,
      driverDeliveryFeeShare,
      businessDeliveryFeeShare,
      pendingCashToSettle,
      isSettled,
      orderIds,
    };
  });
}

/**
 * Liquida el dinero en efectivo recaudado por un repartidor e ingresa el monto a una sesión de caja activa de NEGOVA
 */
export async function liquidateDriverCash(
  businessId: string,
  input: {
    driverId: string;
    driverName: string;
    amount: number;
    sessionId: string;
    notes?: string | null;
    orderIds?: string[];
  },
  actorId?: string
): Promise<{ success: boolean; settlementRecord?: DeliverySettlementRecord; error?: string }> {
  if (input.amount <= 0) {
    return { success: false, error: "El monto a liquidar debe ser superior a cero." };
  }

  const supabase = await getDbClient();

  // 1. Registrar movimiento de entrada en la caja activa
  try {
    const { recordCashMovement } = await import("@/lib/cash/cash-service");
    await recordCashMovement(
      businessId,
      {
        sessionId: input.sessionId,
        movementType: "entry",
        amount: input.amount,
        referenceType: "delivery_settlement",
        notes: input.notes || `Liquidación de domiciliario: ${input.driverName} (${input.orderIds?.length || 0} pedidos)`,
      },
      actorId
    );
  } catch (err: any) {
    console.error("[liquidateDriverCash] Error al registrar movimiento de caja:", err);
    return { success: false, error: err?.message || "No se pudo registrar el ingreso en la caja activa." };
  }

  // 2. Persistir registro de liquidación en settings.delivery_settlements
  const { data: biz } = await supabase
    .from("businesses")
    .select("settings")
    .eq("id", businessId)
    .single();

  const existingSettlements: DeliverySettlementRecord[] = (biz?.settings as any)?.delivery_settlements || [];
  const newSettlement: DeliverySettlementRecord = {
    id: crypto.randomUUID(),
    driverId: input.driverId,
    driverName: input.driverName,
    amount: input.amount,
    sessionId: input.sessionId,
    orderIds: input.orderIds || [],
    settledAt: new Date().toISOString(),
    notes: input.notes || null,
    createdBy: actorId || null,
  };

  const updatedSettings = {
    ...(biz?.settings || {}),
    delivery_settlements: [...existingSettlements, newSettlement],
  };

  await supabase
    .from("businesses")
    .update({
      settings: updatedSettings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", businessId);

  // 3. Log de auditoría
  await logAuditAction({
    businessId,
    userId: actorId,
    action: "liquidate",
    entityType: "delivery_settlement",
    entityId: newSettlement.id,
    description: `Liquidado turno de domiciliario: ${input.driverName} por monto ${input.amount}`,
    metadata: {
      driverId: input.driverId,
      driverName: input.driverName,
      amount: input.amount,
      sessionId: input.sessionId,
      ordersCount: input.orderIds?.length || 0,
    },
  });

  return { success: true, settlementRecord: newSettlement };
}

/**
 * Reporta una novedad o incidencia en una orden de delivery
 */
export async function reportDeliveryIssue(
  businessId: string,
  orderId: string,
  issueType: DeliveryIssueType,
  notes: string,
  reporterName?: string,
  actorId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getDbClient();

  const { data: order, error: orderErr } = await supabase
    .from("restaurant_orders")
    .select("id, order_number, notes")
    .eq("id", orderId)
    .eq("business_id", businessId)
    .single();

  if (orderErr || !order) {
    return { success: false, error: "Pedido no encontrado." };
  }

  const issueLabel = DELIVERY_ISSUE_LABELS[issueType] || issueType;
  const timestamp = new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  const issueTag = `[NOVEDAD: ${issueLabel} (${timestamp})${reporterName ? ` por ${reporterName}` : ""}: ${notes.trim()}]`;

  const updatedNotes = order.notes ? `${order.notes}\n${issueTag}` : issueTag;

  const { error: updateErr } = await supabase
    .from("restaurant_orders")
    .update({
      notes: updatedNotes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (updateErr) {
    return { success: false, error: "No se pudo registrar la novedad del pedido." };
  }

  await logAuditAction({
    businessId,
    userId: actorId,
    action: "report_issue",
    entityType: "restaurant_order",
    entityId: orderId,
    description: `Novedad de reparto en pedido #${order.order_number}: ${issueLabel} - ${notes}`,
    metadata: { orderId, issueType, reporterName, notes },
  });

  return { success: true };
}

