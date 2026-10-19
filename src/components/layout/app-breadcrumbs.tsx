"use client";

import React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AppNavSection } from "./navigation-types";
import { isRouteActive } from "./navigation-utils";

interface AppBreadcrumbsProps {
  navSections: AppNavSection[];
  homeUrl: string;
}

export function AppBreadcrumbs({ navSections, homeUrl }: AppBreadcrumbsProps) {
  const pathname = usePathname() || homeUrl;
  const searchParams = useSearchParams();

  const currentTitle = React.useMemo(() => {
    if (pathname === homeUrl) return "Inicio";

    // Extraer todos los items (y subitems si se desea) para buscar la ruta activa
    const allItems = navSections.flatMap((sec) => sec.items);
    const navItem = allItems.find((nav) =>
      isRouteActive(nav.href, pathname, searchParams, nav.exactMatch)
    );

    if (navItem) {
      if (navItem.id === "perfil") return "Mi Perfil";
      return navItem.label;
    }

    // Fallback basado en el último segmento de la URL
    const segments = pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (!last) return "Dashboard";

    return last.charAt(0).toUpperCase() + last.slice(1);
  }, [pathname, searchParams, navSections, homeUrl]);

  return (
    <div className="flex items-center min-w-0">
      <h1 className="text-base sm:text-lg font-bold font-title text-slate-900 dark:text-white tracking-tight truncate">
        {currentTitle}
      </h1>
    </div>
  );
}
