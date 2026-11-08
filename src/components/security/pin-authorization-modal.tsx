"use client";

import React, { useState } from "react";
import { ShieldAlert, KeyRound, Eye, EyeOff, X, Loader2 } from "lucide-react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Button } from "@/components/ui/button";

interface PinAuthorizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  actionLabel?: string;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  isSubmitting?: boolean;
  onConfirm: (pin: string, reason?: string) => Promise<void> | void;
}

export function PinAuthorizationModal({
  isOpen,
  onClose,
  title = "Autorización de Operación Sensible",
  description = "Ingresa el PIN de 4 a 6 dígitos de un supervisor o colaborador autorizado para continuar.",
  actionLabel = "Autorizar y Continuar",
  requireReason = false,
  reasonLabel = "Motivo de la operación",
  reasonPlaceholder = "Ej. Anulación de comanda / Error en pedido...",
  isSubmitting = false,
  onConfirm,
}: PinAuthorizationModalProps) {
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const cleanPin = pin.trim();
    if (!cleanPin || cleanPin.length < 4 || cleanPin.length > 6) {
      setLocalError("El PIN debe tener entre 4 y 6 dígitos numéricos.");
      return;
    }

    if (requireReason && (!reason.trim() || reason.trim().length < 3)) {
      setLocalError("Debe ingresar un motivo válido (mínimo 3 caracteres).");
      return;
    }

    await onConfirm(cleanPin, reason.trim());
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm font-body animate-in fade-in duration-150">
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-md bg-white dark:bg-[#0D0F16] rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200/80 dark:border-white/[0.08] space-y-5"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold font-title text-slate-900 dark:text-white">
                  {title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Verificación de seguridad requerida
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

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {description}
          </p>

          {localError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400">
              {localError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Input de PIN */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                PIN de Autorización <span className="text-[#ED500A]">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  autoFocus
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setPin(val);
                  }}
                  className="w-full h-12 px-4 pr-11 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] text-slate-900 dark:text-white font-mono text-xl tracking-widest text-center focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[10px] text-slate-400 text-center block font-mono">
                {pin.length}/6 dígitos
              </span>
            </div>

            {/* Input de Motivo si es requerido */}
            {requireReason && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  {reasonLabel} <span className="text-[#ED500A]">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={reasonPlaceholder}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] text-slate-900 dark:text-white resize-none"
                />
              </div>
            )}

            {/* Botones */}
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
                disabled={isSubmitting || pin.length < 4 || (requireReason && reason.trim().length < 3)}
                isLoading={isSubmitting}
              >
                {actionLabel}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
