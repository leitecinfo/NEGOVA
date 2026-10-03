import React from "react";
import { redirect } from "next/navigation";
import { CreditCard } from "lucide-react";
import { AdminPageContainer } from "@/components/admin/admin-page-container";
import { getCurrentUserAuthorization } from "@/lib/auth/authorization";
import { getSubscriptionsList } from "@/lib/subscriptions/subscriptions-service";
import { SuscripcionesClient } from "./suscripciones-client";

export const metadata = {
  title: "Gestión de Suscripciones | NEGOVA Admin",
  description: "Monitoreo y administración centralizada de membresías, periodos de prueba y vigencias SaaS.",
};

export default async function AdminSuscripcionesPage() {
  const authProfile = await getCurrentUserAuthorization();

  // Validación de acceso a nivel de plataforma
  if (!authProfile || !authProfile.isPlatformUser) {
    redirect("/auth/login?redirect=/admin/suscripciones");
  }

  const isSuperAdmin = authProfile.platformRole === "super_admin";
  const initialData = await getSubscriptionsList({ page: 1, pageSize: 15 });

  return (
    <AdminPageContainer
      title="Gestión de Suscripciones"
      description="Monitoreo del ciclo de vida de membresías SaaS, control de vigencias, renovaciones y periodos de prueba de cada comercio."
      badge={
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-orange-50 text-[#ED500A] border border-orange-200 dark:bg-[#ED500A]/10 dark:text-[#ED500A] dark:border-[#ED500A]/20">
          Gestión Global
        </span>
      }
    >
      <SuscripcionesClient
        initialData={initialData}
        currentUserId={authProfile.userId}
        isSuperAdmin={isSuperAdmin}
      />
    </AdminPageContainer>
  );
}
