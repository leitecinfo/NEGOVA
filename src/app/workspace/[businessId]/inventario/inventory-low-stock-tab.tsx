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
import { getLowStockItemsAction } from "./actions";
import { TableSkeleton, EmptyState, ErrorState, KpiCard, KpiGrid, SearchInput, Badge, Button } from "@/components/ui";

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
      {/* 1. ENCABEZADO: Título 'Productos con Stock Bajo' (NORMALIZADO) */}
      {/* ========================================================= */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0D0F16] border border-amber-500/30 dark:border-amber-500/20 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0 shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg sm:text-xl font-bold font-title tracking-tight text-slate-900 dark:text-white">
                  Productos con Stock Bajo
                </h3>
                {items.length > 0 && (
                  <Badge size="sm" variant="red">
                    {items.length} {items.length === 1 ? "crítico" : "críticos"}
                  </Badge>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Actualizar lista</span>
            </button>
          </div>
        </div>

        {/* Tarjetas resumen de déficit normalizadas con KpiGrid */}
        {items.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
            <KpiGrid cols={3}>
              <KpiCard
                title="Total Agotados"
                value={`${totalOutOfStock} productos`}
                subtext="0 unidades físicas en stock"
                icon={<XCircle className="w-5 h-5" />}
                variant={totalOutOfStock > 0 ? "red" : "default"}
              />
              <KpiCard
                title="En Nivel Crítico"
                value={`${totalCritical} productos`}
                subtext="Por debajo del stock mínimo"
                icon={<AlertTriangle className="w-5 h-5" />}
                variant={totalCritical > 0 ? "amber" : "default"}
              />
              <KpiCard
                title="Déficit Total Consolidado"
                value={`-${totalDeficitUnits} un.`}
                subtext="Unidades faltantes por surtir"
                icon={<AlertCircle className="w-5 h-5" />}
                variant={totalDeficitUnits > 0 ? "red" : "emerald"}
              />
            </KpiGrid>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 2. BARRA DE BÚSQUEDA Y FILTRADO (NORMALIZADA) */}
      {/* ========================================================= */}
      {items.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs">
          <div className="flex-1 max-w-md">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch("")}
              placeholder="Buscar por nombre, SKU, categoría o bodega..."
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
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
                              <Badge size="sm" variant="red">
                                <XCircle className="w-3 h-3" />
                                <span>Agotado</span>
                              </Badge>
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

                      {/* 2. Stock Actual */}
                      <td className="py-4 px-4 text-center">
                        <Badge size="sm" variant="red">
                          {isOutOfStock ? (
                            <XCircle className="w-3.5 h-3.5" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5" />
                          )}
                          <span className="font-mono font-bold">{item.quantity} un.</span>
                        </Badge>
                      </td>

                      {/* 3. Stock Mínimo */}
                      <td className="py-4 px-4 text-center font-mono font-bold text-xs text-slate-700 dark:text-slate-300">
                        <span>{Math.round(item.minStock)} un.</span>
                      </td>

                      {/* 4. Diferencia */}
                      <td className="py-4 px-4 text-center">
                        <Badge size="sm" variant="red">
                          <span className="font-mono font-bold">{formattedDifference}</span>
                        </Badge>
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
