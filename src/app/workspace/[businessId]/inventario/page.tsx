import React from "react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import {
  getBusinessLocations,
  ensureDefaultLocation,
  getInventoryKPIs,
  getInventoryStock,
} from "@/lib/inventory/inventory-service";
import { getCategories, getProducts } from "@/lib/products/products-service";
import { getRecipes } from "@/lib/recipes/recipe-service";
import { RecipeWithDetails } from "@/lib/recipes/types";
import { Boxes } from "lucide-react";
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

  const [categories, products, kpis, stockList, recipes] = await Promise.all([
    getCategories(businessId),
    getProducts(businessId),
    getInventoryKPIs(businessId),
    getInventoryStock(businessId),
    getRecipes(businessId).catch((err) => {
      console.warn("[InventarioPage] Error al obtener recetas:", err);
      return [] as RecipeWithDetails[];
    }),
  ]);

  const badge = (
    <div className="p-1.5 rounded-md bg-orange-50 dark:bg-orange-500/10 text-[#ED500A]">
      <Boxes className="w-4 h-4" />
    </div>
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
        recipes={recipes}
      />
    </AppPageContainer>
  );
}
