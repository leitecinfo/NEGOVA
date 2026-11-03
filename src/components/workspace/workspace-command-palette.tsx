"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  CornerDownLeft,
  Package,
  Users,
  Receipt,
  Compass,
  ArrowRight,
  Loader2,
  Clock,
  Sparkles,
} from "lucide-react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { AppNavSection } from "@/components/layout/navigation-types";
import { WorkspaceSearchResultItem } from "@/lib/search/types";
import { searchWorkspaceGlobalAction } from "@/app/workspace/[businessId]/search-actions";

interface WorkspaceCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  navSections: AppNavSection[];
}

export function WorkspaceCommandPalette({
  isOpen,
  onClose,
  businessId,
  navSections,
}: WorkspaceCommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [durationMs, setDurationMs] = useState<number | null>(null);

  const [remoteResults, setRemoteResults] = useState<{
    products: WorkspaceSearchResultItem[];
    customers: WorkspaceSearchResultItem[];
    orders: WorkspaceSearchResultItem[];
  }>({
    products: [],
    customers: [],
    orders: [],
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Extraer todos los módulos navegables del Workspace
  const allModules = useMemo(() => {
    const list: WorkspaceSearchResultItem[] = [];

    navSections.forEach((section) => {
      section.items.forEach((item) => {
        if (item.allowed !== false) {
          list.push({
            id: `mod-${item.id}`,
            category: "module",
            title: item.label,
            subtitle: item.description || `Sección: ${section.label}`,
            href: item.href.startsWith("http") || item.href.startsWith("/")
              ? item.href
              : `/workspace/${businessId}/${item.href}`,
            badge: section.label,
          });

          if (item.subItems) {
            item.subItems.forEach((sub) => {
              list.push({
                id: `mod-${item.id}-${sub.id}`,
                category: "module",
                title: `${item.label} › ${sub.label}`,
                subtitle: sub.description || item.description,
                href: sub.href.startsWith("http") || sub.href.startsWith("/")
                  ? sub.href
                  : `/workspace/${businessId}/${sub.href}`,
                badge: section.label,
              });
            });
          }
        }
      });
    });

    return list;
  }, [navSections, businessId]);

  // 2. Filtrado de módulos locales (instantáneo, 0ms)
  const filteredModules = useMemo(() => {
    if (!query.trim()) return allModules.slice(0, 6);
    const q = query.toLowerCase().trim();
    return allModules
      .filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.subtitle?.toLowerCase().includes(q) ||
          m.badge?.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [query, allModules]);

  // 3. Consulta remota de productos, clientes y comandas con debounce
  useEffect(() => {
    const q = query.trim();

    if (!q) {
      setRemoteResults({ products: [], customers: [], orders: [] });
      setDurationMs(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await searchWorkspaceGlobalAction(businessId, q);
        if (res.success && res.data) {
          setRemoteResults({
            products: res.data.products || [],
            customers: res.data.customers || [],
            orders: res.data.orders || [],
          });
          setDurationMs(res.data.durationMs);
        }
      } catch (err) {
        console.error("[WorkspaceCommandPalette fetch error]:", err);
      } finally {
        setIsLoading(false);
      }
    }, 120);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, businessId]);

  // 4. Lista aplanada combinada para navegación lineal por teclado
  const flattenedItems = useMemo(() => {
    return [
      ...filteredModules,
      ...remoteResults.products,
      ...remoteResults.customers,
      ...remoteResults.orders,
    ];
  }, [filteredModules, remoteResults]);

  // Enfocar automáticamente el input al abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 60);
      setSelectedIndex(0);
    } else {
      setQuery("");
      setRemoteResults({ products: [], customers: [], orders: [] });
      setDurationMs(null);
    }
  }, [isOpen]);

  // Manejo de navegación por teclado (Arriba, Abajo, Enter, Escape)
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (flattenedItems.length || 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + flattenedItems.length) % (flattenedItems.length || 1));
      } else if (e.key === "Enter" && flattenedItems[selectedIndex]) {
        e.preventDefault();
        handleSelect(flattenedItems[selectedIndex].href);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, flattenedItems, selectedIndex]);

  const handleSelect = (href: string) => {
    onClose();
    router.push(href);
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Paleta de búsqueda global del workspace"
        className="fixed inset-0 z-[9999] flex items-start justify-center pt-16 sm:pt-24 px-4 m-0"
      >
        {/* Fondo oscurecido con desenfoque */}
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
          onClick={onClose}
        />

        {/* Contenedor Principal del Modal */}
        <div className="relative w-full max-w-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden z-50 animate-in zoom-in-95 duration-150 flex flex-col max-h-[78vh]">
          {/* Input de Búsqueda */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-white/[0.08] shrink-0">
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Buscar productos, clientes, comandas o módulos..."
              aria-label="Campo de búsqueda global en workspace"
              className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:outline-none focus:ring-0 border-none font-body shadow-none"
            />

            {isLoading && (
              <Loader2 className="w-4 h-4 animate-spin text-[#ED500A] shrink-0" />
            )}

            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSelectedIndex(0);
                  inputRef.current?.focus();
                }}
                className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                title="Limpiar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-500 border border-slate-200 dark:border-white/[0.08] shrink-0">
              ESC
            </kbd>
          </div>

          {/* Lista de Resultados con Categorías */}
          <div className="flex-1 overflow-y-auto p-2 space-y-3">
            {flattenedItems.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400 font-body space-y-1">
                <Search className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="font-semibold text-slate-700 dark:text-slate-200">
                  No se encontraron resultados para &quot;{query}&quot;
                </p>
                <p className="text-[11px] text-slate-400">
                  Prueba buscando por nombre de producto, SKU, cédula/teléfono de cliente o número de comanda.
                </p>
              </div>
            ) : (
              <>
                {/* 1. Módulos y Navegación */}
                {filteredModules.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-blue-500" />
                      <span>Módulos del Sistema</span>
                    </div>
                    <div className="space-y-0.5 mt-0.5">
                      {filteredModules.map((item) => {
                        const globalIndex = flattenedItems.findIndex((it) => it.id === item.id);
                        const isSelected = globalIndex === selectedIndex;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelect(item.href)}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-all ${
                              isSelected
                                ? "bg-orange-50 text-[#ED500A] dark:bg-[#ED500A]/10 dark:text-[#ED500A]"
                                : "text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/[0.04]"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`p-1.5 rounded-lg shrink-0 ${
                                  isSelected
                                    ? "bg-orange-100 text-[#ED500A] dark:bg-[#ED500A]/20"
                                    : "bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400"
                                }`}
                              >
                                <Compass className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold truncate">{item.title}</p>
                                {item.subtitle && (
                                  <p className="text-[11px] text-slate-400 truncate">
                                    {item.subtitle}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              {item.badge && (
                                <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.04]">
                                  {item.badge}
                                </span>
                              )}
                              {isSelected && (
                                <CornerDownLeft className="w-3.5 h-3.5 text-[#ED500A]" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. Productos */}
                {remoteResults.products.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Productos del Catálogo</span>
                    </div>
                    <div className="space-y-0.5 mt-0.5">
                      {remoteResults.products.map((item) => {
                        const globalIndex = flattenedItems.findIndex((it) => it.id === item.id);
                        const isSelected = globalIndex === selectedIndex;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelect(item.href)}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-all ${
                              isSelected
                                ? "bg-orange-50 text-[#ED500A] dark:bg-[#ED500A]/10 dark:text-[#ED500A]"
                                : "text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/[0.04]"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`p-1.5 rounded-lg shrink-0 ${
                                  isSelected
                                    ? "bg-orange-100 text-[#ED500A] dark:bg-[#ED500A]/20"
                                    : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                                }`}
                              >
                                <Package className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold truncate">{item.title}</p>
                                {item.subtitle && (
                                  <p className="text-[11px] text-slate-400 truncate">
                                    {item.subtitle}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              {item.badge && (
                                <span
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                    item.badge === "Disponible"
                                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                      : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                                  }`}
                                >
                                  {item.badge}
                                </span>
                              )}
                              {isSelected && (
                                <CornerDownLeft className="w-3.5 h-3.5 text-[#ED500A]" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Clientes */}
                {remoteResults.customers.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Clientes Registrados</span>
                    </div>
                    <div className="space-y-0.5 mt-0.5">
                      {remoteResults.customers.map((item) => {
                        const globalIndex = flattenedItems.findIndex((it) => it.id === item.id);
                        const isSelected = globalIndex === selectedIndex;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelect(item.href)}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-all ${
                              isSelected
                                ? "bg-orange-50 text-[#ED500A] dark:bg-[#ED500A]/10 dark:text-[#ED500A]"
                                : "text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/[0.04]"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`p-1.5 rounded-lg shrink-0 ${
                                  isSelected
                                    ? "bg-orange-100 text-[#ED500A] dark:bg-[#ED500A]/20"
                                    : "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                                }`}
                              >
                                <Users className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold truncate">{item.title}</p>
                                {item.subtitle && (
                                  <p className="text-[11px] text-slate-400 truncate">
                                    {item.subtitle}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                                Perfil
                              </span>
                              {isSelected && (
                                <CornerDownLeft className="w-3.5 h-3.5 text-[#ED500A]" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 4. Pedidos Recientes */}
                {remoteResults.orders.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-amber-500" />
                      <span>Comandas y Pedidos Recientes</span>
                    </div>
                    <div className="space-y-0.5 mt-0.5">
                      {remoteResults.orders.map((item) => {
                        const globalIndex = flattenedItems.findIndex((it) => it.id === item.id);
                        const isSelected = globalIndex === selectedIndex;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelect(item.href)}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-all ${
                              isSelected
                                ? "bg-orange-50 text-[#ED500A] dark:bg-[#ED500A]/10 dark:text-[#ED500A]"
                                : "text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/[0.04]"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`p-1.5 rounded-lg shrink-0 ${
                                  isSelected
                                    ? "bg-orange-100 text-[#ED500A] dark:bg-[#ED500A]/20"
                                    : "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
                                }`}
                              >
                                <Receipt className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold truncate">{item.title}</p>
                                {item.subtitle && (
                                  <p className="text-[11px] text-slate-400 truncate">
                                    {item.subtitle}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              {item.badge && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08]">
                                  {item.badge}
                                </span>
                              )}
                              {isSelected && (
                                <CornerDownLeft className="w-3.5 h-3.5 text-[#ED500A]" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer de Ayuda y Métricas */}
          <div className="px-4 py-2 border-t border-slate-200 dark:border-white/[0.06] bg-slate-50/70 dark:bg-white/[0.02] flex items-center justify-between text-[11px] text-slate-400 font-mono shrink-0">
            <div className="flex items-center gap-3">
              <span>↑↓ Navegar</span>
              <span>↵ Seleccionar</span>
              <span>ESC Cerrar</span>
            </div>

            <div className="flex items-center gap-2">
              {durationMs !== null && (
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {durationMs}ms
                </span>
              )}
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                NEGOVA Workspace
              </span>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
