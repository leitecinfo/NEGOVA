"use client";

import React, { useState, useEffect } from "react";
import { AdminSidebar } from "./admin-sidebar";
import { AdminMobileSidebar } from "./admin-mobile-sidebar";
import { AdminTopbar } from "./admin-topbar";
import { AdminCommandPalette } from "./admin-command-palette";
import { AdminLogoutModal } from "./admin-logout-modal";
import { AdminThemeProvider } from "./admin-theme-context";
import { AdminUserContext } from "@/lib/auth/admin-context";

interface AdminLayoutShellProps {
  children: React.ReactNode;
  user: AdminUserContext;
}

function AdminLayoutInner({ children, user }: AdminLayoutShellProps) {
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

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

  // Atajo global de teclado para Cmd+K / Ctrl+K
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

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 dark:bg-[#0B0E14] dark:text-[#F8F9FD] overflow-hidden antialiased font-body transition-colors duration-200">
      {/* 1. Sidebar Fijo de Escritorio */}
      <AdminSidebar
        isCollapsed={isDesktopCollapsed}
        onToggleCollapse={handleToggleDesktopSidebar}
        user={user}
      />

      {/* 2. Sidebar Móvil (Drawer) */}
      <AdminMobileSidebar
        isOpen={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
        user={user}
      />

      {/* 3. Área Principal (Topbar + Contenido Scrollable) */}
      <div className="flex flex-col flex-1 h-full min-w-0 overflow-hidden bg-slate-50 dark:bg-[#0B0E14] transition-colors duration-200">
        {/* Barra Superior */}
        <AdminTopbar
          isDesktopCollapsed={isDesktopCollapsed}
          onToggleDesktopSidebar={handleToggleDesktopSidebar}
          onOpenMobileSidebar={() => setIsMobileOpen(true)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenLogoutModal={() => setIsLogoutModalOpen(true)}
          user={user}
        />

        {/* Contenedor con Scroll de Páginas */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50 dark:bg-[#0B0E14] transition-colors duration-200">
          {children}
        </main>
      </div>

      {/* 4. Paleta de Comandos Global (Ctrl+K) */}
      <AdminCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />

      {/* 5. Modal Seguro de Cierre de Sesión */}
      <AdminLogoutModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        userEmail={user.email}
      />
    </div>
  );
}

export function AdminLayoutShell({ children, user }: AdminLayoutShellProps) {
  return (
    <AdminThemeProvider>
      <AdminLayoutInner user={user}>{children}</AdminLayoutInner>
    </AdminThemeProvider>
  );
}
