"use client";

import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Select } from "@/components/ui/select";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  totalCount?: number;
  currentCount?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  itemLabel?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  isPending?: boolean;
  isLoading?: boolean;
  className?: string;
  showFirstLast?: boolean;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  totalCount,
  currentCount,
  pageSize = 10,
  pageSizeOptions = [10, 20, 50, 100],
  itemLabel = "registros",
  onPageChange,
  onPageSizeChange,
  isPending = false,
  isLoading = false,
  className = "",
  showFirstLast = false,
}: PaginationProps) {
  const total = totalItems ?? totalCount ?? 0;
  const pending = isPending || isLoading;

  const effectiveCurrentCount =
    currentCount !== undefined
      ? currentCount
      : Math.min(pageSize, Math.max(0, total - (currentPage - 1) * pageSize));

  const from = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(from + effectiveCurrentCount - 1, total);

  if (totalPages <= 1 && total <= pageSize && !onPageSizeChange) {
    return (
      <div
        className={`flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs text-xs font-body ${className}`}
      >
        <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
          Mostrando <span className="font-semibold text-slate-900 dark:text-white">{effectiveCurrentCount}</span> de{" "}
          <span className="font-semibold text-slate-900 dark:text-white">{total}</span> {itemLabel}
        </div>
        <div className="font-mono text-[11px] text-slate-400">
          Pág. 1 de 1
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs text-xs font-body ${className}`}
    >
      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
        <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
          Mostrando <span className="font-semibold text-slate-900 dark:text-white">{from}–{to}</span> de{" "}
          <span className="font-semibold text-slate-900 dark:text-white">{total}</span> {itemLabel}
        </div>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
              Filas:
            </span>
            <Select
              aria-label="Registros por página"
              selectSize="sm"
              value={pageSize}
              onChange={(e) => {
                const val = typeof e === "number" ? e : Number(e.target?.value || e);
                onPageSizeChange(val);
              }}
              options={pageSizeOptions.map((opt) => ({
                value: String(opt),
                label: String(opt),
              }))}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {showFirstLast && (
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={currentPage <= 1 || pending}
            className="p-1.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.06] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
            title="Primera página"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || pending}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.06] disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Anterior</span>
        </button>

        <div className="px-2 sm:px-3 py-1.5 font-mono font-semibold text-slate-700 dark:text-slate-300 text-xs">
          Pág. {currentPage} de {Math.max(1, totalPages)}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || pending}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.06] disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
        >
          <span>Siguiente</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {showFirstLast && (
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages || pending}
            className="p-1.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.06] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
            title="Última página"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// Aliases para retrocompatibilidad total
export const AdminPagination = Pagination;
export type AdminPaginationProps = PaginationProps;
