"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Layers,
  Smartphone,
  BarChart3,
  CheckCircle2,
  Lock,
} from "lucide-react";

export function HeroSection() {
  const [scrollY, setScrollY] = useState(0);
  const [activeWordIndex, setActiveWordIndex] = useState(0);
  const [activeBenefitIndex, setActiveBenefitIndex] = useState<number | null>(null);

  // Palabras dinámicas en naranja que rotan mientras "Gestión" y "para tu negocio." permanecen 100% fijos
  const dynamicWords = [
    "inteligente",
    "simple",
    "completa",
    "eficiente",
    "centralizada",
  ];

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Rotación sutil de la palabra dinámica en naranja cada 3.2 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveWordIndex((prev) => (prev + 1) % dynamicWords.length);
    }, 3200);
    return () => clearInterval(interval);
  }, [dynamicWords.length]);

  // CÁLCULOS VINCULADOS AL PROGRESO REAL DEL SCROLL PARA SALIDA CINEMATOGRÁFICA
  // 1. Contenido de Texto (Velocidad alta: Y sube rápido, opacidad cae progresivamente)
  const textTranslateY = Math.min(scrollY * 0.28, 140);
  const textOpacity = Math.max(1 - scrollY * 0.0022, 0);

  // 2. Mockup de Producto (Velocidad media: Y sube lento, escala reduce ligeramente de 1 a 0.95 y desenfoque de salida sutil)
  const mockupTranslateY = Math.min(scrollY * 0.16, 95);
  const mockupScale = Math.max(1 - scrollY * 0.00022, 0.94);
  const mockupOpacity = Math.max(1 - scrollY * 0.0018, 0.15);
  const mockupImageBlur = Math.min(scrollY * 0.012, 6);

  // 3. Atmósfera de Luz (Velocidad muy lenta: Y sube sutilmente, blur se expande de 110px a 140px)
  const atmosphereTranslateY = Math.min(scrollY * 0.07, 45);
  const atmosphereOpacity = Math.max(1 - scrollY * 0.0018, 0.1);
  const atmosphereBlur = 110 + Math.min(scrollY * 0.08, 30);

  const benefits = [
    {
      id: "solo-un-lugar",
      icon: Layers,
      title: "Todo en un solo lugar",
      desc: "Centraliza las operaciones de tu negocio desde una sola plataforma.",
    },
    {
      id: "dispositivos",
      icon: Smartphone,
      title: "Desde cualquier dispositivo",
      desc: "Accede con total comodidad desde computador, tablet o celular.",
    },
    {
      id: "tiempo-real",
      icon: BarChart3,
      title: "Información en tiempo real",
      desc: "Consulta ventas, caja e inventarios cuando lo necesites.",
    },
  ];

  return (
    <section className="relative pt-10 pb-20 lg:pt-16 lg:pb-28 overflow-hidden bg-[#F8F9FD] dark:bg-[#0B0E14] transition-colors">
      {/* 1. RETÍCULA ARQUITECTÓNICA DE INGENIERÍA EN DEGRADADO NATIVO (0% MANCHAS DIFUSAS) */}
      <div className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(237, 80, 10, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(237, 80, 10, 0.08) 1px, transparent 1px)`,
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* ÁREA DE CONTENIDO COMERCIAL (SALIDA VINCULADA AL SCROLL EN PARALLAX RÁPIDO) */}
          <div
            className="lg:col-span-6 flex flex-col gap-6 lg:gap-7 relative transition-transform duration-75 ease-out"
            style={{
              transform: `translateY(-${textTranslateY}px)`,
              opacity: textOpacity,
              willChange: "transform, opacity",
            }}
          >

            {/* 1. EYEBROW */}
            <div className="inline-flex items-center gap-2 hero-reveal-1">
              <span className="w-2 h-2 rounded-full bg-[#ED500A] animate-pulse" />
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#0B0E14]/80 dark:text-white/90">
                SISTEMA DE GESTIÓN PARA NEGOCIOS
              </span>
            </div>

            {/* 2. H1 DOMINANTE (CON INLINE TYPOGRAPHY BADGE DE SWISS DESIGN) */}
            <h1 className="font-title font-extrabold text-4xl sm:text-5xl lg:text-[54px] text-[#0B0E14] dark:text-white tracking-tight leading-[1.08] hero-reveal-2 relative">
              <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-2">
                <span>Gestión</span>
                <span className="inline-block relative min-w-[220px] text-[#ED500A]">
                  <span
                    key={dynamicWords[activeWordIndex]}
                    className="inline-block animate-in fade-in slide-in-from-bottom-1 duration-300 underline decoration-[#ED500A]/30 underline-offset-8"
                  >
                    {dynamicWords[activeWordIndex]}
                  </span>
                </span>
                {/* Micro-pill inline de estatus activo */}
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 text-xs font-mono font-bold align-middle my-1 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
                  <span>Tiempo Real</span>
                </span>
              </span>
              <br />
              <span>para tu negocio.</span>
            </h1>

            {/* 3. DESCRIPCIÓN */}
            <p className="font-body text-base sm:text-lg text-[#0B0E14]/75 dark:text-white/75 max-w-xl leading-relaxed hero-reveal-3">
              Gestiona ventas, inventario, clientes y caja desde un solo lugar.
            </p>

            {/* 4. BENEFICIOS CLAVE (STAGGER 1-2-3 EXPLICITO) */}
            <div className="pt-2 pb-1 space-y-4">
              {benefits.map((item, i) => {
                const IconComponent = item.icon;
                const isHovered = activeBenefitIndex === i;
                const benefitClass = i === 0 ? "hero-reveal-b1" : i === 1 ? "hero-reveal-b2" : "hero-reveal-b3";

                return (
                  <div
                    key={item.id}
                    onMouseEnter={() => setActiveBenefitIndex(i)}
                    onMouseLeave={() => setActiveBenefitIndex(null)}
                    className={`flex items-start gap-4 group cursor-default transition-all duration-300 ${benefitClass}`}
                  >
                    {/* ICONO GEOMETRIC TECH LINEAL (20-24px) */}
                    <div className="relative shrink-0 mt-0.5 p-1 rounded-[4px] bg-[#ED500A]/10 group-hover:bg-[#ED500A]/15 transition-colors duration-300">
                      <IconComponent
                        className={`w-5 h-5 transition-all duration-300 ${
                          isHovered
                            ? "text-[#ED500A] scale-110"
                            : "text-[#ED500A] group-hover:text-[#ED500A]"
                        }`}
                      />
                    </div>

                    {/* CONTENIDO EDITORIAL FLUIDO */}
                    <div className="space-y-0.5 border-b border-[#0B0E14]/5 dark:border-white/5 pb-3 w-full group-last:border-b-0 group-last:pb-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-title font-semibold text-sm sm:text-base text-[#0B0E14] dark:text-white group-hover:text-[#ED500A] transition-colors duration-200">
                          {item.title}
                        </h4>
                        <span
                          className={`w-1.5 h-1.5 rounded-full bg-[#ED500A] transition-opacity duration-300 ${
                            isHovered ? "opacity-100" : "opacity-0"
                          }`}
                        />
                      </div>
                      <p className="font-body text-xs sm:text-sm text-[#0B0E14]/65 dark:text-white/65 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 5. LLAMADOS A LA ACCIÓN PRINCIPALES (BOTONES CTA ABAJO DE LOS BENEFICIOS) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
              {/* CTA PRINCIPAL */}
              <a
                href="https://wa.me/573114245409?text=Hola%20NEGOVA%2C%20quiero%20comenzar%20ahora%20con%20mi%20negocio%20y%20obtener%20informaci%C3%B3n%20sobre%20la%20plataforma%20y%20la%20prueba%20gratuita%20de%2030%20d%C3%ADas."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center bg-[#ED500A] hover:bg-[#d64505] active:bg-[#bd3d04] text-white font-title font-semibold text-base px-8 py-3.5 rounded-[4px] shadow-sm transition-all duration-200 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ED500A] hero-reveal-4 cursor-pointer"
              >
                <span>Comenzar ahora</span>
                <ArrowRight className="w-5 h-5 ml-2 transition-transform duration-200 group-hover:translate-x-1" />
              </a>

              {/* CTA SECUNDARIO GHOST */}
              <a
                href="#funcionalidades"
                className="inline-flex items-center justify-center bg-transparent hover:bg-[#0B0E14]/5 dark:hover:bg-white/5 text-[#0B0E14] dark:text-white font-title font-medium text-base px-6 py-3.5 rounded-[4px] border border-[#0B0E14]/15 dark:border-white/20 transition-colors duration-200 hero-reveal-5"
              >
                Ver cómo funciona
              </a>
            </div>

            {/* 6. ELEMENTO DE CONFIANZA HONESTO */}
            <div className="pt-3 border-t border-[#0B0E14]/10 dark:border-white/10 flex flex-wrap items-center gap-5 text-xs text-[#0B0E14]/60 dark:text-white/60 font-body hero-reveal-mockup">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#ED500A]" />
                <span>Diseñado para simplificar la gestión diaria de tu empresa</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#ED500A]" />
                <span>Sin contratos ni comisiones ocultas</span>
              </div>
            </div>
          </div>

          {/* 7. ÁREA VISUAL DEL PRODUCTO (SOMBRA AMBIENTAL 3D Y FLOTACIÓN CONTINUA) */}
          <div
            className="lg:col-span-6 relative flex justify-center items-center hero-reveal-mockup transition-transform duration-75 ease-out"
            style={{
              transform: `translateY(-${mockupTranslateY}px) scale(${mockupScale})`,
              opacity: mockupOpacity,
              willChange: "transform, opacity",
            }}
          >
            {/* CONTENEDOR FLOTANTE DEL MOCKUP CON FLOATING CONTINUO Y HOVER INTERACTIVO */}
            <div className="relative w-full max-w-[680px] lg:max-w-none group cursor-pointer">
              {/* Sombra ambiental tridimensional de elevacion realista */}
              <div className="absolute inset-x-8 bottom-6 h-12 bg-black/40 dark:bg-black/80 blur-2xl rounded-full pointer-events-none transition-all duration-500 group-hover:scale-105 group-hover:bg-black/50" />

              {/* ASSET TRANSPARENTE DEL MOCKUP CON FLOTACIÓN CONTINUA */}
              <div className="relative animate-float-continuous transition-transform duration-500 ease-out group-hover:scale-[1.025] group-hover:-translate-y-2">
                <Image
                  src="/mockup-hero-clean.png"
                  alt="Laptop y Smartphone con la interfaz oficial de NEGOVA"
                  width={1536}
                  height={1024}
                  className="w-full h-auto object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,0.14)] dark:drop-shadow-[0_30px_60px_rgba(0,0,0,0.7)] transition-all duration-75"
                  style={{
                    filter: `blur(${mockupImageBlur}px)`,
                  }}
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

