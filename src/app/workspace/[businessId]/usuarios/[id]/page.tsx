import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, User, Shield, Key } from "lucide-react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { getUserDetail } from "@/lib/auth/users-service";
import { getUserEffectivePermissionsDetail } from "@/lib/auth/user-permissions-service";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { WorkspaceUserDetailClient } from "./workspace-user-detail-client";

interface PageProps {
  params: Promise<{ businessId: string; id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const data = await getUserDetail(id);
    return {
      title: `${data.user.fullName} | Permisos y Perfil | Workspace NEGOVA`,
      description: `Detalle del colaborador y gestión de permisos individuales para ${data.user.fullName}.`,
    };
  } catch {
    return {
      title: "Colaborador | Workspace NEGOVA",
    };
  }
}

export default async function WorkspaceUserDetailPage({ params }: PageProps) {
  const { businessId, id } = await params;

  // 1. Validar sesión y permisos del propietario
  const session = await requireWorkspaceSession(businessId, "business_users.view");

  let detailData = null;
  let permissionsData = null;

  try {
    const [detail, permRes] = await Promise.all([
      getUserDetail(id),
      getUserEffectivePermissionsDetail(businessId, id),
    ]);

    detailData = detail;
    permissionsData = permRes;
  } catch (err) {
    console.error("[WorkspaceUserDetailPage Error]:", err);
    notFound();
  }

  if (!detailData) {
    notFound();
  }

  return (
    <AppPageContainer
      title={detailData.user.fullName}
      description="Perfil del colaborador, rol y personalización granular de permisos."
      badge={
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border ${detailData.user.primaryRole.badgeColor}`}
        >
          <Shield className="w-3.5 h-3.5" />
          {detailData.user.primaryRole.name}
        </span>
      }
      actions={
        <Link
          href={`/workspace/${businessId}/usuarios`}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Directorio</span>
        </Link>
      }
    >
      <WorkspaceUserDetailClient
        user={detailData.user}
        businessId={businessId}
        businessName={session.businessName}
        isOwner={Boolean(session.isOwner || session.isSuperAdmin || session.isPlatformAdmin)}
        initialPermissions={permissionsData}
      />
    </AppPageContainer>
  );
}
