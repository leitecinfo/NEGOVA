"use client";

import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { AdminButton } from "./admin-button";

export interface AdminPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  currentCount: number;
  pageSize?: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  isPending?: boolean;
  className?: string;
  showFirstLast?: boolean;
}

export function AdminPagination({
  currentPage,
  totalPages,
  totalItems,
  currentCount,
  pageSize = 10,
  itemLabel = "registros",
  onPageChange,
  onPageSizeChange,
  isPending = false,
  className = "",
  showFirstLast = false,
}: AdminPaginationProps) {
  const from = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(from + currentCount - 1, totalItems);

  if (totalPages <= 1 && totalItems <= pageSize) {
    return (
      <div
        className={`flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-[#0D0E12] border border-slate-200/80 dark:border-white/[0.08] shadow-xs text-xs font-body ${className}`}
      >
        <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
          Mostrando <span className="font-semibold text-slate-900 dark:text-white">{currentCount}</span> de{" "}
          <span className="font-semibold text-slate-900 dark:text-white">{totalItems}</span> {itemLabel}
        </div>
        <div className="font-mono text-[11px] text-slate-400">
          Pág. 1 de 1
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-[#0D0E12] border border-slate-200/80 dark:border-white/[0.08] shadow-xs text-xs font-body ${className}`}
    >
      <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
        Mostrando <span className="font-semibold text-slate-900 dark:text-white">{from}–{to}</span> de{" "}
        <span className="font-semibold text-slate-900 dark:text-white">{totalItems}</span> {itemLabel}
      </div>

      <div className="flex items-center gap-1.5">
        {showFirstLast && (
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={currentPage <= 1 || isPending}
            className="p-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] disabled:opacity-30 transition-all cursor-pointer"
            title="Primera página"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || isPending}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] disabled:opacity-40 transition-all cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Anterior</span>
        </button>

        <div className="px-3 py-1.5 font-mono font-semibold text-slate-700 dark:text-slate-300 text-xs">
          Pág. {currentPage} de {Math.max(1, totalPages)}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || isPending}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] disabled:opacity-40 transition-all cursor-pointer"
        >
          <span>Siguiente</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {showFirstLast && (
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages || isPending}
            className="p-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] disabled:opacity-30 transition-all cursor-pointer"
            title="Última página"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
