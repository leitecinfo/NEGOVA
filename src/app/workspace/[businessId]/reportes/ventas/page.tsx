import React from "react";
import { Metadata } from "next";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { getSalesReportData } from "@/lib/reports/reports-service";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { SalesReportClient } from "./sales-report-client";
import { ReportsDatePreset, SalesReportFilterParams } from "@/lib/reports/types";

export const metadata: Metadata = {
  title: "Reporte de Ventas con Exportación | NEGOVA",
  description: "Reporte detallado de transacciones comerciales, filtros de canal y exportación en PDF y Excel.",
};

export default async function WorkspaceSalesReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams?: Promise<{
    preset?: string;
    start?: string;
    end?: string;
    channel?: string;
    status?: string;
  }>;
}) {
  const { businessId } = await params;
  const resolvedParams = searchParams ? await searchParams : {};

  // 1. Validar autorización multi-tenant para consultar reportes (reports.view)
  const session = await requireWorkspaceSession(businessId, "reports.view");

  const initialFilters: SalesReportFilterParams = {
    preset: (resolvedParams.preset as ReportsDatePreset) || "this_month",
    startDate: resolvedParams.start,
    endDate: resolvedParams.end,
    channel: (resolvedParams.channel as any) || "all",
    status: (resolvedParams.status as any) || "all",
  };

  // 2. Obtener datos iniciales del reporte de ventas
  const initialData = await getSalesReportData(
    businessId,
    initialFilters,
    session.businessTimezone || "America/Bogota"
  );

  return (
    <AppPageContainer
      title="Reporte de Ventas"
      description={`Historial y auditoría de transacciones para ${session.businessName}.`}
      maxWidth="7xl"
    >
      <SalesReportClient
        businessId={businessId}
        businessName={session.businessName}
        initialData={initialData}
      />
    </AppPageContainer>
  );
}
