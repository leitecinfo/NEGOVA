"use client";

import React from "react";
import { RefreshCw } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";

export interface TableToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit?: (e: React.FormEvent) => void;
  searchPlaceholder?: string;
  onRefresh?: () => void;
  isPending?: boolean;
  tabs?: React.ReactNode;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  onClearSearch?: () => void;
  className?: string;
  layout?: "inline" | "stacked";
}

export function TableToolbar({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  searchPlaceholder = "Buscar...",
  onRefresh,
  isPending = false,
  tabs,
  filters,
  actions,
  onClearSearch,
  className = "",
  layout = "inline",
}: TableToolbarProps) {
  if (layout === "stacked") {
    return (
      <div
        className={`p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-3 font-body ${className}`}
      >
        {/* Fila 1: Tabs (si existen) */}
        {tabs && <div className="min-w-0">{tabs}</div>}

        {/* Fila 2: Buscador Principal y Acciones / Actualizar */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex-1 min-w-0">
            <SearchInput
              value={searchQuery}
              onChange={onSearchChange}
              onSubmit={onSearchSubmit}
              placeholder={searchPlaceholder}
              isLoading={isPending}
              onClear={onClearSearch}
            />
          </div>

          {(actions || onRefresh) && (
            <div className="flex items-center gap-2 shrink-0">
              {actions}

              {onRefresh && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  disabled={isPending}
                  leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />}
                  className="h-10 px-2.5 sm:px-3 text-xs"
                >
                  <span className="hidden sm:inline">Actualizar</span>
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Fila 3: Filtros Multicriterio Envolventes */}
        {filters && (
          <div className="pt-2.5 border-t border-slate-100 dark:border-white/[0.06] w-full">
            {filters}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-4 font-body ${className}`}
    >
      {/* Fila Superior: Tabs / Ámbito y Acciones Globales */}
      {(tabs || onRefresh || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {tabs && <div className="flex-1 min-w-0">{tabs}</div>}

          <div className="flex items-center gap-2 shrink-0">
            {actions}

            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isPending}
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />}
              >
                <span className="hidden sm:inline">Actualizar</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Fila Inferior: Buscador y Filtros Dropdown */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        {/* Buscador Reutilizable */}
        <div className="flex-1 min-w-0 sm:min-w-[220px]">
          <SearchInput
            value={searchQuery}
            onChange={onSearchChange}
            onSubmit={onSearchSubmit}
            placeholder={searchPlaceholder}
            isLoading={isPending}
            onClear={onClearSearch}
          />
        </div>

        {/* Filtros Dropdown */}
        {filters && (
          <div className="flex flex-wrap items-center gap-2 max-w-full">{filters}</div>
        )}
      </div>
    </div>
  );
}

// Aliases para retrocompatibilidad total
export const AdminTableToolbar = TableToolbar;
export type AdminTableToolbarProps = TableToolbarProps;
