"use client";

import { Tabs } from "@/components/ui/tabs";
import React, { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import {
  Boxes,
  Package,
  Layers,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Calendar,
  Filter,
  Search,
  RefreshCw,
  FileText,
  FileSpreadsheet,
  Download,
  Building2,
  Clock,
  Coins,
  ArrowUpDown,
  ArrowUpRight,
  ArrowDownRight,
  X,
  ChevronRight,
  ShieldCheck,
  Loader2,
  TrendingDown,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  KpiCard,
  KpiGrid,
  EmptyState,
  Select,
  Input,
  SearchInput,
} from "@/components/ui";
import { ReportNavTabs } from "@/components/reports/report-nav-tabs";
import {
  InventoryReportData,
  InventoryReportFilterParams,
  InventoryStockStatus,
  ReportsDatePreset,
} from "@/lib/reports/types";
import {
  getInventoryReportAction,
  exportInventoryReportPdfAction,
  exportInventoryReportCsvAction,
} from "./actions";

interface InventoryReportClientProps {
  businessId: string;
  businessName: string;
  initialData: InventoryReportData;
}

type InventoryViewTab = "existencias" | "movimientos" | "bajo_stock";

function formatCOP(val: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(val);
}

export function InventoryReportClient({
  businessId,
  businessName,
  initialData,
}: InventoryReportClientProps) {
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<InventoryReportData>(initialData);
  const [activeTab, setActiveTab] = useState<InventoryViewTab>("existencias");

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  // Filtros interactivos
  const [filters, setFilters] = useState<InventoryReportFilterParams>({
    preset: initialData.dateRange.preset || "this_month",
    startDate: initialData.dateRange.startDate || "",
    endDate: initialData.dateRange.endDate || "",
    locationId: "all",
    categoryId: "all",
    status: "all",
    movementType: "all",
    search: "",
  });

  const fetchReport = (newFilters: InventoryReportFilterParams) => {
    startTransition(async () => {
      const res = await getInventoryReportAction(businessId, newFilters);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast.error(res.error || "No se pudo actualizar el reporte de inventario.");
      }
    });
  };

  const handlePresetChange = (preset: ReportsDatePreset) => {
    const updated: InventoryReportFilterParams = {
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

  const handleFilterChange = (key: keyof InventoryReportFilterParams, val: any) => {
    const updated = { ...filters, [key]: val };
    setFilters(updated);
    fetchReport(updated);
  };

  const handleResetFilters = () => {
    const defaultFilters: InventoryReportFilterParams = {
      preset: "this_month",
      locationId: "all",
      categoryId: "all",
      status: "all",
      movementType: "all",
      search: "",
    };
    setFilters(defaultFilters);
    fetchReport(defaultFilters);
  };

  // Exportar PDF
  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const res = await exportInventoryReportPdfAction(businessId, filters, activeTab);
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
        toast.success("Reporte de inventario en PDF generado exitosamente.");
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
      const res = await exportInventoryReportCsvAction(businessId, filters, activeTab);
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
        toast.success("Reporte de inventario en Excel (CSV) descargado exitosamente.");
      } else {
        toast.error(res.error || "No fue posible generar el archivo de Excel.");
      }
    } catch {
      toast.error("Error inesperado al exportar el reporte en Excel.");
    } finally {
      setIsExportingCsv(false);
    }
  };

  // Renderizador de badge de estado de stock
  const renderStockBadge = (status: InventoryStockStatus) => {
    switch (status) {
      case "out_of_stock":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50">
            <AlertOctagon className="w-3 h-3 text-rose-500 animate-pulse" />
            <span>Agotado</span>
          </span>
        );
      case "low":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            <span>Stock Bajo</span>
          </span>
        );
      case "normal":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>Normal</span>
          </span>
        );
    }
  };

  // Renderizador de tipo de movimiento
  const renderMovementTypeBadge = (type: string, label: string) => {
    switch (type) {
      case "entry":
      case "transfer_in":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <ArrowUpRight className="w-3 h-3 text-emerald-600" />
            <span>{label}</span>
          </span>
        );
      case "exit":
      case "transfer_out":
      case "sale":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <ArrowDownRight className="w-3 h-3 text-blue-600" />
            <span>{label}</span>
          </span>
        );
      case "spoilage":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <TrendingDown className="w-3 h-3 text-rose-600" />
            <span>{label}</span>
          </span>
        );
      case "adjustment":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <ArrowUpDown className="w-3 h-3 text-amber-600" />
            <span>{label}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. NAVEGACIÓN ENTRE REPORTES */}
      <ReportNavTabs businessId={businessId} />

      {/* 2. ENCABEZADO CON BOTONES DE ACCIÓN Y EXPORTACIÓN */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#0D0F16] p-5 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              Reporte Integral de Inventario y Existencias
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Control de existencias por ubicación, valorización de inventario, auditoría de movimientos y alertas de stock bajo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={isExportingCsv || isPending}
            className="text-xs font-medium"
          >
            {isExportingCsv ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" />
            )}
            <span>Exportar Excel</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleExportPdf}
            disabled={isExportingPdf || isPending}
            className="text-xs font-medium bg-[#ED500A] hover:bg-[#d04508] text-white"
          >
            {isExportingPdf ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : (
              <FileText className="w-3.5 h-3.5 mr-1.5 text-white" />
            )}
            <span>Exportar PDF</span>
          </Button>
        </div>
      </div>

      {/* 3. TARJETAS RESUMEN DE KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Valor Total Inventario */}
        <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Valor Total Inventario
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
              {formatCOP(data.summary.totalInventoryValue)}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Σ(cantidad × costo unitario)
            </p>
          </div>
        </div>

        {/* KPI 2: Unidades en Stock */}
        <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Unidades en Existencia
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
              {data.summary.totalItemsCount.toLocaleString("es-CO")}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              En {data.summary.totalProductsCount} registros monitoreados
            </p>
          </div>
        </div>

        {/* KPI 3: Productos Bajo Mínimo */}
        <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Stock Bajo (Alerta)
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
              {data.summary.lowStockCount}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Cantidad menor o igual al mínimo
            </p>
          </div>
        </div>

        {/* KPI 4: Productos Sin Stock (Agotados) */}
        <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Sin Stock (Agotados)
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 font-mono">
              {data.summary.outOfStockCount}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Artículos sin existencias (0 o negativo)
            </p>
          </div>
        </div>
      </div>

      {/* 4. BARRA DE FILTROS Y BÚSQUEDA */}
      <div className="bg-white dark:bg-[#0D0F16] p-4 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar producto o SKU..."
              value={filters.search || ""}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] focus:outline-none focus:ring-1 focus:ring-[#ED500A] text-slate-900 dark:text-white"
            />
          </div>

          {/* Filtro Ubicación */}
          <div>
            <Select
              value={filters.locationId || "all"}
              onChange={(e) => handleFilterChange("locationId", e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] focus:outline-none focus:ring-1 focus:ring-[#ED500A] text-slate-900 dark:text-white"
            >
              {data.availableLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Filtro Categoría */}
          <div>
            <Select
              value={filters.categoryId || "all"}
              onChange={(e) => handleFilterChange("categoryId", e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] focus:outline-none focus:ring-1 focus:ring-[#ED500A] text-slate-900 dark:text-white"
            >
              {data.availableCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Filtro Estado (para existencias) */}
          <div>
            <Select
              value={filters.status || "all"}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] focus:outline-none focus:ring-1 focus:ring-[#ED500A] text-slate-900 dark:text-white"
            >
              <option value="all">Todos los estados</option>
              <option value="normal">Normal</option>
              <option value="low">Stock Bajo</option>
              <option value="out_of_stock">Agotado</option>
            </Select>
          </div>

          {/* Botón Reset */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetFilters}
              disabled={isPending}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-600 dark:text-slate-400 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
              <span>Limpiar Filtros</span>
            </button>
          </div>
        </div>

        {/* Selector de Período para Movimientos */}
        {activeTab === "movimientos" && (
          <div className="pt-2 border-t border-slate-100 dark:border-white/[0.04] flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-2">
              Período de movimientos:
            </span>
            {(
              [
                { id: "today", label: "Hoy" },
                { id: "yesterday", label: "Ayer" },
                { id: "last_7_days", label: "Últimos 7 días" },
                { id: "this_month", label: "Este mes" },
                { id: "custom", label: "Personalizado" },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                onClick={() => handlePresetChange(p.id)}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                  filters.preset === p.id
                    ? "bg-[#ED500A] text-white font-semibold"
                    : "bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}

            {/* Selector Tipo de Movimiento */}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-slate-400">Tipo:</span>
              <Select
                value={filters.movementType || "all"}
                onChange={(e) => handleFilterChange("movementType", e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white"
              >
                <option value="all">Todos los movimientos</option>
                <option value="entry">Entradas</option>
                <option value="exit">Salidas</option>
                <option value="adjustment">Ajustes</option>
                <option value="transfer_in">Transferencias (Entrada)</option>
                <option value="transfer_out">Transferencias (Salida)</option>
                <option value="sale">Ventas</option>
                <option value="spoilage">Mermas</option>
              </Select>
            </div>

            {filters.preset === "custom" && (
              <form onSubmit={handleCustomDateSubmit} className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                <input
                  type="date"
                  value={filters.startDate || ""}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.04] text-slate-900 dark:text-white"
                />
                <span className="text-xs text-slate-400">a</span>
                <input
                  type="date"
                  value={filters.endDate || ""}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.04] text-slate-900 dark:text-white"
                />
                <Button type="submit" size="sm" variant="outline" className="text-xs h-7">
                  Filtrar
                </Button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* 5. NAVEGACIÓN DE PESTAÑAS (VISTAS DEL REPORTE) */}
      <Tabs<InventoryViewTab>
        variant="underline"
        tabs={[
          { id: "existencias", label: "Existencias Actuales", icon: <Boxes className="w-4 h-4" />, count: data.stockRows.length },
          { id: "movimientos", label: "Movimientos del Período", icon: <Clock className="w-4 h-4" />, count: data.movementsRows.length },
          { id: "bajo_stock", label: "Productos con Stock Bajo", icon: <AlertTriangle className="w-4 h-4 text-amber-500" />, count: data.lowStockRows.length },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* 6. CONTENIDO DE LAS VISTAS */}
      {/* VISTA 1: EXISTENCIAS ACTUALES */}
      {activeTab === "existencias" && (
        <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs overflow-hidden">
          {data.stockRows.length === 0 ? (
            <div className="p-10 text-center">
              <Boxes className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                No hay existencias registradas con los filtros actuales
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Verifica los filtros seleccionados o realiza una entrada de inventario desde el módulo operativo.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                    <th className="py-3 px-4">Producto</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4">Ubicación</th>
                    <th className="py-3 px-4 text-right">Cantidad</th>
                    <th className="py-3 px-4 text-right">Stock Mínimo</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Costo Unitario</th>
                    <th className="py-3 px-4 text-right">Valor Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] text-xs">
                  {data.stockRows.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-white/[0.04] transition-colors"
                    >
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                        <div className="flex flex-col">
                          <span>{row.productName}</span>
                          {row.productSku && (
                            <span className="text-[10px] font-mono text-slate-400">
                              SKU: {row.productSku}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {row.categoryName}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Warehouse className="w-3 h-3 text-slate-400" />
                          <span>{row.locationName}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {row.quantity}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500 dark:text-slate-400">
                        {row.minStock}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {renderStockBadge(row.status)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                        {formatCOP(row.cost)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-900 dark:text-white">
                        {formatCOP(row.totalValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 dark:border-white/[0.1] bg-slate-50/80 dark:bg-white/[0.03] font-bold text-xs">
                    <td colSpan={3} className="py-3.5 px-4 text-slate-900 dark:text-white">
                      TOTALES ({data.stockRows.length} productos listados)
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-900 dark:text-white">
                      {data.summary.totalItemsCount.toLocaleString("es-CO")}
                    </td>
                    <td colSpan={3} className="py-3.5 px-4 text-right text-slate-500">
                      Valor Total Inventario:
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-extrabold text-[#ED500A]">
                      {formatCOP(data.summary.totalInventoryValue)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VISTA 2: MOVIMIENTOS DEL PERÍODO */}
      {activeTab === "movimientos" && (
        <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs overflow-hidden">
          {data.movementsRows.length === 0 ? (
            <div className="p-10 text-center">
              <Clock className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                No hay movimientos registrados en el período seleccionado
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Ajusta el filtro de fechas o selecciona &quot;Este mes&quot; para consultar el historial de operaciones.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                    <th className="py-3 px-4">Fecha y Hora</th>
                    <th className="py-3 px-4">Producto</th>
                    <th className="py-3 px-4">Ubicación</th>
                    <th className="py-3 px-4">Tipo Movimiento</th>
                    <th className="py-3 px-4 text-right">Cantidad</th>
                    <th className="py-3 px-4 text-right">Costo Unitario</th>
                    <th className="py-3 px-4">Referencia / Motivo</th>
                    <th className="py-3 px-4">Usuario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] text-xs">
                  {data.movementsRows.map((m) => (
                    <tr
                      key={m.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-white/[0.04] transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {m.formattedDate}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                        <div className="flex flex-col">
                          <span>{m.productName}</span>
                          {m.productSku && (
                            <span className="text-[10px] font-mono text-slate-400">
                              SKU: {m.productSku}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {m.locationName}
                      </td>
                      <td className="py-3 px-4">
                        {renderMovementTypeBadge(m.movementType, m.movementTypeLabel)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {m.quantity}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                        {m.unitCost !== null ? formatCOP(m.unitCost) : "-"}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {m.referenceLabel}
                          </span>
                          {m.notes && m.notes !== m.referenceLabel && (
                            <span className="text-[11px] text-slate-400 italic">
                              {m.notes}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {m.createdByName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VISTA 3: PRODUCTOS CON STOCK BAJO */}
      {activeTab === "bajo_stock" && (
        <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs overflow-hidden">
          {data.lowStockRows.length === 0 ? (
            <div className="p-10 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                ¡Inventario en niveles óptimos!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                No hay productos por debajo del stock mínimo ni existencias agotadas en este momento.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                    <th className="py-3 px-4">Producto</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4">Ubicación</th>
                    <th className="py-3 px-4 text-right">Stock Actual</th>
                    <th className="py-3 px-4 text-right">Stock Mínimo</th>
                    <th className="py-3 px-4 text-right">Déficit Requerido</th>
                    <th className="py-3 px-4 text-right">Costo Reposición</th>
                    <th className="py-3 px-4 text-center">Alerta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] text-xs">
                  {data.lowStockRows.map((row) => (
                    <tr
                      key={`${row.productId}-${row.locationId}`}
                      className="hover:bg-slate-50/70 dark:hover:bg-white/[0.04] transition-colors"
                    >
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                        <div className="flex flex-col">
                          <span>{row.productName}</span>
                          {row.productSku && (
                            <span className="text-[10px] font-mono text-slate-400">
                              SKU: {row.productSku}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {row.categoryName}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {row.locationName}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                        {row.quantity}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500 dark:text-slate-400">
                        {row.minStock}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                        +{row.deficit} uds.
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatCOP(row.replenishmentCost)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {renderStockBadge(row.status)}
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
