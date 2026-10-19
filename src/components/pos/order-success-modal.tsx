"use client";

import React from "react";
import Link from "next/link";
import { CheckCircle2, Receipt, ArrowRight, Store, Plus, Printer } from "lucide-react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { formatCOP } from "@/lib/pos/types";

interface OrderSuccessModalProps {
  isOpen: boolean;
  orderNumber: number;
  orderId: string;
  total: number;
  businessId?: string;
  onClose: () => void;
  onNewOrder: () => void;
}

export function OrderSuccessModal({
  isOpen,
  orderNumber,
  orderId,
  total,
  businessId,
  onClose,
  onNewOrder,
}: OrderSuccessModalProps) {
  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 m-0 p-4 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-md bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden p-6 text-center space-y-5"
        >
          {/* ICONO DE ÉXITO */}
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
          </div>

          {/* TÍTULO Y NÚMERO DE ORDEN */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
              Comanda Registrada
            </span>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
              Pedido #{orderNumber}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              La comanda ha sido guardada en la base de datos con sus ítems y complementos.
            </p>
          </div>

          {/* TOTAL */}
          <div className="p-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 rounded-xl">
            <span className="text-xs text-slate-500 dark:text-slate-400">Total del pedido</span>
            <div className="text-xl font-black text-[#ED500A]">
              {formatCOP(total)}
            </div>
          </div>

          {/* BOTONES */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/[0.08] transition-colors cursor-pointer"
            >
              Cerrar
            </button>

            {businessId && orderId && (
              <Link
                href={`/workspace/${businessId}/pedidos/${orderId}`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/20 transition-colors cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Ir a la Comanda</span>
              </Link>
            )}

            <button
              type="button"
              onClick={onNewOrder}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs bg-[#ED500A] hover:bg-[#d94608] text-white shadow-md shadow-[#ED500A]/20 transition-all cursor-pointer active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Pedido</span>
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
