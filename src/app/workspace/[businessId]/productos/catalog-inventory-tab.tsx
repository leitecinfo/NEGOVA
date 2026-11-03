"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Boxes,
  Warehouse,
  ArrowRight,
  Search,
  Filter,
  AlertTriangle,
  Store,
  CheckCircle2,
  XCircle,
  Package,
  ChevronDown,
  ChevronUp,
  DollarSign,
  TrendingDown,
  Layers,
  Sparkles,
  ExternalLink,
  ShoppingCart,
} from "lucide-react";
import { Product, Category, isProductAvailableInPos } from "@/lib/products/types";
import { formatCOP } from "@/lib/pos/types";

interface CatalogInventoryTabProps {
  businessId: string;
  products: Product[];
  categories: Category[];
  onRefresh?: () => void;
}

export function CatalogInventoryTab({
  businessId,
  products,
  categories,
  onRefresh,
}: CatalogInventoryTabProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [posFilter, setPosFilter] = useState<"all" | "in_pos" | "not_in_pos">("all");
  const [stockStatusFilter, setStockStatusFilter] = useState<
    "all" | "low_stock" | "out_of_stock" | "tracked"
  >("all");

  // Estado para controlar qué filas tienen el desglose de variantes expandido
  const [expandedVariants, setExpandedVariants] = useState<Record<string, boolean>>({});

  const toggleVariants = (productId: string) => {
    setExpandedVariants((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  // Mapa de categorías para búsqueda rápida
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c.id, c.name);
    }
    return map;
  }, [categories]);

  // Normalización de cálculos de inventario por producto
  const enrichedProducts = useMemo(() => {
    return products
      .filter((p) => p.status !== "archived")
      .map((p) => {
        const meta = (p.metadata as any) || {};
        const isTracked = Boolean(meta.track_stock);
        const variants = Array.isArray(meta.variants) ? meta.variants : [];
        const hasVariants = Boolean(meta.has_variants || variants.length > 0);

        // Cálculo de stock total
        let totalStock = 0;
        if (isTracked) {
          if (hasVariants && variants.length > 0) {
            totalStock = variants.reduce(
              (acc: number, v: any) => acc + (Number(v.stock_quantity) || 0),
              0
            );
          } else {
            totalStock = Number(meta.stock_quantity) || 0;
          }
        }

        const minStock = meta.min_stock !== null && meta.min_stock !== undefined ? Number(meta.min_stock) : null;
        const cost = Number(meta.cost ?? meta.average_cost ?? 0);
        const isPosAvailable = isProductAvailableInPos(p);

        // Estado de inventario
        const isOutOfStock = isTracked && totalStock <= 0;
        const isLowStock = isTracked && minStock !== null && totalStock > 0 && totalStock <= minStock;

        return {
          product: p,
          categoryName: p.category_id ? categoryMap.get(p.category_id) || "Sin categoría" : "Sin categoría",
          isTracked,
          totalStock,
          minStock,
          cost,
          price: p.price,
          isPosAvailable,
          hasVariants,
          variants,
          isOutOfStock,
          isLowStock,
        };
      });
  }, [products, categoryMap]);

  // Métricas rápidas (KPIs)
  const kpis = useMemo(() => {
    const totalCount = enrichedProducts.length;
    const trackedProducts = enrichedProducts.filter((p) => p.isTracked);
    const lowStockCount = enrichedProducts.filter((p) => p.isLowStock).length;
    const outOfStockCount = enrichedProducts.filter((p) => p.isOutOfStock).length;
    const availableInPosCount = enrichedProducts.filter((p) => p.isPosAvailable).length;

    const totalValuation = trackedProducts.reduce((sum, item) => {
      return sum + item.totalStock * item.cost;
    }, 0);

    return {
      totalCount,
      lowStockCount,
      outOfStockCount,
      availableInPosCount,
      totalValuation,
    };
  }, [enrichedProducts]);

  // Filtrado reactivo de productos
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return enrichedProducts.filter((item) => {
      // 1. Filtro de búsqueda
      if (q) {
        const nameMatch = item.product.name.toLowerCase().includes(q);
        const meta = (item.product.metadata as any) || {};
        const skuMatch = (meta.sku || "").toLowerCase().includes(q);
        const barcodeMatch = (meta.barcode || "").toLowerCase().includes(q);
        const catMatch = item.categoryName.toLowerCase().includes(q);
        if (!nameMatch && !skuMatch && !barcodeMatch && !catMatch) return false;
      }

      // 2. Filtro de categoría
      if (categoryFilter !== "all" && item.product.category_id !== categoryFilter) {
        return false;
      }

      // 3. Filtro de disponibilidad en POS
      if (posFilter === "in_pos" && !item.isPosAvailable) return false;
      if (posFilter === "not_in_pos" && item.isPosAvailable) return false;

      // 4. Filtro de estado de stock
      if (stockStatusFilter === "low_stock" && !item.isLowStock) return false;
      if (stockStatusFilter === "out_of_stock" && !item.isOutOfStock) return false;
      if (stockStatusFilter === "tracked" && !item.isTracked) return false;

      return true;
    });
  }, [enrichedProducts, search, categoryFilter, posFilter, stockStatusFilter]);

  return (
    <div className="space-y-5 animate-in fade-in duration-150 font-body">
      {/* 1. BANNER DESTACADO PARA IR A LA VISTA GENERAL AVANZADA DE INVENTARIO */}
      <div className="relative overflow-hidden p-5 sm:p-6 rounded-3xl bg-linear-to-r from-slate-900 via-slate-800 to-slate-900 text-white border border-slate-700/60 shadow-lg">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-[#ED500A]/15 to-transparent pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#ED500A]/20 text-[#ED500A] border border-[#ED500A]/30">
              <Boxes className="w-3.5 h-3.5" />
              <span>Resumen Rápido de Catálogo</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white">
              Control de Existencias y Disponibilidad en Caja
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Consulta en tiempo real el stock consolidado, disponibilidad en POS, costos y desglose de variantes de tu catálogo comercial.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              href={`/workspace/${businessId}/compras`}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs sm:text-sm font-semibold transition-all border border-white/10 cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4 text-[#ED500A]" />
              <span>Compras a Proveedores</span>
            </Link>
            <Link
              href={`/workspace/${businessId}/inventario`}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-md hover:scale-[1.02] cursor-pointer"
            >
              <Warehouse className="w-4 h-4" />
              <span>Vista General Avanzada</span>
              <ArrowRight className="w-4 h-4 ml-0.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* 2. TARJETAS DE KPIS RÁPIDOS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Catálogo Activo
          </span>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {kpis.totalCount}
            </span>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Productos registrados</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Disponibles en POS
          </span>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {kpis.availableInPosCount}
            </span>
            <Store className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Habilitados para venta en caja</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Alertas de Stock
          </span>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {kpis.lowStockCount + kpis.outOfStockCount}
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {kpis.outOfStockCount > 0 ? `${kpis.outOfStockCount} agotados` : "Niveles mínimos"}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Valoración al Costo
          </span>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-white truncate">
              {formatCOP(kpis.totalValuation)}
            </span>
            <DollarSign className="w-4 h-4 text-[#ED500A]" />
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Capital en existencias</p>
        </div>
      </div>

      {/* 3. BARRA DE BÚSQUEDA Y FILTROS */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xs">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Buscador */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto por nombre, SKU o código de barras..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/50 transition-all"
            />
          </div>

          {/* Filtro por Categoría */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/50"
          >
            <option value="all">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Filtro por POS */}
          <select
            value={posFilter}
            onChange={(e) => setPosFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/50"
          >
            <option value="all">POS: Todos</option>
            <option value="in_pos">En caja (POS activo)</option>
            <option value="not_in_pos">Fuera de caja</option>
          </select>

          {/* Filtro por Estado de Stock */}
          <select
            value={stockStatusFilter}
            onChange={(e) => setStockStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/50"
          >
            <option value="all">Stock: Todos los estados</option>
            <option value="low_stock">Stock bajo / Crítico</option>
            <option value="out_of_stock">Agotados (0 unidades)</option>
            <option value="tracked">Con control de stock</option>
          </select>
        </div>

        {/* Contador de resultados */}
        <span className="text-xs font-semibold text-slate-500 self-center">
          Mostrando {filteredProducts.length} de {enrichedProducts.length} productos
        </span>
      </div>

      {/* 4. TABLA DE EXISTENCIAS DEL CATÁLOGO */}
      <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/[0.08] text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3.5">Producto</th>
                <th className="px-4 py-3.5">Categoría</th>
                <th className="px-4 py-3.5 text-center">Stock total</th>
                <th className="px-4 py-3.5 text-center">POS</th>
                <th className="px-4 py-3.5">Variantes (desglose)</th>
                <th className="px-4 py-3.5 text-center">Mínimo</th>
                <th className="px-4 py-3.5 text-right">Costo</th>
                <th className="px-4 py-3.5 text-right">Precio de venta</th>
                <th className="px-4 py-3.5 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.05]">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                      <Boxes className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        No se encontraron productos en el inventario
                      </p>
                      <p className="text-xs text-slate-500">
                        Intenta ajustar los filtros de búsqueda o categoría.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((item) => {
                  const {
                    product: p,
                    categoryName,
                    isTracked,
                    totalStock,
                    minStock,
                    cost,
                    price,
                    isPosAvailable,
                    hasVariants,
                    variants,
                    isOutOfStock,
                    isLowStock,
                  } = item;

                  const meta = (p.metadata as any) || {};
                  const isExpanded = Boolean(expandedVariants[p.id]);

                  return (
                    <React.Fragment key={p.id}>
                      <tr className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors">
                        {/* 1. Producto */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] flex items-center justify-center shrink-0 overflow-hidden">
                              {p.image_url ? (
                                <img
                                  src={p.image_url}
                                  alt={p.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 dark:text-white text-xs block truncate">
                                {p.name}
                              </span>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                                {meta.sku && <span>SKU: {meta.sku}</span>}
                                {meta.barcode && <span>CB: {meta.barcode}</span>}
                                {!meta.sku && !meta.barcode && (
                                  <span>{hasVariants ? "Con presentaciones" : "Simple"}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Categoría */}
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300">
                            {categoryName}
                          </span>
                        </td>

                        {/* 3. Stock total */}
                        <td className="px-4 py-3.5 text-center">
                          {isTracked ? (
                            <span
                              className={`inline-flex items-center gap-1 font-mono font-bold text-xs px-2.5 py-1 rounded-full ${
                                isOutOfStock
                                  ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200/60 dark:border-rose-500/20"
                                  : isLowStock
                                  ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200/60 dark:border-amber-500/20"
                                  : "bg-slate-100 dark:bg-white/[0.06] text-slate-900 dark:text-white"
                              }`}
                            >
                              {isOutOfStock && <XCircle className="w-3 h-3 text-rose-500" />}
                              {isLowStock && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                              <span>{totalStock} {meta.unit || "un."}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-50 dark:bg-white/[0.02] text-slate-400 border border-slate-200/60 dark:border-white/[0.06]">
                              Ilimitado
                            </span>
                          )}
                        </td>

                        {/* 4. POS (indicador en caja) */}
                        <td className="px-4 py-3.5 text-center">
                          {isPosAvailable ? (
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-500/20"
                              title="Habilitado para la venta en caja y POS"
                            >
                              <Store className="w-3 h-3 text-emerald-600" />
                              <span>En caja</span>
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-white/[0.04] text-slate-400 border border-slate-200/60 dark:border-white/[0.06]"
                              title="No disponible para venta en caja"
                            >
                              <XCircle className="w-3 h-3 text-slate-400" />
                              <span>No disponible</span>
                            </span>
                          )}
                        </td>

                        {/* 5. Variantes (desglose) */}
                        <td className="px-4 py-3.5">
                          {hasVariants && variants.length > 0 ? (
                            <div>
                              <button
                                type="button"
                                onClick={() => toggleVariants(p.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors cursor-pointer"
                              >
                                <Layers className="w-3.5 h-3.5 text-purple-600" />
                                <span>{variants.length} presentaciones</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">
                              Sin variantes
                            </span>
                          )}
                        </td>

                        {/* 6. Mínimo */}
                        <td className="px-4 py-3.5 text-center font-mono text-xs">
                          {isTracked && minStock !== null ? (
                            <span className="text-slate-700 dark:text-slate-300 font-bold">
                              {minStock} {meta.unit || "un."}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* 7. Costo */}
                        <td className="px-4 py-3.5 text-right font-mono font-medium text-xs text-slate-700 dark:text-slate-300">
                          {cost > 0 ? formatCOP(cost) : "—"}
                        </td>

                        {/* 8. Precio de venta */}
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-xs text-slate-900 dark:text-white">
                          {formatCOP(price)}
                        </td>

                        {/* 9. Estado */}
                        <td className="px-4 py-3.5 text-center">
                          {p.status === "inactive" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-white/[0.06] text-slate-500 border border-slate-200/80 dark:border-white/[0.08]">
                              Inactivo
                            </span>
                          ) : !p.is_available || isOutOfStock ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-500/20">
                              Agotado
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-500/20">
                              Activo
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* FILA EXPANDIBLE CON EL DESGLOSE DE VARIANTES */}
                      {hasVariants && isExpanded && (
                        <tr className="bg-purple-50/30 dark:bg-purple-500/[0.03]">
                          <td colSpan={9} className="px-6 py-3 border-y border-purple-100 dark:border-purple-500/10">
                            <div className="space-y-1.5 pl-4">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Desglose por Presentación / Variante:</span>
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                                {variants.map((v: any, vIdx: number) => (
                                  <div
                                    key={v.id || vIdx}
                                    className="p-2.5 rounded-xl bg-white dark:bg-[#0D0F16] border border-purple-200/70 dark:border-purple-500/20 flex items-center justify-between gap-2 shadow-2xs"
                                  >
                                    <div className="min-w-0">
                                      <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate block">
                                        {v.name}
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        {v.sku ? `SKU: ${v.sku}` : "Sin SKU"}
                                      </span>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <span className="font-mono font-bold text-xs text-slate-900 dark:text-white block">
                                        {formatCOP(v.price ?? price)}
                                      </span>
                                      <span className="text-[10px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 block">
                                        Stock: {v.stock_quantity ?? 0} {meta.unit || "un."}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
