import React from "react";
import { NegovaLogoLoader } from "@/components/ui/negova-logo-loader";

/**
 * Loading boundary oficial para el espacio de trabajo de NEGOVA.
 * Muestra el logo oficial de NEGOVA centrado con animación de marca,
 * con fondo 100% opaco para evitar vistas congeladas o esqueletos desincronizados.
 */
export default function WorkspaceLoading() {
  return (
    <div className="relative w-full h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50 dark:bg-[#0B0E14]">
      <NegovaLogoLoader
        moduleName=""
        subtitle="Cargando información del comercio..."
        isFullPage={false}
      />
    </div>
  );
}
