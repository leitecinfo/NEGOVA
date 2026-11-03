"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  Package,
  MapPin,
  DollarSign,
  Loader2,
  Check,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Product } from "@/lib/products/types";
import { Location } from "@/lib/inventory/types";
import { executeStockMovementAction } from "./inventory-actions";

interface Props {
  businessId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  products: Product[];
  locations: Location[];
}

export function InventoryMovementModal({
  businessId,
  isOpen,
  onClose,
  onSuccess,
  products,
  locations,
}: Props) {
  const [movementType, setMovementType] = useState<"entry" | "exit" | "adjustment">("entry");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [unitCost, setUnitCost] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inicializar ubicación por defecto si no está seleccionada
  useEffect(() => {
    if (locations.length > 0 && !selectedLocationId) {
      setSelectedLocationId(locations[0].id);
    }
  }, [locations, selectedLocationId]);

  // Si cambia el producto seleccionado, precargar costo si existe
  useEffect(() => {
    if (selectedProductId) {
      const prod = products.find((p) => p.id === selectedProductId);
      if (prod) {
        const cost = (prod.metadata as any)?.cost;
        if (cost !== null && cost !== undefined) {
          setUnitCost(String(cost));
        } else {
          setUnitCost("");
        }
      }
    }
  }, [selectedProductId, products]);

  if (!isOpen) return null;

  const parsedQty = parseFloat(quantity) || 0;
  const parsedCost = parseFloat(unitCost) || 0;
  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const currentStock = (selectedProduct?.metadata as any)?.stock_quantity ?? 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProductId) {
      toast.error("Selecciona un producto para el movimiento");
      return;
    }

    if (!selectedLocationId) {
      toast.error("Selecciona la ubicación física de destino/origen");
      return;
    }

    if (parsedQty <= 0 && movementType !== "adjustment") {
      toast.error("La cantidad debe ser mayor a 0");
      return;
    }

    if (parsedQty < 0 && movementType === "adjustment") {
      toast.error("El ajuste no puede fijar un stock negativo");
      return;
    }

    if (movementType === "exit" && parsedQty > currentStock) {
      toast.error("Stock insuficiente", {
        description: `El stock actual disponible es de ${currentStock} unidades.`,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await executeStockMovementAction(businessId, {
        productId: selectedProductId,
        locationId: selectedLocationId,
        movementType,
        quantity: parsedQty,
        unitCost: parsedCost > 0 ? parsedCost : undefined,
        notes: notes.trim() || undefined,
      });

      if (!res.success) {
        toast.error("Error al registrar movimiento", {
          description: res.error || "No se pudo actualizar el inventario.",
        });
        return;
      }

      toast.success("Movimiento registrado exitosamente", {
        description: `Nuevo stock de "${selectedProduct?.name}": ${res.data?.newQuantity} unidades.`,
      });

      setSelectedProductId("");
      setQuantity("");
      setNotes("");
      onClose();
      onSuccess?.();
    } catch (err: any) {
      toast.error("Error inesperado", {
        description: err.message || "Fallo de conexión.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#0E131F] border border-slate-200 dark:border-white/[0.08] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Cabecera */}
        <div className="px-6 py-4.5 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center border border-[#ED500A]/20">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Registrar Movimiento de Stock
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Entradas, salidas o ajustes directos de inventario.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Tipo de Movimiento */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Tipo de Operación
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMovementType("entry")}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                  movementType === "entry"
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold"
                    : "border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                }`}
              >
                <ArrowDownLeft className="w-4 h-4 mb-1" />
                <span className="text-xs">Entrada (+)</span>
              </button>

              <button
                type="button"
                onClick={() => setMovementType("exit")}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                  movementType === "exit"
                    ? "bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400 font-bold"
                    : "border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                }`}
              >
                <ArrowUpRight className="w-4 h-4 mb-1" />
                <span className="text-xs">Salida (-)</span>
              </button>

              <button
                type="button"
                onClick={() => setMovementType("adjustment")}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                  movementType === "adjustment"
                    ? "bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 font-bold"
                    : "border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                }`}
              >
                <SlidersHorizontal className="w-4 h-4 mb-1" />
                <span className="text-xs">Ajuste (=)</span>
              </button>
            </div>
          </div>

          {/* Selector de Producto */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Producto <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/40 transition-colors"
            >
              <option value="">-- Selecciona el producto --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.categories?.name ? `(${p.categories.name})` : ""}
                </option>
              ))}
            </select>
            {selectedProduct && (
              <p className="mt-1 text-2xs text-slate-500 dark:text-slate-400">
                Stock actual registrado:{" "}
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {currentStock} unidades
                </span>
              </p>
            )}
          </div>

          {/* Selector de Ubicación */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Ubicación / Almacén <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/40 transition-colors"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.type === "warehouse" ? "Bodega" : "Punto de Venta"})
                </option>
              ))}
            </select>
          </div>

          {/* Cantidad y Costo Unitario */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {movementType === "adjustment" ? "Nuevo Stock Real" : "Cantidad"} <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                min={movementType === "adjustment" ? "0" : "0.01"}
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/40 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Costo Unitario ($)
              </label>
              <div className="relative">
                <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/40 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Advertencia si Salida > Stock */}
          {movementType === "exit" && parsedQty > currentStock && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>La cantidad a retirar supera el stock actual ({currentStock} un.).</span>
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notas u Observación (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej. Compra directa, auditoría física mensual, salida a cocina..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/40 transition-colors"
            />
          </div>

          {/* Botones */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200/80 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Registrar Movimiento</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

