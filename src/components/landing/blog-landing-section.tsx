"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { BLOG_POSTS } from "@/data/blog-data";
import { ArrowRight, Clock, BookOpen, Sparkles, FileText } from "lucide-react";

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

export function BlogLandingSection() {
  const { ref, visible } = useScrollReveal(0.1);

  // 3 Artículos Principales para la Landing Page
  const landingPosts = BLOG_POSTS.slice(0, 3);

  return (
    <section
      ref={ref}
      id="blog"
      className="relative py-24 sm:py-36 bg-[#F8F9FD] text-[#0B0E14] overflow-hidden border-t border-slate-200/80"
    >
      {/* Luz ambiente difusa de fondo */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[500px] bg-gradient-to-br from-[#ED500A]/5 via-transparent to-[#3B82F6]/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── 1. ENCABEZADO EDITORIAL ── */}
        <div
          className={`text-center max-w-3xl mx-auto transition-all duration-700 ease-out ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <span className="font-mono text-xs font-semibold tracking-widest text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
            RECURSOS PARA TU NEGOCIO
          </span>

          <h2 className="font-title font-black text-3xl sm:text-5xl text-[#0B0E14] mt-4 mb-3 leading-tight tracking-tight">
            Ideas para llevar mejor tu negocio.
          </h2>

          <p className="font-body text-base sm:text-lg text-slate-600 leading-relaxed max-w-[65ch] mx-auto">
            Consejos, ideas y herramientas para ayudarte a organizar tu operación y tomar mejores decisiones.
          </p>
        </div>

        {/* ── 2. REJILLA PERFECTA DE 3 TARJETAS DE ARTÍCULO (100% Texto Visible y Nítido) ── */}
        <div className="mt-14 sm:mt-18 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {landingPosts.map((post, idx) => {
            const delays = ["150ms", "300ms", "450ms"];
            const delay = delays[idx % delays.length];

            return (
              <div
                key={post.id}
                style={{ transitionDelay: visible ? delay : "0ms" }}
                className={`transition-all duration-700 ease-out ${
                  visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
                }`}
              >
                {/* Doppelrand Outer Shell */}
                <div className="h-full p-1.5 rounded-3xl bg-slate-200/80 hover:bg-slate-300/80 border border-slate-200/90 hover:border-[#ED500A]/40 transition-all duration-300 hover:-translate-y-1.5 shadow-xs group flex flex-col">
                  
                  {/* Inner Core */}
                  <div className="h-full rounded-[calc(1.5rem-0.375rem)] p-6 bg-white text-[#0B0E14] flex flex-col justify-between relative overflow-hidden">
                    
                    <div>
                      {/* Contenedor de la Imagen del Artículo */}
                      <div className="relative w-full aspect-[16/10] rounded-2xl overflow-hidden mb-5 bg-[#ED500A] border border-slate-200/80 shadow-xs shrink-0">
                        {post.image ? (
                          <img
                            src={post.image}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 relative z-10"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-[#ED500A] p-4 flex flex-col justify-between text-white">
                            <div className="flex items-center justify-between z-10">
                              <span className="font-mono text-[9.5px] font-bold px-2.5 py-0.5 rounded-full bg-black/20 text-white uppercase tracking-wider">
                                EDITORIAL NEGOVA
                              </span>
                              <BookOpen className="w-4 h-4 text-white opacity-80" />
                            </div>
                            <div className="z-10 flex items-center gap-2">
                              <FileText className="w-4 h-4 text-white/80 shrink-0" />
                              <span className="font-mono text-[11px] font-medium text-white/90 truncate">
                                RECURSOS NEGOVA
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Categoría y Tiempo de Lectura */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20">
                          {post.category}
                        </span>
                        <div className="flex items-center gap-1.5 font-mono text-xs text-slate-500">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{post.readingTime}</span>
                        </div>
                      </div>

                      {/* Título del Artículo (Nítido y Destacado) */}
                      <h3 className="font-title font-extrabold text-lg sm:text-xl text-[#0B0E14] mb-2.5 group-hover:text-[#ED500A] transition-colors leading-snug">
                        {post.title}
                      </h3>

                      {/* Extracto Explicativo (Nítido y 100% Leible) */}
                      <p className="font-body text-xs sm:text-sm text-slate-600 leading-relaxed mb-6 line-clamp-3">
                        {post.excerpt}
                      </p>
                    </div>

                    {/* CTA "Leer artículo →" */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between shrink-0">
                      <Link
                        href={post.href}
                        className="font-title font-bold text-xs sm:text-sm text-[#ED500A] group-hover:underline inline-flex items-center gap-2 cursor-pointer"
                      >
                        <span>Leer artículo</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Link>
                      <span className="font-mono text-[10.5px] text-slate-400">
                        NEGOVA Blog
                      </span>
                    </div>

                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── 3. BOTÓN ÚNICO "VER TODOS LOS ARTÍCULOS" ── */}
        <div
          className={`mt-14 text-center transition-all duration-700 delay-500 ease-out ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <Link
            href="/blog"
            className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-full bg-[#ED500A] hover:bg-[#F36320] text-white font-title font-bold text-sm shadow-md hover:shadow-lg transition-all duration-300 group cursor-pointer"
          >
            <span>Ver todos los artículos</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

      </div>
    </section>
  );
}
