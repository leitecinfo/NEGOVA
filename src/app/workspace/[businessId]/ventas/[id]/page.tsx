import React from "react";
import { notFound } from "next/navigation";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import {
  getBusinessDocumentById,
  getBusinessDocumentConfig,
} from "@/lib/documents/document-service";
import { hasPlatformPermission } from "@/lib/auth/permissions";
import { SaleDetailClient } from "./sale-detail-client";

export default async function WorkspaceSaleDetailPage({
  params,
}: {
  params: Promise<{ businessId: string; id: string }>;
}) {
  const { businessId, id } = await params;

  // 1. Validar autorización multi-tenant para consultar la venta (sales.view)
  const session = await requireWorkspaceSession(businessId, "sales.view");

  // 2. Obtener documento comercial validando pertenencia estricta al negocio (multi-tenant)
  const document = await getBusinessDocumentById(businessId, id);
  if (!document) {
    notFound();
  }

  // 3. Obtener configuración comercial para encabezados de marca
  const config = await getBusinessDocumentConfig(businessId);

  return (
    <SaleDetailClient
      businessId={businessId}
      businessName={session.businessName}
      tradeName={config.tradeName || session.businessName}
      businessTimezone={session.businessTimezone || "America/Bogota"}
      canCancelSale={session.isOwner || hasPlatformPermission(session.roleCode, "sales.cancel")}
      initialDocument={document}
      config={config}
    />
  );
}
