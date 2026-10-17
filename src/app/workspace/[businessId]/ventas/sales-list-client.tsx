"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Receipt,
  RotateCcw,
  Calendar,
  CreditCard,
  Banknote,
  ArrowRight,
} from "lucide-react";
import { AppPageContainer } from "@/components/layout/app-page-container";
import type { BusinessSaleDocument } from "@/lib/documents/types";
import {
  AdminDataTable,
  AdminDataTableColumn,
  AdminTableToolbar,
  AdminSelect,
  AdminPagination,
  AdminEmptyState,
} from "@/components/admin/ui";

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
    startTransition(() => {
      router.push(pathname);
    });
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
      case "issued":
        return {
          label: "Emitido",
          color: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
        };
      case "cancelled":
        return {
          label: "Cancelado",
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
      title="Historial de Ventas"
      description={`Registro cronológico de comprobantes comerciales emitidos en ${businessName}.`}
      badge={
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400">
          <Receipt className="w-3.5 h-3.5" />
          Módulo de Ventas
        </span>
      }
      maxWidth="6xl"
    >
      <div className="space-y-6 font-body">
        {/* BARRA DE HERRAMIENTAS: BÚSQUEDA Y FILTROS ESTANDARIZADOS CON EL MÓDULO USUARIOS */}
        <AdminTableToolbar
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
            <>
              {/* Filtro de Estado */}
              <AdminSelect
                value={status}
                onChange={(val) => {
                  setStatus(val);
                  applyFilters({ status: val });
                }}
                options={[
                  { value: "all", label: "Todos los estados" },
                  { value: "paid", label: "Pagado" },
                  { value: "completed", label: "Completado" },
                  { value: "issued", label: "Emitido" },
                  { value: "cancelled", label: "Cancelado" },
                  { value: "refunded", label: "Reembolsado" },
                ]}
              />

              {/* Filtro de Método de Pago */}
              <AdminSelect
                value={paymentMethod}
                onChange={(val) => {
                  setPaymentMethod(val);
                  applyFilters({ paymentMethod: val });
                }}
                options={[
                  { value: "all", label: "Todos los pagos" },
                  { value: "cash", label: "Efectivo" },
                  { value: "transfer", label: "Transferencia" },
                  { value: "card", label: "Tarjeta" },
                  { value: "credit", label: "Crédito" },
                  { value: "other", label: "Otro" },
                ]}
              />

              {/* Filtros de Rango de Fecha */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-600 dark:text-slate-300">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-[11px] text-slate-400 font-mono">Desde:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    applyFilters({ startDate: e.target.value });
                  }}
                  className="bg-transparent text-xs text-slate-700 dark:text-slate-200 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-600 dark:text-slate-300">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-[11px] text-slate-400 font-mono">Hasta:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    applyFilters({ endDate: e.target.value });
                  }}
                  className="bg-transparent text-xs text-slate-700 dark:text-slate-200 focus:outline-none"
                />
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                  title="Restablecer filtros"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpiar</span>
                </button>
              )}
            </>
          }
        />

        {/* TABLA UNIFICADA CON ADMIN-DATA-TABLE */}
        <AdminDataTable<BusinessSaleDocument>
          data={documents}
          columns={[
            {
              header: "Comprobante",
              render: (doc) => (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-slate-200 to-slate-100 dark:from-white/10 dark:to-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-200 shrink-0">
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
                    <span className="text-[11px] text-slate-400 capitalize">
                      {doc.documentType === "sale" ? "Venta directa" : doc.documentType}
                    </span>
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
                <Link
                  href={`/workspace/${businessId}/ventas/${doc.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-800 dark:text-white transition-colors"
                >
                  <span>Detalle</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </Link>
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
                className="p-4 rounded-2xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 shadow-xs space-y-3 font-body"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200">
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
                  <Link
                    href={`/workspace/${businessId}/ventas/${doc.id}`}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/[0.04] text-xs font-semibold text-slate-800 dark:text-white hover:bg-slate-200 transition-colors"
                  >
                    <span>Ver Detalle</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
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
      </div>
    </AppPageContainer>
  );
}
