import React from "react";
import { Metadata } from "next";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { getInventoryReportData } from "@/lib/reports/reports-service";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { InventoryReportClient } from "./inventory-report-client";
import { ReportsDatePreset, InventoryReportFilterParams } from "@/lib/reports/types";

export const metadata: Metadata = {
  title: "Reporte de Inventario y Existencias | NEGOVA",
  description: "Control de existencias actuales, valorización de inventario, historial de movimientos y alertas de stock bajo.",
};

export default async function WorkspaceInventoryReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams?: Promise<{
    preset?: string;
    start?: string;
    end?: string;
    locationId?: string;
    categoryId?: string;
    status?: string;
  }>;
}) {
  const { businessId } = await params;
  const resolvedParams = searchParams ? await searchParams : {};

  // 1. Validar autorización multi-tenant para consultar reportes (reports.view)
  let session;
  try {
    session = await requireWorkspaceSession(businessId, "reports.view");
  } catch {
    session = await requireWorkspaceSession(businessId, "inventory.view");
  }

  const initialFilters: InventoryReportFilterParams = {
    preset: (resolvedParams.preset as ReportsDatePreset) || "this_month",
    startDate: resolvedParams.start,
    endDate: resolvedParams.end,
    locationId: resolvedParams.locationId || "all",
    categoryId: resolvedParams.categoryId || "all",
    status: (resolvedParams.status as any) || "all",
  };

  // 2. Obtener datos iniciales del reporte de inventario
  const initialData = await getInventoryReportData(
    businessId,
    initialFilters,
    session.businessTimezone || "America/Bogota"
  );

  return (
    <AppPageContainer
      title="Reportes y Estadísticas"
      description="Supervisión integral de inventario, existencias en tiempo real y auditoría de movimientos."
      maxWidth="7xl"
    >
      <InventoryReportClient
        businessId={businessId}
        businessName={session.businessName}
        initialData={initialData}
      />
    </AppPageContainer>
  );
}

