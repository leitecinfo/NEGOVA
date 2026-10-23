"use client";

import React, { useState, useEffect, Suspense } from "react";
import { AppSidebar } from "./app-sidebar";
import { AppMobileSidebar } from "./app-mobile-sidebar";
import { AppTopbar } from "./app-topbar";
import { AppThemeProvider } from "./app-theme-context";
import { NavigationProgressProvider } from "./navigation-progress-bar";
import { AppNavSection, AppBranding, AppUserProfile } from "./navigation-types";

interface AppLayoutShellProps {
  children: React.ReactNode;
  userProfile: AppUserProfile;
  navSections: AppNavSection[];
  branding: AppBranding;
  rightActions?: React.ReactNode;
  modals?: React.ReactNode;
  onOpenLogoutModal?: () => void;
}

function AppLayoutInner({ children, userProfile, navSections, branding, rightActions, modals, onOpenLogoutModal }: AppLayoutShellProps) {
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Cargar estado colapsado guardado en localStorage (Hydration-safe)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("negova_admin_sidebar_collapsed");
      if (saved !== null) {
        setIsDesktopCollapsed(saved === "true");
      }
    } catch {
      // Ignorar errores en almacenamiento local
    }
  }, []);

  // Alternar colapso de barra lateral en escritorio
  const handleToggleDesktopSidebar = () => {
    setIsDesktopCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("negova_admin_sidebar_collapsed", String(next));
      } catch {
        // Ignorar
      }
      return next;
    });
  };

  // Global shortcuts could be handled here or left to the wrapper



  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 dark:bg-[#0B0E14] dark:text-[#F8F9FD] overflow-hidden antialiased font-body transition-colors duration-200">
      {/* 1. Sidebar Fijo de Escritorio */}
      <AppSidebar
        isCollapsed={isDesktopCollapsed}
        onToggleCollapse={handleToggleDesktopSidebar}
        navSections={navSections}
        branding={branding}
      />

      {/* 2. Sidebar Móvil (Drawer) */}
      <AppMobileSidebar
        isOpen={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
        navSections={navSections}
        branding={branding}
        userProfile={userProfile}
      />

      {/* 3. Área Principal (Topbar + Contenido Scrollable) */}
      <div className="flex flex-col flex-1 h-full min-w-0 overflow-hidden bg-slate-50 dark:bg-[#0B0E14] transition-colors duration-200">
        {/* Barra Superior */}
        <AppTopbar
          onOpenMobileSidebar={() => setIsMobileOpen(true)}
          onOpenLogoutModal={onOpenLogoutModal || (() => {})}
          userProfile={userProfile}
          branding={branding}
          navSections={navSections}
          rightActions={rightActions}
        />

        {/* Contenedor con Scroll de Páginas */}
        <main
          id="app-main-viewport"
          className="app-main-viewport flex-1 overflow-y-auto overflow-x-hidden bg-slate-50 dark:bg-[#0B0E14] transition-colors duration-200"
        >
          {children}
        </main>
      </div>

      {/* Modales extras */}
      {modals}
    </div>
  );
}

export function AppLayoutShell(props: AppLayoutShellProps) {
  return (
    <AppThemeProvider>
      <Suspense fallback={null}>
        <NavigationProgressProvider>
          <AppLayoutInner {...props}>{props.children}</AppLayoutInner>
        </NavigationProgressProvider>
      </Suspense>
    </AppThemeProvider>
  );
}
