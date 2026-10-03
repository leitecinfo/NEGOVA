"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  ShieldCheck,
  Layers,
  Globe,
  HeartHandshake,
  ArrowRight,
  Sparkles,
  MessageCircle,
  X,
  Lock,
  CheckCircle2,
  Users,
  Compass,
  Utensils,
  ShoppingBag,
  Briefcase,
  Store,
} from "lucide-react";

// Hook de animación al scroll
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

// ── Modal de Atención Personalizada y Contacto Directo ──
function TrustModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  const whatsappMsg = encodeURIComponent(
    "Hola NEGOVA, quiero probar la plataforma durante 30 días gratis y conversar sobre cómo adaptarla a mi negocio."
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md animate-fade-in">
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
            <HeartHandshake className="w-6 h-6" />
          </div>
          <div>
            <span className="font-mono text-[11px] font-semibold tracking-wider text-[#ED500A] uppercase">
              ACOMPAÑAMIENTO DIRECTO
            </span>
            <h3 className="font-title font-extrabold text-xl text-[#0B0E14]">
              Prueba NEGOVA con Confianza
            </h3>
          </div>
        </div>

        <p className="font-body text-sm text-slate-600 mb-6 leading-relaxed">
          Pruébalo antes de decidir. Empieza con 30 días gratis y descubre si encaja con la forma en que trabajas. Nuestro equipo te acompañará en cada paso.
        </p>

        {/* Compromisos de Confianza */}
        <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 mb-6">
          <div className="flex items-center gap-2.5 text-xs text-slate-700 font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#ED500A] shrink-0" />
            <span>Sin compromisos iniciales ni contratos forzosos.</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-700 font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#ED500A] shrink-0" />
            <span>Configuración y acompañamiento directo en tu negocio.</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-700 font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#ED500A] shrink-0" />
            <span>Tu información siempre bajo tu control y protegida.</span>
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
  );
}

// ── Tarjetas de Caso Real y Confianza para el Carrusel Infinito ──
const MARQUEE_CARDS = [
  {
    category: "GASTRONOMÍA",
    title: "Restaurantes & Cafeterías",
    quote:
      "Control de comandas, insumos por receta y mesas en tiempo real sin depender de cuadernos ni cuentas a mano.",
    tag: "Modo Gastronómico",
    icon: Utensils,
    color: "#ED500A",
  },
  {
    category: "RETAIL & COMERCIO",
    title: "Boutiques & Variedades",
    quote:
      "Facturación ultrarrápida en mostrador con código de barras y control de variantes de tallas, colores o modelos.",
    tag: "Modo Comercio",
    icon: ShoppingBag,
    color: "#3B82F6",
  },
  {
    category: "SERVICIOS",
    title: "Barberías & Estética",
    quote:
      "Agenda de citas fluida, historial de clientes y liquidación transparente de comisiones por profesional.",
    tag: "Modo Servicios",
    icon: Briefcase,
    color: "#10B981",
  },
  {
    category: "MERCADOS",
    title: "Minimarkets & Fruterías",
    quote:
      "Atención ágil en filas con lectura de productos pesables, alerta de fechas de vencimiento y arqueo ciego.",
    tag: "Modo Mercados",
    icon: Store,
    color: "#8B5CF6",
  },
  {
    category: "PROTECCIÓN DE DATOS",
    title: "Información Segura",
    quote:
      "Respaldo automático de tus ventas e inventario con acceso privado y resguardo bajo altos estándares de seguridad.",
    tag: "Seguridad Negova",
    icon: ShieldCheck,
    color: "#ED500A",
  },
  {
    category: "ACOMPAÑAMIENTO",
    title: "Soporte 1 a 1",
    quote:
      "Acompañamiento directo en tu negocio durante la prueba de 30 días para configurar tu catálogo y cajas.",
    tag: "Atención Humana",
    icon: HeartHandshake,
    color: "#3B82F6",
  },
  {
    category: "DISPONIBILIDAD",
    title: "Acceso Web Inmediato",
    quote:
      "Ingresa desde cualquier computador o tablet sin descargas ni instalaciones complicadas para consultar tu negocio.",
    tag: "Acceso Nube",
    icon: Globe,
    color: "#10B981",
  },
  {
    category: "EVOLUCIÓN",
    title: "Construido con Negocios Reales",
    quote:
      "Evolucionamos escuchando la experiencia directa de quienes operan a diario en pequeños comercios de la región.",
    tag: "Cercanía Real",
    icon: Users,
    color: "#8B5CF6",
  },
];

export function TrustSection() {
  const { ref, visible } = useScrollReveal(0.1);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Duplicamos el array para lograr un bucle infinito suave sin saltos
  const duplicatedCards = [...MARQUEE_CARDS, ...MARQUEE_CARDS];

  return (
    <section
      ref={ref}
      id="confianza"
      className="relative py-24 sm:py-36 bg-white text-[#0B0E14] overflow-hidden border-t border-slate-100"
    >
      {/* Fondo con mallas sutiles */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[550px] bg-gradient-to-br from-[#ED500A]/5 via-transparent to-[#3B82F6]/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── 1. ENCABEZADO OFICIAL (Copy Solicitado) ── */}
        <div
          className={`text-center max-w-3xl mx-auto transition-all duration-700 ease-out ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <span className="font-mono text-xs font-semibold tracking-widest text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
            CONFIANZA PARA TU NEGOCIO
          </span>

          <h2 className="font-title font-black text-3xl sm:text-5xl text-[#0B0E14] mt-4 mb-3 leading-tight tracking-tight">
            Tu negocio merece una herramienta en la que puedas confiar.
          </h2>

          <p className="font-body text-base sm:text-lg text-slate-600 leading-relaxed max-w-[65ch] mx-auto">
            NEGOVA está pensado para ayudarte a organizar tu operación sin complicaciones y con la información de tu negocio siempre bajo control.
          </p>
        </div>

      </div>

      {/* ── 2. CARRUSEL INFINITO DE DERECHA A IZQUIERDA (Infinite Marquee) ── */}
      <div
        className={`mt-14 sm:mt-18 relative w-full overflow-hidden transition-all duration-700 delay-150 ease-out ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
      >
        {/* Máscaras de degradado lateral para integración suave */}
        <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-32 bg-gradient-to-r from-white to-transparent z-20 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-32 bg-gradient-to-l from-white to-transparent z-20 pointer-events-none" />

        {/* Tira continua animada en CSS a 60FPS */}
        <div className="flex gap-6 w-max animate-marquee hover:[animation-play-state:paused] py-4 cursor-grab active:cursor-grabbing">
          {duplicatedCards.map((card, idx) => {
            const Icon = card.icon;

            return (
              <div
                key={idx}
                className="w-[320px] sm:w-[380px] shrink-0 p-1.5 rounded-3xl bg-slate-100/90 border border-slate-200/90 hover:border-[#ED500A]/50 hover:-translate-y-1.5 transition-all duration-300 shadow-xs group"
              >
                {/* Doppelrand Inner Core */}
                <div className="h-full rounded-[calc(1.5rem-0.375rem)] p-6 sm:p-7 bg-[#F8F9FD] text-[#0B0E14] flex flex-col justify-between relative overflow-hidden">
                  
                  <div>
                    {/* Cabecera de tarjeta */}
                    <div className="flex items-center justify-between mb-4">
                      <div
                        className="p-2.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs group-hover:scale-105 transition-transform"
                        style={{ color: card.color }}
                      >
                        <Icon className="w-5 h-5" />
                      </div>

                      <span
                        className="font-mono text-[10px] font-bold px-2.5 py-1 rounded-full bg-white border border-slate-200/80"
                        style={{ color: card.color }}
                      >
                        {card.tag}
                      </span>
                    </div>

                    <span className="font-mono text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      {card.category}
                    </span>

                    <h3 className="font-title font-black text-lg text-[#0B0E14] mb-3 group-hover:text-[#ED500A] transition-colors">
                      {card.title}
                    </h3>

                    <p className="font-body text-xs sm:text-sm text-slate-600 leading-relaxed italic">
                      "{card.quote}"
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="font-mono text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
                      NEGOVA GARANTÍA
                    </span>
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: card.color }}
                    />
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      </div>



      {/* Modal de Confianza y Atención Directa */}
      <TrustModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </section>
  );
}
