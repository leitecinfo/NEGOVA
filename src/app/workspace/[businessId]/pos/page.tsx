import React from "react";
import { Metadata } from "next";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { getBusinessDocumentConfig } from "@/lib/documents/document-service";
import { getProducts, getCategories } from "@/lib/products/products-service";
import { getRestaurantTables } from "@/lib/restaurant/restaurant-service";
import { getPosCashContext } from "@/lib/cash/cash-service";
import { getPublicBusinessPaymentMethods } from "@/lib/payments/payment-methods-service";
import { getQuotationById } from "@/lib/quotations/quotations-service";
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
  searchParams?: Promise<{ tableId?: string; quotationId?: string }>;
}) {
  const { businessId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialTableId = resolvedSearchParams?.tableId;
  const initialQuotationId = resolvedSearchParams?.quotationId;

  // 1. Validar autorización multi-tenant (admite sales.create u orders.create)
  let session;
  try {
    session = await requireWorkspaceSession(businessId, "sales.create");
  } catch {
    session = await requireWorkspaceSession(businessId, "orders.create");
  }

  // 2. Obtener configuración comercial, catálogo de productos activos en canal POS, categorías, mesas, métodos de pago, contexto de caja y cotización opcional en paralelo
  const [config, products, categories, tables, paymentMethods, cashContext, initialQuotation] = await Promise.all([
    getBusinessDocumentConfig(businessId),
    getProducts(businessId, { status: "active", channel: "pos" }),
    getCategories(businessId),
    getRestaurantTables(businessId),
    getPublicBusinessPaymentMethods(businessId).catch(() => []),
    getPosCashContext(businessId, session.userId),
    initialQuotationId ? getQuotationById(businessId, initialQuotationId).catch(() => null) : Promise.resolve(null),
  ]);

  return (
    <PosScreenClient
      businessId={businessId}
      businessName={session.businessName}
      cashierName={session.userEmail ? session.userEmail.split("@")[0] : session.businessName}
      tradeName={config.tradeName}
      primaryColor={config.primaryColor}
      initialProducts={products}
      initialCategories={categories}
      initialTables={tables}
      initialSelectedTableId={initialTableId}
      initialCashRegisters={cashContext.registers}
      initialActiveSession={cashContext.activeSession}
      initialCashBalance={cashContext.currentCashBalance}
      initialPaymentMethods={paymentMethods}
      initialQuotation={initialQuotation}
    />
  );
}
