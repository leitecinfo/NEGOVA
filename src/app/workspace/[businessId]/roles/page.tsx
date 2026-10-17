import React from "react";
import { Metadata } from "next";
import { ShieldCheck, Lock } from "lucide-react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { getWorkspaceRolesAction } from "./actions";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { WorkspaceRolesClient } from "./workspace-roles-client";

export const metadata: Metadata = {
  title: "Roles y Permisos | Workspace NEGOVA",
  description:
    "Consulta y administración de capacidades y accesos de los colaboradores del negocio.",
};

export default async function WorkspaceRolesPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  // 1. Validar autorización multi-tenant de sesión
  const session = await requireWorkspaceSession(businessId, "business_users.view");

  // 2. Obtener roles y matriz de permisos para este negocio
  const rolesResult = await getWorkspaceRolesAction(businessId);
  const roles = rolesResult.success && rolesResult.data ? rolesResult.data : [];

  return (
    <AppPageContainer
      title="Roles y permisos"
      description="Consulta las capacidades y accesos operativos asignados a los colaboradores de tu negocio."
      badge={
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          Seguridad y Capacidades
        </span>
      }
    >
      <WorkspaceRolesClient
        initialRoles={roles}
        businessId={session.businessId}
        businessType={session.businessType || rolesResult.businessType || "restaurant"}
      />
    </AppPageContainer>
  );
}
