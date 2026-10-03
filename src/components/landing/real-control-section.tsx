"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  ShoppingBag,
  Package,
  Wallet,
  Users,
  Check,
  CheckCircle2,
  Zap,
  Sparkles,
  ArrowDown,
  Activity,
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

export function RealControlSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [sectionTop, setSectionTop] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const { ref: headerRef, visible: headerVisible } = useScrollReveal(0.05);
  const { ref: stageRef, visible: stageVisible } = useScrollReveal(0.05);
  const { ref: footerRef, visible: footerVisible } = useScrollReveal(0.05);

  // Control de scroll bidireccional (animaciones de salida/paralaje)
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

  // Animación de conexiones más ágil y dinámica (1.2s por fase)
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 1200);
    return () => clearInterval(timer);
  }, []);

  return (
    <section
      ref={sectionRef}
      id="control-conectado"
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

      {/* Resplandor orbital naranja sutil en el centro */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(237,80,10,0.04) 0%, transparent 70%)",
          filter: "blur(100px)",
        }}
      />

      <div
        className="max-w-[1240px] mx-auto px-6 sm:px-8 lg:px-12 relative z-10"
        style={{
          transform: `translateY(-${sectionExitY}px)`,
          opacity: sectionExitOpacity,
        }}
      >

        {/* ── ENCABEZADO EDITORIAL LIMPIO (ENTRADA SCROLL STAGGER) ── */}
        <div
          ref={headerRef}
          className={`max-w-3xl mx-auto text-center mb-16 lg:mb-20 scroll-fly-up ${headerVisible ? "in-view" : ""}`}
        >
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-[#ED500A] animate-pulse" />
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#0B0E14]/70">
              CONTROL EN UN SOLO LUGAR
            </span>
          </div>

          <h2 className="font-title font-extrabold text-3xl sm:text-4xl lg:text-[50px] tracking-tight leading-[1.06] text-[#0B0E14] mb-4">
            Todo conectado.{" "}
            <em className="not-italic text-[#ED500A]">Todo bajo control.</em>
          </h2>
          <p className="font-body text-base sm:text-lg text-[#0B0E14]/65 leading-relaxed max-w-2xl mx-auto">
            Ventas, inventario, caja y clientes trabajan juntos para que puedas dedicarte a hacer crecer tu negocio.
          </p>
        </div>

        {/* ── COMPOSICIÓN VISUAL DEL ECOSISTEMA CONECTADO ── */}
        <div
          ref={stageRef}
          className="relative max-w-4xl mx-auto"
        >

          {/* 1. NODO SUPERIOR: VENTA REGISTRADA (ENTRADA STAGGER 0.15s) */}
          <div className={`flex flex-col items-center scroll-fly-up ${stageVisible ? "in-view" : ""}`} style={{ animationDelay: "0.15s" }}>
            <div
              className={`relative px-6 py-4 rounded-2xl border transition-all duration-300 flex items-center gap-4 shadow-sm ${
                activeStep === 0 || activeStep === 1
                  ? "bg-white border-[#ED500A] shadow-[0_8px_30px_rgba(237,80,10,0.16)] scale-[1.02]"
                  : "bg-white/90 border-slate-200/90"
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center shrink-0">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#ED500A]">
                    VENTA REGISTRADA
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="font-title font-extrabold text-sm sm:text-base text-[#0B0E14]">
                  Cobro confirmado en mostrador
                </div>
              </div>
              <div className="pl-2">
                <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <Check className="w-3 h-3" /> Listo
                </span>
              </div>
            </div>

            {/* Línea conectora animada de Venta a Núcleo */}
            <div className="w-[2px] h-12 sm:h-16 relative overflow-hidden bg-slate-200">
              <div
                className={`absolute inset-x-0 w-full bg-[#ED500A] transition-all duration-300 ${
                  activeStep >= 1 ? "top-0 h-full opacity-100" : "top-0 h-0 opacity-0"
                }`}
              />
              {/* Partícula de energía luminosa con pulso suave */}
              {activeStep === 1 && (
                <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 -left-[3px] bg-[#ED500A] rounded-full shadow-[0_0_10px_#ED500A] animate-pulse" />
              )}
            </div>
          </div>

          {/* 2. NÚCLEO CENTRAL: NEGOVA SINCRONIZADOR (ENTRADA STAGGER 0.25s) */}
          <div className={`flex flex-col items-center scroll-fly-up ${stageVisible ? "in-view" : ""}`} style={{ animationDelay: "0.25s" }}>
            <div
              className={`relative px-7 py-5 rounded-3xl border transition-all duration-300 flex items-center gap-4 shadow-md ${
                activeStep >= 1
                  ? "bg-white border-[#ED500A]/70 shadow-[0_12px_36px_rgba(237,80,10,0.14)] scale-[1.02]"
                  : "bg-white border-slate-200/90"
              }`}
            >
              {/* Logo N con pulso de sincronización */}
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-[#ED500A] text-white flex items-center justify-center font-title font-extrabold text-xl shadow-[0_4px_16px_rgba(237,80,10,0.35)]">
                  N
                </div>
                {activeStep >= 1 && (
                  <span className="absolute -inset-1 rounded-2xl border-2 border-[#ED500A]/40 animate-ping pointer-events-none" />
                )}
              </div>

              <div className="text-left pr-3">
                <div className="font-title font-extrabold text-base sm:text-lg text-[#0B0E14] tracking-tight">
                  NEGOVA Central
                </div>
                <div className="font-body text-xs text-slate-500 mt-0.5">
                  Distribuye la información automáticamente
                </div>
              </div>

              {/* Indicador de sincronización de alta fidelidad (no icono de recarga simple) */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/80">
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ED500A] opacity-75 ${activeStep >= 1 ? "duration-700" : "opacity-0"}`} />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ED500A]" />
                </span>
                <span className="font-mono text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Sincronizado
                </span>
              </div>
            </div>
          </div>

          {/* 3. RED DE CONECTORES HACIA LOS 3 NODOS */}
          <div className="relative w-full max-w-3xl mx-auto h-14 sm:h-16 hidden sm:block">
            <svg className="w-full h-full" viewBox="0 0 600 60" fill="none">
              {/* Línea central vertical */}
              <path
                d="M 300 0 L 300 60"
                stroke={activeStep >= 2 ? "#10B981" : "#CBD5E1"}
                strokeWidth={activeStep >= 2 ? "2.5" : "1.5"}
                strokeDasharray={activeStep >= 2 ? "none" : "4 4"}
                className="transition-all duration-300"
              />
              {/* Rama izquierda a Inventario */}
              <path
                d="M 300 0 C 300 30, 100 30, 100 60"
                stroke={activeStep >= 2 ? "#3B82F6" : "#CBD5E1"}
                strokeWidth={activeStep >= 2 ? "2.5" : "1.5"}
                strokeDasharray={activeStep >= 2 ? "none" : "4 4"}
                className="transition-all duration-300"
              />
              {/* Rama derecha a Cliente */}
              <path
                d="M 300 0 C 300 30, 500 30, 500 60"
                stroke={activeStep >= 2 ? "#8B5CF6" : "#CBD5E1"}
                strokeWidth={activeStep >= 2 ? "2.5" : "1.5"}
                strokeDasharray={activeStep >= 2 ? "none" : "4 4"}
                className="transition-all duration-300"
              />
            </svg>
          </div>

          {/* 4. FILA DE 3 NODOS CONECTADOS (ENTRADA EN STAGGER 0.35s / 0.45s / 0.55s) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6 mt-4 sm:mt-0">

            {/* NODO 1: INVENTARIO */}
            <div
              onMouseEnter={() => setHoveredNode("inventario")}
              onMouseLeave={() => setHoveredNode(null)}
              className={`relative p-6 rounded-3xl border bg-white transition-all duration-300 cursor-pointer overflow-hidden scroll-fly-up ${stageVisible ? "in-view" : ""} ${
                activeStep >= 2 || hoveredNode === "inventario"
                  ? "border-[#3B82F6] shadow-[0_12px_32px_rgba(59,130,246,0.15)] -translate-y-1"
                  : "border-slate-200/80 shadow-sm"
              }`}
              style={{ animationDelay: "0.35s" }}
            >
              {/* Barra superior de acento */}
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#3B82F6]" />

              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-2xl bg-[#3B82F6]/10 text-[#3B82F6] flex items-center justify-center">
                  <Package className="w-5 h-5" />
                </div>
                <span
                  className={`font-mono text-[10px] font-bold px-2.5 py-1 rounded-full transition-colors duration-300 ${
                    activeStep >= 2
                      ? "bg-blue-50 text-blue-700 border border-blue-200/80 shadow-xs"
                      : "bg-slate-50 text-slate-400"
                  }`}
                >
                  {activeStep >= 2 ? "✓ Descontado" : "En espera"}
                </span>
              </div>

              <h4 className="font-title font-extrabold text-base text-[#0B0E14] mb-1">
                Inventario
              </h4>
              <p className="font-body text-xs text-slate-500 leading-relaxed">
                El stock se descuenta automáticamente sin conteos manuales.
              </p>

              {/* Micro-mensaje interactivo en hover */}
              <div
                className={`mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 transition-opacity duration-200 ${
                  hoveredNode === "inventario" ? "opacity-100" : "opacity-70"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#3B82F6]" />
                <span className="font-mono text-[10px] text-slate-600 font-semibold">
                  Stock actualizado al instante
                </span>
              </div>
            </div>

            {/* NODO 2: CAJA */}
            <div
              onMouseEnter={() => setHoveredNode("caja")}
              onMouseLeave={() => setHoveredNode(null)}
              className={`relative p-6 rounded-3xl border bg-white transition-all duration-300 cursor-pointer overflow-hidden scroll-fly-up ${stageVisible ? "in-view" : ""} ${
                activeStep >= 2 || hoveredNode === "caja"
                  ? "border-[#10B981] shadow-[0_12px_32px_rgba(16,185,129,0.15)] -translate-y-1"
                  : "border-slate-200/80 shadow-sm"
              }`}
              style={{ animationDelay: "0.45s" }}
            >
              {/* Barra superior de acento */}
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#10B981]" />

              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-2xl bg-[#10B981]/10 text-[#10B981] flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
                <span
                  className={`font-mono text-[10px] font-bold px-2.5 py-1 rounded-full transition-colors duration-300 ${
                    activeStep >= 2
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-xs"
                      : "bg-slate-50 text-slate-400"
                  }`}
                >
                  {activeStep >= 2 ? "✓ Cuadrada" : "En espera"}
                </span>
              </div>

              <h4 className="font-title font-extrabold text-base text-[#0B0E14] mb-1">
                Caja
              </h4>
              <p className="font-body text-xs text-slate-500 leading-relaxed">
                El ingreso queda registrado y el balance coincide siempre.
              </p>

              {/* Micro-mensaje interactivo en hover */}
              <div
                className={`mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 transition-opacity duration-200 ${
                  hoveredNode === "caja" ? "opacity-100" : "opacity-70"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                <span className="font-mono text-[10px] text-slate-600 font-semibold">
                  Movimiento registrado
                </span>
              </div>
            </div>

            {/* NODO 3: CLIENTES */}
            <div
              onMouseEnter={() => setHoveredNode("cliente")}
              onMouseLeave={() => setHoveredNode(null)}
              className={`relative p-6 rounded-3xl border bg-white transition-all duration-300 cursor-pointer overflow-hidden scroll-fly-up ${stageVisible ? "in-view" : ""} ${
                activeStep >= 2 || hoveredNode === "cliente"
                  ? "border-[#8B5CF6] shadow-[0_12px_32px_rgba(139,92,246,0.15)] -translate-y-1"
                  : "border-slate-200/80 shadow-sm"
              }`}
              style={{ animationDelay: "0.55s" }}
            >
              {/* Barra superior de acento */}
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#8B5CF6]" />

              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-2xl bg-[#8B5CF6]/10 text-[#8B5CF6] flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <span
                  className={`font-mono text-[10px] font-bold px-2.5 py-1 rounded-full transition-colors duration-300 ${
                    activeStep >= 2
                      ? "bg-purple-50 text-purple-700 border border-purple-200/80 shadow-xs"
                      : "bg-slate-50 text-slate-400"
                  }`}
                >
                  {activeStep >= 2 ? "✓ Asociado" : "En espera"}
                </span>
              </div>

              <h4 className="font-title font-extrabold text-base text-[#0B0E14] mb-1">
                Cliente
              </h4>
              <p className="font-body text-xs text-slate-500 leading-relaxed">
                El consumo se guarda en su historial para premiar su fidelidad.
              </p>

              {/* Micro-mensaje interactivo en hover */}
              <div
                className={`mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 transition-opacity duration-200 ${
                  hoveredNode === "cliente" ? "opacity-100" : "opacity-70"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#8B5CF6]" />
                <span className="font-mono text-[10px] text-slate-600 font-semibold">
                  Compra asociada al cliente
                </span>
              </div>
            </div>

          </div>

        </div>

        {/* ── CIERRE VISUAL DE LA SECCIÓN (FRASE CONCLUSIVA CON STAGGER 0.65s) ── */}
        <div
          ref={footerRef}
          className={`text-center mt-16 lg:mt-20 scroll-fly-up ${footerVisible ? "in-view" : ""}`}
          style={{ animationDelay: "0.65s" }}
        >
          <p className="font-title font-extrabold text-xl sm:text-2xl text-[#0B0E14] tracking-tight">
            Tú haces la venta. <span className="text-[#ED500A]">NEGOVA</span> mantiene todo actualizado.
          </p>
        </div>

      </div>
    </section>
  );
}
