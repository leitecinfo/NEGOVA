"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Wallet,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Users,
  Search,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  TrendingUp,
  CreditCard,
  Phone,
  Calendar,
  DollarSign,
  PieChart,
  BarChart3,
  RefreshCw,
  Loader2,
  ChevronRight,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import {
  AccountReceivable,
  AccountsReceivableKPIs,
  AccountReceivableStatus,
  TopDebtorItem,
} from "@/lib/customers/types";
import {
  getAccountsReceivableKPIsAction,
  getBusinessAccountsReceivableAction,
  getTopDebtorsAction,
} from "@/app/workspace/[businessId]/clientes/actions";
import { CustomerPaymentModal } from "./customer-payment-modal";
import Link from "next/link";

interface Props {
  businessId: string;
  initialKpis?: AccountsReceivableKPIs;
  onRefreshParent?: () => void;
}

export function CustomerPortfolioTab({
  businessId,
  initialKpis,
  onRefreshParent,
}: Props) {
  const [kpis, setKpis] = useState<AccountsReceivableKPIs>(
    initialKpis || {
      totalCreditGranted: 0,
      totalReceivable: 0,
      totalCollected: 0,
      overdueBalance: 0,
      customersWithCreditCount: 0,
      customersWithDebtCount: 0,
      overdueCustomersCount: 0,
      agingBuckets: {
        current: 0,
        days1to30: 0,
        days31to60: 0,
        daysOver60: 0,
      },
      collectionRate: 100,
      portfolioHealthRate: 100,
    }
  );

  const [receivables, setReceivables] = useState<AccountReceivable[]>([]);
  const [topDebtors, setTopDebtors] = useState<TopDebtorItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filtros de tabla
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "overdue" | "upcoming" | "partial" | "paid"
  >("active");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal de Abono
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedReceivableForPayment, setSelectedReceivableForPayment] =
    useState<AccountReceivable | null>(null);

  const formatCOP = (val: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val || 0);

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [kpiRes, recRes, debtRes] = await Promise.all([
        getAccountsReceivableKPIsAction(businessId),
        getBusinessAccountsReceivableAction(businessId),
        getTopDebtorsAction(businessId, 5),
      ]);

      if (kpiRes.success && kpiRes.data) {
        setKpis(kpiRes.data);
      }
      if (recRes.success && recRes.data) {
        setReceivables(recRes.data);
      }
      if (debtRes.success && debtRes.data) {
        setTopDebtors(debtRes.data);
      }
    } catch {
      toast.error("Error al cargar los datos de cartera");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [businessId]);

  // Cuentas filtradas en memoria para búsqueda y sub-pestaña instantánea
  const filteredReceivables = useMemo(() => {
    const now = new Date();
    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);

    return receivables.filter((r) => {
      // Filtro de estado
      if (statusFilter === "active" && r.status === "paid") return false;
      if (statusFilter === "overdue" && (!r.isOverdue || r.balance <= 0)) return false;
      if (statusFilter === "partial" && r.status !== "partial") return false;
      if (statusFilter === "paid" && r.status !== "paid") return false;
      if (statusFilter === "upcoming") {
        if (r.status === "paid" || r.isOverdue) return false;
        const due = new Date(r.dueDate);
        if (due > in7Days || due < now) return false;
      }

      // Filtro de búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = r.customerName && r.customerName.toLowerCase().includes(q);
        const matchPhone = r.customerPhone && r.customerPhone.includes(q);
        const matchNotes = r.notes && r.notes.toLowerCase().includes(q);
        return matchName || matchPhone || matchNotes;
      }

      return true;
    });
  }, [receivables, statusFilter, searchQuery]);

  const handleOpenPayment = (receivable?: AccountReceivable) => {
    setSelectedReceivableForPayment(receivable || null);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSuccess = () => {
    loadData(true);
    if (onRefreshParent) onRefreshParent();
  };

  // Cálculo de porcentajes para gráficos de cartera
  const totalExposure = kpis.totalCollected + kpis.totalReceivable;
  const collectedPct =
    totalExposure > 0 ? Math.round((kpis.totalCollected / totalExposure) * 100) : 0;
  const receivablePct = 100 - collectedPct;

  const currentAging = kpis.agingBuckets.current;
  const d1to30Aging = kpis.agingBuckets.days1to30;
  const d31to60Aging = kpis.agingBuckets.days31to60;
  const dOver60Aging = kpis.agingBuckets.daysOver60;
  const totalAgingSum = currentAging + d1to30Aging + d31to60Aging + dOver60Aging || 1;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Barra Superior de Herramientas de Cartera */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#ED500A]" />
            <span>Gestión de Cartera y Cobranzas</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Control de cuentas por cobrar, estados de mora, abonos y liquidez crediticia.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.04] text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50"
            title="Refrescar métricas"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? "animate-spin text-[#ED500A]" : ""}`}
            />
          </button>

          <button
            type="button"
            onClick={() => handleOpenPayment()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0"
          >
            <DollarSign className="w-4 h-4" />
            <span>+ Registrar Abono</span>
          </button>
        </div>
      </div>

      {/* 1. CUATRO TARJETAS DE KPIS PRINCIPALES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Por Cobrar */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Por Cobrar Total
            </span>
            <div className="p-1.5 rounded-lg bg-orange-500/10 text-[#ED500A]">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {formatCOP(kpis.totalReceivable)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {kpis.customersWithDebtCount}{" "}
            {kpis.customersWithDebtCount === 1 ? "cliente con saldo" : "clientes con saldo"}
          </div>
        </div>

        {/* KPI 2: Créditos Vencidos */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Créditos Vencidos (Mora)
            </span>
            <div className="p-1.5 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 tracking-tight">
            {formatCOP(kpis.overdueBalance)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <span>
              {kpis.overdueCustomersCount}{" "}
              {kpis.overdueCustomersCount === 1 ? "cliente en mora" : "clientes en mora"}
            </span>
          </div>
        </div>

        {/* KPI 3: Clientes con Crédito / Cupo Otorgado */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Clientes con Crédito
            </span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {kpis.customersWithCreditCount}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Cupo total asignado: {formatCOP(kpis.totalCreditGranted)}
          </div>
        </div>

        {/* KPI 4: Total Cobrado / Recaudado */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total Recaudado
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
            {formatCOP(kpis.totalCollected)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Tasa de recaudo: {kpis.collectionRate ?? 100}%
          </div>
        </div>
      </div>

      {/* 2. SECCIÓN DE ANÁLISIS VISUAL Y GRÁFICOS DE CARTERA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gráfico A: Pagado vs Por Cobrar + Salud de Cartera */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-[#ED500A]" />
              <span>Pagado vs. Por Cobrar & Salud de Cartera</span>
            </h3>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                (kpis.portfolioHealthRate ?? 100) >= 80
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : (kpis.portfolioHealthRate ?? 100) >= 60
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-red-500/10 text-red-600 dark:text-red-400"
              }`}
            >
              {(kpis.portfolioHealthRate ?? 100) >= 80
                ? "Salud Óptima"
                : (kpis.portfolioHealthRate ?? 100) >= 60
                ? "Atención Requerida"
                : "Alerta de Mora"}
            </span>
          </div>

          {/* Barra Visual Proporcional: Cobrado vs Pendiente */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-emerald-600 dark:text-emerald-400">
                Pagado: {collectedPct}% ({formatCOP(kpis.totalCollected)})
              </span>
              <span className="text-[#ED500A]">
                Por Cobrar: {receivablePct}% ({formatCOP(kpis.totalReceivable)})
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden flex">
              <div
                style={{ width: `${collectedPct}%` }}
                className="bg-emerald-500 transition-all duration-500"
              />
              <div
                style={{ width: `${receivablePct}%` }}
                className="bg-[#ED500A] transition-all duration-500"
              />
            </div>
          </div>

          {/* Salud de Cartera: Corriente vs En Mora */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04] space-y-2">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Composición del Saldo por Cobrar</span>
              <span className="font-mono">{kpis.portfolioHealthRate ?? 100}% al día</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-white dark:bg-[#12151F] border border-slate-200/50 dark:border-white/[0.04]">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                  Corriente (Al día)
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatCOP(Math.max(0, kpis.totalReceivable - kpis.overdueBalance))}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-white dark:bg-[#12151F] border border-slate-200/50 dark:border-white/[0.04]">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                  Vencido (En Mora)
                </span>
                <span className="font-bold text-red-600 dark:text-red-400">
                  {formatCOP(kpis.overdueBalance)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Gráfico B: Antigüedad de Deuda (Aging Buckets) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#ED500A]" />
              <span>Antigüedad de Deuda (Vencimientos)</span>
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Total: {formatCOP(kpis.totalReceivable)}
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {/* Al día */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Corriente (No vencido)
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatCOP(currentAging)}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                <div
                  style={{ width: `${(currentAging / totalAgingSum) * 100}%` }}
                  className="bg-emerald-500 h-full rounded-full"
                />
              </div>
            </div>

            {/* 1 - 30 días */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  1 a 30 días de mora
                </span>
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  {formatCOP(d1to30Aging)}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                <div
                  style={{ width: `${(d1to30Aging / totalAgingSum) * 100}%` }}
                  className="bg-amber-500 h-full rounded-full"
                />
              </div>
            </div>

            {/* 31 - 60 días */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  31 a 60 días de mora
                </span>
                <span className="font-bold text-orange-600 dark:text-orange-400">
                  {formatCOP(d31to60Aging)}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                <div
                  style={{ width: `${(d31to60Aging / totalAgingSum) * 100}%` }}
                  className="bg-orange-500 h-full rounded-full"
                />
              </div>
            </div>

            {/* Más de 60 días */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Más de 60 días de mora
                </span>
                <span className="font-bold text-red-600 dark:text-red-400">
                  {formatCOP(dOver60Aging)}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                <div
                  style={{ width: `${(dOver60Aging / totalAgingSum) * 100}%` }}
                  className="bg-red-500 h-full rounded-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico C: Clientes que Más Deben (Top Deudores) */}
      {topDebtors.length > 0 && (
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-[#ED500A]" />
              <span>Clientes que Más Deben (Mayor Exposición Crediticia)</span>
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Top {topDebtors.length} clientes
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {topDebtors.map((td, idx) => {
              const usagePct =
                td.creditLimit > 0
                  ? Math.min(100, Math.round((td.creditUsed / td.creditLimit) * 100))
                  : 100;

              return (
                <div
                  key={td.customerId}
                  className="p-3.5 rounded-xl border border-slate-200/70 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] flex flex-col justify-between space-y-2 hover:border-[#ED500A]/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-bold text-slate-400">
                          #{idx + 1}
                        </span>
                        <Link
                          href={`/workspace/${businessId}/clientes/${td.customerId}`}
                          className="font-bold text-sm text-slate-900 dark:text-white hover:text-[#ED500A] truncate block"
                        >
                          {td.customerName}
                        </Link>
                      </div>
                      {td.customerPhone && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" />
                          {td.customerPhone}
                        </span>
                      )}
                    </div>

                    {td.hasOverdue && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 shrink-0">
                        Mora
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Deuda:</span>
                      <span className="font-black text-slate-900 dark:text-white">
                        {formatCOP(td.creditUsed)}
                      </span>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-white/[0.08] overflow-hidden">
                      <div
                        style={{ width: `${usagePct}%` }}
                        className={`h-full rounded-full ${
                          td.hasOverdue ? "bg-red-500" : "bg-[#ED500A]"
                        }`}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Cupo: {formatCOP(td.creditLimit)}</span>
                      <span>{usagePct}% usado</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. TABLA DE PRÓXIMOS COBROS Y CUENTAS POR COBRAR */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Sub-pestañas de Estado */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {[
              { id: "active", label: "Activas con Saldo" },
              { id: "upcoming", label: "Próximos 7 Días" },
              { id: "overdue", label: "Vencidas" },
              { id: "partial", label: "Con Abonos" },
              { id: "paid", label: "Liquidadas (Pagadas)" },
              { id: "all", label: "Todas" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  statusFilter === tab.id
                    ? "bg-[#ED500A] text-white shadow-xs"
                    : "bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Buscador Rápido de Tabla */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar cliente o comanda..."
              className="w-full pl-9 pr-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.03] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/40"
            />
          </div>
        </div>

        {/* Tabla Responsiva */}
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-[#ED500A]" />
            <span className="text-xs">Cargando cuentas por cobrar...</span>
          </div>
        ) : filteredReceivables.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-400 space-y-1">
            <p className="text-xs font-semibold">No se encontraron cuentas por cobrar.</p>
            <p className="text-[11px]">
              {searchQuery
                ? "No hay cuentas que coincidan con la búsqueda."
                : "No existen cuentas registradas en este estado."}
            </p>
          </div>
        ) : (
          <div className="border border-slate-200/80 dark:border-white/[0.08] rounded-xl overflow-hidden divide-y divide-slate-200/60 dark:divide-white/[0.06]">
            {/* Header de Tabla */}
            <div className="bg-slate-50/80 dark:bg-white/[0.02] px-4 py-2.5 grid grid-cols-12 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <div className="col-span-4 sm:col-span-3">Cliente</div>
              <div className="col-span-3 sm:col-span-2">Vencimiento</div>
              <div className="hidden sm:block sm:col-span-2 text-right">Total Crédito</div>
              <div className="hidden sm:block sm:col-span-2 text-right">Abonado</div>
              <div className="col-span-3 sm:col-span-2 text-right">Saldo Pendiente</div>
              <div className="col-span-2 sm:col-span-1 text-center">Acción</div>
            </div>

            {/* Filas */}
            {filteredReceivables.map((ar) => (
              <div
                key={ar.id}
                className="px-4 py-3 grid grid-cols-12 items-center hover:bg-slate-50/50 dark:hover:bg-white/[0.02] text-xs transition-colors"
              >
                {/* Cliente */}
                <div className="col-span-4 sm:col-span-3 min-w-0 pr-2">
                  <Link
                    href={`/workspace/${businessId}/clientes/${ar.customerId}`}
                    className="font-bold text-slate-900 dark:text-white hover:text-[#ED500A] truncate block"
                  >
                    {ar.customerName || "Cliente"}
                  </Link>
                  {ar.customerPhone && (
                    <span className="text-[11px] text-slate-400 truncate block">
                      {ar.customerPhone}
                    </span>
                  )}
                </div>

                {/* Vencimiento */}
                <div className="col-span-3 sm:col-span-2">
                  <div className="font-medium text-slate-700 dark:text-slate-300">
                    {new Date(ar.dueDate).toLocaleDateString("es-CO")}
                  </div>
                  {ar.isOverdue ? (
                    <span className="text-[10px] font-bold text-red-500">
                      Mora ({ar.daysOverdue}d)
                    </span>
                  ) : ar.balance > 0 ? (
                    <span className="text-[10px] text-slate-400">
                      En {ar.daysUntilDue} días
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-500 font-semibold">
                      Completada
                    </span>
                  )}
                </div>

                {/* Total Crédito */}
                <div className="hidden sm:block sm:col-span-2 text-right font-medium text-slate-600 dark:text-slate-400">
                  {formatCOP(ar.amount)}
                </div>

                {/* Abonado */}
                <div className="hidden sm:block sm:col-span-2 text-right font-medium text-emerald-600 dark:text-emerald-400">
                  {formatCOP(ar.paidAmount)}
                </div>

                {/* Saldo Pendiente */}
                <div className="col-span-3 sm:col-span-2 text-right">
                  <span
                    className={`font-black text-xs sm:text-sm ${
                      ar.balance > 0
                        ? ar.isOverdue
                          ? "text-red-600 dark:text-red-400"
                          : "text-slate-900 dark:text-white"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {formatCOP(ar.balance)}
                  </span>
                </div>

                {/* Acción Abonar */}
                <div className="col-span-2 sm:col-span-1 text-center">
                  {ar.balance > 0 ? (
                    <button
                      type="button"
                      onClick={() => handleOpenPayment(ar)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-colors shadow-2xs"
                    >
                      Abonar
                    </button>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400">Pagada</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal para Registrar Abono */}
      {isPaymentModalOpen && (
        <CustomerPaymentModal
          businessId={businessId}
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setSelectedReceivableForPayment(null);
          }}
          onSuccess={handlePaymentSuccess}
          initialReceivable={selectedReceivableForPayment}
          availableReceivables={receivables.filter((r) => r.balance > 0)}
        />
      )}
    </div>
  );
}
