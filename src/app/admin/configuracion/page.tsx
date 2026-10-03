import React from "react";
import { Metadata } from "next";
import { getPlatformConfiguration } from "./actions";
import { ConfiguracionClient } from "./configuracion-client";
import { AdminPageContainer } from "@/components/admin/admin-page-container";

export const metadata: Metadata = {
  title: "Configuración de Plataforma | NEGOVA Admin",
  description: "Ajustes maestros del sistema, políticas globales de seguridad, pasarelas e infraestructura NEGOVA Core.",
};

export default async function AdminConfiguracionPage() {
  const config = await getPlatformConfiguration();

  return (
    <AdminPageContainer
      title="Configuración de Plataforma"
      description="Parámetros globales, políticas de seguridad, pasarelas, límites y servicios del Core de NEGOVA."
    >
      <ConfiguracionClient initialConfig={config} />
    </AdminPageContainer>
  );
}
