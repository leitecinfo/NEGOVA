"use client";

import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import {
  ShoppingBag,
  Utensils,
  Briefcase,
  CheckCircle2,
  Barcode,
  Clock,
  UserCheck,
  CreditCard,
  ChefHat,
  Calendar,
  Sparkles,
  ArrowRight,
} from "lucide-react";

// ── Hook de visibilidad suave con IntersectionObserver ──
function useScrollReveal(threshold = 0.05, exitMargin = "150px", entranceMargin = "50px") {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold, rootMargin: `${exitMargin} 0px ${entranceMargin} 0px` }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, exitMargin, entranceMargin]);
  return { ref, visible };
}

// ── Datos de los 3 Modos de Operación con Fotografía Real y Telemetría Flotante ──
const WORK_MODES = [
  {
    id: "comercio",
    label: "Comercio",
    tagline: "Ventas rápidas, productos e inventario.",
    color: "#3B82F6",
    icon: ShoppingBag,
    image: "/images/negocios-comercio-v3.jpg",
    alt: "Tienda moderna de ropa y comercio minorista",
    categoryLabel: "MODO RETAIL & COMERCIO",
    floatingBadges: [
      {
        position: "top-left",
        title: "Escaneo y Cobro Rápido",
        subtitle: "Lector de código listo · 3 items facturados",
        badgeText: "✓ Cobrado en 2 toques",
        badgeColor: "#3B82F6",
        icon: Barcode,
      },
      {
        position: "bottom-right",
        title: "Control de Inventario",
        subtitle: "Prendas descontadas de bodega",
        badgeText: "Stock sincronizado",
        badgeColor: "#10B981",
        icon: CheckCircle2,
      },
      {
        position: "bottom-left",
        title: "Caja Registradora",
        subtitle: "Pagos con tarjeta y efectivo cuadrados",
        badgeText: "Balance al día",
        badgeColor: "#ED500A",
        icon: CreditCard,
      },
    ],
    features: [
      "Lectura instantánea de códigos de barra",
      "Variantes por talla, color o modelo",
      "Arqueos ciegos y cierre de turno sin descuadres",
    ],
  },
  {
    id: "gastronomia",
    label: "Gastronomía",
    tagline: "Pedidos, mesas, productos e insumos.",
    color: "#ED500A",
    icon: Utensils,
    image: "/images/negocios-gastronomia-v3.jpg",
    alt: "Cafetería y restaurante artesanal con salón y barra",
    categoryLabel: "MODO RESTAURANTE & CAFÉ",
    floatingBadges: [
      {
        position: "top-left",
        title: "Mesa 04 · Salón Principal",
        subtitle: "2 comensales · Comanda confirmada",
        badgeText: "● Comanda activa",
        badgeColor: "#ED500A",
        icon: Clock,
      },
      {
        position: "bottom-right",
        title: "Despacho a Cocina",
        subtitle: "Platos en preparación · Receta descontada",
        badgeText: "Insumos deducidos",
        badgeColor: "#3B82F6",
        icon: ChefHat,
      },
      {
        position: "bottom-left",
        title: "Cierre de Cuenta",
        subtitle: "División de cuentas y propinas fácil",
        badgeText: "Mesa liberada",
        badgeColor: "#10B981",
        icon: CheckCircle2,
      },
    ],
    features: [
      "Distribución visual de mesas y barras",
      "Comandas enviadas directamente a cocina",
      "Deducción automática de insumos por receta",
    ],
  },
  {
    id: "servicios",
    label: "Servicios",
    tagline: "Clientes, servicios, agenda y cobros.",
    color: "#10B981",
    icon: Briefcase,
    image: "/images/negocios-servicios-v3.jpg",
    alt: "Estudio moderno de barbería y servicios profesionales",
    categoryLabel: "MODO ESTÉTICA & SERVICIOS",
    floatingBadges: [
      {
        position: "top-left",
        title: "Cita de las 15:30",
        subtitle: "Carlos Mendoza · Corte & Perfilado",
        badgeText: "● En atención",
        badgeColor: "#10B981",
        icon: Calendar,
      },
      {
        position: "bottom-right",
        title: "Comisión por Profesional",
        subtitle: "Atendido por Mateo · Comisión asignada",
        badgeText: "Liquidación lista",
        badgeColor: "#8B5CF6",
        icon: UserCheck,
      },
      {
        position: "bottom-left",
        title: "Ficha del Cliente",
        subtitle: "Historial de visitas y preferencias",
        badgeText: "Cliente frecuente",
        badgeColor: "#3B82F6",
        icon: CheckCircle2,
      },
    ],
    features: [
      "Agenda interactiva con turnos y horarios",
      "Cálculo transparente de comisiones por empleado",
      "Historial de consumo para fidelizar clientes",
    ],
  },
] as const;

export function WorkModesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [sectionTop, setSectionTop] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const { ref: headerRef, visible: headerVisible } = useScrollReveal(0.05);
  const { ref: stageRef, visible: stageVisible } = useScrollReveal(0.05);
  const { ref: footerRef, visible: footerVisible } = useScrollReveal(0.05);

  // Control de scroll bidireccional
  useEffect(() => {
    const handleScroll = () => {
      if (sectionRef.current) {
        setSectionTop(sectionRef.current.getBoundingClientRect().top);
      }
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const exitFactor =
    sectionTop < -300 ? Math.min((Math.abs(sectionTop) - 300) * 0.001, 0.3) : 0;
  const sectionExitOpacity = Math.max(1 - exitFactor, 0.7);
  const sectionExitY =
    sectionTop < -300 ? Math.min((Math.abs(sectionTop) - 300) * 0.08, 40) : 0;

  // Ciclo automático lento (5 segundos por modo) con pausa al interactuar
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % WORK_MODES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isPaused]);

  const activeMode = WORK_MODES[activeIndex];

  return (
    <section
      ref={sectionRef}
      id="formas-de-trabajo"
      className="relative py-28 lg:py-36 bg-[#F8F9FD] text-[#0B0E14] overflow-visible"
    >
      {/* Grid técnico de fondo */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(15,23,42,0.02) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(15,23,42,0.02) 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
        }}
      />

      {/* Resplandor orbital sutil que acompaña el color activo */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] rounded-full pointer-events-none transition-all duration-700"
        style={{
          background: `radial-gradient(circle, ${activeMode.color}08 0%, transparent 70%)`,
          filter: "blur(110px)",
        }}
      />

      <div
        className="max-w-[1280px] mx-auto px-6 sm:px-8 lg:px-12 relative z-10"
        style={{
          transform: `translateY(-${sectionExitY}px)`,
          opacity: sectionExitOpacity,
        }}
      >

        {/* ── ENCABEZADO EDITORIAL LIMPIO (STAGGER 0.05s) ── */}
        <div
          ref={headerRef}
          className={`max-w-3xl mx-auto text-center mb-14 lg:mb-16 scroll-fly-up ${headerVisible ? "in-view" : ""}`}
        >
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-[#ED500A] animate-pulse" />
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#0B0E14]/70">
              UNA PLATAFORMA, MUCHAS FORMAS DE TRABAJAR
            </span>
          </div>

          <h2 className="font-title font-extrabold text-3xl sm:text-4xl lg:text-[50px] tracking-tight leading-[1.06] text-[#0B0E14] mb-4">
            NEGOVA se adapta a tu{" "}
            <em className="not-italic text-[#ED500A]">forma de trabajar</em>
          </h2>
          <p className="font-body text-base sm:text-lg text-[#0B0E14]/65 leading-relaxed max-w-2xl mx-auto">
            Cada negocio tiene su propia manera de operar. NEGOVA se adapta a ella sin obligarte a cambiar cómo haces las cosas.
          </p>
        </div>

        {/* ── SELECTOR DE MODOS OPERATIVOS (PUNTOS DE EXPLORACIÓN) ── */}
        <div
          className={`max-w-3xl mx-auto mb-10 scroll-fly-up ${stageVisible ? "in-view" : ""}`}
          style={{ animationDelay: "0.15s" }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-2 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
            {WORK_MODES.map((mode, idx) => {
              const Icon = mode.icon;
              const isActive = activeIndex === idx;

              return (
                <button
                  key={mode.id}
                  onClick={() => setActiveIndex(idx)}
                  className={`relative p-4 rounded-2xl transition-all duration-300 text-left cursor-pointer overflow-hidden ${
                    isActive
                      ? "bg-slate-50 border border-slate-300/80 shadow-xs"
                      : "hover:bg-slate-50/60 border border-transparent"
                  }`}
                >
                  {/* Barra activa superior con el color del modo */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-[2.5px] transition-all duration-300 ${
                      isActive ? "opacity-100" : "opacity-0"
                    }`}
                    style={{ background: mode.color }}
                  />

                  <div className="flex items-center gap-2.5 mb-1.5">
                    <div
                      className="p-1.5 rounded-lg transition-transform duration-300"
                      style={{
                        background: isActive ? `${mode.color}20` : `${mode.color}12`,
                        color: mode.color,
                        transform: isActive ? "scale(1.05)" : "scale(1)",
                      }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span
                      className="font-title font-extrabold text-sm transition-colors duration-200"
                      style={{ color: isActive ? mode.color : "#0B0E14" }}
                    >
                      {mode.label}
                    </span>
                  </div>

                  <p className="font-body text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {mode.tagline}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── ESCENARIO VISUAL PRINCIPAL: FOTOGRAFÍA CINEMATOGRÁFICA + TELEMETRÍA EN ACCIÓN ── */}
        <div
          ref={stageRef}
          className={`max-w-5xl mx-auto scroll-fly-up ${stageVisible ? "in-view" : ""}`}
          style={{ animationDelay: "0.25s" }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Estructura Doble-Bisel de Alta Gama */}
          <div className="p-2 sm:p-3 rounded-[2.5rem] bg-white border border-slate-200/90 shadow-[0_20px_50px_rgba(0,0,0,0.06)]">
            <div className="relative rounded-[2rem] overflow-hidden min-h-[440px] sm:min-h-[500px] flex flex-col justify-between p-6 sm:p-10">
              
              {/* Imagen de fondo real con transición suave */}
              <div className="absolute inset-0 z-0">
                <Image
                  src={activeMode.image}
                  alt={activeMode.alt}
                  fill
                  className="object-cover transition-all duration-700 ease-out scale-105"
                  sizes="(max-width: 1200px) 100vw, 1200px"
                  priority
                />
                {/* Degradado cinematográfico para legibilidad y elegancia */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E14]/90 via-[#0B0E14]/35 to-[#0B0E14]/50" />
              </div>

              {/* Encabezado flotante dentro del escenario */}
              <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-white/40 shadow-sm">
                  <span
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ backgroundColor: activeMode.color }}
                  />
                  <span className="font-mono text-xs font-bold tracking-wider text-[#0B0E14]">
                    {activeMode.categoryLabel}
                  </span>
                </div>

                <span className="font-mono text-xs text-white/90 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/20">
                  {activeMode.tagline}
                </span>
              </div>

              {/* Tarjetas de telemetría flotantes animadas en vivo */}
              <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3.5 my-auto py-6">
                {activeMode.floatingBadges.map((badge, bIdx) => {
                  const BadgeIcon = badge.icon;
                  return (
                    <div
                      key={bIdx}
                      className="p-4 rounded-2xl bg-white/95 backdrop-blur-md border border-white/60 shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-all duration-300 hover:scale-[1.02]"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div
                          className="p-2 rounded-xl"
                          style={{ background: `${badge.badgeColor}18`, color: badge.badgeColor }}
                        >
                          <BadgeIcon className="w-4 h-4" />
                        </div>
                        <span
                          className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: `${badge.badgeColor}15`,
                            color: badge.badgeColor,
                          }}
                        >
                          {badge.badgeText}
                        </span>
                      </div>

                      <div className="font-title font-extrabold text-sm text-[#0B0E14]">
                        {badge.title}
                      </div>
                      <p className="font-body text-xs text-slate-600 mt-0.5 leading-snug">
                        {badge.subtitle}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Pie con 3 pilares clave del modo activo */}
              <div className="relative z-10 pt-4 border-t border-white/20 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-white/90">
                  {activeMode.features.map((feat, fIdx) => (
                    <div key={fIdx} className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-[#ED500A] shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-white bg-[#ED500A] px-3.5 py-1.5 rounded-xl shadow-sm">
                  <span>Operación lista</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ── FRASE FINAL DE LA SECCIÓN (STAGGER 0.35s) ── */}
        <div
          ref={footerRef}
          className={`text-center mt-16 lg:mt-20 scroll-fly-up ${footerVisible ? "in-view" : ""}`}
          style={{ animationDelay: "0.35s" }}
        >
          <p className="font-title font-extrabold text-xl sm:text-2xl text-[#0B0E14] tracking-tight">
            Tu negocio cambia. <span className="text-[#ED500A]">NEGOVA</span> se adapta.
          </p>
        </div>

      </div>
    </section>
  );
}
