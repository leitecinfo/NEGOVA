"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { FloatingContact } from "./floating-contact";
import { NegovaAssistant } from "./negova-assistant";

// Prefijos de rutas donde NO deben aparecer los botones flotantes de la plataforma
const HIDDEN_ROUTES = ["/dashboard", "/admin", "/panel", "/app", "/workspace", "/menu"];

export function FloatingWrapper() {
  const pathname = usePathname();
  const isProtectedRoute = HIDDEN_ROUTES.some((route) =>
    pathname?.startsWith(route)
  );

  if (isProtectedRoute) return null;

  return (
    <aside
      aria-label="Asistentes flotantes de ayuda"
      className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3.5 pointer-events-auto"
    >
      {/* Botón flotante Asistente IA (Arriba) */}
      <NegovaAssistant />

      {/* Botón flotante WhatsApp (Abajo) */}
      <FloatingContact />
    </aside>
  );
}
