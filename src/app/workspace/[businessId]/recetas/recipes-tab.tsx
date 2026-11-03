"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ChefHat,
  Search,
  Plus,
  Clock,
  Layers,
  MapPin,
  PackageCheck,
  AlertTriangle,
  Eye,
  Edit2,
  Trash2,
  DollarSign,
  Loader2,
  X,
  CheckCircle2,
  Copy,
  Power,
  MoreVertical,
  UtensilsCrossed,
  Package,
  FileText,
  Calendar,
  Activity,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Location } from "@/lib/inventory/types";
import { RecipeWithDetails, RecipeStatus } from "@/lib/recipes/types";
import {
  getRecipesAction,
  deleteRecipeAction,
  duplicateRecipeAction,
  toggleRecipeStatusAction,
} from "./actions";
import { RecipeFormModal } from "./recipe-form-modal";
import { EmptyState, ErrorState, CardSkeleton } from "@/components/ui";

interface Props {
  businessId: string;
  locations: Location[];
  availableUnits?: { value: string; label: string }[];
}

export function RecipesTab({ businessId, locations, availableUnits }: Props) {
  const [recipes, setRecipes] = useState<RecipeWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Barra de Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string>("all");

  // Modales
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [recipeToEdit, setRecipeToEdit] = useState<RecipeWithDetails | null>(null);
  const [recipeToView, setRecipeToView] = useState<RecipeWithDetails | null>(null);

  // Menú flotante de opciones por tarjeta
  const [openMenuRecipeId, setOpenMenuRecipeId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Modal de confirmación para eliminar (CERO alertas nativas)
  const [recipeToDelete, setRecipeToDelete] = useState<RecipeWithDetails | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuRecipeId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadRecipes = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await getRecipesAction(businessId, {
        productId: selectedProductId !== "all" ? selectedProductId : undefined,
      });

      if (res.success && res.data) {
        setRecipes(res.data);
      } else {
        const msg = res.error || "No se pudieron cargar las recetas.";
        setLoadError(msg);
        toast.error("Error al cargar recetas", { description: msg });
      }
    } catch (err: any) {
      const msg = err.message || "Error al cargar las recetas.";
      setLoadError(msg);
      toast.error("Error al cargar recetas", { description: msg });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecipes();
  }, [businessId, selectedProductId]);

  // Lista única de productos asociados a las recetas para el desplegable 'Todos los productos'
  const uniqueProducts = useMemo(() => {
    const map = new Map<string, string>();
    recipes.forEach((r) => {
      if (r.productId && r.productName) {
        map.set(r.productId, r.productName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [recipes]);

  // Filtrado reactivo en memoria
  const filteredRecipes = useMemo(() => {
    return recipes.filter((r) => {
      // 1. Filtro desplegable 'Todos los productos'
      if (selectedProductId !== "all" && r.productId !== selectedProductId) {
        return false;
      }

      // 2. Buscador 'Buscar recetas...'
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (r.name || "").toLowerCase().includes(q);
        const matchesProduct = (r.productName || "").toLowerCase().includes(q);
        const matchesSku = (r.productSku || "").toLowerCase().includes(q);
        const matchesCategory = (r.productCategory || "").toLowerCase().includes(q);
        const matchesNotes = (r.description || "").toLowerCase().includes(q);

        if (!matchesName && !matchesProduct && !matchesSku && !matchesCategory && !matchesNotes) {
          return false;
        }
      }

      return true;
    });
  }, [recipes, searchQuery, selectedProductId]);

  // Formato COP
  const formatCOP = (val: number | null | undefined): string => {
    if (val === null || val === undefined || isNaN(val)) return "$0";
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Formato de Fecha (D/M/AAAA)
  const formatRecipeDate = (isoString?: string): string => {
    if (!isoString) return "—";
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    } catch {
      return isoString;
    }
  };

  // KPIs Superiores Requeridos:
  // 1. Total Recetas
  // 2. Costo Promedio (por porción)
  // 3. Recetas Activas
  const kpis = useMemo(() => {
    const total = recipes.length;
    if (total === 0) {
      return {
        total: 0,
        avgCostPerPortion: 0,
        activeCount: 0,
      };
    }

    const totalCostPerPortion = recipes.reduce((sum, r) => sum + (r.costPerPortion || 0), 0);
    const activeCount = recipes.filter((r) => r.status === "active").length;

    return {
      total,
      avgCostPerPortion: Math.round(totalCostPerPortion / total),
      activeCount,
    };
  }, [recipes]);

  // Acciones de Receta
  const handleOpenCreate = () => {
    setRecipeToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (recipe: RecipeWithDetails) => {
    setOpenMenuRecipeId(null);
    setRecipeToEdit(recipe);
    setIsFormModalOpen(true);
  };

  const handleDuplicate = async (recipe: RecipeWithDetails) => {
    setOpenMenuRecipeId(null);
    try {
      toast.loading(`Duplicando receta de "${recipe.name}"...`, { id: "recipe-dup" });
      const res = await duplicateRecipeAction(businessId, recipe.id);
      if (res.success && res.data) {
        toast.success(`Receta duplicada: "${res.data.name}"`, {
          id: "recipe-dup",
          description: "Se guardó como borrador inactivo para editarla a tu medida.",
        });
        loadRecipes();
      } else {
        toast.error(res.error || "No se pudo duplicar la receta.", { id: "recipe-dup" });
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al duplicar la receta.", { id: "recipe-dup" });
    }
  };

  const handleToggleStatus = async (recipe: RecipeWithDetails) => {
    setOpenMenuRecipeId(null);
    const newStatus: RecipeStatus = recipe.status === "active" ? "inactive" : "active";
    try {
      toast.loading(newStatus === "active" ? "Activando receta..." : "Desactivando receta...", {
        id: "recipe-status",
      });
      const res = await toggleRecipeStatusAction(businessId, recipe.id, newStatus);
      if (res.success) {
        toast.success(
          newStatus === "active"
            ? `Receta "${recipe.name}" activada.`
            : `Receta "${recipe.name}" desactivada.`,
          { id: "recipe-status" }
        );
        loadRecipes();
      } else {
        toast.error(res.error || "No se pudo modificar el estado.", { id: "recipe-status" });
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al modificar el estado.", { id: "recipe-status" });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!recipeToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteRecipeAction(businessId, recipeToDelete.id);
      if (res.success) {
        toast.success(`Receta de "${recipeToDelete.name}" eliminada.`);
        setRecipeToDelete(null);
        loadRecipes();
      } else {
        toast.error(res.error || "Error al eliminar la receta.");
      }
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar la receta.");
    } finally {
      setIsDeleting(false);
    }
  };

  const hasActiveFilters = searchQuery.trim() !== "" || selectedProductId !== "all";

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedProductId("all");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. KPIS SUPERIORES: Total Recetas, Costo Promedio (por porción), Recetas Activas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* KPI 1: Total Recetas */}
        <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
              Total Recetas
            </span>
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 block">
              {kpis.total}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Fichas técnicas registradas
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <ChefHat className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: Costo Promedio (por porción) */}
        <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
              Costo Promedio (por porción)
            </span>
            <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">
              {formatCOP(kpis.avgCostPerPortion)}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Costo base de materias primas
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Recetas Activas */}
        <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
              Recetas Activas
            </span>
            <span className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1 block">
              {kpis.activeCount}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Disponibles para preparación y POS
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. BARRA DE FILTROS: Buscador 'Buscar recetas...', Desplegable 'Todos los productos', Botón '+ Nueva Receta' */}
      <div className="p-3.5 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Buscador 'Buscar recetas...' */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar recetas..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50/50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] text-slate-900 dark:text-white placeholder:text-slate-400 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/40 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Desplegable 'Todos los productos' */}
          <div className="relative">
            <select
              aria-label="Filtrar por producto"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full sm:w-auto px-3.5 py-2 bg-slate-50/50 dark:bg-[#0E131F] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/40 transition-colors cursor-pointer"
            >
              <option value="all">Todos los productos</option>
              {uniqueProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04] rounded-xl transition-colors cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpiar filtros</span>
            </button>
          )}
        </div>

        {/* Botón principal '+ Nueva Receta' */}
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-[#ED500A]/20 transition-all cursor-pointer active:scale-98 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Nueva Receta</span>
        </button>
      </div>

      {/* 3. CATÁLOGO DE RECETAS EN FORMATO CARDS (TARJETAS) */}
      {loadError ? (
        <ErrorState
          title="Error al cargar recetas"
          description={loadError}
          onRetry={loadRecipes}
          retryLabel="Reintentar consulta"
        />
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} className="h-72" />
          ))}
        </div>
      ) : filteredRecipes.length === 0 ? (
        <EmptyState
          icon={ChefHat}
          title="No se encontraron recetas"
          description={
            hasActiveFilters
              ? "No hay recetas que coincidan con la búsqueda o el producto seleccionado."
              : "Crea las fichas técnicas y recetas de tus productos para calcular costos y descontar existencias automáticamente."
          }
          actionLabel="+ Nueva Receta"
          onAction={handleOpenCreate}
          resetLabel={hasActiveFilters ? "Limpiar filtros" : undefined}
          onReset={hasActiveFilters ? handleClearFilters : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecipes.map((recipe) => {
            const isMenuOpen = openMenuRecipeId === recipe.id;
            const portionsAvailable = recipe.portionsAvailable ?? 0;
            const hasPortions = portionsAvailable > 0;

            return (
              <div
                key={recipe.id}
                className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden hover:border-[#ED500A]/40 transition-all flex flex-col justify-between shadow-2xs hover:shadow-md"
              >
                {/* PARTE SUPERIOR DE LA TARJETA */}
                <div className="p-4 sm:p-5 space-y-3.5">
                  {/* CABECERA: Nombre de la receta, fecha y badges de estado */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <h3
                          onClick={() => setRecipeToView(recipe)}
                          className="text-base font-bold text-slate-900 dark:text-white hover:text-[#ED500A] dark:hover:text-[#ED500A] transition-colors cursor-pointer truncate"
                          title={recipe.name}
                        >
                          {recipe.name}
                        </h3>
                        <div className="flex items-center gap-1.5 text-2xs text-slate-400 dark:text-slate-500">
                          <Calendar className="w-3 h-3 shrink-0" />
                          <span>{formatRecipeDate(recipe.createdAt)}</span>
                        </div>
                      </div>

                      {/* MENÚ DE OPCIONES DESPLEGABLE EN CABECERA */}
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenuRecipeId(isMenuOpen ? null : recipe.id)
                          }
                          className="p-1.5 rounded-lg border border-slate-200/70 dark:border-white/[0.08] text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
                          title="Menú de opciones"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {isMenuOpen && (
                          <div
                            ref={menuRef}
                            className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-[#121624] border border-slate-200 dark:border-white/[0.1] rounded-xl shadow-xl z-30 p-1 divide-y divide-slate-100 dark:divide-white/[0.05] animate-in fade-in zoom-in-95 duration-150"
                          >
                            <div className="py-1">
                              {/* Editar */}
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(recipe)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer font-medium text-left"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                                <span>Editar</span>
                              </button>

                              {/* Duplicar */}
                              <button
                                type="button"
                                onClick={() => handleDuplicate(recipe)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer font-medium text-left"
                              >
                                <Copy className="w-3.5 h-3.5 text-amber-500" />
                                <span>Duplicar</span>
                              </button>

                              {/* Desactivar / Activar */}
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(recipe)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer font-medium text-left"
                              >
                                {recipe.status === "active" ? (
                                  <>
                                    <Power className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Desactivar</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>Activar</span>
                                  </>
                                )}
                              </button>
                            </div>

                            <div className="py-1">
                              {/* Eliminar */}
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuRecipeId(null);
                                  setRecipeToDelete(recipe);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer font-medium text-left"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                <span>Eliminar</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* BADGES DE ESTADO: 'Alcanza para X porciones' y 'Activa' */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Badge: Alcanza para X porciones */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold border ${
                          hasPortions
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                        }`}
                      >
                        <PackageCheck className="w-3 h-3" />
                        <span>
                          {hasPortions
                            ? `Alcanza para ${portionsAvailable} ${
                                portionsAvailable === 1 ? "porción" : "porciones"
                              }`
                            : "Sin porciones disponibles"}
                        </span>
                      </span>

                      {/* Badge: Activa / Inactiva */}
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider border ${
                          recipe.status === "active"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-slate-100 dark:bg-white/[0.04] text-slate-500 border-slate-200 dark:border-white/[0.08]"
                        }`}
                      >
                        {recipe.status === "active" ? "Activa" : "Inactiva"}
                      </span>
                    </div>
                  </div>

                  {/* PRODUCTO ASOCIADO: Miniatura de imagen, nombre, categoría, precio de venta y stock actual */}
                  <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.06] flex items-center gap-3">
                    {/* Miniatura de imagen */}
                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden flex items-center justify-center shrink-0">
                      {recipe.productImageUrl ? (
                        <img
                          src={recipe.productImageUrl}
                          alt={recipe.productName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <UtensilsCrossed className="w-5 h-5 text-slate-400" />
                      )}
                    </div>

                    {/* Datos del producto */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {recipe.productName}
                        </span>
                        {recipe.productSku && (
                          <span className="text-3xs font-mono px-1 py-0.2 rounded bg-slate-200/70 dark:bg-white/[0.08] text-slate-600 dark:text-slate-300 shrink-0">
                            {recipe.productSku}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-2xs text-slate-500 dark:text-slate-400">
                        <span className="truncate">
                          {recipe.productCategory || "Sin categoría"}
                        </span>
                        <span>•</span>
                        <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          {formatCOP(recipe.productPrice)}
                        </span>
                      </div>

                      {/* Stock actual del producto */}
                      <div className="flex items-center gap-1 text-2xs">
                        <Package className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-600 dark:text-slate-300 font-mono">
                          {recipe.productStock !== null && recipe.productStock !== undefined
                            ? `${recipe.productStock} en stock`
                            : "Stock consolidado"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* DESCRIPCIÓN / NOTAS DE PREPARACIÓN */}
                  <div className="space-y-1">
                    <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider block">
                      Notas de preparación:
                    </span>
                    <p
                      className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed"
                      title={recipe.description || "Sin notas de preparación"}
                    >
                      {recipe.description?.trim() ? (
                        recipe.description
                      ) : (
                        <span className="text-slate-400 italic">
                          Sin notas de preparación registradas.
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* PIE DE LA TARJETA: Conteo de ingredientes, costo calculado por porción ($) y acciones */}
                <div className="p-3.5 sm:px-5 bg-slate-50/50 dark:bg-white/[0.015] border-t border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between gap-2 text-xs">
                  {/* Conteo de ingredientes */}
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <Layers className="w-3.5 h-3.5 text-[#ED500A] shrink-0" />
                    <span className="font-semibold text-2xs sm:text-xs">
                      {recipe.ingredients.length}{" "}
                      {recipe.ingredients.length === 1 ? "ingrediente" : "ingredientes"}
                    </span>
                  </div>

                  {/* Costo calculado por porción ($) */}
                  <div className="text-right">
                    <span className="text-2xs text-slate-400 block">Costo / porción</span>
                    <span className="font-black font-mono text-xs sm:text-sm text-slate-900 dark:text-white">
                      {formatCOP(recipe.costPerPortion)}
                    </span>
                  </div>

                  {/* Acciones directas rápidas */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setRecipeToView(recipe)}
                      className="p-1.5 rounded-lg border border-slate-200/70 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
                      title="Ver Ficha Técnica"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(recipe)}
                      className="p-1.5 rounded-lg border border-slate-200/70 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:text-[#ED500A] dark:hover:text-[#ED500A] hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
                      title="Editar receta"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Creación / Edición */}
      <RecipeFormModal
        businessId={businessId}
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setRecipeToEdit(null);
        }}
        onSuccess={() => {
          setIsFormModalOpen(false);
          setRecipeToEdit(null);
          loadRecipes();
        }}
        recipe={recipeToEdit}
        locations={locations}
        availableUnits={availableUnits}
      />

      {/* Modal de Detalle de Escandallo y Stock Proyectado */}
      {recipeToView && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <ChefHat className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {recipeToView.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Ficha técnica del producto: <strong>{recipeToView.productName}</strong>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setRecipeToView(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Contenido */}
              <div className="p-6 overflow-y-auto space-y-4 text-xs">
                {/* Métricas */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08]">
                  <div>
                    <span className="text-slate-500 block">Rendimiento:</span>
                    <strong className="text-sm font-mono text-slate-900 dark:text-white">
                      {recipeToView.portions} {recipeToView.portions === 1 ? "porción" : "porciones"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Costo / Porción:</span>
                    <strong className="text-sm font-mono text-slate-900 dark:text-white">
                      {formatCOP(recipeToView.costPerPortion)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Precio de Venta:</span>
                    <strong className="text-sm font-mono text-emerald-600 dark:text-emerald-400">
                      {formatCOP(recipeToView.productPrice)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Margen Bruto:</span>
                    <strong className="text-sm font-mono text-slate-900 dark:text-white">
                      {recipeToView.marginPercentage}%
                    </strong>
                  </div>
                </div>

                {/* Banner de Disponibilidad "¿Cuánto me alcanza?" */}
                <div
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                    recipeToView.portionsAvailable > 0
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                      : "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <PackageCheck className="w-5 h-5 shrink-0" />
                    <div>
                      <div className="font-bold text-xs sm:text-sm">
                        Alcanza para:{" "}
                        <span className="underline">
                          {recipeToView.portionsAvailable}{" "}
                          {recipeToView.portionsAvailable === 1 ? "porción" : "porciones"}
                        </span>
                      </div>
                      <div className="text-2xs opacity-85">
                        {recipeToView.limitingIngredient
                          ? `Cuello de botella: ${recipeToView.limitingIngredient.name} (alcanza para ${recipeToView.limitingIngredient.availablePortions} porc.)`
                          : "Stock suficiente para todos los ingredientes"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabla de Desglose de Ingredientes */}
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-2">
                    Ingredientes ({recipeToView.ingredients.length})
                  </h4>
                  <div className="border border-slate-200/80 dark:border-white/[0.08] rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-white/[0.04]">
                    <div className="bg-slate-50/75 dark:bg-white/[0.02] px-3 py-2 grid grid-cols-12 font-semibold text-slate-500 dark:text-slate-400 uppercase text-3xs tracking-wider">
                      <div className="col-span-4">Ingrediente</div>
                      <div className="col-span-2 text-right">Cantidad</div>
                      <div className="col-span-3 text-right">Costo Unit.</div>
                      <div className="col-span-3 text-right">Stock Actual</div>
                    </div>

                    {recipeToView.ingredients.map((item) => (
                      <div
                        key={item.id}
                        className="px-3 py-2 grid grid-cols-12 items-center hover:bg-slate-50/50 dark:hover:bg-white/[0.02]"
                      >
                        <div className="col-span-4 font-medium text-slate-900 dark:text-white truncate">
                          {item.ingredientName}
                        </div>
                        <div className="col-span-2 text-right text-slate-600 dark:text-slate-400">
                          {item.quantity} {item.unit}
                        </div>
                        <div className="col-span-3 text-right font-mono text-slate-600 dark:text-slate-400">
                          {formatCOP(item.unitCost)}
                        </div>
                        <div className="col-span-3 text-right font-mono font-semibold text-slate-900 dark:text-white">
                          {item.stockQuantity} {item.unit}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {recipeToView.description && (
                  <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] space-y-1">
                    <span className="font-bold text-slate-900 dark:text-white block">
                      Instrucciones de Elaboración:
                    </span>
                    <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
                      {recipeToView.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-slate-200/80 dark:border-white/[0.08] flex justify-end">
                <button
                  type="button"
                  onClick={() => setRecipeToView(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.1] text-slate-800 dark:text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal Personalizado de Confirmación para Eliminar (Regla: Prohibido alertas nativas) */}
      {recipeToDelete && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-md bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.1] rounded-2xl shadow-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    ¿Eliminar Receta?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Esta acción desvinculará la ficha técnica del producto.
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                ¿Estás seguro de que deseas eliminar la receta{" "}
                <strong className="text-slate-900 dark:text-white font-semibold">
                  "{recipeToDelete.name}"
                </strong>
                ? Las materias primas ya no se descontarán automáticamente por receta para este
                producto.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRecipeToDelete(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl border border-slate-200/80 dark:border-white/[0.08] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Eliminando...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Sí, Eliminar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
