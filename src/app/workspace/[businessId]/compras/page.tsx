import React from "react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { getBusinessLocations, ensureDefaultLocation } from "@/lib/inventory/inventory-service";
import { getProducts, getCategories } from "@/lib/products/products-service";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { ShoppingCart } from "lucide-react";
import { InventoryPurchasesTab } from "./inventory-purchases-tab";

interface PageProps {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ productId?: string }>;
}

export default async function ComprasPage({ params, searchParams }: PageProps) {
  const { businessId } = await params;
  const { productId } = await searchParams;

  // Validar permisos de acceso
  await requireWorkspaceSession(businessId, "purchases.view");

  let locations = await getBusinessLocations(businessId);
  if (!locations || locations.length === 0) {
    await ensureDefaultLocation(businessId);
    locations = await getBusinessLocations(businessId);
  }

  const [products, categories] = await Promise.all([
    getProducts(businessId),
    getCategories(businessId),
  ]);

  const badge = (
    <div className="p-1.5 rounded-md bg-[#ED500A]/10 text-[#ED500A]">
      <ShoppingCart className="w-4 h-4" />
    </div>
  );

  return (
    <AppPageContainer
      title="Compras"
      description="Controla tus compras de contado y a crédito, egresos automáticos de caja y existencias de inventario."
      badge={badge}
      maxWidth="7xl"
    >
      <InventoryPurchasesTab
        businessId={businessId}
        products={products}
        locations={locations}
        categories={categories}
        initialProductId={productId || null}
      />
    </AppPageContainer>
  );
}

