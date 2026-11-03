"use client";

import React, { useState, useEffect } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  X,
  History,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  UtensilsCrossed,
  ShoppingCart,
  MapPin,
  ExternalLink,
  Loader2,
  FileText,
} from "lucide-react";
import { Ingredient } from "@/lib/recipes/types";
import { InventoryMovementWithDetails, formatMovementDate, resolveMovementOrigin } from "@/lib/inventory/types";
import { getInventoryMovementsHistoryAction } from "../inventario/actions";
import { formatCOP } from "@/config/plans";
import Link from "next/link";

interface Props {
  businessId: string;
  ingredient: Ingredient | null;
  isOpen: boolean;
  onClose: () => void;
}

export function IngredientHistoryModal({
  businessId,
  ingredient,
  isOpen,
  onClose,
}: Props) {
  const [movements, setMovements] = useState<InventoryMovementWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !ingredient) return;

    let isMounted = true;
    setIsLoading(true);

    getInventoryMovementsHistoryAction(businessId, { productId: ingredient.id })
      .then((res) => {
        if (isMounted) {
          if (res.success && res.data) {
            setMovements(res.data);
          } else {
            setMovements([]);
          }
        }
      })
      .catch(() => {
        if (isMounted) setMovements([]);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, businessId, ingredient]);

  if (!isOpen || !ingredient) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="relative w-full max-w-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.01]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Historial de Movimientos</span>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300">
                    {ingredient.unit}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {ingredient.name} · Stock actual: {ingredient.stockQuantity} {ingredient.unit}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Contenido / Lista de movimientos */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {isLoading ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#ED500A]" />
                <p className="text-xs">Cargando kardex de movimientos...</p>
              </div>
            ) : movements.length === 0 ? (
              <div className="p-10 text-center text-slate-400 space-y-2 border border-dashed border-slate-200 dark:border-white/[0.08] rounded-2xl">
                <History className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Sin movimientos registrados
                </h4>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Aún no se han registrado compras, consumos en recetas o ajustes manuales de stock para este ingrediente.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {movements.map((m) => {
                  const isEntry =
                    m.movementType === "entry" ||
                    m.movementType === "transfer_in";
                  const isExit =
                    m.movementType === "exit" ||
                    m.movementType === "spoilage" ||
                    m.movementType === "transfer_out" ||
                    m.movementType === "sale";

                  const originLabel = resolveMovementOrigin(m);

                  return (
                    <div
                      key={m.id}
                      className="p-3.5 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-xl shrink-0 ${
                            isEntry
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : isExit
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          }`}
                        >
                          {isEntry ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : isExit ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : (
                            <RotateCcw className="w-4 h-4" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {originLabel}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {formatMovementDate(m.createdAt)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {m.locationName && (
                              <span className="flex items-center gap-0.5">
                                <MapPin className="w-3 h-3" />
                                {m.locationName}
                              </span>
                            )}
                            {m.notes && <span>· {m.notes}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`text-xs font-mono font-bold block ${
                            isEntry
                              ? "text-emerald-600 dark:text-emerald-400"
                              : isExit
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-blue-600 dark:text-blue-400"
                          }`}
                        >
                          {isEntry ? "+" : isExit ? "-" : ""}
                          {m.quantity} {ingredient.unit}
                        </span>
                        {m.unitCost ? (
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {formatCOP(m.unitCost)}/{ingredient.unit}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.01] flex items-center justify-between">
            <Link
              href={`/workspace/${businessId}/inventario?tab=history&search=${encodeURIComponent(
                ingredient.name
              )}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#ED500A] hover:underline"
            >
              <span>Ver en Kardex general de Inventario</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-200/70 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
