"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import {
  X,
  SlidersHorizontal,
  Package,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Equal,
  Plus,
  Minus,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Input, Select, SearchSelect, Button, NumberInput, Textarea } from "@/components/ui";
import {
  InventariableItem,
  AdjustmentReason,
  ADJUSTMENT_REASON_LABELS,
  ADJUSTMENT_UI_REASONS,
} from "@/lib/inventory/types";
import { executeStockAdjustmentAction } from "./actions";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  items: InventariableItem[];
  initialItem?: InventariableItem | null;
  onSuccess: () => void;
}

export function StockAdjustmentModal({
  isOpen,
  onClose,
  businessId,
  items,
  initialItem,
  onSuccess,
}: Props) {
  // Filtrar artículos que controlen existencias físicas directas
  // Excluye productos preparados controlados por receta y servicios.
  // Permite productos con stock 0 porque un artículo agotado puede necesitar ajuste positivo.
  const eligibleItems = useMemo(() => {
    return items.filter(
      (it) => it.trackStock && it.controlType === "direct"
    );
  }, [items]);

  const isEligibleInitial = Boolean(
    initialItem &&
    initialItem.trackStock &&
    initialItem.controlType === "direct"
  );

  const [selectedItem, setSelectedItem] = useState<InventariableItem | null>(null);

  // Modo de ajuste: 'physical_count' (conteo total) o 'variation' (+ / -)
  const [adjustmentMode, setAdjustmentMode] = useState<"physical_count" | "variation">("physical_count");
  const [targetCount, setTargetCount] = useState<number>(0);
  const [variationDirection, setVariationDirection] = useState<"add" | "subtract">("add");
  const [variationAmount, setVariationAmount] = useState<number>(1);

  // Campos adicionales
  const [reason, setReason] = useState<AdjustmentReason>("physical_count");
  const [customReason, setCustomReason] = useState<string>("");
  const [costInput, setCostInput] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [isPending, startTransition] = useTransition();

  // Reset y preselección al abrir el modal
  useEffect(() => {
    if (!isOpen) return;

    if (initialItem && initialItem.trackStock && initialItem.controlType === "direct") {
      setSelectedItem(initialItem);
      setTargetCount(initialItem.currentStock);
      setCostInput(initialItem.cost > 0 ? String(initialItem.cost) : "");
    } else if (eligibleItems.length > 0) {
      const first = eligibleItems[0];
      setSelectedItem(first);
      setTargetCount(first.currentStock);
      setCostInput(first.cost > 0 ? String(first.cost) : "");
    } else {
      setSelectedItem(null);
      setTargetCount(0);
      setCostInput("");
    }

    setAdjustmentMode("physical_count");
    setVariationDirection("add");
    setVariationAmount(1);
    setReason("physical_count");
    setCustomReason("");
    setNotes("");
  }, [isOpen, initialItem, eligibleItems]);

  const handleSelectItem = (item: InventariableItem) => {
    setSelectedItem(item);
    setTargetCount(item.currentStock);
    setVariationAmount(1);
    setCostInput(item.cost > 0 ? String(item.cost) : "");
  };

  const itemSelectOptions = useMemo(() => {
    return eligibleItems.map((it) => ({
      value: it.id,
      label: it.name,
      description: `${it.itemType === "ingredient" ? "Insumo / Ingrediente" : "Producto"} • Stock: ${it.currentStock} ${it.unit}${it.sku ? ` • SKU: ${it.sku}` : ""}`,
      icon: it.imageUrl ? (
        <img
          src={it.imageUrl}
          alt={it.name}
          className="w-4 h-4 rounded-sm object-cover"
        />
      ) : (
        <Package className="w-4 h-4 text-slate-400" />
      ),
    }));
  }, [eligibleItems]);

  // Cálculos en tiempo real
  const currentStock = selectedItem ? selectedItem.currentStock : 0;
  const unit = selectedItem?.unit || "un";
  const isIntegerUnit = unit.toLowerCase() === "un" || unit.toLowerCase() === "unidad" || unit.toLowerCase() === "unidades";

  const { targetQuantity, difference } = useMemo(() => {
    if (adjustmentMode === "physical_count") {
      const validTarget = Math.max(0, targetCount);
      return {
        targetQuantity: validTarget,
        difference: Number((validTarget - currentStock).toFixed(3)),
      };
    } else {
      const delta = Math.max(0, variationAmount);
      const target = variationDirection === "add" ? currentStock + delta : currentStock - delta;
      return {
        targetQuantity: Number(target.toFixed(3)),
        difference: Number((variationDirection === "add" ? delta : -delta).toFixed(3)),
      };
    }
  }, [adjustmentMode, targetCount, variationDirection, variationAmount, currentStock]);

  const isResultNegative = targetQuantity < 0;
  const isCustomReasonMissing = reason === "other" && (!customReason || customReason.trim().length === 0);
  const canProceed = Boolean(selectedItem) && !isResultNegative && !isCustomReasonMissing;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedItem) {
      toast.error("Por favor selecciona un artículo para realizar el ajuste.");
      return;
    }

    if (isResultNegative) {
      toast.error("La existencia resultante no puede ser negativa.");
      return;
    }

    if (isCustomReasonMissing) {
      toast.error("Por favor especifica la descripción del motivo del ajuste.");
      return;
    }

    const parsedCost = costInput ? parseFloat(costInput) : undefined;
    if (parsedCost !== undefined && (isNaN(parsedCost) || parsedCost < 0)) {
      toast.error("El costo unitario ingresado es inválido.");
      return;
    }

    const fullNotes = [
      reason === "other" ? `Otro motivo: ${customReason.trim()}` : null,
      notes.trim() || null,
    ]
      .filter(Boolean)
      .join(" — ");

    startTransition(async () => {
      try {
        const res = await executeStockAdjustmentAction(businessId, {
          productId: selectedItem.id,
          targetQuantity,
          reason,
          unitCost: parsedCost,
          notes: fullNotes || undefined,
        });

        if (res.success && res.data) {
          const diffStr = res.data.difference >= 0 ? `+${res.data.difference}` : `${res.data.difference}`;
          toast.success("Ajuste de inventario aplicado exitosamente", {
            description: `«${selectedItem.name}»: ${res.data.previousQuantity} → ${res.data.newQuantity} ${unit} (${diffStr} ${unit}).`,
          });
          onSuccess();
          onClose();
        } else {
          toast.error("No se pudo aplicar el ajuste", {
            description: res.error || "Ocurrió un error inesperado en el servidor.",
          });
        }
      } catch (err: any) {
        toast.error("Fallo de comunicación", {
          description: err?.message || "Error al conectar con el servidor.",
        });
      }
    });
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
        onClick={() => {
          if (!isPending) onClose();
        }}
      >
        <div
          className="relative w-full max-w-lg bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center shrink-0 border border-[#ED500A]/20">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold font-title text-slate-900 dark:text-white">
                  Ajuste manual de existencias
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-body">
                  Corrige cantidades físicas dejando trazabilidad estricta
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer disabled:opacity-50"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Estado vacío si no hay artículos inventariables */}
          {eligibleItems.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                No hay artículos inventariables disponibles
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                El ajuste manual solo aplica sobre productos comerciales o insumos con control de existencias físicas directo.
              </p>
              <div className="pt-2">
                <Button variant="outline" size="sm" onClick={onClose}>
                  Entendido
                </Button>
              </div>
            </div>
          ) : (
            /* Formulario */
            <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto overflow-x-hidden">
              {/* 1. Selector de Artículo */}
              <div className="space-y-1.5">
                {isEligibleInitial && initialItem ? (
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-200/70 dark:bg-white/[0.06] flex items-center justify-center shrink-0 text-slate-500">
                        <Package className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                          {initialItem.name}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {initialItem.itemType === "ingredient" ? "Insumo / Ingrediente" : "Producto"}
                          {initialItem.sku ? ` • SKU: ${initialItem.sku}` : ""}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-2xs font-medium text-slate-400 block">Stock registrado</span>
                      <span className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                        {initialItem.currentStock} {initialItem.unit}
                      </span>
                    </div>
                  </div>
                ) : (
                  <SearchSelect
                    label="Artículo a ajustar"
                    required
                    options={itemSelectOptions}
                    value={selectedItem?.id || ""}
                    onChange={(val) => {
                      const found = eligibleItems.find((it) => it.id === val);
                      if (found) handleSelectItem(found);
                    }}
                    placeholder="Buscar por nombre o SKU..."
                    searchPlaceholder="Escribe el nombre o SKU..."
                    emptyText="No se encontraron artículos inventariables"
                    selectSize="md"
                    helperText={selectedItem ? `Existencia registrada en sistema: ${currentStock} ${unit}` : undefined}
                  />
                )}
              </div>

              {/* 2. Selector de Método de Ajuste */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block font-body">
                  Método de ajuste
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-white/[0.04] rounded-2xl border border-slate-200/60 dark:border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setAdjustmentMode("physical_count")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      adjustmentMode === "physical_count"
                        ? "bg-white dark:bg-[#1E2230] text-[#ED500A] shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Conteo físico (Total)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentMode("variation")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      adjustmentMode === "variation"
                        ? "bg-white dark:bg-[#1E2230] text-[#ED500A] shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Variación (+ / -)
                  </button>
                </div>
              </div>

              {/* 3. Inputs numéricos según el método */}
              {adjustmentMode === "physical_count" ? (
                <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] space-y-2">
                  <NumberInput
                    label="Existencia física real contada"
                    required
                    value={targetCount}
                    onChange={(val) => setTargetCount(val)}
                    min={0}
                    step={isIntegerUnit ? 1 : 0.1}
                    precision={isIntegerUnit ? 0 : 3}
                    allowDecimals={!isIntegerUnit}
                    unit={unit}
                    disabled={isPending}
                    helperText={`Existencia registrada actualmente: ${currentStock} ${unit}`}
                  />
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setVariationDirection("add")}
                      className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        variationDirection === "add"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-slate-200/60 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Sumar entrada (+)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVariationDirection("subtract")}
                      className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        variationDirection === "subtract"
                          ? "bg-rose-600 text-white shadow-xs"
                          : "bg-slate-200/60 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      <Minus className="w-3.5 h-3.5" />
                      <span>Restar salida (-)</span>
                    </button>
                  </div>

                  <NumberInput
                    label="Cantidad a variar"
                    required
                    value={variationAmount}
                    onChange={(val) => setVariationAmount(val)}
                    min={isIntegerUnit ? 1 : 0.01}
                    step={isIntegerUnit ? 1 : 0.1}
                    precision={isIntegerUnit ? 0 : 3}
                    allowDecimals={!isIntegerUnit}
                    unit={unit}
                    disabled={isPending}
                    error={
                      isResultNegative
                        ? `La resta excede las existencias registradas (${currentStock} ${unit})`
                        : undefined
                    }
                  />
                </div>
              )}

              {/* 4. Selector de Motivo */}
              <div className="space-y-1.5">
                <Select
                  label="Motivo del ajuste"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value as AdjustmentReason)}
                  disabled={isPending}
                >
                  {ADJUSTMENT_UI_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {ADJUSTMENT_REASON_LABELS[r]}
                    </option>
                  ))}
                </Select>

                {/* Aviso para mermas */}
                <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Para registrar pérdidas por daño o vencimiento, utiliza el botón Registrar merma.</span>
                </p>
              </div>

              {/* Campo para describir "Otro motivo" */}
              {reason === "other" && (
                <Input
                  label="Descripción del motivo"
                  required
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  disabled={isPending}
                  placeholder="Especifica la causa del ajuste manual..."
                  helperText="Indica la justificación operativa del ajuste"
                />
              )}

              {/* 5. Costo unitario y observaciones */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Costo unitario (opcional)"
                  type="number"
                  step="any"
                  min="0"
                  value={costInput}
                  onChange={(e) => setCostInput(e.target.value)}
                  placeholder="0"
                  helperText="Actualiza costo promedio si se especifica"
                />

                <Textarea
                  label="Notas / Detalle opcional"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej. Revisión física bodega, muestra comercial..."
                />
              </div>

              {/* 6. Resumen de Impacto en Existencias */}
              {selectedItem && (
                <div className="p-3.5 rounded-2xl bg-slate-900 text-white dark:bg-white/[0.04] border border-slate-800 dark:border-white/[0.08] space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block font-body">
                    Impacto en existencias
                  </span>
                  <div className="flex items-center justify-between text-xs font-body">
                    <div className="text-center">
                      <span className="text-[10px] text-slate-400 block">Existencia actual</span>
                      <span className="font-mono font-bold text-sm text-slate-200">
                        {currentStock} {unit}
                      </span>
                    </div>

                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-slate-400 block">Variación</span>
                      <div
                        className={`inline-flex items-center gap-1 font-mono font-bold text-xs px-2.5 py-0.5 rounded-full ${
                          difference > 0
                            ? "bg-emerald-500/20 text-emerald-400"
                            : difference < 0
                            ? "bg-rose-500/20 text-rose-400"
                            : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {difference > 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : difference < 0 ? (
                          <TrendingDown className="w-3 h-3" />
                        ) : (
                          <Equal className="w-3 h-3" />
                        )}
                        <span>{difference >= 0 ? `+${difference}` : difference} {unit}</span>
                      </div>
                    </div>

                    <ArrowRight className="w-4 h-4 text-slate-500" />

                    <div className="text-center">
                      <span className="text-[10px] text-slate-400 block">Nueva existencia</span>
                      <span className={`font-mono font-bold text-base ${isResultNegative ? "text-rose-500" : "text-[#ED500A]"}`}>
                        {targetQuantity} {unit}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 7. Botones de acción */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200/80 dark:border-white/[0.08]">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  disabled={isPending}
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  isLoading={isPending}
                  disabled={!canProceed || isPending}
                >
                  Confirmar y aplicar ajuste
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
