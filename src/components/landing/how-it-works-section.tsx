"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  Store,
  Sliders,
  Sparkles,
  ShoppingBag,
  TrendingUp,
  CreditCard,
  Package,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  Layers,
  BarChart3,
  Check,
} from "lucide-react";

// Hook bidireccional: activa in-view al entrar, lo quita al salir → animación repetible
function useScrollReveal(threshold = 0.15, exitMargin = "200px", entranceMargin = "-8%") {
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

export function HowItWorksSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const [sectionTop, setSectionTop] = useState(0);

  // Estado del paso interactivo activo (0: Crea, 1: Opera, 2: Toma Control)
  const [activeStep, setActiveStep] = useState<number>(0);
  const [isHoveredByPointer, setIsHoveredByPointer] = useState(false);

  // Observers individuales por elemento
  const { ref: headerRef, visible: headerVisible } = useScrollReveal();
  const { ref: stepsRef, visible: stepsVisible } = useScrollReveal();
  const { ref: mockupRef, visible: mockupVisible } = useScrollReveal();


  // Escuchar posición de scroll para animaciones físicas vinculadas al viewport
  useEffect(() => {
    const handleScroll = () => {
      if (sectionRef.current) {
        const rect = sectionRef.current.getBoundingClientRect();
        setScrollY(window.scrollY);
        setSectionTop(rect.top);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // CÁLCULO DE ENTRADA / SCROLL STORYTELLING
  const windowHeight = typeof window !== "undefined" ? window.innerHeight : 900;
  const distanceToViewportBottom = sectionTop - windowHeight;
  
  // Progreso de entrada de 0 (fuera de pantalla por abajo) a 1 (enfocado)
  const rawProgress = 1 - Math.max(0, Math.min(distanceToViewportBottom + 400, 750)) / 750;
  const enterProgress = Math.min(Math.max(rawProgress, 0), 1);

  // Cambiar de paso automáticamente según el avance de scroll si el usuario no tiene el cursor encima
  useEffect(() => {
    if (isHoveredByPointer) return;

    if (enterProgress > 0.75) {
      setActiveStep(2);
    } else if (enterProgress > 0.45) {
      setActiveStep(1);
    } else {
      setActiveStep(0);
    }
  }, [enterProgress, isHoveredByPointer]);

  // CÁLCULO DE SALIDA CINEMATOGRÁFICA
  const exitFactor = sectionTop < -300 ? Math.min((Math.abs(sectionTop) - 300) * 0.0012, 0.35) : 0;
  const sectionExitY = sectionTop < -300 ? Math.min((Math.abs(sectionTop) - 300) * 0.12, 60) : 0;
  const sectionExitOpacity = Math.max(1 - exitFactor, 0.65);

  return (
    <section
      ref={sectionRef}
      id="como-funciona"
      className="relative py-28 lg:py-36 bg-[#F8F9FD] text-[#0B0E14] transition-colors duration-300 overflow-hidden"
    >
      {/* Fondo técnico geométrico — light */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(15,23,42,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.02) 1px, transparent 1px)`,
            backgroundSize: "80px 80px",
          }}
        />
        {/* Acento naranja sutil */}
        <div
          className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(237,80,10,0.05) 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />
      </div>

      <div
        className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12 relative z-10"
        style={{
          transform: `translateY(-${sectionExitY}px)`,
          opacity: sectionExitOpacity,
          willChange: "transform, opacity",
        }}
      >
        {/* CABECERA — vuela desde abajo */}
        <div
          ref={headerRef}
          className={`max-w-3xl mb-16 lg:mb-24 flex flex-col gap-4 scroll-fly-up ${headerVisible ? "in-view" : ""}`}
        >
          <div className="inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#ED500A] animate-pulse" />
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#0B0E14]/70">
              PASO A PASO
            </span>
          </div>

          <h2 className="font-title font-extrabold text-3xl sm:text-4xl lg:text-[52px] tracking-tight leading-[1.06] text-[#0B0E14]">
            Así de fácil es empezar
          </h2>

          <p className="font-body text-base sm:text-lg text-[#0B0E14]/70 max-w-2xl leading-relaxed">
            Configura tu negocio, empieza a operar y mantén todo bajo control desde un solo lugar.
          </p>
        </div>

        {/* SWISS EDITORIAL GRID: PASOS CONECTADOS (IZQUIERDA: 5 COLS) + MOCKUP DE PRODUCTO VIVO (DERECHA: 7 COLS) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* RECORRIDO DE 3 PASOS EDITORIALES (5 COLUMNAS DESKTOP) — vuela desde izquierda */}
          <div
            ref={stepsRef}
            className={`lg:col-span-5 relative flex flex-col gap-6 pl-4 border-l-2 border-slate-200/60 scroll-fly-left ${stepsVisible ? "in-view" : ""}`}
            onMouseEnter={() => setIsHoveredByPointer(true)}
            onMouseLeave={() => setIsHoveredByPointer(false)}
          >
            {/* LÍNEA DE PROGRESO LATERAL LIMPIA EN NEGOVA ORANGE */}
            <div
              className="absolute left-[-2px] top-0 w-[2px] bg-[#ED500A] transition-all duration-500 ease-out shadow-[0_0_12px_rgba(237,80,10,0.6)]"
              style={{
                height: `${activeStep === 0 ? "33%" : activeStep === 1 ? "66%" : "100%"}`,
              }}
            />

            {/* PASO 01 */}
            <div
              onClick={() => setActiveStep(0)}
              onMouseEnter={() => setActiveStep(0)}
              className={`relative flex items-start gap-5 p-6 rounded-3xl transition-all duration-300 cursor-pointer border ${
                activeStep === 0
                  ? "bg-white border-[#ED500A]/50 shadow-[0_12px_32px_rgba(237,80,10,0.1)] translate-x-2"
                  : "bg-white/80 border-slate-200/80 hover:bg-white hover:border-slate-300"
              }`}
            >
              {/* INDICADOR NUMÉRICO LÍMPIDO */}
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center font-mono font-extrabold text-sm shrink-0 transition-all duration-300 ${
                  activeStep === 0
                    ? "bg-[#ED500A] text-white shadow-lg shadow-[#ED500A]/30 scale-105"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                01
              </div>

              <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-title font-extrabold text-xl text-[#0B0E14]">
                    Crea tu negocio
                  </h3>
                  <ChevronRight
                    className={`w-5 h-5 transition-transform duration-300 ${
                      activeStep === 0 ? "text-[#ED500A] translate-x-1 opacity-100" : "text-[#0B0E14]/20 opacity-0"
                    }`}
                  />
                </div>
                <p className="font-body text-sm text-[#0B0E14]/70 leading-relaxed">
                  Registra la información básica de tu negocio y configura tu espacio de trabajo en pocos minutos.
                </p>
              </div>
            </div>

            {/* PASO 02 */}
            <div
              onClick={() => setActiveStep(1)}
              onMouseEnter={() => setActiveStep(1)}
              className={`relative flex items-start gap-5 p-6 rounded-3xl transition-all duration-300 cursor-pointer border ${
                activeStep === 1
                  ? "bg-white border-[#ED500A]/50 shadow-[0_12px_32px_rgba(237,80,10,0.1)] translate-x-2"
                  : "bg-white/80 border-slate-200/80 hover:bg-white hover:border-slate-300"
              }`}
            >
              {/* INDICADOR NUMÉRICO LÍMPIDO */}
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center font-mono font-extrabold text-sm shrink-0 transition-all duration-300 ${
                  activeStep === 1
                    ? "bg-[#ED500A] text-white shadow-lg shadow-[#ED500A]/30 scale-105"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                02
              </div>

              <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-title font-extrabold text-xl text-[#0B0E14]">
                    Empieza a operar
                  </h3>
                  <ChevronRight
                    className={`w-5 h-5 transition-transform duration-300 ${
                      activeStep === 1 ? "text-[#ED500A] translate-x-1 opacity-100" : "text-[#0B0E14]/20 opacity-0"
                    }`}
                  />
                </div>
                <p className="font-body text-sm text-[#0B0E14]/70 leading-relaxed">
                  Agrega tus productos, registra ventas y comienza a llevar el control de tu negocio desde NEGOVA.
                </p>
              </div>
            </div>

            {/* PASO 03 */}
            <div
              onClick={() => setActiveStep(2)}
              onMouseEnter={() => setActiveStep(2)}
              className={`relative flex items-start gap-5 p-6 rounded-3xl transition-all duration-300 cursor-pointer border ${
                activeStep === 2
                  ? "bg-white border-[#ED500A]/50 shadow-[0_12px_32px_rgba(237,80,10,0.1)] translate-x-2"
                  : "bg-white/80 border-slate-200/80 hover:bg-white hover:border-slate-300"
              }`}
            >
              {/* INDICADOR NUMÉRICO LÍMPIDO */}
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center font-mono font-extrabold text-sm shrink-0 transition-all duration-300 ${
                  activeStep === 2
                    ? "bg-[#ED500A] text-white shadow-lg shadow-[#ED500A]/30 scale-105"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                03
              </div>

              <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-title font-extrabold text-xl text-[#0B0E14]">
                    Toma el control
                  </h3>
                  <ChevronRight
                    className={`w-5 h-5 transition-transform duration-300 ${
                      activeStep === 2 ? "text-[#ED500A] translate-x-1 opacity-100" : "text-[#0B0E14]/20 opacity-0"
                    }`}
                  />
                </div>
                <p className="font-body text-sm text-[#0B0E14]/70 leading-relaxed">
                  Consulta tus ventas, inventario, clientes y caja desde una sola plataforma.
                </p>
              </div>
            </div>
          </div>

          {/* MOCKUP DEL PRODUCTO — DISEÑO LIGHT LIMPIO EDITORIAL CON HOVER NARANJA */}
          <div
            ref={mockupRef}
            className={`lg:col-span-7 relative scroll-fly-right ${mockupVisible ? "in-view" : ""}`}
          >
            <div
              className="relative rounded-3xl bg-white border border-slate-200/80 hover:border-[#ED500A]/60 p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.05)] hover:shadow-[0_24px_50px_rgba(237,80,10,0.12)] overflow-hidden min-h-[460px] flex flex-col justify-between group animate-float-continuous transition-all duration-300"
            >
              
              {/* MARCO DE INTERFAZ ESTILO BROWSER / APP */}
              <div className="flex items-center justify-between pb-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-400/80" />
                    <span className="w-3 h-3 rounded-full bg-amber-400/80" />
                    <span className="w-3 h-3 rounded-full bg-emerald-400/80" />
                  </div>
                  <span className="font-mono text-xs text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-200/60">
                    negova.app / {activeStep === 0 ? "configuracion" : activeStep === 1 ? "pos-operacion" : "dashboard-control"}
                  </span>
                </div>
                <span className="font-mono text-xs font-bold text-[#ED500A] bg-[#ED500A]/10 border border-[#ED500A]/20 px-3 py-1 rounded-full">
                  {activeStep === 0 ? "PASO 01 · CONFIGURACIÓN" : activeStep === 1 ? "PASO 02 · REGISTRA Y COBRA" : "PASO 03 · CONTROL TOTAL"}
                </span>
              </div>

              {/* CONTENIDO INTERACTIVO CORRESPONDIENTE AL PASO VINCULADO */}
              <div className="my-8 relative z-10">
                {activeStep === 0 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-4">
                      <div className="p-3.5 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20">
                        <Store className="w-7 h-7" />
                      </div>
                      <div>
                        <h4 className="font-title font-bold text-lg text-[#0B0E14]">Mi Tienda NEGOVA</h4>
                        <p className="font-body text-xs text-slate-500">Configuración básica e identidad comercial</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="p-4 rounded-2xl bg-[#F8F9FD] border border-slate-200/70 hover:border-[#ED500A]/40 flex items-center justify-between shadow-sm transition-all duration-200">
                        <span className="font-mono text-xs text-slate-600">Nombre Comercial</span>
                        <span className="font-title text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Listo
                        </span>
                      </div>
                      <div className="p-4 rounded-2xl bg-[#F8F9FD] border border-slate-200/70 hover:border-[#ED500A]/40 flex items-center justify-between shadow-sm transition-all duration-200">
                        <span className="font-mono text-xs text-slate-600">Moneda & Caja</span>
                        <span className="font-title text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> COP ($)
                        </span>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#ED500A]/5 border border-[#ED500A]/20 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Sparkles className="w-5 h-5 text-[#ED500A]" />
                        <span className="font-body text-xs text-[#0B0E14] font-semibold">Espacio de trabajo creado con éxito</span>
                      </div>
                      <span className="font-mono text-xs font-bold text-[#ED500A] bg-[#ED500A]/10 px-2.5 py-1 rounded-lg">100% Completo</span>
                    </div>
                  </div>
                )}

                {activeStep === 1 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3.5 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20">
                          <ShoppingBag className="w-7 h-7" />
                        </div>
                        <div>
                          <h4 className="font-title font-bold text-lg text-[#0B0E14]">Registro de Venta Rápida</h4>
                          <p className="font-body text-xs text-slate-500">Cobra y actualiza existencias en tiempo real</p>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        Sistema Activo
                      </span>
                    </div>

                    <div className="p-5 rounded-2xl bg-[#F8F9FD] border border-slate-200/70 hover:border-[#ED500A]/40 space-y-3 shadow-sm transition-all duration-200">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-600">Producto: Zapatillas Urban Runner x1</span>
                        <span className="font-bold text-[#0B0E14] text-sm">$145.000 COP</span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-600">Cliente: Carlos Mendoza</span>
                        <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">Pago Recibido</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#F8F9FD] border border-slate-200/70 hover:border-[#ED500A]/40 flex items-center justify-between text-xs shadow-sm transition-all duration-200">
                      <span className="font-mono text-slate-600">Stock Restante Actualizado:</span>
                      <span className="font-mono font-bold text-[#0B0E14] bg-white border border-slate-200 px-3 py-1 rounded-lg">47 unidades</span>
                    </div>
                  </div>
                )}

                {activeStep === 2 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3.5 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20">
                          <BarChart3 className="w-7 h-7" />
                        </div>
                        <div>
                          <h4 className="font-title font-bold text-lg text-[#0B0E14]">Panel de Control Integral</h4>
                          <p className="font-body text-xs text-slate-500">Métricas y resumen de operación en tiempo real</p>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold text-[#ED500A] bg-[#ED500A]/10 border border-[#ED500A]/20 px-3 py-1.5 rounded-xl">
                        Visión 360°
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-4 rounded-2xl bg-[#F8F9FD] border border-slate-200/70 hover:border-[#ED500A]/50 hover:bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 cursor-pointer">
                        <div className="font-mono text-[10px] uppercase font-bold tracking-wider text-slate-400">Ventas Hoy</div>
                        <div className="font-title font-extrabold text-lg text-[#0B0E14] mt-1">$1.450.000</div>
                      </div>
                      <div className="p-4 rounded-2xl bg-[#F8F9FD] border border-slate-200/70 hover:border-[#ED500A]/50 hover:bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 cursor-pointer">
                        <div className="font-mono text-[10px] uppercase font-bold tracking-wider text-slate-400">Saldo Caja</div>
                        <div className="font-title font-extrabold text-lg text-emerald-600 mt-1">$1.270.000</div>
                      </div>
                      <div className="p-4 rounded-2xl bg-[#F8F9FD] border border-slate-200/70 hover:border-[#ED500A]/50 hover:bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 cursor-pointer">
                        <div className="font-mono text-[10px] uppercase font-bold tracking-wider text-slate-400">Clientes</div>
                        <div className="font-title font-extrabold text-lg text-[#ED500A] mt-1">128 Activos</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* PIE Y NAVEGACIÓN MANUAL DE PASOS EN MOCKUP */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {[0, 1, 2].map((idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveStep(idx)}
                      className={`h-2.5 rounded-full transition-all duration-300 ${
                        activeStep === idx ? "bg-[#ED500A] w-7" : "w-2.5 bg-slate-200 hover:bg-slate-300"
                      }`}
                      aria-label={`Ir al paso ${idx + 1}`}
                    />
                  ))}
                </div>

                <span className="font-mono text-xs text-slate-400 flex items-center gap-1 font-medium">
                  Paso {activeStep + 1} de 3
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
