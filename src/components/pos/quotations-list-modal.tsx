"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  FileText,
  Search,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShoppingCart,
  Loader2,
  RefreshCw,
  Eye,
  Filter,
  Check,
  Ban,
} from "lucide-react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Quotation, QuotationStatus } from "@/lib/quotations/types";
import { formatCOP, PosCartItem } from "@/lib/pos/types";
import { toast } from "sonner";

interface QuotationsListModalProps {
  isOpen: boolean;
  businessId: string;
  onClose: () => void;
  onLoadIntoCart: (quotation: Quotation) => void;
}

export function QuotationsListModal({
  isOpen,
  businessId,
  onClose,
  onLoadIntoCart,
}: QuotationsListModalProps) {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | QuotationStatus>("all");
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);

  const fetchQuotations = async () => {
    setIsLoading(true);
    try {
      const { getQuotationsAction } = await import(
        "@/app/workspace/[businessId]/ventas/quotation-actions"
      );
      const res = await getQuotationsAction(businessId, {
        search: search.trim() || undefined,
        status: statusFilter,
        page: 1,
        pageSize: 50,
      });

      if (res.success && res.quotations) {
        setQuotations(res.quotations);
      } else {
        toast.error(res.error || "No se pudieron cargar las cotizaciones.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al consultar cotizaciones.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchQuotations();
    }
  }, [isOpen, statusFilter]);

  // Búsqueda en cliente o recarga con debounce si cambia search
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => {
      fetchQuotations();
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleConvert = (quote: Quotation) => {
    onLoadIntoCart(quote);
    onClose();
    toast.success(`Cotización «${quote.quotationNumber}» cargada en la venta actual.`);
  };

  const getStatusBadge = (quote: Quotation) => {
    if (quote.status === "converted") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-3 h-3" />
          Convertida a venta
        </span>
      );
    }
    if (quote.status === "cancelled") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
          <Ban className="w-3 h-3" />
          Anulada
        </span>
      );
    }
    if (quote.isExpired || quote.status === "expired") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400">
          <AlertCircle className="w-3 h-3" />
          Vencida
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400">
        <Clock className="w-3 h-3" />
        Vigente
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
        <div className="relative w-full max-w-3xl bg-white dark:bg-[#0E131F] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Cotizaciones Emitidas
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Selecciona una cotización para cargar sus productos al carrito y facturar
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filtros y búsqueda */}
          <div className="p-4 border-b border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row gap-3 bg-slate-50/40 dark:bg-white/[0.01]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por #COT, cliente o teléfono..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30"
              />
            </div>

            {/* Píldoras de estado */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    statusFilter === tab.id
                      ? "bg-[#ED500A] text-white shadow-xs"
                      : "bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10"
                  }`}
                >
                  {tab.label}
                </button>
              ))}

              <button
                type="button"
                onClick={fetchQuotations}
                disabled={isLoading}
                className="p-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                title="Actualizar listado"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Listado de cotizaciones */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[300px]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-[#ED500A]" />
                <span className="text-xs">Cargando cotizaciones...</span>
              </div>
            ) : quotations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2 text-center">
                <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  No se encontraron cotizaciones
                </p>
                <p className="text-xs text-slate-400 max-w-sm">
                  Crea cotizaciones desde el carrito del POS pulsando el botón «Crear cotización».
                </p>
              </div>
            ) : (
              quotations.map((quote) => (
                <div
                  key={quote.id}
                  className="bg-white dark:bg-[#131826] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 hover:border-slate-300 dark:hover:border-white/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs text-[#ED500A] bg-[#ED500A]/10 px-2 py-0.5 rounded-md">
                        {quote.quotationNumber}
                      </span>
                      {getStatusBadge(quote)}
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(quote.createdAt).toLocaleDateString("es-CO")}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {quote.customerName}
                      </span>
                      {quote.customerPhone && (
                        <span className="text-xs text-slate-400">· {quote.customerPhone}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                      <span>{quote.items.length} {quote.items.length === 1 ? "ítem" : "ítems"}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1 text-[11px]">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {quote.isExpired ? (
                          <span className="text-rose-500 font-semibold">Expiró</span>
                        ) : (
                          <span>
                            Vence:{" "}
                            <strong>
                              {new Date(quote.validUntil).toLocaleDateString("es-CO", {
                                month: "short",
                                day: "numeric",
                              })}
                            </strong>
                          </span>
                        )}
                      </span>
                      {quote.notes && (
                        <>
                          <span>·</span>
                          <span className="truncate max-w-[200px] italic">«{quote.notes}»</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Acciones e importe */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-white/5">
                    <div className="text-left sm:text-right">
                      <div className="text-xs text-slate-400">Total</div>
                      <div className="text-base font-black text-slate-900 dark:text-white">
                        {formatCOP(quote.total)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedQuotation(quote)}
                        className="p-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                        title="Ver detalle"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleConvert(quote)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#ED500A] hover:bg-[#ED500A]/90 text-white shadow-xs transition-all active:scale-[0.98]"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>Convertir a venta</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Modal secundario de detalle de cotización */}
          {selectedQuotation && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
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
                            {it.quantity}x {it.productName}{" "}
                            {it.variantName ? `(${it.variantName})` : ""}
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
                  <button
                    type="button"
                    onClick={() => {
                      handleConvert(selectedQuotation);
                      setSelectedQuotation(null);
                    }}
                    className="px-4 py-2 text-xs font-bold bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-xl shadow-xs"
                  >
                    Cargar en carrito
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
