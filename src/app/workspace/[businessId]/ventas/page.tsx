import React from "react";
import { Metadata } from "next";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { getBusinessDocumentsList } from "@/lib/documents/document-service";
import { hasPlatformPermission } from "@/lib/auth/permissions";
import { SalesListClient } from "./sales-list-client";

export const metadata: Metadata = {
  title: "Historial de Ventas | Workspace NEGOVA",
  description: "Consulta y seguimiento de comprobantes de ventas emitidos en el comercio.",
};

export default async function WorkspaceSalesListPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { businessId } = await params;
  const sParams = await searchParams;

  // 1. Validar autorización multi-tenant para consultar ventas (sales.view)
  const session = await requireWorkspaceSession(businessId, "sales.view");

  // 2. Extraer parámetros de filtrado y paginación
  const search = typeof sParams.search === "string" ? sParams.search : undefined;
  const status = typeof sParams.status === "string" ? sParams.status : undefined;
  const paymentMethod = typeof sParams.paymentMethod === "string" ? sParams.paymentMethod : undefined;
  const startDate = typeof sParams.startDate === "string" ? sParams.startDate : undefined;
  const endDate = typeof sParams.endDate === "string" ? sParams.endDate : undefined;
  const page = typeof sParams.page === "string" ? Math.max(1, parseInt(sParams.page, 10) || 1) : 1;

  // 3. Consultar datos reales de PostgreSQL
  const { documents, totalCount, totalPages, pageSize } = await getBusinessDocumentsList({
    businessId,
    search,
    status,
    paymentMethod,
    startDate,
    endDate,
    page,
    pageSize: 10,
  });

  return (
    <SalesListClient
      businessId={businessId}
      businessName={session.businessName}
      businessTimezone={session.businessTimezone || "America/Bogota"}
      canCreateSale={session.isOwner || hasPlatformPermission(session.roleCode, "sales.create")}
      documents={documents}
      totalCount={totalCount}
      totalPages={totalPages}
      currentPage={page}
      pageSize={pageSize}
      filters={{
        search: search || "",
        status: status || "all",
        paymentMethod: paymentMethod || "all",
        startDate: startDate || "",
        endDate: endDate || "",
      }}
    />
  );
}
