"use client";

import React from "react";

export function AdminLoadingSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-slate-200/80 dark:bg-white/[0.06] rounded-xl ${className}`}
    />
  );
}

export function AdminTableSkeleton({
  rows = 5,
  cols = 6,
  className = "",
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0E12] shadow-xs overflow-hidden ${className}`}
    >
      <div className="py-4 px-4 border-b border-slate-200 dark:border-white/10 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <AdminLoadingSkeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-slate-100 dark:divide-white/[0.04]">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="py-4 px-4 flex items-center gap-4">
            {Array.from({ length: cols }).map((_, colIdx) => (
              <AdminLoadingSkeleton
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

export function AdminKpiSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0E12] space-y-3"
        >
          <div className="flex justify-between items-center">
            <AdminLoadingSkeleton className="h-3 w-20" />
            <AdminLoadingSkeleton className="h-8 w-8 rounded-xl" />
          </div>
          <AdminLoadingSkeleton className="h-7 w-16" />
          <AdminLoadingSkeleton className="h-2.5 w-28" />
        </div>
      ))}
    </div>
  );
}

export function AdminCardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`p-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0E12] space-y-3 ${className}`}
    >
      <AdminLoadingSkeleton className="h-5 w-1/3" />
      <AdminLoadingSkeleton className="h-4 w-full" />
      <AdminLoadingSkeleton className="h-4 w-2/3" />
    </div>
  );
}
