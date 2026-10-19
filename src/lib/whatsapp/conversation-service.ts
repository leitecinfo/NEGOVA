import {
  BusinessWhatsAppConfig,
  WhatsAppConversationStatus,
  isValidConversationTransition,
  WhatsAppMessage,
} from "./types";
import { sanitizeLog } from "./security";

export interface WhatsAppConversationRecord {
  id: string;
  businessId: string;
  customerPhone: string;
  status: WhatsAppConversationStatus;
  unreadMessagesCount: number;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Servicio de Conversaciones y Configuración Multi-Tenant de WhatsApp
 */
export class WhatsAppConversationService {
  /**
   * Resuelve el negocio autorizado a partir del Phone Number ID de Meta.
   * REGLA DE ORO: La asociación tenant se deriva del identificador verificado del número receptor,
   * NUNCA de un parámetro enviado arbitrariamente por el cliente.
   */
  static async resolveBusinessByPhoneNumberId(
    supabaseClient: any,
    phoneNumberId: string
  ): Promise<BusinessWhatsAppConfig | null> {
    if (!phoneNumberId || !phoneNumberId.trim()) {
      return null;
    }

    const { data, error } = await supabaseClient
      .from("business_whatsapp_configs")
      .select("*")
      .eq("phone_number_id", phoneNumberId.trim())
      .eq("status", "active")
      .maybeSingle();

    if (error || !data) {
      if (error) {
        console.warn(
          "[WhatsAppConversationService] Error al resolver Phone Number ID:",
          sanitizeLog(error)
        );
      }
      return null;
    }

    return {
      id: data.id,
      businessId: data.business_id,
      phoneNumberId: data.phone_number_id,
      wabaId: data.waba_id,
      displayPhoneNumber: data.display_phone_number,
      verifiedName: data.verified_name,
      status: data.status,
      aiEnabled: Boolean(data.ai_enabled),
      aiSettings: data.ai_settings,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Obtiene los secretos criptográficos de WhatsApp para un negocio (RLS-01).
   * EXCLUSIVO para uso del servidor (service_role). La tabla business_whatsapp_secrets
   * tiene denegado el acceso a cualquier cliente autenticado u operativo.
   */
  static async getBusinessSecrets(
    supabaseClient: any,
    businessId: string
  ): Promise<{
    businessId: string;
    encryptedAccessToken: string;
    tokenKeyId: string;
    webhookVerifyToken?: string | null;
  } | null> {
    if (!businessId) return null;

    const { data, error } = await supabaseClient
      .from("business_whatsapp_secrets")
      .select("business_id, encrypted_access_token, token_key_id, webhook_verify_token")
      .eq("business_id", businessId)
      .maybeSingle();

    if (error || !data) {
      if (error) {
        console.warn(
          "[WhatsAppConversationService] Error al consultar secretos de WhatsApp:",
          sanitizeLog(error)
        );
      }
      return null;
    }

    return {
      businessId: data.business_id,
      encryptedAccessToken: data.encrypted_access_token,
      tokenKeyId: data.token_key_id,
      webhookVerifyToken: data.webhook_verify_token,
    };
  }

  /**
   * Obtiene o inicializa la conversación de un contacto en un negocio.
   * La máquina de estados inicia siempre en 'ai_active'.
   */
  static async getOrCreateConversation(
    supabaseClient: any,
    businessId: string,
    customerPhone: string
  ): Promise<WhatsAppConversationRecord> {
    const cleanPhone = customerPhone.replace(/[^\d+]/g, "").trim();

    // 1. Buscar si ya existe
    const { data: existing, error: selectErr } = await supabaseClient
      .from("whatsapp_conversations")
      .select("*")
      .eq("business_id", businessId)
      .eq("customer_phone", cleanPhone)
      .maybeSingle();

    if (!selectErr && existing) {
      return {
        id: existing.id,
        businessId: existing.business_id,
        customerPhone: existing.customer_phone,
        status: existing.status as WhatsAppConversationStatus,
        unreadMessagesCount: existing.unread_messages_count || 0,
        lastMessageAt: existing.last_message_at,
        lastMessagePreview: existing.last_message_preview,
        metadata: existing.metadata || {},
        createdAt: existing.created_at,
        updatedAt: existing.updated_at,
      };
    }

    // 2. Si no existe, crear nueva conversación con estado 'ai_active'
    const newConv = {
      business_id: businessId,
      customer_phone: cleanPhone,
      status: "ai_active",
      unread_messages_count: 0,
      metadata: {},
      last_message_at: new Date().toISOString(),
    };

    const { data: created, error: insertErr } = await supabaseClient
      .from("whatsapp_conversations")
      .insert(newConv)
      .select()
      .single();

    if (insertErr || !created) {
      // Manejo de carrera simultánea si ya fue creada por otro evento
      const { data: retry } = await supabaseClient
        .from("whatsapp_conversations")
        .select("*")
        .eq("business_id", businessId)
        .eq("customer_phone", cleanPhone)
        .maybeSingle();

      if (retry) {
        return {
          id: retry.id,
          businessId: retry.business_id,
          customerPhone: retry.customer_phone,
          status: retry.status as WhatsAppConversationStatus,
          unreadMessagesCount: retry.unread_messages_count || 0,
          lastMessageAt: retry.last_message_at,
          lastMessagePreview: retry.last_message_preview,
          metadata: retry.metadata || {},
          createdAt: retry.created_at,
          updatedAt: retry.updated_at,
        };
      }

      throw new Error("No se pudo inicializar la conversación de WhatsApp.");
    }

    return {
      id: created.id,
      businessId: created.business_id,
      customerPhone: created.customer_phone,
      status: created.status as WhatsAppConversationStatus,
      unreadMessagesCount: created.unread_messages_count || 0,
      lastMessageAt: created.last_message_at,
      lastMessagePreview: created.last_message_preview,
      metadata: created.metadata || {},
      createdAt: created.created_at,
      updatedAt: created.updated_at,
    };
  }

  /**
   * Actualiza el estado de la conversación validando la máquina de estados.
   * La pausa o reactivación de la IA es ESTRICTAMENTE por conversación individual.
   */
  static async updateConversationStatus(
    supabaseClient: any,
    businessId: string,
    conversationId: string,
    nextStatus: WhatsAppConversationStatus
  ): Promise<{ success: boolean; error?: string; status?: WhatsAppConversationStatus }> {
    // 1. Consultar estado actual
    const { data: current, error: getErr } = await supabaseClient
      .from("whatsapp_conversations")
      .select("status, business_id")
      .eq("id", conversationId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (getErr || !current) {
      return { success: false, error: "Conversación no encontrada en este comercio." };
    }

    const currentStatus = current.status as WhatsAppConversationStatus;

    // 2. Validar transición permitida
    if (!isValidConversationTransition(currentStatus, nextStatus)) {
      return {
        success: false,
        error: `Transición de estado inválida de «${currentStatus}» a «${nextStatus}».`,
      };
    }

    // 3. Persistir nuevo estado
    const nowIso = new Date().toISOString();
    const { error: updateErr } = await supabaseClient
      .from("whatsapp_conversations")
      .update({
        status: nextStatus,
        updated_at: nowIso,
      })
      .eq("id", conversationId)
      .eq("business_id", businessId);

    if (updateErr) {
      return { success: false, error: "Error al actualizar el estado de la conversación." };
    }

    return { success: true, status: nextStatus };
  }

  /**
   * Persiste un mensaje recibido y actualiza la vista previa de la conversación.
   */
  static async persistIncomingMessage(
    supabaseClient: any,
    businessId: string,
    conversationId: string,
    message: {
      metaMessageId?: string | null;
      content: string;
      messageType?: string;
      rawPayload?: Record<string, any>;
    }
  ): Promise<{ success: boolean; messageId?: string; isDuplicate?: boolean }> {
    // Verificar si el metaMessageId ya fue registrado
    if (message.metaMessageId) {
      const { data: existing } = await supabaseClient
        .from("whatsapp_messages")
        .select("id")
        .eq("meta_message_id", message.metaMessageId)
        .maybeSingle();

      if (existing) {
        return { success: true, messageId: existing.id, isDuplicate: true };
      }
    }

    const newMsg = {
      conversation_id: conversationId,
      business_id: businessId,
      meta_message_id: message.metaMessageId || null,
      direction: "inbound",
      sender_role: "customer",
      message_type: message.messageType || "text",
      content: message.content,
      raw_payload: message.rawPayload || {},
    };

    const { data: inserted, error: insErr } = await supabaseClient
      .from("whatsapp_messages")
      .insert(newMsg)
      .select("id")
      .single();

    if (insErr) {
      if (insErr.code === "23505" || insErr.message?.includes("duplicate")) {
        return { success: true, isDuplicate: true };
      }
      return { success: false };
    }

    // Actualizar vista previa de la conversación
    await supabaseClient
      .from("whatsapp_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: message.content.slice(0, 100),
      })
      .eq("id", conversationId)
      .eq("business_id", businessId);

    return { success: true, messageId: inserted.id, isDuplicate: false };
  }

  /**
   * Persiste un mensaje saliente (IA, agente humano o sistema) y actualiza la conversación.
   */
  static async persistOutgoingMessage(
    supabaseClient: any,
    businessId: string,
    conversationId: string,
    message: {
      content: string;
      senderRole?: "ai" | "human_agent" | "system";
      messageType?: string;
      metaMessageId?: string | null;
      rawPayload?: Record<string, any>;
    }
  ): Promise<{ success: boolean; messageId?: string }> {
    const newMsg = {
      conversation_id: conversationId,
      business_id: businessId,
      meta_message_id: message.metaMessageId || null,
      direction: "outbound",
      sender_role: message.senderRole || "ai",
      message_type: message.messageType || "text",
      content: message.content,
      raw_payload: message.rawPayload || {},
    };

    const { data: inserted, error: insErr } = await supabaseClient
      .from("whatsapp_messages")
      .insert(newMsg)
      .select("id")
      .single();

    if (insErr || !inserted) {
      console.error(
        "[WhatsAppConversationService] Error al persistir mensaje saliente:",
        sanitizeLog(insErr)
      );
      return { success: false };
    }

    // Actualizar vista previa de la conversación
    await supabaseClient
      .from("whatsapp_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: message.content.slice(0, 100),
      })
      .eq("id", conversationId)
      .eq("business_id", businessId);

    return { success: true, messageId: inserted.id };
  }

  /**
   * Obtiene el historial reciente de mensajes de una conversación en orden cronológico.
   */
  static async getConversationHistory(
    supabaseClient: any,
    businessId: string,
    conversationId: string,
    limit: number = 8
  ): Promise<Array<{ id: string; senderRole: string; direction: string; content: string; createdAt: string }>> {
    const { data, error } = await supabaseClient
      .from("whatsapp_messages")
      .select("id, sender_role, direction, content, created_at")
      .eq("business_id", businessId)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data
      .map((m: any) => ({
        id: m.id,
        senderRole: m.sender_role,
        direction: m.direction,
        content: m.content,
        createdAt: m.created_at,
      }))
      .reverse();
  }
}
