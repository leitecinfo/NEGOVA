"use client";

import React, { useState } from "react";

// Configuración centralizada de WhatsApp
export const WHATSAPP_PHONE_NUMBER = "573114245409";
export const WHATSAPP_PREFILLED_MESSAGE =
  "Hola NEGOVA, quiero conocer más sobre la plataforma y la prueba gratuita de 30 días.";

export function WhatsAppIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <img
      src="/icons8-whatsapp.svg"
      alt="Logo WhatsApp"
      className={className}
    />
  );
}

export function FloatingContact() {
  const [showTooltip, setShowTooltip] = useState(false);

  const whatsappUrl = `https://wa.me/${WHATSAPP_PHONE_NUMBER}?text=${encodeURIComponent(
    WHATSAPP_PREFILLED_MESSAGE
  )}`;

  return (
    <div className="relative group">
      {/* Tooltip on Hover */}
      <div
        className={`absolute right-full top-1/2 -translate-y-1/2 mr-3 px-3 py-1.5 rounded-xl bg-[#0B0E14] text-white font-title font-semibold text-xs whitespace-nowrap shadow-lg border border-white/10 transition-all duration-200 pointer-events-none ${
          showTooltip ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2"
        }`}
      >
        Habla con nosotros
      </div>

      {/* WhatsApp Floating Button */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        aria-label="Hablar con NEGOVA por WhatsApp"
        className="w-14 h-14 sm:w-15 sm:h-15 rounded-full bg-[#25D366] hover:bg-[#20ba5a] text-white flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 cursor-pointer"
      >
        <WhatsAppIcon className="w-7 h-7 sm:w-8 sm:h-8 fill-white" />
      </a>
    </div>
  );
}
