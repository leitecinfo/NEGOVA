import React from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import {
  getCustomerById,
  canConfigureCustomerCredit,
} from "@/lib/customers/customers-service";
import {
  getCustomerLoyaltyAccount,
  getCustomerLoyaltyHistory,
} from "@/lib/loyalty/loyalty-service";
import { hasPlatformPermission } from "@/lib/auth/permissions";
import { CustomerDetailClient } from "./customer-detail-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ businessId: string; id: string }>;
}): Promise<Metadata> {
  const { businessId, id } = await params;
  const customer = await getCustomerById(businessId, id);

  if (!customer) {
    return {
      title: "Cliente no encontrado | Workspace NEGOVA",
    };
  }

  return {
    title: `${customer.fullName} — Ficha de Cliente | Workspace NEGOVA`,
    description: `Historial de compras, pedidos, crédito y direcciones de ${customer.fullName}.`,
  };
}

export default async function WorkspaceCustomerDetailPage({
  params,
}: {
  params: Promise<{ businessId: string; id: string }>;
}) {
  const { businessId, id } = await params;

  // 1. Autorización multi-tenant
  const session = await requireWorkspaceSession(businessId, "customers.view");

  // 2. Obtener datos detallados del cliente y programa de fidelización [FID-001]
  const [customer, loyaltyAccount, loyaltyTransactions] = await Promise.all([
    getCustomerById(businessId, id),
    getCustomerLoyaltyAccount(businessId, id),
    getCustomerLoyaltyHistory(businessId, id),
  ]);

  if (!customer) {
    notFound();
  }

  return (
    <CustomerDetailClient
      businessId={businessId}
      businessName={session.businessName}
      customer={customer}
      initialLoyaltyAccount={loyaltyAccount}
      initialLoyaltyTransactions={loyaltyTransactions}
      canEditCustomer={session.isOwner || hasPlatformPermission(session.roleCode, "customers.update")}
      canDeleteCustomer={session.isOwner || hasPlatformPermission(session.roleCode, "customers.delete")}
      canManageCredit={canConfigureCustomerCredit(session.roleCode, session.isOwner)}
    />
  );
}
