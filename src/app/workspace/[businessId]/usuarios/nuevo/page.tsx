import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { WorkspaceUserFormClient } from "./workspace-user-form-client";
import { BUSINESS_ROLES_CATALOG } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  title: "Nuevo Empleado | Workspace NEGOVA",
  description: "Registrar un nuevo empleado para el negocio.",
};

export default async function WorkspaceNuevoUsuarioPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const session = await requireWorkspaceSession(businessId, "business_users.create");

  // En el flujo de creación de empleados desde Workspace solo se permite el rol 'auxiliar'
  const businessRoles = BUSINESS_ROLES_CATALOG.filter(
    (r) => r.code === "auxiliar"
  );

  return (
    <AppPageContainer
      title="Invitar Empleado"
      description="Registra una nueva cuenta de acceso para el personal de tu negocio."
      maxWidth="5xl"
      badge={
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
          <UserPlus className="w-3.5 h-3.5" />
          Nuevo Empleado
        </span>
      }
      actions={
        <Link
          href={`/workspace/${businessId}/usuarios`}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a Empleados</span>
        </Link>
      }
    >
      <WorkspaceUserFormClient
        businessId={businessId}
        businessRoles={businessRoles}
      />
    </AppPageContainer>
  );
}
