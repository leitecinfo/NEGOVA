import React from "react";
import { redirect } from "next/navigation";
import { AdminPageContainer } from "@/components/admin/admin-page-container";
import { getCurrentUserAuthorization } from "@/lib/auth/authorization";
import { getSupportDashboardData } from "@/lib/support/support-service";
import { getBusinessesList } from "@/lib/businesses/businesses-service";
import { SoporteClient } from "./soporte-client";

export const metadata = {
  title: "Mesa de Ayuda y Soporte | NEGOVA Admin",
  description: "Registro de atenciones directas, bitácora de contacto y seguimiento de tickets para comercios clientes de NEGOVA.",
};

export default async function AdminSoportePage() {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    redirect("/auth/login?redirect=/admin/soporte");
  }

  const [initialData, bizResult] = await Promise.all([
    getSupportDashboardData({ page: 1, pageSize: 10 }),
    getBusinessesList({ pageSize: 100 }),
  ]);

  const businesses = bizResult.businesses.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    phone: b.phone || b.owner?.phone || null,
    email: b.email || b.owner?.email || null,
    ownerName: b.owner?.fullName || "Propietario",
    ownerEmail: b.owner?.email || null,
    ownerPhone: b.owner?.phone || null,
    ownerId: b.owner?.userId || null,
  }));

  return (
    <AdminPageContainer
      title="Mesa de Ayuda & Atención al Cliente"
      description="Registro de atenciones por WhatsApp/teléfono, bitácora de contacto y gestión de tickets de seguimiento técnico."
      badge={
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-orange-50 text-[#ED500A] border border-orange-200 dark:bg-[#ED500A]/10 dark:text-[#ED500A] dark:border-[#ED500A]/20">
          Centro de Soporte
        </span>
      }
    >
      <SoporteClient initialData={initialData} businesses={businesses} />
    </AdminPageContainer>
  );
}
