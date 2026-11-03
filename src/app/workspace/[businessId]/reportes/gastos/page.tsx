import React from "react";
import { Metadata } from "next";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { getExpensesAndPurchasesReportData } from "@/lib/reports/reports-service";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { ExpensesReportClient } from "./expenses-report-client";
import { ReportsDatePreset, ExpensesAndPurchasesFilterParams } from "@/lib/reports/types";

export const metadata: Metadata = {
  title: "Reporte de Gastos y Compras | NEGOVA",
  description: "Supervisión de egresos operativos, órdenes de compra a proveedores, cuentas por pagar y distribución por categorías.",
};

export default async function WorkspaceExpensesReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams?: Promise<{
    preset?: string;
    start?: string;
    end?: string;
    category?: string;
    supplierId?: string;
    status?: string;
  }>;
}) {
  const { businessId } = await params;
  const resolvedParams = searchParams ? await searchParams : {};

  // 1. Validar autorización multi-tenant (reports.view con fallback a expenses.view)
  let session;
  try {
    session = await requireWorkspaceSession(businessId, "reports.view");
  } catch {
    session = await requireWorkspaceSession(businessId, "expenses.view");
  }

  const initialFilters: ExpensesAndPurchasesFilterParams = {
    preset: (resolvedParams.preset as ReportsDatePreset) || "this_month",
    startDate: resolvedParams.start,
    endDate: resolvedParams.end,
    category: resolvedParams.category || "all",
    supplierId: resolvedParams.supplierId || "all",
    status: (resolvedParams.status as any) || "all",
  };

  // 2. Obtener datos analíticos consolidados de gastos y compras
  const initialData = await getExpensesAndPurchasesReportData(
    businessId,
    initialFilters,
    session.businessTimezone || "America/Bogota"
  );

  return (
    <AppPageContainer
      title="Reportes y Estadísticas"
      description="Supervisión analítica de gastos operativos, órdenes de compra y obligaciones con proveedores."
      maxWidth="7xl"
    >
      <ExpensesReportClient
        businessId={businessId}
        businessName={initialData.businessName}
        initialData={initialData}
      />
    </AppPageContainer>
  );
}

