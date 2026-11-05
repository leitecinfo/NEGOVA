/**
 * SERVICIO DE GESTIÓN Y VERIFICACIÓN DE CÓDIGO DE RECOGIDA (TAKEOUT / PICKUP) [POS-RECOGIDA]
 * 
 * Reglas de Negocio:
 * 1. Generación Automática en Servidor: Código numérico de 4 dígitos criptográficamente seguro.
 * 2. Validación de Intentos: Máximo 5 intentos fallidos con bloqueo preventivo.
 * 3. Un Solo Uso: No permite confirmaciones duplicadas.
 * 4. Separación Estricta: La recogida física NO altera el estado de pago (pagado o pendiente).
 * 5. Auditoría Completa: Registra quién confirmó la entrega física y en qué fecha/hora exacta.
 */

import crypto from "crypto";
import { getDbClient } from "@/lib/restaurant/restaurant-service";
import { logAuditAction } from "@/lib/audit/audit-service";

export interface PickupVerificationDetails {
  code: string | null;
  attempts: number;
  isLocked: boolean;
  isConfirmed: boolean;
  confirmedAt: string | null;
  confirmedBy: string | null;
  confirmedByName?: string | null;
}

/**
 * Genera un código de recogida de 4 dígitos numéricos aleatorio e impredecible.
 */
export function generatePickupCode(): string {
  const pinNumber = crypto.randomInt(1000, 10000);
  return pinNumber.toString();
}

/**
 * Extrae la información de código de recogida desde el registro o notas del pedido.
 */
export function extractPickupVerificationDetails(orderRow: any): PickupVerificationDetails {
  let code = orderRow?.pickup_code || null;
  let attempts = typeof orderRow?.pickup_attempts === "number" ? orderRow.pickup_attempts : 0;
  let confirmedAt = orderRow?.pickup_confirmed_at || null;
  let confirmedBy = orderRow?.pickup_confirmed_by || null;
  let confirmedByName = orderRow?.pickup_confirmed_by_name || null;

  const notes = orderRow?.notes || "";
  if (notes) {
    const pinMatch = notes.match(/\[PICKUP_PIN:([0-9]{4,6})(?::(\d+))?\]/i);
    if (pinMatch) {
      if (!code) code = pinMatch[1];
      if (pinMatch[2]) attempts = parseInt(pinMatch[2], 10);
    }

    const confMatch = notes.match(/\[RECOGIDA_CONFIRMADA:(.*?)(?:\|(.*))?\]/i);
    if (confMatch) {
      if (!confirmedAt) confirmedAt = confMatch[1];
      if (!confirmedByName && confMatch[2]) confirmedByName = confMatch[2];
    }
  }

  const isLocked = attempts >= 5;
  const isConfirmed = Boolean(confirmedAt || orderRow?.status === "delivered");

  return {
    code,
    attempts,
    isLocked,
    isConfirmed,
    confirmedAt,
    confirmedBy,
    confirmedByName,
  };
}

/**
 * Valida el código de recogida de un pedido y confirma la entrega física en tienda.
 * IMPORTANTE: No altera el estado del pago.
 */
export async function verifyAndConfirmPickup(
  businessId: string,
  orderId: string,
  enteredCode: string,
  actorId?: string,
  actorName?: string
): Promise<{ success: boolean; error?: string; remainingAttempts?: number; isConfirmed?: boolean }> {
  const supabase = await getDbClient();

  const { data: order, error } = await supabase
    .from("restaurant_orders")
    .select("id, order_number, order_type, status, payment_status, notes, pickup_code, pickup_attempts, pickup_confirmed_at, pickup_confirmed_by")
    .eq("id", orderId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error || !order) {
    return { success: false, error: "Pedido no encontrado o no pertenece a este comercio." };
  }

  // 1. Validar que la orden corresponda a la modalidad Para recoger (takeout)
  if (order.order_type !== "takeout") {
    return {
      success: false,
      error: "Este pedido no corresponde a la modalidad «Para recoger».",
    };
  }

  // 2. No permitir confirmación de pedidos cancelados
  if (order.status === "cancelled") {
    return {
      success: false,
      error: "No se puede confirmar la recogida de un pedido cancelado.",
    };
  }

  const verification = extractPickupVerificationDetails(order);

  // 3. Protección contra confirmación duplicada
  if (verification.isConfirmed && order.status === "delivered") {
    return {
      success: true,
      isConfirmed: true,
      error: "Este pedido ya fue entregado y confirmado previamente.",
    };
  }

  // 4. Protección contra exceso de intentos fallidos
  if (verification.isLocked) {
    return {
      success: false,
      error: "Se ha superado el límite de intentos permitidos (5). La entrega está bloqueada por seguridad.",
      remainingAttempts: 0,
    };
  }

  const cleanInput = enteredCode.trim();
  if (!cleanInput) {
    return { success: false, error: "Debes ingresar el código de 4 dígitos proporcionado por el cliente." };
  }

  const validCode = verification.code;
  if (!validCode) {
    return {
      success: false,
      error: "Este pedido no cuenta con un código de recogida registrado.",
    };
  }

  // 5. Comparación segura del código
  if (cleanInput !== validCode) {
    const newAttempts = verification.attempts + 1;
    const remaining = Math.max(0, 5 - newAttempts);

    // Actualizar notas y columna de intentos
    const cleanNotes = (order.notes || "").replace(/\[PICKUP_PIN:[0-9]{4,6}(?::\d+)?\]/gi, "").trim();
    const updatedNotes = `${cleanNotes} [PICKUP_PIN:${validCode}:${newAttempts}]`.trim();

    try {
      await supabase
        .from("restaurant_orders")
        .update({
          pickup_attempts: newAttempts,
          notes: updatedNotes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("business_id", businessId);
    } catch {
      // Fallback
    }

    await logAuditAction({
      businessId,
      userId: actorId,
      action: "verify_pickup_failed",
      entityType: "restaurant_order",
      entityId: orderId,
      description: `Intento fallido de confirmación de recogida en pedido #${order.order_number} (${newAttempts}/5)`,
      metadata: { orderId, attempt: newAttempts, actorName },
    });

    if (remaining === 0) {
      return {
        success: false,
        error: "Has superado el número máximo de intentos permitidos (5). La entrega ha sido bloqueada.",
        remainingAttempts: 0,
      };
    }

    return {
      success: false,
      error: `Código de recogida incorrecto. Te quedan ${remaining} intento(s).`,
      remainingAttempts: remaining,
    };
  }

  // 6. Código Correcto: Confirmar recogida física SIN tocar payment_status
  const now = new Date().toISOString();
  const staffLabel = actorName ? ` por ${actorName}` : "";
  const cleanNotes = (order.notes || "").replace(/\[PICKUP_PIN:[0-9]{4,6}(?::\d+)?\]/gi, "").trim();
  const finalNotes = `${cleanNotes} [RECOGIDA_CONFIRMADA:${now}${staffLabel ? `|${staffLabel}` : ""}]`.trim();

  const updatePayload: any = {
    status: "delivered",
    delivered_at: now,
    notes: finalNotes,
    updated_at: now,
  };

  // Actualizar columnas dedicadas de recogida si la tabla las tiene
  if (actorId) updatePayload.pickup_confirmed_by = actorId;
  updatePayload.pickup_confirmed_at = now;

  try {
    await supabase
      .from("restaurant_orders")
      .update(updatePayload)
      .eq("id", orderId)
      .eq("business_id", businessId);
  } catch (err) {
    console.error("[verifyAndConfirmPickup] Error confirmando recogida:", err);
    return { success: false, error: "Error al registrar la confirmación de recogida en la base de datos." };
  }

  await logAuditAction({
    businessId,
    userId: actorId,
    action: "confirm_pickup",
    entityType: "restaurant_order",
    entityId: orderId,
    description: `Recogida del pedido #${order.order_number} confirmada exitosamente con código${staffLabel}.`,
    metadata: { orderId, orderNumber: order.order_number, actorId, actorName },
  });

  return { success: true, isConfirmed: true };
}

