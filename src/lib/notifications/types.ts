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
  | "restaurant_order"
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
  | "inventory"
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

/**
 * Sanitiza y valida un enlace de notificación dentro del contexto estricto de un Workspace.
 * Evita navegación a rutas de /admin, enlaces a otros businessId (cross-tenant) o URLs externas no seguras.
 */
export function sanitizeWorkspaceNotificationLink(
  link: string | null | undefined,
  currentBusinessId: string
): string | null {
  if (!link || typeof link !== "string") return null;
  const trimmed = link.trim();

  // Rechazar protocolos absolutos (http:, https:, javascript:, etc.)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return null;
  }

  // Rechazar accesos al panel de administración
  if (trimmed.startsWith("/admin") || trimmed.includes("/admin/")) {
    return null;
  }

  // Si empieza por /workspace/
  if (trimmed.startsWith("/workspace/")) {
    const expectedPrefix = `/workspace/${currentBusinessId}`;
    if (
      trimmed === expectedPrefix ||
      trimmed.startsWith(`${expectedPrefix}/`) ||
      trimmed.startsWith(`${expectedPrefix}?`)
    ) {
      return trimmed;
    }
    // Enlace pertenece a otro negocio -> rechazar
    return null;
  }

  // Si es una ruta relativa que empieza por / (ej: /ventas, /productos)
  if (trimmed.startsWith("/")) {
    return `/workspace/${currentBusinessId}${trimmed}`;
  }

  return null;
}

// ============================================================================
// CONTRATOS Y TIPOS PARA GESTIÓN DE PLANTILLAS Y EVENTOS DE NOTIFICACIÓN [CONF-003]
// ============================================================================

export type NotificationEventId =
  | "qr_order_created"
  | "delivery_status_changed"
  | "low_stock_reached"
  | "cash_shift_closed"
  | "account_receivable_overdue";

export type NotificationChannelType = "whatsapp" | "email" | "push";

export type NotificationEventCategory = "pedidos" | "domicilios" | "inventario" | "caja" | "cartera";

export interface NotificationVariableMeta {
  tag: string;           // Ej: "{cliente}"
  description: string;   // Ej: "Nombre completo del cliente"
  sampleValue: string;   // Ej: "Juan Pérez"
}

export interface NotificationChannelConfig {
  enabled: boolean;
  template: string;
  subject?: string;      // Utilizado principalmente en Email
}

export interface NotificationEventConfig {
  id: NotificationEventId;
  name: string;
  description: string;
  category: NotificationEventCategory;
  enabled: boolean;
  notifyCustomer?: boolean; // Si la notificación además se envía al cliente final
  recipientRoles: string[]; // Roles internos que reciben la alerta (ej: 'admin', 'cashier', 'kitchen', 'waiter')
  channels: {
    whatsapp: NotificationChannelConfig;
    email: NotificationChannelConfig;
    push: NotificationChannelConfig;
  };
  availableVariables: NotificationVariableMeta[];
}

export interface NotificationSettings {
  events: Record<NotificationEventId, NotificationEventConfig>;
  generalWhatsAppEnabled: boolean;
  generalEmailEnabled: boolean;
  generalPushEnabled: boolean;
  defaultWhatsAppSenderPhone?: string | null;
  updatedAt: string;
}

export interface NotificationRoleOption {
  id: string;
  label: string;
  description: string;
}

export const NOTIFICATION_AVAILABLE_ROLES: NotificationRoleOption[] = [
  { id: "owner", label: "Propietario", description: "Acceso global a todas las notificaciones operativas y financieras." },
  { id: "admin", label: "Administrador", description: "Supervisores de turno y gerencia del local." },
  { id: "cashier", label: "Cajero", description: "Personal de caja y cobros en punto de venta." },
  { id: "waiter", label: "Mesero", description: "Atención de mesas y toma de pedidos." },
  { id: "kitchen", label: "Cocina / KDS", description: "Área de preparación de alimentos y comandas." },
  { id: "driver", label: "Repartidor", description: "Personal de entregas y domicilios." },
];

