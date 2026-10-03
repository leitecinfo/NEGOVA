"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { FloatingWrapper } from "@/components/floating/floating-wrapper";
import { 
  Check, 
  Minus, 
  ArrowRight, 
  Sparkles, 
  TrendingUp, 
  HelpCircle,
  MessageCircle,
  Brain,
  ShieldCheck,
  ChevronDown,
  UserCheck,
  Zap,
  CheckCircle2,
  Clock,
  Bot,
  X
} from "lucide-react";

// Hook de observación de scroll bidireccional y puro
function useScrollObserver(): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      {
        threshold: 0.05,
        rootMargin: "0px 0px -40px 0px"
      }
    );

    observer.observe(el);
    return () => {
      observer.unobserve(el);
    };
  }, []);

  return [ref, isVisible];
}

import { getCommercialPlans, COMPARISON_FEATURES } from "@/config/plans";
import { AnnualDiscountConfig } from "@/lib/subscriptions/types";
import { getAnnualDiscountAction } from "@/app/admin/planes/actions";

// Componente de Modal de Atención Personalizada y Activación Manual (Efecto Modal Nativo)
function ContactModal({
  isOpen,
  onClose,
  planName,
  planPrice,
  billingPeriod
}: {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  planPrice?: string;
  billingPeriod: string;
}) {
  if (!isOpen) return null;

  const isTrial = planName.toLowerCase().includes("prueba") || planName.toLowerCase().includes("inicio");
  const whatsappMsg = encodeURIComponent(
    isTrial
      ? `Hola NEGOVA, quiero probar el plan Inicio durante 30 días gratis para mi negocio. (Periodo: ${billingPeriod})`
      : planName.toLowerCase().includes("orientacion") || planName.toLowerCase().includes("asesoria")
      ? "Hola NEGOVA, no sé qué plan elegir. Quisiera ayuda para encontrar el mejor punto de partida."
      : `Hola NEGOVA, quiero activar el Plan ${planName} (${planPrice || ""}) para mi negocio facturado de forma ${billingPeriod}.`
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 border border-slate-200 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden text-[#0B0E14]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra superior de acento */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#ED500A] via-[#F36320] to-[#ED500A]" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
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
            <h3 className="font-title font-extrabold text-xl">
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
            href={`https://wa.me/573114245409?text=${whatsappMsg}`}
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

export default function PlanesPage() {
  const [billingPeriod, setBillingPeriod] = useState<"mensual" | "anual">("mensual");
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<number | null>(null);
  const [annualDiscount, setAnnualDiscount] = useState<AnnualDiscountConfig>({ isEnabled: false, percentage: 0 });
  
  // Estados para controlar las animaciones de Recarga y Scroll del Hero
  const [loaded, setLoaded] = useState(false);
  const [heroRef, heroVisible] = useScrollObserver();
  const [planesHeadingRef, planesHeadingVisible] = useScrollObserver();
  const [flexRef, flexVisible] = useScrollObserver();
  
  // Control de scroll real para salida y entrada bidireccional cinemática
  const [scrollY, setScrollY] = useState(0);

  // Estado para el modal de contacto
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    planName: string;
    planPrice?: string;
  }>({
    isOpen: false,
    planName: "",
  });

  useEffect(() => {
    setLoaded(true);

    getAnnualDiscountAction().then((cfg) => {
      if (cfg) setAnnualDiscount(cfg);
    }).catch(() => {});

    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const openModal = (planName: string, planPrice?: string) => {
    setModalState({ isOpen: true, planName, planPrice });
  };

  const closeModal = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
  };

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const contactGeneralUrl = `https://wa.me/573114245409?text=${encodeURIComponent(
    "Hola NEGOVA, me gustaría hablar con un asesor sobre los planes y precios para mi negocio."
  )}`;

  const createBusinessUrl = `https://wa.me/573114245409?text=${encodeURIComponent(
    "Hola NEGOVA, quiero crear mi negocio y comenzar con la prueba gratuita de 30 días en el Plan Inicio."
  )}`;

  // Ejemplos de preguntas de IA y sus respuestas correspondientes
  const iaQuestions = [
    {
      q: "¿Cuánto vendí hoy?",
      a: "Hoy registraste $342.500 COP en ventas totales. Tu producto estrella fue el café americano, sumando un 25% del total de la jornada."
    },
    {
      q: "¿Qué producto se está agotando?",
      a: "Tienes 3 alertas de stock: Leche entera (2 unidades restantes), Vasos desechables de 8oz (5 unidades restantes) y Azúcar refinada (bajo el mínimo)."
    },
    {
      q: "¿Cuál fue mi producto más vendido esta semana?",
      a: "El producto más vendido fue la 'Hamburguesa Especial' con 48 unidades vendidas, generando ingresos por $1.152.000 COP esta semana."
    },
    {
      q: "¿Cuánto tengo actualmente en caja?",
      a: "El arqueo de caja actual registra un saldo neto de $458.200 COP en efectivo y $180.000 COP en transferencias (Nequi/Daviplata)."
    }
  ];

  // Cálculos de scroll real para salida y entrada bidireccional cinemática (igual al index)
  const textTranslateY = Math.min(scrollY * 0.28, 140);
  const textOpacity = Math.max(1 - scrollY * 0.0022, 0);

  const cardsTranslateY = Math.min(scrollY * 0.16, 95);
  const cardsScale = Math.max(1 - scrollY * 0.00022, 0.94);
  const cardsOpacity = Math.max(1 - scrollY * 0.0018, 0);

  return (
    <div className="min-h-screen bg-[#F8F9FD] text-[#0B0E14] selection:bg-[#ED500A]/20 selection:text-[#ED500A] overflow-x-hidden">
      <Navbar />

      {/* ── 1. HERO CON ANIMACIÓN RECARGA MULTIDIRECCIONAL + ENTRADA/SALIDA SCROLL + DELAYS INDIVIDUALES ── */}
      <section 
        ref={heroRef as any}
        className="relative pt-28 pb-20 sm:pt-36 sm:pb-24 bg-white border-b border-slate-200 overflow-hidden"
      >
        {/* Luz de fondo sutil */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[350px] bg-gradient-to-br from-[#ED500A]/10 via-[#F36320]/5 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
          
          <div 
            className="max-w-4xl mx-auto space-y-6 transition-transform duration-75 ease-out"
            style={{
              transform: `translateY(-${textTranslateY}px)`,
              opacity: textOpacity,
              willChange: "transform, opacity",
            }}
          >
            <span 
              className={`inline-flex items-center gap-2 font-mono text-xs font-bold tracking-widest text-[#ED500A] uppercase px-4 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20 transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                loaded && heroVisible 
                  ? "opacity-100 translate-y-0 scale-100 blur-0" 
                  : "opacity-0 -translate-y-2 scale-[0.98] blur-[1px]"
              }`}
              style={{ transitionDelay: "100ms" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#ED500A] animate-pulse" />
              <span>Transparente y sin sorpresas</span>
            </span>

            <h1 
              className={`font-title font-black text-4xl sm:text-6xl text-[#0B0E14] leading-[1.05] tracking-tight transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                loaded && heroVisible 
                  ? "opacity-100 translate-y-0 scale-100 blur-0" 
                  : "opacity-0 translate-y-2 scale-[0.98] blur-[1px]"
              }`}
              style={{ transitionDelay: "250ms" }}
            >
              Elige el plan que haga <br />
              <span className="text-[#ED500A] italic">crecer tu negocio.</span>
            </h1>

            <p 
              className={`font-body text-base sm:text-xl text-slate-600 max-w-[58ch] mx-auto leading-relaxed transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                loaded && heroVisible 
                  ? "opacity-100 translate-x-0 blur-0" 
                  : "opacity-0 -translate-x-3 blur-[1px]"
              }`}
              style={{ transitionDelay: "400ms" }}
            >
              Empieza con lo que necesitas hoy y desbloquea nuevas herramientas a medida que tu negocio crece. Planes simples. Herramientas que crecen contigo.
            </p>

            {/* CTAs */}
            <div 
              className={`flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                loaded && heroVisible 
                  ? "opacity-100 translate-x-0 scale-100 blur-0" 
                  : "opacity-0 translate-x-3 scale-[0.99] blur-[1px]"
              }`}
              style={{ transitionDelay: "550ms" }}
            >
              <a
                href="#planes"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-[#ED500A] hover:bg-[#F36320] text-white font-title font-bold text-base shadow-xl shadow-[#ED500A]/25 transition-all duration-300 cursor-pointer"
              >
                <span>Comenzar ahora</span>
                <ArrowRight className="w-4 h-4" />
              </a>

              <a
                href={contactGeneralUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-full bg-[#F0F1F5] hover:bg-slate-200 text-[#0B0E14] font-title font-bold text-base transition-all duration-300 cursor-pointer"
              >
                <img src="/icons8-whatsapp.svg" alt="WhatsApp" className="w-5 h-5 shrink-0" />
                <span>Hablar con nosotros</span>
              </a>
            </div>
          </div>

          {/* Tarjetas Visuales con Animaciones Variadas de Carga y Flotado Perpetuo Bidireccional desfasado */}
          <div 
            className="mt-16 grid grid-cols-2 md:grid-cols-5 gap-4 max-w-5xl mx-auto transition-all duration-75 ease-out"
            style={{
              transform: `translateY(-${cardsTranslateY}px) scale(${cardsScale})`,
              opacity: cardsOpacity,
              willChange: "transform, opacity",
            }}
          >
            
            {/* Card 1: Ventas (Entrada desde la izquierda) */}
            <div 
              className={`transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                loaded && heroVisible 
                  ? "opacity-100 translate-x-0 scale-100" 
                  : "opacity-0 -translate-x-4 scale-[0.98]"
              }`}
              style={{ transitionDelay: "700ms" }}
            >
              <div className="animate-float-wave-1 h-full">
                <div className="p-5 rounded-2xl bg-[#F8F9FD] border border-slate-200/80 text-left shadow-xs h-full">
                  <span className="text-xl">⚡</span>
                  <p className="font-mono text-[9px] font-bold text-[#ED500A] uppercase mt-2.5">REGISTRO POS</p>
                  <h4 className="font-title font-bold text-sm text-[#0B0E14] mt-1">Ventas Ágiles</h4>
                  <p className="font-body text-[11px] text-slate-500 mt-1">Sin demoras ni cuentas en papel.</p>
                </div>
              </div>
            </div>

            {/* Card 2: Inventario (Entrada desde arriba) */}
            <div 
              className={`transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                loaded && heroVisible 
                  ? "opacity-100 translate-y-0 scale-100" 
                  : "opacity-0 -translate-y-4 scale-[0.98]"
              }`}
              style={{ transitionDelay: "800ms" }}
            >
              <div className="animate-float-wave-2 h-full">
                <div className="p-5 rounded-2xl bg-[#F8F9FD] border border-slate-200/80 text-left shadow-xs h-full">
                  <span className="text-xl">📦</span>
                  <p className="font-mono text-[9px] font-bold text-[#ED500A] uppercase mt-2.5">EXISTENCIAS</p>
                  <h4 className="font-title font-bold text-sm text-[#0B0E14] mt-1">Inventario Real</h4>
                  <p className="font-body text-[11px] text-slate-500 mt-1">Control de alertas y bajo stock.</p>
                </div>
              </div>
            </div>

            {/* Card 3: Caja (Entrada por escalado central/zoom) */}
            <div 
              className={`transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                loaded && heroVisible 
                  ? "opacity-100 scale-100" 
                  : "opacity-0 scale-[0.96]"
              }`}
              style={{ transitionDelay: "900ms" }}
            >
              <div className="animate-float-wave-3 h-full">
                <div className="p-5 rounded-2xl bg-[#F8F9FD] border border-slate-200/80 text-left shadow-xs h-full">
                  <span className="text-xl">💵</span>
                  <p className="font-mono text-[9px] font-bold text-[#ED500A] uppercase mt-2.5">BALANCES</p>
                  <h4 className="font-title font-bold text-sm text-[#0B0E14] mt-1">Arqueo de Caja</h4>
                  <p className="font-body text-[11px] text-slate-500 mt-1">Saber el efectivo exacto.</p>
                </div>
              </div>
            </div>

            {/* Card 4: Clientes (Entrada desde abajo) */}
            <div 
              className={`transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                loaded && heroVisible 
                  ? "opacity-100 translate-y-0 scale-100" 
                  : "opacity-0 translate-y-4 scale-[0.98]"
              }`}
              style={{ transitionDelay: "1000ms" }}
            >
              <div className="animate-float-wave-1 h-full">
                <div className="p-5 rounded-2xl bg-[#F8F9FD] border border-slate-200/80 text-left shadow-xs h-full">
                  <span className="text-xl">👥</span>
                  <p className="font-mono text-[9px] font-bold text-[#ED500A] uppercase mt-2.5">HISTORIAL</p>
                  <h4 className="font-title font-bold text-sm text-[#0B0E14] mt-1">Gestión Clientes</h4>
                  <p className="font-body text-[11px] text-slate-500 mt-1">Control de fiados y deudas.</p>
                </div>
              </div>
            </div>

            {/* Card 5: IA (Entrada desde la derecha) */}
            <div 
              className={`transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] col-span-2 md:col-span-1 ${
                loaded && heroVisible 
                  ? "opacity-100 translate-x-0 scale-100" 
                  : "opacity-0 translate-x-4 scale-[0.98]"
              }`}
              style={{ transitionDelay: "1100ms" }}
            >
              <div className="animate-float-wave-2 h-full">
                <div className="p-5 rounded-2xl bg-[#F8F9FD] border border-slate-200/80 text-left shadow-xs h-full">
                  <span className="text-xl">🧠</span>
                  <p className="font-mono text-[9px] font-bold text-[#ED500A] uppercase mt-2.5">NEGOCIO AI</p>
                  <h4 className="font-title font-bold text-sm text-[#0B0E14] mt-1">Análisis Inteligente</h4>
                  <p className="font-body text-[11px] text-slate-500 mt-1">Respuestas instantáneas.</p>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── 2. PLANES DE PRECIO UNIFICADOS CON EL DISEÑO DEL INDEX (DOPPELRAND BORDERS Y NUCLEO BLANCO) ── */}
      <section 
        id="planes" 
        ref={planesHeadingRef as any}
        className="py-20 sm:py-28 bg-[#F8F9FD] border-b border-slate-200"
      >
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          
          {/* Selector de facturación mensual/anual */}
          <div className="flex flex-col items-center mb-16 space-y-4">
            <div className="inline-flex p-1.5 rounded-full bg-slate-200/60 border border-slate-200/80">
              
              <button
                onClick={() => setBillingPeriod("mensual")}
                className={`px-6 py-2.5 rounded-full font-title font-bold text-xs transition-all duration-300 cursor-pointer ${
                  billingPeriod === "mensual"
                    ? "bg-[#ED500A] text-white shadow-md"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                Mensual
              </button>

              <button
                onClick={() => setBillingPeriod("anual")}
                className={`relative px-6 py-2.5 rounded-full font-title font-bold text-xs transition-all duration-300 cursor-pointer flex items-center gap-1.5 ${
                  billingPeriod === "anual"
                    ? "bg-[#ED500A] text-white shadow-md"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                <span>Anual</span>
                {annualDiscount.isEnabled && annualDiscount.percentage > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-mono tracking-wider font-extrabold uppercase ${
                    billingPeriod === "anual" ? "bg-white text-[#ED500A]" : "bg-[#ED500A] text-white"
                  }`}>
                    -{annualDiscount.percentage}%
                  </span>
                )}
              </button>

            </div>

            <p className="font-body text-xs text-slate-500">
              {billingPeriod === "anual"
                ? annualDiscount.isEnabled && annualDiscount.percentage > 0
                  ? `Facturado una vez al año con ${annualDiscount.percentage}% de descuento incluido.`
                  : "Facturado una vez al año (12 meses)."
                : "Facturado mes a mes."}
            </p>
          </div>

          {/* Tres Tarjetas de Planes Reutilizando la Estructura de la Home (Doppelrand border + Núcleo Blanco) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch max-w-6xl mx-auto">
            {getCommercialPlans(annualDiscount).map((plan, idx) => {
              const isRec = plan.isRecommended;

              // Staggered delay de revelado individual
              const delays = ["150ms", "350ms", "550ms"];
              const cardDelay = delays[idx % delays.length];

              // Clases de flotado perpetuo desfasado
              const waveClasses = ["animate-float-wave-1", "animate-float-wave-2", "animate-float-wave-3"];
              const waveClass = waveClasses[idx % waveClasses.length];

              const currentPrice = billingPeriod === "mensual" ? plan.pricing.monthlyFormatted : plan.pricing.annualMonthlyFormatted;

              return (
                <div
                  key={plan.id}
                  style={{
                    transitionDelay: planesHeadingVisible ? cardDelay : "0ms",
                  }}
                  className={`relative flex flex-col justify-between transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    planesHeadingVisible
                      ? `opacity-100 translate-y-0 scale-100 ${waveClass}`
                      : "opacity-0 translate-y-16 scale-95"
                  } ${
                    isRec ? "md:-translate-y-3 z-10" : "hover:-translate-y-1"
                  }`}
                >
                  {/* Doppelrand Outer Shell */}
                  <div
                    className={`h-full p-1.5 rounded-3xl transition-all duration-500 ${
                      isRec
                        ? "bg-gradient-to-b from-[#ED500A] via-[#F36320]/40 to-[#ED500A]/20 shadow-[0_22px_55px_rgba(237,80,10,0.22)]"
                        : "bg-slate-200/80 hover:bg-slate-300/80 border border-slate-200/90"
                    }`}
                  >
                    {/* Inner Core (100% fondo blanco idéntico al de inicio) */}
                    <div className="h-full rounded-[calc(1.5rem-0.375rem)] p-6 sm:p-8 flex flex-col justify-between bg-white text-[#0B0E14] relative overflow-hidden">
                      
                      {/* Resplandor sutil ambiente */}
                      {isRec && (
                        <div className="absolute -top-24 -right-24 w-60 h-60 bg-[#ED500A]/10 rounded-full blur-3xl pointer-events-none" />
                      )}

                      {/* Badge superior derecho */}
                      {isRec && (
                        <div className="absolute top-0 right-0">
                          <span className="inline-flex items-center gap-1.5 bg-[#ED500A] text-white font-mono text-[9px] font-extrabold tracking-wider uppercase px-4 py-1.5 rounded-bl-2xl shadow-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                            <span>{plan.badgeText}</span>
                          </span>
                        </div>
                      )}

                      {plan.trialBadge && (
                        <div className="absolute top-0 right-0">
                          <span className="inline-block bg-[#3B82F6] text-white font-mono text-[9px] font-bold tracking-wider uppercase px-3.5 py-1 rounded-bl-2xl">
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
                              {currentPrice}
                            </span>
                            <span className="font-mono text-xs text-slate-500 font-semibold">
                              {plan.pricing.billingNote}
                            </span>
                          </div>
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

                        {/* Capacidad de IA (Destello) */}
                        {plan.aiHighlight && (
                          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-50 via-orange-50/20 to-slate-50 border border-slate-200/80 mb-6 relative overflow-hidden">
                            <div className="flex items-center gap-2 mb-1">
                              <Bot className="w-4 h-4 text-[#ED500A] animate-[pulse_2s_infinite]" />
                              <span className="font-title font-bold text-xs text-[#0B0E14]">
                                {plan.aiHighlight.title}
                              </span>
                            </div>
                            <p className="font-body text-[11px] text-slate-600 leading-relaxed">
                              {plan.aiHighlight.description}
                            </p>
                          </div>
                        )}

                      </div>

                      {/* Botón CTA Unificado del Landing */}
                      <div className="pt-2">
                        <button
                          onClick={() => openModal(plan.name, `${currentPrice} ${plan.pricing.billingNote}`)}
                          className={`w-full inline-flex items-center justify-between pl-6 pr-2 py-3.5 rounded-full font-title font-bold text-sm transition-all duration-300 group cursor-pointer ${
                            isRec
                              ? "bg-[#ED500A] hover:bg-[#F36320] text-white shadow-md shadow-[#ED500A]/25 active:scale-[0.98]"
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

        </div>
      </section>

      {/* ── 3. TABLA COMPARATIVA COMPLETA (RESPONSIVE) ── */}
      <section className="py-20 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 sm:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="font-mono text-xs font-semibold tracking-wider text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
              DETALLE DE MÓDULOS
            </span>
            <h2 className="font-title font-black text-3xl sm:text-4xl text-[#0B0E14] mt-4 mb-2">
              Compara los planes
            </h2>
            <p className="font-body text-slate-600 text-sm sm:text-base">
              Encuentra las herramientas que necesitas para administrar mejor tu negocio.
            </p>
          </div>

          {/* Versión Escritorio */}
          <div className="hidden md:block overflow-hidden rounded-3xl border border-slate-200/80 shadow-xs">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#F8F9FD] border-b border-slate-200">
                  <th className="p-5 font-title font-bold text-xs text-[#0B0E14] uppercase tracking-wider w-[40%]">Funcionalidad</th>
                  <th className="p-5 font-title font-bold text-xs text-[#0B0E14] uppercase tracking-wider text-center w-[20%]">Inicio</th>
                  <th className="p-5 font-title font-bold text-xs text-[#ED500A] uppercase tracking-wider text-center bg-[#ED500A]/5 w-[20%]">Crece</th>
                  <th className="p-5 font-title font-bold text-xs text-[#0B0E14] uppercase tracking-wider text-center w-[20%]">Negocio</th>
                </tr>
              </thead>
              <tbody>
                {/* Agrupamos por categoría */}
                {Array.from(new Set(COMPARISON_FEATURES.map(f => f.category))).map((catName) => (
                  <React.Fragment key={catName}>
                    {/* Header de categoría */}
                    <tr className="bg-slate-50 border-y border-slate-200/60">
                      <td colSpan={4} className="px-5 py-3 font-title font-black text-[11px] text-[#0B0E14]/75 uppercase tracking-wider">
                        {catName}
                      </td>
                    </tr>
                    
                    {COMPARISON_FEATURES.filter(f => f.category === catName).map((feat, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-4 font-body text-xs text-[#0B0E14]">{feat.name}</td>
                        <td className="px-5 py-4 text-center">
                          {feat.inicio ? (
                            <Check className="w-4 h-4 text-[#10B981] mx-auto" />
                          ) : (
                            <Minus className="w-4 h-4 text-slate-300 mx-auto" />
                          )}
                        </td>
                        <td className="px-5 py-4 text-center bg-[#ED500A]/5">
                          {feat.crece ? (
                            <Check className="w-4 h-4 text-[#ED500A] mx-auto font-bold" />
                          ) : (
                            <Minus className="w-4 h-4 text-slate-300 mx-auto" />
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          {feat.negocio ? (
                            <Check className="w-4 h-4 text-[#10B981] mx-auto" />
                          ) : (
                            <Minus className="w-4 h-4 text-slate-300 mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Versión Mobile */}
          <div className="md:hidden space-y-8">
            {Array.from(new Set(COMPARISON_FEATURES.map(f => f.category))).map((catName) => (
              <div key={catName} className="rounded-2xl border border-slate-200 bg-[#F8F9FD] p-5 space-y-4">
                <h4 className="font-title font-black text-xs text-[#0B0E14] uppercase tracking-wider border-b border-slate-200 pb-2">
                  {catName}
                </h4>
                
                <div className="space-y-3.5">
                  {COMPARISON_FEATURES.filter(f => f.category === catName).map((feat, idx) => (
                    <div key={idx} className="flex flex-col gap-2 pt-2 first:pt-0 border-t border-slate-200/50 first:border-0">
                      <span className="font-body text-xs font-semibold text-[#0B0E14]">{feat.name}</span>
                      
                      <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
                        <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                          <span className="text-slate-400 block uppercase font-bold text-[8px]">Inicio</span>
                          <span className="inline-block mt-1">
                            {feat.inicio ? <Check className="w-3.5 h-3.5 text-[#10B981] mx-auto" /> : "—"}
                          </span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-[#ED500A]/10 border border-[#ED500A]/20">
                          <span className="text-[#ED500A] block uppercase font-bold text-[8px]">Crece</span>
                          <span className="inline-block mt-1">
                            {feat.crece ? <Check className="w-3.5 h-3.5 text-[#ED500A] mx-auto" /> : "—"}
                          </span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                          <span className="text-slate-400 block uppercase font-bold text-[8px]">Negocio</span>
                          <span className="inline-block mt-1">
                            {feat.negocio ? <Check className="w-3.5 h-3.5 text-[#10B981] mx-auto" /> : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── 4. SECCIÓN DE VALOR: "Tu negocio cambia..." ── */}
      <section 
        ref={flexRef as any}
        className="py-20 sm:py-28 bg-[#F8F9FD] border-b border-slate-200 overflow-hidden"
      >
        <div className="max-w-6xl mx-auto px-6 sm:px-8 text-center">
          
          <span 
            className={`inline-flex font-mono text-xs font-semibold tracking-wider text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20 transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
              flexVisible 
                ? "opacity-100 translate-y-0 scale-100 blur-0" 
                : "opacity-0 -translate-y-4 scale-95 blur-[1px]"
            }`}
          >
            FLEXIBILIDAD
          </span>
          
          <h2 
            className={`font-title font-black text-3xl sm:text-5xl text-[#0B0E14] mt-6 mb-4 tracking-tight leading-none transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
              flexVisible 
                ? "opacity-100 translate-y-0 scale-100 blur-0" 
                : "opacity-0 translate-y-4 scale-[0.98] blur-[1px]"
            }`}
            style={{ transitionDelay: "150ms" }}
          >
            Tu negocio cambia. NEGOVA también.
          </h2>

          <p 
            className={`font-body text-slate-600 text-sm sm:text-base max-w-[55ch] mx-auto mb-16 leading-relaxed transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
              flexVisible 
                ? "opacity-100 translate-y-0 blur-0" 
                : "opacity-0 translate-y-4 blur-[1px]"
            }`}
            style={{ transitionDelay: "300ms" }}
          >
            No necesitas pagar por herramientas que todavía no utilizas. Empieza con lo esencial y cambia de plan cuando tu negocio necesite más.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Bloque 1 */}
            <div 
              className={`transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                flexVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-[0.97]"
              }`}
              style={{ transitionDelay: "450ms" }}
            >
              <div className="animate-float-wave-1 h-full">
                <div className="bg-white p-8 rounded-3xl border border-slate-200/80 text-left space-y-4 shadow-xs h-full group hover:shadow-md hover:border-slate-300 transition-all duration-300">
                  <div className="w-10 h-10 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Zap className="w-5 h-5 fill-[#ED500A]/10" />
                  </div>
                  <h3 className="font-title font-extrabold text-lg text-[#0B0E14]">Empieza pequeño</h3>
                  <p className="font-body text-xs sm:text-sm text-slate-500 leading-relaxed">
                    Obtén las herramientas fundamentales para comenzar a organizar tu negocio sin enredos de contabilidad.
                  </p>
                </div>
              </div>
            </div>

            {/* Bloque 2 */}
            <div 
              className={`transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                flexVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-[0.97]"
              }`}
              style={{ transitionDelay: "600ms" }}
            >
              <div className="animate-float-wave-2 h-full">
                <div className="bg-white p-8 rounded-3xl border border-slate-200/80 text-left space-y-4 shadow-xs h-full group hover:shadow-md hover:border-slate-300 transition-all duration-300">
                  <div className="w-10 h-10 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <h3 className="font-title font-extrabold text-lg text-[#0B0E14]">Crece a tu ritmo</h3>
                  <p className="font-body text-xs sm:text-sm text-slate-500 leading-relaxed">
                    Desbloquea nuevas funcionalidades (proveedores, fiados, compras) cuando realmente las necesites.
                  </p>
                </div>
              </div>
            </div>

            {/* Bloque 3 */}
            <div 
              className={`transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                flexVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-[0.97]"
              }`}
              style={{ transitionDelay: "750ms" }}
            >
              <div className="animate-float-wave-3 h-full">
                <div className="bg-white p-8 rounded-3xl border border-slate-200/80 text-left space-y-4 shadow-xs h-full group hover:shadow-md hover:border-slate-300 transition-all duration-300">
                  <div className="w-10 h-10 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <h3 className="font-title font-extrabold text-lg text-[#0B0E14]">Ten más control</h3>
                  <p className="font-body text-xs sm:text-sm text-slate-500 leading-relaxed">
                    Obtén información más completa sobre colaboradores, permisos y balances financieros para decidir mejor.
                  </p>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>



      {/* ── 7. PREGUNTAS FRECUENTES (FAQ ACORDEÓN COMPLETO) ── */}
      <section className="py-20 sm:py-28 bg-[#F8F9FD] border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 sm:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="font-mono text-xs font-semibold tracking-wider text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
              RESOLVER DUDAS
            </span>
            <h2 className="font-title font-black text-3xl sm:text-4xl text-[#0B0E14] mt-4 mb-2">
              Preguntas frecuentes
            </h2>
            <p className="font-body text-slate-600 text-sm sm:text-base">
              Preguntas habituales sobre el funcionamiento de los planes, facturación y métodos de pago de NEGOVA.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "¿Puedo cambiar de plan después?",
                a: "Sí, puedes subir o bajar de plan en cualquier momento desde tu panel de configuración o contactando a soporte técnico. El cobro se ajustará automáticamente de manera proporcional."
              },
              {
                q: "¿Puedo cancelar mi suscripción?",
                a: "Sí, NEGOVA no tiene contratos de permanencia. Puedes cancelar tu suscripción mensual o anual en cualquier momento sin penalizaciones adicionales."
              },
              {
                q: "¿Puedo probar NEGOVA antes de pagar?",
                a: "Sí. Ofrecemos 30 días de prueba gratuita del plan Inicio para que puedas conocer la plataforma y organizar tu catálogo y caja sin ningún costo."
              },
              {
                q: "¿Puedo usar NEGOVA desde celular y computador?",
                a: "El plan Inicio es accesible únicamente desde dispositivos móviles. A partir del plan Crece en adelante, puedes utilizar la plataforma simultáneamente en computadores, tablets y celulares."
              },
              {
                q: "¿Qué métodos de pago están disponibles?",
                a: "Aceptamos tarjetas de crédito, débito, PSE, transferencias directas de Nequi, Daviplata y pagos por corresponsal bancario."
              },
              {
                q: "¿Qué pasa con mis datos si cambio de plan?",
                a: "Tus datos e historial se conservan intactos. Si pasas a un plan inferior que no soporta ciertas funciones (como proveedores), esa información quedará temporalmente archivada pero no se borrará."
              },
              {
                q: "¿Puedo agregar usuarios a mi negocio?",
                a: "A partir del plan Negocio puedes agregar empleados, configurar turnos de caja y asignarles roles y permisos específicos para resguardar la seguridad de la información."
              },
              {
                q: "¿NEGOVA funciona para diferentes tipos de negocios?",
                a: "Sí, NEGOVA cuenta con módulos específicos adaptados a negocios gastronómicos, comercios tradicionales, prestadores de servicios y mercados de alta rotación."
              },
              {
                q: "¿NEGOVA incluye inteligencia artificial?",
                a: "Sí, a partir del plan Crece se incluye NEGOVA AI, un asistente inteligente que te permite hacer consultas de caja, stock y balances de ventas mediante lenguaje natural."
              }
            ].map((faq, idx) => (
              <div key={idx} className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full flex items-center justify-between p-5 text-left font-title font-extrabold text-sm sm:text-base text-[#0B0E14] hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${activeFaq === idx ? "rotate-180 text-[#ED500A]" : ""}`} />
                </button>

                {activeFaq === idx && (
                  <div className="p-5 pt-0 font-body text-xs sm:text-sm text-slate-500 leading-relaxed border-t border-slate-100 animate-slide-down">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── 8. CTA FINAL CONVERTIDOR ── */}
      <section className="relative py-24 sm:py-32 bg-[#0B0E14] text-white overflow-hidden text-center">
        {/* Luz de fondo */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-gradient-to-br from-[#ED500A]/20 via-[#F36320]/10 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 sm:px-8 space-y-6">
          <h2 className="font-title font-black text-4xl sm:text-6xl text-white leading-none tracking-tight">
            Un mejor control <br className="hidden sm:inline" />
            empieza hoy.
          </h2>
          
          <p className="font-body text-base sm:text-xl text-slate-300 max-w-[50ch] mx-auto leading-relaxed">
            Haz que administrar tu negocio sea más sencillo con NEGOVA. Solicita tu prueba gratuita de 30 días y da el salto digital.
          </p>

          <div className="pt-4">
            <a
              href={createBusinessUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-[#ED500A] hover:bg-[#F36320] text-white font-title font-bold text-base shadow-xl shadow-[#ED500A]/25 transition-all duration-300 cursor-pointer"
            >
              <span>Crear mi negocio</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Modal de Activación Manual / Contacto Premium */}
      <ContactModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        planName={modalState.planName}
        planPrice={modalState.planPrice}
        billingPeriod={billingPeriod === "mensual" ? "mensual" : "anual"}
      />

      {/* Asistentes Flotantes */}
      <FloatingWrapper />

      <Footer />
    </div>
  );
}
