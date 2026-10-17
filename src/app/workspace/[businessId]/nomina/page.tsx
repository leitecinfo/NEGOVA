import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import { Wallet, Users, ArrowLeft, Plus } from "lucide-react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { hasPermission } from "@/lib/auth/authorization";
import { getWorkspacePayrollPeriodsAction } from "../personal/actions";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { WorkspaceNominaClient } from "./workspace-nomina-client";

export const metadata: Metadata = {
  title: "Nómina & Pagos | Workspace NEGOVA",
  description: "Liquidación de períodos, cálculo de remuneraciones, comprobantes de pago e integración con gastos.",
};

export default async function WorkspaceNominaPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  // 1. Validar autorización de nómina
  const session = await requireWorkspaceSession(businessId, "payroll.view");

  const [canCalculate, canPay, canCancel] = await Promise.all([
    hasPermission(session.userId, "payroll.calculate", { businessId }),
    hasPermission(session.userId, "payroll.pay", { businessId }),
    hasPermission(session.userId, "payroll.cancel", { businessId }),
  ]);

  let periods: any[] = [];
  try {
    const res = await getWorkspacePayrollPeriodsAction(businessId);
    if (res.success && res.data) {
      periods = res.data;
    }
  } catch (err) {
    console.error("[WorkspaceNominaPage Error]:", err);
  }

  return (
    <AppPageContainer
      title="Nómina & Pagos de Personal"
      description="Liquidación de sueldos, novedades, comprobantes y registro de desembolsos integrado a gastos."
      badge={
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400">
          <Wallet className="w-3.5 h-3.5" />
          Finanzas & Nómina
        </span>
      }
      actions={
        <div className="flex items-center gap-2">
          <Link
            href={`/workspace/${businessId}/personal`}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Directorio de Personal</span>
          </Link>
        </div>
      }
    >
      <WorkspaceNominaClient
        initialPeriods={periods}
        businessId={businessId}
        businessName={session.businessName}
        isOwner={session.isOwner}
        canCalculate={canCalculate}
        canPay={canPay}
        canCancel={canCancel}
      />
    </AppPageContainer>
  );
}
