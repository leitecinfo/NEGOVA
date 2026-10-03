"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Navbar } from "@/components/landing/navbar";
import { FAQ_ITEMS, FAQ_CLUSTERS, FaqItem } from "@/data/faq-data";
import {
  Search,
  Plus,
  Minus,
  ArrowLeft,
  MessageCircle,
  HelpCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  X,
} from "lucide-react";

export default function PreguntasFrecuentesPage() {
  const [selectedCluster, setSelectedCluster] = useState<string>("todas");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({
    "que-es-negova": true,
    "control-inventario-manual": true,
  });

  const toggleItem = (id: string) => {
    setOpenIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filtrado reactivo por categoría y buscador
  const filteredItems = useMemo(() => {
    return FAQ_ITEMS.filter((item) => {
      const matchesCluster =
        selectedCluster === "todas" || item.clusterId === selectedCluster;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === "" ||
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.clusterName.toLowerCase().includes(q);

      return matchesCluster && matchesSearch;
    });
  }, [selectedCluster, searchQuery]);

  // Generación de Structured Data JSON-LD para SEO y AI Overviews
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-[#F8F9FD] text-[#0B0E14] flex flex-col justify-between">
      {/* Structured Data FAQPage para motores de búsqueda e IA */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Navbar />

      <main className="grow pt-28 pb-24">
        {/* ── 1. HERO PÁGINA DEDICADA ── */}
        <section className="relative py-12 sm:py-16 overflow-hidden">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-mono font-bold text-slate-500 hover:text-[#ED500A] transition-colors mb-6 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a la landing</span>
            </Link>

            <span className="block font-mono text-xs font-semibold tracking-widest text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20 w-max mx-auto mb-4">
              CENTRO DE AYUDA
            </span>

            <h1 className="font-title font-black text-3xl sm:text-5xl text-[#0B0E14] mb-4 tracking-tight">
              Preguntas frecuentes
            </h1>

            <p className="font-body text-base sm:text-lg text-slate-600 leading-relaxed max-w-[65ch] mx-auto mb-10">
              Encuentra respuestas claras sobre NEGOVA, sus funciones, planes y la forma en que puede ayudarte a gestionar tu negocio.
            </p>

            {/* Buscador interactivo en vivo */}
            <div className="relative max-w-xl mx-auto mb-8">
              <div className="relative flex items-center">
                <Search className="absolute left-4 w-5 h-5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Busca una pregunta... (ej. ¿Cómo puedo controlar mi inventario?)"
                  className="w-full pl-12 pr-10 py-4 rounded-2xl bg-white border border-slate-200 shadow-sm font-body text-sm text-[#0B0E14] placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A] transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3.5 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Filtros de Categorías / Clusters */}
            <div className="flex flex-wrap items-center justify-center gap-2 max-w-3xl mx-auto">
              <button
                onClick={() => setSelectedCluster("todas")}
                className={`px-4 py-2 rounded-full font-mono text-xs font-bold transition-all cursor-pointer ${
                  selectedCluster === "todas"
                    ? "bg-[#ED500A] text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
                }`}
              >
                Todas ({FAQ_ITEMS.length})
              </button>

              {FAQ_CLUSTERS.map((c) => {
                const count = FAQ_ITEMS.filter((item) => item.clusterId === c.id).length;
                const isSelected = selectedCluster === c.id;

                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCluster(c.id)}
                    className={`px-4 py-2 rounded-full font-mono text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#ED500A] text-white shadow-xs"
                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
                    }`}
                  >
                    {c.name} ({count})
                  </button>
                );
              })}
            </div>

          </div>
        </section>

        {/* ── 2. LISTADO DE PREGUNTAS FILTRADAS ── */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          {filteredItems.length === 0 ? (
            <div className="text-center py-16 p-8 rounded-3xl bg-white border border-slate-200/80 shadow-xs">
              <HelpCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="font-title font-bold text-xl text-[#0B0E14] mb-2">
                No encontramos preguntas que coincidan con tu búsqueda.
              </h3>
              <p className="font-body text-sm text-slate-500 mb-6 max-w-md mx-auto">
                Intenta buscar con otros términos o seleccionar otra categoría de preguntas.
              </p>
              <button
                onClick={() => {
                  setSelectedCluster("todas");
                  setSearchQuery("");
                }}
                className="px-6 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-title font-bold text-xs transition-colors"
              >
                Ver todas las preguntas
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredItems.map((item) => {
                const isOpen = !!openIds[item.id];

                return (
                  <div
                    key={item.id}
                    className={`p-1 rounded-2xl transition-all duration-300 ${
                      isOpen
                        ? "bg-gradient-to-r from-[#ED500A]/30 via-slate-200 to-[#ED500A]/20 border border-[#ED500A]/30 shadow-sm"
                        : "bg-slate-200/70 hover:bg-slate-300/70 border border-slate-200/80"
                    }`}
                  >
                    <div className="rounded-[calc(1rem-0.25rem)] bg-white text-[#0B0E14] overflow-hidden">
                      
                      <button
                        onClick={() => toggleItem(item.id)}
                        aria-expanded={isOpen}
                        className="w-full flex items-center justify-between p-5 sm:p-6 text-left focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#ED500A] rounded-xl transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 pr-4">
                          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-500 group-hover:text-[#ED500A] transition-colors shrink-0">
                            {item.clusterName}
                          </span>
                          <h3 className="font-title font-extrabold text-base sm:text-lg text-[#0B0E14] group-hover:text-[#ED500A] transition-colors leading-snug">
                            {item.question}
                          </h3>
                        </div>

                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform duration-300 ${
                            isOpen
                              ? "bg-[#ED500A] text-white rotate-180"
                              : "bg-slate-100 text-slate-600 group-hover:bg-[#ED500A]/10 group-hover:text-[#ED500A]"
                          }`}
                        >
                          {isOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="px-5 pb-6 pt-1 sm:px-6 text-slate-600 font-body text-sm sm:text-base leading-relaxed border-t border-slate-100 animate-fade-in">
                          {item.answer}
                        </div>
                      )}

                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bloque final de consulta directa por WhatsApp */}
          <div className="mt-16 p-8 rounded-3xl bg-white border border-slate-200/80 shadow-sm text-center max-w-2xl mx-auto">
            <div className="p-3 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] w-max mx-auto mb-4">
              <MessageCircle className="w-6 h-6" />
            </div>
            <h3 className="font-title font-extrabold text-xl text-[#0B0E14] mb-2">
              ¿No encontraste la respuesta que buscabas?
            </h3>
            <p className="font-body text-sm text-slate-600 mb-6 leading-relaxed">
              Escríbenos directamente y te ayudaremos a resolver cualquier duda sobre cómo adaptar NEGOVA a tu negocio.
            </p>
            <a
              href="https://wa.me/?text=Hola%20NEGOVA,%20tengo%20una%20consulta%20sobre%20la%20plataforma."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-[#ED500A] hover:bg-[#F36320] text-white font-title font-bold text-sm shadow-md hover:shadow-lg transition-all duration-300 group cursor-pointer"
            >
              <span>Hablar con el equipo</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>

        </section>
      </main>

      {/* Footer minimalista */}
      <footer className="border-t border-slate-200/80 bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs font-mono text-slate-400">
          NEGOVA © 2026 · Plataforma de gestión para negocios reales.
        </div>
      </footer>
    </div>
  );
}
