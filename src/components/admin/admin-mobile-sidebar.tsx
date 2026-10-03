"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { X, ChevronDown } from "lucide-react";
import { ADMIN_NAV_SECTIONS } from "@/config/admin-navigation";
import { AdminUserContext } from "@/lib/auth/admin-context";

interface AdminMobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  user: AdminUserContext;
}

export function AdminMobileSidebar({ isOpen, onClose, user }: AdminMobileSidebarProps) {
  const pathname = usePathname() || "/admin";

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    principal: true,
    gestion: true,
    operacion: true,
    control: true,
    sistema: true,
  });

  // Prevenir scroll de fondo mientras esté abierto el drawer
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Manejo de tecla Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Menú de navegación móvil"
      className="fixed inset-0 z-50 lg:hidden"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Panel Drawer */}
      <div className="fixed inset-y-0 left-0 w-4/5 max-w-xs bg-white dark:bg-[#0D0F16] border-r border-slate-200 dark:border-white/[0.1] shadow-2xl flex flex-col z-50 animate-in slide-in-from-left duration-200">
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-white/[0.08] shrink-0">
          <Link
            href="/admin"
            onClick={onClose}
            className="flex items-center gap-3 overflow-hidden"
          >
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-[#ED500A] to-[#ab3500] p-1.5 flex items-center justify-center shadow-xs">
              <Image
                src="/isotipo.png"
                alt="NEGOVA"
                width={20}
                height={20}
                className="object-contain"
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-title font-extrabold text-sm text-slate-900 dark:text-white">NEGOVA</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-orange-50 text-[#ED500A] border border-orange-200 dark:bg-[#ED500A]/15 dark:text-[#ED500A] dark:border-[#ED500A]/30">
                  Admin
                </span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Plataforma</span>
            </div>
          </Link>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar navegación móvil"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Links de navegación por grupos desglosables */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {ADMIN_NAV_SECTIONS.map((section) => {
            const visibleItems = section.items.filter((item) => {
              if (!item.requiredRoles) return true;
              return item.requiredRoles.includes(user.role as "super_admin" | "admin");
            });

            if (visibleItems.length === 0) return null;

            const isSectionOpen = openSections[section.id] ?? true;

            return (
              <div key={section.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left group hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition-colors focus:outline-hidden"
                >
                  <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 group-hover:text-slate-800 dark:text-slate-400 uppercase">
                    {section.label}
                  </span>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <span className="text-[9px] font-mono text-slate-400">
                      {visibleItems.length}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        isSectionOpen ? "" : "-rotate-90"
                      }`}
                    />
                  </div>
                </button>

                {isSectionOpen && (
                  <div className="space-y-1 animate-in fade-in-50 duration-150">
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = item.exactMatch
                        ? pathname === item.href
                        : pathname === item.href || pathname.startsWith(`${item.href}/`);

                      return (
                        <div key={item.id} className="space-y-1">
                          <Link
                            href={item.href}
                            onClick={onClose}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                              isActive
                                ? "bg-orange-50 text-[#ED500A] font-semibold border border-orange-200/70 dark:bg-[#ED500A]/10 dark:text-[#ED500A] dark:border-[#ED500A]/20"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.04]"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Icon className={`w-4 h-4 ${isActive ? "text-[#ED500A]" : "text-slate-400"}`} />
                              <span>{item.label}</span>
                            </div>
                            {item.badge && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200 dark:bg-white/[0.06] dark:text-slate-300 dark:border-white/[0.08]">
                                {item.badge.text}
                              </span>
                            )}
                          </Link>

                          {/* Sub-items si están activos */}
                          {isActive && item.subItems && (
                            <div className="ml-7 space-y-1 border-l border-slate-200 dark:border-white/[0.08] pl-2.5 pt-1">
                              {item.subItems.map((subItem) => {
                                const SubIcon = subItem.icon;
                                return (
                                  <Link
                                    key={subItem.id}
                                    href={subItem.href}
                                    onClick={onClose}
                                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.04] transition-colors"
                                  >
                                    <SubIcon className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span className="truncate">{subItem.label}</span>
                                  </Link>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
