"use server";

import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import { getEmployeeReportData } from "@/lib/reports/reports-service";
import { generateEmployeeReportPdf } from "@/lib/reports/employee-report-pdf";
import { generateEmployeeReportCsv } from "@/lib/reports/employee-report-csv";
import { getBusinessDocumentConfig } from "@/lib/documents/document-service";
import { EmployeeReportFilterParams, EmployeeReportData } from "@/lib/reports/types";

/**
 * Server Action: Consulta el reporte de rendimiento y ventas por empleado [REP-003].
 * Protegido con el permiso multi-tenant 'reports:read' / 'reports.view'.
 */
export async function getEmployeeReportAction(
  businessId: string,
  filterParams: EmployeeReportFilterParams = {}
): Promise<{ success: boolean; data?: EmployeeReportData; error?: string }> {
  let auth = await verifyWorkspaceAction(businessId, "reports:read");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "reports.view");
  }

  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para consultar los reportes del comercio.",
    };
  }

  try {
    const data = await getEmployeeReportData(
      businessId,
      filterParams,
      auth.context.businessType || "America/Bogota"
    );
    return { success: true, data };
  } catch (err: any) {
    console.error("[getEmployeeReportAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al generar el reporte de empleados.",
    };
  }
}

/**
 * Server Action: Genera el archivo PDF formal del reporte de empleados [REP-003].
 */
export async function exportEmployeeReportPdfAction(
  businessId: string,
  filterParams: EmployeeReportFilterParams = {}
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
      error: auth.error || "No autorizado para exportar reportes del comercio.",
    };
  }

  try {
    const [reportData, docConfig] = await Promise.all([
      getEmployeeReportData(businessId, filterParams, auth.context.businessType || "America/Bogota"),
      getBusinessDocumentConfig(businessId).catch(() => null),
    ]);

    const pdfResult = generateEmployeeReportPdf({
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
    console.error("[exportEmployeeReportPdfAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al exportar el reporte de empleados en PDF.",
    };
  }
}

/**
 * Server Action: Genera el archivo Excel (CSV con BOM) del reporte de empleados [REP-003].
 */
export async function exportEmployeeReportCsvAction(
  businessId: string,
  filterParams: EmployeeReportFilterParams = {}
): Promise<{
  success: boolean;
  content?: string;
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
      error: auth.error || "No autorizado para exportar reportes del comercio.",
    };
  }

  try {
    const reportData = await getEmployeeReportData(
      businessId,
      filterParams,
      auth.context.businessType || "America/Bogota"
    );

    const csvResult = generateEmployeeReportCsv(reportData);

    return {
      success: true,
      content: csvResult.content,
      filename: csvResult.filename,
    };
  } catch (err: any) {
    console.error("[exportEmployeeReportCsvAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al exportar el reporte de empleados en Excel.",
    };
  }
}

