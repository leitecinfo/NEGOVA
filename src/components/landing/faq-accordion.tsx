"use client";

import React, { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

export function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: "¿Qué es NEGOVA y cómo funciona?",
      a: "NEGOVA es la plataforma integral de gestión comercial diseñada para pequeñas y medianas empresas. Te permite registrar ventas, controlar inventarios automáticamente, gestionar compras, clientes, deudas y generar reportes financieros en tiempo real desde celular o computador.",
    },
    {
      q: "¿Necesito conexión permanente a internet para usar NEGOVA?",
      a: "NEGOVA permite registrar ventas e inventarios sin interrupciones. En cuanto recuperas la señal, todos tus datos se sincronizan de forma segura en la nube con Supabase.",
    },
    {
      q: "¿Puedo usar NEGOVA en celular y computador al mismo tiempo?",
      a: "Sí. Con el Plan Pro puedes abrir tu negocio simultáneamente en múltiples celulares de tus vendedores o en el computador de la caja registradora sin costo adicional.",
    },
    {
      q: "¿Cómo ayuda NEGOVA a evitar pérdidas de inventario?",
      a: "Cada vez que registras una venta, el stock disminuye en tiempo real. Si vendes productos con tallas, colores o recetas (ingredientes), el sistema descuenta exactamente cada variante evitándote conteos manuales.",
    },
    {
      q: "¿Es seguro guardar la información de mi negocio en NEGOVA?",
      a: "Máxima seguridad garantizada. Utilizamos autenticación de nivel bancario con cookies HttpOnly, cifrado SSL de punto a punto e infraestructura distribuida para asegurar que solo tú y tus empleados autorizados tengan acceso.",
    },
    {
      q: "¿Cómo funciona la prueba gratuita de 30 días?",
      a: "Puedes registrarte en 1 minuto ingresando tu número de celular. Tendrás acceso ilimitado a todas las funciones del Plan Pro durante 30 días sin ingresar tarjetas de crédito ni firmar contratos.",
    },
  ];

  return (
    <section id="faq" className="py-24 bg-white dark:bg-[#0B0E14]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono font-bold">
            <HelpCircle className="w-4 h-4 text-[#ED500A]" />
            <span>Resolvemos tus dudas</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold font-title text-[#0B0E14] dark:text-white">
            Preguntas Frecuentes sobre NEGOVA
          </h2>
          <p className="text-slate-600 dark:text-slate-400 font-body">
            Todo lo que necesitas saber antes de empezar.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden transition-all bg-[#F8F9FD] dark:bg-[#0B0E14]"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 font-title font-bold text-base sm:text-lg text-[#0B0E14] dark:text-white hover:text-[#ED500A] transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 shrink-0 text-[#ED500A] transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-2 text-sm sm:text-base text-slate-600 dark:text-slate-300 font-body leading-relaxed border-t border-slate-200/60 dark:border-slate-800/60">
                    {faq.a}
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
