"use client";

import React, { useRef } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { FileText, X, Printer, Clock, User, Users, Check } from "lucide-react";
import { toast } from "sonner";
import { printThermalElement } from "@/lib/printing/print-thermal-element";

export interface KitchenTicketData {
  orderId?: string;
  orderNumber: number;
  referenceName?: string | null;
  serviceType: string; // ej: "COMER AQUÍ", "PARA LLEVAR", "DOMICILIO"
  tableName?: string | null;
  cashierName?: string | null;
  dinersCount?: number;
  createdAt?: string;
  generalNotes?: string | null;
  items: Array<{
    quantity: number;
    name: string;
    notes?: string | null;
    modifiers?: string[];
  }>;
}

interface PosKitchenTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: KitchenTicketData | null;
}

export function PosKitchenTicketModal({
  isOpen,
  onClose,
  data,
}: PosKitchenTicketModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !data) return null;

  const nowFormatted = (() => {
    try {
      const d = data.createdAt ? new Date(data.createdAt) : new Date();
      if (isNaN(d.getTime())) return data.createdAt || "Fecha no registrada";
      return d.toLocaleString("es-CO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return data.createdAt || "Fecha no registrada";
    }
  })();

  const handlePrint = () => {
    printThermalElement("pos-kitchen-print-area", `Comanda #${data.orderNumber}`);
    toast.success("Enviando comanda a impresora de cocina...");
  };

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
            /* Ocultar toda la página y elementos de fondo */
            body * {
              visibility: hidden !important;
            }
            .pos-no-print {
              display: none !important;
            }
            /* Mostrar exclusivamente la comanda de cocina a 80mm en la esquina superior */
            #pos-kitchen-print-area,
            #pos-kitchen-print-area * {
              visibility: visible !important;
            }
            #pos-kitchen-print-area {
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
              font-size: 12px !important;
              line-height: 1.25 !important;
              box-shadow: none !important;
              border: none !important;
              border-radius: 0 !important;
              overflow: visible !important;
              z-index: 2147483647 !important;
            }
            #pos-kitchen-print-area * {
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
      <div className="pos-print-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
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
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                  Comanda de Cocina (KDS)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Formato de preparación para zona de despacho y cocina
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

          {/* Contenedor del ticket: Formato simulado de tirilla de papel */}
          <div className="pos-print-body-wrapper p-4 sm:p-6 overflow-y-auto bg-slate-100/70 dark:bg-black/40 flex justify-center">
            <div
              ref={printAreaRef}
              id="pos-kitchen-print-area"
              className="w-full max-w-[340px] sm:max-w-[360px] bg-white text-black p-5 sm:p-6 rounded-xl shadow-md border border-slate-300 font-mono text-xs space-y-3.5 leading-tight"
            >
              {/* Identificador de comanda con badge amplio y legible */}
              <div className="flex flex-col items-center justify-center text-center space-y-1.5">
                <div className="inline-flex items-center justify-center min-w-[56px] h-9 px-3.5 rounded-full border-2 border-black text-base font-black tracking-wide">
                  #{data.orderNumber}
                </div>
                {data.referenceName && (
                  <span className="font-bold text-xs tracking-wider text-slate-800">
                    {data.referenceName}
                  </span>
                )}
              </div>

              {/* Caja de servicio y mesa con borde sólido destacado */}
              <div className="p-2.5 border-2 border-black text-center font-black text-xs uppercase tracking-wide bg-slate-50">
                <span>{data.serviceType}</span>
                {data.tableName && (
                  <span className="ml-2 font-black underline">[{data.tableName}]</span>
                )}
              </div>

              {/* Metadatos de la orden */}
              <div className="text-[11px] space-y-1 border-b border-black pb-2">
                <div className="flex justify-between">
                  <span className="font-bold">Hora:</span>
                  <span>{nowFormatted}</span>
                </div>
                {data.cashierName && (
                  <div className="flex justify-between">
                    <span className="font-bold">Atendió:</span>
                    <span>{data.cashierName}</span>
                  </div>
                )}
                {data.dinersCount && (
                  <div className="flex justify-between">
                    <span className="font-bold">Comensales:</span>
                    <span>{data.dinersCount}</span>
                  </div>
                )}
              </div>

              {/* Lista de platos e ingredientes para cocina */}
              <div className="space-y-3 py-1">
                {data.items.map((it, idx) => (
                  <div key={idx} className="space-y-0.5 border-b border-dashed border-slate-300 pb-2">
                    <div className="flex items-start gap-2">
                      <span className="font-black text-sm w-7 shrink-0 text-center bg-black text-white rounded px-1">
                        {it.quantity}x
                      </span>
                      <span className="font-bold text-sm flex-1 leading-snug whitespace-normal break-words text-wrap">
                        {it.name}
                      </span>
                    </div>

                    {/* Modificadores */}
                    {it.modifiers && it.modifiers.length > 0 && (
                      <div className="pl-9 text-[11px] space-y-0.5 font-semibold text-slate-800">
                        {it.modifiers.map((m, mIdx) => (
                          <div key={mIdx}>• {m}</div>
                        ))}
                      </div>
                    )}

                    {/* Notas especiales del cocinero */}
                    {it.notes && (
                      <div className="pl-9 text-[11px] font-black uppercase text-red-600">
                        *** NOTA: {it.notes} ***
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Notas generales de la orden si existen */}
              {data.generalNotes && (
                <div className="p-2 border-2 border-dashed border-black bg-slate-50 text-[11px] font-black uppercase text-center space-y-0.5">
                  <span className="text-red-600 block">*** NOTA GENERAL ***</span>
                  <span className="text-black block text-xs">{data.generalNotes}</span>
                </div>
              )}

              {/* Pie de comanda */}
              <div className="pt-2 text-center text-[10px] font-bold border-t border-black">
                *** FIN DE COMANDA ***
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
              onClick={handlePrint}
              className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs transition-all flex items-center gap-2 cursor-pointer hover:opacity-90 active:scale-95 shadow-md"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Comanda (80mm)</span>
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
