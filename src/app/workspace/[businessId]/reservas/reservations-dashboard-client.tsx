"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import {
  Calendar as CalendarIcon,
  ListFilter,
  LayoutGrid,
  Plus,
  Search,
  Filter,
  Users,
  Clock,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  UtensilsCrossed,
  MessageSquare,
  Sparkles,
  UserCheck,
  Armchair,
  X,
  Edit2,
  Trash2,
  TrendingUp,
  Store,
  Footprints,
  Globe,
  Loader2,
  AlertTriangle,
  MoveRight,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { SearchInput } from "@/components/ui/search-input";
import { ReservationFormModal } from "./reservation-form-modal";
import { AssignTableModal } from "./assign-table-modal";
import {
  getReservationsAction,
  getReservationMetricsAction,
  updateReservationStatusAction,
  assignReservationTableAction,
  deleteReservationAction,
} from "./actions";
import type {
  ReservationWithDetails,
  ReservationStatus,
  ReservationMetrics,
  ReservationOrigin,
} from "@/lib/reservations/types";
import {
  RESERVATION_STATUS_META,
  RESERVATION_ORIGIN_META,
} from "@/lib/reservations/types";
import type { RestaurantRoom, RestaurantTableWithOrder } from "@/lib/restaurant/types";

interface Props {
  businessId: string;
  initialReservations: ReservationWithDetails[];
  initialMetrics: ReservationMetrics;
  initialRooms: RestaurantRoom[];
  initialTables: RestaurantTableWithOrder[];
}

const HOURS_SCHEDULE = [
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
  "23:00",
];

const WEEK_DAYS = ["lu", "ma", "mi", "ju", "vi", "sá", "do"];

export function ReservationsDashboardClient({
  businessId,
  initialReservations,
  initialMetrics,
  initialRooms,
  initialTables,
}: Props) {
  // Pestañas del módulo: "Vista Calendario" | "Lista Reservas" | "Asignar Mesas"
  const [activeTab, setActiveTab] = useState<"calendar" | "list" | "tables">("calendar");

  // Fecha seleccionada (YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Estados de datos
  const [reservations, setReservations] = useState<ReservationWithDetails[]>(initialReservations);
  const [metrics, setMetrics] = useState<ReservationMetrics>(initialMetrics);
  const [rooms] = useState<RestaurantRoom[]>(initialRooms);
  const [tables] = useState<RestaurantTableWithOrder[]>(initialTables);

  // Filtros de Lista
  const [search, setSearch] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedOrigin, setSelectedOrigin] = useState<string>("all");

  // Filtro de Sala en Asignar Mesas
  const [selectedRoomId, setSelectedRoomId] = useState<string>("all");
  const [selectedReservationToAssign, setSelectedReservationToAssign] = useState<ReservationWithDetails | null>(null);

  // Modales
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<ReservationWithDetails | null>(null);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assigningReservation, setAssigningReservation] = useState<ReservationWithDetails | null>(null);

  const [reservationToDelete, setReservationToDelete] = useState<ReservationWithDetails | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isPending, startTransition] = useTransition();

  // Recargar datos y métricas
  const refreshData = async (targetDate = selectedDate) => {
    try {
      const [resList, resMet] = await Promise.all([
        getReservationsAction(businessId),
        getReservationMetricsAction(businessId, targetDate),
      ]);

      if (resList.success && resList.data) {
        setReservations(resList.data);
      }
      if (resMet.success && resMet.data) {
        setMetrics(resMet.data);
      }
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar reservas.");
    }
  };

  // Cambio de estado de reserva directo
  const handleStatusChange = (reservationId: string, nextStatus: ReservationStatus) => {
    startTransition(async () => {
      const res = await updateReservationStatusAction(businessId, reservationId, nextStatus);
      if (res.success && res.data) {
        setReservations((prev) =>
          prev.map((r) => (r.id === reservationId ? { ...r, status: nextStatus } : r))
        );
        toast.success(`Estado actualizado a ${RESERVATION_STATUS_META[nextStatus]?.label || nextStatus}.`);
        refreshData(selectedDate);
      } else {
        toast.error(res.error || "No se pudo actualizar el estado.");
      }
    });
  };

  // Confirmar eliminación (cero alertas nativas)
  const handleConfirmDelete = async () => {
    if (!reservationToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteReservationAction(businessId, reservationToDelete.id);
      if (res.success) {
        toast.success(`Reserva de «${reservationToDelete.customer_name}» eliminada.`);
        setReservations((prev) => prev.filter((r) => r.id !== reservationToDelete.id));
        setReservationToDelete(null);
        refreshData(selectedDate);
      } else {
        toast.error(res.error || "No se pudo eliminar la reserva.");
      }
    } catch {
      toast.error("Ocurrió un error al eliminar la reserva.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Asignar reserva a mesa directamente
  const handleAssignTable = async (table: RestaurantTableWithOrder) => {
    if (!selectedReservationToAssign) {
      toast.info("Selecciona primero una reserva sin mesa del panel izquierdo.");
      return;
    }

    startTransition(async () => {
      const res = await assignReservationTableAction(businessId, {
        reservationId: selectedReservationToAssign.id,
        tableId: table.id,
        roomId: table.room_id || null,
      });

      if (res.success && res.data) {
        toast.success(`Mesa ${table.name_or_number} asignada a ${selectedReservationToAssign.customer_name}.`);
        setReservations((prev) =>
          prev.map((r) =>
            r.id === selectedReservationToAssign.id
              ? {
                  ...r,
                  table_id: table.id,
                  table_name_or_number: table.name_or_number,
                  room_id: table.room_id || null,
                }
              : r
          )
        );
        setSelectedReservationToAssign(null);
      } else {
        toast.error(res.error || "No se pudo asignar la mesa.");
      }
    });
  };

  // Desasignar mesa directamente
  const handleUnassignTable = async (reservationId: string) => {
    startTransition(async () => {
      const res = await assignReservationTableAction(businessId, {
        reservationId,
        tableId: null,
        roomId: null,
      });

      if (res.success && res.data) {
        toast.success("Mesa desasignada con éxito.");
        setReservations((prev) =>
          prev.map((r) =>
            r.id === reservationId
              ? {
                  ...r,
                  table_id: null,
                  table_name_or_number: null,
                }
              : r
          )
        );
      } else {
        toast.error(res.error || "No se pudo desasignar la mesa.");
      }
    });
  };

  // Navegación mensual para el calendario
  const currentMonthDate = useMemo(() => new Date(selectedDate + "T00:00:00"), [selectedDate]);
  const monthName = currentMonthDate.toLocaleDateString("es-CO", {
    month: "long",
    year: "numeric",
  });

  const handleShiftMonth = (months: number) => {
    const cur = new Date(selectedDate + "T00:00:00");
    cur.setMonth(cur.getMonth() + months);
    setSelectedDate(cur.toISOString().split("T")[0]);
  };

  // Generador de cuadrícula mensual
  const monthDays = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 es domingo
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Días previos de relleno para que empiece en Lunes (1)
    const padding = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    const days: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean }> = [];

    // Días del mes anterior
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = padding - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevDate = new Date(year, month - 1, d);
      days.push({
        dateStr: prevDate.toISOString().split("T")[0],
        dayNum: d,
        isCurrentMonth: false,
      });
    }

    // Días del mes actual
    for (let d = 1; d <= daysInMonth; d++) {
      const curDate = new Date(year, month, d);
      days.push({
        dateStr: curDate.toISOString().split("T")[0],
        dayNum: d,
        isCurrentMonth: true,
      });
    }

    // Días del mes siguiente de relleno
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      days.push({
        dateStr: nextDate.toISOString().split("T")[0],
        dayNum: d,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentMonthDate]);

  // Reservas activas para la fecha seleccionada
  const activeDateReservations = useMemo(() => {
    return reservations
      .filter((r) => r.date === selectedDate && r.status !== "cancelled")
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [reservations, selectedDate]);

  // Reservas filtradas para la pestaña Lista
  const filteredReservations = useMemo(() => {
    return reservations.filter((r) => {
      if (selectedStatus !== "all" && r.status !== selectedStatus) return false;
      if (selectedOrigin !== "all" && r.origin !== selectedOrigin) return false;

      if (search.trim()) {
        const s = search.trim().toLowerCase();
        const matches =
          r.customer_name.toLowerCase().includes(s) ||
          (r.phone && r.phone.toLowerCase().includes(s)) ||
          (r.email && r.email.toLowerCase().includes(s)) ||
          (r.notes && r.notes.toLowerCase().includes(s));
        if (!matches) return false;
      }

      return true;
    });
  }, [reservations, selectedStatus, selectedOrigin, search]);

  // Reservas sin mesa asignada para la fecha seleccionada
  const unassignedReservations = useMemo(() => {
    return reservations.filter(
      (r) => r.date === selectedDate && !r.table_id && r.status !== "cancelled"
    );
  }, [reservations, selectedDate]);

  // Mesas filtradas por sala para la pestaña Asignar Mesas
  const filteredTables = useMemo(() => {
    if (selectedRoomId === "all") return tables;
    return tables.filter((t) => t.room_id === selectedRoomId);
  }, [tables, selectedRoomId]);

  // Fecha seleccionada formateada para título de agenda
  const formattedSelectedDateHeader = useMemo(() => {
    const d = new Date(selectedDate + "T00:00:00");
    const formatted = d.toLocaleDateString("es-CO", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }, [selectedDate]);

  return (
    <div className="space-y-6 font-body">
      {/* 1. ENCABEZADO Y ACCIONES PRINCIPALES */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-1 border-b border-slate-200/80 dark:border-white/[0.08]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Sistema de Reservas
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Gestiona reservas, walk-ins y ocupación del restaurante.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingReservation(null);
            setIsFormModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md shadow-orange-500/20 active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Nueva Reserva</span>
        </button>
      </div>

      {/* 2. MÉTRICAS Y KPIS DE RESERVAS (4 TARJETAS EXACTAS) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Reservas Hoy */}
        <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Reservas Hoy</span>
            <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <CalendarIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {metrics.todayCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {metrics.confirmedTodayCount || 0} confirmadas • {metrics.totalGuestsToday || 0} comensales
          </div>
        </div>

        {/* KPI 2: Próximos 7 Días */}
        <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Próximos 7 Días</span>
            <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {metrics.next7DaysCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            reservas programadas
          </div>
        </div>

        {/* KPI 3: Walk-ins Hoy */}
        <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Walk-ins Hoy</span>
            <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {metrics.walkInsCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            sin reserva previa
          </div>
        </div>

        {/* KPI 4: Ocupación */}
        <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Ocupación</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Armchair className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {metrics.occupancyRate}%
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            capacidad estimada
          </div>
        </div>
      </div>

      {/* 3. PESTAÑAS DE NAVEGACIÓN DEL MÓDULO (3 PESTAÑAS) */}
      <Tabs<"calendar" | "list" | "tables">
        variant="underline"
        tabs={[
          { id: "calendar", label: "Vista Calendario", icon: <CalendarIcon className="w-4 h-4" /> },
          { id: "list", label: "Lista Reservas", icon: <ListFilter className="w-4 h-4" />, count: reservations.length },
          {
            id: "tables",
            label: "Asignar Mesas",
            icon: <LayoutGrid className="w-4 h-4" />,
            badge: unassignedReservations.length > 0 ? (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-3xs font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                {unassignedReservations.length}
              </span>
            ) : null,
          },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* ========================================================================= */}
      {/* 4. PESTAÑA: VISTA CALENDARIO (DOS COLUMNAS LADO A LADO)                   */}
      {/* ========================================================================= */}
      {activeTab === "calendar" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Columna Izquierda: Selector y Métricas de Fecha (4 cols) */}
          <div className="lg:col-span-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-3xl p-5 space-y-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Seleccionar Fecha
            </h3>

            {/* Navegador mensual */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/[0.06]">
              <span className="text-xs font-bold capitalize text-slate-900 dark:text-white">
                {monthName}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleShiftMonth(-1)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  title="Mes anterior"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleShiftMonth(1)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  title="Mes siguiente"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Calendario mensual: Días de la semana lu a do + cuadrícula */}
            <div>
              <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
                {WEEK_DAYS.map((day) => (
                  <span
                    key={day}
                    className="text-[10px] font-bold uppercase text-slate-400 tracking-wider py-1"
                  >
                    {day}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {monthDays.map((d, idx) => {
                  const isSelected = d.dateStr === selectedDate;
                  const isToday = d.dateStr === todayStr;
                  const dayReservations = reservations.filter(
                    (r) => r.date === d.dateStr && r.status !== "cancelled"
                  );
                  const hasReservations = dayReservations.length > 0;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedDate(d.dateStr)}
                      className={`h-9 rounded-xl text-xs font-medium relative flex items-center justify-center transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[#ED500A] text-white font-bold shadow-xs"
                          : d.isCurrentMonth
                          ? isToday
                            ? "bg-orange-500/10 text-[#ED500A] font-bold"
                            : "hover:bg-slate-100 dark:hover:bg-white/[0.04] text-slate-700 dark:text-slate-300"
                          : "text-slate-300 dark:text-slate-600 hover:text-slate-500"
                      }`}
                    >
                      <span>{d.dayNum}</span>
                      {hasReservations && !isSelected && (
                        <span className="w-1 h-1 rounded-full bg-[#ED500A] absolute bottom-1.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Resumen diario */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.06] space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Ocupación estimada</span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {metrics.occupancyRate}%
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Total reservas</span>
                <span className="font-bold font-mono text-slate-900 dark:text-white">
                  {activeDateReservations.length}
                </span>
              </div>
            </div>

            {/* Acción rápida: Botón Nueva Reserva a todo el ancho */}
            <button
              type="button"
              onClick={() => {
                setEditingReservation(null);
                setIsFormModalOpen(true);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-[#ED500A] hover:bg-[#ED500A]/90 text-white font-semibold text-xs shadow-md shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Reserva</span>
            </button>
          </div>

          {/* Columna Derecha: Agenda Horaria (8 cols) */}
          <div className="lg:col-span-8 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Reservas para {formattedSelectedDateHeader}
              </h3>
              <span className="text-xs font-mono text-slate-400">
                {activeDateReservations.length} activas
              </span>
            </div>

            {/* Cronograma por horas continuas */}
            <div className="divide-y divide-slate-100 dark:divide-white/[0.06] max-h-[640px] overflow-y-auto pr-1">
              {HOURS_SCHEDULE.map((hour) => {
                const hourPrefix = hour.slice(0, 2);
                const matchingReservations = activeDateReservations.filter((r) =>
                  r.time.startsWith(hourPrefix)
                );

                return (
                  <div key={hour} className="py-3 flex items-start gap-4">
                    {/* Bloque horario */}
                    <div className="w-14 shrink-0 font-mono text-xs font-bold text-slate-400 dark:text-slate-500 pt-1">
                      {hour}
                    </div>

                    {/* Fichas de reservas o etiqueta "Sin reservas" */}
                    <div className="flex-1 min-w-0">
                      {matchingReservations.length === 0 ? (
                        <span className="text-xs text-slate-300 dark:text-slate-600 italic select-none">
                          Sin reservas
                        </span>
                      ) : (
                        <div className="space-y-2">
                          {matchingReservations.map((r) => {
                            const statusMeta = RESERVATION_STATUS_META[r.status] || RESERVATION_STATUS_META.confirmed;
                            return (
                              <div
                                key={r.id}
                                className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between gap-3 hover:border-orange-500/40 transition-all"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-[#ED500A] flex items-center justify-center font-bold text-xs shrink-0">
                                    {r.customer_name.slice(0, 1)}
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                      {r.customer_name}
                                    </h4>
                                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                                      <span className="flex items-center gap-1 font-mono">
                                        <Users className="w-3 h-3" />
                                        {r.party_size} personas
                                      </span>
                                      <span>•</span>
                                      <span className="font-mono text-slate-600 dark:text-slate-300">
                                        {r.table_name_or_number
                                          ? `Mesa ${r.table_name_or_number}`
                                          : "Sin mesa asignada"}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span
                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${statusMeta.badgeClass}`}
                                  >
                                    {statusMeta.label}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingReservation(r);
                                      setIsFormModalOpen(true);
                                    }}
                                    className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors cursor-pointer"
                                    title="Modificar"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. PESTAÑA: LISTA RESERVAS (FILTROS Y TABLA COMPLETA)                     */}
      {/* ========================================================================= */}
      {activeTab === "list" && (
        <div className="space-y-4">
          {/* Barra de filtros */}
          <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex-1 max-w-md">
              <SearchInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClear={() => setSearch("")}
                placeholder="Buscar por nombre, teléfono o email..."
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Filtro de estado */}
              <Select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="all">Todos los estados</option>
                <option value="pending">Pendiente</option>
                <option value="confirmed">Confirmada</option>
                <option value="checked_in">Check-in</option>
                <option value="seated">En Mesa / Sentado</option>
                <option value="completed">Completada</option>
                <option value="cancelled">Cancelada</option>
                <option value="no_show">No se presentó</option>
              </Select>

              {/* Filtro de origen */}
              <Select
                value={selectedOrigin}
                onChange={(e) => setSelectedOrigin(e.target.value)}
              >
                <option value="all">Todos los orígenes</option>
                <option value="direct">Manual / Directo</option>
                <option value="phone">Teléfono</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="web">Online / Web</option>
                <option value="walk_in">Walk-in</option>
              </Select>
            </div>
          </div>

          {/* Tabla de Reservas */}
          <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Reservas ({filteredReservations.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/60 dark:bg-white/[0.02] text-slate-500 font-semibold text-[11px]">
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Fecha / Hora</th>
                    <th className="py-3 px-4">Personas</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Origen</th>
                    <th className="py-3 px-4">Notas</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {filteredReservations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No se encontraron reservas con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredReservations.map((r) => {
                      const statusMeta = RESERVATION_STATUS_META[r.status] || RESERVATION_STATUS_META.confirmed;
                      const originMeta = RESERVATION_ORIGIN_META[r.origin] || RESERVATION_ORIGIN_META.direct;

                      return (
                        <tr
                          key={r.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors"
                        >
                          {/* Cliente */}
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {r.customer_name}
                            </span>
                            <span className="text-[11px] text-slate-400 block font-mono">
                              {r.phone || r.email || "Sin contacto"}
                            </span>
                          </td>

                          {/* Fecha / Hora */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 font-mono text-slate-700 dark:text-slate-300">
                              <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                              <span>{r.date}</span>
                              <span className="text-slate-400">•</span>
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-bold">{r.time}</span>
                            </div>
                          </td>

                          {/* Personas */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 font-mono font-bold text-slate-800 dark:text-slate-200">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              {r.party_size}
                            </span>
                          </td>

                          {/* Estado con selector interactivo */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <Select
                              selectSize="sm"
                              value={r.status}
                              onChange={(e) =>
                                handleStatusChange(r.id, e.target.value as ReservationStatus)
                              }
                            >
                              <option value="pending">Pendiente</option>
                              <option value="confirmed">Confirmada</option>
                              <option value="checked_in">Check-in</option>
                              <option value="seated">En Mesa</option>
                              <option value="completed">Completada</option>
                              <option value="cancelled">Cancelada</option>
                              <option value="no_show">No se presentó</option>
                            </Select>
                          </td>

                          {/* Origen */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/[0.06]">
                              {originMeta.label}
                            </span>
                          </td>

                          {/* Notas */}
                          <td className="py-3 px-4 max-w-xs truncate text-slate-500 text-[11px]">
                            {r.special_requests || r.allergies || r.notes || "—"}
                          </td>

                          {/* Acciones: Papelera */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingReservation(r);
                                  setIsFormModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors cursor-pointer"
                                title="Editar"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setReservationToDelete(r)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                                title="Eliminar / Cancelar reserva"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. PESTAÑA: ASIGNAR MESAS (PANEL LATERAL + LIENZO DE MESAS)               */}
      {/* ========================================================================= */}
      {activeTab === "tables" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Panel Lateral Izquierdo: Sin Mesa Asignada (4 cols) */}
          <div className="lg:col-span-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-3xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Sin Mesa Asignada
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {selectedDate}
              </span>
            </div>

            {/* Listado de reservas pendientes de mesa */}
            {unassignedReservations.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Todas las reservas tienen mesa asignada
                </p>
                <p className="text-[11px] text-slate-400">
                  No hay comensales pendientes de ubicación para esta fecha.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                {unassignedReservations.map((r) => {
                  const isSelected = selectedReservationToAssign?.id === r.id;
                  return (
                    <div
                      key={r.id}
                      onClick={() =>
                        setSelectedReservationToAssign(isSelected ? null : r)
                      }
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-orange-500/10 border-[#ED500A] ring-2 ring-[#ED500A]/30"
                          : "bg-slate-50 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/[0.06] hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          {r.customer_name}
                        </span>
                        <span className="font-mono text-xs font-bold text-[#ED500A]">
                          {r.time}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="flex items-center gap-1 font-mono">
                          <Users className="w-3 h-3" />
                          {r.party_size} personas
                        </span>
                        <span className="text-[10px] uppercase font-semibold text-amber-600">
                          {isSelected ? "Seleccionada (Haz click en una mesa)" : "Click para asignar"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Panel Central: Asignación de Mesas (8 cols) */}
          <div className="lg:col-span-8 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-3xl p-6 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Asignación de Mesas
                </h3>
                <p className="text-[11px] text-slate-400">
                  Arrastra las reservas desde la izquierda hacia las mesas para asignarlas.
                </p>
              </div>

              {/* Filtro por sala */}
              <Select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
              >
                <option value="all">Todas las salas</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Lienzo de Mesas */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredTables.map((tbl) => {
                const assignedRes = reservations.find(
                  (r) =>
                    r.date === selectedDate &&
                    r.table_id === tbl.id &&
                    r.status !== "cancelled"
                );

                const isCompatible =
                  selectedReservationToAssign &&
                  (tbl.capacity || 0) >= selectedReservationToAssign.party_size;

                return (
                  <div
                    key={tbl.id}
                    onClick={() => handleAssignTable(tbl)}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[110px] ${
                      assignedRes
                        ? "bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40"
                        : selectedReservationToAssign
                        ? isCompatible
                          ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-400 dark:border-emerald-700/60 ring-2 ring-emerald-500/20"
                          : "bg-slate-50/60 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/[0.06] opacity-60"
                        : "bg-slate-50/60 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/[0.06] hover:border-[#ED500A]/50 hover:bg-orange-500/5"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          Mesa {tbl.name_or_number}
                        </span>
                        <span className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400">
                          Cap. {tbl.capacity || 4}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        #{tbl.id.slice(0, 4).toUpperCase()}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 dark:border-white/5">
                      {assignedRes ? (
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="min-w-0 pr-1">
                            <span className="font-semibold text-blue-700 dark:text-blue-300 truncate block">
                              {assignedRes.customer_name}
                            </span>
                            <span className="font-mono text-2xs text-blue-600 dark:text-blue-400 font-bold">
                              {assignedRes.time} ({assignedRes.party_size} pers.)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnassignTable(assignedRes.id);
                            }}
                            title="Desasignar mesa"
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span
                          className={`text-[10px] font-medium block ${
                            selectedReservationToAssign && isCompatible
                              ? "text-emerald-600 dark:text-emerald-400 font-bold"
                              : "text-slate-400"
                          }`}
                        >
                          {selectedReservationToAssign
                            ? isCompatible
                              ? "Haz click para asignar"
                              : "Capacidad menor"
                            : "Disponible para asignar"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: FORMULARIO DE RESERVA (3 PESTAÑAS) */}
      <ReservationFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingReservation(null);
        }}
        businessId={businessId}
        reservation={editingReservation}
        rooms={rooms}
        tables={tables}
        initialDate={selectedDate}
        onSuccess={() => refreshData(selectedDate)}
      />

      {/* MODAL 2: ASIGNAR MESA */}
      <AssignTableModal
        isOpen={isAssignModalOpen}
        onClose={() => {
          setIsAssignModalOpen(false);
          setAssigningReservation(null);
        }}
        businessId={businessId}
        reservation={assigningReservation}
        rooms={rooms}
        tables={tables}
        onAssigned={() => refreshData(selectedDate)}
      />

      {/* MODAL 3: CONFIRMAR ELIMINACIÓN (SIN ALERTAS NATIVAS) */}
      <ConfirmModal
        isOpen={Boolean(reservationToDelete)}
        onClose={() => setReservationToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="¿Eliminar reserva?"
        description={`¿Estás seguro de que deseas cancelar la reserva de «${reservationToDelete?.customer_name}» para el ${reservationToDelete?.date} a las ${reservationToDelete?.time}?`}
        confirmText="Sí, Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
