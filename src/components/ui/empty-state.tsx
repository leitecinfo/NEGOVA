"use client";

import React from "react";
import Link from "next/link";
import { LucideIcon, Inbox } from "lucide-react";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  resetLabel?: string;
  onReset?: () => void;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  resetLabel,
  onReset,
}: EmptyStateProps) {
  return (
    <div className="p-12 text-center rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-3 font-body">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/[0.04] text-slate-400 flex items-center justify-center mx-auto">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-slate-900 dark:text-white font-title">
        {title}
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
        {description}
      </p>

      {(onReset || actionLabel) && (
        <div className="flex items-center justify-center gap-2 pt-2">
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.1] text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
            >
              {resetLabel || "Limpiar Filtros"}
            </button>
          )}

          {actionHref && actionLabel && (
            <Link
              href={actionHref}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ED500A] hover:bg-[#D44405] text-white text-xs font-semibold shadow-xs transition-all"
            >
              <span>{actionLabel}</span>
            </Link>
          )}

          {!actionHref && onAction && actionLabel && (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ED500A] hover:bg-[#D44405] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <span>{actionLabel}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Aliases para retrocompatibilidad total
export const AdminEmptyState = EmptyState;
export type AdminEmptyStateProps = EmptyStateProps;
