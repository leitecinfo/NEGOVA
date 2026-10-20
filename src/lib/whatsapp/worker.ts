import { WhatsAppQueueService } from "./queue-service";
import { WhatsAppConversationService } from "./conversation-service";
import { WhatsAppAiService } from "./ai-service";
import { WhatsAppIncomingEvent, canAiRespond } from "./types";
import { sanitizeLog } from "./security";

export interface WorkerBatchResult {
  claimed: number;
  completed: number;
  failed: number;
  deadLetter: number;
  fencedOut?: number;
}

/**
 * Clasificador de errores del Trabajador (WRK-01).
 * Distingue explícitamente entre fallos temporales/recuperables (red, bloqueos, rate-limits)
 * y errores permanentes (validación, datos corruptos, violación de esquemas).
 * REGLA: Nunca marca todos los errores como recuperables por defecto.
 */
export function classifyWorkerError(err: any): { isRecoverable: boolean; category: string } {
  if (!err) {
    return { isRecoverable: false, category: "UNKNOWN" };
  }

  const message = (typeof err === "string" ? err : err.message || "").toLowerCase();
  const code = err.code ? String(err.code).toLowerCase() : "";

  // 1. Errores permanentes / no recuperables (Ir directo a dead_letter o fencing)
  if (
    message.includes("perdió la propiedad del bloqueo") ||
    message.includes("perdió el bloqueo") ||
    message.includes("malformado") ||
    message.includes("invalid") ||
    message.includes("inválid") ||
    message.includes("no reconocido") ||
    message.includes("no encontrado") ||
    message.includes("not found") ||
    message.includes("unrecognized") ||
    message.includes("syntaxerror") ||
    message.includes("typeerror") ||
    code === "23502" || // not_null_violation
    code === "23503" || // foreign_key_violation
    code === "23514" || // check_violation
    code === "22p02"    // invalid_text_representation
  ) {
    const category = message.includes("bloqueo")
      ? "FENCED_OUT_STALE_LOCK"
      : "PERMANENT_VALIDATION_ERROR";
    return { isRecoverable: false, category };
  }

  // 2. Errores temporales / recuperables (Reintentar con retroceso exponencial)
  if (
    message.includes("timeout") ||
    message.includes("etimedout") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("network") ||
    message.includes("temporaly") ||
    message.includes("temporal") ||
    message.includes("rate limit") ||
    message.includes("429") ||
    message.includes("503") ||
    code === "40001" || // serialization_failure
    code === "40p01" || // deadlock_detected
    code === "55p03"    // lock_not_available
  ) {
    return { isRecoverable: true, category: "TRANSIENT_NETWORK_OR_LOCK_ERROR" };
  }

  // Por defecto, fallos no clasificados van como no recuperables para no bloquear la cola
  return { isRecoverable: false, category: "NON_RECOVERABLE_APPLICATION_ERROR" };
}

/**
 * Trabajador Asíncrono de Eventos de WhatsApp (Worker)
 * Diseñado para procesar lotes de forma segura, concurrente e idempotente.
 */
export class WhatsAppWorker {
  public readonly workerId: string;

  constructor(workerId?: string) {
    this.workerId =
      workerId || `worker_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }

  /**
   * Ejecuta una ronda de procesamiento sobre los eventos en cola.
   * Utiliza fencing para evitar sobreescritura de bloqueos vencidos.
   */
  async processBatch(
    supabaseClient: any,
    batchSize: number = 5
  ): Promise<WorkerBatchResult> {
    const result: WorkerBatchResult = {
      claimed: 0,
      completed: 0,
      failed: 0,
      deadLetter: 0,
      fencedOut: 0,
    };

    // 1. Reclamar eventos atómicamente
    const events = await WhatsAppQueueService.claimNextEvents(
      supabaseClient,
      this.workerId,
      batchSize
    );

    result.claimed = events.length;
    if (events.length === 0) {
      return result;
    }

    // 2. Procesar cada evento reclamado
    for (const event of events) {
      try {
        await this.processSingleEvent(supabaseClient, event);

        // Completar con fencing del workerId
        const completedOk = await WhatsAppQueueService.completeEvent(
          supabaseClient,
          event.id,
          this.workerId
        );

        if (completedOk) {
          result.completed++;
        } else {
          result.fencedOut = (result.fencedOut || 0) + 1;
        }
      } catch (err: any) {
        console.error(
          `[WhatsAppWorker] Error al procesar evento ${event.id}:`,
          sanitizeLog(err?.message || err)
        );

        const { isRecoverable } = classifyWorkerError(err);

        const failResult = await WhatsAppQueueService.failEvent(
          supabaseClient,
          event.id,
          event.attempts,
          event.maxAttempts,
          err?.message || "Error en el trabajador",
          isRecoverable,
          this.workerId
        );

        if (failResult.fencedOut) {
          result.fencedOut = (result.fencedOut || 0) + 1;
        } else if (failResult.status === "dead_letter") {
          result.deadLetter++;
        } else {
          result.failed++;
        }
      }
    }

    return result;
  }

  /**
   * Procesa un evento individual respetando el aislamiento multi-tenant y la máquina de estados.
   */
  private async processSingleEvent(
    supabaseClient: any,
    event: WhatsAppIncomingEvent
  ): Promise<void> {
    // 0. Pre-fencing: verificar que este worker aún posee el bloqueo antes de cualquier mutación o efecto
    const isLockHeld = await WhatsAppQueueService.isLockActive(
      supabaseClient,
      event.id,
      this.workerId
    );
    if (!isLockHeld) {
      throw new Error(`Worker ${this.workerId} perdió la propiedad del bloqueo sobre el evento ${event.id}`);
    }

    // Manejo de eventos de estado de entrega de Meta (WHK-02)
    if (event.eventType === "status") {
      await this.processStatusEvent(supabaseClient, event);
      return;
    }

    const { businessId, senderPhone, payload, metaMessageId } = event;

    // 1. Validar o crear la conversación para este negocio y teléfono
    const conversation = await WhatsAppConversationService.getOrCreateConversation(
      supabaseClient,
      businessId,
      senderPhone
    );

    // 2. Extraer texto o contenido del payload
    let textContent = "";
    let messageType = "text";

    if (payload.text?.body) {
      textContent = payload.text.body;
      messageType = "text";
    } else if (payload.interactive?.button_reply?.title) {
      textContent = payload.interactive.button_reply.title;
      messageType = "interactive";
    } else if (payload.interactive?.list_reply?.title) {
      textContent = payload.interactive.list_reply.title;
      messageType = "interactive";
    } else if (payload.type) {
      messageType = payload.type;
      textContent = `[Mensaje tipo: ${payload.type}]`;
    } else {
      textContent = "[Mensaje sin contenido legible]";
    }

    // 3. Persistir el mensaje de forma duradera
    await WhatsAppConversationService.persistIncomingMessage(
      supabaseClient,
      businessId,
      conversation.id,
      {
        metaMessageId,
        content: textContent,
        messageType,
        rawPayload: payload,
      }
    );

    // 4. Evaluar estado de atención
    if (!canAiRespond(conversation.status)) {
      return;
    }

    // 5. Verificar si la IA está activa en la configuración del comercio
    const { data: config } = await supabaseClient
      .from("business_whatsapp_configs")
      .select("ai_enabled, verified_name")
      .eq("business_id", businessId)
      .maybeSingle();

    if (config && config.ai_enabled === false) {
      return;
    }

    // 6. Generar y registrar respuesta de la IA con catálogo y reglas de atención
    await WhatsAppAiService.processIncomingMessage(supabaseClient, {
      businessId,
      conversationId: conversation.id,
      customerPhone: senderPhone,
      incomingText: textContent,
      businessName: config?.verified_name || undefined,
    });
  }

  /**
   * Procesa un evento de estado de entrega de Meta (WHK-02).
   * Solo asocia el estado si existe un identificador wamid verificable en la base de datos.
   */
  private async processStatusEvent(
    supabaseClient: any,
    event: WhatsAppIncomingEvent
  ): Promise<void> {
    // Pre-fencing: verificar propiedad del bloqueo antes de actualizar estado de mensajes
    const isLockHeld = await WhatsAppQueueService.isLockActive(
      supabaseClient,
      event.id,
      this.workerId
    );
    if (!isLockHeld) {
      throw new Error(`Worker ${this.workerId} perdió la propiedad del bloqueo sobre el evento ${event.id}`);
    }

    const metaMessageId =
      event.payload?.id ||
      (event.metaMessageId?.startsWith("status:")
        ? event.metaMessageId.split(":")[1]
        : event.metaMessageId);
    const status = event.payload?.status;

    if (!metaMessageId || !status) {
      return;
    }

    const { data: existingMsg } = await supabaseClient
      .from("whatsapp_messages")
      .select("id, raw_payload")
      .eq("meta_message_id", metaMessageId)
      .maybeSingle();

    if (existingMsg) {
      const updatedPayload = {
        ...(existingMsg.raw_payload || {}),
        delivery_status: status,
        status_updated_at: new Date().toISOString(),
        status_payload: event.payload,
      };

      await supabaseClient
        .from("whatsapp_messages")
        .update({ raw_payload: updatedPayload })
        .eq("id", existingMsg.id);
    }
  }
}
