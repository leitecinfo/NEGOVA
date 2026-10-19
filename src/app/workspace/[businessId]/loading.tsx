import React from "react";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

/**
 * Loading boundary para el espacio de trabajo de NEGOVA.
 * Se monta automáticamente dentro del área <main> durante las transiciones de ruta,
 * manteniendo el menú lateral y la barra superior 100% interactivos y sin bloqueos.
 */
export default function WorkspaceLoading() {
  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in-50 duration-150">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-white/[0.06]">
        <div className="space-y-2">
          <LoadingSkeleton className="h-7 w-48" />
          <LoadingSkeleton className="h-4 w-72" />
        </div>
        <LoadingSkeleton className="h-9 w-32 rounded-xl" />
      </div>

      {/* KPI Cards Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <LoadingSkeleton className="h-3 w-20" />
              <LoadingSkeleton className="w-8 h-8 rounded-xl" />
            </div>
            <LoadingSkeleton className="h-6 w-28" />
            <LoadingSkeleton className="h-2 w-16" />
          </div>
        ))}
      </div>

      {/* Main Content Area Skeleton */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
          <LoadingSkeleton className="h-5 w-40" />
          <LoadingSkeleton className="h-8 w-24 rounded-xl" />
        </div>

        {/* Content rows shimmer */}
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((row) => (
            <div
              key={row}
              className="h-12 w-full bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.04] rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
