"use server";

import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import { getSalesReportData } from "@/lib/reports/reports-service";
import { generateSalesReportPdf } from "@/lib/reports/sales-report-pdf";
import { generateSalesReportCsv } from "@/lib/reports/sales-report-csv";
import { getBusinessDocumentConfig } from "@/lib/documents/document-service";
import { SalesReportFilterParams, SalesReportData } from "@/lib/reports/types";

/**
 * Server Action: Consulta el reporte detallado de ventas con filtros [REP-002].
 * Protegido con el permiso multi-tenant 'reports:read' / 'reports.view'.
 */
export async function getSalesReportAction(
  businessId: string,
  filterParams: SalesReportFilterParams = {}
): Promise<{ success: boolean; data?: SalesReportData; error?: string }> {
  let auth = await verifyWorkspaceAction(businessId, "reports:read");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "reports.view");
  }

  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para consultar el reporte de ventas del comercio.",
    };
  }

  try {
    const data = await getSalesReportData(
      businessId,
      filterParams,
      auth.context.businessType || "America/Bogota"
    );
    return { success: true, data };
  } catch (err: any) {
    console.error("[getSalesReportAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al generar el reporte de ventas.",
    };
  }
}

/**
 * Server Action: Genera el archivo PDF formal del reporte de ventas [REP-002].
 */
export async function exportSalesReportPdfAction(
  businessId: string,
  filterParams: SalesReportFilterParams = {}
): Promise<{
  success: boolean;
  base64?: string;
  filename?: string;
  error?: string;
}> {
  let auth = await verifyWorkspaceAction(businessId, "reports:read");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "reports.view");
  }

  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No autorizado para exportar reportes de ventas.",
    };
  }

  try {
    const [reportData, docConfig] = await Promise.all([
      getSalesReportData(businessId, filterParams, auth.context.businessType || "America/Bogota"),
      getBusinessDocumentConfig(businessId).catch(() => null),
    ]);

    const pdfResult = generateSalesReportPdf({
      businessName: docConfig?.tradeName || auth.context.businessName || reportData.businessName,
      businessNit: docConfig?.taxId || null,
      businessAddress: docConfig?.address || null,
      businessPhone: docConfig?.phone || null,
      logoUrl: docConfig?.logoUrl || null,
      reportData,
    });

    return {
      success: true,
      base64: pdfResult.buffer.toString("base64"),
      filename: pdfResult.filename,
    };
  } catch (err: any) {
    console.error("[exportSalesReportPdfAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al exportar el reporte en PDF.",
    };
  }
}

/**
 * Server Action: Genera el archivo Excel (CSV con BOM) del reporte de ventas [REP-002].
 */
export async function exportSalesReportCsvAction(
  businessId: string,
  filterParams: SalesReportFilterParams = {}
): Promise<{
  success: boolean;
  content?: string;
  filename?: string;
  contentType?: string;
  error?: string;
}> {
  let auth = await verifyWorkspaceAction(businessId, "reports:read");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "reports.view");
  }

  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No autorizado para exportar reportes de ventas.",
    };
  }

  try {
    const reportData = await getSalesReportData(
      businessId,
      filterParams,
      auth.context.businessType || "America/Bogota"
    );

    const csvResult = generateSalesReportCsv(reportData);

    return {
      success: true,
      content: csvResult.content,
      filename: csvResult.filename,
      contentType: csvResult.contentType,
    };
  } catch (err: any) {
    console.error("[exportSalesReportCsvAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al exportar el reporte en Excel/CSV.",
    };
  }
}
