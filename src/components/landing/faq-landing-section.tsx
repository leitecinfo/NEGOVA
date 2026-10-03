"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { FAQ_ITEMS, FaqItem } from "@/data/faq-data";
import { Plus, Minus, ArrowRight, HelpCircle } from "lucide-react";

// Hook de animación al scroll ajustado para activar la animación cuando el elemento está 20% adentro de la pantalla
function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold, rootMargin: "0px 0px -20% 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

// Componente individual de tarjeta FAQ con su propio observer de entrada al 20% del viewport
function FaqAccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  item: FaqItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { ref, visible } = useScrollReveal(0.15);

  return (
    <div
      ref={ref}
      className={`faq-scroll-card ${visible ? "is-visible" : ""}`}
    >
      <div
        className={`p-1 rounded-2xl transition-all duration-300 ${
          isOpen
            ? "bg-gradient-to-r from-[#ED500A]/30 via-slate-200 to-[#ED500A]/20 border border-[#ED500A]/30 shadow-sm"
            : "bg-slate-200/70 hover:bg-slate-300/70 border border-slate-200/80"
        }`}
      >
        <div className="rounded-[calc(1rem-0.25rem)] bg-white text-[#0B0E14] overflow-hidden">
          
          <button
            onClick={onToggle}
            aria-expanded={isOpen}
            aria-controls={`faq-answer-${item.id}`}
            className="w-full flex items-center justify-between p-5 sm:p-6 text-left focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#ED500A] rounded-xl transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3 pr-4">
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-500 group-hover:text-[#ED500A] transition-colors shrink-0">
                {item.clusterName}
              </span>
              <h3 className="font-title font-extrabold text-base sm:text-lg text-[#0B0E14] group-hover:text-[#ED500A] transition-colors leading-snug">
                {item.question}
              </h3>
            </div>

            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform duration-300 ${
                isOpen
                  ? "bg-[#ED500A] text-white rotate-180"
                  : "bg-slate-100 text-slate-600 group-hover:bg-[#ED500A]/10 group-hover:text-[#ED500A]"
              }`}
            >
              {isOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </div>
          </button>

          {isOpen && (
            <div
              id={`faq-answer-${item.id}`}
              className="px-5 pb-6 pt-1 sm:px-6 text-slate-600 font-body text-sm sm:text-base leading-relaxed border-t border-slate-100 animate-fade-in"
            >
              {item.answer}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export function FaqLandingSection() {
  const { ref, visible } = useScrollReveal(0.1);
  const [openId, setOpenId] = useState<string | null>("que-es-negova");

  const featuredQuestions = FAQ_ITEMS.filter((item) => item.isFeaturedInLanding).slice(0, 7);

  const toggleItem = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section
      ref={ref}
      id="faq"
      className="relative py-24 sm:py-36 bg-[#F8F9FD] text-[#0B0E14] overflow-hidden border-t border-slate-200/80"
    >
      {/* Luz ambiente difusa */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[450px] bg-gradient-to-br from-[#ED500A]/5 via-transparent to-[#3B82F6]/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── 1. ENCABEZADO OFICIAL ── */}
        <div
          className={`text-center max-w-2xl mx-auto transition-all duration-700 ease-out ${
            visible
              ? "opacity-100 translate-y-0 scale-100 blur-0"
              : "opacity-0 translate-y-10 scale-95 blur-xs"
          }`}
        >
          <span className="font-mono text-xs font-semibold tracking-widest text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
            PREGUNTAS FRECUENTES
          </span>

          <h2 className="font-title font-black text-3xl sm:text-5xl text-[#0B0E14] mt-4 mb-3 leading-tight tracking-tight">
            ¿Tienes alguna duda?
          </h2>

          <p className="font-body text-base sm:text-lg text-slate-600 leading-relaxed max-w-[60ch] mx-auto">
            Resolvemos las preguntas más comunes sobre NEGOVA, sus funciones y cómo puede ayudarte a organizar tu negocio.
          </p>
        </div>

        {/* ── 2. LISTA DE PREGUNTAS CON ANIMACIÓN INDIVIDUAL AL 20% EN PANTALLA ── */}
        <div className="mt-12 space-y-4">
          {featuredQuestions.map((item) => (
            <FaqAccordionItem
              key={item.id}
              item={item}
              isOpen={openId === item.id}
              onToggle={() => toggleItem(item.id)}
            />
          ))}
        </div>

        {/* ── 3. CTA SECUNDARIO HACIA LA PÁGINA COMPLETA ── */}
        <div
          className={`mt-12 text-center transition-all duration-700 ease-out ${
            visible
              ? "opacity-100 translate-y-0 scale-100 blur-0"
              : "opacity-0 translate-y-8 scale-95 blur-xs"
          }`}
        >
          <Link
            href="/preguntas-frecuentes"
            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-[#0B0E14] hover:bg-[#ED500A] text-white font-title font-bold text-sm shadow-md hover:shadow-lg transition-all duration-300 group cursor-pointer"
          >
            <span>Ver todas las preguntas</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

      </div>
    </section>
  );
}
