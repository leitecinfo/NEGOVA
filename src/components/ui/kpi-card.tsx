"use client";

import React from "react";

export type KpiVariant =
  | "default"
  | "orange"
  | "emerald"
  | "amber"
  | "red"
  | "purple"
  | "blue";

export interface KpiCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
  variant?: KpiVariant;
  isSelected?: boolean;
  onClick?: () => void;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  className?: string;
}

const variantStyles: Record<
  KpiVariant,
  {
    active: string;
    inactive: string;
    iconBox: string;
    title: string;
    value: string;
    subtext: string;
  }
> = {
  default: {
    active: "bg-white dark:bg-[#0D0F16] border-[#ED500A] ring-2 ring-[#ED500A]/30 shadow-sm",
    inactive:
      "bg-white dark:bg-[#0D0F16] border-slate-200/80 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15]",
    iconBox: "bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300",
    title: "text-slate-600 dark:text-slate-300",
    value: "text-slate-900 dark:text-white",
    subtext: "text-slate-400",
  },
  orange: {
    active: "bg-orange-50/50 dark:bg-orange-950/20 border-[#ED500A] ring-2 ring-[#ED500A]/30 shadow-sm",
    inactive:
      "bg-white dark:bg-[#0D0F16] border-slate-200/80 dark:border-white/[0.08] hover:border-[#ED500A]/40",
    iconBox: "bg-orange-500/10 text-[#ED500A] dark:text-orange-400",
    title: "text-orange-700 dark:text-orange-400",
    value: "text-orange-700 dark:text-orange-400",
    subtext: "text-orange-600/70 dark:text-orange-400/70",
  },
  emerald: {
    active: "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500 ring-2 ring-emerald-500/30 shadow-sm",
    inactive:
      "bg-white dark:bg-[#0D0F16] border-slate-200/80 dark:border-white/[0.08] hover:border-emerald-500/30",
    iconBox: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    title: "text-emerald-700 dark:text-emerald-400",
    value: "text-emerald-700 dark:text-emerald-400",
    subtext: "text-emerald-600/70 dark:text-emerald-400/70",
  },
  amber: {
    active: "bg-amber-50/50 dark:bg-amber-950/20 border-amber-500 ring-2 ring-amber-500/30 shadow-sm",
    inactive:
      "bg-white dark:bg-[#0D0F16] border-slate-200/80 dark:border-white/[0.08] hover:border-amber-500/30",
    iconBox: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    title: "text-amber-700 dark:text-amber-400",
    value: "text-amber-700 dark:text-amber-400",
    subtext: "text-amber-600/70 dark:text-amber-400/70",
  },
  red: {
    active: "bg-red-50/50 dark:bg-red-950/20 border-red-500 ring-2 ring-red-500/30 shadow-sm",
    inactive:
      "bg-white dark:bg-[#0D0F16] border-slate-200/80 dark:border-white/[0.08] hover:border-red-500/30",
    iconBox: "bg-red-500/10 text-red-600 dark:text-red-400",
    title: "text-red-700 dark:text-red-400",
    value: "text-red-700 dark:text-red-400",
    subtext: "text-red-600/70 dark:text-red-400/70",
  },
  purple: {
    active: "bg-purple-50/50 dark:bg-purple-950/20 border-purple-500 ring-2 ring-purple-500/30 shadow-sm",
    inactive:
      "bg-white dark:bg-[#0D0F16] border-slate-200/80 dark:border-white/[0.08] hover:border-purple-500/30",
    iconBox: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    title: "text-purple-700 dark:text-purple-400",
    value: "text-purple-700 dark:text-purple-400",
    subtext: "text-purple-600/70 dark:text-purple-400/70",
  },
  blue: {
    active: "bg-blue-50/50 dark:bg-blue-950/20 border-blue-500 ring-2 ring-blue-500/30 shadow-sm",
    inactive:
      "bg-white dark:bg-[#0D0F16] border-slate-200/80 dark:border-white/[0.08] hover:border-blue-500/30",
    iconBox: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    title: "text-blue-700 dark:text-blue-400",
    value: "text-blue-700 dark:text-blue-400",
    subtext: "text-blue-600/70 dark:text-blue-400/70",
  },
};

export function KpiCard({
  title,
  value,
  subtext,
  icon,
  variant = "default",
  isSelected = false,
  onClick,
  trend,
  className = "",
}: KpiCardProps) {
  const styles = variantStyles[variant];

  // Calibrar tamaño tipográfico dinámicamente según la longitud del texto
  const valStr = String(value);
  const isText = isNaN(Number(value)) && !/^\d+\s*\/\s*\d+$/.test(valStr);
  const sizeClass = isText
    ? valStr.length > 12
      ? "text-base sm:text-lg font-bold"
      : "text-lg sm:text-xl font-bold"
    : "text-2xl sm:text-3xl font-bold tracking-tight";

  return (
    <div
      onClick={onClick}
      className={`p-4 sm:p-5 rounded-2xl border transition-all relative overflow-hidden shadow-xs flex flex-col justify-between ${
        onClick ? "cursor-pointer" : ""
      } ${isSelected ? styles.active : styles.inactive} ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className={`text-xs font-semibold truncate ${styles.title}`}>{title}</span>
        <div className={`p-2 rounded-xl shrink-0 ${styles.iconBox}`}>{icon}</div>
      </div>

      <div className="flex items-center justify-between gap-2 min-w-0">
        <p className={`font-title truncate ${sizeClass} ${styles.value}`} title={valStr}>
          {value}
        </p>

        {trend && (
          <span
            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md shrink-0 whitespace-nowrap ${
              trend.isPositive
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/10 text-red-600 dark:text-red-400"
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>

      {subtext && (
        <span className={`text-[10px] block mt-1.5 font-mono font-medium truncate ${styles.subtext}`}>
          {subtext}
        </span>
      )}
    </div>
  );
}

export interface KpiGridProps {
  children: React.ReactNode;
  cols?: 2 | 3 | 4 | 5;
  className?: string;
}

export function KpiGrid({
  children,
  cols = 4,
  className = "",
}: KpiGridProps) {
  const gridColsClass = {
    2: "grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  }[cols];

  return (
    <div className={`grid ${gridColsClass} gap-3 sm:gap-4 ${className}`}>
      {children}
    </div>
  );
}

// Aliases para retrocompatibilidad total
export const AdminKpiCard = KpiCard;
export const AdminKpiGrid = KpiGrid;
export type AdminKpiVariant = KpiVariant;
export type AdminKpiCardProps = KpiCardProps;
export type AdminKpiGridProps = KpiGridProps;
