import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import { UserPlus, Users } from "lucide-react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { getWorkspaceUsersList } from "@/lib/auth/workspace-users-service";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { Button } from "@/components/ui";
import { WorkspaceUsuariosClient } from "./workspace-usuarios-client";

export const metadata: Metadata = {
  title: "Gestión de Empleados | Workspace NEGOVA",
  description:
    "Administración de colaboradores, roles y accesos dentro del comercio.",
};

export default async function WorkspaceUsuariosPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  
  // 1. Validar autorización multi-tenant
  const session = await requireWorkspaceSession(businessId, "business_users.view");

  // 2. Obtener listado inicial de usuarios en el servidor
  let initialData = null;

  try {
    initialData = await getWorkspaceUsersList(businessId, { page: 1, pageSize: 10 });
  } catch (err) {
    console.error("[WorkspaceUsuariosPage Server Fetch Error]:", err);
  }

  return (
    <AppPageContainer
      title="Empleados"
      description="Administra los empleados y colaboradores que tienen acceso a este negocio."
      badge={
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400">
          <Users className="w-3.5 h-3.5" />
          Empleados del Comercio
        </span>
      }
      actions={
        <Button
          href={`/workspace/${businessId}/usuarios/nuevo`}
          variant="primary"
          size="md"
          leftIcon={<UserPlus className="w-4 h-4" />}
        >
          Invitar Empleado
        </Button>
      }
    >
      <WorkspaceUsuariosClient
        initialData={initialData}
        currentUserId={session.userId}
        businessId={session.businessId}
        businessName={session.businessName}
      />
    </AppPageContainer>
  );
}
