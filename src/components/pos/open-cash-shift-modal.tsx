"use client";

import React, { useEffect, useState } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Input, Select } from "@/components/ui";
import { DollarSign, Landmark, X, Loader2, AlertCircle } from "lucide-react";
import { CashRegister, CashSession } from "@/lib/cash/types";
import { openCashSessionAction } from "@/app/workspace/[businessId]/cajas/actions";
import { toast } from "sonner";

interface OpenCashShiftModalProps {
  isOpen: boolean;
  businessId: string;
  registers: CashRegister[];
  onClose: () => void;
  onSessionOpened: (session: CashSession) => void;
}

export function OpenCashShiftModal({
  isOpen,
  businessId,
  registers,
  onClose,
  onSessionOpened,
}: OpenCashShiftModalProps) {
  const [selectedRegisterId, setSelectedRegisterId] = useState<string>(
    registers[0]?.id || ""
  );
  const [initialAmountStr, setInitialAmountStr] = useState<string>("0");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedRegisterId && registers.length > 0) {
      setSelectedRegisterId(registers[0].id);
    }
  }, [registers, selectedRegisterId]);

  if (!isOpen) return null;

  const quickAmounts = [50000, 100000, 200000, 300000];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    const regId = selectedRegisterId || registers[0]?.id;
    if (!regId) {
      setError("No hay una caja registradora seleccionada.");
      return;
    }

    const cleanAmount = Number(initialAmountStr.replace(/\D/g, "")) || 0;
    if (cleanAmount < 0) {
      setError("La base inicial no puede ser negativa.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await openCashSessionAction(businessId, {
        registerId: regId,
        initialAmount: cleanAmount,
        notes: notes.trim() || undefined,
      });

      if (res.success && res.data) {
        toast.success("¡Turno de caja abierto con éxito!", {
          description: `Base inicial registrada: $${new Intl.NumberFormat("es-CO").format(cleanAmount)}`,
        });
        onSessionOpened(res.data);
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

  return (
    <ModalPortal>
      <div className="fixed inset-0 m-0 p-4 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
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
                  No hay caja abierta
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Selecciona la caja y registra la base inicial para operar el POS
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
            <Select
              label="Caja Registradora"
              id="pos-cash-register-select"
              value={selectedRegisterId || registers[0]?.id || ""}
              onChange={setSelectedRegisterId}
            >
              {registers.length > 0 ? (
                registers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))
              ) : (
                <option value="">Caja Principal</option>
              )}
            </Select>

            {/* BASE INICIAL */}
            <div className="space-y-2">
              <Input
                label="Base Inicial en Efectivo ($ COP)"
                value={
                  initialAmountStr === "0"
                    ? "0"
                    : new Intl.NumberFormat("es-CO").format(
                        Number(initialAmountStr.replace(/\D/g, "")) || 0
                      )
                }
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  setInitialAmountStr(val || "0");
                }}
                placeholder="0"
                startAdornment={<span className="text-slate-400 font-bold">$</span>}
                className="text-base font-mono font-bold"
                autoFocus
              />

              {/* BOTONES RÁPIDOS */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setInitialAmountStr("0")}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  $0
                </button>
                {quickAmounts.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setInitialAmountStr(String(amt))}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/20 text-[#ED500A] transition-colors cursor-pointer"
                  >
                    ${new Intl.NumberFormat("es-CO").format(amt)}
                  </button>
                ))}
              </div>
            </div>

            {/* NOTAS */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Observaciones de apertura (Opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. Recibido por turno mañana con billetes de baja denominación..."
                rows={2}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-[#0B0D14] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A] resize-none"
              />
            </div>

            {/* BOTONES */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Omitir por ahora
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#ED500A] hover:bg-[#d94608] text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Abriendo turno...</span>
                  </>
                ) : (
                  <>
                    <DollarSign className="w-4 h-4" />
                    <span>Abrir caja de hoy</span>
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
