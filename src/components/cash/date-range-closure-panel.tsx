"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  Download,
  AlertCircle,
  Loader2,
  Store,
  Truck,
  Globe,
  TrendingUp,
  Receipt,
  HeartHandshake,
  CheckCircle2,
  Calculator,
  Lock,
  FileEdit,
} from "lucide-react";
import { DateRangeClosureResult, DailyPaymentMethodReconciliation } from "@/lib/cash/types";
import {
  calculateDateRangeClosureAction,
  exportDateRangeClosurePdfAction,
} from "@/app/workspace/[businessId]/cajas/actions";
import { toast } from "sonner";

interface DateRangeClosurePanelProps {
  businessId: string;
}

const STANDARD_METHODS = [
  { method: "cash", label: "Efectivo" },
  { method: "digital", label: "Transferencias" },
  { method: "other", label: "Otros" },
];

export function DateRangeClosurePanel({ businessId }: DateRangeClosurePanelProps) {
  // Por defecto los últimos 7 días
  const today = new Date();
  const past7Days = new Date();
  past7Days.setDate(today.getDate() - 6);

  const [startDate, setStartDate] = useState<string>(past7Days.toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState<string>("00:00");
  const [endDate, setEndDate] = useState<string>(today.toISOString().split("T")[0]);
  const [endTime, setEndTime] = useState<string>("23:59");

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [rangeData, setRangeData] = useState<DateRangeClosureResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Arqueo contado editable por método
  const [countedInputs, setCountedInputs] = useState<Record<string, string>>({});
  // Estado del cierre: Toggle entre 'Borrador' y 'Confirmado'
  const [closureStatus, setClosureStatus] = useState<"draft" | "confirmed">("draft");
  // Notas del cierre
  const [notes, setNotes] = useState<string>("");

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const formatCOP = (val: number) =>
    `$${new Intl.NumberFormat("es-CO").format(Math.round(val))}`;

  const fetchRangeClosure = async (start: string, end: string) => {
    setIsLoading(true);
    setError(null);

    // Validación preventiva en cliente de 30 días
    const d1 = new Date(`${start}T00:00:00Z`);
    const d2 = new Date(`${end}T00:00:00Z`);
    const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays > 30) {
      setError(`El intervalo seleccionado es de ${diffDays} días. El límite máximo permitido es de 30 días.`);
      setIsLoading(false);
      return;
    }

    if (diffDays < 1) {
      setError("La fecha de inicio no puede ser posterior a la fecha final.");
      setIsLoading(false);
      return;
    }

    try {
      const res = await calculateDateRangeClosureAction(businessId, start, end);
      if (res.success && res.data) {
        setRangeData(res.data);

        // Prellenar inputs de conteo
        const initialCounted: Record<string, string> = {};
        for (const std of STANDARD_METHODS) {
          const match = res.data.reconciliation.find(
            (r) => r.method === std.method || (std.method === "digital" && r.method === "transfer")
          );
          initialCounted[std.method] = match ? String(match.countedTotal) : "0";
        }
        setCountedInputs(initialCounted);
      } else {
        setError(res.error || "No se pudo calcular el cierre por rango.");
      }
    } catch (err: any) {
      setError(err?.message || "Error al calcular el cierre por rango de fechas.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRangeClosure(startDate, endDate);
  }, [businessId]);

  const handleApplyRange = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRangeClosure(startDate, endDate);
  };

  const handleCountedChange = (method: string, rawVal: string) => {
    const numericOnly = rawVal.replace(/\D/g, "");
    setCountedInputs((prev) => ({
      ...prev,
      [method]: numericOnly,
    }));
  };

  // Reconciliación calculada dinámicamente con los 5 métodos estándar
  const computedReconciliation: DailyPaymentMethodReconciliation[] = STANDARD_METHODS.map((std) => {
    const backendMatch = (rangeData?.reconciliation || []).find(
      (item) => item.method === std.method || (std.method === "digital" && item.method === "transfer")
    );
    const systemTotal = backendMatch ? backendMatch.systemTotal : 0;
    const countedVal = Number(countedInputs[std.method] || 0);

    return {
      method: std.method,
      label: std.label,
      systemTotal,
      countedTotal: countedVal,
      difference: countedVal - systemTotal,
    };
  });

  const computedTotalSystem = computedReconciliation.reduce((sum, r) => sum + r.systemTotal, 0);
  const computedTotalCounted = computedReconciliation.reduce((sum, r) => sum + r.countedTotal, 0);
  const computedTotalDifference = computedTotalCounted - computedTotalSystem;

  // Métricas de ventas y propinas
  const totalSalesGross = rangeData?.metrics.totalSales || 0;
  const tipsTotal = (rangeData?.metrics as any)?.tipsTotal || 0;
  const netSalesWithoutTips = Math.max(0, totalSalesGross - tipsTotal);

  // Guardar Cierre por Rango
  const handleSaveClosure = () => {
    if (!rangeData || isSaving) return;
    setIsSaving(true);
    try {
      // Persistir registro local / notificar guardado
      if (typeof window !== "undefined") {
        const payload = {
          businessId,
          startDate,
          startTime,
          endDate,
          endTime,
          closureStatus,
          notes,
          computedTotalSystem,
          computedTotalCounted,
          computedTotalDifference,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(`negova_range_closure_${businessId}_${startDate}_${endDate}`, JSON.stringify(payload));
      }

      toast.success(
        closureStatus === "confirmed"
          ? "¡Cierre por rango confirmado y guardado con éxito!"
          : "Cierre por rango guardado como borrador."
      );
    } catch {
      toast.error("No se pudo guardar el cierre por rango.");
    } finally {
      setIsSaving(false);
    }
  };

  // Exportar PDF
  const handleExportPdf = async () => {
    if (!rangeData || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const res = await exportDateRangeClosurePdfAction(businessId, startDate, endDate);
      if (res.success && res.base64) {
        const link = document.createElement("a");
        link.href = `data:application/pdf;base64,${res.base64}`;
        link.download = res.filename || `Cierre_Rango_${startDate}_al_${endDate}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("PDF del cierre consolidado descargado exitosamente.");
      } else {
        toast.error(res.error || "No se pudo generar el PDF del cierre por rango.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al exportar PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6 font-body">
      {/* 1. BARRA SUPERIOR: INTERVALO CON SELECTORES FECHA/HORA Y LÍMITE 30 DÍAS */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-[#ED500A] flex items-center justify-center font-bold shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Cierre por Rango
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                Límite máximo 30 días
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                  closureStatus === "confirmed"
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30"
                    : "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/30"
                }`}
              >
                {closureStatus === "confirmed" ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Confirmado</span>
                  </>
                ) : (
                  <>
                    <FileEdit className="w-3 h-3" />
                    <span>Borrador</span>
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Consolidación periódica de ventas, canales comerciales y métodos de recaudo.
            </p>
          </div>
        </div>

        {/* Presets rápidos */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const t = new Date();
              const p7 = new Date();
              p7.setDate(t.getDate() - 6);
              const sStr = p7.toISOString().split("T")[0];
              const eStr = t.toISOString().split("T")[0];
              setStartDate(sStr);
              setEndDate(eStr);
              fetchRangeClosure(sStr, eStr);
            }}
            className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
          >
            Últimos 7 días
          </button>
          <button
            type="button"
            onClick={() => {
              const t = new Date();
              const p15 = new Date();
              p15.setDate(t.getDate() - 14);
              const sStr = p15.toISOString().split("T")[0];
              const eStr = t.toISOString().split("T")[0];
              setStartDate(sStr);
              setEndDate(eStr);
              fetchRangeClosure(sStr, eStr);
            }}
            className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
          >
            Últimos 15 días
          </button>
          <button
            type="button"
            onClick={() => {
              const t = new Date();
              const p30 = new Date();
              p30.setDate(t.getDate() - 29);
              const sStr = p30.toISOString().split("T")[0];
              const eStr = t.toISOString().split("T")[0];
              setStartDate(sStr);
              setEndDate(eStr);
              fetchRangeClosure(sStr, eStr);
            }}
            className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
          >
            Últimos 30 días
          </button>
        </div>
      </div>

      {/* INTERVALO CON SELECTORES FECHA/HORA DE INICIO Y FIN Y BOTÓN 'CALCULAR CIERRE' */}
      <form
        onSubmit={handleApplyRange}
        className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs flex flex-col md:flex-row items-stretch md:items-end justify-between gap-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full md:max-w-xl">
          {/* Inicio (Fecha y Hora) */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Fecha y Hora de Inicio
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                aria-label="Fecha de inicio"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 px-3 py-2 text-xs font-semibold font-mono rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]"
              />
              <input
                type="time"
                aria-label="Hora de inicio"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-24 px-2.5 py-2 text-xs font-semibold font-mono rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]"
              />
            </div>
          </div>

          {/* Fin (Fecha y Hora) */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Fecha y Hora Final
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                aria-label="Fecha final"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 px-3 py-2 text-xs font-semibold font-mono rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]"
              />
              <input
                type="time"
                aria-label="Hora final"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-24 px-2.5 py-2 text-xs font-semibold font-mono rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]"
              />
            </div>
          </div>
        </div>

        {/* BOTÓN 'CALCULAR CIERRE' */}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full md:w-auto px-5 py-2.5 text-xs font-bold bg-[#ED500A] hover:bg-[#d64508] active:scale-[0.98] text-white rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Calculando...</span>
              </>
            ) : (
              <>
                <Calculator className="w-4 h-4" />
                <span>Calcular Cierre</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* MENSAJE DE ERROR / LÍMITE 30 DÍAS */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl flex items-start gap-3 text-xs text-rose-700 dark:text-rose-400 shadow-xs">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">Error en el intervalo</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* CONTENIDO DEL CIERRE POR RANGO */}
      {isLoading ? (
        <div className="p-16 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] flex flex-col items-center justify-center gap-2 text-slate-400">
          <Loader2 className="w-7 h-7 animate-spin text-[#ED500A]" />
          <span className="text-xs">Calculando consolidación del intervalo...</span>
        </div>
      ) : rangeData ? (
        <div className="space-y-6">
          {/* 2. RESUMEN DEL INTERVALO POR CANALES Y DESGLOSE DE PROPINAS */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              1. Resumen de Ventas y Propinas ({rangeData.daysCount} días)
            </h4>

            {/* Tarjetas globales: Facturado, sin propinas, propinas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="p-4 rounded-2xl bg-orange-50/70 dark:bg-orange-500/10 border border-orange-200/80 dark:border-orange-500/20 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[#ED500A]">
                  <span className="text-xs font-bold uppercase tracking-wider">Total Facturado (Bruto)</span>
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                    {formatCOP(totalSalesGross)}
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Promedio: {formatCOP(Math.round(totalSalesGross / (rangeData.daysCount || 1)))}/día
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span className="text-xs font-bold uppercase tracking-wider">Sin Propinas</span>
                  <Receipt className="w-4 h-4" />
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-black font-mono text-slate-800 dark:text-slate-200">
                    {formatCOP(netSalesWithoutTips)}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Ventas netas de productos y servicios
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span className="text-xs font-bold uppercase tracking-wider">Desglose de Propinas</span>
                  <HeartHandshake className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400">
                    {formatCOP(tipsTotal)}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Propinas acumuladas del período
                  </p>
                </div>
              </div>
            </div>

            {/* Canales comerciales */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              {/* Mostrador */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-slate-500 text-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Mostrador</span>
                  <Store className="w-4 h-4 text-orange-500" />
                </div>
                <div className="text-base sm:text-lg font-bold font-mono text-slate-900 dark:text-white">
                  {formatCOP(rangeData.metrics.counterSales)}
                </div>
                <p className="text-[10px] text-slate-400">POS / Mostrador</p>
              </div>

              {/* Mesas */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-slate-500 text-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Mesas</span>
                  <Store className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-base sm:text-lg font-bold font-mono text-slate-900 dark:text-white">
                  {formatCOP(rangeData.metrics.tablesSales)}
                </div>
                <p className="text-[10px] text-slate-400">Consumo en salón</p>
              </div>

              {/* Domicilios */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-slate-500 text-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Domicilios</span>
                  <Truck className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-base sm:text-lg font-bold font-mono text-slate-900 dark:text-white">
                  {formatCOP(rangeData.metrics.deliverySales)}
                </div>
                <p className="text-[10px] text-slate-400">Reparto / Despacho</p>
              </div>

              {/* Online */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-slate-500 text-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Online</span>
                  <Globe className="w-4 h-4 text-purple-500" />
                </div>
                <div className="text-base sm:text-lg font-bold font-mono text-slate-900 dark:text-white">
                  {formatCOP(rangeData.metrics.onlineSales)}
                </div>
                <p className="text-[10px] text-slate-400">Canal digital / QR</p>
              </div>
            </div>
          </div>

          {/* 3. TABLA DE CUADRE POR MÉTODO DE PAGO CON CÁLCULO REACTIVO DE DIFERENCIAS */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                2. Cuadre por Método de Pago en el Intervalo
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ajusta los montos contados para calcular reactivamente sobrantes o faltantes en tiempo real.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/5 text-slate-400 text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Método de Pago</th>
                    <th className="py-2.5 px-3 text-right">Total Sistema</th>
                    <th className="py-2.5 px-3 text-right">Total Contado</th>
                    <th className="py-2.5 px-3 text-right">Diferencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                  {computedReconciliation.map((item) => (
                    <tr key={item.method} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01]">
                      <td className="py-3 px-3 font-body font-bold text-slate-900 dark:text-white">
                        {item.label}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300 font-semibold">
                        {formatCOP(item.systemTotal)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center justify-end">
                          <span className="text-slate-400 mr-1">$</span>
                          <input
                            type="text"
                            aria-label={`Total contado para ${item.label}`}
                            inputMode="numeric"
                            value={
                              countedInputs[item.method] !== undefined
                                ? new Intl.NumberFormat("es-CO").format(
                                    Number(countedInputs[item.method])
                                  )
                                : ""
                            }
                            onChange={(e) => handleCountedChange(item.method, e.target.value)}
                            className="w-32 px-2.5 py-1 text-right text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]"
                          />
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-bold">
                        {item.difference === 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400">$ 0 (Exacto)</span>
                        ) : item.difference > 0 ? (
                          <span className="text-blue-600 dark:text-blue-400">
                            +{formatCOP(item.difference)} (Sobrante)
                          </span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400">
                            {formatCOP(item.difference)} (Faltante)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 dark:border-white/10 font-bold text-xs bg-slate-50/80 dark:bg-white/[0.02]">
                    <td className="py-3 px-3 text-slate-900 dark:text-white uppercase font-body">
                      Total Consolidado
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-900 dark:text-white">
                      {formatCOP(computedTotalSystem)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-900 dark:text-white">
                      {formatCOP(computedTotalCounted)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-sm">
                      {computedTotalDifference === 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          $ 0 (Cuadrado)
                        </span>
                      ) : computedTotalDifference > 0 ? (
                        <span className="text-blue-600 dark:text-blue-400">
                          +{formatCOP(computedTotalDifference)} (Sobrante)
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400">
                          {formatCOP(computedTotalDifference)} (Faltante)
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* 4. ESTADO DEL CIERRE: TOGGLE 'BORRADOR' VS 'CONFIRMADO', NOTAS Y ACCIONES */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/5">
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  3. Estado del cierre
                </h4>
                <p className="text-[11px] text-slate-500">
                  {closureStatus === "confirmed"
                    ? "El cierre ha sido validado formalmente para trazabilidad contable."
                    : "El cierre permanece como borrador preliminar en proceso de revisión."}
                </p>
              </div>

              {/* TOGGLE ENTRE 'BORRADOR' Y 'CONFIRMADO' */}
              <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setClosureStatus("draft")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    closureStatus === "draft"
                      ? "bg-white dark:bg-[#1A2234] text-amber-700 dark:text-amber-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Borrador
                </button>
                <button
                  type="button"
                  onClick={() => setClosureStatus("confirmed")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    closureStatus === "confirmed"
                      ? "bg-white dark:bg-[#1A2234] text-emerald-700 dark:text-emerald-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Confirmado
                </button>
              </div>
            </div>

            {/* NOTAS DEL CIERRE */}
            <div className="space-y-1.5">
              <label
                htmlFor="range-closure-notes"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Notas del cierre <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <textarea
                id="range-closure-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones de auditoría del período, justificaciones de descuadre o comentarios..."
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]"
              />
            </div>

            {/* ACCIONES: 'EXPORTAR PDF' Y 'GUARDAR CIERRE' */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 dark:border-white/5">
              <div className="text-xs text-slate-400">
                Intervalo consolidado del {startDate} {startTime} al {endDate} {endTime}
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                {/* BOTÓN 'EXPORTAR PDF' */}
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={isExportingPdf}
                  className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5 rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isExportingPdf ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>Exportar PDF</span>
                </button>

                {/* BOTÓN 'GUARDAR CIERRE' */}
                <button
                  type="button"
                  onClick={handleSaveClosure}
                  disabled={isSaving}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-[#ED500A] hover:bg-[#d64508] active:scale-[0.98] rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Guardar Cierre</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
