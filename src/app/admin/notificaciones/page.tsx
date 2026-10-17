import React from "react";
import { Metadata } from "next";
import { Bell, ShieldCheck } from "lucide-react";
import { requireAdminSession } from "@/lib/auth/admin-context";
import { getPlatformNotifications } from "@/lib/notifications/notifications-service";
import { AdminPageContainer } from "@/components/admin/admin-page-container";
import { NotificacionesClient } from "./notificaciones-client";

export const metadata: Metadata = {
  title: "Centro de Notificaciones | Panel Administrativo NEGOVA",
  description:
    "Supervisión y auditoría en tiempo real de altas de usuarios, registros de comercios y alertas del sistema.",
};

export default async function AdminNotificacionesPage() {
  const session = await requireAdminSession();

  let initialNotifications: any[] = [];
  let initialError: string | null = null;
  try {
    initialNotifications = await getPlatformNotifications({ limit: 50 });
  } catch (err: any) {
    console.error("[AdminNotificacionesPage Error]:", err);
    initialError = err?.message || "No fue posible cargar las notificaciones de la plataforma.";
  }

  return (
    <AdminPageContainer
      title="Centro de Notificaciones"
      description="Supervisión en tiempo real de nuevos usuarios, negocios dados de alta y eventos de la plataforma."
      badge={
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20">
          <Bell className="w-3.5 h-3.5" />
          Eventos en Vivo
        </span>
      }
    >
      <NotificacionesClient
        currentUser={session}
        initialNotifications={initialNotifications}
        initialError={initialError}
      />
    </AdminPageContainer>
  );
}
