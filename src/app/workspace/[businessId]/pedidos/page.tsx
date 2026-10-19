import React from "react";
import { Metadata } from "next";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { hasPlatformPermission } from "@/lib/auth/permissions";
import {
  getRestaurantOrdersList,
  getRestaurantOrdersSummary,
} from "@/lib/restaurant/restaurant-service";
import { OrdersListClient } from "./orders-list-client";

export const metadata: Metadata = {
  title: "Gestión de Pedidos | Workspace NEGOVA",
  description: "Centro operativo de seguimiento y preparación de comandas.",
};

export default async function WorkspaceOrdersListPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { businessId } = await params;
  const sParams = await searchParams;

  // 1. Validar autorización multi-tenant para consultar pedidos (orders.view)
  const session = await requireWorkspaceSession(businessId, "orders.view");

  // 2. Extraer parámetros de filtrado y paginación
  const search = typeof sParams.search === "string" ? sParams.search : undefined;
  const status = typeof sParams.status === "string" ? sParams.status : undefined;
  const paymentStatus = typeof sParams.paymentStatus === "string" ? sParams.paymentStatus : undefined;
  const orderType = typeof sParams.orderType === "string" ? sParams.orderType : undefined;
  const channelOrigin = typeof sParams.channelOrigin === "string" ? sParams.channelOrigin : undefined;
  const startDate = typeof sParams.startDate === "string" ? sParams.startDate : undefined;
  const endDate = typeof sParams.endDate === "string" ? sParams.endDate : undefined;
  const page = typeof sParams.page === "string" ? Math.max(1, parseInt(sParams.page, 10) || 1) : 1;

  // 3. Consultar listado y resumen cuantitativo en paralelo
  const [listResult, summaryResult] = await Promise.all([
    getRestaurantOrdersList({
      businessId,
      search,
      status,
      paymentStatus,
      orderType,
      channelOrigin,
      startDate,
      endDate,
      page,
      pageSize: 30,
    }),
    getRestaurantOrdersSummary(businessId),
  ]);

  const canUpdateOrder =
    session.isOwner ||
    hasPlatformPermission(session.roleCode, "orders.update") ||
    hasPlatformPermission(session.roleCode, "orders.manage");

  const canCancelOrder =
    session.isOwner || hasPlatformPermission(session.roleCode, "orders.cancel");

  return (
    <OrdersListClient
      businessId={businessId}
      businessName={session.businessName}
      businessTimezone={session.businessTimezone || "America/Bogota"}
      initialData={listResult}
      summary={summaryResult}
      canUpdateOrder={canUpdateOrder}
      canCancelOrder={canCancelOrder}
      filters={{
        search: search || "",
        status: status || "all",
        paymentStatus: paymentStatus || "all",
        orderType: orderType || "all",
        channelOrigin: channelOrigin || "all",
        startDate: startDate || "",
        endDate: endDate || "",
      }}
    />
  );
}
