"use client";

import React, { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Plus,
  Minus,
  Search,
  Filter,
  Calendar,
  CreditCard,
  Banknote,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Scale,
  FileText,
  Trash2,
  Eye,
  CheckCircle2,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  ShoppingCart,
  Truck,
  RotateCcw,
  X,
  Building2,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { formatCOP } from "@/config/plans";
import {
  UnifiedMovement,
  MovementFlow,
  OPERATIONAL_CATEGORIES,
  PRODUCTION_CATEGORIES,
  INCOME_CATEGORIES,
} from "@/lib/expenses/types";
import { MovementFormModal } from "./movement-form-modal";
import { MovementDetailModal } from "./movement-detail-modal";
import { ConfirmCancelMovementModal } from "./confirm-cancel-movement-modal";
import { getUnifiedMovementsAction } from "./actions";

interface Props {
  businessId: string;
  businessName: string;
  initialMovements: UnifiedMovement[];
  suppliers: Array<{ id: string; name: string }>;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

type PeriodPreset = "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "all" | "custom";

export function WorkspaceGastosClient({
  businessId,
  businessName,
  initialMovements,
  suppliers,
  canCreate,
  canEdit,
  canDelete,
}: Props) {
  const [movements, setMovements] = useState<UnifiedMovement[]>(initialMovements);

  // Filtros
  const [flowFilter, setFlowFilter] = useState<"all" | "income" | "expense">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("this_month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalFlow, setCreateModalFlow] = useState<MovementFlow>("expense");
  const [selectedMovementForDetail, setSelectedMovementForDetail] = useState<UnifiedMovement | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [movementToCancel, setMovementToCancel] = useState<UnifiedMovement | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  const [isPending, startTransition] = useTransition();

  // =========================================================================
  // CÁLCULO DE FECHAS SEGÚN EL PERÍODO
  // =========================================================================
  const { dateRangeStart, dateRangeEnd } = useMemo(() => {
    const now = new Date();

    if (periodPreset === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      return { dateRangeStart: start, dateRangeEnd: end };
    }

    if (periodPreset === "yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0);
      const end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59);
      return { dateRangeStart: start, dateRangeEnd: end };
    }

    if (periodPreset === "this_week") {
      const day = now.getDay() || 7;
      const start = new Date(now);
      start.setDate(start.getDate() - day + 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return { dateRangeStart: start, dateRangeEnd: end };
    }

    if (periodPreset === "this_month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { dateRangeStart: start, dateRangeEnd: end };
    }

    if (periodPreset === "last_month") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return { dateRangeStart: start, dateRangeEnd: end };
    }

    if (periodPreset === "custom") {
      const start = customStartDate ? new Date(customStartDate + "T00:00:00") : null;
      const end = customEndDate ? new Date(customEndDate + "T23:59:59") : null;
      return { dateRangeStart: start, dateRangeEnd: end };
    }

    return { dateRangeStart: null, dateRangeEnd: null };
  }, [periodPreset, customStartDate, customEndDate]);

  // =========================================================================
  // FILTRADO DE MOVIMIENTOS
  // =========================================================================
  const filteredMovements = useMemo(() => {
    return movements.filter((mov) => {
      // 1. Filtro por Flujo (Todos, Solo Egresos, Solo Ingresos)
      if (flowFilter === "income" && mov.flow !== "income") return false;
      if (flowFilter === "expense" && mov.flow !== "expense") return false;

      // 2. Filtro por Categoría
      if (categoryFilter !== "all") {
        if (mov.category.toLowerCase() !== categoryFilter.toLowerCase()) return false;
      }

      // 3. Filtro por Fecha
      if (dateRangeStart || dateRangeEnd) {
        const movDate = new Date(mov.date);
        if (dateRangeStart && movDate < dateRangeStart) return false;
        if (dateRangeEnd && movDate > dateRangeEnd) return false;
      }

      // 4. Buscador por concepto, tercero o comprobante
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const matchConcept = mov.concept.toLowerCase().includes(q);
        const matchThirdParty = mov.thirdPartyName?.toLowerCase().includes(q) || false;
        const matchReceipt = mov.receiptNumber?.toLowerCase().includes(q) || false;
        const matchNotes = mov.notes?.toLowerCase().includes(q) || false;
        const matchCategory = mov.category.toLowerCase().includes(q);

        if (!matchConcept && !matchThirdParty && !matchReceipt && !matchNotes && !matchCategory) {
          return false;
        }
      }

      return true;
    });
  }, [movements, flowFilter, categoryFilter, dateRangeStart, dateRangeEnd, searchTerm]);

  // =========================================================================
  // KPIS SUPERIORES CALCULADOS SOBRE LOS MOVIMIENTOS FILTRADOS
  // =========================================================================
  const kpis = useMemo(() => {
    let totalIncome = 0;
    let totalExpenses = 0;
    let incomeCount = 0;
    let expensesCount = 0;

    for (const mov of filteredMovements) {
      if (mov.status === "cancelled") continue;
      if (mov.flow === "income") {
        totalIncome += mov.amount;
        incomeCount += 1;
      } else {
        totalExpenses += mov.amount;
        expensesCount += 1;
      }
    }

    const netBalance = totalIncome - totalExpenses;

    return {
      totalIncome,
      totalExpenses,
      netBalance,
      movementsCount: filteredMovements.length,
      incomeCount,
      expensesCount,
    };
  }, [filteredMovements]);

  // =========================================================================
  // RECARGA DE DATOS TRAS ACCIONES
  // =========================================================================
  const refreshData = async () => {
    try {
      const res = await getUnifiedMovementsAction(businessId);
      if (res.success && res.data) {
        setMovements(res.data);
      }
    } catch {
      toast.error("Error al actualizar movimientos.");
    }
  };

  const handleCreateSuccess = (newMov: UnifiedMovement) => {
    setMovements((prev) => [newMov, ...prev]);
    refreshData();
  };

  const handleCancelSuccess = (cancelledId: string) => {
    setMovements((prev) =>
      prev.map((m) => (m.id === cancelledId ? { ...m, status: "cancelled" } : m))
    );
    refreshData();
  };

  const handleOpenDetailModal = (mov: UnifiedMovement) => {
    setSelectedMovementForDetail(mov);
    setIsDetailModalOpen(true);
  };

  const handleOpenCancelModal = (mov: UnifiedMovement) => {
    setMovementToCancel(mov);
    setIsCancelModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* ===================================================================== */}
      {/* 1. ENCABEZADO PRINCIPAL                                               */}
      {/* ===================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                Ingresos y Egresos
              </h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                Flujo de Caja & Gastos
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Control financiero unificado de ingresos, egresos operativos, costos de producción y movimientos de caja.
            </p>
          </div>
        </div>

        {/* Botones de acción del encabezado */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            href={`/workspace/${businessId}/compras`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-border bg-card hover:bg-muted text-foreground transition-all shadow-xs"
          >
            <ShoppingCart className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">Compras</span>
          </Link>

          <Link
            href={`/workspace/${businessId}/proveedores`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-border bg-card hover:bg-muted text-foreground transition-all shadow-xs"
          >
            <Truck className="w-4 h-4 text-muted-foreground" />
            <span className="hidden sm:inline">Proveedores</span>
          </Link>

          {canCreate && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md shadow-primary/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nuevo Movimiento</span>
            </button>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. KPIS SUPERIORES                                                    */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Ingresos (+) en verde */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Total Ingresos (+)
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              +{formatCOP(kpis.totalIncome)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {kpis.incomeCount} entradas registradas en el período
          </p>
        </div>

        {/* KPI 2: Total Egresos (-) en rojo */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Total Egresos (-)
            </span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
              -{formatCOP(kpis.totalExpenses)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {kpis.expensesCount} salidas operativas y costos de producción
          </p>
        </div>

        {/* KPI 3: Balance Neto del período */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Balance Neto
            </span>
            <div
              className={`p-2 rounded-xl ${
                kpis.netBalance >= 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              }`}
            >
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-black font-mono ${
                kpis.netBalance >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {kpis.netBalance >= 0 ? "+" : ""}
              {formatCOP(kpis.netBalance)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {kpis.netBalance >= 0 ? "Superávit financiero en el período" : "Déficit de flujo de caja"}
          </p>
        </div>

        {/* KPI 4: Conteo de movimientos */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Movimientos
            </span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">
              {kpis.movementsCount}
            </span>
            <span className="text-xs text-muted-foreground">operaciones</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {kpis.incomeCount} ingresos • {kpis.expensesCount} egresos
          </p>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. FILTROS Y CONTROLES                                                */}
      {/* ===================================================================== */}
      <div className="p-4 rounded-2xl border border-border bg-card shadow-xs space-y-4">
        {/* FILA 1: FLUJO Y ACCESOS RÁPIDOS DE FECHAS */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Selector de Flujo: Todos, Solo Egresos, Solo Ingresos */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border shrink-0">
            <button
              type="button"
              onClick={() => setFlowFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                flowFilter === "all"
                  ? "bg-card text-foreground shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Todos ({movements.length})
            </button>
            <button
              type="button"
              onClick={() => setFlowFilter("expense")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                flowFilter === "expense"
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Minus className="w-3.5 h-3.5" />
              <span>Solo Egresos</span>
            </button>
            <button
              type="button"
              onClick={() => setFlowFilter("income")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                flowFilter === "income"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Solo Ingresos</span>
            </button>
          </div>

          {/* Accesos rápidos de fecha */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "today", label: "Hoy" },
              { id: "yesterday", label: "Ayer" },
              { id: "this_week", label: "Esta semana" },
              { id: "this_month", label: "Este mes" },
              { id: "last_month", label: "Mes anterior" },
              { id: "all", label: "Todo" },
              { id: "custom", label: "Personalizado" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriodPreset(p.id as PeriodPreset)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  periodPreset === p.id
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* FILA 2: FECHAS PERSONALIZADAS (SI APLICA), CATEGORÍA Y BUSCADOR */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-border">
          {/* Selector de Rango Personalizado */}
          {periodPreset === "custom" && (
            <div className="sm:col-span-4 flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-border bg-background text-foreground"
              />
              <span className="text-xs text-muted-foreground">a</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-border bg-background text-foreground"
              />
            </div>
          )}

          {/* Selector de Categorías */}
          <div className={periodPreset === "custom" ? "sm:col-span-3" : "sm:col-span-4"}>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-xs"
            >
              <option value="all">Todas las categorías</option>

              {flowFilter !== "expense" && (
                <optgroup label="Ingresos">
                  {INCOME_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </optgroup>
              )}

              {flowFilter !== "income" && (
                <>
                  <optgroup label="Gastos Operativos">
                    {OPERATIONAL_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Costos de Producción">
                    {PRODUCTION_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </optgroup>
                </>
              )}
            </select>
          </div>

          {/* Buscador */}
          <div className={periodPreset === "custom" ? "sm:col-span-5" : "sm:col-span-8"}>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por concepto, tercero, proveedor o comprobante..."
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-2.5 p-0.5 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. TABLA UNIFICADA DE MOVIMIENTOS                                     */}
      {/* ===================================================================== */}
      <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-xs">
        {filteredMovements.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-muted/50 text-muted-foreground mx-auto flex items-center justify-center">
              <ArrowLeftRight className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-foreground">
                No se encontraron movimientos
              </h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {searchTerm.trim() || categoryFilter !== "all" || flowFilter !== "all"
                  ? "No hay registros que coincidan con los filtros y búsqueda aplicados."
                  : "Aún no has registrado movimientos financieros en este período."}
              </p>
            </div>
            {canCreate && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 shadow-xs cursor-pointer"
                >
                  + Registrar primer movimiento
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Movimiento</th>
                  <th className="px-4 py-3">Tipo & Categoría</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Medio & Caja</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredMovements.map((mov) => {
                  const isIncome = mov.flow === "income";
                  const isCancelled = mov.status === "cancelled";

                  return (
                    <tr
                      key={mov.id}
                      className={`hover:bg-muted/30 transition-colors group ${
                        isCancelled ? "opacity-50 line-through" : ""
                      }`}
                    >
                      {/* 1. Movimiento: Concepto/descripción y nombre de tercero/proveedor */}
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground block truncate max-w-[240px]">
                              {mov.concept}
                            </span>
                            {isCancelled && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-red-500/10 text-red-600 border border-red-500/20">
                                Anulado
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                            {mov.thirdPartyName ? (
                              <span className="text-foreground/80 font-medium truncate max-w-[180px]">
                                {mov.thirdPartyName}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/60 italic">Sin tercero</span>
                            )}
                            {mov.receiptNumber && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  #{mov.receiptNumber}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Tipo y Categoría: Badges de tipo e indicador de categoría */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isIncome ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <ArrowDownLeft className="w-3 h-3" />
                              <span>Ingreso</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                              <ArrowUpRight className="w-3 h-3" />
                              <span>Egreso</span>
                            </span>
                          )}

                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                            {mov.category}
                          </span>
                        </div>
                      </td>

                      {/* 3. Fecha */}
                      <td className="px-4 py-3 text-muted-foreground font-mono text-[11px]">
                        <div>
                          <span className="text-foreground font-semibold block">
                            {new Date(mov.date).toLocaleDateString("es-CO", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                          <span className="text-[10px] text-muted-foreground block">
                            {new Date(mov.date).toLocaleTimeString("es-CO", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </td>

                      {/* 4. Medio y Caja: Badge compuesto del canal y caja afectada */}
                      <td className="px-4 py-3">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border bg-card">
                          {mov.cajaBadge?.includes("Caja") ? (
                            <Banknote
                              className={`w-3.5 h-3.5 ${
                                isIncome ? "text-emerald-600" : "text-amber-500"
                              }`}
                            />
                          ) : mov.paymentMethod.toLowerCase().includes("transfer") ? (
                            <CreditCard className="w-3.5 h-3.5 text-blue-500" />
                          ) : (
                            <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                          <span className="text-[11px] font-medium text-foreground">
                            {mov.cajaBadge || mov.paymentMethod}
                          </span>
                        </div>
                      </td>

                      {/* 5. Monto: Coloreado (+ verde / - rojo) */}
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-mono font-bold text-xs sm:text-sm block ${
                            isIncome
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {isIncome ? "+" : "-"}
                          {formatCOP(mov.amount)}
                        </span>
                      </td>

                      {/* 6. Acciones: Ver soporte y Anular movimiento */}
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1 justify-end">
                          {/* Botón Ver Soporte */}
                          <button
                            type="button"
                            onClick={() => handleOpenDetailModal(mov)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            title="Ver soporte contable"
                          >
                            <FileText className="w-4 h-4" />
                          </button>

                          {/* Botón Anular Movimiento */}
                          {canDelete && !isCancelled && (
                            <button
                              type="button"
                              onClick={() => handleOpenCancelModal(mov)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-500/10 transition-colors cursor-pointer"
                              title="Anular movimiento"
                            >
                              <Trash2 className="w-4 h-4" />
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

      {/* ===================================================================== */}
      {/* 5. MODALES INTEGRADOS                                                 */}
      {/* ===================================================================== */}

      {/* Modal '+ Nuevo Movimiento' */}
      <MovementFormModal
        businessId={businessId}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
        suppliers={suppliers}
        defaultFlow={createModalFlow}
      />

      {/* Modal 'Ver Soporte' / Detalle del Movimiento */}
      <MovementDetailModal
        isOpen={isDetailModalOpen}
        movement={selectedMovementForDetail}
        onClose={() => setIsDetailModalOpen(false)}
        onAnular={(mov) => handleOpenCancelModal(mov)}
      />

      {/* Modal 'Confirmar Anular Movimiento' (Sin alertas nativas) */}
      <ConfirmCancelMovementModal
        businessId={businessId}
        isOpen={isCancelModalOpen}
        movement={movementToCancel}
        onClose={() => setIsCancelModalOpen(false)}
        onSuccess={handleCancelSuccess}
      />
    </div>
  );
}
