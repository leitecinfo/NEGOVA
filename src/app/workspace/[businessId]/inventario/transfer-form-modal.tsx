"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import {
  X,
  ArrowRightLeft,
  ArrowRight,
  Package,
  Layers,
  Trash2,
  Plus,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Search,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Location, TransferItemInput } from "@/lib/inventory/types";
import { transferStockAction, getInventoryStockAction } from "./actions";
import { getProductsAction } from "../productos/actions";
import { Product } from "@/lib/products/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  locations: Location[];
  initialSourceLocationId?: string;
  onSuccess: () => void;
}

interface StagedTransferItem {
  id: string;
  productId: string;
  productName: string;
  productSku?: string | null;
  quantity: number;
  availableOriginStock: number;
}

export function TransferFormModal({
  isOpen,
  onClose,
  businessId,
  locations,
  initialSourceLocationId,
  onSuccess,
}: Props) {
  const [sourceLocationId, setSourceLocationId] = useState<string>("");
  const [destinationLocationId, setDestinationLocationId] = useState<string>("");

  // Catálogo de productos y existencias en la ubicación origen
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(false);
  const [sourceStockMap, setSourceStockMap] = useState<Record<string, number>>({});
  const [isLoadingStock, setIsLoadingStock] = useState<boolean>(false);

  // Formulario de selección de ítem
  const [productSearch, setProductSearch] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantityInput, setQuantityInput] = useState<string>("1");
  const [notes, setNotes] = useState<string>("");

  // Lista preparada para la transferencia
  const [stagedItems, setStagedItems] = useState<StagedTransferItem[]>([]);
  const [isPending, startTransition] = useTransition();

  // Inicializar ubicaciones cuando se abre el modal
  useEffect(() => {
    if (!isOpen) return;

    if (locations.length >= 2) {
      const srcId = initialSourceLocationId || locations[0].id;
      setSourceLocationId(srcId);
      const destCandidate = locations.find((l) => l.id !== srcId);
      setDestinationLocationId(destCandidate ? destCandidate.id : "");
    } else if (locations.length === 1) {
      setSourceLocationId(locations[0].id);
      setDestinationLocationId("");
    }
    setStagedItems([]);
    setSelectedProduct(null);
    setProductSearch("");
    setQuantityInput("1");
    setNotes("");
  }, [isOpen, locations, initialSourceLocationId]);

  // Cargar productos del comercio
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadProducts() {
      setIsLoadingProducts(true);
      try {
        const res = await getProductsAction(businessId);
        if (isMounted && res.success && res.data) {
          setProducts(res.data);
        }
      } catch (err) {
        console.error("Error al cargar productos para transferencia:", err);
      } finally {
        if (isMounted) setIsLoadingProducts(false);
      }
    }

    loadProducts();
    return () => {
      isMounted = false;
    };
  }, [isOpen, businessId]);

  // Cargar existencias en la ubicación de origen seleccionada
  useEffect(() => {
    if (!isOpen || !sourceLocationId) return;

    let isMounted = true;
    async function loadStock() {
      setIsLoadingStock(true);
      try {
        const res = await getInventoryStockAction(businessId, { locationId: sourceLocationId });
        if (isMounted && res.success && res.data) {
          const map: Record<string, number> = {};
          res.data.forEach((s) => {
            map[s.productId] = Number(s.quantity || 0);
          });
          setSourceStockMap(map);
        }
      } catch (err) {
        console.error("Error al consultar stock de origen:", err);
      } finally {
        if (isMounted) setIsLoadingStock(false);
      }
    }

    loadStock();
    return () => {
      isMounted = false;
    };
  }, [isOpen, businessId, sourceLocationId]);

  // Filtrado de productos por búsqueda
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 8);
    const q = productSearch.toLowerCase().trim();
    return products
      .filter((p) => {
        const nameMatch = p.name.toLowerCase().includes(q);
        const skuMatch = (p.metadata as any)?.sku?.toLowerCase().includes(q);
        return nameMatch || skuMatch;
      })
      .slice(0, 10);
  }, [products, productSearch]);

  // Stock disponible del producto actualmente seleccionado
  const currentAvailableStock = useMemo(() => {
    if (!selectedProduct) return 0;
    return sourceStockMap[selectedProduct.id] ?? 0;
  }, [selectedProduct, sourceStockMap]);

  // Manejo de agregar a la lista
  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!selectedProduct) {
      toast.error("Selección incompleta", {
        description: "Por favor busca y selecciona un producto a transferir.",
      });
      return;
    }

    const qty = parseFloat(quantityInput);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Cantidad inválida", {
        description: "La cantidad a transferir debe ser mayor a 0.",
      });
      return;
    }

    // Comprobar si ya está en la lista preparada para validar el acumulado
    const alreadyStaged = stagedItems.find((it) => it.productId === selectedProduct.id);
    const totalProposedQty = (alreadyStaged ? alreadyStaged.quantity : 0) + qty;

    if (totalProposedQty > currentAvailableStock) {
      toast.error("Existencias insuficientes", {
        description: `El stock disponible en origen es de ${currentAvailableStock} unidades. No puedes transferir más de lo disponible.`,
      });
      return;
    }

    if (alreadyStaged) {
      setStagedItems((prev) =>
        prev.map((it) =>
          it.productId === selectedProduct.id
            ? { ...it, quantity: it.quantity + qty }
            : it
        )
      );
      toast.info(`Cantidad actualizada para ${selectedProduct.name}`, {
        description: `Total a transferir: ${totalProposedQty} unidades.`,
      });
    } else {
      setStagedItems((prev) => [
        ...prev,
        {
          id: `transfer-item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          productSku: (selectedProduct.metadata as any)?.sku || null,
          quantity: qty,
          availableOriginStock: currentAvailableStock,
        },
      ]);
    }

    // Resetear selección
    setSelectedProduct(null);
    setProductSearch("");
    setQuantityInput("1");
  };

  const handleRemoveItem = (id: string) => {
    setStagedItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Enviar la transferencia atómica
  const handleExecuteTransfer = () => {
    if (!sourceLocationId || !destinationLocationId) {
      toast.error("Ubicaciones requeridas", {
        description: "Debes seleccionar la ubicación origen y la ubicación destino.",
      });
      return;
    }

    if (sourceLocationId === destinationLocationId) {
      toast.error("Ubicaciones idénticas", {
        description: "La ubicación de origen y destino deben ser diferentes.",
      });
      return;
    }

    // Si no ha agregado ítems a la tabla pero tiene un producto seleccionado en los inputs
    let itemsToTransfer: TransferItemInput[] = stagedItems.map((it) => ({
      productId: it.productId,
      quantity: it.quantity,
    }));

    if (itemsToTransfer.length === 0 && selectedProduct) {
      const qty = parseFloat(quantityInput);
      if (!isNaN(qty) && qty > 0) {
        if (qty > currentAvailableStock) {
          toast.error("Existencias insuficientes", {
            description: `Stock disponible en origen: ${currentAvailableStock}. Solicitado: ${qty}.`,
          });
          return;
        }
        itemsToTransfer = [{ productId: selectedProduct.id, quantity: qty }];
      }
    }

    if (itemsToTransfer.length === 0) {
      toast.error("Transferencia vacía", {
        description: "Agrega al menos un producto con cantidad válida para transferir.",
      });
      return;
    }

    const sourceName = locations.find((l) => l.id === sourceLocationId)?.name || "Origen";
    const destName = locations.find((l) => l.id === destinationLocationId)?.name || "Destino";

    startTransition(async () => {
      try {
        const res = await transferStockAction(businessId, {
          sourceLocationId,
          destinationLocationId,
          items: itemsToTransfer,
          notes: notes.trim() || null,
        });

        if (res.success && res.data) {
          toast.success("Transferencia completada", {
            description: `Se transfirieron ${itemsToTransfer.length} producto(s) desde ${sourceName} hacia ${destName}.`,
          });
          onSuccess();
          onClose();
        } else {
          toast.error("Error en la transferencia", {
            description: res.error || "No se pudo completar la transferencia entre ubicaciones.",
          });
        }
      } catch (err: any) {
        toast.error("Fallo inesperado", {
          description: err.message || "Ocurrió un error al procesar la transferencia.",
        });
      }
    });
  };

  if (!isOpen) return null;

  const totalUnits = stagedItems.reduce((acc, it) => acc + it.quantity, 0);
  const sourceLoc = locations.find((l) => l.id === sourceLocationId);
  const destLoc = locations.find((l) => l.id === destinationLocationId);
  const isSameLocation = sourceLocationId && destinationLocationId && sourceLocationId === destinationLocationId;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
        <div className="bg-white dark:bg-[#0E131F] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]">
          {/* ENCABEZADO */}
          <div className="flex items-center justify-between p-5 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Transferencia entre Ubicaciones
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Mueve existencias físicas entre bodegas, almacenes y puntos de venta
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isPending}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* CUERPO DEL MODAL */}
          <div className="p-5 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
            {locations.length < 2 && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Se requieren al menos 2 ubicaciones</p>
                  <p className="mt-0.5 text-amber-600 dark:text-amber-400/90">
                    Para realizar transferencias internas debes tener creada al menos una bodega, sucursal o punto de venta adicional en la pestaña "Ubicaciones".
                  </p>
                </div>
              </div>
            )}

            {/* SELECTOR DE UBICACIONES ORIGEN Y DESTINO */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08]">
              {/* Origen */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ubicación Origen</span>
                </label>
                <select
                  value={sourceLocationId}
                  onChange={(e) => {
                    const newSource = e.target.value;
                    setSourceLocationId(newSource);
                    // Si el destino es el mismo, mover a otro si es posible
                    if (destinationLocationId === newSource) {
                      const other = locations.find((l) => l.id !== newSource);
                      setDestinationLocationId(other ? other.id : "");
                    }
                    // Resetear items preparados al cambiar de origen para evitar inconsistencias de stock
                    if (stagedItems.length > 0) {
                      setStagedItems([]);
                      toast.info("Lista de transferencia reiniciada por cambio de origen.");
                    }
                  }}
                  disabled={isPending || locations.length < 2}
                  className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-300 dark:border-white/[0.12] bg-white dark:bg-[#121826] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.type === "warehouse" ? "Bodega" : loc.type === "branch" ? "Sucursal" : "POS"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Destino */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-purple-500" />
                  <span>Ubicación Destino</span>
                </label>
                <select
                  value={destinationLocationId}
                  onChange={(e) => setDestinationLocationId(e.target.value)}
                  disabled={isPending || locations.length < 2}
                  className={`w-full text-xs font-medium px-3 py-2 rounded-xl border ${
                    isSameLocation
                      ? "border-rose-400 bg-rose-50/20 text-rose-600 dark:text-rose-400"
                      : "border-slate-300 dark:border-white/[0.12] bg-white dark:bg-[#121826] text-slate-900 dark:text-white"
                  } focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all`}
                >
                  <option value="" disabled>
                    Selecciona destino...
                  </option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id} disabled={loc.id === sourceLocationId}>
                      {loc.name} {loc.id === sourceLocationId ? "(Misma que origen)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Indicador visual de ruta */}
              {sourceLoc && destLoc && !isSameLocation && (
                <div className="md:col-span-2 pt-2 flex items-center justify-center text-2xs text-purple-600 dark:text-purple-400 font-semibold gap-2">
                  <span className="truncate max-w-[180px]">{sourceLoc.name}</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate max-w-[180px]">{destLoc.name}</span>
                </div>
              )}

              {isSameLocation && (
                <div className="md:col-span-2 pt-1 text-2xs text-rose-500 font-semibold text-center">
                  El origen y el destino no pueden ser la misma ubicación.
                </div>
              )}
            </div>

            {/* SECCIÓN AGREGAR PRODUCTO A LA TRANSFERENCIA */}
            <div className="space-y-3 p-4 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121826]">
              <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-purple-500" />
                <span>Agregar Producto a Transferir</span>
              </h4>

              {/* Buscador de producto */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar producto por nombre o SKU..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  disabled={isPending || isLoadingProducts}
                  className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-white/[0.12] bg-slate-50/50 dark:bg-white/[0.02] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                />
              </div>

              {/* Lista filtrada de productos */}
              {productSearch.trim() && (
                <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200/80 dark:border-white/[0.08] divide-y divide-slate-100 dark:divide-white/[0.04] bg-white dark:bg-[#0E131F]">
                  {filteredProducts.length === 0 ? (
                    <div className="p-3 text-center text-2xs text-slate-400">
                      No se encontraron productos coincidentes
                    </div>
                  ) : (
                    filteredProducts.map((p) => {
                      const avail = sourceStockMap[p.id] ?? 0;
                      const isSelected = selectedProduct?.id === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedProduct(p);
                            setProductSearch(p.name);
                          }}
                          className={`w-full p-2.5 text-left text-xs flex items-center justify-between transition-colors ${
                            isSelected
                              ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold"
                              : "hover:bg-slate-50 dark:hover:bg-white/[0.02] text-slate-700 dark:text-slate-200"
                          }`}
                        >
                          <div>
                            <p className="font-semibold">{p.name}</p>
                            {(p.metadata as any)?.sku && (
                              <p className="text-2xs text-slate-400">
                                SKU: {(p.metadata as any).sku}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold ${
                                avail > 0
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              Stock origen: {avail}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {/* Producto seleccionado & Cantidad */}
              {selectedProduct && (
                <div className="p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {selectedProduct.name}
                      </p>
                      <p className="text-2xs text-slate-500 dark:text-slate-400">
                        Disponible en {sourceLoc?.name || "origen"}:{" "}
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          {currentAvailableStock} unidades
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProduct(null);
                        setProductSearch("");
                      }}
                      className="text-2xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline"
                    >
                      Cambiar
                    </button>
                  </div>

                  <div className="flex items-end gap-2.5">
                    <div className="flex-1 space-y-1">
                      <label className="text-2xs font-semibold text-slate-600 dark:text-slate-400">
                        Cantidad a Transferir
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={currentAvailableStock}
                        value={quantityInput}
                        onChange={(e) => setQuantityInput(e.target.value)}
                        className="w-full text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-300 dark:border-white/[0.12] bg-white dark:bg-[#121826] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      disabled={currentAvailableStock <= 0}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-98 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar a la lista</span>
                    </button>
                  </div>

                  {currentAvailableStock <= 0 && (
                    <p className="text-2xs text-rose-500 font-semibold">
                      Este producto no tiene existencias disponibles en la ubicación de origen.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* TABLA DE ÍTEMS PREPARADOS (STAGED) */}
            {stagedItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-purple-500" />
                    <span>Productos en la Transferencia ({stagedItems.length})</span>
                  </h4>
                  <span className="text-2xs font-semibold text-slate-500 dark:text-slate-400">
                    Total: {totalUnits} unidades
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] overflow-hidden bg-white dark:bg-[#0E131F]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/[0.08] text-slate-500 text-2xs font-semibold uppercase">
                      <tr>
                        <th className="py-2 px-3">Producto</th>
                        <th className="py-2 px-3 text-right">Cant. Transferir</th>
                        <th className="py-2 px-3 text-right">Remanente Origen</th>
                        <th className="py-2 px-3 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                      {stagedItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01]">
                          <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">
                            <div>
                              <span>{item.productName}</span>
                              {item.productSku && (
                                <span className="block text-2xs text-slate-400 font-normal">
                                  SKU: {item.productSku}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-purple-600 dark:text-purple-400">
                            {item.quantity}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-500 dark:text-slate-400">
                            {item.availableOriginStock - item.quantity}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* NOTAS DE LA TRANSFERENCIA */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Notas / Motivo de la Operación (opcional)
              </label>
              <textarea
                rows={2}
                placeholder="p. ej. Reabastecimiento de barra para el turno nocturno, traslado por evento especial..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isPending}
                className="w-full text-xs p-3 rounded-xl border border-slate-300 dark:border-white/[0.12] bg-white dark:bg-[#121826] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 resize-none transition-all"
              />
            </div>
          </div>

          {/* PIE DEL MODAL CON BOTONES */}
          <div className="p-4 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {stagedItems.length > 0 ? (
                <span>
                  {stagedItems.length} producto(s) &bull; {totalUnits} unidades
                </span>
              ) : selectedProduct ? (
                <span>1 producto seleccionado</span>
              ) : (
                <span>Ningún producto agregado</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteTransfer}
                disabled={
                  isPending ||
                  locations.length < 2 ||
                  isSameLocation ||
                  (stagedItems.length === 0 && !selectedProduct)
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-98"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Transfiriendo...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {stagedItems.length > 0
                        ? `Transferir ${totalUnits} unidad(es)`
                        : "Completar Transferencia"}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
