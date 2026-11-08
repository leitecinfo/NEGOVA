"use client";

import React, { useState, useEffect } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Input, Select } from "@/components/ui";
import {
  X,
  Scale,
  Droplets,
  Ruler,
  Hash,
  Loader2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  MeasurementUnit,
  MeasurementUnitType,
  MEASUREMENT_UNIT_TYPES,
  MEASUREMENT_UNIT_TYPE_LABELS,
  CreateMeasurementUnitInput,
  UpdateMeasurementUnitInput,
} from "@/lib/units/types";
import { createMeasurementUnitAction, updateMeasurementUnitAction } from "./actions";

interface Props {
  businessId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (unit: MeasurementUnit) => void;
  baseUnits: MeasurementUnit[];
  unitToEdit?: MeasurementUnit | null;
}

export function UnitFormModal({
  businessId,
  isOpen,
  onClose,
  onSuccess,
  baseUnits,
  unitToEdit,
}: Props) {
  const isEditing = Boolean(unitToEdit);

  const [name, setName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [type, setType] = useState<MeasurementUnitType>("weight");
  const [isBase, setIsBase] = useState(false);
  const [conversionFactor, setConversionFactor] = useState("1");
  const [baseUnitId, setBaseUnitId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Filtrar unidades base compatibles con el tipo seleccionado
  const compatibleBaseUnits = baseUnits.filter((u) => u.type === type && u.isBase);
  const activeBaseUnit =
    compatibleBaseUnits.find((u) => u.id === baseUnitId) ||
    compatibleBaseUnits[0] ||
    null;

  useEffect(() => {
    if (unitToEdit) {
      setName(unitToEdit.name);
      setAbbreviation(unitToEdit.abbreviation);
      setType(unitToEdit.type);
      setIsBase(unitToEdit.isBase);
      setConversionFactor(String(unitToEdit.conversionFactor));
      setBaseUnitId(unitToEdit.baseUnitId || "");
      setFormError(null);
    } else {
      setName("");
      setAbbreviation("");
      setType("weight");
      setIsBase(false);
      setConversionFactor("1");
      const defaultBase = baseUnits.find((u) => u.type === "weight" && u.isBase);
      setBaseUnitId(defaultBase?.id || "");
      setFormError(null);
    }
  }, [unitToEdit, isOpen, baseUnits]);

  // Actualizar baseUnitId por defecto al cambiar de tipo
  const handleTypeChange = (newType: MeasurementUnitType) => {
    setType(newType);
    const matchedBase = baseUnits.find((u) => u.type === newType && u.isBase);
    setBaseUnitId(matchedBase?.id || "");
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = name.trim();
    const cleanAbbrev = abbreviation.trim().toLowerCase();
    const factorNum = parseFloat(conversionFactor);

    if (!cleanName) {
      setFormError("El nombre de la unidad es requerido.");
      return;
    }

    if (!cleanAbbrev) {
      setFormError("La abreviación es requerida.");
      return;
    }

    if (cleanAbbrev.length > 10) {
      setFormError("La abreviación no puede exceder 10 caracteres.");
      return;
    }

    if (isNaN(factorNum) || factorNum <= 0) {
      setFormError("El factor de conversión debe ser un número positivo mayor a 0.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing && unitToEdit) {
        const payload: UpdateMeasurementUnitInput = {
          name: cleanName,
          abbreviation: cleanAbbrev,
          conversionFactor: unitToEdit.isBase ? 1.0 : factorNum,
          baseUnitId: unitToEdit.isBase ? null : baseUnitId || null,
        };

        const res = await updateMeasurementUnitAction(businessId, unitToEdit.id, payload);
        if (!res.success || !res.data) {
          setFormError(res.error || "No se pudo actualizar la unidad.");
          return;
        }

        toast.success(`Unidad «${res.data.name}» actualizada correctamente.`);
        onSuccess(res.data);
        onClose();
      } else {
        const payload: CreateMeasurementUnitInput = {
          name: cleanName,
          abbreviation: cleanAbbrev,
          type,
          isBase,
          conversionFactor: isBase ? 1.0 : factorNum,
          baseUnitId: isBase ? null : baseUnitId || null,
        };

        const res = await createMeasurementUnitAction(businessId, payload);
        if (!res.success || !res.data) {
          setFormError(res.error || "No se pudo crear la unidad.");
          return;
        }

        toast.success(`Unidad «${res.data.name}» creada correctamente.`);
        onSuccess(res.data);
        onClose();
      }
    } catch (err: any) {
      setFormError(err.message || "Error inesperado al guardar la unidad.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const parsedFactor = parseFloat(conversionFactor) || 0;
  const targetBaseSymbol = activeBaseUnit?.abbreviation || "base";

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-lg bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  {isEditing ? "Editar Unidad de Medida" : "Nueva Unidad de Medida"}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isEditing
                    ? "Modifica el factor de conversión o nombre"
                    : "Registra unidades con factores de conversión precisos"}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
            {formError && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{formError}</div>
              </div>
            )}

            {/* Tipo de Unidad */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Tipo de Magnitud
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {MEASUREMENT_UNIT_TYPES.map((t) => {
                  const isSelected = type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={isEditing || isSubmitting}
                      onClick={() => handleTypeChange(t)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all ${
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 font-semibold shadow-sm"
                          : "border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                      } ${isEditing ? "opacity-70 cursor-not-allowed" : ""}`}
                    >
                      {t === "weight" && <Scale className="w-4 h-4 mb-1" />}
                      {t === "volume" && <Droplets className="w-4 h-4 mb-1" />}
                      {t === "length" && <Ruler className="w-4 h-4 mb-1" />}
                      {t === "count" && <Hash className="w-4 h-4 mb-1" />}
                      <span>{MEASUREMENT_UNIT_TYPE_LABELS[t]}</span>
                    </button>
                  );
                })}
              </div>
              {isEditing && (
                <p className="text-[11px] text-slate-400 mt-1">
                  El tipo de magnitud no se puede alterar para conservar la integridad histórica de recetas y existencias.
                </p>
              )}
            </div>

            {/* Nombre y Abreviación */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Input
                  label="Nombre de la Unidad *"
                  type="text"
                  required
                  placeholder="Ej. Libra, Mililitro, Onza"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <Input
                  label="Abreviación / Símbolo *"
                  type="text"
                  required
                  maxLength={10}
                  placeholder="Ej. lb, ml, oz"
                  value={abbreviation}
                  onChange={(e) => setAbbreviation(e.target.value)}
                  disabled={isSubmitting || (isEditing && unitToEdit?.isSystem)}
                  className="font-mono"
                />
              </div>
            </div>

            {/* Unidad Base de Referencia */}
            {!isBase && (
              <div>
                <Select
                  label="Unidad Base de Referencia"
                  value={baseUnitId}
                  onChange={(e) => setBaseUnitId(e.target.value)}
                  disabled={isSubmitting || (isEditing && unitToEdit?.isBase)}
                >
                  {compatibleBaseUnits.map((bu) => (
                    <option key={bu.id} value={bu.id}>
                      {bu.name} ({bu.abbreviation}) — Unidad Base de {MEASUREMENT_UNIT_TYPE_LABELS[bu.type]}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {/* Factor de Conversión */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-slate-400">
                  1 {abbreviation.trim() || "unidad"} = {parsedFactor} {targetBaseSymbol}
                </span>
              </div>
              <Input
                label={`Factor de Conversión ${isBase ? "(Fijo 1.0 para Unidades Base)" : "*"}`}
                type="number"
                step="any"
                min="0.000001"
                required
                disabled={isBase || isSubmitting || (isEditing && unitToEdit?.isBase)}
                value={isBase ? "1.0" : conversionFactor}
                onChange={(e) => setConversionFactor(e.target.value)}
                placeholder="Ej. 0.4536 para 1 lb = 0.4536 kg"
                className="font-mono"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                Multiplicador para transformar esta unidad a su base (Ej: 1 g = 0.001 kg, 1 lb = 0.4536 kg).
              </p>
            </div>

            {/* Tarjeta de previsualización de equivalencia */}
            <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/15 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-300">
                <Sparkles className="w-4 h-4 text-blue-500 shrink-0" />
                <span>Equivalencia activa:</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-500/10 text-blue-800 dark:text-blue-200 text-xs font-semibold font-mono">
                <span>1 {abbreviation.trim() || "x"}</span>
                <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
                <span>
                  {isBase ? "1.0" : parsedFactor} {targetBaseSymbol}
                </span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-all disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isEditing ? "Guardar Cambios" : "Crear Unidad"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
