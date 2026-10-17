/**
 * Tipos para el módulo de auditoría de NEGOVA
 * Compatible con la estructura PostgreSQL real:
 * - public.audit_logs (con business_id, user_id, action::audit_action, entity_type, entity_id, etc.)
 * - public.users y public.profiles
 */

export type AuditActionType =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "status_change"
  | "permission_change"
  | "subscription_change"
  | "other";

export interface LogAuditActionParams {
  userId?: string | null;
  action: AuditActionType | string;
  entityType?: string;
  entityId?: string | null;
  businessId?: string | null;
  businessName?: string | null;
  oldData?: Record<string, any> | null;
  newData?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt?: string;
}

export interface AuditLogModel {
  id: string;
  businessId: string | null;
  businessName?: string | null;
  userId: string | null;
  userName?: string;
  userEmail?: string;
  action: string;
  actionLabel: string;
  actionVariant: "create" | "update" | "delete" | "security" | "status" | "default";
  entityType: string;
  entityId: string | null;
  oldData?: Record<string, any> | null;
  newData?: Record<string, any> | null;
  metadata: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export interface AuditFilterParams {
  page?: number;
  pageSize?: number;
  search?: string;
  action?: string;
  entityType?: string;
  userId?: string;
  businessId?: string | null;
  startDate?: string;
  endDate?: string;
}

export interface AuditLogsResult {
  logs: AuditLogModel[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: {
    totalEvents: number;
    securityEvents: number;
    businessEvents: number;
    userEvents: number;
    subscriptionEvents: number;
  };
}
