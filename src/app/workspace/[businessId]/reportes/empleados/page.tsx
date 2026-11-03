import React from "react";
import { Metadata } from "next";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { getEmployeeReportData } from "@/lib/reports/reports-service";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { EmployeeReportClient } from "./employee-report-client";
import { ReportsDatePreset, EmployeeReportFilterParams } from "@/lib/reports/types";

export const metadata: Metadata = {
  title: "Reporte de Empleados y Ventas | NEGOVA",
  description: "Rendimiento del equipo de trabajo, ventas por colaborador, turnos trabajados y ranking de desempeño.",
};

export default async function WorkspaceEmployeeReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams?: Promise<{
    preset?: string;
    start?: string;
    end?: string;
    locationId?: string;
    roleCode?: string;
  }>;
}) {
  const { businessId } = await params;
  const resolvedParams = searchParams ? await searchParams : {};

  // 1. Validar autorización multi-tenant para consultar reportes (reports.view)
  const session = await requireWorkspaceSession(businessId, "reports.view");

  const initialFilters: EmployeeReportFilterParams = {
    preset: (resolvedParams.preset as ReportsDatePreset) || "this_month",
    startDate: resolvedParams.start,
    endDate: resolvedParams.end,
    locationId: resolvedParams.locationId || "all",
    roleCode: resolvedParams.roleCode || "all",
  };

  // 2. Obtener datos iniciales del reporte de empleados
  const initialData = await getEmployeeReportData(
    businessId,
    initialFilters,
    session.businessTimezone || "America/Bogota"
  );

  return (
    <AppPageContainer
      title="Reporte de Empleados"
      description={`Métricas de rendimiento, ranking de ventas y auditoría operativa de ${session.businessName}.`}
      maxWidth="7xl"
    >
      <EmployeeReportClient
        businessId={businessId}
        businessName={session.businessName}
        initialData={initialData}
      />
    </AppPageContainer>
  );
}

