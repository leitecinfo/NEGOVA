import React from "react";
import { redirect } from "next/navigation";
import { Layers } from "lucide-react";
import { AdminPageContainer } from "@/components/admin/admin-page-container";
import { getCurrentUserAuthorization } from "@/lib/auth/authorization";
import { getSubscriptionsList, resolveCanonicalPlanId } from "@/lib/subscriptions/subscriptions-service";
import { getAnnualDiscountConfig } from "@/lib/subscriptions/annual-discount-service";
import { PlanId } from "@/config/plans";
import { PlanesClient } from "./planes-client";

export const metadata = {
  title: "Catálogo de Planes | NEGOVA Admin",
  description: "Definición canónica del catálogo comercial de planes, precios y capacidades de NEGOVA.",
};

export default async function AdminPlanesPage() {
  const authProfile = await getCurrentUserAuthorization();

  if (!authProfile || !authProfile.isPlatformUser) {
    redirect("/auth/login?redirect=/admin/planes");
  }

  // Obtener configuración global de descuento anual
  const annualDiscountConfig = await getAnnualDiscountConfig();

  // Obtener estadísticas de suscripciones por plan
  const subsResult = await getSubscriptionsList({ pageSize: 100 });
  const planCounts: Record<PlanId, number> = {
    inicio: 0,
    crece: 0,
    negocio: 0,
  };

  subsResult.subscriptions.forEach((sub) => {
    const plan = resolveCanonicalPlanId(sub.planId);
    if (planCounts[plan] !== undefined) {
      planCounts[plan]++;
    }
  });

  return (
    <AdminPageContainer
      title="Catálogo Comercial de Planes"
      description="Oferta oficial de planes comerciales de NEGOVA (Inicio, Crece, Negocio), precios en pesos colombianos (COP), límites y matriz de funcionalidades."
      badge={
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-orange-50 text-[#ED500A] border border-orange-200 dark:bg-[#ED500A]/10 dark:text-[#ED500A] dark:border-[#ED500A]/20">
          Catálogo Oficial
        </span>
      }
    >
      <PlanesClient
        planCounts={planCounts}
        totalBusinesses={subsResult.totalCount}
        initialDiscountConfig={annualDiscountConfig}
      />
    </AdminPageContainer>
  );
}
