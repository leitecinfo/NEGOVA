"use client";

import { Tabs } from "@/components/ui/tabs";
import { Input, Select, SearchInput } from "@/components/ui";
import React, { useState, useTransition } from "react";
import {
  Bike,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Calendar,
  Filter,
  Search,
  RotateCcw,
  Star,
  Users,
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
  FileText,
  Loader2,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  getDeliveryReportAction,
  exportDeliveryReportPdfAction,
  exportDeliveryReportCsvAction,
} from "./actions";
import type {
  DeliveryReportData,
  DeliveryReportFilterParams,
  ReportsDatePreset,
} from "@/lib/reports/types";
import { EmptyState } from "@/components/ui/empty-state";

interface Props {
  businessId: string;
  initialData: DeliveryReportData;
}

function formatCOP(val: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(val);
}

export function DeliveryReportClient({ businessId, initialData }: Props) {
  const [data, setData] = useState<DeliveryReportData>(initialData);
  const [activeTab, setActiveTab] = useState<"drivers" | "zones" | "orders">("drivers");

  const [filters, setFilters] = useState<DeliveryReportFilterParams>({
    preset: initialData.filterParams.preset || "this_month",
    startDate: initialData.dateRange.startDate,
    endDate: initialData.dateRange.endDate,
    driverName: "all",
    zoneId: "all",
    status: "all",
    search: "",
  });

  const [isPending, startTransition] = useTransition();
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  const fetchReport = (newFilters: DeliveryReportFilterParams) => {
    startTransition(async () => {
      const res = await getDeliveryReportAction(businessId, newFilters);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast.error(res.error || "No se pudo actualizar el reporte de domicilios.");
      }
    });
  };

  const handlePresetChange = (preset: ReportsDatePreset) => {
    const updated: DeliveryReportFilterParams = {
      ...filters,
      preset,
      startDate: preset === "custom" ? filters.startDate : undefined,
      endDate: preset === "custom" ? filters.endDate : undefined,
    };
    setFilters(updated);
    if (preset !== "custom") {
      fetchReport(updated);
    }
  };

  const handleCustomDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!filters.startDate || !filters.endDate) {
      toast.warning("Por favor selecciona ambas fechas para el rango personalizado.");
      return;
    }
    if (filters.startDate > filters.endDate) {
      toast.error("La fecha inicial no puede ser posterior a la fecha final.");
      return;
    }
    fetchReport(filters);
  };

  const handleFilterChange = (key: keyof DeliveryReportFilterParams, val: any) => {
    const updated = { ...filters, [key]: val };
    setFilters(updated);
    fetchReport(updated);
  };

  const handleResetFilters = () => {
    const defaultFilters: DeliveryReportFilterParams = {
      preset: "this_month",
      driverName: "all",
      zoneId: "all",
      status: "all",
      search: "",
    };
    setFilters(defaultFilters);
    fetchReport(defaultFilters);
  };

  // Exportar PDF
  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const res = await exportDeliveryReportPdfAction(businessId, filters);
      if (res.success && res.base64 && res.filename) {
        const byteCharacters = atob(res.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Reporte de domicilios en PDF generado exitosamente.");
      } else {
        toast.error(res.error || "No fue posible generar el archivo PDF.");
      }
    } catch {
      toast.error("Error inesperado al exportar el reporte en PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Exportar Excel (CSV con BOM UTF-8)
  const handleExportCsv = async () => {
    setIsExportingCsv(true);
    try {
      const res = await exportDeliveryReportCsvAction(businessId, filters);
      if (res.success && res.content && res.filename) {
        const blob = new Blob([res.content], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Reporte de domicilios en Excel (CSV) generado exitosamente.");
      } else {
        toast.error(res.error || "No fue posible generar el archivo CSV.");
      }
    } catch {
      toast.error("Error inesperado al exportar el reporte en CSV.");
    } finally {
      setIsExportingCsv(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER PRINCIPAL Y ACCIONES DE EXPORTACIÓN */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200/80 dark:border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Reporte de Domicilios y Despachos
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20">
              REP-007
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Análisis de entregas, tiempos de despacho, ranking por repartidor y pedidos por zona geográfica en {data.businessName}.
          </p>
        </div>

        {/* BOTONES DE EXPORTACIÓN */}
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap justify-end">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isExportingCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-2xs disabled:opacity-50"
            title="Descargar reporte en formato Excel (CSV)"
          >
            {isExportingCsv ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            )}
            <span>Exportar Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
            title="Descargar reporte formal en PDF"
          >
            {isExportingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <FileText className="w-4 h-4 text-white" />
            )}
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      {/* 5 KPIS / INDICADORES CLAVE */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* KPI 1: Total Entregas */}
        <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Entregas</span>
            <div className="p-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <Bike className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {data.summary.totalDeliveries}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="text-emerald-500 font-semibold">{data.summary.successfulDeliveries} exitosas</span>
            <span>•</span>
            <span className="text-slate-500 font-medium">{data.summary.successRate}% éxito</span>
          </div>
        </div>

        {/* KPI 2: Tiempo Promedio */}
        <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Tiempo Promedio</span>
            <div className="p-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {data.summary.averageDeliveryTimeMinutes} <span className="text-sm font-normal text-slate-400">min</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Aceptación → Entrega física
          </div>
        </div>

        {/* KPI 3: Facturación Domicilios */}
        <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Ventas Domicilio</span>
            <div className="p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">
            {formatCOP(data.summary.totalRevenue)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 truncate">
            Tarifas: {formatCOP(data.summary.totalTariffs)}
          </div>
        </div>

        {/* KPI 4: Repartidor Líder */}
        <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Repartidor Líder</span>
            <div className="p-1.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
            {data.summary.topDriver ? data.summary.topDriver.driverName : "Sin entregas"}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {data.summary.topDriver ? `${data.summary.topDriver.completedCount} entregas completadas` : "Ningún despacho"}
          </div>
        </div>

        {/* KPI 5: Zona Líder */}
        <div className="col-span-2 lg:col-span-1 p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Zona Principal</span>
            <div className="p-1.5 bg-[#ED500A]/10 text-[#ED500A] rounded-xl">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
            {data.summary.topZone ? data.summary.topZone.zoneName : "Sin zona"}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {data.summary.topZone ? `${data.summary.topZone.ordersCount} pedidos recibidos` : "Sin pedidos"}
          </div>
        </div>
      </div>

      {/* BARRA DE PRESETS & FILTROS */}
      <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] p-4 rounded-2xl space-y-3.5">
        {/* Presets de Fecha */}
        <div className="flex items-center justify-between flex-wrap gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {[
              { id: "today", label: "Hoy" },
              { id: "yesterday", label: "Ayer" },
              { id: "last_7_days", label: "Últimos 7 Días" },
              { id: "this_month", label: "Este Mes" },
              { id: "custom", label: "Personalizado" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePresetChange(p.id as ReportsDatePreset)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                  filters.preset === p.id
                    ? "bg-[#ED500A] text-white shadow-xs"
                    : "bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-white/[0.08]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer</span>
          </button>
        </div>

        {/* Rango Personalizado de Fechas (Si aplica) */}
        {filters.preset === "custom" && (
          <form
            onSubmit={handleCustomDateSubmit}
            className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04] flex-wrap text-xs"
          >
            <span className="font-semibold text-slate-600 dark:text-slate-400">Rango:</span>
            <input
              type="date"
              value={filters.startDate || ""}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] text-slate-800 dark:text-white"
            />
            <span className="text-slate-400">hasta</span>
            <input
              type="date"
              value={filters.endDate || ""}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] text-slate-800 dark:text-white"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-[#ED500A] text-white rounded-lg font-semibold hover:bg-[#ED500A]/90 transition-colors"
            >
              Aplicar
            </button>
          </form>
        )}

        {/* Filtros Secundarios: Repartidor, Zona, Estado y Buscador */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
          {/* Selector de Repartidor */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Repartidor
            </label>
            <Select
              value={filters.driverName || "all"}
              onChange={(e) => handleFilterChange("driverName", e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50/50 dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 rounded-xl text-xs focus:outline-hidden transition-colors"
            >
              <option value="all">Todos los Repartidores</option>
              {data.availableDrivers
                .filter((d) => d !== "all")
                .map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
            </Select>
          </div>

          {/* Selector de Zona */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Zona de Reparto
            </label>
            <Select
              value={filters.zoneId || "all"}
              onChange={(e) => handleFilterChange("zoneId", e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50/50 dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 rounded-xl text-xs focus:outline-hidden transition-colors"
            >
              {data.availableZones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Selector de Estado */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Estado de Entrega
            </label>
            <Select
              value={filters.status || "all"}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50/50 dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 rounded-xl text-xs focus:outline-hidden transition-colors"
            >
              <option value="all">Todos los Estados</option>
              <option value="delivered">Exitosos (Entregados)</option>
              <option value="delivering">En Camino</option>
              <option value="cancelled">Cancelados</option>
              <option value="rejected">Rechazados / Fallidos</option>
            </Select>
          </div>

          {/* Buscador */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Búsqueda Rápida
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cliente, teléfono, dirección..."
                value={filters.search || ""}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50/50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] text-slate-900 dark:text-white placeholder:text-slate-400 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/50 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* PESTAÑAS DE TABLAS: POR REPARTIDOR | POR ZONA | REGISTRO DE PEDIDOS */}
      <Tabs<"drivers" | "zones" | "orders">
        tabs={[
          { id: "drivers", label: "Ranking por Repartidor", icon: <Users className="w-4 h-4" />, count: data.drivers.length },
          { id: "zones", label: "Análisis por Zonas", icon: <MapPin className="w-4 h-4" />, count: data.zones.length },
          { id: "orders", label: "Registro de Pedidos", icon: <Bike className="w-4 h-4" />, count: data.orders.length },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* TABLA 1: RANKING POR REPARTIDOR */}
      {activeTab === "drivers" && (
        <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-2xs">
          {data.drivers.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="Sin entregas de repartidores"
                description="No se registraron entregas asignadas a repartidores en este rango de fechas."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/75 dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Puesto</th>
                    <th className="py-3 px-4">Repartidor</th>
                    <th className="py-3 px-4 text-center">Entregas Completadas</th>
                    <th className="py-3 px-4 text-center">Asignadas</th>
                    <th className="py-3 px-4 text-center">Tasa Cumplimiento</th>
                    <th className="py-3 px-4 text-center">Tiempo Promedio</th>
                    <th className="py-3 px-4 text-center">Calificación</th>
                    <th className="py-3 px-4 text-right">Tarifas Recaudadas</th>
                    <th className="py-3 px-4 text-right">Total Facturado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {data.drivers.map((d, idx) => (
                    <tr
                      key={d.driverName}
                      className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        <span
                          className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-[10px] ${
                            idx === 0
                              ? "bg-amber-500 text-white font-extrabold shadow-2xs"
                              : idx === 1
                              ? "bg-slate-300 dark:bg-slate-600 text-slate-900 dark:text-white font-bold"
                              : idx === 2
                              ? "bg-amber-700/60 text-white font-bold"
                              : "text-slate-500 font-medium"
                          }`}
                        >
                          #{idx + 1}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        <div>{d.driverName}</div>
                        {d.driverPhone && (
                          <div className="text-[11px] text-slate-400 font-normal">
                            {d.driverPhone}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {d.completedDeliveries}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center font-medium text-slate-700 dark:text-slate-300">
                        {d.totalAssigned}
                      </td>

                      <td className="py-3.5 px-4 text-center font-semibold text-slate-800 dark:text-slate-200">
                        {d.completionRate}%
                      </td>

                      <td className="py-3.5 px-4 text-center font-semibold text-slate-800 dark:text-slate-200 font-mono">
                        {d.averageDeliveryTimeMinutes} min
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-amber-500 font-bold">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          {d.averageRating.toFixed(1)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                        {formatCOP(d.totalTariffsCollected)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white">
                        {formatCOP(d.totalAmountCollected)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TABLA 2: ANÁLISIS POR ZONAS */}
      {activeTab === "zones" && (
        <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-2xs">
          {data.zones.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="Sin registros de zonas"
                description="No hay pedidos asignados a zonas de cobertura en el período seleccionado."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/75 dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Zona de Entrega</th>
                    <th className="py-3 px-4 text-right">Tarifa Configurada</th>
                    <th className="py-3 px-4 text-center">Total Pedidos</th>
                    <th className="py-3 px-4 text-center">Entregados</th>
                    <th className="py-3 px-4 text-center">Tiempo Promedio</th>
                    <th className="py-3 px-4 text-right">Monto Total Facturado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {data.zones.map((z) => (
                    <tr
                      key={z.zoneId}
                      className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: z.color || "#ED500A" }}
                          />
                          <span>{z.zoneName}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                        {formatCOP(z.tariff)}
                      </td>

                      <td className="py-3.5 px-4 text-center font-bold text-slate-900 dark:text-white">
                        {z.totalOrders}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          {z.completedOrders}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono font-medium text-slate-700 dark:text-slate-300">
                        {z.averageDeliveryTimeMinutes} min
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white">
                        {formatCOP(z.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TABLA 3: REGISTRO DETALLADO DE PEDIDOS */}
      {activeTab === "orders" && (
        <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-2xs">
          {data.orders.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No se encontraron pedidos"
                description="No hay pedidos que coincidan con los filtros seleccionados."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/75 dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Pedido</th>
                    <th className="py-3 px-4">Fecha y Hora</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Dirección</th>
                    <th className="py-3 px-4">Zona</th>
                    <th className="py-3 px-4">Repartidor</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-center">Tiempo</th>
                    <th className="py-3 px-4 text-right">Tarifa</th>
                    <th className="py-3 px-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {data.orders.map((o) => (
                    <tr
                      key={o.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-[#ED500A]">
                        #{o.orderNumber}
                      </td>

                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {o.formattedCreatedAt}
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        <div>{o.customerName}</div>
                        {o.customerPhone && (
                          <div className="text-[10px] text-slate-400 font-normal">
                            {o.customerPhone}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 max-w-xs truncate text-slate-600 dark:text-slate-300">
                        {o.deliveryAddress}
                      </td>

                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                        {o.zoneName}
                      </td>

                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                        {o.driverName}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            o.status === "delivered"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : o.status === "delivering"
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                              : o.status === "cancelled"
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                              : o.status === "rejected"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              : "bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {o.statusLabel}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center font-mono text-slate-600 dark:text-slate-300">
                        {o.deliveryDurationMinutes > 0 ? `${o.deliveryDurationMinutes} min` : "-"}
                      </td>

                      <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">
                        {formatCOP(o.deliveryFee)}
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                        {formatCOP(o.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

