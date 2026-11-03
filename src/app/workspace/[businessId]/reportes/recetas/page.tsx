import React from "react";
import { Metadata } from "next";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { getRecipeReportData } from "@/lib/reports/reports-service";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { RecipeReportClient } from "./recipe-report-client";
import { ReportsDatePreset, RecipeReportFilterParams } from "@/lib/reports/types";

export const metadata: Metadata = {
  title: "Reporte de Recetas y Costos | NEGOVA",
  description: "Análisis de costos de recetas, escandallos, margen bruto por producto y ritmo de consumo de ingredientes.",
};

export default async function WorkspaceRecipeReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams?: Promise<{
    preset?: string;
    start?: string;
    end?: string;
    categoryId?: string;
    marginFilter?: string;
    search?: string;
  }>;
}) {
  const { businessId } = await params;
  const resolvedParams = searchParams ? await searchParams : {};

  // 1. Validar autorización multi-tenant para consultar reportes
  let session;
  try {
    session = await requireWorkspaceSession(businessId, "reports.view");
  } catch {
    session = await requireWorkspaceSession(businessId, "recipes.view");
  }

  const initialFilters: RecipeReportFilterParams = {
    preset: (resolvedParams.preset as ReportsDatePreset) || "this_month",
    startDate: resolvedParams.start,
    endDate: resolvedParams.end,
    categoryId: resolvedParams.categoryId || "all",
    marginFilter: (resolvedParams.marginFilter as any) || "all",
    search: resolvedParams.search || "",
  };

  // 2. Obtener datos iniciales del reporte de recetas y costos
  const initialData = await getRecipeReportData(
    businessId,
    initialFilters,
    session.businessTimezone || "America/Bogota"
  );

  return (
    <AppPageContainer
      title="Reportes y Estadísticas"
      description="Costeo de recetas, escandallos, margen bruto por producto y proyección de agotamiento de insumos."
      maxWidth="7xl"
    >
      <RecipeReportClient
        businessId={businessId}
        businessName={session.businessName}
        initialData={initialData}
      />
    </AppPageContainer>
  );
}
