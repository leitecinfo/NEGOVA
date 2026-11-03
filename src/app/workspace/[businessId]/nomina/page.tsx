import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import { Wallet, Users } from "lucide-react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { hasPermission } from "@/lib/auth/authorization";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { WorkspaceNominaClient } from "./workspace-nomina-client";
import {
  getWorkspacePayrollPeriodsAction,
  getWorkspacePayrollPeriodDetailAction,
} from "./actions";
import { PayrollPeriodModel } from "@/lib/payroll/payroll-service";

export const metadata: Metadata = {
  title: "Nómina y Liquidaciones | Workspace NEGOVA",
  description: "Liquidación periódica de salarios, comprobantes de pago de colaboradores y control de egresos.",
};

export default async function WorkspaceNominaPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  // 1. Validar autorización de acceso al módulo de nómina
  const session = await requireWorkspaceSession(businessId, "payroll.view");

  // 2. Permisos específicos para liquidar, desembolsar y anular comprobantes
  const [canCalculate, canPay, canCancel] = await Promise.all([
    hasPermission(session.userId, "payroll.calculate", { businessId }),
    hasPermission(session.userId, "payroll.pay", { businessId }),
    hasPermission(session.userId, "payroll.cancel", { businessId }),
  ]);

  // 3. Cargar períodos iniciales y detalle del período más reciente
  let initialPeriods: PayrollPeriodModel[] = [];
  try {
    const res = await getWorkspacePayrollPeriodsAction(businessId);
    if (res.success && res.data) {
      initialPeriods = res.data;
      if (initialPeriods.length > 0) {
        const detailRes = await getWorkspacePayrollPeriodDetailAction(businessId, initialPeriods[0].id);
        if (detailRes.success && detailRes.data) {
          initialPeriods[0] = detailRes.data;
        }
      }
    }
  } catch (err) {
    console.error("[WorkspaceNominaPage Fetch Error]:", err);
  }

  return (
    <AppPageContainer
      title="Nómina y Liquidaciones"
      description="Control de períodos quincenales y mensuales, comprobantes de pago y registro financiero de egresos."
      badge={
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400">
          <Wallet className="w-3.5 h-3.5" />
          Remuneraciones & Pagos
        </span>
      }
      actions={
        <div className="flex items-center gap-2">
          <Link
            href={`/workspace/${businessId}/personal`}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-[0.98]"
          >
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Directorio de Personal</span>
          </Link>
        </div>
      }
    >
      <WorkspaceNominaClient
        initialPeriods={initialPeriods}
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
