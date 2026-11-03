import React, { Suspense } from "react";
import { Metadata } from "next";
import Link from "next/link";
import { Globe, ArrowLeft } from "lucide-react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { getBusinessLinksPageConfig } from "@/lib/links/links-service";
import { LinksPageConfigClient } from "./links-page-config-client";

export const metadata: Metadata = {
  title: "Página de Enlaces (Bio Links) | Workspace NEGOVA",
  description: "Configura tu página de enlaces tipo Linktree para Instagram, TikTok y WhatsApp con tu menú digital y pedidos a domicilio.",
};

interface PageProps {
  params: Promise<{ businessId: string }>;
}

export default async function WorkspaceLinksPageConfigPage({ params }: PageProps) {
  const { businessId } = await params;

  // 1. Autorización de lectura en configuración
  await requireWorkspaceSession(businessId, "business_settings.view");

  // 2. Cargar configuración de enlaces del comercio
  const initialConfig = await getBusinessLinksPageConfig(businessId);

  return (
    <AppPageContainer
      title="Página de Enlaces (Bio Links)"
      description="Crea tu enlace único para biografías de Instagram, TikTok y perfiles de WhatsApp. Centraliza el acceso al menú digital, domicilios, mapas y redes oficiales."
      badge={
        <div className="flex items-center gap-2">
          <Link
            href={`/workspace/${businessId}/configuracion`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/[0.04] hover:bg-slate-200 dark:hover:bg-white/[0.08] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Configuración
          </Link>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-600 border border-purple-500/20 dark:text-purple-400">
            <Globe className="w-3.5 h-3.5" />
            Presencia Digital & Enlaces
          </span>
        </div>
      }
    >
      <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Cargando configuración de enlaces...</div>}>
        <LinksPageConfigClient
          initialConfig={initialConfig}
          businessId={businessId}
        />
      </Suspense>
    </AppPageContainer>
  );
}
