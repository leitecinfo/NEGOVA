"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ArrowRight, Plus, DollarSign, Loader2, X } from "lucide-react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { useNavigationProgress } from "@/components/layout/navigation-progress-bar";
import { formatCOP } from "@/lib/pos/types";

interface OrderSuccessModalProps {
  isOpen: boolean;
  orderNumber: number;
  orderId: string;
  total: number;
  businessId?: string;
  onClose: () => void;
  onNewOrder: () => void;
  onPayOrder?: () => void;
}

export function OrderSuccessModal({
  isOpen,
  orderNumber,
  orderId,
  total,
  businessId,
  onClose,
  onNewOrder,
  onPayOrder,
}: OrderSuccessModalProps) {
  const router = useRouter();
  const { startNavigation } = useNavigationProgress();
  const [isNavigating, setIsNavigating] = useState(false);
  const [isPaying, setIsPaying] = useState(false);

  // Prefetch proactivo tan pronto como se abre el modal de éxito con el ID del pedido
  useEffect(() => {
    if (isOpen && businessId && orderId) {
      router.prefetch(`/workspace/${businessId}/pedidos/${orderId}`);
    }
  }, [isOpen, businessId, orderId, router]);

  // Restablecer estado de navegación al cerrar o cambiar estado
  useEffect(() => {
    if (!isOpen) {
      setIsNavigating(false);
      setIsPaying(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGoToOrder = () => {
    if (!businessId || !orderId || isNavigating) return;
    setIsNavigating(true);
    startNavigation(`/workspace/${businessId}/pedidos/${orderId}`);
    router.push(`/workspace/${businessId}/pedidos/${orderId}`);
  };

  const handlePayOrder = async () => {
    if (!onPayOrder || isPaying || isNavigating) return;
    setIsPaying(true);
    try {
      await onPayOrder();
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 m-0 p-4 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-md bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden p-6 text-center space-y-5"
        >
          {/* BOTÓN CERRAR SUPERIOR */}
          <button
            type="button"
            onClick={onClose}
            disabled={isNavigating}
            aria-label="Cerrar modal"
            className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>

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
          <div className="p-3.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 rounded-xl">
            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">Total del pedido</span>
            <div className="text-2xl font-black text-[#ED500A]">
              {formatCOP(total)}
            </div>
          </div>

          {/* DISTRIBUCIÓN DE BOTONES */}
          <div className="pt-2 space-y-2.5">
            {/* Fila 1: Acciones Principales Operativas */}
            <div className={`grid gap-2.5 ${onPayOrder ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
              {onPayOrder && (
                <button
                  type="button"
                  onClick={handlePayOrder}
                  disabled={isNavigating || isPaying}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {isPaying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Iniciando cobro...</span>
                    </>
                  ) : (
                    <>
                      <DollarSign className="w-4 h-4 stroke-[2.5]" />
                      <span>Cobrar Pedido</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={onNewOrder}
                disabled={isNavigating || isPaying}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs sm:text-sm bg-[#ED500A] hover:bg-[#d94608] active:bg-[#bf3d07] text-white shadow-md shadow-[#ED500A]/20 transition-all cursor-pointer active:scale-[0.99] disabled:opacity-50"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Nuevo Pedido</span>
              </button>
            </div>

            {/* Fila 2: Acciones Secundarias de Navegación y Salida */}
            <div className={`grid gap-2.5 ${businessId && orderId ? "grid-cols-2" : "grid-cols-1"}`}>
              {businessId && orderId && (
                <button
                  type="button"
                  onClick={handleGoToOrder}
                  onMouseEnter={() => router.prefetch(`/workspace/${businessId}/pedidos/${orderId}`)}
                  disabled={isNavigating}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/[0.08] transition-colors cursor-pointer disabled:opacity-75 disabled:cursor-wait"
                >
                  {isNavigating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                      <span>Abriendo comanda...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <span>Ir a la Comanda</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                disabled={isNavigating}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-transparent hover:bg-slate-100 dark:hover:bg-white/[0.05] border border-slate-200/60 dark:border-white/[0.06] transition-colors cursor-pointer disabled:opacity-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
