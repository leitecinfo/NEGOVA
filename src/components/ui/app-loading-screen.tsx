import React from "react";

interface AppLoadingScreenProps {
  title?: string;
  subtitle?: string;
  fullScreen?: boolean;
}

export function AppLoadingScreen({
  title = "NEGOVA",
  subtitle = "Cargando...",
  fullScreen = true,
}: AppLoadingScreenProps) {
  return (
    <div
      className={`${
        fullScreen
          ? "fixed inset-0 z-50 flex items-center justify-center bg-white/95 dark:bg-[#0B0E14]/95 backdrop-blur-md"
          : "min-h-[70vh] w-full flex items-center justify-center"
      }`}
    >
      <div className="flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in duration-200">
        {/* Contenedor del Isotipo con el Spinner circular girando alrededor */}
        <div className="relative flex items-center justify-center">
          {/* Anillo de carga giratorio */}
          <div className="w-24 h-24 rounded-full border-4 border-slate-200 dark:border-white/10 border-t-[#ED500A] border-r-[#ED500A]/40 animate-spin" />

          {/* Isotipo oficial de NEGOVA en el centro */}
          <div className="absolute inset-0 flex items-center justify-center p-3">
            <img
              src="/isotipo.png"
              alt="NEGOVA"
              className="w-12 h-12 object-contain drop-shadow-md select-none pointer-events-none"
            />
          </div>
        </div>

        {/* Nombre de la marca & Texto de carga */}
        <div className="space-y-1">
          <h2 className="text-xl font-black tracking-wider text-slate-900 dark:text-white uppercase">
            {title}
          </h2>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 animate-pulse">
            {subtitle}
          </p>
        </div>
      </div>
    </div>
  );
}
