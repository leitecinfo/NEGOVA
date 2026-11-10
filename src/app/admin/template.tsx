"use client";

import React, { Suspense } from "react";
import { usePathname } from "next/navigation";
import { RouteMountedNotifier } from "@/components/layout/route-mounted-notifier";

/**
 * Template oficial del Panel Administrativo de NEGOVA.
 * Envuelve el contenido en un Suspense boundary de modo que el RouteMountedNotifier
 * se monte y ejecute su efecto ÚNICAMENTE cuando las promesas del Server Component
 * de la vista de destino se hayan resuelto y commiteado en el DOM.
 */
export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <Suspense fallback={null}>
      <RouteMountedNotifier pathname={pathname} />
      {children}
    </Suspense>
  );
}

