"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  AlertTriangle,
  TrendingDown,
  Layers,
  Calendar,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Loader2,
  Package,
  FileText,
  DollarSign,
  Clock,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Product } from "@/lib/products/types";
import {
  SpoilageRecord,
  SpoilageKPIs,
  SpoilageCause,
  SpoilageItemType,
  SpoilageTimeFilter,
  SPOILAGE_CAUSES,
  SPOILAGE_CAUSE_LABELS,
  SPOILAGE_CAUSE_COLORS,
} from "@/lib/spoilage/types";
import { getSpoilageRecordsAction, getSpoilageKPIsAction } from "./actions";
import { SpoilageFormModal } from "./spoilage-form-modal";
import { formatCOP } from "@/lib/pos/types";

interface Props {
  businessId: string;
  products: Product[];
}

export function SpoilageTab({ businessId, products }: Props) {
  const [records, setRecords] = useState<SpoilageRecord[]>([]);
  const [kpis, setKpis] = useState<SpoilageKPIs | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filtros requeridos: Temporal (Hoy, Última semana, Último mes, Todos) y Campo de búsqueda
  const [timeFilter, setTimeFilter] = useState<SpoilageTimeFilter>("all");
  const [search, setSearch] = useState("");
  const [causeFilter, setCauseFilter] = useState<SpoilageCause | "all">("all");
  const [typeFilter, setTypeFilter] = useState<SpoilageItemType | "all">("all");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [recordsRes, kpisRes] = await Promise.all([
        getSpoilageRecordsAction(businessId, {
          search: search.trim() || undefined,
          cause: causeFilter !== "all" ? causeFilter : undefined,
          itemType: typeFilter !== "all" ? typeFilter : undefined,
          timeFilter: timeFilter !== "all" ? timeFilter : undefined,
        }),
        getSpoilageKPIsAction(businessId),
      ]);

      if (recordsRes.success && recordsRes.data) {
        setRecords(recordsRes.data);
      }
      if (kpisRes.success && kpisRes.data) {
        setKpis(kpisRes.data);
      }
    } catch (err: any) {
      toast.error("Error al consultar el registro de mermas", {
        description: err.message || "No se pudo sincronizar la información.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [businessId, search, causeFilter, typeFilter, timeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-CO", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ======================================================== */}
      {/* 1. KPIS SUPERIORES: Total Registros, Valor Total, Mermas Hoy, Valor Hoy */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Registros */}
        <div className="p-4.5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total Registros
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <h4 className="text-xl font-bold text-slate-900 dark:text-white">
              {kpis?.totalRecords || 0}
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">Incidentes reportados</p>
          </div>
        </div>

        {/* KPI 2: Valor Total Mermas ($) */}
        <div className="p-4.5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Valor Total Mermas
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <h4 className="text-xl font-bold text-rose-600 dark:text-rose-400">
              {formatCOP(kpis?.totalCost || 0)}
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">Pérdida acumulada total</p>
          </div>
        </div>

        {/* KPI 3: Mermas Hoy */}
        <div className="p-4.5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Mermas Hoy
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <h4 className="text-xl font-bold text-slate-900 dark:text-white">
              {kpis?.todayRecordsCount || 0}
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">Incidentes del día de hoy</p>
          </div>
        </div>

        {/* KPI 4: Valor Hoy ($) */}
        <div className="p-4.5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Valor Hoy ($)
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <h4 className="text-xl font-bold text-slate-900 dark:text-white">
              {formatCOP(kpis?.todayCost || 0)}
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">Pérdida registrada hoy</p>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. BARRA DE HERRAMIENTAS: FILTROS Y BOTÓN REGISTRAR MERMA */}
      {/* ======================================================== */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3.5 bg-slate-50/70 dark:bg-white/[0.02] p-3 rounded-2xl border border-slate-200/70 dark:border-white/[0.06]">
        {/* Filtros: Campo de Búsqueda y Temporal */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Campo de Búsqueda */}
          <div className="relative flex-1 min-w-[200px] sm:min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar producto, ingrediente o motivo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white placeholder:text-slate-400 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/40 transition-colors"
            />
          </div>

          {/* Filtro Temporal: (Hoy, Última semana, Último mes, Todos) */}
          <div className="flex items-center gap-1 p-1 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs shrink-0 overflow-x-auto">
            <button
              type="button"
              onClick={() => setTimeFilter("today")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all shrink-0 ${
                timeFilter === "today"
                  ? "bg-[#ED500A] text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter("week")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all shrink-0 ${
                timeFilter === "week"
                  ? "bg-[#ED500A] text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Última semana
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter("month")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all shrink-0 ${
                timeFilter === "month"
                  ? "bg-[#ED500A] text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Último mes
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter("all")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all shrink-0 ${
                timeFilter === "all"
                  ? "bg-[#ED500A] text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Todos
            </button>
          </div>

          {/* Filtro por Tipo */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden transition-colors shrink-0"
          >
            <option value="all">Todos los Tipos</option>
            <option value="product">Productos</option>
            <option value="ingredient">Ingredientes</option>
          </select>

          {/* Filtro por Causa */}
          <select
            value={causeFilter}
            onChange={(e) => setCauseFilter(e.target.value as any)}
            className="px-3 py-2 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden transition-colors shrink-0"
          >
            <option value="all">Todas las Causas</option>
            <option value="expired">Vencido</option>
            <option value="damaged">Dañado</option>
            <option value="spilled">Derramado</option>
            <option value="stolen">Robo</option>
            <option value="other">Otro</option>
          </select>

          {/* Botón de Recargar */}
          <button
            type="button"
            onClick={() => loadData()}
            title="Recargar datos"
            className="p-2 rounded-xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-[#ED500A]" : ""}`} />
          </button>
        </div>

        {/* Botón Principal: Registrar Nueva Merma */}
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4.5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Nueva Merma</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* 3. TABLA DE MERMAS REGISTRADAS */}
      {/* ======================================================== */}
      <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin mb-3 text-rose-500" />
            <p className="text-sm font-medium">Consultando registro de mermas y kardex...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-white">
              No hay mermas registradas
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
              {search || timeFilter !== "all" || causeFilter !== "all" || typeFilter !== "all"
                ? "No se encontraron mermas con los filtros aplicados. Prueba modificando los criterios."
                : "Las pérdidas por vencimiento, avería, derrames o hurtos aparecerán aquí y descontarán automáticamente el inventario."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/75 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 font-semibold uppercase text-2xs tracking-wider">
                <tr>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Ítem / Elemento</th>
                  <th className="py-3 px-4">Causa</th>
                  <th className="py-3 px-4 text-right">Cantidad</th>
                  <th className="py-3 px-4 text-right">Costo Unit.</th>
                  <th className="py-3 px-4 text-right">Pérdida Total</th>
                  <th className="py-3 px-4">Descripción / Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {records.map((r) => {
                  const colorConfig =
                    SPOILAGE_CAUSE_COLORS[r.cause] || SPOILAGE_CAUSE_COLORS.other;

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-white/[0.015] transition-colors"
                    >
                      <td className="py-3 px-4 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {formatDate(r.date)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-2xs font-semibold bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300">
                          {r.itemType === "product" ? (
                            <>
                              <Package className="w-3 h-3 text-indigo-500" />
                              <span>Producto</span>
                            </>
                          ) : (
                            <>
                              <Layers className="w-3 h-3 text-amber-500" />
                              <span>Ingrediente</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {r.itemName}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-semibold border ${colorConfig.bg} ${colorConfig.text} ${colorConfig.border}`}
                        >
                          {SPOILAGE_CAUSE_LABELS[r.cause] || r.cause}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-800 dark:text-slate-200">
                        {r.quantity}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500 dark:text-slate-400">
                        {formatCOP(r.unitCost)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        {formatCOP(r.totalCost)}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {r.notes || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Registrar Nueva Merma */}
      <SpoilageFormModal
        businessId={businessId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => loadData()}
        products={products}
      />
    </div>
  );
}
