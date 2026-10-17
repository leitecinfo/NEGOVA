import React from "react";
import { Metadata } from "next";
import { Headphones } from "lucide-react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { getBusinessSupportTickets } from "@/lib/support/support-service";
import { WorkspaceSoporteClient } from "./soporte-client";

export const metadata: Metadata = {
  title: "Mesa de Ayuda y Soporte | Workspace NEGOVA",
  description: "Gestión de solicitudes de soporte y atención técnica para tu comercio.",
};

export default async function WorkspaceSoportePage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  // 1. Validar sesión y membresía activa en el negocio
  const session = await requireWorkspaceSession(businessId, "none");

  // 2. Obtener solicitudes de soporte persistidas para este negocio (Multi-Tenant)
  const initialTickets = await getBusinessSupportTickets(session.businessId);

  return (
    <AppPageContainer
      title="Mesa de Ayuda y Soporte"
      description="Canal directo para solicitar asistencia técnica, resolver dudas operativas y hacer seguimiento a tus casos en NEGOVA."
      badge={
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-orange-500/10 text-[#ED500A] border border-orange-500/20 dark:text-orange-400">
          <Headphones className="w-3.5 h-3.5" />
          Atención al Comercio
        </span>
      }
      maxWidth="6xl"
    >
      <WorkspaceSoporteClient
        businessId={session.businessId}
        businessName={session.businessName}
        initialTickets={initialTickets}
      />
    </AppPageContainer>
  );
}
