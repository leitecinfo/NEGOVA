"use client";

import React, { useState } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { MapPin, X, Loader2, AlertCircle, ArrowRight, Landmark } from "lucide-react";
import { createCashRegisterAction } from "@/app/workspace/[businessId]/cajas/actions";
import { toast } from "sonner";
import { CashRegister } from "@/lib/cash/types";

interface CreateCashRegisterModalProps {
  isOpen: boolean;
  businessId: string;
  locations?: { id: string; name: string }[];
  onClose: () => void;
  onSuccess: (newRegister: CashRegister) => void;
}

export function CreateCashRegisterModal({
  isOpen,
  businessId,
  locations = [],
  onClose,
  onSuccess,
}: CreateCashRegisterModalProps) {
  const [name, setName] = useState("");
  const [physicalPoint, setPhysicalPoint] = useState("");
  const [locationId, setLocationId] = useState<string>("");
  const [suggestedBase, setSuggestedBase] = useState<string>("");
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSuggestedBaseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) {
      setSuggestedBase("");
      return;
    }
    const val = parseInt(raw, 10);
    setSuggestedBase(new Intl.NumberFormat("es-CO").format(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("El nombre de la caja es obligatorio.");
      return;
    }

    const numSuggestedBase = suggestedBase
      ? parseInt(suggestedBase.replace(/\D/g, ""), 10) || 0
      : 0;

    setIsSubmitting(true);
    try {
      // Si el usuario seleccionó una ubicación física o escribió una
      let targetLocationId = locationId || undefined;

      const res = await createCashRegisterAction(businessId, {
        name: trimmedName,
        locationId: targetLocationId,
        isActive,
      });

      if (res.success && res.data) {
        // Guardar la base sugerida en el almacenamiento local para que al abrir turno se autocomplete
        if (typeof window !== "undefined" && numSuggestedBase > 0) {
          localStorage.setItem(
            `negova_cash_base_sugerida_${res.data.id}`,
            String(numSuggestedBase)
          );
        }

        toast.success(`Caja "${res.data.name}" creada exitosamente.`);
        onSuccess(res.data);
        onClose();
      } else {
        setError(res.error || "No se pudo crear la caja registradora.");
      }
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error inesperado al crear la caja.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 m-0 p-4 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-md bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col font-body animate-in zoom-in-95 duration-150"
        >
          {/* HEADER */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-[#ED500A] flex items-center justify-center font-bold shrink-0">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Nueva caja
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configura el cajón que llevará sus propios turnos, ventas y movimientos.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* FORMULARIO */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* 1. NOMBRE DE LA CAJA (*) */}
            <div className="space-y-1.5">
              <label
                htmlFor="register-name-input"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Nombre de la caja <span className="text-rose-500">*</span>
              </label>
              <input
                id="register-name-input"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Caja Principal, Caja Barra, Caja Domicilios..."
                className="w-full px-3 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]"
                autoFocus
              />
            </div>

            {/* 2. PUNTO FÍSICO (OPCIONAL) CON ICONO DE UBICACIÓN */}
            <div className="space-y-1.5">
              <label
                htmlFor="register-physical-point-input"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Punto físico (opcional)
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="register-physical-point-input"
                  type="text"
                  value={physicalPoint}
                  onChange={(e) => setPhysicalPoint(e.target.value)}
                  placeholder="Ej. Barra principal, Salón piso 1, Mostrador entrada..."
                  className="w-full pl-9 pr-3 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]"
                />
              </div>

              {/* Si hay ubicaciones físicas registradas en el negocio */}
              {locations.length > 0 && (
                <div className="pt-1">
                  <select
                    value={locationId}
                    onChange={(e) => {
                      setLocationId(e.target.value);
                      const loc = locations.find((l) => l.id === e.target.value);
                      if (loc) setPhysicalPoint(loc.name);
                    }}
                    className="w-full px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-slate-600 dark:text-slate-300 focus:outline-none"
                  >
                    <option value="">Vincular a ubicación del sistema (opcional)</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 3. BASE SUGERIDA PARA ABRIR ($ COP) */}
            <div className="space-y-1.5">
              <label
                htmlFor="register-suggested-base-input"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Base sugerida para abrir ($ COP)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs font-mono">
                  $ COP
                </span>
                <input
                  id="register-suggested-base-input"
                  type="text"
                  inputMode="numeric"
                  value={suggestedBase}
                  onChange={handleSuggestedBaseChange}
                  placeholder="0"
                  className="w-full pl-16 pr-3 py-2.5 text-xs font-bold font-mono rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]"
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Monto de efectivo recomendado con el que habitualmente se inicia el turno en esta caja para dar cambio.
              </p>
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className="px-5 py-2.5 text-xs font-bold text-white bg-[#ED500A] hover:bg-[#d64508] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creando caja...</span>
                  </>
                ) : (
                  <>
                    <span>{"Crear caja ->"}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
