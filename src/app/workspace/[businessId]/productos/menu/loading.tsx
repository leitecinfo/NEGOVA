import React from "react";
import { LoadingSkeleton, CardSkeleton } from "@/components/ui/loading-skeleton";

export default function LoadingDigitalMenu() {
  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in-50 duration-150">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-white/[0.06]">
        <div className="space-y-2">
          <LoadingSkeleton className="h-7 w-48" />
          <LoadingSkeleton className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-2">
          <LoadingSkeleton className="h-9 w-28 rounded-xl" />
          <LoadingSkeleton className="h-9 w-28 rounded-xl" />
        </div>
      </div>

      {/* 3 Modality Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-3"
          >
            <div className="flex items-center gap-3">
              <LoadingSkeleton className="w-9 h-9 rounded-xl" />
              <LoadingSkeleton className="h-5 w-32" />
            </div>
            <LoadingSkeleton className="h-3 w-full" />
            <LoadingSkeleton className="h-3 w-4/5" />
          </div>
        ))}
      </div>

      {/* Preview Section Skeleton */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
          <LoadingSkeleton className="h-5 w-40" />
          <LoadingSkeleton className="h-8 w-24 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {[1, 2, 3, 4, 5, 6].map((card) => (
            <CardSkeleton key={card} />
          ))}
        </div>
      </div>
    </div>
  );
}
