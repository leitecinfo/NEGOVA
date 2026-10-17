"use client";

import React, { useState } from "react";
import {
  Image as ImageIcon,
  Download,
  ExternalLink,
  Phone,
  MapPin,
  MessageCircle,
  Share2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
} from "lucide-react";
import { DigitalMenuPublicBusiness } from "@/lib/menu/types";
import { toast } from "sonner";

interface Props {
  business: DigitalMenuPublicBusiness;
  fileUrl: string;
  fileName?: string | null;
  fileSizeBytes?: number | null;
  isPreview?: boolean;
}

export function ImageViewerComponent({
  business,
  fileUrl,
  fileName,
  fileSizeBytes,
  isPreview = false,
}: Props) {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const cleanWhatsapp = (business.whatsapp || business.phone || "").replace(/[^0-9]/g, "");
  const whatsappUrl = () => {
    if (!cleanWhatsapp) return "#";
    const text = `¡Hola! Me comunico desde su menú digital. Quisiera realizar un pedido.`;
    return `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(text)}`;
  };

  const handleShare = () => {
    if (typeof window !== "undefined") {
      if (navigator.share) {
        navigator.share({
          title: `Menú de ${business.name}`,
          text: `Consulta el menú digital de ${business.name}`,
          url: window.location.href,
        }).catch(() => {});
      } else {
        navigator.clipboard.writeText(window.location.href);
        toast.success("Enlace del menú copiado");
      }
    }
  };

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.75));
  const handleResetZoom = () => setZoomLevel(1);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-16 selection:bg-orange-500/30">
      {/* Header Institucional */}
      <header className="bg-slate-900 border-b border-white/10 px-4 py-4 shadow-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-center sm:text-left">
            {business.logo_url ? (
              <img
                src={business.logo_url}
                alt={business.name}
                className="w-12 h-12 rounded-xl object-cover border border-white/10 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-orange-600 flex items-center justify-center text-white font-bold shrink-0">
                <ImageIcon className="w-6 h-6" />
              </div>
            )}
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                {business.name}
              </h1>
              <p className="text-xs text-slate-400">
                Menú Oficial {fileName ? `\u2022 ${fileName}` : ""}
              </p>
            </div>
          </div>

          {/* Barra de Acciones y Contacto */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {cleanWhatsapp && (
              <a
                href={whatsappUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-transform hover:scale-105 active:scale-95 shadow-sm"
                style={{ backgroundColor: "#25D366" }}
              >
                <MessageCircle className="w-3.5 h-3.5 fill-current" />
                <span>Pedir WhatsApp</span>
              </a>
            )}

            <a
              href={fileUrl}
              download={fileName || "menu-digital.jpg"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors"
              title="Descargar imagen"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Descargar</span>
            </a>

            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ED500A] hover:bg-[#d44304] text-white text-xs font-bold transition-colors shadow-sm"
              title="Abrir imagen completa"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Ver Completo</span>
            </a>

            {!isPreview && (
              <button
                onClick={handleShare}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Compartir"
              >
                <Share2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Visor de Imagen con Controles de Zoom */}
      <main className="max-w-4xl mx-auto w-full px-4 mt-6 flex-1 flex flex-col">
        {/* Barra de Herramientas de Zoom */}
        <div className="flex items-center justify-between bg-slate-900 border border-white/10 px-4 py-2 rounded-t-2xl text-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleZoomOut}
              disabled={zoomLevel <= 0.75}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 disabled:opacity-30 transition-colors text-slate-300"
              title="Reducir zoom"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="font-mono text-xs text-slate-400 px-2">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              disabled={zoomLevel >= 3}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 disabled:opacity-30 transition-colors text-slate-300"
              title="Aumentar zoom"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            {zoomLevel !== 1 && (
              <button
                onClick={handleResetZoom}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 transition-colors text-slate-300 ml-1"
                title="Restablecer zoom"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={() => setIsFullscreen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-xs text-orange-400 hover:text-orange-300 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Pantalla Completa</span>
          </button>
        </div>

        {/* Contenedor de la Imagen con Scroll Responsivo */}
        <div className="bg-slate-900 border-x border-b border-white/10 rounded-b-2xl overflow-auto p-4 flex items-center justify-center min-h-[60vh] max-h-[85vh]">
          <div
            className="transition-transform duration-200 origin-center flex justify-center"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            <img
              src={fileUrl}
              alt={`Menú de ${business.name}`}
              className="max-w-full h-auto object-contain rounded-xl shadow-2xl"
              style={{ maxHeight: "80vh" }}
            />
          </div>
        </div>
      </main>

      {/* Lightbox Pantalla Completa si se activa */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md"
          onClick={() => setIsFullscreen(false)}
        >
          <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
            <span className="text-xs text-slate-400">Clic en cualquier parte para cerrar</span>
            <button
              onClick={() => setIsFullscreen(false)}
              className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors"
            >
              Cerrar (ESC)
            </button>
          </div>
          <div className="max-w-full max-h-full overflow-auto p-2" onClick={(e) => e.stopPropagation()}>
            <img
              src={fileUrl}
              alt={`Menú de ${business.name}`}
              className="max-h-[92vh] max-w-full object-contain mx-auto shadow-2xl rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-slate-500 max-w-4xl mx-auto px-4">
        {business.address && (
          <p className="flex items-center justify-center gap-1.5 text-slate-400 mb-1">
            <MapPin className="w-3.5 h-3.5" />
            <span>
              {business.address}
              {business.city ? `, ${business.city}` : ""}
            </span>
          </p>
        )}
        <p className="font-semibold text-slate-300">{business.name}</p>
        <p className="text-[11px] mt-0.5">Menú Digital con NEGOVA</p>
      </footer>
    </div>
  );
}
