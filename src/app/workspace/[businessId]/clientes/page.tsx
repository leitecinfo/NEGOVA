import React from "react";
import { Metadata } from "next";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import {
  listBusinessCustomers,
  getAccountsReceivableKPIs,
  getCustomerGlobalKPIs,
} from "@/lib/customers/customers-service";
import type {
  CustomerCreditTab,
  CustomerDirectoryTab,
} from "@/lib/customers/types";
import { hasPlatformPermission } from "@/lib/auth/permissions";
import { CustomersListClient } from "./customers-list-client";

export const metadata: Metadata = {
  title: "Directorio de Clientes y Cartera | Workspace NEGOVA",
  description: "Consulta y gestión de clientes frecuentes, crédito, cuentas por cobrar y direcciones.",
};

export default async function WorkspaceCustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { businessId } = await params;
  const sParams = await searchParams;

  // 1. Autorización multi-tenant en servidor
  const session = await requireWorkspaceSession(businessId, "customers.view");

  // 2. Parámetros de búsqueda, pestaña, período, ordenamiento y paginación
  const search = typeof sParams.search === "string" ? sParams.search : undefined;
  const status = typeof sParams.status === "string" && ["active", "inactive", "all"].includes(sParams.status)
    ? (sParams.status as "active" | "inactive" | "all")
    : "active";
  const creditTab: CustomerCreditTab =
    typeof sParams.creditTab === "string" &&
    ["all", "with_credit", "receivable", "overdue"].includes(sParams.creditTab)
      ? (sParams.creditTab as CustomerCreditTab)
      : "all";
  const directoryTab: CustomerDirectoryTab =
    typeof sParams.tab === "string" &&
    ["all", "active", "inactive", "with_discount", "with_credit", "receivable", "overdue"].includes(sParams.tab)
      ? (sParams.tab as CustomerDirectoryTab)
      : "all";
  const period =
    typeof sParams.period === "string" &&
    ["all", "today", "7d", "month", "year"].includes(sParams.period)
      ? (sParams.period as "all" | "today" | "7d" | "month" | "year")
      : "all";
  const sortBy =
    typeof sParams.sortBy === "string" &&
    ["sales_desc", "orders_desc", "name_asc", "name_desc", "recent"].includes(sParams.sortBy)
      ? (sParams.sortBy as "sales_desc" | "orders_desc" | "name_asc" | "name_desc" | "recent")
      : "sales_desc";
  const page = typeof sParams.page === "string" ? Math.max(1, parseInt(sParams.page, 10) || 1) : 1;

  // 3. Consulta de datos, KPIs de cartera y KPIs globales de clientes en paralelo
  const [customersResult, creditKpis, globalKpis] = await Promise.all([
    listBusinessCustomers({
      businessId,
      search,
      status,
      creditTab,
      directoryTab,
      period,
      sortBy,
      page,
      pageSize: 10,
    }),
    getAccountsReceivableKPIs(businessId),
    getCustomerGlobalKPIs(businessId),
  ]);

  const { customers, totalCount, totalPages, pageSize } = customersResult;

  return (
    <CustomersListClient
      businessId={businessId}
      businessName={session.businessName}
      canCreateCustomer={session.isOwner || hasPlatformPermission(session.roleCode, "customers.create")}
      canDeleteCustomer={session.isOwner || hasPlatformPermission(session.roleCode, "customers.delete")}
      customers={customers}
      creditKpis={creditKpis}
      globalKpis={globalKpis}
      totalCount={totalCount}
      totalPages={totalPages}
      currentPage={page}
      pageSize={pageSize}
      filters={{
        search: search || "",
        status,
        creditTab,
        directoryTab,
        period,
        sortBy,
      }}
    />
  );
}
