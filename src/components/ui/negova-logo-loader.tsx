"use client";

import React from "react";
import Image from "next/image";

interface NegovaLogoLoaderProps {
  moduleName?: string;
  subtitle?: string;
  isFullPage?: boolean;
}

/**
 * Pantalla de carga oficial de NEGOVA con el Isotipo de marca central,
 * fondo 100% opaco para evitar vistas congeladas detrás y animación fluida.
 */
export function NegovaLogoLoader({
  moduleName,
  subtitle = "Un momento por favor...",
  isFullPage = false,
}: NegovaLogoLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`${
        isFullPage ? "fixed inset-0" : "absolute inset-0"
      } z-50 flex flex-col items-center justify-center bg-slate-50 dark:bg-[#0B0E14] select-none`}
    >
      <style>{`
        @keyframes negova-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes negova-pulse-glow {
          0%, 100% { opacity: 0.3; transform: scale(0.95); }
          50% { opacity: 0.65; transform: scale(1.15); }
        }
        @keyframes negova-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
        .negova-glow {
          animation: negova-pulse-glow 2.4s ease-in-out infinite;
        }
        .negova-orbit {
          animation: negova-spin 1.4s linear infinite;
        }
        .negova-orbit-reverse {
          animation: negova-spin 2.8s linear infinite reverse;
        }
        .negova-bar-move {
          animation: negova-bar 1.3s cubic-bezier(0.65, 0, 0.35, 1) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .negova-glow, .negova-orbit, .negova-orbit-reverse, .negova-bar-move {
            animation: none;
          }
        }
      `}</style>

      {/* Halo de luz de marca de fondo */}
      <div
        aria-hidden
        className="negova-glow absolute w-72 h-72 rounded-full pointer-events-none blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(237,80,10,0.22) 0%, transparent 70%)",
        }}
      />

      {/* Contenedor central */}
      <div className="relative flex flex-col items-center px-6 text-center max-w-sm">
        {/* Emblema con Logo Oficial de NEGOVA */}
        <div className="relative w-24 h-24 flex items-center justify-center mb-6">
          {/* Anillo de órbita giratorio externo */}
          <div
            aria-hidden
            className="negova-orbit absolute inset-0 rounded-full"
            style={{
              background: "conic-gradient(from 0deg, transparent 0deg, transparent 200deg, #ED500A 320deg, #f59e0b 360deg)",
              WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2.5px))",
              mask: "radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2.5px))",
            }}
          />

          {/* Anillo punteado decorativo interior */}
          <div
            aria-hidden
            className="negova-orbit-reverse absolute inset-2 rounded-full border border-dashed border-orange-500/25 dark:border-orange-500/35"
          />

          {/* Caja del isotipo oficial */}
          <div className="relative w-16 h-16 rounded-2xl bg-white dark:bg-[#131620] border border-slate-200/90 dark:border-white/[0.1] shadow-xl shadow-orange-500/10 dark:shadow-black/50 flex items-center justify-center p-2.5">
            <Image
              src="/isotipo.png"
              alt="Logo NEGOVA"
              width={56}
              height={56}
              priority
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Título de Marca y Mensajes */}
        <div className="space-y-1.5 mb-5">
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#ED500A]">
            NEGOVA
          </p>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            {moduleName ? `Abriendo ${moduleName}` : "Cargando módulo"}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        </div>

        {/* Barra de progreso indeterminada elegante */}
        <div className="w-48 h-1 rounded-full bg-slate-200/70 dark:bg-white/[0.08] overflow-hidden">
          <div className="negova-bar-move h-full w-2/5 rounded-full bg-linear-to-r from-[#ED500A] via-[#f97316] to-[#f59e0b]" />
        </div>
      </div>
    </div>
  );
}

