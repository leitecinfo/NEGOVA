import React from "react";
import { Metadata } from "next";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import {
  getKdsOrders,
  getKdsAlertConfig,
  getKdsOpenTickets,
} from "@/lib/restaurant/restaurant-service";
import { KdsScreenClient } from "./kds-screen-client";

export const metadata: Metadata = {
  title: "Monitor de Cocina (KDS) | Workspace NEGOVA",
  description: "Pantalla de visualización y preparación de comandas en tiempo real.",
};

export default async function WorkspaceCocinaPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams?: Promise<{ view?: string }>;
}) {
  const { businessId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const defaultView = resolvedSearchParams.view === "tickets" ? "open_tickets" : "kds";

  // 1. Validar autorización multi-tenant para cocina (orders.view)
  await requireWorkspaceSession(businessId, "orders.view");

  // 2. Obtener comandas iniciales, configuración de alertas y tickets abiertos [KDS-002 & KDS-003]
  const [initialOrders, alertConfig, openTicketsData] = await Promise.all([
    getKdsOrders(businessId),
    getKdsAlertConfig(businessId),
    getKdsOpenTickets(businessId),
  ]);

  return (
    <div className="flex-1 w-full flex flex-col min-h-full bg-slate-50 dark:bg-[#0B0E14] text-slate-900 dark:text-[#F8F9FD]">
      <KdsScreenClient
        businessId={businessId}
        initialOrders={initialOrders}
        initialAlertConfig={alertConfig}
        initialOpenTickets={openTicketsData.tickets}
        initialOpenSummary={openTicketsData.summary}
        defaultView={defaultView}
      />
    </div>
  );
}
