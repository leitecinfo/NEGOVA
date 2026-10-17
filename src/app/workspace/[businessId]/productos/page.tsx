import React from "react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { getProducts, getCategories } from "@/lib/products/products-service";
import { ProductsManagerClient } from "./products-manager-client";
import { Store, UtensilsCrossed } from "lucide-react";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { getCatalogModuleLabel } from "@/config/commercial-activities";

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  // Validate session and permission
  const session = await requireWorkspaceSession(businessId, "products.view");

  // Fetch initial data (auto-inicializa categorías con plantilla si el negocio no tiene ninguna)
  const [products, categories] = await Promise.all([
    getProducts(businessId),
    getCategories(businessId, session.businessType),
  ]);

  const pageTitle = getCatalogModuleLabel(session.commercialActivities, session.businessType);
  const isFood = (session.businessType || "").toLowerCase().includes("food") ||
    (session.businessType || "").toLowerCase().includes("rest") ||
    (session.businessType || "").toLowerCase().includes("comida");

  const badge = (
    <div className="p-1.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
      {isFood ? <UtensilsCrossed className="w-4 h-4" /> : <Store className="w-4 h-4" />}
    </div>
  );

  return (
    <AppPageContainer
      title={pageTitle}
      description={
        isFood
          ? "Administra tu menú, preparaciones, variantes, adicionales y disponibilidad para el punto de venta."
          : "Administra tu catálogo comercial, precios y disponibilidad en tiempo real."
      }
      badge={badge}
      maxWidth="7xl"
    >
      <ProductsManagerClient 
        businessId={businessId} 
        businessType={session.businessType || "fast_food"}
        commercialActivities={session.commercialActivities}
        initialProducts={products} 
        initialCategories={categories} 
      />
    </AppPageContainer>
  );
}
