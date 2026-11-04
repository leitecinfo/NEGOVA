"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Search, HelpCircle } from "lucide-react";
import { AppLayoutShell } from "@/components/layout/app-layout-shell";
import { LogoutModal } from "@/components/ui/logout-modal";
import type { WorkspaceUserContext } from "@/lib/auth/workspace-context";
import { WorkspaceHeaderQuickAccess } from "@/components/workspace/workspace-header-quick-access";
import { WorkspaceNotificationDropdown } from "@/components/workspace/workspace-notification-dropdown";
import { WorkspaceRealtimeListener } from "@/components/workspace/workspace-realtime-listener";
import { WorkspaceCommandPalette } from "@/components/workspace/workspace-command-palette";
import { WorkspaceSidebarSubscriptionWidget } from "@/components/workspace/workspace-sidebar-subscription-widget";
import { buildWorkspaceNavSections } from "@/config/workspace-navigation";
import { WorkspaceOpenTicketsFloatingButton } from "@/components/workspace/workspace-open-tickets-floating-button";

interface WorkspaceShellProps {
  session: WorkspaceUserContext;
  logoUrl?: string | null;
  primaryColor?: string;
  productCount?: number;
  employeeCount?: number;
  trialRemainingDays?: number | null;
  isTrialing?: boolean;
  children: React.ReactNode;
}

export function WorkspaceShell({
  session,
  logoUrl,
  primaryColor = "#0284C7",
  productCount = 0,
  employeeCount = 1,
  trialRemainingDays = null,
  isTrialing = false,
  children,
}: WorkspaceShellProps) {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const businessId = session.businessId;

  // Atajo global de teclado para Cmd+K / Ctrl+K [NAV-001]
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
      <WorkspaceCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        businessId={businessId}
        navSections={navSections}
      />
      <LogoutModal
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
      sidebarFooterWidget={
        <WorkspaceSidebarSubscriptionWidget
          businessId={businessId}
          planId={session.planId}
          enabledFeatures={session.enabledFeatures}
          planLimits={session.planLimits}
          productCount={productCount}
          employeeCount={employeeCount}
          trialRemainingDays={trialRemainingDays}
          isTrialing={isTrialing}
          upgradeUrl={`/workspace/${businessId}/configuracion?tab=mi-negocio`}
        />
      }
      rightActions={
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Botón Disparador de Búsqueda Global (Ctrl+K) */}
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/80 text-xs text-slate-600 hover:text-slate-900 dark:bg-white/[0.04] dark:hover:bg-white/[0.07] dark:border-white/[0.08] dark:text-slate-400 dark:hover:text-slate-200 transition-all focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
            aria-label="Buscar en el workspace (Ctrl+K)"
            title="Buscar en el workspace (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden md:inline font-body">Buscar...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-slate-50 dark:text-slate-400 dark:bg-white/[0.06] rounded border border-slate-200/80 dark:border-white/[0.08] shadow-2xs">
              <span className="text-[11px]">⌘</span>K
            </kbd>
          </button>

          <WorkspaceHeaderQuickAccess
            businessId={businessId}
            navSections={navSections}
            initialModuleId={(session.businessSettings as any)?.headerQuickAccess}
            businessType={session.businessType}
            commercialActivities={session.commercialActivities}
            canViewOrders={canViewOrders}
          />
          <WorkspaceNotificationDropdown businessId={businessId} />

          {/* Enlace al Centro de Ayuda en Cabecera */}
          <Link
            href={`/workspace/${businessId}/ayuda`}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            title="Centro de Ayuda y Guías"
            aria-label="Centro de Ayuda"
          >
            <HelpCircle className="w-5 h-5" />
          </Link>

          <WorkspaceRealtimeListener businessId={businessId} />
        </div>
      }
      modals={modals}
      onOpenLogoutModal={() => setIsLogoutModalOpen(true)}
    >
      {children}
      {/* Botón flotante inferior derecho: Tickets Abiertos */}
      <WorkspaceOpenTicketsFloatingButton businessId={businessId} />
    </AppLayoutShell>
  );
}

