import React from "react";
import { Metadata } from "next";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { getPeakHoursReportData } from "@/lib/reports/reports-service";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { PeakHoursClient } from "./peak-hours-client";
import { PeakHoursFilterParams } from "@/lib/reports/types";

export const metadata: Metadata = {
  title: "Análisis de Horas Pico y Mapa de Calor | NEGOVA",
  description: "Mapa de calor de ventas por día y hora para optimizar turnos de personal y abastecimiento.",
};

export default async function WorkspacePeakHoursReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams?: Promise<{
    preset?: string;
    start?: string;
    end?: string;
    channel?: string;
  }>;
}) {
  const { businessId } = await params;
  const resolvedParams = searchParams ? await searchParams : {};

  // 1. Validar autorización multi-tenant para consultar reportes (reports.view)
  const session = await requireWorkspaceSession(businessId, "reports.view");

  const initialFilters: PeakHoursFilterParams = {
    preset: (resolvedParams.preset as any) || "last_30_days",
    startDate: resolvedParams.start,
    endDate: resolvedParams.end,
    channel: (resolvedParams.channel as any) || "all",
  };

  // 2. Obtener datos iniciales del reporte de horas pico
  const initialData = await getPeakHoursReportData(
    businessId,
    initialFilters,
    session.businessTimezone || "America/Bogota"
  );

  return (
    <AppPageContainer
      title="Análisis de Horas Pico"
      description="Mapa de calor interactivo de concurrencia y facturación por día de la semana y hora del día."
      maxWidth="7xl"
    >
      <PeakHoursClient
        businessId={businessId}
        initialData={initialData}
      />
    </AppPageContainer>
  );
}

