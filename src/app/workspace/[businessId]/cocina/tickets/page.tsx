import React from "react";
import { Metadata } from "next";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { getKdsOpenTickets, getKdsOrders, getKdsAlertConfig } from "@/lib/restaurant/restaurant-service";
import { KdsScreenClient } from "../kds-screen-client";

export const metadata: Metadata = {
  title: "Tickets Abiertos | Monitor de Cocina | Workspace NEGOVA",
  description: "Panel de tickets abiertos, cuentas sin cobrar y supervisión de demoras.",
};

export default async function WorkspaceCocinaTicketsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  // 1. Validar autorización multi-tenant (orders.view)
  await requireWorkspaceSession(businessId, "orders.view");

  // 2. Obtener datos en paralelo
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
        defaultView="open_tickets"
      />
    </div>
  );
}

