"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Package,
  AlertTriangle,
  DollarSign,
  Activity,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  CheckCircle2,
  ArrowUpDown,
  Boxes,
  Plus,
  ArrowRightLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Category } from "@/lib/products/types";
import {
  InventoryKPIs,
  Location,
  ProductStockMatrixResult,
  ProductStockMatrixRow,
} from "@/lib/inventory/types";
import {
  TableSkeleton,
  EmptyState,
  ErrorState,
} from "@/components/ui";
import {
  getInventoryKPIsAction,
  getInventoryStockMatrixAction,
} from "./inventory-actions";

interface Props {
  businessId: string;
  categories: Category[];
  locations: Location[];
  onRefreshLocations?: () => void;
  onOpenMovementModal?: () => void;
  onOpenTransferModal?: () => void;
}

export function InventoryProductsTab({
  businessId,
  categories,
  locations,
  onRefreshLocations,
  onOpenMovementModal,
  onOpenTransferModal,
}: Props) {
  const [matrixData, setMatrixData] = useState<ProductStockMatrixResult | null>(null);
  const [kpis, setKpis] = useState<InventoryKPIs | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [matrixRes, kpisRes] = await Promise.all([
        getInventoryStockMatrixAction(businessId, {
          search: search || undefined,
          categoryId: selectedCategory !== "all" ? selectedCategory : undefined,
          lowStockOnly,
        }),
        getInventoryKPIsAction(businessId),
      ]);

      if (matrixRes.success && matrixRes.data) {
        setMatrixData(matrixRes.data);
      }
      if (kpisRes.success && kpisRes.data) {
        setKpis(kpisRes.data);
      }
    } catch (err: any) {
      const msg = err.message || "No se pudo sincronizar la información.";
      setLoadError(msg);
      toast.error("Error al cargar existencias de inventario", {
        description: msg,
      });
    } finally {
      setIsLoading(false);
    }
  }, [businessId, search, selectedCategory, lowStockOnly]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const currentLocations = matrixData?.locations || locations;
  const rows = matrixData?.rows || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. KPIS SUPERIORES DE INVENTARIO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Productos */}
        <div className="p-4.5 rounded-2xl bg-white dark:bg-[#0E131F] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total Catálogo
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <h4 className="text-xl font-bold text-slate-900 dark:text-white">
              {kpis?.totalProducts || 0}
            </h4>
            <p className="text-2xs text-slate-400 mt-0.5">Productos activos en catálogo</p>
          </div>
        </div>

        {/* KPI 2: Stock Bajo */}
        <div className="p-4.5 rounded-2xl bg-white dark:bg-[#0E131F] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Stock Bajo / Crítico
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <h4 className="text-xl font-bold text-amber-600 dark:text-amber-400">
              {kpis?.lowStockCount || 0}
            </h4>
            <p className="text-2xs text-slate-400 mt-0.5">Por debajo del mínimo fijado</p>
          </div>
        </div>

        {/* KPI 3: Valor al Costo */}
        <div className="p-4.5 rounded-2xl bg-white dark:bg-[#0E131F] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Valoración al Costo
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <h4 className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCOP(kpis?.totalCostValue || 0)}
            </h4>
            <p className="text-2xs text-slate-400 mt-0.5">Costo total de existencias</p>
          </div>
        </div>

        {/* KPI 4: Movimientos Hoy */}
        <div className="p-4.5 rounded-2xl bg-white dark:bg-[#0E131F] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Movimientos Hoy
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <h4 className="text-xl font-bold text-slate-900 dark:text-white">
              {kpis?.todayMovementsCount || 0}
            </h4>
            <p className="text-2xs text-slate-400 mt-0.5">Entradas, salidas y mermas</p>
          </div>
        </div>
      </div>

      {/* 2. BARRA DE FILTROS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5">
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Buscador */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3.5 py-2 bg-slate-50/50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] text-slate-900 dark:text-white placeholder:text-slate-400 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/40 w-full transition-colors"
            />
          </div>

          {/* Categoría */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-slate-50/50 dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden transition-colors"
          >
            <option value="all">Todas las Categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Toggle Solo Stock Bajo */}
          <button
            type="button"
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all ${
              lowStockOnly
                ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                : "bg-slate-50/50 dark:bg-[#0D0F16] border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-300"
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Solo Stock Bajo</span>
          </button>

          {/* Recargar */}
          <button
            onClick={() => loadData()}
            title="Recargar tabla de stock"
            className="p-2 rounded-xl border border-slate-200/80 dark:border-white/[0.08] text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {onOpenTransferModal && (
            <button
              type="button"
              onClick={onOpenTransferModal}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold border border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 transition-all cursor-pointer active:scale-98 shrink-0"
              title="Transferir existencias entre dos ubicaciones"
            >
              <ArrowRightLeft className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Transferencias</span>
            </button>
          )}

          {onOpenMovementModal && (
            <button
              type="button"
              onClick={onOpenMovementModal}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-[#ED500A]/20 transition-all cursor-pointer active:scale-98 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nuevo movimiento</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. TABLA MATRICIAL DE STOCK O ESTADOS CONSISTENTES [DS-002] */}
      {loadError ? (
        <ErrorState
          title="Error al cargar existencias de inventario"
          description={loadError}
          onRetry={loadData}
          retryLabel="Reintentar consulta"
        />
      ) : isLoading ? (
        <TableSkeleton rows={6} cols={4 + (currentLocations.length || 1)} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No se encontraron productos en inventario"
          description={
            lowStockOnly
              ? "Ningún producto se encuentra por debajo de su stock mínimo configurado."
              : search || selectedCategory !== "all"
              ? "No hay productos que coincidan con los filtros de búsqueda o categoría aplicados."
              : "Aún no se han configurado existencias de inventario para este catálogo."
          }
          actionLabel={onOpenMovementModal ? "+ Nuevo movimiento" : undefined}
          onAction={onOpenMovementModal}
          resetLabel={
            search || selectedCategory !== "all" || lowStockOnly
              ? "Limpiar filtros"
              : undefined
          }
          onReset={
            search || selectedCategory !== "all" || lowStockOnly
              ? () => {
                  setSearch("");
                  setSelectedCategory("all");
                  setLowStockOnly(false);
                }
              : undefined
          }
        />
      ) : (
        <div className="bg-white dark:bg-[#0E131F] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/75 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 font-semibold uppercase text-2xs tracking-wider">
                <tr>
                  <th className="py-3 px-4 min-w-[180px]">Producto</th>
                  <th className="py-3 px-4 min-w-[120px]">Categoría</th>
                  <th className="py-3 px-4 text-right min-w-[100px]">Costo Prom.</th>

                  {/* Una columna por cada ubicación activa */}
                  {currentLocations.map((loc) => (
                    <th
                      key={loc.id}
                      className="py-3 px-4 text-right min-w-[120px] bg-slate-100/50 dark:bg-white/[0.01]"
                    >
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          {loc.name}
                        </span>
                        <span className="text-3xs text-slate-400 lowercase font-normal">
                          {loc.type === "warehouse" ? "Bodega" : "Punto Venta"}
                        </span>
                      </div>
                    </th>
                  ))}

                  <th className="py-3 px-4 text-right font-bold min-w-[110px] text-slate-900 dark:text-white">
                    Stock Total
                  </th>
                  <th className="py-3 px-4 text-right font-bold min-w-[120px] text-emerald-700 dark:text-emerald-400">
                    Valor Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {rows.map((row) => (
                  <tr
                    key={row.productId}
                    className="hover:bg-slate-50/50 dark:hover:bg-white/[0.015] transition-colors"
                  >
                    {/* Nombre y SKU */}
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      <div className="flex flex-col">
                        <span>{row.productName}</span>
                        {row.sku && (
                          <span className="text-2xs text-slate-400 font-normal">
                            SKU: {row.sku}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Categoría */}
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {row.categoryName || (
                        <span className="text-slate-400 italic">Sin categoría</span>
                      )}
                    </td>

                    {/* Costo Promedio Ponderado */}
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-700 dark:text-slate-200">
                      {formatCOP(row.cost)}
                    </td>

                    {/* Columnas de Ubicaciones */}
                    {currentLocations.map((loc) => {
                      const locStock = row.stockByLocation[loc.id] || {
                        quantity: 0,
                        minStock: 0,
                        cost: 0,
                        isLow: true,
                      };

                      return (
                        <td
                          key={loc.id}
                          className="py-3 px-4 text-right whitespace-nowrap bg-slate-50/20 dark:bg-white/[0.005]"
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            <span
                              className={`font-semibold ${
                                locStock.isLow
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-slate-800 dark:text-slate-200"
                              }`}
                            >
                              {locStock.quantity}
                            </span>

                            {locStock.isLow && (
                              <span
                                title={`Stock bajo (Mínimo: ${locStock.minStock})`}
                                className="inline-flex items-center px-1.5 py-0.5 rounded-full text-3xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              >
                                !
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Stock Total Consolidado */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-bold text-xs ${
                          row.totalStock <= 0
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            : row.isLowStock
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {row.totalStock} un.
                      </span>
                    </td>

                    {/* Valoración Total (Stock Total × Costo Promedio) */}
                    <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {formatCOP(Math.max(0, row.totalStock) * (row.cost || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

