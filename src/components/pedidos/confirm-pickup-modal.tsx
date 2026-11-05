"use client";

import React, { useState, useRef, useEffect } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  PackageCheck,
  X,
  Lock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  KeyRound,
  User,
  Phone,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { confirmOrderPickupAction } from "@/app/workspace/[businessId]/ventas/order-actions";
import { RestaurantOrderWithDetails } from "@/lib/restaurant/types";

interface ConfirmPickupModalProps {
  businessId: string;
  isOpen: boolean;
  order: RestaurantOrderWithDetails | null;
  onClose: () => void;
  onSuccess?: (orderId: string) => void;
}

export function ConfirmPickupModal({
  businessId,
  isOpen,
  order,
  onClose,
  onSuccess,
}: ConfirmPickupModalProps) {
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCode("");
      setErrorMessage(null);
      const attempts = order?.pickup_attempts ?? 0;
      const locked = attempts >= 5;
      setIsLocked(locked);
      setRemainingAttempts(Math.max(0, 5 - attempts));
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  const isAlreadyDelivered =
    order.status === "delivered" || Boolean(order.pickup_confirmed_at);
  const isCancelled = order.status === "cancelled";

  const handleConfirm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = code.trim();

    if (cleanCode.length !== 4) {
      setErrorMessage("El código debe tener exactamente 4 dígitos.");
      return;
    }

    if (isLocked) {
      setErrorMessage("La confirmación está bloqueada por exceso de intentos.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await confirmOrderPickupAction(
        businessId,
        order.id,
        cleanCode
      );

      if (!res.success) {
        setErrorMessage(res.error || "Código incorrecto.");
        if (res.remainingAttempts !== undefined) {
          setRemainingAttempts(res.remainingAttempts);
        }
        if (res.isLocked) {
          setIsLocked(true);
        }
        setIsSubmitting(false);
        return;
      }

      toast.success(
        `¡Recogida confirmada! El pedido #${order.order_number} ha sido marcado como entregado.`,
        { duration: 5000 }
      );
      if (onSuccess) {
        onSuccess(order.id);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Error inesperado al validar código.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
        onClick={onClose}
      >
        <div
          className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Encabezado */}
          <div className="flex items-center justify-between p-5 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.01]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                <PackageCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Confirmar Recogida
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  Pedido #{order.order_number}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Cuerpo */}
          <form onSubmit={handleConfirm} className="p-5 sm:p-6 space-y-4">
            {/* Tarjeta del cliente / destinatario */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Persona que recoge
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Para recoger
                </span>
              </div>
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{order.customer_name || "Cliente General"}</span>
              </div>
              {order.customer_phone && (
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-mono text-xs">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{order.customer_phone}</span>
                </div>
              )}
            </div>

            {/* Estados especiales: Ya entregado o Cancelado */}
            {isAlreadyDelivered ? (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
                <div>
                  <p className="font-bold">Este pedido ya fue entregado</p>
                  <p className="text-[11px] opacity-80">
                    No es necesario validar el código nuevamente.
                  </p>
                </div>
              </div>
            ) : isCancelled ? (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
                <div>
                  <p className="font-bold">Pedido cancelado</p>
                  <p className="text-[11px] opacity-80">
                    No se puede confirmar la recogida de un pedido cancelado.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Ingreso del PIN de 4 dígitos */}
                <div className="space-y-2 text-center">
                  <label
                    htmlFor="pickup-pin-input"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Ingresa el PIN de 4 dígitos proporcionado por el cliente
                  </label>

                  <div className="relative max-w-xs mx-auto">
                    <input
                      id="pickup-pin-input"
                      ref={inputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      disabled={isLocked || isSubmitting}
                      value={code}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                        setCode(val);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="••••"
                      className="w-full text-center text-3xl font-mono font-black tracking-[0.5em] py-3 px-4 rounded-2xl border-2 border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-white/20 focus:outline-none focus:border-[#ED500A] focus:ring-4 focus:ring-[#ED500A]/15 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 dark:text-slate-600 pointer-events-none" />
                  </div>

                  {remainingAttempts !== null && remainingAttempts < 5 && !isLocked && (
                    <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      Intentos restantes: {remainingAttempts} de 5
                    </p>
                  )}
                </div>

                {/* Mensajes de error en modal (CERO window.alert) */}
                {errorMessage && (
                  <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                    <span className="leading-snug">{errorMessage}</span>
                  </div>
                )}

                {/* Mensaje de bloqueo */}
                {isLocked && (
                  <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2.5">
                    <ShieldAlert className="w-5 h-5 shrink-0 text-rose-500" />
                    <div>
                      <p className="font-bold">Entrega bloqueada</p>
                      <p className="text-[11px] opacity-80">
                        Se superó el límite de 5 intentos fallidos para proteger contra intentos repetitivos.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Separación de estados aclaratoria */}
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/[0.04] text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                Separación de estados:
              </span>
              <span>
                Confirmar la recogida valida la entrega física del pedido. Si el pago está pendiente, seguirá pendiente hasta registrar el cobro en caja.
              </span>
            </div>

            {/* Botones de acción */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200/80 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.05] text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Cerrar
              </button>

              {!isAlreadyDelivered && !isCancelled && (
                <button
                  type="submit"
                  disabled={code.length !== 4 || isSubmitting || isLocked}
                  className="px-5 py-2.5 rounded-xl bg-[#ED500A] hover:bg-[#d94608] text-white text-xs font-bold shadow-md shadow-[#ED500A]/20 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Validando...</span>
                    </>
                  ) : (
                    <>
                      <PackageCheck className="w-4 h-4" />
                      <span>Confirmar Entrega</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
