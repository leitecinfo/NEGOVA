"use client";

import React from "react";

export function LoadingSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-slate-200/80 dark:bg-white/[0.06] rounded-xl ${className}`}
    />
  );
}

export function TableSkeleton({
  rows = 5,
  cols = 4,
  className = "",
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] shadow-xs overflow-hidden ${className}`}
    >
      <div className="py-4 px-4 border-b border-slate-200 dark:border-white/[0.08] flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <LoadingSkeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-slate-100 dark:divide-white/[0.04]">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="py-4 px-4 flex items-center gap-4">
            {Array.from({ length: cols }).map((_, colIdx) => (
              <LoadingSkeleton
                key={colIdx}
                className={`h-4 flex-1 ${colIdx === 0 ? "w-1/3" : ""}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function KpiSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-5 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] space-y-3"
        >
          <div className="flex justify-between items-center">
            <LoadingSkeleton className="h-3 w-20" />
            <LoadingSkeleton className="h-8 w-8 rounded-xl" />
          </div>
          <LoadingSkeleton className="h-7 w-16" />
          <LoadingSkeleton className="h-2.5 w-28" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`p-5 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] space-y-3 ${className}`}
    >
      <LoadingSkeleton className="h-5 w-1/3" />
      <LoadingSkeleton className="h-4 w-full" />
      <LoadingSkeleton className="h-4 w-2/3" />
    </div>
  );
}

// Aliases para retrocompatibilidad total
export const AdminLoadingSkeleton = LoadingSkeleton;
export const AdminTableSkeleton = TableSkeleton;
export const AdminKpiSkeleton = KpiSkeleton;
export const AdminCardSkeleton = CardSkeleton;
