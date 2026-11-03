"use client";

import React, { useEffect, useState } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Landmark, X, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { CashRegisterWithSession, CashSession } from "@/lib/cash/types";
import { openCashSessionAction } from "@/app/workspace/[businessId]/cajas/actions";
import { toast } from "sonner";

interface OpenCashShiftModalProps {
  isOpen: boolean;
  businessId: string;
  registersWithSessions: CashRegisterWithSession[];
  defaultRegisterId?: string;
  onClose: () => void;
  onSuccess: (session: CashSession) => void;
}

export function OpenCashShiftModal({
  isOpen,
  businessId,
  registersWithSessions,
  defaultRegisterId,
  onClose,
  onSuccess,
}: OpenCashShiftModalProps) {
  // Filtrar cajas disponibles (sin turno abierto)
  const availableRegisters = registersWithSessions.filter(
    (rw) => rw.register.isActive && !rw.activeSession
  );

  const [selectedRegisterId, setSelectedRegisterId] = useState<string>(
    defaultRegisterId || availableRegisters[0]?.register.id || ""
  );
  const [initialAmountStr, setInitialAmountStr] = useState<string>("200000");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultRegisterId) {
      setSelectedRegisterId(defaultRegisterId);
    } else if (availableRegisters.length > 0 && !selectedRegisterId) {
      setSelectedRegisterId(availableRegisters[0].register.id);
    }
  }, [defaultRegisterId, availableRegisters, selectedRegisterId]);

  if (!isOpen) return null;

  const quickAmounts = [50000, 100000, 200000, 300000];

  const selectedTarget = registersWithSessions.find(
    (rw) => rw.register.id === selectedRegisterId
  );
  const isTargetAlreadyOpen = Boolean(selectedTarget?.activeSession);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    if (!selectedRegisterId) {
      setError("Por favor, selecciona una caja registradora.");
      return;
    }

    if (isTargetAlreadyOpen) {
      setError("Esta caja ya tiene un turno abierto. Debes cerrarlo antes de iniciar uno nuevo.");
      return;
    }

    const cleanAmount = Number(initialAmountStr.replace(/\D/g, "")) || 0;
    if (cleanAmount < 0) {
      setError("La base inicial no puede ser un monto negativo.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await openCashSessionAction(businessId, {
        registerId: selectedRegisterId,
        initialAmount: cleanAmount,
        notes: notes.trim() || undefined,
      });

      if (res.success && res.data) {
        toast.success("¡Turno de caja abierto con éxito!", {
          description: `Base inicial registrada: $${new Intl.NumberFormat("es-CO").format(cleanAmount)}`,
        });
        onSuccess(res.data);
        onClose();
      } else {
        setError(res.error || "No se pudo abrir el turno de caja.");
      }
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error inesperado al abrir la caja.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, "");
    setInitialAmountStr(rawVal);
  };

  const formattedDisplayAmount = initialAmountStr
    ? new Intl.NumberFormat("es-CO").format(Number(initialAmountStr))
    : "0";

  return (
    <ModalPortal>
      <div className="fixed inset-0 m-0 p-4 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-md bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col font-body"
        >
          {/* HEADER */}
          <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-[#ED500A] flex items-center justify-center font-bold">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Abrir Turno de Caja
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Selecciona la caja y registra la base inicial de efectivo
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* SELECTOR DE CAJA */}
            <div className="space-y-1.5">
              <label
                htmlFor="cash-register-select"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Caja Registradora
              </label>
              <select
                id="cash-register-select"
                value={selectedRegisterId}
                onChange={(e) => {
                  setSelectedRegisterId(e.target.value);
                  setError(null);
                }}
                className="w-full px-3 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]"
              >
                {registersWithSessions.map((rw) => {
                  const isOpen = Boolean(rw.activeSession);
                  return (
                    <option
                      key={rw.register.id}
                      value={rw.register.id}
                      disabled={isOpen || !rw.register.isActive}
                    >
                      {rw.register.name} {!rw.register.isActive ? "(Inactiva)" : isOpen ? "(Turno ya abierto)" : "✓ Disponible"}
                    </option>
                  );
                })}
              </select>
              {isTargetAlreadyOpen && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  ⚠️ Esta caja ya posee un turno abierto activo.
                </p>
              )}
            </div>

            {/* BASE INICIAL */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Base Inicial en Efectivo ($ COP)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold">
                  $
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formattedDisplayAmount}
                  onChange={handleAmountChange}
                  placeholder="0"
                  className="w-full pl-8 pr-3 py-2.5 text-lg font-bold font-mono rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]"
                />
              </div>

              {/* BOTONES RÁPIDOS */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {quickAmounts.map((amt) => {
                  const isSelected = Number(initialAmountStr) === amt;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setInitialAmountStr(String(amt))}
                      className={`py-1.5 px-1 rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer text-center ${
                        isSelected
                          ? "bg-[#ED500A] text-white shadow-xs"
                          : "bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/5"
                      }`}
                    >
                      ${amt / 1000}k
                    </button>
                  );
                })}
              </div>
            </div>

            {/* NOTAS */}
            <div className="space-y-1.5">
              <label
                htmlFor="open-shift-notes"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Observaciones de apertura (Opcional)
              </label>
              <input
                id="open-shift-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. Billetes de $20k y $10k, turno de la mañana..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]"
              />
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
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
                disabled={isSubmitting || isTargetAlreadyOpen || !selectedRegisterId}
                className="px-5 py-2.5 text-xs font-bold text-white bg-[#ED500A] hover:bg-[#d64508] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Abriendo turno...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Abrir Turno de Hoy</span>
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
