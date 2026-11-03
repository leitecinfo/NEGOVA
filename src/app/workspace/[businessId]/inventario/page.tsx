import React from "react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import {
  getBusinessLocations,
  ensureDefaultLocation,
  getInventoryKPIs,
  getInventoryStock,
} from "@/lib/inventory/inventory-service";
import { getCategories, getProducts } from "@/lib/products/products-service";
import { WorkspaceInventarioClient } from "./workspace-inventario-client";
import { AppPageContainer } from "@/components/layout/app-page-container";

export default async function InventarioPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  // Validar permisos de acceso al módulo de inventario
  await requireWorkspaceSession(businessId, "inventory.view");

  let locations = await getBusinessLocations(businessId);
  if (!locations || locations.length === 0) {
    await ensureDefaultLocation(businessId);
    locations = await getBusinessLocations(businessId);
  }

  const [categories, products, kpis, stockList] = await Promise.all([
    getCategories(businessId),
    getProducts(businessId),
    getInventoryKPIs(businessId),
    getInventoryStock(businessId),
  ]);

  const badge = (
    <span className="text-2xs font-bold uppercase tracking-wider text-[#ED500A] bg-[#ED500A]/10 px-2.5 py-1 rounded-md border border-[#ED500A]/20">
      Operación de Inventario
    </span>
  );

  return (
    <AppPageContainer
      title="Inventario"
      description="Controla existencias y movimientos desde un solo lugar."
      badge={badge}
      maxWidth="7xl"
    >
      <WorkspaceInventarioClient
        businessId={businessId}
        initialLocations={locations}
        categories={categories}
        products={products}
        initialKPIs={kpis}
        initialStock={stockList}
      />
    </AppPageContainer>
  );
}
