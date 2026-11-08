"use client";

import React, { useState } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Input } from "@/components/ui";
import { Tag, X, Percent, DollarSign } from "lucide-react";
import { formatCOP } from "@/lib/pos/types";

interface PosDiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  itemPrice: number;
  currentDiscountPercentage?: number;
  currentDiscountAmount?: number;
  onApplyDiscount: (discount: { type: "percentage" | "fixed"; value: number }) => void;
}

const QUICK_PERCENTAGES = [5, 10, 15, 20, 25, 50];

export function PosDiscountModal({
  isOpen,
  onClose,
  itemName,
  itemPrice,
  currentDiscountPercentage = 0,
  currentDiscountAmount = 0,
  onApplyDiscount,
}: PosDiscountModalProps) {
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">(
    currentDiscountAmount > 0 ? "fixed" : "percentage"
  );
  const [value, setValue] = useState<number>(
    currentDiscountAmount > 0 ? currentDiscountAmount : currentDiscountPercentage || 10
  );

  if (!isOpen) return null;

  const calculatedDiscount =
    discountType === "percentage"
      ? (itemPrice * (value || 0)) / 100
      : Math.min(itemPrice, value || 0);

  const finalPrice = Math.max(0, itemPrice - calculatedDiscount);

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    onApplyDiscount({
      type: discountType,
      value: Math.max(0, value || 0),
    });
    onClose();
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-md bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cabecera */}
          <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-[#ED500A] flex items-center justify-center font-bold">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Descuento individual
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {itemName} — {formatCOP(itemPrice)}
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

          <form onSubmit={handleApply} className="p-6 space-y-4 text-xs">
            {/* Selector de Tipo de Descuento: % Porcentaje o $ Monto fijo */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Tipo de descuento
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                    discountType === "percentage"
                      ? "border-[#ED500A] bg-orange-500/10 text-[#ED500A]"
                      : "border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02] text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="discountType"
                    checked={discountType === "percentage"}
                    onChange={() => {
                      setDiscountType("percentage");
                      setValue(10);
                    }}
                    className="sr-only"
                  />
                  <Percent className="w-3.5 h-3.5" />
                  <span>% Porcentaje</span>
                </label>

                <label
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                    discountType === "fixed"
                      ? "border-[#ED500A] bg-orange-500/10 text-[#ED500A]"
                      : "border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02] text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="discountType"
                    checked={discountType === "fixed"}
                    onChange={() => {
                      setDiscountType("fixed");
                      setValue(2000);
                    }}
                    className="sr-only"
                  />
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>$ Monto fijo</span>
                </label>
              </div>
            </div>

            {/* Botones de acceso rápido porcentual */}
            {discountType === "percentage" && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500">
                  Accesos rápidos
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PERCENTAGES.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setValue(pct)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                        value === pct
                          ? "bg-[#ED500A] text-white shadow-xs"
                          : "bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Campo de valor */}
            <Input
              label={discountType === "percentage" ? "Porcentaje a descontar" : "Monto a descontar (COP)"}
              type="number"
              min="0"
              max={discountType === "percentage" ? 100 : itemPrice}
              step={discountType === "percentage" ? 1 : 500}
              value={value || ""}
              onChange={(e) => setValue(Number(e.target.value) || 0)}
              placeholder={discountType === "percentage" ? "% descuento" : "$ monto"}
              startAdornment={
                <span className="font-mono font-bold text-slate-400">
                  {discountType === "percentage" ? "%" : "$"}
                </span>
              }
              className="font-mono font-bold"
            />

            {/* Resumen */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.06] space-y-1 text-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span>Descuento aplicado:</span>
                <span className="font-mono text-rose-600 font-bold">
                  -{formatCOP(calculatedDiscount)}
                </span>
              </div>
              <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white pt-1 border-t border-slate-200/50 dark:border-white/5">
                <span>Precio final:</span>
                <span className="font-mono text-sm text-[#ED500A]">
                  {formatCOP(finalPrice)}
                </span>
              </div>
            </div>

            {/* Pie del modal */}
            <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#ED500A] hover:bg-[#ED500A]/90 text-white font-semibold shadow-md shadow-orange-500/20 active:scale-95 transition-all cursor-pointer"
              >
                Aplicar
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
