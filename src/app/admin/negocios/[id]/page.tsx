import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Store, Building2 } from "lucide-react";
import { requireAdminSession } from "@/lib/auth/admin-context";
import { getBusinessDetail } from "@/lib/businesses/businesses-service";
import { getBusinessCreationOptionsAction } from "../actions";
import { AdminPageContainer } from "@/components/admin/admin-page-container";
import { NegocioDetailClient } from "./negocio-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const data = await getBusinessDetail(id);
    return {
      title: `${data.business.name} | Gestión de Negocios | NEGOVA`,
      description: `Ficha administrativa, colaboradores, suscripción y eventos forenses del negocio ${data.business.name}.`,
    };
  } catch {
    return {
      title: "Detalle de Negocio | Panel Administrativo NEGOVA",
    };
  }
}

export default async function AdminNegocioDetailPage({ params }: PageProps) {
  const session = await requireAdminSession();
  const { id } = await params;

  let detailData = null;
  let options = null;

  try {
    const [detail, opts] = await Promise.all([
      getBusinessDetail(id),
      getBusinessCreationOptionsAction(),
    ]);

    detailData = detail;
    options = opts;
  } catch (err: any) {
    notFound();
  }

  if (!detailData) {
    notFound();
  }

  return (
    <AdminPageContainer
      title={detailData.business.name}
      description={`Administración de tenant, equipo colaborador, suscripción y trazabilidad de eventos.`}
      badge={
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:text-blue-400">
          <Store className="w-3.5 h-3.5" />
          /{detailData.business.slug}
        </span>
      }
      actions={
        <Link
          href="/admin/negocios"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a Negocios</span>
        </Link>
      }
    >
      <NegocioDetailClient
        business={detailData.business}
        memberships={detailData.memberships}
        auditLogs={detailData.auditLogs}
        candidateOwners={options.candidateOwners}
        currentUserId={session.id}
        isSuperAdmin={session.isSuperAdmin}
      />
    </AdminPageContainer>
  );
}
