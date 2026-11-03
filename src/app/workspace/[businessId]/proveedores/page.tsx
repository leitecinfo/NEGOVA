import React from "react";
import { Metadata } from "next";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import {
  getSuppliers,
  getPurchases,
  getAccountsPayable,
} from "@/lib/purchases/purchases-service";
import { getBusinessLocations, ensureDefaultLocation } from "@/lib/inventory/inventory-service";
import { getProducts, getCategories } from "@/lib/products/products-service";
import { WorkspaceProveedoresClient } from "./workspace-proveedores-client";

export const metadata: Metadata = {
  title: "Directorio de Proveedores y Cuentas por Pagar | Workspace NEGOVA",
  description: "Gestiona distribuidores comerciales, acuerdos de crédito, compras acumuladas y pagos pendientes.",
};

export default async function WorkspaceProveedoresPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  // 1. Validar permisos de acceso al directorio de proveedores
  await requireWorkspaceSession(businessId, "suppliers.view");

  // 2. Garantizar ubicación por defecto si no existe
  let locations = await getBusinessLocations(businessId);
  if (!locations || locations.length === 0) {
    await ensureDefaultLocation(businessId);
    locations = await getBusinessLocations(businessId);
  }

  // 3. Carga en paralelo de proveedores, historial de compras, cuentas por pagar y catálogo
  const [suppliers, purchases, accountsPayable, products, categories] = await Promise.all([
    getSuppliers(businessId),
    getPurchases(businessId, { period: "all" }),
    getAccountsPayable(businessId, { status: "all" }),
    getProducts(businessId),
    getCategories(businessId),
  ]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      <WorkspaceProveedoresClient
        businessId={businessId}
        initialSuppliers={suppliers}
        initialPurchases={purchases}
        initialAccountsPayable={accountsPayable}
        products={products}
        locations={locations}
        categories={categories}
      />
    </div>
  );
}
