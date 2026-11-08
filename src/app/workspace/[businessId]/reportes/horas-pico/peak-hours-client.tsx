"use client";

import { Input, Select, SearchInput } from "@/components/ui";
import React, { useState, useTransition } from "react";
import {
  Flame,
  Clock,
  Calendar,
  Filter,
  DollarSign,
  TrendingUp,
  Receipt,
  RotateCcw,
  Sparkles,
  Award,
  Layers,
  Info,
  CalendarRange,
} from "lucide-react";
import { toast } from "sonner";
import { ReportNavTabs } from "@/components/reports/report-nav-tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { getPeakHoursReportAction } from "./actions";
import type {
  PeakHoursReportData,
  PeakHoursFilterParams,
  PeakHoursMetricMode,
  HeatmapCell,
  SalesChannelType,
} from "@/lib/reports/types";

interface Props {
  businessId: string;
  initialData: PeakHoursReportData;
}

const PRESET_OPTIONS = [
  { value: "last_7_days", label: "Últimos 7 días" },
  { value: "last_30_days", label: "Últimos 30 días" },
  { value: "this_month", label: "Este mes" },
  { value: "last_90_days", label: "Últimos 90 días" },
  { value: "custom", label: "Personalizado" },
];

const CHANNEL_OPTIONS: Array<{ value: SalesChannelType | "all"; label: string }> = [
  { value: "all", label: "Todos los Canales" },
  { value: "mostrador", label: "Mostrador / Caja" },
  { value: "mesa", label: "Mesas / Salón" },
  { value: "domicilio", label: "Domicilios" },
  { value: "digital_menu", label: "Menú Digital QR" },
];

export function PeakHoursClient({ businessId, initialData }: Props) {
  const [data, setData] = useState<PeakHoursReportData>(initialData);
  const [metricMode, setMetricMode] = useState<PeakHoursMetricMode>("transactions");

  // Filtros
  const [preset, setPreset] = useState<string>(initialData.filterParams.preset || "last_30_days");
  const [channel, setChannel] = useState<string>(initialData.filterParams.channel || "all");
  const [startDate, setStartDate] = useState<string>(initialData.filterParams.startDate || "");
  const [endDate, setEndDate] = useState<string>(initialData.filterParams.endDate || "");

  const [activeCell, setActiveCell] = useState<HeatmapCell | null>(null);
  const [isPending, startTransition] = useTransition();

  const formatCOP = (amount: number): string => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatCompactCOP = (amount: number): string => {
    if (amount >= 1_000_000) {
      return `$${(amount / 1_000_000).toFixed(1)}M`;
    }
    if (amount >= 1_000) {
      return `$${Math.round(amount / 1_000)}k`;
    }
    return `$${amount}`;
  };

  const handleApplyFilters = (newPreset?: string, newChannel?: string) => {
    const targetPreset = (newPreset !== undefined ? newPreset : preset) as any;
    const targetChannel = (newChannel !== undefined ? newChannel : channel) as any;

    startTransition(async () => {
      try {
        const filters: PeakHoursFilterParams = {
          preset: targetPreset,
          channel: targetChannel,
          startDate: targetPreset === "custom" ? startDate : undefined,
          endDate: targetPreset === "custom" ? endDate : undefined,
        };

        const res = await getPeakHoursReportAction(businessId, filters);
        if (res.success && res.data) {
          setData(res.data);
          toast.success("Horas pico actualizadas", {
            description: `Filtrado por: ${targetPreset === "custom" ? `${startDate} a ${endDate}` : targetPreset}`,
          });
        } else {
          toast.error("Error al actualizar reporte", {
            description: res.error || "No se pudieron obtener los datos de horas pico.",
          });
        }
      } catch (err: any) {
        toast.error("Error inesperado", {
          description: err.message,
        });
      }
    });
  };

  const handlePresetChange = (p: string) => {
    setPreset(p);
    if (p !== "custom") {
      handleApplyFilters(p, undefined);
    }
  };

  const handleChannelChange = (c: string) => {
    setChannel(c);
    handleApplyFilters(undefined, c);
  };

  const globalSummary = data.globalSummary;
  const hoursList = data.heatmapMatrix[0]?.map((c) => ({ hour: c.hour, label: c.hourLabel })) || [];

  return (
    <div className="space-y-6">
      {/* Navegación de Reportes */}
      <ReportNavTabs businessId={businessId} />

      {/* BARRA DE HERRAMIENTAS Y FILTROS */}
      <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* Presets de Fecha */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Período:
            </span>
            {PRESET_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handlePresetChange(opt.value)}
                disabled={isPending}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  preset === opt.value
                    ? "bg-[#ED500A] text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Selector de Modo: Transacciones (#) vs Facturación ($) */}
          <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Ver por:
            </span>
            <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMetricMode("transactions")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                  metricMode === "transactions"
                    ? "bg-white dark:bg-[#0D0F16] text-[#ED500A] shadow-xs font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span># Ventas</span>
              </button>
              <button
                type="button"
                onClick={() => setMetricMode("amount")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                  metricMode === "amount"
                    ? "bg-white dark:bg-[#0D0F16] text-[#ED500A] shadow-xs font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Monto ($)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Fila secundaria: Canales y Fechas personalizadas */}
        <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              Canal:
            </span>
            <Select
              value={channel}
              onChange={(e) => handleChannelChange(e.target.value)}
              disabled={isPending}
              className="px-3 py-1.5 bg-slate-50 dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 transition-colors"
            >
              {CHANNEL_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>

          {preset === "custom" && (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold"
              />
              <span className="text-xs text-slate-400">a</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold"
              />
              <button
                type="button"
                onClick={() => handleApplyFilters()}
                disabled={isPending}
                className="px-3 py-1.5 bg-[#ED500A] text-white rounded-xl text-xs font-bold hover:bg-[#ED500A]/90 transition-colors"
              >
                Filtrar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4 KPIS / INDICADORES PRINCIPALES */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Hora Pico Global */}
        <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Hora Pico Global</span>
            <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
            {globalSummary.hasData
              ? `${globalSummary.globalPeakDayName} • ${globalSummary.globalPeakHourLabel}`
              : "Sin datos"}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            {globalSummary.hasData ? (
              <>
                <span className="font-semibold text-[#ED500A]">
                  {globalSummary.globalPeakSalesCount} ventas
                </span>
                <span>•</span>
                <span>{formatCompactCOP(globalSummary.globalPeakAmount)}</span>
              </>
            ) : (
              <span>No hay transacciones registradas</span>
            )}
          </div>
        </div>

        {/* KPI 2: Día Más Concurrido */}
        <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Día Más Frecuentado</span>
            <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            {globalSummary.hasData ? globalSummary.busiestDayOfWeek : "Sin datos"}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            {globalSummary.hasData ? (
              <>
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {globalSummary.busiestDaySalesCount} ventas
                </span>
                <span>•</span>
                <span>{formatCompactCOP(globalSummary.busiestDayAmount)}</span>
              </>
            ) : (
              <span>Día con mayor concentración</span>
            )}
          </div>
        </div>

        {/* KPI 3: Total Ventas del Período */}
        <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Volumen del Período</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            {globalSummary.totalPeriodSalesCount} ventas
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {formatCOP(globalSummary.totalPeriodAmount)} facturado
          </div>
        </div>

        {/* KPI 4: Promedio por Hora Activa */}
        <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Promedio / Hora</span>
            <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            {globalSummary.averageHourlySalesCount} ventas/h
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {formatCompactCOP(globalSummary.averageHourlyAmount)} / hora de atención
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL: MAPA DE CALOR Y TABLA */}
      {!globalSummary.hasData ? (
        <div className="p-8 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl">
          <EmptyState
            title="Sin datos de ventas para este período"
            description="No se registraron ventas en el rango de fechas o canal seleccionado. Selecciona un rango más amplio como «Últimos 30 días» o «Últimos 90 días»."
            actionLabel="Ver Últimos 30 Días"
            onAction={() => handlePresetChange("last_30_days")}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* MAPA DE CALOR (HEATMAP) 7 x 18 */}
          <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Mapa de Calor de Concurrencia (7 × 18)
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ED500A]/10 text-[#ED500A]">
                    {metricMode === "transactions" ? "Por Transacciones" : "Por Facturación ($)"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Visualiza la intensidad operativa desde las 6:00 AM hasta las 11:00 PM para cada día de la semana.
                </p>
              </div>

              {/* Leyenda de Intensidad */}
              <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0">
                <span>Baja</span>
                <div className="flex items-center gap-1">
                  <div className="w-3.5 h-3.5 rounded-sm bg-slate-100 dark:bg-white/[0.05] border border-slate-200/50 dark:border-white/[0.05]" title="0 ventas" />
                  <div className="w-3.5 h-3.5 rounded-sm bg-[#ED500A]/20" title="Baja" />
                  <div className="w-3.5 h-3.5 rounded-sm bg-[#ED500A]/50" title="Media" />
                  <div className="w-3.5 h-3.5 rounded-sm bg-[#ED500A]/80" title="Alta" />
                  <div className="w-3.5 h-3.5 rounded-sm bg-[#ED500A]" title="Pico máximo" />
                </div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Pico</span>
              </div>
            </div>

            {/* Cuadrícula del Heatmap: Responsiva para 1024px+ y con scroll horizontal táctil si es menor */}
            <div className="overflow-x-auto no-scrollbar pb-2">
              <div className="min-w-[860px] lg:min-w-full">
                {/* Cabecera de Horas (Eje X: 18 columnas de 6AM a 11PM) */}
                <div className="grid grid-cols-[80px_repeat(18,1fr)] gap-1.5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  <div className="text-left pl-2">Día</div>
                  {hoursList.map((h) => (
                    <div key={h.hour} className="truncate">
                      {h.label}
                    </div>
                  ))}
                </div>

                {/* Filas de Días (Eje Y: 7 filas de Lunes a Domingo) */}
                <div className="space-y-1.5">
                  {data.heatmapMatrix.map((dayRow, dayIdx) => {
                    const dayConfig = dayRow[0];
                    const isBusiestDay = dayConfig.dayIndex === globalSummary.busiestDayIndex;

                    return (
                      <div
                        key={dayConfig.dayIndex}
                        className="grid grid-cols-[80px_repeat(18,1fr)] gap-1.5 items-center"
                      >
                        {/* Nombre del Día */}
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 pl-1">
                          <span className="truncate">{dayConfig.dayShort}</span>
                          {isBusiestDay && (
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-[#ED500A]"
                              title="Día de mayor concurrencia"
                            />
                          )}
                        </div>

                        {/* 18 Celdas de Horas */}
                        {dayRow.map((cell) => {
                          const intensity =
                            metricMode === "transactions"
                              ? cell.countIntensity
                              : cell.amountIntensity;

                          const isGlobalPeak =
                            cell.dayIndex === globalSummary.globalPeakDayIndex &&
                            cell.hour === globalSummary.globalPeakHour &&
                            globalSummary.globalPeakSalesCount > 0;

                          // Color de fondo dinámico según intensidad
                          let bgClass = "bg-slate-100/70 dark:bg-white/[0.03] text-slate-400 border-slate-200/50 dark:border-white/[0.04]";
                          let textClass = "text-slate-400 dark:text-slate-500";

                          if (intensity > 0) {
                            if (intensity < 0.25) {
                              bgClass = "bg-[#ED500A]/15 border-[#ED500A]/20";
                              textClass = "text-[#ED500A] dark:text-orange-400 font-semibold";
                            } else if (intensity < 0.5) {
                              bgClass = "bg-[#ED500A]/35 border-[#ED500A]/40";
                              textClass = "text-[#ED500A] dark:text-orange-300 font-bold";
                            } else if (intensity < 0.75) {
                              bgClass = "bg-[#ED500A]/65 border-[#ED500A]/70 shadow-xs";
                              textClass = "text-white font-black";
                            } else {
                              bgClass = "bg-[#ED500A] border-[#ED500A] shadow-xs";
                              textClass = "text-white font-black";
                            }
                          }

                          const displayValue =
                            metricMode === "transactions"
                              ? cell.salesCount > 0
                                ? cell.salesCount
                                : "-"
                              : cell.totalAmount > 0
                              ? formatCompactCOP(cell.totalAmount)
                              : "-";

                          return (
                            <button
                              key={cell.hour}
                              type="button"
                              onClick={() => setActiveCell(cell)}
                              onMouseEnter={() => setActiveCell(cell)}
                              className={`h-11 sm:h-12 rounded-xl border flex flex-col items-center justify-center p-1 transition-all relative group ${bgClass} ${
                                isGlobalPeak
                                  ? "ring-2 ring-amber-400 dark:ring-amber-300 ring-offset-1 dark:ring-offset-[#0D0F16] z-10 font-black scale-[1.03]"
                                  : "hover:scale-[1.05] hover:z-20"
                              }`}
                              title={`${cell.dayName} ${cell.hourLabel}: ${cell.salesCount} ventas (${formatCOP(cell.totalAmount)})`}
                            >
                              <span className={`text-[11px] leading-tight truncate w-full text-center ${textClass}`}>
                                {displayValue}
                              </span>

                              {isGlobalPeak && (
                                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* DETALLE DE CELDA SELECCIONADA / HOVER */}
            {activeCell && (
              <div className="mt-4 p-3 bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center font-bold">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">
                      {activeCell.dayName} • {activeCell.hourLabel} (de {activeCell.hour}:00 a {activeCell.hour + 1}:00)
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Franja horaria seleccionada
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Ventas</span>
                    <span className="font-extrabold text-[#ED500A] text-sm">
                      {activeCell.salesCount} transacciones
                    </span>
                  </div>
                  <div className="border-l border-slate-200 dark:border-white/[0.08] pl-3">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Facturación</span>
                    <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                      {formatCOP(activeCell.totalAmount)}
                    </span>
                  </div>
                  <div className="border-l border-slate-200 dark:border-white/[0.08] pl-3">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Ticket Promedio</span>
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                      {formatCOP(activeCell.averageTicket)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* TABLA RESUMEN DE HORAS PICO POR DÍA DE LA SEMANA */}
          <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Resumen de Horas Pico por Día de la Semana
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Planificación de turnos de personal y preparación de inventario según la hora más demandada.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/75 dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Día de la Semana</th>
                    <th className="py-3 px-4">Hora Pico Identificada</th>
                    <th className="py-3 px-4 text-center">Ventas en Pico</th>
                    <th className="py-3 px-4 text-right">Facturación en Pico</th>
                    <th className="py-3 px-4 text-center">Total Ventas Día</th>
                    <th className="py-3 px-4 text-right">Total Facturación Día</th>
                    <th className="py-3 px-4 text-right">% Concentración</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {data.daySummaries.map((daySum) => {
                    const isBusiest = daySum.dayIndex === globalSummary.busiestDayIndex;
                    const concentration =
                      daySum.totalDaySalesCount > 0
                        ? Math.round((daySum.peakSalesCount / daySum.totalDaySalesCount) * 100)
                        : 0;

                    return (
                      <tr
                        key={daySum.dayIndex}
                        className={`hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors ${
                          isBusiest ? "bg-[#ED500A]/5 font-semibold" : ""
                        }`}
                      >
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span>{daySum.dayName}</span>
                            {isBusiest && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-[#ED500A]/10 text-[#ED500A]">
                                Día Líder
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold bg-amber-500/10 text-amber-700 dark:text-amber-400 font-mono">
                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                            {daySum.peakHourLabel} ({daySum.peakHour}:00)
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center font-bold text-[#ED500A]">
                          {daySum.peakSalesCount}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatCOP(daySum.peakTotalAmount)}
                        </td>

                        <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-300 font-medium">
                          {daySum.totalDaySalesCount}
                        </td>

                        <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-300">
                          {formatCOP(daySum.totalDayAmount)}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                            {concentration}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

