"use client";

import React from "react";
import { LucideIcon, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  resetLabel?: string;
  onReset?: () => void;
  className?: string;
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
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`p-12 text-center rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-3 font-body ${className}`}>
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReset}
            >
              {resetLabel || "Limpiar Filtros"}
            </Button>
          )}

          {actionLabel && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              href={actionHref}
              onClick={onAction}
            >
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Aliases para retrocompatibilidad total
export const AdminEmptyState = EmptyState;
export type AdminEmptyStateProps = EmptyStateProps;
