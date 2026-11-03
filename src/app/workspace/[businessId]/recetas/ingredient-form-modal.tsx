"use client";

import React, { useState, useEffect } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  X,
  Apple,
  Scale,
  DollarSign,
  Package,
  Layers,
  MapPin,
  Eye,
  Store,
  QrCode,
  Globe,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Location } from "@/lib/inventory/types";
import {
  Ingredient,
  CreateIngredientInput,
  UpdateIngredientInput,
  INGREDIENT_UNITS,
} from "@/lib/recipes/types";
import { createIngredientAction, updateIngredientAction } from "./actions";

interface Props {
  businessId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (ingredient: Ingredient) => void;
  locations: Location[];
  ingredientToEdit?: Ingredient | null;
  availableUnits?: { value: string; label: string }[];
}

export function IngredientFormModal({
  businessId,
  isOpen,
  onClose,
  onSuccess,
  locations,
  ingredientToEdit,
  availableUnits,
}: Props) {
  const isEditing = Boolean(ingredientToEdit);

  const unitOptions =
    availableUnits && availableUnits.length > 0 ? availableUnits : INGREDIENT_UNITS;

  const [name, setName] = useState("");
  const [unit, setUnit] = useState("unidad");
  const [costPerUnit, setCostPerUnit] = useState("");
  const [initialStock, setInitialStock] = useState("");
  const [minStock, setMinStock] = useState("0");
  const [maxStock, setMaxStock] = useState("");
  const [locationId, setLocationId] = useState(locations[0]?.id || "");
  const [availableInPos, setAvailableInPos] = useState(false);
  const [availableInQr, setAvailableInQr] = useState(false);
  const [availableOnline, setAvailableOnline] = useState(false);
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (ingredientToEdit) {
      setName(ingredientToEdit.name);
      setUnit(ingredientToEdit.unit);
      setCostPerUnit(String(ingredientToEdit.costPerUnit || ""));
      setInitialStock(String(ingredientToEdit.stockQuantity || ""));
      setMinStock(String(ingredientToEdit.minStock || "0"));
      setMaxStock(ingredientToEdit.maxStock ? String(ingredientToEdit.maxStock) : "");
      setLocationId(ingredientToEdit.locationId || locations[0]?.id || "");
      setAvailableInPos(ingredientToEdit.availableInPos);
      setAvailableInQr(ingredientToEdit.availableInQr);
      setAvailableOnline(ingredientToEdit.availableOnline);
      setNotes(ingredientToEdit.notes || "");
    } else {
      setName("");
      setUnit("unidad");
      setCostPerUnit("");
      setInitialStock("0");
      setMinStock("0");
      setMaxStock("");
      setLocationId(locations[0]?.id || "");
      setAvailableInPos(false);
      setAvailableInQr(false);
      setAvailableOnline(false);
      setNotes("");
    }
  }, [ingredientToEdit, isOpen, locations]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("El nombre del ingrediente es obligatorio");
      return;
    }

    const costNum = parseFloat(costPerUnit) || 0;
    const initialNum = parseFloat(initialStock) || 0;
    const minNum = parseFloat(minStock) || 0;
    const maxNum = maxStock ? parseFloat(maxStock) : null;

    if (maxNum !== null && maxNum < minNum) {
      toast.error("El stock máximo no puede ser menor que el stock mínimo");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && ingredientToEdit) {
        const res = await updateIngredientAction(businessId, ingredientToEdit.id, {
          name: name.trim(),
          unit,
          costPerUnit: costNum,
          minStock: minNum,
          maxStock: maxNum,
          locationId: locationId || undefined,
          availableInPos,
          availableInQr,
          availableOnline,
          notes: notes.trim() || undefined,
        });

        if (!res.success || !res.data) {
          toast.error("Error al actualizar ingrediente", {
            description: res.error || "Verifica los datos e intenta nuevamente.",
          });
          return;
        }

        toast.success("Ingrediente actualizado exitosamente");
        onSuccess(res.data);
      } else {
        const res = await createIngredientAction(businessId, {
          name: name.trim(),
          unit,
          costPerUnit: costNum,
          initialStock: initialNum,
          minStock: minNum,
          maxStock: maxNum,
          locationId: locationId || undefined,
          availableInPos,
          availableInQr,
          availableOnline,
          notes: notes.trim() || undefined,
        });

        if (!res.success || !res.data) {
          toast.error("Error al registrar ingrediente", {
            description: res.error || "Verifica los datos e intenta nuevamente.",
          });
          return;
        }

        toast.success("Ingrediente registrado exitosamente", {
          description: `«${res.data.name}» fue dado de alta con ${res.data.stockQuantity} ${res.data.unit} en Kardex.`,
        });
        onSuccess(res.data);
      }

      onClose();
    } catch (err: any) {
      toast.error("Error inesperado", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Apple className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {isEditing ? "Editar Ingrediente" : "Crear Nuevo Ingrediente"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Materia prima para recetas y escandallos con control de inventario
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
            {/* Nombre y Unidad */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Nombre del Ingrediente <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Harina de Trigo Fortificada"
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Unidad de Medida <span className="text-rose-500">*</span>
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                >
                  {unitOptions.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Costo y Ubicación */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Costo Unitario por {unit} (COP)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={costPerUnit}
                    onChange={(e) => setCostPerUnit(e.target.value)}
                    placeholder="Ej: 4500"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ubicación Principal / Bodega
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <select
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.type === "warehouse" ? "Bodega" : "Punto de Venta"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Parámetros de Stock */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.06] space-y-3">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-[#ED500A]" />
                <span>Control de Existencias Físicas ({unit})</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {!isEditing && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Stock Inicial
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={initialStock}
                      onChange={(e) => setInitialStock(e.target.value)}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Stock Mínimo (Alerta)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Stock Máximo (Opcional)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={maxStock}
                    onChange={(e) => setMaxStock(e.target.value)}
                    placeholder="Ej: 50"
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30"
                  />
                </div>
              </div>
            </div>

            {/* Canales de Visibilidad */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.06] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Canales de Venta Directa
                </span>
                <span className="text-[10px] text-slate-400">
                  (Por defecto ocultos al cliente final)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-slate-800/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={availableInPos}
                    onChange={(e) => setAvailableInPos(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-[#ED500A] focus:ring-[#ED500A]"
                  />
                  <Store className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Visible en POS
                  </span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-slate-800/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={availableInQr}
                    onChange={(e) => setAvailableInQr(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-[#ED500A] focus:ring-[#ED500A]"
                  />
                  <QrCode className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Visible en Menú QR
                  </span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-slate-800/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={availableOnline}
                    onChange={(e) => setAvailableOnline(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-[#ED500A] focus:ring-[#ED500A]"
                  />
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Tienda Online
                  </span>
                </label>
              </div>
            </div>

            {/* Notas */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Notas u Observaciones
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Proveedor habitual, temperatura de almacenamiento, etc."
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 resize-none"
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-[#ED500A] text-white hover:bg-[#ED500A]/90 transition-all shadow-md shadow-[#ED500A]/20 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <span>{isEditing ? "Guardar Cambios" : "Crear Ingrediente"}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
