import React from "react";

interface AppPageContainerProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: "full" | "7xl" | "6xl" | "5xl";
}

export function AppPageContainer({
  title,
  description,
  actions,
  badge,
  children,
  maxWidth = "7xl",
}: AppPageContainerProps) {
  const maxWidthClass = {
    full: "max-w-full",
    "7xl": "max-w-7xl",
    "6xl": "max-w-6xl",
    "5xl": "max-w-5xl",
  }[maxWidth];

  return (
    <div className="w-full flex-1 p-4 sm:p-6 lg:p-8 space-y-6">
      <div className={`${maxWidthClass} mx-auto space-y-6`}>
        {/* Cabecera de Página */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-white/[0.06]">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold font-title text-slate-900 dark:text-white tracking-tight">
                {title}
              </h1>
              {badge}
            </div>
            {description && (
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-body max-w-2xl">
                {description}
              </p>
            )}
          </div>

          {actions && <div className="flex items-center gap-2.5 shrink-0">{actions}</div>}
        </div>

        {/* Contenido Principal de la Vista */}
        <div className="space-y-6">{children}</div>
      </div>
    </div>
  );
}
