"use client";

import React from "react";

export type StatusBadgeVariant =
  | "emerald"
  | "amber"
  | "red"
  | "blue"
  | "purple"
  | "slate"
  | "orange";

export interface StatusBadgeProps {
  status?: string;
  label?: string;
  variant?: StatusBadgeVariant;
  showDot?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

const BADGE_STYLES: Record<StatusBadgeVariant, string> = {
  emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  red: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",
  blue: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
  purple: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
  slate: "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400",
  orange: "bg-orange-500/10 text-[#ED500A] border-orange-500/20 dark:text-orange-400",
};

const STATUS_MAP: Record<string, { label: string; variant: StatusBadgeVariant }> = {
  active: { label: "Activo", variant: "emerald" },
  trial: { label: "En prueba", variant: "blue" },
  suspended: { label: "Suspendido", variant: "red" },
  inactive: { label: "Inactivo", variant: "slate" },
  disabled: { label: "Desactivado", variant: "red" },
  pending: { label: "Pendiente", variant: "amber" },
  blocked: { label: "Bloqueado", variant: "red" },
  cancelled: { label: "Cancelado", variant: "slate" },
};

export function StatusBadge({
  status,
  label,
  variant,
  showDot = true,
  className = "",
  icon,
}: StatusBadgeProps) {
  let resolvedLabel = label || "";
  let resolvedVariant = variant || "slate";

  if (status && STATUS_MAP[status]) {
    if (!label) resolvedLabel = STATUS_MAP[status].label;
    if (!variant) resolvedVariant = STATUS_MAP[status].variant;
  } else if (status && !label) {
    resolvedLabel = status;
  }

  const style = BADGE_STYLES[resolvedVariant] || BADGE_STYLES.slate;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${style} ${className}`}
    >
      {showDot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {icon}
      <span>{resolvedLabel}</span>
    </span>
  );
}

// Aliases para compatibilidad retroactiva directa
export const AdminStatusBadge = StatusBadge;
export type AdminStatusBadgeProps = StatusBadgeProps;
export type AdminStatusBadgeVariant = StatusBadgeVariant;
