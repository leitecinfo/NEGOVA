"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  Boxes,
  MapPin,
  Warehouse,
  History,
  AlertTriangle,
  SlidersHorizontal,
  Plus,
  ArrowRightLeft,
  ShoppingCart,
  Package,
  DollarSign,
  Activity,
  Search,
  X,
  Filter,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  Layers,
  ArrowUpDown,
  Tag,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Category, Product } from "@/lib/products/types";
import { Location, InventoryKPIs, InventoryStock } from "@/lib/inventory/types";
import { InventoryHistoryTab } from "./inventory-history-tab";
import { InventoryLowStockTab } from "./inventory-low-stock-tab";
import { InventoryPurchasesTab } from "../compras/inventory-purchases-tab";
import { MovementFormModal } from "./movement-form-modal";
import { TransferFormModal } from "./transfer-form-modal";
import { PurchaseFormModal } from "../compras/purchase-form-modal";
import { getInventoryLocationsAction } from "../productos/inventory-actions";
import { useRouter } from "next/navigation";

interface Props {
  businessId: string;
  initialLocations: Location[];
  categories: Category[];
  products?: Product[];
  initialKPIs?: InventoryKPIs | null;
  initialStock?: InventoryStock[];
}

export function WorkspaceInventarioClient({
  businessId,
  initialLocations,
  categories,
  products = [],
  initialKPIs,
  initialStock = [],
}: Props) {
  const router = useRouter();
  const [locations, setLocations] = useState<Location[]>(initialLocations);
  const [stockList, setStockList] = useState<InventoryStock[]>(initialStock);

  // Pestañas solicitadas: PRODUCTOS, COMPRAS, HISTORIAL, STOCK BAJO
  const [activeTab, setActiveTab] = useState<"products" | "purchases" | "history" | "low_stock">("products");

  // Modales
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [selectedProductForMovement, setSelectedProductForMovement] = useState<string | undefined>(undefined);
  const [selectedProductForPurchase, setSelectedProductForPurchase] = useState<string | null>(null);

  // Filtros de la pestaña PRODUCTOS
  const [searchName, setSearchName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState<
    "all" | "in_stock" | "low_stock" | "out_of_stock" | "active" | "inactive"
  >("all");

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const handleRefreshLocations = async () => {
    const res = await getInventoryLocationsAction(businessId);
    if (res.success && res.data) {
      setLocations(res.data);
    }
  };

  // Mapa de stock consolidado por producto
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

  // Lista enriquecida de productos comerciales
  const enrichedProducts = useMemo(() => {
    return products.map((prod) => {
      const meta = (prod.metadata || {}) as Record<string, any>;
      const cat = categories.find((c) => c.id === prod.category_id);
      const variants = Array.isArray(meta.variants) ? meta.variants : [];
      const hasVariants = Boolean(meta.has_variants || variants.length > 0);

      const stockData = stockByProduct.get(prod.id);
      const totalStock = stockData ? stockData.totalQuantity : Number(meta.stock_quantity ?? 0);
      const minStock = stockData ? stockData.minStock : Number(meta.min_stock ?? 0);
      const cost = stockData && stockData.cost > 0 ? stockData.cost : Number(meta.cost ?? meta.average_cost ?? 0);
      const isLowStock = totalStock <= minStock;
      const isOutOfStock = totalStock <= 0;

      // Calcular precio de variantes si aplica
      const minVariantPrice = hasVariants && variants.length > 0
        ? Math.min(...variants.map((v: any) => Number(v.price) || 0))
        : null;

      return {
        ...prod,
        category: cat,
        meta,
        totalStock,
        minStock,
        cost,
        hasVariants,
        variants,
        minVariantPrice,
        isLowStock,
        isOutOfStock,
      };
    });
  }, [products, categories, stockByProduct]);

  // KPIs Superiores: Total productos, Stock bajo, Valor al costo, Movimientos hoy
  const kpis = useMemo(() => {
    if (initialKPIs) return initialKPIs;

    let totalProducts = enrichedProducts.length;
    let lowStockCount = 0;
    let totalCostValue = 0;

    for (const p of enrichedProducts) {
      if (p.isLowStock) {
        lowStockCount++;
      }
      totalCostValue += p.totalStock * p.cost;
    }

    return {
      totalProducts,
      lowStockCount,
      totalCostValue,
      todayMovementsCount: 0,
    };
  }, [initialKPIs, enrichedProducts]);

  // Filtrado reactivo de productos
  const filteredProducts = useMemo(() => {
    return enrichedProducts.filter((p) => {
      // 1. Filtro por Nombre / SKU / Código
      if (searchName.trim()) {
        const q = searchName.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesSku = p.meta.sku ? String(p.meta.sku).toLowerCase().includes(q) : false;
        const matchesBarcode = p.meta.barcode ? String(p.meta.barcode).toLowerCase().includes(q) : false;
        const matchesVariant = p.variants.some((v: any) => v.name?.toLowerCase().includes(q));

        if (!matchesName && !matchesSku && !matchesBarcode && !matchesVariant) {
          return false;
        }
      }

      // 2. Filtro por Categoría
      if (selectedCategory !== "all") {
        if (p.category_id !== selectedCategory) {
          return false;
        }
      }

      // 3. Filtro por Estado
      if (selectedStatus === "in_stock") {
        if (p.totalStock <= p.minStock) return false;
      } else if (selectedStatus === "low_stock") {
        if (p.totalStock > p.minStock || p.totalStock <= 0) return false;
      } else if (selectedStatus === "out_of_stock") {
        if (p.totalStock > 0) return false;
      } else if (selectedStatus === "active") {
        if (!p.is_available) return false;
      } else if (selectedStatus === "inactive") {
        if (p.is_available) return false;
      }

      return true;
    });
  }, [enrichedProducts, searchName, selectedCategory, selectedStatus]);

  const hasActiveFilters =
    searchName.trim() !== "" ||
    selectedCategory !== "all" ||
    selectedStatus !== "all";

  const clearFilters = () => {
    setSearchName("");
    setSelectedCategory("all");
    setSelectedStatus("all");
    setCurrentPage(1);
  };

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + pageSize);

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* 1. KPIS SUPERIORES */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Productos */}
        <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
              Total productos
            </span>
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 block">
              {kpis.totalProducts}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              En catálogo comercial
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
        </div>

        {/* Stock Bajo */}
        <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
              Stock bajo
            </span>
            <span
              className={`text-2xl font-bold font-mono mt-1 block ${
                kpis.lowStockCount > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-slate-900 dark:text-white"
              }`}
            >
              {kpis.lowStockCount}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Por debajo del umbral mínimo
            </span>
          </div>
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              kpis.lowStockCount > 0
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "bg-slate-100 dark:bg-white/[0.04] text-slate-400"
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Valor al Costo */}
        <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
              Valor al costo
            </span>
            <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">
              {formatCOP(kpis.totalCostValue)}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Valorizado total en almacén
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Movimientos Hoy */}
        <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
              Movimientos hoy
            </span>
            <span className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1 block">
              {kpis.todayMovementsCount}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Entradas, salidas y ajustes
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. NAVEGACIÓN POR PESTAÑAS Y ACCIONES GLOBALES */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200/80 dark:border-white/[0.08] pb-2">
        {/* Pestañas: PRODUCTOS, COMPRAS, HISTORIAL, STOCK BAJO */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("products")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
              activeTab === "products"
                ? "bg-[#ED500A]/10 text-[#ED500A] dark:bg-[#ED500A]/20"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Boxes className="w-4 h-4 text-[#ED500A]" />
            <span>PRODUCTOS</span>
            <span className="ml-1 text-2xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 font-bold">
              {filteredProducts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("purchases")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
              activeTab === "purchases"
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <ShoppingCart className="w-4 h-4 text-blue-500" />
            <span>COMPRAS</span>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
              activeTab === "history"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <History className="w-4 h-4 text-emerald-500" />
            <span>HISTORIAL</span>
          </button>

          <button
            onClick={() => setActiveTab("low_stock")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
              activeTab === "low_stock"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>STOCK BAJO</span>
            {kpis.lowStockCount > 0 && (
              <span className="ml-1 text-2xs px-1.5 py-0.5 rounded-full bg-amber-500 text-white font-bold">
                {kpis.lowStockCount}
              </span>
            )}
          </button>
        </div>

        {/* Acciones de inventario: Transferencias y Nuevo movimiento */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            onClick={() => setIsTransferModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold border border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 transition-all cursor-pointer"
            title="Transferir existencias entre dos ubicaciones"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span className="hidden sm:inline">Transferencias</span>
          </button>

          <button
            onClick={() => {
              setSelectedProductForMovement(undefined);
              setIsMovementModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nuevo movimiento</span>
          </button>
        </div>
      </div>

      {/* 3. CONTENIDO DE LA PESTAÑA ACTIVA */}
      {activeTab === "products" ? (
        <div className="space-y-4">
          {/* BARRA DE FILTROS: NOMBRE, CATEGORÍA, ESTADO */}
          <div className="p-3.5 sm:p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs flex flex-wrap items-center gap-3">
            {/* Filtro Nombre / Búsqueda */}
            <div className="relative flex-1 min-w-[200px] sm:min-w-[280px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchName}
                onChange={(e) => {
                  setSearchName(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Filtrar por nombre, SKU o variante..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]"
              />
              {searchName && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchName("");
                    setCurrentPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filtro Categoría */}
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 rounded-xl text-xs focus:outline-hidden cursor-pointer"
            >
              <option value="all">Todas las categorías ({enrichedProducts.length})</option>
              {categories.map((cat) => {
                const count = enrichedProducts.filter((p) => p.category_id === cat.id).length;
                return (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({count})
                  </option>
                );
              })}
            </select>

            {/* Filtro Estado */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 rounded-xl text-xs focus:outline-hidden cursor-pointer"
            >
              <option value="all">Todos los estados</option>
              <option value="in_stock">En stock (&gt; Mínimo)</option>
              <option value="low_stock">Stock bajo (&le; Mínimo)</option>
              <option value="out_of_stock">Agotado (0 unidades)</option>
              <option value="active">Activos para venta</option>
              <option value="inactive">Inactivos / Pausados</option>
            </select>

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

          {/* TABLA DE PRODUCTOS: Producto, Categoría, Stock total, Variantes, Mínimo, Costo, Precio de venta, Estado */}
          <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 min-w-[200px]">Producto</th>
                    <th className="py-3 px-3">Categoría</th>
                    <th className="py-3 px-3 text-right">Stock total</th>
                    <th className="py-3 px-3">Variantes</th>
                    <th className="py-3 px-3 text-right">Mínimo</th>
                    <th className="py-3 px-3 text-right">Costo</th>
                    <th className="py-3 px-4 text-right">Precio de venta</th>
                    <th className="py-3 px-3 text-center">Estado</th>
                    <th className="py-3 px-3 text-center w-24">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                  {paginatedProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center">
                        <div className="max-w-xs mx-auto space-y-2">
                          <Package className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            No se encontraron productos
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {hasActiveFilters
                              ? "Prueba a cambiar los filtros o limpiar la búsqueda."
                              : "No tienes productos en el catálogo comercial."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedProducts.map((product) => {
                      const displayPrice = product.hasVariants && product.minVariantPrice !== null
                        ? `Desde ${formatCOP(product.minVariantPrice)}`
                        : formatCOP(product.price);

                      return (
                        <tr
                          key={product.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors"
                        >
                          {/* 1. Producto */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              {product.image_url ? (
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  className="w-9 h-9 rounded-xl object-cover border border-slate-200/80 dark:border-white/[0.08] shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] flex items-center justify-center shrink-0 text-slate-400">
                                  <Package className="w-4 h-4" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                                  {product.name}
                                </span>
                                {product.meta.sku ? (
                                  <span className="text-[10px] font-mono font-semibold text-slate-400 block truncate">
                                    SKU: {product.meta.sku}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic block">
                                    Sin SKU
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 2. Categoría */}
                          <td className="py-3 px-3">
                            {product.category ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300">
                                {product.category.name}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">
                                Sin categoría
                              </span>
                            )}
                          </td>

                          {/* 3. Stock total */}
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                                {product.totalStock}
                              </span>
                              {product.isOutOfStock ? (
                                <span
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                  title="Agotado: 0 unidades disponibles"
                                >
                                  Agotado
                                </span>
                              ) : product.isLowStock ? (
                                <span
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                  title="Stock bajo: por debajo del mínimo"
                                >
                                  ⚠️ Bajo
                                </span>
                              ) : null}
                            </div>
                          </td>

                          {/* 4. Variantes */}
                          <td className="py-3 px-3">
                            {product.hasVariants ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20"
                                title={product.variants.map((v: any) => v.name).join(", ")}
                              >
                                <Layers className="w-3 h-3" />
                                <span>{product.variants.length} variantes</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">
                                Sin variantes
                              </span>
                            )}
                          </td>

                          {/* 5. Mínimo */}
                          <td className="py-3 px-3 text-right">
                            <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
                              {product.minStock > 0 ? product.minStock : "—"}
                            </span>
                          </td>

                          {/* 6. Costo */}
                          <td className="py-3 px-3 text-right">
                            <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
                              {product.cost > 0 ? formatCOP(product.cost) : "—"}
                            </span>
                          </td>

                          {/* 7. Precio de venta */}
                          <td className="py-3 px-4 text-right">
                            <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                              {displayPrice}
                            </span>
                          </td>

                          {/* 8. Estado */}
                          <td className="py-3 px-3 text-center">
                            {product.isOutOfStock ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">
                                <XCircle className="w-3 h-3" />
                                <span>Agotado</span>
                              </span>
                            ) : product.isLowStock ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Stock bajo</span>
                              </span>
                            ) : product.is_available ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>En stock</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 dark:bg-white/[0.04] px-2 py-0.5 rounded-full">
                                <span>Pausado</span>
                              </span>
                            )}
                          </td>

                          {/* 9. Acciones */}
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedProductForMovement(product.id);
                                setIsMovementModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-bold text-[#ED500A] bg-[#ED500A]/10 hover:bg-[#ED500A]/20 rounded-lg transition-colors cursor-pointer"
                              title="Registrar entrada, salida o ajuste para este producto"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Movimiento</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {filteredProducts.length > 0 && (
              <div className="p-3.5 sm:p-4 border-t border-slate-200/80 dark:border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <span>Filas por página:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 rounded-lg text-xs focus:outline-hidden cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="ml-2 font-medium">
                    Mostrando{" "}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {Math.min(startIndex + 1, filteredProducts.length)}
                    </strong>{" "}
                    -{" "}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {Math.min(startIndex + pageSize, filteredProducts.length)}
                    </strong>{" "}
                    de{" "}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {filteredProducts.length}
                    </strong>{" "}
                    productos
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={safeCurrentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    title="Primera página"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safeCurrentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    title="Página anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-3 py-1 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Página {safeCurrentPage} de {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safeCurrentPage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    title="Página siguiente"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={safeCurrentPage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    title="Última página"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === "purchases" ? (
        <InventoryPurchasesTab
          businessId={businessId}
          products={products}
          locations={locations}
        />
      ) : activeTab === "history" ? (
        <InventoryHistoryTab
          businessId={businessId}
          locations={locations}
          onOpenMovementModal={() => {
            setSelectedProductForMovement(undefined);
            setIsMovementModalOpen(true);
          }}
          onOpenTransferModal={() => setIsTransferModalOpen(true)}
        />
      ) : (
        <InventoryLowStockTab
          businessId={businessId}
          onRestockPurchase={(item) => {
            setSelectedProductForPurchase(item.productId);
            setIsPurchaseModalOpen(true);
          }}
          onRestockMovement={(item) => {
            setSelectedProductForMovement(item.productId);
            setIsMovementModalOpen(true);
          }}
        />
      )}

      {/* Modal de Movimiento de Inventario */}
      <MovementFormModal
        businessId={businessId}
        isOpen={isMovementModalOpen}
        onClose={() => {
          setIsMovementModalOpen(false);
          setSelectedProductForMovement(undefined);
        }}
        onSuccess={() => {
          handleRefreshLocations();
          router.refresh();
        }}
        locations={locations}
      />

      {/* Modal de Transferencia entre Ubicaciones [INV-005] */}
      <TransferFormModal
        businessId={businessId}
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onSuccess={() => {
          handleRefreshLocations();
          router.refresh();
        }}
        locations={locations}
      />

      {/* Modal de Nueva Compra / Reabastecimiento Directo */}
      <PurchaseFormModal
        businessId={businessId}
        isOpen={isPurchaseModalOpen}
        onClose={() => {
          setIsPurchaseModalOpen(false);
          setSelectedProductForPurchase(null);
        }}
        onSuccess={() => {
          handleRefreshLocations();
          router.refresh();
        }}
        products={products}
        locations={locations}
        categories={categories}
        initialProductId={selectedProductForPurchase}
      />
    </div>
  );
}
