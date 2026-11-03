"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  AlertTriangle,
  ShoppingCart,
  RefreshCw,
  Search,
  XCircle,
  AlertCircle,
  CheckCircle2,
  Package,
  Plus,
  ArrowDownLeft,
  ChevronDown,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LowStockItem } from "@/lib/inventory/types";
import { getLowStockItemsAction } from "../productos/inventory-actions";
import { TableSkeleton, EmptyState, ErrorState } from "@/components/ui";

interface Props {
  businessId: string;
  onRestockPurchase?: (item: LowStockItem) => void;
  onRestockMovement?: (item: LowStockItem) => void;
}

export function InventoryLowStockTab({
  businessId,
  onRestockPurchase,
  onRestockMovement,
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState<LowStockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filtros internos
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "out_of_stock" | "critical">("all");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const loadLowStock = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await getLowStockItemsAction(businessId);
      if (res.success && res.data) {
        setItems(res.data);
      } else {
        const msg = res.error || "No se pudieron obtener los productos con stock bajo.";
        setLoadError(msg);
        toast.error("Error al consultar alertas", {
          description: msg,
        });
      }
    } catch (err: any) {
      const msg = err.message || "Fallo al comunicar con el servidor.";
      setLoadError(msg);
      toast.error("Error de conexión", {
        description: msg,
      });
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadLowStock();
  }, [loadLowStock]);

  // Manejador del botón interactivo: 'Reabastecer'
  const handleRestock = (item: LowStockItem, mode: "purchase" | "movement" = "purchase") => {
    setActiveMenuId(null);

    if (mode === "purchase") {
      if (onRestockPurchase) {
        onRestockPurchase(item);
      } else {
        toast.info(`Abriendo orden de compra para "${item.productName}"...`);
        router.push(
          `/workspace/${businessId}/compras?productId=${item.productId}&locationId=${item.locationId}&quantity=${item.deficit || 1}`
        );
      }
    } else {
      if (onRestockMovement) {
        onRestockMovement(item);
      } else {
        toast.info(`Abriendo ingreso de stock para "${item.productName}"...`);
        router.push(
          `/workspace/${businessId}/inventario?action=movement&productId=${item.productId}&locationId=${item.locationId}`
        );
      }
    }
  };

  // Filtrado reactivo de ítems críticos
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }

      if (q) {
        const matchName = item.productName.toLowerCase().includes(q);
        const matchSku = item.sku?.toLowerCase().includes(q);
        const matchCategory = item.categoryName?.toLowerCase().includes(q);
        const matchLocation = item.locationName.toLowerCase().includes(q);
        return matchName || matchSku || matchCategory || matchLocation;
      }

      return true;
    });
  }, [items, search, statusFilter]);

  // Estadísticas rápidas
  const totalOutOfStock = items.filter((i) => i.status === "out_of_stock").length;
  const totalCritical = items.filter((i) => i.status === "critical").length;
  const totalDeficitUnits = items.reduce((acc, i) => acc + (i.deficit || 0), 0);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* ========================================================= */}
      {/* 1. ENCABEZADO: Título 'Productos con Stock Bajo' con icono de advertencia/alerta */}
      {/* ========================================================= */}
      <div className="p-5 sm:p-6 rounded-3xl bg-linear-to-r from-amber-500/10 via-amber-500/5 to-rose-500/10 border border-amber-500/20 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0 shadow-xs">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Productos con Stock Bajo
                </h3>
                {items.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500 text-white shadow-2xs">
                    {items.length} {items.length === 1 ? "crítico" : "críticos"}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                {items.length === 0
                  ? "Todos los productos del catálogo cuentan con existencias por encima de sus límites de seguridad."
                  : "Lista de referencias con déficit de existencias que requieren orden de compra o ingreso inmediato."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => loadLowStock()}
              disabled={isLoading}
              title="Actualizar existencias críticas"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-[#0D0F16] border border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-white/[0.04] transition-all cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Actualizar lista</span>
            </button>
          </div>
        </div>

        {/* Tarjetas resumen de déficit */}
        {items.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-amber-500/15">
            <div className="p-3 rounded-2xl bg-white/70 dark:bg-[#0D0F16]/70 border border-amber-500/20">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Total Agotados (0 un.)
              </span>
              <span className="text-lg sm:text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5 block">
                {totalOutOfStock} productos
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-white/70 dark:bg-[#0D0F16]/70 border border-amber-500/20">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                En Nivel Crítico
              </span>
              <span className="text-lg sm:text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5 block">
                {totalCritical} productos
              </span>
            </div>

            <div className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-white/70 dark:bg-[#0D0F16]/70 border border-amber-500/20">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Déficit Total Consolidado
              </span>
              <span className="text-lg sm:text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5 block">
                -{totalDeficitUnits} unidades
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 2. BARRA DE BÚSQUEDA Y FILTRADO */}
      {/* ========================================================= */}
      {items.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xs">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, SKU, categoría o bodega..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/40"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === "all"
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold"
                  : "bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/[0.08]"
              }`}
            >
              Todos ({items.length})
            </button>
            <button
              onClick={() => setStatusFilter("out_of_stock")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === "out_of_stock"
                  ? "bg-rose-600 text-white font-bold"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20"
              }`}
            >
              Agotados ({totalOutOfStock})
            </button>
            <button
              onClick={() => setStatusFilter("critical")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === "critical"
                  ? "bg-amber-600 text-white font-bold"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
              }`}
            >
              Críticos ({totalCritical})
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. TABLA DE PRODUCTOS CRÍTICOS */}
      {/* ========================================================= */}
      {loadError ? (
        <ErrorState
          title="Error al consultar alertas de stock"
          description={loadError}
          onRetry={loadLowStock}
          retryLabel="Reintentar consulta"
        />
      ) : isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="¡Niveles de inventario óptimos!"
          description="Todos tus productos tienen cantidades superiores a sus umbrales de stock mínimo configurados. No hay alertas críticas en este momento."
        />
      ) : filteredItems.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl text-slate-500 text-xs">
          No se encontraron productos críticos con el término buscado.
        </div>
      ) : (
        <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-3xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Producto</th>
                  <th className="py-3.5 px-4 text-center">Stock Actual</th>
                  <th className="py-3.5 px-4 text-center">Stock Mínimo</th>
                  <th className="py-3.5 px-4 text-center">Diferencia</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {filteredItems.map((item) => {
                  const itemKey = `${item.productId}_${item.locationId}`;
                  const isMenuOpen = activeMenuId === itemKey;

                  // Cálculo de diferencia: Stock Actual - Stock Mínimo (ej: 2 - 5 = -3)
                  const difference = item.quantity - item.minStock;
                  const formattedDifference =
                    difference < 0 ? `${difference} un.` : `-${item.deficit || 0} un.`;

                  const isOutOfStock = item.quantity <= 0;

                  return (
                    <tr
                      key={itemKey}
                      className="hover:bg-slate-50/70 dark:hover:bg-white/[0.015] transition-colors"
                    >
                      {/* 1. Producto: Nombre e identificación de la referencia */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                              {item.productName}
                            </span>
                            {isOutOfStock && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                <XCircle className="w-3 h-3" />
                                <span>Agotado</span>
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            {item.sku ? (
                              <span className="font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-slate-300">
                                Ref/SKU: {item.sku}
                              </span>
                            ) : (
                              <span className="font-mono text-[11px] text-slate-400">
                                ID: {item.productId.slice(0, 8)}
                              </span>
                            )}
                            {item.categoryName && (
                              <span className="text-[11px] text-slate-400">
                                · {item.categoryName}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400">
                              · {item.locationName}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Stock Actual: Badge / etiqueta numérica en color rojo con las unidades físicas */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-bold bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200/80 dark:border-rose-500/20 shadow-2xs">
                          {isOutOfStock ? (
                            <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          )}
                          <span>{item.quantity} un.</span>
                        </span>
                      </td>

                      {/* 3. Stock Mínimo: Número entero que disparó la alerta */}
                      <td className="py-4 px-4 text-center font-mono font-bold text-xs text-slate-700 dark:text-slate-300">
                        <span>{Math.round(item.minStock)} un.</span>
                      </td>

                      {/* 4. Diferencia: Número negativo en rojo (ej: -3) indicando el déficit respecto al mínimo requerido */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center font-mono font-extrabold text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-xl border border-rose-500/20 shadow-2xs">
                          {formattedDifference}
                        </span>
                      </td>

                      {/* 5. Acción: Botón interactivo 'Reabastecer' que abre directamente la orden de compra o ingreso */}
                      <td className="py-4 px-4 sm:px-6 text-right">
                        <div className="relative inline-flex items-center shadow-2xs rounded-xl">
                          {/* Botón Principal: Abre orden de compra */}
                          <button
                            type="button"
                            onClick={() => handleRestock(item, "purchase")}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-l-xl text-xs font-bold transition-all cursor-pointer"
                            title={`Reabastecer ${item.productName} mediante orden de compra`}
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            <span>Reabastecer</span>
                          </button>

                          {/* Botón Secundario: Despliega opción de ingreso rápido */}
                          <button
                            type="button"
                            onClick={() => setActiveMenuId(isMenuOpen ? null : itemKey)}
                            className="px-2 py-2 bg-[#ED500A]/90 hover:bg-[#ED500A] text-white rounded-r-xl border-l border-white/20 transition-all cursor-pointer"
                            title="Opciones de reabastecimiento"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>

                          {/* Menú Flotante de Opciones */}
                          {isMenuOpen && (
                            <div className="absolute right-0 top-full mt-1.5 w-56 z-20 bg-white dark:bg-[#151926] border border-slate-200 dark:border-white/[0.1] rounded-2xl shadow-xl p-1.5 text-left animate-in fade-in zoom-in-95 duration-150">
                              <button
                                type="button"
                                onClick={() => handleRestock(item, "purchase")}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] rounded-xl transition-colors cursor-pointer"
                              >
                                <ShoppingCart className="w-4 h-4 text-[#ED500A]" />
                                <div className="text-left">
                                  <span className="font-bold block">Crear orden de compra</span>
                                  <span className="text-[10px] text-slate-400 block">
                                    Genera factura y asigna proveedor
                                  </span>
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRestock(item, "movement")}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] rounded-xl transition-colors cursor-pointer mt-1"
                              >
                                <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                                <div className="text-left">
                                  <span className="font-bold block">Registrar ingreso rápido</span>
                                  <span className="text-[10px] text-slate-400 block">
                                    Entrada directa de existencias
                                  </span>
                                </div>
                              </button>
                            </div>
                          )}
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
    </div>
  );
}
