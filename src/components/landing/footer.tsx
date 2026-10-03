"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Mail, ArrowUpRight } from "lucide-react";

// Correo genérico de contacto centralizado para fácil configuración
export const NEGOVA_CONTACT_EMAIL = "hola@negova.app";

function useScrollReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold, rootMargin: "0px 0px -15% 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

// ── ICONOS OFICIALES SVG DE REDES SOCIALES (100% Compatibles y Reconocibles) ──
function FacebookIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
    </svg>
  );
}

function InstagramIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
    </svg>
  );
}

function TikTokIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64c.29 0 .56.05.82.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 003 15.68 6.34 6.34 0 009.34 22a6.34 6.34 0 006.33-6.32V9.05a8.16 8.16 0 004.92 1.62V7.22a4.84 4.84 0 01-1-.53z" />
    </svg>
  );
}

function LinkedInIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
    </svg>
  );
}

function YouTubeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

// Enlaces oficiales de Redes Sociales
const SOCIAL_LINKS = [
  {
    name: "Facebook",
    href: "https://facebook.com/negova.app",
    icon: FacebookIcon,
  },
  {
    name: "Instagram",
    href: "https://instagram.com/negova.app",
    icon: InstagramIcon,
  },
  {
    name: "TikTok",
    href: "https://tiktok.com/@negova.app",
    icon: TikTokIcon,
  },
  {
    name: "LinkedIn",
    href: "https://linkedin.com/company/negova",
    icon: LinkedInIcon,
  },
  {
    name: "YouTube",
    href: "https://youtube.com/@negova",
    icon: YouTubeIcon,
  },
];

export function Footer() {
  const { ref, visible } = useScrollReveal(0.1);

  return (
    <footer
      ref={ref}
      id="contacto"
      className="relative bg-[#0B0E14] text-white border-t border-white/10 pt-20 pb-12 overflow-hidden"
    >
      {/* Luz ambiental sutil */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute bottom-0 right-0 w-[600px] h-[300px] bg-gradient-to-tl from-[#ED500A]/10 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        
        {/* ── BLOQUE PRINCIPAL EDITORIAL ── */}
        <div
          className={`grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 pb-16 border-b border-white/10 transition-all duration-700 ease-out ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          
          {/* COLUMNA IZQUIERDA: IMAGOTIPO NEGOVA + DESCRIPCIÓN + CONTACTO + REDES */}
          <div className="lg:col-span-4 space-y-6">
            <Link
              href="/"
              className="group inline-flex items-center gap-3 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#ED500A] rounded-sm"
              aria-label="NEGOVA Inicio"
            >
              <div className="relative w-9 h-9 flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
                <Image
                  src="/isotipo.png"
                  alt="Imagotipo NEGOVA"
                  width={36}
                  height={36}
                  className="object-contain rounded-[6px]"
                />
              </div>
              <span className="font-title font-black text-2xl tracking-tight text-white uppercase">
                NEGOVA
              </span>
            </Link>

            <p className="font-body text-sm text-slate-400 leading-relaxed max-w-[38ch]">
              NEGOVA ayuda a pequeños y medianos negocios a organizar sus ventas, inventario, caja y operación desde un solo lugar.
            </p>

            {/* Bloque de Contacto Directo */}
            <div className="pt-2">
              <span className="font-mono text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                ¿TIENES ALGUNA PREGUNTA?
              </span>
              <a
                href={`mailto:${NEGOVA_CONTACT_EMAIL}`}
                className="inline-flex items-center gap-2 text-sm font-title font-bold text-[#ED500A] hover:text-[#F36320] transition-colors group cursor-pointer"
              >
                <Mail className="w-4 h-4 text-[#ED500A]" />
                <span>{NEGOVA_CONTACT_EMAIL}</span>
                <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
            </div>

            {/* Bloque de Redes Sociales */}
            <div className="pt-2">
              <span className="font-mono text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
                SÍGUENOS
              </span>
              <div className="flex items-center gap-3">
                {SOCIAL_LINKS.map((soc) => {
                  const Icon = soc.icon;
                  return (
                    <a
                      key={soc.name}
                      href={soc.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Síguenos en ${soc.name}`}
                      className="p-2.5 rounded-full bg-white/5 hover:bg-[#ED500A] text-slate-300 hover:text-white border border-white/10 hover:border-[#ED500A] transition-all duration-300 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#ED500A] cursor-pointer"
                    >
                      <Icon className="w-4 h-4" />
                    </a>
                  );
                })}
              </div>
            </div>

          </div>

          {/* COLUMNA DERECHA: 4 COLUMNAS DE NAVEGACIÓN ORGANIZADA */}
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-8">
            
            {/* Columna 1: NEGOVA */}
            <div className="space-y-4">
              <h4 className="font-mono text-xs font-bold text-[#ED500A] uppercase tracking-wider">
                NEGOVA
              </h4>
              <ul className="space-y-2.5 font-body text-xs text-slate-400">
                <li>
                  <Link href="/" className="hover:text-white transition-colors">
                    Inicio
                  </Link>
                </li>
                <li>
                  <Link href="/#historias" className="hover:text-white transition-colors">
                    Funcionalidades
                  </Link>
                </li>
                <li>
                  <Link href="/#directorio" className="hover:text-white transition-colors">
                    Categorías
                  </Link>
                </li>
                <li>
                  <Link href="/#precios" className="hover:text-white transition-colors">
                    Planes
                  </Link>
                </li>
                <li>
                  <Link href="/blog" className="hover:text-white transition-colors">
                    Blog
                  </Link>
                </li>
                <li>
                  <a href={`mailto:${NEGOVA_CONTACT_EMAIL}`} className="hover:text-white transition-colors">
                    Contacto
                  </a>
                </li>
              </ul>
            </div>

            {/* Columna 2: Funcionalidades */}
            <div className="space-y-4">
              <h4 className="font-mono text-xs font-bold text-[#ED500A] uppercase tracking-wider">
                FUNCIONALIDADES
              </h4>
              <ul className="space-y-2.5 font-body text-xs text-slate-400">
                <li>
                  <Link href="/funcionalidades/inventario" className="hover:text-white transition-colors">
                    Control de inventarios
                  </Link>
                </li>
                <li>
                  <Link href="/funcionalidades/ventas-pos" className="hover:text-white transition-colors">
                    Registro de ventas y gastos
                  </Link>
                </li>
                <li>
                  <Link href="/funcionalidades/reportes" className="hover:text-white transition-colors">
                    Reportes y estadísticas
                  </Link>
                </li>
                <li>
                  <Link href="/funcionalidades/catalogo" className="hover:text-white transition-colors">
                    Catálogo de productos
                  </Link>
                </li>
                <li>
                  <Link href="/funcionalidades/clientes-fiados" className="hover:text-white transition-colors">
                    Gestión de clientes y fiados
                  </Link>
                </li>
                <li>
                  <Link href="/funcionalidades/arqueo-caja" className="hover:text-white transition-colors">
                    Arqueo y control de caja
                  </Link>
                </li>
              </ul>
            </div>

            {/* Columna 3: Negocios */}
            <div className="space-y-4">
              <h4 className="font-mono text-xs font-bold text-[#ED500A] uppercase tracking-wider">
                NEGOCIOS
              </h4>
              <ul className="space-y-2.5 font-body text-xs text-slate-400">
                <li>
                  <Link href="/#directorio" className="hover:text-white transition-colors">
                    Gastronomía
                  </Link>
                </li>
                <li>
                  <Link href="/#directorio" className="hover:text-white transition-colors">
                    Comercio
                  </Link>
                </li>
                <li>
                  <Link href="/#directorio" className="hover:text-white transition-colors">
                    Servicios
                  </Link>
                </li>
                <li>
                  <Link href="/#directorio" className="hover:text-white transition-colors">
                    Mercados
                  </Link>
                </li>
              </ul>
            </div>

            {/* Columna 4: Información Legal */}
            <div className="space-y-4">
              <h4 className="font-mono text-xs font-bold text-[#ED500A] uppercase tracking-wider">
                INFORMACIÓN
              </h4>
              <ul className="space-y-2.5 font-body text-xs text-slate-400">
                <li>
                  <Link href="/#faq" className="hover:text-white transition-colors">
                    Preguntas frecuentes
                  </Link>
                </li>
                <li>
                  <Link href="/#precios" className="hover:text-white transition-colors">
                    Planes y precios
                  </Link>
                </li>
                <li>
                  <a href={`mailto:${NEGOVA_CONTACT_EMAIL}`} className="hover:text-white transition-colors">
                    Contacto directo
                  </a>
                </li>
              </ul>
            </div>

          </div>

        </div>

        {/* ── FOOTER INFERIOR LEGAL ── */}
        <div
          className={`pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-slate-400 transition-all duration-700 delay-200 ease-out ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <div>
            © 2026 NEGOVA. Todos los derechos reservados.
          </div>

          <div className="flex items-center gap-6">
            <span className="hover:text-[#ED500A] transition-colors cursor-pointer">
              Términos y condiciones
            </span>
            <span className="hover:text-[#ED500A] transition-colors cursor-pointer">
              Política de privacidad
            </span>
          </div>
        </div>

      </div>
    </footer>
  );
}
