"use client";

import React, { useState } from "react";
import { MessageCircle, ShoppingBag, Plus, Minus, Trash2, X, ChevronUp } from "lucide-react";
import { CartItem } from "./menu-cart-types";
import { toast } from "sonner";

interface Props {
  cart: Record<string, CartItem>;
  onUpdateQuantity: (id: string, delta: number) => void;
  onClearCart: () => void;
  currency: string;
  businessName: string;
  whatsappPhone?: string | null;
  theme?: "dark" | "light" | "brutal" | "elegante";
  accentColor?: string;
  isPreview?: boolean;
}

export function MenuCartDrawer({
  cart,
  onUpdateQuantity,
  onClearCart,
  currency,
  businessName,
  whatsappPhone,
  theme = "dark",
  accentColor = "#22C55E",
  isPreview = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const items = Object.values(cart);
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const formatPrice = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: currency || "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const cleanWhatsapp = (whatsappPhone || "").replace(/[^0-9]/g, "");

  const generateWhatsappUrl = () => {
    if (!cleanWhatsapp || items.length === 0) return "#";
    const lines = items.map(
      (item) =>
        `• ${item.quantity} x ${item.name}${item.variantName ? ` (${item.variantName})` : ""} — ${formatPrice(item.unitPrice * item.quantity)}`
    );
    const message = `¡Hola! Quisiera realizar el siguiente pedido en *${businessName}*:\n\n${lines.join(
      "\n"
    )}\n\n*Total a pagar: ${formatPrice(totalAmount)}*\n\n¿Me confirman disponibilidad y tiempo estimado?`;
    return `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(message)}`;
  };

  // Tema Brutalista / Claro
  const isBrutal = theme === "brutal";
  const isLight = theme === "light";

  const barBackground = isBrutal
    ? "#FFFFFF"
    : isLight
    ? "rgba(255, 255, 255, 0.98)"
    : "rgba(11, 13, 19, 0.95)";
  const barBorder = isBrutal
    ? "3px solid #111111"
    : isLight
    ? "1px solid #E2E8F0"
    : "1px solid rgba(255, 255, 255, 0.12)";
  const barShadow = isBrutal
    ? "0 -4px 0 #111111"
    : "0 -4px 20px rgba(0, 0, 0, 0.25)";
  const textColor = isBrutal || isLight ? "#0F172A" : "#FFFFFF";

  // Si no hay productos en el pedido y el modal no está abierto, no renderizar barra que tape el menú
  if (totalCount === 0 && !isOpen) {
    return null;
  }

  return (
    <>
      {/* 1. MODAL COMPLETO Y CENTRADO DEL CARRITO */}
      {isOpen && (
        <div
          className={`${
            isPreview ? "absolute" : "fixed"
          } inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 transition-all`}
          onClick={() => setIsOpen(false)}
        >
          <div
            className={`w-full max-w-sm rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col max-h-[85%] ${
              isBrutal
                ? "bg-white border-[3px] border-[#111111] shadow-[6px_6px_0_#111111]"
                : isLight
                ? "bg-white border border-slate-200 text-[#0F172A]"
                : "bg-[#141721] border border-white/10 text-white"
            }`}
            style={{ color: textColor }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del modal */}
            <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-500" />
                <h3 className="font-extrabold text-sm sm:text-base">
                  Tu Pedido ({totalCount})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearCart}
                    className="p-1 rounded-lg text-slate-400 hover:text-red-500 transition-colors text-xs flex items-center gap-1"
                    title="Vaciar pedido"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-semibold">Vaciar</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Lista de platos en el carrito */}
            <div className="overflow-y-auto py-3 space-y-2 flex-1 [scrollbar-width:thin]">
              {items.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs space-y-2">
                  <div className="text-3xl">🛍️</div>
                  <p className="font-bold text-slate-700 dark:text-slate-200">Tu carrito está vacío</p>
                  <p className="text-[11px] text-slate-400">Agrega platillos desde el menú para realizar tu pedido.</p>
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs sm:text-sm truncate">
                        {item.name}
                      </p>
                      {item.variantName && (
                        <span className="text-[11px] font-semibold text-emerald-500 block truncate">
                          {item.variantName}
                        </span>
                      )}
                      <span className="text-xs text-slate-400 font-medium">
                        {formatPrice(item.unitPrice * item.quantity)}
                      </span>
                    </div>

                    {/* Controles de cantidad */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.id, -1)}
                        className="w-6 h-6 rounded-md border border-black/10 dark:border-white/10 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-bold text-xs w-4 text-center">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.id, 1)}
                        className="w-6 h-6 rounded-md border border-black/10 dark:border-white/10 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer del modal con total y acción */}
            <div className="pt-3 border-t border-black/10 dark:border-white/10 shrink-0 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">Total a ordenar:</span>
                <span className="text-base sm:text-lg font-black text-emerald-500">
                  {formatPrice(totalAmount)}
                </span>
              </div>

              {items.length > 0 ? (
                <a
                  href={generateWhatsappUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider text-white bg-[#22C55E] hover:opacity-95 active:scale-98 transition-all shadow-md"
                  style={{
                    border: isBrutal ? "2px solid #111111" : undefined,
                    boxShadow: isBrutal ? "2px 2px 0 #111111" : undefined,
                  }}
                >
                  <MessageCircle className="w-4 h-4 fill-current shrink-0" />
                  <span>Enviar por WhatsApp</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-full py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  Ver el Menú
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. BARRA INFERIOR FIJA (SIEMPRE EN LA BASE DEL VISOR O PANTALLA) */}
      <aside
        aria-label="Barra de pedido"
        className={`${
          isPreview ? "absolute" : "fixed"
        } left-0 right-0 bottom-0 z-30 p-2.5 sm:p-3 backdrop-blur-md`}
        style={{
          backgroundColor: barBackground,
          borderTop: barBorder,
          boxShadow: barShadow,
        }}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          {/* Botón Carrito / Abrir Modal */}
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl sm:rounded-full font-bold text-xs sm:text-sm transition-transform active:scale-95 ${
              isBrutal
                ? "border-2 border-black bg-[#ffd60a] text-black shadow-[3px_3px_0_#111]"
                : isLight
                ? "border border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200"
                : "border border-white/15 bg-white/10 text-white hover:bg-white/15"
            }`}
          >
            <span>🛒</span>
            <span className="font-extrabold">{totalCount}</span>
            <span className="opacity-60">&bull;</span>
            <span className="font-black text-emerald-400">
              {formatPrice(totalAmount)}
            </span>
            <ChevronUp className="w-3.5 h-3.5 opacity-60" />
          </button>

          {/* Botón WhatsApp */}
          <a
            href={totalCount > 0 ? generateWhatsappUrl() : undefined}
            target={totalCount > 0 ? "_blank" : undefined}
            rel="noopener noreferrer"
            onClick={(e) => {
              if (totalCount === 0) {
                e.preventDefault();
                toast.info("Agrega platos al carrito para pedir por WhatsApp");
              }
            }}
            className={`flex items-center gap-2 px-4 sm:px-6 py-2 rounded-xl sm:rounded-full font-black text-xs sm:text-sm uppercase tracking-wider text-white transition-all shadow-md ${
              totalCount > 0
                ? "hover:opacity-95 active:scale-95 cursor-pointer"
                : "opacity-45 cursor-not-allowed"
            }`}
            style={{
              backgroundColor: "#22C55E",
              border: isBrutal ? "2px solid #111111" : undefined,
              boxShadow: isBrutal && totalCount > 0 ? "3px 3px 0 #111111" : undefined,
            }}
          >
            <MessageCircle className="w-4 h-4 fill-current shrink-0" />
            <span>Pedir por WhatsApp</span>
          </a>
        </div>
      </aside>
    </>
  );
}
