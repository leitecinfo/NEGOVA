"use client";

import React, { useRef } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Receipt, X, Printer, Store, UtensilsCrossed, CheckCircle2 } from "lucide-react";
import { formatCOP } from "@/lib/pos/types";
import { toast } from "sonner";

export interface InvoiceData {
  orderNumber: number;
  invoiceFolio: string; // ej. V1793676329435
  businessName: string;
  taxRegime?: string; // ej. "No responsable de IVA"
  createdAt?: string;
  customerName: string;
  customerPhone?: string | null;
  customerAddress?: string | null;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  subtotal: number;
  deliveryFee?: number;
  tipAmount?: number;
  discountAmount?: number;
  total: number;
  serviceType: string; // ej. "Comer Aquí", "Para llevar", "Domicilio"
  saleType: "Contado" | "Crédito";
  paymentMethodName: string; // ej. "Efectivo", "Tarjeta"
}

interface PosInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: InvoiceData | null;
}

export function PosInvoiceModal({
  isOpen,
  onClose,
  data,
}: PosInvoiceModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !data) return null;

  const handlePrint = () => {
    window.print();
    toast.success("Enviando factura a impresora térmica...");
  };

  const formattedDate =
    data.createdAt ||
    new Date().toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-sm bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cabecera del modal */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-[#ED500A] flex items-center justify-center font-bold">
                <Receipt className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Factura / Recibo de Venta
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Formato simulado de ticket */}
          <div className="p-5 overflow-y-auto bg-slate-100/50 dark:bg-black/30 flex justify-center">
            <div
              ref={printAreaRef}
              className="w-full max-w-[280px] bg-white text-black p-5 rounded-lg shadow-sm border border-slate-200 font-mono text-[11px] space-y-3 leading-tight"
            >
              {/* Cabecera: Círculo con ID y Logotipo / Nombre */}
              <div className="flex flex-col items-center justify-center text-center space-y-1.5">
                <div className="w-11 h-11 rounded-full border-2 border-black flex items-center justify-center text-lg font-black">
                  #{data.orderNumber}
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center font-bold text-xs uppercase">
                  {data.businessName.slice(0, 3)}
                </div>
                <div className="font-bold text-xs uppercase tracking-wider">
                  {data.businessName}
                </div>
                <div className="text-[10px] text-slate-600">
                  {data.taxRegime || "No responsable de IVA"}
                </div>
              </div>

              {/* Línea divisoria discontinua */}
              <hr className="border-black border-dashed border-t" />

              {/* Datos del comprobante */}
              <div className="space-y-1 text-[10px]">
                <div>
                  <span className="font-bold">Factura: </span>
                  <span>
                    #{data.orderNumber} · {data.invoiceFolio}
                  </span>
                </div>
                <div>
                  <span className="font-bold">Fecha: </span>
                  <span>{formattedDate}</span>
                </div>
                <div>
                  <span className="font-bold">Cliente: </span>
                  <span>{data.customerName}</span>
                </div>
                {data.customerPhone && (
                  <div>
                    <span className="font-bold">Tel: </span>
                    <span>{data.customerPhone}</span>
                  </div>
                )}
                {data.customerAddress && (
                  <div>
                    <span className="font-bold">Dirección: </span>
                    <span>{data.customerAddress}</span>
                  </div>
                )}
              </div>

              {/* Línea divisoria discontinua */}
              <hr className="border-black border-dashed border-t" />

              {/* Tabla de productos */}
              <div>
                <div className="grid grid-cols-12 font-bold text-[10px] pb-1 border-b border-black">
                  <span className="col-span-6">Producto</span>
                  <span className="col-span-2 text-center">Cant</span>
                  <span className="col-span-2 text-right">Precio</span>
                  <span className="col-span-2 text-right">Total</span>
                </div>
                <div className="divide-y divide-slate-100 py-1 space-y-1">
                  {data.items.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-12 pt-1 text-[10px] leading-tight">
                      <span className="col-span-6 truncate font-medium">{it.name}</span>
                      <span className="col-span-2 text-center font-bold">{it.quantity}</span>
                      <span className="col-span-2 text-right">{formatCOP(it.unitPrice)}</span>
                      <span className="col-span-2 text-right font-bold">{formatCOP(it.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bloque de totales */}
              <div className="pt-2 border-t border-black space-y-1 text-right text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-bold">{formatCOP(data.subtotal)}</span>
                </div>
                {Boolean(data.deliveryFee && data.deliveryFee > 0) && (
                  <div className="flex justify-between text-slate-600">
                    <span>Domicilio:</span>
                    <span>{formatCOP(data.deliveryFee || 0)}</span>
                  </div>
                )}
                {Boolean(data.tipAmount && data.tipAmount > 0) && (
                  <div className="flex justify-between text-slate-600">
                    <span>Propina:</span>
                    <span>{formatCOP(data.tipAmount || 0)}</span>
                  </div>
                )}
                {Boolean(data.discountAmount && data.discountAmount > 0) && (
                  <div className="flex justify-between text-rose-600">
                    <span>Descuento:</span>
                    <span>-{formatCOP(data.discountAmount || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm pt-1 border-t border-black">
                  <span>TOTAL:</span>
                  <span>{formatCOP(data.total)}</span>
                </div>
              </div>

              {/* Línea divisoria discontinua */}
              <hr className="border-black border-dashed border-t" />

              {/* Condiciones de la venta */}
              <div className="space-y-0.5 text-[10px]">
                <div>
                  <span className="font-bold">Servicio: </span>
                  <span>{data.serviceType}</span>
                </div>
                <div>
                  <span className="font-bold">Tipo de venta: </span>
                  <span>{data.saleType}</span>
                </div>
                <div>
                  <span className="font-bold">Pago: </span>
                  <span>{data.paymentMethodName}</span>
                </div>
              </div>

              {/* Mensaje de cortesía */}
              <div className="text-center font-bold text-xs pt-2">
                ¡Gracias por su compra!
              </div>
            </div>
          </div>

          {/* Acciones inferiores */}
          <div className="p-4 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-end gap-2 bg-white dark:bg-[#0D0F16]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer hover:opacity-90 active:scale-95 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
