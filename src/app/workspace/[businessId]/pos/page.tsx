import React from "react";
import { Metadata } from "next";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { getBusinessDocumentConfig } from "@/lib/documents/document-service";
import { getProducts, getCategories } from "@/lib/products/products-service";
import { getRestaurantTables } from "@/lib/restaurant/restaurant-service";
import { PosScreenClient } from "@/components/pos/pos-screen-client";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Vender | NEGOVA",
    description: "Módulo mobile-first de punto de venta y toma de ventas multicanal.",
  };
}

export default async function WorkspacePosPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams?: Promise<{ tableId?: string }>;
}) {
  const { businessId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialTableId = resolvedSearchParams?.tableId;

  // 1. Validar autorización multi-tenant (admite sales.create u orders.create)
  let session;
  try {
    session = await requireWorkspaceSession(businessId, "sales.create");
  } catch {
    session = await requireWorkspaceSession(businessId, "orders.create");
  }

  // 2. Obtener configuración comercial, catálogo de productos activos, categorías y mesas en paralelo
  const [config, products, categories, tables] = await Promise.all([
    getBusinessDocumentConfig(businessId),
    getProducts(businessId, { status: "active" }),
    getCategories(businessId),
    getRestaurantTables(businessId),
  ]);

  return (
    <PosScreenClient
      businessId={businessId}
      businessName={session.businessName}
      tradeName={config.tradeName}
      primaryColor={config.primaryColor}
      initialProducts={products}
      initialCategories={categories}
      initialTables={tables}
      initialSelectedTableId={initialTableId}
    />
  );
}
