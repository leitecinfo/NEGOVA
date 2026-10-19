import React from "react";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { hasPlatformPermission } from "@/lib/auth/permissions";
import { getRestaurantOrderWithDetails } from "@/lib/restaurant/restaurant-service";
import { getBusinessDocumentConfig } from "@/lib/documents/document-service";
import { OrderDetailClient } from "./order-detail-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ businessId: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Detalle del Pedido | Workspace NEGOVA`,
    description: `Consulta y seguimiento de la orden ${id}.`,
  };
}

export default async function WorkspaceOrderDetailPage({
  params,
}: {
  params: Promise<{ businessId: string; id: string }>;
}) {
  const { businessId, id } = await params;

  // 1. Validar autorización multi-tenant para consultar pedidos (orders.view)
  const session = await requireWorkspaceSession(businessId, "orders.view");

  // 2. Obtener pedido y configuración comercial asegurando aislamiento multi-tenant
  const [order, config] = await Promise.all([
    getRestaurantOrderWithDetails(businessId, id),
    getBusinessDocumentConfig(businessId),
  ]);

  if (!order) {
    notFound();
  }

  const canUpdateOrder =
    session.isOwner ||
    hasPlatformPermission(session.roleCode, "orders.update") ||
    hasPlatformPermission(session.roleCode, "orders.manage");

  const canCancelOrder =
    session.isOwner || hasPlatformPermission(session.roleCode, "orders.cancel");

  return (
    <OrderDetailClient
      businessId={businessId}
      businessName={session.businessName}
      tradeName={config.tradeName || session.businessName}
      businessTimezone={session.businessTimezone || "America/Bogota"}
      initialOrder={order}
      config={config}
      canUpdateOrder={canUpdateOrder}
      canCancelOrder={canCancelOrder}
    />
  );
}
