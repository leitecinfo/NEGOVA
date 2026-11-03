"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HelpCircle, Sparkles, BookOpen } from "lucide-react";
import { resolveHelpContextFromPath, HELP_ARTICLES } from "@/config/workspace-help-content";

interface WorkspaceHelpFloatingButtonProps {
  businessId: string;
}

/**
 * [HELP-001] Botón "?" flotante y contextual en todas las páginas del Workspace.
 * 
 * Funcionalidad:
 * 1. Detecta la ruta actual mediante usePathname().
 * 2. Si el usuario está en POS, redirige a la guía del POS (/ayuda?context=pos).
 * 3. Si está en Mesas, Domicilios, Caja o Productos, redirige a su guía correspondiente.
 * 4. Atajo de teclado '?' para abrir el centro de ayuda.
 */
export function WorkspaceHelpFloatingButton({ businessId }: WorkspaceHelpFloatingButtonProps) {
  const pathname = usePathname() || "";
  const [isHovered, setIsHovered] = useState(false);

  // No renderizar si ya estamos en la propia página de ayuda
  const isAlreadyInHelp = pathname.includes("/ayuda");

  // Resolver el contexto activo del módulo
  const context = resolveHelpContextFromPath(pathname);
  const relatedArticle = HELP_ARTICLES.find((a) => a.moduleId === context);
  const moduleLabel = relatedArticle?.moduleName || "este módulo";

  // Atajo de teclado '?'
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "?" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        window.location.href = `/workspace/${businessId}/ayuda?context=${context}`;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [businessId, context]);

  if (isAlreadyInHelp) {
    return null;
  }

  return (
    <div
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 group font-body"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Tooltip flotante contextual al hacer hover */}
      <div
        className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 dark:bg-[#121622]/95 text-white text-xs font-semibold shadow-xl border border-slate-700/60 dark:border-white/10 backdrop-blur-xs transition-all duration-200 pointer-events-none ${
          isHovered ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2"
        }`}
      >
        <BookOpen className="w-3.5 h-3.5 text-[#ED500A]" />
        <span>Ayuda: {moduleLabel}</span>
        <kbd className="ml-1 px-1 py-0.2 rounded bg-white/10 text-[10px] font-mono text-slate-300">
          ?
        </kbd>
      </div>

      {/* Botón flotante '?' */}
      <Link
        href={`/workspace/${businessId}/ayuda?context=${context}`}
        className="w-12 h-12 rounded-2xl bg-[#ED500A] hover:bg-[#d64505] text-white shadow-xl hover:shadow-orange-500/30 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 border border-white/20 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A] focus:ring-offset-2"
        aria-label={`Centro de ayuda: Guía de ${moduleLabel}`}
        title={`¿Necesitas ayuda? Haz clic o presiona '?' para ver la guía de ${moduleLabel}`}
      >
        <HelpCircle className="w-6 h-6" />
      </Link>
    </div>
  );
}

