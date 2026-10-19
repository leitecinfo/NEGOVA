"use client";

import React from "react";
import {
  Menu,
  Search,
} from "lucide-react";
import { AppBreadcrumbs } from "./app-breadcrumbs";
import { AppUserMenu } from "./app-user-menu";
import { AdminLiveClock as AppLiveClock } from "@/components/admin/admin-live-clock"; // Can reuse as is or copy later
import { AppUserProfile, AppBranding, AppNavSection } from "./navigation-types";

interface AppTopbarProps {
  onOpenMobileSidebar: () => void;
  onOpenLogoutModal: () => void;
  userProfile: AppUserProfile;
  branding: AppBranding;
  navSections: AppNavSection[];
  rightActions?: React.ReactNode;
}

export function AppTopbar({
  onOpenMobileSidebar,
  onOpenLogoutModal,
  userProfile,
  branding,
  navSections,
  rightActions,
}: AppTopbarProps) {

  return (
    <header className="sticky top-0 z-20 h-16 w-full bg-white/95 dark:bg-[#0D0F16]/95 backdrop-blur-md border-b border-slate-200 dark:border-white/[0.08] px-4 sm:px-6 flex items-center justify-between gap-4 transition-colors duration-200">
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
        <AppBreadcrumbs navSections={navSections} homeUrl={branding.homeUrl} />
      </div>

      {/* 2. Área Derecha: Reloj en Vivo, Búsqueda Global, Alertas y Perfil */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Reloj y Fecha en Vivo (Bogotá UTC-5) */}
        <AppLiveClock />

        {/* Acciones específicas del contexto (Búsqueda, Notificaciones) */}
        {rightActions}

        <div className="h-5 w-[1px] bg-slate-200 dark:bg-white/[0.08]" />

        {/* Menú de Usuario */}
        <AppUserMenu userProfile={userProfile} branding={branding} onOpenLogoutModal={onOpenLogoutModal} />
      </div>
    </header>
  );
}
