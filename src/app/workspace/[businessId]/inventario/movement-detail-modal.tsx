"use client";

import React from "react";
import {
  X,
  History,
  Package,
  ArrowDownLeft,
  ArrowUpRight,
  User,
  Calendar,
  DollarSign,
  FileText,
  Tag,
  Hash,
  Layers,
  Store,
  ShoppingCart,
  Bike,
  RotateCcw,
} from "lucide-react";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  InventoryMovementWithDetails,
  formatMovementDate,
  MovementOrigin,
} from "@/lib/inventory/types";
import { formatCOP } from "@/lib/pos/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  movement: InventoryMovementWithDetails | null;
}

export function MovementDetailModal({ isOpen, onClose, movement }: Props) {
  if (!isOpen || !movement) return null;

  const isEntry =
    movement.movementType === "entry" ||
    movement.movementType === "transfer_in" ||
    (movement.movementType === "adjustment" && movement.quantity >= 0);

  const getOriginIcon = (origin?: MovementOrigin) => {
    switch (origin) {
      case "Compra":
        return <Package className="w-4 h-4 text-emerald-500" />;
      case "Merma":
        return <RotateCcw className="w-4 h-4 text-rose-500" />;
      case "Ajuste":
        return <Layers className="w-4 h-4 text-blue-500" />;
      case "Receta":
        return <Layers className="w-4 h-4 text-purple-500" />;
      case "POS":
        return <ShoppingCart className="w-4 h-4 text-sky-500" />;
      case "Mesa":
        return <Store className="w-4 h-4 text-amber-500" />;
      case "Domicilio":
        return <Bike className="w-4 h-4 text-indigo-500" />;
      case "Devolución":
        return <RotateCcw className="w-4 h-4 text-purple-500" />;
      default:
        return <History className="w-4 h-4 text-slate-500" />;
    }
  };

  const qty = Number(movement.quantity || 0);
  const unit = movement.unit || "un";
  const unitCost = movement.unitCost ?? 0;
  const total = movement.totalCost ?? (unitCost > 0 ? qty * unitCost : null);

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-lg bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-2xl shrink-0 ${
                  isEntry
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                }`}
              >
                {isEntry ? (
                  <ArrowDownLeft className="w-6 h-6" />
                ) : (
                  <ArrowUpRight className="w-6 h-6" />
                )}
              </div>
              <div>
                <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 block">
                  Detalle del Movimiento
                </span>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5 truncate max-w-[280px] sm:max-w-xs">
                  {movement.productName}
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs sm:text-sm">
            {/* Tarjetas de Existencias: Anterior, Cantidad, Resultante */}
            <div className="grid grid-cols-3 gap-2 text-center p-3.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl">
              <div>
                <span className="text-2xs font-medium text-slate-400 uppercase tracking-wider block">
                  Existencia Anterior
                </span>
                <span className="text-sm sm:text-base font-bold font-mono text-slate-700 dark:text-slate-300 mt-1 block">
                  {movement.previousQuantity !== null && movement.previousQuantity !== undefined
                    ? `${movement.previousQuantity} ${unit}`
                    : "—"}
                </span>
              </div>

              <div>
                <span className="text-2xs font-medium text-slate-400 uppercase tracking-wider block">
                  {isEntry ? "Entrada (+)" : "Salida (-)"}
                </span>
                <span
                  className={`text-sm sm:text-base font-black font-mono mt-1 block ${
                    isEntry ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {isEntry ? "+" : "-"}
                  {qty} {unit}
                </span>
              </div>

              <div>
                <span className="text-2xs font-medium text-slate-400 uppercase tracking-wider block">
                  Existencia Resultante
                </span>
                <span className="text-sm sm:text-base font-bold font-mono text-slate-900 dark:text-white mt-1 block">
                  {movement.resultingQuantity !== null && movement.resultingQuantity !== undefined
                    ? `${movement.resultingQuantity} ${unit}`
                    : "—"}
                </span>
              </div>
            </div>

            {/* Datos detallados */}
            <div className="space-y-2.5 divide-y divide-slate-100 dark:divide-white/[0.04]">
              {/* Fecha y hora */}
              <div className="pt-2 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Fecha y hora:</span>
                </span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">
                  {formatMovementDate(movement.createdAt)}
                </span>
              </div>

              {/* Origen / Causa operativa */}
              <div className="pt-2 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  {getOriginIcon(movement.origin)}
                  <span>Origen operativo:</span>
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {movement.origin || "Operación regular"}
                </span>
              </div>

              {/* Tipo de movimiento */}
              <div className="pt-2 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  <span>Tipo de registro:</span>
                </span>
                <span className="font-mono text-xs uppercase px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300">
                  {movement.movementType}
                </span>
              </div>

              {/* Usuario responsable */}
              <div className="pt-2 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  <span>Usuario responsable:</span>
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {movement.createdByName || "Sistema"}
                </span>
              </div>

              {/* Costos si aplican */}
              {(unitCost > 0 || total) && (
                <>
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Costo unitario:</span>
                    </span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">
                      {unitCost > 0 ? formatCOP(unitCost) : "—"}
                    </span>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Valor total del movimiento:</span>
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {total ? formatCOP(total) : "—"}
                    </span>
                  </div>
                </>
              )}

              {/* Referencia de la operación relacionada */}
              {movement.referenceId && (
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5" />
                    <span>Referencia vinculada:</span>
                  </span>
                  <span className="font-mono text-2xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]" title={movement.referenceId}>
                    {movement.referenceType ? `[${movement.referenceType}] ` : ""}
                    {movement.referenceId}
                  </span>
                </div>
              )}
            </div>

            {/* Observaciones y trazabilidad */}
            <div className="p-3 bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Motivo / Observaciones del movimiento
              </span>
              <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {movement.notes || "Sin observaciones adicionales registradas para este movimiento."}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 text-slate-700 dark:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
