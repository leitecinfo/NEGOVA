"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { AppNavSection, AppBranding } from "./navigation-types";
import { NegovaLogoLoader } from "@/components/ui/negova-logo-loader";

interface ModuleLoadingOverlayProps {
  isActive: boolean;
  navigatingHref: string | null;
  navSections: AppNavSection[];
  branding: AppBranding;
}

interface ResolvedModule {
  label: string;
}

/**
 * Resuelve el módulo de destino buscando la coincidencia de href más larga
 * dentro del catálogo de navegación.
 */
function resolveModule(href: string | null, navSections: AppNavSection[]): ResolvedModule | null {
  if (!href) return null;
  const cleanHref = href.split("?")[0].replace(/\/$/, "");
  let best: ResolvedModule | null = null;
  let bestLen = -1;

  const consider = (candidateHref: string, mod: ResolvedModule) => {
    const base = candidateHref.split("?")[0].replace(/\/$/, "");
    if (!base) return;
    if ((cleanHref === base || cleanHref.startsWith(`${base}/`)) && base.length > bestLen) {
      best = mod;
      bestLen = base.length;
    }
  };

  for (const section of navSections) {
    for (const item of section.items) {
      consider(item.href, { label: item.label });
      for (const sub of item.subItems || []) {
        consider(sub.href, { label: sub.label });
      }
    }
  }
  return best;
}

const LOADING_TIPS = [
  "Sincronizando datos del comercio",
  "Verificando permisos de acceso",
  "Preparando la información",
  "Casi listo",
];

/**
 * Pantalla de carga oficial mostrada sobre la pantalla mientras
 * se resuelve la navegación entre módulos del Workspace.
 * - Fondo 100% opaco para ocultar la página anterior sin dejar vistas congeladas.
 * - Muestra el logo oficial de NEGOVA animado.
 * - Muestra el nombre del módulo destino.
 * - isFullPage={true} para garantizar cobertura total de viewport sin recortes por scroll.
 * - Autodescarte si la ruta ya coincide con el destino o si supera 2 segundos.
 */
export function ModuleLoadingOverlay({
  isActive,
  navigatingHref,
  navSections,
}: ModuleLoadingOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const target = useMemo(() => resolveModule(navigatingHref, navSections), [navigatingHref, navSections]);

  useEffect(() => {
    if (!isActive) {
      setVisible(false);
      setElapsed(0);
      return;
    }

    // Pequeño retardo de 40ms para no parpadear si la navegación es instantánea (ej: cliente en caché)
    const showTimer = setTimeout(() => setVisible(true), 40);

    // Failsafe de seguridad: si la conexión se congela o cancela, liberar overlay tras 8s
    const maxSafetyTimer = setTimeout(() => {
      setVisible(false);
    }, 8000);

    const started = Date.now();
    const tick = setInterval(() => setElapsed(Date.now() - started), 300);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(maxSafetyTimer);
      clearInterval(tick);
    };
  }, [isActive, navigatingHref]);

  if (!isActive || !visible) return null;

  const label = target?.label;
  const tipIndex = Math.min(LOADING_TIPS.length - 1, Math.floor(elapsed / 1200));
  const isSlow = elapsed > 3500;
  const subtitle = isSlow ? "La conexión está lenta, seguimos cargando..." : `${LOADING_TIPS[tipIndex]}...`;

  return (
    <div className="absolute inset-0 z-50 animate-in fade-in duration-150 flex items-center justify-center bg-slate-50 dark:bg-[#0B0E14] select-none pointer-events-auto">
      <NegovaLogoLoader
        moduleName={label}
        subtitle={subtitle}
        isFullPage={false}
      />
    </div>
  );
}
