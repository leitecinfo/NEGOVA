"use client";

import React from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  X,
  FileText,
  Calendar,
  Building2,
  CreditCard,
  Banknote,
  User,
  Hash,
  AlertTriangle,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  Trash2,
} from "lucide-react";
import { formatCOP } from "@/config/plans";
import { UnifiedMovement } from "@/lib/expenses/types";

interface Props {
  isOpen: boolean;
  movement: UnifiedMovement | null;
  onClose: () => void;
  onAnular?: (movement: UnifiedMovement) => void;
}

export function MovementDetailModal({
  isOpen,
  movement,
  onClose,
  onAnular,
}: Props) {
  if (!isOpen || !movement) return null;

  const isIncome = movement.flow === "income";

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header del Modal */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-xl border ${
                  isIncome
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                }`}
              >
                {isIncome ? (
                  <ArrowDownLeft className="w-5 h-5" />
                ) : (
                  <ArrowUpRight className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Soporte de Movimiento
                </h3>
                <p className="text-xs text-muted-foreground">
                  Comprobante y trazabilidad contable del registro.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Contenido / Ficha del Movimiento */}
          <div className="p-6 space-y-4 overflow-y-auto text-xs">
            {/* Monto y Estado */}
            <div className="p-4 rounded-2xl bg-muted/30 border border-border text-center space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Monto Registrado
              </span>
              <div
                className={`text-2xl sm:text-3xl font-black font-mono ${
                  isIncome
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {isIncome ? "+" : "-"}
                {formatCOP(movement.amount)}
              </div>
              <div className="pt-1 flex items-center justify-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isIncome
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                  }`}
                >
                  {isIncome ? "Ingreso (+)" : "Egreso (-)"}
                </span>

                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                  {movement.category}
                </span>
              </div>
            </div>

            {/* Concepto y Descripción */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Concepto
              </span>
              <p className="text-sm font-bold text-foreground">
                {movement.concept}
              </p>
              {movement.description && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {movement.description}
                </p>
              )}
            </div>

            {/* Ficha de Detalles en Rejilla */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
              {/* Fecha */}
              <div className="p-2.5 rounded-xl bg-card border border-border">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-semibold">
                  Fecha y Hora
                </span>
                <span className="font-semibold text-foreground mt-0.5 block">
                  {new Date(movement.date).toLocaleDateString("es-CO", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {/* Canal y Caja */}
              <div className="p-2.5 rounded-xl bg-card border border-border">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-semibold">
                  Medio & Caja
                </span>
                <span className="font-bold text-foreground mt-0.5 block truncate" title={movement.cajaBadge || ""}>
                  {movement.cajaBadge || movement.paymentMethod}
                </span>
              </div>

              {/* Tercero / Proveedor */}
              <div className="p-2.5 rounded-xl bg-card border border-border">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-semibold">
                  Tercero / Proveedor
                </span>
                <span className="font-semibold text-foreground mt-0.5 block truncate">
                  {movement.thirdPartyName || "— No especificado —"}
                </span>
              </div>

              {/* Comprobante */}
              <div className="p-2.5 rounded-xl bg-card border border-border">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-semibold">
                  N° Comprobante
                </span>
                <span className="font-mono font-bold text-foreground mt-0.5 block">
                  {movement.receiptNumber || "Sin soporte N°"}
                </span>
              </div>
            </div>

            {/* Notas y Justificación */}
            {movement.notes && (
              <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Notas / Observaciones
                </span>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {movement.notes}
                </p>
              </div>
            )}

            {/* Footer de Acciones */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-border">
              {onAnular && movement.status !== "cancelled" && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onAnular(movement);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Anular movimiento</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="ml-auto px-4 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs cursor-pointer"
              >
                Cerrar soporte
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
