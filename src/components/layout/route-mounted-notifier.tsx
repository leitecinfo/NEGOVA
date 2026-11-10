"use client";

import { useEffect } from "react";
import { useNavigationProgress } from "./navigation-progress-bar";

interface RouteMountedNotifierProps {
  pathname: string;
}

/**
 * Emite la notificación de montaje real una vez que el Suspense boundary
 * del módulo de destino se resuelve y el nuevo árbol se commitea en el DOM.
 * Esto previene que el overlay de carga se cierre prematuramente a los 50ms
 * mientras el Server Component aún espera datos del backend.
 */
export function RouteMountedNotifier({ pathname }: RouteMountedNotifierProps) {
  const { notifyRouteMounted } = useNavigationProgress();

  useEffect(() => {
    notifyRouteMounted(pathname);
  }, [pathname, notifyRouteMounted]);

  return null;
}
