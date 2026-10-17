import React from "react";
import { Metadata } from "next";
import { Bell } from "lucide-react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { getNotifications } from "@/lib/notifications/notifications-service";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { WorkspaceNotificacionesClient } from "./workspace-notificaciones-client";

export const metadata: Metadata = {
  title: "Centro de Notificaciones | Workspace NEGOVA",
  description: "Historial de alertas, comprobantes generados, soporte y avisos de tu comercio.",
};

export default async function WorkspaceNotificacionesPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  // 1. Validar autorización de sesión en el negocio
  const session = await requireWorkspaceSession(businessId, "none");

  // 2. Cargar notificaciones del negocio para el usuario actual
  let initialNotifications: any[] = [];
  let initialError: string | null = null;
  try {
    initialNotifications = await getNotifications({
      scope: "business",
      businessId,
      currentUserId: session.userId,
      limit: 50,
    });
  } catch (err: any) {
    console.error("[WorkspaceNotificacionesPage Error]:", err);
    initialError = err?.message || "No fue posible cargar las notificaciones del comercio.";
  }

  return (
    <AppPageContainer
      title="Centro de Notificaciones"
      description="Supervisión de comprobantes, alertas operativas, soporte y avisos del sistema en tu comercio."
      badge={
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20">
          <Bell className="w-3.5 h-3.5" />
          Alertas del Comercio
        </span>
      }
    >
      <WorkspaceNotificacionesClient
        businessId={session.businessId}
        currentUserId={session.userId}
        initialNotifications={initialNotifications}
        initialError={initialError}
      />
    </AppPageContainer>
  );
}
