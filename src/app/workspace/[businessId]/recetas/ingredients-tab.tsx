"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Apple,
  Plus,
  Search,
  Filter,
  DollarSign,
  AlertTriangle,
  Scale,
  Package,
  Layers,
  MapPin,
  Edit2,
  Trash2,
  Loader2,
  FileSpreadsheet,
  History,
  Eye,
  EyeOff,
  LayoutGrid,
  List,
  AlertCircle,
  CheckCircle2,
  Activity,
  XCircle,
  Warehouse,
  Sparkles,
} from "lucide-react";
import { formatCOP } from "@/config/plans";
import { Location } from "@/lib/inventory/types";
import {
  Ingredient,
  IngredientKPIs,
  IngredientFilters,
  INGREDIENT_UNITS,
} from "@/lib/recipes/types";
import {
  getIngredientsAction,
  getIngredientKPIsAction,
  archiveIngredientAction,
  toggleIngredientAvailabilityAction,
} from "./actions";
import { IngredientFormModal } from "./ingredient-form-modal";
import { IngredientHistoryModal } from "./ingredient-history-modal";
import { IngredientImportModal } from "./ingredient-import-modal";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { TableSkeleton, EmptyState, ErrorState } from "@/components/ui";
import { toast } from "sonner";

interface Props {
  businessId: string;
  locations: Location[];
  availableUnits?: { value: string; label: string }[];
}

function getAvatarColor(char: string) {
  const colors = [
    "from-amber-500/20 to-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30",
    "from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    "from-blue-500/20 to-indigo-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30",
    "from-purple-500/20 to-pink-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30",
    "from-rose-500/20 to-red-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30",
  ];
  const idx = (char.charCodeAt(0) || 0) % colors.length;
  return colors[idx];
}

function formatStockDisplay(qty: number, unit: string) {
  const formatted = Number.isInteger(qty) ? qty.toString() : qty.toFixed(2);
  return `${formatted} ${unit}`;
}

export function IngredientsTab({ businessId, locations, availableUnits }: Props) {
  const unitOptions =
    availableUnits && availableUnits.length > 0 ? availableUnits : INGREDIENT_UNITS;

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [kpis, setKpis] = useState<IngredientKPIs>({
    totalIngredients: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    totalCostValuation: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Vista (Tarjetas por defecto vs Tabla)
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Filtros
  const [search, setSearch] = useState("");
  const [stockStatus, setStockStatus] = useState<"all" | "low_stock" | "out_of_stock" | "in_stock">("all");
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");

  // Modales
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [ingredientToArchive, setIngredientToArchive] = useState<Ingredient | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [historyModalIngredient, setHistoryModalIngredient] = useState<Ingredient | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [listRes, kpiRes] = await Promise.all([
        getIngredientsAction(businessId, {
          search,
          stockStatus,
          unit: unitFilter,
          locationId: locationFilter,
        }),
        getIngredientKPIsAction(businessId),
      ]);

      if (listRes.success && listRes.data) {
        setIngredients(listRes.data);
      } else {
        const msg = listRes.error || "No se pudieron cargar los ingredientes.";
        setLoadError(msg);
        toast.error("Error al cargar ingredientes", { description: msg });
      }

      if (kpiRes.success && kpiRes.data) setKpis(kpiRes.data);
    } catch (err: any) {
      const msg = err.message || "Error al conectar con el servidor.";
      setLoadError(msg);
      toast.error("Error al cargar ingredientes", { description: msg });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [businessId, stockStatus, unitFilter, locationFilter]);

  // Manejo de eliminar / archivar
  const handleConfirmArchive = async () => {
    if (!ingredientToArchive) return;
    setIsArchiving(true);
    try {
      const res = await archiveIngredientAction(businessId, ingredientToArchive.id);
      if (!res.success) {
        toast.error("Error al eliminar ingrediente", {
          description: res.error || "No se pudo eliminar el ingrediente.",
        });
        return;
      }

      toast.success("Ingrediente eliminado", {
        description: `«${ingredientToArchive.name}» fue retirado del catálogo activo.`,
      });
      setIngredientToArchive(null);
      loadData();
    } catch (err: any) {
      toast.error("Error inesperado", { description: err.message });
    } finally {
      setIsArchiving(false);
    }
  };

  // Manejo de alternar visibilidad / activación (Ocultar / Desactivar)
  const handleToggleAvailability = async (ing: Ingredient) => {
    setTogglingId(ing.id);
    const newStatus = !ing.isAvailable;
    try {
      const res = await toggleIngredientAvailabilityAction(businessId, ing.id, newStatus);
      if (res.success) {
        setIngredients((prev) =>
          prev.map((item) => (item.id === ing.id ? { ...item, isAvailable: newStatus } : item))
        );
        toast.success(
          newStatus
            ? `«${ing.name}» ahora está visible y activo`
            : `«${ing.name}» ahora está oculto / desactivado`
        );
      } else {
        toast.error("Error al modificar visibilidad", {
          description: res.error || "No se pudo actualizar el estado.",
        });
      }
    } catch (err: any) {
      toast.error("Error inesperado", { description: err.message });
    } finally {
      setTogglingId(null);
    }
  };

  // Filtrado local en vivo por buscador
  const filteredIngredients = useMemo(() => {
    if (!search.trim()) return ingredients;
    const q = search.toLowerCase().trim();
    return ingredients.filter(
      (ing) =>
        ing.name.toLowerCase().includes(q) ||
        (ing.notes && ing.notes.toLowerCase().includes(q)) ||
        (ing.locationName && ing.locationName.toLowerCase().includes(q))
    );
  }, [ingredients, search]);

  // Cálculo de KPIs requeridos: TOTAL, STOCK BAJO, VALOR TOTAL ($), CON SEGUIMIENTO
  const calculatedKPIs = useMemo(() => {
    const total = ingredients.length;
    const lowStock = ingredients.filter((i) => i.stockQuantity <= i.minStock).length;
    const totalValuation = ingredients.reduce(
      (sum, i) => sum + i.stockQuantity * i.costPerUnit,
      0
    );
    const trackedCount = ingredients.filter(
      (i) => i.minStock > 0 || i.stockQuantity > 0 || i.maxStock !== null
    ).length;

    return {
      total,
      lowStock,
      totalValuation: kpis.totalCostValuation || totalValuation,
      trackedCount: trackedCount || total,
    };
  }, [ingredients, kpis]);

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* 1. KPIS SUPERIORES: TOTAL, STOCK BAJO, VALOR TOTAL, CON SEGUIMIENTO */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* TOTAL */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              TOTAL
            </span>
            <div className="p-2.5 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white">
            {calculatedKPIs.total}
          </p>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 block">
            Ingredientes e insumos activos
          </span>
        </div>

        {/* STOCK BAJO */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              STOCK BAJO
            </span>
            <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p
            className={`mt-2 text-2xl sm:text-3xl font-black font-mono ${
              calculatedKPIs.lowStock > 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-slate-900 dark:text-white"
            }`}
          >
            {calculatedKPIs.lowStock}
          </p>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 block">
            Existencias &le; Mínimo requerido
          </span>
        </div>

        {/* VALOR TOTAL ($) */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              VALOR TOTAL ($)
            </span>
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 truncate">
            {formatCOP(calculatedKPIs.totalValuation)}
          </p>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 block">
            Capital en materias primas
          </span>
        </div>

        {/* CON SEGUIMIENTO */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              CON SEGUIMIENTO
            </span>
            <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white">
            {calculatedKPIs.trackedCount}
          </p>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 block">
            Con kardex y umbrales activos
          </span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. BARRA SUPERIOR: Buscador, Contador dinámico, Importar, + Nuevo */}
      {/* ========================================================= */}
      <div className="p-4 rounded-3xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Buscador por texto */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, nota o almacén..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30"
            />
          </div>

          {/* Contador dinámico ('N ingredientes') */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/[0.08] text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0 self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-[#ED500A]" />
            <span>
              {filteredIngredients.length === 1
                ? "1 ingrediente"
                : `${filteredIngredients.length} ingredientes`}
            </span>
          </div>
        </div>

        {/* Acciones principales y switch de vista */}
        <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
          {/* Selector de Vista (Tarjetas / Tabla) */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-white/[0.04] rounded-xl border border-slate-200/80 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              title="Vista en tarjetas"
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "cards"
                  ? "bg-white dark:bg-[#1E2028] text-[#ED500A] shadow-2xs"
                  : "text-slate-400 hover:text-slate-700 dark:hover:text-white"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Vista en tabla"
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-white dark:bg-[#1E2028] text-[#ED500A] shadow-2xs"
                  : "text-slate-400 hover:text-slate-700 dark:hover:text-white"
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Botón 'Importar' */}
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.1] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-all cursor-pointer shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#ED500A]" />
            <span>Importar</span>
          </button>

          {/* Botón '+ Nuevo Ingrediente' */}
          <button
            type="button"
            onClick={() => {
              setEditingIngredient(null);
              setIsFormOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-[#ED500A] text-white hover:bg-[#ED500A]/90 transition-all shadow-md shadow-[#ED500A]/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nuevo Ingrediente</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. CATÁLOGO DE INGREDIENTES EN TARJETAS O TABLA */}
      {/* ========================================================= */}
      {loadError ? (
        <ErrorState
          title="Error al cargar ingredientes"
          description={loadError}
          onRetry={loadData}
          retryLabel="Reintentar consulta"
        />
      ) : isLoading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : filteredIngredients.length === 0 ? (
        <EmptyState
          icon={Apple}
          title="No hay ingredientes registrados"
          description={
            search.trim()
              ? "No se encontraron ingredientes con el término buscado."
              : "Registra materias primas, insumos y empaques para costear y calcular la rentabilidad de tus recetas."
          }
          actionLabel="Crear Primer Ingrediente"
          onAction={() => {
            setEditingIngredient(null);
            setIsFormOpen(true);
          }}
          resetLabel={search.trim() ? "Limpiar búsqueda" : undefined}
          onReset={search.trim() ? () => setSearch("") : undefined}
        />
      ) : viewMode === "cards" ? (
        /* VISTA EN TARJETAS (CARD GRID) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {filteredIngredients.map((ing) => {
            const initialChar = ing.name.trim().charAt(0).toUpperCase();
            const avatarColorClass = getAvatarColor(initialChar);

            const isOutOfStock = ing.stockQuantity <= 0;
            const isLowStock = ing.stockQuantity <= ing.minStock;

            // Capacidad de inventario
            const capacityTarget =
              ing.maxStock && ing.maxStock > 0
                ? ing.maxStock
                : ing.minStock > 0
                ? ing.minStock * 2
                : 100;
            const progressPercent = Math.min(
              100,
              Math.max(0, Math.round((ing.stockQuantity / capacityTarget) * 100))
            );

            const totalValuation = ing.stockQuantity * ing.costPerUnit;

            return (
              <div
                key={ing.id}
                className={`group relative rounded-3xl bg-white dark:bg-[#0D0F16] border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-2xs hover:shadow-md ${
                  isLowStock
                    ? "border-rose-300/80 dark:border-rose-500/30 hover:border-rose-500/50"
                    : "border-slate-200/80 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15]"
                } ${!ing.isAvailable ? "opacity-75" : ""}`}
              >
                {/* Parte Superior de la Tarjeta */}
                <div className="p-4 sm:p-5 space-y-4">
                  {/* Avatar / Inicial del insumo y nombre */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-12 h-12 rounded-2xl bg-linear-to-br border flex items-center justify-center font-black text-lg shadow-2xs shrink-0 ${avatarColorClass}`}
                    >
                      {initialChar}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h4
                          className="font-bold text-sm text-slate-900 dark:text-white truncate"
                          title={ing.name}
                        >
                          {ing.name}
                        </h4>
                        {!ing.isAvailable && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.05] text-slate-500 shrink-0">
                            Oculto
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-400">
                        {ing.locationName && (
                          <span className="flex items-center gap-1 truncate max-w-[130px]">
                            <MapPin className="w-3 h-3 shrink-0" />
                            {ing.locationName}
                          </span>
                        )}
                        <span>· {ing.unit}</span>
                      </div>
                    </div>
                  </div>

                  {/* Stock Actual con unidad de medida & Costo Unitario */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-white/[0.04]">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                        Stock Actual
                      </span>
                      <span className="text-sm font-bold font-mono text-slate-900 dark:text-white block mt-0.5">
                        {formatStockDisplay(ing.stockQuantity, ing.unit)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                        Costo Unitario
                      </span>
                      <span className="text-xs font-bold font-mono text-[#ED500A] block mt-0.5">
                        {formatCOP(ing.costPerUnit)}/{ing.unit}
                      </span>
                    </div>
                  </div>

                  {/* Alerta visual de stock bajo en rojo con barra de progreso de capacidad */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      {isLowStock ? (
                        <span className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>
                            {isOutOfStock
                              ? "Agotado (0 un)"
                              : `Stock bajo (${ing.stockQuantity}/${ing.minStock} ${ing.unit})`}
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 font-medium">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>Stock óptimo</span>
                        </span>
                      )}

                      <span className="font-mono text-[10px] text-slate-400">
                        Capacidad: {progressPercent}%
                      </span>
                    </div>

                    {/* Barra de progreso de capacidad */}
                    <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isLowStock ? "bg-rose-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Valorización total en existencias */}
                  <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.04] flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Valorización en existencias:
                    </span>
                    <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                      {formatCOP(totalValuation)}
                    </span>
                  </div>
                </div>

                {/* Acciones Rápidas (Pie de la Tarjeta) */}
                <div className="p-3 border-t border-slate-100 dark:border-white/[0.04] bg-slate-50/60 dark:bg-white/[0.01] flex items-center justify-between gap-1">
                  {/* Ver historial de movimientos */}
                  <button
                    type="button"
                    onClick={() => setHistoryModalIngredient(ing)}
                    title="Ver historial de movimientos"
                    className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <History className="w-4 h-4 text-emerald-500" />
                  </button>

                  {/* Editar */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingIngredient(ing);
                      setIsFormOpen(true);
                    }}
                    title="Editar ingrediente"
                    className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4 text-[#ED500A]" />
                  </button>

                  {/* Ocultar / Desactivar */}
                  <button
                    type="button"
                    onClick={() => handleToggleAvailability(ing)}
                    disabled={togglingId === ing.id}
                    title={ing.isAvailable ? "Ocultar / Desactivar" : "Mostrar / Activar"}
                    className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    {togglingId === ing.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                    ) : ing.isAvailable ? (
                      <Eye className="w-4 h-4 text-blue-500" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-amber-500" />
                    )}
                  </button>

                  {/* Eliminar con diálogo modal de confirmación */}
                  <button
                    type="button"
                    onClick={() => setIngredientToArchive(ing)}
                    title="Eliminar ingrediente"
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VISTA EN TABLA TRADICIONAL */
        <div className="rounded-3xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/[0.06] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3.5">Ingrediente</th>
                  <th className="px-4 py-3.5">Stock Actual</th>
                  <th className="px-4 py-3.5">Costo Unitario</th>
                  <th className="px-4 py-3.5">Capacidad / Estado</th>
                  <th className="px-4 py-3.5 text-right">Valoración</th>
                  <th className="px-4 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {filteredIngredients.map((ing) => {
                  const initialChar = ing.name.trim().charAt(0).toUpperCase();
                  const avatarColorClass = getAvatarColor(initialChar);
                  const isLowStock = ing.stockQuantity <= ing.minStock;
                  const totalValuation = ing.stockQuantity * ing.costPerUnit;

                  return (
                    <tr
                      key={ing.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-white/[0.015] transition-colors"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-xl border flex items-center justify-center font-bold text-xs shrink-0 ${avatarColorClass}`}
                          >
                            {initialChar}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {ing.name}
                            </span>
                            {ing.locationName && (
                              <span className="text-[11px] text-slate-400">
                                {ing.locationName}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 font-mono font-bold">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs ${
                            isLowStock
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 font-extrabold"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {formatStockDisplay(ing.stockQuantity, ing.unit)}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 font-mono font-semibold text-[#ED500A]">
                        {formatCOP(ing.costPerUnit)}/{ing.unit}
                      </td>

                      <td className="px-4 py-3.5">
                        {isLowStock ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Bajo ({ing.minStock} min)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Óptimo</span>
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatCOP(totalValuation)}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setHistoryModalIngredient(ing)}
                            title="Historial de movimientos"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingIngredient(ing);
                              setIsFormOpen(true);
                            }}
                            title="Editar"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#ED500A] hover:bg-[#ED500A]/10"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleAvailability(ing)}
                            title={ing.isAvailable ? "Ocultar" : "Mostrar"}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-500/10"
                          >
                            {ing.isAvailable ? (
                              <Eye className="w-4 h-4" />
                            ) : (
                              <EyeOff className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setIngredientToArchive(ing)}
                            title="Eliminar"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar Ingrediente */}
      <IngredientFormModal
        businessId={businessId}
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingIngredient(null);
        }}
        onSuccess={() => {
          loadData();
        }}
        locations={locations}
        ingredientToEdit={editingIngredient}
        availableUnits={availableUnits}
      />

      {/* Modal Historial de Movimientos */}
      <IngredientHistoryModal
        businessId={businessId}
        ingredient={historyModalIngredient}
        isOpen={Boolean(historyModalIngredient)}
        onClose={() => setHistoryModalIngredient(null)}
      />

      {/* Modal Importar Ingredientes */}
      <IngredientImportModal
        businessId={businessId}
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => loadData()}
        locations={locations}
      />

      {/* Modal Confirmación Eliminar / Archivar */}
      <ConfirmModal
        isOpen={Boolean(ingredientToArchive)}
        onClose={() => setIngredientToArchive(null)}
        onConfirm={handleConfirmArchive}
        title="¿Eliminar este ingrediente?"
        description={`«${ingredientToArchive?.name}» será retirado del catálogo de recetas y existencias activas.`}
        confirmText="Sí, eliminar ingrediente"
        cancelText="Conservar ingrediente"
        variant="danger"
        isLoading={isArchiving}
      />
    </div>
  );
}
