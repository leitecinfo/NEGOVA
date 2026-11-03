import React from "react";
import { Metadata } from "next";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import {
  getBusinessDeliveryOrders,
  getOperationalDeliveryDrivers,
  getDeliveryBusinessConfig,
} from "@/lib/delivery/delivery-service";
import { getBusinessDocumentConfig } from "@/lib/documents/document-service";
import { DeliveriesClient } from "./deliveries-client";

export const metadata: Metadata = {
  title: "Gestión de Domicilios | Workspace NEGOVA",
  description: "Despacho operativo de pedidos, asignación de domiciliarios y verificación de entrega.",
};

export default async function WorkspaceDeliveriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { businessId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  let defaultTab: "orders" | "by_driver" | "zones" | "config" = "orders";
  if (resolvedSearchParams.tab === "repartidores" || resolvedSearchParams.tab === "by_driver") {
    defaultTab = "by_driver";
  } else if (resolvedSearchParams.tab === "zonas" || resolvedSearchParams.tab === "zones") {
    defaultTab = "zones";
  } else if (resolvedSearchParams.tab === "config") {
    defaultTab = "config";
  }

  // 1. Validar autorización multi-tenant (orders.view)
  const session = await requireWorkspaceSession(businessId, "orders.view");

  // 2. Cargar en paralelo órdenes de entrega, repartidores configurados, configuración de marca y delivery
  const [deliveryOrders, drivers, config, deliveryConfig] = await Promise.all([
    getBusinessDeliveryOrders(businessId),
    getOperationalDeliveryDrivers(businessId),
    getBusinessDocumentConfig(businessId),
    getDeliveryBusinessConfig(businessId),
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
      initialDeliveryConfig={deliveryConfig}
      defaultTab={defaultTab}
    />
  );
}
