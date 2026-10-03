"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, ArrowRight, Shield, CornerDownLeft } from "lucide-react";
import { ALL_ADMIN_NAV_ITEMS } from "@/config/admin-navigation";

interface AdminCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminCommandPalette({ isOpen, onClose }: AdminCommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filtrar items y subitems según la búsqueda
  const allSearchableItems = React.useMemo(() => {
    const items: Array<{
      id: string;
      label: string;
      href: string;
      icon: any;
      section: string;
      description?: string;
    }> = [];

    ALL_ADMIN_NAV_ITEMS.forEach((item) => {
      items.push({
        id: item.id,
        label: item.label,
        href: item.href,
        icon: item.icon,
        section: item.section,
        description: item.description,
      });

      if (item.subItems) {
        item.subItems.forEach((sub) => {
          items.push({
            id: `${item.id}-${sub.id}`,
            label: `${item.label} › ${sub.label}`,
            href: sub.href,
            icon: sub.icon,
            section: item.section,
            description: sub.description,
          });
        });
      }
    });

    return items;
  }, []);

  // Filtrar items según la búsqueda
  const filteredItems = React.useMemo(() => {
    if (!query.trim()) return allSearchableItems;
    const lower = query.toLowerCase();
    return allSearchableItems.filter(
      (item) =>
        item.label.toLowerCase().includes(lower) ||
        item.description?.toLowerCase().includes(lower) ||
        item.section.toLowerCase().includes(lower)
    );
  }, [query, allSearchableItems]);

  // Enfocar input al abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  // Navegación por teclado dentro del modal
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
      } else if (e.key === "Enter" && filteredItems[selectedIndex]) {
        e.preventDefault();
        handleSelect(filteredItems[selectedIndex].href);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex]);

  const handleSelect = (href: string) => {
    onClose();
    router.push(href);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de comandos globales"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 px-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Contenedor del Modal */}
      <div className="relative w-full max-w-xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden z-50 animate-in zoom-in-95 duration-150 flex flex-col max-h-[75vh]">
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
            placeholder="Escribe un comando o busca un módulo..."
            aria-label="Campo de búsqueda de comandos"
            className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:outline-none focus:ring-0 border-none font-body shadow-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-500 border border-slate-200 dark:border-white/[0.08]">
            ESC
          </kbd>
        </div>

        {/* Lista de Resultados */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 font-body">
              No se encontraron módulos coincidentes con &quot;{query}&quot;
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.href)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs transition-all ${
                    isSelected
                      ? "bg-orange-50 text-[#ED500A] dark:bg-[#ED500A]/10 dark:text-[#ED500A]"
                      : "text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-1.5 rounded-lg shrink-0 ${
                        isSelected
                          ? "bg-orange-100 text-[#ED500A] dark:bg-[#ED500A]/20 dark:text-[#ED500A]"
                          : "bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{item.label}</p>
                      {item.description && (
                        <p className="text-[11px] text-slate-400 truncate">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-[10px] font-mono uppercase text-slate-400 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.04]">
                      {item.section}
                    </span>
                    {isSelected && (
                      <CornerDownLeft className="w-3.5 h-3.5 text-[#ED500A]" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer del Command Palette */}
        <div className="px-4 py-2 border-t border-slate-200 dark:border-white/[0.06] bg-slate-50/70 dark:bg-white/[0.02] flex items-center justify-between text-[11px] text-slate-400 font-mono shrink-0">
          <div className="flex items-center gap-3">
            <span>↑↓ para navegar</span>
            <span>↵ para seleccionar</span>
          </div>
          <span className="text-[10px]">NEGOVA Command Engine</span>
        </div>
      </div>
    </div>
  );
}
