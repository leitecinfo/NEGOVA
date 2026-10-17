import React from "react";
import { Metadata } from "next";
import { Users, UserPlus, Wallet } from "lucide-react";
import { requireAdminSession } from "@/lib/auth/admin-context";
import { getAdminEmployeesAction, getAdminPayrollPeriodsAction } from "./actions";
import { AdminPageContainer } from "@/components/admin/admin-page-container";
import { AdminPersonalClient } from "./admin-personal-client";

export const metadata: Metadata = {
  title: "Personal & Nómina Interna | Panel Administrativo NEGOVA",
  description: "Gestión de empleados internos de NEGOVA Core y liquidación de nómina corporativa.",
};

export default async function AdminPersonalPage() {
  const session = await requireAdminSession();

  let initialEmployees = null;
  let initialPeriods: any[] = [];

  try {
    const [empRes, perRes] = await Promise.all([
      getAdminEmployeesAction({ page: 1, pageSize: 20 }),
      getAdminPayrollPeriodsAction(),
    ]);

    if (empRes.success && empRes.data) {
      initialEmployees = empRes.data;
    }
    if (perRes.success && perRes.data) {
      initialPeriods = perRes.data;
    }
  } catch (err) {
    console.error("[AdminPersonalPage Fetch Error]:", err);
  }

  return (
    <AdminPageContainer
      title="Personal & Nómina de NEGOVA"
      description="Directorio de colaboradores internos de la plataforma, roles laborales y pagos corporativos."
      badge={
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-600 border border-purple-500/20 dark:text-purple-400">
          <Users className="w-3.5 h-3.5" />
          Operación Interna Core
        </span>
      }
    >
      <AdminPersonalClient
        initialEmployees={initialEmployees}
        initialPeriods={initialPeriods}
        isSuperAdmin={session.isSuperAdmin}
        currentUserId={session.id}
      />
    </AdminPageContainer>
  );
}
