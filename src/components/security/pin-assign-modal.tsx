"use client";

import React, { useState } from "react";
import { KeyRound, Eye, EyeOff, ShieldCheck, X, Loader2 } from "lucide-react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
function isValidPinFormat(pin: string): boolean {
  return /^\d{4,6}$/.test(pin?.trim() || "");
}

interface PinAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employeeName: string;
  hasExistingPin?: boolean;
  onSavePin: (pin: string) => Promise<{ success: boolean; error?: string }>;
}

export function PinAssignModal({
  isOpen,
  onClose,
  onSuccess,
  employeeName,
  hasExistingPin = false,
  onSavePin,
}: PinAssignModalProps) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanPin = pin.trim();
    const cleanConfirm = confirmPin.trim();

    if (!isValidPinFormat(cleanPin)) {
      setErrorMsg("El PIN debe tener entre 4 y 6 dígitos numéricos (ej. 1234 o 567890).");
      return;
    }

    if (cleanPin !== cleanConfirm) {
      setErrorMsg("Los números de PIN ingresados no coinciden.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onSavePin(cleanPin);
      if (!res.success) {
        setErrorMsg(res.error || "No se pudo guardar el PIN de seguridad.");
        toast.error(res.error || "Error al asignar PIN.");
        return;
      }

      toast.success(
        hasExistingPin
          ? `PIN de seguridad actualizado para ${employeeName}.`
          : `PIN de seguridad asignado con éxito a ${employeeName}.`
      );
      setPin("");
      setConfirmPin("");
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "Error al guardar el PIN.");
      toast.error(err?.message || "Error al guardar PIN.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-body animate-in fade-in duration-150">
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-md bg-white dark:bg-[#0D0F16] rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200/80 dark:border-white/[0.08] space-y-5"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-[#ED500A] flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold font-title text-slate-900 dark:text-white">
                  {hasExistingPin ? "Cambiar PIN de Seguridad" : "Asignar PIN de Seguridad"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Colaborador: <strong className="text-slate-700 dark:text-slate-200">{employeeName}</strong>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.06] text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              El PIN se almacena protegido mediante <strong>hash criptográfico unidireccional</strong>. Se utilizará para autorizar operaciones sensibles (anulaciones de venta, aperturas de caja o descuentos).
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Campo: Nuevo PIN */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Nuevo PIN (4 a 6 dígitos) <span className="text-[#ED500A]">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  autoFocus
                  placeholder="Ej. 1234"
                  value={pin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setPin(val);
                  }}
                  className="w-full h-11 px-3.5 pr-10 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] text-slate-900 dark:text-white font-mono text-base tracking-widest focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {pin.length}/6 dígitos
              </span>
            </div>

            {/* Campo: Confirmar PIN */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Confirmar PIN <span className="text-[#ED500A]">*</span>
              </label>
              <input
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                placeholder="Vuelve a ingresar el PIN"
                value={confirmPin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  setConfirmPin(val);
                }}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] text-slate-900 dark:text-white font-mono text-base tracking-widest focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
              />
            </div>

            {/* Acciones */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={isSubmitting || pin.length < 4}
                isLoading={isSubmitting}
              >
                Guardar PIN
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
