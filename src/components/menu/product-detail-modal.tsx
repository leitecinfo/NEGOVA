"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Plus,
  Minus,
  MessageCircle,
  Sparkles,
  AlertCircle,
  Check,
  Utensils,
  Flame,
  Info,
} from "lucide-react";
import { Product, ProductVariant, ProductModifierGroup } from "@/lib/products/types";
import { DigitalMenuPublicBusiness } from "@/lib/menu/types";

interface Props {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  business: DigitalMenuPublicBusiness;
  primaryColor?: string;
  theme?: "dark" | "light";
  onAddToCart?: (item: {
    productId: string;
    name: string;
    variantId?: string | null;
    variantName?: string;
    unitPrice: number;
    quantity: number;
    image_url?: string | null;
    selectedModifiers?: Array<{
      groupId: string;
      groupName: string;
      optionId: string;
      optionName: string;
      price: number;
    }>;
  }) => void;
}

export function ProductDetailModal({
  product,
  isOpen,
  onClose,
  business,
  primaryColor = "#2563EB",
  theme = "dark",
  onAddToCart,
}: Props) {
  const isDark = theme === "dark";

  const variants: ProductVariant[] = useMemo(() => {
    if (!product) return [];
    const meta = product.metadata as any;
    if (meta?.has_variants && Array.isArray(meta?.variants) && meta.variants.length > 0) {
      return meta.variants.filter((v: ProductVariant) => v.is_available !== false);
    }
    return [];
  }, [product]);

  const modifierGroups: ProductModifierGroup[] = useMemo(() => {
    if (!product) return [];
    const meta = product.metadata as any;
    if (Array.isArray(meta?.modifier_groups)) {
      return meta.modifier_groups;
    }
    return [];
  }, [product]);

  const ingredients: string = useMemo(() => {
    if (!product) return "";
    return (product.metadata as any)?.ingredients || "";
  }, [product]);

  const allergens: string[] = useMemo(() => {
    if (!product) return [];
    const a = (product.metadata as any)?.allergens;
    return Array.isArray(a) ? a : [];
  }, [product]);

  // Estados interactivos
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState<number>(1);

  // Inicializar variante predeterminada al abrir
  useEffect(() => {
    if (product) {
      if (variants.length > 0) {
        setSelectedVariantId(variants[0].id);
      } else {
        setSelectedVariantId(null);
      }
      setSelectedModifiers({});
      setQuantity(1);
    }
  }, [product, variants]);

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !product) return null;

  const selectedVariant = variants.find((v) => v.id === selectedVariantId) || null;
  const basePrice = selectedVariant ? selectedVariant.price : product.price;

  // Calcular precio de extras seleccionados
  let extrasPrice = 0;
  const chosenModifiersList: {
    groupId: string;
    groupName: string;
    optionId: string;
    optionName: string;
    price: number;
  }[] = [];

  modifierGroups.forEach((group) => {
    const chosenIds = selectedModifiers[group.name] || [];
    group.options.forEach((opt) => {
      const optId = opt.id || opt.name;
      if (chosenIds.includes(optId)) {
        extrasPrice += opt.price || 0;
        chosenModifiersList.push({
          groupId: group.id || group.name,
          groupName: group.name,
          optionId: optId,
          optionName: opt.name,
          price: opt.price || 0,
        });
      }
    });
  });

  const unitTotal = basePrice + extrasPrice;
  const grandTotal = unitTotal * quantity;

  const formatPrice = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: business.currency || "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleToggleModifier = (group: ProductModifierGroup, optionId: string) => {
    const current = selectedModifiers[group.name] || [];
    const maxSelect = group.max_select || 1;

    if (maxSelect === 1) {
      // Selección única
      if (current.includes(optionId)) {
        if (!group.required) {
          setSelectedModifiers({ ...selectedModifiers, [group.name]: [] });
        }
      } else {
        setSelectedModifiers({ ...selectedModifiers, [group.name]: [optionId] });
      }
    } else {
      // Selección múltiple
      if (current.includes(optionId)) {
        setSelectedModifiers({
          ...selectedModifiers,
          [group.name]: current.filter((id) => id !== optionId),
        });
      } else {
        if (current.length < maxSelect) {
          setSelectedModifiers({
            ...selectedModifiers,
            [group.name]: [...current, optionId],
          });
        }
      }
    }
  };

  // Construir mensaje contextual para WhatsApp
  const cleanWhatsapp = (business.whatsapp || business.phone || "").replace(/[^0-9]/g, "");
  const buildWhatsappUrl = () => {
    if (!cleanWhatsapp) return "#";

    let text = `¡Hola! Me gustaría hacer un pedido desde el menú digital de *${business.name}*:\n\n`;
    text += `• *${quantity}x ${product.name}*`;

    if (selectedVariant) {
      text += ` (${selectedVariant.name} — ${formatPrice(selectedVariant.price)})`;
    } else {
      text += ` (${formatPrice(product.price)})`;
    }

    if (chosenModifiersList.length > 0) {
      text += `\n  *Extras / Opciones:*`;
      chosenModifiersList.forEach((mod) => {
        text += `\n   + ${mod.optionName}${mod.price > 0 ? ` (+${formatPrice(mod.price)})` : ""}`;
      });
    }

    if (quantity > 1 || extrasPrice > 0) {
      text += `\n\n*Total estimado:* ${formatPrice(grandTotal)}`;
    }

    return `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      {/* Backdrop con desenfoque */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Contenedor del Modal / Bottom Sheet */}
      <div
        className={`relative w-full max-w-lg rounded-t-3xl sm:rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 transition-all ${
          isDark
            ? "bg-[#12141C] text-white border-white/10"
            : "bg-white text-slate-900 border-slate-200"
        }`}
      >
        {/* Cabecera con Imagen o Fondo */}
        <div className="relative">
          {product.image_url ? (
            <div className="h-56 sm:h-64 w-full bg-black/20 overflow-hidden relative">
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              <div
                className={`absolute inset-0 bg-gradient-to-t ${
                  isDark ? "from-[#12141C] via-transparent to-transparent" : "from-white via-transparent to-transparent"
                }`}
              />
            </div>
          ) : (
            <div
              className={`h-24 w-full flex items-center justify-center border-b ${
                isDark ? "bg-[#181B26] border-white/10" : "bg-slate-100 border-slate-200"
              }`}
            >
              <Utensils className={`w-8 h-8 opacity-40`} />
            </div>
          )}

          {/* Botón Cerrar flotante */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-all shadow-md z-20"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Badge de Precio Flotante */}
          <div
            className="absolute bottom-3 right-4 px-3.5 py-1 rounded-xl text-xs sm:text-sm font-black text-white shadow-lg backdrop-blur-sm"
            style={{ backgroundColor: primaryColor }}
          >
            {formatPrice(unitTotal)}
          </div>
        </div>

        {/* Cuerpo del Modal con Scroll */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Título y Descripción */}
          <div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-tight">
              {product.name}
            </h2>

            {product.description && (
              <p
                className={`text-xs sm:text-sm mt-2 leading-relaxed font-normal ${
                  isDark ? "text-slate-300" : "text-slate-600"
                }`}
              >
                {product.description}
              </p>
            )}
          </div>

          {/* Ingredientes si están disponibles */}
          {ingredients && (
            <div
              className={`p-3 rounded-2xl border text-xs leading-relaxed ${
                isDark ? "bg-white/5 border-white/10 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700"
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold mb-1 opacity-80">
                <Utensils className="w-3.5 h-3.5" />
                <span>Ingredientes:</span>
              </div>
              <p>{ingredients}</p>
            </div>
          )}

          {/* Alérgenos si existen */}
          {allergens.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[11px] font-bold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Alérgenos:
              </span>
              {allergens.map((alg) => (
                <span
                  key={alg}
                  className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400 uppercase"
                >
                  {alg}
                </span>
              ))}
            </div>
          )}

          {/* SECCIÓN 1: SELECCIÓN DE VARIANTES / PRESENTACIONES */}
          {variants.length > 0 && (
            <div className="space-y-2.5 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Elige una presentación o tamaño
                </label>
                <span className="text-[10px] font-bold uppercase text-amber-400">
                  Obligatorio
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {variants.map((v) => {
                  const isSelected = selectedVariantId === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? isDark
                            ? "bg-white/10 border-white/30 text-white shadow-md ring-1 ring-white/20"
                            : "bg-blue-50/70 border-blue-300 text-blue-950 shadow-sm ring-1 ring-blue-400"
                          : isDark
                          ? "bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/5"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "border-transparent text-white"
                              : isDark
                              ? "border-slate-500"
                              : "border-slate-400"
                          }`}
                          style={{
                            backgroundColor: isSelected ? primaryColor : "transparent",
                          }}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                        <div>
                          <span className="font-bold text-xs sm:text-sm">{v.name}</span>
                          {v.specific_description && (
                            <p className="text-[11px] opacity-75">{v.specific_description}</p>
                          )}
                        </div>
                      </div>

                      <span
                        className="font-black text-xs sm:text-sm whitespace-nowrap pl-2"
                        style={{ color: isSelected ? primaryColor : undefined }}
                      >
                        {formatPrice(v.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECCIÓN 2: GRUPOS DE MODIFICADORES Y EXTRAS */}
          {modifierGroups.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-white/10">
              {modifierGroups.map((group) => {
                const chosenIds = selectedModifiers[group.name] || [];
                return (
                  <div key={group.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                        {group.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {group.max_select === 1
                          ? "Selecciona 1 opción"
                          : `Hasta ${group.max_select || "varias"} opciones`}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {group.options.map((opt) => {
                        const optId = opt.id || opt.name;
                        const isChosen = chosenIds.includes(optId);
                        return (
                          <button
                            key={optId}
                            type="button"
                            onClick={() => handleToggleModifier(group, optId)}
                            className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition-all ${
                              isChosen
                                ? isDark
                                  ? "bg-white/10 border-white/30 text-white"
                                  : "bg-blue-50 border-blue-300 text-blue-900"
                                : isDark
                                ? "bg-white/[0.02] border-white/5 text-slate-300 hover:bg-white/5"
                                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                  isChosen ? "border-transparent text-white" : "border-slate-500"
                                }`}
                                style={{
                                  backgroundColor: isChosen ? primaryColor : "transparent",
                                }}
                              >
                                {isChosen && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </div>
                              <span className="font-semibold">{opt.name}</span>
                            </div>

                            {opt.price > 0 && (
                              <span className="font-bold opacity-90 text-[11px]">
                                +{formatPrice(opt.price)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Barra Inferior Fija: Selector de Cantidad & Botón de Pedido WhatsApp */}
        <div
          className={`p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 ${
            isDark ? "bg-[#0E1017] border-white/10" : "bg-slate-50 border-slate-200"
          }`}
        >
          {/* Selector de Cantidad */}
          <div className="flex items-center justify-between sm:justify-start w-full sm:w-auto gap-4">
            <span className="text-xs font-bold text-slate-400">Cantidad:</span>
            <div
              className={`flex items-center rounded-xl border ${
                isDark ? "bg-white/5 border-white/10" : "bg-white border-slate-300"
              }`}
            >
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="p-2 hover:opacity-75 transition-opacity"
                disabled={quantity <= 1}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-8 text-center text-xs font-black">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="p-2 hover:opacity-75 transition-opacity"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Acciones de Pedido */}
          <div className="flex flex-col sm:flex-row items-center gap-2 flex-1 w-full sm:w-auto">
            {onAddToCart && (
              <button
                type="button"
                onClick={() => {
                  if (!product) return;
                  onAddToCart({
                    productId: product.id,
                    name: product.name,
                    variantId: selectedVariant?.id || null,
                    variantName: selectedVariant?.name,
                    unitPrice: unitTotal,
                    quantity,
                    image_url: product.image_url,
                    selectedModifiers: chosenModifiersList.length > 0 ? chosenModifiersList : undefined,
                  });
                  onClose();
                }}
                className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider text-white shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer touch-manipulation"
                style={{ backgroundColor: primaryColor }}
              >
                <Plus className="w-4 h-4" />
                <span>+ Agregar al Pedido &bull; {formatPrice(grandTotal)}</span>
              </button>
            )}

            {cleanWhatsapp && (
              <a
                href={buildWhatsappUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full sm:w-auto ${
                  onAddToCart ? "px-4 py-3" : "flex-1 py-3 px-5"
                } flex items-center justify-center gap-2 rounded-xl font-black text-xs uppercase tracking-wider text-white shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98]`}
                style={{ backgroundColor: "#22C55E" }}
              >
                <MessageCircle className="w-4 h-4 fill-current" />
                <span>{onAddToCart ? "Pedir Directo" : `Pedir por WhatsApp • ${formatPrice(grandTotal)}`}</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
