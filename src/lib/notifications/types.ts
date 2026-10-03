/**
 * Tipos y Definiciones Canónicas del Sistema Transversal de Notificaciones de NEGOVA
 * 
 * Reglas de Arquitectura:
 * 1. scope = "platform" -> Notificaciones internas para el equipo de NEGOVA (admin/super_admin).
 * 2. scope = "business" -> Notificaciones operativas del Workspace del cliente (bound to businessId).
 * 3. audience = "global" -> Destinada a todos los usuarios autorizados dentro del ámbito.
 * 4. audience = "user" -> Destinada exclusivamente a un usuario específico (recipientUserId).
 */

export type NotificationScope = "platform" | "business";

export type NotificationAudience = "global" | "user";

export type NotificationType =
  | "support_interaction"
  | "support_ticket"
  | "ticket_assigned"
  | "support_chat"
  | "chat_escalated"
  | "document_generated"
  | "user_created"
  | "business_created"
  | "security"
  | "billing"
  | "system";

export interface AppNotification {
  id: string;
  scope: NotificationScope;
  audience: NotificationAudience;
  recipientUserId: string | null;
  businessId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  isRead: boolean; // Alias para 100% de compatibilidad con componentes previos
  entityType: string | null; // "support_interaction" | "support_ticket" | "business" | "user" | etc.
  entityId: string | null;
  entityNumber: string | null; // "ATN-0001", "TCK-0001", etc.
  href: string | null;
  link?: string | null; // Alias para compatibilidad con llamadas existentes
  metadata?: Record<string, any>;
}

// Alias para compatibilidad con código existente
export type PlatformNotification = AppNotification;

export interface NotificationFilterOptions {
  scope?: NotificationScope;
  businessId?: string | null;
  currentUserId?: string | null;
  isPlatformUser?: boolean;
  unreadOnly?: boolean;
  type?: NotificationType;
  limit?: number;
}
