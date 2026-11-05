"use client";

import React, { useEffect, useState } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  Landmark,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowDownCircle,
  ArrowUpCircle,
  CreditCard,
  DollarSign,
  Receipt,
  FileText,
} from "lucide-react";
import { CashRegister, CashSession } from "@/lib/cash/types";
import {
  getCashSessionSummaryAction,
  closeCashSessionAction,
} from "@/app/workspace/[businessId]/cajas/actions";
import { toast } from "sonner";

interface CloseCashShiftModalProps {
  isOpen: boolean;
  businessId: string;
  register: CashRegister;
  session: CashSession;
  onClose: () => void;
  onSuccess: (closedSession: CashSession) => void;
}

export function CloseCashShiftModal({
  isOpen,
  businessId,
  register,
  session,
  onClose,
  onSuccess,
}: CloseCashShiftModalProps) {
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [countedCashStr, setCountedCashStr] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar resumen financiero de la sesión al abrir
  useEffect(() => {
    let isMounted = true;
    if (isOpen && session?.id) {
      setIsLoadingSummary(true);
      setError(null);
      getCashSessionSummaryAction(businessId, session.id)
        .then((res) => {
          if (isMounted) {
            if (res.success && res.data) {
              setSummary(res.data);
              // Inicializar el campo contado vacío para forzar arqueo real o prellenar con esperado
              setCountedCashStr(String(Math.round(res.data.expectedCashInDrawer || 0)));
            } else {
              setError(res.error || "No se pudo cargar el resumen de la caja.");
            }
          }
        })
        .catch((err) => {
          if (isMounted) {
            setError(err?.message || "Error al consultar resumen.");
          }
        })
        .finally(() => {
          if (isMounted) setIsLoadingSummary(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, businessId, session?.id]);

  if (!isOpen) return null;

  const expectedCash = summary ? Number(summary.expectedCashInDrawer || 0) : 0;
  const countedCash = Number(countedCashStr.replace(/\D/g, "")) || 0;
  const difference = countedCash - expectedCash;
  const hasDifference = difference !== 0;

  const formatCop = (amt: number) =>
    `$${new Intl.NumberFormat("es-CO").format(amt)}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    if (countedCash < 0) {
      setError("El total contado no puede ser un valor negativo.");
      return;
    }

    if (hasDifference && !notes.trim()) {
      setError(
        "Hay una diferencia en el arqueo. Por favor, especifica el motivo en las observaciones antes de cerrar."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await closeCashSessionAction(businessId, {
        sessionId: session.id,
        finalAmountCounted: countedCash,
        notes: notes.trim()
          ? `${notes.trim()}${hasDifference ? ` [Diferencia arqueo: ${difference >= 0 ? "+" : ""}${formatCop(difference)}]` : ""}`
          : undefined,
      });

      if (res.success && res.data) {
        toast.success(`Turno de "${register.name}" cerrado correctamente`, {
          description: `Total contado: ${formatCop(countedCash)} | Total sistema: ${formatCop(expectedCash)}`,
        });
        onSuccess(res.data);
        onClose();
      } else {
        setError(res.error || "No se pudo cerrar el turno de caja.");
      }
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error inesperado al cerrar el turno.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 m-0 p-4 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-lg bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col font-body max-h-[90vh]"
        >
          {/* HEADER */}
          <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white/10 text-white flex items-center justify-center font-bold">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Cerrar Turno — {register.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Resumen de movimientos, arqueo de efectivo y balance final
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

          {/* BODY */}
          <div className="overflow-y-auto p-5 space-y-5">
            {isLoadingSummary ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-[#ED500A]" />
                <span className="text-xs font-medium">Calculando balance del sistema...</span>
              </div>
            ) : error && !summary ? (
              <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* DESGLOSE DEL SISTEMA */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-white/5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Resumen del Sistema
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      {summary?.movementsCount || 0} movimiento(s)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>Base Inicial:</span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">
                        {formatCop(summary?.initialAmount || 0)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                      <span>(+) Ventas Efectivo:</span>
                      <span className="font-mono font-semibold">
                        {formatCop(summary?.totalSalesCash || 0)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
                      <span>Ventas Digitales / Transferencias:</span>
                      <span className="font-mono font-semibold">
                        {formatCop((summary?.totalSalesCard || 0) + (summary?.totalSalesDigital || 0))}
                      </span>
                    </div>

                    {summary?.totalManualEntries > 0 && (
                      <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                        <span>(+) Ingresos manuales:</span>
                        <span className="font-mono font-semibold">
                          {formatCop(summary.totalManualEntries)}
                        </span>
                      </div>
                    )}

                    {summary?.totalExpenses > 0 && (
                      <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                        <span>(-) Gastos de caja:</span>
                        <span className="font-mono font-semibold">
                          -{formatCop(summary.totalExpenses)}
                        </span>
                      </div>
                    )}

                    {summary?.totalWithdrawals > 0 && (
                      <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                        <span>(-) Retiros de efectivo:</span>
                        <span className="font-mono font-semibold">
                          -{formatCop(summary.totalWithdrawals)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* TOTAL DEL SISTEMA DESTACADO */}
                  <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Total Esperado en Cajón (Efectivo):
                      </span>
                      <p className="text-[10px] text-slate-400">
                        Base + Ventas Efectivo + Ingresos - Gastos/Retiros
                      </p>
                    </div>
                    <span className="text-base font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                      {formatCop(expectedCash)}
                    </span>
                  </div>
                </div>

                {/* ARQUEO FÍSICO / EFECTIVO CONTADO */}
                <div className="p-4 rounded-xl bg-orange-50/50 dark:bg-orange-500/5 border border-orange-200/80 dark:border-orange-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="counted-cash-input"
                      className="text-xs font-bold text-slate-900 dark:text-white"
                    >
                      Total Contado en Cajón (Arqueo Físico)
                    </label>
                    <button
                      type="button"
                      onClick={() => setCountedCashStr(String(Math.round(expectedCash)))}
                      className="text-[11px] font-semibold text-[#ED500A] hover:underline cursor-pointer"
                    >
                      Copiar total del sistema
                    </button>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold">
                      $
                    </div>
                    <input
                      id="counted-cash-input"
                      type="text"
                      inputMode="numeric"
                      value={
                        countedCashStr
                          ? new Intl.NumberFormat("es-CO").format(Number(countedCashStr))
                          : ""
                      }
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setCountedCashStr(val);
                      }}
                      placeholder="0"
                      className="w-full pl-8 pr-3 py-2.5 text-lg font-bold font-mono rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0F16] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]"
                    />
                  </div>

                  {/* COMPARADOR: SISTEMA VS CONTADO & DIFERENCIA */}
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="p-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                      <span className="text-[10px] text-slate-500 block uppercase">Sistema</span>
                      <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                        {formatCop(expectedCash)}
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                      <span className="text-[10px] text-slate-500 block uppercase">Contado</span>
                      <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                        {formatCop(countedCash)}
                      </span>
                    </div>

                    <div
                      className={`p-2 rounded-lg border ${
                        difference === 0
                          ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                          : difference > 0
                          ? "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400"
                          : "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400"
                      }`}
                    >
                      <span className="text-[10px] block uppercase font-bold">
                        {difference === 0 ? "Cuadre" : difference > 0 ? "Sobrante" : "Faltante"}
                      </span>
                      <span className="text-xs font-mono font-bold">
                        {difference > 0 ? `+${formatCop(difference)}` : formatCop(difference)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* NOTAS DE CIERRE */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="close-shift-notes"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Notas y Observaciones de Cierre {hasDifference ? "(Requerido por descuadre)" : "(Opcional)"}
                  </label>
                  <textarea
                    id="close-shift-notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={
                      hasDifference
                        ? "Explica la causa del faltante/sobrante en el arqueo físico..."
                        : "Comentarios sobre el cierre del turno, entrega de turno, etc."
                    }
                    className={`w-full px-3 py-2 text-xs rounded-xl border bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${
                      hasDifference && !notes.trim()
                        ? "border-amber-400 focus:ring-amber-500"
                        : "border-slate-200 dark:border-white/10 focus:ring-[#ED500A]"
                    }`}
                  />
                </div>

                {/* ACCIONES */}
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
                    disabled={isSubmitting || (hasDifference && !notes.trim())}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-black dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Cerrando turno...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirmar Cierre de Turno</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
