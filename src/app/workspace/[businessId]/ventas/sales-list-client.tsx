"use client";

import React, { useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Receipt,
  RotateCcw,
  Calendar,
  CreditCard,
  Banknote,
  ArrowRight,
  Eye,
  FileText,
  MoreHorizontal,
  Printer,
  Download,
  MessageCircle,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { AppPageContainer } from "@/components/layout/app-page-container";
import type { BusinessSaleDocument } from "@/lib/documents/types";
import { WorkspaceQuotationsTab } from "./workspace-quotations-tab";
import {
  DataTable,
  DataTableColumn,
} from "@/components/ui/data-table";
import { TableToolbar } from "@/components/ui/table-toolbar";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { ModalPortal } from "@/components/ui/modal-portal";
import { ThermalTicketModal } from "@/components/printing/thermal-ticket";
import { downloadSalePdfAction } from "./actions";

interface SalesListClientProps {
  businessId: string;
  businessName: string;
  businessTimezone: string;
  canCreateSale: boolean;
  documents: BusinessSaleDocument[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  filters: {
    search: string;
    status: string;
    paymentMethod: string;
    startDate: string;
    endDate: string;
  };
}

const STATUS_OPTIONS = [
  { value: "all", label: "Todos los estados" },
  { value: "paid", label: "Pagado" },
  { value: "pending", label: "Pendiente de cobro" },
  { value: "completed", label: "Completado" },
  { value: "issued", label: "Emitido" },
  { value: "cancelled", label: "Cancelada" },
  { value: "refunded", label: "Reembolsado" },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: "all", label: "Todos los pagos" },
  { value: "cash", label: "Efectivo" },
  { value: "transfer", label: "Transferencia" },
  { value: "card", label: "Tarjeta" },
  { value: "credit", label: "Crédito" },
  { value: "other", label: "Otro" },
];

export function SalesListClient({
  businessId,
  businessName,
  businessTimezone,
  documents,
  totalCount,
  totalPages,
  currentPage,
  filters,
}: SalesListClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(filters.search);
  const [status, setStatus] = useState(filters.status);
  const [paymentMethod, setPaymentMethod] = useState(filters.paymentMethod);
  const [startDate, setStartDate] = useState(filters.startDate);
  const [endDate, setEndDate] = useState(filters.endDate);
  const [mainTab, setMainTab] = useState<"sales" | "quotations">("sales");

  // Estados de acciones de factura, modal de impresión y WhatsApp
  const [selectedInvoiceDoc, setSelectedInvoiceDoc] = useState<BusinessSaleDocument | null>(null);
  const [selectedTicketDoc, setSelectedTicketDoc] = useState<BusinessSaleDocument | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [isDownloadingPdfId, setIsDownloadingPdfId] = useState<string | null>(null);
  const [whatsappModalDoc, setWhatsappModalDoc] = useState<BusinessSaleDocument | null>(null);
  const [whatsappPhone, setWhatsappPhone] = useState("");

  // Cerrar menú contextual al hacer clic fuera
  useEffect(() => {
    const handleOutsideClick = () => {
      setOpenActionMenuId(null);
    };
    if (openActionMenuId) {
      window.addEventListener("click", handleOutsideClick);
      return () => window.removeEventListener("click", handleOutsideClick);
    }
  }, [openActionMenuId]);

  const handleDownloadPdf = async (doc: BusinessSaleDocument) => {
    setIsDownloadingPdfId(doc.id);
    try {
      const res = await downloadSalePdfAction(businessId, doc.id);
      if (!res.success || !res.base64) {
        toast.error(res.error || "No se pudo generar el archivo PDF.");
        return;
      }

      const byteCharacters = atob(res.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = res.filename || `${doc.documentNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("PDF descargado correctamente.");
    } catch (err: any) {
      toast.error(err?.message || "Error al descargar el PDF.");
    } finally {
      setIsDownloadingPdfId(null);
    }
  };

  const handleOpenWhatsapp = (doc: BusinessSaleDocument) => {
    setWhatsappModalDoc(doc);
    setWhatsappPhone(doc.customerPhone || "");
  };

  const handleSendWhatsappMessage = (doc: BusinessSaleDocument, phoneTarget: string) => {
    const cleanPhone = phoneTarget.replace(/\D/g, "");
    const payBadge = getPaymentBadge(doc.paymentMethod);
    const itemsLines = doc.items && doc.items.length > 0
      ? doc.items.map((it) => `• ${it.quantity}x ${it.description} (${formatCOP(it.total)})`).join("\n")
      : "";

    const msg = [
      `¡Hola! Te compartimos el comprobante de tu compra en *${businessName}*:`,
      ``,
      `📄 *Comprobante:* ${doc.documentNumber}`,
      `📅 *Fecha:* ${formatDate(doc.issuedAt)}`,
      `👤 *Cliente:* ${doc.customerName || "Consumidor Final"}`,
      itemsLines ? `\n🛍️ *Detalle de compra:*\n${itemsLines}\n` : "",
      `💳 *Medio de pago:* ${payBadge.label}`,
      `💰 *Total:* ${formatCOP(doc.total)}`,
      ``,
      `¡Muchas gracias por tu compra!`,
    ].filter(Boolean).join("\n");

    let targetNumber = cleanPhone;
    if (targetNumber.length === 10 && !targetNumber.startsWith("57")) {
      targetNumber = "57" + targetNumber;
    }
    const url = targetNumber
      ? `https://wa.me/${targetNumber}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    window.open(url, "_blank");
    setWhatsappModalDoc(null);
    toast.success("Abriendo WhatsApp con el comprobante...");
  };

  // Sincronizar estado local si cambian los props del servidor
  useEffect(() => {
    setSearch(filters.search);
  }, [filters.search]);

  useEffect(() => {
    setStatus(filters.status);
  }, [filters.status]);

  useEffect(() => {
    setPaymentMethod(filters.paymentMethod);
  }, [filters.paymentMethod]);

  const applyFilters = (newParams: Record<string, string>) => {
    startTransition(() => {
      const params = new URLSearchParams();
      const current = {
        search,
        status,
        paymentMethod,
        startDate,
        endDate,
        page: "1",
        ...newParams,
      };

      if (current.search.trim()) params.set("search", current.search.trim());
      if (current.status && current.status !== "all") params.set("status", current.status);
      if (current.paymentMethod && current.paymentMethod !== "all") params.set("paymentMethod", current.paymentMethod);
      if (current.startDate) params.set("startDate", current.startDate);
      if (current.endDate) params.set("endDate", current.endDate);
      if (current.page && current.page !== "1") params.set("page", current.page);

      router.push(`${pathname}?${params.toString()}`);
    });
  };

  // Filtrado reactivo en tiempo real al escribir (debounce 300ms)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (search === filters.search) return;

    const timer = setTimeout(() => {
      applyFilters({ search });
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters({ search });
  };

  const handleClearFilters = () => {
    setSearch("");
    setStatus("all");
    setPaymentMethod("all");
    setStartDate("");
    setEndDate("");
    applyFilters({ search: "", status: "all", paymentMethod: "all", startDate: "", endDate: "" });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    applyFilters({ page: String(newPage) });
  };

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("es-CO", {
        timeZone: businessTimezone,
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const getStatusBadge = (docStatus: string) => {
    switch (docStatus) {
      case "completed":
      case "paid":
        return {
          label: "Pagado",
          color: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
        };
      case "pending":
        return {
          label: "Pendiente de cobro",
          color: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
        };
      case "issued":
        return {
          label: "Emitido",
          color: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
        };
      case "cancelled":
        return {
          label: "Cancelada",
          color: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20",
        };
      case "refunded":
        return {
          label: "Reembolsado",
          color: "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20",
        };
      default:
        return {
          label: docStatus,
          color: "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10",
        };
    }
  };

  const getPaymentBadge = (method: string) => {
    switch (method) {
      case "cash":
        return { label: "Efectivo", icon: Banknote, color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20" };
      case "transfer":
        return { label: "Transferencia", icon: CreditCard, color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20" };
      case "card":
      case "credit":
        return { label: "Tarjeta", icon: CreditCard, color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20" };
      default:
        return { label: method || "Otro", icon: Receipt, color: "text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/20" };
    }
  };

  const hasActiveFilters = Boolean(
    filters.search ||
    (filters.status && filters.status !== "all") ||
    (filters.paymentMethod && filters.paymentMethod !== "all") ||
    filters.startDate ||
    filters.endDate
  );

  return (
    <AppPageContainer
      title="Historial de Ventas y Cotizaciones"
      description={`Registro cronológico de comprobantes comerciales y cotizaciones emitidas en ${businessName}.`}
      badge={
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400">
          <Receipt className="w-3.5 h-3.5" />
          Módulo de Ventas
        </span>
      }
      maxWidth="6xl"
    >
      <div className="space-y-6 font-body">
        {/* PESTAÑAS PRINCIPALES: COMPROBANTES / COTIZACIONES */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-3">
          <button
            type="button"
            onClick={() => setMainTab("sales")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              mainTab === "sales"
                ? "bg-[#ED500A] text-white shadow-xs"
                : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Comprobantes de Venta</span>
          </button>

          <button
            type="button"
            onClick={() => setMainTab("quotations")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              mainTab === "quotations"
                ? "bg-[#ED500A] text-white shadow-xs"
                : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Cotizaciones</span>
          </button>
        </div>

        {mainTab === "quotations" ? (
          <WorkspaceQuotationsTab businessId={businessId} />
        ) : (
          <>
            {/* BARRA DE HERRAMIENTAS: BÚSQUEDA Y FILTROS REORGANIZADOS Y ALINEADOS */}
            <TableToolbar
          layout="stacked"
          searchQuery={search}
          onSearchChange={setSearch}
          onSearchSubmit={handleSearchSubmit}
          searchPlaceholder="Buscar por número (DOC-2026-...) o cliente..."
          onRefresh={() => router.refresh()}
          onClearSearch={() => {
            setSearch("");
            applyFilters({ search: "" });
          }}
          isPending={isPending}
          filters={
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 w-full items-center">
              {/* Filtro de Estado */}
              <Select
                value={status}
                onChange={(val) => {
                  setStatus(val);
                  applyFilters({ status: val });
                }}
                options={STATUS_OPTIONS}
              />

              {/* Filtro de Método de Pago */}
              <Select
                value={paymentMethod}
                onChange={(val) => {
                  setPaymentMethod(val);
                  applyFilters({ paymentMethod: val });
                }}
                options={PAYMENT_METHOD_OPTIONS}
              />

              {/* Filtro Fecha Desde */}
              <div className="relative flex items-center h-10 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] px-3 focus-within:ring-2 focus-within:ring-[#ED500A]/30 focus-within:border-[#ED500A] transition-all">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-2" />
                <span className="text-[11px] text-slate-400 font-mono mr-1.5 shrink-0">Desde:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    applyFilters({ startDate: e.target.value });
                  }}
                  className="w-full bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                />
              </div>

              {/* Filtro Fecha Hasta */}
              <div className="relative flex items-center h-10 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] px-3 focus-within:ring-2 focus-within:ring-[#ED500A]/30 focus-within:border-[#ED500A] transition-all">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-2" />
                <span className="text-[11px] text-slate-400 font-mono mr-1.5 shrink-0">Hasta:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    applyFilters({ endDate: e.target.value });
                  }}
                  className="w-full bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                />
              </div>

              {/* Botón Restablecer Filtros */}
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="h-10 inline-flex items-center justify-center gap-1.5 px-3.5 rounded-xl border border-rose-200 dark:border-rose-500/20 bg-rose-50/60 dark:bg-rose-500/10 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all cursor-pointer whitespace-nowrap"
                  title="Restablecer todos los filtros"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpiar Filtros</span>
                </button>
              ) : (
                <div className="hidden xl:block" />
              )}
            </div>
          }
        />

        {/* TABLA UNIFICADA CON DATA-TABLE OFICIAL */}
        <DataTable<BusinessSaleDocument>
          isLoading={isPending}
          data={documents}
          columns={[
            {
              header: "Comprobante",
              render: (doc) => (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-200 shrink-0">
                    <Receipt className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <Link
                      href={`/workspace/${businessId}/ventas/${doc.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-mono font-bold text-slate-900 dark:text-white hover:text-[#ED500A] dark:hover:text-[#ED500A] transition-colors truncate block"
                    >
                      {doc.documentNumber}
                    </Link>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-slate-400 capitalize">
                        {doc.documentType === "sale" ? "Venta directa" : doc.documentType}
                      </span>
                      {doc.notes && doc.notes.includes("CUFE") && (
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          DIAN FEV
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ),
            },
            {
              header: "Cliente",
              headerClassName: "whitespace-nowrap",
              render: (doc) => (
                <div className="space-y-0.5 min-w-0">
                  <span className="font-semibold text-slate-900 dark:text-white block truncate">
                    {doc.customerName || "Consumidor Final"}
                  </span>
                  {doc.customerId && (
                    <span className="text-[11px] text-slate-400 font-mono block">
                      ID: {doc.customerId}
                    </span>
                  )}
                </div>
              ),
            },
            {
              header: "Fecha & Hora",
              headerClassName: "whitespace-nowrap",
              className: "whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-xs",
              render: (doc) => formatDate(doc.issuedAt),
            },
            {
              header: "Método de Pago",
              headerClassName: "whitespace-nowrap",
              className: "whitespace-nowrap",
              render: (doc) => {
                const payBadge = getPaymentBadge(doc.paymentMethod);
                const PayIcon = payBadge.icon;
                return (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${payBadge.color}`}>
                    <PayIcon className="w-3 h-3" />
                    <span>{payBadge.label}</span>
                  </span>
                );
              },
            },
            {
              header: "Estado",
              headerClassName: "whitespace-nowrap",
              className: "whitespace-nowrap",
              render: (doc) => {
                const statusBadge = getStatusBadge(doc.status);
                return (
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusBadge.color}`}>
                    {statusBadge.label}
                  </span>
                );
              },
            },
            {
              header: "Total",
              headerClassName: "whitespace-nowrap text-right",
              className: "whitespace-nowrap text-right font-mono font-extrabold text-slate-900 dark:text-white text-sm",
              align: "right",
              render: (doc) => formatCOP(doc.total),
            },
            {
              header: "Acciones",
              headerClassName: "whitespace-nowrap text-right",
              className: "whitespace-nowrap text-right",
              align: "right",
              render: (doc) => (
                <div className="inline-flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {/* Botón Factura directo */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedInvoiceDoc(doc);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20 transition-all cursor-pointer shadow-2xs"
                    title="Ver factura de venta"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Factura</span>
                  </button>

                  {/* Menú contextual ... */}
                  <div className="relative inline-block text-left">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenActionMenuId(openActionMenuId === doc.id ? null : doc.id);
                      }}
                      className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                      title="Más opciones de la venta"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    {openActionMenuId === doc.id && (
                      <div className="absolute right-0 mt-1 w-48 z-50 rounded-xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xl py-1 text-xs font-medium text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-100">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenActionMenuId(null);
                            router.push(`/workspace/${businessId}/ventas/${doc.id}`);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.04] flex items-center gap-2 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                          <span>Ver detalle</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenActionMenuId(null);
                            setSelectedTicketDoc(doc);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.04] flex items-center gap-2 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-500" />
                          <span>Reimprimir tiquete</span>
                        </button>
                        <button
                          type="button"
                          disabled={isDownloadingPdfId === doc.id}
                          onClick={() => {
                            setOpenActionMenuId(null);
                            handleDownloadPdf(doc);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.04] flex items-center gap-2 cursor-pointer"
                        >
                          {isDownloadingPdfId === doc.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                          ) : (
                            <Download className="w-3.5 h-3.5 text-blue-500" />
                          )}
                          <span>Descargar PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenActionMenuId(null);
                            handleOpenWhatsapp(doc);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.04] flex items-center gap-2 cursor-pointer text-emerald-600 dark:text-emerald-400 font-medium"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Compartir por WhatsApp</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ),
            },
          ]}
          keyExtractor={(doc) => doc.id}
          onRowClick={(doc) => router.push(`/workspace/${businessId}/ventas/${doc.id}`)}
          emptyState={{
            icon: Receipt,
            title: hasActiveFilters ? "Sin resultados para estos filtros" : "No hay ventas registradas todavía",
            description: hasActiveFilters
              ? "Prueba cambiando o limpiando los criterios de búsqueda para visualizar comprobantes."
              : "Las operaciones y comprobantes emitidos desde el Punto de venta (POS) se registrarán y listarán aquí automáticamente para su consulta.",
            onReset: hasActiveFilters ? handleClearFilters : undefined,
            resetLabel: hasActiveFilters ? "Limpiar Filtros" : undefined,
          }}
          renderMobileCard={(doc) => {
            const payBadge = getPaymentBadge(doc.paymentMethod);
            const PayIcon = payBadge.icon;
            const statusBadge = getStatusBadge(doc.status);

            return (
              <div
                key={doc.id}
                className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-3 font-body"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center font-bold text-slate-700 dark:text-slate-200">
                      <Receipt className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-mono font-bold text-sm text-slate-900 dark:text-white truncate">
                        {doc.documentNumber}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {doc.customerName || "Consumidor Final"}
                      </p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${statusBadge.color}`}>
                    {statusBadge.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100 dark:border-white/[0.04]">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">Fecha</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300 text-[11px]">
                      {formatDate(doc.issuedAt)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">Pago</span>
                    <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300 text-[11px]">
                      <PayIcon className="w-3 h-3" />
                      {payBadge.label}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-white/[0.04]">
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block font-mono">Total</span>
                    <span className="text-base font-mono font-extrabold text-[#ED500A]">
                      {formatCOP(doc.total)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedInvoiceDoc(doc);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                      title="Ver factura de venta"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Factura</span>
                    </button>

                    <div className="relative inline-block text-left">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenActionMenuId(openActionMenuId === doc.id ? null : doc.id);
                        }}
                        className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                        title="Más opciones de la venta"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      {openActionMenuId === doc.id && (
                        <div className="absolute right-0 bottom-full mb-1 w-48 z-50 rounded-xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xl py-1 text-xs font-medium text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-100">
                          <button
                            type="button"
                            onClick={() => {
                              setOpenActionMenuId(null);
                              router.push(`/workspace/${businessId}/ventas/${doc.id}`);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.04] flex items-center gap-2 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-400" />
                            <span>Ver detalle</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenActionMenuId(null);
                              setSelectedTicketDoc(doc);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.04] flex items-center gap-2 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-500" />
                            <span>Reimprimir tiquete</span>
                          </button>
                          <button
                            type="button"
                            disabled={isDownloadingPdfId === doc.id}
                            onClick={() => {
                              setOpenActionMenuId(null);
                              handleDownloadPdf(doc);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.04] flex items-center gap-2 cursor-pointer"
                          >
                            {isDownloadingPdfId === doc.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                            ) : (
                              <Download className="w-3.5 h-3.5 text-blue-500" />
                            )}
                            <span>Descargar PDF</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenActionMenuId(null);
                              handleOpenWhatsapp(doc);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.04] flex items-center gap-2 cursor-pointer text-emerald-600 dark:text-emerald-400 font-medium"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Compartir por WhatsApp</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          }}
          pagination={{
            currentPage,
            totalPages,
            totalItems: totalCount,
            currentCount: documents.length,
            itemLabel: "ventas",
            onPageChange: handlePageChange,
            isPending,
          }}
        />
          </>
        )}

        {/* MODAL DE FACTURA DE VENTA INTERACTIVO */}
        {selectedInvoiceDoc && (
          <ModalPortal>
            <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
              <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col font-body">
                {/* Cabecera del Modal */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06] shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                        Factura de Venta
                      </h3>
                      <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">
                        {selectedInvoiceDoc.documentNumber}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedInvoiceDoc(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Barra de Acciones del Comprobante */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.05] shrink-0">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Acciones de documento:
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTicketDoc(selectedInvoiceDoc)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-[#121622] border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500" />
                      <span>Imprimir</span>
                    </button>

                    <button
                      type="button"
                      disabled={isDownloadingPdfId === selectedInvoiceDoc.id}
                      onClick={() => handleDownloadPdf(selectedInvoiceDoc)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 transition-colors shadow-2xs cursor-pointer"
                    >
                      {isDownloadingPdfId === selectedInvoiceDoc.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-blue-600" />
                      )}
                      <span>Descargar PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenWhatsapp(selectedInvoiceDoc)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 transition-colors shadow-2xs cursor-pointer"
                      title="Compartir comprobante por WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Compartir por WhatsApp</span>
                    </button>
                  </div>
                </div>

                {/* Cuerpo de la Factura (Scrollable) */}
                <div className="overflow-y-auto space-y-4 pr-1 text-xs">
                  {/* Tarjeta de Encabezado Comercial */}
                  <div className="p-4 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.01] grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Negocio Emisor
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                        {businessName}
                      </h4>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5 font-mono">
                        Fecha: {formatDate(selectedInvoiceDoc.issuedAt)}
                      </p>
                    </div>

                    <div className="sm:text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Cliente Receptor
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                        {selectedInvoiceDoc.customerName || "Consumidor Final"}
                      </h4>
                      {selectedInvoiceDoc.customerId && (
                        <p className="text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                          NIT / CC: {selectedInvoiceDoc.customerId}
                        </p>
                      )}
                      {selectedInvoiceDoc.customerPhone && (
                        <p className="text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                          Tel: {selectedInvoiceDoc.customerPhone}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Badges de Estado y Método */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-mono text-[11px]">Medio de pago:</span>
                      {(() => {
                        const payBadge = getPaymentBadge(selectedInvoiceDoc.paymentMethod);
                        const PayIcon = payBadge.icon;
                        return (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${payBadge.color}`}>
                            <PayIcon className="w-3 h-3" />
                            <span>{payBadge.label}</span>
                          </span>
                        );
                      })()}
                    </div>

                    {(() => {
                      const statusBadge = getStatusBadge(selectedInvoiceDoc.status);
                      return (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${statusBadge.color}`}>
                          {statusBadge.label}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Tabla de Artículos */}
                  <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 dark:bg-white/[0.04] border-b border-slate-200/80 dark:border-white/[0.08] text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                        <tr>
                          <th className="py-2.5 px-3">Ítem / Concepto</th>
                          <th className="py-2.5 px-3 text-center">Cant.</th>
                          <th className="py-2.5 px-3 text-right">Precio</th>
                          <th className="py-2.5 px-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                        {selectedInvoiceDoc.items && selectedInvoiceDoc.items.length > 0 ? (
                          selectedInvoiceDoc.items.map((it, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                              <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                                {it.description}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono text-slate-600 dark:text-slate-300">
                                {it.quantity}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-300">
                                {formatCOP(it.unitPrice)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                {formatCOP(it.total)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-slate-400">
                              Venta directa sin desglose de ítems
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Totales */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] space-y-1.5 max-w-xs ml-auto text-xs font-mono">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Subtotal:</span>
                      <span>{formatCOP(selectedInvoiceDoc.subtotal || selectedInvoiceDoc.total)}</span>
                    </div>
                    {Number(selectedInvoiceDoc.discountTotal || 0) > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Descuento:</span>
                        <span>-{formatCOP(selectedInvoiceDoc.discountTotal || 0)}</span>
                      </div>
                    )}
                    {Number(selectedInvoiceDoc.taxTotal || 0) > 0 && (
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Impuestos:</span>
                        <span>{formatCOP(selectedInvoiceDoc.taxTotal || 0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-baseline pt-2 border-t border-slate-200 dark:border-white/10 text-sm font-bold text-slate-900 dark:text-white">
                      <span>Total:</span>
                      <span className="text-base text-emerald-600 dark:text-emerald-400">
                        {formatCOP(selectedInvoiceDoc.total)}
                      </span>
                    </div>
                  </div>

                  {selectedInvoiceDoc.notes && (
                    <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300">
                      <span className="font-bold">Observaciones: </span>
                      <span>{selectedInvoiceDoc.notes}</span>
                    </div>
                  )}
                </div>

                {/* Pie del Modal */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/[0.06] shrink-0">
                  <Link
                    href={`/workspace/${businessId}/ventas/${selectedInvoiceDoc.id}`}
                    className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-[#ED500A] transition-colors"
                  >
                    Abrir vista completa de venta →
                  </Link>

                  <button
                    type="button"
                    onClick={() => setSelectedInvoiceDoc(null)}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </ModalPortal>
        )}

        {/* MODAL DE WHATSAPP PARA VENTAS */}
        {whatsappModalDoc && (
          <ModalPortal>
            <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 font-body">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/[0.06]">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-base">
                    <MessageCircle className="w-5 h-5" />
                    <span>Enviar Comprobante por WhatsApp</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWhatsappModalDoc(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Número de WhatsApp del cliente
                    </label>
                    <input
                      type="tel"
                      value={whatsappPhone}
                      onChange={(e) => setWhatsappPhone(e.target.value)}
                      placeholder="Ej. 3001234567 o 573001234567"
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-white font-mono"
                    />
                    <span className="text-[10px] text-slate-400">
                      Si lo dejas vacío, abrirá WhatsApp para que elijas el chat destinatario.
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.06] space-y-1 text-xs">
                    <span className="font-semibold text-slate-500 dark:text-slate-400 block text-[11px] uppercase tracking-wider">
                      Resumen del comprobante:
                    </span>
                    <div className="text-slate-700 dark:text-slate-300 text-[11px] font-mono whitespace-pre-line bg-white dark:bg-white/[0.03] p-2.5 rounded-lg border border-slate-100 dark:border-white/5 max-h-48 overflow-y-auto">
                      {`¡Hola! Te compartimos el comprobante de tu compra en *${businessName}*:
📄 *Comprobante:* ${whatsappModalDoc.documentNumber}
📅 *Fecha:* ${formatDate(whatsappModalDoc.issuedAt)}
👤 *Cliente:* ${whatsappModalDoc.customerName || "Consumidor Final"}${whatsappModalDoc.items && whatsappModalDoc.items.length > 0 ? `\n\n🛍️ *Detalle de compra:*\n` + whatsappModalDoc.items.map((it) => `• ${it.quantity}x ${it.description} (${formatCOP(it.total)})`).join("\n") : ""}
💳 *Medio de pago:* ${getPaymentBadge(whatsappModalDoc.paymentMethod).label}
💰 *Total:* ${formatCOP(whatsappModalDoc.total)}

¡Muchas gracias por tu compra!`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setWhatsappModalDoc(null)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendWhatsappMessage(whatsappModalDoc, whatsappPhone)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-xs"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Abrir en WhatsApp</span>
                  </button>
                </div>
              </div>
            </div>
          </ModalPortal>
        )}

        {/* MODAL DE TIQUETE TÉRMICO */}
        {selectedTicketDoc && (
          <ThermalTicketModal
            documentNumber={selectedTicketDoc.documentNumber}
            issuedAt={selectedTicketDoc.issuedAt}
            business={{
              name: businessName,
              tradeName: businessName,
            }}
            orderType="sale"
            customer={{
              name: selectedTicketDoc.customerName,
              phone: selectedTicketDoc.customerPhone,
            }}
            items={(selectedTicketDoc.items || []).map((it) => ({
              description: it.description,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              total: it.total,
            }))}
            subtotal={selectedTicketDoc.subtotal || selectedTicketDoc.total}
            discountTotal={selectedTicketDoc.discountTotal || 0}
            taxTotal={selectedTicketDoc.taxTotal || 0}
            total={selectedTicketDoc.total}
            paymentMethod={selectedTicketDoc.paymentMethod}
            paymentStatus={selectedTicketDoc.status}
            notes={selectedTicketDoc.notes}
            isOpen={Boolean(selectedTicketDoc)}
            onClose={() => setSelectedTicketDoc(null)}
          />
        )}
      </div>
    </AppPageContainer>
  );
}
