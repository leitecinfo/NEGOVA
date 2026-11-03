import React, { Suspense } from "react";
import { Metadata } from "next";
import Link from "next/link";
import { Bell, ArrowLeft } from "lucide-react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { getNotificationSettings } from "@/lib/notifications/notification-settings-service";
import { NotificationsConfigClient } from "./notifications-config-client";

export const metadata: Metadata = {
  title: "Plantillas de Notificación | Workspace NEGOVA",
  description: "Configura alertas automatizadas por WhatsApp y Email para pedidos QR, domicilios, stock bajo y arqueos de caja.",
};

interface PageProps {
  params: Promise<{ businessId: string }>;
}

export default async function WorkspaceNotificationsConfigPage({ params }: PageProps) {
  const { businessId } = await params;

  // 1. Autorización de lectura
  const session = await requireWorkspaceSession(businessId, "business_settings.view");

  // 2. Cargar configuración de notificaciones del negocio
  const initialSettings = await getNotificationSettings(businessId);

  // 3. Permiso de edición
  const canManage = session.isOwner || session.roleCode === "admin";

  return (
    <AppPageContainer
      title="Plantillas y Eventos de Notificación"
      description="Configura qué eventos generan avisos automáticos por WhatsApp y Email, edita el texto de las plantillas con variables dinámicas y define los roles destinatarios."
      badge={
        <div className="flex items-center gap-2">
          <Link
            href={`/workspace/${businessId}/configuracion`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/[0.04] hover:bg-slate-200 dark:hover:bg-white/[0.08] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Configuración
          </Link>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400">
            <Bell className="w-3.5 h-3.5" />
            Canales & Mensajería
          </span>
        </div>
      }
    >
      <Suspense
        fallback={
          <div className="py-12 text-center text-sm text-slate-500">
            Cargando configuración de notificaciones...
          </div>
        }
      >
        <NotificationsConfigClient
          businessId={businessId}
          businessName={session.businessName}
          initialSettings={initialSettings}
          canManage={canManage}
        />
      </Suspense>
    </AppPageContainer>
  );
}
