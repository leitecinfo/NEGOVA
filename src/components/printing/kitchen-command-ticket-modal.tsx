"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChefHat, Printer, X, DollarSign, Plus } from "lucide-react";
import { ModalPortal } from "@/components/ui/modal-portal";

export interface KitchenTicketItem {
  quantity: number;
  name: string;
  notes?: string | null;
  modifiers?: string[];
}

export interface KitchenCommandTicketData {
  orderNumber: number;
  orderId?: string;
  orderType: "dine_in" | "takeout" | "delivery" | string;
  tableName?: string | null;
  customerName?: string | null;
  diners?: number;
  createdAt?: string;
  cashierName?: string | null;
  items: KitchenTicketItem[];
  total?: number;
}

interface KitchenCommandTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: KitchenCommandTicketData | null;
  onPayOrder?: () => void;
  onNewOrder?: () => void;
}

export function KitchenCommandTicketModal({
  isOpen,
  onClose,
  order,
  onPayOrder,
  onNewOrder,
}: KitchenCommandTicketModalProps) {
  const [printTime, setPrintTime] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      setPrintTime(
        `${now.toLocaleDateString("es-CO")}, ${now.toLocaleTimeString("es-CO", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}`
      );
    }
  }, [isOpen]);

  if (!isOpen || !order) return null;

  // Formatear destino / modalidad
  let destinationLabel = "PARA LLEVAR";
  if (order.orderType === "dine_in") {
    destinationLabel = order.tableName ? `MESA ${order.tableName.toUpperCase().replace(/^MESA\s*/i, "")}` : "CONSUMO EN MESA";
  } else if (order.orderType === "delivery") {
    destinationLabel = "A DOMICILIO";
  }

  // Formatear fecha y hora de la orden
  const orderDate = order.createdAt ? new Date(order.createdAt) : new Date();
  const formattedDate = orderDate.toLocaleDateString("es-CO");
  const formattedTime = orderDate.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 m-0 p-4 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-sm sm:max-w-md bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* HEADER DEL MODAL */}
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-[#ED500A]" />
              <span className="font-bold text-sm text-slate-900 dark:text-white">
                Comanda de Cocina
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar modal"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* CUERPO: TICKET TÉRMICO DE COMANDA */}
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex justify-center bg-slate-100 dark:bg-black/30">
            <div
              id="kitchen-command-print-area"
              className="w-full max-w-[280px] bg-white text-black p-5 rounded-lg shadow-sm border border-slate-300 font-mono text-center select-none"
            >
              {/* CÍRCULO CON NÚMERO DE ORDEN */}
              <div className="w-14 h-14 rounded-full border-2 border-black mx-auto flex items-center justify-center font-black text-2xl tracking-tighter">
                #{order.orderNumber}
              </div>

              {/* TÍTULO COMANDA COCINA */}
              <div className="font-black text-xs sm:text-sm tracking-widest mt-2.5">
                COMANDA COCINA
              </div>

              {/* RECTÁNGULO DE DESTINO */}
              <div className="border-2 border-black py-1 px-2 my-2.5 font-black text-xs sm:text-sm uppercase tracking-wider">
                {destinationLabel}
              </div>

              {/* DATOS DE OPERACIÓN */}
              <div className="text-[11px] text-left space-y-0.5 leading-snug font-medium">
                {order.cashierName && <div>Cajero: {order.cashierName}</div>}
                <div>Comensales: {order.diners || 1}</div>
                <div>Fecha: {formattedDate}</div>
                <div>Hora: {formattedTime}</div>
                {order.customerName && <div>Cliente: {order.customerName}</div>}
              </div>

              {/* LÍNEA SEPARADORA */}
              <div className="border-b border-black my-2" />

              {/* LISTA DE PRODUCTOS */}
              <div className="space-y-1.5 my-2">
                {order.items.length === 0 ? (
                  <div className="text-xs text-slate-500 italic py-2">Sin ítems en comanda</div>
                ) : (
                  order.items.map((item, idx) => (
                    <div key={idx} className="text-left leading-tight">
                      <div className="font-black text-xs uppercase">
                        {item.quantity}X {item.name}
                      </div>
                      {item.notes && (
                        <div className="text-[10px] text-slate-700 italic pl-3">
                          * {item.notes}
                        </div>
                      )}
                      {item.modifiers && item.modifiers.length > 0 && (
                        <div className="text-[10px] text-slate-700 pl-3">
                          + {item.modifiers.join(", ")}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* LÍNEA SEPARADORA DE CORTE */}
              <div className="border-b-2 border-dashed border-black my-2" />

              {/* PIE DE IMPRESIÓN */}
              <div className="text-[9px] text-slate-600">
                Impreso: {printTime}
              </div>
            </div>
          </div>

          {/* ACCIONES DEL MODAL */}
          <div className="p-4 border-t border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] shrink-0 space-y-2">
            {/* Fila 1: Imprimir comanda y opción de cobrar si aplica */}
            <div className={`grid gap-2 ${onPayOrder ? "grid-cols-2" : "grid-cols-1"}`}>
              <button
                type="button"
                onClick={handlePrint}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-[#ED500A] hover:bg-[#d94608] active:bg-[#bf3d07] text-white shadow-md shadow-[#ED500A]/20 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4 stroke-[2.5]" />
                <span>Imprimir</span>
              </button>

              {onPayOrder && (
                <button
                  type="button"
                  onClick={onPayOrder}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-sm transition-all cursor-pointer"
                >
                  <DollarSign className="w-4 h-4 stroke-[2.5]" />
                  <span>Cobrar Pedido</span>
                </button>
              )}
            </div>

            {/* Fila 2: Nuevo pedido o Cerrar */}
            <div className={`grid gap-2 ${onNewOrder ? "grid-cols-2" : "grid-cols-1"}`}>
              {onNewOrder && (
                <button
                  type="button"
                  onClick={onNewOrder}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/[0.08] transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nuevo Pedido</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-transparent hover:bg-slate-100 dark:hover:bg-white/[0.05] border border-slate-200/60 dark:border-white/[0.06] transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ESTILOS DE IMPRESIÓN DIRECTA DE COMANDA TÉRMICA */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #kitchen-command-print-area,
          #kitchen-command-print-area * {
            visibility: visible !important;
          }
          #kitchen-command-print-area {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 8px !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            color: black !important;
          }
        }
      `}</style>
    </ModalPortal>
  );
}

