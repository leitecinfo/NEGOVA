"use server";

import { getCurrentUserAuthorization } from "@/lib/auth/authorization";
import { getAuditLogsList } from "@/lib/audit/audit-service";
import { AuditFilterParams } from "@/lib/audit/types";

export async function fetchAuditLogsAction(params: AuditFilterParams) {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    return { success: false, error: "Acceso no autorizado", data: null };
  }

  const result = await getAuditLogsList(params);
  return { success: true, data: result };
}
