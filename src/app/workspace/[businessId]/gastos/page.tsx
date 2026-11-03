import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import { DollarSign, ShoppingCart, Truck, ArrowLeftRight } from "lucide-react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { hasPermission } from "@/lib/auth/authorization";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { WorkspaceGastosClient } from "./workspace-gastos-client";
import {
  getUnifiedMovementsAction,
  getSuppliersAndProductsForExpensesAction,
} from "./actions";
import { UnifiedMovement } from "@/lib/expenses/types";

export const metadata: Metadata = {
  title: "Ingresos y Egresos | Workspace NEGOVA",
  description: "Control financiero unificado de ingresos, egresos operativos, costos de producción y movimientos de caja.",
};

export default async function WorkspaceGastosPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  // 1. Validar autorización de acceso al módulo de finanzas / gastos
  const session = await requireWorkspaceSession(businessId, "expenses.view");

  // 2. Permisos específicos granulares
  const [canCreate, canEdit, canDelete] = await Promise.all([
    hasPermission(session.userId, "expenses.create", { businessId }),
    hasPermission(session.userId, "expenses.update", { businessId }),
    hasPermission(session.userId, "expenses.delete", { businessId }),
  ]);

  // 3. Cargar movimientos unificados y catálogo auxiliar
  let initialMovements: UnifiedMovement[] = [];
  let suppliers: Array<{ id: string; name: string }> = [];

  try {
    const [movRes, suppRes] = await Promise.all([
      getUnifiedMovementsAction(businessId),
      getSuppliersAndProductsForExpensesAction(businessId),
    ]);
    if (movRes.success) initialMovements = movRes.data || [];
    if (suppRes.success && suppRes.suppliers) suppliers = suppRes.suppliers;
  } catch (err) {
    console.error("[WorkspaceGastosPage Fetch Error]:", err);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      <WorkspaceGastosClient
        businessId={businessId}
        businessName={session.businessName}
        initialMovements={initialMovements}
        suppliers={suppliers}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </div>
  );
}
