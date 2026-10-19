import { z } from "zod";

// ==========================================
// 1. ESTADOS DE CONVERSACIÓN Y TRANSICIONES
// ==========================================

export const WhatsAppConversationStatusEnum = z.enum([
  "ai_active",
  "human_pending",
  "human_active",
  "closed",
]);

export type WhatsAppConversationStatus = z.infer<typeof WhatsAppConversationStatusEnum>;

export const VALID_CONVERSATION_TRANSITIONS: Record<
  WhatsAppConversationStatus,
  WhatsAppConversationStatus[]
> = {
  ai_active: ["human_pending", "closed"],
  human_pending: ["human_active", "ai_active", "closed"],
  human_active: ["ai_active", "closed"],
  closed: ["ai_active"],
};

export function isValidConversationTransition(
  from: WhatsAppConversationStatus,
  to: WhatsAppConversationStatus
): boolean {
  if (from === to) return true;
  const allowed = VALID_CONVERSATION_TRANSITIONS[from];
  return Boolean(allowed && allowed.includes(to));
}

export function canAiRespond(status: WhatsAppConversationStatus): boolean {
  return status === "ai_active";
}

// ==========================================
// 2. CONFIGURACIÓN DE WHATSAPP POR NEGOCIO
// ==========================================

export const WhatsAppConfigStatusEnum = z.enum([
  "pending",
  "active",
  "disconnected",
  "suspended",
]);

export type WhatsAppConfigStatus = z.infer<typeof WhatsAppConfigStatusEnum>;

/**
 * Configuración Operativa de WhatsApp por Comercio.
 * Contiene únicamente datos no sensibles legibles por personal autorizado del negocio.
 */
export interface BusinessWhatsAppConfig {
  id: string;
  businessId: string;
  phoneNumberId: string;
  wabaId?: string | null;
  displayPhoneNumber?: string | null;
  verifiedName?: string | null;
  status: WhatsAppConfigStatus;
  aiEnabled: boolean;
  aiSettings?: {
    welcomeMessage?: string;
    personalityPrompt?: string;
    businessHours?: string;
    outOfHoursMessage?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Secretos Criptográficos de WhatsApp (RLS-01).
 * Almacenados en tabla aislada con acceso restringido exclusivamente a service_role.
 */
export interface BusinessWhatsAppSecrets {
  id: string;
  businessId: string;
  encryptedAccessToken: string;
  tokenKeyId: string;
  webhookVerifyToken?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 3. EVENTOS ENTRANTES Y COLA PERSISTENTE
// ==========================================

export const IncomingEventStatusEnum = z.enum([
  "pending",
  "processing",
  "completed",
  "failed",
  "dead_letter",
]);

export type IncomingEventStatus = z.infer<typeof IncomingEventStatusEnum>;

export interface WhatsAppIncomingEvent {
  id: string;
  businessId: string;
  phoneNumberId: string;
  metaMessageId?: string | null;
  senderPhone: string;
  eventType: "message" | "status" | "interactive" | "unknown";
  payload: Record<string, any>;
  status: IncomingEventStatus;
  attempts: number;
  maxAttempts: number;
  lockedAt?: string | null;
  lockedBy?: string | null;
  nextAttemptAt?: string | null;
  lastError?: string | null;
  processedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 4. MENSAJES DE WHATSAPP
// ==========================================

export const MessageSenderRoleEnum = z.enum(["customer", "ai", "human_agent", "system"]);
export type MessageSenderRole = z.infer<typeof MessageSenderRoleEnum>;

export const MessageDirectionEnum = z.enum(["inbound", "outbound"]);
export type MessageDirection = z.infer<typeof MessageDirectionEnum>;

export const MessageTypeEnum = z.enum([
  "text",
  "image",
  "interactive",
  "audio",
  "document",
  "location",
  "order",
]);
export type MessageType = z.infer<typeof MessageTypeEnum>;

export interface WhatsAppMessage {
  id: string;
  conversationId: string;
  businessId: string;
  metaMessageId?: string | null;
  direction: MessageDirection;
  senderRole: MessageSenderRole;
  messageType: MessageType;
  content: string;
  rawPayload?: Record<string, any>;
  createdAt: string;
}

// ==========================================
// 5. ESTRUCTURA DE EVENTOS DE META (WEBHOOK)
// ==========================================

export interface MetaWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: {
    body: string;
  };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  image?: { id: string; mime_type?: string; sha256?: string };
  audio?: { id: string; mime_type?: string };
  document?: { id: string; filename?: string; mime_type?: string };
}

export const MetaWebhookStatusEnum = z.enum(["sent", "delivered", "read", "failed"]);
export type MetaWebhookStatusType = z.infer<typeof MetaWebhookStatusEnum>;

export const MetaWebhookStatusItemSchema = z.object({
  id: z.string().min(1, "El id del mensaje de Meta (wamid) es obligatorio"),
  status: z.string().min(1, "El estado es obligatorio"),
  timestamp: z.string().optional(),
  recipient_id: z.string().optional(),
  conversation: z.record(z.string(), z.any()).optional(),
  pricing: z.record(z.string(), z.any()).optional(),
  errors: z.array(z.record(z.string(), z.any())).optional(),
});

export type MetaWebhookStatusItem = z.infer<typeof MetaWebhookStatusItemSchema>;

export interface MetaWebhookValue {
  messaging_product: string;
  metadata: {
    display_phone_number?: string;
    phone_number_id: string;
  };
  contacts?: Array<{
    profile: {
      name: string;
    };
    wa_id: string;
  }>;
  messages?: MetaWebhookMessage[];
  statuses?: MetaWebhookStatusItem[];
}

export interface MetaWebhookChange {
  field: string;
  value: MetaWebhookValue;
}

export interface MetaWebhookEntry {
  id: string;
  changes: MetaWebhookChange[];
}

export interface MetaWebhookPayload {
  object: string;
  entry: MetaWebhookEntry[];
}
