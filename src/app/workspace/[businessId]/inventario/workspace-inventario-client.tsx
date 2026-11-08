"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  Boxes,
  History,
  AlertTriangle,
  SlidersHorizontal,
  Plus,
  Package,
  DollarSign,
  Search,
  RotateCcw,
  Layers,
  CheckCircle2,
  XCircle,
  Eye,
  TrendingDown,
  Warehouse,
  ShoppingBag,
  ExternalLink,
  ChefHat,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Category, Product } from "@/lib/products/types";
import {
  Location,
  InventoryKPIs,
  InventoryStock,
  InventariableItem,
} from "@/lib/inventory/types";
import { RecipeWithDetails } from "@/lib/recipes/types";
import { InventoryHistoryTab } from "./inventory-history-tab";
import { InventoryLowStockTab } from "./inventory-low-stock-tab";
import { StockAdjustmentModal } from "./stock-adjustment-modal";
import { ItemDetailModal } from "./item-detail-modal";
import { MovementFormModal } from "./movement-form-modal";
import { SpoilageRecordsTab } from "./spoilage-records-tab";
import { SpoilageFormModal } from "./spoilage-form-modal";
import { getBusinessLocationsAction } from "./actions";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  businessId: string;
  initialLocations: Location[];
  categories: Category[];
  products?: Product[];
  initialKPIs?: InventoryKPIs | null;
  initialStock?: InventoryStock[];
  recipes?: RecipeWithDetails[];
}

export function WorkspaceInventarioClient({
  businessId,
  initialLocations,
  categories,
  products = [],
  initialKPIs,
  initialStock = [],
  recipes = [],
}: Props) {
  const router = useRouter();
  const [locations, setLocations] = useState<Location[]>(initialLocations);
  const [stockList, setStockList] = useState<InventoryStock[]>(initialStock);

  // Pestañas unificadas del inventario: EXISTENCIAS, STOCK BAJO, HISTORIAL, MERMAS
  const [activeTab, setActiveTab] = useState<"products" | "low_stock" | "history" | "wastes">("products");

  // Modales
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isSpoilageModalOpen, setIsSpoilageModalOpen] = useState(false);
  const [spoilageRefreshTrigger, setSpoilageRefreshTrigger] = useState(0);

  // Artículo seleccionado para acciones
  const [selectedItemForAction, setSelectedItemForAction] = useState<InventariableItem | null>(null);

  // Filtros de la pestaña EXISTENCIAS
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedItemType, setSelectedItemType] = useState<"all" | "direct" | "recipe" | "ingredient">("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock" | "pending_recipe">("all");

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const handleRefresh = async () => {
    const res = await getBusinessLocationsAction(businessId);
    if (res.success && res.data) {
      setLocations(res.data);
    }
    router.refresh();
  };

  // Mapa de stock consolidado por producto desde inventory_stock
  const stockByProduct = useMemo(() => {
    const map = new Map<string, { totalQuantity: number; minStock: number; cost: number }>();

    for (const s of stockList) {
      const existing = map.get(s.productId);
      const qty = Number(s.quantity || 0);
      const min = Number(s.minStock || 0);
      const c = Number(s.cost || 0);

      if (existing) {
        existing.totalQuantity += qty;
        existing.minStock = Math.max(existing.minStock, min);
        if (c > 0) existing.cost = c;
      } else {
        map.set(s.productId, {
          totalQuantity: qty,
          minStock: min,
          cost: c,
        });
      }
    }

    return map;
  }, [stockList]);

  // Mapa de recetas activas indexadas por productId
  const recipesByProduct = useMemo(() => {
    const map = new Map<string, RecipeWithDetails>();
    for (const r of recipes) {
      if (!r.productId) continue;
      if (r.status === "active") {
        map.set(r.productId, r);
      } else if (!map.has(r.productId)) {
        map.set(r.productId, r);
      }
    }
    return map;
  }, [recipes]);

  // Lista unificada y filtrada de ARTÍCULOS INVENTARIABLES [TAREA-03]:
  // A. Productos con existencias directas (track_stock === true y product_type !== 'service')
  // B. Productos preparados o elaborados (hamburguesas, salchipapas, pizzas) con cálculo
  //    dinámico de disponibilidad a partir de las existencias de sus ingredientes en recetas.
  // C. Insumos e ingredientes inventariables (product_type === 'ingredient')
  // EXCLUSIÓN ESTRICTA: Solo servicios puros sin existencias (product_type === 'service').
  const inventariableItems = useMemo<InventariableItem[]>(() => {
    return products
      .filter((prod) => {
        const meta = (prod.metadata || {}) as Record<string, any>;
        if (meta.product_type === "service") return false;
        return true;
      })
      .map((prod) => {
        const meta = (prod.metadata || {}) as Record<string, any>;
        const cat = categories.find((c) => c.id === prod.category_id);
        const variants = Array.isArray(meta.variants) ? meta.variants : [];
        const hasVariants = Boolean(meta.has_variants || variants.length > 0);

        const isIngredient = meta.product_type === "ingredient";
        const recipe = recipesByProduct.get(prod.id);
        const isPrepared =
          meta.product_type === "prepared" ||
          Boolean(meta.has_recipe) ||
          Boolean(recipe) ||
          (!meta.track_stock && !isIngredient);

        const controlType =
          (isPrepared || Boolean(recipe)) && !isIngredient ? ("recipe" as const) : ("direct" as const);

        const stockData = stockByProduct.get(prod.id);
        const price = Number(prod.price || 0);

        if (controlType === "recipe") {
          // ==========================================
          // CASO B: PRODUCTO PREPARADO / ELABORADO
          // ==========================================
          const recipeIngredients = recipe?.ingredients?.map((ing) => {
            const requiredPerPortion =
              ing.requiredPerPortion ??
              (recipe.portions > 0 ? ing.quantity / recipe.portions : ing.quantity);
            const availablePortions =
              ing.availablePortions ??
              (requiredPerPortion > 0 ? Math.floor(ing.stockQuantity / requiredPerPortion) : 0);
            const isLimiting = Boolean(
              recipe.limitingIngredient && recipe.limitingIngredient.ingredientId === ing.ingredientId
            );
            return {
              ingredientId: ing.ingredientId,
              ingredientName: ing.ingredientName,
              quantity: ing.quantity,
              unit: ing.unit,
              stockQuantity: ing.stockQuantity,
              requiredPerPortion,
              availablePortions,
              isLimiting,
            };
          });

          const hasRecipeConfigured = Boolean(recipe);
          const portionsAvailable = hasRecipeConfigured
            ? recipe!.portionsAvailable ?? 0
            : null;

          let status: InventariableItem["status"] = "in_stock";
          if (!hasRecipeConfigured) {
            status = "pending_recipe";
          } else if (portionsAvailable! <= 0) {
            status = "out_of_stock";
          } else if (portionsAvailable! <= 5) {
            status = "low_stock";
          }

          const unit = meta.unit || "porción";
          const cost = recipe?.costPerPortion ?? Number(meta.cost ?? 0);

          return {
            id: prod.id,
            name: prod.name,
            itemType: "product",
            controlType: "recipe",
            categoryId: prod.category_id,
            categoryName: cat?.name || null,
            sku: meta.sku || null,
            barcode: meta.barcode || null,
            imageUrl: prod.image_url || null,
            unit,
            currentStock: portionsAvailable ?? 0,
            minStock: 0,
            cost,
            price,
            totalValue: 0, // No genera valorización física terminada (evita doble conteo)
            status,
            hasVariants,
            variants,
            trackStock: false,
            isAvailable: Boolean(prod.is_available),
            updatedAt: prod.updated_at,
            recipeId: recipe?.id || null,
            recipeName: recipe?.name || null,
            recipeStatus: (recipe?.status as any) || "none",
            portionsAvailable,
            exactPortionsAvailable: recipe?.exactPortionsAvailable ?? null,
            limitingIngredient: recipe?.limitingIngredient || null,
            recipeIngredients,
          };
        } else {
          // ==========================================
          // CASO A: PRODUCTOS DIRECTOS E INSUMOS
          // ==========================================
          const currentStock = stockData ? stockData.totalQuantity : Number(meta.stock_quantity ?? 0);
          const minStock = stockData ? stockData.minStock : Number(meta.min_stock ?? 0);
          const cost = stockData && stockData.cost > 0 ? stockData.cost : Number(meta.cost ?? 0);
          const totalValue = currentStock > 0 && cost > 0 ? Number((currentStock * cost).toFixed(2)) : 0;

          let status: InventariableItem["status"] = "in_stock";
          if (currentStock <= 0) {
            status = "out_of_stock";
          } else if (minStock > 0 && currentStock <= minStock) {
            status = "low_stock";
          }

          const unit = meta.unit || (isIngredient ? "kg" : "un");

          return {
            id: prod.id,
            name: prod.name,
            itemType: isIngredient ? "ingredient" : "product",
            controlType: "direct",
            categoryId: prod.category_id,
            categoryName: cat?.name || null,
            sku: meta.sku || null,
            barcode: meta.barcode || null,
            imageUrl: prod.image_url || null,
            unit,
            currentStock,
            minStock,
            cost,
            price,
            totalValue,
            status,
            hasVariants,
            variants,
            trackStock: true,
            isAvailable: Boolean(prod.is_available),
            updatedAt: prod.updated_at,
          };
        }
      });
  }, [products, categories, stockByProduct, recipesByProduct]);

  // KPIs calculados estrictamente sobre artículos inventariables
  const kpis = useMemo(() => {
    let inStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalCostValue = 0;

    for (const item of inventariableItems) {
      totalCostValue += item.totalValue;
      if (item.status === "out_of_stock") {
        outOfStockCount++;
      } else if (item.status === "low_stock") {
        lowStockCount++;
      } else if (item.status === "in_stock") {
        inStockCount++;
      }
    }

    return {
      totalItems: inventariableItems.length,
      inStockCount,
      lowStockCount,
      outOfStockCount,
      totalCostValue: Number(totalCostValue.toFixed(2)),
      todayMovementsCount: initialKPIs?.todayMovementsCount || 0,
    };
  }, [inventariableItems, initialKPIs]);

  // Filtrado reactivo de la tabla de existencias
  const filteredItems = useMemo(() => {
    return inventariableItems.filter((item) => {
      // 1. Búsqueda por texto (Nombre / SKU / Código / Variante / Ingrediente limitante)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesSku = item.sku ? item.sku.toLowerCase().includes(q) : false;
        const matchesBarcode = item.barcode ? item.barcode.toLowerCase().includes(q) : false;
        const matchesVariant = item.variants.some((v: any) => v.name?.toLowerCase().includes(q));
        const matchesLimiting = item.limitingIngredient?.name?.toLowerCase().includes(q);

        if (!matchesName && !matchesSku && !matchesBarcode && !matchesVariant && !matchesLimiting) {
          return false;
        }
      }

      // 2. Filtro por Categoría
      if (selectedCategory !== "all") {
        if (item.categoryId !== selectedCategory) {
          return false;
        }
      }

      // 3. Filtro por Tipo de Control / Modalidad
      if (selectedItemType !== "all") {
        if (selectedItemType === "direct" && item.controlType !== "direct") {
          return false;
        }
        if (selectedItemType === "recipe" && item.controlType !== "recipe") {
          return false;
        }
        if (selectedItemType === "ingredient" && item.itemType !== "ingredient") {
          return false;
        }
      }

      // 4. Filtro por Estado
      if (selectedStatus !== "all") {
        if (item.status !== selectedStatus) {
          return false;
        }
      }

      return true;
    });
  }, [inventariableItems, searchQuery, selectedCategory, selectedItemType, selectedStatus]);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    selectedCategory !== "all" ||
    selectedItemType !== "all" ||
    selectedStatus !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedItemType("all");
    setSelectedStatus("all");
    setCurrentPage(1);
  };

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + pageSize);

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* 1. KPIS SUPERIORES CALCULADOS CON DATOS REALES (NORMALIZADOS) */}
      <KpiGrid cols={5}>
        <KpiCard
          title="Total artículos"
          value={kpis.totalItems}
          subtext="Con control de stock"
          icon={<Boxes className="w-5 h-5" />}
          variant="blue"
        />
        <KpiCard
          title="Disponibles"
          value={kpis.inStockCount}
          subtext="Existencias suficientes"
          icon={<CheckCircle2 className="w-5 h-5" />}
          variant="emerald"
        />
        <KpiCard
          title="Stock bajo"
          value={kpis.lowStockCount}
          subtext="Por reabastecer"
          icon={<AlertTriangle className="w-5 h-5" />}
          variant={kpis.lowStockCount > 0 ? "amber" : "default"}
          onClick={() => setActiveTab("low_stock")}
          className="cursor-pointer hover:border-amber-400"
        />
        <KpiCard
          title="Agotados"
          value={kpis.outOfStockCount}
          subtext="0 unidades físicas"
          icon={<XCircle className="w-5 h-5" />}
          variant={kpis.outOfStockCount > 0 ? "red" : "default"}
        />
        <KpiCard
          title="Valor al costo"
          value={formatCOP(kpis.totalCostValue)}
          subtext="Valorizado total en almacén"
          icon={<DollarSign className="w-5 h-5" />}
          variant="emerald"
        />
      </KpiGrid>

      {/* 2. PESTAÑAS Y ACCIONES DEL MÓDULO (ESTILO PRODUCTOS) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200/80 dark:border-white/[0.08] pb-1">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab("products")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 cursor-pointer ${
              activeTab === "products"
                ? "bg-[#ED500A]/10 text-[#ED500A] dark:bg-[#ED500A]/20 font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.02]"
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Existencias</span>
            <span className="ml-1 text-2xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 font-bold">
              {inventariableItems.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("low_stock")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 cursor-pointer ${
              activeTab === "low_stock"
                ? "bg-[#ED500A]/10 text-[#ED500A] dark:bg-[#ED500A]/20 font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.02]"
            }`}
          >
            <AlertTriangle className={`w-4 h-4 ${activeTab === "low_stock" ? "text-[#ED500A]" : "text-amber-500"}`} />
            <span>Stock bajo</span>
            {kpis.lowStockCount > 0 && (
              <span className="ml-1 text-2xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/20">
                {kpis.lowStockCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 cursor-pointer ${
              activeTab === "history"
                ? "bg-[#ED500A]/10 text-[#ED500A] dark:bg-[#ED500A]/20 font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.02]"
            }`}
          >
            <History className="w-4 h-4" />
            <span>Historial</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("wastes")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 cursor-pointer ${
              activeTab === "wastes"
                ? "bg-[#ED500A]/10 text-[#ED500A] dark:bg-[#ED500A]/20 font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.02]"
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            <span>Mermas</span>
          </button>
        </div>

        {/* Botón principal: Ajuste manual, Mermas y enlace contextual a Compras */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSpoilageModalOpen(true)}
            className="text-rose-700 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/10"
            title="Registrar merma o desperdicio de existencias"
          >
            <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>Registrar merma</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            href={`/workspace/${businessId}/compras`}
            title="Ir al módulo de Compras para registrar abastecimiento formal con proveedor"
          >
            <ShoppingBag className="w-4 h-4 text-[#ED500A]" />
            <span>Registrar abastecimiento</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setSelectedItemForAction(null);
              setIsAdjustmentModalOpen(true);
            }}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Ajuste manual</span>
          </Button>
        </div>
      </div>

      {/* 3. CONTENIDO DE LA PESTAÑA ACTIVA */}
      {activeTab === "products" ? (
        <div className="space-y-4">
          {/* BARRA DE FILTROS: Búsqueda, Categoría, Tipo de artículo y Estado de existencias */}
          <div className="p-3.5 sm:p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs flex flex-wrap items-center gap-3">
            {/* Búsqueda por texto */}
            <div className="flex-1 min-w-[200px] sm:min-w-[260px]">
              <SearchInput
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                onClear={() => {
                  setSearchQuery("");
                  setCurrentPage(1);
                }}
                placeholder="Buscar por nombre, SKU o código de barras..."
              />
            </div>

            {/* Filtro Tipo de Artículo */}
            <Select
              value={selectedItemType}
              onChange={(e) => {
                setSelectedItemType(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-auto min-w-[170px]"
            >
              <option value="all">Todos los tipos</option>
              <option value="direct">Control directo (físico)</option>
              <option value="recipe">Por receta (elaborados)</option>
              <option value="ingredient">Insumos e ingredientes</option>
            </Select>

            {/* Filtro Categoría */}
            <Select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="w-auto min-w-[170px]"
            >
              <option value="all">Todas las categorías</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>

            {/* Filtro Estado */}
            <Select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-auto min-w-[160px]"
            >
              <option value="all">Todos los estados</option>
              <option value="in_stock">Disponible</option>
              <option value="low_stock">Stock bajo</option>
              <option value="out_of_stock">Agotado</option>
              <option value="pending_recipe">Receta pendiente</option>
            </Select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar filtros</span>
              </button>
            )}
          </div>

          {/* TABLA DE EXISTENCIAS:
              Artículo | Categoría | Tipo de control | Existencias / Disp. | Estado | Costo unitario | Valor total | Acciones */}
          <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs min-w-[980px]">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-4 px-5 min-w-[260px] whitespace-nowrap">Artículo</th>
                    <th className="py-4 px-4 min-w-[140px] whitespace-nowrap">Categoría</th>
                    <th className="py-4 px-4 text-center min-w-[150px] whitespace-nowrap">Tipo de control</th>
                    <th className="py-4 px-4 text-right min-w-[180px] whitespace-nowrap">Existencias / Disponibilidad</th>
                    <th className="py-4 px-4 text-center min-w-[140px] whitespace-nowrap">Estado</th>
                    <th className="py-4 px-4 text-right min-w-[130px] whitespace-nowrap">Costo unitario</th>
                    <th className="py-4 px-5 text-right min-w-[130px] whitespace-nowrap">Valor total</th>
                    <th className="py-4 px-5 text-center min-w-[150px] whitespace-nowrap">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                  {paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-14 text-center">
                        <div className="max-w-md mx-auto space-y-2.5">
                          <Package className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                          <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                            {hasActiveFilters
                              ? "No hay artículos que coincidan con los filtros"
                              : "No tienes productos o insumos registrados en inventario"}
                          </h4>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            {hasActiveFilters
                              ? "Prueba a cambiar los criterios de búsqueda, tipo de control o estado."
                              : "Los productos con existencias físicas y los platos preparados aparecen automáticamente en este inventario."}
                          </p>
                          {!hasActiveFilters && (
                            <div className="pt-2">
                              <Link
                                href={`/workspace/${businessId}/productos`}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#ED500A] bg-[#ED500A]/10 hover:bg-[#ED500A]/20 transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Ir a Catálogo de Productos</span>
                              </Link>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedItems.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors"
                      >
                        {/* 1. Artículo */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-11 h-11 rounded-2xl object-cover border border-slate-200/80 dark:border-white/[0.08] shrink-0"
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] flex items-center justify-center shrink-0 text-slate-400">
                                {item.controlType === "recipe" ? (
                                  <ChefHat className="w-5 h-5 text-purple-400" />
                                ) : (
                                  <Package className="w-5 h-5" />
                                )}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                  {item.name}
                                </span>
                                <Badge
                                  size="sm"
                                  variant={item.itemType === "ingredient" ? "emerald" : "slate"}
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {item.itemType === "ingredient" ? "Insumo" : "Producto"}
                                </Badge>
                              </div>
                              {item.sku ? (
                                <span className="text-[11px] font-mono font-semibold text-slate-400 block truncate mt-0.5">
                                  SKU: {item.sku}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic block mt-0.5">
                                  Sin SKU
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. Categoría */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          {item.categoryName ? (
                            <Badge size="sm" variant="slate" className="px-2.5 py-1 text-xs font-medium whitespace-nowrap">
                              {item.categoryName}
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              Sin categoría
                            </span>
                          )}
                        </td>

                        {/* 3. Tipo de control */}
                        <td className="py-4 px-4 text-center whitespace-nowrap">
                          {item.controlType === "recipe" ? (
                            <Badge
                              size="sm"
                              variant="purple"
                              icon={<ChefHat className="w-3.5 h-3.5 text-purple-500 shrink-0" />}
                              className="px-3 py-1 text-xs font-semibold whitespace-nowrap"
                            >
                              Por receta
                            </Badge>
                          ) : (
                            <Badge
                              size="sm"
                              variant="blue"
                              icon={<Package className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                              className="px-3 py-1 text-xs font-semibold whitespace-nowrap"
                            >
                              Directo
                            </Badge>
                          )}
                        </td>

                        {/* 4. Existencias / Disponibilidad calculada */}
                        <td className="py-4 px-4 text-right">
                          {item.controlType === "direct" ? (
                            <div>
                              <span className="font-mono font-bold text-sm text-slate-900 dark:text-white block whitespace-nowrap">
                                {item.currentStock} {item.unit}
                              </span>
                              <span className="text-[11px] text-slate-400 block mt-0.5 whitespace-nowrap">
                                {item.minStock > 0 ? `Mínimo: ${item.minStock} ${item.unit}` : "Sin mínimo"}
                              </span>
                            </div>
                          ) : item.recipeStatus !== "none" ? (
                            <div>
                              <span
                                className={`font-mono font-bold text-sm block whitespace-nowrap ${
                                  (item.portionsAvailable ?? 0) > 0
                                    ? "text-purple-600 dark:text-purple-400"
                                    : "text-rose-600 dark:text-rose-400"
                                }`}
                              >
                                {item.portionsAvailable} porciones disp.
                              </span>
                              {item.limitingIngredient ? (
                                <span
                                  className="text-[11px] text-amber-600 dark:text-amber-400 block mt-0.5 truncate max-w-[180px] ml-auto"
                                  title={`Cuello de botella: ${item.limitingIngredient.name} (${item.limitingIngredient.availablePortions} un.)`}
                                >
                                  Limitado: {item.limitingIngredient.name}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400 block mt-0.5 whitespace-nowrap">
                                  Insumos suficientes
                                </span>
                              )}
                            </div>
                          ) : (
                            <div>
                              <span className="font-mono text-sm text-slate-400 italic block whitespace-nowrap">—</span>
                              <span className="text-[11px] text-amber-600/90 dark:text-amber-400/90 block mt-0.5 font-medium whitespace-nowrap">
                                Sin receta configurada
                              </span>
                            </div>
                          )}
                        </td>

                        {/* 5. Estado */}
                        <td className="py-4 px-4 text-center whitespace-nowrap">
                          {item.status === "pending_recipe" ? (
                            <Badge size="sm" variant="slate" dot className="px-3 py-1 text-xs text-amber-700 dark:text-amber-300 border-amber-500/20 bg-amber-500/10 font-semibold whitespace-nowrap">
                              Receta pendiente
                            </Badge>
                          ) : (
                            <Badge
                              size="sm"
                              variant={
                                item.status === "out_of_stock"
                                  ? "red"
                                  : item.status === "low_stock"
                                  ? "amber"
                                  : "emerald"
                              }
                              dot
                              className="px-3 py-1 text-xs font-semibold whitespace-nowrap"
                            >
                              {item.status === "out_of_stock"
                                ? "Agotado"
                                : item.status === "low_stock"
                                ? "Stock bajo"
                                : "Disponible"}
                            </Badge>
                          )}
                        </td>

                        {/* 6. Costo unitario */}
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                            {item.cost > 0 ? formatCOP(item.cost) : "—"}
                          </span>
                          {item.controlType === "recipe" && item.cost > 0 && (
                            <span className="text-[10px] text-slate-400 block mt-0.5">p/porción</span>
                          )}
                        </td>

                        {/* 7. Valor total */}
                        <td className="py-4 px-5 text-right whitespace-nowrap">
                          {item.controlType === "direct" && item.totalValue > 0 ? (
                            <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 block">
                              {formatCOP(item.totalValue)}
                            </span>
                          ) : item.controlType === "recipe" ? (
                            <span
                              className="text-[11px] text-slate-400 italic block"
                              title="El costo de los ingredientes ya se computa en las existencias físicas del almacén"
                            >
                              En insumos
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-slate-400 block">—</span>
                          )}
                        </td>

                        {/* 8. Acciones: Ajustar / Receta y Detalle */}
                        <td className="py-4 px-5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            {item.controlType === "direct" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedItemForAction(item);
                                  setIsAdjustmentModalOpen(true);
                                }}
                                className="px-3 py-1.5 text-xs font-semibold text-[#ED500A] border-orange-500/20 hover:bg-orange-500/10 transition-colors"
                                title="Ajustar existencia física"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                <span>Ajustar</span>
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                href={`/workspace/${businessId}/recetas`}
                                className="px-3 py-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 border-purple-500/20 hover:bg-purple-500/10 transition-colors"
                                title="Ver o configurar receta"
                              >
                                <ChefHat className="w-3.5 h-3.5 text-purple-500" />
                                <span>{item.recipeId ? "Receta" : "Configurar"}</span>
                              </Button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedItemForAction(item);
                                setIsDetailModalOpen(true);
                              }}
                              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-xl transition-colors cursor-pointer"
                              title="Ver ficha técnica y desglose"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {filteredItems.length > 0 && (
              <div className="border-t border-slate-200/80 dark:border-white/[0.08]">
                <Pagination
                  currentPage={safeCurrentPage}
                  totalPages={totalPages}
                  totalItems={filteredItems.length}
                  currentCount={Math.min(pageSize, filteredItems.length - startIndex)}
                  pageSize={pageSize}
                  itemLabel="artículos"
                  onPageChange={(pg) => setCurrentPage(pg)}
                  onPageSizeChange={(newSize) => {
                    setPageSize(newSize);
                    setCurrentPage(1);
                  }}
                  pageSizeOptions={[10, 20, 50, 100]}
                  showFirstLast
                />
              </div>
            )}
          </div>
        </div>
      ) : activeTab === "low_stock" ? (
        <InventoryLowStockTab
          businessId={businessId}
          onRestockMovement={(lowStockItem) => {
            const found = inventariableItems.find((it) => it.id === lowStockItem.productId);
            if (found) {
              setSelectedItemForAction(found);
              setIsAdjustmentModalOpen(true);
            }
          }}
        />
      ) : activeTab === "history" ? (
        <InventoryHistoryTab
          businessId={businessId}
          locations={locations}
          onOpenMovementModal={() => {
            setSelectedItemForAction(null);
            setIsAdjustmentModalOpen(true);
          }}
        />
      ) : (
        <SpoilageRecordsTab
          businessId={businessId}
          items={inventariableItems}
          onOpenCreateModal={() => setIsSpoilageModalOpen(true)}
          refreshTrigger={spoilageRefreshTrigger}
          onStockChanged={handleRefresh}
        />
      )}

      {/* Modal de Ajuste Manual de Inventario [TAREA-03] */}
      <StockAdjustmentModal
        isOpen={isAdjustmentModalOpen}
        onClose={() => {
          setIsAdjustmentModalOpen(false);
          setSelectedItemForAction(null);
        }}
        businessId={businessId}
        items={inventariableItems}
        initialItem={selectedItemForAction}
        onSuccess={handleRefresh}
      />

      {/* Modal de Detalle de Artículo [TAREA-03] */}
      <ItemDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedItemForAction(null);
        }}
        businessId={businessId}
        item={selectedItemForAction}
        onOpenAdjustment={(item) => {
          setSelectedItemForAction(item);
          setIsAdjustmentModalOpen(true);
        }}
        onMinStockUpdated={(productId, newMin) => {
          setStockList((prev) =>
            prev.map((s) => (s.productId === productId ? { ...s, minStock: newMin } : s))
          );
          handleRefresh();
        }}
      />

      {/* Modal de Movimiento de Inventario General */}
      <MovementFormModal
        businessId={businessId}
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        onSuccess={handleRefresh}
        locations={locations}
      />

      {/* Modal de Registro de Mermas [TAREA-08] */}
      <SpoilageFormModal
        businessId={businessId}
        isOpen={isSpoilageModalOpen}
        onClose={() => setIsSpoilageModalOpen(false)}
        onSuccess={() => {
          setSpoilageRefreshTrigger((prev) => prev + 1);
          handleRefresh();
        }}
        items={inventariableItems}
      />
    </div>
  );
}
