"use client";

import React, { useEffect, useState } from "react";
import {
  Calendar,
  Lock,
  Download,
  AlertCircle,
  Loader2,
  RefreshCw,
  Store,
  UtensilsCrossed,
  Truck,
  Globe,
  TrendingUp,
  Receipt,
  HeartHandshake,
} from "lucide-react";
import {
  DailyClosureCalculationResult,
  DailyPaymentMethodReconciliation,
} from "@/lib/cash/types";
import {
  calculateDailyClosureAction,
  saveDailyClosureAction,
  exportDailyClosurePdfAction,
} from "@/app/workspace/[businessId]/cajas/actions";
import { toast } from "sonner";

interface DailyClosurePanelProps {
  businessId: string;
}

const STANDARD_METHODS = [
  { method: "cash", label: "Efectivo" },
  { method: "digital", label: "Transferencias" },
  { method: "card", label: "Tarjetas" },
  { method: "credit", label: "Crédito" },
  { method: "other", label: "Otros" },
];

export function DailyClosurePanel({ businessId }: DailyClosurePanelProps) {
  // Fecha seleccionada (por defecto hoy en YYYY-MM-DD local)
  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const [isLoading, setIsLoading] = useState(true);
  const [closureData, setClosureData] = useState<DailyClosureCalculationResult | null>(null);

  // Arqueo contado por método editable
  const [countedInputs, setCountedInputs] = useState<Record<string, string>>({});
  const [observations, setObservations] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatCop = (amt: number) =>
    `$${new Intl.NumberFormat("es-CO").format(Math.round(amt))}`;

  // Cargar datos para la fecha seleccionada
  const fetchClosure = async (dateStr: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await calculateDailyClosureAction(businessId, dateStr);
      if (res.success && res.data) {
        setClosureData(res.data);

        // Prellenar inputs de conteo
        const initialCounted: Record<string, string> = {};
        for (const std of STANDARD_METHODS) {
          const match = res.data.reconciliation.find(
            (r) => r.method === std.method || (std.method === "digital" && r.method === "transfer")
          );
          initialCounted[std.method] = match ? String(match.countedTotal) : "0";
        }
        setCountedInputs(initialCounted);

        if (res.data.closureRecord?.observations) {
          setObservations(res.data.closureRecord.observations);
        } else {
          setObservations("");
        }
      } else {
        setError(res.error || "No se pudo cargar el cálculo del cierre del día.");
      }
    } catch (err: any) {
      setError(err?.message || "Error al consultar cierre del día.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClosure(selectedDate);
  }, [selectedDate, businessId]);

  // Manejar cambio en montos contados
  const handleCountedChange = (method: string, rawVal: string) => {
    if (closureData?.isSaved) return; // Inmutable si ya está guardado
    const numericOnly = rawVal.replace(/\D/g, "");
    setCountedInputs((prev) => ({
      ...prev,
      [method]: numericOnly,
    }));
  };

  // Reconciliación calculada dinámicamente con los 5 métodos estándar
  const computedReconciliation: DailyPaymentMethodReconciliation[] = STANDARD_METHODS.map((std) => {
    const backendMatch = (closureData?.reconciliation || []).find(
      (item) => item.method === std.method || (std.method === "digital" && item.method === "transfer")
    );
    const systemTotal = backendMatch ? backendMatch.systemTotal : 0;

    if (closureData?.isSaved && backendMatch) {
      return {
        method: std.method,
        label: std.label,
        systemTotal: backendMatch.systemTotal,
        countedTotal: backendMatch.countedTotal,
        difference: backendMatch.difference,
      };
    }

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

  // Métricas desglosadas (Ventas brutas, sin propinas, propinas)
  const totalSalesGross = closureData?.metrics.totalSales || 0;
  const tipsTotal = (closureData?.metrics as any)?.tipsTotal || 0;
  const netSalesWithoutTips = Math.max(0, totalSalesGross - tipsTotal);

  // Guardar Cierre del Día
  const handleSaveClosure = async () => {
    if (!closureData || closureData.isSaved || isSaving) return;

    setIsSaving(true);
    setError(null);

    const countedMap: Record<string, number> = {};
    for (const [m, val] of Object.entries(countedInputs)) {
      countedMap[m] = Number(val || 0);
    }

    try {
      const res = await saveDailyClosureAction(businessId, {
        closureDate: selectedDate,
        countedByMethod: countedMap,
        observations: observations.trim() || undefined,
      });

      if (res.success && res.data) {
        toast.success(`¡Cierre del día ${selectedDate} guardado con éxito!`, {
          description: "El registro ha quedado sellado e inmutable para auditoría.",
        });
        await fetchClosure(selectedDate);
      } else {
        setError(res.error || "No se pudo guardar el cierre del día.");
      }
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error inesperado al guardar el cierre.");
    } finally {
      setIsSaving(false);
    }
  };

  // Exportar PDF
  const handleExportPdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);

    const countedMap: Record<string, number> = {};
    for (const [m, val] of Object.entries(countedInputs)) {
      countedMap[m] = Number(val || 0);
    }

    try {
      const res = await exportDailyClosurePdfAction(
        businessId,
        selectedDate,
        countedMap,
        observations
      );

      if (res.success && res.base64) {
        const link = document.createElement("a");
        link.href = `data:application/pdf;base64,${res.base64}`;
        link.download = res.filename || `Cierre_Z_${selectedDate}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Comprobante de Cierre Z descargado en PDF.");
      } else {
        toast.error(res.error || "No se pudo generar el archivo PDF.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al exportar PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. BARRA SUPERIOR: SELECTOR DE FECHA DE CONSULTA Y ESTADO */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-[#ED500A] flex items-center justify-center font-bold shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Cierre del Día
              </h3>
              {closureData?.isSaved ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                  <Lock className="w-3 h-3" />
                  <span>Cierre Guardado (Inmutable)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                  <span>En curso / Preliminar</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Resumen integral de ventas, canales comerciales y cuadre de caja del día.
            </p>
          </div>
        </div>

        {/* SELECTOR DE FECHA DE CONSULTA */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 w-full sm:w-auto">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="date"
              aria-label="Fecha de consulta"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-semibold font-mono text-slate-900 dark:text-white focus:outline-none cursor-pointer w-full"
            />
          </div>
          <button
            type="button"
            onClick={() => fetchClosure(selectedDate)}
            className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer shrink-0"
            title="Refrescar cálculo"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-7 h-7 animate-spin text-[#ED500A]" />
          <span className="text-xs font-medium">Consolidando métricas y ventas del día...</span>
        </div>
      ) : closureData ? (
        <div className="space-y-6">
          {/* 2. RESUMEN DEL DÍA: TOTAL VENTAS (BRUTO, SIN PROPINAS, PROPINAS) Y CANALES */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              1. Resumen de Ventas y Canales
            </h4>

            {/* Total Ventas (bruto, sin propinas, propinas) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="p-4 rounded-2xl bg-orange-50/70 dark:bg-orange-500/10 border border-orange-200/80 dark:border-orange-500/20 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[#ED500A]">
                  <span className="text-xs font-bold uppercase tracking-wider">Total Ventas (Bruto)</span>
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                    {formatCop(totalSalesGross)}
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Facturación total del día
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
                    {formatCop(netSalesWithoutTips)}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Ventas netas de productos y servicios
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span className="text-xs font-bold uppercase tracking-wider">Propinas</span>
                  <HeartHandshake className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400">
                    {formatCop(tipsTotal)}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Propinas recaudadas para el personal
                  </p>
                </div>
              </div>
            </div>

            {/* Canales (Mostrador, Mesas, Domicilios, Online) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              {/* Mostrador */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] flex flex-col justify-between shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Mostrador</span>
                  <Store className="w-4 h-4 text-orange-500" />
                </div>
                <div className="mt-2">
                  <span className="text-base sm:text-lg font-bold font-mono text-slate-800 dark:text-slate-200">
                    {formatCop(closureData.metrics.counterSales)}
                  </span>
                  <p className="text-[10px] text-slate-400">POS / Para llevar</p>
                </div>
              </div>

              {/* Mesas */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] flex flex-col justify-between shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Mesas</span>
                  <UtensilsCrossed className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="mt-2">
                  <span className="text-base sm:text-lg font-bold font-mono text-slate-800 dark:text-slate-200">
                    {formatCop(closureData.metrics.tablesSales)}
                  </span>
                  <p className="text-[10px] text-slate-400">Consumo en salón</p>
                </div>
              </div>

              {/* Domicilios */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] flex flex-col justify-between shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Domicilios</span>
                  <Truck className="w-4 h-4 text-blue-500" />
                </div>
                <div className="mt-2">
                  <span className="text-base sm:text-lg font-bold font-mono text-slate-800 dark:text-slate-200">
                    {formatCop(closureData.metrics.deliverySales)}
                  </span>
                  <p className="text-[10px] text-slate-400">Reparto / Despacho</p>
                </div>
              </div>

              {/* Online */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] flex flex-col justify-between shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Online</span>
                  <Globe className="w-4 h-4 text-purple-500" />
                </div>
                <div className="mt-2">
                  <span className="text-base sm:text-lg font-bold font-mono text-slate-800 dark:text-slate-200">
                    {formatCop(closureData.metrics.onlineSales)}
                  </span>
                  <p className="text-[10px] text-slate-400">Menú QR / Web</p>
                </div>
              </div>
            </div>
          </div>

          {/* 3. CUADRE POR MÉTODO DE PAGO */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  2. Cuadre por Método de Pago
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Compara los valores del sistema contra el arqueo contado y calcula diferencias automáticamente.
                </p>
              </div>
              {closureData.isSaved && (
                <span className="text-xs text-slate-500 flex items-center gap-1 font-semibold">
                  <Lock className="w-3.5 h-3.5" /> Lectura inmutable
                </span>
              )}
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
                        {formatCop(item.systemTotal)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {closureData.isSaved ? (
                          <span className="font-bold text-slate-900 dark:text-white">
                            {formatCop(item.countedTotal)}
                          </span>
                        ) : (
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
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-bold">
                        {item.difference === 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400">$ 0</span>
                        ) : item.difference > 0 ? (
                          <span className="text-blue-600 dark:text-blue-400">
                            +{formatCop(item.difference)}
                          </span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400">
                            {formatCop(item.difference)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 dark:border-white/10 font-bold text-xs bg-slate-50/80 dark:bg-white/[0.02]">
                    <td className="py-3 px-3 text-slate-900 dark:text-white uppercase font-body">
                      Total General
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-900 dark:text-white">
                      {formatCop(computedTotalSystem)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-900 dark:text-white">
                      {formatCop(computedTotalCounted)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-sm">
                      {computedTotalDifference === 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          $ 0 (Cuadrado)
                        </span>
                      ) : computedTotalDifference > 0 ? (
                        <span className="text-blue-600 dark:text-blue-400">
                          +{formatCop(computedTotalDifference)} (Sobrante)
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400">
                          {formatCop(computedTotalDifference)} (Faltante)
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* 4. NOTAS DEL CIERRE (OPCIONAL) Y ACCIONES */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="closure-observations"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                3. Notas del cierre <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <textarea
                id="closure-observations"
                rows={3}
                disabled={closureData.isSaved}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Novedades del día, justificaciones de descuadre, incidentes con terminales o comprobantes..."
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A] disabled:opacity-70 disabled:bg-slate-50 dark:disabled:bg-white/[0.02]"
              />
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 dark:border-white/5">
              <div className="text-xs text-slate-400">
                {closureData.isSaved ? (
                  <span>
                    Cierre realizado el{" "}
                    {new Date(closureData.closureRecord?.createdAt || "").toLocaleString("es-CO")}
                  </span>
                ) : (
                  <span>Al guardar el cierre, el registro quedará registrado formalmente.</span>
                )}
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                {/* BOTÓN EXPORTAR PDF */}
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

                {/* BOTÓN GUARDAR CIERRE DEL DÍA */}
                {!closureData.isSaved && (
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
                        <span>Guardar Cierre del Día</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
