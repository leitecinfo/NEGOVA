"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { FloatingWrapper } from "@/components/floating/floating-wrapper";
import { FaqLandingSection } from "@/components/landing/faq-landing-section";
import {
  Mail,
  MessageSquare,
  Phone,
  ArrowRight,
  Zap,
  TrendingUp,
  UserCheck,
  HelpCircle,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  Clock,
  Send,
  Check,
  X
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

// Modal de éxito personalizado para evitar alertas nativas (Cumple regla global)
function SuccessModal({ isOpen, onClose, userName }: { isOpen: boolean; onClose: () => void; userName: string }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div 
        className="relative w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 border border-slate-200 shadow-2xl text-center text-[#0B0E14]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#ED500A] to-[#F36320]" />
        
        <div className="mx-auto w-12 h-12 rounded-full bg-[#10B981]/15 text-[#10B981] flex items-center justify-center mb-4">
          <Check className="w-6 h-6 stroke-[3px]" />
        </div>

        <h3 className="font-title font-black text-xl mb-2 text-[#0B0E14]">
          ¡Mensaje Enviado!
        </h3>

        <p className="font-body text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
          Gracias <strong>{userName}</strong>. Hemos recibido tus datos correctamente. Un asesor del equipo de NEGOVA se pondrá en contacto contigo de forma cercana y humana.
        </p>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-full bg-[#0B0E14] hover:bg-[#ED500A] text-white font-title font-bold text-sm transition-colors cursor-pointer"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

export default function ContactoPage() {
  const [loaded, setLoaded] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  // Refs de scroll reveal para cada sección
  const [heroRef, heroVisible] = useScrollObserver();
  const [channelsRef, channelsVisible] = useScrollObserver();
  const [directRef, directVisible] = useScrollObserver();
  const [storyRef, storyVisible] = useScrollObserver();
  const [trustRef, trustVisible] = useScrollObserver();

  // Estados del Formulario
  const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    consulta: "Soporte",
    mensaje: ""
  });
  const [showSuccess, setShowSuccess] = useState(false);

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
  const textTranslateY = Math.min(scrollY * 0.28, 140);
  const textOpacity = Math.max(1 - scrollY * 0.0022, 0);

  const visualTranslateY = Math.min(scrollY * 0.16, 95);
  const visualScale = Math.max(1 - scrollY * 0.00022, 0.94);
  const visualOpacity = Math.max(1 - scrollY * 0.0018, 0);

  // Handlers del Formulario
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre || !formData.email || !formData.mensaje) return;
    setShowSuccess(true);
  };

  const handleCloseSuccess = () => {
    setShowSuccess(false);
    setFormData({
      nombre: "",
      email: "",
      consulta: "Soporte",
      mensaje: ""
    });
  };



  // WhatsApp e información general
  const contactGeneralUrl = `https://wa.me/573114245409?text=${encodeURIComponent(
    "Hola NEGOVA, necesito ayuda y orientación para mi negocio. Me gustaría hablar con un asesor."
  )}`;

  const contactSupportUrl = `https://wa.me/573114245409?text=${encodeURIComponent(
    "Hola NEGOVA, necesito soporte técnico con mi cuenta o funcionalidad."
  )}`;

  const contactAlliancesUrl = `https://wa.me/573114245409?text=${encodeURIComponent(
    "Hola NEGOVA, me interesa proponer una alianza o colaboración comercial."
  )}`;

  const emailUrl = "mailto:contacto@negova.co?subject=Consulta NEGOVA";

  return (
    <div className="min-h-screen bg-[#F8F9FD] text-[#0B0E14] selection:bg-[#ED500A]/20 selection:text-[#ED500A] overflow-x-hidden">
      <Navbar />

      {/* ── 1. HERO CON COMPOSICIÓN VISUAL Y ANIMACIÓN MULTIDIRECCIONAL STAGGERED + PARALLAX SCROLL ── */}
      <section
        ref={heroRef as any}
        className="relative pt-28 pb-20 sm:pt-36 sm:pb-24 bg-white border-b border-slate-200 overflow-hidden"
      >
        {/* Luz de fondo sutil */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[350px] bg-gradient-to-br from-[#ED500A]/10 via-[#F36320]/5 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* Contenido comercial */}
            <div
              className="lg:col-span-6 text-left space-y-6 transition-transform duration-75 ease-out"
              style={{
                transform: `translateY(-${textTranslateY}px)`,
                opacity: textOpacity,
                willChange: "transform, opacity",
              }}
            >
              <span
                className={`inline-flex items-center gap-2 font-mono text-xs font-bold tracking-widest text-[#ED500A] uppercase px-4 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20 transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  loaded && heroVisible 
                    ? "opacity-100 translate-y-0 scale-100 blur-0" 
                    : "opacity-0 -translate-y-2 scale-[0.98] blur-[1px]"
                }`}
                style={{ transitionDelay: "100ms" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#ED500A] animate-pulse" />
                <span>Atención 100% Humana</span>
              </span>

              <h1
                className={`font-title font-black text-4xl sm:text-6xl text-[#0B0E14] leading-[1.05] tracking-tight transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  loaded && heroVisible 
                    ? "opacity-100 translate-y-0 scale-100 blur-0" 
                    : "opacity-0 translate-y-2 scale-[0.98] blur-[1px]"
                }`}
                style={{ transitionDelay: "250ms" }}
              >
                Hablemos de <br />
                <span className="text-[#ED500A] italic">tu negocio.</span>
              </h1>

              <p
                className={`font-body text-base sm:text-xl text-slate-600 leading-relaxed transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  loaded && heroVisible 
                    ? "opacity-100 translate-x-0 blur-0" 
                    : "opacity-0 -translate-x-3 blur-[1px]"
                }`}
                style={{ transitionDelay: "400ms" }}
              >
                ¿Tienes una pregunta, necesitas ayuda o quieres conocer mejor NEGOVA? Estamos aquí para escucharte y ayudarte a encontrar la mejor solución para tu negocio.
              </p>

              {/* CTAs */}
              <div
                className={`flex flex-col sm:flex-row items-center gap-4 pt-4 transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  loaded && heroVisible 
                    ? "opacity-100 translate-x-0 scale-100 blur-0" 
                    : "opacity-0 translate-x-3 scale-[0.99] blur-[1px]"
                }`}
                style={{ transitionDelay: "550ms" }}
              >
                <a
                  href={contactGeneralUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-[#25D366] hover:bg-[#22C55E] text-white font-title font-bold text-base shadow-xl shadow-[#25D366]/20 transition-all duration-300 cursor-pointer"
                >
                  <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24">
                    <path d="M12.004 2C6.48 2 2 6.48 2 12.004c0 1.764.46 3.42 1.26 4.876L2 22l5.284-1.388c1.4.764 2.996 1.2 4.72 1.2 5.524 0 10.004-4.48 10.004-10.008C22.008 6.48 17.528 2 12.004 2zm0 18.008c-1.576 0-3.04-.424-4.308-1.164l-.308-.184-3.2 1.04.856-3.124-.2-.316c-.808-1.288-1.236-2.776-1.236-4.32C3.608 7.396 7.396 3.608 12.004 3.608c4.608 0 8.396 3.788 8.396 8.396 0 4.608-3.788 8.404-8.396 8.404zm4.62-6.312c-.252-.124-1.492-.736-1.724-.82-.232-.084-.4-.124-.568.124-.168.252-.652.82-.8 1-.148.168-.296.184-.548.06-.252-.124-1.064-.392-2.028-1.252-.748-.668-1.252-1.496-1.4-1.748-.148-.252-.016-.388.108-.512.112-.112.252-.296.38-.444.124-.148.168-.252.252-.42.084-.168.04-.316-.02-.444-.06-.124-.568-1.368-.78-1.876-.204-.5-.428-.428-.584-.428-.152 0-.324-.016-.496-.016-.172 0-.456.064-.696.324-.24.252-.916.896-.916 2.184 0 1.288.936 2.532 1.064 2.704.128.172 1.84 2.808 4.456 3.936.624.268 1.108.428 1.488.548.628.2 1.2.172 1.652.1.504-.076 1.492-.608 1.704-1.196.212-.588.212-1.092.148-1.196-.06-.108-.224-.172-.476-.296z" />
                  </svg>
                  <span>Hablar con NEGOVA</span>
                </a>

                <a
                  href="#formulario"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-full bg-[#F0F1F5] hover:bg-slate-200 text-[#0B0E14] font-title font-bold text-base transition-all duration-300 cursor-pointer"
                >
                  <Mail className="w-5 h-5 shrink-0" />
                  <span>Escribirnos</span>
                </a>
              </div>
            </div>

            {/* Composición visual de tarjetas de soporte y mensajes */}
            <div
              className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4 relative transition-all duration-75 ease-out"
              style={{
                transform: `translateY(-${visualTranslateY}px) scale(${visualScale})`,
                opacity: visualOpacity,
                willChange: "transform, opacity",
              }}
            >
              
              {/* Tarjeta 1: Canal Soporte */}
              <div
                className={`transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  loaded && heroVisible 
                    ? "opacity-100 translate-x-0 scale-100" 
                    : "opacity-0 -translate-x-4 scale-[0.98]"
                }`}
                style={{ transitionDelay: "700ms" }}
              >
                <div className="animate-float-wave-1 h-full">
                  <div className="p-6 rounded-3xl bg-[#F8F9FD] border border-slate-200/80 text-left space-y-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center">
                      <Phone className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-[9px] font-bold text-slate-400 uppercase">TIEMPO DE RESPUESTA</span>
                    <h4 className="font-title font-bold text-sm text-[#0B0E14]">&lt; 15 minutos</h4>
                    <p className="font-body text-[11px] text-slate-500">Asesoría directa y atenta vía WhatsApp.</p>
                  </div>
                </div>
              </div>

              {/* Tarjeta 2: Humano */}
              <div
                className={`transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  loaded && heroVisible 
                    ? "opacity-100 translate-y-0 scale-100" 
                    : "opacity-0 -translate-y-4 scale-[0.98]"
                }`}
                style={{ transitionDelay: "800ms" }}
              >
                <div className="animate-float-wave-2 h-full">
                  <div className="p-6 rounded-3xl bg-[#F8F9FD] border border-slate-200/80 text-left space-y-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#3B82F6]/10 text-[#3B82F6] flex items-center justify-center">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-[9px] font-bold text-slate-400 uppercase">SOPORTE CERCANO</span>
                    <h4 className="font-title font-bold text-sm text-[#0B0E14]">100% Humano</h4>
                    <p className="font-body text-[11px] text-slate-500">Sin contestadoras automáticas complejas.</p>
                  </div>
                </div>
              </div>

              {/* Tarjeta 3: Cobertura Nacional */}
              <div
                className={`transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] sm:col-span-2 ${
                  loaded && heroVisible 
                    ? "opacity-100 translate-y-0 scale-100" 
                    : "opacity-0 translate-y-4 scale-[0.98]"
                }`}
                style={{ transitionDelay: "950ms" }}
              >
                <div className="animate-float-wave-3 h-full">
                  <div className="p-6 rounded-3xl bg-[#0B0E14] text-white text-left space-y-3 border border-white/10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#ED500A]/10 rounded-full blur-2xl pointer-events-none" />
                    <div className="w-10 h-10 rounded-2xl bg-[#10B981]/15 text-[#10B981] flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-[9px] font-bold text-[#ED500A] uppercase">ESTADO DEL SERVICIO</span>
                    <h4 className="font-title font-bold text-sm text-white">Sistemas Estables y Operando</h4>
                    <p className="font-body text-[11px] text-slate-300">Monitoreo continuo de tu inventario y ventas.</p>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* ── 2. SECCIÓN: ELIGE CÓMO CONTACTARNOS (GRID DE CANALES) ── */}
      <section 
        ref={channelsRef as any}
        className="py-20 sm:py-28 bg-[#F8F9FD] border-b border-slate-200 overflow-hidden"
      >
        <div className="max-w-6xl mx-auto px-6 sm:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span 
              className={`inline-flex font-mono text-xs font-semibold tracking-wider text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20 transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                channelsVisible 
                  ? "opacity-100 translate-y-0 scale-100 blur-0" 
                  : "opacity-0 -translate-y-4 scale-95 blur-[1px]"
              }`}
            >
              Estamos para ayudarte
            </span>
            
            <h2 
              className={`font-title font-black text-3xl sm:text-5xl text-[#0B0E14] mt-6 mb-4 tracking-tight leading-none transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                channelsVisible 
                  ? "opacity-100 translate-y-0 scale-100 blur-0" 
                  : "opacity-0 translate-y-4 scale-[0.98] blur-[1px]"
              }`}
              style={{ transitionDelay: "150ms" }}
            >
              Elige la opción que mejor se adapte a ti
            </h2>
            
            <p 
              className={`font-body text-slate-600 text-sm sm:text-base max-w-[55ch] mx-auto leading-relaxed transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                channelsVisible 
                  ? "opacity-100 translate-y-0 blur-0" 
                  : "opacity-0 translate-y-4 blur-[1px]"
              }`}
              style={{ transitionDelay: "300ms" }}
            >
              Elige el canal adecuado para que podamos brindarte una solución veloz y personalizada.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Card 1: Soporte */}
            <div 
              className={`transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                channelsVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-[0.97]"
              }`}
              style={{ transitionDelay: "400ms" }}
            >
              <div className="animate-float-wave-1 h-full">
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 text-left space-y-4 shadow-xs h-full flex flex-col justify-between group hover:shadow-md hover:border-slate-300 transition-all duration-300">
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <MessageSquare className="w-5 h-5 fill-[#ED500A]/10" />
                    </div>
                    <h3 className="font-title font-extrabold text-base text-[#0B0E14]">Soporte y ayuda</h3>
                    <p className="font-body text-xs text-slate-500 leading-relaxed">
                      ¿Tienes problemas con tu cuenta, necesitas orientación o tienes dudas sobre alguna función?
                    </p>
                  </div>
                  <a
                    href={contactSupportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-[#25D366] text-slate-700 hover:text-white font-title font-bold text-xs transition-colors cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24">
                      <path d="M12.004 2C6.48 2 2 6.48 2 12.004c0 1.764.46 3.42 1.26 4.876L2 22l5.284-1.388c1.4.764 2.996 1.2 4.72 1.2 5.524 0 10.004-4.48 10.004-10.008C22.008 6.48 17.528 2 12.004 2zm0 18.008c-1.576 0-3.04-.424-4.308-1.164l-.308-.184-3.2 1.04.856-3.124-.2-.316c-.808-1.288-1.236-2.776-1.236-4.32C3.608 7.396 7.396 3.608 12.004 3.608c4.608 0 8.396 3.788 8.396 8.396 0 4.608-3.788 8.404-8.396 8.404zm4.62-6.312c-.252-.124-1.492-.736-1.724-.82-.232-.084-.4-.124-.568.124-.168.252-.652.82-.8 1-.148.168-.296.184-.548.06-.252-.124-1.064-.392-2.028-1.252-.748-.668-1.252-1.496-1.4-1.748-.148-.252-.016-.388.108-.512.112-.112.252-.296.38-.444.124-.148.168-.252.252-.42.084-.168.04-.316-.02-.444-.06-.124-.568-1.368-.78-1.876-.204-.5-.428-.428-.584-.428-.152 0-.324-.016-.496-.016-.172 0-.456.064-.696.324-.24.252-.916.896-.916 2.184 0 1.288.936 2.532 1.064 2.704.128.172 1.84 2.808 4.456 3.936.624.268 1.108.428 1.488.548.628.2 1.2.172 1.652.1.504-.076 1.492-.608 1.704-1.196.212-.588.212-1.092.148-1.196-.06-.108-.224-.172-.476-.296z" />
                    </svg>
                    <span>Hablar con soporte</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Card 2: Ventas */}
            <div 
              className={`transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                channelsVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-[0.97]"
              }`}
              style={{ transitionDelay: "500ms" }}
            >
              <div className="animate-float-wave-2 h-full">
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 text-left space-y-4 shadow-xs h-full flex flex-col justify-between group hover:shadow-md hover:border-slate-300 transition-all duration-300">
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#3B82F6]/10 text-[#3B82F6] flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Zap className="w-5 h-5" />
                    </div>
                    <h3 className="font-title font-extrabold text-base text-[#0B0E14]">Ventas y planes</h3>
                    <p className="font-body text-xs text-slate-500 leading-relaxed">
                      ¿Quieres conocer los planes de NEGOVA, comparar funcionalidades o saber cuál se adapta mejor a tu negocio?
                    </p>
                  </div>
                  <Link
                    href="/planes"
                    className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-[#0B0E14] text-slate-700 hover:text-white font-title font-bold text-xs transition-colors cursor-pointer"
                  >
                    Consultar planes
                  </Link>
                </div>
              </div>
            </div>

            {/* Card 3: Alianzas */}
            <div 
              className={`transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                channelsVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-[0.97]"
              }`}
              style={{ transitionDelay: "600ms" }}
            >
              <div className="animate-float-wave-3 h-full">
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 text-left space-y-4 shadow-xs h-full flex flex-col justify-between group hover:shadow-md hover:border-slate-300 transition-all duration-300">
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#10B981]/10 text-[#10B981] flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <h3 className="font-title font-extrabold text-base text-[#0B0E14]">Alianzas y negocios</h3>
                    <p className="font-body text-xs text-slate-500 leading-relaxed">
                      ¿Quieres trabajar con NEGOVA, proponer una alianza o explorar una oportunidad comercial?
                    </p>
                  </div>
                  <a
                    href={contactAlliancesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-[#10B981] text-slate-700 hover:text-white font-title font-bold text-xs transition-colors cursor-pointer"
                  >
                    Proponer una alianza
                  </a>
                </div>
              </div>
            </div>

            {/* Card 4: Otras consultas */}
            <div 
              className={`transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                channelsVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-[0.97]"
              }`}
              style={{ transitionDelay: "700ms" }}
            >
              <div className="animate-float-wave-1 h-full">
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 text-left space-y-4 shadow-xs h-full flex flex-col justify-between group hover:shadow-md hover:border-slate-300 transition-all duration-300">
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Mail className="w-5 h-5" />
                    </div>
                    <h3 className="font-title font-extrabold text-base text-[#0B0E14]">Otras consultas</h3>
                    <p className="font-body text-xs text-slate-500 leading-relaxed">
                      Para preguntas generales, sugerencias, comentarios o cualquier otro tema libre.
                    </p>
                  </div>
                  <a
                    href="#formulario"
                    className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-[#0B0E14] text-slate-700 hover:text-white font-title font-bold text-xs transition-colors cursor-pointer"
                  >
                    Escribir a NEGOVA
                  </a>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── 3. SECCIÓN DE CONTACTO DIRECTO Y FORMULARIO (SPLIT COLUMN LAYOUT) ── */}
      <section 
        ref={directRef as any}
        className="py-20 sm:py-28 bg-white border-b border-slate-200 overflow-hidden"
      >
        <div className="max-w-6xl mx-auto px-6 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            
            {/* Columna Izquierda: Opciones de Contacto Directo */}
            <div 
              className={`lg:col-span-5 text-left space-y-8 transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                directVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-12"
              }`}
            >
              <div>
                <span className="font-mono text-xs font-semibold tracking-wider text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
                  Contacto Directo
                </span>
                <h2 className="font-title font-black text-2xl sm:text-4xl text-[#0B0E14] mt-4 mb-2 tracking-tight leading-tight">
                  ¿Prefieres hablar directamente con nosotros?
                </h2>
                <p className="font-body text-slate-600 text-xs sm:text-sm leading-relaxed">
                  Escríbenos y cuéntanos qué necesitas. Te ayudaremos de inmediato sin lenguaje técnico innecesario.
                </p>
              </div>

              <div className="space-y-4">
                
                {/* Opción 1: WhatsApp */}
                <div className="p-5 rounded-3xl bg-[#F8F9FD] border border-slate-200/80 flex items-start gap-4 hover:border-[#25D366]/30 transition-all duration-300">
                  <div className="p-3 rounded-2xl bg-[#25D366]/10 text-[#25D366] shrink-0">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M12.004 2C6.48 2 2 6.48 2 12.004c0 1.764.46 3.42 1.26 4.876L2 22l5.284-1.388c1.4.764 2.996 1.2 4.72 1.2 5.524 0 10.004-4.48 10.004-10.008C22.008 6.48 17.528 2 12.004 2zm0 18.008c-1.576 0-3.04-.424-4.308-1.164l-.308-.184-3.2 1.04.856-3.124-.2-.316c-.808-1.288-1.236-2.776-1.236-4.32C3.608 7.396 7.396 3.608 12.004 3.608c4.608 0 8.396 3.788 8.396 8.396 0 4.608-3.788 8.404-8.396 8.404zm4.62-6.312c-.252-.124-1.492-.736-1.724-.82-.232-.084-.4-.124-.568.124-.168.252-.652.82-.8 1-.148.168-.296.184-.548.06-.252-.124-1.064-.392-2.028-1.252-.748-.668-1.252-1.496-1.4-1.748-.148-.252-.016-.388.108-.512.112-.112.252-.296.38-.444.124-.148.168-.252.252-.42.084-.168.04-.316-.02-.444-.06-.124-.568-1.368-.78-1.876-.204-.5-.428-.428-.584-.428-.152 0-.324-.016-.496-.016-.172 0-.456.064-.696.324-.24.252-.916.896-.916 2.184 0 1.288.936 2.532 1.064 2.704.128.172 1.84 2.808 4.456 3.936.624.268 1.108.428 1.488.548.628.2 1.2.172 1.652.1.504-.076 1.492-.608 1.704-1.196.212-.588.212-1.092.148-1.196-.06-.108-.224-.172-.476-.296z" />
                    </svg>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-title font-bold text-sm text-[#0B0E14]">WhatsApp Directo</h4>
                    <p className="font-body text-xs text-slate-500">Atención directa en tiempo real para resolver dudas rápidas y soporte urgente.</p>
                    <a
                      href={contactGeneralUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-title font-extrabold text-[#25D366] hover:underline"
                    >
                      <span>Abrir WhatsApp</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Opción 2: Correo */}
                <div className="p-5 rounded-3xl bg-[#F8F9FD] border border-slate-200/80 flex items-start gap-4 hover:border-slate-300 transition-all duration-300">
                  <div className="p-3 rounded-2xl bg-[#3B82F6]/10 text-[#3B82F6] shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-title font-bold text-sm text-[#0B0E14]">Correo electrónico</h4>
                    <p className="font-body text-xs text-slate-500">Para consultas generales, propuestas de alianzas y requerimientos formales.</p>
                    <a
                      href={emailUrl}
                      className="inline-flex items-center gap-1 text-xs font-title font-extrabold text-[#3B82F6] hover:underline"
                    >
                      <span>Enviar correo</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

              </div>
            </div>

            {/* Columna Derecha: Formulario de Contacto */}
            <div 
              id="formulario"
              className={`lg:col-span-7 bg-[#F8F9FD] border border-slate-200/80 rounded-3xl p-6 sm:p-8 relative overflow-hidden transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                directVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-12"
              }`}
              style={{ transitionDelay: "200ms" }}
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-[#ED500A]/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="mb-6">
                <h3 className="font-title font-black text-xl text-[#0B0E14]">Cuéntanos qué necesitas</h3>
                <p className="font-body text-xs text-slate-500">Completa este breve formulario y te responderemos pronto.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="nombre" className="block text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                      Nombre completo
                    </label>
                    <input
                      type="text"
                      id="nombre"
                      name="nombre"
                      value={formData.nombre}
                      onChange={handleInputChange}
                      required
                      placeholder="Ej. Andrés Mendoza"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white font-body text-xs text-[#0B0E14] focus:outline-none focus:border-[#ED500A] transition-colors"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label htmlFor="email" className="block text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                      Correo electrónico
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      placeholder="Ej. andres@tunegocio.com"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white font-body text-xs text-[#0B0E14] focus:outline-none focus:border-[#ED500A] transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="consulta" className="block text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                    Tipo de consulta
                  </label>
                  <div className="relative">
                    <select
                      id="consulta"
                      name="consulta"
                      value={formData.consulta}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white font-body text-xs text-[#0B0E14] focus:outline-none focus:border-[#ED500A] appearance-none transition-colors cursor-pointer"
                    >
                      <option value="Soporte">Soporte y Ayuda</option>
                      <option value="Ventas">Ventas y Planes</option>
                      <option value="Informacion">Información sobre NEGOVA</option>
                      <option value="Alianzas">Alianzas comerciales</option>
                      <option value="Sugerencias">Sugerencias y comentarios</option>
                      <option value="Otro">Otro asunto</option>
                    </select>
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="mensaje" className="block text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                    ¿En qué podemos ayudarte?
                  </label>
                  <textarea
                    id="mensaje"
                    name="mensaje"
                    value={formData.mensaje}
                    onChange={handleInputChange}
                    required
                    rows={4}
                    placeholder="Escribe tu mensaje o dudas aquí..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white font-body text-xs text-[#0B0E14] focus:outline-none focus:border-[#ED500A] resize-none transition-colors"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-full bg-[#0B0E14] hover:bg-[#ED500A] text-white font-title font-bold text-sm transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>Enviar mensaje</span>
                  </button>
                </div>
              </form>

            </div>

          </div>
        </div>
      </section>

      {/* ── 4. SECCIÓN: NEGOVA ESTÁ CERCA DE TI (EMOCIONAL Y HUMANA) ── */}
      <section 
        ref={storyRef as any}
        className="py-20 sm:py-28 bg-[#F8F9FD] border-b border-slate-200 overflow-hidden"
      >
        <div className="max-w-6xl mx-auto px-6 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* Texto Comercial */}
            <div 
              className={`lg:col-span-5 text-left space-y-6 transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                storyVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
              }`}
            >
              <span className="font-mono text-xs font-semibold tracking-wider text-[#ED500A] uppercase px-3.5 py-1.5 rounded-full bg-[#ED500A]/10 border border-[#ED500A]/20">
                Tu negocio importa
              </span>
              <h2 className="font-title font-black text-3xl sm:text-5xl text-[#0B0E14] tracking-tight leading-none">
                Creado para negocios reales.
              </h2>
              <p className="font-body text-slate-600 text-sm leading-relaxed">
                Desde una tienda de barrio hasta una barbería, una ferretería o un pequeño restaurante, sabemos que detrás de cada negocio hay una persona trabajando todos los días para hacerlo crecer.
              </p>
              <p className="font-body text-slate-500 text-xs sm:text-sm leading-relaxed">
                Por eso creamos NEGOVA: para hacer más sencilla la gestión de tu negocio y acompañarte en cada paso del camino, con herramientas claras y soporte humano en el que puedas confiar.
              </p>
            </div>

            {/* Composición visual de comercios locales */}
            <div 
              className={`lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-6 transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                storyVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-12 scale-95"
              }`}
              style={{ transitionDelay: "200ms" }}
            >
              {/* Comercio 1: Tienda */}
              <div className="animate-float-wave-1">
                <div className="p-6 rounded-3xl bg-white border border-slate-200/80 space-y-3">
                  <span className="text-3xl block">🏪</span>
                  <h4 className="font-title font-bold text-sm text-[#0B0E14]">Tiendas y Mercados</h4>
                  <p className="font-body text-[11px] text-slate-500">Para quienes controlan miles de productos diarios de consumo masivo.</p>
                </div>
              </div>

              {/* Comercio 2: Barbería */}
              <div className="animate-float-wave-2">
                <div className="p-6 rounded-3xl bg-white border border-slate-200/80 space-y-3">
                  <span className="text-3xl block">💈</span>
                  <h4 className="font-title font-bold text-sm text-[#0B0E14]">Servicios Locales</h4>
                  <p className="font-body text-[11px] text-slate-500">Peluquerías, barberías y talleres que gestionan citas y caja.</p>
                </div>
              </div>

              {/* Comercio 3: Gastronomía */}
              <div className="animate-float-wave-3">
                <div className="p-6 rounded-3xl bg-white border border-slate-200/80 space-y-3">
                  <span className="text-3xl block">🍔</span>
                  <h4 className="font-title font-bold text-sm text-[#0B0E14]">Gastronomía</h4>
                  <p className="font-body text-[11px] text-slate-500">Pequeños restaurantes, panaderías y cafeterías locales.</p>
                </div>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* ── 5. SECCIÓN DE CONFIANZA (SOPORTE HUMANO SIN ESTADÍSTICAS FALSAS) ── */}
      <section 
        ref={trustRef as any}
        className="py-16 sm:py-20 bg-white border-b border-slate-200 overflow-hidden"
      >
        <div className="max-w-6xl mx-auto px-6 sm:px-8 text-center">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Pilar 1 */}
            <div 
              className={`space-y-2 transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                trustVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: "100ms" }}
            >
              <div className="mx-auto w-10 h-10 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center mb-3">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h4 className="font-title font-bold text-sm sm:text-base text-[#0B0E14]">Atención cercana</h4>
              <p className="font-body text-xs text-slate-500 max-w-[30ch] mx-auto leading-relaxed">
                Respuestas pensadas para personas de carne y hueso, no para sistemas complicados.
              </p>
            </div>

            {/* Pilar 2 */}
            <div 
              className={`space-y-2 transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                trustVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: "250ms" }}
            >
              <div className="mx-auto w-10 h-10 rounded-2xl bg-[#3B82F6]/10 text-[#3B82F6] flex items-center justify-center mb-3">
                <HelpCircle className="w-5 h-5" />
              </div>
              <h4 className="font-title font-bold text-sm sm:text-base text-[#0B0E14]">Soporte sencillo</h4>
              <p className="font-body text-xs text-slate-500 max-w-[30ch] mx-auto leading-relaxed">
                Te ayudamos a resolver tus dudas rápidamente sin usar lenguaje técnico innecesario.
              </p>
            </div>

            {/* Pilar 3 */}
            <div 
              className={`space-y-2 transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                trustVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: "400ms" }}
            >
              <div className="mx-auto w-10 h-10 rounded-2xl bg-[#10B981]/10 text-[#10B981] flex items-center justify-center mb-3">
                <UserCheck className="w-5 h-5" />
              </div>
              <h4 className="font-title font-bold text-sm sm:text-base text-[#0B0E14]">NEGOVA contigo</h4>
              <p className="font-body text-xs text-slate-500 max-w-[30ch] mx-auto leading-relaxed">
                Una herramienta creada de forma local para acompañar el día a día real de tu negocio.
              </p>
            </div>

          </div>

        </div>
      </section>
      {/* ── 6. SECCIÓN DE PREGUNTAS FRECUENTES (REUTILIZADA DE LA LANDING) ── */}
      <FaqLandingSection />
      {/* ── 7. CTA FINAL DE CONVERSIÓN ── */}
      <section className="relative py-24 sm:py-32 bg-[#0B0E14] text-white overflow-hidden text-center">
        {/* Luz de fondo */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-gradient-to-br from-[#ED500A]/20 via-[#F36320]/10 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 sm:px-8 space-y-6">
          <h2 className="font-title font-black text-4xl sm:text-6xl text-white leading-none tracking-tight">
            ¿Listo para llevar mejor <br className="hidden sm:inline" />
            el control de tu negocio?
          </h2>
          
          <p className="font-body text-base sm:text-xl text-slate-300 max-w-[50ch] mx-auto leading-relaxed">
            Empieza a conocer NEGOVA y descubre una forma más sencilla de administrar tus ventas, clientes e inventario.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/planes"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-[#ED500A] hover:bg-[#F36320] text-white font-title font-bold text-base shadow-xl shadow-[#ED500A]/25 transition-all duration-300 cursor-pointer"
            >
              <span>Comenzar ahora</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            
            <a
              href={contactGeneralUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-full bg-[#25D366] hover:bg-[#22C55E] text-white font-title font-bold text-base shadow-xl shadow-[#25D366]/20 transition-all duration-300 cursor-pointer"
            >
              <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24">
                <path d="M12.004 2C6.48 2 2 6.48 2 12.004c0 1.764.46 3.42 1.26 4.876L2 22l5.284-1.388c1.4.764 2.996 1.2 4.72 1.2 5.524 0 10.004-4.48 10.004-10.008C22.008 6.48 17.528 2 12.004 2zm0 18.008c-1.576 0-3.04-.424-4.308-1.164l-.308-.184-3.2 1.04.856-3.124-.2-.316c-.808-1.288-1.236-2.776-1.236-4.32C3.608 7.396 7.396 3.608 12.004 3.608c4.608 0 8.396 3.788 8.396 8.396 0 4.608-3.788 8.404-8.396 8.404zm4.62-6.312c-.252-.124-1.492-.736-1.724-.82-.232-.084-.4-.124-.568.124-.168.252-.652.82-.8 1-.148.168-.296.184-.548.06-.252-.124-1.064-.392-2.028-1.252-.748-.668-1.252-1.496-1.4-1.748-.148-.252-.016-.388.108-.512.112-.112.252-.296.38-.444.124-.148.168-.252.252-.42.084-.168.04-.316-.02-.444-.06-.124-.568-1.368-.78-1.876-.204-.5-.428-.428-.584-.428-.152 0-.324-.016-.496-.016-.172 0-.456.064-.696.324-.24.252-.916.896-.916 2.184 0 1.288.936 2.532 1.064 2.704.128.172 1.84 2.808 4.456 3.936.624.268 1.108.428 1.488.548.628.2 1.2.172 1.652.1.504-.076 1.492-.608 1.704-1.196.212-.588.212-1.092.148-1.196-.06-.108-.224-.172-.476-.296z" />
              </svg>
              <span>Hablar con nosotros</span>
            </a>
          </div>
        </div>
      </section>

      {/* Modal de éxito (Evita window.alert nativo) */}
      <SuccessModal
        isOpen={showSuccess}
        onClose={handleCloseSuccess}
        userName={formData.nombre}
      />

      <FloatingWrapper />
      <Footer />
    </div>
  );
}
