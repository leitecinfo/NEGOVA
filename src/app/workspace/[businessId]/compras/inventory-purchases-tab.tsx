"use client";

import React, { useState, useEffect, useTransition, useMemo } from "react";
import {
  ShoppingCart,
  Plus,
  Search,
  Filter,
  CreditCard,
  Banknote,
  AlertCircle,
  Calendar,
  Building2,
  FileText,
  Ban,
  Clock,
  Loader2,
  X,
  RotateCcw,
  Printer,
  Store,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Select } from "@/components/ui/select";
import { SearchInput } from "@/components/ui/search-input";
import { DatePicker } from "@/components/ui/date-picker";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { formatCOP } from "@/config/plans";
import {
  Purchase,
  PurchaseKPIs,
  PurchaseFilters,
  PurchasePeriodPreset,
  Supplier,
  AccountsPayableWithDetails,
} from "@/lib/purchases/types";
import { Product } from "@/lib/products/types";
import { Location } from "@/lib/inventory/types";
import {
  getPurchasesAction,
  getPurchaseKPIsAction,
  cancelPurchaseAction,
  getSuppliersAction,
} from "./actions";
import { PurchaseFormModal } from "./purchase-form-modal";
import { PurchaseDetailModal } from "./purchase-detail-modal";
import { AccountsPayableTab } from "./accounts-payable-tab";
import { PaymentModal } from "./payment-modal";
import { toast } from "sonner";

interface Props {
  businessId: string;
  products: Product[];
  locations: Location[];
  categories?: any[];
  initialProductId?: string | null;
}

const PERIOD_PRESETS: { id: PurchasePeriodPreset; label: string }[] = [
  { id: "today", label: "Hoy" },
  { id: "yesterday", label: "Ayer" },
  { id: "7d", label: "7 días" },
  { id: "this_week", label: "Semana" },
  { id: "this_month", label: "Mes" },
  { id: "last_month", label: "Mes anterior" },
  { id: "all", label: "Todo" },
];

const STATUS_TABS: {
  id: "all" | "cash" | "credit" | "pending" | "overdue";
  label: string;
}[] = [
  { id: "all", label: "Todas" },
  { id: "cash", label: "De contado" },
  { id: "credit", label: "A crédito" },
  { id: "pending", label: "Por pagar" },
  { id: "overdue", label: "Vencidas" },
];

export function InventoryPurchasesTab({
  businessId,
  products,
  locations,
  categories = [],
  initialProductId,
}: Props) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [kpis, setKpis] = useState<PurchaseKPIs>({
    totalPurchased: 0,
    totalPaid: 0,
    totalPendingBalance: 0,
    paidPurchasesCount: 0,
    pendingPurchasesCount: 0,
    uniqueSuppliersCount: 0,
    totalCash: 0,
    totalCredit: 0,
    dueTodayOrOverdue: 0,
    totalPurchasesCount: 0,
  });

  const [isLoading, setIsLoading] = useState(true);

  // Filtros
  const [period, setPeriod] = useState<PurchasePeriodPreset>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [statusTab, setStatusTab] = useState<
    "all" | "cash" | "credit" | "pending" | "overdue"
  >("all");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [purchaseStatusFilter, setPurchaseStatusFilter] = useState<string>("all");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>("all");
  const [paymentMethod, setPaymentMethod] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Modal Nueva Compra
  const [isNewPurchaseOpen, setIsNewPurchaseOpen] = useState(
    Boolean(initialProductId)
  );

  // Modal Cancelación
  const [purchaseToCancel, setPurchaseToCancel] = useState<Purchase | null>(
    null
  );
  const [cancellationReason, setCancellationReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  // Modal Ver Detalle
  const [selectedPurchaseDetails, setSelectedPurchaseDetails] =
    useState<Purchase | null>(null);

  // Modal Imprimir Comprobante
  const [purchaseToPrint, setPurchaseToPrint] = useState<Purchase | null>(null);

  // Submódulo activo
  const [activeModuleTab, setActiveModuleTab] = useState<
    "purchases" | "accounts_payable"
  >("purchases");
  const [accountToPay, setAccountToPay] =
    useState<AccountsPayableWithDetails | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const filterPayload: PurchaseFilters = {
        period,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        supplierId: selectedSupplier,
        paymentType: (paymentTypeFilter as any) || undefined,
        paymentMethod,
        paymentStatus: (paymentStatusFilter as any) || undefined,
        purchaseStatus: (purchaseStatusFilter as any) || undefined,
        statusTab,
        search,
      };

      const [pRes, kpiRes, sRes] = await Promise.all([
        getPurchasesAction(businessId, filterPayload),
        getPurchaseKPIsAction(businessId, {
          period,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          supplierId: selectedSupplier,
        }),
        getSuppliersAction(businessId),
      ]);

      if (pRes.success && pRes.data) setPurchases(pRes.data);
      if (kpiRes.success && kpiRes.data) setKpis(kpiRes.data);
      if (sRes.success && sRes.data) setSuppliers(sRes.data);
    } catch (err: any) {
      toast.error("Error al cargar compras", { description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [
    businessId,
    period,
    startDate,
    endDate,
    selectedSupplier,
    paymentStatusFilter,
    purchaseStatusFilter,
    paymentTypeFilter,
    paymentMethod,
    statusTab,
  ]);

  // Manejo de presets de periodo
  const handleSelectPeriodPreset = (presetId: PurchasePeriodPreset) => {
    setPeriod(presetId);
    setStartDate("");
    setEndDate("");
  };

  // Manejo de fechas manuales
  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    setPeriod("custom");
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    setPeriod("custom");
  };

  const handleClearCustomDates = () => {
    setStartDate("");
    setEndDate("");
    setPeriod("all");
  };

  // Restablecer todos los filtros ("Ver todo")
  const handleClearFilters = () => {
    setPeriod("all");
    setStartDate("");
    setEndDate("");
    setStatusTab("all");
    setSelectedSupplier("all");
    setPaymentStatusFilter("all");
    setPurchaseStatusFilter("all");
    setPaymentTypeFilter("all");
    setPaymentMethod("all");
    setSearch("");
  };

  const hasActiveFilters =
    period !== "all" ||
    Boolean(startDate) ||
    Boolean(endDate) ||
    statusTab !== "all" ||
    selectedSupplier !== "all" ||
    paymentStatusFilter !== "all" ||
    purchaseStatusFilter !== "all" ||
    paymentTypeFilter !== "all" ||
    paymentMethod !== "all" ||
    Boolean(search.trim());

  // Manejo de anulación
  const handleConfirmCancel = async () => {
    if (!purchaseToCancel) return;
    setIsCancelling(true);
    try {
      const res = await cancelPurchaseAction(businessId, purchaseToCancel.id, cancellationReason);
      if (!res.success) {
        toast.error("Error al anular compra", {
          description: res.error || "No se pudo anular la compra.",
        });
        return;
      }
      toast.success("Compra anulada exitosamente", {
        description: `Se revirtieron existencias de ${purchaseToCancel.purchaseNumber}.`,
      });
      setPurchaseToCancel(null);
      setCancellationReason("");
      loadData();
    } catch (err: any) {
      toast.error("Error inesperado", { description: err.message });
    } finally {
      setIsCancelling(false);
    }
  };

  // Filtrado local en tiempo real por buscador (nº factura, proveedor o notas)
  const filteredPurchases = useMemo(() => {
    if (!search.trim()) return purchases;
    const q = search.toLowerCase().trim();
    return purchases.filter(
      (p) =>
        p.purchaseNumber.toLowerCase().includes(q) ||
        (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(q)) ||
        (p.supplierName && p.supplierName.toLowerCase().includes(q)) ||
        (p.notes && p.notes.toLowerCase().includes(q))
    );
  }, [purchases, search]);

  return (
    <div className="space-y-6">
      {/* 1. NAVEGACIÓN ENTRE COMPRAS Y CUENTAS POR PAGAR CON ACCIONES */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200/80 dark:border-white/[0.08] pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveModuleTab("purchases")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeModuleTab === "purchases"
                ? "bg-[#ED500A]/10 text-[#ED500A] dark:bg-[#ED500A]/20"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.02]"
            }`}
          >
            <ShoppingCart className="w-4 h-4 text-[#ED500A]" />
            <span>Compras y Facturas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModuleTab("accounts_payable")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeModuleTab === "accounts_payable"
                ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.02]"
            }`}
          >
            <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>Cuentas por Pagar</span>
            {kpis.dueTodayOrOverdue > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-3xs font-black bg-rose-500 text-white">
                {formatCOP(kpis.dueTodayOrOverdue)}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
          <Link
            href={`/workspace/${businessId}/proveedores`}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-colors shadow-2xs"
          >
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Proveedores</span>
          </Link>

          <Link
            href={`/workspace/${businessId}/reportes?tab=purchases`}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-colors shadow-2xs"
          >
            <FileText className="w-3.5 h-3.5 text-[#ED500A]" />
            <span>Informe</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsNewPurchaseOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl bg-[#ED500A] text-white hover:bg-[#ED500A]/90 transition-all shadow-md shadow-[#ED500A]/20 cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva compra</span>
          </button>
        </div>
      </div>

      {activeModuleTab === "accounts_payable" ? (
        <AccountsPayableTab businessId={businessId} />
      ) : (
        <>
          {/* 2. KPIS DE COMPRAS NORMALIZADOS */}
          <KpiGrid cols={4}>
            <KpiCard
              title="Comprado"
              value={formatCOP(kpis.totalPurchased)}
              subtext={`${kpis.uniqueSuppliersCount} ${kpis.uniqueSuppliersCount === 1 ? "proveedor" : "proveedores"} · ${kpis.totalPurchasesCount} compras`}
              icon={<ShoppingCart className="w-5 h-5" />}
              variant="blue"
            />
            <KpiCard
              title="Total Pagado"
              value={formatCOP(kpis.totalPaid || kpis.totalCash)}
              subtext={`${kpis.paidPurchasesCount ?? 0} ${kpis.paidPurchasesCount === 1 ? "compra saldada" : "compras saldadas"}`}
              icon={<Banknote className="w-5 h-5" />}
              variant="emerald"
            />
            <KpiCard
              title="Saldo Pendiente"
              value={formatCOP(kpis.totalPendingBalance ?? kpis.totalCredit)}
              subtext={`${kpis.pendingPurchasesCount ?? 0} ${kpis.pendingPurchasesCount === 1 ? "factura pendiente" : "facturas pendientes"}`}
              icon={<CreditCard className="w-5 h-5" />}
              variant={kpis.totalPendingBalance > 0 ? "amber" : "default"}
            />
            <KpiCard
              title="Por pagar hoy"
              value={formatCOP(kpis.dueTodayOrOverdue)}
              subtext={kpis.dueTodayOrOverdue > 0 ? "Requiere pago urgente" : "Al día sin mora"}
              icon={<AlertCircle className="w-5 h-5" />}
              variant={kpis.dueTodayOrOverdue > 0 ? "red" : "default"}
            />
          </KpiGrid>

          {/* 3. FILTROS DE PERÍODO (ACCESOS RÁPIDOS Y RANGO DE FECHAS) */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06]">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Accesos rápidos de período */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {PERIOD_PRESETS.map((preset) => {
                  const isActive =
                    period === preset.id && !startDate && !endDate;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPeriodPreset(preset.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        isActive
                          ? "bg-[#ED500A] text-white shadow-sm"
                          : "bg-white dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-white/[0.08]"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {/* Selector de rango de fechas */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-36">
                  <DatePicker
                    value={startDate}
                    onChange={(val) => handleStartDateChange(val)}
                    placeholder="Desde..."
                    size="sm"
                    clearable={true}
                  />
                </div>

                <div className="w-36">
                  <DatePicker
                    value={endDate}
                    onChange={(val) => handleEndDateChange(val)}
                    placeholder="Hasta..."
                    size="sm"
                    clearable={true}
                  />
                </div>

                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={handleClearCustomDates}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 transition-colors cursor-pointer"
                    title="Limpiar rango de fechas"
                  >
                    <X className="w-3 h-3" />
                    <span>Limpiar fechas</span>
                  </button>
                )}
              </div>
            </div>

            {/* 4. FILTROS ADICIONALES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-200/60 dark:border-white/[0.04]">
              {/* Buscador */}
              <div className="sm:col-span-2">
                <SearchInput
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch("")}
                  placeholder="Buscar por factura, proveedor o artículo..."
                />
              </div>

              {/* Proveedor */}
              <div>
                <Select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  selectSize="sm"
                >
                  <option value="all">Todos los proveedores</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Estado de Pago */}
              <div>
                <Select
                  value={paymentStatusFilter}
                  onChange={(e) => setPaymentStatusFilter(e.target.value)}
                  selectSize="sm"
                >
                  <option value="all">Estado pago: Todos</option>
                  <option value="paid">Pagadas</option>
                  <option value="partially_paid">Abono Parcial</option>
                  <option value="pending">Pendientes de Pago</option>
                </Select>
              </div>

              {/* Estado de Compra */}
              <div>
                <Select
                  value={purchaseStatusFilter}
                  onChange={(e) => setPurchaseStatusFilter(e.target.value)}
                  selectSize="sm"
                >
                  <option value="all">Estado compra: Todos</option>
                  <option value="confirmed">Confirmadas</option>
                  <option value="cancelled">Anuladas</option>
                </Select>
              </div>

              {/* Condición / Tipo de Pago */}
              <div>
                <Select
                  value={paymentTypeFilter}
                  onChange={(e) => setPaymentTypeFilter(e.target.value)}
                  selectSize="sm"
                >
                  <option value="all">Tipo: Contado / Crédito</option>
                  <option value="cash">De Contado</option>
                  <option value="credit">A Crédito</option>
                </Select>
              </div>
            </div>
          </div>

          {/* 5. FILTROS POR ESTADO DE PAGO (PESTAÑAS) */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-slate-100 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/[0.06]">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusTab(tab.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    statusTab === tab.id
                      ? "bg-white dark:bg-white/[0.08] text-[#ED500A] shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-[#ED500A] bg-slate-100 dark:bg-white/[0.04] hover:bg-[#ED500A]/10 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar filtros</span>
              </button>
            )}
          </div>

          {/* 6. LISTADO DE COMPRAS (TABLA CON 14 COLUMNAS EXIGIDAS) */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] overflow-hidden shadow-sm">
            {isLoading ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-[#ED500A]" />
                <span className="text-xs">Cargando compras...</span>
              </div>
            ) : filteredPurchases.length === 0 ? (
              <div className="p-12 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] mx-auto flex items-center justify-center">
                  {hasActiveFilters ? (
                    <Filter className="w-7 h-7 text-slate-400" />
                  ) : (
                    <ShoppingCart className="w-7 h-7 text-[#ED500A]" />
                  )}
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    {hasActiveFilters
                      ? "No se encontraron compras con los filtros aplicados"
                      : "No hay compras registradas aún"}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    {hasActiveFilters
                      ? "Intenta modificar o restablecer los filtros de período, proveedor, tipo o estado para ver resultados."
                      : "Registra facturas de tus compras a proveedores para aumentar existencias automáticamente, recalcular el costo promedio ponderado y controlar tus cuentas por pagar."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-all cursor-pointer shadow-sm"
                    >
                      <Filter className="w-3.5 h-3.5 text-slate-400" />
                      <span>Ver todo</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsNewPurchaseOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-[#ED500A] text-white hover:bg-[#ED500A]/90 transition-all shadow-md shadow-[#ED500A]/20 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nueva compra</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/[0.06] text-slate-500 font-semibold">
                    <tr>
                      <th className="px-3.5 py-3 font-semibold whitespace-nowrap">Factura / Ref</th>
                      <th className="px-3.5 py-3 font-semibold whitespace-nowrap">Proveedor</th>
                      <th className="px-3.5 py-3 font-semibold whitespace-nowrap">Fecha Compra</th>
                      <th className="px-3.5 py-3 font-semibold whitespace-nowrap">Vencimiento</th>
                      <th className="px-3 py-3 font-semibold text-center whitespace-nowrap">Líneas</th>
                      <th className="px-3.5 py-3 font-semibold text-right whitespace-nowrap">Subtotal</th>
                      <th className="px-3.5 py-3 font-semibold text-right whitespace-nowrap">Impuestos</th>
                      <th className="px-3.5 py-3 font-semibold text-right whitespace-nowrap">Retención</th>
                      <th className="px-3.5 py-3 font-semibold text-right whitespace-nowrap">Total</th>
                      <th className="px-3.5 py-3 font-semibold text-right whitespace-nowrap">Pagado</th>
                      <th className="px-3.5 py-3 font-semibold text-right whitespace-nowrap">Saldo</th>
                      <th className="px-3.5 py-3 font-semibold text-center whitespace-nowrap">Estado Pago</th>
                      <th className="px-3.5 py-3 font-semibold text-center whitespace-nowrap">Estado Compra</th>
                      <th className="px-3.5 py-3 font-semibold text-right whitespace-nowrap">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                    {filteredPurchases.map((purchase) => {
                      const isCredit = purchase.paymentType === "credit";
                      const isCancelled = purchase.status === "cancelled";
                      const hasPending = (purchase.balance ?? 0) > 0 && !isCancelled;

                      return (
                        <tr
                          key={purchase.id}
                          className={`hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors ${
                            isCancelled ? "opacity-60 bg-slate-50/30" : ""
                          }`}
                        >
                          {/* 1. Factura / Ref */}
                          <td className="px-3.5 py-3 whitespace-nowrap">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                                {purchase.purchaseNumber}
                              </span>
                              {purchase.invoiceNumber ? (
                                <span className="font-mono text-slate-500 text-3xs">
                                  Ref: {purchase.invoiceNumber}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-3xs capitalize">
                                  {purchase.documentType || "Factura"}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 2. Proveedor */}
                          <td className="px-3.5 py-3 whitespace-nowrap">
                            <div className="flex flex-col gap-0.5 max-w-[170px]">
                              <span className="font-bold text-slate-900 dark:text-white truncate">
                                {purchase.supplierName || (
                                  <span className="text-slate-400 italic font-normal">
                                    Compra libre
                                  </span>
                                )}
                              </span>
                              {purchase.supplierTaxId && (
                                <span className="text-3xs text-slate-400 font-mono">
                                  NIT: {purchase.supplierTaxId}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 3. Fecha Compra */}
                          <td className="px-3.5 py-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                            <span className="text-xs">
                              {new Date(purchase.purchaseDate).toLocaleDateString(
                                "es-CO",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                }
                              )}
                            </span>
                          </td>

                          {/* 4. Vencimiento */}
                          <td className="px-3.5 py-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                            {purchase.dueDate ? (
                              <span className="text-xs font-medium">
                                {new Date(purchase.dueDate).toLocaleDateString(
                                  "es-CO",
                                  {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  }
                                )}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>

                          {/* 5. Cantidad de artículos / Líneas */}
                          <td className="px-3 py-3 whitespace-nowrap text-center">
                            <span className="inline-block px-2 py-0.5 rounded-md font-mono text-2xs font-semibold bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-slate-300">
                              {purchase.itemsCount || purchase.items?.length || 0}
                            </span>
                          </td>

                          {/* 6. Subtotal */}
                          <td className="px-3.5 py-3 whitespace-nowrap text-right font-mono text-slate-700 dark:text-slate-300">
                            {formatCOP(purchase.subtotal)}
                          </td>

                          {/* 7. Impuestos */}
                          <td className="px-3.5 py-3 whitespace-nowrap text-right font-mono text-slate-600 dark:text-slate-400">
                            {purchase.taxAmount > 0 ? `+${formatCOP(purchase.taxAmount)}` : "$ 0"}
                          </td>

                          {/* 8. Retenciones */}
                          <td className="px-3.5 py-3 whitespace-nowrap text-right font-mono text-amber-600 dark:text-amber-400">
                            {(purchase.retentionAmount ?? 0) > 0 ? `-${formatCOP(purchase.retentionAmount ?? 0)}` : "—"}
                          </td>

                          {/* 9. Total de la compra */}
                          <td className="px-3.5 py-3 whitespace-nowrap text-right font-mono font-black text-slate-900 dark:text-white">
                            {formatCOP(purchase.total)}
                          </td>

                          {/* 10. Total pagado */}
                          <td className="px-3.5 py-3 whitespace-nowrap text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCOP(purchase.paidAmount ?? 0)}
                          </td>

                          {/* 11. Saldo pendiente */}
                          <td className="px-3.5 py-3 whitespace-nowrap text-right font-mono">
                            {hasPending ? (
                              <span className="font-bold text-rose-600 dark:text-rose-400">
                                {formatCOP(purchase.balance ?? 0)}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">$ 0</span>
                            )}
                          </td>

                          {/* 12. Estado de pago (Badge claro y diferenciado) */}
                          <td className="px-3.5 py-3 whitespace-nowrap text-center">
                            {isCancelled ? (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-2xs font-bold bg-slate-100 text-slate-500 dark:bg-white/[0.05] dark:text-slate-400">
                                Anulada
                              </span>
                            ) : purchase.paymentStatus === "paid" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Pagada</span>
                              </span>
                            ) : purchase.paymentStatus === "partially_paid" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                <Clock className="w-3 h-3" />
                                <span>Abono Parcial</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                <AlertCircle className="w-3 h-3" />
                                <span>Pendiente</span>
                              </span>
                            )}
                          </td>

                          {/* 13. Estado de la compra */}
                          <td className="px-3.5 py-3 whitespace-nowrap text-center">
                            {isCancelled ? (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-2xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                Anulada
                              </span>
                            ) : (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-2xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                Confirmada
                              </span>
                            )}
                          </td>

                          {/* 14. Acciones */}
                          <td className="px-3.5 py-3 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Abonar si tiene saldo pendiente y no está anulada */}
                              {hasPending && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (purchase.accountPayable) {
                                      setAccountToPay({
                                        ...purchase.accountPayable,
                                        amount: purchase.accountPayable.totalAmount,
                                        supplierName: purchase.supplierName,
                                        purchaseNumber: purchase.purchaseNumber,
                                        isOverdue: purchase.accountPayable.status === "overdue",
                                        daysUntilDue: 0,
                                      });
                                    }
                                  }}
                                  title="Registrar abono a esta compra"
                                  className="px-2 py-1 rounded-lg text-2xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <Banknote className="w-3.5 h-3.5" />
                                  <span>Abonar</span>
                                </button>
                              )}

                              {/* Ver detalle completo */}
                              <button
                                type="button"
                                onClick={() => setSelectedPurchaseDetails(purchase)}
                                title="Ver detalle de compra"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
                              >
                                <FileText className="w-4 h-4" />
                              </button>

                              {/* Imprimir comprobante */}
                              <button
                                type="button"
                                onClick={() => setPurchaseToPrint(purchase)}
                                title="Imprimir comprobante"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-[#ED500A] hover:bg-[#ED500A]/10 transition-colors cursor-pointer"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              {/* Anular compra si está activa */}
                              {!isCancelled && (
                                <button
                                  type="button"
                                  onClick={() => setPurchaseToCancel(purchase)}
                                  title="Anular compra y revertir existencias"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                >
                                  <Ban className="w-4 h-4" />
                                </button>
                              )}
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

          {/* MODAL DETALLE DE COMPRA */}
          <PurchaseDetailModal
            businessId={businessId}
            purchase={selectedPurchaseDetails}
            isOpen={Boolean(selectedPurchaseDetails)}
            onClose={() => setSelectedPurchaseDetails(null)}
            onOpenPayment={(p) => {
              if (p.accountPayable) {
                setAccountToPay({
                  ...p.accountPayable,
                  amount: p.accountPayable.totalAmount,
                  supplierName: p.supplierName,
                  purchaseNumber: p.purchaseNumber,
                  isOverdue: p.accountPayable.status === "overdue",
                  daysUntilDue: 0,
                });
              }
            }}
            onRequestCancel={(p) => {
              setSelectedPurchaseDetails(null);
              setPurchaseToCancel(p);
            }}
            onPrint={(p) => {
              setSelectedPurchaseDetails(null);
              setPurchaseToPrint(p);
            }}
          />

          {/* MODAL IMPRIMIR COMPROBANTE DE COMPRA */}
          {purchaseToPrint && (
            <ModalPortal>
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  {/* Encabezado del modal */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-[#ED500A]/10 text-[#ED500A]">
                        <Printer className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Comprobante de Compra
                        </h3>
                        <p className="text-2xs text-slate-500 font-mono">
                          {purchaseToPrint.purchaseNumber}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPurchaseToPrint(null)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Cuerpo imprimible del comprobante */}
                  <div
                    id="printable-purchase-voucher"
                    className="p-6 space-y-4 overflow-y-auto bg-white dark:bg-slate-900 font-sans"
                  >
                    <div className="border border-slate-200 dark:border-white/[0.1] rounded-xl p-5 space-y-4 text-xs">
                      {/* Cabecera del comprobante */}
                      <div className="text-center pb-4 border-b border-dashed border-slate-300 dark:border-white/[0.1] space-y-1">
                        <span className="font-mono text-2xs uppercase tracking-widest text-[#ED500A] font-bold">
                          NEGOVA COMPRAS
                        </span>
                        <h4 className="font-black text-base text-slate-900 dark:text-white">
                          COMPROBANTE DE INGRESO
                        </h4>
                        <div className="flex items-center justify-center gap-3 text-slate-500 text-2xs font-mono">
                          <span>REGISTRO: {purchaseToPrint.purchaseNumber}</span>
                          {purchaseToPrint.invoiceNumber && (
                            <>
                              <span>•</span>
                              <span>FACTURA: {purchaseToPrint.invoiceNumber}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Datos de Proveedor y Fecha */}
                      <div className="grid grid-cols-2 gap-3 text-2xs">
                        <div>
                          <span className="text-slate-400 font-bold block uppercase">
                            Proveedor:
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white text-xs">
                            {purchaseToPrint.supplierName || "Compra libre"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block uppercase">
                            Fecha de emisión:
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {new Date(purchaseToPrint.purchaseDate).toLocaleString(
                              "es-CO",
                              { dateStyle: "medium", timeStyle: "short" }
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block uppercase">
                            Condición de Pago:
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {purchaseToPrint.paymentType === "credit"
                              ? "A Crédito"
                              : "De Contado"}{" "}
                            ({purchaseToPrint.paymentMethod})
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block uppercase">
                            Caja Origen:
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {purchaseToPrint.cashRegisterName ||
                              (purchaseToPrint.paymentMethod === "cash" &&
                              purchaseToPrint.paymentType === "cash"
                                ? "Caja Principal"
                                : "N/A")}
                          </span>
                        </div>
                      </div>

                      {/* Tabla de Artículos */}
                      <div className="pt-2">
                        <table className="w-full text-left text-2xs border-collapse">
                          <thead>
                            <tr className="border-y border-slate-200 dark:border-white/[0.08] text-slate-500 font-bold">
                              <th className="py-2">Cant.</th>
                              <th className="py-2">Descripción</th>
                              <th className="py-2 text-right">Unitario</th>
                              <th className="py-2 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                            {purchaseToPrint.items?.map((it) => (
                              <tr key={it.id}>
                                <td className="py-2 font-mono font-bold">
                                  {it.quantity}
                                </td>
                                <td className="py-2">
                                  <div className="font-medium text-slate-900 dark:text-white">
                                    {it.itemName}
                                  </div>
                                  <span className="text-3xs text-slate-400">
                                    {it.isInventoryItem
                                      ? "Inventario"
                                      : "Gasto libre"}
                                  </span>
                                </td>
                                <td className="py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                                  {formatCOP(it.unitCost)}
                                </td>
                                <td className="py-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                                  {formatCOP(it.totalCost)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Resumen numérico */}
                      <div className="pt-3 border-t border-slate-200 dark:border-white/[0.1] space-y-1 text-2xs">
                        <div className="flex justify-between text-slate-500">
                          <span>Subtotal:</span>
                          <span className="font-mono">
                            {formatCOP(purchaseToPrint.subtotal)}
                          </span>
                        </div>
                        {purchaseToPrint.taxAmount > 0 && (
                          <div className="flex justify-between text-slate-500">
                            <span>Impuestos / IVA:</span>
                            <span className="font-mono">
                              +{formatCOP(purchaseToPrint.taxAmount)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between font-black text-sm text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-white/[0.08]">
                          <span>TOTAL:</span>
                          <span className="font-mono text-[#ED500A]">
                            {formatCOP(purchaseToPrint.total)}
                          </span>
                        </div>

                        {purchaseToPrint.accountPayable &&
                          purchaseToPrint.accountPayable.balance > 0 && (
                            <div className="flex justify-between text-rose-600 font-bold pt-1 text-2xs">
                              <span>Saldo pendiente a pagar:</span>
                              <span className="font-mono">
                                {formatCOP(
                                  purchaseToPrint.accountPayable.balance
                                )}
                              </span>
                            </div>
                          )}
                      </div>

                      {/* Observaciones */}
                      {purchaseToPrint.notes && (
                        <div className="pt-2 text-2xs text-slate-500 border-t border-slate-100 dark:border-white/[0.04]">
                          <span className="font-bold">Observaciones: </span>
                          <span>{purchaseToPrint.notes}</span>
                        </div>
                      )}

                      {/* Línea de firma */}
                      <div className="pt-8 grid grid-cols-2 gap-6 text-center text-3xs text-slate-400">
                        <div>
                          <div className="border-t border-dashed border-slate-300 dark:border-white/[0.1] pt-1">
                            Recibido en Almacén
                          </div>
                        </div>
                        <div>
                          <div className="border-t border-dashed border-slate-300 dark:border-white/[0.1] pt-1">
                            Firma Autorizada
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Acciones del pie del modal */}
                  <div className="p-4 border-t border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between gap-2">
                    <span className="text-2xs text-slate-400">
                      Formato optimizado para impresión térmica o carta
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPurchaseToPrint(null)}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-white/[0.1] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
                      >
                        Cerrar
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#ED500A] text-white hover:bg-[#ED500A]/90 transition-colors shadow-sm cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Imprimir</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </ModalPortal>
          )}

          {/* MODAL NUEVA COMPRA */}
          <PurchaseFormModal
            businessId={businessId}
            isOpen={isNewPurchaseOpen}
            onClose={() => setIsNewPurchaseOpen(false)}
            onSuccess={() => {
              loadData();
            }}
            products={products}
            locations={locations}
            categories={categories}
            initialProductId={initialProductId}
          />

          {/* MODAL DE ANULACIÓN CON MOTIVO Y ADVERTENCIAS */}
          {purchaseToCancel && (
            <ModalPortal>
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                  {/* Encabezado */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/[0.06] bg-rose-50/50 dark:bg-rose-950/20">
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                      <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/40">
                        <Ban className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Anular Compra
                        </h3>
                        <p className="text-2xs font-mono text-slate-500">
                          {purchaseToCancel.purchaseNumber}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPurchaseToCancel(null);
                        setCancellationReason("");
                      }}
                      disabled={isCancelling}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Contenido */}
                  <div className="p-6 space-y-4">
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Consecuencias de la anulación</span>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-2xs pl-1 text-rose-600/90 dark:text-rose-300/90">
                        <li>Se generará una salida de inventario para revertir existencias.</li>
                        <li>Si fue compra de contado en caja activa, se reintegrará el egreso.</li>
                        <li>La cuenta por pagar asociada quedará cancelada.</li>
                        <li>Esta acción no se puede deshacer.</li>
                      </ul>
                    </div>

                    <div className="text-xs space-y-1">
                      <span className="text-slate-500 dark:text-slate-400">Total de la compra:</span>
                      <p className="text-base font-black text-slate-900 dark:text-white font-mono">
                        {formatCOP(purchaseToCancel.total)}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Motivo de anulación <span className="text-slate-400 font-normal">(opcional)</span>
                      </label>
                      <textarea
                        value={cancellationReason}
                        onChange={(e) => setCancellationReason(e.target.value)}
                        placeholder="Ej: Factura digitada por error, devolución al proveedor, etc."
                        rows={3}
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] focus:border-[#ED500A] focus:outline-none transition-colors resize-none"
                      />
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="p-4 border-t border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPurchaseToCancel(null);
                        setCancellationReason("");
                      }}
                      disabled={isCancelling}
                      className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-white/[0.1] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
                    >
                      Conservar compra
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmCancel}
                      disabled={isCancelling}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isCancelling ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Anulando...</span>
                        </>
                      ) : (
                        <>
                          <Ban className="w-4 h-4" />
                          <span>Sí, anular compra</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </ModalPortal>
          )}
        </>
      )}

      {/* MODAL DE REGISTRO DE PAGO DESDE COMPRA */}
      <PaymentModal
        businessId={businessId}
        isOpen={Boolean(accountToPay)}
        account={accountToPay}
        onClose={() => setAccountToPay(null)}
        onSuccess={() => {
          loadData();
        }}
      />
    </div>
  );
}
