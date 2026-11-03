"use server";

import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import { getSalesDashboardMetrics } from "@/lib/reports/reports-service";
import { ReportsDateRange, SalesDashboardData } from "@/lib/reports/types";

/**
 * Server Action: Consulta métricas consolidadas del Dashboard de Ventas [REP-001].
 * Requiere el permiso multi-tenant 'reports:read'.
 */
export async function getSalesDashboardMetricsAction(
  businessId: string,
  dateRange: ReportsDateRange
): Promise<{ success: boolean; data?: SalesDashboardData; error?: string }> {
  // 1. Validar autorización multi-tenant con 'reports:read'
  const auth = await verifyWorkspaceAction(businessId, "reports:read");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para consultar reportes y métricas del comercio.",
    };
  }

  try {
    const data = await getSalesDashboardMetrics(
      businessId,
      dateRange,
      auth.context.businessType || "America/Bogota"
    );
    return { success: true, data };
  } catch (err: any) {
    console.error("[getSalesDashboardMetricsAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al calcular las métricas de ventas.",
    };
  }
}
