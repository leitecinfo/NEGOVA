"use client";

import React, { useState, useEffect } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  Product,
  ProductModifierGroup,
  ProductModifierOption,
  ProductVariant,
  getEffectiveVariantIngredients,
} from "@/lib/products/types";
import {
  PosSelectedModifier,
  formatCOP,
  validateAllModifierGroups,
  validateModifierGroupSelection,
} from "@/lib/pos/types";
import { X, Plus, Minus, Check, Layers, AlertCircle, ShoppingBag, Sparkles } from "lucide-react";

interface ModifierSelectionModalProps {
  isOpen: boolean;
  product: Product | null;
  onClose: () => void;
  onConfirm: (
    selectedModifiers: PosSelectedModifier[],
    quantity: number,
    notes?: string,
    variant?: ProductVariant | null
  ) => void;
}

export function ModifierSelectionModal({
  isOpen,
  product,
  onClose,
  onConfirm,
}: ModifierSelectionModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  // Record: groupId -> array of selected optionIds
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  // Selección de variante / tamaño
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const rawVariants: ProductVariant[] = (product?.metadata as any)?.variants || [];
  const hasVariants = Boolean(
    (product?.metadata as any)?.has_variants && rawVariants.length > 0
  );

  const modifierGroups: ProductModifierGroup[] =
    (product?.metadata as any)?.modifier_groups || [];

  // Reset selections when product changes or opens
  useEffect(() => {
    if (product && isOpen) {
      setQuantity(1);
      setNotes("");

      // Inicializar variante activa
      if (hasVariants && rawVariants.length > 0) {
        const firstAvailable = rawVariants.find((v) => v.is_available) || rawVariants[0];
        setSelectedVariantId(firstAvailable ? firstAvailable.id : null);
      } else {
        setSelectedVariantId(null);
      }

      const initial: Record<string, string[]> = {};
      modifierGroups.forEach((grp) => {
        const gKey = grp.id || grp.name;
        initial[gKey] = [];
      });

      setSelections(initial);
    }
  }, [product, isOpen]);

  if (!isOpen || !product) return null;

  const handleToggleOption = (group: ProductModifierGroup, option: ProductModifierOption) => {
    if (!option.is_available) return;

    const gKey = group.id || group.name;
    const oKey = option.id || option.name;
    const current = selections[gKey] || [];
    const isSelected = current.includes(oKey);
    const maxAllowed = group.max_select ?? (group.required && !group.max_select ? 1 : Infinity);

    let next: string[];

    if (maxAllowed === 1) {
      // Comportamiento de radio: reemplaza la opción anterior
      if (isSelected && !group.required) {
        next = [];
      } else {
        next = [oKey];
      }
    } else {
      // Comportamiento de checkbox: hasta maxAllowed
      if (isSelected) {
        next = current.filter((id) => id !== oKey);
      } else {
        if (current.length >= maxAllowed) {
          return; // Límite máximo alcanzado
        }
        next = [...current, oKey];
      }
    }

    setSelections((prev) => ({
      ...prev,
      [gKey]: next,
    }));
  };

  // Construir lista plana de modificadores seleccionados
  const buildSelectedModifiersList = (): PosSelectedModifier[] => {
    const list: PosSelectedModifier[] = [];

    modifierGroups.forEach((grp) => {
      const gKey = grp.id || grp.name;
      const selectedIds = selections[gKey] || [];

      selectedIds.forEach((sId) => {
        const option = grp.options.find((opt) => (opt.id || opt.name) === sId);
        if (option) {
          list.push({
            groupId: gKey,
            groupName: grp.name,
            optionId: sId,
            optionName: option.name,
            price: Math.max(0, option.price || 0),
          });
        }
      });
    });

    return list;
  };

  const selectedVariant = hasVariants
    ? rawVariants.find((v) => v.id === selectedVariantId) || null
    : null;

  const effectiveBasePrice = selectedVariant
    ? Math.max(0, selectedVariant.price || 0)
    : Math.max(0, product.price || 0);

  const effectiveIngredients = getEffectiveVariantIngredients(
    (product.metadata as any)?.ingredients,
    selectedVariant
  );

  const selectedModifiersList = buildSelectedModifiersList();
  const modifiersExtraPrice = selectedModifiersList.reduce((acc, m) => acc + m.price, 0);
  const unitPrice = effectiveBasePrice + modifiersExtraPrice;
  const lineTotal = unitPrice * quantity;

  // Validación de obligatoriedad y límites
  let validation = validateAllModifierGroups(modifierGroups, selections);
  if (hasVariants && !selectedVariant) {
    validation = {
      isValid: false,
      error: "Por favor selecciona un tamaño o presentación para continuar.",
    };
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.isValid) return;

    onConfirm(selectedModifiersList, quantity, notes.trim() || undefined, selectedVariant);
    onClose();
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 m-0 p-4 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-lg bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* HEADER DEL MODAL */}
          <div className="p-5 border-b border-slate-100 dark:border-white/5 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3.5">
              {product.image_url ? (
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/[0.08] shrink-0">
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center shrink-0">
                  <Layers className="w-6 h-6" />
                </div>
              )}

              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                  {product.name}
                </h3>
                <p className="text-sm font-semibold text-[#ED500A] mt-0.5">
                  {selectedVariant
                    ? `${selectedVariant.name} — ${formatCOP(effectiveBasePrice)}`
                    : `Base: ${formatCOP(effectiveBasePrice)}`}
                </p>
                {product.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-1">
                    {product.description}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* CUERPO: VARIANTES, INGREDIENTES Y GRUPOS DE MODIFICADORES */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* SELECTOR DE TAMAÑO / VARIANTE */}
            {hasVariants && (
              <div className="p-4 bg-orange-50/60 dark:bg-[#ED500A]/5 border border-orange-200/80 dark:border-[#ED500A]/20 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#ED500A]" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                      Tamaño / Presentación *
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400">
                    Obligatorio
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {rawVariants.map((v) => {
                    const isSelected = selectedVariantId === v.id;
                    const isDisabled = !v.is_available;

                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => setSelectedVariantId(v.id)}
                        className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                          isSelected
                            ? "bg-white dark:bg-[#0D0F16] border-[#ED500A] ring-2 ring-[#ED500A]/40 shadow-xs"
                            : isDisabled
                            ? "bg-slate-100 dark:bg-white/[0.02] border-slate-200/40 opacity-50 cursor-not-allowed"
                            : "bg-white dark:bg-[#0D0F16] border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm font-bold ${isSelected ? "text-[#ED500A]" : "text-slate-800 dark:text-slate-200"}`}>
                            {v.name}
                          </span>
                          {isDisabled && (
                            <span className="text-[10px] text-red-500 font-semibold bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded">
                              Agotado
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs font-black text-slate-900 dark:text-white">
                          {formatCOP(v.price)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* INGREDIENTES / COMPONENTES EFECTIVOS */}
            {effectiveIngredients && (
              <div className="p-3 bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5 rounded-xl">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">
                  Ingredientes {selectedVariant ? `(${selectedVariant.name})` : "del producto"}:
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                  {effectiveIngredients}
                </p>
              </div>
            )}
            {modifierGroups.map((group, gIdx) => {
              const gKey = group.id || group.name;
              const currentSelected = selections[gKey] || [];
              const maxAllowed = group.max_select ?? (group.required && !group.max_select ? 1 : Infinity);
              const groupValidation = validateModifierGroupSelection(group, currentSelected);
              const isSingleChoice = maxAllowed === 1;

              return (
                <div
                  key={gKey || gIdx}
                  className="p-4 bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 rounded-xl space-y-3"
                >
                  {/* Encabezado del Grupo */}
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {group.name}
                        </h4>
                        {group.required ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400">
                            Obligatorio
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400">
                            Opcional
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {isSingleChoice
                          ? "Selecciona una opción"
                          : `Selecciona de ${group.min_select || 0} a ${
                              group.max_select || "ilimitadas"
                            } opciones`}
                      </p>
                    </div>

                    <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {currentSelected.length} {maxAllowed !== Infinity ? `/ ${maxAllowed}` : ""}
                    </div>
                  </div>

                  {/* Alerta de validación específica del grupo */}
                  {!groupValidation.isValid && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 p-2 rounded-lg border border-amber-200/60 dark:border-amber-500/20">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{groupValidation.error}</span>
                    </div>
                  )}

                  {/* Opciones del Grupo */}
                  <div className="space-y-1.5 pt-1">
                    {group.options.map((option, oIdx) => {
                      const oKey = option.id || option.name;
                      const isSelected = currentSelected.includes(oKey);
                      const isAtMax = currentSelected.length >= maxAllowed && !isSelected;
                      const isDisabled = !option.is_available || (isAtMax && !isSingleChoice);

                      return (
                        <button
                          key={oKey || oIdx}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => handleToggleOption(group, option)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                            isSelected
                              ? "bg-white dark:bg-[#0D0F16] border-[#ED500A] ring-1 ring-[#ED500A] shadow-xs"
                              : isDisabled
                              ? "bg-slate-100/60 dark:bg-white/[0.01] border-slate-200/40 dark:border-white/5 opacity-50 cursor-not-allowed"
                              : "bg-white dark:bg-[#0D0F16] border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Check / Radio visual */}
                            <div
                              className={`w-5 h-5 ${
                                isSingleChoice ? "rounded-full" : "rounded-md"
                              } border flex items-center justify-center transition-colors shrink-0 ${
                                isSelected
                                  ? "bg-[#ED500A] border-[#ED500A] text-white"
                                  : "border-slate-300 dark:border-white/20 bg-transparent"
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>

                            <span
                              className={`text-sm font-medium truncate ${
                                isSelected
                                  ? "text-slate-900 dark:text-white font-semibold"
                                  : "text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {option.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {!option.is_available ? (
                              <span className="text-[11px] font-semibold text-red-500 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded">
                                Agotado
                              </span>
                            ) : option.price > 0 ? (
                              <span className="text-xs font-semibold text-[#ED500A]">
                                +{formatCOP(option.price)}
                              </span>
                            ) : (
                              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                Sin costo
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Notas opcionales de la comanda */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Instrucciones especiales para cocina / preparación (Opcional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. Salsa aparte, término bien asado, sin sal..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ED500A]/50"
              />
            </div>
          </div>

          {/* FOOTER: TOTAL Y BOTÓN DE ACCIÓN */}
          <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              {/* Selector de cantidad */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-500">Cantidad:</span>
                <div className="flex items-center bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl p-0.5">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg disabled:opacity-30 transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm font-bold text-slate-900 dark:text-white">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Desglose de precio unitario y total */}
              <div className="text-right">
                <div className="text-xs text-slate-500">
                  {formatCOP(unitPrice)} c/u
                </div>
                <div className="text-lg font-black text-slate-900 dark:text-white">
                  {formatCOP(lineTotal)}
                </div>
              </div>
            </div>

            {/* Botón de Confirmación */}
            <button
              type="button"
              disabled={!validation.isValid}
              onClick={handleSubmit}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-bold text-sm bg-[#ED500A] hover:bg-[#ED500A]/90 text-white shadow-md shadow-[#ED500A]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>
                {validation.isValid
                  ? `Agregar al pedido — ${formatCOP(lineTotal)}`
                  : validation.error || "Completa las selecciones obligatorias"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
