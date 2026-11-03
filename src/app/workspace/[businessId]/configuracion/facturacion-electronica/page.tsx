import React, { Suspense } from "react";
import { Metadata } from "next";
import Link from "next/link";
import { FileText, ArrowLeft } from "lucide-react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { AppPageContainer } from "@/components/layout/app-page-container";
import {
  getDianBillingConfig,
  getElectronicDocumentsList,
} from "@/lib/dian/dian-service";
import { DianConfigClient } from "./dian-config-client";

export const metadata: Metadata = {
  title: "Facturación Electrónica DIAN | Workspace NEGOVA",
  description: "Configuración de facturación electrónica DIAN: resolución, prefijos, datos del emisor, CUFE, CUDE y proveedor tecnológico.",
};

interface PageProps {
  params: Promise<{ businessId: string }>;
}

export default async function WorkspaceDianConfigPage({ params }: PageProps) {
  const { businessId } = await params;

  // 1. Autorización multi-tenant de lectura en configuración
  await requireWorkspaceSession(businessId, "business_settings.view");

  // 2. Cargar configuración DIAN y documentos electrónicos emitidos
  const config = await getDianBillingConfig(businessId);
  const docsRes = await getElectronicDocumentsList(businessId, { pageSize: 50 });

  return (
    <AppPageContainer
      title="Facturación Electrónica DIAN"
      description="Configura los datos del emisor, resolución 1876 de la DIAN, prefijos, rangos autorizados y conexión con tu proveedor tecnológico para emisión de facturas y notas crédito con CUFE/CUDE."
      badge={
        <div className="flex items-center gap-2">
          <Link
            href={`/workspace/${businessId}/configuracion`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/[0.04] hover:bg-slate-200 dark:hover:bg-white/[0.08] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Configuración
          </Link>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:text-blue-400">
            <FileText className="w-3.5 h-3.5" />
            Normativa Fiscal DIAN
          </span>
        </div>
      }
    >
      <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Cargando configuración de facturación electrónica...</div>}>
        <DianConfigClient
          initialConfig={config}
          initialDocuments={docsRes.documents}
          businessId={businessId}
        />
      </Suspense>
    </AppPageContainer>
  );
}
