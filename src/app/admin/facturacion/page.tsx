import React from "react";
import { redirect } from "next/navigation";
import { Receipt } from "lucide-react";
import { AdminPageContainer } from "@/components/admin/admin-page-container";
import { getCurrentUserAuthorization } from "@/lib/auth/authorization";
import { getBillingList } from "@/lib/billing/billing-service";
import { FacturacionClient } from "./facturacion-client";

export const metadata = {
  title: "Facturación de Plataforma | NEGOVA Admin",
  description: "Registro de ingresos, comprobantes y liquidación de suscripciones de comercios clientes en NEGOVA.",
};

export default async function AdminFacturacionPage() {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    redirect("/auth/login?redirect=/admin/facturacion");
  }

  const initialData = await getBillingList({ page: 1, pageSize: 10 });

  return (
    <AdminPageContainer
      title="Facturación de Plataforma"
      description="Control y liquidación de cobros de suscripciones emitidos a negocios clientes de NEGOVA, métodos de pago y estados de recaudación."
      badge={
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-orange-50 text-[#ED500A] border border-orange-200 dark:bg-[#ED500A]/10 dark:text-[#ED500A] dark:border-[#ED500A]/20">
          Recaudos SaaS
        </span>
      }
    >
      <FacturacionClient initialData={initialData} />
    </AdminPageContainer>
  );
}
