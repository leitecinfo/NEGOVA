"use server";

import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import { getInventoryReportData } from "@/lib/reports/reports-service";
import { generateInventoryReportPdf } from "@/lib/reports/inventory-report-pdf";
import { generateInventoryReportCsv } from "@/lib/reports/inventory-report-csv";
import { getBusinessDocumentConfig } from "@/lib/documents/document-service";
import {
  InventoryReportFilterParams,
  InventoryReportData,
} from "@/lib/reports/types";

/**
 * Server Action: Consulta el reporte integral de inventario con filtros multidimensionales [REP-004].
 * Protegido con permisos multi-tenant 'reports:read' / 'reports.view' / 'inventory.view'.
 */
export async function getInventoryReportAction(
  businessId: string,
  filterParams: InventoryReportFilterParams = {}
): Promise<{ success: boolean; data?: InventoryReportData; error?: string }> {
  let auth = await verifyWorkspaceAction(businessId, "reports:read");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "reports.view");
  }
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "inventory.view");
  }

  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para consultar el reporte de inventario del comercio.",
    };
  }

  try {
    const data = await getInventoryReportData(
      businessId,
      filterParams,
      auth.context.businessType || "America/Bogota"
    );
    return { success: true, data };
  } catch (err: any) {
    console.error("[getInventoryReportAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al generar el reporte de inventario.",
    };
  }
}

/**
 * Server Action: Genera el archivo PDF formal del reporte de inventario [REP-004].
 */
export async function exportInventoryReportPdfAction(
  businessId: string,
  filterParams: InventoryReportFilterParams = {},
  view: "existencias" | "movimientos" | "bajo_stock" = "existencias"
): Promise<{
  success: boolean;
  base64?: string;
  filename?: string;
  contentType?: string;
  error?: string;
}> {
  let auth = await verifyWorkspaceAction(businessId, "reports:read");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "reports.view");
  }
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "inventory.view");
  }

  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para exportar el reporte de inventario.",
    };
  }

  try {
    const [reportData, docConfig] = await Promise.all([
      getInventoryReportData(
        businessId,
        filterParams,
        auth.context.businessType || "America/Bogota"
      ),
      getBusinessDocumentConfig(businessId),
    ]);

    const pdfResult = generateInventoryReportPdf({
      businessName: docConfig?.tradeName || auth.context.businessName || "Comercio",
      businessNit: docConfig?.taxId || null,
      businessAddress: docConfig?.address || null,
      businessPhone: docConfig?.phone || null,
      logoUrl: docConfig?.logoUrl || null,
      reportData,
      view,
    });

    return {
      success: true,
      base64: pdfResult.base64,
      filename: pdfResult.filename,
      contentType: pdfResult.contentType,
    };
  } catch (err: any) {
    console.error("[exportInventoryReportPdfAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al generar la exportación en PDF del reporte de inventario.",
    };
  }
}

/**
 * Server Action: Genera el archivo Excel (CSV con BOM UTF-8) del reporte de inventario [REP-004].
 */
export async function exportInventoryReportCsvAction(
  businessId: string,
  filterParams: InventoryReportFilterParams = {},
  view: "existencias" | "movimientos" | "bajo_stock" = "existencias"
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
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "inventory.view");
  }

  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para exportar el reporte de inventario.",
    };
  }

  try {
    const reportData = await getInventoryReportData(
      businessId,
      filterParams,
      auth.context.businessType || "America/Bogota"
    );

    const csvResult = generateInventoryReportCsv(reportData, view);

    return {
      success: true,
      content: csvResult.content,
      filename: csvResult.filename,
      contentType: csvResult.contentType,
    };
  } catch (err: any) {
    console.error("[exportInventoryReportCsvAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al generar la exportación en Excel del reporte de inventario.",
    };
  }
}
