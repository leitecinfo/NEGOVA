"use client";

import { Tabs } from "@/components/ui/tabs";
import React, { useState, useTransition, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  TrendingDown,
  ShoppingBag,
  Building2,
  Calendar,
  Filter,
  Search,
  RefreshCw,
  FileText,
  FileSpreadsheet,
  Download,
  Coins,
  Receipt,
  PieChart as PieChartIcon,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Truck,
  CreditCard,
  Layers,
  ChevronRight,
  Loader2,
  ArrowUpRight,
  Clock,
  ExternalLink,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { toast } from "sonner";
import {
  Button,
  EmptyState,
  Select,
  Input,
  SearchInput,
} from "@/components/ui";
import { ReportNavTabs } from "@/components/reports/report-nav-tabs";
import {
  ExpensesAndPurchasesReportData,
  ExpensesAndPurchasesFilterParams,
  ReportsDatePreset,
} from "@/lib/reports/types";
import {
  getExpensesAndPurchasesReportAction,
  exportExpensesAndPurchasesPdfAction,
  exportExpensesAndPurchasesCsvAction,
} from "./actions";

interface ExpensesReportClientProps {
  businessId: string;
  businessName: string;
  initialData: ExpensesAndPurchasesReportData;
}

type ActiveViewTab = "gastos" | "compras";

function formatCOP(val: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(val);
}

export function ExpensesReportClient({
  businessId,
  businessName,
  initialData,
}: ExpensesReportClientProps) {
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<ExpensesAndPurchasesReportData>(initialData);
  const [activeTab, setActiveTab] = useState<ActiveViewTab>("gastos");
  const [isMounted, setIsMounted] = useState(false);

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Filtros
  const [filters, setFilters] = useState<ExpensesAndPurchasesFilterParams>({
    preset: initialData.dateRange.preset || "this_month",
    startDate: initialData.dateRange.startDate || "",
    endDate: initialData.dateRange.endDate || "",
    category: "all",
    supplierId: "all",
    status: "all",
    search: "",
  });

  const fetchReport = (newFilters: ExpensesAndPurchasesFilterParams) => {
    startTransition(async () => {
      const res = await getExpensesAndPurchasesReportAction(businessId, newFilters);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast.error(res.error || "No se pudo actualizar el reporte de gastos y compras.");
      }
    });
  };

  const handlePresetChange = (preset: ReportsDatePreset) => {
    const updated: ExpensesAndPurchasesFilterParams = {
      ...filters,
      preset,
    };
    setFilters(updated);
    fetchReport(updated);
  };

  const handleFilterChange = (key: keyof ExpensesAndPurchasesFilterParams, value: any) => {
    const updated: ExpensesAndPurchasesFilterParams = {
      ...filters,
      [key]: value,
    };
    setFilters(updated);
    fetchReport(updated);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReport(filters);
  };

  // Exportar PDF
  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      toast.loading("Generando documento PDF...", { id: "pdf-export" });

      const res = await exportExpensesAndPurchasesPdfAction(businessId, filters, activeTab);
      if (res.success && res.base64 && res.filename) {
        const byteCharacters = atob(res.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = res.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast.success("Reporte PDF descargado con éxito.", { id: "pdf-export" });
      } else {
        toast.error(res.error || "Error al exportar en PDF.", { id: "pdf-export" });
      }
    } catch {
      toast.error("Error inesperado al exportar PDF.", { id: "pdf-export" });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Exportar Excel (CSV)
  const handleExportCsv = async () => {
    try {
      setIsExportingCsv(true);
      toast.loading("Generando archivo Excel (CSV)...", { id: "csv-export" });

      const res = await exportExpensesAndPurchasesCsvAction(businessId, filters, activeTab);
      if (res.success && res.content && res.filename) {
        const blob = new Blob([res.content], { type: "text/csv;charset=utf-8;" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = res.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast.success("Archivo Excel (CSV) exportado con éxito.", { id: "csv-export" });
      } else {
        toast.error(res.error || "Error al exportar en CSV.", { id: "csv-export" });
      }
    } catch {
      toast.error("Error inesperado al exportar CSV.", { id: "csv-export" });
    } finally {
      setIsExportingCsv(false);
    }
  };

  // Preparar datos de torta
  const pieChartData = useMemo(() => {
    return data.expenses.categoryDistribution.map((cat) => ({
      name: cat.category,
      value: cat.amount,
      percentage: cat.percentage,
      count: cat.count,
      color: cat.color,
    }));
  }, [data.expenses.categoryDistribution]);

  return (
    <div className="space-y-6">
      {/* 1. Barra de Navegación de Reportes */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <ReportNavTabs businessId={businessId} />

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={isExportingCsv || isPending}
            className="border-slate-200 dark:border-white/[0.08]"
          >
            {isExportingCsv ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin text-emerald-600" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />
            )}
            Excel
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={isExportingPdf || isPending}
            className="border-slate-200 dark:border-white/[0.08]"
          >
            {isExportingPdf ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin text-[#ED500A]" />
            ) : (
              <FileText className="w-4 h-4 mr-2 text-[#ED500A]" />
            )}
            PDF
          </Button>
        </div>
      </div>

      {/* 2. Pestañas de Vista (Gastos vs Compras) */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/[0.06] pb-2">
        <Tabs<ActiveViewTab>
          tabs={[
            { id: "gastos", label: "Reporte de Gastos Operativos", icon: <TrendingDown className="w-4 h-4" />, count: data.expenses.summary.transactionsCount },
            { id: "compras", label: "Reporte de Compras a Proveedores", icon: <ShoppingBag className="w-4 h-4" />, count: data.purchases.summary.confirmedPurchasesCount },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        {isPending && (
          <div className="flex items-center gap-2 text-xs text-slate-500 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#ED500A]" />
            <span>Actualizando datos...</span>
          </div>
        )}
      </div>

      {/* 3. Barra de Filtros */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/[0.06] shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Presets de fecha */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-medium text-slate-500 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Período:
            </span>
            {(
              [
                { id: "today", label: "Hoy" },
                { id: "yesterday", label: "Ayer" },
                { id: "last_7_days", label: "7 Días" },
                { id: "this_month", label: "Este Mes" },
                { id: "custom", label: "Personalizado" },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePresetChange(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filters.preset === p.id
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                    : "bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Buscador de texto */}
          <form onSubmit={handleSearchSubmit} className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={
                activeTab === "gastos"
                  ? "Buscar gasto o concepto..."
                  : "Buscar compra, factura..."
              }
              value={filters.search || ""}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ED500A]"
            />
          </form>
        </div>

        {/* Filtros desplegables y Rango Custom */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-white/[0.04]">
          {/* Si activo es Gastos: filtro de categoría */}
          {activeTab === "gastos" && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Categoría:</span>
              <Select
                value={filters.category || "all"}
                onChange={(e) => handleFilterChange("category", e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/[0.08] rounded-lg text-xs font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#ED500A]"
              >
                <option value="all">Todas las categorías</option>
                {data.availableCategories
                  .filter((c) => c !== "all")
                  .map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
              </Select>
            </div>
          )}

          {/* Filtro de proveedor (aplica a ambos) */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Proveedor:</span>
            <Select
              value={filters.supplierId || "all"}
              onChange={(e) => handleFilterChange("supplierId", e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/[0.08] rounded-lg text-xs font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#ED500A]"
            >
              {data.availableSuppliers.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Filtro de estado */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Estado:</span>
            <Select
              value={filters.status || "all"}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/[0.08] rounded-lg text-xs font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#ED500A]"
            >
              <option value="all">Todos los estados</option>
              <option value="completed">Completados / Confirmados</option>
              <option value="cancelled">Anulados</option>
            </Select>
          </div>

          {/* Rango de fechas si está en custom */}
          {filters.preset === "custom" && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Desde:</span>
              <input
                type="date"
                value={filters.startDate || ""}
                onChange={(e) => handleFilterChange("startDate", e.target.value)}
                className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/[0.08] rounded-lg text-xs"
              />
              <span className="text-slate-500 font-medium">Hasta:</span>
              <input
                type="date"
                value={filters.endDate || ""}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
                className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/[0.08] rounded-lg text-xs"
              />
            </div>
          )}
        </div>
      </div>

      {/* 4. CONTENIDO PRINCIPAL: GASTOS */}
      {activeTab === "gastos" && (
        <div className="space-y-6">
          {/* Tarjetas KPI de Gastos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-5 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Total Gastos Operativos
                </span>
                <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-[#ED500A] flex items-center justify-center">
                  <TrendingDown className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                  {formatCOP(data.expenses.summary.totalExpenses)}
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {data.expenses.summary.transactionsCount} registros en el período
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-5 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Promedio Diario
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Coins className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                  {formatCOP(data.expenses.summary.dailyAverage)}
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Gasto promedio por día calendario
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-5 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Categoría Principal
                </span>
                <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <PieChartIcon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-lg font-extrabold text-slate-900 dark:text-white truncate">
                  {data.expenses.summary.mainCategory?.category || "N/A"}
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                  {data.expenses.summary.mainCategory
                    ? `${formatCOP(data.expenses.summary.mainCategory.amount)} (${data.expenses.summary.mainCategory.percentage}% del total)`
                    : "Sin gastos en período"}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-5 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Categorías Activas
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                  {data.expenses.categoryDistribution.length}
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Distribución total 100%
                </p>
              </div>
            </div>
          </div>

          {/* Gráficos: Torta y Barras */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Gráfico de Torta: Distribución por Categoría (suma 100%) */}
            <div className="lg:col-span-5 p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/[0.06] shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <PieChartIcon className="w-4 h-4 text-[#ED500A]" />
                    Distribución por Categoría (100%)
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 font-medium">
                    Suma 100%
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Participación porcentual de cada concepto en los egresos del período.
                </p>

                {pieChartData.length > 0 && isMounted ? (
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={78}
                          paddingAngle={3}
                        >
                          {pieChartData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val: any) => [formatCOP(Number(val)), "Monto"]}
                          contentStyle={{
                            backgroundColor: "#0f172a",
                            borderColor: "#334155",
                            borderRadius: "0.5rem",
                            color: "#fff",
                            fontSize: "12px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-56 flex flex-col items-center justify-center text-slate-400 text-xs">
                    <PieChartIcon className="w-8 h-8 mb-2 opacity-40" />
                    No hay gastos registrados en este período.
                  </div>
                )}
              </div>

              {/* Leyenda y Desglose de Categorías */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/[0.04] space-y-1.5 max-h-40 overflow-y-auto no-scrollbar">
                {data.expenses.categoryDistribution.map((cat) => (
                  <div
                    key={cat.category}
                    className="flex items-center justify-between text-xs py-1 px-1.5 rounded hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                        {cat.category}
                      </span>
                      <span className="text-slate-400 text-[10px]">({cat.count} reg)</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {formatCOP(cat.amount)}
                      </span>
                      <span className="text-xs font-bold text-slate-500 w-12 text-right">
                        {cat.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Gráfico de Barras: Gastos por Mes (Últimos 6 meses) */}
            <div className="lg:col-span-7 p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/[0.06] shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#ED500A]" />
                  Gastos Mensuales (Últimos 6 Meses)
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  Comportamiento histórico
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Total de egresos registrados mes a mes para detección de tendencias.
              </p>

              {isMounted ? (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.expenses.last6MonthsMonthly}
                      margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "#64748b" }}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(val: any) => [formatCOP(Number(val)), "Gasto"]}
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderColor: "#334155",
                          borderRadius: "0.5rem",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                      />
                      <Bar
                        dataKey="totalAmount"
                        fill="#ED500A"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={48}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-72 flex items-center justify-center text-slate-400 text-xs">
                  Cargando gráfico...
                </div>
              )}
            </div>
          </div>

          {/* Tabla de Gastos Detallada */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/[0.06] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Listado Detallado de Gastos
                </h3>
                <p className="text-xs text-slate-500">
                  Registros individuales del módulo de egresos en el período seleccionado.
                </p>
              </div>
              <span className="text-xs text-slate-500">
                Mostrando {data.expenses.rows.length} registros
              </span>
            </div>

            {data.expenses.rows.length === 0 ? (
              <EmptyState
                icon={TrendingDown}
                title="No se encontraron gastos"
                description="No hay egresos que coincidan con los filtros y fechas seleccionadas."
              />
            ) : (
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.06] text-slate-500 font-semibold uppercase">
                    <tr>
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Categoría</th>
                      <th className="py-3 px-4">Proveedor</th>
                      <th className="py-3 px-4">Concepto / Descripción</th>
                      <th className="py-3 px-4">Medio de Pago</th>
                      <th className="py-3 px-4 text-right">Monto</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                    {data.expenses.rows.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-400">
                          {row.formattedDate}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {row.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-slate-700 dark:text-slate-300">
                          {row.supplierName}
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-slate-600 dark:text-slate-400">
                          <div className="font-medium text-slate-800 dark:text-slate-200">
                            {row.concept}
                          </div>
                          {row.description && (
                            <div className="text-[11px] text-slate-400 truncate">
                              {row.description}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.04] text-[11px]">
                            <CreditCard className="w-3 h-3 text-slate-400" />
                            {row.paymentMethodLabel}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-right font-bold text-slate-900 dark:text-white">
                          {row.status === "cancelled" ? (
                            <span className="text-red-500 line-through">
                              {formatCOP(row.amount)}
                            </span>
                          ) : (
                            formatCOP(row.amount)
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              row.status === "completed"
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/40"
                                : "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200/40"
                            }`}
                          >
                            {row.statusLabel}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Resumen inferior */}
                  <tfoot className="bg-slate-50/80 dark:bg-white/[0.02] border-t border-slate-200 dark:border-white/[0.08] font-bold">
                    <tr>
                      <td colSpan={5} className="py-3 px-4 text-slate-700 dark:text-slate-300">
                        TOTAL DE GASTOS CONFIRMADOS DEL PERÍODO
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-[#ED500A]">
                        {formatCOP(data.expenses.summary.totalExpenses)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. CONTENIDO PRINCIPAL: COMPRAS */}
      {activeTab === "compras" && (
        <div className="space-y-6">
          {/* Tarjetas KPI de Compras */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-5 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Total Compras Confirmadas
                </span>
                <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-[#ED500A] flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                  {formatCOP(data.purchases.summary.totalPurchases)}
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {data.purchases.summary.confirmedPurchasesCount} órdenes de compra
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-5 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Cuentas por Pagar Pendientes
                </span>
                <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 font-mono">
                  {formatCOP(data.purchases.summary.pendingAccountsPayableAmount)}
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {data.purchases.summary.pendingAccountsPayableCount} facturas pendientes de pago
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-5 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Proveedor Líder
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-lg font-extrabold text-slate-900 dark:text-white truncate">
                  {data.purchases.topSuppliers[0]?.supplierName || "N/A"}
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                  {data.purchases.topSuppliers[0]
                    ? `${formatCOP(data.purchases.topSuppliers[0].totalAmount)} (${data.purchases.topSuppliers[0].percentage}%)`
                    : "Sin compras registradas"}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-5 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Proveedores en Período
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                  {data.purchases.topSuppliers.length}
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Proveedores activos con compras
                </p>
              </div>
            </div>
          </div>

          {/* Top 5 Proveedores Ranking */}
          <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/[0.06] shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#ED500A]" />
                Top 5 Proveedores por Monto de Compras
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                Concentración de compras
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Distribución de volumen comprado por proveedor estratégico.
            </p>

            {data.purchases.topSuppliers.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No hay compras confirmadas en el período seleccionado.
              </div>
            ) : (
              <div className="space-y-3">
                {data.purchases.topSuppliers.map((sup, idx) => (
                  <div key={sup.supplierName + idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 font-bold flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {sup.supplierName}
                        </span>
                        {sup.taxId && (
                          <span className="text-slate-400 text-[10px]">({sup.taxId})</span>
                        )}
                        <span className="text-slate-400 text-[11px]">
                          • {sup.purchasesCount} compra(s)
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {formatCOP(sup.totalAmount)}
                        </span>
                        <span className="text-xs font-semibold text-[#ED500A] w-12 text-right">
                          {sup.percentage}%
                        </span>
                      </div>
                    </div>
                    {/* Barra de progreso */}
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-white/[0.04] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#ED500A] rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, sup.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabla de Compras Detallada con Productos Comprados (Criterio estricto) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/[0.06] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Órdenes de Compra a Proveedores
                </h3>
                <p className="text-xs text-slate-500">
                  Detalle de documentos de adquisición, productos e insumos vinculados.
                </p>
              </div>
              <span className="text-xs text-slate-500">
                Mostrando {data.purchases.rows.length} compras
              </span>
            </div>

            {data.purchases.rows.length === 0 ? (
              <EmptyState
                icon={ShoppingBag}
                title="No se encontraron compras"
                description="No hay compras registradas para las fechas y filtros indicados."
              />
            ) : (
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.06] text-slate-500 font-semibold uppercase">
                    <tr>
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4"># Documento</th>
                      <th className="py-3 px-4">Proveedor</th>
                      <th className="py-3 px-4">Productos e Insumos Detallados</th>
                      <th className="py-3 px-4 text-right">Subtotal</th>
                      <th className="py-3 px-4 text-right">Impuestos</th>
                      <th className="py-3 px-4 text-right">Total</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                    {data.purchases.rows.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-400">
                          {row.formattedDate}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {row.purchaseNumber}
                          </div>
                          {row.invoiceNumber && (
                            <div className="text-[10px] text-slate-400">
                              Fac: {row.invoiceNumber}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">
                          {row.supplierName}
                        </td>
                        {/* Detalle de productos (Criterio de aceptación 4) */}
                        <td className="py-3 px-4 max-w-md">
                          {row.items.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {row.items.map((it) => (
                                <span
                                  key={it.id}
                                  className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.04] text-[11px] text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-white/[0.06]"
                                >
                                  <span className="font-medium">{it.productName}</span>
                                  <span className="ml-1 text-slate-500 font-bold">
                                    x{it.quantity}
                                  </span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">
                              {row.itemsSummary}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-right text-slate-600 dark:text-slate-400">
                          {formatCOP(row.subtotal)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-right text-slate-600 dark:text-slate-400">
                          {formatCOP(row.taxAmount)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-right font-bold text-slate-900 dark:text-white">
                          {row.status === "cancelled" ? (
                            <span className="text-red-500 line-through">
                              {formatCOP(row.total)}
                            </span>
                          ) : (
                            formatCOP(row.total)
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              row.status === "confirmed"
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/40"
                                : "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200/40"
                            }`}
                          >
                            {row.statusLabel}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Resumen inferior de compras */}
                  <tfoot className="bg-slate-50/80 dark:bg-white/[0.02] border-t border-slate-200 dark:border-white/[0.08] font-bold">
                    <tr>
                      <td colSpan={6} className="py-3 px-4 text-slate-700 dark:text-slate-300">
                        TOTAL DE COMPRAS CONFIRMADAS DEL PERÍODO
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-[#ED500A]">
                        {formatCOP(data.purchases.summary.totalPurchases)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
