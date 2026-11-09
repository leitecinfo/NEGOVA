"use client";

import React, { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useNavigationProgress } from "@/components/layout/navigation-progress-bar";

/**
 * Template oficial del Panel Administrativo de NEGOVA.
 * Notifica al NavigationProgressProvider cuando la vista de destino ha montado en el DOM.
 */
export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { notifyRouteMounted } = useNavigationProgress();

  useEffect(() => {
    notifyRouteMounted(pathname, searchParams ? searchParams.toString() : "");
  }, [pathname, searchParams, notifyRouteMounted]);

  return <>{children}</>;
}

