"use client";

import React, { useRef, useState } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Receipt, X, Printer, Store, CheckCircle2, Camera, Loader2 } from "lucide-react";
import { formatCOP } from "@/lib/pos/types";
import { toast } from "sonner";
import { printThermalElement } from "@/lib/printing/print-thermal-element";
import { downloadElementAsImage } from "@/lib/printing/download-invoice-image";

export interface InvoiceData {
  orderNumber: number;
  invoiceFolio: string; // ej. V-001042 o FAC-0001
  businessName: string;
  logoUrl?: string | null;
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

  const [isDownloadingPhoto, setIsDownloadingPhoto] = useState(false);

  if (!isOpen || !data) return null;

  const handlePrint = () => {
    printThermalElement("pos-receipt-print-area", `Factura ${data.invoiceFolio}`);
    toast.success("Enviando comprobante a impresora térmica...");
  };

  const handleDownloadPhoto = async () => {
    if (!printAreaRef.current) return;
    setIsDownloadingPhoto(true);
    try {
      const filename = `Factura_${data.invoiceFolio || data.orderNumber}.png`;
      const result = await downloadElementAsImage(printAreaRef.current, filename);
      if (result === "shared") {
        toast.success("Foto de la factura compartida");
      } else {
        toast.success("Foto de la factura descargada correctamente");
      }
    } catch (err: any) {
      toast.error("No se pudo generar la foto de la factura", {
        description: err?.message || "Inténtalo de nuevo.",
      });
    } finally {
      setIsDownloadingPhoto(false);
    }
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
      {/* ESTILOS DE IMPRESIÓN TÉRMICA ESTÁNDAR 80MM AISLADOS (@media print) */}
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
            /* Ocultar elementos de UI no imprimibles */
            body * {
              visibility: hidden !important;
            }
            .pos-no-print {
              display: none !important;
            }
            /* Renderizar exclusivamente el comprobante térmico a 80mm en esquina superior */
            #pos-receipt-print-area,
            #pos-receipt-print-area * {
              visibility: visible !important;
            }
            #pos-receipt-print-area {
              display: block !important;
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: 80mm !important;
              max-width: 80mm !important;
              margin: 0 !important;
              padding: 3mm 2mm !important;
              background: #ffffff !important;
              color: #000000 !important;
              font-family: 'Courier New', Courier, monospace !important;
              font-size: 11px !important;
              line-height: 1.25 !important;
              box-shadow: none !important;
              border: none !important;
              border-radius: 0 !important;
              overflow: visible !important;
              z-index: 2147483647 !important;
            }
            #pos-receipt-print-area * {
              color: #000000 !important;
              background: transparent !important;
              text-shadow: none !important;
              box-shadow: none !important;
            }
          }
        `,
        }}
      />

      {/* BACKDROP NEUTRAL OSCURO */}
      <div className="pos-print-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
        <div
          role="dialog"
          aria-modal="true"
          className="pos-print-modal-card relative w-full max-w-md sm:max-w-lg bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cabecera del modal */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] pos-no-print">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-[#ED500A] flex items-center justify-center font-bold">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                  Factura / Recibo de Venta
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Formato estándar para tirilla térmica de 80mm
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

          {/* Formato simulado de ticket (Área imprimible) */}
          <div className="pos-print-body-wrapper p-4 sm:p-6 overflow-y-auto bg-slate-100/70 dark:bg-black/40 flex justify-center">
            <div
              ref={printAreaRef}
              id="pos-receipt-print-area"
              className="w-full max-w-[340px] sm:max-w-[360px] bg-white text-black p-5 sm:p-6 rounded-xl shadow-md border border-slate-300 font-mono text-[11px] space-y-3.5 leading-tight"
            >
              {/* Cabecera: Badge con ID de comanda y Logotipo / Nombre */}
              <div className="flex flex-col items-center justify-center text-center space-y-2">
                <div className="inline-flex items-center justify-center min-w-[56px] h-9 px-3.5 rounded-full border-2 border-black text-base font-black tracking-wide">
                  #{data.orderNumber}
                </div>

                {data.logoUrl ? (
                  <div className="w-14 h-14 rounded-xl overflow-hidden border border-black/15 flex items-center justify-center bg-white shrink-0">
                    <img
                      src={data.logoUrl}
                      alt={data.businessName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-300 flex items-center justify-center font-bold text-sm uppercase text-slate-700">
                    {data.businessName.slice(0, 3)}
                  </div>
                )}

                <div className="font-black text-sm uppercase tracking-wider">
                  {data.businessName}
                </div>
                <div className="text-[10px] text-slate-600">
                  {data.taxRegime || "No responsable de IVA"}
                </div>
              </div>

              {/* Línea divisoria discontinua */}
              <hr className="border-black border-dashed border-t" />

              {/* Datos del comprobante */}
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="font-bold">Comprobante:</span>
                  <span className="font-mono font-semibold">{data.invoiceFolio}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold">Fecha:</span>
                  <span>{formattedDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold">Cliente:</span>
                  <span className="truncate max-w-[200px] text-right font-medium">{data.customerName}</span>
                </div>
                {data.customerPhone && (
                  <div className="flex justify-between">
                    <span className="font-bold">Teléfono:</span>
                    <span>{data.customerPhone}</span>
                  </div>
                )}
                {data.customerAddress && (
                  <div className="flex justify-between">
                    <span className="font-bold">Dirección:</span>
                    <span className="truncate max-w-[200px] text-right">{data.customerAddress}</span>
                  </div>
                )}
              </div>

              {/* Línea divisoria discontinua */}
              <hr className="border-black border-dashed border-t" />

              {/* Tabla de productos (Columnas perfectamente dimensionadas sin solapamiento) */}
              <div>
                <div className="flex items-center justify-between font-bold text-[11px] pb-1.5 border-b border-black">
                  <span className="flex-1 min-w-0 pr-2">Producto</span>
                  <span className="w-10 text-center shrink-0">Cant</span>
                  <span className="w-20 text-right shrink-0">Precio</span>
                  <span className="w-20 text-right shrink-0">Total</span>
                </div>
                <div className="divide-y divide-dashed divide-slate-300 py-1 space-y-1">
                  {data.items.map((it, idx) => (
                    <div key={idx} className="flex items-start justify-between pt-1 text-[11px] leading-tight gap-1">
                      <span className="flex-1 min-w-0 pr-1 whitespace-normal break-words text-wrap font-medium leading-tight">
                        {it.name}
                      </span>
                      <span className="w-10 text-center font-bold shrink-0">{it.quantity}</span>
                      <span className="w-20 text-right font-mono text-slate-700 shrink-0">
                        {formatCOP(it.unitPrice)}
                      </span>
                      <span className="w-20 text-right font-bold font-mono shrink-0">
                        {formatCOP(it.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bloque de totales */}
              <div className="pt-2 border-t border-black space-y-1 text-right text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-bold font-mono">{formatCOP(data.subtotal)}</span>
                </div>
                {Boolean(data.deliveryFee && data.deliveryFee > 0) && (
                  <div className="flex justify-between text-slate-700">
                    <span>Domicilio:</span>
                    <span className="font-mono">+{formatCOP(data.deliveryFee || 0)}</span>
                  </div>
                )}
                {Boolean(data.tipAmount && data.tipAmount > 0) && (
                  <div className="flex justify-between text-slate-700">
                    <span>Propina:</span>
                    <span className="font-mono">+{formatCOP(data.tipAmount || 0)}</span>
                  </div>
                )}
                {Boolean(data.discountAmount && data.discountAmount > 0) && (
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>Descuento:</span>
                    <span className="font-mono">-{formatCOP(data.discountAmount || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm pt-1.5 border-t-2 border-black">
                  <span>TOTAL A PAGAR:</span>
                  <span className="font-mono">{formatCOP(data.total)}</span>
                </div>
              </div>

              {/* Línea divisoria discontinua */}
              <hr className="border-black border-dashed border-t" />

              {/* Condiciones de la venta */}
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="font-bold">Servicio:</span>
                  <span>{data.serviceType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold">Condición:</span>
                  <span>{data.saleType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold">Medio de pago:</span>
                  <span>{data.paymentMethodName}</span>
                </div>
              </div>

              {/* Mensaje de cortesía */}
              <div className="text-center font-bold text-xs pt-3 border-t border-black border-dashed">
                ¡Gracias por su compra!
              </div>
            </div>
          </div>

          {/* Acciones inferiores */}
          <div className="p-4 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-end gap-2 bg-white dark:bg-[#0D0F16] pos-no-print">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleDownloadPhoto}
              disabled={isDownloadingPhoto}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#0D0F16] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-800 dark:text-slate-200 font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
              title="Descargar o compartir foto de la factura"
            >
              {isDownloadingPhoto ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#ED500A]" />
              ) : (
                <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              )}
              <span>Descargar foto</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2.5 rounded-xl bg-[#ED500A] hover:bg-[#d94608] text-white font-bold text-xs transition-all flex items-center gap-2 cursor-pointer hover:opacity-90 active:scale-95 shadow-md shadow-[#ED500A]/20"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Ticket (80mm)</span>
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
