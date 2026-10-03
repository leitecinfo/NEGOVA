"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { ALL_ADMIN_NAV_ITEMS } from "@/config/admin-navigation";

/**
 * Título de Navegación del Header:
 * Muestra limpiamente el nombre de la vista actual tanto en móvil como en escritorio
 * (ej: "Dashboard", "Mi Perfil", "Usuarios", "Negocios"), evitando rutas largas o redundantes.
 */
export function AdminBreadcrumbs() {
  const pathname = usePathname() || "/admin";

  const currentTitle = React.useMemo(() => {
    if (pathname === "/admin") return "Dashboard";
    if (pathname === "/admin/perfil") return "Mi Perfil";

    // Buscar en los items de navegación registrados
    const navItem = ALL_ADMIN_NAV_ITEMS.find((nav) =>
      nav.exactMatch ? pathname === nav.href : pathname === nav.href || pathname.startsWith(`${nav.href}/`)
    );

    if (navItem) {
      // Ajustar nombres si es necesario para que sean directos y limpios
      if (navItem.id === "perfil") return "Mi Perfil";
      return navItem.label;
    }

    // Fallback basado en el último segmento de la URL
    const segments = pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (!last) return "Dashboard";

    return last.charAt(0).toUpperCase() + last.slice(1);
  }, [pathname]);

  return (
    <div className="flex items-center min-w-0">
      <h1 className="text-base sm:text-lg font-bold font-title text-slate-900 dark:text-white tracking-tight truncate">
        {currentTitle}
      </h1>
    </div>
  );
}
