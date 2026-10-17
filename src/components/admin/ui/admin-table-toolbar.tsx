"use client";

import React from "react";
import { RefreshCw } from "lucide-react";
import { AdminSearchInput } from "./admin-search-input";
import { AdminButton } from "./admin-button";

export interface AdminTableToolbarProps {
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

export function AdminTableToolbar({
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
}: AdminTableToolbarProps) {
  if (layout === "stacked") {
    return (
      <div
        className={`p-4 rounded-2xl bg-white dark:bg-[#0D0E12] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-3 font-body ${className}`}
      >
        {/* Fila 1: Tabs (si existen) */}
        {tabs && <div className="min-w-0">{tabs}</div>}

        {/* Fila 2: Buscador Principal y Acciones / Actualizar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <AdminSearchInput
              value={searchQuery}
              onChange={onSearchChange}
              onSubmit={onSearchSubmit}
              placeholder={searchPlaceholder}
              isLoading={isPending}
              onClear={onClearSearch}
            />
          </div>

          {(actions || onRefresh) && (
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              {actions}

              {onRefresh && (
                <AdminButton
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  disabled={isPending}
                  leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />}
                >
                  <span>Actualizar</span>
                </AdminButton>
              )}
            </div>
          )}
        </div>

        {/* Fila 3: Filtros Multicriterio Envolventes */}
        {filters && (
          <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] flex flex-wrap items-center gap-2">
            {filters}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`p-4 rounded-2xl bg-white dark:bg-[#0D0E12] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-4 font-body ${className}`}
    >
      {/* Fila Superior: Tabs / Ámbito y Acciones Globales */}
      {(tabs || onRefresh || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {tabs && <div className="flex-1 min-w-0">{tabs}</div>}

          <div className="flex items-center gap-2 shrink-0">
            {actions}

            {onRefresh && (
              <AdminButton
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isPending}
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />}
              >
                <span className="hidden sm:inline">Actualizar</span>
              </AdminButton>
            )}
          </div>
        </div>
      )}

      {/* Fila Inferior: Buscador y Filtros Dropdown */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        {/* Buscador Reutilizable */}
        <div className="flex-1 min-w-0 sm:min-w-[220px]">
          <AdminSearchInput
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
