import { WhatsAppQueueService } from "./queue-service";
import { WhatsAppConversationService } from "./conversation-service";
import { WhatsAppWorker } from "./worker";
import { sanitizeLog } from "./security";

export interface SimulateMessageOptions {
  businessId: string;
  senderPhone?: string;
  senderName?: string;
  phoneNumberId?: string;
  text: string;
  metaMessageId?: string;
  timestamp?: number;
  processImmediately?: boolean;
  workerId?: string;
}

export interface SimulationResult {
  success: boolean;
  eventId?: string;
  isDuplicate: boolean;
  metaMessageId: string;
  conversationId?: string;
  conversationStatus?: string;
  incomingMessage?: {
    id: string;
    content: string;
    senderRole: string;
    createdAt: string;
  } | null;
  outgoingResponse?: {
    id: string;
    content: string;
    senderRole: string;
    createdAt: string;
  } | null;
  createdOrder?: any | null;
  error?: string;
}

/**
 * Simulador de Mensajes Entrantes de WhatsApp para Pruebas Internas (Fase 2).
 * Permite simular la recepción de un mensaje con estructura idéntica a Meta WhatsApp Cloud API
 * SIN necesidad de cuenta de Meta, número real ni webhook público expuesto.
 *
 * Principios:
 * 1. Usa identificadores ficticios exclusivos de prueba ('wamid.test_...').
 * 2. Entra SIEMPRE por el flujo interno real (Cola persistente -> Deduplicación -> Worker -> Conversación -> IA/POS).
 * 3. NO se salta ninguna regla de persistencia ni de negocio.
 * 4. Protegido para entornos de prueba y desarrollo.
 */
export class WhatsAppSimulator {
  /**
   * Simula la recepción de un mensaje de WhatsApp y opcionalmente ejecuta su procesamiento.
   */
  static async simulateIncomingMessage(
    supabaseClient: any,
    options: SimulateMessageOptions
  ): Promise<SimulationResult> {
    const {
      businessId,
      senderPhone = "573009990001",
      senderName = "Cliente de Prueba QA",
      text,
      timestamp = Math.floor(Date.now() / 1000),
      processImmediately = true,
      workerId = `sim_worker_${Date.now()}`,
    } = options;

    if (!businessId || !businessId.trim()) {
      return {
        success: false,
        isDuplicate: false,
        metaMessageId: "",
        error: "El parámetro businessId es obligatorio.",
      };
    }

    if (!text || !text.trim()) {
      return {
        success: false,
        isDuplicate: false,
        metaMessageId: "",
        error: "El texto del mensaje no puede estar vacío.",
      };
    }

    // 1. Resolver o generar Phone Number ID para el comercio
    let resolvedPhoneId = options.phoneNumberId;
    if (!resolvedPhoneId) {
      const { data: config } = await supabaseClient
        .from("business_whatsapp_configs")
        .select("phone_number_id")
        .eq("business_id", businessId)
        .maybeSingle();

      resolvedPhoneId = config?.phone_number_id || `phone_test_${businessId.slice(0, 8)}`;
    }

    // 2. Generar identificador ficticio determinista o aleatorio de Meta
    const metaMessageId =
      options.metaMessageId ||
      `wamid.test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // 3. Estructurar payload simulado fiel a la especificación de Meta
    const simulatedMetaPayload = {
      from: senderPhone,
      id: metaMessageId,
      timestamp: String(timestamp),
      text: {
        body: text.trim(),
      },
      type: "text",
      _simulated: true,
      _simulated_profile: {
        name: senderName,
      },
    };

    // 4. Encolar mediante el servicio de cola existente (Garantiza persistencia duradera y deduplicación)
    const enqueueResult = await WhatsAppQueueService.enqueue(supabaseClient, {
      businessId,
      phoneNumberId: resolvedPhoneId || "simulated_phone_id",
      metaMessageId,
      senderPhone,
      eventType: "message",
      payload: simulatedMetaPayload,
    });

    if (!enqueueResult.success && !enqueueResult.isDuplicate) {
      return {
        success: false,
        isDuplicate: false,
        metaMessageId,
        error: enqueueResult.error || "Falló la persistencia en la cola de eventos.",
      };
    }

    const eventId = enqueueResult.eventId;
    const isDuplicate = Boolean(enqueueResult.isDuplicate);

    // Si ya era duplicado, no procesar doble
    if (isDuplicate) {
      return {
        success: true,
        eventId,
        isDuplicate: true,
        metaMessageId,
      };
    }

    // 5. Si se solicitó procesamiento inmediato (sincrónico para pruebas)
    if (processImmediately && eventId) {
      try {
        const worker = new WhatsAppWorker(workerId);
        // Procesar hasta que este evento en particular sea completado o se agote la cola
        for (let round = 0; round < 10; round++) {
          const batch = await worker.processBatch(supabaseClient, 5);
          const { data: currentEvent } = await supabaseClient
            .from("whatsapp_incoming_events")
            .select("status")
            .eq("id", eventId)
            .maybeSingle();

          if (
            !currentEvent ||
            currentEvent.status === "completed" ||
            currentEvent.status === "failed" ||
            currentEvent.status === "dead_letter"
          ) {
            break;
          }

          if (batch.claimed === 0) {
            break;
          }
        }
      } catch (workerErr: any) {
        console.error(
          "[WhatsAppSimulator] Error durante el procesamiento del worker:",
          sanitizeLog(workerErr)
        );
      }
    }

    // 6. Consultar estado resultante de la conversación y mensajes generados
    let conversationData: any = null;
    let incomingMsg: any = null;
    let outgoingMsg: any = null;
    let createdOrder: any = null;

    try {
      const { data: conv } = await supabaseClient
        .from("whatsapp_conversations")
        .select("*")
        .eq("business_id", businessId)
        .eq("customer_phone", senderPhone)
        .maybeSingle();

      if (conv) {
        conversationData = conv;

        // Consultar mensaje entrante
        const { data: inMsg } = await supabaseClient
          .from("whatsapp_messages")
          .select("id, content, sender_role, created_at")
          .eq("conversation_id", conv.id)
          .eq("direction", "inbound")
          .eq("meta_message_id", metaMessageId)
          .maybeSingle();

        if (inMsg) {
          incomingMsg = {
            id: inMsg.id,
            content: inMsg.content,
            senderRole: inMsg.sender_role,
            sender_role: inMsg.sender_role,
            createdAt: inMsg.created_at,
          };
        }

        // Consultar última respuesta de la IA (saliente) posterior a este mensaje
        const { data: outMsgs } = await supabaseClient
          .from("whatsapp_messages")
          .select("id, content, sender_role, created_at, raw_payload")
          .eq("conversation_id", conv.id)
          .eq("direction", "outbound")
          .order("created_at", { ascending: false })
          .limit(1);

        if (outMsgs && outMsgs.length > 0) {
          outgoingMsg = {
            id: outMsgs[0].id,
            content: outMsgs[0].content,
            senderRole: outMsgs[0].sender_role,
            sender_role: outMsgs[0].sender_role,
            createdAt: outMsgs[0].created_at,
            rawPayload: outMsgs[0].raw_payload,
          };

          if (outMsgs[0].raw_payload?.created_order_id) {
            const { data: order } = await supabaseClient
              .from("restaurant_orders")
              .select("id, order_number, total, status, payment_status, channel_origin")
              .eq("id", outMsgs[0].raw_payload.created_order_id)
              .maybeSingle();

            createdOrder = order;
          }
        }
      }
    } catch (queryErr: any) {
      console.warn("[WhatsAppSimulator] Advertencia al consultar resultados:", queryErr);
    }

    return {
      success: true,
      eventId,
      isDuplicate: false,
      metaMessageId,
      conversationId: conversationData?.id,
      conversationStatus: conversationData?.status,
      incomingMessage: incomingMsg,
      outgoingResponse: outgoingMsg,
      createdOrder,
    };
  }
}
