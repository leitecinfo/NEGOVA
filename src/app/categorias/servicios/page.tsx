"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { FloatingWrapper } from "@/components/floating/floating-wrapper";
import { PricingSection } from "@/components/landing/pricing-section";
import { FaqLandingSection } from "@/components/landing/faq-landing-section";
import { 
  ArrowRight,
  Sparkles,
  Users,
  Compass,
  ArrowUpRight
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

// Categorías de servicios (Bento Grid con placeholders de imágenes anteriores)
const SERVICE_TYPES = [
  {
    title: "Barberías",
    description: "Para negocios que necesitan organizar clientes, servicios, ventas y caja.",
    details: "Controla servicios, ventas y caja de cada jornada.",
    icon: "💈",
    image: "/images/servicios-tipo-barberia.jpg",
    span: "lg:col-span-2 lg:row-span-1"
  },
  {
    title: "Peluquerías y salones de belleza",
    description: "Para negocios que ofrecen diferentes servicios y necesitan mantener organizada su operación.",
    details: "Organiza servicios, clientes, ventas y movimientos de caja.",
    icon: "✂️",
    image: "/images/servicios-tipo-salon.jpg",
    span: "lg:col-span-1 lg:row-span-1"
  },
  {
    title: "Gimnasios",
    description: "Para pequeños gimnasios que necesitan controlar clientes, pagos and servicios.",
    details: "Mantén organizados clientes, pagos y operación del negocio.",
    icon: "🏋️",
    image: "/images/servicios-tipo-gimnasio.jpg",
    span: "lg:col-span-1 lg:row-span-1"
  },
  {
    title: "Academias",
    description: "Para academias y pequeños centros de formación.",
    details: "Organiza clientes, servicios, pagos y registros del negocio.",
    icon: "🎓",
    image: "/images/servicios-tipo-academia.jpg",
    span: "lg:col-span-2 lg:row-span-1"
  },
  {
    title: "Talleres mecánicos",
    description: "Para talleres que necesitan organizar servicios, clientes y movimientos de dinero.",
    details: "Registra servicios, clientes, ventas y gastos del taller.",
    icon: "🔧",
    image: "/images/servicios-tipo-taller.jpg",
    span: "lg:col-span-2 lg:row-span-1"
  },
  {
    title: "Servicios técnicos",
    description: "Para negocios dedicados a reparación, mantenimiento o soporte técnico.",
    details: "Organiza servicios realizados, clientes y movimientos de caja.",
    icon: "🛠️",
    image: "/images/servicios-tipo-tecnico.jpg",
    span: "lg:col-span-1 lg:row-span-1"
  },
  {
    title: "Lavanderías",
    description: "Para pequeños negocios que reciben y entregan prendas o productos.",
    details: "Organiza servicios, ventas y control de la operación diaria.",
    icon: "🧺",
    image: "/images/comercio-tipo-mascotas.jpg",
    span: "lg:col-span-1 lg:row-span-1"
  },
  {
    title: "Spas y estéticas",
    description: "Para negocios que ofrecen múltiples servicios a sus clientes.",
    details: "Gestiona servicios, clientes, ventas y caja desde un solo lugar.",
    icon: "💆",
    image: "/images/servicios-tipo-spa.jpg",
    span: "lg:col-span-2 lg:row-span-1"
  }
];

// Funcionalidades reales de NEGOVA para Servicios
const SERVICE_FEATURES = [
  {
    title: "Registro de ventas",
    desc: "Registra los cobros de tus servicios de forma ágil y sin complicaciones.",
    icon: "🛒"
  },
  {
    title: "Control de caja",
    desc: "Registra entradas y salidas de efectivo para cuadrar la caja al final del día.",
    icon: "💵"
  },
  {
    title: "Gestión de clientes",
    desc: "Guarda la información de contacto de tus clientes y el historial de sus visitas.",
    icon: "👥"
  },
  {
    title: "Gestión de servicios",
    desc: "Define tu catálogo de servicios con sus respectivos precios y tiempos estimados.",
    icon: "📝"
  },
  {
    title: "Gestión de productos",
    desc: "Registra productos complementarios que vendas en tu negocio (shampoo, repuestos).",
    icon: "🧴"
  },
  {
    title: "Inventario",
    desc: "Controla las existencias de los productos de reventa y recibe alertas de bajo stock.",
    icon: "📦"
  },
  {
    title: "Reportes",
    desc: "Consulta balances del día y estadísticas útiles para saber qué servicios rinden más.",
    icon: "📊"
  },
  {
    title: "Control de gastos",
    desc: "Registra egresos por pago a colaboradores, insumos o servicios públicos.",
    icon: "📉"
  }
];

export default function ServiciosPage() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
  }, []);

  const whatsappUrl = `https://wa.me/573114245409?text=${encodeURIComponent(
    "Hola NEGOVA, tengo un negocio de servicios y me gustaría solicitar la prueba gratuita de 30 días."
  )}`;

  return (
    <div className="min-h-screen bg-[#F8F9FD] text-[#0B0E14] selection:bg-[#ED500A]/20 selection:text-[#ED500A]">
      <Navbar />

      {/* ── 1. HERO ESPECÍFICO DE SERVICIOS (DISEÑO EDITORIAL SPLIT PREMIUM) ── */}
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
                <span>Especial para Servicios</span>
              </div>

              <h1 className="font-title font-black text-4xl sm:text-5xl lg:text-6xl text-[#0B0E14] leading-[1.08] tracking-tight">
                Sistema de gestión para{" "}
                <span className="text-[#ED500A] italic">negocios de servicios.</span>
              </h1>

              <p className="font-body text-base sm:text-lg text-slate-600 leading-relaxed max-w-[50ch]">
                Organiza clientes, servicios, ventas y caja desde un solo lugar. NEGOVA está diseñado para barberías, salones, centros y pequeños talleres que buscan controlar su operación diaria fácilmente.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
                <Link
                  href="/#precios"
                  className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-[#ED500A] hover:bg-[#F36320] text-white font-title font-bold text-base shadow-xl shadow-[#ED500A]/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer group"
                >
                  <span>Prueba NEGOVA gratis</span>
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
                  <span>Catálogo de servicios</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#ED500A]">✓</span>
                  <span>Soporte cercano</span>
                </div>
              </div>
            </div>

            {/* Columna Derecha: Imagen de producto de servicios (Animación de carga CSS + Flotado Perpetuo) */}
            <div className={`lg:col-span-6 relative hero-onload-right ${loaded ? "is-active" : ""}`}>
              <div className="absolute inset-0 bg-gradient-to-tr from-[#ED500A]/15 to-transparent rounded-3xl blur-2xl -z-10 animate-pulse" />
              
              <div className="relative rounded-3xl bg-white p-3 sm:p-4 border border-slate-200/90 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.1)] hover:shadow-[0_30px_75px_-15px_rgba(0,0,0,0.16)] transition-all duration-500 animate-float-perpetual">
                <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden border border-slate-100 bg-slate-50">
                  <Image
                    src="/images/negocios-servicios-v3.jpg"
                    alt="Sistema de gestión NEGOVA en un salón de belleza local"
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
                {/* Etiqueta flotante */}
                <div className="absolute -bottom-4 -right-4 bg-[#0B0E14] text-white py-3 px-4.5 rounded-2xl shadow-xl border border-white/10 flex items-center gap-2.5">
                  <span className="text-sm">💇‍♀️</span>
                  <div className="text-left">
                    <p className="font-mono text-[9px] font-bold text-[#ED500A] uppercase tracking-wider">EJEMPLO REAL</p>
                    <p className="font-title font-bold text-xs">Ventas, caja y clientes en vivo</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 2. SECCIÓN: TIPOS DE NEGOCIO (BENTO GRID CON IMÁGENES REALES) ── */}
      <section className="py-20 sm:py-28 bg-[#F8F9FD] border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12">
          
          <Reveal variant="up" className="text-center max-w-3xl mx-auto mb-16">
            <span className="font-mono text-xs font-semibold tracking-wider text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
              ADAPTABILIDAD
            </span>
            <h2 className="font-title font-extrabold text-3xl sm:text-4xl lg:text-5xl text-[#0B0E14] mt-4 mb-4 tracking-tight">
              Diseñado para diferentes tipos de negocios de servicios
            </h2>
            <p className="font-body text-base sm:text-lg text-slate-600 max-w-[65ch] mx-auto">
              Desde una peluquería de barrio hasta un taller mecánico, NEGOVA se adapta al flujo de trabajo real de tu establecimiento.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-auto">
            {SERVICE_TYPES.map((type, i) => (
              <Reveal 
                key={i}
                variant="up"
                delay={i * 50}
                className={`relative rounded-3xl overflow-hidden group border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between min-h-[340px] md:min-h-[300px] lg:min-h-[340px] ${type.span}`}
              >
                {/* Fondo de Imagen con Zoom en Hover */}
                <div className="absolute inset-0 z-0">
                  <Image 
                    src={type.image} 
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

      {/* ── 3. SECCIÓN: FUNCIONALIDADES (SCROLL REVEAL BIDIRECCIONAL CSS) ── */}
      <section className="py-20 sm:py-28 bg-white border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            
            {/* Cabecera Explicación Izquierda */}
            <Reveal variant="left" className="lg:col-span-4 space-y-6 lg:sticky lg:top-36">
              <span className="font-mono text-xs font-semibold tracking-wider text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
                CAPACIDADES CLAVE
              </span>
              <h2 className="font-title font-black text-3xl sm:text-4xl text-[#0B0E14] leading-tight">
                Herramientas para organizar tu negocio de servicios
              </h2>
              <p className="font-body text-slate-600 text-sm sm:text-base leading-relaxed">
                NEGOVA recopila lo indispensable que tu salón, gimnasio o taller técnico necesita. Controla tus finanzas y la atención al cliente sin sistemas de contabilidad complejos.
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

            {/* Listado Editorial Asimétrico Derecha */}
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {SERVICE_FEATURES.map((feat, idx) => (
                <Reveal 
                  key={idx}
                  variant="up"
                  delay={idx * 50}
                  className={`p-6 rounded-2xl border transition-all duration-300 ${
                    idx % 3 === 0 
                      ? "bg-[#0B0E14] text-white border-transparent shadow-lg" 
                      : "bg-[#F8F9FD] text-[#0B0E14] border-slate-200/80 shadow-xs hover:border-slate-300"
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

      {/* ── 4. SECCIÓN: EJEMPLO REAL (COTIDIANO) (SCROLL REVEAL BIDIRECCIONAL CSS) ── */}
      <section className="py-20 sm:py-28 bg-[#F8F9FD] border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* Foto de Entorno Real de Servicios */}
            <Reveal variant="left" className="lg:col-span-5 relative">
              <div className="absolute inset-0 bg-[#ED500A]/10 rounded-3xl blur-xl -z-10" />
              <div className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-md">
                <Image
                  src="/images/negocios-servicios-lifestyle.png"
                  alt="Atención real en un negocio de servicios con NEGOVA"
                  width={600}
                  height={450}
                  className="object-cover"
                />
              </div>
            </Reveal>

            {/* Explicación del Timeline de Servicio */}
            <Reveal variant="right" className="lg:col-span-7 space-y-8 text-left">
              <div>
                <span className="font-mono text-xs font-semibold tracking-wider text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
                  FLUJO COTIDIANO
                </span>
                <h2 className="font-title font-extrabold text-3xl sm:text-4xl text-[#0B0E14] mt-4 mb-2 tracking-tight">
                  Así fluye la jornada en tu negocio de servicios
                </h2>
                <p className="font-body text-slate-600 text-sm sm:text-base">
                  Visualiza cómo la atención al cliente se conecta automáticamente con tus finanzas del día:
                </p>
              </div>

              {/* Línea de tiempo vertical */}
              <div className="relative border-l border-slate-200 pl-6 space-y-6">
                
                {/* Paso 1 */}
                <Reveal variant="up" delay={50} className="relative">
                  <div className="absolute -left-[31px] top-0.5 w-4.5 h-4.5 rounded-full bg-[#ED500A] border-4 border-[#F8F9FD]" />
                  <h4 className="font-title font-bold text-sm text-[#0B0E14]">Un cliente agenda o llega a tu negocio</h4>
                  <p className="font-body text-xs sm:text-sm text-slate-500 mt-1">Ingresa para realizarse un corte, mantenimiento, reparación o clase.</p>
                </Reveal>

                {/* Paso 2 */}
                <Reveal variant="up" delay={100} className="relative">
                  <div className="absolute -left-[31px] top-0.5 w-4.5 h-4.5 rounded-full bg-[#ED500A] border-4 border-[#F8F9FD]" />
                  <h4 className="font-title font-bold text-sm text-[#0B0E14]">Se brinda el servicio correspondiente</h4>
                  <p className="font-body text-xs sm:text-sm text-slate-500 mt-1">El estilista, mecánico, entrenador o técnico realiza el trabajo.</p>
                </Reveal>

                {/* Paso 3 */}
                <Reveal variant="up" delay={150} className="relative">
                  <div className="absolute -left-[31px] top-0.5 w-4.5 h-4.5 rounded-full bg-[#ED500A] border-4 border-[#F8F9FD]" />
                  <h4 className="font-title font-bold text-sm text-[#0B0E14]">Se registra el cobro de la venta</h4>
                  <p className="font-body text-xs sm:text-sm text-slate-500 mt-1">Digitas el cobro en el POS seleccionando el servicio brindado del catálogo.</p>
                </Reveal>

                {/* Paso 4 */}
                <Reveal variant="up" delay={200} className="relative">
                  <div className="absolute -left-[31px] top-0.5 w-4.5 h-4.5 rounded-full bg-[#ED500A] border-4 border-[#F8F9FD]" />
                  <h4 className="font-title font-bold text-sm text-[#0B0E14]">El dinero queda registrado en caja</h4>
                  <p className="font-body text-xs sm:text-sm text-slate-500 mt-1">La venta entra al arqueo y suma al balance diario en efectivo o transferencias.</p>
                </Reveal>

                {/* Paso 5 */}
                <Reveal variant="up" delay={250} className="relative">
                  <div className="absolute -left-[31px] top-0.5 w-4.5 h-4.5 rounded-full bg-[#ED500A] border-4 border-[#F8F9FD]" />
                  <h4 className="font-title font-bold text-sm text-[#0B0E14]">La información queda disponible para consultar</h4>
                  <p className="font-body text-xs sm:text-sm text-slate-500 mt-1">Visualizas qué colaborador rindió más y cuáles son los ingresos netos.</p>
                </Reveal>

              </div>
            </Reveal>

          </div>

        </div>
      </section>

      {/* ── 5. BLOQUE DE VALOR: "Menos tiempo organizando..." (SCROLL REVEAL BIDIRECCIONAL CSS) ── */}
      <section className="py-20 sm:py-32 bg-white border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12 text-center max-w-4xl">
          
          <Reveal variant="up">
            <span className="font-mono text-xs font-semibold tracking-wider text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
              MÁS ENFOQUE
            </span>
            <h2 className="font-title font-black text-4xl sm:text-5xl lg:text-6xl text-[#0B0E14] mt-6 mb-6 tracking-tight leading-none">
              Menos tiempo organizando. <br className="hidden sm:inline" />
              <span className="text-[#ED500A] italic">Más tiempo atendiendo.</span>
            </h2>
            
            <p className="font-body text-base sm:text-xl text-slate-600 leading-relaxed max-w-[50ch] mx-auto mb-12">
              NEGOVA ayuda a centralizar la información de tu negocio para que puedas dedicar menos tiempo a registros manuales y tener mayor control de tu operación.
            </p>
          </Reveal>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Ventas de servicios", icon: "💇‍♂️" },
              { label: "Caja cuadradada", icon: "🔑" },
              { label: "Clientes registrados", icon: "👥" },
              { label: "Control de insumos", icon: "🧴" }
            ].map((ben, i) => (
              <Reveal 
                key={i} 
                variant="fade"
                delay={i * 60}
                className="p-5 rounded-2xl bg-[#F8F9FD] border border-slate-200/70 flex flex-col items-center gap-2 shadow-xs"
              >
                <span className="text-3xl">{ben.icon}</span>
                <span className="font-title font-bold text-xs sm:text-sm text-[#0B0E14]">{ben.label}</span>
              </Reveal>
            ))}
          </div>

        </div>
      </section>

      {/* ── 6. SECCIÓN DE CONVERSIÓN: PRUEBA GRATUITA (SCROLL REVEAL BIDIRECCIONAL CSS) ── */}
      <section className="py-20 sm:py-28 bg-[#F8F9FD] border-b border-slate-200 text-center">
        <Reveal variant="up" className="max-w-4xl mx-auto px-6 sm:px-8">
          
          <span className="font-mono text-xs font-semibold tracking-wider text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
            PRUEBA EL PLAN INICIO
          </span>
          
          <h2 className="font-title font-extrabold text-3xl sm:text-4xl lg:text-5xl text-[#0B0E14] mt-6 mb-4 tracking-tight">
            Conoce NEGOVA durante 30 días.
          </h2>

          <p className="font-body text-slate-600 text-sm sm:text-base max-w-[55ch] mx-auto mb-4 leading-relaxed">
            Prueba el plan Inicio de forma gratuita durante 30 días y descubre una forma más sencilla de llevar el control diario.
          </p>

          <p className="font-body text-xs text-slate-500 max-w-[48ch] mx-auto mb-8 italic">
            La prueba gratuita es limitada y durante la etapa inicial es gestionada directamente por el equipo de NEGOVA para darte la asesoría adecuada.
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

      {/* Preguntas Frecuentes específicas de Inicio */}
      <FaqLandingSection />

      {/* Planes de Precios de NEGOVA */}
      <PricingSection />

      {/* ── 7. CTA FINAL DE CONVERSIÓN (SCROLL REVEAL BIDIRECCIONAL CSS) ── */}
      <section className="relative py-24 sm:py-32 bg-[#0B0E14] text-white overflow-hidden text-center">
        {/* Luz de fondo */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-gradient-to-br from-[#ED500A]/20 via-[#F36320]/10 to-transparent rounded-full blur-3xl" />
        </div>

        <Reveal variant="up" className="relative max-w-4xl mx-auto px-6 sm:px-8 space-y-6">
          <h2 className="font-title font-black text-4xl sm:text-6xl text-white leading-none tracking-tight">
            Empieza a organizar tu <br className="hidden sm:inline" />
            negocio con NEGOVA.
          </h2>
          
          <p className="font-body text-base sm:text-xl text-slate-300 max-w-[50ch] mx-auto leading-relaxed">
            Prueba NEGOVA durante 30 días y descubre una forma más sencilla de controlar tu operación.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
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
