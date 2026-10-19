"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const businessId = params?.businessId as string | undefined;

  useEffect(() => {
    // Registrar error para monitoreo técnico sin bloquear la interfaz
    console.error("[Workspace Navigation/Module Error]:", error);
  }, [error]);

  return (
    <div className="w-full max-w-2xl mx-auto p-4 sm:p-8 my-12 text-center animate-in fade-in-50 duration-200">
      <div className="p-8 sm:p-10 rounded-3xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-lg space-y-6">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold font-title text-slate-900 dark:text-white">
            No fue posible cargar este módulo
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            Ocurrió un problema temporal al recuperar la información. Puedes reintentar la acción o volver al inicio del espacio de trabajo.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#ED500A] text-white text-xs font-semibold hover:bg-[#d94405] transition-colors shadow-xs"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reintentar carga</span>
          </button>

          {businessId && (
            <Link
              href={`/workspace/${businessId}`}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors border border-slate-200 dark:border-white/[0.08]"
            >
              <Home className="w-4 h-4" />
              <span>Ir al Inicio</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
