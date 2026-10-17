import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import { Users, UserPlus, Calculator, Wallet } from "lucide-react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { hasPermission } from "@/lib/auth/authorization";
import { getWorkspaceEmployeesAction } from "./actions";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { WorkspacePersonalClient } from "./workspace-personal-client";

export const metadata: Metadata = {
  title: "Personal & Trabajadores | Workspace NEGOVA",
  description: "Fichas laborales, información de contacto, cuentas de pago y novedades del equipo.",
};

export default async function WorkspacePersonalPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  // 1. Validar autorización de acceso al módulo de personal
  const session = await requireWorkspaceSession(businessId, "staff.view");

  // Permisos específicos para salarios y nómina
  const [canCreateEmployee, canViewSalaries, canViewPayroll] = await Promise.all([
    hasPermission(session.userId, "staff.create", { businessId }),
    hasPermission(session.userId, "staff.salaries.view", { businessId }),
    hasPermission(session.userId, "payroll.view", { businessId }),
  ]);

  // 2. Cargar listado inicial
  let initialData = null;
  try {
    const res = await getWorkspaceEmployeesAction(businessId, { page: 1, pageSize: 20 });
    if (res.success) {
      initialData = res.data || null;
    }
  } catch (err) {
    console.error("[WorkspacePersonalPage Fetch Error]:", err);
  }

  return (
    <AppPageContainer
      title="Personal & Colaboradores"
      description="Directorio de trabajadores del comercio, cargos, datos laborales y novedades."
      badge={
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:text-blue-400">
          <Users className="w-3.5 h-3.5" />
          Equipo de Trabajo
        </span>
      }
      actions={
        <div className="flex items-center gap-2">
          {canViewPayroll && (
            <Link
              href={`/workspace/${businessId}/nomina`}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-[0.98]"
            >
              <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Ver Nómina</span>
            </Link>
          )}
        </div>
      }
    >
      <WorkspacePersonalClient
        initialData={initialData}
        businessId={businessId}
        businessName={session.businessName}
        isOwner={session.isOwner}
        canCreateEmployee={canCreateEmployee}
        canViewSalaries={canViewSalaries}
      />
    </AppPageContainer>
  );
}
