"use server";

import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import { getRecipeReportData } from "@/lib/reports/reports-service";
import { generateRecipeReportPdf } from "@/lib/reports/recipe-report-pdf";
import { generateRecipeReportCsv } from "@/lib/reports/recipe-report-csv";
import { getBusinessDocumentConfig } from "@/lib/documents/document-service";
import {
  RecipeReportFilterParams,
  RecipeReportData,
} from "@/lib/reports/types";

/**
 * Server Action: Consulta el reporte integral de recetas, escandallos y costos [REP-008].
 * Protegido con permisos multi-tenant 'reports:read' / 'reports.view' / 'recipes.view'.
 */
export async function getRecipeReportAction(
  businessId: string,
  filterParams: RecipeReportFilterParams = {}
): Promise<{ success: boolean; data?: RecipeReportData; error?: string }> {
  let auth = await verifyWorkspaceAction(businessId, "reports:read");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "reports.view");
  }
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "recipes.view");
  }

  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para consultar el reporte de recetas del comercio.",
    };
  }

  try {
    const data = await getRecipeReportData(
      businessId,
      filterParams,
      auth.context.businessTimezone || "America/Bogota"
    );
    return { success: true, data };
  } catch (err: any) {
    console.error("[getRecipeReportAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al generar el reporte de recetas y costos.",
    };
  }
}

/**
 * Server Action: Genera el archivo PDF formal del reporte de recetas y escandallos [REP-008].
 */
export async function exportRecipeReportPdfAction(
  businessId: string,
  filterParams: RecipeReportFilterParams = {},
  view: "costos" | "ingredientes" | "todo" = "todo"
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
    auth = await verifyWorkspaceAction(businessId, "recipes.view");
  }

  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para exportar el reporte de recetas.",
    };
  }

  try {
    const [reportData, docConfig] = await Promise.all([
      getRecipeReportData(
        businessId,
        filterParams,
        auth.context.businessTimezone || "America/Bogota"
      ),
      getBusinessDocumentConfig(businessId),
    ]);

    const pdfResult = generateRecipeReportPdf({
      businessName: docConfig?.tradeName || auth.context.businessName || "Comercio",
      businessNit: docConfig?.taxId || null,
      businessAddress: docConfig?.address || null,
      businessPhone: docConfig?.phone || null,
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
    console.error("[exportRecipeReportPdfAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Ocurrió un error al generar el documento PDF.",
    };
  }
}

/**
 * Server Action: Genera el archivo CSV compatible con Excel del reporte de recetas [REP-008].
 */
export async function exportRecipeReportCsvAction(
  businessId: string,
  filterParams: RecipeReportFilterParams = {},
  view: "costos" | "ingredientes" | "todo" = "todo"
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
    auth = await verifyWorkspaceAction(businessId, "recipes.view");
  }

  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para exportar el reporte de recetas.",
    };
  }

  try {
    const reportData = await getRecipeReportData(
      businessId,
      filterParams,
      auth.context.businessTimezone || "America/Bogota"
    );

    const csvResult = generateRecipeReportCsv(reportData, view);

    return {
      success: true,
      content: csvResult.content,
      filename: csvResult.filename,
      contentType: csvResult.contentType,
    };
  } catch (err: any) {
    console.error("[exportRecipeReportCsvAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Ocurrió un error al exportar la hoja de cálculo.",
    };
  }
}
