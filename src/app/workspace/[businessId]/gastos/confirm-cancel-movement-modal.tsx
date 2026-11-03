"use client";

import React, { useState } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { formatCOP } from "@/config/plans";
import { UnifiedMovement } from "@/lib/expenses/types";
import { cancelUnifiedMovementAction } from "./actions";

interface Props {
  businessId: string;
  isOpen: boolean;
  movement: UnifiedMovement | null;
  onClose: () => void;
  onSuccess: (cancelledId: string) => void;
}

export function ConfirmCancelMovementModal({
  businessId,
  isOpen,
  movement,
  onClose,
  onSuccess,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !movement) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const res = await cancelUnifiedMovementAction(businessId, movement.id);
      if (!res.success) {
        toast.error("Error al anular movimiento", {
          description: res.error || "No se pudo anular el movimiento.",
        });
        return;
      }

      toast.success(`Movimiento «${movement.concept}» anulado exitosamente.`);
      onSuccess(movement.id);
      onClose();
    } catch (err: any) {
      toast.error("Error inesperado al anular movimiento.", {
        description: err?.message || "Ocurrió un error en el servidor.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isIncome = movement.flow === "income";

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-foreground">
                ¿Anular este movimiento?
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Esta acción revertirá el registro financiero en el balance.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground space-y-1.5">
            <div className="flex justify-between items-center text-foreground font-semibold">
              <span className="truncate max-w-[200px]">{movement.concept}</span>
              <span
                className={`font-mono font-bold ${
                  isIncome ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {isIncome ? "+" : "-"}
                {formatCOP(movement.amount)}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Categoría: <strong className="text-foreground">{movement.category}</strong>
            </p>
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Si este movimiento afectó una caja en efectivo, se compensará en la sesión para mantener cuadrado el balance.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-red-600 text-white hover:bg-red-700 transition-all shadow-md disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Anulando...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Sí, anular movimiento</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
