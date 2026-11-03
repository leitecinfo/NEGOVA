"use client";

import React, { useRef } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { UtensilsCrossed, X, Printer, Clock, User, Users, Check } from "lucide-react";
import { toast } from "sonner";

export interface KitchenTicketData {
  orderNumber: number;
  referenceName?: string | null;
  serviceType: string; // ej: "COMER AQUÍ", "PARA LLEVAR", "DOMICILIO"
  tableName?: string | null;
  cashierName?: string | null;
  dinersCount?: number;
  createdAt?: string;
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

  const nowFormatted = new Date().toLocaleString("es-CO", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const handlePrint = () => {
    window.print();
    toast.success("Enviando comanda a impresora térmica...");
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-sm bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cabecera del modal */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-[#ED500A] flex items-center justify-center font-bold">
                <UtensilsCrossed className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Comanda de Cocina
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

          {/* Contenedor del ticket: Formato simulado de tirilla de papel */}
          <div className="p-5 overflow-y-auto bg-slate-100/50 dark:bg-black/30 flex justify-center">
            <div
              ref={printAreaRef}
              className="w-full max-w-[280px] bg-white text-black p-5 rounded-lg shadow-sm border border-slate-200 font-mono text-xs space-y-3"
            >
              {/* Identificador de comanda en círculo */}
              <div className="flex flex-col items-center justify-center text-center space-y-1">
                <div className="w-12 h-12 rounded-full border-2 border-black flex items-center justify-center text-xl font-black">
                  #{data.orderNumber}
                </div>
                {data.referenceName && (
                  <span className="font-bold text-sm tracking-wide">
                    {data.referenceName}
                  </span>
                )}
              </div>

              {/* Caja de servicio y mesa con borde sólido */}
              <div className="p-2 border-2 border-black text-center font-bold text-xs uppercase">
                {data.tableName ? `MESA ${data.tableName} - ` : ""}
                {data.serviceType || "COMER AQUÍ"}
              </div>

              {/* Metadatos de la orden */}
              <div className="text-[11px] space-y-0.5 leading-tight">
                <div>
                  <span className="font-bold">Cajero: </span>
                  <span>{data.cashierName || "ADMINISTRADOR"}</span>
                </div>
                {data.dinersCount ? (
                  <div>
                    <span className="font-bold">Comensales: </span>
                    <span>{data.dinersCount}</span>
                  </div>
                ) : null}
                <div>
                  <span className="font-bold">Fecha: </span>
                  <span>{data.createdAt || nowFormatted}</span>
                </div>
              </div>

              {/* Línea de separación sólida */}
              <hr className="border-black border-t-2" />

              {/* Detalle de platos / productos */}
              <div className="space-y-2 py-1">
                {data.items.map((item, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="font-black text-sm flex items-start gap-1.5">
                      <span>{item.quantity}X</span>
                      <span className="uppercase">{item.name}</span>
                    </div>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div className="text-[10px] pl-4 italic">
                        {item.modifiers.join(", ")}
                      </div>
                    )}
                    {item.notes && (
                      <div className="text-[10px] pl-4 font-semibold text-slate-700">
                        * {item.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Línea divisoria punteada */}
              <hr className="border-black border-dashed border-t" />

              {/* Pie de tirilla */}
              <div className="text-[9px] text-center text-slate-600 pt-1">
                Impreso: {nowFormatted}
              </div>
            </div>
          </div>

          {/* Acciones de pie */}
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
