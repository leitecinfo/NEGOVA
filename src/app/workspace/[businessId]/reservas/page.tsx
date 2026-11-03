import React from "react";
import { Metadata } from "next";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import {
  getReservations,
  getReservationMetrics,
} from "@/lib/reservations/reservations-service";
import {
  getRestaurantRooms,
  getRestaurantTablesWithOrders,
} from "@/lib/restaurant/restaurant-service";
import { ReservationsDashboardClient } from "./reservations-dashboard-client";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Sistema de Reservas | Workspace NEGOVA",
    description: "Gestiona reservas, walk-ins y ocupación del restaurante.",
  };
}

export default async function WorkspaceReservasPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  // 1. Validar sesión multi-tenant con permisos de pedidos o mesas
  let session;
  try {
    session = await requireWorkspaceSession(businessId, "orders.view");
  } catch {
    session = await requireWorkspaceSession(businessId, "tables.view");
  }

  // 2. Consultar datos iniciales en paralelo
  const [initialReservations, initialMetrics, initialRooms, tablesRes] = await Promise.all([
    getReservations(businessId).catch(() => []),
    getReservationMetrics(businessId).catch(() => ({
      todayCount: 0,
      next7DaysCount: 0,
      walkInsCount: 0,
      occupancyRate: 0,
      totalGuestsToday: 0,
      confirmedTodayCount: 0,
      checkedInTodayCount: 0,
      seatedTodayCount: 0,
    })),
    getRestaurantRooms(businessId).catch(() => []),
    getRestaurantTablesWithOrders(businessId).catch(() => []),
  ]);

  return (
    <ReservationsDashboardClient
      businessId={businessId}
      initialReservations={initialReservations}
      initialMetrics={initialMetrics}
      initialRooms={initialRooms}
      initialTables={Array.isArray(tablesRes) ? tablesRes : []}
    />
  );
}
