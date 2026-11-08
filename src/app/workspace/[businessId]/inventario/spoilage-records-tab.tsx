"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  TrendingDown,
  Plus,
  AlertTriangle,
  DollarSign,
  User,
  Package,
  ArrowRight,
  Eye,
  RefreshCw,
  Clock,
  Pencil,
  Ban,
  CheckCircle2,
  X,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  SpoilageRecord,
  SpoilageKPIs,
  SPOILAGE_CAUSE_LABELS,
  SPOILAGE_CAUSE_COLORS,
  SpoilageStatus,
} from "@/lib/spoilage/types";
import { InventariableItem } from "@/lib/inventory/types";
import { getSpoilageRecordsAction, getSpoilageKPIsAction } from "./actions";
import { TableSkeleton, EmptyState, ErrorState, KpiGrid, KpiCard, SearchInput, Select, Button } from "@/components/ui";
import { ModalPortal } from "@/components/ui/modal-portal";
import { SpoilageFormModal } from "./spoilage-form-modal";
import { SpoilageCancelModal } from "./spoilage-cancel-modal";
import { formatCOP } from "@/lib/pos/types";

interface Props {
  businessId: string;
  items?: InventariableItem[];
  onOpenCreateModal: () => void;
  refreshTrigger?: number;
  onStockChanged?: () => void;
}

export function SpoilageRecordsTab({
  businessId,
  items = [],
  onOpenCreateModal,
  refreshTrigger = 0,
  onStockChanged,
}: Props) {
  const [records, setRecords] = useState<SpoilageRecord[]>([]);
  const [kpis, setKpis] = useState<SpoilageKPIs | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState("");
  const [causeFilter, setCauseFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<SpoilageStatus | "all">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modales
  const [selectedRecord, setSelectedRecord] = useState<SpoilageRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<SpoilageRecord | null>(null);
  const [cancellingRecord, setCancellingRecord] = useState<SpoilageRecord | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [recordsRes, kpisRes] = await Promise.all([
        getSpoilageRecordsAction(businessId, {
          search: search.trim() || undefined,
          cause: causeFilter !== "all" ? (causeFilter as any) : undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
        getSpoilageKPIsAction(businessId),
      ]);

      if (recordsRes.success && recordsRes.data) {
        setRecords(recordsRes.data);
      } else {
        setLoadError(recordsRes.error || "No se pudieron obtener los registros de mermas.");
      }

      if (kpisRes.success && kpisRes.data) {
        setKpis(kpisRes.data);
      }
    } catch (err: any) {
      setLoadError(err?.message || "Error al conectar con el servidor.");
    } finally {
      setIsLoading(false);
    }
  }, [businessId, search, causeFilter, statusFilter, startDate, endDate]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  const handleActionSuccess = () => {
    loadData();
    onStockChanged?.();
  };

  const formatDate = (iso?: string | null) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    } catch {
      return iso;
    }
  };

  const getCauseLabel = (cause: string, customReason?: string | null) => {
    if (customReason && customReason.trim()) {
      return customReason;
    }
    return (SPOILAGE_CAUSE_LABELS as Record<string, string>)[cause] || cause;
  };

  const getCauseBadge = (cause: string) => {
    const styling = (SPOILAGE_CAUSE_COLORS as Record<string, { bg: string; text: string; border: string }>)[cause];
    if (styling) {
      return `${styling.bg} ${styling.text} border ${styling.border}`;
    }
    return "bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20";
  };

  const clearFilters = () => {
    setSearch("");
    setCauseFilter("all");
    setStatusFilter("all");
    setStartDate("");
    setEndDate("");
  };

  const hasActiveFilters = Boolean(
    search || causeFilter !== "all" || statusFilter !== "all" || startDate || endDate
  );

  return (
    <div className="space-y-6">
      {/* 1. Métricas de Mermas */}
      <KpiGrid cols={3}>
        <KpiCard
          title="Mermas vigentes"
          value={kpis ? kpis.totalRecords : records.filter((r) => r.status === "active").length}
          subtext={`${kpis?.recentRecordsCount || 0} en los últimos 30 días`}
          icon={<TrendingDown className="w-5 h-5" />}
          variant="red"
        />
        <KpiCard
          title="Costo total perdido"
          value={formatCOP(kpis?.totalCost || 0)}
          subtext="Pérdidas operativas (excluye anuladas)"
          icon={<DollarSign className="w-5 h-5" />}
          variant="red"
        />
        <KpiCard
          title="Mermas anuladas"
          value={kpis?.cancelledRecordsCount ?? records.filter((r) => r.status === "cancelled").length}
          subtext={
            kpis?.cancelledCost && kpis.cancelledCost > 0
              ? `${formatCOP(kpis.cancelledCost)} reintegrados al stock`
              : "Existencias revertidas"
          }
          icon={<AlertTriangle className="w-5 h-5" />}
          variant="amber"
        />
      </KpiGrid>

      {/* 2. Barra de Control y Filtros */}
      <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              Historial de mermas y desperdicios
            </span>
            <span className="text-xs text-slate-400">
              ({records.length} {records.length === 1 ? "registro" : "registros"})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2 rounded-xl border border-slate-200/80 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="Refrescar listado"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>

            <button
              onClick={onOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar merma</span>
            </button>
          </div>
        </div>

        {/* Controles de Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100 dark:border-white/[0.04]">
          {/* Búsqueda */}
          <div className="lg:col-span-1">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch("")}
              placeholder="Buscar artículo, motivo u observación..."
            />
          </div>

          {/* Causa */}
          <div>
            <Select
              value={causeFilter}
              onChange={(e) => setCauseFilter(e.target.value)}
              aria-label="Filtrar por causa de merma"
            >
              <option value="all">Todas las causas</option>
              <option value="expired">Producto vencido</option>
              <option value="damaged">Producto dañado</option>
              <option value="decomposed">Descomposición</option>
              <option value="spilled">Derrame o desperdicio</option>
              <option value="handling_error">Error de manipulación</option>
              <option value="stolen">Pérdida o faltante</option>
              <option value="other">Otro motivo</option>
            </Select>
          </div>

          {/* Estado */}
          <div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              aria-label="Filtrar por estado de la merma"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Solo vigentes</option>
              <option value="cancelled">Solo anuladas</option>
            </Select>
          </div>

          {/* Fecha inicial */}
          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#ED500A]"
              title="Fecha inicial"
            />
          </div>

          {/* Fecha final */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#ED500A]"
              title="Fecha final"
            />
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors shrink-0 cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Listado / Tabla de Mermas Mejorada */}
      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : loadError ? (
        <ErrorState description={loadError} onRetry={loadData} />
      ) : records.length === 0 ? (
        <EmptyState
          icon={TrendingDown}
          title={hasActiveFilters ? "No se encontraron mermas con esos filtros" : "No hay mermas registradas"}
          description={
            hasActiveFilters
              ? "Prueba restableciendo los filtros de fecha o búsqueda para ver otros registros."
              : "Cuando registres mermas por vencimiento, daño o desperdicio, se reflejarán aquí con descuento único de stock y trazabilidad completa."
          }
          resetLabel={hasActiveFilters ? "Limpiar filtros" : undefined}
          onReset={hasActiveFilters ? clearFilters : undefined}
          actionLabel={!hasActiveFilters ? "Registrar primera merma" : undefined}
          onAction={!hasActiveFilters ? onOpenCreateModal : undefined}
        />
      ) : (
        <div className="border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden bg-white dark:bg-[#0D0F16] shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/70 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 font-semibold">
                  <th className="py-3 px-4">Artículo</th>
                  <th className="py-3 px-4 text-right">Cantidad</th>
                  <th className="py-3 px-4">Motivo</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4 min-w-[160px]">Observación</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {records.map((r) => {
                  const unitText = r.unit || "un";
                  const totalLoss = Number(r.totalCost || (r.quantity * (r.unitCost || 0)));
                  const isCancelled = r.status === "cancelled";

                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors ${
                        isCancelled ? "opacity-75 bg-slate-50/30 dark:bg-white/[0.01]" : ""
                      }`}
                    >
                      {/* Artículo */}
                      <td className="py-3 px-4 min-w-[180px]">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white block">
                            {r.itemName || "Artículo no identificado"}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 font-medium">
                            {r.itemType === "ingredient" ? "Insumo" : "Producto"}
                          </span>
                        </div>
                        {r.registeredByName && (
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            Por: {r.registeredByName}
                          </span>
                        )}
                      </td>

                      {/* Cantidad */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span
                          className={`font-mono font-bold ${
                            isCancelled
                              ? "text-slate-400 line-through"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          -{r.quantity} {unitText}
                        </span>
                        {totalLoss > 0 && !isCancelled && (
                          <span className="text-[10px] font-mono text-slate-400 block">
                            {formatCOP(totalLoss)}
                          </span>
                        )}
                      </td>

                      {/* Motivo */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${getCauseBadge(
                            r.cause
                          )}`}
                        >
                          {getCauseLabel(r.cause, r.customReason)}
                        </span>
                      </td>

                      {/* Fecha */}
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDate(r.createdAt || r.date)}</span>
                        </div>
                      </td>

                      {/* Observación */}
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {r.notes ? (
                          <span className="line-clamp-2 leading-relaxed text-[11px]">
                            {r.notes}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">—</span>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {isCancelled ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            Anulada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Vigente
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* Ver detalles */}
                          <button
                            onClick={() => setSelectedRecord(r)}
                            className="inline-flex items-center gap-1 p-1.5 px-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                            title="Ver detalles completos"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Detalles</span>
                          </button>

                          {/* Acciones para registros vigentes */}
                          {!isCancelled && (
                            <>
                              <button
                                onClick={() => setEditingRecord(r)}
                                className="inline-flex items-center gap-1 p-1.5 px-2 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors cursor-pointer"
                                title="Editar merma"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Editar</span>
                              </button>

                              <button
                                onClick={() => setCancellingRecord(r)}
                                className="inline-flex items-center gap-1 p-1.5 px-2 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title="Anular merma y revertir existencias"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Anular</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Modal de Detalle de Merma */}
      {selectedRecord && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
            <div
              className="relative w-full max-w-lg bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    selectedRecord.status === "cancelled"
                      ? "bg-slate-200 dark:bg-white/10 text-slate-500"
                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  }`}>
                    <TrendingDown className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Detalle de Merma
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                      {selectedRecord.itemName}
                    </h3>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedRecord(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
                {/* Cuadro de Estado Anulada si aplica */}
                {selectedRecord.status === "cancelled" && (
                  <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs space-y-1.5 font-body">
                    <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300">
                      <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span>Registro Anulado (Existencias Revertidas)</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                      Esta merma fue anulada y su efecto sobre el inventario fue restituido (+{selectedRecord.quantity} {selectedRecord.unit || "un"}). No afecta el costo operativo de pérdidas ni descuenta existencias.
                    </p>
                    {selectedRecord.cancellationReason && (
                      <div className="pt-1 text-slate-700 dark:text-slate-200 text-[11px]">
                        <strong className="text-slate-900 dark:text-white">Motivo de anulación:</strong> {selectedRecord.cancellationReason}
                      </div>
                    )}
                    {selectedRecord.cancelledByName && (
                      <div className="text-[10px] text-slate-400">
                        Anulado por: {selectedRecord.cancelledByName} {selectedRecord.cancelledAt ? `el ${formatDate(selectedRecord.cancelledAt)}` : ""}
                      </div>
                    )}
                  </div>
                )}

                {/* Cuadros de resumen */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl">
                    <span className="text-[11px] text-slate-400 block">Cantidad registrada</span>
                    <span className={`text-lg font-bold font-mono mt-0.5 block ${
                      selectedRecord.status === "cancelled"
                        ? "text-slate-400 line-through"
                        : "text-rose-600 dark:text-rose-400"
                    }`}>
                      -{selectedRecord.quantity} {selectedRecord.unit || "un"}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl">
                    <span className="text-[11px] text-slate-400 block">Pérdida valorizada</span>
                    <span className={`text-lg font-bold font-mono mt-0.5 block ${
                      selectedRecord.status === "cancelled"
                        ? "text-slate-400 line-through"
                        : "text-slate-900 dark:text-white"
                    }`}>
                      {formatCOP(selectedRecord.totalCost || (selectedRecord.quantity * (selectedRecord.unitCost || 0)))}
                    </span>
                  </div>
                </div>

                {/* Trazabilidad de existencias */}
                {(selectedRecord.previousStock !== undefined && selectedRecord.previousStock !== null ||
                  selectedRecord.resultingStock !== undefined && selectedRecord.resultingStock !== null) && (
                  <div className="p-3 bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl flex items-center justify-around text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Stock previo</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-sm">
                        {selectedRecord.previousStock ?? "—"} {selectedRecord.unit || "un"}
                      </span>
                    </div>

                    <ArrowRight className="w-4 h-4 text-slate-400" />

                    <div>
                      <span className="text-[10px] text-slate-400 block">Stock resultante</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                        {selectedRecord.resultingStock ?? "—"} {selectedRecord.unit || "un"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Info detallada */}
                <div className="border border-slate-200/80 dark:border-white/[0.08] rounded-2xl divide-y divide-slate-100 dark:divide-white/[0.04]">
                  <div className="p-2.5 px-3 flex justify-between">
                    <span className="text-slate-400">Estado:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {selectedRecord.status === "cancelled" ? "Anulada" : "Vigente"}
                    </span>
                  </div>

                  <div className="p-2.5 px-3 flex justify-between">
                    <span className="text-slate-400">Motivo / Causa:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {getCauseLabel(selectedRecord.cause, selectedRecord.customReason)}
                    </span>
                  </div>

                  <div className="p-2.5 px-3 flex justify-between">
                    <span className="text-slate-400">Fecha y hora:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {formatDate(selectedRecord.createdAt || selectedRecord.date)}
                    </span>
                  </div>

                  <div className="p-2.5 px-3 flex justify-between">
                    <span className="text-slate-400">Registrado por:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {selectedRecord.registeredByName || "Sistema / Usuario"}
                    </span>
                  </div>

                  {selectedRecord.movementId && (
                    <div className="p-2.5 px-3 flex justify-between items-center">
                      <span className="text-slate-400">ID Movimiento (Kardex):</span>
                      <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 truncate max-w-[200px]">
                        {selectedRecord.movementId}
                      </span>
                    </div>
                  )}

                  {selectedRecord.notes && (
                    <div className="p-2.5 px-3">
                      <span className="text-slate-400 block mb-1">Observaciones:</span>
                      <p className="text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-white/[0.03] p-2 rounded-xl text-[11px] leading-relaxed">
                        {selectedRecord.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer con Acciones Contextuales */}
              <div className="p-4 px-5 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between">
                <div>
                  {selectedRecord.status === "active" && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const toEdit = selectedRecord;
                          setSelectedRecord(null);
                          setEditingRecord(toEdit);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          const toCancel = selectedRecord;
                          setSelectedRecord(null);
                          setCancellingRecord(toCancel);
                        }}
                      >
                        <Ban className="w-3.5 h-3.5 mr-1" />
                        Anular
                      </Button>
                    </div>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedRecord(null)}
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* 5. Modal de Edición de Merma (reutiliza SpoilageFormModal en modo edición) */}
      {editingRecord && (
        <SpoilageFormModal
          isOpen={Boolean(editingRecord)}
          onClose={() => setEditingRecord(null)}
          businessId={businessId}
          items={items}
          initialRecord={editingRecord}
          onSuccess={handleActionSuccess}
        />
      )}

      {/* 6. Modal de Anulación de Merma */}
      {cancellingRecord && (
        <SpoilageCancelModal
          isOpen={Boolean(cancellingRecord)}
          onClose={() => setCancellingRecord(null)}
          businessId={businessId}
          record={cancellingRecord}
          onSuccess={handleActionSuccess}
        />
      )}
    </div>
  );
}
