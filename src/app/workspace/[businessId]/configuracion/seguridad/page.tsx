import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { AppPageContainer } from "@/components/layout/app-page-container";
import {
  getUser2faStatus,
  getBusinessSecuritySettings,
} from "@/lib/auth/two-factor-service";
import { SecurityConfigClient } from "./security-config-client";

export const metadata: Metadata = {
  title: "Seguridad y 2FA | Workspace NEGOVA",
  description: "Configura la verificación en dos pasos con Google Authenticator, códigos de respaldo y políticas de acceso para administradores.",
};

interface PageProps {
  params: Promise<{ businessId: string }>;
}

export default async function WorkspaceSecurityConfigPage({ params }: PageProps) {
  const { businessId } = await params;

  // 1. Autorización estricta de workspace
  const session = await requireWorkspaceSession(businessId, "business_settings.view");

  // 2. Cargar estado de 2FA del usuario y políticas del negocio
  const [userStatus, businessSecurity] = await Promise.all([
    getUser2faStatus(session.userId),
    getBusinessSecuritySettings(businessId),
  ]);

  const isOwnerOrAdmin = Boolean(session.isOwner || session.isSuperAdmin || session.roleCode === "admin");

  return (
    <AppPageContainer
      title="Seguridad y Doble Factor (2FA)"
      description="Protege el acceso a tu cuenta con autenticación TOTP (Google Authenticator, Authy), gestiona códigos de recuperación y configura políticas de acceso."
      badge={
        <div className="flex items-center gap-2">
          <Link
            href={`/workspace/${businessId}/configuracion`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/[0.04] hover:bg-slate-200 dark:hover:bg-white/[0.08] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Configuración
          </Link>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:text-blue-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            2FA / TOTP
          </span>
        </div>
      }
    >
      <SecurityConfigClient
        businessId={businessId}
        initialData={{
          userStatus,
          userEmail: session.userEmail || "",
          isOwnerOrAdmin,
          businessSecurity,
        }}
      />
    </AppPageContainer>
  );
}

