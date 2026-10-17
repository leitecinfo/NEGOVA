"use client";

import React, { useRef, useState, useEffect } from "react";
import { ArrowRight, Sparkles, MessageCircle, ShieldCheck, X, CheckCircle2 } from "lucide-react";
import { ModalPortal } from "@/components/ui/modal-portal";

function useScrollReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold, rootMargin: "60px 0px -5% 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

// ── Modal de Atención Personalizada y Cierre Directo ──
function FinalCtaModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  const whatsappMsg = encodeURIComponent(
    "Hola NEGOVA, quiero comenzar con la prueba gratuita de 30 días para organizar mi negocio."
  );

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md animate-fade-in">
        <div
          className="relative w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 border border-slate-200 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#ED500A] via-[#F36320] to-[#ED500A]" />

          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-2xl bg-[#ED500A]/10 text-[#ED500A]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="font-mono text-[11px] font-semibold tracking-wider text-[#ED500A] uppercase">
                PUESTA EN MARCHA
              </span>
              <h3 className="font-title font-extrabold text-xl text-[#0B0E14]">
                Comenzar con NEGOVA
              </h3>
            </div>
          </div>

          <p className="font-body text-sm text-slate-600 mb-6 leading-relaxed">
            Prueba NEGOVA durante 30 días gratis con el plan Inicio. Te ayudamos a configurar tu negocio desde el primer día sin compromisos.
          </p>

          <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 mb-6">
            <div className="flex items-center gap-2.5 text-xs text-slate-700 font-medium">
              <CheckCircle2 className="w-4 h-4 text-[#ED500A] shrink-0" />
              <span>Prueba de 30 días sin costo ni tarjetas de crédito.</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-700 font-medium">
              <CheckCircle2 className="w-4 h-4 text-[#ED500A] shrink-0" />
              <span>Asesoría personalizada para cargar tu catálogo.</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-700 font-medium">
              <CheckCircle2 className="w-4 h-4 text-[#ED500A] shrink-0" />
              <span>Acceso inmediato desde tu navegador web.</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={`https://wa.me/?text=${whatsappMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-full bg-[#ED500A] hover:bg-[#F36320] text-white font-title font-bold text-sm shadow-md hover:shadow-lg transition-all duration-200 group cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 fill-white/20" />
              <span>Hablar con el equipo</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
            <button
              onClick={onClose}
              className="px-5 py-3.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-title font-semibold text-sm transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

export function FinalCtaSection() {
  const { ref, visible } = useScrollReveal(0.12);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <section
      ref={ref}
      id="comenzar"
      className="relative py-24 sm:py-36 bg-[#0B0E14] text-white overflow-hidden border-t border-white/10"
    >
      {/* Atmósfera naranja sutil de fondo */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1100px] h-[600px] bg-gradient-to-br from-[#ED500A]/15 via-transparent to-[#F36320]/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">

        {/* ── 1. EYEBROW ── */}
        <div
          className={`transition-all duration-700 ease-out ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <span className="inline-flex items-center gap-2 font-mono text-xs font-semibold tracking-widest text-[#ED500A] uppercase px-4 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/30 mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>CONTROL REAL PARA TU NEGOCIO</span>
          </span>
        </div>

        {/* ── 2. TÍTULO Y TEXTO DE APOYO ── */}
        <div
          className={`transition-all duration-700 delay-100 ease-out ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <h2 className="font-title font-black text-4xl sm:text-6xl text-white mb-6 leading-tight tracking-tight max-w-4xl mx-auto">
            Tu negocio puede estar más organizado.
          </h2>

          <p className="font-body text-base sm:text-xl text-slate-300 leading-relaxed max-w-[55ch] mx-auto mb-10">
            Empieza con NEGOVA y lleva el control de tu operación desde un solo lugar.
          </p>
        </div>

        {/* ── 3. BOTONES DE ACCIÓN PRINCIPAL Y SECUNDARIO ── */}
        <div
          className={`flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-700 delay-200 ease-out ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 pl-8 pr-4 py-4 rounded-full bg-[#ED500A] hover:bg-[#F36320] text-white font-title font-bold text-base shadow-xl shadow-[#ED500A]/25 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 group cursor-pointer"
          >
            <span>Comenzar con NEGOVA</span>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
              <ArrowRight className="w-4 h-4 text-white" />
            </div>
          </button>

          <a
            href={`https://wa.me/573114245409?text=${encodeURIComponent(
              "Hola NEGOVA, quiero conocer más sobre la plataforma y la prueba gratuita de 30 días."
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-full bg-[#25D366] hover:bg-[#20ba5a] text-white font-title font-bold text-base shadow-lg shadow-[#25D366]/25 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 group cursor-pointer"
          >
            <img src="/icons8-whatsapp.svg" alt="WhatsApp" className="w-5 h-5 shrink-0" />
            <span>Hablar con nosotros</span>
          </a>
        </div>

        {/* ── 4. COMUNICACIÓN DE PRUEBA GRATUITA DE 30 DÍAS ── */}
        <div
          className={`mt-10 transition-all duration-700 delay-300 ease-out ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-slate-300 font-mono text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-[#ED500A] animate-ping" />
            <span>Prueba NEGOVA durante 30 días · Sin compromiso</span>
          </div>
        </div>

      </div>

      {/* Modal de atención personalizada */}
      <FinalCtaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </section>
  );
}
