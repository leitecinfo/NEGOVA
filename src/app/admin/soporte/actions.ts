"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserAuthorization } from "@/lib/auth/authorization";
import {
  getSupportDashboardData,
  createSupportInteraction,
  createSupportTicket,
  escalateInteractionToTicket,
  updateSupportTicket,
} from "@/lib/support/support-service";
import {
  SupportFilterParams,
  SupportChannel,
  SupportCategory,
  InteractionOutcome,
  TicketStatus,
  TicketPriority,
} from "@/lib/support/types";

export async function fetchSupportDashboardDataAction(params: SupportFilterParams) {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    return { success: false, error: "Acceso no autorizado", data: null };
  }

  const result = await getSupportDashboardData(params);
  return { success: true, data: result };
}

export async function createSupportInteractionAction(data: {
  businessId: string;
  businessName: string;
  businessSlug: string;
  contactName: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  channel: SupportChannel;
  category: SupportCategory;
  subject: string;
  summary: string;
  outcome?: InteractionOutcome;
  createLinkedTicket?: boolean;
  ticketPriority?: TicketPriority;
  ticketDescription?: string;
}) {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    return { success: false, error: "Acceso no autorizado" };
  }

  const result = await createSupportInteraction({
    ...data,
    agentId: auth.userId,
    agentName: auth.email ? auth.email.split("@")[0] : "Administrador NEGOVA",
  });

  if (result.success) {
    revalidatePath("/admin/soporte");
  }

  return result;
}

export async function createSupportTicketAction(data: {
  businessId: string;
  businessName: string;
  businessSlug: string;
  contactName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  originChannel?: SupportChannel;
  interactionId?: string | null;
  category: SupportCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
  assignedAgentId?: string | null;
  assignedAgentName?: string | null;
  internalNotes?: string | null;
  clientResolution?: string | null;
}) {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    return { success: false, error: "Acceso no autorizado" };
  }

  const result = await createSupportTicket({
    ...data,
    adminUserId: auth.userId,
    assignedAgentId: data.assignedAgentId || auth.userId,
    assignedAgentName: data.assignedAgentName || (auth.email ? auth.email.split("@")[0] : "Administrador NEGOVA"),
  });

  if (result.success) {
    revalidatePath("/admin/soporte");
  }

  return result;
}

export async function escalateInteractionToTicketAction(
  interactionId: string,
  data: {
    priority?: TicketPriority;
    description?: string;
  }
) {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    return { success: false, error: "Acceso no autorizado" };
  }

  const result = await escalateInteractionToTicket(interactionId, {
    ...data,
    adminUserId: auth.userId,
    agentName: auth.email ? auth.email.split("@")[0] : "Administrador NEGOVA",
  });

  if (result.success) {
    revalidatePath("/admin/soporte");
  }

  return result;
}

export async function updateSupportTicketAction(
  ticketId: string,
  data: {
    status?: TicketStatus;
    priority?: TicketPriority;
    assignedAgentId?: string | null;
    assignedAgentName?: string | null;
    internalNotes?: string | null;
    clientResolution?: string | null;
  }
) {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    return { success: false, error: "Acceso no autorizado" };
  }

  const result = await updateSupportTicket(ticketId, {
    ...data,
    adminUserId: auth.userId,
  });

  if (result.success) {
    revalidatePath("/admin/soporte");
  }

  return result;
}

// ==========================================
// ACCIONES DE CHAT DE SOPORTE EN TIEMPO REAL
// ==========================================

export async function fetchConversationsListAction(params: {
  status?: string;
  businessId?: string;
  search?: string;
} = {}) {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    return { success: false, error: "Acceso no autorizado", data: [] };
  }

  const { getConversationsList } = await import("@/lib/support/chat-service");
  const list = await getConversationsList(params);
  return { success: true, data: list };
}

export async function fetchConversationMessagesAction(conversationId: string) {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    return { success: false, error: "Acceso no autorizado", data: [] };
  }

  const { getConversationMessages } = await import("@/lib/support/chat-service");
  const messages = await getConversationMessages(conversationId);
  return { success: true, data: messages };
}

export async function sendAgentChatMessageAction(conversationId: string, content: string) {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    return { success: false, error: "Acceso no autorizado" };
  }

  const { sendAgentMessage } = await import("@/lib/support/chat-service");
  const agentName = auth.email ? auth.email.split("@")[0] : "Agente NEGOVA";
  const result = await sendAgentMessage(conversationId, auth.userId, agentName, content);

  if (result.success) {
    revalidatePath("/admin/soporte");
  }

  return result;
}

export async function convertChatToInteractionAction(
  conversationId: string,
  data: {
    category: SupportCategory;
    subject: string;
    summary: string;
    outcome: InteractionOutcome;
  }
) {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    return { success: false, error: "Acceso no autorizado" };
  }

  const { convertChatToInteraction } = await import("@/lib/support/chat-service");
  const agentName = auth.email ? auth.email.split("@")[0] : "Agente NEGOVA";
  const result = await convertChatToInteraction(conversationId, {
    ...data,
    agentUserId: auth.userId,
    agentName,
  });

  if (result.success) {
    revalidatePath("/admin/soporte");
  }

  return result;
}

export async function convertChatToTicketAction(
  conversationId: string,
  data: {
    category: SupportCategory;
    priority: TicketPriority;
    subject: string;
    description: string;
    internalNotes?: string;
  }
) {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    return { success: false, error: "Acceso no autorizado" };
  }

  const { convertChatToTicket } = await import("@/lib/support/chat-service");
  const agentName = auth.email ? auth.email.split("@")[0] : "Agente NEGOVA";
  const result = await convertChatToTicket(conversationId, {
    ...data,
    agentUserId: auth.userId,
    agentName,
  });

  if (result.success) {
    revalidatePath("/admin/soporte");
  }

  return result;
}

export async function simulateClientMessageAction(conversationId: string, content: string) {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    return { success: false, error: "Acceso no autorizado" };
  }

  const { sendClientMessage } = await import("@/lib/support/chat-service");
  const result = await sendClientMessage(conversationId, content);

  if (result.success) {
    revalidatePath("/admin/soporte");
  }

  return result;
}

export async function toggleChatModeAction(conversationId: string, newMode: "ai" | "human") {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    return { success: false, error: "Acceso no autorizado" };
  }

  const { setConversationMode } = await import("@/lib/support/chat-service");
  const agentName = auth.email ? auth.email.split("@")[0] : "Agente NEGOVA";
  const result = await setConversationMode(conversationId, newMode, auth.userId, agentName);

  if (result.success) {
    revalidatePath("/admin/soporte");
  }

  return result;
}

export async function startDemoChatConversationAction(businessId: string, userName: string, businessName: string) {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    return { success: false, error: "Acceso no autorizado" };
  }

  const { getOrCreateActiveConversation } = await import("@/lib/support/chat-service");
  const conv = await getOrCreateActiveConversation({
    businessId,
    businessName,
    userId: auth.userId,
    userName,
    userEmail: auth.email || null,
  });

  revalidatePath("/admin/soporte");
  return { success: true, conversation: conv };
}



