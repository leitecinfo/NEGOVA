import React from "react";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { hasPlatformPermission } from "@/lib/auth/permissions";
import { getRestaurantOrderWithDetails } from "@/lib/restaurant/restaurant-service";
import { getBusinessDocumentConfig } from "@/lib/documents/document-service";
import { getPublicBusinessPaymentMethods } from "@/lib/payments/payment-methods-service";
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

  // 1. Carga paralela de sesión autorizada, pedido, configuración comercial y métodos de pago
  const [session, order, config, paymentMethods] = await Promise.all([
    requireWorkspaceSession(businessId, "orders.view"),
    getRestaurantOrderWithDetails(businessId, id),
    getBusinessDocumentConfig(businessId),
    getPublicBusinessPaymentMethods(businessId),
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

  const canRegisterPayment =
    session.isOwner ||
    hasPlatformPermission(session.roleCode, "orders.update") ||
    hasPlatformPermission(session.roleCode, "orders.manage") ||
    hasPlatformPermission(session.roleCode, "sales.create");

  return (
    <OrderDetailClient
      businessId={businessId}
      businessName={session.businessName}
      tradeName={config.tradeName || session.businessName}
      businessTimezone={session.businessTimezone || "America/Bogota"}
      initialOrder={order}
      config={config}
      paymentMethods={paymentMethods}
      canUpdateOrder={canUpdateOrder}
      canCancelOrder={canCancelOrder}
      canRegisterPayment={canRegisterPayment}
    />
  );
}
