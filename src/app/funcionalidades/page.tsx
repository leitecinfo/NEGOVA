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
  ShoppingCart,
  Boxes,
  Receipt,
  Users,
  Store,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Zap,
  HelpCircle,
  MessageCircle,
  ChevronDown,
} from "lucide-react";

// Data para las 6 Funcionalidades Principales de NEGOVA
const NEGOVA_FEATURES = [
  {
    id: "venta",
    number: "1",
    title: "Registro de ventas & Punto de Venta (POS)",
    shortDesc: "Control total de ventas en tiempo real sin descuadres ni cuadernos.",
    description:
      "Con NEGOVA llevas el control total de tus ventas en tiempo real, registrando cada transacción de forma rápida e intuitiva. Supervisa el rendimiento diario de tu negocio, identifica los productos más vendidos y evita descuadres en tu caja. Gracias a resúmenes claros y actualizados, podrás tomar decisiones estratégicas que impulsen la rentabilidad de tu comercio.",
    mockupType: "pos",
    mockupTitle: "Punto de Venta NEGOVA",
    mockupBg: "from-amber-500/10 via-orange-500/5 to-transparent",
    bullets: [
      "Cobro ágil e impresión o envío de comprobantes",
      "Historial organizado de transacciones del día",
      "Descuento automático de existencias del inventario",
    ],
  },
  {
    id: "inventario",
    number: "2",
    title: "Control de inventario & Stock",
    shortDesc: "Gestión de existencias en tiempo real y alertas automáticas de bajo stock.",
    description:
      "Con NEGOVA gestionas tu inventario en tiempo real y mantienes el control total de tus productos. Registra entradas y salidas de mercancía, organiza tu stock por categorías y agrega variantes como tallas, colores o presentaciones para un control más preciso. Recibe alertas para evitar desabastecimiento o exceso de mercancía, optimiza tus compras y asegura la disponibilidad de lo que tu negocio necesita.",
    mockupType: "stock",
    mockupTitle: "Módulo de Inventario & Alertas",
    mockupBg: "from-blue-500/10 via-sky-500/5 to-transparent",
    bullets: [
      "Alertas automáticas de productos próximos a agotarse",
      "Organización por categorías y variantes (tallas, presentaciones)",
      "Reducción de pérdidas por mercancía vencida o no registrada",
    ],
  },
  {
    id: "caja",
    number: "3",
    title: "Arqueo & Registro de caja diaria",
    shortDesc: "Control detallado de salidas de dinero, compras y flujo de efectivo.",
    description:
      "Con NEGOVA llevas un control detallado de todos los movimientos de caja y gastos operativos en tiempo real. Registra fácilmente cada salida de dinero, clasifícala por categoría y mantén un historial claro de tus costos cotidianos. Así evitas pérdidas de capital, optimizas tus recursos y tienes una visión completa del saldo disponible para cuadrar la caja sin estrés.",
    mockupType: "cash",
    mockupTitle: "Arqueo de Caja & Movimientos",
    mockupBg: "from-emerald-500/10 via-teal-500/5 to-transparent",
    bullets: [
      "Registro inmediato de ingresos y egresos diarios",
      "Arqueo de caja rápido al finalizar la jornada",
      "Detección de descuadres de dinero en tiempo real",
    ],
  },
  {
    id: "clientes",
    number: "4",
    title: "Gestión de clientes & Control de deudas (Fiados)",
    shortDesc: "Registro del fiado a clientes y saldos pendientes sin cuadernos de papel.",
    description:
      "Con NEGOVA centralizas la información de tus clientes y haces un seguimiento completo de sus compras y deudas pendientes. Registra saldos por cobrar, compras anteriores y compromisos de pago para dar un seguimiento organizado sin depender de libretas rotas o borradores en papel. Así aseguras el recaudo oportuno y fortaleces la fidelidad con tus clientes.",
    mockupType: "credit",
    mockupTitle: "Control de Fiados & Clientes",
    mockupBg: "from-purple-500/10 via-indigo-500/5 to-transparent",
    bullets: [
      "Historial individual de compras por comprador",
      "Registro claro de saldos pendientes y abonos",
      "Recordatorios organizados para recaudo de deudas",
    ],
  },
  {
    id: "catalogo",
    number: "5",
    title: "Catálogo de productos & Precios",
    shortDesc: "Organización estructurada por categorías, variantes y precios.",
    description:
      "Con NEGOVA organizas el catálogo de productos de tu negocio de forma limpia y profesional. Agrupa tus artículos por categorías clave, define precios de costo y venta, y maneja características según tu sector (como gramos, litros, unidades o paquetes). Mantiene tu menú o estantería virtual siempre al día para vender con seguridad.",
    mockupType: "catalog",
    mockupTitle: "Gestor de Productos & Menú",
    mockupBg: "from-orange-500/10 via-amber-500/5 to-transparent",
    bullets: [
      "Soporte para múltiples variantes y presentaciones",
      "Clasificación por categorías personalizables",
      "Actualización rápida de precios de lista",
    ],
  },
  {
    id: "reportes",
    number: "6",
    title: "Análisis de estadísticas & Reportes",
    shortDesc: "Balances reales y resúmenes visuales para tomar mejores decisiones.",
    description:
      "Con NEGOVA accedes a estadísticas claras y actualizadas sobre el rendimiento de tu negocio. Consulta reportes de ventas, identifica tus productos estrella de mayor rotación y analiza la evolución de tus ganancias netas. Con información en tiempo real dejas de adivinar y comienzas a hacer crecer tu empresa con datos confiables.",
    mockupType: "analytics",
    mockupTitle: "Reportes & Resumen Operativo",
    mockupBg: "from-[#ED500A]/10 via-red-500/5 to-transparent",
    bullets: [
      "Gráficas de ventas por día, semana o mes",
      "Ranking de productos más vendidos y más rentables",
      "Exportación de resúmenes para control del dueño",
    ],
  },
];

// Historias de clientes
const CLIENT_STORIES = [
  {
    feature: "Registro de ventas",
    quote:
      "El registro de ventas cambió completamente mi negocio. Ahora puedo ver exactamente qué productos se venden más y a qué hora. Mi negocio funciona mucho más organizado desde que empecé a usar el sistema.",
    author: "Carlos Rodríguez",
    business: "Tienda de Barrio El Triunfo",
  },
  {
    feature: "Control de inventario",
    quote:
      "Llevar el control de mi inventario con NEGOVA ha traído cambios gigantes. Ahora veo las unidades en stock con un toque y le pido a mis distribuidores con anticipación antes de quedarme sin mercancía.",
    author: "José Uribe",
    business: "Minimercado San José",
  },
];

// Preguntas frecuentes de Funcionalidades
const FAQ_ITEMS = [
  {
    q: "¿Cómo funciona el control de inventario en NEGOVA?",
    a: "Cada vez que registras una venta o ingreso de mercancía, NEGOVA descuenta o suma automáticamente las unidades en stock. Te alerta cuando un producto alcanza su límite mínimo de reposición.",
  },
  {
    q: "¿Puedo controlar el fiado a clientes sin cuadernos de papel?",
    a: "¡Sí! Puedes asociar una venta a un cliente registrado, anotar el saldo fiado y registrar los abonos parciales o totales. Sabrás exactamente cuánto te debe cada comprador en cualquier momento.",
  },
  {
    q: "¿NEGOVA genera reportes de ventas diarios y mensuales?",
    a: "Así es. Puedes visualizar resúmenes claros de ventas totales, ganancias netas por producto y comportamiento por fecha desde cualquier computador, tablet o celular.",
  },
  {
    q: "¿Puedo manejar variaciones de productos como tallas o presentaciones?",
    a: "Sí. NEGOVA te permite estructurar tus productos con variantes (por ejemplo: refrescos en 350ml, 1L, 2L; o prendas por talla S, M, L) asignando existencias a cada opción.",
  },
  {
    q: "¿Necesito instalar programas pesados en mi computador?",
    a: "No. NEGOVA funciona 100% desde la nube en tu navegador web. Ingresas con tu usuario desde tu computador de escritorio, laptop o teléfono sin instalaciones complicadas.",
  },
];

export default function FuncionalidadesPage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Observer para cambiar dinámicamente la imagen sticky del laptop a medida que el usuario hace scroll
  useEffect(() => {
    const handleScroll = () => {
      const viewportCenter = window.innerHeight / 2;
      let closestIdx = 0;
      let closestDist = Infinity;

      itemRefs.current.forEach((el, index) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const elementCenter = rect.top + rect.height / 2;
        const dist = Math.abs(elementCenter - viewportCenter);

        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = index;
        }
      });

      setActiveIndex(closestIdx);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const whatsappUrl = `https://wa.me/573114245409?text=${encodeURIComponent(
    "Hola NEGOVA, quiero conocer más sobre las funcionalidades y la prueba gratuita de 30 días."
  )}`;

  return (
    <div className="min-h-screen bg-[#F8F9FD] text-[#0B0E14] selection:bg-[#ED500A]/20 selection:text-[#ED500A]">
      <Navbar />

      {/* ── 1. HERO CON IMAGEN COMPLETA DE DISPOSITIVOS COMO FONDO ── */}
      <section className="relative pt-32 pb-24 sm:pt-40 sm:pb-32 bg-[#0B0E14] text-white overflow-hidden border-b border-white/10 flex items-center justify-center min-h-[550px] sm:min-h-[620px]">
        {/* Imagen de fondo con opacidad controlada para legibilidad del texto */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/hero-devices.jpg"
            alt="Dispositivos NEGOVA POS"
            fill
            className="object-cover object-center opacity-30 select-none pointer-events-none"
            priority
          />
          {/* Overlay de degradado oscuro */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E14] via-[#0B0E14]/75 to-[#0B0E14]/85" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          
          {/* Eyebrow de Marca */}
          <div className="inline-flex items-center gap-2 font-mono text-xs font-semibold tracking-widest text-[#ED500A] uppercase px-4 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/30">
            <span className="w-2 h-2 rounded-full bg-[#ED500A] animate-pulse" />
            <span>SISTEMA POS WEB · NEGOVA</span>
          </div>

          {/* Titular Principal en Display Sólido */}
          <h1 className="font-title font-black text-4xl sm:text-6xl text-white leading-[1.08] tracking-tight max-w-4xl mx-auto">
            Todas las herramientas que tu negocio necesita en{" "}
            <span className="text-[#ED500A] italic">
              un solo lugar.
            </span>
          </h1>

          {/* Subtítulo explicativo */}
          <p className="font-body text-base sm:text-xl text-slate-300 leading-relaxed max-w-[55ch] mx-auto">
            Punto de venta intuitivo, control de inventario en tiempo real, arqueo de caja y registro del fiado sin cuadernos de papel.
          </p>

          {/* Botones de Acción Principal y WhatsApp */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              href="/#precios"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-[#ED500A] hover:bg-[#F36320] text-white font-title font-bold text-base shadow-xl shadow-[#ED500A]/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer group"
            >
              <span>Probar 30 días gratis</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-full bg-[#25D366] hover:bg-[#20ba5a] text-white font-title font-bold text-base shadow-lg shadow-[#25D366]/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer"
            >
              <img src="/icons8-whatsapp.svg" alt="WhatsApp" className="w-5 h-5 shrink-0" />
              <span>Contáctanos por WhatsApp</span>
            </a>
          </div>

        </div>
      </section>

      {/* ── 2. SECCIÓN PRINCIPAL: MOCKUP STICKY QUE CAMBIA AL HACER SCROLL ── */}
      <section className="relative py-20 sm:py-32 bg-[#F8F9FD] border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header de la sección */}
          <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-24">
            <span className="font-mono text-xs font-semibold tracking-wider text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
              UN SISTEMA POS, UN NEGOCIO EXITOSO
            </span>
            <h2 className="font-title font-extrabold text-3xl sm:text-5xl text-[#0B0E14] mt-4 mb-4 tracking-tight">
              Optimiza tu operación diaria y desbloquea el potencial de tu negocio
            </h2>
            <p className="font-body text-base sm:text-lg text-slate-600">
              A medida que exploras cada funcionalidad, observa cómo la pantalla del sistema se adapta a tu día a día.
            </p>
          </div>

          {/* Grid Layout: Izquierda Sticky (Imagen Flotante) + Derecha Scroll (Items 1 a 6) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start mt-8 sm:mt-12">
            
            {/* ── COLUMNA IZQUIERDA: IMAGEN FLOTANTE STICKY CON DISTANCIA SEGURA DE CABECERA ── */}
            <div className="lg:col-span-6 lg:sticky lg:top-36 z-20 flex items-center justify-center pt-2">
              <div className="relative w-full max-w-lg rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2)] hover:shadow-[0_30px_75px_-15px_rgba(0,0,0,0.28)] transition-all duration-500 border border-slate-200/80 bg-white animate-float-perpetual">
                <div className="relative aspect-[16/10] w-full">
                  <Image
                    src={
                      activeIndex === 0
                        ? "/mockup-hero-clean.png"
                        : activeIndex === 1
                        ? "/images/blog-inventario-tienda.jpg"
                        : activeIndex === 2
                        ? "/images/blog-control-caja.jpg"
                        : activeIndex === 3
                        ? "/images/blog-ganancias-negocio.jpg"
                        : activeIndex === 4
                        ? "/negova-hero-product.jpg"
                        : "/hero-devices.jpg"
                    }
                    alt={NEGOVA_FEATURES[activeIndex].title}
                    fill
                    className="object-cover transition-opacity duration-500"
                  />
                </div>
              </div>
            </div>

            {/* ── COLUMNA DERECHA: LISTA DE CARACTERÍSTICAS (MÁS CERCA Y SIN CARDS) ── */}
            <div className="lg:col-span-6 space-y-10 sm:space-y-14">
              {NEGOVA_FEATURES.map((feature, index) => {
                const isActive = activeIndex === index;

                return (
                  <div
                    key={feature.id}
                    id={feature.id}
                    ref={(el) => {
                      itemRefs.current[index] = el;
                    }}
                    className={`scroll-mt-36 pb-10 sm:pb-14 transition-opacity duration-300 ${
                      index < NEGOVA_FEATURES.length - 1 ? "border-b border-slate-200/80" : ""
                    } ${isActive ? "opacity-100" : "opacity-60 hover:opacity-100"}`}
                  >
                    {/* Badge con Número */}
                    <div className="flex items-center gap-3 mb-4">
                      <span
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-title font-extrabold text-sm transition-colors ${
                          isActive
                            ? "bg-[#ED500A] text-white shadow-md shadow-[#ED500A]/30"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {feature.number}
                      </span>
                      <div className="h-0.5 w-12 bg-[#ED500A]/30" />
                    </div>

                    {/* Título de la Característica */}
                    <h3 className="font-title font-extrabold text-2xl sm:text-3xl text-[#0B0E14] mb-3 leading-tight">
                      {feature.title}
                    </h3>

                    {/* Descripción Explicativa */}
                    <p className="font-body text-sm sm:text-base text-slate-600 leading-relaxed mb-5">
                      {feature.description}
                    </p>

                    {/* Bullets clave */}
                    <div className="space-y-2 mb-5">
                      {feature.bullets.map((b, bIdx) => (
                        <div key={bIdx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 font-medium">
                          <CheckCircle2 className="w-4 h-4 text-[#ED500A] shrink-0 mt-0.5" />
                          <span>{b}</span>
                        </div>
                      ))}
                    </div>

                    {/* Enlace Ver más */}
                    <Link
                      href="/#precios"
                      className="inline-flex items-center gap-2 font-title font-bold text-xs sm:text-sm text-[#ED500A] hover:text-[#F36320] transition-colors group cursor-pointer"
                    >
                      <span>Ver más en planes y precios</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      </section>

      {/* ── 3. SECCIÓN OFICIAL DE TARJETAS DE PLANES Y PRECIOS ── */}
      <PricingSection />

      {/* ── 4. PILARES DE CONFIANZA, SEGURIDAD Y ACOMPAÑAMIENTO HUMANO ── */}
      <TrustSection />

      {/* ── 5. SECCIÓN OFICIAL DE PREGUNTAS FRECUENTES (FAQ) ── */}
      <FaqLandingSection />

      {/* Llamado al Acción Final */}
      <FinalCtaSection />

      {/* Asistentes Flotantes */}
      <FloatingWrapper />

      <Footer />
    </div>
  );
}
