import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import { HelpCircle, ArrowLeft } from "lucide-react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { WorkspaceHelpClient } from "./workspace-help-client";

export const metadata: Metadata = {
  title: "Centro de Ayuda y Tutoriales | Workspace NEGOVA",
  description: "Guías paso a paso, preguntas frecuentes y asistencia técnica para operar tu negocio en NEGOVA.",
};

interface PageProps {
  params: Promise<{ businessId: string }>;
  searchParams?: Promise<{ context?: string }>;
}

export default async function WorkspaceHelpPage({ params, searchParams }: PageProps) {
  const { businessId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const context = resolvedSearchParams.context || "pos";

  // 1. Autorización estricta de workspace
  const session = await requireWorkspaceSession(businessId, "business_settings.view");

  return (
    <AppPageContainer
      title="Centro de Ayuda y Aprendizaje"
      description="Consulta guías paso a paso para todos los módulos, preguntas frecuentes de operación diaria y contacta a soporte técnico."
      badge={
        <div className="flex items-center gap-2">
          <Link
            href={`/workspace/${businessId}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/[0.04] hover:bg-slate-200 dark:hover:bg-white/[0.08] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Workspace
          </Link>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-orange-500/10 text-[#ED500A] border border-[#ED500A]/20">
            <HelpCircle className="w-3.5 h-3.5" />
            Guías & Soporte
          </span>
        </div>
      }
    >
      <WorkspaceHelpClient
        businessId={businessId}
        initialContext={context}
        userEmail={session.userEmail || ""}
      />
    </AppPageContainer>
  );
}

