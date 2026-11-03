"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Receipt,
  Calendar,
  CreditCard,
  Banknote,
  Clock,
  ArrowRight,
  Store,
  UtensilsCrossed,
  Bike,
  QrCode,
  Award,
  RefreshCw,
  Search,
  Filter,
  ShoppingBag,
  Layers,
  ChevronRight,
  ExternalLink,
  SlidersHorizontal,
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import {
  SalesDashboardData,
  ReportsDateRange,
  ReportsDatePreset,
  SalesChannelType,
} from "@/lib/reports/types";
import { ReportNavTabs } from "@/components/reports/report-nav-tabs";
import { getSalesDashboardMetricsAction } from "./actions";
import {
  EmptyState,
  ErrorState,
  KpiSkeleton,
  CardSkeleton,
} from "@/components/ui";

interface SalesDashboardClientProps {
  businessId: string;
  businessName: string;
  initialData: SalesDashboardData;
}

export function SalesDashboardClient({
  businessId,
  businessName,
  initialData,
}: SalesDashboardClientProps) {
  const [data, setData] = useState<SalesDashboardData>(initialData);
  const [dateRange, setDateRange] = useState<ReportsDateRange>(initialData.dateRange);
  const [customStart, setCustomStart] = useState<string>(
    initialData.dateRange.startDate || new Date().toISOString().slice(0, 10)
  );
  const [customEnd, setCustomEnd] = useState<string>(
    initialData.dateRange.endDate || new Date().toISOString().slice(0, 10)
  );
  const [isPending, startTransition] = useTransition();
  const [isMounted, setIsMounted] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handlePresetChange = (preset: ReportsDatePreset) => {
    const newRange: ReportsDateRange = {
      preset,
      startDate: preset === "custom" ? customStart : undefined,
      endDate: preset === "custom" ? customEnd : undefined,
    };
    setDateRange(newRange);

    if (preset !== "custom") {
      fetchMetrics(newRange);
    }
  };

  const handleApplyCustomRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStart || !customEnd) {
      toast.error("Por favor selecciona fecha de inicio y fin.");
      return;
    }
    if (customStart > customEnd) {
      toast.error("La fecha de inicio no puede ser posterior a la fecha de fin.");
      return;
    }

    const newRange: ReportsDateRange = {
      preset: "custom",
      startDate: customStart,
      endDate: customEnd,
    };
    setDateRange(newRange);
    fetchMetrics(newRange);
  };

  const fetchMetrics = (rangeToFetch: ReportsDateRange) => {
    setLoadError(null);
    startTransition(async () => {
      try {
        const res = await getSalesDashboardMetricsAction(businessId, rangeToFetch);
        if (res.success && res.data) {
          setData(res.data);
          setLoadError(null);
          toast.success("Métricas de ventas actualizadas.");
        } else {
          setLoadError(res.error || "No se pudieron obtener las métricas de ventas.");
          toast.error(res.error || "No se pudieron obtener las métricas de ventas.");
        }
      } catch (err: any) {
        const msg = err.message || "Error al actualizar las métricas de ventas.";
        setLoadError(msg);
        toast.error(msg);
      }
    });
  };

  const channelIcons: Record<SalesChannelType, React.ReactNode> = {
    mostrador: <Store className="w-4 h-4 text-blue-500" />,
    mesa: <UtensilsCrossed className="w-4 h-4 text-amber-500" />,
    domicilio: <Bike className="w-4 h-4 text-indigo-500" />,
    digital_menu: <QrCode className="w-4 h-4 text-purple-500" />,
  };

  const getPresetLabel = (preset: ReportsDatePreset) => {
    switch (preset) {
      case "today":
        return "Hoy";
      case "yesterday":
        return "Ayer";
      case "last_7_days":
        return "Últimos 7 días";
      case "this_month":
        return "Este mes";
      case "custom":
        return "Rango personalizado";
    }
  };

  return (
    <div className="space-y-6">
      {/* Pestañas de Navegación de Reportes */}
      <ReportNavTabs businessId={businessId} />

      {/* HEADER DE CONTROL: TÍTULO, SELECTOR DE FECHAS Y REFRESH */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Dashboard de Ventas & KPIs
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ED500A] animate-pulse" />
              {getPresetLabel(dateRange.preset)}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Supervisión consolidada de ingresos, transacciones, canales y productos estrella de {businessName}.
          </p>
        </div>

        {/* SELECTOR DE PERÍODO */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-wrap">
          <div className="flex items-center bg-slate-100 dark:bg-white/[0.04] p-1 rounded-xl border border-slate-200 dark:border-white/[0.08] text-xs">
            <button
              type="button"
              onClick={() => handlePresetChange("today")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                dateRange.preset === "today"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange("yesterday")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                dateRange.preset === "yesterday"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Ayer
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange("last_7_days")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                dateRange.preset === "last_7_days"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              7 Días
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange("this_month")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                dateRange.preset === "this_month"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Este Mes
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange("custom")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                dateRange.preset === "custom"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Personalizado
            </button>
          </div>

          <button
            type="button"
            onClick={() => fetchMetrics(dateRange)}
            disabled={isPending}
            className="p-2 rounded-xl border border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50 cursor-pointer"
            title="Refrescar métricas"
          >
            <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin text-[#ED500A]" : ""}`} />
          </button>
        </div>
      </div>

      {/* FORMULARIO DE FECHAS PERSONALIZADAS */}
      {dateRange.preset === "custom" && (
        <form
          onSubmit={handleApplyCustomRange}
          className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-2xl flex flex-wrap items-center gap-3 text-xs"
        >
          <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#ED500A]" />
            <span>Definir rango de fechas:</span>
          </span>
          <div className="flex items-center gap-2">
            <label className="text-slate-500 font-medium">Desde:</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-slate-500 font-medium">Hasta:</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-1.5 rounded-xl bg-[#ED500A] hover:bg-[#d84606] text-white font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {isPending ? "Calculando..." : "Aplicar Rango"}
          </button>
        </form>
      )}

      {/* 4 TARJETAS RESUMEN: DÍA, SEMANA, MES, TICKET PROMEDIO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* TARJETA 1: VENTAS DEL DÍA */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Ventas del Día
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              {formatCOP(data.kpis.todaySalesAmount)}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {data.kpis.todayTransactionsCount}
              </span>{" "}
              {data.kpis.todayTransactionsCount === 1 ? "transacción registrada" : "transacciones registradas"}
            </p>
          </div>
        </div>

        {/* TARJETA 2: VENTAS DE LA SEMANA */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Ventas de la Semana
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              {formatCOP(data.kpis.weekSalesAmount)}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {data.kpis.weekTransactionsCount}
              </span>{" "}
              transacciones acumuladas
            </p>
          </div>
        </div>

        {/* TARJETA 3: VENTAS DEL MES */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Ventas del Mes
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              {formatCOP(data.kpis.monthSalesAmount)}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {data.kpis.monthTransactionsCount}
              </span>{" "}
              transacciones en el mes
            </p>
          </div>
        </div>

        {/* TARJETA 4: TICKET PROMEDIO */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Ticket Promedio
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              {formatCOP(data.kpis.averageTicketAmount)}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              En base a{" "}
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {data.kpis.periodTransactionsCount}
              </span>{" "}
              tickets analizados
            </p>
          </div>
        </div>
      </div>

      {/* ESTADO DE ERROR / CARGA / VACÍO CONSISTENTES [DS-002] */}
      {loadError ? (
        <ErrorState
          title="Error al cargar dashboard de ventas"
          description={loadError}
          onRetry={() => fetchMetrics(dateRange)}
          retryLabel="Reintentar consulta"
        />
      ) : isPending ? (
        <div className="space-y-5 pt-1 animate-pulse">
          <KpiSkeleton count={4} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <CardSkeleton className="h-64" />
            <CardSkeleton className="h-64" />
          </div>
        </div>
      ) : data.isEmpty ? (
        <EmptyState
          icon={ShoppingBag}
          title="Sin ventas registradas en este período"
          description="No se encontraron comprobantes comerciales ni comandas pagadas en el intervalo seleccionado. Comienza a facturar en el Punto de Venta (POS) o selecciona otro rango de fechas."
          actionLabel="Ir al POS"
          actionHref={`/workspace/${businessId}/pos`}
          resetLabel="Ver últimos 7 días"
          onReset={() => handlePresetChange("last_7_days")}
        />
      ) : (
        <>
          {/* SECCIÓN DE GRÁFICOS: BARRAS (7 DÍAS) & LÍNEA (30 DÍAS) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* GRÁFICO 1: BARRAS - VENTAS POR DÍA (ÚLTIMOS 7 DÍAS) */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#ED500A]" />
                    <span>Ventas por Día (Últimos 7 días)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Facturación diaria en los últimos 7 días del comercio.
                  </p>
                </div>
              </div>

              <div className="h-64 w-full">
                {isMounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.last7DaysDailySales} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                      <XAxis
                        dataKey="dayName"
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `$${v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${Math.round(v / 1000)}k`}`}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const p = payload[0].payload;
                            return (
                              <div className="p-3 bg-slate-900 text-white rounded-xl shadow-xl text-xs border border-slate-800">
                                <p className="font-bold text-slate-300">
                                  {p.dayName} · {p.formattedDate}
                                </p>
                                <p className="text-base font-black text-[#ED500A] font-mono mt-0.5">
                                  {formatCOP(p.totalAmount)}
                                </p>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  {p.transactionsCount} {p.transactionsCount === 1 ? "transacción" : "transacciones"}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="totalAmount" fill="#ED500A" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full w-full bg-slate-100 dark:bg-white/[0.02] rounded-xl animate-pulse" />
                )}
              </div>
            </div>

            {/* GRÁFICO 2: LÍNEA / ÁREA - TENDENCIA DE VENTAS (ÚLTIMOS 30 DÍAS) */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    <span>Tendencia de Ventas (Últimos 30 días)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Curva de ingresos diarios acumulados durante el mes.
                  </p>
                </div>
              </div>

              <div className="h-64 w-full">
                {isMounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.last30DaysTrendSales} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="salesTrendGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                      <XAxis
                        dataKey="formattedDate"
                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                        interval={4}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `$${v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${Math.round(v / 1000)}k`}`}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const p = payload[0].payload;
                            return (
                              <div className="p-3 bg-slate-900 text-white rounded-xl shadow-xl text-xs border border-slate-800">
                                <p className="font-bold text-slate-300">{p.formattedDate}</p>
                                <p className="text-sm font-bold text-blue-400 font-mono mt-0.5">
                                  Día: {formatCOP(p.totalAmount)}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  Acumulado: {formatCOP(p.accumulatedAmount)}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                  {p.transactionsCount} órdenes
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="totalAmount"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#salesTrendGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full w-full bg-slate-100 dark:bg-white/[0.02] rounded-xl animate-pulse" />
                )}
              </div>
            </div>
          </div>

          {/* SECCIÓN INFERIOR: CANAL CON MÁS VENTAS & TOP 5 PRODUCTOS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* DESGLOSE POR CANAL Y CANAL LÍDER */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-500" />
                    <span>Ventas por Canal de Origen</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Participación de Mostrador, Mesas, Domicilios y Menú QR.
                  </p>
                </div>

                {data.kpis.topChannel && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    <Award className="w-3.5 h-3.5" />
                    <span>Líder: {data.kpis.topChannel.label}</span>
                  </span>
                )}
              </div>

              <div className="space-y-4">
                {data.channels.map((ch) => (
                  <div key={ch.channel} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                        {channelIcons[ch.channel]}
                        <span>{ch.label}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-slate-400 text-[11px]">{ch.transactionsCount} ventas</span>
                        <span className="font-bold text-slate-900 dark:text-white">{formatCOP(ch.totalAmount)}</span>
                        <span className="text-slate-500 font-bold w-9 text-right">{ch.percentage}%</span>
                      </div>
                    </div>

                    {/* Barra de progreso */}
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-white/[0.04] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#ED500A] transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, ch.percentage))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TOP 5 PRODUCTOS MÁS VENDIDOS */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-500" />
                    <span>Productos Más Vendidos (Top 5)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Artículos con mayor volumen de facturación en el período.
                  </p>
                </div>
              </div>

              {data.topProducts.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No hay productos registrados en este período.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.topProducts.map((prod, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.04] flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 font-black text-xs flex items-center justify-center font-mono">
                          {idx + 1}
                        </span>
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {prod.productName}
                          </h4>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {prod.quantitySold} {prod.quantitySold === 1 ? "unidad vendida" : "unidades vendidas"}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                          {formatCOP(prod.revenue)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
