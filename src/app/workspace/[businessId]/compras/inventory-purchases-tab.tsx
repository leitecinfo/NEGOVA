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
import { AccountsPayableTab } from "./accounts-payable-tab";
import { PaymentModal } from "./payment-modal";
import { ConfirmModal } from "@/components/ui/confirm-modal";
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
      const [pRes, kpiRes, sRes] = await Promise.all([
        getPurchasesAction(businessId, {
          period,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          supplierId: selectedSupplier,
          paymentMethod,
          statusTab,
          search,
        }),
        getPurchaseKPIsAction(businessId),
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
    setPaymentMethod("all");
    setSearch("");
  };

  const hasActiveFilters =
    period !== "all" ||
    Boolean(startDate) ||
    Boolean(endDate) ||
    statusTab !== "all" ||
    selectedSupplier !== "all" ||
    paymentMethod !== "all" ||
    Boolean(search.trim());

  // Manejo de anulación
  const handleConfirmCancel = async () => {
    if (!purchaseToCancel) return;
    setIsCancelling(true);
    try {
      const res = await cancelPurchaseAction(businessId, purchaseToCancel.id);
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
      {/* 1. ENCABEZADO: TÍTULO 'Compras', DESCRIPCIÓN Y BOTONES DE ACCIÓN */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Compras
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-2xs font-bold bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20">
              Módulo de Compras
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Control integral de compras de contado y a crédito, sincronización con egresos de caja activa y actualización automática de existencias y costos promedio.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Botón: Proveedores */}
          <Link
            href={`/workspace/${businessId}/proveedores`}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-xl bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.1] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-all cursor-pointer shadow-2xs"
          >
            <Building2 className="w-4 h-4 text-slate-500" />
            <span>Proveedores</span>
          </Link>

          {/* Botón: Informe de compras */}
          <Link
            href={`/workspace/${businessId}/reportes?tab=purchases`}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-xl bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.1] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-all cursor-pointer shadow-2xs"
          >
            <FileText className="w-4 h-4 text-[#ED500A]" />
            <span>Informe de compras</span>
          </Link>

          {/* Botón: + Nueva compra */}
          <button
            type="button"
            onClick={() => setIsNewPurchaseOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-[#ED500A] text-white hover:bg-[#ED500A]/90 transition-all shadow-md shadow-[#ED500A]/20 cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nueva compra</span>
          </button>
        </div>
      </div>

      {/* SUB-NAVEGACIÓN ENTRE COMPRAS Y CUENTAS POR PAGAR */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-white/[0.08] pb-2">
        <button
          type="button"
          onClick={() => setActiveModuleTab("purchases")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeModuleTab === "purchases"
              ? "bg-[#ED500A]/10 text-[#ED500A] dark:bg-[#ED500A]/20"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
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
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
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

      {activeModuleTab === "accounts_payable" ? (
        <AccountsPayableTab businessId={businessId} />
      ) : (
        <>
          {/* 2. KPIS DE COMPRAS: Comprado, De contado, A crédito, Por pagar hoy */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Comprado (Total y Nº de proveedores) */}
            <div className="p-4 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Comprado
                </span>
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <ShoppingCart className="w-4 h-4" />
                </div>
              </div>
              <p className="mt-2 text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {formatCOP(kpis.totalPurchased)}
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {kpis.uniqueSuppliersCount}{" "}
                  {kpis.uniqueSuppliersCount === 1 ? "proveedor" : "proveedores"}
                </span>
                <span>•</span>
                <span>
                  {kpis.totalPurchasesCount}{" "}
                  {kpis.totalPurchasesCount === 1 ? "compra" : "compras"}
                </span>
              </div>
            </div>

            {/* De contado (Pagado) */}
            <div className="p-4 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  De contado
                </span>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Banknote className="w-4 h-4" />
                </div>
              </div>
              <p className="mt-2 text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {formatCOP(kpis.totalCash)}
              </p>
              <span className="mt-1 inline-block text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                Pagado de inmediato
              </span>
            </div>

            {/* A crédito (Deuda pendiente) */}
            <div className="p-4 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  A crédito
                </span>
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <p className="mt-2 text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {formatCOP(kpis.totalCredit)}
              </p>
              <span className="mt-1 inline-block text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                Financiadas por proveedores
              </span>
            </div>

            {/* Por pagar hoy (Vencimientos del día) */}
            <div className="p-4 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Por pagar hoy
                </span>
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <AlertCircle className="w-4 h-4" />
                </div>
              </div>
              <p className="mt-2 text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">
                {formatCOP(kpis.dueTodayOrOverdue)}
              </p>
              <span className="mt-1 inline-block text-[11px] text-slate-400 font-medium">
                Vencimientos del día o atrasados
              </span>
            </div>
          </div>

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
                          : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-white/[0.08]"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {/* Selector de rango de fechas */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-slate-800 text-xs shadow-2xs">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-slate-400 text-2xs uppercase font-bold">
                    Desde:
                  </span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none text-xs"
                  />
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-slate-800 text-xs shadow-2xs">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-slate-400 text-2xs uppercase font-bold">
                    Hasta:
                  </span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    className="bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none text-xs"
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

            {/* 4. FILTROS ADICIONALES: Buscador, Proveedor, Medio de pago */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-200/60 dark:border-white/[0.04]">
              {/* Buscador (nº factura, proveedor o notas) */}
              <div className="relative sm:col-span-2">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nº factura, proveedor o notas..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Proveedor (desplegable) */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-slate-800">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full text-xs bg-transparent border-none text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="all">Todos los proveedores</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Medio de pago (desplegable) */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-slate-800">
                <Banknote className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full text-xs bg-transparent border-none text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="all">Todos los medios de pago</option>
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia bancaria</option>
                  <option value="card">Tarjeta Débito/Crédito</option>
                  <option value="other">Otro</option>
                </select>
              </div>
            </div>
          </div>

          {/* 5. FILTROS POR ESTADO DE PAGO: Todas, De contado, A crédito, Por pagar, Vencidas */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-slate-100 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/[0.06]">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusTab(tab.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    statusTab === tab.id
                      ? "bg-white dark:bg-slate-800 text-[#ED500A] shadow-sm"
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

          {/* 6. LISTADO DE COMPRAS CON ESTADO VACÍO INFORMATIVO Y BOTÓN 'VER TODO' */}
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
                      ? "Intenta modificar o restablecer los filtros de período, proveedor, medio o estado de pago para ver resultados."
                      : "Registra facturas de tus compras a proveedores para aumentar existencias automáticamente, recalcular el costo promedio ponderado y controlar tus cuentas por pagar."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-all cursor-pointer shadow-sm"
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
                    <span>+ Nueva Compra</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/[0.06] text-slate-500 font-semibold">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Compra</th>
                      <th className="px-4 py-3 font-semibold">Fecha</th>
                      <th className="px-4 py-3 font-semibold">Pago</th>
                      <th className="px-4 py-3 font-semibold text-right">Valor ($)</th>
                      <th className="px-4 py-3 font-semibold text-center">Saldo</th>
                      <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                    {filteredPurchases.map((purchase) => {
                      const isCredit = purchase.paymentType === "credit";
                      const hasDebt =
                        purchase.accountPayable &&
                        purchase.accountPayable.balance > 0;
                      const isCancelled = purchase.status === "cancelled";

                      return (
                        <tr
                          key={purchase.id}
                          className={`hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors ${
                            isCancelled ? "opacity-60 bg-slate-50/30" : ""
                          }`}
                        >
                          {/* 1. Compra (Proveedor y código COMP-XXXXX) */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-slate-900 dark:text-white">
                                {purchase.supplierName || (
                                  <span className="text-slate-400 italic">
                                    Compra libre
                                  </span>
                                )}
                              </span>
                              <div className="flex items-center gap-1.5 text-2xs">
                                <span className="font-mono font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-white/[0.08]">
                                  {purchase.purchaseNumber}
                                </span>
                                {purchase.invoiceNumber && (
                                  <span className="font-mono text-slate-400 text-3xs">
                                    Fact: {purchase.invoiceNumber}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 2. Fecha */}
                          <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 dark:text-slate-400">
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

                          {/* 3. Pago (Badges compuestos: condición, medio y caja origen) */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {/* Condición: De Contado / A Crédito */}
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  isCredit
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                }`}
                              >
                                {isCredit ? "A Crédito" : "De Contado"}
                              </span>

                              {/* Medio de pago */}
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-white/[0.08] capitalize">
                                {purchase.paymentMethod === "cash"
                                  ? "Efectivo"
                                  : purchase.paymentMethod === "transfer"
                                  ? "Transferencia"
                                  : purchase.paymentMethod === "card"
                                  ? "Tarjeta"
                                  : purchase.paymentMethod || "Otro"}
                              </span>

                              {/* Caja de origen si aplica egreso de caja */}
                              {(purchase.deductFromCashRegister ||
                                (!isCredit &&
                                  purchase.paymentMethod === "cash")) && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                  <Store className="w-2.5 h-2.5" />
                                  <span>
                                    {purchase.cashRegisterName
                                      ? `Salió de ${purchase.cashRegisterName}`
                                      : "Salió de Caja Principal"}
                                  </span>
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 4. Valor ($) */}
                          <td className="px-4 py-3.5 whitespace-nowrap text-right font-mono font-bold text-slate-900 dark:text-white">
                            {formatCOP(purchase.total)}
                          </td>

                          {/* 5. Saldo (Pagada o saldo pendiente) */}
                          <td className="px-4 py-3.5 whitespace-nowrap text-center">
                            {isCancelled ? (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-2xs font-bold bg-slate-100 text-slate-500 dark:bg-white/[0.05] dark:text-slate-400">
                                Anulada
                              </span>
                            ) : !isCredit ||
                              !purchase.accountPayable ||
                              purchase.accountPayable.balance === 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Pagada</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                <span>
                                  Saldo: {formatCOP(purchase.accountPayable.balance)}{" "}
                                  pendiente
                                </span>
                              </span>
                            )}
                          </td>

                          {/* 6. Acciones (Ver detalle, Imprimir, Anular con modal) */}
                          <td className="px-4 py-3.5 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Abonar si tiene saldo pendiente */}
                              {purchase.accountPayable &&
                                purchase.accountPayable.balance > 0 &&
                                !isCancelled && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAccountToPay({
                                        ...purchase.accountPayable!,
                                        amount:
                                          purchase.accountPayable!.totalAmount,
                                        supplierName: purchase.supplierName,
                                        purchaseNumber: purchase.purchaseNumber,
                                        isOverdue:
                                          purchase.accountPayable!.status ===
                                          "overdue",
                                        daysUntilDue: 0,
                                      });
                                    }}
                                    title="Registrar abono a esta compra a crédito"
                                    className="px-2 py-1 rounded-lg text-2xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors flex items-center gap-1 cursor-pointer"
                                  >
                                    <Banknote className="w-3.5 h-3.5" />
                                    <span>Abonar</span>
                                  </button>
                                )}

                              {/* Ver detalle */}
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedPurchaseDetails(purchase)
                                }
                                title="Ver detalle de compra"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
                              >
                                <FileText className="w-4 h-4" />
                              </button>

                              {/* Imprimir */}
                              <button
                                type="button"
                                onClick={() => setPurchaseToPrint(purchase)}
                                title="Imprimir comprobante"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-[#ED500A] hover:bg-[#ED500A]/10 transition-colors cursor-pointer"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              {/* Anular */}
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
          {selectedPurchaseDetails && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
                  <div>
                    <span className="font-mono text-xs font-bold text-[#ED500A]">
                      {selectedPurchaseDetails.purchaseNumber}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Detalle de Compra
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPurchaseDetails(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400">Proveedor:</span>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {selectedPurchaseDetails.supplierName || "Compra libre"}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Nº Factura:</span>
                      <p className="font-semibold text-slate-900 dark:text-white font-mono">
                        {selectedPurchaseDetails.invoiceNumber || "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Fecha de compra:</span>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {new Date(
                          selectedPurchaseDetails.purchaseDate
                        ).toLocaleDateString("es-CO", {
                          dateStyle: "medium",
                        })}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Tipo de Pago:</span>
                      <p className="font-semibold text-slate-900 dark:text-white capitalize">
                        {selectedPurchaseDetails.paymentType === "credit"
                          ? "A Crédito"
                          : "Contado"}{" "}
                        ({selectedPurchaseDetails.paymentMethod})
                      </p>
                    </div>
                  </div>

                  {selectedPurchaseDetails.notes && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.06] text-xs">
                      <span className="text-slate-400 font-medium">Notas:</span>
                      <p className="text-slate-700 dark:text-slate-300 mt-0.5">
                        {selectedPurchaseDetails.notes}
                      </p>
                    </div>
                  )}

                  {/* Cuentas por pagar asociada si aplica */}
                  {selectedPurchaseDetails.accountPayable && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
                      <div className="flex justify-between font-bold text-amber-700 dark:text-amber-400">
                        <span>Estado de Cuenta por Pagar:</span>
                        <span className="capitalize">
                          {selectedPurchaseDetails.accountPayable.status}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span>Saldo pendiente:</span>
                        <span className="font-bold text-rose-600">
                          {formatCOP(
                            selectedPurchaseDetails.accountPayable.balance
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500 text-3xs">
                        <span>Vencimiento:</span>
                        <span>
                          {new Date(
                            selectedPurchaseDetails.accountPayable.dueDate
                          ).toLocaleDateString("es-CO")}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Desglose de ítems */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                      Artículos Adquiridos (
                      {selectedPurchaseDetails.items?.length || 0})
                    </h4>
                    <div className="space-y-2">
                      {selectedPurchaseDetails.items?.map((it) => (
                        <div
                          key={it.id}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">
                              {it.itemName}
                            </p>
                            <span className="text-[11px] text-slate-400">
                              {it.quantity} x {formatCOP(it.unitCost)}{" "}
                              {it.isInventoryItem
                                ? "(Ingresó a inventario)"
                                : "(Gasto libre)"}
                            </span>
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {formatCOP(it.totalCost)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>Subtotal:</span>
                      <span>{formatCOP(selectedPurchaseDetails.subtotal)}</span>
                    </div>
                    {selectedPurchaseDetails.taxAmount > 0 && (
                      <div className="flex justify-between text-slate-500">
                        <span>IVA:</span>
                        <span>
                          +{formatCOP(selectedPurchaseDetails.taxAmount)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-slate-900 dark:text-white text-sm pt-2 border-t">
                      <span>Total Facturado:</span>
                      <span className="text-[#ED500A]">
                        {formatCOP(selectedPurchaseDetails.total)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const p = selectedPurchaseDetails;
                      setSelectedPurchaseDetails(null);
                      setPurchaseToPrint(p);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#ED500A]/10 text-[#ED500A] hover:bg-[#ED500A]/20 transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Imprimir comprobante</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPurchaseDetails(null)}
                    className="px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-200 dark:bg-white/[0.1] text-slate-700 dark:text-white hover:bg-slate-300 transition-colors cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL IMPRIMIR COMPROBANTE DE COMPRA */}
          {purchaseToPrint && (
            <ModalPortal>
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
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

          {/* MODAL DE CONFIRMACIÓN DE ANULACIÓN */}
          <ConfirmModal
            isOpen={Boolean(purchaseToCancel)}
            onClose={() => setPurchaseToCancel(null)}
            onConfirm={handleConfirmCancel}
            title="¿Anular esta compra?"
            description={`Se anulará ${purchaseToCancel?.purchaseNumber} (${formatCOP(
              purchaseToCancel?.total || 0
            )}). Las existencias ingresadas se revertirán automáticamente del inventario y la cuenta por pagar será cancelada.`}
            confirmText="Sí, anular compra"
            cancelText="Conservar compra"
            variant="danger"
            isLoading={isCancelling}
          />
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
