"use client";

import React, { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import {
  ChefHat,
  UtensilsCrossed,
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
  Clock,
  Coins,
  ArrowUpDown,
  ArrowUpRight,
  ArrowDownRight,
  X,
  ChevronRight,
  ShieldAlert,
  Loader2,
  TrendingDown,
  Percent,
  Flame,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  KpiCard,
  KpiGrid,
  EmptyState,
} from "@/components/ui";
import { ReportNavTabs } from "@/components/reports/report-nav-tabs";
import {
  RecipeReportData,
  RecipeReportFilterParams,
  RecipeMarginStatus,
  ReportsDatePreset,
} from "@/lib/reports/types";
import {
  getRecipeReportAction,
  exportRecipeReportPdfAction,
  exportRecipeReportCsvAction,
} from "./actions";

interface RecipeReportClientProps {
  businessId: string;
  businessName: string;
  initialData: RecipeReportData;
}

type RecipeViewTab = "costos" | "ingredientes";

function formatCurrency(val: number, currency: string = "COP"): string {
  if (currency === "COP") {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val);
  }
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 2,
  }).format(val);
}

export function RecipeReportClient({
  businessId,
  businessName,
  initialData,
}: RecipeReportClientProps) {
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<RecipeReportData>(initialData);
  const [activeTab, setActiveTab] = useState<RecipeViewTab>("costos");

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  // Filtros interactivos
  const [filters, setFilters] = useState<RecipeReportFilterParams>({
    preset: initialData.filterParams.preset || "this_month",
    startDate: initialData.filterParams.startDate || "",
    endDate: initialData.filterParams.endDate || "",
    categoryId: "all",
    marginFilter: "all",
    search: "",
  });

  const currency = data.currency || "COP";

  const fetchReport = (newFilters: RecipeReportFilterParams) => {
    startTransition(async () => {
      const res = await getRecipeReportAction(businessId, newFilters);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast.error(res.error || "No se pudo actualizar el reporte de recetas y costos.");
      }
    });
  };

  const handleFilterChange = (key: keyof RecipeReportFilterParams, value: any) => {
    const updated = { ...filters, [key]: value };
    setFilters(updated);
    fetchReport(updated);
  };

  const handlePresetChange = (preset: ReportsDatePreset) => {
    const updated: RecipeReportFilterParams = {
      ...filters,
      preset,
    };
    if (preset !== "custom") {
      updated.startDate = undefined;
      updated.endDate = undefined;
    }
    setFilters(updated);
    fetchReport(updated);
  };

  const handleCustomDateApply = () => {
    if (!filters.startDate || !filters.endDate) {
      toast.error("Por favor selecciona fecha de inicio y fecha de fin.");
      return;
    }
    if (filters.startDate > filters.endDate) {
      toast.error("La fecha de inicio no puede ser posterior a la fecha de fin.");
      return;
    }
    fetchReport(filters);
  };

  // Exportar a PDF
  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const res = await exportRecipeReportPdfAction(businessId, filters, activeTab === "costos" ? "costos" : "ingredientes");
      if (res.success && res.base64 && res.filename) {
        const link = document.createElement("a");
        link.href = `data:application/pdf;base64,${res.base64}`;
        link.download = res.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Documento PDF generado y descargado correctamente.");
      } else {
        toast.error(res.error || "No se pudo generar el reporte en PDF.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al exportar a PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Exportar a Excel (CSV con UTF-8 BOM)
  const handleExportCsv = async () => {
    setIsExportingCsv(true);
    try {
      const res = await exportRecipeReportCsvAction(businessId, filters, activeTab === "costos" ? "costos" : "ingredientes");
      if (res.success && res.content && res.filename) {
        const blob = new Blob([res.content], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = res.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("Archivo Excel (CSV) exportado con éxito.");
      } else {
        toast.error(res.error || "No se pudo exportar la hoja de cálculo.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al exportar a Excel.");
    } finally {
      setIsExportingCsv(false);
    }
  };

  // Filtrado local por término de búsqueda
  const filteredProductCosts = useMemo(() => {
    if (!filters.search?.trim()) return data.productCosts;
    const q = filters.search.trim().toLowerCase();
    return data.productCosts.filter(
      (p) =>
        p.productName.toLowerCase().includes(q) ||
        p.recipeName.toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q)
    );
  }, [data.productCosts, filters.search]);

  const filteredIngredientConsumptions = useMemo(() => {
    if (!filters.search?.trim()) return data.ingredientConsumptions;
    const q = filters.search.trim().toLowerCase();
    return data.ingredientConsumptions.filter((i) =>
      i.ingredientName.toLowerCase().includes(q)
    );
  }, [data.ingredientConsumptions, filters.search]);

  // Ingredientes en riesgo crítico o alerta
  const highRiskIngredients = useMemo(() => {
    return data.depletionRanking.filter(
      (ing) =>
        ing.depletionAlert === "depleted" ||
        ing.depletionAlert === "critical" ||
        ing.depletionAlert === "warning"
    );
  }, [data.depletionRanking]);

  return (
    <div className="space-y-6">
      {/* 1. Navegación entre Módulos de Reportes */}
      <ReportNavTabs businessId={businessId} />

      {/* 2. Barra de Control: Filtros y Acciones de Exportación */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Presets de Fecha */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "today", label: "Hoy" },
              { id: "yesterday", label: "Ayer" },
              { id: "last_7_days", label: "7 Días" },
              { id: "last_30_days", label: "30 Días" },
              { id: "this_month", label: "Este Mes" },
              { id: "custom", label: "Personalizado" },
            ].map((p) => {
              const active = filters.preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePresetChange(p.id as ReportsDatePreset)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    active
                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Botones de Exportación */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPdf}
              disabled={isExportingPdf || isPending}
              className="gap-2 text-xs border-slate-300 dark:border-slate-700"
            >
              {isExportingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ED500A]" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-red-500" />
              )}
              <span>Descargar PDF</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={isExportingCsv || isPending}
              className="gap-2 text-xs border-slate-300 dark:border-slate-700"
            >
              {isExportingCsv ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ED500A]" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>Exportar Excel</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchReport(filters)}
              disabled={isPending}
              className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white"
              title="Actualizar datos"
            >
              <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin text-[#ED500A]" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Rango de Fecha Personalizado */}
        {filters.preset === "custom" && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Desde:</span>
              <input
                type="date"
                value={filters.startDate || ""}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Hasta:</span>
              <input
                type="date"
                value={filters.endDate || ""}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCustomDateApply}
              disabled={isPending}
              className="text-xs h-8"
            >
              Aplicar Rango
            </Button>
          </div>
        )}

        {/* Filtros de Categoría, Margen y Búsqueda */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          {/* Categoría */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Categoría de Producto</label>
            <select
              value={filters.categoryId || "all"}
              onChange={(e) => handleFilterChange("categoryId", e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="all">Todas las categorías</option>
              {data.categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro de Margen */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Filtro de Margen Bruto</label>
            <select
              value={filters.marginFilter || "all"}
              onChange={(e) => handleFilterChange("marginFilter", e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="all">Todos los márgenes</option>
              <option value="low_margin">Alerta: Margen &lt; 30%</option>
              <option value="negative_margin">Crítico: Margen Negativo (&lt; 0%)</option>
              <option value="healthy_margin">Saludable: Margen &ge; 30%</option>
            </select>
          </div>

          {/* Buscador de Texto */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Buscar por Nombre</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder={activeTab === "costos" ? "Buscar producto o receta..." : "Buscar ingrediente..."}
                value={filters.search || ""}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
              {filters.search && (
                <button
                  type="button"
                  onClick={() => setFilters({ ...filters, search: "" })}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Tarjetas Resumen de KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Recetas */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recetas Activas</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {data.summary.totalRecipes}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {data.productCosts.length} productos analizados
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            <ChefHat className="w-5 h-5" />
          </div>
        </div>

        {/* Margen Bruto Promedio */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Margen Bruto Promedio</p>
            <h3 className={`text-2xl font-bold mt-1 ${
              data.summary.averageGrossMarginPercentage >= 30
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-600 dark:text-amber-400"
            }`}>
              {data.summary.averageGrossMarginPercentage.toFixed(1)}%
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {data.summary.averageGrossMarginPercentage >= 30 ? "Promedio saludable" : "Rendimiento por debajo de meta"}
            </p>
          </div>
          <div className={`p-2.5 rounded-xl ${
            data.summary.averageGrossMarginPercentage >= 30
              ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
          }`}>
            <Percent className="w-5 h-5" />
          </div>
        </div>

        {/* Alertas de Margen Crítico (< 30% y Negativo) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Márgenes en Alerta</p>
            <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
              {data.summary.productsWithCriticalMarginCount}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {data.summary.productsWithNegativeMarginCount > 0 ? (
                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                  {data.summary.productsWithNegativeMarginCount} con pérdida (&lt;0%)
                </span>
              ) : (
                "Margen inferior al 30%"
              )}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Costo Total Consumido */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Costo Consumo Período</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {formatCurrency(data.summary.totalIngredientCostConsumed, currency)}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {data.summary.ingredientsAtDepletionRiskCount > 0 ? (
                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                  {data.summary.ingredientsAtDepletionRiskCount} ingredientes en riesgo
                </span>
              ) : (
                "Inventario de recetas en orden"
              )}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
            <Coins className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 4. Selector de Pestañas de la Vista */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <button
          type="button"
          onClick={() => setActiveTab("costos")}
          className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 ${
            activeTab === "costos"
              ? "text-[#ED500A]"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <UtensilsCrossed className="w-4 h-4" />
          <span>Costos por Producto (Escandallos)</span>
          <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-normal">
            {filteredProductCosts.length}
          </span>
          {activeTab === "costos" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ED500A]" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ingredientes")}
          className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 ${
            activeTab === "ingredientes"
              ? "text-[#ED500A]"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Consumo de Ingredientes</span>
          <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-normal">
            {filteredIngredientConsumptions.length}
          </span>
          {highRiskIngredients.length > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
              {highRiskIngredients.length} alertas
            </span>
          )}
          {activeTab === "ingredientes" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ED500A]" />
          )}
        </button>
      </div>

      {/* 5. Contenido de la Vista Seleccionada */}
      {activeTab === "costos" ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          {/* Subheader */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                Escandallos y Rentabilidad por Producto
              </h4>
              <p className="text-xs text-slate-500">
                Ordenado por margen ascendente para identificar los platos y productos menos rentables.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-rose-600 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> &lt;0% Pérdida
              </span>
              <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> &lt;30% Alerta
              </span>
              <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> &ge;30% Saludable
              </span>
            </div>
          </div>

          {/* Tabla de Costos */}
          {filteredProductCosts.length === 0 ? (
            <div className="p-12">
              <EmptyState
                icon={ChefHat}
                title="No se encontraron recetas ni costos"
                description={
                  filters.search || filters.categoryId !== "all" || filters.marginFilter !== "all"
                    ? "No hay productos que coincidan con los filtros aplicados. Intenta restablecer los filtros."
                    : "No hay recetas activas registradas en este negocio. Crea una receta con sus ingredientes para calcular el escandallo y rentabilidad."
                }
                actionLabel="Ir a Gestión de Recetas"
                actionHref={`/workspace/${businessId}/recetas`}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Producto</th>
                    <th className="py-3 px-3">Categoría</th>
                    <th className="py-3 px-3 text-right">Porciones</th>
                    <th className="py-3 px-3 text-right">Costo Receta</th>
                    <th className="py-3 px-3 text-right">Precio Venta</th>
                    <th className="py-3 px-3 text-right">Margen ($)</th>
                    <th className="py-3 px-3 text-right">Margen (%)</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredProductCosts.map((item) => {
                    const isCritical = item.marginStatus === "critical";
                    const isWarning = item.marginStatus === "warning";

                    return (
                      <tr
                        key={item.productId}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                          isCritical
                            ? "bg-rose-50/40 dark:bg-rose-950/20"
                            : isWarning
                            ? "bg-amber-50/40 dark:bg-amber-950/20"
                            : ""
                        }`}
                      >
                        {/* Producto */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {item.productName}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span>Receta: {item.recipeName}</span>
                            <span>•</span>
                            <span>{item.ingredientsCount} ingredientes</span>
                          </div>
                        </td>

                        {/* Categoría */}
                        <td className="py-3.5 px-3 text-slate-600 dark:text-slate-400">
                          {item.categoryName}
                        </td>

                        {/* Porciones */}
                        <td className="py-3.5 px-3 text-right font-medium text-slate-700 dark:text-slate-300">
                          {item.portions}
                        </td>

                        {/* Costo Receta */}
                        <td className="py-3.5 px-3 text-right font-medium text-slate-900 dark:text-white">
                          {formatCurrency(item.recipeCost, currency)}
                        </td>

                        {/* Precio Venta */}
                        <td className="py-3.5 px-3 text-right font-medium text-slate-900 dark:text-white">
                          {formatCurrency(item.salePrice, currency)}
                        </td>

                        {/* Margen ($) */}
                        <td
                          className={`py-3.5 px-3 text-right font-bold ${
                            item.grossMarginAmount < 0
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {formatCurrency(item.grossMarginAmount, currency)}
                        </td>

                        {/* Margen (%) */}
                        <td className="py-3.5 px-3 text-right">
                          <span
                            className={`inline-flex items-center gap-1 font-bold text-sm ${
                              isCritical
                                ? "text-rose-600 dark:text-rose-400"
                                : isWarning
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {item.grossMarginPercentage < 0 ? (
                              <ArrowDownRight className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            )}
                            {item.grossMarginPercentage.toFixed(1)}%
                          </span>
                        </td>

                        {/* Estado */}
                        <td className="py-3.5 px-4 text-center">
                          {isCritical ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                              <AlertOctagon className="w-3 h-3" />
                              Pérdida (&lt;0%)
                            </span>
                          ) : isWarning ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                              <AlertTriangle className="w-3 h-3" />
                              Alerta (&lt;30%)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                              <CheckCircle2 className="w-3 h-3" />
                              Saludable
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Alerta de Ranking de Agotamiento de Ingredientes */}
          {highRiskIngredients.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    Ingredientes que se agotarán primero (Ritmo actual de ventas)
                  </h4>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    Según el consumo proyectado a partir de las comandas y ventas del período analizado:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
                    {highRiskIngredients.slice(0, 6).map((ing) => (
                      <div
                        key={ing.ingredientId}
                        className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-200/80 dark:border-amber-900/40 text-xs flex items-center justify-between"
                      >
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {ing.ingredientName}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Stock: {ing.currentStock} {ing.unit} • Quema: {ing.dailyBurnRate} {ing.unit}/día
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-xs ${
                            ing.depletionAlert === "depleted"
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                              : ing.depletionAlert === "critical"
                              ? "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          }`}
                        >
                          {ing.daysUntilDepleted !== null ? `${ing.daysUntilDepleted} días` : "Agotado"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tabla de Consumo de Ingredientes */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                Consumo y Ritmo Diario de Insumos
              </h4>
              <p className="text-xs text-slate-500">
                Consumo real calculado multiplicando unidades vendidas por la formulación de cada receta.
              </p>
            </div>

            {filteredIngredientConsumptions.length === 0 ? (
              <div className="p-12">
                <EmptyState
                  icon={Package}
                  title="No se registran consumos de ingredientes"
                  description="No se identificaron ingredientes consumidos en el período seleccionado."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Ingrediente</th>
                      <th className="py-3 px-3 text-right">Stock Actual</th>
                      <th className="py-3 px-3">Unidad</th>
                      <th className="py-3 px-3 text-right">Costo Unitario</th>
                      <th className="py-3 px-3 text-right">Consumo Período</th>
                      <th className="py-3 px-3 text-right">Costo Consumido</th>
                      <th className="py-3 px-3 text-right">Ritmo Diario</th>
                      <th className="py-3 px-3 text-right">Días Restantes</th>
                      <th className="py-3 px-4 text-center">Alerta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredIngredientConsumptions.map((ing) => {
                      const isDepleted = ing.depletionAlert === "depleted";
                      const isCritical = ing.depletionAlert === "critical";
                      const isWarning = ing.depletionAlert === "warning";

                      return (
                        <tr
                          key={ing.ingredientId}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                            isDepleted || isCritical
                              ? "bg-rose-50/30 dark:bg-rose-950/20"
                              : isWarning
                              ? "bg-amber-50/30 dark:bg-amber-950/20"
                              : ""
                          }`}
                        >
                          {/* Ingrediente */}
                          <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                            {ing.ingredientName}
                          </td>

                          {/* Stock Actual */}
                          <td className="py-3.5 px-3 text-right font-medium text-slate-900 dark:text-white">
                            {ing.currentStock.toLocaleString("es-CO")}
                          </td>

                          {/* Unidad */}
                          <td className="py-3.5 px-3 text-slate-500">
                            {ing.unit}
                          </td>

                          {/* Costo Unitario */}
                          <td className="py-3.5 px-3 text-right text-slate-600 dark:text-slate-400">
                            {formatCurrency(ing.costPerUnit, currency)}
                          </td>

                          {/* Consumo Período */}
                          <td className="py-3.5 px-3 text-right font-semibold text-slate-900 dark:text-white">
                            {ing.periodConsumption.toFixed(2)} {ing.unit}
                          </td>

                          {/* Costo Consumido */}
                          <td className="py-3.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                            {formatCurrency(ing.totalCostConsumed, currency)}
                          </td>

                          {/* Ritmo Diario */}
                          <td className="py-3.5 px-3 text-right text-slate-600 dark:text-slate-400">
                            {ing.dailyBurnRate.toFixed(2)} /día
                          </td>

                          {/* Días Restantes */}
                          <td className="py-3.5 px-3 text-right font-bold">
                            {ing.daysUntilDepleted !== null ? (
                              <span
                                className={
                                  ing.daysUntilDepleted <= 3
                                    ? "text-rose-600 dark:text-rose-400"
                                    : ing.daysUntilDepleted <= 7
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-slate-700 dark:text-slate-300"
                                }
                              >
                                {ing.daysUntilDepleted} días
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>

                          {/* Alerta */}
                          <td className="py-3.5 px-4 text-center">
                            {isDepleted ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                                Agotado (0 stock)
                              </span>
                            ) : isCritical ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                                Crítico (≤ 3 días)
                              </span>
                            ) : isWarning ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                                Alerta (≤ 7 días)
                              </span>
                            ) : ing.depletionAlert === "no_consumption" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                Sin consumo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                                Estable
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
