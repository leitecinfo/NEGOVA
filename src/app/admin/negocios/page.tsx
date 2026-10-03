import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import { Building2, Plus, Store } from "lucide-react";
import { requireAdminSession } from "@/lib/auth/admin-context";
import { getBusinessesList } from "@/lib/businesses/businesses-service";
import { AdminPageContainer } from "@/components/admin/admin-page-container";
import { NegociosClient } from "./negocios-client";

export const metadata: Metadata = {
  title: "Gestión de Negocios | Panel Administrativo NEGOVA",
  description: "Administra los negocios que utilizan NEGOVA y consulta su estado, acceso y configuración.",
};

export default async function AdminNegociosPage() {
  const session = await requireAdminSession();

  let initialData = null;

  try {
    initialData = await getBusinessesList({ page: 1, pageSize: 10 });
  } catch (err) {
    console.error("[AdminNegociosPage Fetch Error]:", err);
  }

  return (
    <AdminPageContainer
      title="Negocios"
      description="Administra los negocios que utilizan NEGOVA y consulta su estado, acceso y configuración."
      badge={
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:text-blue-400">
          <Store className="w-3.5 h-3.5" />
          Directorio de Tenants
        </span>
      }
      actions={
        <Link
          href="/admin/negocios/nuevo"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ED500A] hover:bg-[#D44405] text-white text-xs font-semibold shadow-xs hover:shadow-sm transition-all cursor-pointer font-body active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Negocio</span>
        </Link>
      }
    >
      <NegociosClient
        initialData={initialData}
        currentUserId={session.id}
        isSuperAdmin={session.isSuperAdmin}
      />
    </AdminPageContainer>
  );
}
