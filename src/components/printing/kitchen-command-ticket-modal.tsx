"use client";

import React, { useState, useEffect, useRef } from "react";
import { FileText, Printer, X, DollarSign, Plus } from "lucide-react";
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
  roomName?: string | null;
  customerName?: string | null;
  diners?: number;
  createdAt?: string;
  cashierName?: string | null;
  items: KitchenTicketItem[];
  total?: number;
}

import { printThermalElement } from "@/lib/printing/print-thermal-element";

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
    const tableClean = order.tableName ? `MESA ${order.tableName.toUpperCase().replace(/^MESA\s*/i, "")}` : "CONSUMO EN MESA";
    destinationLabel = order.roomName ? `${tableClean} (${order.roomName.toUpperCase()})` : tableClean;
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
    printThermalElement("kitchen-command-print-area", `Comanda #${order.orderNumber}`);
  };

  return (
    <ModalPortal>
      {/* ESTILOS DE IMPRESIÓN DIRECTA DE COMANDA TÉRMICA 80MM */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @media print {
            @page {
              margin: 0 !important;
              size: 80mm auto !important;
            }
            *, *::before, *::after {
              box-sizing: border-box !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #000000 !important;
              width: 80mm !important;
              max-width: 80mm !important;
              min-width: 80mm !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              overflow: visible !important;
              height: auto !important;
            }
            /* Ocultar elementos no imprimibles */
            .pos-no-print {
              display: none !important;
            }
            /* Neutralizar contenedores del modal en impresión */
            .pos-print-modal-overlay {
              position: static !important;
              background: transparent !important;
              padding: 0 !important;
              margin: 0 !important;
              inset: auto !important;
              width: 80mm !important;
              max-width: 80mm !important;
              height: auto !important;
              max-height: none !important;
              overflow: visible !important;
              display: block !important;
            }
            .pos-print-modal-card {
              position: static !important;
              background: transparent !important;
              border: none !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              padding: 0 !important;
              margin: 0 !important;
              width: 80mm !important;
              max-width: 80mm !important;
              height: auto !important;
              max-height: none !important;
              overflow: visible !important;
              display: block !important;
            }
            .pos-print-body-wrapper {
              background: transparent !important;
              padding: 0 !important;
              margin: 0 !important;
              overflow: visible !important;
              height: auto !important;
              max-height: none !important;
              display: block !important;
            }
            /* Mostrar exclusivamente la comanda de cocina a 80mm */
            #kitchen-command-print-area {
              display: block !important;
              visibility: visible !important;
              position: relative !important;
              width: 80mm !important;
              max-width: 80mm !important;
              margin: 0 !important;
              padding: 3mm 2mm !important;
              background: #ffffff !important;
              color: #000000 !important;
              font-family: 'Courier New', Courier, monospace !important;
              font-size: 12px !important;
              line-height: 1.25 !important;
              box-shadow: none !important;
              border: none !important;
              border-radius: 0 !important;
              overflow: visible !important;
            }
            #kitchen-command-print-area * {
              visibility: visible !important;
              color: #000000 !important;
              background: transparent !important;
              text-shadow: none !important;
              box-shadow: none !important;
            }
          }
        `,
        }}
      />

      <div className="pos-print-modal-overlay fixed inset-0 m-0 p-3 sm:p-4 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
        <div
          role="dialog"
          aria-modal="true"
          className="pos-print-modal-card relative w-full max-w-md sm:max-w-lg bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* HEADER DEL MODAL */}
          <div className="px-5 py-4 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-white/[0.02] pos-no-print">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#ED500A]" />
              <span className="font-bold text-sm text-slate-900 dark:text-white">
                Comanda de Cocina
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar modal"
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* CUERPO: TICKET TÉRMICO DE COMANDA */}
          <div className="pos-print-body-wrapper p-4 sm:p-6 overflow-y-auto flex-1 flex justify-center bg-slate-100/70 dark:bg-black/40">
            <div
              id="kitchen-command-print-area"
              className="w-full max-w-[340px] sm:max-w-[360px] bg-white text-black p-5 sm:p-6 rounded-xl shadow-md border border-slate-300 font-mono text-center select-none"
            >
              {/* BADGE CON NÚMERO DE ORDEN */}
              <div className="inline-flex items-center justify-center min-w-[56px] h-9 px-3.5 rounded-full border-2 border-black mx-auto font-black text-base tracking-wide">
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
                      <div className="font-black text-xs uppercase whitespace-normal break-words text-wrap">
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
          <div className="p-4 border-t border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] shrink-0 space-y-2 pos-no-print">
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
    </ModalPortal>
  );
}

