"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Landmark,
  Plus,
  Play,
  Lock,
  DollarSign,
  TrendingUp,
  Receipt,
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Wallet,
  Sparkles,
  ArrowDownRight,
  ArrowUpRight,
  History,
  CalendarRange,
  MoreVertical,
  Scale,
  Search,
  Filter,
  Users,
  Check,
  FileText,
  ChevronDown,
  ArrowLeftRight,
  ShieldAlert,
  Loader2,
  Eye,
} from "lucide-react";
import {
  CashOverviewData,
  CashRegisterWithSession,
  CashRegister,
  CashSession,
  CashMovementWithDetails,
  CashSessionHistoryItem,
  CashierItem,
  CASH_MOVEMENT_TYPE_LABELS,
  CashMovementType,
} from "@/lib/cash/types";
import { OpenCashShiftModal } from "./open-cash-shift-modal";
import { CloseCashShiftModal } from "./close-cash-shift-modal";
import { CreateCashRegisterModal } from "./create-cash-register-modal";
import { CashMovementModal } from "./cash-movement-modal";
import { ShiftMovementsHistoryModal } from "./shift-movements-history-modal";
import { DailyClosurePanel } from "./daily-closure-panel";
import { DateRangeClosurePanel } from "./date-range-closure-panel";
import {
  getAllCashMovementsAction,
  getCashSessionsHistoryAction,
  getCashiersListAction,
} from "@/app/workspace/[businessId]/cajas/actions";
import { toast } from "sonner";

interface WorkspaceCajaClientProps {
  businessId: string;
  initialData: CashOverviewData;
  locations?: { id: string; name: string }[];
  currentUserId?: string;
  currentBusinessUserId?: string;
  currentUserName?: string;
  currentUserEmail?: string;
}

type CashManagementTab =
  | "terminals"
  | "movements"
  | "shift_history"
  | "cashiers"
  | "daily_closure"
  | "range_closure";

export function WorkspaceCajaClient({
  businessId,
  initialData,
  locations = [],
  currentUserId,
  currentBusinessUserId,
  currentUserName,
  currentUserEmail,
}: WorkspaceCajaClientProps) {
  const router = useRouter();
  const [data, setData] = useState<CashOverviewData>(initialData);
  const [activeTab, setActiveTab] = useState<CashManagementTab>("movements");

  // Estados de Modales
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [openShiftDefaultRegisterId, setOpenShiftDefaultRegisterId] = useState<string | undefined>();

  const [closingRegister, setClosingRegister] = useState<{
    register: CashRegister;
    session: CashSession;
  } | null>(null);

  const [movementModalState, setMovementModalState] = useState<{
    register: CashRegister;
    session: CashSession;
    currentCash: number;
    initialType: "entry" | "withdrawal";
  } | null>(null);

  const [historyModalState, setHistoryModalState] = useState<{
    register: CashRegister;
    session: CashSession;
    initialAmount: number;
    expectedCash: number;
    isOpenSession: boolean;
  } | null>(null);

  const [isCreateRegisterModalOpen, setIsCreateRegisterModalOpen] = useState(false);

  // Menú contextual de la tarjeta activa
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);

  // Selector de caja activa para la tarjeta cuando hay múltiples abiertas
  const [selectedActiveRegisterId, setSelectedActiveRegisterId] = useState<string | null>(null);

  // Estados para las pestañas de gestión
  const [movementsList, setMovementsList] = useState<CashMovementWithDetails[]>([]);
  const [isMovementsLoading, setIsMovementsLoading] = useState(false);
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>("all");
  const [movementRegisterFilter, setMovementRegisterFilter] = useState<string>("all");
  const [movementSearchQuery, setMovementSearchQuery] = useState<string>("");

  const [sessionsHistory, setSessionsHistory] = useState<CashSessionHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [sessionStatusFilter, setSessionStatusFilter] = useState<"all" | "open" | "closed">("all");

  const [cashiersList, setCashiersList] = useState<CashierItem[]>([]);
  const [isCashiersLoading, setIsCashiersLoading] = useState(false);

  const [isPending, startTransition] = useTransition();

  // =========================================================================
  // FORMATEADORES Y UTILIDADES
  // =========================================================================
  const formatCop = (amt: number) =>
    `$${new Intl.NumberFormat("es-CO").format(Math.round(amt))}`;

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "N/A";
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat("es-CO", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
        day: "2-digit",
        month: "short",
      }).format(d);
    } catch {
      return isoString;
    }
  };

  const formatElapsedTime = (isoString?: string | null) => {
    if (!isoString) return "";
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      if (diffMs < 0) return "Iniciada recién";
      const totalMinutes = Math.floor(diffMs / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      if (hours === 0) return `hace ${minutes}m`;
      return `hace ${hours}h ${minutes}m`;
    } catch {
      return "";
    }
  };

  // =========================================================================
  // CAJA ACTIVA PRINCIPAL PARA LA TARJETA
  // =========================================================================
  const openRegisters = useMemo(() => {
    return data.registers.filter((rw) => Boolean(rw.activeSession));
  }, [data.registers]);

  // Si hay una caja abierta por el usuario actual, priorizarla
  const activeRegisterWithSession = useMemo(() => {
    if (openRegisters.length === 0) return null;

    if (selectedActiveRegisterId) {
      const found = openRegisters.find((r) => r.register.id === selectedActiveRegisterId);
      if (found) return found;
    }

    // Buscar si hay una sesión abierta por este usuario
    const userSession = openRegisters.find(
      (r) =>
        r.activeSession?.openedBy &&
        (r.activeSession.openedBy === currentUserId ||
          r.activeSession.openedBy === currentBusinessUserId)
    );
    if (userSession) return userSession;

    // Fallback: primera caja abierta
    return openRegisters[0];
  }, [openRegisters, selectedActiveRegisterId, currentUserId, currentBusinessUserId]);

  const isUserActiveBox = useMemo(() => {
    if (!activeRegisterWithSession?.activeSession?.openedBy) return false;
    const opBy = activeRegisterWithSession.activeSession.openedBy;
    return opBy === currentUserId || opBy === currentBusinessUserId;
  }, [activeRegisterWithSession, currentUserId, currentBusinessUserId]);

  // Calcular Entradas y Salidas Netas de los turnos abiertos
  const netEntriesWithdrawals = useMemo(() => {
    if (data.kpis.netEntriesWithdrawals !== undefined) {
      return data.kpis.netEntriesWithdrawals;
    }
    let totalEntries = 0;
    let totalOuts = 0;
    for (const rw of openRegisters) {
      if (rw.sessionSummary) {
        totalEntries += rw.sessionSummary.totalManualEntries;
        totalOuts += rw.sessionSummary.totalExpenses + rw.sessionSummary.totalWithdrawals;
      }
    }
    return totalEntries - totalOuts;
  }, [data.kpis.netEntriesWithdrawals, openRegisters]);

  // =========================================================================
  // CARGA DE DATOS PARA PESTAÑAS
  // =========================================================================
  const loadMovements = async () => {
    setIsMovementsLoading(true);
    try {
      const res = await getAllCashMovementsAction(businessId, 150);
      if (res.success && res.data) {
        setMovementsList(res.data);
      }
    } catch {
      toast.error("Error al cargar movimientos de caja.");
    } finally {
      setIsMovementsLoading(false);
    }
  };

  const loadSessionsHistory = async () => {
    setIsHistoryLoading(true);
    try {
      const res = await getCashSessionsHistoryAction(businessId, 60);
      if (res.success && res.data) {
        setSessionsHistory(res.data);
      }
    } catch {
      toast.error("Error al cargar historial de turnos.");
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const loadCashiers = async () => {
    setIsCashiersLoading(true);
    try {
      const res = await getCashiersListAction(businessId);
      if (res.success && res.data) {
        setCashiersList(res.data);
      }
    } catch {
      toast.error("Error al cargar colaboradores de caja.");
    } finally {
      setIsCashiersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "movements") {
      loadMovements();
    } else if (activeTab === "shift_history") {
      loadSessionsHistory();
    } else if (activeTab === "cashiers") {
      loadCashiers();
    }
  }, [activeTab, businessId]);

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
      if (activeTab === "movements") loadMovements();
      if (activeTab === "shift_history") loadSessionsHistory();
      if (activeTab === "cashiers") loadCashiers();
    });
  };

  const handleOpenShift = (registerId?: string) => {
    setOpenShiftDefaultRegisterId(registerId);
    setIsOpenShiftModalOpen(true);
  };

  const handleCloseShift = (rw: CashRegisterWithSession) => {
    if (rw.activeSession) {
      setClosingRegister({
        register: rw.register,
        session: rw.activeSession,
      });
    }
  };

  // Filtrado de movimientos
  const filteredMovements = useMemo(() => {
    let result = movementsList;

    if (movementTypeFilter !== "all") {
      result = result.filter((m) => m.movementType === movementTypeFilter);
    }

    if (movementRegisterFilter !== "all") {
      result = result.filter((m) => m.registerId === movementRegisterFilter);
    }

    if (movementSearchQuery.trim()) {
      const q = movementSearchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          (m.notes && m.notes.toLowerCase().includes(q)) ||
          (m.referenceId && m.referenceId.toLowerCase().includes(q)) ||
          (m.registerName && m.registerName.toLowerCase().includes(q)) ||
          (CASH_MOVEMENT_TYPE_LABELS[m.movementType] &&
            CASH_MOVEMENT_TYPE_LABELS[m.movementType].toLowerCase().includes(q))
      );
    }

    return result;
  }, [movementsList, movementTypeFilter, movementRegisterFilter, movementSearchQuery]);

  // Filtrado de historial de turnos
  const filteredSessionsHistory = useMemo(() => {
    if (sessionStatusFilter === "all") return sessionsHistory;
    return sessionsHistory.filter((s) => s.status === sessionStatusFilter);
  }, [sessionsHistory, sessionStatusFilter]);

  return (
    <div className="space-y-6">
      {/* ===================================================================== */}
      {/* 1. ENCABEZADO Y ACCIONES                                              */}
      {/* Título: Cajas | Descripción: Abre y cierra turnos...                   */}
      {/* Botones: 'Cierre diario', 'Movimiento', '+ Nueva caja'               */}
      {/* ===================================================================== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-card border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Cajas
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20">
              Control de Turnos & POS
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl">
            Abre y cierra turnos, registra entradas y salidas de efectivo y mira cuánto debe haber en cada caja.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Botón Refrescar */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isPending}
            className="p-2.5 text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-xl transition-colors cursor-pointer"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
          </button>

          {/* Botón: Cierre diario */}
          <button
            type="button"
            onClick={() => setActiveTab("daily_closure")}
            className={`px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border ${
              activeTab === "daily_closure"
                ? "bg-[#ED500A] text-white border-[#ED500A] shadow-xs"
                : "bg-background text-foreground border-border hover:bg-muted"
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Cierre diario</span>
          </button>

          {/* Botón: Cierre por rango */}
          <button
            type="button"
            onClick={() => setActiveTab("range_closure")}
            className={`px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border ${
              activeTab === "range_closure"
                ? "bg-[#ED500A] text-white border-[#ED500A] shadow-xs"
                : "bg-background text-foreground border-border hover:bg-muted"
            }`}
          >
            <CalendarRange className="w-4 h-4" />
            <span>Cierre por rango</span>
          </button>

          {/* Botón: Movimiento */}
          <button
            type="button"
            onClick={() => {
              if (activeRegisterWithSession && activeRegisterWithSession.activeSession) {
                setMovementModalState({
                  register: activeRegisterWithSession.register,
                  session: activeRegisterWithSession.activeSession,
                  currentCash:
                    activeRegisterWithSession.sessionSummary?.expectedCashInDrawer ||
                    activeRegisterWithSession.activeSession.initialAmount,
                  initialType: "entry",
                });
              } else {
                toast.error("No hay ninguna sesión de caja abierta para registrar movimientos.");
              }
            }}
            className="px-3.5 py-2.5 text-xs font-bold text-foreground bg-background hover:bg-muted border border-border rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Movimiento</span>
          </button>

          {/* Botón: + Nueva caja */}
          <button
            type="button"
            onClick={() => setIsCreateRegisterModalOpen(true)}
            className="px-3.5 py-2.5 text-xs font-bold text-foreground bg-background hover:bg-muted border border-border rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nueva caja</span>
          </button>

          {/* Botón: Abrir Turno */}
          <button
            type="button"
            onClick={() => handleOpenShift()}
            className="px-4 py-2.5 text-xs font-bold text-white bg-[#ED500A] hover:bg-[#d64508] active:scale-[0.98] rounded-xl shadow-md shadow-[#ED500A]/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Abrir Turno</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. MÉTRICAS Y KPIS SUPERIORES                                         */}
      {/* - Cajas abiertas (ej. '1 de 1')                                       */}
      {/* - Efectivo en cajas                                                   */}
      {/* - Vendido en turnos abiertos                                          */}
      {/* - Entradas y salidas netas                                            */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Cajas abiertas */}
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Cajas abiertas
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-foreground">
                {data.kpis.openSessionsCount} de {data.kpis.totalRegistersCount}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px]">
              {data.kpis.openSessionsCount > 0 ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {data.kpis.openSessionsCount === 1 ? "1 turno operando en vivo" : `${data.kpis.openSessionsCount} turnos operando`}
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                  <span className="text-muted-foreground">Sin cajas operando actualmente</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* KPI 2: Efectivo en cajas */}
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Efectivo en cajas
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black font-mono text-foreground">
              {formatCop(data.kpis.totalCashInDrawers)}
            </span>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Saldo físico esperado en cajones
            </p>
          </div>
        </div>

        {/* KPI 3: Vendido en turnos abiertos */}
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Vendido en turnos
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black font-mono text-foreground">
              {formatCop(data.kpis.totalSalesInOpenSessions)}
            </span>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Efectivo + tarjetas en sesiones activas
            </p>
          </div>
        </div>

        {/* KPI 4: Entradas y salidas netas */}
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Entradas / Salidas netas
            </span>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                netEntriesWithdrawals >= 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              }`}
            >
              <ArrowLeftRight className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span
              className={`text-2xl font-black font-mono ${
                netEntriesWithdrawals >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {netEntriesWithdrawals > 0 ? "+" : ""}
              {formatCop(netEntriesWithdrawals)}
            </span>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Aportes manuales menos gastos y retiros
            </p>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. TARJETA DE DETALLE DE CAJA ACTIVA                                  */}
      {/* - Nombre de la caja, badge 'Abierta', 'TU CAJA', menú contextual '...' */}
      {/* - Efectivo esperado en caja y tiempo transcurrido desde apertura      */}
      {/* - Desglose de arqueo: Base de apertura, + Ventas en efectivo, - Salidas*/}
      {/* - Resumen de ventas con monto y cantidad de transacciones              */}
      {/* - Usuario asignado (cajero activo)                                     */}
      {/* - Botones de acción: 'Movimiento' y 'Cerrar caja'                     */}
      {/* ===================================================================== */}
      {activeRegisterWithSession && activeRegisterWithSession.activeSession ? (
        <div className="p-5 sm:p-6 rounded-2xl bg-card border-2 border-emerald-500/30 dark:border-emerald-500/20 shadow-md ring-1 ring-emerald-500/10 relative overflow-hidden">
          {/* Barra lateral decorativa */}
          <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-emerald-500" />

          {/* Cabecera de la tarjeta */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <Landmark className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-black text-foreground">
                    {activeRegisterWithSession.register.name}
                  </h3>

                  {/* Badge 'Abierta' */}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Abierta</span>
                  </span>

                  {/* Badge 'TU CAJA' */}
                  {isUserActiveBox && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                      <Sparkles className="w-3 h-3" />
                      <span>TU CAJA</span>
                    </span>
                  )}

                  {/* Selector si hay múltiples cajas abiertas */}
                  {openRegisters.length > 1 && (
                    <div className="inline-flex items-center gap-1 text-[11px] text-muted-foreground ml-2">
                      <span>Ver:</span>
                      <select
                        value={activeRegisterWithSession.register.id}
                        onChange={(e) => setSelectedActiveRegisterId(e.target.value)}
                        className="px-2 py-0.5 text-xs font-semibold rounded-lg border border-border bg-background text-foreground focus:outline-none"
                      >
                        {openRegisters.map((r) => (
                          <option key={r.register.id} value={r.register.id}>
                            {r.register.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>
                      Abierta {formatElapsedTime(activeRegisterWithSession.activeSession.openedAt)}
                    </span>
                  </span>
                  <span>•</span>
                  <span>Hora: {formatDate(activeRegisterWithSession.activeSession.openedAt)}</span>
                </div>
              </div>
            </div>

            {/* Menú contextual '...' y acciones de cabecera */}
            <div className="relative flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                onClick={() => setIsContextMenuOpen(!isContextMenuOpen)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors cursor-pointer"
                title="Opciones de caja"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {/* Dropdown contextual */}
              {isContextMenuOpen && (
                <div
                  className="absolute right-0 top-11 z-20 w-52 bg-card border border-border rounded-xl shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100 text-xs"
                  onMouseLeave={() => setIsContextMenuOpen(false)}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsContextMenuOpen(false);
                      setHistoryModalState({
                        register: activeRegisterWithSession.register,
                        session: activeRegisterWithSession.activeSession!,
                        initialAmount: activeRegisterWithSession.activeSession!.initialAmount,
                        expectedCash:
                          activeRegisterWithSession.sessionSummary?.expectedCashInDrawer ||
                          activeRegisterWithSession.activeSession!.initialAmount,
                        isOpenSession: true,
                      });
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-muted flex items-center gap-2 text-foreground cursor-pointer"
                  >
                    <History className="w-4 h-4 text-primary" />
                    <span>Ver movimientos del turno</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsContextMenuOpen(false);
                      setMovementModalState({
                        register: activeRegisterWithSession.register,
                        session: activeRegisterWithSession.activeSession!,
                        currentCash:
                          activeRegisterWithSession.sessionSummary?.expectedCashInDrawer ||
                          activeRegisterWithSession.activeSession!.initialAmount,
                        initialType: "entry",
                      });
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-muted flex items-center gap-2 text-foreground cursor-pointer"
                  >
                    <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                    <span>+ Registrar entrada</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsContextMenuOpen(false);
                      setMovementModalState({
                        register: activeRegisterWithSession.register,
                        session: activeRegisterWithSession.activeSession!,
                        currentCash:
                          activeRegisterWithSession.sessionSummary?.expectedCashInDrawer ||
                          activeRegisterWithSession.activeSession!.initialAmount,
                        initialType: "withdrawal",
                      });
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-muted flex items-center gap-2 text-foreground cursor-pointer"
                  >
                    <ArrowUpRight className="w-4 h-4 text-amber-600" />
                    <span>- Registrar retiro</span>
                  </button>

                  <div className="my-1 border-t border-border" />

                  <button
                    type="button"
                    onClick={() => {
                      setIsContextMenuOpen(false);
                      handleCloseShift(activeRegisterWithSession);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center gap-2 font-bold cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Cerrar caja (Arqueo)</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Cuerpo: Efectivo esperado, Desglose de arqueo y Resumen de ventas */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 py-4">
            {/* Efectivo esperado en caja */}
            <div className="md:col-span-4 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex flex-col justify-between space-y-2">
              <div>
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider block">
                  Efectivo esperado en caja
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Fondo base + cobros en efectivo - egresos
                </span>
              </div>
              <span className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                {formatCop(
                  activeRegisterWithSession.sessionSummary?.expectedCashInDrawer ||
                    activeRegisterWithSession.activeSession.initialAmount
                )}
              </span>
            </div>

            {/* Desglose de arqueo */}
            <div className="md:col-span-4 p-4 rounded-xl bg-muted/30 border border-border flex flex-col justify-between space-y-2 text-xs">
              <span className="font-bold text-foreground uppercase tracking-wider block text-[11px]">
                Desglose de Arqueo
              </span>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Base de apertura:</span>
                  <span className="font-mono font-bold text-foreground">
                    {formatCop(activeRegisterWithSession.activeSession.initialAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                  <span>+ Ventas en efectivo:</span>
                  <span className="font-mono font-bold">
                    +{formatCop(activeRegisterWithSession.sessionSummary?.totalSalesCash || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                  <span>- Salidas (Gastos/Retiros):</span>
                  <span className="font-mono font-bold">
                    -{formatCop(
                      (activeRegisterWithSession.sessionSummary?.totalExpenses || 0) +
                        (activeRegisterWithSession.sessionSummary?.totalWithdrawals || 0)
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Resumen de ventas */}
            <div className="md:col-span-4 p-4 rounded-xl bg-muted/30 border border-border flex flex-col justify-between space-y-2 text-xs">
              <span className="font-bold text-foreground uppercase tracking-wider block text-[11px]">
                Resumen de Ventas
              </span>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total ventas:</span>
                  <span className="font-mono font-bold text-foreground">
                    {formatCop(activeRegisterWithSession.sessionSummary?.totalSales || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Movimientos / Ventas:</span>
                  <span className="font-semibold text-foreground">
                    {activeRegisterWithSession.sessionSummary?.movementsCount || 0} operaciones
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                  <span>Venta tarjeta/digital:</span>
                  <span className="font-mono text-foreground">
                    {formatCop(
                      (activeRegisterWithSession.sessionSummary?.totalSalesCard || 0) +
                        (activeRegisterWithSession.sessionSummary?.totalSalesDigital || 0)
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Pie de la tarjeta: Usuario asignado y Botones de acción */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-border">
            {/* Usuario asignado (cajero activo) */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs border border-primary/20">
                <User className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-foreground block">
                  {isUserActiveBox ? "Tú estás a cargo de esta caja" : "Cajero en turno activo"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {activeRegisterWithSession.activeSession.notes
                    ? `Nota: ${activeRegisterWithSession.activeSession.notes}`
                    : "Operaciones registradas con auditoría completa"}
                </span>
              </div>
            </div>

            {/* Botones de acción: Movimiento y Cerrar caja */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() =>
                  setMovementModalState({
                    register: activeRegisterWithSession.register,
                    session: activeRegisterWithSession.activeSession!,
                    currentCash:
                      activeRegisterWithSession.sessionSummary?.expectedCashInDrawer ||
                      activeRegisterWithSession.activeSession!.initialAmount,
                    initialType: "entry",
                  })
                }
                className="flex-1 sm:flex-initial px-4 py-2 text-xs font-bold text-foreground bg-muted hover:bg-muted/80 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                <span>Movimiento</span>
              </button>

              <button
                type="button"
                onClick={() => handleCloseShift(activeRegisterWithSession)}
                className="flex-1 sm:flex-initial px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-black dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Cerrar caja</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Tarjeta cuando no hay cajas abiertas */
        <div className="p-6 rounded-2xl bg-card border border-dashed border-border text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">
              No hay turnos de caja abiertos actualmente
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto mt-0.5">
              Abre un turno con fondo inicial en una de tus terminales para registrar ventas en efectivo y movimientos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleOpenShift()}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-[#ED500A] hover:bg-[#d64508] rounded-xl shadow-md shadow-[#ED500A]/20 transition-all cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Abrir turno de caja</span>
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4. PESTAÑAS DE GESTIÓN                                                */}
      {/* - Pestaña 1: 'Movimientos'                                            */}
      {/* - Pestaña 2: 'Historial de turnos'                                    */}
      {/* - Pestaña 3: 'Cajeros'                                                */}
      {/* - Extras: 'Terminales', 'Cierre diario', 'Cierre por rango'           */}
      {/* ===================================================================== */}
      <div className="space-y-4">
        {/* Barra de pestañas */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-1 text-xs">
          {/* Pestaña 1: Movimientos */}
          <button
            type="button"
            onClick={() => setActiveTab("movements")}
            className={`px-4 py-2.5 font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "movements"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>Movimientos</span>
          </button>

          {/* Pestaña 2: Historial de turnos */}
          <button
            type="button"
            onClick={() => setActiveTab("shift_history")}
            className={`px-4 py-2.5 font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "shift_history"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <History className="w-4 h-4" />
            <span>Historial de turnos</span>
          </button>

          {/* Pestaña 3: Cajeros */}
          <button
            type="button"
            onClick={() => setActiveTab("cashiers")}
            className={`px-4 py-2.5 font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "cashiers"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Cajeros</span>
          </button>

          {/* Pestaña: Terminales de caja */}
          <button
            type="button"
            onClick={() => setActiveTab("terminals")}
            className={`px-4 py-2.5 font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "terminals"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Landmark className="w-4 h-4" />
            <span>Terminales ({data.registers.length})</span>
          </button>

          {/* Pestaña: Cierre diario (Z) */}
          <button
            type="button"
            onClick={() => setActiveTab("daily_closure")}
            className={`px-4 py-2.5 font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "daily_closure"
                ? "bg-[#ED500A] text-white shadow-xs"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Cierre diario (Z)</span>
          </button>

          {/* Pestaña: Cierre por rango */}
          <button
            type="button"
            onClick={() => setActiveTab("range_closure")}
            className={`px-4 py-2.5 font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "range_closure"
                ? "bg-[#ED500A] text-white shadow-xs"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <CalendarRange className="w-4 h-4" />
            <span>Cierre por Rango</span>
          </button>
        </div>

        {/* =================================================================== */}
        {/* CONTENIDO PESTAÑA 1: MOVIMIENTOS                                   */}
        {/* =================================================================== */}
        {activeTab === "movements" && (
          <div className="space-y-4">
            {/* Barra de Filtros */}
            <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                {/* Buscador libre */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={movementSearchQuery}
                    onChange={(e) => setMovementSearchQuery(e.target.value)}
                    placeholder="Buscar por concepto o referencia..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                  />
                </div>

                {/* Filtro por Tipo */}
                <select
                  value={movementTypeFilter}
                  onChange={(e) => setMovementTypeFilter(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-xs"
                >
                  <option value="all">Todos los tipos</option>
                  <option value="sale_cash">Ventas en Efectivo</option>
                  <option value="entry">Entradas Manuales</option>
                  <option value="expense">Gastos de Caja</option>
                  <option value="withdrawal">Retiros de Efectivo</option>
                  <option value="sale_card">Ventas Tarjeta</option>
                  <option value="sale_digital">Ventas Digitales</option>
                </select>

                {/* Filtro por Caja */}
                {data.registers.length > 1 && (
                  <select
                    value={movementRegisterFilter}
                    onChange={(e) => setMovementRegisterFilter(e.target.value)}
                    className="px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-xs"
                  >
                    <option value="all">Todas las cajas</option>
                    {data.registers.map((r) => (
                      <option key={r.register.id} value={r.register.id}>
                        {r.register.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <span className="text-muted-foreground text-[11px] self-end sm:self-center font-medium">
                {filteredMovements.length} movimientos encontrados
              </span>
            </div>

            {/* Tabla de Movimientos */}
            <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
              {isMovementsLoading ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-xs">Cargando movimientos de caja...</span>
                </div>
              ) : filteredMovements.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground space-y-1">
                  <ArrowLeftRight className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm font-semibold text-foreground">No hay movimientos registrados</p>
                  <p className="text-xs">Los cobros y egresos registrados en caja aparecerán aquí.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                      <tr>
                        <th className="px-4 py-3">Fecha y Hora</th>
                        <th className="px-4 py-3">Caja / Terminal</th>
                        <th className="px-4 py-3">Tipo de Movimiento</th>
                        <th className="px-4 py-3">Concepto / Notas</th>
                        <th className="px-4 py-3 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredMovements.map((mov) => {
                        const isIncome =
                          mov.movementType === "sale_cash" ||
                          mov.movementType === "entry" ||
                          mov.movementType === "sale_card" ||
                          mov.movementType === "sale_digital";

                        const isExpense = mov.movementType === "expense" || mov.movementType === "withdrawal";

                        return (
                          <tr key={mov.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 text-muted-foreground font-mono">
                              {formatDate(mov.createdAt)}
                            </td>
                            <td className="px-4 py-3 font-semibold text-foreground">
                              {mov.registerName || "Caja Principal"}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  mov.movementType === "sale_cash"
                                    ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20"
                                    : mov.movementType === "entry"
                                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                                    : mov.movementType === "expense"
                                    ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
                                    : mov.movementType === "withdrawal"
                                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {mov.movementType === "entry" && <ArrowDownRight className="w-3 h-3" />}
                                {isExpense && <ArrowUpRight className="w-3 h-3" />}
                                <span>{CASH_MOVEMENT_TYPE_LABELS[mov.movementType] || mov.movementType}</span>
                              </span>
                            </td>
                            <td className="px-4 py-3 text-foreground font-medium">
                              {mov.notes || (mov.referenceId ? `Ref: ${mov.referenceId}` : "Sin concepto")}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span
                                className={`font-mono font-bold text-xs sm:text-sm ${
                                  isIncome
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-rose-600 dark:text-rose-400"
                                }`}
                              >
                                {isIncome ? "+" : "-"}
                                {formatCop(mov.amount)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* CONTENIDO PESTAÑA 2: HISTORIAL DE TURNOS                            */}
        {/* =================================================================== */}
        {activeTab === "shift_history" && (
          <div className="space-y-4">
            {/* Filtros de turnos */}
            <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-semibold">Estado:</span>
                <button
                  type="button"
                  onClick={() => setSessionStatusFilter("all")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    sessionStatusFilter === "all"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setSessionStatusFilter("open")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    sessionStatusFilter === "open"
                      ? "bg-emerald-600 text-white"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Abiertos
                </button>
                <button
                  type="button"
                  onClick={() => setSessionStatusFilter("closed")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    sessionStatusFilter === "closed"
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Cerrados
                </button>
              </div>

              <span className="text-muted-foreground text-[11px]">
                {filteredSessionsHistory.length} turnos registrados
              </span>
            </div>

            {/* Listado de Turnos */}
            <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
              {isHistoryLoading ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-xs">Cargando historial de turnos...</span>
                </div>
              ) : filteredSessionsHistory.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground space-y-1">
                  <History className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm font-semibold text-foreground">No hay turnos registrados</p>
                  <p className="text-xs">Abre un turno para iniciar el registro histórico de caja.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                      <tr>
                        <th className="px-4 py-3">Caja</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3">Apertura</th>
                        <th className="px-4 py-3">Cierre</th>
                        <th className="px-4 py-3 text-right">Base Inicial</th>
                        <th className="px-4 py-3 text-right">Vendido</th>
                        <th className="px-4 py-3 text-right">Arqueo Final</th>
                        <th className="px-4 py-3 text-right">Diferencia</th>
                        <th className="px-4 py-3 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredSessionsHistory.map((s) => {
                        const isClosed = s.status === "closed";
                        const hasDifference = s.difference !== null && s.difference !== undefined;
                        const diffVal = s.difference || 0;

                        return (
                          <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 font-bold text-foreground">
                              {s.registerName}
                            </td>
                            <td className="px-4 py-3">
                              {s.status === "open" ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  <span>Abierto</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
                                  <span>Cerrado</span>
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground font-mono">
                              {formatDate(s.openedAt)}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground font-mono">
                              {s.closedAt ? formatDate(s.closedAt) : "En curso..."}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                              {formatCop(s.initialAmount)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                              {formatCop(s.totalSales || 0)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                              {s.finalAmountCounted != null ? formatCop(Number(s.finalAmountCounted)) : "N/A"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {hasDifference ? (
                                <span
                                  className={`inline-block font-mono font-bold text-xs ${
                                    diffVal === 0
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : diffVal > 0
                                      ? "text-blue-600 dark:text-blue-400"
                                      : "text-rose-600 dark:text-rose-400"
                                  }`}
                                >
                                  {diffVal === 0
                                    ? "Exacto ($0)"
                                    : diffVal > 0
                                    ? `+${formatCop(diffVal)} (Sobrante)`
                                    : `${formatCop(diffVal)} (Faltante)`}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-[11px]">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  const reg = data.registers.find((r) => r.register.id === s.registerId)?.register || {
                                    id: s.registerId,
                                    businessId,
                                    name: s.registerName,
                                    isActive: true,
                                    createdAt: s.openedAt,
                                    updatedAt: s.openedAt,
                                  };
                                  setHistoryModalState({
                                    register: reg,
                                    session: {
                                      id: s.id,
                                      registerId: s.registerId,
                                      businessId: s.businessId,
                                      openedAt: s.openedAt,
                                      initialAmount: s.initialAmount,
                                      closedAt: s.closedAt,
                                      finalAmountCounted: s.finalAmountCounted,
                                      notes: s.notes,
                                      status: s.status,
                                      createdAt: s.openedAt,
                                      updatedAt: s.closedAt || s.openedAt,
                                    },
                                    initialAmount: s.initialAmount,
                                    expectedCash: s.expectedCash || s.initialAmount,
                                    isOpenSession: s.status === "open",
                                  });
                                }}
                                className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                title="Ver movimientos de este turno"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* CONTENIDO PESTAÑA 3: CAJEROS                                        */}
        {/* =================================================================== */}
        {activeTab === "cashiers" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
              {isCashiersLoading ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-xs">Cargando cajeros y colaboradores...</span>
                </div>
              ) : cashiersList.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground space-y-1">
                  <Users className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm font-semibold text-foreground">No se encontraron cajeros</p>
                  <p className="text-xs">Invita o asigna colaboradores al comercio desde el módulo de Personal.</p>
                </div>
              ) : (
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cashiersList.map((cashier) => (
                    <div
                      key={cashier.id}
                      className="p-4 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition-all flex items-start gap-3.5"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm shrink-0 border border-primary/20">
                        {cashier.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-sm font-bold text-foreground truncate">
                            {cashier.name}
                          </h4>
                          {cashier.isOnline ? (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="En turno" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" title="Disponible" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{cashier.email}</p>
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-muted text-muted-foreground uppercase tracking-wider">
                            {cashier.role}
                          </span>
                          {cashier.activeRegisterName ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                              Asignado a: {cashier.activeRegisterName}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">
                              Sin caja asignada
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* CONTENIDO PESTAÑA: TERMINALES Y TURNOS (LISTADO POR CAJA)           */}
        {/* =================================================================== */}
        {activeTab === "terminals" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Terminales registradas ({data.registers.length})
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {data.registers.map((rw) => {
                const isOpen = Boolean(rw.activeSession);
                const summary = rw.sessionSummary;

                return (
                  <div
                    key={rw.register.id}
                    className={`p-5 rounded-2xl bg-card border transition-all flex flex-col justify-between shadow-xs ${
                      isOpen
                        ? "border-emerald-500/40 dark:border-emerald-500/30 ring-1 ring-emerald-500/20"
                        : "border-border"
                    }`}
                  >
                    <div>
                      {/* Cabecera */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                              isOpen
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <Landmark className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-foreground">
                              {rw.register.name}
                            </h4>
                            <span className="text-[11px] text-muted-foreground">
                              {locations.find((l) => l.id === rw.register.locationId)?.name ||
                                "Terminal de Cobro"}
                            </span>
                          </div>
                        </div>

                        {isOpen ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Abierto</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
                            <Lock className="w-3 h-3" />
                            <span>Cerrada</span>
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      {isOpen && rw.activeSession ? (
                        <div className="mt-4 space-y-3">
                          <div className="p-2.5 rounded-xl bg-muted/40 border border-border flex items-center justify-between text-xs text-muted-foreground">
                            <span>Abierto: {formatDate(rw.activeSession.openedAt)}</span>
                            <span className="font-mono font-bold text-foreground">
                              Base: {formatCop(rw.activeSession.initialAmount)}
                            </span>
                          </div>

                          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                              Efectivo Esperado
                            </span>
                            <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                              {formatCop(summary?.expectedCashInDrawer || rw.activeSession.initialAmount)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 p-4 rounded-xl bg-muted/20 border border-dashed border-border text-center">
                          <p className="text-xs text-muted-foreground">Sin turno activo actualmente</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-border">
                      {isOpen ? (
                        <button
                          type="button"
                          onClick={() => handleCloseShift(rw)}
                          className="w-full py-2 px-3 text-xs font-bold text-white bg-slate-900 hover:bg-black dark:bg-white dark:text-slate-900 rounded-xl transition-all cursor-pointer"
                        >
                          Cerrar Turno (Arqueo)
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenShift(rw.register.id)}
                          className="w-full py-2 px-3 text-xs font-bold text-[#ED500A] bg-[#ED500A]/10 hover:bg-[#ED500A] hover:text-white border border-[#ED500A]/20 rounded-xl transition-all cursor-pointer"
                        >
                          Abrir Turno
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PESTAÑAS: CIERRES */}
        {activeTab === "daily_closure" && <DailyClosurePanel businessId={businessId} />}
        {activeTab === "range_closure" && <DateRangeClosurePanel businessId={businessId} />}
      </div>

      {/* ===================================================================== */}
      {/* 5. MODALES PORTAL                                                     */}
      {/* ===================================================================== */}
      {/* Modal: Abrir turno */}
      <OpenCashShiftModal
        isOpen={isOpenShiftModalOpen}
        businessId={businessId}
        registersWithSessions={data.registers}
        defaultRegisterId={openShiftDefaultRegisterId}
        onClose={() => {
          setIsOpenShiftModalOpen(false);
          setOpenShiftDefaultRegisterId(undefined);
        }}
        onSuccess={() => {
          handleRefresh();
        }}
      />

      {/* Modal: Cerrar turno */}
      {closingRegister && (
        <CloseCashShiftModal
          isOpen={Boolean(closingRegister)}
          businessId={businessId}
          register={closingRegister.register}
          session={closingRegister.session}
          onClose={() => setClosingRegister(null)}
          onSuccess={() => {
            setClosingRegister(null);
            handleRefresh();
          }}
        />
      )}

      {/* Modal: Crear nueva caja [CAJA-002] */}
      <CreateCashRegisterModal
        isOpen={isCreateRegisterModalOpen}
        businessId={businessId}
        locations={locations}
        onClose={() => setIsCreateRegisterModalOpen(false)}
        onSuccess={(newRegister) => {
          setData((prev) => ({
            ...prev,
            registers: [
              ...prev.registers,
              {
                register: newRegister,
                activeSession: null,
                sessionSummary: null,
              },
            ],
            kpis: {
              ...prev.kpis,
              totalRegistersCount: prev.kpis.totalRegistersCount + 1,
            },
          }));
          setIsCreateRegisterModalOpen(false);
          handleRefresh();
        }}
      />

      {/* Modal: Registrar entrada / salida de efectivo [CAJA-002] */}
      {movementModalState && (
        <CashMovementModal
          isOpen={Boolean(movementModalState)}
          businessId={businessId}
          registersWithSessions={data.registers}
          defaultRegisterId={movementModalState.register?.id}
          sessionId={movementModalState.session?.id}
          registerName={movementModalState.register?.name}
          currentCashInDrawer={movementModalState.currentCash}
          initialType={movementModalState.initialType}
          onClose={() => setMovementModalState(null)}
          onSuccess={(updatedExpectedCash, registerId) => {
            const targetRegisterId = registerId || movementModalState.register?.id;
            // Efectivo en caja actualizado al instante en la interfaz
            setData((prev) => {
              const nextRegisters = prev.registers.map((rw) => {
                if (rw.register.id === targetRegisterId) {
                  return {
                    ...rw,
                    sessionSummary: rw.sessionSummary
                      ? {
                          ...rw.sessionSummary,
                          expectedCashInDrawer: updatedExpectedCash,
                        }
                      : null,
                  };
                }
                return rw;
              });

              const newTotalCash = nextRegisters.reduce((acc, r) => {
                if (!r.activeSession) return acc;
                return (
                  acc +
                  (r.sessionSummary?.expectedCashInDrawer ??
                    r.activeSession.initialAmount ??
                    0)
                );
              }, 0);

              return {
                ...prev,
                registers: nextRegisters,
                kpis: {
                  ...prev.kpis,
                  totalCashInDrawers: newTotalCash,
                },
              };
            });

            setMovementModalState(null);
            handleRefresh();
          }}
        />
      )}

      {/* Modal: Historial de movimientos del turno */}
      {historyModalState && (
        <ShiftMovementsHistoryModal
          isOpen={Boolean(historyModalState)}
          businessId={businessId}
          sessionId={historyModalState.session.id}
          registerName={historyModalState.register.name}
          initialAmount={historyModalState.initialAmount}
          expectedCashInDrawer={historyModalState.expectedCash}
          isOpenSession={historyModalState.isOpenSession}
          onClose={() => setHistoryModalState(null)}
          onNewMovementClick={(type) => {
            setMovementModalState({
              register: historyModalState.register,
              session: historyModalState.session,
              currentCash: historyModalState.expectedCash,
              initialType: type,
            });
            setHistoryModalState(null);
          }}
        />
      )}
    </div>
  );
}
