"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import {
  X,
  RotateCcw,
  Package,
  AlertTriangle,
  Calendar,
  AlertCircle,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Input, Select, SearchSelect, Button, NumberInput, Textarea, DatePicker } from "@/components/ui";
import { InventariableItem } from "@/lib/inventory/types";
import {
  SpoilageUiCause,
  SPOILAGE_UI_CAUSES,
  SPOILAGE_CAUSE_LABELS,
  CreateSpoilageInput,
  UpdateSpoilageInput,
  SpoilageRecord,
} from "@/lib/spoilage/types";
import { createSpoilageRecordAction, updateSpoilageRecordAction } from "./actions";
import { formatCOP } from "@/lib/pos/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  items: InventariableItem[];
  initialItem?: InventariableItem | null;
  initialRecord?: SpoilageRecord | null;
  onSuccess: () => void;
}

export function SpoilageFormModal({
  isOpen,
  onClose,
  businessId,
  items,
  initialItem,
  initialRecord,
  onSuccess,
}: Props) {
  const isEditMode = Boolean(initialRecord);

  // Filtrar artículos que participan en existencias directas
  // En modo edición incluye el artículo ya registrado aunque tenga stock 0 actualmente
  const eligibleItems = useMemo(() => {
    return items.filter(
      (it) =>
        it.trackStock &&
        it.controlType === "direct" &&
        (it.currentStock > 0 || (initialRecord && it.id === initialRecord.itemId))
    );
  }, [items, initialRecord]);

  const isEligibleInitial = Boolean(
    initialItem &&
    initialItem.trackStock &&
    initialItem.controlType === "direct" &&
    initialItem.currentStock > 0
  );

  const [selectedItem, setSelectedItem] = useState<InventariableItem | null>(null);

  // Form fields
  const [quantity, setQuantity] = useState<number>(1);
  const [cause, setCause] = useState<SpoilageUiCause>("expired");
  const [customReason, setCustomReason] = useState<string>("");
  const [dateInput, setDateInput] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState<string>("");

  // Paso de confirmación previa
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();

  // Inicializar o preseleccionar artículo
  useEffect(() => {
    if (!isOpen) {
      setIsConfirming(false);
      return;
    }

    if (initialRecord) {
      // Modo edición: Pre-llenar con datos del registro existente
      const found = items.find((it) => it.id === initialRecord.itemId);
      if (found) {
        setSelectedItem(found);
      } else {
        setSelectedItem({
          id: initialRecord.itemId,
          name: initialRecord.itemName,
          sku: null,
          categoryName: "General",
          itemType: initialRecord.itemType,
          controlType: "direct",
          currentStock: initialRecord.previousStock ?? 0,
          minStock: 0,
          cost: initialRecord.unitCost,
          price: 0,
          totalValue: 0,
          status: "in_stock",
          unit: initialRecord.unit || "un",
          trackStock: true,
          hasVariants: false,
          variants: [],
          isAvailable: true,
        });
      }

      setQuantity(initialRecord.quantity);
      setCause((initialRecord.cause as SpoilageUiCause) || "expired");
      setCustomReason(initialRecord.customReason || "");
      setDateInput(
        initialRecord.date ? initialRecord.date.split("T")[0] : new Date().toISOString().split("T")[0]
      );
      // Limpiar notas automáticas de auditoría si existen
      const cleanNotes = (initialRecord.notes || "")
        .replace(/^Merma\s*\([^)]+\)\s*—?\s*/i, "")
        .replace(/\(Anterior:[^)]+\)/gi, "")
        .replace(/\[Editado:[^\]]+\]/gi, "")
        .trim();
      setNotes(cleanNotes);
    } else if (initialItem && initialItem.trackStock && initialItem.controlType === "direct" && initialItem.currentStock > 0) {
      setSelectedItem(initialItem);
      setQuantity(1);
      setCause("expired");
      setCustomReason("");
      setNotes("");
      setDateInput(new Date().toISOString().split("T")[0]);
    } else if (eligibleItems.length > 0) {
      setSelectedItem(eligibleItems[0]);
      setQuantity(1);
      setCause("expired");
      setCustomReason("");
      setNotes("");
      setDateInput(new Date().toISOString().split("T")[0]);
    } else {
      setSelectedItem(null);
      setQuantity(1);
      setCause("expired");
      setCustomReason("");
      setNotes("");
      setDateInput(new Date().toISOString().split("T")[0]);
    }

    setIsConfirming(false);
  }, [isOpen, initialItem, initialRecord, eligibleItems, items]);

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

  const currentStock = selectedItem ? selectedItem.currentStock : 0;
  const unit = selectedItem ? selectedItem.unit : "un";
  const isIntegerUnit = unit.toLowerCase() === "un" || unit.toLowerCase() === "unidad" || unit.toLowerCase() === "unidades";
  const unitCost = selectedItem ? selectedItem.cost : 0;
  const totalCost = Number((quantity * unitCost).toFixed(2));

  // Cálculo de diferencia y stock resultante en modo creación vs edición
  const isSameItemInEdit = isEditMode && initialRecord && selectedItem?.id === initialRecord.itemId;
  const baseStockAvailable = isSameItemInEdit
    ? currentStock + (initialRecord ? initialRecord.quantity : 0)
    : currentStock;
  const difference = isSameItemInEdit && initialRecord ? quantity - initialRecord.quantity : quantity;
  const resultingStock = isSameItemInEdit
    ? Math.max(0, currentStock - difference)
    : Math.max(0, currentStock - quantity);

  // Validaciones
  const isZeroOrNegative = quantity <= 0;
  const isExcessive = isSameItemInEdit
    ? quantity > baseStockAvailable
    : (selectedItem ? quantity > currentStock : false);
  const isCustomReasonMissing = cause === "other" && (!customReason || customReason.trim().length === 0);
  const hasZeroStock = !isEditMode && (selectedItem ? currentStock <= 0 : true);

  const canProceed =
    Boolean(selectedItem) &&
    !isZeroOrNegative &&
    !isExcessive &&
    !isCustomReasonMissing &&
    !hasZeroStock;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canProceed || !selectedItem) return;

    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }

    startTransition(async () => {
      try {
        if (isEditMode && initialRecord) {
          // Actualización de merma
          const updatePayload: UpdateSpoilageInput = {
            id: initialRecord.id,
            itemType: selectedItem.itemType,
            itemId: selectedItem.id,
            itemName: selectedItem.name,
            cause,
            customReason: cause === "other" ? customReason.trim() : null,
            unit,
            quantity,
            unitCost,
            notes: notes.trim() || null,
            date: dateInput ? `${dateInput}T${new Date().toTimeString().split(" ")[0]}Z` : undefined,
          };

          const res = await updateSpoilageRecordAction(businessId, updatePayload);

          if (res.success && res.data) {
            toast.success("Merma actualizada con éxito", {
              description: `Se actualizaron las existencias de «${selectedItem.name}». Stock resultante: ${resultingStock} ${unit}.`,
            });
            onSuccess();
            onClose();
          } else {
            toast.error("Error al actualizar la merma", {
              description: res.error || "No se pudo guardar la modificación.",
            });
            setIsConfirming(false);
          }
        } else {
          // Creación de merma nueva
          const createPayload: CreateSpoilageInput = {
            itemType: selectedItem.itemType,
            itemId: selectedItem.id,
            itemName: selectedItem.name,
            cause,
            customReason: cause === "other" ? customReason.trim() : null,
            unit,
            quantity,
            unitCost,
            notes: notes.trim() || null,
            date: dateInput ? `${dateInput}T${new Date().toTimeString().split(" ")[0]}Z` : undefined,
            idempotencyKey: `${businessId}_${selectedItem.id}_${quantity}_${cause}_${Date.now()}`,
          };

          const res = await createSpoilageRecordAction(businessId, createPayload);

          if (res.success && res.data) {
            toast.success("Merma registrada con éxito", {
              description: `Se descontaron ${quantity} ${unit} de «${selectedItem.name}». Stock resultante: ${resultingStock} ${unit}.`,
            });
            onSuccess();
            onClose();
          } else {
            toast.error("Error al registrar merma", {
              description: res.error || "No se pudo procesar la solicitud.",
            });
            setIsConfirming(false);
          }
        }
      } catch (err: any) {
        toast.error("Error inesperado", {
          description: err?.message || "Ocurrió un fallo de conexión.",
        });
        setIsConfirming(false);
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
          className="relative w-full max-w-lg bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] shrink-0">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl border shrink-0 ${
                  isEditMode
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                }`}
              >
                {isEditMode ? <RotateCcw className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold font-title text-slate-900 dark:text-white">
                  {isEditMode ? "Editar merma" : "Registrar merma"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-body mt-0.5">
                  {isEditMode
                    ? "Modifica el artículo, cantidad, fecha o motivo de la merma."
                    : "Salida por pérdida, daño, descomposición o desperdicio justificado."}
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

          {/* Si no hay artículos con existencias disponibles */}
          {eligibleItems.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                No hay artículos con existencias disponibles
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                Para registrar una merma, el negocio debe contar con productos comerciales o insumos con control de stock y existencias físicas mayores a cero.
              </p>
              <div className="pt-2">
                <Button variant="outline" size="sm" onClick={onClose}>
                  Entendido
                </Button>
              </div>
            </div>
          ) : (
            /* Formulario */
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="p-5 space-y-4 overflow-y-auto overflow-x-hidden flex-1">
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
                        <span className="text-2xs font-medium text-slate-400 block">Stock disponible</span>
                        <span className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                          {initialItem.currentStock} {initialItem.unit}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <SearchSelect
                      label="Artículo a mermar"
                      required
                      options={itemSelectOptions}
                      value={selectedItem?.id || ""}
                      onChange={(val) => {
                        const found = eligibleItems.find((it) => it.id === val);
                        if (found) setSelectedItem(found);
                      }}
                      placeholder="Seleccionar producto o insumo..."
                      searchPlaceholder="Buscar por nombre o SKU..."
                      emptyText="No se encontraron artículos con existencias disponibles"
                      disabled={isPending || isConfirming}
                      selectSize="md"
                      helperText={selectedItem ? `Stock actual disponible: ${currentStock} ${unit}` : undefined}
                    />
                  )}
                </div>

                {/* 2. Cantidad y Fecha */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <NumberInput
                    label="Cantidad perdida"
                    required
                    value={quantity}
                    onChange={(val) => setQuantity(val)}
                    min={isIntegerUnit ? 1 : 0.01}
                    max={currentStock > 0 ? currentStock : undefined}
                    step={isIntegerUnit ? 1 : 0.1}
                    precision={isIntegerUnit ? 0 : 3}
                    allowDecimals={!isIntegerUnit}
                    unit={unit}
                    disabled={isPending || isConfirming || hasZeroStock}
                    error={isExcessive ? `Supera el stock actual (${currentStock} ${unit})` : undefined}
                  />

                  <DatePicker
                    label="Fecha de la merma"
                    required
                    value={dateInput}
                    onChange={(val) => setDateInput(val)}
                    disabled={isPending || isConfirming}
                    align="right"
                  />
                </div>

                {/* 3. Motivo de la merma */}
                <Select
                  label="Motivo de la merma"
                  required
                  value={cause}
                  onChange={(e) => setCause(e.target.value as SpoilageUiCause)}
                  disabled={isPending || isConfirming}
                >
                  {SPOILAGE_UI_CAUSES.map((c) => (
                    <option key={c} value={c}>
                      {SPOILAGE_CAUSE_LABELS[c]}
                    </option>
                  ))}
                </Select>

                {/* Campo para describir "Otro motivo" */}
                {cause === "other" && (
                  <Input
                    label="Descripción del motivo"
                    required
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    disabled={isPending || isConfirming}
                    placeholder="Ej: Contaminación cruzada, corte de luz en refrigerador..."
                    helperText="Indica la causa específica de la merma"
                  />
                )}

                {/* 4. Observaciones adicionales */}
                <Textarea
                  label="Observación adicional (opcional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isPending || isConfirming}
                  rows={2}
                  placeholder="Detalles sobre lo ocurrido, lote o turno..."
                />

                {/* 5. Resumen de Impacto */}
                {selectedItem && !isZeroOrNegative && !isExcessive && (
                  <div className="p-3.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl space-y-2 text-xs font-body">
                    {isEditMode && initialRecord ? (
                      <>
                        <div className="flex items-center justify-between font-semibold">
                          <span className="text-slate-500 dark:text-slate-400">Cantidad anterior:</span>
                          <span className="font-mono text-slate-700 dark:text-slate-300">
                            {initialRecord.quantity} {unit}
                          </span>
                        </div>
                        <div className="flex items-center justify-between font-semibold">
                          <span className="text-slate-500 dark:text-slate-400">Impacto en existencias:</span>
                          <span
                            className={`font-mono font-bold ${
                              difference > 0
                                ? "text-rose-600 dark:text-rose-400"
                                : difference < 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            {difference > 0
                              ? `-${difference} ${unit} (se descontarán adicionales)`
                              : difference < 0
                              ? `+${Math.abs(difference)} ${unit} (se reintegrarán al stock)`
                              : "Sin variación de cantidad"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between font-semibold pt-1 border-t border-slate-200/50 dark:border-white/[0.04]">
                          <span className="text-slate-500 dark:text-slate-400">Stock resultante:</span>
                          <span className="font-mono text-slate-900 dark:text-white font-bold">
                            {resultingStock} {unit}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between font-semibold">
                          <span className="text-slate-500 dark:text-slate-400">Existencias resultantes:</span>
                          <span className="font-mono text-slate-900 dark:text-white">
                            {currentStock} → <strong className="text-rose-600 dark:text-rose-400">{resultingStock} {unit}</strong>
                          </span>
                        </div>
                        {unitCost > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 dark:text-slate-400">Valorización de la pérdida:</span>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              {formatCOP(totalCost)}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* 6. Panel de Confirmación */}
                {isConfirming && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>{isEditMode ? "¿Confirmar cambios en la merma?" : "¿Confirmar registro de merma?"}</span>
                    </div>
                    <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                      {isEditMode
                        ? `Esta acción recalculará el efecto sobre las existencias físicas de «${selectedItem?.name}» dejando un stock resultante de ${resultingStock} ${unit} y actualizará el Kardex.`
                        : `Esta acción descontará inmediatamente ${quantity} ${unit} de «${selectedItem?.name}» de las existencias físicas del inventario y registrará un movimiento inmutable en el Kardex.`}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer Buttons (Pinned en la parte inferior) */}
              <div className="p-4 px-5 flex items-center justify-end gap-2.5 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] shrink-0">
                {isConfirming ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsConfirming(false)}
                      disabled={isPending}
                    >
                      Volver y editar
                    </Button>
                    <Button
                      variant={isEditMode ? "primary" : "destructive"}
                      size="sm"
                      type="submit"
                      isLoading={isPending}
                    >
                      {isEditMode ? "Guardar cambios" : "Confirmar merma"}
                    </Button>
                  </>
                ) : (
                  <>
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
                      disabled={!canProceed || isPending}
                    >
                      {isEditMode ? "Continuar con la edición" : "Continuar"}
                    </Button>
                  </>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
