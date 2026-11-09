'use client';

import React, { useState } from 'react';
import { ModalPortal } from '@/components/ui/modal-portal';
import {
  ShoppingCart,
  X,
  Play,
  ExternalLink,
  ChevronLeft,
  Video,
  CheckCircle2,
} from 'lucide-react';

export interface TutorialVideo {
  id: string;
  title: string;
  duration?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
}

export const POS_TUTORIAL_VIDEOS: TutorialVideo[] = [
  {
    id: 'vid-pos-1',
    title: 'Primera venta en el sistema POS',
    duration: '3:45',
  },
  {
    id: 'vid-pos-2',
    title: 'Cómo realizar la primera venta',
    duration: '4:12',
  },
  {
    id: 'vid-pos-3',
    title: 'Cómo vender con remisión y cerrar',
    duration: '2:50',
  },
  {
    id: 'vid-pos-4',
    title: 'Cómo hacer una venta por remisión abierta',
    duration: '3:15',
  },
  {
    id: 'vid-pos-5',
    title: 'Cómo realizar una venta de domicilio desde el mostrador',
    duration: '5:02',
  },
  {
    id: 'vid-pos-6',
    title: 'Crear primer producto con modificadores y carrito',
    duration: '4:30',
  },
  {
    id: 'vid-pos-7',
    title: 'Proceso de compra de productos con y sin modificadores',
    duration: '3:55',
  },
  {
    id: 'vid-pos-8',
    title: 'Cómo aplicar descuentos y promociones en una venta',
    duration: '2:40',
  },
];

interface ModuleVideosModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleName?: string;
  videos?: TutorialVideo[];
}

export function ModuleVideosModal({
  isOpen,
  onClose,
  moduleName = 'Ventas y POS',
  videos = POS_TUTORIAL_VIDEOS,
}: ModuleVideosModalProps) {
  const [activeVideo, setActiveVideo] = useState<TutorialVideo | null>(null);

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Encabezado Superior */}
          <div className="px-6 py-5 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center font-bold shrink-0">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  {moduleName}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {videos.length} videos disponibles para este módulo
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Contenido / Reproductor o Lista */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1">
            {activeVideo ? (
              /* Reproductor Integrado */
              <div className="space-y-4 animate-in fade-in duration-150">
                <button
                  type="button"
                  onClick={() => setActiveVideo(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#ED500A] transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Volver a la lista de videos</span>
                </button>

                <div className="relative w-full aspect-video rounded-2xl bg-black overflow-hidden flex flex-col items-center justify-center text-white border border-slate-800 shadow-inner">
                  <div className="w-14 h-14 rounded-full bg-[#ED500A] flex items-center justify-center text-white shadow-lg cursor-pointer hover:scale-105 transition-transform">
                    <Play className="w-6 h-6 fill-white ml-0.5" />
                  </div>
                  <span className="text-xs font-medium text-slate-300 mt-3 px-4 text-center">
                    Reproduciendo tutorial: <strong>{activeVideo.title}</strong>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono mt-1">
                    Duración: {activeVideo.duration || '3:00 min'}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {activeVideo.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Guía paso a paso oficial de NEGOVA
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/40">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Disponible</span>
                  </span>
                </div>
              </div>
            ) : (
              /* Lista Vertical de Tutoriales */
              <div className="space-y-2.5">
                {videos.map((vid, idx) => (
                  <div
                    key={vid.id || idx}
                    onClick={() => setActiveVideo(vid)}
                    className="group relative flex items-center justify-between p-3 sm:p-3.5 bg-white dark:bg-[#0D0F16] hover:bg-slate-50 dark:hover:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] hover:border-[#ED500A]/40 rounded-2xl transition-all cursor-pointer shadow-xs active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      {/* Icono circular de reproducción */}
                      <div className="w-9 h-9 rounded-full bg-orange-500/10 text-[#ED500A] group-hover:bg-[#ED500A] group-hover:text-white flex items-center justify-center shrink-0 transition-colors shadow-2xs">
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </div>

                      {/* Texto explicativo */}
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#ED500A] transition-colors truncate">
                          {vid.title}
                        </h4>
                        {vid.duration && (
                          <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                            {vid.duration}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Icono de enlace externo (Abrir) */}
                    <div className="p-1.5 text-slate-400 group-hover:text-[#ED500A] transition-colors shrink-0 ml-2">
                      <ExternalLink className="w-4 h-4" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
