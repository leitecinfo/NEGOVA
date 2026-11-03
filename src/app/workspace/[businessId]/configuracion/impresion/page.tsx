import React from "react";
import { Metadata } from "next";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { getPrintingSettings } from "@/lib/printing/printing-service";
import { PrintingConfigClient } from "./printing-config-client";

export const metadata: Metadata = {
  title: "Configuración de Impresión y Estaciones | Workspace NEGOVA",
  description: "Administra impresoras térmicas, estaciones de comanda de cocina, cajón monedero y plantillas.",
};

export default async function WorkspacePrintingConfigPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  // 1. Validar autorización multi-tenant
  const session = await requireWorkspaceSession(businessId, "business_settings.view");

  // 2. Obtener configuración de impresión, cajas y datos del negocio
  const { settings, cashRegisters, businessMaster } = await getPrintingSettings(businessId);

  return (
    <PrintingConfigClient
      businessId={businessId}
      initialSettings={settings}
      cashRegisters={cashRegisters}
      businessMaster={businessMaster}
      isOwner={session.isOwner}
    />
  );
}

