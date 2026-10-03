"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { Navbar } from "@/components/landing/navbar";
import { BLOG_POSTS, BLOG_CATEGORIES, BlogPost } from "@/data/blog-data";
import {
  Search,
  Clock,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  X,
} from "lucide-react";

// Hook de observación de scroll bidireccional
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
        threshold: 0.05,
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

// Componente individual de tarjeta de artículo para animaciones de carga y scroll desacopladas
function BlogCard({ post, index }: { post: BlogPost; index: number }) {
  const [ref, visible] = useScrollObserver();

  return (
    <div
      ref={ref as any}
      className={`transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
        visible 
          ? "opacity-100 translate-y-0 scale-100 blur-0" 
          : "opacity-0 translate-y-12 scale-[0.98] blur-[1px]"
      }`}
      style={{ transitionDelay: `${(index % 3) * 150}ms` }}
    >
      <Link
        href={post.href}
        className="group block h-full p-1.5 rounded-3xl bg-slate-100/90 border border-slate-200/90 hover:border-[#ED500A]/40 transition-all duration-300 hover:-translate-y-1 shadow-xs"
      >
        <div className="h-full rounded-[calc(1.5rem-0.375rem)] p-6 bg-white text-[#0B0E14] flex flex-col justify-between relative overflow-hidden">
          
          <div>
            {/* Ilustración de la tarjeta */}
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden mb-5 bg-[#ED500A] border border-slate-200/80">
              {post.image ? (
                <img
                  src={post.image}
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 relative z-10"
                />
              ) : (
                <div className="absolute inset-0 bg-[#ED500A] p-5 flex flex-col justify-between text-white">
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/20 text-white w-max uppercase">
                    EDITORIAL NEGOVA
                  </span>
                  <h4 className="font-title font-bold text-base text-white line-clamp-2">
                    {post.title}
                  </h4>
                </div>
              )}
            </div>

            {/* Metadatos */}
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20">
                {post.category}
              </span>
              <div className="flex items-center gap-1.5 font-mono text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                <span>{post.readingTime}</span>
              </div>
            </div>

            {/* Título */}
            <h3 className="font-title font-bold text-lg text-[#0B0E14] mb-2 group-hover:text-[#ED500A] transition-colors leading-snug">
              {post.title}
            </h3>

            {/* Extracto */}
            <p className="font-body text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
              {post.excerpt}
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="font-title font-bold text-xs text-[#ED500A] group-hover:underline inline-flex items-center gap-1.5">
              <span>Leer artículo</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </span>
          </div>

        </div>
      </Link>
    </div>
  );
}

export default function BlogPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // Estados para controlar las animaciones del Hero
  const [loaded, setLoaded] = useState(false);
  const [heroRef, heroVisible] = useScrollObserver();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    setLoaded(true);

    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Cálculos de scroll real para salida y entrada bidireccional cinemática del Hero
  const heroTranslateY = Math.min(scrollY * 0.28, 140);
  const heroOpacity = Math.max(1 - scrollY * 0.0022, 0);

  // Filtrado reactivo por categoría y buscador
  const filteredPosts = useMemo(() => {
    return BLOG_POSTS.filter((post) => {
      const matchesCategory =
        selectedCategory === "Todos" ||
        post.category.toLowerCase().includes(selectedCategory.toLowerCase());

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === "" ||
        post.title.toLowerCase().includes(q) ||
        post.excerpt.toLowerCase().includes(q) ||
        post.category.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-[#F8F9FD] text-[#0B0E14] flex flex-col justify-between">
      <Navbar />

      <main className="grow pt-28 pb-24">
        {/* ── 1. HERO PÁGINA BLOG CON FONDO DE IMAGEN + ANIMACIÓN DE RECARGA Y SCROLL BIDIRECCIONAL ── */}
        <section 
          ref={heroRef as any}
          className="relative py-24 sm:py-32 overflow-hidden bg-[#0B0E14] text-white border-b border-slate-900"
          style={{
            backgroundImage: "url('/negova-hero-product.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* Overlay oscuro de alta gama para asegurar excelente legibilidad */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0B0E14]/90 via-[#0B0E14]/80 to-[#0B0E14]/95 backdrop-blur-[1px] pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#ED500A]/10 via-transparent to-[#3B82F6]/5 pointer-events-none" />

          <div 
            className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 transition-all duration-75 ease-out"
            style={{
              transform: `translateY(-${heroTranslateY}px)`,
              opacity: heroOpacity,
              willChange: "transform, opacity",
            }}
          >
            
            <Link
              href="/"
              className={`inline-flex items-center gap-2 text-xs font-mono font-bold text-slate-400 hover:text-[#ED500A] transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                loaded && heroVisible 
                  ? "opacity-100 translate-y-0 scale-100 blur-0" 
                  : "opacity-0 -translate-y-4 scale-95 blur-[1px]"
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a la landing</span>
            </Link>

            <span 
              className={`block font-mono text-xs font-semibold tracking-widest text-[#ED500A] uppercase px-4 py-1.5 rounded-full bg-[#ED500A]/20 border border-[#ED500A]/40 w-max mx-auto transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                loaded && heroVisible 
                  ? "opacity-100 translate-y-0 scale-100 blur-0" 
                  : "opacity-0 -translate-y-4 scale-95 blur-[1px]"
              }`}
              style={{ transitionDelay: "150ms" }}
            >
              RECURSOS Y CONOCIMIENTO
            </span>

            <h1 
              className={`font-title font-black text-4xl sm:text-6xl text-white tracking-tight leading-none transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                loaded && heroVisible 
                  ? "opacity-100 translate-y-0 scale-100 blur-0" 
                  : "opacity-0 translate-y-4 scale-[0.98] blur-[1px]"
              }`}
              style={{ transitionDelay: "300ms" }}
            >
              Blog para Negocios Reales
            </h1>

            <p 
              className={`font-body text-base sm:text-lg text-slate-300 leading-relaxed max-w-[65ch] mx-auto transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                loaded && heroVisible 
                  ? "opacity-100 translate-y-0 scale-100 blur-0" 
                  : "opacity-0 translate-y-4 scale-[0.98] blur-[1px]"
              }`}
              style={{ transitionDelay: "450ms" }}
            >
              Consejos prácticos, guías operativas e ideas para ayudarte a organizar tu negocio y tomar mejores decisiones cotidianas.
            </p>

            {/* Buscador de artículos */}
            <div 
              className={`relative max-w-xl mx-auto pt-4 transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                loaded && heroVisible 
                  ? "opacity-100 translate-y-0 scale-100 blur-0" 
                  : "opacity-0 translate-y-8 scale-[0.97] blur-[1px]"
              }`}
              style={{ transitionDelay: "600ms" }}
            >
              <div className="relative flex items-center">
                <Search className="absolute left-4 w-5 h-5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Busca un artículo... (ej. inventario, caja, ganancias)"
                  className="w-full pl-12 pr-10 py-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md font-body text-sm text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A] focus:border-transparent transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3.5 p-1 rounded-full text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Categorías */}
            <div 
              className={`flex flex-wrap items-center justify-center gap-2 max-w-3xl mx-auto pt-2 transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                loaded && heroVisible 
                  ? "opacity-100 translate-y-0 scale-100 blur-0" 
                  : "opacity-0 translate-y-8 scale-[0.97] blur-[1px]"
              }`}
              style={{ transitionDelay: "750ms" }}
            >
              {BLOG_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat;

                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-full font-mono text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#ED500A] text-white shadow-xs"
                        : "bg-white/10 text-slate-300 hover:bg-white/20 border border-white/10"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

          </div>
        </section>

        {/* ── 2. REJILLA DE ARTÍCULOS ── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          {filteredPosts.length === 0 ? (
            <div className="text-center py-16 p-8 rounded-3xl bg-white border border-slate-200/80 shadow-xs max-w-xl mx-auto">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="font-title font-bold text-xl text-[#0B0E14] mb-2">
                No encontramos artículos para tu búsqueda.
              </h3>
              <p className="font-body text-sm text-slate-500 mb-6">
                Prueba buscar otros temas como inventario, ventas o caja.
              </p>
              <button
                onClick={() => {
                  setSelectedCategory("Todos");
                  setSearchQuery("");
                }}
                className="px-6 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-title font-bold text-xs transition-colors"
              >
                Ver todos los artículos
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredPosts.map((post, index) => (
                <BlogCard key={post.id} post={post} index={index} />
              ))}
            </div>
          )}

          {/* Bloque CTA final hacia NEGOVA */}
          <div className="mt-16 p-8 sm:p-10 rounded-3xl bg-[#0B0E14] text-white border border-white/10 text-center max-w-3xl mx-auto shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#ED500A]/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <span className="font-mono text-xs font-bold text-[#ED500A] uppercase tracking-wider block mb-2">
                CONTROL REAL PARA TU NEGOCIO
              </span>
              <h3 className="font-title font-black text-2xl sm:text-3xl text-white mb-3">
                Organiza tu operación con NEGOVA.
              </h3>
              <p className="font-body text-sm text-slate-300 mb-6 max-w-xl mx-auto leading-relaxed">
                Prueba la plataforma durante 30 días gratis con el plan Inicio y descubre lo sencillo que es llevar tu negocio sin complicaciones.
              </p>
              <Link
                href="/#planes"
                className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-[#ED500A] hover:bg-[#F36320] text-white font-title font-bold text-sm shadow-lg shadow-[#ED500A]/20 transition-all duration-300 group cursor-pointer"
              >
                <span>Probar 30 días gratis</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

        </section>
      </main>

      {/* Footer minimalista */}
      <footer className="border-t border-slate-200/80 bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs font-mono text-slate-400">
          NEGOVA © 2026 · Recursos y guías para negocios reales.
        </div>
      </footer>
    </div>
  );
}
