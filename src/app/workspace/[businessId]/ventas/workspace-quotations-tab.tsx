"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Search,
  Plus,
  RefreshCw,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Eye,
  ShoppingCart,
  Copy,
  Ban,
  Loader2,
  TrendingUp,
  Receipt,
  ArrowRight,
  X,
} from "lucide-react";
import { Quotation, QuotationKPIs, QuotationStatus } from "@/lib/quotations/types";
import { formatCOP } from "@/lib/pos/types";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/confirm-modal";

interface WorkspaceQuotationsTabProps {
  businessId: string;
}

export function WorkspaceQuotationsTab({ businessId }: WorkspaceQuotationsTabProps) {
  const router = useRouter();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [kpis, setKpis] = useState<QuotationKPIs | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | QuotationStatus>("all");
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [quotationToCancel, setQuotationToCancel] = useState<Quotation | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { getQuotationsAction, getQuotationsKPIsAction } = await import(
        "@/app/workspace/[businessId]/ventas/quotation-actions"
      );

      const [quotesRes, kpisRes] = await Promise.all([
        getQuotationsAction(businessId, {
          search: search.trim() || undefined,
          status: statusFilter,
          page: 1,
          pageSize: 50,
        }),
        getQuotationsKPIsAction(businessId),
      ]);

      if (quotesRes.success && quotesRes.quotations) {
        setQuotations(quotesRes.quotations);
      }
      if (kpisRes.success && kpisRes.kpis) {
        setKpis(kpisRes.kpis);
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al cargar cotizaciones.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [businessId, statusFilter]);

  // Búsqueda en vivo con debounce
  useEffect(() => {
    const t = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleCancelQuotation = async () => {
    if (!quotationToCancel) return;
    setIsCancelling(true);
    try {
      const { cancelQuotationAction } = await import(
        "@/app/workspace/[businessId]/ventas/quotation-actions"
      );
      const res = await cancelQuotationAction(businessId, quotationToCancel.id);
      if (res.success) {
        toast.success(`Cotización ${quotationToCancel.quotationNumber} anulada.`);
        setQuotationToCancel(null);
        loadData();
      } else {
        toast.error(res.error || "No se pudo anular la cotización.");
      }
    } catch {
      toast.error("Error al procesar la anulación.");
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusBadge = (quote: Quotation) => {
    if (quote.status === "converted") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Convertida a venta
        </span>
      );
    }
    if (quote.status === "cancelled") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10">
          <Ban className="w-3.5 h-3.5" />
          Anulada
        </span>
      );
    }
    if (quote.isExpired || quote.status === "expired") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
          <AlertCircle className="w-3.5 h-3.5" />
          Vencida
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
        <Clock className="w-3.5 h-3.5" />
        Vigente
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. KPIS EJECUTIVOS DE COTIZACIONES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI: Vigentes */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0E131F] border border-slate-200/80 dark:border-white/10 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Cotizaciones Vigentes</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {kpis?.pendingCount ?? 0}
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
            {formatCOP(kpis?.pendingTotalAmount ?? 0)} en negociación
          </div>
        </div>

        {/* KPI: Convertidas */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0E131F] border border-slate-200/80 dark:border-white/10 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Convertidas a Venta</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {kpis?.convertedCount ?? 0}
          </div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            {formatCOP(kpis?.convertedTotalAmount ?? 0)} facturados
          </div>
        </div>

        {/* KPI: Tasa de Conversión */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0E131F] border border-slate-200/80 dark:border-white/10 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Tasa de Conversión</span>
            <TrendingUp className="w-4 h-4 text-[#ED500A]" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {kpis?.conversionRatePercentage ?? 0}%
          </div>
          <div className="text-xs text-slate-400">
            De cotizaciones concluidas
          </div>
        </div>

        {/* KPI: Vencidas */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0E131F] border border-slate-200/80 dark:border-white/10 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Vencidas / Expiradas</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {kpis?.expiredCount ?? 0}
          </div>
          <div className="text-xs text-slate-400">
            Superaron la fecha de vigencia
          </div>
        </div>
      </div>

      {/* 2. BARRA DE HERRAMIENTAS Y ACCIONES */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0E131F] border border-slate-200/80 dark:border-white/10 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Buscador */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por número (COT-2026-...), cliente o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 text-slate-900 dark:text-white placeholder:text-slate-400"
          />
        </div>

        {/* Filtros de estado y botón nueva cotización */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-xl">
            {[
              { id: "all", label: "Todas" },
              { id: "pending", label: "Vigentes" },
              { id: "converted", label: "Convertidas" },
              { id: "expired", label: "Vencidas" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === tab.id
                    ? "bg-white dark:bg-[#1A2234] text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            title="Refrescar datos"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <Link
            href={`/workspace/${businessId}/pos`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#ED500A] hover:bg-[#ED500A]/90 text-white shadow-sm transition-all whitespace-nowrap active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Cotización en POS</span>
          </Link>
        </div>
      </div>

      {/* 3. LISTADO TABULAR DE COTIZACIONES */}
      <div className="bg-white dark:bg-[#0E131F] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-[#ED500A]" />
            <span className="text-xs">Cargando cotizaciones comerciales...</span>
          </div>
        ) : quotations.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
            <div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                No hay cotizaciones para mostrar
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Puedes crear cotizaciones agregando productos al carrito en el punto de venta (POS) y
                pulsando «Crear cotización».
              </p>
            </div>
            <Link
              href={`/workspace/${businessId}/pos`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#ED500A] text-white shadow-xs"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Ir al POS</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/10 text-slate-500 font-bold">
                <tr>
                  <th className="py-3 px-4">Cotización</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Fecha Emisión</th>
                  <th className="py-3 px-4">Vigencia / Vencimiento</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {quotations.map((quote) => (
                  <tr
                    key={quote.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Número de cotización */}
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#ED500A]" />
                        <span>{quote.quotationNumber}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {quote.items.length} {quote.items.length === 1 ? "producto" : "productos"}
                      </span>
                    </td>

                    {/* Cliente */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {quote.customerName}
                      </div>
                      {quote.customerPhone && (
                        <div className="text-[11px] text-slate-400">{quote.customerPhone}</div>
                      )}
                    </td>

                    {/* Fecha de Emisión */}
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      {new Date(quote.createdAt).toLocaleDateString("es-CO", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>

                    {/* Vigencia / Vencimiento */}
                    <td className="py-3.5 px-4">
                      <div className="text-slate-800 dark:text-slate-200 font-medium">
                        {new Date(quote.validUntil).toLocaleDateString("es-CO", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                      <div className="text-[11px]">
                        {quote.status === "converted" ? (
                          <span className="text-emerald-500">Cerrada exitosamente</span>
                        ) : quote.isExpired ? (
                          <span className="text-rose-500 font-bold">Vencida</span>
                        ) : quote.daysRemaining !== undefined && quote.daysRemaining >= 0 ? (
                          <span className="text-blue-500 font-medium">
                            Resta(n) {quote.daysRemaining} día(s)
                          </span>
                        ) : null}
                      </div>
                    </td>

                    {/* Total */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="font-black text-sm text-slate-900 dark:text-white font-mono">
                        {formatCOP(quote.total)}
                      </div>
                    </td>

                    {/* Estado */}
                    <td className="py-3.5 px-4 text-center">{getStatusBadge(quote)}</td>

                    {/* Acciones */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Botón Ver Detalle */}
                        <button
                          type="button"
                          onClick={() => setSelectedQuotation(quote)}
                          className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                          title="Ver detalle de la cotización"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Botón Convertir a Venta */}
                        <Link
                          href={`/workspace/${businessId}/pos?quotationId=${quote.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#ED500A] hover:bg-[#ED500A]/90 text-white shadow-xs transition-transform active:scale-[0.98]"
                          title="Cargar productos en el carrito del POS y proceder a facturar"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>Convertir a venta</span>
                        </Link>

                        {/* Botón Anular si está pendiente */}
                        {quote.status === "pending" && !quote.isExpired && (
                          <button
                            type="button"
                            onClick={() => setQuotationToCancel(quote)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Anular cotización"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DETALLE DE COTIZACIÓN */}
      {selectedQuotation && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#121624] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl max-w-lg w-full p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-[#ED500A]">
                  {selectedQuotation.quotationNumber}
                </span>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Detalle de Cotización
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedQuotation(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1 text-xs">
              <p>
                <strong className="text-slate-700 dark:text-slate-300">Cliente:</strong>{" "}
                {selectedQuotation.customerName}
              </p>
              {selectedQuotation.customerPhone && (
                <p>
                  <strong className="text-slate-700 dark:text-slate-300">Teléfono:</strong>{" "}
                  {selectedQuotation.customerPhone}
                </p>
              )}
              {selectedQuotation.customerEmail && (
                <p>
                  <strong className="text-slate-700 dark:text-slate-300">Email:</strong>{" "}
                  {selectedQuotation.customerEmail}
                </p>
              )}
              <p>
                <strong className="text-slate-700 dark:text-slate-300">Vigencia:</strong> Válida
                hasta el {new Date(selectedQuotation.validUntil).toLocaleDateString("es-CO")}
              </p>
              {selectedQuotation.notes && (
                <p className="italic text-slate-500">
                  <strong>Observaciones:</strong> {selectedQuotation.notes}
                </p>
              )}
            </div>

            {/* Tabla de ítems */}
            <div className="border border-slate-200/80 dark:border-white/10 rounded-xl overflow-hidden text-xs">
              <div className="bg-slate-50 dark:bg-white/[0.03] px-3 py-2 font-bold text-slate-500 flex justify-between">
                <span>Producto / Descripción</span>
                <span>Total</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-48 overflow-y-auto">
                {selectedQuotation.items.map((it, idx) => (
                  <div key={idx} className="px-3 py-2 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {it.quantity}x {it.productName} {it.variantName ? `(${it.variantName})` : ""}
                      </p>
                      {it.selectedModifiers && it.selectedModifiers.length > 0 && (
                        <p className="text-[10px] text-slate-400">
                          + {it.selectedModifiers.map((m) => m.optionName).join(", ")}
                        </p>
                      )}
                    </div>
                    <span className="font-mono font-medium">{formatCOP(it.lineTotal)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totales */}
            <div className="space-y-1 text-xs pt-1 border-t border-slate-100 dark:border-white/5">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>{formatCOP(selectedQuotation.subtotal)}</span>
              </div>
              {selectedQuotation.taxTotal > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>IVA</span>
                  <span>{formatCOP(selectedQuotation.taxTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-white pt-1">
                <span>Total</span>
                <span className="text-[#ED500A]">{formatCOP(selectedQuotation.total)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedQuotation(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl"
              >
                Cerrar
              </button>
              <Link
                href={`/workspace/${businessId}/pos?quotationId=${selectedQuotation.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-xl shadow-xs"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Cargar en POS</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PARA ANULAR COTIZACIÓN */}
      <ConfirmModal
        isOpen={Boolean(quotationToCancel)}
        onClose={() => setQuotationToCancel(null)}
        onConfirm={handleCancelQuotation}
        title={`¿Anular cotización ${quotationToCancel?.quotationNumber}?`}
        description="Esta cotización quedará marcada como anulada y no podrá convertirse en venta."
        confirmText={isCancelling ? "Anulando..." : "Anular cotización"}
        variant="danger"
      />
    </div>
  );
}
