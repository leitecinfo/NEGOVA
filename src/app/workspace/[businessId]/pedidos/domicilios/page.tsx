import React from "react";
import { Metadata } from "next";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { getBusinessDeliveryOrders, getOperationalDeliveryDrivers } from "@/lib/delivery/delivery-service";
import { getBusinessDocumentConfig } from "@/lib/documents/document-service";
import { DeliveriesClient } from "./deliveries-client";

export const metadata: Metadata = {
  title: "Gestión de Domicilios | Workspace NEGOVA",
  description: "Despacho operativo de pedidos, asignación de domiciliarios y verificación de entrega.",
};

export default async function WorkspaceDeliveriesPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  // 1. Validar autorización multi-tenant (orders.view)
  const session = await requireWorkspaceSession(businessId, "orders.view");

  // 2. Cargar en paralelo órdenes de entrega, repartidores configurados y configuración de marca
  const [deliveryOrders, drivers, config] = await Promise.all([
    getBusinessDeliveryOrders(businessId),
    getOperationalDeliveryDrivers(businessId),
    getBusinessDocumentConfig(businessId),
  ]);

  return (
    <DeliveriesClient
      businessId={businessId}
      businessName={session.businessName}
      tradeName={config.tradeName || session.businessName}
      businessTimezone={session.businessTimezone || "America/Bogota"}
      initialOrders={deliveryOrders}
      initialDrivers={drivers}
      config={config}
    />
  );
}
