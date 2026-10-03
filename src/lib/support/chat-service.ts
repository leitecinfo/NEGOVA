/**
 * SERVICIO CANÓNICO DE CHAT DE SOPORTE EN TIEMPO REAL E IA DE NEGOVA
 * 
 * Persistencia: PostgreSQL (support_conversations, support_chat_messages)
 * 
 * Capacidades:
 * 1. Conversación multi-turno aislada por tenant (businessId, userId).
 * 2. Control estricto de Modo IA vs Modo Humano.
 * 3. Escalación de IA a Agente Humano con notificación interna y correo sin desconectar a la IA preventivamente.
 * 4. Integración canónica con Atenciones (ATN-XXXX) y Tickets (TCK-XXXX).
 * 5. Despacho de notificaciones transversales (scope: platform) y correo vía Resend.
 */

import { GoogleGenAI } from "@google/genai";
import { queryNegovaKnowledge } from "@/lib/negova-knowledge";
import {
  SupportConversation,
  SupportChatMessage,
  ConversationStatus,
  ConversationMode,
  MessageSenderRole,
} from "./types";
import { createSupportInteraction, createSupportTicket } from "./support-service";
import { createNotification } from "@/lib/notifications/notifications-service";
import { sendSupportEscalationEmail } from "@/lib/email/resend";

let inMemoryConversations: SupportConversation[] = [];
const inMemoryMessages: Map<string, SupportChatMessage[]> = new Map();

async function getSupabaseAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (serviceKey && supabaseUrl) {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    return createAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  const { createClient } = await import("@/lib/supabase/server");
  return await createClient();
}

function mapRowToConversation(row: any): SupportConversation {
  return {
    id: row.id,
    conversationNumber: row.conversation_number || row.conversationNumber,
    businessId: row.business_id || row.businessId,
    businessName: row.business_name || row.businessName || "",
    businessSlug: row.business_slug || row.businessSlug || "",
    userId: row.user_id || row.userId,
    userName: row.user_name || row.userName || "",
    userEmail: row.user_email || row.userEmail || null,
    userPhone: row.user_phone || row.userPhone || null,
    status: (row.status as ConversationStatus) || "active",
    mode: (row.mode as ConversationMode) || "ai",
    assignedAgentId: row.assigned_agent_id || row.assignedAgentId || null,
    assignedAgentName: row.assigned_agent_name || row.assignedAgentName || null,
    subject: row.subject || "Consulta general de soporte",
    lastMessageAt: row.last_message_at || row.lastMessageAt || new Date().toISOString(),
    lastMessagePreview: row.last_message_preview || row.lastMessagePreview || "",
    unreadCountAdmin: Number(row.unread_count_admin ?? row.unreadCountAdmin ?? 0),
    unreadCountClient: Number(row.unread_count_client ?? row.unreadCountClient ?? 0),
    interactionId: row.interaction_id || row.interactionId || null,
    ticketId: row.ticket_id || row.ticketId || null,
    aiContext: row.ai_context || row.aiContext || {},
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
    resolvedAt: row.resolved_at || row.resolvedAt || null,
  };
}

function mapRowToMessage(row: any): SupportChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id || row.conversationId,
    senderRole: row.sender_role || row.senderRole,
    senderId: row.sender_id || row.senderId,
    senderName: row.sender_name || row.senderName,
    content: row.content,
    suggestedActions: row.suggested_actions || row.suggestedActions,
    readByAdmin: !!(row.read_by_admin ?? row.readByAdmin),
    readByClient: !!(row.read_by_client ?? row.readByClient),
    isInternalNote: !!(row.is_internal_note ?? row.isInternalNote),
    metadata: row.metadata || {},
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
  };
}

/**
 * 1. Obtiene todas las conversaciones de soporte desde PostgreSQL (con cache en memoria)
 */
export async function getConversationsList(params: {
  status?: string;
  businessId?: string;
  assignedAgentId?: string;
  mode?: string;
  search?: string;
} = {}): Promise<SupportConversation[]> {
  try {
    const admin = await getSupabaseAdminClient();
    const { data, error } = await admin
      .from("support_conversations")
      .select("*")
      .order("last_message_at", { ascending: false });

    let convs: SupportConversation[] = [];

    if (!error && Array.isArray(data)) {
      convs = data.map(mapRowToConversation);
      inMemoryConversations = convs;
    } else {
      // Fallback a inMemoryConversations si hay delay de conexión
      convs = inMemoryConversations;
    }

    let filtered = [...convs];

    if (params.status && params.status !== "all") {
      filtered = filtered.filter((c) => c.status === params.status);
    }

    if (params.businessId && params.businessId !== "all") {
      filtered = filtered.filter((c) => c.businessId === params.businessId);
    }

    if (params.mode && params.mode !== "all") {
      filtered = filtered.filter((c) => c.mode === params.mode);
    }

    if (params.assignedAgentId) {
      filtered = filtered.filter((c) => c.assignedAgentId === params.assignedAgentId);
    }

    if (params.search && params.search.trim()) {
      const q = params.search.toLowerCase().trim();
      filtered = filtered.filter(
        (c) =>
          c.conversationNumber.toLowerCase().includes(q) ||
          c.businessName.toLowerCase().includes(q) ||
          c.userName.toLowerCase().includes(q) ||
          c.lastMessagePreview.toLowerCase().includes(q)
      );
    }

    filtered.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    return filtered;
  } catch (err) {
    console.error("Error al obtener conversaciones de soporte:", err);
    return inMemoryConversations;
  }
}

/**
 * Guarda o actualiza una conversación en PostgreSQL y memoria
 */
async function saveConversation(conv: SupportConversation): Promise<boolean> {
  const idx = inMemoryConversations.findIndex((c) => c.id === conv.id);
  if (idx >= 0) {
    inMemoryConversations[idx] = conv;
  } else {
    inMemoryConversations.unshift(conv);
  }

  try {
    const admin = await getSupabaseAdminClient();
    const dbPayload = {
      id: conv.id,
      conversation_number: conv.conversationNumber,
      business_id: conv.businessId && conv.businessId.includes("-") ? conv.businessId : null,
      business_name: conv.businessName,
      business_slug: conv.businessSlug,
      user_id: conv.userId && conv.userId.length > 20 ? conv.userId : null,
      user_name: conv.userName,
      user_email: conv.userEmail,
      user_phone: conv.userPhone,
      status: conv.status,
      mode: conv.mode,
      assigned_agent_id: conv.assignedAgentId,
      assigned_agent_name: conv.assignedAgentName,
      subject: conv.subject,
      last_message_at: conv.lastMessageAt,
      last_message_preview: conv.lastMessagePreview,
      unread_count_admin: conv.unreadCountAdmin,
      unread_count_client: conv.unreadCountClient,
      interaction_id: conv.interactionId,
      ticket_id: conv.ticketId,
      ai_context: conv.aiContext,
      updated_at: new Date().toISOString(),
      resolved_at: conv.resolvedAt,
    };

    const { error } = await admin
      .from("support_conversations")
      .upsert(dbPayload, { onConflict: "id" });

    if (error) {
      console.warn("Aviso al guardar en support_conversations:", error.message);
    }
    return !error;
  } catch (err) {
    return true;
  }
}

/**
 * 2. Guarda un mensaje en PostgreSQL y memoria
 */
async function saveMessage(message: SupportChatMessage): Promise<boolean> {
  const current = inMemoryMessages.get(message.conversationId) || [];
  inMemoryMessages.set(message.conversationId, [...current, message]);

  try {
    const admin = await getSupabaseAdminClient();
    const dbPayload = {
      id: message.id,
      conversation_id: message.conversationId,
      sender_role: message.senderRole,
      sender_id: message.senderId,
      sender_name: message.senderName,
      content: message.content,
      suggested_actions: message.suggestedActions || null,
      read_by_admin: message.readByAdmin,
      read_by_client: message.readByClient,
      is_internal_note: message.isInternalNote,
      metadata: message.metadata || {},
      created_at: message.createdAt,
    };

    const { error } = await admin
      .from("support_chat_messages")
      .upsert(dbPayload, { onConflict: "id" });

    if (error) {
      console.warn("Aviso al guardar en support_chat_messages:", error.message);
    }
    return !error;
  } catch (err) {
    return true;
  }
}

/**
 * 3. Obtiene o crea la conversación activa para un usuario de un negocio
 */
export async function getOrCreateActiveConversation(data: {
  businessId: string;
  businessName: string;
  businessSlug?: string;
  userId: string;
  userName: string;
  userEmail?: string | null;
  userPhone?: string | null;
  planId?: string;
}): Promise<SupportConversation> {
  const all = await getConversationsList();
  
  // Buscar conversación activa o en espera para este usuario y negocio
  const existing = all.find(
    (c) =>
      c.businessId === data.businessId &&
      c.userId === data.userId &&
      ["active", "waiting_agent", "with_agent"].includes(c.status)
  );

  if (existing) {
    return existing;
  }

  // Crear nueva conversación
  const count = all.length + 1;
  const convNumber = `CHT-${String(count).padStart(4, "0")}`;

  const newConv: SupportConversation = {
    id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    conversationNumber: convNumber,
    businessId: data.businessId,
    businessName: data.businessName,
    businessSlug: data.businessSlug || data.businessName.toLowerCase().replace(/\s+/g, "-"),
    userId: data.userId,
    userName: data.userName,
    userEmail: data.userEmail || null,
    userPhone: data.userPhone || null,
    status: "active",
    mode: "ai",
    assignedAgentId: null,
    assignedAgentName: null,
    subject: "Consulta general de soporte",
    lastMessageAt: new Date().toISOString(),
    lastMessagePreview: "Conversación iniciada con la IA de Soporte NEGOVA",
    unreadCountAdmin: 0,
    unreadCountClient: 0,
    interactionId: null,
    ticketId: null,
    aiContext: {
      planId: data.planId || "inicio",
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveConversation(newConv);

  // Mensaje de bienvenida inicial de la IA
  const welcomeMsg: SupportChatMessage = {
    id: `msg-welcome-${Date.now()}`,
    conversationId: newConv.id,
    senderRole: "ai",
    senderId: "negova-ai",
    senderName: "IA de Soporte NEGOVA",
    content: `¡Hola ${data.userName}! 👋 Soy el Asistente de Soporte de NEGOVA para **${data.businessName}**. ¿En qué puedo orientarte hoy sobre ventas, inventario, caja o reportes? Si requieres atención de un asesor en cualquier momento, solo indícalo.`,
    readByAdmin: true,
    readByClient: true,
    createdAt: new Date().toISOString(),
  };

  await saveMessage(welcomeMsg);
  return newConv;
}

/**
 * 4. Obtiene los mensajes de una conversación
 */
export async function getConversationMessages(conversationId: string): Promise<SupportChatMessage[]> {
  try {
    const admin = await getSupabaseAdminClient();
    const { data, error } = await admin
      .from("support_chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      const msgs = data.map(mapRowToMessage);
      inMemoryMessages.set(conversationId, msgs);
      return msgs;
    }
    return inMemoryMessages.get(conversationId) || [];
  } catch (err) {
    return inMemoryMessages.get(conversationId) || [];
  }
}

/**
 * 5. Cambia el Modo de la Conversación (IA <-> Humano)
 */
export async function setConversationMode(
  conversationId: string,
  newMode: "ai" | "human",
  agentUserId?: string,
  agentName?: string
): Promise<{ success: boolean; conversation?: SupportConversation; error?: string }> {
  try {
    const allConvs = await getConversationsList();
    const conv = allConvs.find((c) => c.id === conversationId);
    if (!conv) {
      return { success: false, error: "Conversación no encontrada" };
    }

    const isSwitchingToHuman = newMode === "human";
    const updatedConv: SupportConversation = {
      ...conv,
      mode: newMode,
      status: isSwitchingToHuman ? "with_agent" : "active",
      assignedAgentId: isSwitchingToHuman ? (agentUserId || conv.assignedAgentId) : conv.assignedAgentId,
      assignedAgentName: isSwitchingToHuman ? (agentName || conv.assignedAgentName) : conv.assignedAgentName,
      updatedAt: new Date().toISOString(),
    };

    await saveConversation(updatedConv);

    // Registrar mensaje de sistema informativo
    const sysMsg: SupportChatMessage = {
      id: `msg-mode-${Date.now()}`,
      conversationId,
      senderRole: "system",
      senderId: "system",
      senderName: "Sistema NEGOVA",
      content: isSwitchingToHuman
        ? `👨‍💼 Atención humana activada por ${agentName || "un asesor"}. Las respuestas automáticas de la IA han sido pausadas.`
        : `🤖 Modo IA de Soporte reactivado. La IA responderá de forma automática a los mensajes del cliente.`,
      readByAdmin: true,
      readByClient: true,
      createdAt: new Date().toISOString(),
    };

    await saveMessage(sysMsg);

    return { success: true, conversation: updatedConv };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al cambiar modo de chat" };
  }
}

/**
 * 6. Envío de mensaje por parte del CLIENTE (con procesamiento IA o espera de Humano)
 */
export async function sendClientMessage(
  conversationId: string,
  content: string
): Promise<{
  success: boolean;
  userMessage?: SupportChatMessage;
  aiResponse?: SupportChatMessage | null;
  escalatedToHuman?: boolean;
  error?: string;
}> {
  try {
    const allConvs = await getConversationsList();
    const conv = allConvs.find((c) => c.id === conversationId);
    if (!conv) {
      return { success: false, error: "Conversación no encontrada" };
    }

    const currentMessages = await getConversationMessages(conversationId);

    const clientMsg: SupportChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      conversationId,
      senderRole: "client",
      senderId: conv.userId,
      senderName: conv.userName,
      content: content.trim(),
      readByAdmin: false,
      readByClient: true,
      createdAt: new Date().toISOString(),
    };

    await saveMessage(clientMsg);

    // Verificar si el cliente solicita explícitamente un humano o asesor
    const lowerContent = content.toLowerCase();
    const humanKeywords = [
      "humano",
      "persona",
      "asesor",
      "agente",
      "alguien real",
      "soporte humano",
      "hablar con una persona",
      "hablar con un asesor",
      "operador",
      "no me ayuda la ia",
      "transferir",
      "asesor real",
    ];
    const requestedHuman = humanKeywords.some((kw) => lowerContent.includes(kw));

    let aiMsg: SupportChatMessage | null = null;
    let isEscalated = false;

    if (conv.mode === "ai" && requestedHuman) {
      // Escalación: Notificar al humano y enviar correo, PERO NO cambiar automáticamente a modo humano
      // para que si el humano no está en ese segundo, la IA pueda seguir asistiendo.
      isEscalated = true;
      const updatedConv: SupportConversation = {
        ...conv,
        status: "waiting_agent", // Marca como pendiente de agente humano
        lastMessageAt: new Date().toISOString(),
        lastMessagePreview: `[ESCALADO] ${content.slice(0, 70)}`,
        unreadCountAdmin: conv.unreadCountAdmin + 1,
        aiContext: {
          ...conv.aiContext,
          escalationReason: "Solicitud explícita de asesor humano",
        },
      };
      await saveConversation(updatedConv);

      // Respuesta tranquilizadora de la IA mientras el humano toma el control
      aiMsg = {
        id: `msg-ai-${Date.now()}`,
        conversationId,
        senderRole: "ai",
        senderId: "negova-ai",
        senderName: "IA de Soporte NEGOVA",
        content: `He notificado a nuestro equipo de soporte humano para que revise tu caso y un asesor se ponga en contacto contigo por este chat. Mientras tanto, si tienes alguna otra pregunta o deseas darme más detalles, sigo aquí para ayudarte.`,
        readByAdmin: true,
        readByClient: true,
        createdAt: new Date().toISOString(),
      };
      await saveMessage(aiMsg);

      // 1. Notificación interna en el sistema
      try {
        await createNotification({
          scope: "platform",
          audience: "global",
          type: "chat_escalated",
          title: `🚨 Chat requiere asesor humano (${conv.businessName})`,
          message: `${conv.userName} de ${conv.businessName} solicitó soporte humano: "${content.slice(0, 80)}"`,
          entityType: "support_chat",
          entityId: conv.id,
          entityNumber: conv.conversationNumber,
          href: `/admin/soporte?tab=chat&id=${conv.id}`,
        });
      } catch (err) {
        console.warn("Aviso al crear notificación interna:", err);
      }

      // 2. Notificación por Correo electrónico vía Resend
      try {
        await sendSupportEscalationEmail({
          conversationNumber: conv.conversationNumber,
          businessName: conv.businessName,
          userName: conv.userName,
          userEmail: conv.userEmail,
          userPhone: conv.userPhone,
          clientMessage: content,
          conversationId: conv.id,
          reason: "El cliente solicitó expresamente la atención de un asesor humano.",
        });
      } catch (err) {
        console.warn("Aviso al enviar correo de escalación:", err);
      }
    } else if (conv.mode === "ai") {
      // Modo IA activo: Generar respuesta inteligente con Gemini y Base de Conocimiento oficial
      const aiResponseText = await generateAiSupportResponse(content, currentMessages, conv);

      aiMsg = {
        id: `msg-ai-${Date.now()}`,
        conversationId,
        senderRole: "ai",
        senderId: "negova-ai",
        senderName: "IA de Soporte NEGOVA",
        content: aiResponseText,
        readByAdmin: true,
        readByClient: true,
        createdAt: new Date().toISOString(),
      };
      await saveMessage(aiMsg);

      const updatedConv: SupportConversation = {
        ...conv,
        lastMessageAt: new Date().toISOString(),
        lastMessagePreview: content.slice(0, 80),
      };
      await saveConversation(updatedConv);
    } else {
      // Modo Humano activo: La IA NO responde. Se incrementan no leídos del admin y se notifica.
      const updatedConv: SupportConversation = {
        ...conv,
        status: conv.status === "with_agent" ? "with_agent" : "waiting_agent",
        lastMessageAt: new Date().toISOString(),
        lastMessagePreview: content.slice(0, 80),
        unreadCountAdmin: conv.unreadCountAdmin + 1,
      };
      await saveConversation(updatedConv);

      try {
        await createNotification({
          scope: "platform",
          audience: conv.assignedAgentId ? "user" : "global",
          recipientUserId: conv.assignedAgentId || null,
          type: "support_chat",
          title: `Nuevo mensaje de ${conv.businessName}`,
          message: `${conv.userName}: "${content.slice(0, 80)}"`,
          entityType: "support_chat",
          entityId: conv.id,
          entityNumber: conv.conversationNumber,
          href: `/admin/soporte?tab=chat&id=${conv.id}`,
        });
      } catch {}
    }

    return {
      success: true,
      userMessage: clientMsg,
      aiResponse: aiMsg,
      escalatedToHuman: isEscalated,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al enviar mensaje" };
  }
}

/**
 * 7. Envío de mensaje por parte del AGENTE HUMANO (Administrador de NEGOVA)
 */
export async function sendAgentMessage(
  conversationId: string,
  agentUserId: string,
  agentName: string,
  content: string
): Promise<{ success: boolean; agentMessage?: SupportChatMessage; error?: string }> {
  try {
    const allConvs = await getConversationsList();
    const conv = allConvs.find((c) => c.id === conversationId);
    if (!conv) {
      return { success: false, error: "Conversación no encontrada" };
    }

    const agentMsg: SupportChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      conversationId,
      senderRole: "agent",
      senderId: agentUserId,
      senderName: agentName,
      content: content.trim(),
      readByAdmin: true,
      readByClient: false,
      createdAt: new Date().toISOString(),
    };

    await saveMessage(agentMsg);

    // Cuando el agente humano responde, la conversación pasa a Modo Humano y estado with_agent
    const updatedConv: SupportConversation = {
      ...conv,
      status: "with_agent",
      mode: "human",
      assignedAgentId: agentUserId,
      assignedAgentName: agentName,
      lastMessageAt: new Date().toISOString(),
      lastMessagePreview: `[Agente ${agentName}]: ${content.slice(0, 70)}`,
      unreadCountAdmin: 0,
      unreadCountClient: conv.unreadCountClient + 1,
    };

    await saveConversation(updatedConv);

    return { success: true, agentMessage: agentMsg };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al responder como agente" };
  }
}

/**
 * 8. Formaliza una conversación de chat en un Registro de Atención (ATN-XXXX)
 */
export async function convertChatToInteraction(
  conversationId: string,
  data: {
    category: "technical" | "usage_inquiry" | "billing" | "account" | "general";
    subject: string;
    summary: string;
    outcome: "resolved_immediately" | "escalated_to_ticket" | "information_provided" | "pending_customer";
    agentUserId: string;
    agentName: string;
  }
): Promise<{ success: boolean; interactionNumber?: string; error?: string }> {
  try {
    const allConvs = await getConversationsList();
    const conv = allConvs.find((c) => c.id === conversationId);
    if (!conv) {
      return { success: false, error: "Conversación no encontrada" };
    }

    // Crear Atención
    const atnRes = await createSupportInteraction({
      businessId: conv.businessId,
      businessName: conv.businessName,
      businessSlug: conv.businessSlug,
      contactName: conv.userName,
      contactPhone: conv.userPhone,
      contactEmail: conv.userEmail,
      channel: "in_app_chat",
      category: data.category,
      subject: data.subject || conv.subject || "Atención desde Chat en Vivo",
      summary: data.summary,
      outcome: data.outcome,
      agentId: data.agentUserId,
      agentName: data.agentName,
    });

    if (!atnRes.success || !atnRes.interaction) {
      return { success: false, error: atnRes.error || "No se pudo registrar la atención." };
    }

    // Enlazar a la conversación
    const updatedConv: SupportConversation = {
      ...conv,
      interactionId: atnRes.interaction.id,
      status: data.outcome === "resolved_immediately" ? "resolved" : conv.status,
    };
    await saveConversation(updatedConv);

    // Mensaje de sistema informativo en el hilo
    const sysMsg: SupportChatMessage = {
      id: `msg-sys-${Date.now()}`,
      conversationId,
      senderRole: "system",
      senderId: "system",
      senderName: "Sistema NEGOVA",
      content: `📋 Esta conversación fue formalizada en el Registro de Atención ${atnRes.interaction.interactionNumber}.`,
      readByAdmin: true,
      readByClient: true,
      createdAt: new Date().toISOString(),
    };
    await saveMessage(sysMsg);

    return { success: true, interactionNumber: atnRes.interaction.interactionNumber };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al formalizar atención" };
  }
}

/**
 * 9. Escala una conversación de chat a un Ticket formal (TCK-XXXX)
 */
export async function convertChatToTicket(
  conversationId: string,
  data: {
    category: "technical" | "usage_inquiry" | "billing" | "account" | "general";
    priority: "low" | "medium" | "high" | "urgent";
    subject: string;
    description: string;
    internalNotes?: string;
    assignedAgentId?: string;
    agentUserId: string;
    agentName: string;
  }
): Promise<{ success: boolean; ticketNumber?: string; error?: string }> {
  try {
    const allConvs = await getConversationsList();
    const conv = allConvs.find((c) => c.id === conversationId);
    if (!conv) {
      return { success: false, error: "Conversación no encontrada" };
    }

    // Crear Ticket
    const tckRes = await createSupportTicket({
      businessId: conv.businessId,
      businessName: conv.businessName,
      businessSlug: conv.businessSlug,
      contactName: conv.userName,
      contactEmail: conv.userEmail,
      contactPhone: conv.userPhone,
      originChannel: "in_app_chat",
      category: data.category,
      priority: data.priority,
      subject: data.subject || conv.subject || "Ticket generado desde Chat",
      description: data.description,
      internalNotes: data.internalNotes,
      assignedAgentId: data.assignedAgentId || data.agentUserId,
      assignedAgentName: data.agentName,
      adminUserId: data.agentUserId,
    });

    if (!tckRes.success || !tckRes.ticket) {
      return { success: false, error: tckRes.error || "No se pudo crear el ticket." };
    }

    // Enlazar a la conversación
    const updatedConv: SupportConversation = {
      ...conv,
      ticketId: tckRes.ticket.id,
      status: "with_agent",
    };
    await saveConversation(updatedConv);

    // Mensaje de sistema informativo en el hilo
    const sysMsg: SupportChatMessage = {
      id: `msg-sys-${Date.now()}`,
      conversationId,
      senderRole: "system",
      senderId: "system",
      senderName: "Sistema NEGOVA",
      content: `🎫 Esta conversación fue escalada al Ticket de Seguimiento ${tckRes.ticket.ticketNumber}. El equipo de soporte dará seguimiento técnico formal.`,
      readByAdmin: true,
      readByClient: true,
      createdAt: new Date().toISOString(),
    };
    await saveMessage(sysMsg);

    return { success: true, ticketNumber: tckRes.ticket.ticketNumber };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al escalar a ticket" };
  }
}

/**
 * 10. GENERADOR DE RESPUESTAS CONTEXTUALES DE LA IA DE SOPORTE NEGOVA
 */
async function generateAiSupportResponse(
  userQuery: string,
  history: SupportChatMessage[],
  conv: SupportConversation
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  const systemInstruction = `
Eres el Asistente Inteligente de Soporte Oficial de NEGOVA.
Estás atendiendo al usuario "${conv.userName}" del negocio "${conv.businessName}".
Plan actual del negocio: Plan ${conv.aiContext.planId || "Inicio"}.

TU MISIÓN:
Ayudar al usuario a resolver dudas operativas sobre el uso de NEGOVA (registrar ventas, agregar productos, controlar inventario, arqueo de caja, fiados, gastos y reportes).

REGLAS DE FORMATO Y ESTILO:
1. Responde en español claro, cordial y conciso (máximo 2 a 3 párrafos).
2. Usa negritas con doble asterisco (**ejemplo**) para resaltar botones, módulos y conceptos clave.
3. Si enumeras pasos, usa viñetas con asterisco (* paso 1).
4. NUNCA inventes funciones no confirmadas (como facturación electrónica DIAN, comandas avanzadas de cocina ni apps nativas de Play Store).
5. Si el usuario solicita hablar con una persona, asesor o agente humano, indícale cordialmente que has notificado al equipo de soporte humano para que se una a la conversación.
6. Enfócate exclusivamente en "${conv.businessName}".
`;

  if (apiKey && apiKey.trim().length > 5 && !apiKey.includes("YOUR_")) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const formattedContents: Array<{
        role: "user" | "model";
        parts: Array<{ text: string }>;
      }> = [];

      // Historial multi-turno
      for (const msg of history.slice(-6)) {
        if (msg.content && msg.senderRole !== "system") {
          formattedContents.push({
            role: msg.senderRole === "client" ? "user" : "model",
            parts: [{ text: msg.content }],
          });
        }
      }

      formattedContents.push({
        role: "user",
        parts: [{ text: userQuery }],
      });

      const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
      for (const m of models) {
        try {
          const res = await ai.models.generateContent({
            model: m,
            config: {
              systemInstruction,
              temperature: 0.3,
              maxOutputTokens: 500,
            },
            contents: formattedContents,
          });

          if (res && res.text && res.text.trim()) {
            return res.text.trim();
          }
        } catch {}
      }
    } catch (sdkErr) {
      console.warn("Aviso al ejecutar Gemini SDK, usando fallback oficial:", sdkErr);
    }
  }

  // Fallback a base de conocimiento oficial
  const fallback = queryNegovaKnowledge(userQuery);
  return fallback.text;
}
