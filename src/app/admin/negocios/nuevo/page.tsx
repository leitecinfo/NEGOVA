import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Store, Plus } from "lucide-react";
import { requireAdminSession } from "@/lib/auth/admin-context";
import { getBusinessCreationOptionsAction } from "../actions";
import { AdminPageContainer } from "@/components/admin/admin-page-container";
import { NuevoNegocioClient } from "./nuevo-negocio-client";

export const metadata: Metadata = {
  title: "Nuevo Negocio | Panel Administrativo NEGOVA",
  description: "Registrar y dar de alta un nuevo negocio tenant en la plataforma NEGOVA.",
};

export default async function AdminNuevoNegocioPage() {
  await requireAdminSession();

  const options = await getBusinessCreationOptionsAction();

  return (
    <AdminPageContainer
      title="Registrar Nuevo Negocio"
      description="Da de alta un nuevo tenant en NEGOVA, asigna su propietario y configura su plan de inicio."
      maxWidth="5xl"
      badge={
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20">
          <Store className="w-3.5 h-3.5" />
          Alta de Tenant
        </span>
      }
      actions={
        <Link
          href="/admin/negocios"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Directorio</span>
        </Link>
      }
    >
      <NuevoNegocioClient
        plans={options.plans}
        candidateOwners={options.candidateOwners}
      />
    </AdminPageContainer>
  );
}
