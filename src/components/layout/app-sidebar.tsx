"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutGrid,
  Search,
  X,
} from "lucide-react";
import { AppNavSection, AppBranding } from "./navigation-types";
import { isRouteActive } from "./navigation-utils";
import { useNavigationProgress } from "./navigation-progress-bar";
import { ModalPortal } from "@/components/ui/modal-portal";

interface AppSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  navSections: AppNavSection[];
  branding: AppBranding;
}

export function AppSidebar({ isCollapsed, onToggleCollapse, navSections, branding }: AppSidebarProps) {
  const pathname = usePathname() || branding.homeUrl;
  const searchParams = useSearchParams();
  const { startNavigation } = useNavigationProgress();

  // Estado de grupos desglosables en modo expandido
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    operacion: true,
    catalogo: true,
    gestion: true,
    administracion: true,
    cuenta: true,
    principal: true,
    control: true,
    sistema: true,
  });

  // Estados para el menú flotante "Módulos" en modo colapsado
  const [isModulesFlyoutOpen, setIsModulesFlyoutOpen] = useState(false);
  const [isPinnedByClick, setIsPinnedByClick] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [flyoutTop, setFlyoutTop] = useState<number>(80);

  const modulesButtonRef = useRef<HTMLButtonElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Asegurar que la sección que contiene la ruta activa esté abierta cuando esté expandido
  useEffect(() => {
    navSections.forEach((section) => {
      const hasActive = section.items.some((item) =>
        isRouteActive(item.href, pathname, searchParams, item.exactMatch)
      );
      if (hasActive) {
        setOpenSections((prev) => ({ ...prev, [section.id]: true }));
      }
    });
  }, [pathname, searchParams, navSections]);

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionId]: !(prev[sectionId] ?? true),
    }));
  };

  // Identificar el grupo Operaciones para el modo colapsado
  const isOperacionesSection = (section: AppNavSection) =>
    section.id.toLowerCase() === "operacion" ||
    section.id.toLowerCase() === "operaciones" ||
    section.label.toLowerCase().includes("operaci");

  const hasOperacion = navSections.some(isOperacionesSection);
  const primarySection = hasOperacion
    ? navSections.find(isOperacionesSection)
    : navSections[0];

  const visibleCollapsedItems = useMemo(
    () => (primarySection?.items || []).filter((item) => item.allowed !== false),
    [primarySection]
  );

  const hiddenSections = useMemo(
    () =>
      navSections
        .filter((sec) => sec.id !== primarySection?.id)
        .map((sec) => ({
          ...sec,
          items: sec.items.filter((item) => item.allowed !== false),
        }))
        .filter((sec) => sec.items.length > 0),
    [navSections, primarySection]
  );

  // Evaluar si alguna ruta oculta está activa para encender el botón "Módulos"
  const isAnyHiddenActive = useMemo(() => {
    return hiddenSections.some((section) =>
      section.items.some((item) => {
        if (isRouteActive(item.href, pathname, searchParams, item.exactMatch)) {
          return true;
        }
        if (item.subItems?.some((sub) => isRouteActive(sub.href, pathname, searchParams))) {
          return true;
        }
        return false;
      })
    );
  }, [hiddenSections, pathname, searchParams]);

  // Filtrar las opciones ocultas según la búsqueda
  const filteredHiddenSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return hiddenSections;

    return hiddenSections
      .map((sec) => {
        const matchingItems = sec.items.filter((item) => {
          const matchLabel = item.label.toLowerCase().includes(q);
          const matchDesc = item.description?.toLowerCase().includes(q);
          const matchSub = item.subItems?.some((sub) => sub.label.toLowerCase().includes(q));
          return matchLabel || matchDesc || matchSub;
        });

        return {
          ...sec,
          items: matchingItems,
        };
      })
      .filter((sec) => sec.items.length > 0);
  }, [hiddenSections, searchQuery]);

  // Control de posición del menú flotante
  const updateFlyoutPosition = () => {
    if (modulesButtonRef.current) {
      const rect = modulesButtonRef.current.getBoundingClientRect();
      const desiredTop = rect.top - 60;
      const clampedTop = Math.max(16, Math.min(window.innerHeight - 520, desiredTop));
      setFlyoutTop(clampedTop);
    }
  };

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const handleModulesMouseEnter = () => {
    clearCloseTimeout();
    updateFlyoutPosition();
    setIsModulesFlyoutOpen(true);
  };

  const handleModulesMouseLeave = () => {
    if (!isPinnedByClick) {
      closeTimeoutRef.current = setTimeout(() => {
        setIsModulesFlyoutOpen(false);
      }, 200);
    }
  };

  const handleFlyoutMouseEnter = () => {
    clearCloseTimeout();
  };

  const handleFlyoutMouseLeave = () => {
    if (!isPinnedByClick) {
      closeTimeoutRef.current = setTimeout(() => {
        setIsModulesFlyoutOpen(false);
      }, 200);
    }
  };

  const handleModulesClick = () => {
    clearCloseTimeout();
    updateFlyoutPosition();
    setIsModulesFlyoutOpen((prev) => {
      const next = !prev;
      setIsPinnedByClick(next);
      return next;
    });
  };

  const closeFlyout = () => {
    clearCloseTimeout();
    setIsModulesFlyoutOpen(false);
    setIsPinnedByClick(false);
    setSearchQuery("");
  };

  // Cerrar el menú flotante al navegar
  useEffect(() => {
    closeFlyout();
  }, [pathname]);

  // Enfocar input cuando se abre con clic
  useEffect(() => {
    if (isModulesFlyoutOpen && isPinnedByClick) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isModulesFlyoutOpen, isPinnedByClick]);

  // Cerrar al hacer clic afuera o con tecla Escape
  useEffect(() => {
    if (!isModulesFlyoutOpen) return;

    const handlePointerDownOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (
        flyoutRef.current &&
        !flyoutRef.current.contains(target) &&
        modulesButtonRef.current &&
        !modulesButtonRef.current.contains(target)
      ) {
        closeFlyout();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeFlyout();
      }
    };

    document.addEventListener("mousedown", handlePointerDownOutside);
    document.addEventListener("touchstart", handlePointerDownOutside);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDownOutside);
      document.removeEventListener("touchstart", handlePointerDownOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModulesFlyoutOpen]);

  // Cleanup de timeout
  useEffect(() => {
    return () => {
      clearCloseTimeout();
    };
  }, []);

  return (
    <aside
      aria-label="Barra lateral de navegación principal"
      className={`relative hidden lg:flex flex-col shrink-0 h-screen bg-white dark:bg-[#0D0F16] border-r border-slate-200 dark:border-white/[0.08] transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] z-30 ${
        isCollapsed ? "w-[72px]" : "w-72"
      }`}
    >
      {/* 1. Header con Branding Genérico */}
      <div className="h-16 flex items-center justify-between px-3.5 border-b border-slate-200 dark:border-white/[0.08] shrink-0">
        <Link
          href={branding.homeUrl}
          onClick={() => {
            if (pathname !== branding.homeUrl) {
              startNavigation(branding.homeUrl);
            }
          }}
          className="flex items-center gap-3 w-full min-w-0 overflow-hidden focus:outline-hidden focus:ring-1 focus:ring-[#ED500A] rounded-xl p-1.5 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
        >
          {branding.logoUrl ? (
            <div className="relative w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-white p-1 shadow-xs border border-slate-200 dark:border-white/[0.08] overflow-hidden">
              <Image
                src={branding.logoUrl}
                alt={branding.appTitle}
                fill
                sizes="36px"
                className="object-contain"
                unoptimized
              />
            </div>
          ) : (
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
          )}

          {!isCollapsed && (
            <div className="flex flex-col min-w-0 flex-1 transition-opacity duration-200">
              <span
                className="font-title font-bold text-sm text-slate-900 dark:text-white truncate tracking-tight block leading-snug"
                title={branding.appTitle}
              >
                {branding.appTitle}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {branding.appSubtitle && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-orange-50 text-[#ED500A] border border-orange-200/80 dark:bg-[#ED500A]/15 dark:text-[#ED500A] dark:border-[#ED500A]/30 shrink-0">
                    {branding.appSubtitle}
                  </span>
                )}
                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {branding.appSubtitle === "Admin" ? "Panel Central" : "Espacio de Trabajo"}
                </span>
              </div>
            </div>
          )}
        </Link>
      </div>

      {/* 2. Navegación Principal */}
      {!isCollapsed ? (
        /* ================= MODO EXPANDIDO (COMPORTAMIENTO ORIGINAL INTACTO) ================= */
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10">
          {navSections.map((section) => {
            const visibleItems = section.items.filter((item) => item.allowed !== false);
            if (visibleItems.length === 0) return null;

            const isSectionOpen = openSections[section.id] ?? true;

            return (
              <div key={section.id} className="space-y-1">
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

                {isSectionOpen && (
                  <div className="space-y-1 animate-in fade-in-50 duration-150">
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = isRouteActive(item.href, pathname, searchParams, item.exactMatch);

                      return (
                        <div key={item.id} className="relative">
                          <Link
                            href={item.href}
                            onClick={() => {
                              if (!isActive) {
                                startNavigation(item.href);
                              }
                            }}
                            className={`group flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 relative ${
                              isActive
                                ? "bg-orange-50 text-[#ED500A] font-semibold border border-orange-200/70 dark:bg-[#ED500A]/10 dark:text-[#ED500A] dark:border-[#ED500A]/20"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.04]"
                            }`}
                            aria-current={isActive ? "page" : undefined}
                          >
                            <Icon
                              className={`w-4 h-4 shrink-0 transition-transform duration-150 ${
                                isActive
                                  ? "text-[#ED500A]"
                                  : "text-slate-500 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200"
                              }`}
                            />

                            <div className="flex items-center justify-between flex-1 min-w-0">
                              <span className="truncate">{item.label}</span>
                              {item.badge ? (
                                <span
                                  className={`ml-2 px-1.5 py-0.2 rounded text-[10px] font-mono border ${
                                    item.badge.variant === "warning"
                                      ? "bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
                                      : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/[0.06] dark:text-slate-300 dark:border-white/[0.08]"
                                  }`}
                                >
                                  {item.badge.text}
                                </span>
                              ) : null}
                            </div>

                            {isActive && (
                              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#ED500A]" />
                            )}
                          </Link>

                          {isActive && item.subItems && (
                            <div className="ml-7 mt-1 space-y-0.5 border-l border-slate-200 dark:border-white/[0.08] pl-2.5 animate-in fade-in-50 duration-150">
                              {item.subItems.map((subItem) => {
                                const SubIcon = subItem.icon;
                                const isSubActive = isRouteActive(subItem.href, pathname, searchParams);
                                return (
                                  <Link
                                    key={subItem.id}
                                    href={subItem.href}
                                    onClick={() => {
                                      if (!isSubActive) {
                                        startNavigation(subItem.href);
                                      }
                                    }}
                                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                                      isSubActive
                                        ? "bg-orange-50 text-[#ED500A] font-semibold dark:bg-[#ED500A]/10"
                                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.04]"
                                    }`}
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
      ) : (
        /* ================= MODO COLAPSADO (SOLO OPERACIONES + MÓDULOS) ================= */
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-1.5 space-y-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10">
          {/* Grupo Único Visible: Operaciones */}
          <div className="space-y-1.5">
            {visibleCollapsedItems.map((item) => {
              const Icon = item.icon;
              const isActive = isRouteActive(item.href, pathname, searchParams, item.exactMatch);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => {
                    if (!isActive) {
                      startNavigation(item.href);
                    }
                  }}
                  className={`group flex flex-col items-center justify-center p-1.5 rounded-xl transition-all duration-150 relative w-[60px] min-h-[50px] mx-auto text-center ${
                    isActive
                      ? "bg-orange-50 text-[#ED500A] font-semibold border border-orange-200/70 dark:bg-[#ED500A]/10 dark:text-[#ED500A] dark:border-[#ED500A]/20 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.04]"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                  title={item.label}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 transition-transform duration-150 ${
                      isActive
                        ? "text-[#ED500A]"
                        : "text-slate-500 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200"
                    }`}
                  />
                  <span className="text-[9px] font-medium leading-tight tracking-tight mt-1 truncate max-w-[54px] text-center">
                    {item.label}
                  </span>
                  {item.badge && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-[#0D0F16]" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Separador hacia la opción Módulos */}
          {hiddenSections.length > 0 && (
            <div className="w-full flex justify-center py-1">
              <div className="w-6 h-[1px] bg-slate-200 dark:bg-white/[0.08]" />
            </div>
          )}

          {/* Opción Nueva: Módulos */}
          {hiddenSections.length > 0 && (
            <div className="flex justify-center">
              <button
                ref={modulesButtonRef}
                type="button"
                onClick={handleModulesClick}
                onMouseEnter={handleModulesMouseEnter}
                onMouseLeave={handleModulesMouseLeave}
                aria-haspopup="dialog"
                aria-expanded={isModulesFlyoutOpen}
                className={`group flex flex-col items-center justify-center p-1.5 rounded-xl transition-all duration-150 relative w-[60px] min-h-[50px] mx-auto text-center ${
                  isAnyHiddenActive || isModulesFlyoutOpen
                    ? "bg-orange-50 text-[#ED500A] font-semibold border border-orange-200/70 dark:bg-[#ED500A]/10 dark:text-[#ED500A] dark:border-[#ED500A]/20 shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.04]"
                }`}
                title="Módulos"
              >
                <LayoutGrid
                  className={`w-5 h-5 shrink-0 transition-transform duration-150 ${
                    isAnyHiddenActive || isModulesFlyoutOpen
                      ? "text-[#ED500A]"
                      : "text-slate-500 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200"
                  }`}
                />
                <span className="text-[9px] font-medium leading-tight tracking-tight mt-1 truncate max-w-[54px] text-center">
                  Módulos
                </span>
                {isAnyHiddenActive && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#ED500A]" />
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. Menú Flotante de Módulos (Renderizado en Portal para evitar recorte) */}
      {isCollapsed && isModulesFlyoutOpen && hiddenSections.length > 0 && (
        <ModalPortal>
          {/* Telón sutil solo si fue fijado por clic/tap para cerrar tocando afuera */}
          {isPinnedByClick && (
            <div
              className="fixed inset-0 z-40 bg-black/20"
              onClick={closeFlyout}
            />
          )}

          <div
            ref={flyoutRef}
            onMouseEnter={handleFlyoutMouseEnter}
            onMouseLeave={handleFlyoutMouseLeave}
            style={{ top: `${flyoutTop}px` }}
            className="fixed left-[76px] z-50 w-80 sm:w-[350px] max-h-[min(580px,calc(100vh-32px))] bg-[#0D0F16] border border-slate-700/60 dark:border-white/[0.1] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white animate-in fade-in zoom-in-95 duration-150"
            role="dialog"
            aria-label="Menú de Módulos"
          >
            {/* Header con Buscador Superior */}
            <div className="p-3 border-b border-white/[0.08] bg-[#0D0F16] shrink-0">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar módulo..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-white/[0.05] border border-white/[0.08] rounded-xl text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#ED500A] focus:border-[#ED500A] font-body"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 p-1 rounded-md text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Lista de Opciones con Ícono, Nombre y Estado Activo Resaltado */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
              {filteredHiddenSections.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 font-body">
                  No se encontraron módulos coincidentes con &quot;{searchQuery}&quot;
                </div>
              ) : (
                filteredHiddenSections.map((section) => (
                  <div key={section.id} className="space-y-1">
                    <div className="px-2 py-1 text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                      {section.label}
                    </div>

                    <div className="space-y-1">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = isRouteActive(item.href, pathname, searchParams, item.exactMatch);

                        return (
                          <div key={item.id} className="space-y-0.5">
                            <Link
                              href={item.href}
                              onClick={() => {
                                closeFlyout();
                                if (!isActive) startNavigation(item.href);
                              }}
                              className={`group flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                                isActive
                                  ? "bg-[#ED500A]/15 text-[#ED500A] font-semibold border border-[#ED500A]/30 shadow-xs"
                                  : "text-slate-300 hover:text-white hover:bg-white/[0.05] border border-transparent"
                              }`}
                            >
                              <div
                                className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                                  isActive
                                    ? "bg-[#ED500A]/20 text-[#ED500A]"
                                    : "bg-white/[0.06] text-slate-400 group-hover:text-slate-200"
                                }`}
                              >
                                <Icon className="w-4 h-4" />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="truncate">{item.label}</span>
                                  {item.badge && (
                                    <span
                                      className={`ml-2 px-1.5 py-0.2 rounded text-[9px] font-mono border ${
                                        item.badge.variant === "warning"
                                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                          : "bg-white/[0.06] text-slate-300 border-white/[0.08]"
                                      }`}
                                    >
                                      {item.badge.text}
                                    </span>
                                  )}
                                </div>
                                {item.description && (
                                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            </Link>

                            {/* Sub-items si existen */}
                            {item.subItems && item.subItems.length > 0 && (
                              <div className="ml-8 space-y-0.5 border-l border-white/[0.08] pl-2 pt-0.5">
                                {item.subItems.map((subItem) => {
                                  const SubIcon = subItem.icon;
                                  const isSubActive = isRouteActive(subItem.href, pathname, searchParams);
                                  return (
                                    <Link
                                      key={subItem.id}
                                      href={subItem.href}
                                      onClick={() => {
                                        closeFlyout();
                                        if (!isSubActive) startNavigation(subItem.href);
                                      }}
                                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                                        isSubActive
                                          ? "bg-[#ED500A]/15 text-[#ED500A] font-semibold"
                                          : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                                      }`}
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
                  </div>
                ))
              )}
            </div>
          </div>
        </ModalPortal>
      )}

      {/* 4. Footer del Sidebar: Botón Exclusivo para Desglosar / Colapsar la Barra Lateral */}
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
