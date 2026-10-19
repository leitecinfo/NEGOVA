"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";

interface NavigationProgressContextType {
  isNavigating: boolean;
  navigatingHref: string | null;
  startNavigation: (href: string) => void;
  endNavigation: () => void;
}

const NavigationProgressContext = createContext<NavigationProgressContextType>({
  isNavigating: false,
  navigatingHref: null,
  startNavigation: () => {},
  endNavigation: () => {},
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

  // Terminar navegación cuando la URL o los searchParams cambien
  useEffect(() => {
    if (isNavigating) {
      setProgress(100);
      const timer = setTimeout(() => {
        setIsNavigating(false);
        setNavigatingHref(null);
        setIsVisible(false);
        setProgress(0);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams]);

  const startNavigation = useCallback((href: string) => {
    setNavigatingHref(href);
    setIsNavigating(true);
    setIsVisible(true);
    setProgress(25);

    // Incrementar progresivamente mientras el servidor resuelve
    const t1 = setTimeout(() => setProgress((p) => (p < 60 ? 60 : p)), 180);
    const t2 = setTimeout(() => setProgress((p) => (p < 85 ? 85 : p)), 500);

    // Timeout de seguridad en caso de fallo de red
    const timeout = setTimeout(() => {
      setIsNavigating(false);
      setNavigatingHref(null);
      setIsVisible(false);
      setProgress(0);
    }, 8000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(timeout);
    };
  }, []);

  const endNavigation = useCallback(() => {
    setProgress(100);
    setTimeout(() => {
      setIsNavigating(false);
      setNavigatingHref(null);
      setIsVisible(false);
      setProgress(0);
    }, 200);
  }, []);

  return (
    <NavigationProgressContext.Provider
      value={{
        isNavigating,
        navigatingHref,
        startNavigation,
        endNavigation,
      }}
    >
      {/* Barra de progreso global micro-animada en la parte superior */}
      {isVisible && (
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          className="fixed top-0 left-0 right-0 h-[2.5px] z-[99999] pointer-events-none bg-transparent"
        >
          <div
            className="h-full bg-linear-to-r from-[#ED500A] via-[#f97316] to-[#ea580c] transition-all duration-300 ease-out shadow-[0_0_10px_rgba(237,80,10,0.6)]"
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
