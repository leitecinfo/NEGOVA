"use client";

import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ShoppingBag,
  Utensils,
  Briefcase,
  LayoutGrid,
  ArrowRight,
  RotateCw,
  CheckCircle2,
} from "lucide-react";

// ── Hook bidireccional responsivo y fluido ──
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

// ── Datos — 4 tipos reales de NEGOVA con Fotografía Real de Alta Calidad ──
const BUSINESS_TYPES = [
  {
    id: "gastronomicos",
    icon: Utensils,
    label: "Negocios gastronómicos",
    tagline: "Control de insumos, recetas y mesas.",
    image: "/images/negocios-gastronomia-v3.jpg",
    alt: "Cafetería y restaurante artesanal",
    subtypes: [
      "Restaurantes",
      "Cafés & Cafeterías",
      "Bares & Gastrobares",
      "Comidas rápidas",
      "Licoreras & Estancos",
      "Panaderías & Pastelerías",
    ],
    whyTitle: "¿Por qué NEGOVA?",
    description:
      "La solución ideal para gastronomía: gestiona inventarios de tus insumos, controla costos de ingredientes, organiza comandas, mesas y pedidos, y calcula márgenes de ganancia en tiempo real.",
    summaryBenefit:
      "Optimiza compras, reduce desperdicios y aumenta la rentabilidad de tu negocio gastronómico.",
    color: "#ED500A",
    index: "01",
  },
  {
    id: "comercios",
    icon: ShoppingBag,
    label: "Comercios",
    tagline: "Ventas rápidas, inventario y caja.",
    image: "/images/negocios-comercio-v3.jpg",
    alt: "Tienda moderna de ropa y retail",
    subtypes: [
      "Tiendas de ropa & calzado",
      "Ferreterías & Pinturas",
      "Papelerías & Variedades",
      "Tecnología & Celulares",
      "Minimarkets & Abarrotes",
      "Tiendas de mascotas / Pets",
    ],
    whyTitle: "¿Por qué NEGOVA?",
    description:
      "Diseñado para comercio ágil: control de inventario con código de barras, variantes de tallas/colores, arqueos de caja ciegos y facturación ultrarrápida en mostrador.",
    summaryBenefit:
      "Evita pérdidas de stock, agiliza la atención al cliente y mantén tu caja cuadrada todos los días.",
    color: "#3B82F6",
    index: "02",
  },
  {
    id: "servicios",
    icon: Briefcase,
    label: "Servicios",
    tagline: "Clientes, citas y colaboradores.",
    image: "/images/negocios-servicios-v3.jpg",
    alt: "Estudio de barbería y servicios profesionales",
    subtypes: [
      "Barberías & Peluquerías",
      "Talleres mecánicos",
      "Estéticas & Spas",
      "Servicios técnicos",
      "Lavanderías & Tintorerías",
      "Gimnasios & Fitness",
    ],
    whyTitle: "¿Por qué NEGOVA?",
    description:
      "Organiza toda tu prestación de servicios: agenda clientes, asigna comisiones automáticas por profesional, historial de atenciones y cobro ágil desde un solo lugar.",
    summaryBenefit:
      "Fideliza a tus clientes, liquida comisiones con transparencia y optimiza el tiempo de tu equipo.",
    color: "#10B981",
    index: "03",
  },
  {
    id: "mercados",
    icon: LayoutGrid,
    label: "Mercados",
    tagline: "Alta rotación, pesables y stock masivo.",
    image: "/images/negocios-mercados-v3.jpg",
    alt: "Supermercado y mercado de productos frescos",
    subtypes: [
      "Supermercados de barrio",
      "Fruterías & Verdulerías",
      "Carnicerías & Charcuterías",
      "Depósitos & Mayoristas",
      "Distribuidoras de alimentos",
      "Plazas y locales comerciales",
    ],
    whyTitle: "¿Por qué NEGOVA?",
    description:
      "Potencia para negocios de alto flujo: productos por peso y unidad, múltiples cajas sincronizadas al instante, alertas de reposición y control de fechas de vencimiento.",
    summaryBenefit:
      "Atiende filas sin demoras, reduce productos vencidos y conoce tus márgenes por categoría en tiempo real.",
    color: "#8B5CF6",
    index: "04",
  },
] as const;

type BusinessType = (typeof BUSINESS_TYPES)[number];

// ── Flip Card individual con Fotografía Real ──
function FlipCard({
  biz,
  visible,
  delay,
  animClass,
}: {
  biz: BusinessType;
  visible: boolean;
  delay: string;
  animClass: string;
}) {
  const [flipped, setFlipped] = useState(false);
  const Icon = biz.icon;

  return (
    <div
      className={`${animClass} ${visible ? "in-view" : ""}`}
      style={{ animationDelay: visible ? delay : "0s" }}
      onMouseEnter={() => setFlipped(true)}
      onMouseLeave={() => setFlipped(false)}
    >
      <div
        className="relative w-full group cursor-pointer"
        style={{ perspective: "1000px", minHeight: "540px" }}
      >
        <div
          className="relative w-full h-full transition-transform duration-500 ease-out"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            minHeight: "540px",
          }}
        >
          {/* CARA FRONTAL: Fotografía Real + Título + Sub-negocios */}
          <div
            className="absolute inset-0 rounded-3xl border border-slate-200/90 group-hover:border-[#ED500A]/50 bg-white flex flex-col justify-between overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)] group-hover:shadow-[0_16px_36px_rgba(237,80,10,0.1)] transition-all duration-300"
            style={{ backfaceVisibility: "hidden" }}
          >
            <div>
              {/* Fotografía real del negocio en perspectiva */}
              <div className="relative h-48 sm:h-52 w-full overflow-hidden rounded-t-3xl border-b border-slate-100">
                <Image
                  src={biz.image}
                  alt={biz.alt}
                  fill
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-108"
                  sizes="(max-width: 768px) 100vw, 350px"
                />

                {/* Degradado oscuro inferior para integrar y dar contraste al título */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />

                {/* Barra superior de acento */}
                <div
                  className="absolute top-0 left-0 right-0 h-[3px] z-10"
                  style={{ background: biz.color }}
                />

                {/* Header flotante sobre la foto */}
                <div className="absolute inset-x-0 top-3 px-4 flex items-center justify-between z-10">
                  <div
                    className="p-2 rounded-xl bg-white/95 backdrop-blur-md shadow-xs"
                    style={{ color: biz.color }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span
                    className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md shadow-xs"
                    style={{ color: biz.color }}
                  >
                    {biz.index}
                  </span>
                </div>

                {/* Título sobre la foto */}
                <div className="absolute inset-x-0 bottom-3 px-4 z-10">
                  <h3 className="font-title font-extrabold text-base sm:text-lg text-white leading-snug drop-shadow-xs">
                    {biz.label}
                  </h3>
                </div>
              </div>

              {/* Contenido inferior de la tarjeta */}
              <div className="p-5">
                <p className="font-body text-xs text-slate-500 leading-relaxed mb-4">
                  {biz.tagline}
                </p>

                {/* Lista vertical de ejemplos de negocios */}
                <div className="flex flex-col gap-2 pt-3 border-t border-slate-100">
                  {biz.subtypes.map((sub, sIdx) => (
                    <div key={sIdx} className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: biz.color }}
                      />
                      <span className="truncate">{sub}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pista interactiva de giro */}
            <div className="mx-5 mb-4 pt-3 border-t border-slate-100 flex items-center justify-between text-slate-400 group-hover:text-[#ED500A] transition-colors duration-200">
              <div className="flex items-center gap-1.5">
                <RotateCw className="w-3.5 h-3.5 transition-transform duration-500 group-hover:rotate-180" />
                <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">
                  Ver cómo se adapta
                </span>
              </div>
              <span className="font-mono text-[10px] font-bold">↻ Girar</span>
            </div>
          </div>

          {/* CARA TRASERA: Explicación de valor + Beneficio clave + CTA */}
          <div
            className="absolute inset-0 rounded-3xl p-6 flex flex-col justify-between overflow-hidden shadow-[0_16px_36px_rgba(237,80,10,0.12)] bg-white"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              border: `1.5px solid ${biz.color}`,
            }}
          >
            {/* Header trasero */}
            <div>
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="p-1.5 rounded-lg shrink-0"
                    style={{ background: `${biz.color}18`, color: biz.color }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <h4 className="font-title font-extrabold text-sm text-[#0B0E14] truncate">
                    {biz.whyTitle}
                  </h4>
                </div>
                <span
                  className="font-mono text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0"
                  style={{ background: `${biz.color}15`, color: biz.color }}
                >
                  100% Adaptable
                </span>
              </div>

              {/* Explicación de solución para este tipo de negocio */}
              <p className="font-body text-xs sm:text-[13px] text-slate-700 leading-relaxed mt-4">
                {biz.description}
              </p>

              {/* Beneficio destacado / ROI */}
              <div className="mt-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs font-semibold text-slate-800 leading-relaxed">
                {biz.summaryBenefit}
              </div>
            </div>

            {/* Footer con acción de inicio */}
            <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle2
                  className="w-4 h-4 shrink-0"
                  style={{ color: biz.color }}
                />
                <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  Listo para operar
                </span>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-title font-bold px-4 py-2 rounded-xl bg-[#0B0E14] text-white hover:bg-[#ED500A] transition-colors shadow-sm"
              >
                <span>Empezar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──
export function BusinessTypesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [sectionTop, setSectionTop] = useState(0);

  const { ref: headerRef, visible: headerVisible } = useScrollReveal(0.05);
  const { ref: gridRef, visible: gridVisible } = useScrollReveal(0.05);

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

  const staggerDelays = ["0.05s", "0.15s", "0.25s", "0.35s"];

  return (
    <section
      ref={sectionRef}
      id="negocios"
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
      {/* Brillo orbital naranja sutil */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(237,80,10,0.05) 0%, transparent 70%)",
          filter: "blur(90px)",
        }}
      />

      <div
        className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12 relative z-10"
        style={{
          transform: `translateY(-${sectionExitY}px)`,
          opacity: sectionExitOpacity,
        }}
      >
        {/* ── CABECERA CENTRADA EDITORIAL ── */}
        <div
          ref={headerRef}
          className={`max-w-3xl mx-auto text-center mb-16 lg:mb-20 scroll-fly-up ${headerVisible ? "in-view" : ""}`}
        >
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-[#ED500A] animate-pulse" />
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#0B0E14]/70">
              ADAPTABILIDAD TOTAL
            </span>
          </div>

          <h2 className="font-title font-extrabold text-3xl sm:text-4xl lg:text-[50px] tracking-tight leading-[1.06] text-[#0B0E14] mb-4">
            Un sistema para{" "}
            <em className="not-italic text-[#ED500A]">tu negocio</em>
          </h2>
          <p className="font-body text-base sm:text-lg text-[#0B0E14]/65 leading-relaxed max-w-2xl mx-auto">
            Sin importar qué vendas o cómo trabajes, NEGOVA se adapta a tu modelo operativo para mantener todo organizado y bajo control.
          </p>
        </div>

        {/* ── GRID DE 4 COLUMNAS CON FOTOGRAFÍA REAL ── */}
        <div
          ref={gridRef}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {BUSINESS_TYPES.map((biz, i) => (
            <FlipCard
              key={biz.id}
              biz={biz}
              visible={gridVisible}
              delay={staggerDelays[i]}
              animClass="scroll-fly-up"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
