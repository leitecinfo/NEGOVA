import React from "react";
import { Metadata } from "next";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import {
  getRestaurantTablesWithOrders,
  getRestaurantTablesSummary,
} from "@/lib/restaurant/restaurant-service";
import { TablesDashboardClient } from "./tables-dashboard-client";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Mesas | NEGOVA",
    description: "Administración, disponibilidad y cuentas activas de mesas en salón.",
  };
}

export default async function WorkspaceMesasPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  // 1. Validar sesión multi-tenant y permisos de acceso (tables.view u orders.view)
  let session;
  try {
    session = await requireWorkspaceSession(businessId, "tables.view");
  } catch {
    session = await requireWorkspaceSession(businessId, "orders.view");
  }

  // 2. Determinar si el usuario tiene privilegios para administrar (crear/editar/eliminar) mesas
  const canManageTables =
    session.isOwner ||
    session.roleCode === "owner" ||
    session.roleCode === "admin" ||
    ["tables.create", "tables.manage", "orders.manage"].some((p) =>
      (session as any).permissions?.includes?.(p)
    );

  // 3. Consultar en paralelo las mesas con sus comandas activas y el resumen consolidado
  const [tables, summary] = await Promise.all([
    getRestaurantTablesWithOrders(businessId),
    getRestaurantTablesSummary(businessId),
  ]);

  return (
    <TablesDashboardClient
      businessId={businessId}
      businessName={session.businessName}
      initialTables={tables}
      initialSummary={summary}
      canManageTables={canManageTables}
    />
  );
}
