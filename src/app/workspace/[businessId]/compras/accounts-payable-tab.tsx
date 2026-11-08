"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  CreditCard,
  Search,
  Filter,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  DollarSign,
  Banknote,
  RefreshCw,
  Loader2,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Building2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatCOP } from "@/config/plans";
import {
  AccountsPayableWithDetails,
  AccountsPayableKPIs,
  AccountsPayableFilters,
  Supplier,
} from "@/lib/purchases/types";
import {
  getAccountsPayableAction,
  getAccountsPayableKPIsAction,
  getSuppliersAction,
} from "./actions";
import { PaymentModal } from "./payment-modal";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";

interface Props {
  businessId: string;
}

export function AccountsPayableTab({ businessId }: Props) {
  const [accounts, setAccounts] = useState<AccountsPayableWithDetails[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [kpis, setKpis] = useState<AccountsPayableKPIs>({
    totalBalance: 0,
    overdueBalance: 0,
    upcomingBalance: 0,
    pendingAccountsCount: 0,
    overdueAccountsCount: 0,
  });

  const [isLoading, setIsLoading] = useState(true);

  // Filtros
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "partial" | "paid" | "overdue">("all");
  const [dueDateRange, setDueDateRange] = useState<"today" | "next_7d" | "this_month" | "overdue" | "all">("all");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  // Modal de pago
  const [selectedAccountForPayment, setSelectedAccountForPayment] = useState<AccountsPayableWithDetails | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [apRes, kpiRes, supRes] = await Promise.all([
        getAccountsPayableAction(businessId, {
          status: statusFilter,
          supplierId: selectedSupplier !== "all" ? selectedSupplier : undefined,
          dueDateRange: dueDateRange !== "all" ? dueDateRange : undefined,
          search: search.trim() || undefined,
        }),
        getAccountsPayableKPIsAction(businessId),
        getSuppliersAction(businessId),
      ]);

      if (apRes.success && apRes.data) setAccounts(apRes.data);
      if (kpiRes.success && kpiRes.data) setKpis(kpiRes.data);
      if (supRes.success && supRes.data) setSuppliers(supRes.data);
    } catch (err: any) {
      toast.error("Error al cargar cuentas por pagar", {
        description: err.message || "Fallo en la consulta de datos.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [businessId, statusFilter, selectedSupplier, dueDateRange, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenPayment = (account: AccountsPayableWithDetails) => {
    setSelectedAccountForPayment(account);
    setIsPaymentModalOpen(true);
  };

  const getStatusBadge = (status: string, isOverdue: boolean) => {
    if (status === "paid") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3" />
          <span>Pagada</span>
        </span>
      );
    }

    if (status === "overdue" || isOverdue) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <AlertTriangle className="w-3 h-3" />
          <span>Vencida</span>
        </span>
      );
    }

    if (status === "partial" || status === "partially_paid") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
          <Clock className="w-3 h-3" />
          <span>Pago Parcial</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
        <Clock className="w-3 h-3" />
        <span>Pendiente</span>
      </span>
    );
  };

  const getDueDateLabel = (account: AccountsPayableWithDetails) => {
    const formatted = new Date(account.dueDate).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    if (account.status === "paid") {
      return <span className="text-slate-500">{formatted}</span>;
    }

    if (account.isOverdue) {
      const days = Math.abs(account.daysUntilDue);
      return (
        <div>
          <span className="font-semibold text-rose-600 dark:text-rose-400 block">{formatted}</span>
          <span className="text-3xs text-rose-500 font-bold block">
            Vencida hace {days} {days === 1 ? "día" : "días"}
          </span>
        </div>
      );
    }

    if (account.daysUntilDue === 0) {
      return (
        <div>
          <span className="font-bold text-amber-600 block">{formatted}</span>
          <span className="text-3xs text-amber-500 font-bold block">¡Vence hoy!</span>
        </div>
      );
    }

    if (account.daysUntilDue <= 7) {
      return (
        <div>
          <span className="font-semibold text-slate-800 dark:text-slate-200 block">{formatted}</span>
          <span className="text-3xs text-amber-600 font-bold block">
            Vence en {account.daysUntilDue} {account.daysUntilDue === 1 ? "día" : "días"}
          </span>
        </div>
      );
    }

    return <span className="text-slate-600 dark:text-slate-300">{formatted}</span>;
  };

  return (
    <div className="space-y-6">
      {/* 1. TARJETAS DE INDICADORES (KPIS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Por Pagar */}
        <div className="p-4 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total por Pagar
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {formatCOP(kpis.totalBalance)}
          </p>
          <span className="text-[11px] text-slate-400">
            {kpis.pendingAccountsCount} {kpis.pendingAccountsCount === 1 ? "factura pendiente" : "facturas pendientes"}
          </span>
        </div>

        {/* Vencido */}
        <div className="p-4 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Saldo Vencido
            </span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">
            {formatCOP(kpis.overdueBalance)}
          </p>
          <span className="text-[11px] text-rose-500 font-medium">
            {kpis.overdueAccountsCount} {kpis.overdueAccountsCount === 1 ? "cuenta en mora" : "cuentas en mora"}
          </span>
        </div>

        {/* Próximo a Vencer (7 días) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Próximo a Vencer
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
            {formatCOP(kpis.upcomingBalance)}
          </p>
          <span className="text-[11px] text-amber-600 font-medium">
            Vence en los próximos 7 días
          </span>
        </div>

        {/* Proveedores con deuda */}
        <div className="p-4 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Proveedores
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {suppliers.length}
          </p>
          <span className="text-[11px] text-slate-400">
            Directorio activo
          </span>
        </div>
      </div>

      {/* 2. BARRA DE FILTROS Y ESTADOS */}
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
          {/* Sub-Pestañas de Estado */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-slate-100 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/[0.06]">
            {[
              { id: "all", label: "Todas" },
              { id: "pending", label: "Pendientes" },
              { id: "partial", label: "Parciales" },
              { id: "overdue", label: "Vencidas" },
              { id: "paid", label: "Pagadas" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === tab.id
                    ? "bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Buscador */}
            <div className="flex-1 sm:w-64">
              <SearchInput
                inputSize="sm"
                placeholder="Buscar por proveedor, compra, factura..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClear={() => setSearch("")}
              />
            </div>

            {/* Filtro Proveedor */}
            <Select
              selectSize="sm"
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
            >
              <option value="all">Todos los Proveedores</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>

            {/* Filtro Rango Vencimiento */}
            <Select
              selectSize="sm"
              value={dueDateRange}
              onChange={(e) => setDueDateRange(e.target.value as any)}
            >
              <option value="all">Cualquier Vencimiento</option>
              <option value="today">Vence Hoy</option>
              <option value="next_7d">Próximos 7 días</option>
              <option value="this_month">Este Mes</option>
              <option value="overdue">Solo Vencidas</option>
            </Select>

            {/* Recargar */}
            <button
              onClick={() => loadData()}
              title="Actualizar cuentas por pagar"
              className="p-2 rounded-xl border border-slate-200/80 dark:border-white/[0.08] text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 3. TABLA DE CUENTAS POR PAGAR */}
      <div className="bg-white dark:bg-[#0E131F] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin mb-3 text-purple-600" />
            <p className="text-sm">Consultando cuentas por pagar...</p>
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              No hay cuentas por pagar pendientes
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
              Las compras a crédito registradas generarán automáticamente cuentas por pagar con control de saldo y fecha límite.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/[0.06] text-slate-500 font-semibold uppercase text-2xs tracking-wider">
                <tr>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Compra / Factura</th>
                  <th className="px-4 py-3">Vencimiento</th>
                  <th className="px-4 py-3 text-right">Total Factura</th>
                  <th className="px-4 py-3 text-right">Abonado</th>
                  <th className="px-4 py-3 text-right">Saldo Pendiente</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {accounts.map((acc) => {
                  const isSettled = acc.status === "paid" || acc.balance <= 0;

                  return (
                    <tr
                      key={acc.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors"
                    >
                      {/* Proveedor */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {acc.supplierName || (
                            <span className="text-slate-400 italic">Proveedor libre</span>
                          )}
                        </div>
                        {acc.supplierPhone && (
                          <span className="text-2xs text-slate-400 block">
                            Tel: {acc.supplierPhone}
                          </span>
                        )}
                      </td>

                      {/* Compra / Factura */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {acc.purchaseNumber || "—"}
                        </div>
                        {acc.purchaseInvoiceNumber && (
                          <span className="text-2xs text-slate-400 block font-mono">
                            Fact: {acc.purchaseInvoiceNumber}
                          </span>
                        )}
                      </td>

                      {/* Vencimiento */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {getDueDateLabel(acc)}
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right text-slate-600 dark:text-slate-300 font-medium">
                        {formatCOP(acc.totalAmount)}
                      </td>

                      {/* Abonado */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCOP(acc.paidAmount)}
                      </td>

                      {/* Saldo Pendiente */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right font-black text-rose-600 dark:text-rose-400">
                        {formatCOP(acc.balance)}
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        {getStatusBadge(acc.status, acc.isOverdue)}
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenPayment(acc)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              isSettled
                                ? "bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                            }`}
                          >
                            <Banknote className="w-3.5 h-3.5" />
                            <span>{isSettled ? "Ver Pagos" : "Abonar"}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE REGISTRO DE PAGOS / ABONOS */}
      <PaymentModal
        businessId={businessId}
        isOpen={isPaymentModalOpen}
        account={selectedAccountForPayment}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedAccountForPayment(null);
        }}
        onSuccess={() => {
          loadData();
        }}
      />
    </div>
  );
}

