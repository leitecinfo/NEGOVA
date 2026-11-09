"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
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
  Download,
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
  Boxes,
  Barcode,
  Tag,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import { formatCOP } from "@/config/plans";
import { Location } from "@/lib/inventory/types";
import {
  Ingredient,
  IngredientKPIs,
  IngredientFilters,
  INGREDIENT_UNITS,
  MaterialType,
} from "@/lib/recipes/types";
import {
  getIngredientsAction,
  getIngredientKPIsAction,
  archiveIngredientAction,
  toggleIngredientAvailabilityAction,
  getRecipesUsingIngredientAction,
  exportIngredientsCSVAction,
  exportIngredientsExcelAction,
  getMaterialCategoriesAction,
} from "./actions";
import { IngredientFormModal } from "./ingredient-form-modal";
import { IngredientHistoryModal } from "./ingredient-history-modal";
import { IngredientImportModal } from "./ingredient-import-modal";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { TableSkeleton, EmptyState, ErrorState, KpiCard, KpiGrid, SearchInput } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";

interface Props {
  businessId: string;
  locations: Location[];
  availableUnits?: { value: string; label: string }[];
  categories?: { id: string; name: string }[];
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

export function IngredientsTab({ businessId, locations, availableUnits, categories: initialCategories }: Props) {
  const unitOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string }>();
    INGREDIENT_UNITS.forEach((u) => {
      map.set(u.value.toLowerCase(), { value: u.value, label: u.label });
    });
    if (availableUnits && availableUnits.length > 0) {
      availableUnits.forEach((u) => {
        const key = u.value.toLowerCase();
        if (!map.has(key)) {
          map.set(key, u);
        }
      });
    }
    return Array.from(map.values());
  }, [availableUnits]);

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>(initialCategories || []);
  const [kpis, setKpis] = useState<IngredientKPIs>({
    totalIngredients: 0,
    activeIngredients: 0,
    activeSupplies: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    totalCostValuation: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Vista (Tabla por defecto para administración clara o Tarjetas)
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Filtros
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "ingredient" | "supply">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [stockStatus, setStockStatus] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");

  // Exportación
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    if (isExportMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isExportMenuOpen]);

  // Modales
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [ingredientToArchive, setIngredientToArchive] = useState<Ingredient | null>(null);
  const [recipesUsingIngredient, setRecipesUsingIngredient] = useState<
    Array<{ recipeId: string; recipeName: string; productName: string; status: string }>
  >([]);
  const [isCheckingRecipes, setIsCheckingRecipes] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [historyModalIngredient, setHistoryModalIngredient] = useState<Ingredient | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Cargar categorías si no vinieron por props
  useEffect(() => {
    if (!initialCategories || initialCategories.length === 0) {
      getMaterialCategoriesAction(businessId)
        .then((res) => {
          if (res.success && res.data) {
            setCategories(res.data);
          }
        })
        .catch(() => {});
    }
  }, [businessId, initialCategories]);

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [listRes, kpiRes] = await Promise.all([
        getIngredientsAction(businessId, {
          search,
          type: typeFilter,
          categoryId: categoryFilter,
          status: statusFilter,
          stockStatus,
          locationId: locationFilter,
        }),
        getIngredientKPIsAction(businessId),
      ]);

      if (listRes.success && listRes.data) {
        setIngredients(listRes.data);
      } else {
        const msg = listRes.error || "No se pudieron cargar los materiales.";
        setLoadError(msg);
        toast.error("Error al cargar materiales", { description: msg });
      }

      if (kpiRes.success && kpiRes.data) setKpis(kpiRes.data);
    } catch (err: any) {
      const msg = err.message || "Error al conectar con el servidor.";
      setLoadError(msg);
      toast.error("Error al cargar materiales", { description: msg });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [businessId, typeFilter, categoryFilter, statusFilter, stockStatus, locationFilter]);

  // Manejo de exportar CSV
  const handleExportCSV = async () => {
    setIsExportingCSV(true);
    try {
      const res = await exportIngredientsCSVAction(businessId);
      if (!res.success || !res.csv) {
        toast.error("Error al exportar CSV", { description: res.error || "No se pudo generar el archivo." });
        return;
      }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename || `ingredientes_insumos_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("CSV exportado exitosamente");
    } catch (err: any) {
      toast.error("Error al exportar", { description: err.message });
    } finally {
      setIsExportingCSV(false);
    }
  };

  // Manejo de exportar Excel
  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const res = await exportIngredientsExcelAction(businessId);
      if (!res.success || !res.base64) {
        toast.error("Error al exportar Excel", { description: res.error || "No se pudo generar el archivo." });
        return;
      }
      const byteCharacters = atob(res.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename || `ingredientes_insumos_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Excel exportado exitosamente");
    } catch (err: any) {
      toast.error("Error al exportar", { description: err.message });
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Manejo previo a archivar: consultar recetas vinculadas
  const handleRequestArchive = async (ing: Ingredient) => {
    setIngredientToArchive(ing);
    setIsCheckingRecipes(true);
    setRecipesUsingIngredient([]);
    try {
      const res = await getRecipesUsingIngredientAction(businessId, ing.id);
      if (res.success && res.data) {
        setRecipesUsingIngredient(res.data);
      }
    } catch {
      // No bloqueante
    } finally {
      setIsCheckingRecipes(false);
    }
  };

  // Confirmar eliminación / archivado
  const handleConfirmArchive = async () => {
    if (!ingredientToArchive) return;
    setIsArchiving(true);
    try {
      const res = await archiveIngredientAction(businessId, ingredientToArchive.id);
      if (!res.success) {
        toast.error("Error al eliminar material", {
          description: res.error || "No se pudo eliminar el material.",
        });
        return;
      }

      toast.success("Material retirado", {
        description: `«${ingredientToArchive.name}» fue retirado del catálogo activo.`,
      });
      setIngredientToArchive(null);
      setRecipesUsingIngredient([]);
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
            : `«${ing.name}» ahora está inactivo / oculto`
        );
      } else {
        toast.error("Error al modificar estado", {
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
        (ing.sku && ing.sku.toLowerCase().includes(q)) ||
        (ing.barcode && ing.barcode.toLowerCase().includes(q)) ||
        (ing.categoryName && ing.categoryName.toLowerCase().includes(q)) ||
        (ing.notes && ing.notes.toLowerCase().includes(q)) ||
        (ing.locationName && ing.locationName.toLowerCase().includes(q))
    );
  }, [ingredients, search]);

  // Cálculo de KPIs consolidados (sección 5.1 de la especificación)
  const calculatedKPIs = useMemo(() => {
    const total = ingredients.length;
    const activeIngredients = ingredients.filter(
      (i) => (i.type === "ingredient" || !i.type) && i.isAvailable
    ).length;
    const activeSupplies = ingredients.filter(
      (i) => i.type === "supply" && i.isAvailable
    ).length;
    const lowStock = ingredients.filter(
      (i) => i.stockQuantity <= i.minStock && i.stockQuantity > 0
    ).length;
    const outOfStock = ingredients.filter((i) => i.stockQuantity <= 0).length;
    const totalValuation = ingredients.reduce(
      (sum, i) => sum + i.stockQuantity * i.costPerUnit,
      0
    );

    return {
      total: kpis.totalIngredients || total,
      activeIngredients: kpis.activeIngredients || activeIngredients,
      activeSupplies: kpis.activeSupplies || activeSupplies,
      lowStock: kpis.lowStockCount || lowStock,
      outOfStock: kpis.outOfStockCount || outOfStock,
      totalValuation: kpis.totalCostValuation || totalValuation,
    };
  }, [ingredients, kpis]);

  const activeTab: "all" | "ingredient" | "supply" = typeFilter;

  const hasActiveFilters =
    Boolean(search.trim()) ||
    typeFilter !== "all" ||
    categoryFilter !== "all" ||
    statusFilter !== "all" ||
    stockStatus !== "all" ||
    locationFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setCategoryFilter("all");
    setStatusFilter("all");
    setStockStatus("all");
    setLocationFilter("all");
    setCurrentPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filteredIngredients.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedIngredients = filteredIngredients.slice(startIndex, startIndex + pageSize);

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* 1. INDICADORES (NORMALIZADOS CON KPIGRID Y KPICARD)       */}
      {/* ========================================================= */}
      <KpiGrid cols={5}>
        <KpiCard
          title="Total Materiales"
          value={calculatedKPIs.total}
          subtext="Registrados en el sistema"
          icon={<Package className="w-5 h-5" />}
          variant="blue"
          onClick={() => {
            setTypeFilter("all");
            setStockStatus("all");
            setCurrentPage(1);
          }}
          className="cursor-pointer hover:border-blue-400"
        />
        <KpiCard
          title="Ingredientes"
          value={calculatedKPIs.activeIngredients}
          subtext="Para recetas y productos"
          icon={<Apple className="w-5 h-5" />}
          variant="emerald"
          onClick={() => {
            setTypeFilter("ingredient");
            setStockStatus("all");
            setCurrentPage(1);
          }}
          className="cursor-pointer hover:border-emerald-400"
        />
        <KpiCard
          title="Insumos"
          value={calculatedKPIs.activeSupplies}
          subtext="Operación y empaques"
          icon={<Boxes className="w-5 h-5" />}
          variant="purple"
          onClick={() => {
            setTypeFilter("supply");
            setStockStatus("all");
            setCurrentPage(1);
          }}
          className="cursor-pointer hover:border-purple-400"
        />
        <KpiCard
          title="Stock Bajo"
          value={calculatedKPIs.lowStock}
          subtext="Existencia ≤ Mínimo"
          icon={<AlertTriangle className="w-5 h-5" />}
          variant={calculatedKPIs.lowStock > 0 ? "amber" : "default"}
          onClick={() => {
            setStockStatus("low_stock");
            setTypeFilter("all");
            setCurrentPage(1);
          }}
          className="cursor-pointer hover:border-amber-400"
        />
        <KpiCard
          title="Valor al costo"
          value={formatCOP(calculatedKPIs.totalValuation)}
          subtext="Valorizado total en almacén"
          icon={<DollarSign className="w-5 h-5" />}
          variant="emerald"
        />
      </KpiGrid>

      {/* ========================================================= */}
      {/* 2. PESTAÑAS Y ACCIONES DEL MÓDULO (ESTILO PRODUCTOS / INVENTARIO) */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200/80 dark:border-white/[0.08] pb-1">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              setTypeFilter("all");
              setStockStatus("all");
              setCurrentPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 cursor-pointer ${
              activeTab === "all"
                ? "bg-[#ED500A]/10 text-[#ED500A] dark:bg-[#ED500A]/20 font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.02]"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Todos</span>
            <span className="ml-1 text-2xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 font-bold">
              {calculatedKPIs.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTypeFilter("ingredient");
              setStockStatus("all");
              setCurrentPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 cursor-pointer ${
              activeTab === "ingredient"
                ? "bg-[#ED500A]/10 text-[#ED500A] dark:bg-[#ED500A]/20 font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.02]"
            }`}
          >
            <Apple className="w-4 h-4" />
            <span>Ingredientes</span>
            <span className="ml-1 text-2xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 font-bold">
              {calculatedKPIs.activeIngredients}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTypeFilter("supply");
              setStockStatus("all");
              setCurrentPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 cursor-pointer ${
              activeTab === "supply"
                ? "bg-[#ED500A]/10 text-[#ED500A] dark:bg-[#ED500A]/20 font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.02]"
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Insumos</span>
            <span className="ml-1 text-2xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 font-bold">
              {calculatedKPIs.activeSupplies}
            </span>
          </button>
        </div>

        {/* Acciones principales y switch de vista */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
          {/* Selector de Vista (Tabla / Tarjetas) */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-white/[0.04] rounded-xl border border-slate-200/80 dark:border-white/[0.08]">
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
          </div>

          {/* Botón único de Exportar con menú desplegable */}
          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
              disabled={isExportingCSV || isExportingExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.1] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-all cursor-pointer shadow-2xs disabled:opacity-50"
              title="Exportar materiales"
            >
              {isExportingCSV || isExportingExcel ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
              ) : (
                <Download className="w-3.5 h-3.5 text-[#ED500A]" />
              )}
              <span>Exportar</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                  isExportMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-56 z-30 bg-white dark:bg-[#151926] border border-slate-200 dark:border-white/[0.1] rounded-2xl shadow-xl p-1.5 text-left animate-in fade-in zoom-in-95 duration-150">
                <button
                  type="button"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    handleExportExcel();
                  }}
                  disabled={isExportingExcel}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] rounded-xl transition-colors cursor-pointer text-left"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div>
                    <span className="font-bold block">Excel (.xlsx)</span>
                    <span className="text-[10px] text-slate-400 block">Hoja de cálculo nativa</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    handleExportCSV();
                  }}
                  disabled={isExportingCSV}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] rounded-xl transition-colors cursor-pointer text-left mt-0.5"
                >
                  <Download className="w-4 h-4 text-blue-500 shrink-0" />
                  <div>
                    <span className="font-bold block">CSV (.csv)</span>
                    <span className="text-[10px] text-slate-400 block">Texto delimitado (UTF-8)</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Importar */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
            title="Importar materiales desde archivo"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#ED500A]" />
            <span>Importar</span>
          </Button>

          {/* Nuevo Material */}
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditingIngredient(null);
              setIsFormOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo material</span>
          </Button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. BARRA DE FILTROS UNIFICADA */}
      {/* ========================================================= */}
      <div className="p-3.5 sm:p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs flex flex-wrap items-center gap-3">
        {/* Búsqueda por texto */}
        <div className="flex-1 min-w-[200px] sm:min-w-[260px]">
          <SearchInput
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            onClear={() => {
              setSearch("");
              setCurrentPage(1);
            }}
            placeholder="Buscar por nombre, SKU o código de barras..."
          />
        </div>

        {/* Filtro por Categoría */}
        {categories.length > 0 && (
          <Select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-auto min-w-[170px]"
          >
            <option value="all">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}

        {/* Filtro por Disponibilidad / Stock */}
        <Select
          value={stockStatus}
          onChange={(e) => {
            setStockStatus(e.target.value as any);
            setCurrentPage(1);
          }}
          className="w-auto min-w-[160px]"
        >
          <option value="all">Todos los stocks</option>
          <option value="in_stock">En stock (&gt; mín)</option>
          <option value="low_stock">Stock bajo (&le; mín)</option>
          <option value="out_of_stock">Agotado (0)</option>
        </Select>

        {/* Filtro por Estado */}
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as any);
            setCurrentPage(1);
          }}
          className="w-auto min-w-[150px]"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos / Ocultos</option>
        </Select>

        {/* Botón para limpiar filtros */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Limpiar filtros</span>
          </button>
        )}
      </div>

      {/* ========================================================= */}
      {/* 4. CONTENIDO PRINCIPAL: LISTADO EN TABLA O TARJETAS */}
      {/* ========================================================= */}
      {loadError ? (
        <ErrorState
          title="Error al cargar materiales"
          description={loadError}
          onRetry={loadData}
          retryLabel="Reintentar consulta"
        />
      ) : isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : filteredIngredients.length === 0 ? (
        <EmptyState
          icon={Apple}
          title="No hay materiales registrados"
          description={
            hasActiveFilters
              ? "No se encontraron materiales que coincidan con los filtros aplicados."
              : "Registra ingredientes, insumos, empaques y suministros para controlar existencias, costear recetas y compras."
          }
          actionLabel="Crear Primer Material"
          onAction={() => {
            setEditingIngredient(null);
            setIsFormOpen(true);
          }}
          resetLabel={hasActiveFilters ? "Limpiar filtros" : undefined}
          onReset={hasActiveFilters ? clearFilters : undefined}
        />
      ) : viewMode === "table" ? (
        /* VISTA EN TABLA (Sección 5.2 de la especificación) */
        <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[950px]">
              <thead className="bg-slate-50/80 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3.5">Nombre</th>
                  <th className="px-3 py-3.5">Tipo</th>
                  <th className="px-3 py-3.5">Categoría</th>
                  <th className="px-3 py-3.5">SKU / Ref</th>
                  <th className="px-3 py-3.5">Unidad</th>
                  <th className="px-4 py-3.5">Existencia actual</th>
                  <th className="px-3 py-3.5">Stock mín</th>
                  <th className="px-3 py-3.5">Costo unitario</th>
                  <th className="px-3 py-3.5 text-center">Estado</th>
                  <th className="px-4 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {paginatedIngredients.map((ing) => {
                  const initialChar = ing.name.trim().charAt(0).toUpperCase();
                  const avatarColorClass = getAvatarColor(initialChar);
                  const isOutOfStock = ing.stockQuantity <= 0;
                  const isLowStock = ing.stockQuantity <= ing.minStock;
                  const isSupply = ing.type === "supply";

                  return (
                    <tr
                      key={ing.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-white/[0.015] transition-colors"
                    >
                      {/* Nombre con avatar / imagen */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          {ing.imageUrl ? (
                            <img
                              src={ing.imageUrl}
                              alt={ing.name}
                              className="w-8 h-8 rounded-xl object-cover border border-slate-200/80 dark:border-white/[0.08] shrink-0"
                              loading="lazy"
                            />
                          ) : (
                            <div
                              className={`w-8 h-8 rounded-xl border flex items-center justify-center font-bold text-xs shrink-0 ${avatarColorClass}`}
                            >
                              {initialChar}
                            </div>
                          )}
                          <div className="min-w-0">
                            <span
                              className="font-bold text-slate-900 dark:text-white block truncate max-w-[200px]"
                              title={ing.name}
                            >
                              {ing.name}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Tipo: Ingrediente vs Insumo */}
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        <Badge variant={isSupply ? "purple" : "emerald"} size="sm">
                          {isSupply ? <Boxes className="w-3 h-3 mr-1" /> : <Apple className="w-3 h-3 mr-1" />}
                          {isSupply ? "Insumo" : "Ingrediente"}
                        </Badge>
                      </td>

                      {/* Categoría */}
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        <span className="text-slate-600 dark:text-slate-300 text-xs">
                          {ing.categoryName || "—"}
                        </span>
                      </td>

                      {/* SKU / Ref */}
                      <td className="px-3 py-3.5 whitespace-nowrap font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {ing.sku || "—"}
                      </td>

                      {/* Unidad */}
                      <td className="px-3 py-3.5 whitespace-nowrap font-medium text-slate-600 dark:text-slate-300">
                        {ing.unit}
                      </td>

                      {/* Existencia actual */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <Badge
                          variant={isOutOfStock ? "red" : isLowStock ? "amber" : "emerald"}
                          size="sm"
                          className="font-mono font-bold"
                        >
                          {formatStockDisplay(ing.stockQuantity, ing.unit)}
                        </Badge>
                      </td>

                      {/* Stock mínimo */}
                      <td className="px-3 py-3.5 whitespace-nowrap font-mono text-slate-500 dark:text-slate-400">
                        {ing.minStock > 0 ? `${ing.minStock} ${ing.unit}` : "—"}
                      </td>

                      {/* Costo unitario */}
                      <td className="px-3 py-3.5 whitespace-nowrap font-mono font-semibold text-[#ED500A]">
                        {formatCOP(ing.costPerUnit)}/{ing.unit}
                      </td>

                      {/* Estado */}
                      <td className="px-3 py-3.5 text-center whitespace-nowrap">
                        <Badge variant={ing.isAvailable ? "emerald" : "slate"} size="sm">
                          {ing.isAvailable ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setHistoryModalIngredient(ing)}
                            title="Historial de movimientos (Kardex)"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors cursor-pointer"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingIngredient(ing);
                              setIsFormOpen(true);
                            }}
                            title="Editar material"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#ED500A] hover:bg-[#ED500A]/10 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleAvailability(ing)}
                            disabled={togglingId === ing.id}
                            title={ing.isAvailable ? "Desactivar material" : "Activar material"}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors cursor-pointer"
                          >
                            {togglingId === ing.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                            ) : ing.isAvailable ? (
                              <Eye className="w-4 h-4" />
                            ) : (
                              <EyeOff className="w-4 h-4 text-amber-500" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRequestArchive(ing)}
                            title="Eliminar material"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
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

          {/* Paginador estándar de tabla */}
          {filteredIngredients.length > 0 && (
            <div className="p-3 sm:p-4 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/40 dark:bg-white/[0.01]">
              <Pagination
                currentPage={safeCurrentPage}
                totalPages={totalPages}
                totalItems={filteredIngredients.length}
                pageSize={pageSize}
                pageSizeOptions={[10, 15, 25, 50]}
                itemLabel="materiales"
                onPageChange={(page) => setCurrentPage(page)}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
              />
            </div>
          )}
        </div>
      ) : (
        /* VISTA EN TARJETAS */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {paginatedIngredients.map((ing) => {
            const initialChar = ing.name.trim().charAt(0).toUpperCase();
            const avatarColorClass = getAvatarColor(initialChar);
            const isOutOfStock = ing.stockQuantity <= 0;
            const isLowStock = ing.stockQuantity <= ing.minStock;
            const isSupply = ing.type === "supply";

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
                  isOutOfStock
                    ? "border-rose-400/80 dark:border-rose-500/40"
                    : isLowStock
                    ? "border-amber-300/80 dark:border-amber-500/30"
                    : "border-slate-200/80 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15]"
                } ${!ing.isAvailable ? "opacity-75" : ""}`}
              >
                {/* Parte Superior */}
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    {ing.imageUrl ? (
                      <img
                        src={ing.imageUrl}
                        alt={ing.name}
                        className="w-12 h-12 rounded-2xl object-cover border border-slate-200/80 dark:border-white/[0.08] shadow-2xs shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className={`w-12 h-12 rounded-2xl bg-linear-to-br border flex items-center justify-center font-black text-lg shadow-2xs shrink-0 ${avatarColorClass}`}
                      >
                        {initialChar}
                      </div>
                    )}

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
                            Inactivo
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-400">
                        {isSupply ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400">
                            <Boxes className="w-3 h-3" /> Insumo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            <Apple className="w-3 h-3" /> Ingrediente
                          </span>
                        )}
                        {ing.categoryName && <span>· {ing.categoryName}</span>}
                        {ing.sku && <span>· SKU: {ing.sku}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Stock Actual & Costo Unitario */}
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

                  {/* Alerta de Stock y Barra de Capacidad */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      {isOutOfStock ? (
                        <span className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Agotado (0 {ing.unit})</span>
                        </span>
                      ) : isLowStock ? (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Bajo (&le; {ing.minStock} {ing.unit})</span>
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

                    <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isOutOfStock ? "bg-rose-500" : isLowStock ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Valorización total */}
                  <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.04] flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Valorización en existencias:
                    </span>
                    <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                      {formatCOP(totalValuation)}
                    </span>
                  </div>
                </div>

                {/* Acciones del pie de la tarjeta */}
                <div className="p-3 border-t border-slate-100 dark:border-white/[0.04] bg-slate-50/60 dark:bg-white/[0.01] flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => setHistoryModalIngredient(ing)}
                    title="Historial de movimientos"
                    className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <History className="w-4 h-4 text-emerald-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingIngredient(ing);
                      setIsFormOpen(true);
                    }}
                    title="Editar material"
                    className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4 text-[#ED500A]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleAvailability(ing)}
                    disabled={togglingId === ing.id}
                    title={ing.isAvailable ? "Desactivar material" : "Activar material"}
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

                  <button
                    type="button"
                    onClick={() => handleRequestArchive(ing)}
                    title="Eliminar material"
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Paginador estándar de tarjetas */}
        {filteredIngredients.length > 0 && (
          <div className="p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16]">
            <Pagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              totalItems={filteredIngredients.length}
              pageSize={pageSize}
              pageSizeOptions={[12, 24, 48]}
              itemLabel="materiales"
              onPageChange={(page) => setCurrentPage(page)}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />
          </div>
        )}
      </div>
      )}

      {/* Modal Crear / Editar Material */}
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
        categories={categories}
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

      {/* Modal Importar Ingredientes e Insumos */}
      <IngredientImportModal
        businessId={businessId}
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => loadData()}
        locations={locations}
      />

      {/* Modal Confirmación Eliminar / Archivar con verificación de Recetas */}
      <ConfirmModal
        isOpen={Boolean(ingredientToArchive)}
        onClose={() => {
          setIngredientToArchive(null);
          setRecipesUsingIngredient([]);
        }}
        onConfirm={handleConfirmArchive}
        title={`¿Eliminar ${ingredientToArchive?.type === "supply" ? "este insumo" : "este ingrediente"}?`}
        description={
          recipesUsingIngredient.length > 0
            ? `ADVERTENCIA: Este material se encuentra vinculado a ${recipesUsingIngredient.length} receta(s) activa(s): ${recipesUsingIngredient.map((r) => `«${r.recipeName}»`).join(", ")}. Si lo eliminas, los costos y escandallos de preparación se verán afectados. ¿Deseas eliminarlo de todas formas?`
            : `«${ingredientToArchive?.name}» será retirado del catálogo activo de materiales y existencias.`
        }
        confirmText="Sí, eliminar material"
        cancelText="Conservar material"
        variant="danger"
        isLoading={isArchiving || isCheckingRecipes}
      />
    </div>
  );
}
