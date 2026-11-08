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
  LayoutGrid,
  Table as TableIcon,
  Tag,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Select } from "@/components/ui/select";
import { SearchInput } from "@/components/ui/search-input";
import { Location } from "@/lib/inventory/types";
import { RecipeWithDetails, RecipeStatus } from "@/lib/recipes/types";
import { Product } from "@/lib/products/types";
import {
  getRecipesAction,
  deleteRecipeAction,
  duplicateRecipeAction,
  toggleRecipeStatusAction,
} from "./actions";
import { getProductsAction } from "../productos/actions";
import { RecipeFormModal } from "./recipe-form-modal";
import { EmptyState, ErrorState, CardSkeleton, KpiCard, KpiGrid } from "@/components/ui";

interface Props {
  businessId: string;
  locations: Location[];
  availableUnits?: { value: string; label: string }[];
}

export function RecipesTab({ businessId, locations, availableUnits }: Props) {
  const [recipes, setRecipes] = useState<RecipeWithDetails[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modo de vista: tabla o cuadrícula de tarjetas
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Barra de Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

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
      // 1. Cargar recetas primero para renderizado instantáneo
      const recipesRes = await getRecipesAction(businessId);

      if (recipesRes.success && recipesRes.data) {
        setRecipes(recipesRes.data);
      } else {
        const msg = recipesRes.error || "No se pudieron cargar las recetas.";
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

    // 2. Carga en segundo plano de productos para cálculo de KPIs secundarios sin bloquear la interfaz
    getProductsAction(businessId)
      .then((prodsRes) => {
        if (prodsRes.success && prodsRes.data) {
          setProducts(prodsRes.data);
        }
      })
      .catch(() => {
        // Silencioso para no degradar la experiencia de usuario
      });
  };

  useEffect(() => {
    loadRecipes();
  }, [businessId]);

  // Lista única de categorías presentes en las recetas
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    recipes.forEach((r) => {
      if (r.productCategory && r.productCategory.trim()) {
        set.add(r.productCategory.trim());
      }
    });
    return Array.from(set).sort();
  }, [recipes]);

  // Filtrado reactivo en memoria
  const filteredRecipes = useMemo(() => {
    return recipes.filter((r) => {
      // 1. Filtro por categoría
      if (selectedCategory !== "all" && r.productCategory !== selectedCategory) {
        return false;
      }

      // 2. Filtro por estado
      if (selectedStatus !== "all" && r.status !== selectedStatus) {
        return false;
      }

      // 3. Buscador por texto
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
  }, [recipes, searchQuery, selectedCategory, selectedStatus]);

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

  // 5.1. INDICADORES REALES CALCULADOS:
  // - Total de recetas
  // - Recetas activas
  // - Recetas incompletas o sin ingredientes
  // - Productos preparados sin receta
  // - Costo promedio de elaboración
  const kpis = useMemo(() => {
    const total = recipes.length;
    const activeCount = recipes.filter((r) => r.status === "active").length;
    const incompleteCount = recipes.filter((r) => !r.ingredients || r.ingredients.length === 0).length;

    const totalCostPerPortion = recipes.reduce((sum, r) => sum + (r.costPerPortion || 0), 0);
    const avgCostPerPortion = total > 0 ? Math.round(totalCostPerPortion / total) : 0;

    // Productos preparados que no tienen receta activa
    const preparedProducts = products.filter((p) => {
      const meta = (p.metadata as any) || {};
      return meta.product_type !== "ingredient" && meta.product_kind !== "service";
    });

    const productsWithRecipeIds = new Set(recipes.map((r) => r.productId));
    const preparedWithoutRecipeCount = preparedProducts.filter(
      (p) => !productsWithRecipeIds.has(p.id)
    ).length;

    return {
      total,
      activeCount,
      incompleteCount,
      preparedWithoutRecipeCount,
      avgCostPerPortion,
    };
  }, [recipes, products]);

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
        toast.success(`Receta "${recipeToDelete.name}" eliminada exitosamente.`);
        setRecipeToDelete(null);
        loadRecipes();
      } else {
        toast.error(res.error || "No se pudo eliminar la receta.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al eliminar la receta.");
    } finally {
      setIsDeleting(false);
    }
  };

  const hasActiveFilters =
    searchQuery.trim() !== "" || selectedCategory !== "all" || selectedStatus !== "all";

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedStatus("all");
  };

  return (
    <div className="space-y-6">
      {/* 5.1. TARJETAS DE INDICADORES / KPIS REALES (NORMALIZADOS) */}
      <KpiGrid cols={5}>
        <KpiCard
          title="Total Recetas"
          value={kpis.total}
          subtext="Fichas registradas"
          icon={<ChefHat className="w-5 h-5" />}
          variant="orange"
        />
        <KpiCard
          title="Recetas Activas"
          value={kpis.activeCount}
          subtext="Operando en POS"
          icon={<CheckCircle2 className="w-5 h-5" />}
          variant="emerald"
        />
        <KpiCard
          title="Sin Ingredientes"
          value={kpis.incompleteCount}
          subtext="Requieren insumos"
          icon={<AlertTriangle className="w-5 h-5" />}
          variant={kpis.incompleteCount > 0 ? "amber" : "default"}
        />
        <KpiCard
          title="Platos sin Receta"
          value={kpis.preparedWithoutRecipeCount}
          subtext="Pendientes de vincular"
          icon={<UtensilsCrossed className="w-5 h-5" />}
          variant={kpis.preparedWithoutRecipeCount > 0 ? "blue" : "default"}
        />
        <KpiCard
          title="Costo Promedio"
          value={formatCOP(kpis.avgCostPerPortion)}
          subtext="Por porción elaborada"
          icon={<DollarSign className="w-5 h-5" />}
          variant="purple"
        />
      </KpiGrid>

      {/* 5.2. BARRA DE FILTROS Y ACCIONES */}
      <div className="p-3.5 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Buscador de recetas */}
          <div className="flex-1 max-w-sm">
            <SearchInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery("")}
              placeholder="Buscar por producto o receta..."
            />
          </div>

          {/* Filtro por Categoría */}
          {availableCategories.length > 0 && (
            <div className="w-full sm:w-48">
              <Select
                aria-label="Filtrar por categoría"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="all">Todas las categorías</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* Filtro por Estado */}
          <div className="w-full sm:w-36">
            <Select
              aria-label="Filtrar por estado"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activas</option>
              <option value="inactive">Inactivas</option>
            </Select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04] rounded-xl transition-colors cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpiar</span>
            </button>
          )}
        </div>

        {/* Conmutador de vista y Botón Crear */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <div className="flex items-center bg-slate-100 dark:bg-white/[0.05] p-1 rounded-xl border border-slate-200/80 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-white dark:bg-[#131620] text-[#ED500A] shadow-xs font-bold"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
              title="Vista de Tabla"
            >
              <TableIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "cards"
                  ? "bg-white dark:bg-[#131620] text-[#ED500A] shadow-xs font-bold"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
              title="Vista de Tarjetas"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-[#ED500A]/20 transition-all cursor-pointer active:scale-98 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva receta</span>
          </button>
        </div>
      </div>

      {/* 5.3. LISTADO O ESTADO VACÍO */}
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
            <CardSkeleton key={i} className="h-44" />
          ))}
        </div>
      ) : filteredRecipes.length === 0 ? (
        <EmptyState
          icon={ChefHat}
          title="No hay recetas registradas"
          description={
            hasActiveFilters
              ? "No se encontraron recetas con los filtros aplicados. Intenta restablecer los filtros."
              : "Define cómo se elaboran los productos de tu negocio asociando sus ingredientes, cantidades, unidades y costos."
          }
          actionLabel="Crear primera receta"
          onAction={handleOpenCreate}
          resetLabel={hasActiveFilters ? "Limpiar filtros" : undefined}
          onReset={hasActiveFilters ? handleClearFilters : undefined}
        />
      ) : viewMode === "table" ? (
        /* VISTA TABLA DE RECETAS (PROFESIONAL, LIMPIA Y CONSISTENTE) */
        <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-3xs">
                  <th className="py-3.5 px-4">Producto Preparado / Receta</th>
                  <th className="py-3.5 px-3">Categoría</th>
                  <th className="py-3.5 px-3 text-center">Ingredientes</th>
                  <th className="py-3.5 px-3 text-right">Costo / Porción</th>
                  <th className="py-3.5 px-3 text-right">Precio Venta</th>
                  <th className="py-3.5 px-3 text-center">Capacidad Est.</th>
                  <th className="py-3.5 px-3 text-center">Estado</th>
                  <th className="py-3.5 px-3 text-center">Actualización</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {filteredRecipes.map((recipe) => {
                  const portionsAvailable = recipe.portionsAvailable ?? 0;
                  const hasStock = portionsAvailable > 0;

                  return (
                    <tr
                      key={recipe.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors group"
                    >
                      {/* Producto / Receta */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-[#ED500A] flex items-center justify-center shrink-0 font-bold">
                            <ChefHat className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setRecipeToView(recipe)}
                              className="font-bold text-slate-900 dark:text-white hover:text-[#ED500A] transition-colors truncate block text-left cursor-pointer"
                              title="Ver ficha técnica"
                            >
                              {recipe.name}
                            </button>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                              Producto: {recipe.productName}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Categoría */}
                      <td className="py-3.5 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-slate-300">
                          {recipe.productCategory || "Sin categoría"}
                        </span>
                      </td>

                      {/* Cantidad de Ingredientes */}
                      <td className="py-3.5 px-3 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {recipe.ingredients.length} {recipe.ingredients.length === 1 ? "insumo" : "insumos"}
                      </td>

                      {/* Costo Estimado por Porción */}
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatCOP(recipe.costPerPortion)}
                      </td>

                      {/* Precio de Venta */}
                      <td className="py-3.5 px-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCOP(recipe.productPrice)}
                      </td>

                      {/* Capacidad Estimada */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border ${
                            hasStock
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                              : "bg-slate-100 dark:bg-white/[0.05] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/[0.08]"
                          }`}
                          title={
                            recipe.limitingIngredient
                              ? `Limitado por ${recipe.limitingIngredient.name}`
                              : "Sin existencias suficientes"
                          }
                        >
                          {portionsAvailable} porc.
                        </span>
                      </td>

                      {/* Estado */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            recipe.status === "active"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-slate-200/70 dark:bg-white/[0.08] text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {recipe.status === "active" ? "Activa" : "Inactiva"}
                        </span>
                      </td>

                      {/* Fecha de Actualización */}
                      <td className="py-3.5 px-3 text-center text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                        {formatRecipeDate(recipe.updatedAt || recipe.createdAt)}
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setRecipeToView(recipe)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
                            title="Ver ficha técnica"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(recipe)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-[#ED500A] hover:bg-[#ED500A]/10 transition-colors cursor-pointer"
                            title="Editar receta"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleStatus(recipe)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              recipe.status === "active"
                                ? "text-slate-400 hover:text-amber-600 hover:bg-amber-500/10"
                                : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-500/10"
                            }`}
                            title={recipe.status === "active" ? "Desactivar receta" : "Activar receta"}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDuplicate(recipe)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-500/10 transition-colors cursor-pointer"
                            title="Duplicar receta"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setRecipeToDelete(recipe)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Eliminar receta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
      ) : (
        /* VISTA TARJETAS (FORMATO COMPACTO Y MODERNO) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecipes.map((recipe) => {
            const portionsAvailable = recipe.portionsAvailable ?? 0;
            const hasPortions = portionsAvailable > 0;

            return (
              <div
                key={recipe.id}
                className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden hover:border-[#ED500A]/40 transition-all flex flex-col justify-between shadow-2xs hover:shadow-md"
              >
                <div className="p-4 sm:p-5 space-y-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <h3
                        onClick={() => setRecipeToView(recipe)}
                        className="text-base font-bold text-slate-900 dark:text-white hover:text-[#ED500A] transition-colors cursor-pointer truncate"
                        title={recipe.name}
                      >
                        {recipe.name}
                      </h3>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block truncate">
                        Producto: {recipe.productName}
                      </span>
                    </div>

                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                        recipe.status === "active"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-slate-200/70 dark:bg-white/[0.08] text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {recipe.status === "active" ? "Activa" : "Inactiva"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06]">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Costo / unidad</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {formatCOP(recipe.costPerPortion)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Precio de venta</span>
                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCOP(recipe.productPrice)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Capacidad estimada</span>
                      <span className="font-mono font-bold text-[#ED500A]">
                        {portionsAvailable} {portionsAvailable === 1 ? "porción" : "porciones"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Margen bruto est.</span>
                      <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {recipe.marginPercentage}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50/50 dark:bg-white/[0.015] border-t border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-500 font-medium">
                    {recipe.ingredients.length} {recipe.ingredients.length === 1 ? "ingrediente" : "ingredientes"}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setRecipeToView(recipe)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
                      title="Ver ficha técnica"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(recipe)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-[#ED500A] hover:bg-[#ED500A]/10 transition-colors cursor-pointer"
                      title="Editar receta"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecipeToDelete(recipe)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Eliminar receta"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE CREACIÓN / EDICIÓN */}
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
        recipeToEdit={recipeToEdit}
        locations={locations}
        availableUnits={availableUnits}
      />

      {/* MODAL DE DETALLE DE FICHA TÉCNICA Y ESCANDALLO */}
      {recipeToView && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="relative w-full max-w-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Encabezado */}
              <div className="px-5 py-4 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center font-bold shrink-0">
                    <ChefHat className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                      {recipeToView.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Ficha técnica del producto preparado: <strong>{recipeToView.productName}</strong>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setRecipeToView(null)}
                  className="p-1.5 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Contenido */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs">
                {/* Resumen de Métricas */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08]">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Rendimiento:</span>
                    <strong className="text-sm font-mono text-slate-900 dark:text-white">
                      {recipeToView.portions} {recipeToView.portions === 1 ? "porción" : "porciones"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Costo / Porción:</span>
                    <strong className="text-sm font-mono text-slate-900 dark:text-white">
                      {formatCOP(recipeToView.costPerPortion)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Precio de Venta:</span>
                    <strong className="text-sm font-mono text-emerald-600 dark:text-emerald-400">
                      {formatCOP(recipeToView.productPrice)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Margen Bruto:</span>
                    <strong className="text-sm font-mono text-purple-600 dark:text-purple-400">
                      {recipeToView.marginPercentage}%
                    </strong>
                  </div>
                </div>

                {/* Banner de Capacidad Estimada */}
                <div
                  className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                    recipeToView.portionsAvailable > 0
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                      : "bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <PackageCheck className="w-5 h-5 shrink-0" />
                    <div>
                      <div className="font-bold text-xs sm:text-sm">
                        Capacidad estimada:{" "}
                        <span>
                          {recipeToView.portionsAvailable}{" "}
                          {recipeToView.portionsAvailable === 1 ? "unidad" : "unidades"}
                        </span>
                      </div>
                      <div className="text-[11px] opacity-85">
                        {recipeToView.limitingIngredient
                          ? `Limitado por «${recipeToView.limitingIngredient.name}» (existencias actuales alcanzan para ${recipeToView.limitingIngredient.availablePortions} porciones)`
                          : "Existencias suficientes de todos los ingredientes"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabla de Desglose de Ingredientes */}
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-2 text-xs">
                    Ingredientes e Insumos ({recipeToView.ingredients.length})
                  </h4>
                  <div className="border border-slate-200/80 dark:border-white/[0.08] rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-white/[0.04]">
                    <div className="bg-slate-50/75 dark:bg-white/[0.02] px-3 py-2 grid grid-cols-12 font-bold text-slate-500 dark:text-slate-400 uppercase text-3xs tracking-wider">
                      <div className="col-span-5">Ingrediente</div>
                      <div className="col-span-2 text-right">Cantidad</div>
                      <div className="col-span-2 text-right">Costo Unit.</div>
                      <div className="col-span-3 text-right">Subtotal</div>
                    </div>

                    {recipeToView.ingredients.map((item) => (
                      <div
                        key={item.id}
                        className="px-3 py-2.5 grid grid-cols-12 items-center hover:bg-slate-50/50 dark:hover:bg-white/[0.02]"
                      >
                        <div className="col-span-5 font-semibold text-slate-900 dark:text-white truncate">
                          {item.ingredientName}
                          {item.isOptional && (
                            <span className="ml-1.5 text-[10px] text-slate-400 font-normal">
                              (opcional)
                            </span>
                          )}
                        </div>
                        <div className="col-span-2 text-right font-mono text-slate-600 dark:text-slate-400">
                          {item.quantity} {item.unit}
                        </div>
                        <div className="col-span-2 text-right font-mono text-slate-600 dark:text-slate-400">
                          {formatCOP(item.unitCost)}
                        </div>
                        <div className="col-span-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatCOP(item.subtotalCost)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notas de Preparación */}
                {recipeToView.description && (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08]">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Notas de preparación:
                    </span>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-line">
                      {recipeToView.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Pie de acciones del modal */}
              <div className="px-5 py-3 border-t border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = recipeToView;
                    setRecipeToView(null);
                    handleOpenEdit(toEdit);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#ED500A] hover:bg-[#ED500A]/90 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Editar Receta</span>
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL DE CONFIRMACIÓN PARA ELIMINAR (CERO ALERTAS NATIVAS) */}
      {recipeToDelete && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="relative w-full max-w-md bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-3xl shadow-2xl p-6 space-y-4">
              <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    ¿Eliminar esta receta?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300">
                Estás a punto de eliminar la receta de «<strong>{recipeToDelete.name}</strong>». El
                producto preparado permanecerá en el catálogo comercial, pero ya no tendrá ficha técnica
                ni cálculo automático de materias primas.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRecipeToDelete(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Eliminando...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Sí, eliminar receta</span>
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
