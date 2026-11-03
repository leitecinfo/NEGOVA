"use server";

import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import { getDeliveryReportData } from "@/lib/reports/reports-service";
import { generateDeliveryReportPdf } from "@/lib/reports/delivery-report-pdf";
import { generateDeliveryReportCsv } from "@/lib/reports/delivery-report-csv";
import { getBusinessDocumentConfig } from "@/lib/documents/document-service";
import type { DeliveryReportFilterParams, DeliveryReportData } from "@/lib/reports/types";

/**
 * Server Action: Consulta el reporte de rendimiento y métricas de domicilios [REP-007].
 * Protegido con permisos multi-tenant 'reports.view' u 'orders.view'.
 */
export async function getDeliveryReportAction(
  businessId: string,
  filterParams: DeliveryReportFilterParams = {}
): Promise<{ success: boolean; data?: DeliveryReportData; error?: string }> {
  let auth = await verifyWorkspaceAction(businessId, "reports.view");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "orders.view");
  }

  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para consultar los reportes del negocio.",
    };
  }

  try {
    const data = await getDeliveryReportData(
      businessId,
      filterParams,
      auth.context.businessTimezone || "America/Bogota"
    );
    return { success: true, data };
  } catch (err: any) {
    console.error("[getDeliveryReportAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al generar el reporte de domicilios.",
    };
  }
}

/**
 * Server Action: Genera el archivo PDF formal del reporte de domicilios [REP-007].
 */
export async function exportDeliveryReportPdfAction(
  businessId: string,
  filterParams: DeliveryReportFilterParams = {}
): Promise<{
  success: boolean;
  base64?: string;
  filename?: string;
  error?: string;
}> {
  let auth = await verifyWorkspaceAction(businessId, "reports.view");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "orders.view");
  }

  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No autorizado para exportar reportes.",
    };
  }

  try {
    const [reportData, docConfig] = await Promise.all([
      getDeliveryReportData(
        businessId,
        filterParams,
        auth.context.businessTimezone || "America/Bogota"
      ),
      getBusinessDocumentConfig(businessId).catch(() => null),
    ]);

    const result = generateDeliveryReportPdf({
      businessName: auth.context.businessName || "Negocio",
      businessNit: docConfig?.taxId || null,
      businessAddress: docConfig?.address || null,
      businessPhone: docConfig?.phone || null,
      reportData,
    });

    if (!result || !result.base64) {
      return {
        success: false,
        error: "Error al renderizar el documento PDF de domicilios.",
      };
    }

    return {
      success: true,
      base64: result.base64,
      filename: result.filename,
    };
  } catch (err: any) {
    console.error("[exportDeliveryReportPdfAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error inesperado al exportar PDF de domicilios.",
    };
  }
}

/**
 * Server Action: Genera el archivo CSV para Microsoft Excel del reporte de domicilios [REP-007].
 */
export async function exportDeliveryReportCsvAction(
  businessId: string,
  filterParams: DeliveryReportFilterParams = {}
): Promise<{
  success: boolean;
  content?: string;
  filename?: string;
  error?: string;
}> {
  let auth = await verifyWorkspaceAction(businessId, "reports.view");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "orders.view");
  }

  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No autorizado para exportar reportes.",
    };
  }

  try {
    const reportData = await getDeliveryReportData(
      businessId,
      filterParams,
      auth.context.businessTimezone || "America/Bogota"
    );

    const result = generateDeliveryReportCsv(reportData);

    return {
      success: true,
      content: result.content,
      filename: result.filename,
    };
  } catch (err: any) {
    console.error("[exportDeliveryReportCsvAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error inesperado al exportar CSV de domicilios.",
    };
  }
}
