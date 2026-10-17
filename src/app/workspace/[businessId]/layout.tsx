import React from "react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { getBusinessDocumentConfig } from "@/lib/documents/document-service";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

export default async function WorkspaceRootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  // 1. Validar sesión del workspace a nivel layout (autenticación y membresía activa en el negocio)
  const session = await requireWorkspaceSession(businessId, "none");

  // 2. Obtener identidad visual y de marca configurada
  const config = await getBusinessDocumentConfig(businessId);

  return (
    <WorkspaceShell
      session={session}
      logoUrl={config.logoUrl}
      primaryColor={config.primaryColor}
    >
      {children}
    </WorkspaceShell>
  );
}
