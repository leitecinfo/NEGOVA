"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowUpRight, Store, ShoppingBag, Briefcase, Utensils, ChevronDown } from "lucide-react";

function useScrollReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold, rootMargin: "60px 0px -5% 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

// ── Datos Oficiales del Directorio por Categoría ──
export interface DirectoryCategory {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  links: { label: string; href: string }[];
}

export const BUSINESS_DIRECTORY: DirectoryCategory[] = [
  {
    id: "comercio",
    name: "COMERCIO",
    icon: ShoppingBag,
    description: "Tiendas de retail, especializadas y comercios al por menor.",
    links: [
      { label: "Software de gestión para ferreterías", href: "/#planes" },
      { label: "Software de gestión para floristerías", href: "/#planes" },
      { label: "Software de gestión para tiendas de ropa", href: "/#planes" },
      { label: "Software de gestión para tiendas de calzado", href: "/#planes" },
      { label: "Software de gestión para papelerías", href: "/#planes" },
      { label: "Software de gestión para tiendas de manualidades", href: "/#planes" },
      { label: "Software de gestión para tiendas de tecnología", href: "/#planes" },
      { label: "Software de gestión para tiendas de mascotas", href: "/#planes" },
    ],
  },
  {
    id: "servicios",
    name: "SERVICIOS",
    icon: Briefcase,
    description: "Establecimientos de bienestar, belleza y servicios técnicos.",
    links: [
      { label: "Software de gestión para gimnasios", href: "/#planes" },
      { label: "Software de gestión para academias", href: "/#planes" },
      { label: "Software de gestión para barberías", href: "/#planes" },
      { label: "Software de gestión para peluquerías", href: "/#planes" },
      { label: "Software de gestión para salones de belleza", href: "/#planes" },
      { label: "Software de gestión para spas", href: "/#planes" },
      { label: "Software de gestión para talleres mecánicos", href: "/#planes" },
      { label: "Software de gestión para servicios técnicos", href: "/#planes" },
    ],
  },
  {
    id: "mercados",
    name: "MERCADOS",
    icon: Store,
    description: "Minimarkets, tiendas de barrio y comercio de víveres.",
    links: [
      { label: "Software de gestión para minimercados", href: "/#planes" },
      { label: "Software de gestión para tiendas de barrio", href: "/#planes" },
      { label: "Software de gestión para kioscos", href: "/#planes" },
      { label: "Software de gestión para fruterías", href: "/#planes" },
      { label: "Software de gestión para carnicerías", href: "/#planes" },
      { label: "Software de gestión para supermercados pequeños", href: "/#planes" },
      { label: "Software de gestión para distribuidores", href: "/#planes" },
      { label: "Software de gestión para mayoristas", href: "/#planes" },
    ],
  },
  {
    id: "gastronomia",
    name: "GASTRONOMÍA",
    icon: Utensils,
    description: "Restaurantes, cafeterías y negocios de alimentos y bebidas.",
    links: [
      { label: "Software de gestión para restaurantes", href: "/#planes" },
      { label: "Software de gestión para cafeterías", href: "/#planes" },
      { label: "Software de gestión para panaderías", href: "/#planes" },
      { label: "Software de gestión para pastelerías", href: "/#planes" },
      { label: "Software de gestión para comidas rápidas", href: "/#planes" },
      { label: "Software de gestión para bares", href: "/#planes" },
      { label: "Software de gestión para gastrobares", href: "/#planes" },
      { label: "Software de gestión para pizzerías", href: "/#planes" },
    ],
  },
];

export function BusinessDirectorySection() {
  const { ref, visible } = useScrollReveal(0.1);
  const [activeTab, setActiveTab] = useState<string>("comercio");
  const [openMobileAccordion, setOpenMobileAccordion] = useState<string | null>("comercio");

  const activeCategory = BUSINESS_DIRECTORY.find((c) => c.id === activeTab) || BUSINESS_DIRECTORY[0];

  const toggleMobileCategory = (id: string) => {
    setOpenMobileAccordion((prev) => (prev === id ? null : id));
  };

  return (
    <section
      ref={ref}
      id="directorio"
      className="relative py-20 sm:py-28 bg-[#F8F9FD] text-[#0B0E14] border-t border-slate-200/80"
    >
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── 1. ENCABEZADO DISCRETO ── */}
        <div
          className={`text-center max-w-2xl mx-auto mb-12 transition-all duration-700 ease-out ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <h3 className="font-title font-extrabold text-2xl sm:text-3xl text-[#0B0E14] mb-2 tracking-tight">
            NEGOVA para tu negocio
          </h3>
          <p className="font-body text-sm sm:text-base text-slate-600 leading-relaxed">
            Descubre cómo NEGOVA puede ayudarte según el tipo de negocio que tengas.
          </p>
        </div>

        {/* ── 2. NAVEGACIÓN DESKTOP / TABLET POR TABS (4 Categorías Principales) ── */}
        <div
          className={`hidden md:block transition-all duration-700 delay-150 ease-out ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          {/* Selector Horizontal de Categorías */}
          <div className="flex items-center justify-center gap-3 mb-10 p-1.5 rounded-full bg-slate-200/70 border border-slate-300/60 max-w-3xl mx-auto">
            {BUSINESS_DIRECTORY.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeTab === cat.id;

              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(cat.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-full font-mono text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#ED500A] text-white shadow-md"
                      : "text-slate-600 hover:text-[#0B0E14] hover:bg-white/60"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>

          {/* Grilla Editorial de Enlaces de la Categoría Activa */}
          <div className="p-1.5 rounded-3xl bg-white border border-slate-200/90 shadow-sm">
            <div className="rounded-[calc(1.5rem-0.375rem)] p-8 sm:p-10 bg-white">
              
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-[#ED500A]/10 text-[#ED500A] uppercase tracking-wider">
                  SOLUCIONES PARA {activeCategory.name}
                </span>
                <p className="font-body text-xs text-slate-500">
                  {activeCategory.description}
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {activeCategory.links.map((link, lIdx) => (
                  <Link
                    key={lIdx}
                    href={link.href}
                    className="group p-3.5 rounded-2xl bg-[#F8F9FD] hover:bg-slate-100 border border-slate-200/60 transition-all duration-200 flex items-center justify-between"
                  >
                    <span className="font-body text-xs sm:text-sm font-semibold text-slate-700 group-hover:text-[#ED500A] transition-colors leading-snug">
                      {link.label}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#ED500A] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0 ml-2" />
                  </Link>
                ))}
              </div>

            </div>
          </div>
        </div>

        {/* ── 3. NAVEGACIÓN MOBILE POR ACORDEÓN COMPACTO ── */}
        <div
          className={`block md:hidden space-y-4 transition-all duration-700 delay-150 ease-out ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          {BUSINESS_DIRECTORY.map((cat) => {
            const Icon = cat.icon;
            const isOpen = openMobileAccordion === cat.id;

            return (
              <div
                key={cat.id}
                className="rounded-2xl bg-white border border-slate-200/90 shadow-xs overflow-hidden"
              >
                <button
                  onClick={() => toggleMobileCategory(cat.id)}
                  className="w-full flex items-center justify-between p-5 text-left font-mono text-xs font-bold text-[#0B0E14] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-[#ED500A]/10 text-[#ED500A]">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span>{cat.name}</span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${
                      isOpen ? "rotate-180 text-[#ED500A]" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 space-y-2.5 border-t border-slate-100 bg-[#F8F9FD]">
                    {cat.links.map((link, lIdx) => (
                      <Link
                        key={lIdx}
                        href={link.href}
                        className="block p-3 rounded-xl bg-white border border-slate-200/60 font-body text-xs font-medium text-slate-700 active:text-[#ED500A]"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
