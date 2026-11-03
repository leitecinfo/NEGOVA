"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import {
  X,
  Plus,
  Trash2,
  Package,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  Sliders,
  AlertCircle,
  CheckCircle2,
  Loader2,
  DollarSign,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Location, MovementType } from "@/lib/inventory/types";
import { recordInventoryMovementsBatchAction, getInventoryStockAction } from "./actions";
import { formatCOP, formatNumberWithDots, parseNumberFromDots } from "@/lib/pos/types";
import { getProductsAction } from "../productos/actions";
import { Product } from "@/lib/products/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  locations: Location[];
  initialLocationId?: string;
  onSuccess: () => void;
}

interface StagedMovement {
  id: string;
  productId: string;
  productName: string;
  sku?: string | null;
  locationId: string;
  locationName: string;
  movementType: "entry" | "exit" | "adjustment";
  quantity: number;
  unitCost: number;
  totalCost: number;
  notes?: string;
  currentStock: number;
}

export function MovementFormModal({
  isOpen,
  onClose,
  businessId,
  locations,
  initialLocationId,
  onSuccess,
}: Props) {
  const [selectedLocationId, setSelectedLocationId] = useState<string>(
    initialLocationId || locations[0]?.id || ""
  );

  // Catálogo de productos disponibles
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(false);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});

  // Campos del formulario individual
  const [productSearch, setProductSearch] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [movementType, setMovementType] = useState<"entry" | "exit" | "adjustment">("entry");
  const [quantityInput, setQuantityInput] = useState<string>("1");
  const [costInput, setCostInput] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Lista temporal para operaciones en lote
  const [stagedItems, setStagedItems] = useState<StagedMovement[]>([]);
  const [isPending, startTransition] = useTransition();

  // Sincronizar ubicación inicial
  useEffect(() => {
    if (initialLocationId) {
      setSelectedLocationId(initialLocationId);
    } else if (locations.length > 0 && !selectedLocationId) {
      setSelectedLocationId(locations[0].id);
    }
  }, [initialLocationId, locations, selectedLocationId]);

  // Cargar catálogo de productos y existencias de la ubicación seleccionada
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadCatalog() {
      setIsLoadingProducts(true);
      try {
        const [prodRes, stockRes] = await Promise.all([
          getProductsAction(businessId),
          selectedLocationId ? getInventoryStockAction(businessId, { locationId: selectedLocationId }) : null,
        ]);

        if (!isMounted) return;

        if (prodRes.success && prodRes.data) {
          setProducts(prodRes.data.filter((p: Product) => (p as any).status !== "archived"));
        }

        if (stockRes && stockRes.success && stockRes.data) {
          const map: Record<string, number> = {};
          stockRes.data.forEach((s: any) => {
            map[s.productId] = s.quantity;
          });
          setStockMap(map);
        }
      } catch (err: any) {
        toast.error("Error al cargar productos de inventario", {
          description: err?.message,
        });
      } finally {
        if (isMounted) setIsLoadingProducts(false);
      }
    }

    loadCatalog();

    return () => {
      isMounted = false;
    };
  }, [isOpen, businessId, selectedLocationId]);

  // Cuando se selecciona un producto, sugerir su costo
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setProductSearch(product.name);
    const cost = (product.metadata as any)?.cost || 0;
    setCostInput(cost > 0 ? formatNumberWithDots(cost) : "");
  };

  // Stock disponible actual del producto en la ubicación seleccionada
  const currentStockForSelected = useMemo(() => {
    if (!selectedProduct) return 0;
    return stockMap[selectedProduct.id] ?? 0;
  }, [selectedProduct, stockMap]);

  // Filtrado de productos en el buscador
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 8);
    const term = productSearch.toLowerCase();
    return products
      .filter((p) => {
        const nameMatch = p.name.toLowerCase().includes(term);
        const skuMatch = (p.metadata as any)?.sku?.toLowerCase()?.includes(term);
        return nameMatch || skuMatch;
      })
      .slice(0, 10);
  }, [products, productSearch]);

  const activeLocation = useMemo(() => {
    return locations.find((l) => l.id === selectedLocationId) || locations[0];
  }, [locations, selectedLocationId]);

  // Validación y adición a la lista temporal
  const handleAddToStaged = () => {
    if (!selectedProduct) {
      toast.error("Por favor selecciona un producto para registrar el movimiento.");
      return;
    }

    if (!selectedLocationId) {
      toast.error("Debes seleccionar una ubicación válida.");
      return;
    }

    const qty = parseFloat(quantityInput);
    if (isNaN(qty) || (movementType !== "adjustment" && qty <= 0) || (movementType === "adjustment" && qty < 0)) {
      toast.error(
        movementType === "adjustment"
          ? "La cantidad para el ajuste de inventario debe ser 0 o superior."
          : "La cantidad debe ser mayor a 0."
      );
      return;
    }

    // Regla de negocio: la salida no puede exceder el stock disponible
    if (movementType === "exit" && qty > currentStockForSelected) {
      toast.error("Existencias insuficientes para realizar la salida", {
        description: `El stock disponible de «${selectedProduct.name}» es de ${currentStockForSelected} unidades.`,
      });
      return;
    }

    const unitCost = costInput ? parseNumberFromDots(costInput) : (selectedProduct.metadata as any)?.cost || 0;
    const totalCost = Number((unitCost * qty).toFixed(2));

    const newItem: StagedMovement = {
      id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      sku: (selectedProduct.metadata as any)?.sku || null,
      locationId: selectedLocationId,
      locationName: activeLocation?.name || "Ubicación",
      movementType,
      quantity: qty,
      unitCost,
      totalCost,
      notes: notes.trim() || undefined,
      currentStock: currentStockForSelected,
    };

    setStagedItems((prev) => [...prev, newItem]);

    // Limpiar selección para el próximo producto
    setSelectedProduct(null);
    setProductSearch("");
    setQuantityInput("1");
    setNotes("");
    toast.success(`«${selectedProduct.name}» agregado a la lista`);
  };

  const handleRemoveStaged = (id: string) => {
    setStagedItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Totales acumulados de la lista en lote
  const summary = useMemo(() => {
    const totalCount = stagedItems.length;
    const totalUnits = stagedItems.reduce((sum, it) => sum + it.quantity, 0);
    const totalValue = stagedItems.reduce((sum, it) => sum + it.totalCost, 0);
    return { totalCount, totalUnits, totalValue };
  }, [stagedItems]);

  // Envío final del lote al servidor
  const handleSubmitBatch = () => {
    // Si no agregó con el botón "+ Agregar a la lista" pero tiene un producto listo en el formulario
    let itemsToSubmit = [...stagedItems];

    if (itemsToSubmit.length === 0) {
      if (!selectedProduct) {
        toast.error("Agrega al menos un movimiento a la lista antes de registrar.");
        return;
      }

      const qty = parseFloat(quantityInput);
      if (isNaN(qty) || (movementType !== "adjustment" && qty <= 0) || (movementType === "adjustment" && qty < 0)) {
        toast.error("Ingresa una cantidad válida.");
        return;
      }

      if (movementType === "exit" && qty > currentStockForSelected) {
        toast.error("Existencias insuficientes para realizar la salida", {
          description: `El stock disponible actual es de ${currentStockForSelected} unidades.`,
        });
        return;
      }

      const unitCost = costInput ? parseNumberFromDots(costInput) : (selectedProduct.metadata as any)?.cost || 0;
      const totalCost = Number((unitCost * qty).toFixed(2));

      itemsToSubmit = [
        {
          id: `mov_direct`,
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          sku: (selectedProduct.metadata as any)?.sku || null,
          locationId: selectedLocationId,
          locationName: activeLocation?.name || "Ubicación",
          movementType,
          quantity: qty,
          unitCost,
          totalCost,
          notes: notes.trim() || undefined,
          currentStock: currentStockForSelected,
        },
      ];
    }

    startTransition(async () => {
      try {
        const payload = itemsToSubmit.map((it) => ({
          productId: it.productId,
          locationId: it.locationId,
          movementType: it.movementType,
          quantity: it.quantity,
          unitCost: it.unitCost,
          totalCost: it.totalCost,
          notes: it.notes || undefined,
        }));

        const res = await recordInventoryMovementsBatchAction(businessId, payload);

        if (!res.success) {
          toast.error("Error al registrar movimientos", {
            description: res.error,
          });
          return;
        }

        toast.success(
          itemsToSubmit.length === 1
            ? "Movimiento de inventario registrado correctamente"
            : `${itemsToSubmit.length} movimientos de inventario registrados exitosamente`
        );

        // Reset
        setStagedItems([]);
        setSelectedProduct(null);
        setProductSearch("");
        setQuantityInput("1");
        setNotes("");
        onSuccess();
        onClose();
      } catch (err: any) {
        toast.error("Error inesperado al registrar movimientos", {
          description: err?.message,
        });
      }
    });
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        >
          {/* HEADER */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200/80 dark:border-white/[0.08] shrink-0 bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Registrar Movimientos de Inventario
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Registra entradas, salidas o ajustes físicos en las existencias de tus bodegas.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={isPending}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* CONTENIDO SCROLLEABLE */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-5">
            {/* 1. SELECTOR DE UBICACIÓN */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Ubicación / Bodega de destino *
              </label>
              <select
                value={selectedLocationId}
                onChange={(e) => {
                  setSelectedLocationId(e.target.value);
                  setSelectedProduct(null);
                  setProductSearch("");
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50/50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/50 transition-all cursor-pointer"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.type === "warehouse" ? "Bodega" : "Punto de Venta"})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. TIPO DE MOVIMIENTO */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Tipo de movimiento *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {/* Entrada */}
                <button
                  type="button"
                  onClick={() => setMovementType("entry")}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    movementType === "entry"
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-xs"
                      : "bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>Entrada (+)</span>
                </button>

                {/* Salida */}
                <button
                  type="button"
                  onClick={() => setMovementType("exit")}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    movementType === "exit"
                      ? "bg-red-500/10 border-red-500 text-red-600 dark:text-red-400 shadow-xs"
                      : "bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Salida (-)</span>
                </button>

                {/* Ajuste */}
                <button
                  type="button"
                  onClick={() => setMovementType("adjustment")}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    movementType === "adjustment"
                      ? "bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 shadow-xs"
                      : "bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <Sliders className="w-4 h-4" />
                  <span>Ajuste (=)</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {movementType === "entry" && "Incrementa las existencias del producto en la ubicación."}
                {movementType === "exit" && "Reduce las existencias. No permite dejar el inventario en negativo."}
                {movementType === "adjustment" && "Fija el conteo físico exacto de existencias (establece el valor indicado)."}
              </p>
            </div>

            {/* 3. BUSCADOR DE PRODUCTOS CON STOCK DISPONIBLE */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Producto de catálogo *
                </label>
                {selectedProduct && (
                  <span className="text-xs font-medium text-slate-500">
                    Stock actual en {activeLocation?.name}:{" "}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {currentStockForSelected} un.
                    </strong>
                  </span>
                )}
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar producto por nombre o SKU..."
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    if (selectedProduct && e.target.value !== selectedProduct.name) {
                      setSelectedProduct(null);
                    }
                  }}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50/50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#ED500A]/50 transition-all"
                />
              </div>

              {/* Lista sugerida si no está seleccionado aún */}
              {!selectedProduct && productSearch.trim().length > 0 && (
                <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-white/[0.08] rounded-xl bg-white dark:bg-[#0E131F] divide-y divide-slate-100 dark:divide-white/[0.04] shadow-md">
                  {isLoadingProducts ? (
                    <div className="p-3 text-center text-xs text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin inline-block mr-1.5" />
                      Cargando catálogo...
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400">
                      No se encontraron productos coincidentes.
                    </div>
                  ) : (
                    filteredProducts.map((p) => {
                      const availStock = stockMap[p.id] ?? 0;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectProduct(p)}
                          className="w-full p-2.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-between transition-colors cursor-pointer"
                        >
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-white">{p.name}</span>
                            {(p.metadata as any)?.sku && (
                              <span className="text-2xs text-slate-400 block">
                                SKU: {(p.metadata as any).sku}
                              </span>
                            )}
                          </div>
                          <span className="text-2xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 font-bold text-slate-700 dark:text-slate-300">
                            {availStock} en stock
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* 4. CANTIDAD, COSTO Y NOTAS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {movementType === "adjustment" ? "Nuevo Stock Físico (Conteo Exacto) *" : "Cantidad a Mover *"}
                </label>
                <input
                  type="number"
                  step="any"
                  min={movementType === "adjustment" ? "0" : "0.01"}
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(e.target.value)}
                  placeholder={movementType === "adjustment" ? "Ej. 25" : "Ej. 10"}
                  className="w-full px-3.5 py-2.5 bg-slate-50/50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#ED500A]/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Costo Unitario (COP)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={costInput}
                    onChange={(e) => setCostInput(formatNumberWithDots(e.target.value))}
                    placeholder="0"
                    className="w-full pl-7 pr-3.5 py-2.5 bg-slate-50/50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#ED500A]/50 transition-all"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Notas / Motivo del Movimiento
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. Factura proveedor #4912, Conteo mensual, Merma operativa..."
                className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#ED500A]/50 transition-all"
              />
            </div>

            {/* BOTÓN AGREGAR A LA LISTA */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleAddToStaged}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-98"
              >
                <Plus className="w-4 h-4 text-[#ED500A]" />
                <span>+ Agregar a la lista</span>
              </button>
            </div>

            {/* 5. LISTA DE MOVIMIENTOS EN LOTE PREPARADOS */}
            {stagedItems.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-slate-200/80 dark:border-white/[0.08] animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Operaciones en Lote ({stagedItems.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => setStagedItems([])}
                    className="text-2xs text-red-500 hover:underline font-semibold"
                  >
                    Limpiar lista
                  </button>
                </div>

                <div className="border border-slate-200/80 dark:border-white/[0.08] rounded-xl overflow-hidden bg-slate-50/50 dark:bg-white/[0.01]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/70 dark:bg-white/[0.03] text-slate-500 font-semibold text-2xs uppercase">
                      <tr>
                        <th className="py-2 px-3">Tipo</th>
                        <th className="py-2 px-3">Producto</th>
                        <th className="py-2 px-3">Ubicación</th>
                        <th className="py-2 px-3 text-right">Cant.</th>
                        <th className="py-2 px-3 text-right">Costo Total</th>
                        <th className="py-2 px-2 text-center w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.04]">
                      {stagedItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-100/40 dark:hover:bg-white/[0.02]">
                          <td className="py-2 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded-md font-bold text-3xs uppercase ${
                                item.movementType === "entry"
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : item.movementType === "exit"
                                  ? "bg-red-500/10 text-red-600"
                                  : "bg-blue-500/10 text-blue-600"
                              }`}
                            >
                              {item.movementType === "entry" ? "Entrada" : item.movementType === "exit" ? "Salida" : "Ajuste"}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            {item.productName}
                          </td>
                          <td className="py-2 px-3 text-slate-500 text-2xs">{item.locationName}</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">
                            {item.movementType === "entry" ? `+${item.quantity}` : item.movementType === "exit" ? `-${item.quantity}` : `=${item.quantity}`}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">
                            {formatCOP(item.totalCost)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveStaged(item.id)}
                              className="text-slate-400 hover:text-red-500 p-1 rounded-md transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* RESUMEN DEL LOTE */}
                <div className="p-3 bg-slate-100/70 dark:bg-white/[0.03] rounded-xl grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-2xs text-slate-400 block font-medium">Total Productos</span>
                    <strong className="text-slate-800 dark:text-slate-200 font-bold">{summary.totalCount}</strong>
                  </div>
                  <div>
                    <span className="text-2xs text-slate-400 block font-medium">Unidades Totales</span>
                    <strong className="text-slate-800 dark:text-slate-200 font-bold">{summary.totalUnits}</strong>
                  </div>
                  <div>
                    <span className="text-2xs text-slate-400 block font-medium">Costo Total</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{formatCOP(summary.totalValue)}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* FOOTER CON BOTÓN REGISTRAR */}
          <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSubmitBatch}
              disabled={isPending || (stagedItems.length === 0 && !selectedProduct)}
              className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-[#ED500A] hover:bg-[#ED500A]/90 text-white shadow-md shadow-[#ED500A]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2 active:scale-98"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Procesando inventario...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {stagedItems.length > 1
                      ? `Registrar ${stagedItems.length} movimientos`
                      : stagedItems.length === 1
                      ? "Registrar 1 movimiento"
                      : "Registrar movimiento"}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
