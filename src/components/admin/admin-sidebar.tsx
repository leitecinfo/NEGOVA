"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { ADMIN_NAV_SECTIONS } from "@/config/admin-navigation";
import { AdminUserContext } from "@/lib/auth/admin-context";

interface AdminSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  user: AdminUserContext;
}

export function AdminSidebar({ isCollapsed, onToggleCollapse, user }: AdminSidebarProps) {
  const pathname = usePathname() || "/admin";
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  // Estado de grupos desglosables / colapsables (por defecto todos cerrados)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    principal: false,
    gestion: false,
    operacion: false,
    control: false,
    sistema: false,
    cuenta: false,
  });

  // Asegurar que la sección que contiene la ruta activa esté abierta
  useEffect(() => {
    ADMIN_NAV_SECTIONS.forEach((section) => {
      const hasActive = section.items.some((item) =>
        item.exactMatch ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)
      );
      if (hasActive) {
        setOpenSections((prev) => ({ ...prev, [section.id]: true }));
      }
    });
  }, [pathname]);

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  return (
    <aside
      aria-label="Barra lateral de navegación principal"
      className={`relative hidden lg:flex flex-col shrink-0 h-screen bg-white dark:bg-[#0D0F16] border-r border-slate-200 dark:border-white/[0.08] transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] z-30 ${
        isCollapsed ? "w-[72px]" : "w-72"
      }`}
    >
      {/* 1. Header con Branding NEGOVA */}
      <div className="h-16 flex items-center justify-between px-3.5 border-b border-slate-200 dark:border-white/[0.08] shrink-0">
        <Link
          href="/admin"
          className="flex items-center gap-3 w-full min-w-0 overflow-hidden focus:outline-hidden focus:ring-1 focus:ring-[#ED500A] rounded-xl p-1.5 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
        >
          <div className="relative w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-linear-to-br from-[#ED500A] to-[#ab3500] p-2 shadow-xs">
            <Image
              src="/isotipo.png"
              alt="NEGOVA"
              width={20}
              height={20}
              className="object-contain"
              priority
            />
          </div>

          {!isCollapsed && (
            <div className="flex flex-col min-w-0 flex-1 transition-opacity duration-200">
              <span className="font-title font-bold text-sm text-slate-900 dark:text-white truncate tracking-tight block leading-snug">
                NEGOVA
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-orange-50 text-[#ED500A] border border-orange-200/80 dark:bg-[#ED500A]/15 dark:text-[#ED500A] dark:border-[#ED500A]/30 shrink-0">
                  Admin
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  Panel Central
                </span>
              </div>
            </div>
          )}
        </Link>
      </div>

      {/* 2. Navegación por Secciones Desglosables (Scrollable) */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10">
        {ADMIN_NAV_SECTIONS.map((section) => {
          // Filtrar items según rol del usuario
          const visibleItems = section.items.filter((item) => {
            if (!item.requiredRoles) return true;
            return item.requiredRoles.includes(user.role as "super_admin" | "admin");
          });

          if (visibleItems.length === 0) return null;

          const isSectionOpen = openSections[section.id] ?? false;

          return (
            <div key={section.id} className="space-y-1">
              {/* Título de la sección desglosable */}
              {!isCollapsed ? (
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={isSectionOpen}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left group hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition-colors focus:outline-hidden"
                >
                  <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200 uppercase transition-colors">
                    {section.label}
                  </span>
                  <div className="flex items-center gap-1.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300">
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
              ) : (
                <div className="w-full flex justify-center py-1">
                  <div className="w-4 h-[1px] bg-slate-200 dark:bg-white/[0.08]" />
                </div>
              )}

              {/* Items de la sección */}
              {(isCollapsed || isSectionOpen) && (
                <div className="space-y-1 animate-in fade-in-50 duration-150">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.exactMatch
                      ? pathname === item.href
                      : pathname === item.href || pathname.startsWith(`${item.href}/`);

                    return (
                      <div
                        key={item.id}
                        className="relative"
                        onMouseEnter={() => isCollapsed && setHoveredItemId(item.id)}
                        onMouseLeave={() => isCollapsed && setHoveredItemId(null)}
                      >
                        <Link
                          href={item.href}
                          className={`group flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 relative ${
                            isActive
                              ? "bg-orange-50 text-[#ED500A] font-semibold border border-orange-200/70 dark:bg-[#ED500A]/10 dark:text-[#ED500A] dark:border-[#ED500A]/20"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.04]"
                          } ${isCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : ""}`}
                          aria-current={isActive ? "page" : undefined}
                        >
                          {/* Icono */}
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-transform duration-150 ${
                              isActive
                                ? "text-[#ED500A]"
                                : "text-slate-500 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200"
                            }`}
                          />

                          {/* Texto y Badge si está expandido */}
                          {!isCollapsed && (
                            <div className="flex items-center justify-between flex-1 min-w-0">
                              <span className="truncate">{item.label}</span>
                              {item.badge && (
                                <span className="ml-2 px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200 dark:bg-white/[0.06] dark:text-slate-300 dark:border-white/[0.08]">
                                  {item.badge.text}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Indicador de píldora activa en el borde izquierdo */}
                          {isActive && !isCollapsed && (
                            <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#ED500A]" />
                          )}
                        </Link>

                        {/* Tooltip flotante en modo colapsado */}
                        {isCollapsed && hoveredItemId === item.id && (
                          <div
                            role="tooltip"
                            className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-slate-900 text-white dark:bg-[#131722] dark:text-[#F8F9FD] border border-slate-700 dark:border-[#1E2333] rounded-lg text-xs font-medium shadow-xl whitespace-nowrap z-50 animate-in fade-in zoom-in-95 duration-150 flex items-center gap-2"
                          >
                            <span>{item.label}</span>
                            {item.badge && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-white/20 text-white">
                                {item.badge.text}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Sub-items si están disponibles y la sección está activa */}
                        {!isCollapsed && isActive && item.subItems && (
                          <div className="ml-7 mt-1 space-y-0.5 border-l border-slate-200 dark:border-white/[0.08] pl-2.5 animate-in fade-in-50 duration-150">
                            {item.subItems.map((subItem) => {
                              const SubIcon = subItem.icon;
                              return (
                                <Link
                                  key={subItem.id}
                                  href={subItem.href}
                                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.04] transition-colors"
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

      {/* 3. Footer del Sidebar: Botón Exclusivo para Desglosar / Colapsar la Barra Lateral */}
      <div className="p-3 border-t border-slate-200 dark:border-white/[0.08] shrink-0">
        {!isCollapsed ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Colapsar barra lateral"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors focus:outline-hidden focus:ring-1 focus:ring-[#ED500A] group"
            title="Colapsar barra lateral"
          >
            <PanelLeftClose className="w-4 h-4 text-slate-500 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200 transition-colors" />
            <span>Colapsar menú</span>
          </button>
        ) : (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Expandir barra lateral"
              className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06] transition-colors focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
              title="Expandir barra lateral"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
