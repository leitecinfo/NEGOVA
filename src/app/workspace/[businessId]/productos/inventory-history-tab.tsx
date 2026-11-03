"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  History,
  Search,
  Filter,
  Calendar,
  RefreshCw,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  ShoppingCart,
  AlertTriangle,
  ArrowRightLeft,
  Package,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import {
  Location,
  MovementType,
  MOVEMENT_TYPE_LABELS,
  InventoryMovementWithDetails,
} from "@/lib/inventory/types";
import { getInventoryMovementsHistoryAction } from "./inventory-actions";
import {
  TableSkeleton,
  EmptyState,
  ErrorState,
} from "@/components/ui";

interface Props {
  businessId: string;
  locations: Location[];
  onOpenMovementModal?: () => void;
  onOpenTransferModal?: () => void;
}

export function InventoryHistoryTab({
  businessId,
  locations,
  onOpenMovementModal,
  onOpenTransferModal,
}: Props) {
  const [movements, setMovements] = useState<InventoryMovementWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filtros
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<MovementType | "all">("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await getInventoryMovementsHistoryAction(businessId, {
        locationId: selectedLocation !== "all" ? selectedLocation : undefined,
        movementType: selectedType !== "all" ? selectedType : undefined,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate + "T23:59:59").toISOString() : undefined,
      });

      if (res.success && res.data) {
        let list = res.data;
        if (search.trim()) {
          const s = search.trim().toLowerCase();
          list = list.filter(
            (m) =>
              m.productName.toLowerCase().includes(s) ||
              (m.productSku && m.productSku.toLowerCase().includes(s)) ||
              (m.notes && m.notes.toLowerCase().includes(s))
          );
        }
        setMovements(list);
      } else {
        const msg = res.error || "No se pudo recuperar el historial de movimientos.";
        setLoadError(msg);
        toast.error("Error al cargar historial", {
          description: msg,
        });
      }
    } catch (err: any) {
      const msg = err.message || "Error al conectar con el servidor.";
      setLoadError(msg);
      toast.error("Error al consultar historial", {
        description: msg,
      });
    } finally {
      setIsLoading(false);
    }
  }, [businessId, selectedLocation, selectedType, startDate, endDate, search]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const formatCOP = (val?: number | null) => {
    if (val === null || val === undefined) return "-";
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("es-CO", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getMovementBadge = (type: MovementType) => {
    switch (type) {
      case "entry":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-2xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <ArrowDownLeft className="w-3 h-3" />
            <span>Entrada</span>
          </span>
        );
      case "exit":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-2xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <ArrowUpRight className="w-3 h-3" />
            <span>Salida</span>
          </span>
        );
      case "adjustment":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-2xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <SlidersHorizontal className="w-3 h-3" />
            <span>Ajuste</span>
          </span>
        );
      case "sale":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-2xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            <ShoppingCart className="w-3 h-3" />
            <span>Venta</span>
          </span>
        );
      case "spoilage":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-2xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3" />
            <span>Merma</span>
          </span>
        );
      case "transfer_in":
      case "transfer_out":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-2xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <ArrowRightLeft className="w-3 h-3" />
            <span>Transferencia</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-semibold bg-slate-100 text-slate-600">
            {type}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4.5 animate-in fade-in duration-200">
      {/* BARRA DE FILTROS */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0E131F] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Buscador de producto / notas */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por producto, SKU o notas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3.5 py-2 bg-slate-50/50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] text-slate-900 dark:text-white placeholder:text-slate-400 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/40 w-full transition-colors"
            />
          </div>

          {/* Filtro por Ubicación */}
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="px-3 py-2 bg-slate-50/50 dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden transition-colors"
          >
            <option value="all">Todas las Ubicaciones</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          {/* Filtro por Tipo de Movimiento */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as any)}
            className="px-3 py-2 bg-slate-50/50 dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden transition-colors"
          >
            <option value="all">Todos los Movimientos</option>
            <option value="entry">Entradas (+)</option>
            <option value="exit">Salidas (-)</option>
            <option value="adjustment">Ajustes</option>
            <option value="sale">Ventas POS</option>
            <option value="spoilage">Mermas</option>
            <option value="transfer_in">Transferencias</option>
          </select>

          {/* Rango de Fechas */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              title="Fecha inicial"
              className="px-2.5 py-2 bg-slate-50/50 dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 rounded-xl text-xs focus:outline-hidden"
            />
            <span className="text-slate-400 text-xs">a</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              title="Fecha final"
              className="px-2.5 py-2 bg-slate-50/50 dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 rounded-xl text-xs focus:outline-hidden"
            />
          </div>

          {/* Botón Refrescar */}
          <button
            onClick={() => loadHistory()}
            title="Actualizar historial"
            className="p-2 rounded-xl border border-slate-200/80 dark:border-white/[0.08] text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {onOpenTransferModal && (
            <button
              type="button"
              onClick={onOpenTransferModal}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold border border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 transition-all cursor-pointer active:scale-98 shrink-0"
              title="Transferir existencias entre dos ubicaciones"
            >
              <ArrowRightLeft className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Transferencias</span>
            </button>
          )}

          {onOpenMovementModal && (
            <button
              type="button"
              onClick={onOpenMovementModal}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-[#ED500A]/20 transition-all cursor-pointer active:scale-98 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nuevo movimiento</span>
            </button>
          )}
        </div>
      </div>

      {/* TABLA DE HISTORIAL O ESTADOS CONSISTENTES [DS-002] */}
      {loadError ? (
        <ErrorState
          title="Error al cargar historial de movimientos"
          description={loadError}
          onRetry={loadHistory}
          retryLabel="Reintentar consulta"
        />
      ) : isLoading ? (
        <TableSkeleton rows={6} cols={8} />
      ) : movements.length === 0 ? (
        <EmptyState
          icon={History}
          title="No hay movimientos registrados"
          description={
            search || selectedLocation !== "all" || selectedType !== "all" || startDate || endDate
              ? "No se encontraron movimientos para los filtros y fechas seleccionados."
              : "Las entradas, salidas, ventas y ajustes de stock que se realicen se registrarán automáticamente en este kardex para total trazabilidad."
          }
          actionLabel={onOpenMovementModal ? "+ Nuevo movimiento" : undefined}
          onAction={onOpenMovementModal}
          resetLabel={
            search || selectedLocation !== "all" || selectedType !== "all" || startDate || endDate
              ? "Limpiar filtros"
              : undefined
          }
          onReset={
            search || selectedLocation !== "all" || selectedType !== "all" || startDate || endDate
              ? () => {
                  setSearch("");
                  setSelectedLocation("all");
                  setSelectedType("all");
                  setStartDate("");
                  setEndDate("");
                }
              : undefined
          }
        />
      ) : (
        <div className="bg-white dark:bg-[#0E131F] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/75 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 font-semibold uppercase text-2xs tracking-wider">
                <tr>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Origen / Ubicación</th>
                  <th className="py-3 px-4 text-right">Cantidad</th>
                  <th className="py-3 px-4 text-right">Costo Unit.</th>
                  <th className="py-3 px-4 text-right">Costo Total</th>
                  <th className="py-3 px-4">Notas / Referencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {movements.map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-white/[0.015] transition-colors"
                  >
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300 font-medium">
                      {formatDate(m.createdAt)}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      <div>
                        <span>{m.productName}</span>
                        {m.productSku && (
                          <span className="block text-2xs text-slate-400 font-normal">
                            SKU: {m.productSku}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">{getMovementBadge(m.movementType)}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {m.locationName}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                      {m.quantity}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500 dark:text-slate-400">
                      {formatCOP(m.unitCost)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-700 dark:text-slate-300">
                      {formatCOP(m.totalCost)}
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-xs">
                      <div>
                        <span className="truncate block">{m.notes || "-"}</span>
                        {m.referenceType === "transfer" && m.referenceId && (
                          <span className="inline-flex items-center gap-1 text-2xs text-purple-600 dark:text-purple-400 font-mono mt-0.5">
                            <ArrowRightLeft className="w-3 h-3" />
                            <span>Transf. #{m.referenceId.slice(0, 8)}</span>
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
