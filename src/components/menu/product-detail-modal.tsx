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
  Flame,
  Info,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { Product, ProductVariant, ProductModifierGroup, getProductImages } from "@/lib/products/types";
import { ProductImageGallery } from "./product-image-gallery";
import { validateModifierGroupSelection, validateAllModifierGroups } from "@/lib/pos/types";
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
    taxPercentage?: number;
    taxIncludedInPrice?: boolean;
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

  const productImages: string[] = useMemo(() => {
    return getProductImages(product);
  }, [product]);

  const modifierGroups: ProductModifierGroup[] = useMemo(() => {
    if (!product) return [];
    const meta = product.metadata as any;
    if (Array.isArray(meta?.modifier_groups)) {
      return (meta.modifier_groups as ProductModifierGroup[])
        .filter((g) => g.status !== "inactive")
        .map((g) => ({
          ...g,
          options: (g.options || []).filter((opt) => opt.status !== "inactive"),
        }))
        .filter((g) => g.options.length > 0);
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

  // Calcular precio de extras seleccionados y lista de modificadores normalizada
  let extrasPrice = 0;
  const chosenModifiersList: {
    groupId: string;
    groupName: string;
    optionId: string;
    optionName: string;
    price: number;
  }[] = [];

  modifierGroups.forEach((group) => {
    const groupKey = group.id || group.name;
    const chosenIds = selectedModifiers[groupKey] || selectedModifiers[group.name] || [];
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

  // Validación de requerimientos y límites de modificadores
  const validation = useMemo(() => {
    // 1. Validar variante si el producto tiene variantes registradas
    if (variants.length > 0 && !selectedVariantId) {
      return {
        isValid: false,
        error: "Debes elegir una presentación o tamaño.",
      };
    }

    // 2. Validar reglas de cada grupo de modificadores (obligatoriedad, mín y máx)
    for (const group of modifierGroups) {
      const groupKey = group.id || group.name;
      const chosen = selectedModifiers[groupKey] || selectedModifiers[group.name] || [];
      const check = validateModifierGroupSelection(group, chosen);
      if (!check.isValid) {
        return check;
      }
    }

    return { isValid: true };
  }, [variants, selectedVariantId, modifierGroups, selectedModifiers]);

  const formatPrice = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: business.currency || "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleToggleModifier = (group: ProductModifierGroup, optionId: string) => {
    const groupKey = group.id || group.name;
    const current = selectedModifiers[groupKey] || selectedModifiers[group.name] || [];
    const maxAllowed = group.max_select ?? (group.required && !group.max_select ? 1 : Infinity);
    const isSingleChoice = maxAllowed === 1;

    if (isSingleChoice) {
      // Selección única (estilo radio button)
      if (current.includes(optionId)) {
        if (!group.required) {
          setSelectedModifiers((prev) => ({
            ...prev,
            [groupKey]: [],
            [group.name]: [],
          }));
        }
      } else {
        setSelectedModifiers((prev) => ({
          ...prev,
          [groupKey]: [optionId],
          [group.name]: [optionId],
        }));
      }
    } else {
      // Selección múltiple (estilo checkbox)
      if (current.includes(optionId)) {
        const next = current.filter((id) => id !== optionId);
        setSelectedModifiers((prev) => ({
          ...prev,
          [groupKey]: next,
          [group.name]: next,
        }));
      } else {
        if (current.length < maxAllowed) {
          const next = [...current, optionId];
          setSelectedModifiers((prev) => ({
            ...prev,
            [groupKey]: next,
            [group.name]: next,
          }));
        } else {
          // El usuario intenta seleccionar más de lo permitido
          toast.warning(
            `Límite alcanzado: puedes seleccionar como máximo ${maxAllowed} ${
              maxAllowed === 1 ? "opción" : "opciones"
            } en «${group.name}».`
          );
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
        {/* Cabecera con Galería de Fotografías */}
        <div className="relative">
          <ProductImageGallery
            images={productImages}
            productName={product.name}
            theme={theme}
            primaryColor={primaryColor}
          />

          {/* Botón Cerrar flotante */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full bg-black/65 hover:bg-black/85 text-white backdrop-blur-md transition-all shadow-md z-30 cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Badge de Precio Flotante (cuando hay foto cargada) */}
          {productImages.length > 0 && (
            <div
              className={`absolute right-4 px-3.5 py-1 rounded-xl text-xs sm:text-sm font-black text-white shadow-lg backdrop-blur-sm z-20 ${
                productImages.length > 1 ? "bottom-16 sm:bottom-18" : "bottom-3"
              }`}
              style={{ backgroundColor: primaryColor }}
            >
              {formatPrice(unitTotal)}
            </div>
          )}
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
                <Info className="w-3.5 h-3.5" />
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
                const groupKey = group.id || group.name;
                const chosenIds = selectedModifiers[groupKey] || selectedModifiers[group.name] || [];
                const maxAllowed = group.max_select ?? (group.required && !group.max_select ? 1 : Infinity);
                const minRequired = group.required ? Math.max(1, group.min_select || 1) : (group.min_select || 0);
                const isSingleChoice = maxAllowed === 1;
                const groupValidation = validateModifierGroupSelection(group, chosenIds);
                const isComplete = groupValidation.isValid;

                return (
                  <div
                    key={groupKey}
                    className={`space-y-2 p-3 sm:p-3.5 rounded-2xl border transition-all ${
                      !groupValidation.isValid
                        ? isDark
                          ? "bg-amber-500/[0.04] border-amber-500/30"
                          : "bg-amber-50/50 border-amber-300/70"
                        : isDark
                        ? "bg-white/[0.02] border-white/5"
                        : "bg-slate-50/60 border-slate-200/80"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-black uppercase tracking-wider truncate">
                          {group.name}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white/10 text-slate-300 shrink-0">
                          {group.commercial_type === "replacement" || group.type === "replacement"
                            ? "Reemplazo"
                            : group.commercial_type === "size" || group.type === "size"
                            ? "Tamaño"
                            : "Adicional"}
                        </span>
                        {group.required ? (
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md shrink-0 ${
                              isComplete
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            }`}
                          >
                            {isComplete ? "✓ Listo" : "Obligatorio"}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-400 bg-white/5 px-2 py-0.5 rounded-md shrink-0">
                            Opcional
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] font-mono text-slate-400 shrink-0">
                        {isSingleChoice
                          ? "1 opción"
                          : `${chosenIds.length} / ${maxAllowed === Infinity ? "∞" : maxAllowed}`}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400">
                      {isSingleChoice
                        ? "Selecciona 1 opción"
                        : minRequired > 0
                        ? `Selecciona de ${minRequired} a ${maxAllowed === Infinity ? "varias" : maxAllowed} opciones`
                        : `Hasta ${maxAllowed === Infinity ? "varias" : maxAllowed} opciones`}
                    </div>

                    {/* Alerta de validación específica del grupo */}
                    {!groupValidation.isValid && (
                      <div className="flex items-center gap-1.5 p-2 rounded-xl text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                        <span className="text-[11px] leading-tight font-medium">{groupValidation.error}</span>
                      </div>
                    )}

                    <div className="space-y-1.5 pt-1">
                      {group.options.map((opt) => {
                        const optId = opt.id || opt.name;
                        const isChosen = chosenIds.includes(optId);
                        const isAtMax = chosenIds.length >= maxAllowed && !isChosen && !isSingleChoice;

                        return (
                          <button
                            key={optId}
                            type="button"
                            disabled={!opt.is_available}
                            onClick={() => handleToggleModifier(group, optId)}
                            className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                              isChosen
                                ? isDark
                                  ? "bg-white/10 border-white/30 text-white shadow-xs"
                                  : "bg-blue-50 border-blue-300 text-blue-900 shadow-xs"
                                : isAtMax
                                ? isDark
                                  ? "bg-white/[0.01] border-white/5 text-slate-400 opacity-60"
                                  : "bg-slate-50/50 border-slate-200 text-slate-400 opacity-60"
                                : isDark
                                ? "bg-white/[0.02] border-white/5 text-slate-300 hover:bg-white/5"
                                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-3.5 h-3.5 ${
                                  isSingleChoice ? "rounded-full" : "rounded"
                                } border flex items-center justify-center shrink-0 ${
                                  isChosen ? "border-transparent text-white" : "border-slate-500"
                                }`}
                                style={{
                                  backgroundColor: isChosen ? primaryColor : "transparent",
                                }}
                              >
                                {isChosen && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </div>
                              <span className={`font-semibold ${isChosen ? "text-white font-bold" : ""}`}>
                                {opt.name}
                              </span>
                            </div>

                            {opt.price > 0 ? (
                              <span className="font-bold opacity-90 text-[11px]">
                                +{formatPrice(opt.price)}
                              </span>
                            ) : (
                              <span className="text-[11px] opacity-75 font-medium">
                                {group.commercial_type === "replacement" || group.type === "replacement"
                                  ? "Sin costo adicional"
                                  : "Sin costo"}
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
          className={`p-4 border-t flex flex-col gap-3 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] ${
            isDark ? "bg-[#0E1017] border-white/10" : "bg-slate-50 border-slate-200"
          }`}
        >
          {/* Alerta global si faltan selecciones obligatorias */}
          {!validation.isValid && (
            <div className="w-full px-3 py-2 rounded-xl text-xs bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
              <span className="font-semibold text-[11px] leading-tight">
                {validation.error}
              </span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
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
                  className="p-2 hover:opacity-75 transition-opacity cursor-pointer disabled:opacity-30"
                  disabled={quantity <= 1}
                  aria-label="Disminuir cantidad"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-8 text-center text-xs font-black">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="p-2 hover:opacity-75 transition-opacity cursor-pointer"
                  aria-label="Aumentar cantidad"
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
                  disabled={!validation.isValid}
                  onClick={() => {
                    if (!product || !validation.isValid) return;
                    onAddToCart({
                      productId: product.id,
                      name: product.name,
                      variantId: selectedVariant?.id || null,
                      variantName: selectedVariant?.name,
                      unitPrice: unitTotal,
                      quantity,
                      image_url: product.image_url,
                      selectedModifiers: chosenModifiersList.length > 0 ? chosenModifiersList : undefined,
                      taxPercentage: Number((product.metadata as any)?.tax_percentage ?? (product as any).tax_percentage ?? 0),
                      taxIncludedInPrice: (product.metadata as any)?.tax_included_in_price ?? (product as any).tax_included_in_price ?? true,
                    });
                    onClose();
                  }}
                  className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider text-white shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100 min-h-[44px]"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {validation.isValid
                      ? `+ Agregar al Pedido • ${formatPrice(grandTotal)}`
                      : validation.error || "Completa las opciones"}
                  </span>
                </button>
              )}

              {cleanWhatsapp && (
                validation.isValid ? (
                  <a
                    href={buildWhatsappUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full sm:w-auto ${
                      onAddToCart ? "px-4 py-3" : "flex-1 py-3 px-5"
                    } flex items-center justify-center gap-2 rounded-xl font-black text-xs uppercase tracking-wider text-white shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98] min-h-[44px]`}
                    style={{ backgroundColor: "#22C55E" }}
                  >
                    <MessageCircle className="w-4 h-4 fill-current" />
                    <span>{onAddToCart ? "Pedir Directo" : `Pedir por WhatsApp • ${formatPrice(grandTotal)}`}</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className={`w-full sm:w-auto ${
                      onAddToCart ? "px-4 py-3" : "flex-1 py-3 px-5"
                    } flex items-center justify-center gap-2 rounded-xl font-black text-xs uppercase tracking-wider text-white bg-slate-400 dark:bg-white/10 opacity-50 cursor-not-allowed min-h-[44px]`}
                    title={validation.error}
                  >
                    <MessageCircle className="w-4 h-4 fill-current" />
                    <span>{onAddToCart ? "Pedir Directo" : "Completar Opciones"}</span>
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
