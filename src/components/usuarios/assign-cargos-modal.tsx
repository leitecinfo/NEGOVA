"use client";

import React, { useState, useEffect, useTransition } from "react";
import { X, Briefcase, Plus, Check, Loader2, Info } from "lucide-react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { CargoBadge } from "./cargo-badge";
import { DEFAULT_PRESET_CARGOS, getCargoBadgeStyles } from "@/lib/auth/cargos-service";
import { updateUserCargosAction, getBusinessCargosAction, addCustomCargoAction } from "@/app/workspace/[businessId]/usuarios/actions";
import { toast } from "sonner";

interface AssignCargosModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  userId: string;
  userName: string;
  initialCargos?: string[];
  onCargosUpdated?: (updatedCargos: string[]) => void;
}

export function AssignCargosModal({
  isOpen,
  onClose,
  businessId,
  userId,
  userName,
  initialCargos = [],
  onCargosUpdated,
}: AssignCargosModalProps) {
  const [selectedCargos, setSelectedCargos] = useState<string[]>(initialCargos);
  const [availableCargos, setAvailableCargos] = useState<string[]>(DEFAULT_PRESET_CARGOS);
  const [newCargoInput, setNewCargoInput] = useState("");
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [isSaving, startTransition] = useTransition();

  // Cargar cargos disponibles del negocio
  useEffect(() => {
    if (isOpen) {
      setSelectedCargos(initialCargos);
      getBusinessCargosAction(businessId).then((res) => {
        if (res.success && res.data && res.data.length > 0) {
          setAvailableCargos(res.data);
        }
      });
    }
  }, [isOpen, initialCargos, businessId]);

  if (!isOpen) return null;

  const handleToggleCargo = (cargo: string) => {
    setSelectedCargos((prev) =>
      prev.includes(cargo) ? prev.filter((c) => c !== cargo) : [...prev, cargo]
    );
  };

  const handleRemoveCargo = (cargo: string) => {
    setSelectedCargos((prev) => prev.filter((c) => c !== cargo));
  };

  const handleAddCustomCargo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newCargoInput.trim();
    if (!clean) return;

    if (availableCargos.map((c) => c.toLowerCase()).includes(clean.toLowerCase())) {
      if (!selectedCargos.includes(clean)) {
        setSelectedCargos((prev) => [...prev, clean]);
      }
      setNewCargoInput("");
      return;
    }

    setIsAddingCustom(true);
    try {
      const res = await addCustomCargoAction(businessId, clean);
      if (res.success && res.cargo) {
        setAvailableCargos((prev) => Array.from(new Set([...prev, res.cargo!])));
        setSelectedCargos((prev) => Array.from(new Set([...prev, res.cargo!])));
        setNewCargoInput("");
        toast.success(`Cargo «${res.cargo}» agregado.`);
      } else {
        toast.error(res.error || "No fue posible agregar el cargo.");
      }
    } finally {
      setIsAddingCustom(false);
    }
  };

  const handleSave = () => {
    startTransition(async () => {
      const res = await updateUserCargosAction(businessId, userId, selectedCargos);
      if (res.success) {
        toast.success(`Cargos de ${userName} actualizados.`);
        if (onCargosUpdated && res.cargos) {
          onCargosUpdated(res.cargos);
        }
        onClose();
      } else {
        toast.error(res.error || "No fue posible guardar los cargos.");
      }
    });
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150 font-body">
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-lg bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cabecera */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-[#ED500A] flex items-center justify-center font-bold">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Cargos Operativos
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {userName}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cuerpo */}
          <div className="p-6 overflow-y-auto space-y-5">
            {/* Mensaje Aclaratorio: Distinción Rol vs Cargo */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400">
              <Info className="w-4 h-4 text-[#ED500A] shrink-0 mt-0.5" />
              <div className="space-y-0.5 leading-relaxed">
                <p>
                  <strong className="text-slate-800 dark:text-slate-200">Etiquetas Operativas:</strong> Describen las responsabilidades diarias en el negocio (Cajero, Mesero, Cocinero, etc.).
                </p>
                <p className="text-[11px] text-slate-500">
                  Un empleado puede desempeñar varios cargos a la vez. No modifican los permisos de acceso ni consumen cupos adicionales del plan.
                </p>
              </div>
            </div>

            {/* Cargos actualmente seleccionados */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Cargos Asignados ({selectedCargos.length})
              </label>
              {selectedCargos.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.01]">
                  {selectedCargos.map((cargo) => (
                    <CargoBadge
                      key={cargo}
                      cargo={cargo}
                      onRemove={() => handleRemoveCargo(cargo)}
                      size="md"
                    />
                  ))}
                </div>
              ) : (
                <div className="p-3 text-center text-xs text-slate-400 italic rounded-2xl border border-dashed border-slate-200 dark:border-white/[0.08]">
                  Sin cargos operativos asignados
                </div>
              )}
            </div>

            {/* Catálogo para seleccionar */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Seleccionar del Catálogo
              </label>
              <div className="flex flex-wrap gap-2">
                {availableCargos.map((cargo) => {
                  const isSelected = selectedCargos.includes(cargo);
                  const { dotColor } = getCargoBadgeStyles(cargo);
                  return (
                    <button
                      key={cargo}
                      type="button"
                      onClick={() => handleToggleCargo(cargo)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[#ED500A] text-white border-[#ED500A] shadow-xs scale-102"
                          : "bg-white dark:bg-[#0D0F16] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/[0.08] hover:border-[#ED500A]/40"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isSelected ? "bg-white" : dotColor
                        }`}
                      />
                      <span>{cargo}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 ml-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Crear nuevo cargo personalizado */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Crear otro cargo para el negocio
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ej. Parrillero, Pastelero, Conductor..."
                  value={newCargoInput}
                  onChange={(e) => setNewCargoInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomCargo();
                    }
                  }}
                  className="flex-1 h-10 px-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                />
                <button
                  type="button"
                  onClick={() => handleAddCustomCargo()}
                  disabled={!newCargoInput.trim() || isAddingCustom}
                  className="h-10 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  {isAddingCustom ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Agregar</span>
                </button>
              </div>
            </div>
          </div>

          {/* Pie de Acciones */}
          <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-end gap-2.5 bg-white dark:bg-[#0D0F16]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-[#ED500A] hover:bg-[#d94608] disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-[#ED500A]/25 transition flex items-center gap-2 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Guardar Cargos</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

