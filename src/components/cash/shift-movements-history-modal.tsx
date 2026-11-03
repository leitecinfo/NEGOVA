"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  History,
  ArrowDownRight,
  ArrowUpRight,
  ShoppingCart,
  Receipt,
  RotateCcw,
  RefreshCw,
  Loader2,
  Clock,
  Calendar,
  AlertCircle,
  Plus,
  Minus,
} from "lucide-react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { CashMovement, CashMovementType, CASH_MOVEMENT_TYPE_LABELS } from "@/lib/cash/types";
import { toast } from "sonner";

interface ShiftMovementsHistoryModalProps {
  isOpen: boolean;
  businessId: string;
  sessionId: string;
  registerName: string;
  initialAmount: number;
  expectedCashInDrawer: number;
  isOpenSession: boolean;
  onClose: () => void;
  onNewMovementClick?: (type: "entry" | "withdrawal") => void;
}

export function ShiftMovementsHistoryModal({
  isOpen,
  businessId,
  sessionId,
  registerName,
  initialAmount,
  expectedCashInDrawer,
  isOpenSession,
  onClose,
  onNewMovementClick,
}: ShiftMovementsHistoryModalProps) {
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const formatCOP = (val: number) =>
    `$${new Intl.NumberFormat("es-CO").format(val)}`;

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat("es-CO", {
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: true,
        day: "2-digit",
        month: "short",
      }).format(d);
    } catch {
      return isoString;
    }
  };

  const loadMovements = async () => {
    setIsLoading(true);
    try {
      const { getCashMovementsAction } = await import(
        "@/app/workspace/[businessId]/cajas/actions"
      );
      const res = await getCashMovementsAction(businessId, sessionId);
      if (res.success && res.data) {
        setMovements(res.data);
      } else {
        toast.error(res.error || "No se pudieron consultar los movimientos del turno.");
      }
    } catch {
      toast.error("Error al consultar movimientos del turno.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMovements();
    }
  }, [isOpen, sessionId, businessId]);

  if (!isOpen) return null;

  // Filtrado de movimientos por tipo
  const filteredMovements = movements.filter((m) => {
    if (typeFilter === "all") return true;
    if (typeFilter === "sales") return ["sale_cash", "sale_card", "sale_digital"].includes(m.movementType);
    if (typeFilter === "expenses") return m.movementType === "expense";
    if (typeFilter === "entries") return m.movementType === "entry";
    if (typeFilter === "withdrawals") return m.movementType === "withdrawal";
    return true;
  });

  const getMovementVisual = (type: CashMovementType) => {
    switch (type) {
      case "sale_cash":
        return {
          icon: ShoppingCart,
          color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20",
          sign: "+",
          label: "Venta Efectivo",
          affectsCash: true,
        };
      case "sale_card":
      case "sale_digital":
        return {
          icon: ShoppingCart,
          color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20",
          sign: "+",
          label: type === "sale_card" ? "Venta Tarjeta" : "Venta Digital",
          affectsCash: false,
        };
      case "entry":
        return {
          icon: ArrowDownRight,
          color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20",
          sign: "+",
          label: "Entrada Manual",
          affectsCash: true,
        };
      case "withdrawal":
        return {
          icon: ArrowUpRight,
          color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20",
          sign: "-",
          label: "Retiro de Efectivo",
          affectsCash: true,
        };
      case "expense":
        return {
          icon: Receipt,
          color: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20",
          sign: "-",
          label: "Gasto en Efectivo",
          affectsCash: true,
        };
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
        <div className="relative w-full max-w-2xl bg-white dark:bg-[#0E131F] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Historial de Movimientos del Turno
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {registerName} · Base inicial: <span className="font-mono">{formatCOP(initialAmount)}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={loadMovements}
                disabled={isLoading}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                title="Actualizar movimientos"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Banner de Saldo en Cajón en Tiempo Real */}
          <div className="px-5 py-3.5 bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Efectivo Actual en Cajón
              </span>
              <span className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                {formatCOP(expectedCashInDrawer)}
              </span>
            </div>

            {/* Acciones directas si el turno está abierto */}
            {isOpenSession && onNewMovementClick && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNewMovementClick("entry")}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Entrada</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNewMovementClick("withdrawal")}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                  <span>Retiro</span>
                </button>
              </div>
            )}
          </div>

          {/* Filtros de Tipo de Movimiento */}
          <div className="px-5 py-2.5 border-b border-slate-200/80 dark:border-white/10 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: "all", label: "Todos" },
              { id: "sales", label: "Ventas" },
              { id: "entries", label: "Entradas" },
              { id: "withdrawals", label: "Retiros" },
              { id: "expenses", label: "Gastos" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTypeFilter(tab.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  typeFilter === tab.id
                    ? "bg-[#ED500A] text-white shadow-xs"
                    : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Lista de Movimientos */}
          <div className="flex-1 overflow-y-auto p-5 space-y-2 min-h-[250px]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-[#ED500A]" />
                <span className="text-xs">Cargando movimientos...</span>
              </div>
            ) : filteredMovements.length === 0 ? (
              <div className="text-center py-12 text-slate-400 space-y-1">
                <History className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  No hay movimientos registrados
                </p>
                <p className="text-[11px] text-slate-400">
                  Las ventas, gastos, entradas y retiros del turno aparecerán aquí.
                </p>
              </div>
            ) : (
              filteredMovements.map((mov) => {
                const visual = getMovementVisual(mov.movementType);
                const Icon = visual.icon;

                return (
                  <div
                    key={mov.id}
                    className="p-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#131826] flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center border font-bold shrink-0 ${visual.color}`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {visual.label}
                          </span>
                          {!visual.affectsCash && (
                            <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">
                              No efectivo
                            </span>
                          )}
                        </div>

                        {mov.notes && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                            {mov.notes}
                          </p>
                        )}

                        <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {formatDate(mov.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`font-mono font-bold text-sm ${
                          visual.sign === "+"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {visual.sign}
                        {formatCOP(mov.amount)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.02] flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Total movimientos: <strong>{filteredMovements.length}</strong>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-black text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
