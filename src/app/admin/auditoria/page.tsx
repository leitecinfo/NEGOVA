import React from "react";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { AdminPageContainer } from "@/components/admin/admin-page-container";
import { getCurrentUserAuthorization } from "@/lib/auth/authorization";
import { getAuditLogsList } from "@/lib/audit/audit-service";
import { AuditoriaClient } from "./auditoria-client";

export const metadata = {
  title: "Auditoría del Sistema | NEGOVA Admin",
  description: "Registro inmutable de accesos, modificaciones a tenants, suscripciones y eventos de seguridad.",
};

export default async function AdminAuditoriaPage() {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    redirect("/auth/login?redirect=/admin/auditoria");
  }

  const initialData = await getAuditLogsList({ page: 1, pageSize: 15 });

  return (
    <AdminPageContainer
      title="Auditoría del Sistema"
      description="Registro inmutable de trazabilidad, eventos de seguridad, modificaciones a comercios y auditoría transaccional de NEGOVA."
      badge={
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-orange-50 text-[#ED500A] border border-orange-200 dark:bg-[#ED500A]/10 dark:text-[#ED500A] dark:border-[#ED500A]/20">
          Logs Inmutables
        </span>
      }
    >
      <AuditoriaClient initialData={initialData} />
    </AdminPageContainer>
  );
}
