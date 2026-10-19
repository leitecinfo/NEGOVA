import { WhatsAppIncomingEvent, IncomingEventStatus } from "./types";
import { sanitizeLog } from "./security";

export interface EnqueueEventInput {
  businessId: string;
  phoneNumberId: string;
  metaMessageId?: string | null;
  senderPhone: string;
  eventType: "message" | "status" | "interactive" | "unknown";
  payload: Record<string, any>;
  maxAttempts?: number;
}

export interface EnqueueResult {
  success: boolean;
  eventId?: string;
  isDuplicate?: boolean;
  error?: string;
}

export interface QueueMetrics {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  deadLetter: number;
}

/**
 * Servicio de Cola Persistente y Deduplicación en PostgreSQL
 * Diseñado para garantizar:
 * - Persistencia antes de responder al Webhook.
 * - Deduplicación estricta por `meta_message_id` (wamid de Meta).
 * - Bloqueo seguro frente a concurrencia de múltiples trabajadores.
 * - Reintentos con retroceso exponencial y detección de eventos agotados.
 */
export class WhatsAppQueueService {
  /**
   * Encola un evento entrante verificando deduplicación.
   */
  static async enqueue(
    supabaseClient: any,
    input: EnqueueEventInput
  ): Promise<EnqueueResult> {
    try {
      // 1. Deduplicación por metaMessageId si está presente
      if (input.metaMessageId && input.metaMessageId.trim()) {
        const { data: existingEvent, error: checkErr } = await supabaseClient
          .from("whatsapp_incoming_events")
          .select("id, status")
          .eq("business_id", input.businessId)
          .eq("meta_message_id", input.metaMessageId.trim())
          .maybeSingle();

        if (checkErr && !checkErr.message?.includes("not found")) {
          console.error(
            "[WhatsAppQueueService] Error al verificar deduplicación:",
            sanitizeLog(checkErr)
          );
          return {
            success: false,
            error: "Error al verificar la unicidad del evento.",
          };
        }

        if (existingEvent) {
          return {
            success: true,
            eventId: existingEvent.id,
            isDuplicate: true,
          };
        }
      }

      // 2. Inserción duradera en estado 'pending'
      const newEvent = {
        business_id: input.businessId,
        phone_number_id: input.phoneNumberId,
        meta_message_id: input.metaMessageId?.trim() || null,
        sender_phone: input.senderPhone.trim(),
        event_type: input.eventType,
        payload: input.payload,
        status: "pending",
        attempts: 0,
        max_attempts: input.maxAttempts || 3,
        next_attempt_at: new Date().toISOString(),
      };

      const { data, error } = await supabaseClient
        .from("whatsapp_incoming_events")
        .insert(newEvent)
        .select("id")
        .single();

      if (error) {
        // En caso de colisión de clave única por carrera simultánea
        if (
          error.code === "23505" ||
          error.message?.includes("unique") ||
          error.message?.includes("duplicate")
        ) {
          return {
            success: true,
            isDuplicate: true,
          };
        }

        console.error(
          "[WhatsAppQueueService] Error al persistir evento:",
          sanitizeLog(error)
        );
        return {
          success: false,
          error: "No se pudo persistir el evento en la cola duradera.",
        };
      }

      return {
        success: true,
        eventId: data.id,
        isDuplicate: false,
      };
    } catch (err: any) {
      console.error(
        "[WhatsAppQueueService] Excepción en enqueue:",
        sanitizeLog(err?.message || err)
      );
      return {
        success: false,
        error: "Excepción interna al encolar evento.",
      };
    }
  }

  /**
   * Reclama de forma atómica y segura eventos pendientes o abandonados para su procesamiento (QUE-01 y QUE-02).
   * 1. Prioriza la RPC de PostgreSQL `claim_whatsapp_incoming_events` (FOR UPDATE SKIP LOCKED).
   * 2. Recupera eventos en 'processing' cuyo bloqueo haya superado `lockTimeoutSeconds` (por defecto 300s / 5min).
   * 3. Si un evento abandonado alcanzó max_attempts, se envía a 'dead_letter'.
   * 4. Fencing token: registra `locked_by` y `locked_at` atómicamente.
   */
  static async claimNextEvents(
    supabaseClient: any,
    workerId: string,
    batchSize: number = 5,
    lockTimeoutSeconds: number = 300
  ): Promise<WhatsAppIncomingEvent[]> {
    // 1. Intentar ejecución atómica mediante RPC de PostgreSQL si está disponible
    if (typeof supabaseClient.rpc === "function") {
      try {
        const { data: rpcData, error: rpcErr } = await supabaseClient.rpc(
          "claim_whatsapp_incoming_events",
          {
            p_worker_id: workerId,
            p_batch_size: batchSize,
            p_lock_timeout_seconds: lockTimeoutSeconds,
          }
        );

        if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
          return rpcData.map((row: any) => ({
            id: row.id,
            businessId: row.business_id,
            phoneNumberId: row.phone_number_id,
            metaMessageId: row.meta_message_id,
            senderPhone: row.sender_phone,
            eventType: row.event_type,
            payload: row.payload,
            status: row.status as IncomingEventStatus,
            attempts: row.attempts,
            maxAttempts: row.max_attempts,
            lockedAt: row.locked_at,
            lockedBy: row.locked_by,
            nextAttemptAt: row.next_attempt_at,
            lastError: row.last_error,
            processedAt: row.processed_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));
        }
      } catch {
        // En caso de que la función no esté definida en el entorno cliente o mock, ejecutar fallback
      }
    }

    // 2. Fallback / Entorno simulado: Reclamación atómica con control de expiración de bloqueo
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const lockThresholdIso = new Date(now - lockTimeoutSeconds * 1000).toISOString();

    // 2.1 Identificar y enviar a dead_letter eventos en processing cuyo bloqueo expiró o es nulo y ya agotaron sus intentos
    const { data: processingRows } = await supabaseClient
      .from("whatsapp_incoming_events")
      .select("*")
      .eq("status", "processing");

    if (processingRows && Array.isArray(processingRows)) {
      for (const row of processingRows) {
        if (!row.locked_at || row.locked_at <= lockThresholdIso) {
          if (row.attempts >= (row.max_attempts || 3)) {
            await supabaseClient
              .from("whatsapp_incoming_events")
              .update({
                status: "dead_letter",
                locked_by: null,
                locked_at: null,
                last_error: `${row.last_error || ""} [Expiró el bloqueo del worker y se agotaron los intentos]`.trim(),
                updated_at: nowIso,
              })
              .eq("id", row.id)
              .eq("status", "processing");
          }
        }
      }
    }

    // 2.2 Consultar eventos pendientes disponibles
    const { data: pendingCandidates } = await supabaseClient
      .from("whatsapp_incoming_events")
      .select("*")
      .eq("status", "pending")
      .lte("next_attempt_at", nowIso)
      .order("created_at", { ascending: true })
      .limit(batchSize);

    // 2.3 Consultar eventos en processing con bloqueo expirado o nulo recuperables
    const { data: processingCandidates } = await supabaseClient
      .from("whatsapp_incoming_events")
      .select("*")
      .eq("status", "processing")
      .order("created_at", { ascending: true });

    const expiredCandidates = (processingCandidates || []).filter(
      (c: any) =>
        (!c.locked_at || c.locked_at <= lockThresholdIso) &&
        (c.attempts || 0) < (c.max_attempts || 3)
    );

    const candidates = [
      ...(pendingCandidates || []),
      ...expiredCandidates,
    ].slice(0, batchSize);

    if (candidates.length === 0) {
      return [];
    }

    const claimedEvents: WhatsAppIncomingEvent[] = [];

    for (const cand of candidates) {
      const isRecovery = cand.status === "processing";
      const nextAttempts = isRecovery ? (cand.attempts || 0) + 1 : cand.attempts;

      // Bloqueo atómico condicional sobre el estado previo
      const { data: locked, error: lockErr } = await supabaseClient
        .from("whatsapp_incoming_events")
        .update({
          status: "processing",
          locked_at: nowIso,
          locked_by: workerId,
          attempts: nextAttempts,
          updated_at: nowIso,
        })
        .eq("id", cand.id)
        .eq("status", cand.status)
        .select()
        .maybeSingle();

      if (!lockErr && locked) {
        claimedEvents.push({
          id: locked.id,
          businessId: locked.business_id,
          phoneNumberId: locked.phone_number_id,
          metaMessageId: locked.meta_message_id,
          senderPhone: locked.sender_phone,
          eventType: locked.event_type,
          payload: locked.payload,
          status: locked.status as IncomingEventStatus,
          attempts: locked.attempts,
          maxAttempts: locked.max_attempts,
          lockedAt: locked.locked_at,
          lockedBy: locked.locked_by,
          nextAttemptAt: locked.next_attempt_at,
          lastError: locked.last_error,
          processedAt: locked.processed_at,
          createdAt: locked.created_at,
          updatedAt: locked.updated_at,
        });
      }
    }

    return claimedEvents;
  }

  /**
   * Marca un evento como completado con éxito.
   * Aplica FENCING: Requiere que `locked_by` coincida con el trabajador que procesó,
   * impidiendo que un trabajador obsoleto o demorado sobreescriba un evento recuperado por otro.
   */
  static async completeEvent(
    supabaseClient: any,
    eventId: string,
    workerId?: string
  ): Promise<boolean> {
    const nowIso = new Date().toISOString();
    let query = supabaseClient
      .from("whatsapp_incoming_events")
      .update({
        status: "completed",
        locked_by: null,
        locked_at: null,
        processed_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", eventId)
      .eq("status", "processing");

    if (workerId) {
      query = query.eq("locked_by", workerId);
    }

    const { data, error } = await query.select();

    if (error) {
      console.error(
        `[WhatsAppQueueService] Error al completar evento ${eventId}:`,
        sanitizeLog(error)
      );
      return false;
    }

    // Fencing check: si el update no coincidió con ninguna fila, el bloqueo ya no pertenecía a este worker
    if (workerId && Array.isArray(data) && data.length === 0) {
      console.warn(
        `[WhatsAppQueueService] Fencing: se rechazó completar evento ${eventId}; el worker ${workerId} perdió el bloqueo.`
      );
      return false;
    }

    return true;
  }

  /**
   * Comprueba si el bloqueo del worker sobre un evento continúa activo y vigente en PostgreSQL.
   * Debe consultarse antes de disparar efectos externos irreversibles (p. ej. llamadas HTTP a Meta o Gemini).
   */
  static async isLockActive(
    supabaseClient: any,
    eventId: string,
    workerId: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabaseClient
        .from("whatsapp_incoming_events")
        .select("id")
        .eq("id", eventId)
        .eq("status", "processing")
        .eq("locked_by", workerId)
        .maybeSingle();

      return !error && !!data;
    } catch {
      return false;
    }
  }

  /**
   * Registra un fallo en el procesamiento de un evento.
   * Aplica FENCING: Si el bloqueo expiró y otro trabajador tomó el evento, descarta la modificación obsoleta.
   * Aplica retroceso exponencial si es recuperable y quedan intentos disponibles.
   * Si los intentos se agotan o el fallo es irrecuperable, lo marca como 'dead_letter'.
   */
  static async failEvent(
    supabaseClient: any,
    eventId: string,
    currentAttempts: number,
    maxAttempts: number,
    errorMessage: string,
    isRecoverable: boolean = true,
    workerId?: string
  ): Promise<{ status: IncomingEventStatus; nextAttemptAt?: string; fencedOut?: boolean }> {
    const nextAttemptCount = currentAttempts + 1;
    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    const isExhausted = nextAttemptCount >= maxAttempts || !isRecoverable;
    const finalStatus: IncomingEventStatus = isExhausted
      ? "dead_letter"
      : "pending";

    // Retroceso exponencial: base 5 seg * 2^(intentos-1), máx 3600 seg
    const delaySeconds = Math.min(3600, Math.pow(2, nextAttemptCount - 1) * 5);
    const nextAttemptAt = isExhausted
      ? null
      : new Date(now + delaySeconds * 1000).toISOString();

    let query = supabaseClient
      .from("whatsapp_incoming_events")
      .update({
        status: finalStatus,
        attempts: nextAttemptCount,
        locked_by: null,
        locked_at: null,
        last_error: errorMessage.slice(0, 500),
        next_attempt_at: nextAttemptAt,
        updated_at: nowIso,
      })
      .eq("id", eventId)
      .eq("status", "processing");

    if (workerId) {
      query = query.eq("locked_by", workerId);
    }

    const { data, error } = await query.select();

    if (error) {
      console.error(
        `[WhatsAppQueueService] Error al asentar fallo en evento ${eventId}:`,
        sanitizeLog(error)
      );
    }

    // Fencing check
    if (workerId && Array.isArray(data) && data.length === 0) {
      console.warn(
        `[WhatsAppQueueService] Fencing: se rechazó asentar fallo en evento ${eventId}; worker ${workerId} perdió el bloqueo.`
      );
      return {
        status: finalStatus,
        nextAttemptAt: nextAttemptAt || undefined,
        fencedOut: true,
      };
    }

    return {
      status: finalStatus,
      nextAttemptAt: nextAttemptAt || undefined,
      fencedOut: false,
    };
  }

  /**
   * Retorna métricas de observabilidad de la cola.
   */
  static async getQueueMetrics(
    supabaseClient: any,
    businessId?: string
  ): Promise<QueueMetrics> {
    let query = supabaseClient
      .from("whatsapp_incoming_events")
      .select("status");

    if (businessId) {
      query = query.eq("business_id", businessId);
    }

    const { data, error } = await query;
    if (error || !data) {
      return { pending: 0, processing: 0, completed: 0, failed: 0, deadLetter: 0 };
    }

    return {
      pending: data.filter((r: any) => r.status === "pending").length,
      processing: data.filter((r: any) => r.status === "processing").length,
      completed: data.filter((r: any) => r.status === "completed").length,
      failed: data.filter((r: any) => r.status === "failed").length,
      deadLetter: data.filter((r: any) => r.status === "dead_letter").length,
    };
  }
}
