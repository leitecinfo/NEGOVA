"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  ShoppingBag,
  PackageCheck,
  CreditCard,
  UserCheck,
  TrendingUp,
  Smartphone,
  CheckCircle2,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";

// Hook reutilizable: anima al entrar Y se resetea al salir para que se repita
// entranceMargin: cuánto debe estar en pantalla antes de activar (negativo = más adentro)
// exitMargin: cuánto margen al salir por arriba antes de resetear
function useScrollReveal(
  threshold = 0.15,
  entranceMargin = "-8%",
  exitMargin = "200px"
) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Entró al viewport: activar animación de entrada
          setVisible(true);
        } else {
          // Salió del viewport: resetear para que la animación se repita
          setVisible(false);
        }
      },
      // rootMargin: top=exitMargin (resetea pronto al subir), bottom=entranceMargin (activa tarde al bajar)
      { threshold, rootMargin: `${exitMargin} 0px ${entranceMargin} 0px` }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, entranceMargin, exitMargin]);

  return { ref, visible };
}

export function ProductStorySection() {
  const sectionRef = useRef<HTMLElement>(null);

  // Estados para animaciones autónomas
  const [liveSaleCount, setLiveSaleCount] = useState(24);
  const [cashBalance, setCashBalance] = useState(1270000);
  const [stockLevel] = useState(48);
  const [activeDevice, setActiveDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [allowAutonomousMotion, setAllowAutonomousMotion] = useState(false);

  // Observers independientes por fila de cards
  const { ref: headerRef, visible: headerVisible } = useScrollReveal(0.3);
  const { ref: row1Ref, visible: row1Visible } = useScrollReveal(0.15);
  const { ref: row2Ref, visible: row2Visible } = useScrollReveal(0.15);
  const { ref: row3Ref, visible: row3Visible } = useScrollReveal(0.15);

  // Arrancar animaciones autónomas cuando la primera fila entra
  useEffect(() => {
    if (!row1Visible) return;
    const timer = setTimeout(() => setAllowAutonomousMotion(true), 900);
    return () => clearTimeout(timer);
  }, [row1Visible]);

  useEffect(() => {
    if (!allowAutonomousMotion) return;
    const saleInterval = setInterval(() => {
      setLiveSaleCount((p) => p + 1);
      setCashBalance((p) => p + 45000);
    }, 4200);
    const deviceInterval = setInterval(() => {
      setActiveDevice((p) =>
        p === "desktop" ? "tablet" : p === "tablet" ? "mobile" : "desktop"
      );
    }, 3500);
    return () => {
      clearInterval(saleInterval);
      clearInterval(deviceInterval);
    };
  }, [allowAutonomousMotion]);

  return (
    <section
      ref={sectionRef}
      id="capacidades"
      className="relative py-24 lg:py-32 bg-[#F8F9FD] dark:bg-[#0B0E14] text-[#0B0E14] dark:text-white transition-colors duration-300 overflow-visible"
    >
      <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
        {/* CABECERA — vuela desde abajo cuando entra al viewport */}
        <div
          ref={headerRef}
          className={`max-w-3xl mb-16 lg:mb-20 flex flex-col gap-4 scroll-fly-up ${headerVisible ? "in-view" : ""}`}
        >
          {/* 1. EYEBROW */}
          <div className="inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#ED500A]" />
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#0B0E14]/70 dark:text-white/70">
              TODO LO QUE NECESITAS
            </span>
          </div>

          {/* 2. H2 */}
          <h2 className="font-title font-extrabold text-3xl sm:text-4xl lg:text-[48px] tracking-tight leading-[1.08] text-[#0B0E14] dark:text-white">
            ¿Qué puedes hacer con NEGOVA?
          </h2>

          {/* 3. DESCRIPCIÓN */}
          <p className="font-body text-base sm:text-lg text-[#0B0E14]/75 dark:text-white/75 max-w-2xl leading-relaxed">
            Las herramientas que necesitas para organizar y hacer crecer tu negocio desde un solo lugar.
          </p>
        </div>

        {/* SWISS EDITORIAL BENTO GRID ASIMÉTRICO — cada fila tiene su propio observer */}
        {/* FILA 1: VENDE + STOCK */}
        <div ref={row1Ref} className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-stretch mb-6 sm:mb-8">
          {/* 1. VENDE (VUELA DESDE LA IZQUIERDA) */}
          <div
            className={`md:col-span-7 p-7 sm:p-9 rounded-3xl bg-white dark:bg-[#121620] border border-slate-200/80 dark:border-white/10 shadow-xl flex flex-col justify-between group hover:border-[#ED500A]/30 transition-all duration-300 relative overflow-hidden scroll-fly-left stagger-1 ${
              row1Visible ? "in-view" : ""
            }`}
          >
            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] transition-transform duration-300 group-hover:scale-105">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#ED500A] bg-[#ED500A]/10 px-3 py-1 rounded-full">
                  01 · VENDE
                </span>
              </div>

              <div>
                <h3 className="font-title font-extrabold text-2xl sm:text-3xl text-[#0B0E14] dark:text-white mb-2">
                  Registra tus ventas fácilmente
                </h3>
                <p className="font-body text-base text-[#0B0E14]/70 dark:text-white/70 max-w-xl leading-relaxed">
                  Registra cada venta, cobra y mantén el control de tus ingresos en tiempo real.
                </p>
              </div>
            </div>

            {/* VISUAL DINÁMICO AUTÓNOMO 1: COMPROBANTE & CONTADOR DE VENTA EN VIVO */}
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#F8F9FD] dark:bg-[#0B0E14] p-5 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-[#10B981] animate-ping" />
                <div>
                  <div className="font-mono text-xs font-bold text-[#0B0E14] dark:text-white">
                    Ventas del Día: #{liveSaleCount}
                  </div>
                  <div className="font-body text-xs text-[#0B0E14]/60 dark:text-white/60">
                    Comprobante digital enviado al cliente
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#10B981] bg-[#10B981]/10 px-3 py-1.5 rounded-xl justify-center sm:justify-start">
                <CheckCircle2 className="w-4 h-4" />
                <span>Pago Recibido $45.000</span>
              </div>
            </div>
          </div>

          {/* 2. STOCK (VUELA DESDE LA DERECHA) */}
          <div
            className={`md:col-span-5 p-7 sm:p-9 rounded-3xl bg-white dark:bg-[#121620] border border-slate-200/80 dark:border-white/10 shadow-xl flex flex-col justify-between group hover:border-[#ED500A]/30 transition-all duration-300 relative overflow-hidden scroll-fly-right stagger-2 ${
              row1Visible ? "in-view" : ""
            }`}
          >
            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] transition-transform duration-300 group-hover:scale-105">
                  <PackageCheck className="w-6 h-6" />
                </div>
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#0B0E14]/50 dark:text-white/50">
                  02 · STOCK
                </span>
              </div>

              <div>
                <h3 className="font-title font-extrabold text-xl sm:text-2xl text-[#0B0E14] dark:text-white mb-2">
                  Siempre sabes qué tienes
                </h3>
                <p className="font-body text-sm sm:text-base text-[#0B0E14]/70 dark:text-white/70 leading-relaxed">
                  Conoce tus existencias, identifica productos de mayor movimiento y evita quedarte sin stock.
                </p>
              </div>
            </div>

            {/* VISUAL DINÁMICO AUTÓNOMO 2: NIVELES DE STOCK EN TIEMPO REAL */}
            <div className="mt-8 p-4 rounded-2xl bg-[#F8F9FD] dark:bg-[#0B0E14] border border-slate-200/60 dark:border-white/5 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#0B0E14]/70 dark:text-white/70">Zapatillas Urban Runner</span>
                <span className="font-bold text-[#10B981]">{stockLevel} disponibles</span>
              </div>
              <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-[#10B981] rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(stockLevel * 1.5, 100)}%` }}
                />
              </div>
            </div>
          </div>

        </div>

        {/* FILA 2: CAJA + CLIENTES */}
        <div ref={row2Ref} className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-stretch mb-6 sm:mb-8">
          {/* 3. ADMINISTRA TU CAJA (VUELA DESDE LA IZQUIERDA + BORDE ORBITAL PERPETUO) */}
          <div
            className={`md:col-span-5 p-7 sm:p-9 rounded-3xl bg-white dark:bg-[#121620] border border-slate-200/80 dark:border-white/10 shadow-xl flex flex-col justify-between group hover:border-[#ED500A]/30 transition-all duration-300 relative overflow-hidden border-glow-card scroll-fly-left stagger-1 ${
              row2Visible ? "in-view" : ""
            }`}
          >
            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] transition-transform duration-300 group-hover:scale-105">
                  <CreditCard className="w-6 h-6" />
                </div>
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#0B0E14]/50 dark:text-white/50">
                  03 · CAJA
                </span>
              </div>

              <div>
                <h3 className="font-title font-extrabold text-xl sm:text-2xl text-[#0B0E14] dark:text-white mb-2">
                  Ten tus cuentas claras
                </h3>
                <p className="font-body text-sm sm:text-base text-[#0B0E14]/70 dark:text-white/70 leading-relaxed">
                  Registra ingresos y gastos y conoce cuánto dinero tienes realmente en tu negocio.
                </p>
              </div>
            </div>

            {/* VISUAL DINÁMICO AUTÓNOMO 3: SALDO DE CAJA REAL */}
            <div className="mt-8 p-4 rounded-2xl bg-[#F8F9FD] dark:bg-[#0B0E14] border border-slate-200/60 dark:border-white/5 flex items-center justify-between">
              <div>
                <div className="font-mono text-[11px] uppercase text-[#0B0E14]/50 dark:text-white/50">
                  Efectivo en Caja
                </div>
                <div className="font-title font-extrabold text-xl text-[#ED500A]">
                  ${cashBalance.toLocaleString("es-CO")} COP
                </div>
              </div>
              <span className="font-mono text-xs font-bold text-[#10B981] bg-[#10B981]/10 px-2.5 py-1 rounded-full">
                Cuadrada
              </span>
            </div>
          </div>

          {/* 4. CONOCE A TUS CLIENTES (VUELA DESDE LA DERECHA + BORDE ORBITAL PERPETUO) */}
          <div
            className={`md:col-span-7 p-7 sm:p-9 rounded-3xl bg-white dark:bg-[#121620] border border-slate-200/80 dark:border-white/10 shadow-xl flex flex-col justify-between group hover:border-[#ED500A]/30 transition-all duration-300 relative overflow-hidden border-glow-card scroll-fly-right stagger-2 ${
              row2Visible ? "in-view" : ""
            }`}
          >
            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] transition-transform duration-300 group-hover:scale-105">
                  <UserCheck className="w-6 h-6" />
                </div>
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#0B0E14]/50 dark:text-white/50">
                  04 · CLIENTES
                </span>
              </div>

              <div>
                <h3 className="font-title font-extrabold text-2xl sm:text-3xl text-[#0B0E14] dark:text-white mb-2">
                  Construye mejores relaciones
                </h3>
                <p className="font-body text-base text-[#0B0E14]/70 dark:text-white/70 max-w-xl leading-relaxed">
                  Guarda información, historial de compras y cuentas pendientes de tus clientes.
                </p>
              </div>
            </div>

            {/* VISUAL DINÁMICO AUTÓNOMO 4: PERFIL Y CREDITOS DE CLIENTE */}
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#F8F9FD] dark:bg-[#0B0E14] border border-slate-200/60 dark:border-white/5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#ED500A] text-white flex items-center justify-center font-bold text-xs shrink-0">
                  AM
                </div>
                <div>
                  <div className="font-title font-bold text-xs text-[#0B0E14] dark:text-white">
                    Andrea Morales
                  </div>
                  <div className="font-body text-[11px] text-[#10B981]">
                    12 compras · Cliente Fiel
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F8F9FD] dark:bg-[#0B0E14] border border-slate-200/60 dark:border-white/5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  RG
                </div>
                <div>
                  <div className="font-title font-bold text-xs text-[#0B0E14] dark:text-white">
                    Roberto Gómez
                  </div>
                  <div className="font-body text-[11px] text-amber-500">
                    Crédito $85.000 (Al día)
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* FILA 3: ANLÍTICA + ACCESO TOTAL */}
        <div ref={row3Ref} className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-stretch">
          {/* 5. ANALIZA TU NEGOCIO (VUELA DESDE LA IZQUIERDA) */}
          <div
            className={`md:col-span-6 p-7 sm:p-9 rounded-3xl bg-white dark:bg-[#121620] border border-slate-200/80 dark:border-white/10 shadow-xl flex flex-col justify-between group hover:border-[#ED500A]/30 transition-all duration-300 relative overflow-hidden border-glow-card scroll-fly-left stagger-1 ${
              row3Visible ? "in-view" : ""
            }`}
          >
            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] transition-transform duration-300 group-hover:scale-105">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#0B0E14]/50 dark:text-white/50">
                  05 · ANALÍTICA
                </span>
              </div>

              <div>
                <h3 className="font-title font-extrabold text-xl sm:text-2xl text-[#0B0E14] dark:text-white mb-2">
                  Decide con información real
                </h3>
                <p className="font-body text-sm sm:text-base text-[#0B0E14]/70 dark:text-white/70 leading-relaxed">
                  Consulta indicadores y reportes que te ayudan a entender cómo está funcionando tu negocio.
                </p>
              </div>
            </div>

            {/* VISUAL DINÁMICO AUTÓNOMO 5: GRÁFICO DE TENDENCIA MINIMALISTA */}
            <div className="mt-8 p-4 rounded-2xl bg-[#F8F9FD] dark:bg-[#0B0E14] border border-slate-200/60 dark:border-white/5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-bold text-[#0B0E14] dark:text-white">
                  Crecimiento Mensual
                </span>
                <span className="font-mono font-bold text-[#10B981] flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  +28% este mes
                </span>
              </div>
              {/* Micro-barras visuales de gráfico */}
              <div className="flex items-end gap-2 h-12 pt-2">
                <div className="w-full bg-[#ED500A]/20 h-[35%] rounded-t" />
                <div className="w-full bg-[#ED500A]/30 h-[50%] rounded-t" />
                <div className="w-full bg-[#ED500A]/50 h-[65%] rounded-t" />
                <div className="w-full bg-[#ED500A]/70 h-[80%] rounded-t" />
                <div className="w-full bg-[#ED500A] h-[100%] rounded-t" />
              </div>
            </div>
          </div>

          {/* 6. ACCEDE DESDE CUALQUIER LUGAR (VUELA DESDE LA DERECHA) */}
          <div
            className={`md:col-span-6 p-7 sm:p-9 rounded-3xl bg-white dark:bg-[#121620] border border-slate-200/80 dark:border-white/10 shadow-xl flex flex-col justify-between group hover:border-[#ED500A]/30 transition-all duration-300 relative overflow-hidden border-glow-card scroll-fly-right stagger-2 ${
              row3Visible ? "in-view" : ""
            }`}
          >
            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] transition-transform duration-300 group-hover:scale-105">
                  <Smartphone className="w-6 h-6" />
                </div>
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#0B0E14]/50 dark:text-white/50">
                  06 · ACCESO TOTAL
                </span>
              </div>

              <div>
                <h3 className="font-title font-extrabold text-xl sm:text-2xl text-[#0B0E14] dark:text-white mb-2">
                  Tu negocio siempre contigo
                </h3>
                <p className="font-body text-sm sm:text-base text-[#0B0E14]/70 dark:text-white/70 leading-relaxed">
                  Administra tu negocio desde computador, tablet o celular.
                </p>
              </div>
            </div>

            {/* VISUAL DINÁMICO AUTÓNOMO 6: CONMUTADOR MULTIDISPOSITIVO */}
            <div className="mt-8 p-4 rounded-2xl bg-[#F8F9FD] dark:bg-[#0B0E14] border border-slate-200/60 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono">
                <span
                  className={`px-3 py-1 rounded-xl transition-all font-bold ${
                    activeDevice === "desktop"
                      ? "bg-[#ED500A] text-white"
                      : "text-[#0B0E14]/60 dark:text-white/60"
                  }`}
                >
                  Computador
                </span>
                <span
                  className={`px-3 py-1 rounded-xl transition-all font-bold ${
                    activeDevice === "tablet"
                      ? "bg-[#ED500A] text-white"
                      : "text-[#0B0E14]/60 dark:text-white/60"
                  }`}
                >
                  Tablet
                </span>
                <span
                  className={`px-3 py-1 rounded-xl transition-all font-bold ${
                    activeDevice === "mobile"
                      ? "bg-[#ED500A] text-white"
                      : "text-[#0B0E14]/60 dark:text-white/60"
                  }`}
                >
                  Celular
                </span>
              </div>
              <Sparkles className="w-4 h-4 text-[#ED500A] animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
