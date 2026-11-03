"use client";

import React, { useState } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { FileText, X, Plus, Minus, DollarSign, Layers } from "lucide-react";
import { formatCOP } from "@/lib/pos/types";

interface PosItemLibreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItem: (item: {
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
  }) => void;
}

export function PosItemLibreModal({
  isOpen,
  onClose,
  onAddItem,
}: PosItemLibreModalProps) {
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("Unidad");
  const [unitPrice, setUnitPrice] = useState<number>(0);

  if (!isOpen) return null;

  const totalCalculated = quantity * (unitPrice || 0);
  const isValid = description.trim().length > 0 && quantity > 0 && unitPrice >= 0;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    onAddItem({
      description: description.trim(),
      quantity,
      unit,
      unitPrice,
    });

    setDescription("");
    setQuantity(1);
    setUnitPrice(0);
    onClose();
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-lg bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Encabezado */}
          <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-[#ED500A] flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Ítem libre
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Agrega un cargo o producto que no está en el catálogo.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleAdd} className="p-6 space-y-5 text-xs overflow-y-auto">
            {/* Paso 1: Descripción */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span>Descripción</span>
                  <span className="px-1.5 py-0.2 rounded-md bg-orange-500/10 text-[#ED500A] text-[10px] font-bold">
                    PASO 1
                  </span>
                </label>
                <span className="text-[11px] text-slate-400">
                  Así aparecerá en el pedido y la factura
                </span>
              </div>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej: Cargo extra por empaque especial"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30"
              />
            </div>

            {/* Paso 2: Cantidad y unidad */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span>Cantidad y unidad</span>
                  <span className="px-1.5 py-0.2 rounded-md bg-orange-500/10 text-[#ED500A] text-[10px] font-bold">
                    PASO 2
                  </span>
                </label>
                <span className="text-[11px] text-slate-400">Solo cantidades enteras</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center border border-slate-200 dark:border-white/[0.08] rounded-xl overflow-hidden bg-slate-50 dark:bg-white/[0.03]">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="p-2.5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="flex-1 text-center font-mono font-bold text-xs bg-transparent text-slate-900 dark:text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="p-2.5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 cursor-pointer font-medium"
                >
                  <option value="Unidad">Unidad</option>
                  <option value="Porción">Porción</option>
                  <option value="Servicio">Servicio</option>
                  <option value="Plato">Plato</option>
                  <option value="Combo">Combo</option>
                </select>
              </div>
            </div>

            {/* Paso 3: Precio unitario */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span>Precio unitario</span>
                  <span className="px-1.5 py-0.2 rounded-md bg-orange-500/10 text-[#ED500A] text-[10px] font-bold">
                    PASO 3
                  </span>
                </label>
                <span className="text-[11px] text-slate-400">Precio por unidad</span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400 text-xs">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="500"
                  required
                  value={unitPrice || ""}
                  onChange={(e) => setUnitPrice(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="0"
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white text-xs font-mono font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30"
                />
              </div>
            </div>

            {/* Pie del modal */}
            <div className="pt-4 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] text-slate-400 block">
                  {description.trim() ? "Total calculado:" : "Completa la descripción"}
                </span>
                <span className="text-base font-bold font-mono text-slate-900 dark:text-white">
                  {formatCOP(totalCalculated)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!isValid}
                  className="px-5 py-2.5 rounded-xl bg-[#ED500A] hover:bg-[#ED500A]/90 text-white font-semibold shadow-md shadow-orange-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-40"
                >
                  + Agregar al pedido
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
