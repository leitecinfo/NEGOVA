'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';

interface ModuleVideoButtonProps {
  onClick: () => void;
  className?: string;
}

/**
 * Botón tipo cápsula alargada (pill) con bordes completamente redondeados,
 * icono de cuatro puntas / destello en el lado izquierdo y etiqueta "Ver video".
 */
export function ModuleVideoButton({ onClick, className = '' }: ModuleVideoButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/40 hover:bg-amber-100/80 dark:hover:bg-amber-900/40 transition-all shadow-xs cursor-pointer active:scale-95 ${className}`}
      title="Ver videos tutoriales del módulo"
    >
      <Sparkles className="w-3.5 h-3.5 fill-amber-500 text-amber-500 shrink-0" />
      <span className="whitespace-nowrap font-medium">Ver video</span>
    </button>
  );
}
