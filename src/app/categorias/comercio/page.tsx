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

// Categorías de comercios minoristas (Diseño Bento Grid)
const COMMERCE_TYPES = [
  {
    title: "Tiendas de barrio",
    description: "Controla ventas, productos, inventario y caja de tu negocio diario.",
    details: "Control de arqueo, ventas en mostrador y registro de fiados.",
    icon: "🏪",
    image: "/images/comercio-tipo-tienda.jpg",
    span: "lg:col-span-2 lg:row-span-1"
  },
  {
    title: "Minimercados",
    description: "Organiza productos de alta rotación y conoce qué necesitas reponer.",
    details: "Alertas automáticas de bajo stock and control de caja física.",
    icon: "🛒",
    image: "/images/comercio-tipo-minimercado.jpg",
    span: "lg:col-span-1 lg:row-span-1"
  },
  {
    title: "Ferreterías",
    description: "Mantén organizados productos, categorías, existencias y ventas.",
    details: "Inventario clasificado, control de compras a proveedores y caja.",
    icon: "🔨",
    image: "/images/comercio-tipo-ferreteria.jpg",
    span: "lg:col-span-1 lg:row-span-1"
  },
  {
    title: "Papelerías",
    description: "Gestiona productos, ventas y diferentes categorías de artículos.",
    details: "Catálogo multiobjeto, ventas rápidas y control de egresos.",
    icon: "✏️",
    image: "/images/comercio-tipo-papeleria.jpg",
    span: "lg:col-span-2 lg:row-span-1"
  },
  {
    title: "Tiendas de ropa y calzado",
    description: "Organiza productos y sus variantes como tallas, colores y referencias.",
    details: "Control de stock por variantes, costos y precios diferenciados.",
    icon: "👕",
    image: "/images/comercio-tipo-ropa.jpg",
    span: "lg:col-span-2 lg:row-span-1"
  },
  {
    title: "Tecnología y celulares",
    description: "Controla productos, categorías, precios y movimientos de venta.",
    details: "Catálogo de accesorios, registro de ingresos y arqueos de caja.",
    icon: "📱",
    image: "/images/gastro-tipo-otros.jpg",
    span: "lg:col-span-1 lg:row-span-1"
  },
  {
    title: "Floristerías",
    description: "Organiza productos, ventas e inventario de tu negocio.",
    details: "Registro ágil en tablet o celular y arqueo de turnos.",
    icon: "💐",
    image: "/images/comercio-tipo-floristeria.jpg",
    span: "lg:col-span-1 lg:row-span-1"
  },
  {
    title: "Tiendas de mascotas y variedades",
    description: "Gestiona productos y operaciones desde un solo lugar de forma sencilla.",
    details: "Alertas de existencias y registro de abonos a cuentas.",
    icon: "🐶",
    image: "/images/comercio-tipo-mascotas.jpg",
    span: "lg:col-span-2 lg:row-span-1"
  }
];

// Problemas reales del comercio
const REAL_PROBLEMS = [
  {
    title: "Ventas anotadas en un cuaderno",
    desc: "Las deudas y ventas se pierden entre hojas sueltas, tachones o cuadernos que se pueden extraviar."
  },
  {
    title: "No siempre se sabe cuánto se vendió",
    desc: "No se tiene la certeza de cuánto dinero real ingresó al finalizar la jornada laboral."
  },
  {
    title: "Productos que se están agotando",
    desc: "Te das cuenta de que no hay stock a mitad de la venta, perdiendo clientes frente a la competencia."
  },
  {
    title: "Productos acumulados en inventario",
    desc: "Dinero quieto en artículos que no rotan por no tener reportes visuales de ventas."
  },
  {
    title: "Precios difíciles de organizar",
    desc: "Errores frecuentes al cobrar debido a cambios constantes en costos de proveedores."
  },
  {
    title: "Dinero de caja mezclado",
    desc: "El efectivo de ventas se utiliza para pagar egresos de casa o compras imprevistas."
  },
  {
    title: "Tiempo perdido buscando datos",
    desc: "Minutos buscando facturas o recordando cuánto dinero debe un cliente de confianza."
  },
  {
    title: "Desconocimiento del producto estrella",
    desc: "Dificultad para saber con exactitud qué artículos están generando la ganancia neta real."
  },
  {
    title: "Dependencia total de la memoria",
    desc: "Toda la administración recae en tu cabeza, generando cansancio mental y estrés."
  }
];

// Funcionalidades reales de NEGOVA
const COMMERCE_FEATURES = [
  {
    title: "Ventas",
    desc: "Registra las ventas de tu negocio de forma rápida y organizada.",
    icon: "🛒"
  },
  {
    title: "Inventario",
    desc: "Conoce qué productos tienes, cuáles tienen movimiento y cuáles necesitan reposición.",
    icon: "📦"
  },
  {
    title: "Productos",
    desc: "Organiza productos, categorías, precios y características.",
    icon: "🍎"
  },
  {
    title: "Variantes",
    desc: "Permite representar productos que pueden tener características diferentes (talla, color, presentación, referencia).",
    icon: "🏷️"
  },
  {
    title: "Caja",
    desc: "Registra ingresos, salidas y movimientos de dinero.",
    icon: "💵"
  },
  {
    title: "Gastos",
    desc: "Mantén un registro de los gastos del negocio (proveedores, servicios).",
    icon: "📉"
  },
  {
    title: "Clientes",
    desc: "Organiza la información de tus clientes y controla deudas (fiados) con abonos.",
    icon: "👥"
  },
  {
    title: "Reportes",
    desc: "Consulta información de la operación para entender mejor el comportamiento del negocio.",
    icon: "📈"
  }
];

export default function ComercioPage() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Activa la animación de recarga/onload en el Hero
    setLoaded(true);
  }, []);

  const whatsappUrl = `https://wa.me/573114245409?text=${encodeURIComponent(
    "Hola NEGOVA, tengo un negocio comercial y me gustaría solicitar la prueba gratuita de 30 días."
  )}`;

  return (
    <div className="min-h-screen bg-[#F8F9FD] text-[#0B0E14] selection:bg-[#ED500A]/20 selection:text-[#ED500A]">
      <Navbar />

      {/* ── 1. HERO ESPECÍFICO DE COMERCIO (DISEÑO EDITORIAL SPLIT PREMIUM) ── */}
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
                <span>Especial para Comercio</span>
              </div>

              <h1 className="font-title font-black text-4xl sm:text-5xl lg:text-6xl text-[#0B0E14] leading-[1.08] tracking-tight">
                Gestiona tu negocio comercial{" "}
                <span className="text-[#ED500A] italic">sin complicarte.</span>
              </h1>

              <p className="font-body text-base sm:text-lg text-slate-600 leading-relaxed max-w-[50ch]">
                Organiza tus ventas, productos, inventario y caja desde un solo lugar. NEGOVA está pensado para pequeños comercios que necesitan tener mayor control de su operación diaria de forma sencilla.
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

            {/* Columna Derecha: Imagen de producto comercial (Animación de carga CSS + Flotado Perpetuo) */}
            <div className={`lg:col-span-6 relative hero-onload-right ${loaded ? "is-active" : ""}`}>
              <div className="absolute inset-0 bg-gradient-to-tr from-[#ED500A]/15 to-transparent rounded-3xl blur-2xl -z-10 animate-pulse" />
              
              <div className="relative rounded-3xl bg-white p-3 sm:p-4 border border-slate-200/90 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.1)] hover:shadow-[0_30px_75px_-15px_rgba(0,0,0,0.16)] transition-all duration-500 animate-float-perpetual">
                <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden border border-slate-100 bg-slate-50">
                  <Image
                    src="/images/negocios-comercio-v3.jpg"
                    alt="Sistema de gestión NEGOVA en un minimercado local"
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
                {/* Etiqueta flotante */}
                <div className="absolute -bottom-4 -right-4 bg-[#0B0E14] text-white py-3 px-4.5 rounded-2xl shadow-xl border border-white/10 flex items-center gap-2.5">
                  <span className="text-sm">🏬</span>
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

      {/* ── 2. SECCIÓN: TIPOS DE NEGOCIO (BENTO GRID CON IMÁGENES REALES) ── */}
      <section className="py-20 sm:py-28 bg-[#F8F9FD] border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12">
          
          <Reveal variant="up" className="text-center max-w-3xl mx-auto mb-16">
            <span className="font-mono text-xs font-semibold tracking-wider text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
              ADAPTABILIDAD
            </span>
            <h2 className="font-title font-extrabold text-3xl sm:text-4xl lg:text-5xl text-[#0B0E14] mt-4 mb-4 tracking-tight">
              Diseñado para el comercio de todos los días
            </h2>
            <p className="font-body text-base sm:text-lg text-slate-600 max-w-[65ch] mx-auto">
              Desde una tienda de barrio hasta una ferretería, NEGOVA busca adaptarse a la forma en que realmente trabajan los pequeños comercios.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-auto">
            {COMMERCE_TYPES.map((type, i) => {
              const hasImage = !!type.image;

              return (
                <Reveal 
                  key={i}
                  variant="up"
                  delay={i * 50}
                  className={`relative rounded-3xl overflow-hidden group border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between min-h-[340px] md:min-h-[300px] lg:min-h-[340px] ${type.span} ${
                    !hasImage 
                      ? type.title === "Floristerías"
                        ? "bg-[#0B0E14] text-white border-transparent shadow-md p-8"
                        : "bg-gradient-to-br from-[#ED500A]/5 to-[#F36320]/10 border-slate-200/80 p-8 shadow-xs hover:border-[#ED500A]/30"
                      : ""
                  }`}
                >
                  {hasImage ? (
                    <>
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
                    </>
                  ) : (
                    /* Tarjeta Bento de Texto sin Imagen */
                    <div className="h-full flex flex-col justify-between flex-1">
                      <div className="space-y-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${
                          type.title === "Floristerías" ? "bg-white/10" : "bg-white border border-slate-100"
                        }`}>
                          {type.icon}
                        </div>
                        <div>
                          <h3 className={`font-title font-extrabold text-xl ${
                            type.title === "Floristerías" ? "text-white" : "text-[#0B0E14]"
                          }`}>
                            {type.title}
                          </h3>
                          <p className={`font-body text-sm mt-2 leading-relaxed ${
                            type.title === "Floristerías" ? "text-slate-300" : "text-slate-600"
                          }`}>
                            {type.description}
                          </p>
                        </div>
                      </div>
                      <div className={`mt-6 pt-4 border-t flex items-center justify-between text-xs font-semibold ${
                        type.title === "Floristerías" ? "border-white/10 text-slate-400" : "border-slate-100 text-slate-500"
                      }`}>
                        <span>{type.details}</span>
                        <span className="text-[#ED500A]">✓</span>
                      </div>
                    </div>
                  )}
                </Reveal>
              );
            })}
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
              Cuando tienes productos por todas partes, necesitas saber qué está pasando.
            </h2>
            <p className="font-body text-base sm:text-lg text-slate-600">
              Revisa si te identificas con alguna de estas situaciones comunes del día a día en tu comercio:
            </p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {REAL_PROBLEMS.map((prob, idx) => (
              <Reveal 
                key={idx}
                variant="up"
                delay={idx * 40}
                className="p-6 rounded-2xl bg-[#F8F9FD] border border-slate-200/80 hover:bg-white hover:border-[#ED500A]/25 transition-all duration-300 space-y-3"
              >
                <div className="w-8 h-8 rounded-lg bg-orange-100 text-[#ED500A] flex items-center justify-center font-bold text-sm">
                  {idx + 1}
                </div>
                <h4 className="font-title font-bold text-base text-[#0B0E14]">
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
            
            {/* Cabecera Explicación Izquierda */}
            <Reveal variant="left" className="lg:col-span-4 space-y-6 lg:sticky lg:top-36">
              <span className="font-mono text-xs font-semibold tracking-wider text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
                HERRAMIENTAS CLAVE
              </span>
              <h2 className="font-title font-black text-3xl sm:text-4xl text-[#0B0E14] leading-tight">
                Todo lo esencial para tener tu comercio bajo control
              </h2>
              <p className="font-body text-slate-600 text-sm sm:text-base leading-relaxed">
                NEGOVA te ofrece las herramientas indispensables diseñadas para el flujo diario del comercio colombiano. Registra, controla y organiza la operación sin procesos complejos.
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
              {COMMERCE_FEATURES.map((feat, idx) => (
                <Reveal 
                  key={idx}
                  variant="up"
                  delay={idx * 50}
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
            
            {/* Foto de Entorno Comercial Real */}
            <Reveal variant="left" className="lg:col-span-5 relative">
              <div className="absolute inset-0 bg-[#ED500A]/10 rounded-3xl blur-xl -z-10" />
              <div className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-md">
                <Image
                  src="/images/negocios-comercio-lifestyle.png"
                  alt="Operación diaria en una tienda de barrio con NEGOVA"
                  width={600}
                  height={450}
                  className="object-cover"
                />
              </div>
            </Reveal>

            {/* Explicación de la Situación Cotidiana */}
            <Reveal variant="right" className="lg:col-span-7 space-y-8 text-left">
              <div>
                <span className="font-mono text-xs font-semibold tracking-wider text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
                  SITUACIÓN DIARIA
                </span>
                <h2 className="font-title font-extrabold text-3xl sm:text-4xl text-[#0B0E14] mt-4 mb-2 tracking-tight">
                  Así puede verse un día en tu comercio
                </h2>
                <p className="font-body text-slate-600 text-sm sm:text-base">
                  Mira cómo fluye la operación diaria de tu establecimiento comercial de manera sencilla:
                </p>
              </div>

              {/* Línea de tiempo vertical */}
              <div className="relative border-l border-slate-200 pl-6 space-y-6">
                
                {/* Paso 1 */}
                <Reveal variant="up" delay={50} className="relative">
                  <div className="absolute -left-[31px] top-0.5 w-4.5 h-4.5 rounded-full bg-[#ED500A] border-4 border-[#F8F9FD]" />
                  <h4 className="font-title font-bold text-sm text-[#0B0E14]">Un cliente entra al negocio</h4>
                  <p className="font-body text-xs sm:text-sm text-slate-500 mt-1">Busca el producto necesario en los estantes o mostrador.</p>
                </Reveal>

                {/* Paso 2 */}
                <Reveal variant="up" delay={100} className="relative">
                  <div className="absolute -left-[31px] top-0.5 w-4.5 h-4.5 rounded-full bg-[#ED500A] border-4 border-[#F8F9FD]" />
                  <h4 className="font-title font-bold text-sm text-[#0B0E14]">Encuentra un producto</h4>
                  <p className="font-body text-xs sm:text-sm text-slate-500 mt-1">El comensal o comprador decide llevarlo y se acerca a pagar.</p>
                </Reveal>

                {/* Paso 3 */}
                <Reveal variant="up" delay={150} className="relative">
                  <div className="absolute -left-[31px] top-0.5 w-4.5 h-4.5 rounded-full bg-[#ED500A] border-4 border-[#F8F9FD]" />
                  <h4 className="font-title font-bold text-sm text-[#0B0E14]">Se registra la venta</h4>
                  <p className="font-body text-xs sm:text-sm text-slate-500 mt-1">Ingresas los artículos en el punto de venta de NEGOVA al instante.</p>
                </Reveal>

                {/* Paso 4 */}
                <Reveal variant="up" delay={200} className="relative">
                  <div className="absolute -left-[31px] top-0.5 w-4.5 h-4.5 rounded-full bg-[#ED500A] border-4 border-[#F8F9FD]" />
                  <h4 className="font-title font-bold text-sm text-[#0B0E14]">El inventario refleja el movimiento</h4>
                  <p className="font-body text-xs sm:text-sm text-slate-500 mt-1">La cantidad de stock disponible se actualiza automáticamente.</p>
                </Reveal>

                {/* Paso 5 */}
                <Reveal variant="up" delay={250} className="relative">
                  <div className="absolute -left-[31px] top-0.5 w-4.5 h-4.5 rounded-full bg-[#ED500A] border-4 border-[#F8F9FD]" />
                  <h4 className="font-title font-bold text-sm text-[#0B0E14]">El dinero queda registrado en caja</h4>
                  <p className="font-body text-xs sm:text-sm text-slate-500 mt-1">La transacción suma al flujo de efectivo diario esperado.</p>
                </Reveal>

                {/* Paso 6 */}
                <Reveal variant="up" delay={300} className="relative">
                  <div className="absolute -left-[31px] top-0.5 w-4.5 h-4.5 rounded-full bg-[#ED500A] border-4 border-[#F8F9FD]" />
                  <h4 className="font-title font-bold text-sm text-[#0B0E14]">La información queda disponible para consultar</h4>
                  <p className="font-body text-xs sm:text-sm text-slate-500 mt-1">Consulta los reportes financieros para ver la salud del negocio.</p>
                </Reveal>

              </div>
            </Reveal>

          </div>

        </div>
      </section>

      {/* ── 7. SECCIÓN: COMERCIO CON VARIANTES (SCROLL REVEAL BIDIRECCIONAL CSS) ── */}
      <section className="py-20 sm:py-28 bg-white border-b border-slate-200 overflow-hidden">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* Explicación Técnica/Comercial de Variantes */}
            <Reveal variant="left" className="lg:col-span-5 space-y-6 text-left">
              <span className="font-mono text-xs font-semibold tracking-wider text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
                FLEXIBILIDAD DE PRODUCTO
              </span>
              <h2 className="font-title font-black text-3xl sm:text-4xl text-[#0B0E14] leading-tight">
                No todos los productos son iguales
              </h2>
              <p className="font-body text-slate-600 text-sm sm:text-base leading-relaxed">
                NEGOVA puede ayudarte a organizar productos que tienen diferentes características, evitando tener toda esa información dispersa en múltiples hojas o filas repetidas.
              </p>
              <div className="pt-2 text-xs font-semibold text-slate-500">
                ✦ Capacidad contemplada por el sistema para estructurar el catálogo.
              </div>
            </Reveal>

            {/* Visualización Asincrónica de Variantes */}
            <Reveal variant="right" className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { type: "Camiseta", options: "Talla S · M · L · XL", icon: "👕" },
                { type: "Zapatos", options: "Talla 38 · 39 · 40 · 41", icon: "👟" },
                { type: "Producto", options: "Pequeño · Mediano · Grande", icon: "📦" },
                { type: "Artículo", options: "Rojo · Azul · Negro", icon: "🎨" }
              ].map((item, idx) => (
                <div 
                  key={idx}
                  className="p-6 rounded-2xl bg-[#F8F9FD] border border-slate-200/70 hover:border-[#ED500A]/30 transition-all duration-300 flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-xl shadow-xs">
                    {item.icon}
                  </div>
                  <div>
                    <h4 className="font-title font-bold text-sm text-[#0B0E14]">{item.type}</h4>
                    <p className="font-body text-xs text-[#ED500A] font-semibold mt-1 bg-[#ED500A]/5 border border-[#ED500A]/15 py-0.5 px-2 rounded-md inline-block">
                      {item.options}
                    </p>
                  </div>
                </div>
              ))}
            </Reveal>

          </div>

        </div>
      </section>

      {/* ── 8. SECCIÓN: BENEFICIO PRINCIPAL (SCROLL REVEAL BIDIRECCIONAL CSS) ── */}
      <section className="py-20 sm:py-32 bg-[#F8F9FD] border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12 text-center max-w-4xl">
          
          <Reveal variant="up">
            <span className="font-mono text-xs font-semibold tracking-wider text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
              EL PROPÓSITO
            </span>
            <h2 className="font-title font-black text-4xl sm:text-5xl lg:text-6xl text-[#0B0E14] mt-6 mb-6 tracking-tight leading-none">
              Menos desorden. <br className="hidden sm:inline" />
              <span className="text-[#ED500A] italic">Más control.</span>
            </h2>
            
            <p className="font-body text-base sm:text-xl text-slate-600 leading-relaxed max-w-[50ch] mx-auto mb-12">
              Ten una visión más clara de lo que vendes, lo que tienes en inventario y lo que necesita tu atención inmediata.
            </p>
          </Reveal>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Ventas rápidas", icon: "⚡" },
              { label: "Inventario al día", icon: "📦" },
              { label: "Caja organizada", icon: "🔑" },
              { label: "Clientes y fiados", icon: "🤝" },
              { label: "Variantes de stock", icon: "🏷️" }
            ].map((ben, i) => (
              <Reveal 
                key={i} 
                variant="fade"
                delay={i * 60}
                className="p-5 rounded-2xl bg-white border border-slate-200/70 flex flex-col items-center gap-2 shadow-xs"
              >
                <span className="text-3xl">{ben.icon}</span>
                <span className="font-title font-bold text-xs sm:text-sm text-[#0B0E14]">{ben.label}</span>
              </Reveal>
            ))}
          </div>

        </div>
      </section>



      {/* ── 10. SECCIÓN DE CONVERSIÓN: PRUEBA GRATUITA (SCROLL REVEAL BIDIRECCIONAL CSS) ── */}
      <section className="py-20 sm:py-28 bg-[#F8F9FD] border-b border-slate-200 text-center">
        <Reveal variant="up" className="max-w-4xl mx-auto px-6 sm:px-8">
          
          <span className="font-mono text-xs font-semibold tracking-wider text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
            PRUEBA EL SISTEMA
          </span>
          
          <h2 className="font-title font-extrabold text-3xl sm:text-4xl lg:text-5xl text-[#0B0E14] mt-6 mb-4 tracking-tight">
            Conoce NEGOVA durante 30 días.
          </h2>

          <p className="font-body text-slate-600 text-sm sm:text-base max-w-[55ch] mx-auto mb-4 leading-relaxed">
            Prueba el plan Inicio durante 30 días y descubre una forma más sencilla de organizar tu comercio.
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

      {/* ── 11. PREGUNTAS FRECUENTES (FAQ) DE INICIO ── */}
      <FaqLandingSection />

      {/* ── 12. PLANES DE PRECIOS GENERALES DE NEGOVA ── */}
      <PricingSection />

      {/* ── 13. PILARES DE CONFIANZA ── */}
      <TrustSection />

      {/* ── 14. CTA FINAL DE CONVERSIÓN (SCROLL REVEAL BIDIRECCIONAL CSS) ── */}
      <section className="relative py-24 sm:py-32 bg-[#0B0E14] text-white overflow-hidden text-center">
        {/* Luz de fondo */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-gradient-to-br from-[#ED500A]/20 via-[#F36320]/10 to-transparent rounded-full blur-3xl" />
        </div>

        <Reveal variant="up" className="relative max-w-4xl mx-auto px-6 sm:px-8 space-y-6">
          <h2 className="font-title font-black text-4xl sm:text-6xl text-white leading-none tracking-tight">
            Organiza tu comercio. <br className="hidden sm:inline" />
            Empieza con NEGOVA.
          </h2>
          
          <p className="font-body text-base sm:text-xl text-slate-300 max-w-[50ch] mx-auto leading-relaxed">
            Tus productos, ventas, inventario y caja en un solo lugar.
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
