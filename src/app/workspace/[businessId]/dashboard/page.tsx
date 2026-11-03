import React from "react";
import { Metadata } from "next";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { getSalesDashboardMetrics } from "@/lib/reports/reports-service";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { SalesDashboardClient } from "./sales-dashboard-client";
import { ReportsDateRange, ReportsDatePreset } from "@/lib/reports/types";

export const metadata: Metadata = {
  title: "Dashboard de Ventas & KPIs | Workspace NEGOVA",
  description: "Métricas consolidadas de facturación, transacciones, canales y productos estrella.",
};

export default async function WorkspaceDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams?: Promise<{ preset?: string; start?: string; end?: string }>;
}) {
  const { businessId } = await params;
  const resolvedParams = searchParams ? await searchParams : {};

  // 1. Validar autorización multi-tenant para el Dashboard (reports.view)
  const session = await requireWorkspaceSession(businessId, "reports.view");

  const initialRange: ReportsDateRange = {
    preset: (resolvedParams.preset as ReportsDatePreset) || "today",
    startDate: resolvedParams.start,
    endDate: resolvedParams.end,
  };

  // 2. Obtener métricas consolidadas de ventas
  const dashboardData = await getSalesDashboardMetrics(
    businessId,
    initialRange,
    session.businessTimezone || "America/Bogota"
  );

  return (
    <AppPageContainer
      title={session.businessName}
      description="Dashboard de KPIs de ventas y métricas consolidadas del comercio."
      maxWidth="6xl"
    >
      <SalesDashboardClient
        businessId={businessId}
        businessName={session.businessName}
        initialData={dashboardData}
      />
    </AppPageContainer>
  );
}
