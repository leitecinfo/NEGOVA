"use client";

import React, { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutGrid,
  Plus,
  Users,
  UtensilsCrossed,
  Clock,
  ExternalLink,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Unlock,
  RefreshCw,
  Search,
  X,
  FileText,
  User,
  ShoppingBag,
  Sparkles,
  MoreVertical,
  Armchair,
  Receipt,
  Eye,
  ListFilter,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { AppPageContainer } from "@/components/layout/app-page-container";
import {
  AdminButton,
  AdminConfirmDialog,
  AdminEmptyState,
  AdminKpiCard,
  AdminKpiGrid,
  AdminSelect,
  AdminTableToolbar,
} from "@/components/admin/ui";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  createRestaurantTableAction,
  updateRestaurantTableAction,
  deleteRestaurantTableAction,
  releaseRestaurantTableAction,
} from "./actions";
import type {
  RestaurantTableWithOrder,
  RestaurantTablesSummary,
  CreateTableInput,
  UpdateTableInput,
} from "@/lib/restaurant/types";

interface TablesDashboardClientProps {
  businessId: string;
  businessName: string;
  initialTables: RestaurantTableWithOrder[];
  initialSummary: RestaurantTablesSummary;
  canManageTables: boolean;
}

export function TablesDashboardClient({
  businessId,
  businessName,
  initialTables,
  initialSummary,
  canManageTables,
}: TablesDashboardClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Estados locales de filtrado, búsqueda y modo de vista
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "occupied">("all");
  const [viewMode, setViewMode] = useState<"floor" | "compact">("floor");

  // Estados de modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTableWithOrder | null>(null);
  const [tableToDelete, setTableToDelete] = useState<RestaurantTableWithOrder | null>(null);
  const [tableToRelease, setTableToRelease] = useState<RestaurantTableWithOrder | null>(null);
  const [activeMenuTableId, setActiveMenuTableId] = useState<string | null>(null);

  // Formulario de creación
  const [createForm, setCreateForm] = useState<CreateTableInput>({
    name_or_number: "",
    capacity: 4,
    sort_order: 0,
  });

  // Formulario de edición
  const [editForm, setEditForm] = useState<UpdateTableInput>({
    name_or_number: "",
    capacity: 4,
    sort_order: 0,
  });

  const [formError, setFormError] = useState<string | null>(null);

  // Formato de moneda COP
  const formatCOP = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Cálculo del tiempo transcurrido de ocupación
  const calculateOccupiedDuration = (isoString?: string) => {
    if (!isoString) return null;
    try {
      const orderDate = new Date(isoString);
      const diffMs = Math.max(0, Date.now() - orderDate.getTime());
      const diffMinutes = Math.floor(diffMs / (1000 * 60));

      if (diffMinutes < 1) return "Recién abierta";
      if (diffMinutes < 60) return `${diffMinutes} min`;
      const hours = Math.floor(diffMinutes / 60);
      const remainingMins = diffMinutes % 60;
      return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
    } catch {
      return null;
    }
  };

  // Filtrado reactivo de mesas
  const filteredTables = useMemo(() => {
    return initialTables.filter((tbl) => {
      // 1. Filtro de estado
      if (statusFilter !== "all" && tbl.status !== statusFilter) {
        return false;
      }
      // 2. Búsqueda por nombre de mesa o cliente de comanda activa
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesName = tbl.name_or_number.toLowerCase().includes(q);
        const matchesCustomer =
          tbl.activeOrder?.customer_name?.toLowerCase().includes(q) || false;
        const matchesOrderNumber =
          tbl.activeOrder?.order_number?.toString() === q.replace(/^#/, "");
        if (!matchesName && !matchesCustomer && !matchesOrderNumber) {
          return false;
        }
      }
      return true;
    });
  }, [initialTables, search, statusFilter]);

  // Manejadores de acciones
  const handleOpenCreateModal = () => {
    setCreateForm({
      name_or_number: "",
      capacity: 4,
      sort_order: initialTables.length + 1,
    });
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (table: RestaurantTableWithOrder) => {
    setEditingTable(table);
    setEditForm({
      name_or_number: table.name_or_number,
      capacity: table.capacity || 4,
      sort_order: table.sort_order || 0,
    });
    setFormError(null);
    setActiveMenuTableId(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name_or_number.trim()) {
      setFormError("El nombre o número de la mesa es requerido.");
      return;
    }

    startTransition(async () => {
      const res = await createRestaurantTableAction(businessId, createForm);
      if (res.success) {
        toast.success(`Mesa «${createForm.name_or_number}» creada con éxito.`);
        setIsCreateModalOpen(false);
        router.refresh();
      } else {
        setFormError(res.error || "No se pudo registrar la mesa.");
        toast.error(res.error || "Error al crear la mesa.");
      }
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTable) return;
    if (!editForm.name_or_number?.trim()) {
      setFormError("El nombre o número de mesa es requerido.");
      return;
    }

    startTransition(async () => {
      const res = await updateRestaurantTableAction(businessId, editingTable.id, editForm);
      if (res.success) {
        toast.success(`Mesa «${editForm.name_or_number}» actualizada exitosamente.`);
        setEditingTable(null);
        router.refresh();
      } else {
        setFormError(res.error || "No se pudo actualizar la mesa.");
        toast.error(res.error || "Error al actualizar la mesa.");
      }
    });
  };

  const handleConfirmDelete = async () => {
    if (!tableToDelete) return;
    const target = tableToDelete;
    setTableToDelete(null);

    startTransition(async () => {
      const res = await deleteRestaurantTableAction(businessId, target.id);
      if (res.success) {
        toast.success(`Mesa «${target.name_or_number}» eliminada correctamente.`);
        router.refresh();
      } else {
        toast.error(res.error || "No se pudo eliminar la mesa.");
      }
    });
  };

  const handleConfirmRelease = async () => {
    if (!tableToRelease) return;
    const target = tableToRelease;
    setTableToRelease(null);

    startTransition(async () => {
      const res = await releaseRestaurantTableAction(businessId, target.id);
      if (res.success) {
        toast.success(`Mesa «${target.name_or_number}» liberada y lista para recibir nuevos comensales.`);
        router.refresh();
      } else {
        toast.error(res.error || "No fue posible liberar la mesa.");
      }
    });
  };

  // Helper para calcular la distribución física de sillas según capacidad
  const getChairLayout = (capacity: number) => {
    const cap = Math.max(1, capacity || 4);
    if (cap <= 2) {
      return { top: 1, bottom: 1, left: 0, right: 0 };
    }
    if (cap <= 4) {
      return { top: 1, bottom: 1, left: 1, right: 1 };
    }
    if (cap <= 6) {
      return { top: 2, bottom: 2, left: 1, right: 1 };
    }
    return { top: 3, bottom: 3, left: 1, right: 1 };
  };

  return (
    <AppPageContainer
      title="Plano de Mesas y Salón"
      description={`Supervisión gráfica en vivo, asignación de comensales y cuentas activas en ${businessName}.`}
      badge={
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20">
          <Armchair className="w-3.5 h-3.5" />
          Servicio de Salón
        </span>
      }
      actions={
        <div className="flex items-center gap-2">
          {/* Switcher de Vista: Salón Gráfico vs Lista */}
          <div className="hidden sm:inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("floor")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                viewMode === "floor"
                  ? "bg-white dark:bg-[#1A1D24] text-slate-900 dark:text-white shadow-xs font-semibold"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
              title="Vista de plano de salón gráfico con mesas y sillas"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Plano Salón</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("compact")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                viewMode === "compact"
                  ? "bg-white dark:bg-[#1A1D24] text-slate-900 dark:text-white shadow-xs font-semibold"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
              title="Vista compacta de mesas para alta densidad"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Lista Rápida</span>
            </button>
          </div>

          {canManageTables && (
            <AdminButton
              variant="primary"
              size="sm"
              onClick={handleOpenCreateModal}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              <span>Nueva Mesa</span>
            </AdminButton>
          )}
        </div>
      }
      maxWidth="7xl"
    >
      <div className="space-y-6 font-body">
        {/* ========================================================================= */}
        {/* 1. INDICADORES RESUMIDOS DE SALÓN (KPIs) */}
        {/* ========================================================================= */}
        <AdminKpiGrid cols={4}>
          <AdminKpiCard
            title="Total Mesas"
            value={initialSummary.total}
            subtext="Mesas en el salón"
            icon={<Armchair className="w-4 h-4" />}
            variant="blue"
            isSelected={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
          />

          <AdminKpiCard
            title="Disponibles"
            value={initialSummary.available}
            subtext="Listas para comensales"
            icon={<CheckCircle2 className="w-4 h-4" />}
            variant="emerald"
            isSelected={statusFilter === "available"}
            onClick={() => setStatusFilter("available")}
          />

          <AdminKpiCard
            title="Ocupadas"
            value={initialSummary.occupied}
            subtext="Con comanda activa"
            icon={<UtensilsCrossed className="w-4 h-4" />}
            variant="amber"
            isSelected={statusFilter === "occupied"}
            onClick={() => setStatusFilter("occupied")}
          />

          <AdminKpiCard
            title="Tasa de Ocupación"
            value={`${initialSummary.occupancyRate}%`}
            subtext={`${initialSummary.occupied} de ${initialSummary.total} mesas activas`}
            icon={<Clock className="w-4 h-4" />}
            variant="purple"
          />
        </AdminKpiGrid>

        {/* ========================================================================= */}
        {/* 2. BARRA DE HERRAMIENTAS: BÚSQUEDA Y FILTROS RÁPIDOS */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-[#0D0E12] border border-slate-200/80 dark:border-white/[0.08] shadow-xs">
          {/* Segmented Quick Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                statusFilter === "all"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                  : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-white/10"
              }`}
            >
              <span>Todas</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  statusFilter === "all"
                    ? "bg-white/20 text-white dark:bg-black/10 dark:text-slate-900"
                    : "bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300"
                }`}
              >
                {initialSummary.total}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("available")}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                statusFilter === "available"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200/60 dark:border-emerald-500/20"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Libres</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-current">
                {initialSummary.available}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("occupied")}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                statusFilter === "occupied"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 border border-amber-200/60 dark:border-amber-500/20"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Ocupadas</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-current">
                {initialSummary.occupied}
              </span>
            </button>
          </div>

          {/* Search Bar & Refresh */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar mesa o cliente..."
                className="w-full h-9 pl-9 pr-8 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.03] text-xs font-body text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => router.refresh()}
              disabled={isPending}
              className="p-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shrink-0"
              title="Refrescar estado de mesas"
            >
              <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin text-[#ED500A]" : ""}`} />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. PLANO GRÁFICO DE SALÓN / CUADRÍCULA VISUAL INTUITIVA */}
        {/* ========================================================================= */}
        {filteredTables.length === 0 ? (
          <AdminEmptyState
            icon={Armchair}
            title={
              initialTables.length === 0
                ? "No hay mesas registradas en el salón"
                : "Sin resultados para estos filtros"
            }
            description={
              initialTables.length === 0
                ? "Crea las mesas de tu salón para asignarlas a las comandas registradas desde el POS."
                : "Intenta cambiar los términos de búsqueda o el filtro de disponibilidad."
            }
            actionLabel={initialTables.length === 0 && canManageTables ? "Crear la primera mesa" : undefined}
            onAction={initialTables.length === 0 && canManageTables ? handleOpenCreateModal : undefined}
          />
        ) : viewMode === "floor" ? (
          /* ===================================================================== */
          /* MODO PLANO DE SALÓN: MESAS REALISTAS CON SILLAS PERIMETRALES */
          /* ===================================================================== */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-2">
            {filteredTables.map((tbl) => {
              const isOccupied = tbl.status === "occupied";
              const activeOrder = tbl.activeOrder;
              const durationText = calculateOccupiedDuration(activeOrder?.created_at || tbl.updated_at);
              const chairLayout = getChairLayout(tbl.capacity || 4);

              return (
                <div
                  key={tbl.id}
                  className="relative group flex flex-col items-center justify-between transition-all duration-300"
                >
                  {/* SILLAS SUPERIORES */}
                  <div className="flex items-center justify-center gap-3 w-full -mb-3 z-10 pointer-events-none">
                    {Array.from({ length: chairLayout.top }).map((_, i) => (
                      <div
                        key={`top-chair-${i}`}
                        className={`w-11 h-4 rounded-t-xl rounded-b-xs border transition-all duration-300 shadow-xs ${
                          isOccupied
                            ? "bg-amber-400 dark:bg-amber-500/90 border-amber-500 dark:border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.35)]"
                            : "bg-slate-100 dark:bg-[#1E222D] border-slate-300 dark:border-white/10 group-hover:border-emerald-500/40"
                        }`}
                      />
                    ))}
                  </div>

                  {/* CUERPO CENTRAL DE LA MESA (SUPERFICIE REALISTA DE SALÓN) */}
                  <div className="flex items-center justify-between w-full relative">
                    {/* SILLA IZQUIERDA */}
                    {chairLayout.left > 0 ? (
                      <div className="flex flex-col justify-center gap-2 -mr-3 z-10 pointer-events-none">
                        {Array.from({ length: chairLayout.left }).map((_, i) => (
                          <div
                            key={`left-chair-${i}`}
                            className={`w-4 h-11 rounded-l-xl rounded-r-xs border transition-all duration-300 shadow-xs ${
                              isOccupied
                                ? "bg-amber-400 dark:bg-amber-500/90 border-amber-500 dark:border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.35)]"
                                : "bg-slate-100 dark:bg-[#1E222D] border-slate-300 dark:border-white/10 group-hover:border-emerald-500/40"
                            }`}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="w-1" />
                    )}

                    {/* SUPERFICIE DE LA MESA */}
                    <div
                      className={`relative flex-1 rounded-3xl p-5 border-2 transition-all duration-300 overflow-hidden shadow-md group-hover:-translate-y-1 group-hover:shadow-xl ${
                        isOccupied
                          ? "bg-gradient-to-b from-amber-50/90 via-white to-amber-50/50 dark:from-[#1E1913] dark:via-[#16130F] dark:to-[#120F0C] border-amber-400/80 dark:border-amber-500/40 shadow-amber-500/5 group-hover:border-amber-500"
                          : "bg-gradient-to-b from-white via-slate-50/70 to-slate-100/50 dark:from-[#171A23] dark:via-[#13161C] dark:to-[#0E1015] border-slate-200 dark:border-white/10 group-hover:border-emerald-500/50 group-hover:shadow-emerald-500/5"
                      }`}
                    >
                      {/* Ambient Accent Watermark */}
                      <div className="absolute -right-4 -bottom-4 w-24 h-24 pointer-events-none opacity-[0.04] dark:opacity-[0.06] text-current">
                        <UtensilsCrossed className="w-full h-full" />
                      </div>

                      {/* CABECERA DE LA MESA: NOMBRE, CAPACIDAD Y ESTADO */}
                      <div className="flex items-start justify-between gap-2 relative z-10">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                              {tbl.name_or_number}
                            </h3>
                            {/* Chip de comensales / capacidad */}
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                              <Users className="w-3 h-3 text-slate-400" />
                              <span>{tbl.capacity || 4} pax</span>
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                            {isOccupied ? (
                              <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                                <Clock className="w-3 h-3 animate-spin text-amber-500" style={{ animationDuration: "12s" }} />
                                {durationText || "En servicio"}
                              </span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Lista para comanda
                              </span>
                            )}
                          </p>
                        </div>

                        {/* ESTADO VIBRANTE DE LA MESA */}
                        <div className="flex items-center gap-1">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black border shadow-xs ${
                              isOccupied
                                ? "bg-amber-500 text-white border-amber-600 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30"
                                : "bg-emerald-500 text-white border-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isOccupied ? "bg-white dark:bg-amber-400 animate-ping" : "bg-white dark:bg-emerald-400"
                              }`}
                            />
                            <span>{isOccupied ? "OCUPADA" : "LIBRE"}</span>
                          </span>

                          {/* Menú Administrativo Flotante */}
                          {canManageTables && (
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveMenuTableId(activeMenuTableId === tbl.id ? null : tbl.id)
                                }
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                                title="Opciones administrativas"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {activeMenuTableId === tbl.id && (
                                <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-[#16181E] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditModal(tbl)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors font-medium text-left"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Editar Mesa</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuTableId(null);
                                      setTableToDelete(tbl);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors font-medium text-left"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Eliminar Mesa</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* CENTRO DE LA MESA: COMANDA ACTIVA O INVITACIÓN POS */}
                      <div className="mt-4 relative z-10">
                        {isOccupied && activeOrder ? (
                          <div className="p-3 rounded-2xl bg-amber-500/[0.08] dark:bg-amber-500/[0.06] border border-amber-300/60 dark:border-amber-500/20 space-y-2">
                            {/* Comanda # y Monto Grande */}
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200 bg-amber-500/15 text-amber-900 dark:text-amber-300 px-2 py-0.5 rounded-md">
                                Comanda #{activeOrder.order_number}
                              </span>
                              <span className="font-mono text-sm font-black text-[#ED500A] tracking-tight">
                                {formatCOP(activeOrder.total)}
                              </span>
                            </div>

                            {/* Cliente o detalle */}
                            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                              <div className="flex items-center gap-1.5 truncate pr-2">
                                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate font-medium">
                                  {activeOrder.customer_name || "Comensal de mesa"}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-400 shrink-0 font-medium">
                                {activeOrder.items_count} {activeOrder.items_count === 1 ? "artículo" : "artículos"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="py-4 px-3 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-dashed border-slate-200 dark:border-white/10 text-center">
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                              Mesa libre para nuevo pedido
                            </p>
                          </div>
                        )}
                      </div>

                      {/* BOTONERA OPERATIVA DE LA MESA */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2 relative z-10">
                        {isOccupied && activeOrder ? (
                          <>
                            <Link
                              href={`/workspace/${businessId}/pedidos/${activeOrder.id}`}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 transition-all active:scale-[0.98]"
                            >
                              <FileText className="w-3.5 h-3.5 text-[#ED500A]" />
                              <span>Ver Comanda</span>
                            </Link>

                            <button
                              type="button"
                              onClick={() => setTableToRelease(tbl)}
                              disabled={isPending}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-500/15 hover:bg-amber-200 dark:hover:bg-amber-500/25 border border-amber-300/80 dark:border-amber-500/25 transition-all active:scale-[0.98]"
                              title="Liberar mesa al finalizar el servicio"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              <span>Liberar</span>
                            </button>
                          </>
                        ) : (
                          <Link
                            href={`/workspace/${businessId}/pos?tableId=${tbl.id}`}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#ED500A] hover:bg-[#ED500A]/90 shadow-md shadow-[#ED500A]/20 transition-all active:scale-[0.98]"
                          >
                            <UtensilsCrossed className="w-3.5 h-3.5" />
                            <span>Tomar Pedido (POS)</span>
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* SILLA DERECHA */}
                    {chairLayout.right > 0 ? (
                      <div className="flex flex-col justify-center gap-2 -ml-3 z-10 pointer-events-none">
                        {Array.from({ length: chairLayout.right }).map((_, i) => (
                          <div
                            key={`right-chair-${i}`}
                            className={`w-4 h-11 rounded-r-xl rounded-l-xs border transition-all duration-300 shadow-xs ${
                              isOccupied
                                ? "bg-amber-400 dark:bg-amber-500/90 border-amber-500 dark:border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.35)]"
                                : "bg-slate-100 dark:bg-[#1E222D] border-slate-300 dark:border-white/10 group-hover:border-emerald-500/40"
                            }`}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="w-1" />
                    )}
                  </div>

                  {/* SILLAS INFERIORES */}
                  <div className="flex items-center justify-center gap-3 w-full -mt-3 z-10 pointer-events-none">
                    {Array.from({ length: chairLayout.bottom }).map((_, i) => (
                      <div
                        key={`bottom-chair-${i}`}
                        className={`w-11 h-4 rounded-b-xl rounded-t-xs border transition-all duration-300 shadow-xs ${
                          isOccupied
                            ? "bg-amber-400 dark:bg-amber-500/90 border-amber-500 dark:border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.35)]"
                            : "bg-slate-100 dark:bg-[#1E222D] border-slate-300 dark:border-white/10 group-hover:border-emerald-500/40"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ===================================================================== */
          /* MODO LISTA RÁPIDA: DENSO, EFICIENTE PARA HORAS PICO */
          /* ===================================================================== */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredTables.map((tbl) => {
              const isOccupied = tbl.status === "occupied";
              const activeOrder = tbl.activeOrder;
              const durationText = calculateOccupiedDuration(activeOrder?.created_at || tbl.updated_at);

              return (
                <div
                  key={tbl.id}
                  className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                    isOccupied
                      ? "bg-amber-50/40 dark:bg-[#14120E] border-amber-300/80 dark:border-amber-500/30 shadow-xs"
                      : "bg-white dark:bg-[#0D0E12] border-slate-200 dark:border-white/10 hover:border-emerald-500/40"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white text-base truncate">
                        {tbl.name_or_number}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isOccupied
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400"
                        }`}
                      >
                        {isOccupied ? "Ocupada" : "Libre"}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                      <span>Cap: {tbl.capacity || 4}p</span>
                      {isOccupied && activeOrder ? (
                        <>
                          <span>•</span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {formatCOP(activeOrder.total)}
                          </span>
                          <span>•</span>
                          <span>{durationText || "En curso"}</span>
                        </>
                      ) : (
                        <span>• Lista para clientes</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isOccupied && activeOrder ? (
                      <>
                        <Link
                          href={`/workspace/${businessId}/pedidos/${activeOrder.id}`}
                          className="p-2 rounded-xl text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                          title="Ver comanda"
                        >
                          <FileText className="w-4 h-4 text-[#ED500A]" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => setTableToRelease(tbl)}
                          disabled={isPending}
                          className="p-2 rounded-xl text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"
                          title="Liberar mesa"
                        >
                          <Unlock className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <Link
                        href={`/workspace/${businessId}/pos?tableId=${tbl.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-[#ED500A] hover:bg-[#ED500A]/90 transition-colors"
                      >
                        <UtensilsCrossed className="w-3.5 h-3.5" />
                        <span>POS</span>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. MODAL PARA CREAR MESA */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-body">
            <div className="relative w-full max-w-md bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center font-bold">
                    <Armchair className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Registrar Nueva Mesa
                    </h3>
                    <p className="text-xs text-slate-500">Agrega una mesa física para el salón</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleCreateSubmit} className="p-5 space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Nombre o Número de Mesa *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.name_or_number}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, name_or_number: e.target.value }))
                    }
                    placeholder="Ej. Mesa 5, Barra 2, Terraza 3..."
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] text-xs font-body text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Capacidad (Personas)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={createForm.capacity || 4}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          capacity: Number(e.target.value) || 4,
                        }))
                      }
                      className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] text-xs font-body text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Orden Visual
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={createForm.sort_order || 0}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          sort_order: Number(e.target.value) || 0,
                        }))
                      }
                      className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] text-xs font-body text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                    />
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-2.5">
                  <AdminButton
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreateModalOpen(false)}
                    disabled={isPending}
                  >
                    Cancelar
                  </AdminButton>
                  <AdminButton
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isPending}
                  >
                    {isPending ? "Guardando..." : "Guardar Mesa"}
                  </AdminButton>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL PARA EDITAR MESA */}
      {/* ========================================================================= */}
      {editingTable && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-body">
            <div className="relative w-full max-w-md bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center font-bold">
                    <Edit2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Editar Mesa «{editingTable.name_or_number}»
                    </h3>
                    <p className="text-xs text-slate-500">Actualiza los datos de la mesa</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingTable(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Nombre o Número de Mesa *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.name_or_number}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, name_or_number: e.target.value }))
                    }
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] text-xs font-body text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Capacidad (Personas)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={editForm.capacity || 4}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          capacity: Number(e.target.value) || 4,
                        }))
                      }
                      className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] text-xs font-body text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Orden Visual
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={editForm.sort_order || 0}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          sort_order: Number(e.target.value) || 0,
                        }))
                      }
                      className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] text-xs font-body text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                    />
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-2.5">
                  <AdminButton
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingTable(null)}
                    disabled={isPending}
                  >
                    Cancelar
                  </AdminButton>
                  <AdminButton
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isPending}
                  >
                    {isPending ? "Actualizando..." : "Guardar Cambios"}
                  </AdminButton>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ========================================================================= */}
      {/* 6. DIÁLOGO DE CONFIRMACIÓN: LIBERAR MESA */}
      {/* ========================================================================= */}
      <AdminConfirmDialog
        isOpen={Boolean(tableToRelease)}
        onClose={() => setTableToRelease(null)}
        onConfirm={handleConfirmRelease}
        isLoading={isPending}
        title={`¿Liberar «${tableToRelease?.name_or_number}»?`}
        description={`La mesa volverá a estar disponible para recibir una nueva cuenta. Recuerda que la comanda activa (#${
          tableToRelease?.activeOrder?.order_number || ""
        }) debe haber concluido su servicio o estar cancelada.`}
        confirmLabel="Liberar Mesa"
        variant="primary"
      />

      {/* ========================================================================= */}
      {/* 7. DIÁLOGO DE CONFIRMACIÓN: ELIMINAR MESA */}
      {/* ========================================================================= */}
      <AdminConfirmDialog
        isOpen={Boolean(tableToDelete)}
        onClose={() => setTableToDelete(null)}
        onConfirm={handleConfirmDelete}
        isLoading={isPending}
        title={`¿Eliminar «${tableToDelete?.name_or_number}»?`}
        description="Esta acción eliminará la mesa físicamente del sistema si no posee pedidos históricos asociados. Esta acción no se puede deshacer."
        confirmLabel="Eliminar Mesa"
        variant="destructive"
      />
    </AppPageContainer>
  );
}
