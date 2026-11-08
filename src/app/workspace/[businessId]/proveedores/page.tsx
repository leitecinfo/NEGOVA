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
import { AppPageContainer } from "@/components/layout/app-page-container";
import { Building2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Directorio de Proveedores | Workspace NEGOVA",
  description: "Gestiona los proveedores de tu negocio, datos de contacto, estado comercial e integración con compras.",
};

export default async function WorkspaceProveedoresPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  // 1. Validar permisos de acceso al directorio de proveedores
  await requireWorkspaceSession(businessId, "suppliers.view");

  // 2. Garantizar ubicación por defecto si no existe de forma segura
  let locations: any[] = [];
  try {
    locations = await getBusinessLocations(businessId);
    if (!locations || locations.length === 0) {
      await ensureDefaultLocation(businessId);
      locations = await getBusinessLocations(businessId);
    }
  } catch (err) {
    console.warn("[WorkspaceProveedoresPage] Error al obtener ubicaciones:", err);
  }

  // 3. Carga resiliente de proveedores, compras y catálogo
  const [suppliers, purchases, accountsPayable, products, categories] = await Promise.all([
    getSuppliers(businessId).catch((err) => {
      console.warn("[WorkspaceProveedoresPage] Error al cargar proveedores:", err);
      return [];
    }),
    getPurchases(businessId, { period: "all" }).catch((err) => {
      console.warn("[WorkspaceProveedoresPage] Error al cargar compras:", err);
      return [];
    }),
    getAccountsPayable(businessId, { status: "all" }).catch((err) => {
      console.warn("[WorkspaceProveedoresPage] Error al cargar cuentas por pagar:", err);
      return [];
    }),
    getProducts(businessId).catch((err) => {
      console.warn("[WorkspaceProveedoresPage] Error al cargar productos:", err);
      return [];
    }),
    getCategories(businessId).catch((err) => {
      console.warn("[WorkspaceProveedoresPage] Error al cargar categorías:", err);
      return [];
    }),
  ]);

  const badge = (
    <div className="p-1.5 rounded-md bg-[#ED500A]/10 text-[#ED500A]">
      <Building2 className="w-4 h-4" />
    </div>
  );

  return (
    <AppPageContainer
      title="Proveedores"
      description="Gestiona tu directorio de distribuidores, condiciones comerciales, historial de compras y cuentas por pagar."
      badge={badge}
      maxWidth="7xl"
    >
      <WorkspaceProveedoresClient
        businessId={businessId}
        initialSuppliers={suppliers || []}
        initialPurchases={purchases || []}
        initialAccountsPayable={accountsPayable || []}
        products={products || []}
        locations={locations || []}
        categories={categories || []}
      />
    </AppPageContainer>
  );
}
