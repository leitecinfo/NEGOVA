"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  Loader2,
  Landmark,
  Wallet,
} from "lucide-react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { CashRegisterWithSession } from "@/lib/cash/types";
import { toast } from "sonner";
import { recordCashMovementAction } from "@/app/workspace/[businessId]/cajas/actions";

export interface CashRegisterOption {
  id: string;
  name: string;
  sessionId?: string | null;
  currentCash: number;
  isOpen: boolean;
}

export interface CashMovementModalProps {
  isOpen: boolean;
  businessId: string;
  // Soporte directo con lista de cajas
  registersWithSessions?: CashRegisterWithSession[];
  availableRegisters?: CashRegisterOption[];
  defaultRegisterId?: string;
  // Fallbacks de compatibilidad directa
  sessionId?: string;
  registerName?: string;
  currentCashInDrawer?: number;
  initialType?: "entry" | "withdrawal";
  onClose: () => void;
  onSuccess: (updatedExpectedCash: number, registerId?: string) => void;
}

const ENTRY_TAGS = ["Fondo de caja", "Refuerzo de caja", "Ingreso extra"] as const;
const WITHDRAWAL_TAGS = [
  "Retiro para depósito",
  "Gastos menores",
  "Pago a proveedor",
  "Pago de servicio",
] as const;

export function CashMovementModal({
  isOpen,
  businessId,
  registersWithSessions,
  availableRegisters,
  defaultRegisterId,
  sessionId,
  registerName,
  currentCashInDrawer: propCurrentCash,
  initialType = "entry",
  onClose,
  onSuccess,
}: CashMovementModalProps) {
  // Construir opciones de cajas disponibles
  const registerOptions: CashRegisterOption[] = React.useMemo(() => {
    if (registersWithSessions && registersWithSessions.length > 0) {
      return registersWithSessions.map((rw) => ({
        id: rw.register.id,
        name: rw.register.name,
        sessionId: rw.activeSession?.id || null,
        currentCash:
          rw.sessionSummary?.expectedCashInDrawer ??
          rw.activeSession?.initialAmount ??
          0,
        isOpen: Boolean(rw.activeSession),
      }));
    }

    if (availableRegisters && availableRegisters.length > 0) {
      return availableRegisters;
    }

    if (sessionId) {
      return [
        {
          id: defaultRegisterId || "default-register",
          name: registerName || "Caja Principal",
          sessionId,
          currentCash: propCurrentCash ?? 0,
          isOpen: true,
        },
      ];
    }

    return [];
  }, [
    registersWithSessions,
    availableRegisters,
    defaultRegisterId,
    sessionId,
    registerName,
    propCurrentCash,
  ]);

  // Selección de caja
  const [selectedRegisterId, setSelectedRegisterId] = useState<string>(() => {
    if (defaultRegisterId && registerOptions.some((r) => r.id === defaultRegisterId)) {
      return defaultRegisterId;
    }
    const firstOpen = registerOptions.find((r) => r.isOpen);
    return firstOpen?.id || registerOptions[0]?.id || "";
  });

  useEffect(() => {
    if (defaultRegisterId && registerOptions.some((r) => r.id === defaultRegisterId)) {
      setSelectedRegisterId(defaultRegisterId);
    } else if (!selectedRegisterId && registerOptions.length > 0) {
      const firstOpen = registerOptions.find((r) => r.isOpen);
      setSelectedRegisterId(firstOpen?.id || registerOptions[0].id);
    }
  }, [defaultRegisterId, registerOptions, selectedRegisterId]);

  const selectedRegister =
    registerOptions.find((r) => r.id === selectedRegisterId) || registerOptions[0];

  const currentCashInDrawer = selectedRegister?.currentCash ?? 0;
  const currentSessionId = selectedRegister?.sessionId;
  const isRegisterOpen = Boolean(selectedRegister?.isOpen && currentSessionId);

  // Estados del movimiento
  const [movementType, setMovementType] = useState<"entry" | "withdrawal">(initialType);
  const [amount, setAmount] = useState<string>("");
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    setMovementType(initialType);
  }, [initialType]);

  // Al cambiar tipo de movimiento, limpiar el tag seleccionado
  const handleToggleType = (type: "entry" | "withdrawal") => {
    setMovementType(type);
    setSelectedTag("");
  };

  if (!isOpen) return null;

  const numAmount = Math.max(0, parseFloat(amount.replace(/\D/g, "")) || 0);

  const formatCOP = (val: number) =>
    `$${new Intl.NumberFormat("es-CO").format(val)}`;

  const quickPresets = [20000, 50000, 100000, 200000];

  // Validación de fondos en retiros / salidas: no permitir retirar más de lo que hay en cajón
  const isWithdrawalExceeding =
    movementType === "withdrawal" && numAmount > currentCashInDrawer;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) {
      setAmount("");
      return;
    }
    const val = parseInt(raw, 10);
    setAmount(new Intl.NumberFormat("es-CO").format(val));
  };

  const handleSelectTag = (tag: string) => {
    setSelectedTag(tag);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isRegisterOpen || !currentSessionId) {
      toast.error("La caja seleccionada no tiene un turno abierto.");
      return;
    }

    if (numAmount <= 0) {
      toast.error("El monto debe ser superior a $0.");
      return;
    }

    if (isWithdrawalExceeding) {
      toast.error(
        `No se puede retirar ${formatCOP(numAmount)}. El saldo disponible en cajón es ${formatCOP(currentCashInDrawer)}.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const fullConcept = selectedTag || (movementType === "entry" ? "Ingreso de efectivo" : "Retiro de efectivo");
      const fullNotes = notes.trim()
        ? `${fullConcept} — ${notes.trim()}`
        : fullConcept;

      const res = await recordCashMovementAction(businessId, {
        sessionId: currentSessionId,
        movementType,
        amount: numAmount,
        notes: fullNotes,
        referenceType: "manual_cash_movement",
      });

      if (res.success) {
        const nextCash =
          movementType === "entry"
            ? currentCashInDrawer + numAmount
            : currentCashInDrawer - numAmount;

        toast.success(
          movementType === "entry"
            ? `Entrada de ${formatCOP(numAmount)} registrada en ${selectedRegister.name}.`
            : `Salida de ${formatCOP(numAmount)} registrada en ${selectedRegister.name}.`
        );

        onSuccess(nextCash, selectedRegister.id);
        onClose();
      } else {
        toast.error(res.error || "No se pudo registrar el movimiento de caja.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al procesar el movimiento de caja.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-md bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] font-body animate-in zoom-in-95 duration-150"
        >
          {/* HEADER */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 transition-colors ${
                  movementType === "entry"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                }`}
              >
                {movementType === "entry" ? (
                  <ArrowUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <ArrowDown className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Movimiento de caja
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Entradas o salidas de efectivo que no son ventas: fondo, retiros, pagos menores...
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

          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
            {/* 1. SELECTOR TOGGLE DE TIPO: ↑ Entrada (verde) / ↓ Salida (rojo) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Tipo de movimiento <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100/80 dark:bg-white/5 rounded-xl border border-slate-200/80 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => handleToggleType("entry")}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    movementType === "entry"
                      ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <ArrowUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>↑ Entrada</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleType("withdrawal")}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    movementType === "withdrawal"
                      ? "bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <ArrowDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  <span>↓ Salida</span>
                </button>
              </div>
            </div>

            {/* 2. CAJA (*) DESPLEGABLE CON VISUALIZACIÓN DE SALDO EN TIEMPO REAL */}
            <div className="space-y-1.5">
              <label
                htmlFor="register-select"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Caja <span className="text-rose-500">*</span>
              </label>

              {registerOptions.length > 1 ? (
                <select
                  id="register-select"
                  value={selectedRegisterId}
                  onChange={(e) => setSelectedRegisterId(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]"
                >
                  {registerOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name} — {formatCOP(opt.currentCash)} en cajón {opt.isOpen ? "(Turno abierto)" : "(Cerrada)"}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 text-xs">
                  <div className="flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-slate-400" />
                    <span className="font-bold text-slate-900 dark:text-white">
                      {selectedRegister?.name || "Caja Principal"}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">
                    {selectedRegister?.isOpen ? "Turno abierto" : "Cerrada"}
                  </span>
                </div>
              )}

              {/* Monitor de saldo en tiempo real */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/5 text-xs">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-slate-400" />
                  <span>Saldo en cajón en tiempo real:</span>
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {formatCOP(currentCashInDrawer)}
                </span>
              </div>

              {!isRegisterOpen && (
                <div className="p-2.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Esta caja no tiene un turno abierto. Debes abrir turno para registrar movimientos.</span>
                </div>
              )}
            </div>

            {/* 3. MONTO (*) MONETARIO */}
            <div className="space-y-1.5">
              <label
                htmlFor="cash-movement-amount"
                className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between"
              >
                <span>Monto <span className="text-rose-500">*</span></span>
                {movementType === "withdrawal" && (
                  <span className="text-[11px] font-normal text-slate-400 font-mono">
                    Máx: {formatCOP(currentCashInDrawer)}
                  </span>
                )}
              </label>

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                  $
                </span>
                <input
                  id="cash-movement-amount"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={amount}
                  onChange={handleAmountChange}
                  className={`w-full pl-8 pr-4 py-2.5 text-base font-black font-mono rounded-xl border bg-slate-50/50 dark:bg-white/5 focus:outline-none transition-colors ${
                    isWithdrawalExceeding
                      ? "border-rose-400 text-rose-600 dark:text-rose-400 focus:ring-2 focus:ring-rose-500/30"
                      : "border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#ED500A]/30"
                  }`}
                  autoFocus
                />
              </div>

              {isWithdrawalExceeding && (
                <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 pt-0.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>El monto a retirar no puede superar el efectivo disponible en cajón.</span>
                </div>
              )}

              {/* Botones Presets Rápidos */}
              <div className="flex items-center gap-1.5 pt-1">
                {quickPresets.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAmount(new Intl.NumberFormat("es-CO").format(val))}
                    className="flex-1 py-1 px-1.5 text-[11px] font-bold font-mono rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    +${val / 1000}k
                  </button>
                ))}
              </div>
            </div>

            {/* 4. TAGS DE CONCEPTO RÁPIDO */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Tags de concepto rápido
              </label>
              <div className="flex flex-wrap gap-1.5">
                {movementType === "entry"
                  ? ENTRY_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleSelectTag(tag)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                          selectedTag === tag
                            ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30 shadow-2xs font-bold"
                            : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-200 dark:hover:bg-white/10"
                        }`}
                      >
                        {tag}
                      </button>
                    ))
                  : WITHDRAWAL_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleSelectTag(tag)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                          selectedTag === tag
                            ? "bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/30 shadow-2xs font-bold"
                            : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-200 dark:hover:bg-white/10"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
              </div>
            </div>

            {/* 5. MOTIVO / DETALLE EN ÁREA DE TEXTO LIBRE OPCIONAL */}
            <div className="space-y-1.5">
              <label
                htmlFor="movement-notes"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Motivo / Detalle <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <textarea
                id="movement-notes"
                rows={2}
                maxLength={300}
                placeholder="Detalle adicional, número de soporte, proveedor o nota explicativa..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 resize-none"
              />
            </div>

            {/* Proyección de Saldo Posterior */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Saldo proyectado tras operación:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {formatCOP(
                  movementType === "entry"
                    ? currentCashInDrawer + numAmount
                    : Math.max(0, currentCashInDrawer - numAmount)
                )}
              </span>
            </div>

            {/* BOTONES DE CONFIRMACIÓN */}
            <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  numAmount <= 0 ||
                  isWithdrawalExceeding ||
                  !isRegisterOpen
                }
                className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed ${
                  movementType === "entry"
                    ? "bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]"
                    : "bg-rose-600 hover:bg-rose-700 active:scale-[0.98]"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Registrando...</span>
                  </>
                ) : (
                  <>
                    {movementType === "entry" ? (
                      <ArrowUp className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowDown className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {movementType === "entry" ? "Registrar entrada" : "Registrar salida"}
                    </span>
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
