"use server";

import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import { getExpensesAndPurchasesReportData } from "@/lib/reports/reports-service";
import { generateExpensesAndPurchasesPdf } from "@/lib/reports/expenses-purchases-report-pdf";
import { generateExpensesAndPurchasesCsv } from "@/lib/reports/expenses-purchases-report-csv";
import { getBusinessDocumentConfig } from "@/lib/documents/document-service";
import {
  ExpensesAndPurchasesFilterParams,
  ExpensesAndPurchasesReportData,
} from "@/lib/reports/types";

/**
 * Server Action: Consulta el reporte integral de gastos y compras con filtros multidimensionales [REP-005].
 * Protegido con permisos multi-tenant 'reports.view' / 'reports:read' / 'expenses.view' / 'purchases.view'.
 */
export async function getExpensesAndPurchasesReportAction(
  businessId: string,
  filterParams: ExpensesAndPurchasesFilterParams = {}
): Promise<{
  success: boolean;
  data?: ExpensesAndPurchasesReportData;
  error?: string;
}> {
  let auth = await verifyWorkspaceAction(businessId, "reports:read");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "reports.view");
  }
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "expenses.view");
  }
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "purchases.view");
  }

  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para consultar el reporte de gastos y compras.",
    };
  }

  try {
    const data = await getExpensesAndPurchasesReportData(
      businessId,
      filterParams,
      auth.context.businessType || "America/Bogota"
    );
    return { success: true, data };
  } catch (err: any) {
    console.error("[getExpensesAndPurchasesReportAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al obtener datos del reporte de gastos y compras.",
    };
  }
}

/**
 * Server Action: Genera el archivo PDF formal del reporte de gastos y compras [REP-005].
 */
export async function exportExpensesAndPurchasesPdfAction(
  businessId: string,
  filterParams: ExpensesAndPurchasesFilterParams = {},
  view: "gastos" | "compras" | "ambos" = "ambos"
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
    auth = await verifyWorkspaceAction(businessId, "reports.export");
  }
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "expenses.view");
  }

  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No autorizado para exportar el reporte en PDF.",
    };
  }

  try {
    const reportData = await getExpensesAndPurchasesReportData(
      businessId,
      filterParams,
      auth.context.businessType || "America/Bogota"
    );

    const docConfig = await getBusinessDocumentConfig(businessId).catch(() => null);

    const pdfResult = generateExpensesAndPurchasesPdf({
      businessName: reportData.businessName,
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
      contentType: "application/pdf",
    };
  } catch (err: any) {
    console.error("[exportExpensesAndPurchasesPdfAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al generar el documento PDF de gastos y compras.",
    };
  }
}

/**
 * Server Action: Genera el archivo Excel (CSV con BOM) del reporte de gastos y compras [REP-005].
 */
export async function exportExpensesAndPurchasesCsvAction(
  businessId: string,
  filterParams: ExpensesAndPurchasesFilterParams = {},
  view: "gastos" | "compras" | "ambos" = "ambos"
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
    auth = await verifyWorkspaceAction(businessId, "reports.export");
  }
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "expenses.view");
  }

  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No autorizado para exportar el reporte en CSV / Excel.",
    };
  }

  try {
    const reportData = await getExpensesAndPurchasesReportData(
      businessId,
      filterParams,
      auth.context.businessType || "America/Bogota"
    );

    const csvResult = generateExpensesAndPurchasesCsv(reportData, view);

    return {
      success: true,
      content: csvResult.content,
      filename: csvResult.filename,
      contentType: csvResult.contentType,
    };
  } catch (err: any) {
    console.error("[exportExpensesAndPurchasesCsvAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al exportar datos de gastos y compras en CSV.",
    };
  }
}

