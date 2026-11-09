"use client";

import React, { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useNavigationProgress } from "@/components/layout/navigation-progress-bar";

/**
 * Template oficial del Workspace de NEGOVA.
 * A diferencia de los layouts que persisten entre rutas hermanas, Next.js crea una nueva
 * instancia de este Template cada vez que el usuario navega a un módulo diferente.
 * Esto garantiza que el hook `useEffect` se ejecute ÚNICAMENTE cuando la nueva vista ha
 * completado su fetch de servidor, hidratación y montaje efectivo en el DOM.
 */
export default function WorkspaceTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { notifyRouteMounted } = useNavigationProgress();

  useEffect(() => {
    notifyRouteMounted(pathname, searchParams ? searchParams.toString() : "");
  }, [pathname, searchParams, notifyRouteMounted]);

  return <>{children}</>;
}

