"use client";

import React, { useState } from "react";
import {
  FileText,
  Download,
  ExternalLink,
  Phone,
  MapPin,
  MessageCircle,
  Share2,
  AlertCircle,
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

export function PdfViewerComponent({
  business,
  fileUrl,
  fileName,
  fileSizeBytes,
  isPreview = false,
}: Props) {
  const [loadError, setLoadError] = useState(false);

  const cleanWhatsapp = (business.whatsapp || business.phone || "").replace(/[^0-9]/g, "");
  const whatsappUrl = () => {
    if (!cleanWhatsapp) return "#";
    const text = `¡Hola! Me comunico desde su menú digital en PDF. Quisiera consultar o hacer un pedido.`;
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

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return "";
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    const kb = bytes / 1024;
    return `${kb.toFixed(0)} KB`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-16 selection:bg-orange-500/30">
      {/* Header Institucional del Negocio */}
      <header className="bg-slate-900 border-b border-white/10 px-4 py-4 shadow-md sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-center sm:text-left">
            {business.logo_url ? (
              <img
                src={business.logo_url}
                alt={business.name}
                className="w-12 h-12 rounded-xl object-cover border border-white/10 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-orange-600 flex items-center justify-center text-white font-bold shrink-0">
                <FileText className="w-6 h-6" />
              </div>
            )}
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                {business.name}
              </h1>
              <p className="text-xs text-slate-400">
                Menú en formato PDF {fileName ? `\u2022 ${fileName}` : ""}{" "}
                {fileSizeBytes ? `(${formatFileSize(fileSizeBytes)})` : ""}
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
              download={fileName || "menu.pdf"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors"
              title="Descargar archivo PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Descargar</span>
            </a>

            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ED500A] hover:bg-[#d44304] text-white text-xs font-bold transition-colors shadow-sm"
              title="Abrir en pantalla completa"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Abrir PDF</span>
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

      {/* Visor PDF Integrado con soporte Universal */}
      <main className="max-w-5xl mx-auto w-full px-4 mt-6 flex-1 flex flex-col">
        <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex-1 flex flex-col min-h-[75vh]">
          {/* Barra superior del visor */}
          <div className="bg-slate-800/80 px-4 py-2.5 border-b border-white/10 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-400" />
              <span className="font-semibold text-white">Documento Oficial</span>
            </div>
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-orange-400 hover:text-orange-300 font-medium inline-flex items-center gap-1"
            >
              <span>Ver pantalla completa</span>
              <Maximize2 className="w-3 h-3" />
            </a>
          </div>

          {/* Objeto PDF con Fallback para Navegadores Móviles */}
          <div className="relative flex-1 w-full min-h-[70vh]">
            <object
              data={`${fileUrl}#toolbar=1&navpanes=0&view=FitH`}
              type="application/pdf"
              className="w-full h-full min-h-[70vh]"
              onError={() => setLoadError(true)}
            >
              {/* Fallback visible si el dispositivo o navegador no admite visor embebido */}
              <div className="p-8 text-center flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                  <FileText className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  Menú Digital en formato PDF
                </h3>
                <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                  Para una lectura más cómoda en este dispositivo móvil, puedes abrir el menú en
                  pantalla completa o descargarlo directamente.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#ED500A] hover:bg-[#d44304] text-white text-sm font-bold shadow-lg transition-transform hover:scale-105"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Ver Menú PDF</span>
                  </a>
                  <a
                    href={fileUrl}
                    download={fileName || "menu.pdf"}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar PDF</span>
                  </a>
                </div>
              </div>
            </object>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-slate-500 max-w-5xl mx-auto px-4">
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
