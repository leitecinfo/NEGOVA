"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

interface NavigationProgressContextType {
  isNavigating: boolean;
  navigatingHref: string | null;
  startNavigation: (href: string) => void;
  endNavigation: () => void;
  notifyRouteMounted: (pathname: string, search?: string) => void;
}

const NavigationProgressContext = createContext<NavigationProgressContextType>({
  isNavigating: false,
  navigatingHref: null,
  startNavigation: () => {},
  endNavigation: () => {},
  notifyRouteMounted: () => {},
});

export function useNavigationProgress() {
  return useContext(NavigationProgressContext);
}

export function NavigationProgressProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigatingHref, setNavigatingHref] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startPathnameRef = useRef<string | null>(null);
  const startSearchRef = useRef<string | null>(null);

  const endNavigation = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    setProgress(100);
    const t = setTimeout(() => {
      setIsNavigating(false);
      setNavigatingHref(null);
      setIsVisible(false);
      setProgress(0);
      startPathnameRef.current = null;
      startSearchRef.current = null;
    }, 120);
    timersRef.current.push(t);
  }, []);

  const startNavigation = useCallback((href: string) => {
    // Normalizar URLs para evitar falsos positivos con trailing slashes
    const cleanTarget = href.split("?")[0].replace(/\/$/, "");
    const cleanCurrent = pathname.split("?")[0].replace(/\/$/, "");

    // Si ya estamos en la ruta destino, no iniciar carga
    if (cleanTarget === cleanCurrent) {
      return;
    }

    // Limpiar timers de una navegación anterior para que no cancelen la actual
    timersRef.current.forEach(clearTimeout);

    // Guardar ruta y search de partida
    startPathnameRef.current = cleanCurrent;
    startSearchRef.current = searchParams ? searchParams.toString() : "";

    // Resetear inmediatamente el scroll del contenedor principal de la vista
    try {
      const viewport = document.getElementById("app-main-viewport");
      if (viewport) {
        viewport.scrollTo({ top: 0, behavior: "instant" });
      }
    } catch {
      // Ignorar si no está en DOM
    }

    setNavigatingHref(href);
    setIsNavigating(true);
    setIsVisible(true);
    setProgress(25);

    // Incrementar progresivamente mientras el servidor resuelve el RSC
    const t1 = setTimeout(() => setProgress((p) => Math.max(p, 60)), 150);
    const t2 = setTimeout(() => setProgress((p) => Math.max(p, 85)), 400);

    // Failsafe de seguridad por pérdida de red o aborto (8 segundos)
    const timeout = setTimeout(() => {
      endNavigation();
    }, 8000);

    timersRef.current = [t1, t2, timeout];
  }, [pathname, searchParams, endNavigation]);

  // Escuchar clics globales en enlaces para activar el estado de carga instantáneamente
  useEffect(() => {
    function handleGlobalLinkClick(e: MouseEvent) {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

      const target = (e.target as HTMLElement)?.closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      if (target.target && target.target !== "_self") {
        return;
      }

      try {
        const targetUrl = new URL(target.href, window.location.origin);
        if (targetUrl.origin !== window.location.origin) return;

        const currentPath = window.location.pathname.replace(/\/$/, "");
        const currentSearch = window.location.search;
        const targetPath = targetUrl.pathname.replace(/\/$/, "");
        const targetSearch = targetUrl.search;

        if (targetPath !== currentPath || targetSearch !== currentSearch) {
          startNavigation(targetPath);
        }
      } catch {
        // Ignorar URLs inválidas
      }
    }

    const handlePopState = () => endNavigation();
    const handlePageShow = () => endNavigation();

    document.addEventListener("click", handleGlobalLinkClick, { capture: true });
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      document.removeEventListener("click", handleGlobalLinkClick, { capture: true });
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [startNavigation, endNavigation]);

  // Notificación explícita de montaje de ruta: emitida por templates/páginas al renderizar en el DOM
  const notifyRouteMounted = useCallback(
    (mountedPathname: string, _search?: string) => {
      if (!isNavigating) return;

      const cleanMounted = (mountedPathname || "").split("?")[0].replace(/\/$/, "");
      const cleanStart = startPathnameRef.current;
      const cleanTarget = (navigatingHref || "").split("?")[0].replace(/\/$/, "");

      // Concluir navegación si montó la ruta esperada o si ya cambió respecto a la pantalla de origen
      const isTarget = Boolean(cleanTarget && (cleanMounted === cleanTarget || cleanMounted.startsWith(`${cleanTarget}/`)));
      const isDifferentFromStart = Boolean(cleanStart && cleanMounted !== cleanStart);

      if (isTarget || isDifferentFromStart) {
        endNavigation();
      }
    },
    [isNavigating, navigatingHref, endNavigation]
  );

  // Fallback de seguridad: si el router ya actualizó la URL pero la página tardó en notificar
  // (por ejemplo en rutas externas o sin template), avanzar la barra y concluir con retardo de gracia
  useEffect(() => {
    if (!isNavigating) return;

    const cleanCurrent = pathname.split("?")[0].replace(/\/$/, "");
    const cleanTarget = (navigatingHref || "").split("?")[0].replace(/\/$/, "");

    if (cleanTarget && (cleanCurrent === cleanTarget || cleanCurrent.startsWith(`${cleanTarget}/`))) {
      setProgress((p) => Math.max(p, 90));
      // Tiempo de gracia para permitir que Server Components pesados completen su reconciliación
      const fallbackTimer = setTimeout(() => {
        endNavigation();
      }, 2500);
      return () => clearTimeout(fallbackTimer);
    }
  }, [pathname, searchParams, isNavigating, navigatingHref, endNavigation]);

  return (
    <NavigationProgressContext.Provider
      value={{
        isNavigating,
        navigatingHref,
        startNavigation,
        endNavigation,
        notifyRouteMounted,
      }}
    >
      {/* Barra de progreso global micro-animada en la parte superior */}
      {isVisible && (
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          className="fixed top-0 left-0 right-0 h-[3.5px] z-[999999] pointer-events-none bg-transparent"
        >
          <div
            className="h-full bg-linear-to-r from-[#ED500A] via-[#f97316] to-[#f59e0b] transition-all duration-300 ease-out shadow-[0_0_14px_rgba(237,80,10,0.85)]"
            style={{
              width: `${progress}%`,
              opacity: progress === 100 ? 0 : 1,
              transition: progress === 100 ? "width 150ms ease-out, opacity 250ms ease-out 100ms" : "width 300ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </div>
      )}
      {children}
    </NavigationProgressContext.Provider>
  );
}
