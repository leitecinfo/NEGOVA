"use client";

import React, { useState, useTransition } from "react";
import { X, AlertTriangle, RotateCcw, Package, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Button, Textarea } from "@/components/ui";
import { SpoilageRecord } from "@/lib/spoilage/types";
import { cancelSpoilageRecordAction } from "./actions";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  record: SpoilageRecord | null;
  onSuccess: () => void;
}

export function SpoilageCancelModal({
  isOpen,
  onClose,
  businessId,
  record,
  onSuccess,
}: Props) {
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!isOpen || !record) return null;

  const unit = record.unit || "un";
  const canSubmit = reason.trim().length >= 3 && !isPending;

  const handleCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    startTransition(async () => {
      try {
        const res = await cancelSpoilageRecordAction(businessId, {
          id: record.id,
          reason: reason.trim(),
        });

        if (res.success && res.data) {
          toast.success("Merma anulada con éxito", {
            description: `Se restauraron +${record.quantity} ${unit} a las existencias de «${record.itemName}».`,
          });
          setReason("");
          onSuccess();
          onClose();
        } else {
          toast.error("No se pudo anular la merma", {
            description: res.error || "Ocurrió un error al procesar la solicitud.",
          });
        }
      } catch (err: any) {
        toast.error("Error inesperado", {
          description: err?.message || "Ocurrió un fallo de conexión.",
        });
      }
    });
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => {
          if (!isPending) onClose();
        }}
      >
        <div
          className="relative w-full max-w-md bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold font-title text-slate-900 dark:text-white">
                  Anular registro de merma
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-body mt-0.5">
                  Revierte la salida de existencias y conserva la trazabilidad.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer disabled:opacity-50"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleCancel} className="p-5 space-y-4">
            {/* Resumen del Artículo y Reversión de Stock */}
            <div className="p-3.5 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 space-y-2.5 text-xs font-body">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="font-bold text-slate-900 dark:text-white truncate">
                    {record.itemName}
                  </span>
                </div>
                <span className="font-mono text-rose-600 dark:text-rose-400 font-semibold shrink-0">
                  Merma original: -{record.quantity} {unit}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-white/70 dark:bg-black/30 border border-amber-500/20 flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300 font-medium">
                  Efecto sobre el inventario:
                </span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  +{record.quantity} {unit} reintegrados
                </span>
              </div>
            </div>

            {/* Advertencia de Auditoría */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                El registro <strong>no será eliminado físicamente</strong> para mantener la auditoría del Kardex. Se marcará como <strong>«Anulada»</strong> y se asentará un movimiento compensatorio.
              </p>
            </div>

            {/* Campo: Motivo de Anulación */}
            <Textarea
              label="Motivo de la anulación"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Registro ingresado por error, conteo duplicado, el producto no estaba dañado..."
              rows={3}
              disabled={isPending}
              helperText="Describe la justificación de la anulación (mínimo 3 caracteres)"
            />

            {/* Botones de Acción */}
            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200/80 dark:border-white/[0.08]">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={onClose}
                disabled={isPending}
              >
                Volver
              </Button>
              <Button
                variant="destructive"
                size="sm"
                type="submit"
                disabled={!canSubmit}
                isLoading={isPending}
              >
                Confirmar anulación
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

