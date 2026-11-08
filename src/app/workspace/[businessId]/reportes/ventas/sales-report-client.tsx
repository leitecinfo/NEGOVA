"use client";

import React, { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  Search,
  RefreshCw,
  ArrowLeft,
  ChevronRight,
  CreditCard,
  Banknote,
  Smartphone,
  Store,
  Armchair,
  Bike,
  QrCode,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Receipt,
  User,
  Users,
  Layers,
  X,
  HelpCircle,
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
import {
  SalesReportData,
  SalesReportFilterParams,
  ReportsDatePreset,
  SalesChannelType,
} from "@/lib/reports/types";
import { ReportNavTabs } from "@/components/reports/report-nav-tabs";
import {
  getSalesReportAction,
  exportSalesReportPdfAction,
  exportSalesReportCsvAction,
} from "./actions";

interface SalesReportClientProps {
  businessId: string;
  businessName: string;
  initialData: SalesReportData;
}

function formatCOP(val: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(val);
}

export function SalesReportClient({
  businessId,
  businessName,
  initialData,
}: SalesReportClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [data, setData] = useState<SalesReportData>(initialData);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  // Filtros interactivos
  const [filters, setFilters] = useState<SalesReportFilterParams>({
    preset: initialData.dateRange.preset || "this_month",
    startDate: initialData.dateRange.startDate || "",
    endDate: initialData.dateRange.endDate || "",
    channel: "all",
    paymentMethod: "all",
    employeeId: "all",
    status: "all",
    search: "",
  });

  // Manejo de refresco con nuevos filtros
  const fetchReport = (newFilters: SalesReportFilterParams) => {
    startTransition(async () => {
      const res = await getSalesReportAction(businessId, newFilters);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast.error(res.error || "No se pudo actualizar el reporte de ventas.");
      }
    });
  };

  const handlePresetChange = (preset: ReportsDatePreset) => {
    const updated: SalesReportFilterParams = {
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

  const handleFilterChange = (key: keyof SalesReportFilterParams, val: any) => {
    const updated = { ...filters, [key]: val };
    setFilters(updated);
    fetchReport(updated);
  };

  const handleResetFilters = () => {
    const defaultFilters: SalesReportFilterParams = {
      preset: "this_month",
      channel: "all",
      paymentMethod: "all",
      employeeId: "all",
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
      const res = await exportSalesReportPdfAction(businessId, filters);
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
        toast.success("Reporte PDF generado exitosamente.");
      } else {
        toast.error(res.error || "No fue posible generar el archivo PDF.");
      }
    } catch {
      toast.error("Error inesperado al exportar el reporte en PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Exportar Excel (CSV con BOM)
  const handleExportCsv = async () => {
    setIsExportingCsv(true);
    try {
      const res = await exportSalesReportCsvAction(businessId, filters);
      if (res.success && res.content && res.filename) {
        const blob = new Blob([res.content], { type: res.contentType || "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Archivo Excel (CSV) exportado sin truncar.");
      } else {
        toast.error(res.error || "No se pudo generar el archivo CSV.");
      }
    } catch {
      toast.error("Error inesperado al exportar el archivo CSV.");
    } finally {
      setIsExportingCsv(false);
    }
  };

  // Badge visual para canales
  const renderChannelBadge = (channel: SalesChannelType) => {
    switch (channel) {
      case "mesa":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            <Armchair className="w-3 h-3" />
            <span>Mesas</span>
          </span>
        );
      case "domicilio":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">
            <Bike className="w-3 h-3" />
            <span>Domicilio</span>
          </span>
        );
      case "digital_menu":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20">
            <QrCode className="w-3 h-3" />
            <span>Menú QR</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
            <Store className="w-3 h-3" />
            <span>Mostrador</span>
          </span>
        );
    }
  };

  // Badge de Estado
  const renderStatusBadge = (row: typeof data.rows[0]) => {
    if (row.status === "cancelled") {
      return (
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3 text-rose-500" />
            <span>Anulada</span>
          </span>
          {row.cancellationReason && (
            <p className="text-[11px] font-medium text-rose-600 dark:text-rose-300 max-w-xs break-words">
              <strong>Motivo:</strong> {row.cancellationReason}
            </p>
          )}
        </div>
      );
    }

    if (row.status === "pending") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
          <span>Pendiente</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
        <span>Completada</span>
      </span>
    );
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.channel !== "all") count++;
    if (filters.paymentMethod !== "all") count++;
    if (filters.employeeId !== "all") count++;
    if (filters.status !== "all") count++;
    if (filters.search?.trim()) count++;
    return count;
  }, [filters]);

  return (
    <div className="space-y-6 font-body">
      {/* Selector de Pestañas de Reportes */}
      <ReportNavTabs businessId={businessId} />

      {/* 1. Header con Navegación y Botones de Exportación */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs">
        <div className="space-y-1">
          <Link
            href={`/workspace/${businessId}/dashboard`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#ED500A] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver al Dashboard</span>
          </Link>
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#ED500A]" />
            <span>Reporte Detallado de Ventas</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Transacciones, canales, impuestos y auditoría de anulaciones en {businessName}.
          </p>
        </div>

        {/* Botonera de Exportación */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isExportingCsv || isPending || data.rows.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            title="Descargar archivo compatible con Microsoft Excel (CSV)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{isExportingCsv ? "Generando Excel..." : "Exportar Excel"}</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExportingPdf || isPending || data.rows.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/5 hover:bg-slate-200/80 dark:hover:bg-white/10 border border-slate-200 dark:border-white/[0.08] transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            title="Descargar documento formal en PDF con membrete institucional"
          >
            <FileText className="w-4 h-4 text-[#ED500A]" />
            <span>{isExportingPdf ? "Generando PDF..." : "Exportar PDF"}</span>
          </button>

          <button
            type="button"
            onClick={() => fetchReport(filters)}
            disabled={isPending}
            className="p-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            title="Refrescar reporte"
          >
            <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin text-[#ED500A]" : ""}`} />
          </button>
        </div>
      </div>

      {/* 2. Barra de Filtros Multidimensionales */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-4">
        {/* Selector de Presets de Fecha */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-white/5 pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#ED500A]" />
              <span>Período:</span>
            </span>

            {[
              { id: "today", label: "Hoy" },
              { id: "yesterday", label: "Ayer" },
              { id: "last_7_days", label: "Últimos 7 días" },
              { id: "this_month", label: "Este mes" },
              { id: "custom", label: "Personalizado" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePresetChange(p.id as ReportsDatePreset)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  filters.preset === p.id
                    ? "bg-[#ED500A] text-white shadow-xs"
                    : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-white/10"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpiar filtros ({activeFiltersCount})</span>
            </button>
          )}
        </div>

        {/* Formulario Rango Personalizado si aplica */}
        {filters.preset === "custom" && (
          <form
            onSubmit={handleCustomDateSubmit}
            className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5"
          >
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Desde:
              </label>
              <Input
                type="date"
                required
                value={filters.startDate || ""}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                inputSize="sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Hasta:
              </label>
              <Input
                type="date"
                required
                value={filters.endDate || ""}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                inputSize="sm"
              />
            </div>

            <Button type="submit" variant="primary" size="sm" disabled={isPending}>
              Aplicar Rango
            </Button>
          </form>
        )}

        {/* Filtros de Canal, Método, Estado, Empleado y Búsqueda */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          {/* Canal */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
              Canal de Venta
            </label>
            <Select
              value={filters.channel || "all"}
              onChange={(e) => handleFilterChange("channel", e.target.value)}
            >
              <option value="all">Todos los canales</option>
              <option value="mostrador">Mostrador (POS)</option>
              <option value="mesa">Salón / Mesas</option>
              <option value="domicilio">Domicilios</option>
              <option value="digital_menu">Menú QR</option>
            </Select>
          </div>

          {/* Método de Pago */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
              Método de Pago
            </label>
            <Select
              value={filters.paymentMethod || "all"}
              onChange={(e) => handleFilterChange("paymentMethod", e.target.value)}
            >
              <option value="all">Todos los métodos</option>
              <option value="cash">Efectivo</option>
              <option value="card">Tarjeta</option>
              <option value="transfer">Transferencia</option>
              <option value="credit">A Crédito</option>
              <option value="split">Pago Mixto</option>
            </Select>
          </div>

          {/* Estado */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
              Estado de la Venta
            </label>
            <Select
              value={filters.status || "all"}
              onChange={(e) => handleFilterChange("status", e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="completed">Completadas / Pagadas</option>
              <option value="cancelled">Anuladas / Canceladas</option>
            </Select>
          </div>

          {/* Empleado */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
              Empleado / Cajero
            </label>
            <Select
              value={filters.employeeId || "all"}
              onChange={(e) => handleFilterChange("employeeId", e.target.value)}
            >
              <option value="all">Todos los colaboradores</option>
              {data.employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Búsqueda */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
              Búsqueda Rápida
            </label>
            <SearchInput
              value={filters.search || ""}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              onClear={() => handleFilterChange("search", "")}
              placeholder="Buscar..."
            />
          </div>
        </div>
      </div>

      {/* 3. Tabla de Ventas */}
      <div className="rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs overflow-hidden">
        {data.rows.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Receipt}
              title="No se encontraron ventas con estos filtros"
              description="Intenta ampliar el rango de fechas, seleccionar otro canal o restablecer los filtros."
              actionLabel={activeFiltersCount > 0 ? "Restablecer Filtros" : undefined}
              onAction={activeFiltersCount > 0 ? handleResetFilters : undefined}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/80 dark:bg-white/[0.02] text-slate-600 dark:text-slate-400 uppercase text-[10px] font-black tracking-wider">
                  <th className="py-3 px-4">Fecha y Hora</th>
                  <th className="py-3 px-4"># Documento</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Canal</th>
                  <th className="py-3 px-4">Método de Pago</th>
                  <th className="py-3 px-4">Empleado / Cajero</th>
                  <th className="py-3 px-4 text-right">Subtotal</th>
                  <th className="py-3 px-4 text-right">Impuestos</th>
                  <th className="py-3 px-4 text-right">Descuento</th>
                  <th className="py-3 px-4 text-right">Total Neto</th>
                  <th className="py-3 px-4">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {data.rows.map((row) => {
                  const isCancelled = row.status === "cancelled";

                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors ${
                        isCancelled ? "bg-rose-500/[0.02]" : ""
                      }`}
                    >
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap font-medium">
                        {row.formattedDate}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {row.documentNumber}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-medium max-w-xs truncate">
                        {row.customerName}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {renderChannelBadge(row.channel)}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-slate-700 dark:text-slate-300 font-medium">
                        {row.paymentMethodLabel}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {row.employeeName}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                        {formatCOP(row.subtotal)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-slate-500">
                        {row.taxTotal > 0 ? formatCOP(row.taxTotal) : "$0"}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-rose-600 dark:text-rose-400">
                        {row.discountTotal > 0 ? `-${formatCOP(row.discountTotal)}` : "$0"}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-black text-sm text-slate-900 dark:text-white">
                        <span className={isCancelled ? "line-through text-rose-500 opacity-80" : ""}>
                          {formatCOP(row.total)}
                        </span>
                      </td>

                      <td className="py-3 px-4 min-w-[130px]">
                        {renderStatusBadge(row)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Resumen Inferior Consolidado (Totales Exactos de las Filas Visibles) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-[#ED500A]" />
            <span>Resumen de Totales ({data.summary.transactionCount} {data.summary.transactionCount === 1 ? "venta" : "ventas"} visibles)</span>
          </span>
          <span className="text-[11px] text-slate-400">
            Los totales corresponden estrictamente a las transacciones listadas
          </span>
        </div>

        <KpiGrid cols={5}>
          <KpiCard
            title="Total Bruto (Subtotal)"
            value={formatCOP(data.summary.totalGross)}
            subtext="Suma de subtotales"
            icon={<Layers className="w-4 h-4" />}
            variant="blue"
          />

          <KpiCard
            title="Total Impuestos (IVA)"
            value={formatCOP(data.summary.totalTax)}
            subtext="Tributos consolidados"
            icon={<HelpCircle className="w-4 h-4" />}
            variant="purple"
          />

          <KpiCard
            title="Total Descuentos"
            value={formatCOP(data.summary.totalDiscount)}
            subtext="Beneficios y descuentos"
            icon={<XCircle className="w-4 h-4" />}
            variant="amber"
          />

          <KpiCard
            title="Total Neto Cobrado"
            value={formatCOP(data.summary.totalNet)}
            subtext="Facturación neta del período"
            icon={<CheckCircle2 className="w-4 h-4" />}
            variant="emerald"
          />

          <KpiCard
            title="Transacciones"
            value={data.summary.transactionCount}
            subtext={`${data.rows.filter(r => r.status === "completed").length} completadas / ${data.rows.filter(r => r.status === "cancelled").length} anuladas`}
            icon={<Receipt className="w-4 h-4" />}
            variant="blue"
          />
        </KpiGrid>
      </div>
    </div>
  );
}
