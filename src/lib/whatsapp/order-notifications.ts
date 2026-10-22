import { WhatsAppQueueService } from "./queue-service";

export interface OrderNotificationPayload {
  orderId: string;
  orderNumber: number;
  total: number;
  orderType: string;
  channelOrigin: string;
  tableName?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  deliveryReference?: string | null;
  notes?: string | null;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    modifiers?: any[];
  }>;
}

/**
 * Encola de manera asíncrona y segura una notificación de pedido nuevo hacia el WhatsApp del negocio.
 * - No bloquea la creación del pedido si WhatsApp falla o no está configurado.
 * - Respeta aislamiento estricto multi-tenant por businessId.
 * - Utiliza WhatsAppQueueService para persistencia en cola duradera de PostgreSQL.
 * - REGLA DE NEGOCIO OBLIGATORIA: Los pedidos en modalidad "En mesa" (dine_in) se operan
 *   internamente en el panel de Pedidos / Cocina de NEGOVA y el personal debe confirmar o
 *   rechazar la comanda antes de preparación. NO se envían notificaciones de WhatsApp para dine_in.
 * - Las modalidades "takeout" (Recogida) y "delivery" (Domicilio) sí encolan y envían la notificación al negocio.
 */
export async function enqueueOrderWhatsAppNotification(
  supabase: any,
  businessId: string,
  payload: OrderNotificationPayload
): Promise<{ enqueued: boolean; error?: string }> {
  try {
    // 0. Regla por modalidad: "dine_in" NO genera ni encola notificaciones de WhatsApp
    if (payload.orderType === "dine_in") {
      return { enqueued: false };
    }

    // 1. Consultar si el comercio tiene integración de WhatsApp activa
    const { data: config, error: configErr } = await supabase
      .from("business_whatsapp_configs")
      .select("phone_number_id, status")
      .eq("business_id", businessId)
      .maybeSingle();

    if (configErr || !config || config.status !== "active") {
      // Si el comercio no tiene configurado WhatsApp Business API o no está activo, no fallamos
      return { enqueued: false };
    }

    // 2. Construir mensaje legible para la notificación (solo takeout o delivery)
    const typeLabel =
      payload.orderType === "takeout"
        ? "Recogida en local"
        : "Domicilio";

    const itemsSummary = payload.items
      .map((it) => `• ${it.quantity}x ${it.productName} ($${it.subtotal.toLocaleString("es-CO")})`)
      .join("\n");

    const textContent =
      `🔔 *NUEVO PEDIDO #${payload.orderNumber} RECIBIDO*\n\n` +
      `*Modalidad:* ${typeLabel}\n` +
      (payload.customerName ? `*Cliente:* ${payload.customerName}\n` : "") +
      (payload.customerPhone ? `*Teléfono:* ${payload.customerPhone}\n` : "") +
      (payload.deliveryAddress ? `*Dirección:* ${payload.deliveryAddress}\n` : "") +
      `*Total:* $${payload.total.toLocaleString("es-CO")}\n\n` +
      `*Detalle:*\n${itemsSummary}\n` +
      (payload.notes ? `\n*Notas:* ${payload.notes}` : "");

    // 3. Encolar evento persistente en whatsapp_incoming_events
    const res = await WhatsAppQueueService.enqueue(supabase, {
      businessId,
      phoneNumberId: config.phone_number_id,
      senderPhone: payload.customerPhone || "system",
      eventType: "interactive",
      metaMessageId: `order-notif-${payload.orderId}`,
      payload: {
        type: "order_notification",
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        text: textContent,
        rawPayload: payload,
      },
    });

    return { enqueued: res.success };
  } catch (err: any) {
    // Falla de notificación externa no aborta el flujo comercial
    console.warn("[enqueueOrderWhatsAppNotification] Advertencia al encolar:", err?.message);
    return { enqueued: false, error: err?.message };
  }
}
