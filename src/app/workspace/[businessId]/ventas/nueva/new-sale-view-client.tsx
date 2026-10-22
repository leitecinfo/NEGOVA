"use client";

import React, { useState } from "react";
import { PosScreenClient } from "@/components/pos/pos-screen-client";
import { NewSaleFormClient } from "./new-sale-form-client";
import { Product, Category } from "@/lib/products/types";
import { RestaurantTable } from "@/lib/restaurant/types";

import { PublicPaymentMethodDTO } from "@/lib/payments/types";

interface NewSaleViewClientProps {
  businessId: string;
  businessName: string;
  tradeName: string;
  primaryColor?: string;
  initialProducts: Product[];
  initialCategories: Category[];
  initialTables?: RestaurantTable[];
  posSettings?: {
    printReceipt?: boolean;
    receiptCopies?: number;
    defaultPaymentMethod?: "cash" | "transfer" | "card";
    askCustomerName?: boolean;
  };
  paymentMethods?: PublicPaymentMethodDTO[];
}

export function NewSaleViewClient({
  businessId,
  businessName,
  tradeName,
  primaryColor,
  initialProducts,
  initialCategories,
  initialTables = [],
  posSettings,
  paymentMethods,
}: NewSaleViewClientProps) {
  // Por defecto, abre la interfaz ágil de POS si hay productos o se accede a nueva venta
  const [mode, setMode] = useState<"pos" | "manual">("pos");

  if (mode === "manual") {
    return (
      <NewSaleFormClient
        businessId={businessId}
        businessName={businessName}
        tradeName={tradeName}
        primaryColor={primaryColor}
        onSwitchToPos={() => setMode("pos")}
        posSettings={posSettings}
        paymentMethods={paymentMethods}
      />
    );
  }

  return (
    <PosScreenClient
      businessId={businessId}
      businessName={businessName}
      tradeName={tradeName}
      primaryColor={primaryColor}
      initialProducts={initialProducts}
      initialCategories={initialCategories}
      initialTables={initialTables}
      onSwitchToManualForm={() => setMode("manual")}
    />
  );
}
