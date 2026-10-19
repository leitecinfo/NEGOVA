"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  UtensilsCrossed,
  ShoppingBag,
  Wrench,
  Store,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

export function CategoryTabs() {
  const [activeTab, setActiveTab] = useState<"gastronomicos" | "comercios" | "servicios" | "mercados">("gastronomicos");

  const categories = {
    gastronomicos: {
      title: "Sistema de gestión para negocios gastronómicos",
      subtitle: "La forma más fácil para la gestión de tu restaurante: menú, mesas, recetas e inventarios de insumos.",
      icon: <UtensilsCrossed className="w-6 h-6 text-[#ED500A]" />,
      types: ["Restaurantes", "Cafés", "Bares", "Comida rápida", "Licoreras", "Panaderías"],
      description:
        "El Sistema POS NEGOVA es la solución ideal para negocios gastronómicos. Gestiona inventarios de insumos por gramaje o porción, controla costos de ingredientes, organiza el servicio a la mesa y calcula márgenes de ganancia en tiempo real.",
      highlights: [
        "Menú digital y modificación rápida de platos",
        "Control de recetas y costeo automático por ingrediente",
        "Gestión de comandas y mesas integradas",
        "Centralización de pedidos a domicilio",
      ],
    },
    comercios: {
      title: "Sistema de gestión para comercios y tiendas retail",
      subtitle: "Stock, ventas y promociones sin complicaciones desde cualquier dispositivo.",
      icon: <ShoppingBag className="w-6 h-6 text-blue-600" />,
      types: [
        "Tiendas de ropa",
        "Calzado y zapaterías",
        "Ferreterías",
        "Artículos para el hogar",
        "Tiendas de regalos",
        "Accesorios",
      ],
      description:
        "Para comercios retail, NEGOVA ofrece un sistema POS completo que maneja múltiples proveedores, códigos de barras y variantes avanzadas por talla, color y modelo en tiempo real.",
      highlights: [
        "Catálogo con variantes infinitas por talla y color",
        "Escaneo rápido con lector de código de barras",
        "Promociones y descuentos en 1-clic",
        "Catálogo digital para compartir por WhatsApp",
      ],
    },
    servicios: {
      title: "Sistema de gestión para empresas de servicios",
      subtitle: "Control total de clientes, agenda de trabajo, proveedores y rentabilidad por proyecto.",
      icon: <Wrench className="w-6 h-6 text-emerald-600" />,
      types: [
        "Talleres mecánicos y automotriz",
        "Salones de belleza y estética",
        "Servicios de salud y clínicas",
        "Servicios profesionales",
        "Veterinarias",
      ],
      description:
        "NEGOVA funciona como un sistema integral para administrar clientes, controlar horas o servicios prestados, comisiones de empleados e insumos asociados al servicio.",
      highlights: [
        "Directorio de clientes y registro de historial",
        "Control de comisiones de empleados por servicio",
        "Gestión de cuentas por cobrar y abonados",
        "Asignación de materiales e insumos utilizados",
      ],
    },
    mercados: {
      title: "Sistema de gestión para mercados y víveres",
      subtitle: "Control total de volumen, peso, precios por kilo/unidad e inventario precargado.",
      icon: <Store className="w-6 h-6 text-purple-600" />,
      types: [
        "Minimercados",
        "Supermercados de barrio",
        "Charcuterías",
        "Frutas y verduras",
        "Distribuidor mayorista",
      ],
      description:
        "Diseñado para alta rotación. Permite vender por gramos, kilos o unidades, usar lector de código de barras y plantilla de inventario masivo precargado.",
      highlights: [
        "Venta por peso (kilos/gramos) y unidades",
        "Plantilla de inventario masivo desde Excel",
        "Control estricto de caja e impresiones de ticket",
        "Registro de créditos a clientes habituales",
      ],
    },
  };

  const current = categories[activeTab];

  return (
    <section id="categorias" className="py-24 bg-white dark:bg-[#0D0F16] border-y border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold font-title text-[#0B0E14] dark:text-white">
            Diseñado para Cada Tipo de Negocio
          </h2>
          <p className="text-slate-600 dark:text-slate-400 font-body">
            Soluciones adaptadas a las reglas operativas de tu industria.
          </p>

          {/* TABS DE SELECCIÓN DE CATEGORÍA */}
          <div className="flex flex-wrap justify-center gap-2 pt-4">
            {(
              [
                { id: "gastronomicos", label: "Gastronómicos" },
                { id: "comercios", label: "Comercios Retail" },
                { id: "servicios", label: "Servicios" },
                { id: "mercados", label: "Mercados & Víveres" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-6 rounded-xl font-title font-bold text-sm transition-all ${
                  activeTab === tab.id
                    ? "bg-[#0B0E14] dark:bg-white text-white dark:text-[#0B0E14] shadow-md scale-105"
                    : "bg-[#F8F9FD] dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* CONTENIDO DINÁMICO DE LA CATEGORÍA SELECCIONADA */}
        <div className="bg-[#F8F9FD] dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-12 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 shadow-sm">
                {current.icon}
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold font-title text-[#0B0E14] dark:text-white">
                {current.title}
              </h3>
            </div>

            <p className="text-slate-600 dark:text-slate-300 font-body leading-relaxed text-sm sm:text-base">
              {current.description}
            </p>

            <div className="space-y-3 pt-2">
              {current.highlights.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <CheckCircle2 className="w-5 h-5 text-[#ED500A] shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="pt-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#ED500A] hover:bg-[#ab3500] text-white font-title font-bold text-sm shadow-md transition-colors"
              >
                <span>Probar para mi negocio</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* LISTA DE NICHOS ESPECÍFICOS */}
          <div className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
            <h4 className="font-title font-bold text-sm text-slate-400 uppercase tracking-wider">
              Tipos de establecimientos compatibles:
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {current.types.map((type, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[#F8F9FD] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono font-semibold text-center text-slate-700 dark:text-slate-200 hover:border-[#ED500A] transition-colors"
                >
                  {type}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
