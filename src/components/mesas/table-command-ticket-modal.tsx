"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  FileText,
  Printer,
  X,
  DollarSign,
  ShoppingBag,
  Clock,
  User,
  Users,
  Layers,
  Sparkles,
  Receipt,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { ModalPortal } from "@/components/ui/modal-portal";
import { RestaurantTableWithOrder, RestaurantOrderWithDetails } from "@/lib/restaurant/types";
import { formatCOP } from "@/config/plans";
import { printThermalElement } from "@/lib/printing/print-thermal-element";
import { getTableActiveOrderDetailsAction } from "@/app/workspace/[businessId]/mesas/actions";

interface TableCommandTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: RestaurantTableWithOrder | null;
  businessId: string;
  businessName?: string;
  onCloseTable?: (table: RestaurantTableWithOrder) => void;
  onRefresh?: () => void;
}

export function TableCommandTicketModal({
  isOpen,
  onClose,
  table,
  businessId,
  businessName = "NEGOVA",
  onCloseTable,
  onRefresh,
}: TableCommandTicketModalProps) {
  const [printTime, setPrintTime] = useState<string>("");
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const [detailedOrder, setDetailedOrder] = useState<RestaurantOrderWithDetails | null>(null);

  const activeOrder = table?.activeOrder;

  // Cargar detalles completos de la comanda si es necesario
  useEffect(() => {
    if (!isOpen || !table || !activeOrder) {
      setDetailedOrder(null);
      return;
    }

    const now = new Date();
    setPrintTime(
      `${now.toLocaleDateString("es-CO")}, ${now.toLocaleTimeString("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}`
    );

    // Si ya vienen los ítems en activeOrder, los usamos inmediatamente
    if (activeOrder.items && activeOrder.items.length > 0) {
      return;
    }

    // Si no vienen los ítems precargados, los consultamos de forma reactiva
    let isCancelled = false;
    setIsLoadingDetails(true);
    getTableActiveOrderDetailsAction(businessId, activeOrder.id)
      .then((res) => {
        if (!isCancelled && res.success && res.order) {
          setDetailedOrder(res.order);
        }
      })
      .catch((err) => {
        console.error("Error cargando detalle de comanda:", err);
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingDetails(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, table, activeOrder, businessId]);

  if (!isOpen || !table || !activeOrder) return null;

  // Unificar lista de ítems (desde detailedOrder o activeOrder)
  const orderItems = detailedOrder?.items || activeOrder.items || [];
  const orderTotal = detailedOrder?.total ?? activeOrder.total ?? 0;
  const orderNumber = detailedOrder?.order_number ?? activeOrder.order_number ?? 0;
  const orderDate = detailedOrder?.created_at || activeOrder.created_at;

  // Extraer mesero responsable
  const waiterName = (() => {
    const notesStr = detailedOrder?.notes || activeOrder.notes || "";
    const waiterMatch = notesStr.match(/\[CAMARERO:([^\]]+)\]/);
    if (waiterMatch) return waiterMatch[1].trim();
    return (
      detailedOrder?.driver_name ||
      activeOrder.driver_name ||
      detailedOrder?.customer_name ||
      activeOrder.customer_name ||
      "Mesero de salón"
    );
  })();

  // Formatear fechas y horas
  const dateObj = orderDate ? new Date(orderDate) : new Date();
  const formattedDate = dateObj.toLocaleDateString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const formattedTime = dateObj.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  // Calcular tiempo de ocupación
  const elapsedMinutes = Math.max(
    1,
    Math.floor((Date.now() - dateObj.getTime()) / (1000 * 60))
  );

  const handlePrint = () => {
    printThermalElement(
      "table-command-print-area",
      `Comanda ${table.name_or_number} (#${orderNumber})`
    );
    toast.success("Enviando comanda a impresión...");
  };

  return (
    <ModalPortal>
      {/* ESTILOS DE IMPRESIÓN TÉRMICA 80MM AISLADOS */}
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
            .table-command-no-print {
              display: none !important;
            }
            #table-command-print-area {
              display: block !important;
              visibility: visible !important;
              position: relative !important;
              width: 80mm !important;
              max-width: 80mm !important;
              margin: 0 !important;
              padding: 4mm 3mm !important;
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
            #table-command-print-area * {
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

      {/* OVERLAY OFICIAL DE NEGOVA */}
      <div
        className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md sm:max-w-lg bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        >
          {/* HEADER DEL MODAL */}
          <div className="px-5 py-4 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-white/[0.02] table-command-no-print">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center border border-[#ED500A]/20">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white font-title">
                    Comanda {table.name_or_number}
                  </h3>
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    {activeOrder.status === "ready" ? "Listo" : "Ocupado"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  {table.roomName ? `${table.roomName} · ` : ""}Orden #{orderNumber} · {elapsedMinutes} min
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar modal"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* CUERPO DEL TICKET DE COMANDA */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex justify-center bg-slate-100/70 dark:bg-black/40">
            <div
              id="table-command-print-area"
              className="w-full max-w-[340px] sm:max-w-[360px] bg-white text-black p-5 sm:p-6 rounded-2xl shadow-lg border border-slate-300/80 font-mono text-center select-none"
            >
              {/* LOGO O NOMBRE COMERCIAL */}
              <div className="font-black text-sm uppercase tracking-wider mb-1">
                {businessName}
              </div>

              {/* BADGE NÚMERO DE ORDEN */}
              <div className="inline-flex items-center justify-center min-w-[64px] h-9 px-4 rounded-full border-2 border-black mx-auto font-black text-lg tracking-wider my-1">
                #{orderNumber}
              </div>

              {/* TÍTULO */}
              <div className="font-black text-xs tracking-widest uppercase mt-1">
                COMANDA DE MESA
              </div>

              {/* DESTINO / MESA */}
              <div className="border-2 border-black py-1.5 px-3 my-2.5 font-black text-sm uppercase tracking-wider bg-slate-50">
                {table.name_or_number} {table.roomName ? `· ${table.roomName.toUpperCase()}` : ""}
              </div>

              {/* METADATOS OPERATIVOS */}
              <div className="text-[11px] text-left space-y-0.5 leading-snug font-medium pt-1">
                <div>Atendido por: <strong className="font-bold">{waiterName}</strong></div>
                <div>Comensales: {table.capacity || 4} personas</div>
                <div>Fecha: {formattedDate}</div>
                <div>Apertura: {formattedTime} ({elapsedMinutes} min)</div>
                {activeOrder.customer_name && (
                  <div>Cliente: {activeOrder.customer_name}</div>
                )}
              </div>

              {/* LÍNEA SEPARADORA */}
              <div className="border-b-2 border-black my-3" />

              {/* LISTA DE PRODUCTOS / ÍTEMS */}
              <div className="space-y-2.5 my-2">
                {isLoadingDetails ? (
                  <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-xs">Cargando productos de comanda...</span>
                  </div>
                ) : orderItems.length === 0 ? (
                  <div className="py-4 text-xs text-slate-500 italic">
                    Sin productos registrados en la comanda
                  </div>
                ) : (
                  orderItems.map((item, idx) => (
                    <div key={item.id || idx} className="text-left text-xs leading-snug">
                      <div className="flex items-start justify-between gap-2 font-black uppercase">
                        <span className="flex-1">
                          {item.quantity}X {(item as any).name || (item as any).product_name}
                        </span>
                        <span className="shrink-0 font-bold">
                          {formatCOP(item.subtotal || item.unit_price * item.quantity || 0)}
                        </span>
                      </div>

                      {/* Modificadores / Adicionales */}
                      {item.modifiers && item.modifiers.length > 0 && (
                        <div className="text-[10px] text-slate-700 pl-3 pt-0.5 space-y-0.5">
                          {item.modifiers.map((mod: any, mIdx: number) => {
                            const modLabel =
                              typeof mod === "string"
                                ? mod
                                : `${mod.optionName || mod.name || "Adicional"}${mod.price ? ` (+${formatCOP(mod.price)})` : ""}`;
                            return (
                              <div key={mIdx}>
                                + {modLabel}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Notas de preparación */}
                      {item.notes && (
                        <div className="text-[10px] text-slate-700 italic pl-3 pt-0.5">
                          * {item.notes}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* LÍNEA SEPARADORA DE TOTALES */}
              <div className="border-b-2 border-black my-3" />

              {/* TOTALES */}
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between text-[11px] font-medium">
                  <span>Subtotal:</span>
                  <span>{formatCOP(orderTotal)}</span>
                </div>
                <div className="flex items-center justify-between font-black text-sm pt-1 border-t border-black/40">
                  <span>TOTAL CUENTA:</span>
                  <span className="text-base">{formatCOP(orderTotal)}</span>
                </div>
              </div>

              {/* LÍNEA SEPARADORA DE CORTE */}
              <div className="border-b-2 border-dashed border-black my-3" />

              {/* PIE DE TICKET */}
              <div className="text-[9px] text-slate-600 space-y-0.5">
                <div>Comanda generada en NEGOVA Mesas</div>
                <div>Impreso: {printTime}</div>
              </div>
            </div>
          </div>

          {/* ACCIONES DEL MODAL */}
          <div className="p-4 border-t border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] shrink-0 space-y-2 table-command-no-print">
            {/* Fila 1: Imprimir y Cobrar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs sm:text-sm bg-slate-900 hover:bg-black text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-sm transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4 stroke-[2.5]" />
                <span>Imprimir Comanda</span>
              </button>

              {onCloseTable && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onCloseTable(table);
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-sm transition-colors cursor-pointer"
                >
                  <DollarSign className="w-4 h-4 stroke-[2.5]" />
                  <span>Cobrar / Cerrar Mesa</span>
                </button>
              )}
            </div>

            {/* Fila 2: Ir a POS a agregar productos o Cerrar */}
            <div className="flex items-center gap-2">
              <Link
                href={`/workspace/${businessId}/pos?tableId=${table.id}`}
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold bg-[#ED500A]/10 hover:bg-[#ED500A]/15 text-[#ED500A] border border-[#ED500A]/20 transition-colors"
                title="Abre el POS para agregar más platos o bebidas a esta mesa"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Agregar productos en POS</span>
              </Link>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] border border-slate-200/60 dark:border-white/[0.06] transition-colors cursor-pointer"
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
