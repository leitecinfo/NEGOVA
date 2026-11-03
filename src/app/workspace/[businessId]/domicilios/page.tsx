import React from "react";
import { Metadata } from "next";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import {
  getBusinessDeliveryOrders,
  getOperationalDeliveryDrivers,
  getDeliveryBusinessConfig,
} from "@/lib/delivery/delivery-service";
import { getBusinessDocumentConfig } from "@/lib/documents/document-service";
import { WorkspaceDomiciliosClient } from "@/components/delivery/workspace-domicilios-client";

export const metadata: Metadata = {
  title: "Gestión de Domicilios y Reparto | Workspace NEGOVA",
  description: "Despacho operativo de pedidos, asignación de domiciliarios, control de ruta y verificación con PIN.",
};

export default async function WorkspaceDomiciliosPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { businessId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  let defaultTab: "dispatch" | "drivers" | "settlement" | "zones" = "dispatch";
  const tabParam = resolvedSearchParams.tab?.toLowerCase();
  if (tabParam === "repartidores" || tabParam === "drivers" || tabParam === "by_driver") {
    defaultTab = "drivers";
  } else if (tabParam === "liquidacion" || tabParam === "settlement" || tabParam === "arqueo") {
    defaultTab = "settlement";
  } else if (tabParam === "zonas" || tabParam === "zones" || tabParam === "config") {
    defaultTab = "zones";
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
    <WorkspaceDomiciliosClient
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
