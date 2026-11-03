"use server";

import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import { getPeakHoursReportData } from "@/lib/reports/reports-service";
import type { PeakHoursFilterParams, PeakHoursReportData } from "@/lib/reports/types";

/**
 * Server Action: Consulta el reporte de Análisis de Horas Pico y Mapa de Calor [REP-006].
 * Protegido con permisos multi-tenant 'reports:read' / 'reports.view'.
 */
export async function getPeakHoursReportAction(
  businessId: string,
  filterParams: PeakHoursFilterParams = {}
): Promise<{ success: boolean; data?: PeakHoursReportData; error?: string }> {
  let auth = await verifyWorkspaceAction(businessId, "reports:read");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "reports.view");
  }

  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para consultar el reporte de horas pico del comercio.",
    };
  }

  try {
    const data = await getPeakHoursReportData(
      businessId,
      filterParams,
      auth.context.businessType || "America/Bogota"
    );
    return { success: true, data };
  } catch (err: any) {
    console.error("[getPeakHoursReportAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al generar el reporte de horas pico.",
    };
  }
}

