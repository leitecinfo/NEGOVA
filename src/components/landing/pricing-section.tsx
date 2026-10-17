"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  Check,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Zap,
  Clock,
  MessageCircle,
  X,
  CheckCircle2,
  HelpCircle,
  TrendingUp,
  Store,
  Bot,
  BrainCircuit,
  Layers,
  ChevronRight,
} from "lucide-react";
import { ModalPortal } from "@/components/ui/modal-portal";

// Hook de animación bidireccional al scroll
function useScrollReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold, rootMargin: "80px 0px -5% 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

import { COMMERCIAL_PLANS_LIST, CommercialPlan } from "@/config/plans";

// ── Modal de Atención Personalizada y Activación Manual ──
function ContactModal({
  isOpen,
  onClose,
  planName,
  planPrice,
}: {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  planPrice?: string;
}) {
  if (!isOpen) return null;

  const isTrial = planName.toLowerCase().includes("prueba") || planName.toLowerCase().includes("inicio");
  const whatsappMsg = encodeURIComponent(
    isTrial
      ? "Hola NEGOVA, quiero probar el plan Inicio durante 30 días gratis para mi negocio."
      : planName.toLowerCase().includes("orientacion") || planName.toLowerCase().includes("asesoria")
      ? "Hola NEGOVA, no sé qué plan elegir. Quisiera ayuda para encontrar el mejor punto de partida."
      : `Hola NEGOVA, quiero activar el Plan ${planName} (${planPrice || ""}) para mi negocio.`
  );

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md animate-fade-in">
        <div
          className="relative w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 border border-slate-200 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Barra superior de acento */}
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
                ATENCIÓN PERSONALIZADA
              </span>
              <h3 className="font-title font-extrabold text-xl text-[#0B0E14]">
                {isTrial ? "Prueba Gratis · 30 Días" : `Plan ${planName}`}
              </h3>
            </div>
          </div>

          <p className="font-body text-sm text-slate-600 mb-6 leading-relaxed">
            {isTrial
              ? "Prueba NEGOVA con el plan Inicio durante 30 días. Sin compromisos. Te asistiremos de forma directa para crear tu espacio de trabajo de inmediato."
              : `Te ayudamos a poner en marcha el Plan ${planName}. Nuestro equipo te acompañará para configurar tu negocio rápidamente.`}
          </p>

          {/* Pasos de atención manual */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 mb-6">
            <div className="flex items-center gap-3 text-xs text-slate-700">
              <div className="w-5 h-5 rounded-full bg-[#ED500A] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0">1</div>
              <span>Nos indicas el tipo de negocio que tienes.</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-700">
              <div className="w-5 h-5 rounded-full bg-[#0B0E14] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0">2</div>
              <span>Revisamos tu operación y preparamos tu catálogo.</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-700">
              <div className="w-5 h-5 rounded-full bg-[#10B981] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0">3</div>
              <span>Te entregamos las credenciales de acceso para empezar.</span>
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

export function PricingSection() {
  const { ref, visible } = useScrollReveal(0.1);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    planName: string;
    planPrice?: string;
  }>({
    isOpen: false,
    planName: "",
  });

  const openModal = (planName: string, planPrice?: string) => {
    setModalState({ isOpen: true, planName, planPrice });
  };

  const closeModal = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <section
      ref={ref}
      id="precios"
      className="relative py-24 sm:py-36 bg-[#F8F9FD] text-[#0B0E14] overflow-hidden"
    >
      {/* Luz ambiental sutil */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-br from-[#ED500A]/5 via-transparent to-[#3B82F6]/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── 1. ENCABEZADO Y COMUNICACIÓN DE PRUEBA GRATUITA ── */}
        <div
          className={`text-center max-w-3xl mx-auto transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <span className="font-mono text-xs font-semibold tracking-widest text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
            PLANES Y PRECIOS
          </span>

          <h2 className="font-title font-black text-3xl sm:text-5xl text-[#0B0E14] mt-4 mb-3 leading-tight tracking-tight">
            Elige cómo quieres llevar tu negocio.
          </h2>

          <p className="font-body text-base sm:text-lg text-slate-600 leading-relaxed max-w-[65ch] mx-auto mb-6">
            Empieza con lo que necesitas hoy y crece con NEGOVA cuando tu negocio lo necesite.
          </p>

          {/* Bloque destacado de 30 Días Gratis */}
          <div className="inline-flex flex-col sm:flex-row items-center gap-3 px-5 py-3 rounded-2xl bg-white border border-slate-200/90 shadow-sm text-left">
            <div className="flex items-center gap-2 text-[#ED500A] font-title font-extrabold text-sm sm:text-base shrink-0">
              <Sparkles className="w-4 h-4 fill-[#ED500A]/20" />
              <span>30 días gratis</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-slate-200" />
            <p className="font-body text-xs sm:text-sm text-slate-600">
              Prueba NEGOVA durante 30 días con el plan Inicio. Sin compromiso.
            </p>
          </div>
        </div>

        {/* ── 2. BARRA DE PROGRESIÓN VISUAL DEL PRODUCTO ── */}
        <div
          className={`mt-12 max-w-4xl mx-auto hidden md:grid grid-cols-3 gap-4 transition-all duration-700 delay-100 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <div className="p-3 rounded-xl bg-white/70 border border-slate-200/80 text-center">
            <span className="font-mono text-[11px] font-bold text-[#3B82F6] block">01. INICIO</span>
            <span className="font-title font-bold text-xs text-[#0B0E14]">Pon orden</span>
          </div>
          <div className="p-3 rounded-xl bg-[#ED500A]/5 border border-[#ED500A]/30 text-center relative overflow-hidden">
            <span className="font-mono text-[11px] font-bold text-[#ED500A] block">02. CRECE</span>
            <span className="font-title font-bold text-xs text-[#0B0E14]">Entiende tu negocio</span>
          </div>
          <div className="p-3 rounded-xl bg-white/70 border border-slate-200/80 text-center">
            <span className="font-mono text-[11px] font-bold text-[#10B981] block">03. NEGOCIO</span>
            <span className="font-title font-bold text-xs text-[#0B0E14]">Operación completa</span>
          </div>
        </div>

        {/* ── 3. COMPOSICIÓN EDITORIAL DE LOS 3 PLANES CON STAGGERED REVEAL INDIVIDUAL DESDE ABAJO ── */}
        <div className="mt-8 sm:mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {COMMERCIAL_PLANS_LIST.map((plan, idx) => {
            const isRec = plan.isRecommended;

            // Staggered delays individuales para cada tarjeta desde abajo (150ms, 350ms, 550ms)
            const delays = ["150ms", "350ms", "550ms"];
            const cardDelay = delays[idx % delays.length];

            // Clases de flotado perpetuo tipo ola desfasado (ola 1, ola 2, ola 3)
            const waveClasses = ["animate-float-wave-1", "animate-float-wave-2", "animate-float-wave-3"];
            const waveClass = waveClasses[idx % waveClasses.length];

            return (
              <div
                key={plan.id}
                style={{
                  transitionDelay: visible ? cardDelay : "0ms",
                }}
                className={`relative flex flex-col justify-between transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  visible
                    ? `opacity-100 translate-y-0 scale-100 ${waveClass}`
                    : "opacity-0 translate-y-16 scale-95"
                } ${
                  isRec
                    ? "md:-translate-y-3 z-10"
                    : "hover:-translate-y-1"
                }`}
              >
                {/* Doppelrand Outer Shell (100% Opacidad sólida para máxima legibilidad) */}
                <div
                  className={`h-full p-1.5 rounded-3xl transition-all duration-500 ${
                    isRec
                      ? "bg-gradient-to-b from-[#ED500A] via-[#F36320]/40 to-[#ED500A]/20 shadow-[0_22px_55px_rgba(237,80,10,0.22)]"
                      : "bg-slate-200/80 hover:bg-slate-300/80 border border-slate-200/90"
                  }`}
                >
                  {/* Inner Core */}
                  <div
                    className={`h-full rounded-[calc(1.5rem-0.375rem)] p-6 sm:p-8 flex flex-col justify-between bg-white text-[#0B0E14] relative overflow-hidden`}
                  >
                    {/* Resplandor sutil ambiente de fondo (sin afectar opacidad del texto) */}
                    {isRec && (
                      <div className="absolute -top-24 -right-24 w-60 h-60 bg-[#ED500A]/10 rounded-full blur-3xl pointer-events-none" />
                    )}

                    {/* Badge de Recomendado con animación perpetua */}
                    {isRec && (
                      <div className="absolute top-0 right-0">
                        <span className="inline-flex items-center gap-1.5 bg-[#ED500A] text-white font-mono text-[10px] font-extrabold tracking-wider uppercase px-4 py-1.5 rounded-bl-2xl shadow-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          <span>{plan.badgeText}</span>
                        </span>
                      </div>
                    )}

                    {/* Badge de 30 Días Gratis en Inicio */}
                    {plan.trialBadge && (
                      <div className="absolute top-0 right-0">
                        <span className="inline-block bg-[#3B82F6] text-white font-mono text-[10px] font-bold tracking-wider uppercase px-3.5 py-1 rounded-bl-2xl">
                          {plan.trialBadge}
                        </span>
                      </div>
                    )}

                    <div>
                      {/* Cabecera del Plan */}
                      <div className="mb-5">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="relative flex h-2.5 w-2.5">
                            <span
                              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                              style={{ backgroundColor: plan.color }}
                            />
                            <span
                              className="relative inline-flex rounded-full h-2.5 w-2.5"
                              style={{ backgroundColor: plan.color }}
                            />
                          </span>
                          <h3 className="font-title font-black text-2xl text-[#0B0E14]">
                            {plan.name}
                          </h3>
                        </div>

                        {/* Concepto del Plan */}
                        <div className="mb-3">
                          <span
                            className="inline-block font-title font-extrabold text-xs px-2.5 py-0.5 rounded-md"
                            style={{
                              backgroundColor: `${plan.color}15`,
                              color: plan.color,
                            }}
                          >
                            {plan.concept}
                          </span>
                        </div>

                        <p className="font-body text-xs text-slate-500 leading-relaxed min-h-[44px]">
                          {plan.description}
                        </p>
                      </div>

                      {/* Bloque de Precio */}
                      <div className="mb-6 pt-4 pb-5 border-y border-slate-100">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-title font-black text-3xl sm:text-4xl text-[#0B0E14]">
                            {plan.pricing.monthlyFormatted}
                          </span>
                          <span className="font-mono text-xs text-slate-500 font-semibold">
                            {plan.pricing.billingNote}
                          </span>
                        </div>
                        {/* Propuesta de valor sintética */}
                        <p className="font-body text-[11px] font-medium text-slate-600 mt-1.5 italic">
                          "{plan.tagline}"
                        </p>
                      </div>

                      {/* Grupos de Funcionalidades */}
                      <div className="space-y-4 mb-6">
                        {plan.featureGroups.map((group, gIdx) => (
                          <div key={gIdx}>
                            <p className="font-mono text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                              {group.category}
                            </p>
                            <div className="space-y-2">
                              {group.items.map((item, iIdx) => (
                                <div key={iIdx} className="flex items-start gap-2 text-xs text-slate-700">
                                  <CheckCircle2
                                    className="w-3.5 h-3.5 shrink-0 mt-0.5"
                                    style={{ color: plan.color }}
                                  />
                                  <span className="font-medium leading-tight">{item}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Capacidad de IA con destello sutil */}
                      {plan.aiHighlight && (
                        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-50 via-orange-50/20 to-slate-50 border border-slate-200/80 mb-6 relative overflow-hidden">
                          <div className="flex items-center gap-2 mb-1">
                            <Bot className="w-4 h-4 text-[#ED500A] animate-[pulse_2s_infinite]" />
                            <span className="font-title font-bold text-xs text-[#0B0E14]">
                              {plan.aiHighlight.title}
                            </span>
                          </div>
                          <p className="font-body text-[11px] text-slate-600 mb-2 leading-relaxed">
                            {plan.aiHighlight.description}
                          </p>
                          {plan.aiHighlight.sampleQuestions && (
                            <div className="space-y-1 pl-2 border-l-2 border-[#ED500A]/40">
                              {plan.aiHighlight.sampleQuestions.map((q, qIdx) => (
                                <p key={qIdx} className="font-mono text-[10.5px] text-slate-500 italic">
                                  "{q}"
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Botón CTA del Plan con Microinteracción */}
                    <div className="pt-2">
                      <button
                        onClick={() => openModal(plan.name, `${plan.pricing.monthlyFormatted} ${plan.pricing.billingNote}`)}
                        className={`w-full inline-flex items-center justify-between pl-6 pr-2 py-3.5 rounded-full font-title font-bold text-sm transition-all duration-300 group cursor-pointer ${
                          isRec
                            ? "bg-[#ED500A] hover:bg-[#F36320] text-white shadow-md shadow-[#ED500A]/20 active:scale-[0.98]"
                            : "bg-slate-100 hover:bg-[#0B0E14] text-slate-800 hover:text-white active:scale-[0.98]"
                        }`}
                      >
                        <span>{plan.ctaText}</span>
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform group-hover:translate-x-1 ${
                            isRec
                              ? "bg-white/20 text-white"
                              : "bg-slate-200 group-hover:bg-white/20 text-slate-700 group-hover:text-white"
                          }`}
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </button>

                      {plan.id === "inicio" && (
                        <p className="font-mono text-[10px] text-center text-slate-400 mt-2 font-medium">
                          Incluye 30 días de prueba sin costo
                        </p>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── 4. BLOQUE DE PRUEBA GRATUITA DEDICADO ── */}
        <div
          className={`mt-14 max-w-3xl mx-auto p-1 rounded-3xl bg-gradient-to-r from-slate-200 via-orange-100 to-slate-200 transition-all duration-700 delay-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="rounded-[calc(1.5rem-0.25rem)] bg-white p-6 sm:p-8 border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#3B82F6]/10 text-[#3B82F6] font-mono text-[11px] font-bold uppercase mb-2">
                <Clock className="w-3.5 h-3.5" />
                <span>30 DÍAS PARA PROBAR NEGOVA</span>
              </div>
              <h4 className="font-title font-extrabold text-lg sm:text-xl text-[#0B0E14] mb-1">
                Empieza con Inicio y conoce la plataforma antes de decidir.
              </h4>
              <p className="font-body text-xs text-slate-500">
                Gestión manual durante esta primera etapa. Te acompañamos en la configuración inicial.
              </p>
            </div>

            <button
              onClick={() => openModal("Prueba Gratuita 30 días")}
              className="px-6 py-3.5 rounded-full bg-[#0B0E14] hover:bg-[#ED500A] text-white font-title font-bold text-sm shrink-0 transition-colors shadow-md group cursor-pointer inline-flex items-center gap-2"
            >
              <span>Quiero probar NEGOVA</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* ── 5. PREGUNTA DE ORIENTACIÓN Y CTA FINAL ── */}
        <div
          className={`mt-12 pt-10 border-t border-slate-200/80 text-center max-w-2xl mx-auto transition-all duration-700 delay-350 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <h4 className="font-title font-extrabold text-xl text-[#0B0E14] mb-2">
            ¿No sabes qué plan elegir?
          </h4>
          <p className="font-body text-sm text-slate-600 mb-6 leading-relaxed">
            Cuéntanos qué tipo de negocio tienes y te ayudamos a encontrar el punto de partida adecuado.
          </p>

          <button
            onClick={() => openModal("Orientación sobre mi negocio")}
            className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-full bg-[#ED500A] hover:bg-[#F36320] text-white font-title font-bold text-sm shadow-md hover:shadow-lg transition-all duration-200 group cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 fill-white/20" />
            <span>Hablar con NEGOVA</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

      </div>

      {/* Modal de atención personalizada */}
      <ContactModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        planName={modalState.planName}
        planPrice={modalState.planPrice}
      />
    </section>
  );
}
