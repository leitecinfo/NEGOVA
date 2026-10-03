import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, User, Shield } from "lucide-react";
import { requireAdminSession } from "@/lib/auth/admin-context";
import { getUserDetail } from "@/lib/auth/users-service";
import { getBusinessesAndRolesOptionsAction } from "../actions";
import { AdminPageContainer } from "@/components/admin/admin-page-container";
import { UsuarioDetailClient } from "./usuario-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const data = await getUserDetail(id);
    return {
      title: `${data.user.fullName} | Detalle de Usuario | NEGOVA`,
      description: `Información de perfil, asignación de rol, membresías y permisos efectivos de ${data.user.fullName}.`,
    };
  } catch {
    return {
      title: "Detalle de Usuario | Panel Administrativo NEGOVA",
    };
  }
}

export default async function AdminUsuarioDetailPage({ params }: PageProps) {
  const session = await requireAdminSession();
  const { id } = await params;

  let detailData = null;
  let options = null;

  try {
    const [detail, opts] = await Promise.all([
      getUserDetail(id),
      getBusinessesAndRolesOptionsAction(),
    ]);

    detailData = detail;
    options = opts;
  } catch (err) {
    console.error("[AdminUsuarioDetailPage Error]:", err);
    notFound();
  }

  if (!detailData) {
    notFound();
  }

  return (
    <AdminPageContainer
      title={detailData.user.fullName}
      description={`Gestión de identidad, membresías, auditoría y matriz de permisos calculados.`}
      badge={
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border ${detailData.user.primaryRole.badgeColor}`}
        >
          {detailData.user.primaryRole.name}
        </span>
      }
      actions={
        <Link
          href="/admin/usuarios"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Directorio</span>
        </Link>
      }
    >
      <UsuarioDetailClient
        user={detailData.user}
        effectivePermissions={detailData.effectivePermissions}
        auditLogs={detailData.auditLogs}
        businesses={options?.businesses || []}
        platformRoles={options.platformRoles}
        businessRoles={options.businessRoles}
        currentUserId={session.id}
        isSuperAdmin={session.isSuperAdmin}
      />
    </AdminPageContainer>
  );
}
