/**
 * Tipos Canónicos para el Sistema de Soporte y Mesa de Ayuda de NEGOVA
 * 
 * Separación conceptual:
 * 1. SupportInteraction (ATN-XXXX): Registro rápido de contacto / bitácora cotidiana (WhatsApp, Teléfono, etc.)
 * 2. SupportTicket (TCK-XXXX): Caso formal que requiere seguimiento, investigación técnica o ciclo de vida.
 */

export type SupportChannel =
  | "whatsapp"
  | "phone"
  | "email"
  | "in_app_chat"
  | "other";

export type SupportCategory =
  | "technical"
  | "usage_inquiry"
  | "billing"
  | "account"
  | "general";

export type InteractionOutcome =
  | "resolved_immediately"
  | "escalated_to_ticket"
  | "information_provided"
  | "pending_customer";

export type TicketStatus =
  | "open"
  | "in_progress"
  | "resolved"
  | "closed";

export type TicketPriority =
  | "low"
  | "medium"
  | "high"
  | "urgent";

/**
 * 0. CHAT DE SOPORTE EN TIEMPO REAL E IA
 */
export type ConversationStatus = "active" | "waiting_agent" | "with_agent" | "resolved" | "closed";
export type ConversationMode = "ai" | "human" | "hybrid";
export type MessageSenderRole = "client" | "ai" | "agent" | "system";

export interface SupportChatMessage {
  id: string;
  conversationId: string;
  senderRole: MessageSenderRole;
  senderId: string;
  senderName: string;
  content: string;
  suggestedActions?: Array<{
    label: string;
    actionType: "escalate_human" | "link" | "retry";
    payload?: string;
  }>;
  readByAdmin: boolean;
  readByClient: boolean;
  isInternalNote?: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface SupportConversation {
  id: string;
  conversationNumber: string; // CHT-0001
  businessId: string;
  businessName: string;
  businessSlug: string;
  userId: string;
  userName: string;
  userEmail?: string | null;
  userPhone?: string | null;
  
  status: ConversationStatus;
  mode: ConversationMode;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  
  subject?: string | null;
  lastMessageAt: string;
  lastMessagePreview: string;
  unreadCountAdmin: number;
  unreadCountClient: number;
  
  // Relaciones preservadas
  interactionId: string | null; // Enlace a ATN-XXXX
  ticketId: string | null;      // Enlace a TCK-XXXX
  
  // Contexto IA controlado
  aiContext: {
    planId?: string;
    businessCategory?: string;
    detectedTopic?: string;
    escalationReason?: string;
  };
  
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
}

/**
 * 1. REGISTRO DE ATENCIÓN (Bitácora de Contacto Rápida)
 */
export interface SupportInteraction {
  id: string;
  interactionNumber: string; // ATN-0001, ATN-0002...
  businessId: string;
  businessName: string;
  businessSlug: string;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  channel: SupportChannel;
  category: SupportCategory;
  subject: string;
  summary: string;
  outcome: InteractionOutcome;
  ticketId: string | null;
  ticketNumber: string | null;
  agentId: string;
  agentName: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 2. TICKET DE SOPORTE FORMAL (Seguimiento Técnico / Operativo)
 */
export interface SupportTicket {
  id: string;
  ticketNumber: string; // TCK-0001, TCK-0002...
  businessId: string;
  businessName: string;
  businessSlug: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  originChannel: SupportChannel;
  interactionId: string | null;
  interactionNumber: string | null;
  category: SupportCategory;
  priority: TicketPriority;
  status: TicketStatus;
  subject: string;
  description: string;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  internalNotes: string | null; // Solo visible para el equipo interno de NEGOVA
  clientResolution: string | null; // Respuesta / solución entregada al cliente
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
}

/**
 * Parámetros de filtrado
 */
export interface SupportFilterParams {
  tab?: "interactions" | "tickets" | "chat";
  page?: number;
  pageSize?: number;
  search?: string;
  channel?: string;
  category?: string;
  outcome?: string;
  status?: string;
  priority?: string;
  businessId?: string;
}

/**
 * Métricas consolidadas del Dashboard de Soporte
 */
export interface SupportDashboardStats {
  totalInteractions: number;
  todayInteractions: number;
  resolvedImmediatelyCount: number;
  escalatedInteractionsCount: number;
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  urgentTickets: number;
}

/**
 * Respuesta consolidada para el cliente de soporte
 */
export interface SupportDashboardResult {
  interactions: SupportInteraction[];
  tickets: SupportTicket[];
  interactionsTotalCount: number;
  ticketsTotalCount: number;
  page: number;
  pageSize: number;
  interactionsTotalPages: number;
  ticketsTotalPages: number;
  stats: SupportDashboardStats;
}
