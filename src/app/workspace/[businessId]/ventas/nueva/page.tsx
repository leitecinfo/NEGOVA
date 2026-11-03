import React from "react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { getBusinessDocumentConfig } from "@/lib/documents/document-service";
import { getProducts, getCategories } from "@/lib/products/products-service";
import { getRestaurantTables } from "@/lib/restaurant/restaurant-service";
import { getPosCashContext } from "@/lib/cash/cash-service";
import { NewSaleViewClient } from "./new-sale-view-client";

import { getPublicBusinessPaymentMethods } from "@/lib/payments/payment-methods-service";

export default async function WorkspaceNewSalePage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  // 1. Validar autorización multi-tenant para registrar ventas (sales.create)
  const session = await requireWorkspaceSession(businessId, "sales.create");

  // 2. Obtener configuración comercial, catálogo de productos, categorías, mesas, métodos de pago activos y turno de caja
  const [config, products, categories, tables, paymentMethods, cashContext] = await Promise.all([
    getBusinessDocumentConfig(businessId),
    getProducts(businessId, { status: "active" }),
    getCategories(businessId),
    getRestaurantTables(businessId),
    getPublicBusinessPaymentMethods(businessId),
    getPosCashContext(businessId, session.userId),
  ]);

  return (
    <NewSaleViewClient
      businessId={businessId}
      businessName={session.businessName}
      tradeName={config.tradeName}
      primaryColor={config.primaryColor}
      initialProducts={products}
      initialCategories={categories}
      initialTables={tables}
      initialCashRegisters={cashContext.registers}
      initialActiveSession={cashContext.activeSession}
      initialCashBalance={cashContext.currentCashBalance}
      posSettings={(session.businessSettings?.pos as any) || undefined}
      paymentMethods={paymentMethods}
    />
  );
}
