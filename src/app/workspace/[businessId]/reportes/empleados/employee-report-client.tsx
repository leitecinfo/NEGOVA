"use client";

import React, { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  Award,
  Crown,
  Medal,
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
  Receipt,
  TrendingUp,
  X,
  Layers,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  Loader2,
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
  EmployeeReportData,
  EmployeeReportFilterParams,
  ReportsDatePreset,
} from "@/lib/reports/types";
import {
  getEmployeeReportAction,
  exportEmployeeReportPdfAction,
  exportEmployeeReportCsvAction,
} from "./actions";

interface EmployeeReportClientProps {
  businessId: string;
  businessName: string;
  initialData: EmployeeReportData;
}

function formatCOP(val: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(val);
}

export function EmployeeReportClient({
  businessId,
  businessName,
  initialData,
}: EmployeeReportClientProps) {
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<EmployeeReportData>(initialData);

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  // Filtros interactivos
  const [filters, setFilters] = useState<EmployeeReportFilterParams>({
    preset: initialData.dateRange.preset || "this_month",
    startDate: initialData.dateRange.startDate || "",
    endDate: initialData.dateRange.endDate || "",
    locationId: "all",
    roleCode: "all",
    search: "",
  });

  const fetchReport = (newFilters: EmployeeReportFilterParams) => {
    startTransition(async () => {
      const res = await getEmployeeReportAction(businessId, newFilters);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast.error(res.error || "No se pudo actualizar el reporte de empleados.");
      }
    });
  };

  const handlePresetChange = (preset: ReportsDatePreset) => {
    const updated: EmployeeReportFilterParams = {
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

  const handleFilterChange = (key: keyof EmployeeReportFilterParams, val: any) => {
    const updated = { ...filters, [key]: val };
    setFilters(updated);
    fetchReport(updated);
  };

  const handleResetFilters = () => {
    const defaultFilters: EmployeeReportFilterParams = {
      preset: "this_month",
      locationId: "all",
      roleCode: "all",
      search: "",
    };
    setFilters(defaultFilters);
    fetchReport(defaultFilters);
  };

  // Exportar PDF
  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const res = await exportEmployeeReportPdfAction(businessId, filters);
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
        toast.success("Reporte de empleados en PDF generado exitosamente.");
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
      const res = await exportEmployeeReportCsvAction(businessId, filters);
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
        toast.success("Reporte de empleados en Excel (CSV) descargado exitosamente.");
      } else {
        toast.error(res.error || "No fue posible generar el archivo de Excel.");
      }
    } catch {
      toast.error("Error inesperado al exportar el reporte en Excel.");
    } finally {
      setIsExportingCsv(false);
    }
  };

  // Top 3 Colaboradores para el Podio
  const topPodium = useMemo(() => {
    return data.employees.slice(0, 3);
  }, [data.employees]);

  return (
    <div className="space-y-6">
      {/* 1. Barra de Pestañas de Reportes y Acciones Superiores */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2">
        <ReportNavTabs businessId={businessId} />

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => fetchReport(filters)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm transition-all disabled:opacity-50"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin text-[#ED500A]" : ""}`} />
            <span>Actualizar</span>
          </button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCsv}
            disabled={isExportingCsv || data.employees.length === 0}
            leftIcon={
              isExportingCsv ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              )
            }
          >
            {isExportingCsv ? "Generando..." : "Exportar Excel"}
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleExportPdf}
            disabled={isExportingPdf || data.employees.length === 0}
            leftIcon={
              isExportingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Download className="w-4 h-4" />
              )
            }
          >
            {isExportingPdf ? "Generando..." : "Exportar PDF"}
          </Button>
        </div>
      </div>

      {/* 2. Filtros y Selector de Período */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.06] shadow-sm space-y-4">
        {/* Selector de Presets de Fecha */}
        <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-100 dark:border-white/[0.04]">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mr-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            Período:
          </span>

          {[
            { id: "today", label: "Hoy" },
            { id: "yesterday", label: "Ayer" },
            { id: "last_7_days", label: "Últimos 7 días" },
            { id: "this_month", label: "Este mes" },
            { id: "custom", label: "Personalizado" },
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetChange(preset.id as ReportsDatePreset)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filters.preset === preset.id
                  ? "bg-[#ED500A] text-white shadow-sm font-semibold"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/60"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Rango Personalizado si está activo */}
        {filters.preset === "custom" && (
          <form
            onSubmit={handleCustomDateSubmit}
            className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-orange-500/5 border border-orange-500/20"
          >
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Desde:</label>
              <input
                type="date"
                value={filters.startDate || ""}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Hasta:</label>
              <input
                type="date"
                value={filters.endDate || ""}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#ED500A] text-white hover:bg-[#d04508] shadow-sm transition-all"
            >
              Aplicar Rango
            </button>
          </form>
        )}

        {/* Filtros Multidimensionales: Ubicación, Rol y Búsqueda */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Ubicación */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Ubicación / Sede
            </label>
            <div className="relative">
              <Building2 className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <Select
                value={filters.locationId || "all"}
                onChange={(e) => handleFilterChange("locationId", e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#ED500A]"
              >
                {data.availableLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Rol */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Rol del Colaborador
            </label>
            <div className="relative">
              <ShieldCheck className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <Select
                value={filters.roleCode || "all"}
                onChange={(e) => handleFilterChange("roleCode", e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#ED500A]"
              >
                {data.availableRoles.map((role) => (
                  <option key={role.code} value={role.code}>
                    {role.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Búsqueda por Nombre / Correo */}
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Buscar Colaborador
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Nombre o correo del colaborador..."
                  value={filters.search || ""}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && fetchReport(filters)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]"
                />
              </div>

              {(filters.locationId !== "all" || filters.roleCode !== "all" || filters.search) && (
                <button
                  onClick={handleResetFilters}
                  className="p-2 text-slate-500 hover:text-red-500 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shrink-0"
                  title="Limpiar filtros"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Podio de Rendimiento (Top 3 en Ventas) */}
      {topPodium.length > 0 && topPodium.some((p) => p.totalSalesAmount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1er Lugar - ORO */}
          {topPodium[0] && (
            <div className="relative p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 dark:border-amber-500/20 shadow-sm flex flex-col justify-between overflow-hidden">
              <div className="absolute -right-3 -top-3 w-20 h-20 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                    #1 Top Vendedor
                  </span>
                  <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    {topPodium[0].salesPercentage}% del equipo
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                  {topPodium[0].name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 truncate">
                  {topPodium[0].roleName} {topPodium[0].email ? `• ${topPodium[0].email}` : ""}
                </p>
              </div>

              <div className="pt-3 border-t border-amber-500/20 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 font-medium">Total Vendido</span>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {formatCOP(topPodium[0].totalSalesAmount)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-medium">Ticket Promedio</span>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {formatCOP(topPodium[0].averageTicketAmount)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2do Lugar - PLATA */}
          {topPodium[1] && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-500/10 via-slate-500/5 to-transparent border border-slate-300/60 dark:border-white/10 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-400/30">
                    <Medal className="w-3.5 h-3.5 text-slate-400" />
                    #2 Segundo Lugar
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {topPodium[1].salesPercentage}% del equipo
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                  {topPodium[1].name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 truncate">
                  {topPodium[1].roleName} {topPodium[1].email ? `• ${topPodium[1].email}` : ""}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-white/[0.06] grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 font-medium">Total Vendido</span>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {formatCOP(topPodium[1].totalSalesAmount)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-medium">Ticket Promedio</span>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {formatCOP(topPodium[1].averageTicketAmount)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3er Lugar - BRONCE */}
          {topPodium[2] && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-orange-600/10 via-orange-600/5 to-transparent border border-orange-500/20 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-600/15 text-orange-800 dark:text-orange-300 border border-orange-600/20">
                    <Award className="w-3.5 h-3.5 text-orange-600" />
                    #3 Tercer Lugar
                  </span>
                  <span className="text-[11px] font-semibold text-orange-600/80">
                    {topPodium[2].salesPercentage}% del equipo
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                  {topPodium[2].name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 truncate">
                  {topPodium[2].roleName} {topPodium[2].email ? `• ${topPodium[2].email}` : ""}
                </p>
              </div>

              <div className="pt-3 border-t border-orange-500/15 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 font-medium">Total Vendido</span>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {formatCOP(topPodium[2].totalSalesAmount)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-medium">Ticket Promedio</span>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {formatCOP(topPodium[2].averageTicketAmount)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Tarjetas de Resumen Consolidado del Equipo */}
      <KpiGrid cols={4}>
        <KpiCard
          title="Total Ventas del Equipo"
          value={formatCOP(data.summary.totalTeamSalesAmount)}
          subtext={`${data.summary.totalTeamSalesCount} comprobantes emitidos`}
          icon={<Receipt className="w-4 h-4 text-emerald-500" />}
        />

        <KpiCard
          title="Ticket Promedio"
          value={formatCOP(data.summary.averageTeamTicketAmount)}
          subtext="Promedio por venta realizada"
          icon={<TrendingUp className="w-4 h-4 text-blue-500" />}
        />

        <KpiCard
          title="Turnos y Horas Laboradas"
          value={`${data.summary.totalShiftsWorked} turnos`}
          subtext={`${data.summary.totalHoursWorked} horas registradas en caja`}
          icon={<Clock className="w-4 h-4 text-indigo-500" />}
        />

        <KpiCard
          title="Propinas Recaudadas"
          value={formatCOP(data.summary.totalTipsAmount)}
          subtext={`${data.summary.activeEmployeesCount} empleados activos`}
          icon={<Coins className="w-4 h-4 text-amber-500" />}
        />
      </KpiGrid>

      {/* 5. Tabla Principal de Rendimiento por Empleado */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.06] shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-[#ED500A]" />
              Ranking de Ventas y Rendimiento
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Métricas consolidadas de facturación, turnos de caja y propinas por colaborador.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/[0.06] shrink-0 self-start sm:self-auto">
            {data.employees.length} colaboradores listados
          </span>
        </div>

        {data.employees.length === 0 ? (
          <div className="p-12">
            <EmptyState
              title="No se encontraron colaboradores"
              description="No hay colaboradores activos o registros que coincidan con los filtros seleccionados."
              actionLabel="Restablecer filtros"
              onAction={handleResetFilters}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/[0.06] bg-slate-50/75 dark:bg-slate-800/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 text-center w-12">#</th>
                  <th className="py-3 px-4">Colaborador</th>
                  <th className="py-3 px-4">Rol</th>
                  <th className="py-3 px-4 text-right">Ventas</th>
                  <th className="py-3 px-4 text-right">Total Vendido</th>
                  <th className="py-3 px-4 text-right">Ticket Prom.</th>
                  <th className="py-3 px-4 text-center">Turnos</th>
                  <th className="py-3 px-4 text-right">Horas</th>
                  <th className="py-3 px-4 text-right">Propinas</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] text-xs">
                {data.employees.map((emp) => (
                  <tr
                    key={emp.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    {/* Ranking */}
                    <td className="py-3.5 px-4 text-center">
                      {emp.rank === 1 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs border border-amber-500/30">
                          1
                        </span>
                      ) : emp.rank === 2 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-300">
                          2
                        </span>
                      ) : emp.rank === 3 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-200 dark:bg-orange-950 text-orange-800 dark:text-orange-300 font-bold text-xs border border-orange-300">
                          3
                        </span>
                      ) : (
                        <span className="text-slate-400 font-semibold">{emp.rank}</span>
                      )}
                    </td>

                    {/* Colaborador */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shrink-0">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-white truncate">
                            {emp.name}
                          </div>
                          {emp.email && (
                            <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                              {emp.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Rol */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/60 dark:border-white/[0.06]">
                        {emp.roleName}
                      </span>
                    </td>

                    {/* Ventas (Cantidad) */}
                    <td className="py-3.5 px-4 text-right font-medium text-slate-900 dark:text-white">
                      {emp.salesCount}
                    </td>

                    {/* Total Vendido y Barra de Participación */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {formatCOP(emp.totalSalesAmount)}
                      </div>
                      <div className="flex items-center justify-end gap-1.5 mt-1">
                        <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-[#ED500A] rounded-full"
                            style={{ width: `${Math.min(100, emp.salesPercentage)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {emp.salesPercentage}%
                        </span>
                      </div>
                    </td>

                    {/* Ticket Promedio */}
                    <td className="py-3.5 px-4 text-right text-slate-700 dark:text-slate-300 font-medium">
                      {formatCOP(emp.averageTicketAmount)}
                    </td>

                    {/* Turnos */}
                    <td className="py-3.5 px-4 text-center text-slate-700 dark:text-slate-300">
                      {emp.shiftsCount}
                    </td>

                    {/* Horas */}
                    <td className="py-3.5 px-4 text-right text-slate-700 dark:text-slate-300">
                      {emp.totalHoursWorked} h
                    </td>

                    {/* Propinas */}
                    <td className="py-3.5 px-4 text-right font-medium">
                      {emp.totalTipsAmount > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          {formatCOP(emp.totalTipsAmount)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Estado */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <UserCheck className="w-3 h-3" />
                        Activo
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Fila de Totales */}
              <tfoot>
                <tr className="border-t-2 border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-slate-800/80 font-bold text-xs text-slate-900 dark:text-white">
                  <td className="py-4 px-4 text-center text-slate-400">Σ</td>
                  <td className="py-4 px-4" colSpan={2}>
                    TOTALES DEL EQUIPO ({data.summary.activeEmployeesCount} activos)
                  </td>
                  <td className="py-4 px-4 text-right text-slate-900 dark:text-white">
                    {data.summary.totalTeamSalesCount}
                  </td>
                  <td className="py-4 px-4 text-right text-[#ED500A]">
                    {formatCOP(data.summary.totalTeamSalesAmount)}
                  </td>
                  <td className="py-4 px-4 text-right text-slate-700 dark:text-slate-300">
                    {formatCOP(data.summary.averageTeamTicketAmount)}
                  </td>
                  <td className="py-4 px-4 text-center text-slate-700 dark:text-slate-300">
                    {data.summary.totalShiftsWorked}
                  </td>
                  <td className="py-4 px-4 text-right text-slate-700 dark:text-slate-300">
                    {data.summary.totalHoursWorked} h
                  </td>
                  <td className="py-4 px-4 text-right text-emerald-600 dark:text-emerald-400">
                    {formatCOP(data.summary.totalTipsAmount)}
                  </td>
                  <td className="py-4 px-4 text-center text-slate-400">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

