"use client";

import React from "react";
import {
  Menu,
  Search,
} from "lucide-react";
import { AdminBreadcrumbs } from "./admin-breadcrumbs";
import { AdminNotificationDropdown } from "./admin-notification-dropdown";
import { AdminUserMenu } from "./admin-user-menu";
import { AdminLiveClock } from "./admin-live-clock";
import { AdminUserContext } from "@/lib/auth/admin-context";

interface AdminTopbarProps {
  onOpenMobileSidebar: () => void;
  onOpenCommandPalette: () => void;
  onOpenLogoutModal: () => void;
  user: AdminUserContext;
  // Opcionales para retrocompatibilidad
  isDesktopCollapsed?: boolean;
  onToggleDesktopSidebar?: () => void;
}

export function AdminTopbar({
  onOpenMobileSidebar,
  onOpenCommandPalette,
  onOpenLogoutModal,
  user,
}: AdminTopbarProps) {

  return (
    <header className="sticky top-0 z-20 h-16 w-full bg-white/95 dark:bg-[#0D0F16]/90 backdrop-blur-md border-b border-slate-200 dark:border-white/[0.08] px-4 sm:px-6 flex items-center justify-between gap-4 transition-colors duration-200">
      {/* 1. Área Izquierda: Controles de Navegación & Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Toggle únicamente para dispositivos móviles */}
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          aria-label="Abrir navegación móvil"
          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06] transition-colors lg:hidden focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Migas de pan / Contexto con Nombre Real */}
        <AdminBreadcrumbs />
      </div>

      {/* 2. Área Derecha: Reloj en Vivo, Búsqueda Global, Alertas y Perfil */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Reloj y Fecha en Vivo (Bogotá UTC-5) */}
        <AdminLiveClock />

        {/* Disparador de Búsqueda Global (Command Palette) */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/70 border border-slate-200 text-xs text-slate-600 hover:text-slate-900 dark:bg-white/[0.04] dark:hover:bg-white/[0.07] dark:border-white/[0.08] dark:text-slate-400 dark:hover:text-slate-200 transition-all focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
          aria-label="Abrir buscador global"
        >
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden md:inline font-body">Buscar módulo...</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-white dark:text-slate-400 dark:bg-white/[0.06] rounded border border-slate-200 dark:border-white/[0.08] shadow-2xs">
            <span className="text-[11px]">⌘</span>K
          </kbd>
        </button>

        {/* Notificaciones */}
        <AdminNotificationDropdown />

        <div className="h-5 w-[1px] bg-slate-200 dark:bg-white/[0.08]" />

        {/* Menú de Usuario */}
        <AdminUserMenu user={user} onOpenLogoutModal={onOpenLogoutModal} />
      </div>
    </header>
  );
}
