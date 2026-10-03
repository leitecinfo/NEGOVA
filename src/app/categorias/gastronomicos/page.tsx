"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { FloatingWrapper } from "@/components/floating/floating-wrapper";
import { PricingSection } from "@/components/landing/pricing-section";
import { TrustSection } from "@/components/landing/trust-section";
import { FaqLandingSection } from "@/components/landing/faq-landing-section";
import { FinalCtaSection } from "@/components/landing/final-cta-section";
import { 
  CheckCircle2, 
  ArrowRight, 
  Store, 
  Sparkles,
  ChevronDown, 
  HelpCircle,
  AlertTriangle,
  FileText,
  Boxes,
  TrendingUp,
  Clock,
  Smartphone,
  ChevronRight,
  MessageSquare
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
        threshold: 0.1,
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

// Componente Wrapper para revelado bidireccional mediante CSS puro
function Reveal({ 
  children, 
  className = "", 
  variant = "up", 
  delay = 0 
}: { 
  children: React.ReactNode; 
  className?: string; 
  variant?: "up" | "left" | "right" | "fade"; 
  delay?: number;
}) {
  const [ref, isVisible] = useScrollObserver();
  
  const variantClass = 
    variant === "up" 
      ? "gastro-reveal-up" 
      : variant === "left" 
      ? "gastro-reveal-left" 
      : variant === "right" 
      ? "gastro-reveal-right" 
      : "gastro-reveal-fade";

  return (
    <div
      ref={ref as any}
      className={`${variantClass} ${isVisible ? "is-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// Categorías de negocios gastronómicos
const BUSINESS_TYPES = [
  {
    title: "Restaurantes",
    description: "Para negocios que atienden pedidos y necesitan controlar ventas, productos, caja e inventario.",
    details: "Control de insumos, cierres de turno y ventas en mostrador.",
    icon: "🍽️",
    image: "/images/gastro-tipo-restaurante.jpg",
    span: "lg:col-span-2 lg:row-span-1"
  },
  {
    title: "Comida rápida",
    description: "Para negocios de alta rotación que necesitan registrar ventas rápidamente y mantener control de sus productos.",
    details: "Facturación rápida en 3 clics y alertas de productos por agotarse.",
    icon: "🍔",
    image: "/images/gastro-tipo-rapida.jpg",
    span: "lg:col-span-1 lg:row-span-1"
  },
  {
    title: "Cafeterías",
    description: "Para cafeterías que necesitan organizar productos, ventas, inventario y caja.",
    details: "Control de caja chica, catálogo con variantes (tamaño, tipo de leche) y fiados.",
    icon: "☕",
    image: "/images/gastro-tipo-cafeteria.jpg",
    span: "lg:col-span-1 lg:row-span-1"
  },
  {
    title: "Panaderías y pastelerías",
    description: "Para negocios que manejan productos de elaboración y venta diaria.",
    details: "Actualización de stock cotidiano, ventas rápidas y fiados a vecinos.",
    icon: "🥖",
    image: "/images/gastro-tipo-panaderia.jpg",
    span: "lg:col-span-2 lg:row-span-1"
  },
  {
    title: "Bares y licoreras",
    description: "Para negocios que necesitan controlar productos, ventas y movimientos de caja.",
    details: "Control de botellas, arqueo al cierre de la noche y flujo de caja.",
    icon: "🍺",
    image: "/images/gastro-tipo-bares.jpg",
    span: "lg:col-span-1 lg:row-span-1"
  },
  {
    title: "Otros negocios gastronómicos",
    description: "Para pequeños negocios de alimentos con necesidades similares.",
    details: "Adaptable a pastelerías caseras, fruterías, carritos de comida y más.",
    icon: "🥟",
    image: "/images/gastro-tipo-otros.jpg",
    span: "lg:col-span-2 lg:row-span-1"
  }
];

// Problemas reales de los comercios
const REAL_PROBLEMS = [
  {
    title: "Ventas anotadas en cuadernos",
    desc: "Las deudas y ventas se pierden entre hojas sueltas, tachones o cuadernos que se pueden extraviar."
  },
  {
    title: "Desconocimiento del total diario",
    desc: "No siempre se sabe con exactitud cuánto se vendió realmente al finalizar la jornada laboral."
  },
  {
    title: "Sin control de productos agotados",
    desc: "Te das cuenta de que no hay stock a mitad del servicio, perdiendo ventas y clientes."
  },
  {
    title: "Dinero de caja mezclado",
    desc: "El efectivo de las ventas se mezcla con compras rápidas a proveedores o gastos personales."
  },
  {
    title: "Precios y productos desorganizados",
    desc: "Errores al cobrar por no tener una lista de precios unificada y visible para todos."
  },
  {
    title: "Pérdida de tiempo buscando datos",
    desc: "Minutos valiosos buscando en papeles cuánto debe un cliente o cuánto se gastó."
  },
  {
    title: "Dificultad para saber qué funciona",
    desc: "Es difícil saber qué plato o producto es el que realmente te deja más ganancias netas."
  },
  {
    title: "Dependencia de la memoria",
    desc: "El propietario carga con toda la operación en la cabeza, generando estrés y cansancio."
  }
];

// Funcionalidades reales y confirmadas de NEGOVA
const CONFIRMED_FEATURES = [
  {
    title: "Ventas",
    desc: "Registra las ventas de tu negocio y mantén organizada la información de tus transacciones.",
    icon: "🛒"
  },
  {
    title: "Inventario",
    desc: "Controla los productos disponibles y conoce qué necesitas reponer con alertas de stock bajo.",
    icon: "📦"
  },
  {
    title: "Caja",
    desc: "Registra ingresos, salidas y movimientos para tener mayor control del dinero físico.",
    icon: "💵"
  },
  {
    title: "Productos",
    desc: "Organiza tus productos, categorías y la información necesaria (costos, precios) para venderlos.",
    icon: "🍎"
  },
  {
    title: "Clientes",
    desc: "Mantén organizada la información de tus clientes y controla deudas (fiados) con historial de abonos.",
    icon: "👥"
  },
  {
    title: "Gastos",
    desc: "Registra los gastos del negocio (proveedores, servicios) para entender hacia dónde se va el dinero.",
    icon: "📉"
  },
  {
    title: "Reportes",
    desc: "Convierte la información de tu operación diaria en datos simples que te ayuden a entender tu negocio.",
    icon: "📈"
  }
];

export default function GastronomicosPage() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Activa la animación de recarga/onload en el Hero
    setLoaded(true);
  }, []);

  const whatsappUrl = `https://wa.me/573114245409?text=${encodeURIComponent(
    "Hola NEGOVA, tengo un negocio gastronómico y me gustaría solicitar la prueba gratuita de 30 días."
  )}`;

  return (
    <div className="min-h-screen bg-[#F8F9FD] text-[#0B0E14] selection:bg-[#ED500A]/20 selection:text-[#ED500A]">
      <Navbar />

      {/* ── 1. HERO ESPECÍFICO DE GASTRONOMÍA (DISEÑO EDITORIAL SPLIT PREMIUM) ── */}
      <section className="relative pt-28 pb-20 sm:pt-36 sm:pb-28 bg-white border-b border-slate-200 overflow-hidden">
        {/* Luz de fondo sutil */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-br from-[#ED500A]/10 via-[#F36320]/5 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* Columna Izquierda: Mensaje y Conversión (Animación de carga CSS) */}
            <div className={`lg:col-span-6 space-y-6 text-left hero-onload-left ${loaded ? "is-active" : ""}`}>
              <div className="inline-flex items-center gap-2 font-mono text-xs font-semibold tracking-widest text-[#ED500A] uppercase px-4 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
                <span className="w-2 h-2 rounded-full bg-[#ED500A] animate-pulse" />
                <span>Especial para Gastronomía</span>
              </div>

              <h1 className="font-title font-black text-4xl sm:text-5xl lg:text-6xl text-[#0B0E14] leading-[1.08] tracking-tight">
                Gestión para negocios gastronómicos que quieren tener{" "}
                <span className="text-[#ED500A] italic">todo bajo control.</span>
              </h1>

              <p className="font-body text-base sm:text-lg text-slate-600 leading-relaxed max-w-[50ch]">
                Organiza tus ventas, productos, inventario y caja desde un solo lugar. NEGOVA está pensado para negocios gastronómicos pequeños que necesitan trabajar de forma más organizada sin complicarse.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
                <Link
                  href="/#precios"
                  className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-[#ED500A] hover:bg-[#F36320] text-white font-title font-bold text-base shadow-xl shadow-[#ED500A]/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer group"
                >
                  <span>Probar NEGOVA</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>

                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-full bg-[#25D366] hover:bg-[#20ba5a] text-white font-title font-bold text-base shadow-lg shadow-[#25D366]/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer"
                >
                  <img src="/icons8-whatsapp.svg" alt="WhatsApp" className="w-5 h-5 shrink-0" />
                  <span>Hablar con nosotros</span>
                </a>
              </div>

              {/* Tiras de Garantía */}
              <div className="pt-2 flex items-center gap-6 text-xs font-semibold text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="text-[#ED500A]">✓</span>
                  <span>30 días gratis</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#ED500A]">✓</span>
                  <span>Acceso 100% Web</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#ED500A]">✓</span>
                  <span>Soporte cercano</span>
                </div>
              </div>
            </div>

            {/* Columna Derecha: Composición de producto real de NEGOVA (Animación de carga CSS + Flotado Perpetuo) */}
            <div className={`lg:col-span-6 relative hero-onload-right ${loaded ? "is-active" : ""}`}>
              <div className="absolute inset-0 bg-gradient-to-tr from-[#ED500A]/15 to-transparent rounded-3xl blur-2xl -z-10 animate-pulse" />
              
              {/* Card visual del producto con flotación perpetua */}
              <div className="relative rounded-3xl bg-white p-3 sm:p-4 border border-slate-200/90 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.1)] hover:shadow-[0_30px_75px_-15px_rgba(0,0,0,0.16)] transition-all duration-500 animate-float-perpetual">
                <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden border border-slate-100 bg-slate-50">
                  <Image
                    src="/images/negocios-gastronomia-v3.jpg"
                    alt="Sistema de gestión NEGOVA en un restaurante local"
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
                {/* Etiqueta flotante explicativa */}
                <div className="absolute -bottom-4 -right-4 bg-[#0B0E14] text-white py-3 px-4.5 rounded-2xl shadow-xl border border-white/10 flex items-center gap-2.5">
                  <span className="text-sm">🍔</span>
                  <div className="text-left">
                    <p className="font-mono text-[9px] font-bold text-[#ED500A] uppercase tracking-wider">EJEMPLO REAL</p>
                    <p className="font-title font-bold text-xs">Venta y control de stock unificados</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 2. SECCIÓN: DISEÑADO PARA NEGOCIOS COMO EL TUYO (SCROLL REVEAL BIDIRECCIONAL CSS) ── */}
      <section className="py-20 sm:py-28 bg-[#F8F9FD] border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12">
          
          <Reveal variant="up" className="text-center max-w-3xl mx-auto mb-16">
            <span className="font-mono text-xs font-semibold tracking-wider text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
              ADAPTABILIDAD
            </span>
            <h2 className="font-title font-extrabold text-3xl sm:text-4xl lg:text-5xl text-[#0B0E14] mt-4 mb-4 tracking-tight">
              Diseñado para negocios como el tuyo
            </h2>
            <p className="font-body text-base sm:text-lg text-slate-600 max-w-[65ch] mx-auto">
              Cada negocio gastronómico trabaja de una manera diferente. NEGOVA busca adaptarse a esa realidad.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-auto">
            {BUSINESS_TYPES.map((type, i) => (
              <Reveal 
                key={i}
                variant="up"
                delay={i * 50}
                className={`relative rounded-3xl overflow-hidden group border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between min-h-[340px] md:min-h-[300px] lg:min-h-[340px] ${type.span}`}
              >
                {/* Fondo de Imagen con Zoom en Hover */}
                <div className="absolute inset-0 z-0">
                  <Image 
                    src={type.image!} 
                    fill 
                    className="object-cover group-hover:scale-105 transition-transform duration-700" 
                    alt={type.title}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                  {/* Gradiente oscuro para contraste de texto */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/10 z-10" />
                </div>

                {/* Contenido en tema oscuro encima de la imagen */}
                <div className="relative z-20 h-full p-8 flex flex-col justify-between flex-1">
                  <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-xl shadow-xs">
                    {type.icon}
                  </div>
                  
                  <div className="mt-8 space-y-3">
                    <h3 className="font-title font-extrabold text-xl text-white">
                      {type.title}
                    </h3>
                    <p className="font-body text-slate-200 text-xs sm:text-sm leading-relaxed max-w-[42ch]">
                      {type.description}
                    </p>
                    <div className="pt-3 border-t border-white/25 flex items-center justify-between text-[11px] font-semibold text-slate-300">
                      <span>{type.details}</span>
                      <span className="text-[#ED500A]">✓</span>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

        </div>
      </section>

      {/* ── 3. SECCIÓN: PROBLEMAS REALES (SCROLL REVEAL BIDIRECCIONAL CSS) ── */}
      <section className="py-20 sm:py-28 bg-white border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12">
          
          <Reveal variant="up" className="text-center max-w-3xl mx-auto mb-16">
            <span className="font-mono text-xs font-semibold tracking-wider text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
              RETOS COTIDIANOS
            </span>
            <h2 className="font-title font-extrabold text-3xl sm:text-4xl lg:text-5xl text-[#0B0E14] mt-4 mb-4 tracking-tight">
              Cuando el negocio crece, llevarlo todo en la cabeza ya no alcanza.
            </h2>
            <p className="font-body text-base sm:text-lg text-slate-600">
              Revisa si te identificas con alguna de estas situaciones comunes del día a día:
            </p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {REAL_PROBLEMS.map((prob, idx) => (
              <Reveal 
                key={idx}
                variant="up"
                delay={idx * 50}
                className="p-6 rounded-2xl bg-[#F8F9FD] border border-slate-200/80 hover:bg-white hover:border-[#ED500A]/25 transition-all duration-300 space-y-3"
              >
                <div className="w-8 h-8 rounded-lg bg-orange-100 text-[#ED500A] flex items-center justify-center font-bold text-sm">
                  {idx + 1}
                </div>
                <h4 className="font-title font-extrabold text-base text-[#0B0E14]">
                  {prob.title}
                </h4>
                <p className="font-body text-slate-500 text-xs sm:text-sm leading-relaxed">
                  {prob.desc}
                </p>
              </Reveal>
            ))}
          </div>

        </div>
      </section>

      {/* ── 4. SECCIÓN: FUNCIONALIDADES (SCROLL REVEAL BIDIRECCIONAL CSS) ── */}
      <section className="py-20 sm:py-28 bg-[#F8F9FD] border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            
            {/* Cabecera / Explicación Izquierda (Desliza desde la izquierda) */}
            <Reveal variant="left" className="lg:col-span-4 space-y-6 lg:sticky lg:top-36">
              <span className="font-mono text-xs font-semibold tracking-wider text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
                HERRAMIENTAS REALES
              </span>
              <h2 className="font-title font-black text-3xl sm:text-4xl text-[#0B0E14] leading-tight">
                Todo lo esencial para organizar tu operación
              </h2>
              <p className="font-body text-slate-600 text-sm sm:text-base leading-relaxed">
                Sin módulos ficticios ni herramientas de grandes corporaciones que nunca vas a usar. NEGOVA te ofrece exactamente lo que un pequeño negocio gastronómico necesita para estar en orden.
              </p>
              <div className="pt-2">
                <Link
                  href="/#precios"
                  className="inline-flex items-center gap-2 font-title font-bold text-sm text-[#ED500A] hover:text-[#F36320] transition-colors group cursor-pointer"
                >
                  <span>Ver planes disponibles</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </Reveal>

            {/* Listado Editorial Asimétrico Derecha (Revelado escalonado) */}
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {CONFIRMED_FEATURES.map((feat, idx) => (
                <Reveal 
                  key={idx}
                  variant="up"
                  delay={idx * 60}
                  className={`p-6 rounded-2xl border transition-all duration-300 ${
                    idx % 3 === 0 
                      ? "bg-[#0B0E14] text-white border-transparent shadow-lg" 
                      : "bg-white text-[#0B0E14] border-slate-200/80 shadow-xs hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3.5 mb-3">
                    <span className="text-2xl">{feat.icon}</span>
                    <h3 className={`font-title font-extrabold text-lg ${idx % 3 === 0 ? "text-white" : "text-[#0B0E14]"}`}>
                      {feat.title}
                    </h3>
                  </div>
                  <p className={`font-body text-xs sm:text-sm leading-relaxed ${idx % 3 === 0 ? "text-slate-300" : "text-slate-500"}`}>
                    {feat.desc}
                  </p>
                </Reveal>
              ))}
            </div>

          </div>

        </div>
      </section>



      {/* ── 6. SECCIÓN: EJEMPLO REAL (COTIDIANO) (SCROLL REVEAL BIDIRECCIONAL CSS) ── */}
      <section className="py-20 sm:py-28 bg-[#F8F9FD] border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* Foto de Entorno Gastronómico Real (Desliza desde la izquierda) */}
            <Reveal variant="left" className="lg:col-span-5 relative">
              <div className="absolute inset-0 bg-[#ED500A]/10 rounded-3xl blur-xl -z-10" />
              <div className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-md">
                <Image
                  src="/images/negocios-gastronomia-lifestyle.png"
                  alt="Operación diaria en una cafetería NEGOVA"
                  width={600}
                  height={450}
                  className="object-cover"
                />
              </div>
            </Reveal>

            {/* Explicación de la Situación Cotidiana (Desliza desde la derecha) */}
            <Reveal variant="right" className="lg:col-span-7 space-y-8 text-left">
              <div>
                <span className="font-mono text-xs font-semibold tracking-wider text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
                  SITUACIÓN DIARIA
                </span>
                <h2 className="font-title font-extrabold text-3xl sm:text-4xl text-[#0B0E14] mt-4 mb-2 tracking-tight">
                  Imagina un día normal en tu negocio
                </h2>
                <p className="font-body text-slate-600 text-sm sm:text-base">
                  Mira cómo fluye la operación habitual de tu local comercial sin esfuerzo:
                </p>
              </div>

              {/* Línea de tiempo vertical */}
              <div className="relative border-l border-slate-200 pl-6 space-y-6">
                
                {/* Paso 1 */}
                <Reveal variant="up" delay={50} className="relative">
                  <div className="absolute -left-[31px] top-0.5 w-4.5 h-4.5 rounded-full bg-[#ED500A] border-4 border-[#F8F9FD]" />
                  <h4 className="font-title font-bold text-sm text-[#0B0E14]">Un cliente realiza una compra</h4>
                  <p className="font-body text-xs sm:text-sm text-slate-500 mt-1">El comensal pide en el mostrador o caja del local comercial.</p>
                </Reveal>

                {/* Paso 2 */}
                <Reveal variant="up" delay={100} className="relative">
                  <div className="absolute -left-[31px] top-0.5 w-4.5 h-4.5 rounded-full bg-[#ED500A] border-4 border-[#F8F9FD]" />
                  <h4 className="font-title font-bold text-sm text-[#0B0E14]">La venta queda registrada</h4>
                  <p className="font-body text-xs sm:text-sm text-slate-500 mt-1">Ingresas los artículos en el punto de venta POS táctil de NEGOVA.</p>
                </Reveal>

                {/* Paso 3 */}
                <Reveal variant="up" delay={150} className="relative">
                  <div className="absolute -left-[31px] top-0.5 w-4.5 h-4.5 rounded-full bg-[#ED500A] border-4 border-[#F8F9FD]" />
                  <h4 className="font-title font-bold text-sm text-[#0B0E14]">El inventario se actualiza automáticamente</h4>
                  <p className="font-body text-xs sm:text-sm text-slate-500 mt-1">Las unidades de tus insumos o bebidas se descuentan de forma inmediata.</p>
                </Reveal>

                {/* Paso 4 */}
                <Reveal variant="up" delay={200} className="relative">
                  <div className="absolute -left-[31px] top-0.5 w-4.5 h-4.5 rounded-full bg-[#ED500A] border-4 border-[#F8F9FD]" />
                  <h4 className="font-title font-bold text-sm text-[#0B0E14]">El movimiento queda reflejado en la caja</h4>
                  <p className="font-body text-xs sm:text-sm text-slate-500 mt-1">El total pagado se suma al saldo esperado en tu caja física del día.</p>
                </Reveal>

                {/* Paso 5 */}
                <Reveal variant="up" delay={250} className="relative">
                  <div className="absolute -left-[31px] top-0.5 w-4.5 h-4.5 rounded-full bg-[#ED500A] border-4 border-[#F8F9FD]" />
                  <h4 className="font-title font-bold text-sm text-[#0B0E14]">Información disponible en la nube</h4>
                  <p className="font-body text-xs sm:text-sm text-slate-500 mt-1">Los reportes financieros de ganancias quedan listos para consultar posteriormente.</p>
                </Reveal>

              </div>
            </Reveal>

          </div>

        </div>
      </section>

      {/* ── 7. SECCIÓN: BENEFICIO PRINCIPAL (SCROLL REVEAL BIDIRECCIONAL CSS) ── */}
      <section className="py-20 sm:py-32 bg-white border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12 text-center max-w-4xl">
          
          <Reveal variant="up">
            <span className="font-mono text-xs font-semibold tracking-wider text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
              EL PROPÓSITO
            </span>
            <h2 className="font-title font-black text-4xl sm:text-5xl lg:text-6xl text-[#0B0E14] mt-6 mb-6 tracking-tight leading-none">
              Menos tiempo anotando. <br className="hidden sm:inline" />
              <span className="text-[#ED500A] italic">Más tiempo atendiendo.</span>
            </h2>
            
            <p className="font-body text-base sm:text-xl text-slate-600 leading-relaxed max-w-[50ch] mx-auto mb-12">
              NEGOVA busca quitarle complejidad a la gestión diaria para que puedas dedicar más tiempo a tus clientes y a tu negocio.
            </p>
          </Reveal>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Atención al cliente", icon: "🤝" },
              { label: "Ventas rápidas", icon: "⚡" },
              { label: "Organización", icon: "📁" },
              { label: "Ahorro de Tiempo", icon: "⏰" },
              { label: "Control de Caja", icon: "🔑" }
            ].map((ben, i) => (
              <Reveal 
                key={i} 
                variant="fade"
                delay={i * 60}
                className="p-5 rounded-2xl bg-[#F8F9FD] border border-slate-200/70 flex flex-col items-center gap-2"
              >
                <span className="text-3xl">{ben.icon}</span>
                <span className="font-title font-bold text-xs sm:text-sm text-[#0B0E14]">{ben.label}</span>
              </Reveal>
            ))}
          </div>

        </div>
      </section>


      {/* ── 9. SECCIÓN DE CONVERSIÓN: PRUEBA GRATUITA (SCROLL REVEAL BIDIRECCIONAL CSS) ── */}
      <section className="py-20 sm:py-28 bg-[#F8F9FD] border-b border-slate-200 text-center">
        <Reveal variant="up" className="max-w-4xl mx-auto px-6 sm:px-8">
          
          <span className="font-mono text-xs font-semibold tracking-wider text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
            PRUEBA EL SISTEMA
          </span>
          
          <h2 className="font-title font-extrabold text-3xl sm:text-4xl lg:text-5xl text-[#0B0E14] mt-6 mb-4 tracking-tight">
            Conoce NEGOVA durante 30 días.
          </h2>

          <p className="font-body text-slate-600 text-sm sm:text-base max-w-[55ch] mx-auto mb-4 leading-relaxed">
            Prueba el plan Inicio durante 30 días y descubre cómo puede ayudarte a organizar tu negocio.
          </p>

          <p className="font-body text-xs text-slate-500 max-w-[48ch] mx-auto mb-8 italic">
            La prueba gratuita es limitada y durante la etapa inicial es gestionada directamente por el equipo de NEGOVA para darte el mejor acompañamiento.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-[#ED500A] hover:bg-[#F36320] text-white font-title font-bold text-base shadow-xl shadow-[#ED500A]/25 transition-all duration-300 cursor-pointer"
            >
              <span>Solicitar prueba gratuita</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-full bg-white hover:bg-slate-50 text-[#0B0E14] font-title font-bold text-base shadow-sm border border-slate-200 transition-all duration-300 cursor-pointer"
            >
              <img src="/icons8-whatsapp.svg" alt="WhatsApp" className="w-5 h-5 shrink-0" />
              <span>Hablar con NEGOVA</span>
            </a>
          </div>

        </Reveal>
      </section>

      {/* ── 10. PREGUNTAS FRECUENTES (FAQ) DE INICIO ── */}
      <FaqLandingSection />

      {/* ── 11. PLANES DE PRECIOS GENERALES DE NEGOVA ── */}
      <PricingSection />

      {/* ── 12. PILARES DE CONFIANZA ── */}
      <TrustSection />

      {/* ── 13. CTA FINAL DE CONVERSIÓN (SCROLL REVEAL BIDIRECCIONAL CSS) ── */}
      <section className="relative py-24 sm:py-32 bg-[#0B0E14] text-white overflow-hidden text-center">
        {/* Luz de fondo */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-gradient-to-br from-[#ED500A]/20 via-[#F36320]/10 to-transparent rounded-full blur-3xl" />
        </div>

        <Reveal variant="up" className="relative max-w-4xl mx-auto px-6 sm:px-8 space-y-6">
          <h2 className="font-title font-black text-4xl sm:text-6xl text-white leading-none tracking-tight">
            Organiza tu negocio. <br className="hidden sm:inline" />
            Empieza con NEGOVA.
          </h2>
          
          <p className="font-body text-base sm:text-xl text-slate-300 max-w-[50ch] mx-auto leading-relaxed">
            Una forma más sencilla de tener tus ventas, inventario, caja y operación bajo control.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/#precios"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-[#ED500A] hover:bg-[#F36320] text-white font-title font-bold text-base shadow-xl shadow-[#ED500A]/25 transition-all duration-300 cursor-pointer"
            >
              <span>Probar NEGOVA</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-full bg-[#25D366] hover:bg-[#20ba5a] text-white font-title font-bold text-base shadow-lg shadow-[#25D366]/20 transition-all duration-300 cursor-pointer"
            >
              <img src="/icons8-whatsapp.svg" alt="WhatsApp" className="w-5 h-5 shrink-0" />
              <span>Hablar con nosotros</span>
            </a>
          </div>
        </Reveal>
      </section>

      {/* Asistentes Flotantes */}
      <FloatingWrapper />

      <Footer />
    </div>
  );
}
