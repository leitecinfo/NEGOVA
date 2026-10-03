export interface AuditLogModel {
  id: string;
  userId: string | null;
  userName?: string;
  userEmail?: string;
  action: string;
  actionLabel: string;
  actionVariant: "create" | "update" | "delete" | "security" | "status" | "default";
  entityType: string;
  entityId: string | null;
  metadata: Record<string, any> | null;
  ipAddress?: string | null;
  createdAt: string;
}

export interface AuditFilterParams {
  page?: number;
  pageSize?: number;
  search?: string;
  action?: string;
  entityType?: string;
  userId?: string;
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
