"use client";

import React, { useState } from "react";
import { AppLayoutShell } from "@/components/layout/app-layout-shell";
import { AdminLogoutModal } from "@/components/admin/admin-logout-modal";
import type { WorkspaceUserContext } from "@/lib/auth/workspace-context";
import { WorkspaceHeaderQuickAccess } from "@/components/workspace/workspace-header-quick-access";
import { WorkspaceNotificationDropdown } from "@/components/workspace/workspace-notification-dropdown";
import { buildWorkspaceNavSections } from "@/config/workspace-navigation";

interface WorkspaceShellProps {
  session: WorkspaceUserContext;
  logoUrl?: string | null;
  primaryColor?: string;
  children: React.ReactNode;
}

export function WorkspaceShell({
  session,
  logoUrl,
  primaryColor = "#0284C7",
  children,
}: WorkspaceShellProps) {
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const businessId = session.businessId;

  // Determinar si el usuario tiene permiso para ver pedidos
  const canViewOrders =
    session.isOwner ||
    session.roleCode === "owner" ||
    session.roleCode === "admin" ||
    ["orders.view", "orders.manage"].some((p) =>
      (session as any).permissions?.includes?.(p)
    );

  // Secciones de navegación generadas desde el catálogo centralizado de Workspace
  const navSections = buildWorkspaceNavSections(businessId, {
    businessType: session.businessType,
    commercialActivities: session.commercialActivities,
    planId: session.planId,
    enabledFeatures: session.enabledFeatures,
    isOwner: session.isOwner,
    roleCode: session.roleCode,
  });

  const modals = (
    <>
      <AdminLogoutModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        userEmail={session.userEmail}
      />
    </>
  );

  return (
    <AppLayoutShell
      navSections={navSections}
      userProfile={{
        id: session.userId,
        name: session.userEmail, // Fallback a email, ya que el contexto no tiene fullName actualmente
        email: session.userEmail,
        avatarUrl: null, // Si en el futuro hay avatar por negocio o global
        roleLabel: session.roleName,
      }}
      branding={{
        logoUrl: logoUrl || undefined,
        appTitle: session.businessName,
        appSubtitle: "Workspace",
        homeUrl: `/workspace/${businessId}`,
        primaryColor,
      }}
      rightActions={
        <div className="flex items-center gap-1 sm:gap-1.5">
          <WorkspaceHeaderQuickAccess
            businessId={businessId}
            navSections={navSections}
            initialModuleId={(session.businessSettings as any)?.headerQuickAccess}
            businessType={session.businessType}
            commercialActivities={session.commercialActivities}
            canViewOrders={canViewOrders}
          />
          <WorkspaceNotificationDropdown businessId={businessId} />
        </div>
      }
      modals={modals}
      onOpenLogoutModal={() => setIsLogoutModalOpen(true)}
    >
      {children}
    </AppLayoutShell>
  );
}
