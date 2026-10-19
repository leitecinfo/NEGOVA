"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { User, Settings, LogOut, ChevronDown, Shield, Sun, Moon } from "lucide-react";
import { AppUserProfile, AppBranding } from "./navigation-types";
import { useAppTheme } from "./app-theme-context";
import { UserAvatar } from "@/components/ui/user-avatar";

interface AppUserMenuProps {
  userProfile: AppUserProfile;
  branding: AppBranding;
  onOpenLogoutModal: () => void;
}

export function AppUserMenu({ userProfile, branding, onOpenLogoutModal }: AppUserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useAppTheme();

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Cerrar con Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const roleLabel = userProfile.roleLabel;

  return (
    <div ref={menuRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="flex items-center gap-2.5 p-1 sm:px-2.5 sm:py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
      >
        {/* Avatar (Foto real o placeholder Avvvatars estilizado) */}
        <UserAvatar
          src={userProfile.avatarUrl}
          value={userProfile.email}
          name={userProfile.name}
          size={32}
          radius={8}
          style="shape"
        />

        {/* Nombre y Rol */}
        <div className="hidden md:flex flex-col text-left">
          <span className="text-xs font-semibold text-slate-800 dark:text-white font-title truncate max-w-[130px]">
            {userProfile.name}
          </span>
          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 leading-tight">
            {roleLabel}
          </span>
        </div>

        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 hidden sm:block" />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header con Perfil */}
          <div className="p-3.5 border-b border-slate-200 dark:border-white/[0.06] bg-slate-50/70 dark:bg-white/[0.03] flex items-center gap-3">
            <UserAvatar
              src={userProfile.avatarUrl}
              value={userProfile.email}
              name={userProfile.name}
              size={38}
              radius={10}
              style="shape"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 dark:text-white font-title truncate">
                {userProfile.name}
              </p>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {userProfile.email}
              </p>
              <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-orange-50 dark:bg-[#ED500A]/10 border border-orange-200 dark:border-[#ED500A]/20 text-[#ED500A] text-[10px] font-mono font-medium">
                <Shield className="w-3 h-3" />
                <span>{roleLabel}</span>
              </div>
            </div>
          </div>

          {/* Opciones de Navegación */}
          <div className="p-1.5 space-y-0.5">
            <Link
              href={`${branding.homeUrl}/perfil`}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-xl transition-colors"
              role="menuitem"
            >
              <User className="w-4 h-4 text-slate-400" />
              <span>Mi Perfil de Acceso</span>
            </Link>

            {/* Alternar Tema desde el menú */}
            <button
              type="button"
              onClick={() => {
                toggleTheme();
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-xl transition-colors text-left"
              role="menuitem"
            >
              <div className="flex items-center gap-2.5">
                {theme === "dark" ? (
                  <Sun className="w-4 h-4 text-amber-500" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-500" />
                )}
                <span>Apariencia</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.08] text-slate-600 dark:text-slate-400">
                {theme === "dark" ? "Oscuro" : "Claro"}
              </span>
            </button>
          </div>

          {/* Separador y Salida */}
          <div className="p-1.5 border-t border-slate-200 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenLogoutModal();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors text-left font-medium"
              role="menuitem"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
