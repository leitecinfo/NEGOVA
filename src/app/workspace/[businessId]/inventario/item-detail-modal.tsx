"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Package,
  Layers,
  History,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Tag,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  SlidersHorizontal,
  Loader2,
  Calendar,
  User,
  Barcode,
  Edit3,
  Check,
  ChefHat,
  AlertCircle,
  ExternalLink,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  InventariableItem,
  InventoryMovementWithDetails,
} from "@/lib/inventory/types";
import {
  getProductMovementHistoryAction,
  updateItemMinStockAction,
} from "./actions";
import { formatCOP } from "@/lib/pos/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  item: InventariableItem | null;
  onOpenAdjustment: (item: InventariableItem) => void;
  onMinStockUpdated?: (productId: string, newMin: number) => void;
}

export function ItemDetailModal({
  isOpen,
  onClose,
  businessId,
  item,
  onOpenAdjustment,
  onMinStockUpdated,
}: Props) {
  const router = useRouter();
  const [movements, setMovements] = useState<InventoryMovementWithDetails[]>([]);
  const [isLoadingMovements, setIsLoadingMovements] = useState(false);
  const [isEditingMinStock, setIsEditingMinStock] = useState(false);
  const [minStockInput, setMinStockInput] = useState<string>("");
  const [currentMinStock, setCurrentMinStock] = useState<number>(0);
  const [isSavingMinStock, setIsSavingMinStock] = useState(false);

  useEffect(() => {
    if (item) {
      setCurrentMinStock(item.minStock || 0);
      setMinStockInput(String(item.minStock || 0));
      setIsEditingMinStock(false);
    }
  }, [item]);

  const handleSaveMinStock = async () => {
    if (!item) return;
    const parsed = parseFloat(minStockInput);
    if (isNaN(parsed) || parsed < 0) {
      toast.error("El stock mínimo debe ser un número mayor o igual a cero.");
      return;
    }

    setIsSavingMinStock(true);
    try {
      const res = await updateItemMinStockAction(businessId, item.id, parsed);
      if (res.success) {
        setCurrentMinStock(parsed);
        setIsEditingMinStock(false);
        toast.success(`Stock mínimo actualizado a ${parsed} ${item.unit}`);
        if (onMinStockUpdated) {
          onMinStockUpdated(item.id, parsed);
        } else {
          router.refresh();
        }
      } else {
        toast.error(res.error || "No se pudo actualizar el stock mínimo.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al guardar stock mínimo.");
    } finally {
      setIsSavingMinStock(false);
    }
  };

  const loadMovements = useCallback(async () => {
    if (!item) return;
    setIsLoadingMovements(true);
    try {
      const res = await getProductMovementHistoryAction(businessId, item.id, 15);
      if (res.success && res.data) {
        setMovements(res.data);
      } else {
        setMovements([]);
      }
    } catch {
      setMovements([]);
    } finally {
      setIsLoadingMovements(false);
    }
  }, [businessId, item]);

  useEffect(() => {
    if (isOpen && item) {
      loadMovements();
    } else {
      setMovements([]);
    }
  }, [isOpen, item, loadMovements]);

  if (!isOpen || !item) return null;

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    } catch {
      return isoString;
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
        <div
          className="relative w-full max-w-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3 min-w-0">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-12 h-12 rounded-2xl object-cover border border-slate-200/80 dark:border-white/[0.08] shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/[0.08] flex items-center justify-center shrink-0 text-slate-400">
                  <Package className="w-6 h-6" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      item.controlType === "recipe"
                        ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                        : item.itemType === "ingredient"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                    }`}
                  >
                    {item.controlType === "recipe"
                      ? "Elaborado por receta"
                      : item.itemType === "ingredient"
                      ? "Insumo / Ingrediente"
                      : "Control Directo"}
                  </span>

                  {item.status === "pending_recipe" ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/20">
                      <ChefHat className="w-3 h-3 text-amber-500" />
                      <span>Receta pendiente</span>
                    </span>
                  ) : item.status === "out_of_stock" ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">
                      <XCircle className="w-3 h-3" />
                      <span>{item.controlType === "recipe" ? "Agotado (sin insumos)" : "Agotado"}</span>
                    </span>
                  ) : item.status === "low_stock" ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Stock bajo</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Disponible</span>
                    </span>
                  )}
                </div>

                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1 truncate">
                  {item.name}
                </h2>

                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap">
                  {item.categoryName && (
                    <span>Categoría: <strong className="text-slate-600 dark:text-slate-300">{item.categoryName}</strong></span>
                  )}
                  {item.sku && <span>• SKU: <strong className="font-mono text-slate-600 dark:text-slate-300">{item.sku}</strong></span>}
                  {item.barcode && <span>• Barra: <strong className="font-mono text-slate-600 dark:text-slate-300">{item.barcode}</strong></span>}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
            {item.controlType === "recipe" ? (
              /* ============================================================ */
              /* VISTA PARA PRODUCTOS PREPARADOS / ELABORADOS POR RECETA     */
              /* ============================================================ */
              <div className="space-y-5">
                {/* 1. Métricas de preparación y receta */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl text-center">
                    <span className="text-[11px] font-medium text-slate-400 block">Disponibilidad estimada</span>
                    <span className="text-lg font-bold font-mono text-purple-600 dark:text-purple-400 mt-0.5 block">
                      {item.portionsAvailable !== null && item.portionsAvailable !== undefined
                        ? `${item.portionsAvailable} porciones`
                        : "—"}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {item.recipeId ? "Según insumos en stock" : "Sin receta vinculada"}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl text-center">
                    <span className="text-[11px] font-medium text-slate-400 block">Receta vinculada</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white mt-1 block truncate">
                      {item.recipeName || "Sin receta"}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {item.recipeStatus === "active" ? "Receta activa" : item.recipeId ? "Receta inactiva" : "Pendiente"}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl text-center">
                    <span className="text-[11px] font-medium text-slate-400 block">Cuello de botella</span>
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-1 block truncate">
                      {item.limitingIngredient ? item.limitingIngredient.name : item.recipeId ? "Sin déficit" : "—"}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {item.limitingIngredient
                        ? `Alcanza para ${item.limitingIngredient.availablePortions} un.`
                        : item.recipeId
                        ? "Todos los insumos OK"
                        : "Requiere receta"}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl text-center">
                    <span className="text-[11px] font-medium text-slate-400 block">Costo estimado</span>
                    <span className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-0.5 block">
                      {item.cost > 0 ? formatCOP(item.cost) : "—"}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Por porción preparada</span>
                  </div>
                </div>

                {/* 2. Lista de Ingredientes Requeridos */}
                {item.recipeIngredients && item.recipeIngredients.length > 0 ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <UtensilsCrossed className="w-4 h-4 text-purple-500" />
                        <span>Ingredientes e Insumos requeridos ({item.recipeIngredients.length})</span>
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Disponibilidad determinada por el menor rendimiento
                      </span>
                    </div>

                    <div className="border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-white/[0.04]">
                      <div className="bg-slate-50/80 dark:bg-white/[0.02] p-2.5 px-3.5 grid grid-cols-12 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <div className="col-span-5">Ingrediente</div>
                        <div className="col-span-2 text-right">Requerido</div>
                        <div className="col-span-3 text-right">En almacén</div>
                        <div className="col-span-2 text-right">Alcanza</div>
                      </div>

                      {item.recipeIngredients.map((ing) => (
                        <div
                          key={ing.ingredientId}
                          className={`p-3 px-3.5 grid grid-cols-12 items-center text-xs transition-colors ${
                            ing.isLimiting
                              ? "bg-amber-500/5 dark:bg-amber-500/10"
                              : "hover:bg-slate-50/50 dark:hover:bg-white/[0.02]"
                          }`}
                        >
                          <div className="col-span-5 min-w-0 pr-2">
                            <span className="font-semibold text-slate-900 dark:text-white block truncate">
                              {ing.ingredientName}
                            </span>
                            {ing.isLimiting && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Ingrediente limitante</span>
                              </span>
                            )}
                          </div>

                          <div className="col-span-2 text-right font-mono text-slate-600 dark:text-slate-300">
                            {ing.quantity} {ing.unit}
                          </div>

                          <div className="col-span-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                            {ing.stockQuantity} {ing.unit}
                          </div>

                          <div className="col-span-2 text-right">
                            <span
                              className={`font-mono font-bold text-xs ${
                                ing.availablePortions <= 0
                                  ? "text-rose-600 dark:text-rose-400"
                                  : ing.isLimiting
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-emerald-600 dark:text-emerald-400"
                              }`}
                            >
                              {ing.availablePortions} un
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 text-xs space-y-2">
                    <ChefHat className="w-8 h-8 mx-auto text-amber-500 mb-1" />
                    <h4 className="font-bold text-slate-900 dark:text-white">
                      Sin receta configurada
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed text-[11px]">
                      Este producto preparado no tiene una receta activa con ingredientes asociados. Configúrala en el módulo de Recetas para que NEGOVA calcule su disponibilidad automática a partir de tus existencias de insumos y descuente ingredientes en cada venta.
                    </p>
                    <div className="pt-2">
                      <Link
                        href={`/workspace/${businessId}/recetas`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#ED500A] hover:bg-[#ED500A]/90 transition-all shadow-xs"
                      >
                        <ChefHat className="w-4 h-4" />
                        <span>Configurar receta en el módulo</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ============================================================ */
              /* VISTA PARA PRODUCTOS DIRECTOS E INSUMOS (EXISTENCIAS FÍSICAS)*/
              /* ============================================================ */
              <>
                {/* 1. Métricas Principales */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl text-center">
                    <span className="text-[11px] font-medium text-slate-400 block">Existencia actual</span>
                    <span className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-0.5 block">
                      {item.currentStock} {item.unit}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl text-center relative group">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-[11px] font-medium text-slate-400">Stock mínimo</span>
                      {!isEditingMinStock && (
                        <button
                          type="button"
                          onClick={() => setIsEditingMinStock(true)}
                          className="text-slate-400 hover:text-[#ED500A] p-0.5 rounded transition-colors cursor-pointer"
                          title="Editar nivel de stock mínimo"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {isEditingMinStock ? (
                      <div className="mt-1 flex items-center justify-center gap-1">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={minStockInput}
                          onChange={(e) => setMinStockInput(e.target.value)}
                          className="w-16 px-1.5 py-0.5 text-xs text-center font-mono font-bold bg-white dark:bg-[#0D0F16] border border-[#ED500A] rounded-lg text-slate-900 dark:text-white focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          disabled={isSavingMinStock}
                          onClick={handleSaveMinStock}
                          className="p-1 rounded bg-[#ED500A] text-white hover:bg-[#ED500A]/90 transition-colors cursor-pointer disabled:opacity-50"
                          title="Guardar"
                        >
                          {isSavingMinStock ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        </button>
                        <button
                          type="button"
                          disabled={isSavingMinStock}
                          onClick={() => {
                            setMinStockInput(String(currentMinStock));
                            setIsEditingMinStock(false);
                          }}
                          className="p-1 rounded bg-slate-200 dark:bg-white/[0.1] text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition-colors cursor-pointer"
                          title="Cancelar"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-lg font-bold font-mono text-slate-700 dark:text-slate-300 mt-0.5 block">
                        {currentMinStock > 0 ? `${currentMinStock} ${item.unit}` : "—"}
                      </span>
                    )}
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl text-center">
                    <span className="text-[11px] font-medium text-slate-400 block">Costo unitario</span>
                    <span className="text-lg font-bold font-mono text-slate-700 dark:text-slate-300 mt-0.5 block">
                      {item.cost > 0 ? formatCOP(item.cost) : "—"}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl text-center">
                    <span className="text-[11px] font-medium text-slate-400 block">Valor total</span>
                    <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                      {item.totalValue > 0 ? formatCOP(item.totalValue) : "—"}
                    </span>
                  </div>
                </div>

                {/* 2. Variantes si existen */}
                {item.hasVariants && item.variants.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-purple-500" />
                      <span>Presentaciones y variantes ({item.variants.length})</span>
                    </span>
                    <div className="border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-white/[0.04]">
                      {item.variants.map((v: any) => (
                        <div
                          key={v.id || v.name}
                          className="p-2.5 px-3.5 flex items-center justify-between text-xs hover:bg-slate-50/50 dark:hover:bg-white/[0.02]"
                        >
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-white block">
                              {v.name}
                            </span>
                            {v.sku && (
                              <span className="text-[10px] font-mono text-slate-400">
                                SKU: {v.sku}
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200 block">
                              {formatCOP(v.price || 0)}
                            </span>
                            {v.stock_quantity !== undefined && (
                              <span className="text-[10px] text-slate-400">
                                Stock: {v.stock_quantity} un
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Historial reciente de movimientos */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <History className="w-4 h-4 text-[#ED500A]" />
                      <span>Historial de movimientos de este artículo</span>
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {movements.length} {movements.length === 1 ? "registro" : "registros"}
                    </span>
                  </div>

                  {isLoadingMovements ? (
                    <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#ED500A]" />
                      <span>Cargando trazabilidad...</span>
                    </div>
                  ) : movements.length === 0 ? (
                    <div className="p-6 text-center rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.06] text-xs text-slate-400 space-y-1">
                      <Clock className="w-5 h-5 mx-auto text-slate-300 dark:text-slate-600 mb-1" />
                      <p className="font-semibold text-slate-600 dark:text-slate-300">
                        Sin movimientos registrados todavía
                      </p>
                      <p className="text-[11px]">
                        Los ajustes, ventas, compras o mermas asociadas aparecerán aquí.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-white/[0.04]">
                      {movements.map((m) => {
                        const isPositive =
                          m.movementType === "entry" ||
                          m.movementType === "transfer_in" ||
                          (m.movementType === "adjustment" && m.notes?.includes("Dif: +"));
                        const isNegative =
                          m.movementType === "exit" ||
                          m.movementType === "transfer_out" ||
                          m.movementType === "spoilage" ||
                          m.movementType === "sale" ||
                          (m.movementType === "adjustment" && m.notes?.includes("Dif: -"));

                        return (
                          <div
                            key={m.id}
                            className="p-3 px-3.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                    m.movementType === "entry"
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                      : m.movementType === "exit" || m.movementType === "spoilage"
                                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                      : m.movementType === "sale"
                                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                      : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                  }`}
                                >
                                  {m.movementType === "entry"
                                    ? "Entrada"
                                    : m.movementType === "exit"
                                    ? "Salida"
                                    : m.movementType === "sale"
                                    ? "Venta"
                                    : m.movementType === "spoilage"
                                    ? "Merma"
                                    : "Ajuste"}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  {formatDate(m.createdAt)}
                                </span>
                              </div>
                              {m.notes && (
                                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 truncate">
                                  {m.notes}
                                </p>
                              )}
                              {m.createdByName && (
                                <span className="text-[10px] text-slate-400 mt-0.5 block">
                                  Por: {m.createdByName}
                                </span>
                              )}
                            </div>

                            <div className="text-right shrink-0">
                              <span
                                className={`font-mono font-bold text-xs ${
                                  isPositive
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : isNegative
                                    ? "text-rose-600 dark:text-rose-400"
                                    : "text-slate-900 dark:text-white"
                                }`}
                              >
                                {isPositive ? `+${m.quantity}` : isNegative ? `-${m.quantity}` : m.quantity} {item.unit}
                              </span>
                              {typeof m.unitCost === "number" && m.unitCost > 0 && (
                                <span className="text-[10px] font-mono text-slate-400 block">
                                  c/u {formatCOP(m.unitCost)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 px-5 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              Cerrar
            </button>

            {item.controlType === "recipe" ? (
              <Link
                href={`/workspace/${businessId}/recetas`}
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition-all shadow-xs cursor-pointer"
              >
                <ChefHat className="w-3.5 h-3.5" />
                <span>{item.recipeId ? "Ver receta en el módulo" : "Crear receta"}</span>
              </Link>
            ) : (
              <button
                onClick={() => {
                  onClose();
                  onOpenAdjustment(item);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#ED500A] hover:bg-[#ED500A]/90 transition-all shadow-xs cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Ajustar existencia</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
