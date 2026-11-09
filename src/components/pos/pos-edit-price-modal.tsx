"use client";

import React, { useState } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Input } from "@/components/ui";
import { DollarSign, X, Info } from "lucide-react";

interface PosEditPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  currentUnitPrice: number;
  onSavePrice: (newPrice: number) => void;
}

export function PosEditPriceModal({
  isOpen,
  onClose,
  itemName,
  currentUnitPrice,
  onSavePrice,
}: PosEditPriceModalProps) {
  const [price, setPrice] = useState<number>(currentUnitPrice);

  if (!isOpen) return null;

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    onSavePrice(Math.max(0, price || 0));
    onClose();
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-sm bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cabecera */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-orange-500/10 text-[#ED500A] flex items-center justify-center font-bold shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                  Editar precio
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate max-w-[200px]">
                  {itemName}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer shrink-0 ml-2"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleApply} className="p-6 space-y-4 text-xs">
            {/* Campo de Precio Unitario */}
            <Input
              label="Precio Unitario (COP)"
              type="number"
              min="0"
              step="500"
              required
              autoFocus
              value={price || ""}
              onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))}
              placeholder="0"
              startAdornment={<span className="font-mono font-bold text-slate-400">$</span>}
              className="font-mono font-bold text-sm"
            />

            {/* Nota informativa inferior */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.06] flex items-start gap-2 text-slate-500 text-[11px]">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="italic">
                Solo afecta este carrito. No modifica el producto en la base de datos.
              </p>
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
