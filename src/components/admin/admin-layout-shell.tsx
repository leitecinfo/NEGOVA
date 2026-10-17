"use client";

import React, { useState, useEffect } from "react";
import { AppLayoutShell } from "@/components/layout/app-layout-shell";
import { AdminCommandPalette } from "./admin-command-palette";
import { AdminLogoutModal } from "./admin-logout-modal";
import { AdminNotificationDropdown } from "./admin-notification-dropdown";
import { Search } from "lucide-react";
import { ADMIN_NAV_SECTIONS } from "@/config/admin-navigation";
import { AdminUserContext } from "@/lib/auth/admin-context";
import { AppNavSection } from "@/components/layout/navigation-types";

interface AdminLayoutShellProps {
  children: React.ReactNode;
  user: AdminUserContext;
}

export function AdminLayoutShell({ children, user }: AdminLayoutShellProps) {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

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

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  };

  // Filtrar las secciones de Admin según el rol
  const filteredNavSections: AppNavSection[] = ADMIN_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.map((item) => ({
      ...item,
      allowed: !item.requiredRoles || item.requiredRoles.includes(user.role as any),
    })),
  }));

  const rightActions = (
    <>
      {/* Disparador de Búsqueda Global (Command Palette) */}
      <button
        type="button"
        onClick={() => setIsCommandPaletteOpen(true)}
        className="flex items-center gap-2 p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/70 border border-slate-200 text-xs text-slate-600 hover:text-slate-900 dark:bg-white/[0.04] dark:hover:bg-white/[0.07] dark:border-white/[0.08] dark:text-slate-400 dark:hover:text-slate-200 transition-all focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
        aria-label="Abrir buscador global"
      >
        <Search className="w-3.5 h-3.5 text-slate-400" />
        <span className="hidden md:inline font-body">Buscar módulo...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-white dark:text-slate-400 dark:bg-white/[0.06] rounded border border-slate-200 dark:border-white/[0.08] shadow-2xs">
          <span className="text-[11px]">⌘</span>K
        </kbd>
      </button>

      {/* Notificaciones de Admin */}
      <AdminNotificationDropdown />
    </>
  );

  const modals = (
    <>
      <AdminCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
      <AdminLogoutModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        userEmail={user.email}
      />
    </>
  );

  return (
    <AppLayoutShell
      navSections={filteredNavSections}
      userProfile={{
        id: user.id,
        name: user.fullName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        roleLabel: user.role === "super_admin" ? "Super Admin" : "Administrador",
      }}
      branding={{
        appTitle: "NEGOVA",
        appSubtitle: "Admin",
        homeUrl: "/admin",
      }}
      rightActions={rightActions}
      modals={modals}
      onOpenLogoutModal={() => setIsLogoutModalOpen(true)}
    >
      {children}
    </AppLayoutShell>
  );
}
