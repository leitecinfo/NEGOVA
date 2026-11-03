import React from "react";
import { Metadata } from "next";
import { Landmark } from "lucide-react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { WorkspaceCajaClient } from "@/components/cash/workspace-caja-client";
import { getCashOverview } from "@/lib/cash/cash-service";
import { getBusinessLocations } from "@/lib/inventory/inventory-service";
import { CashOverviewData } from "@/lib/cash/types";

export const metadata: Metadata = {
  title: "Cajas y Control de Turnos | Workspace NEGOVA",
  description: "Apertura, arqueos, cierres de turno y conciliación de efectivo en tiempo real.",
};

export default async function WorkspaceCajaPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  // 1. Validar autorización de acceso al módulo de cajas
  const session = await requireWorkspaceSession(businessId, "cash.view");

  // 2. Cargar panorámica de cajas y ubicaciones
  let initialData: CashOverviewData = {
    kpis: {
      openSessionsCount: 0,
      totalCashInDrawers: 0,
      totalSalesInOpenSessions: 0,
      totalRegistersCount: 0,
    },
    registers: [],
  };

  let locations: { id: string; name: string }[] = [];

  try {
    const [overview, locs] = await Promise.all([
      getCashOverview(businessId),
      getBusinessLocations(businessId).catch(() => []),
    ]);

    initialData = overview;
    locations = locs.map((l) => ({ id: l.id, name: l.name }));
  } catch (err) {
    console.error("[WorkspaceCajaPage] Error al cargar overview de cajas:", err);
  }

  return (
    <AppPageContainer
      title="Cajas y Movimientos"
      description="Supervisión de turnos de caja, efectivo en cajones y arqueos diarios con conciliación."
      maxWidth="7xl"
      badge={
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold font-mono">
          <Landmark className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Fase 6 POS & Cajas</span>
        </div>
      }
    >
      <WorkspaceCajaClient
        businessId={businessId}
        initialData={initialData}
        locations={locations}
        currentUserId={session.userId}
        currentBusinessUserId={session.businessUserId || undefined}
        currentUserEmail={session.userEmail}
      />
    </AppPageContainer>
  );
}
