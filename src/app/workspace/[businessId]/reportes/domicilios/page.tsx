import React from "react";
import { Metadata } from "next";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { getDeliveryReportData } from "@/lib/reports/reports-service";
import { DeliveryReportClient } from "./delivery-report-client";
import { ReportsDatePreset, DeliveryReportFilterParams } from "@/lib/reports/types";

export const metadata: Metadata = {
  title: "Reporte de Domicilios y Despachos | NEGOVA",
  description: "Métricas de entregas a domicilio, tiempos de despacho, ranking por repartidor y análisis por zonas.",
};

export default async function WorkspaceDeliveryReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams?: Promise<{
    preset?: string;
    start?: string;
    end?: string;
    driver?: string;
    zone?: string;
    status?: string;
  }>;
}) {
  const { businessId } = await params;
  const resolvedParams = searchParams ? await searchParams : {};

  // 1. Validar autorización multi-tenant para consultar reportes
  let session;
  try {
    session = await requireWorkspaceSession(businessId, "reports.view");
  } catch {
    session = await requireWorkspaceSession(businessId, "orders.view");
  }

  const initialFilters: DeliveryReportFilterParams = {
    preset: (resolvedParams.preset as ReportsDatePreset) || "this_month",
    startDate: resolvedParams.start,
    endDate: resolvedParams.end,
    driverName: resolvedParams.driver || "all",
    zoneId: resolvedParams.zone || "all",
    status: (resolvedParams.status as any) || "all",
  };

  // 2. Obtener datos iniciales del reporte de domicilios
  const initialData = await getDeliveryReportData(
    businessId,
    initialFilters,
    session.businessTimezone || "America/Bogota"
  );

  return (
    <DeliveryReportClient
      businessId={businessId}
      initialData={initialData}
    />
  );
}

