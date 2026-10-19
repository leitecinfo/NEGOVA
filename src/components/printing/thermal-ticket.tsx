"use client";

import React, { useState, useEffect } from "react";
import { Printer, X, Check, FileText, Bike, UtensilsCrossed, ShoppingBag } from "lucide-react";
import { ModalPortal } from "@/components/ui/modal-portal";

export interface ThermalTicketItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string | null;
  modifiers?: Array<{
    groupName: string;
    optionName: string;
    price: number;
  }>;
}

export interface ThermalTicketProps {
  documentNumber: string;
  issuedAt: string | Date;
  business: {
    name: string;
    tradeName?: string;
    legalName?: string;
    taxId?: string;
    address?: string;
    city?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
    logoUrl?: string | null;
  };
  orderType?: "dine_in" | "takeout" | "delivery" | "sale" | string;
  tableName?: string | null;
  dinersCount?: number | null;
  waiterName?: string | null;
  customer?: {
    name?: string | null;
    phone?: string | null;
    address?: string | null;
    deliveryReference?: string | null;
  } | null;
  items: ThermalTicketItem[];
  subtotal: number;
  discountTotal?: number;
  taxTotal?: number;
  deliveryFee?: number;
  total: number;
  paymentMethod?: string | null;
  paymentStatus?: "paid" | "pending" | "partial" | string | null;
  notes?: string | null;
  thankYouNote?: string | null;
  documentObservations?: string | null;
  footerText?: string | null;
  headerText?: string | null;
  defaultPaperWidth?: "58mm" | "80mm";
  isOpen: boolean;
  onClose: () => void;
}

export function ThermalTicketModal({
  documentNumber,
  issuedAt,
  business,
  orderType = "sale",
  tableName,
  dinersCount,
  waiterName,
  customer,
  items,
  subtotal,
  discountTotal = 0,
  deliveryFee = 0,
  total,
  paymentMethod = "cash",
  paymentStatus = "paid",
  notes,
  thankYouNote,
  documentObservations,
  footerText,
  headerText,
  defaultPaperWidth = "80mm",
  isOpen,
  onClose,
}: ThermalTicketProps) {
  // Manejo de ancho térmico con persistencia en localStorage
  const [paperWidth, setPaperWidth] = useState<"58mm" | "80mm">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("negova_thermal_paper_width");
      if (saved === "58mm" || saved === "80mm") return saved;
    }
    return defaultPaperWidth;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("negova_thermal_paper_width", paperWidth);
    }
  }, [paperWidth]);

  if (!isOpen) return null;

  // Formato de moneda colombiana
  const formatCOP = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(Math.round(val || 0));
  };

  // Formato canónico requerido: Fecha y hora juntas en una sola línea
  // Ejemplo: "Fecha y hora: 18/10/2026 · 12:35 p. m."
  const formatDateTimeSingleLine = (dateInput: string | Date) => {
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return "Fecha y hora: No registrada";

      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();

      const timeStr = d.toLocaleTimeString("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      return `Fecha y hora: ${day}/${month}/${year} · ${timeStr}`;
    } catch {
      return "Fecha y hora: No registrada";
    }
  };

  // Método de pago legible
  const getPaymentLabel = (method?: string | null) => {
    switch (method?.toLowerCase()) {
      case "cash":
        return "Efectivo";
      case "transfer":
        return "Transferencia / Nequi / Daviplata";
      case "card":
        return "Tarjeta Débito/Crédito";
      case "credit":
        return "Crédito a cliente";
      default:
        return method || "No especificado";
    }
  };

  // Destino legible
  const getDestinationLabel = () => {
    switch (orderType) {
      case "dine_in":
        return "Consumo en Local / Salón";
      case "takeout":
        return "Para Llevar / Retiro en Mostrador";
      case "delivery":
        return "Entrega a Domicilio";
      default:
        return "Venta en Mostrador";
    }
  };

  const handlePrint = () => {
    // Establecer variable CSS para ancho de página en impresión
    document.documentElement.style.setProperty(
      "--ticket-width",
      paperWidth === "58mm" ? "58mm" : "80mm"
    );
    window.print();
  };

  const is58mm = paperWidth === "58mm";

  return (
    <ModalPortal>
      {/* ESTILOS DE IMPRESIÓN AISLADOS (@media print) */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          @page {
            margin: 0 !important;
            size: ${paperWidth === "58mm" ? "58mm auto" : "80mm auto"} !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: ${paperWidth === "58mm" ? "58mm" : "80mm"} !important;
          }
          /* Ocultar todo el layout y portal */
          body > * {
            display: none !important;
          }
          /* Mostrar únicamente el contenedor del tiquete */
          #thermal-ticket-printable-root {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${paperWidth === "58mm" ? "54mm" : "76mm"} !important;
            max-width: ${paperWidth === "58mm" ? "54mm" : "76mm"} !important;
            margin: 0 auto !important;
            padding: ${paperWidth === "58mm" ? "1.5mm" : "2.5mm"} !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Courier New', Courier, monospace, monospace !important;
            box-shadow: none !important;
            border: none !important;
            z-index: 2147483647 !important;
          }
          #thermal-ticket-printable-root * {
            visibility: visible !important;
            color: #000000 !important;
            background: transparent !important;
            text-shadow: none !important;
            box-shadow: none !important;
          }
          .thermal-no-print {
            display: none !important;
          }
        }
      `}} />

      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4 m-0 thermal-no-print animate-in fade-in duration-150">
        <div
          role="dialog"
          aria-modal="true"
          className="bg-white dark:bg-[#0B0E14] rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
        >
          {/* ENCABEZADO MODAL: CONTROLES DE ANCHO Y CIERRE */}
          <div className="p-4 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between gap-3 bg-slate-50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                  Vista Previa de Tiquete Térmico
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Comprobante comercial para impresoras de 58 mm y 80 mm
                </p>
              </div>
            </div>

            {/* SELECTOR DE ANCHO: 58 mm vs 80 mm */}
            <div className="flex items-center gap-1 p-1 bg-slate-200/80 dark:bg-white/10 rounded-xl">
              <button
                type="button"
                onClick={() => setPaperWidth("58mm")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  is58mm
                    ? "bg-white dark:bg-[#0D0F16] text-emerald-600 dark:text-emerald-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                }`}
              >
                58 mm
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth("80mm")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  !is58mm
                    ? "bg-white dark:bg-[#0D0F16] text-emerald-600 dark:text-emerald-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                }`}
              >
                80 mm
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* SIMULADOR DE PAPEL TÉRMICO (SCROLLABLE EN PANTALLA) */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-black/50 flex justify-center items-start">
            <div
              id="thermal-ticket-printable-root"
              className={`bg-white text-black shadow-md border border-slate-300 font-mono transition-all duration-200 ${
                is58mm ? "w-[260px] p-3 text-[11px]" : "w-[360px] p-5 text-[12px]"
              }`}
              style={{
                lineHeight: "1.35",
                color: "#000000",
                backgroundColor: "#ffffff",
              }}
            >
              {/* 1. ENCABEZADO DEL NEGOCIO */}
              <div className="text-center space-y-1 pb-2">
                {business.logoUrl && (
                  <div className="flex justify-center mb-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={business.logoUrl}
                      alt={business.tradeName || business.name}
                      className="max-h-12 max-w-[120px] object-contain filter grayscale contrast-200"
                    />
                  </div>
                )}
                <h2 className="font-black text-sm uppercase tracking-wide leading-tight">
                  {business.tradeName || business.name}
                </h2>
                {business.legalName && business.legalName !== business.tradeName && (
                  <p className="text-[10px] text-gray-700 leading-tight">
                    {business.legalName}
                  </p>
                )}
                {business.taxId && (
                  <p className="text-[10px] text-gray-800">
                    NIT / RUT: <span className="font-semibold">{business.taxId}</span>
                  </p>
                )}
                {business.address && (
                  <p className="text-[10px] text-gray-800 leading-tight">
                    {business.address} {business.city ? `• ${business.city}` : ""}
                  </p>
                )}
                {(business.phone || business.whatsapp) && (
                  <p className="text-[10px] text-gray-800">
                    Tel: {business.phone || business.whatsapp}
                  </p>
                )}
                {headerText && (
                  <p className="text-[10px] text-gray-600 italic pt-0.5">
                    {headerText}
                  </p>
                )}
              </div>

              {/* LÍNEA DIVISORIA */}
              <div className="border-t border-dashed border-black/80 my-2" />

              {/* 2. INFORMACIÓN DE LA OPERACIÓN COMERCIAL */}
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between font-bold">
                  <span>TIQUETE:</span>
                  <span>{documentNumber}</span>
                </div>

                {/* FECHA Y HORA EN UNA SOLA LÍNEA */}
                <p className="text-[10px] text-gray-800">
                  {formatDateTimeSingleLine(issuedAt)}
                </p>

                {/* TIPO DE DESTINO Y SERVICIO */}
                <div className="text-[10px] font-semibold text-gray-800">
                  Modalidad: <span className="uppercase">{getDestinationLabel()}</span>
                </div>

                {/* MESA Y MESERO (SI APLICA) */}
                {orderType === "dine_in" && tableName && (
                  <div className="text-[10px] font-bold text-gray-900 flex justify-between">
                    <span>MESA: {tableName}</span>
                    {dinersCount && <span>{dinersCount} personas</span>}
                  </div>
                )}

                {waiterName && (
                  <div className="text-[10px] text-gray-700">
                    Atendido por: {waiterName}
                  </div>
                )}

                {/* DATOS DE ENTREGA A DOMICILIO (SI APLICA) */}
                {orderType === "delivery" && customer && (
                  <div className="mt-1.5 p-1.5 bg-gray-50 border border-gray-300 rounded text-[10px] space-y-0.5">
                    <p className="font-bold uppercase tracking-tight">Datos de Entrega:</p>
                    {customer.address && (
                      <p className="font-semibold leading-tight">
                        Dirección: {customer.address}
                      </p>
                    )}
                    {customer.deliveryReference && (
                      <p className="italic text-gray-700 leading-tight">
                        Ref: {customer.deliveryReference}
                      </p>
                    )}
                    {customer.name && customer.name !== "Cliente Domicilio" && (
                      <p>Destinatario: {customer.name}</p>
                    )}
                    {customer.phone && (
                      <p>Teléfono: {customer.phone}</p>
                    )}
                  </div>
                )}

                {/* DATOS DE CLIENTE EN MOSTRADOR (SI ESTÁ IDENTIFICADO) */}
                {orderType !== "delivery" && customer?.name && customer.name !== "Consumidor Final" && (
                  <div className="text-[10px] text-gray-700">
                    Cliente: <span className="font-semibold">{customer.name}</span>
                    {customer.phone ? ` • Tel: ${customer.phone}` : ""}
                  </div>
                )}
              </div>

              {/* LÍNEA DIVISORIA */}
              <div className="border-t border-dashed border-black/80 my-2" />

              {/* 3. DETALLE DE PRODUCTOS */}
              <div className="w-full">
                {is58mm ? (
                  /* FORMATO COMPACTO 58 mm: Cant x Detalle + Total en fila */
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-bold text-[10px] border-b border-black pb-0.5 uppercase">
                      <span>Cant x Producto</span>
                      <span className="text-right">Importe</span>
                    </div>

                    {items.map((item, idx) => (
                      <div key={idx} className="space-y-0.5 pt-0.5 border-b border-dotted border-gray-200 pb-1">
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="font-semibold leading-tight break-words flex-1">
                            {item.quantity}x {item.description}
                          </span>
                          <span className="font-mono font-bold whitespace-nowrap text-right">
                            {formatCOP(item.total)}
                          </span>
                        </div>

                        <div className="flex justify-between text-[10px] text-gray-600 pl-3">
                          <span>@ {formatCOP(item.unitPrice)} c/u</span>
                        </div>

                        {item.modifiers && item.modifiers.length > 0 && (
                          <div className="pl-3 text-[9px] text-gray-600 italic">
                            {item.modifiers.map((m, mIdx) => (
                              <div key={mIdx}>
                                + {m.optionName} {m.price > 0 ? `(${formatCOP(m.price)})` : ""}
                              </div>
                            ))}
                          </div>
                        )}

                        {item.notes && (
                          <div className="pl-3 text-[9px] text-gray-600 italic">
                            Nota: {item.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  /* FORMATO COMPLETO 80 mm: Tabla 4 Columnas Alíneadas */
                  <div>
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="border-b border-black text-[10px] font-bold uppercase">
                          <th className="py-1 pr-1 w-7">Cant</th>
                          <th className="py-1 pr-1">Descripción</th>
                          <th className="py-1 pr-1 text-right w-16">P.Unit</th>
                          <th className="py-1 text-right w-18">Importe</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dotted divide-gray-200">
                        {items.map((item, idx) => (
                          <tr key={idx} className="align-top">
                            <td className="py-1 pr-1 font-bold text-center">
                              {item.quantity}
                            </td>
                            <td className="py-1 pr-1 break-words leading-tight">
                              <div>{item.description}</div>
                              {item.modifiers && item.modifiers.length > 0 && (
                                <div className="text-[9px] text-gray-600 italic pl-1">
                                  {item.modifiers.map((m, mIdx) => (
                                    <div key={mIdx}>
                                      + {m.optionName} {m.price > 0 ? `(${formatCOP(m.price)})` : ""}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {item.notes && (
                                <div className="text-[9px] text-gray-600 italic pl-1">
                                  Nota: {item.notes}
                                </div>
                              )}
                            </td>
                            <td className="py-1 pr-1 text-right whitespace-nowrap font-mono text-[10px]">
                              {formatCOP(item.unitPrice)}
                            </td>
                            <td className="py-1 text-right whitespace-nowrap font-mono font-bold">
                              {formatCOP(item.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* LÍNEA DIVISORIA */}
              <div className="border-t border-dashed border-black/80 my-2" />

              {/* 4. TOTALES Y AJUSTES COMERCIALES */}
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-mono">{formatCOP(subtotal)}</span>
                </div>

                {discountTotal > 0 && (
                  <div className="flex justify-between text-gray-700">
                    <span>Descuento:</span>
                    <span className="font-mono">-{formatCOP(discountTotal)}</span>
                  </div>
                )}

                {deliveryFee > 0 && (
                  <div className="flex justify-between text-gray-700">
                    <span>Costo de Domicilio:</span>
                    <span className="font-mono">+{formatCOP(deliveryFee)}</span>
                  </div>
                )}

                <div className="border-t border-black pt-1.5 flex justify-between font-black text-sm">
                  <span>TOTAL A PAGAR:</span>
                  <span className="font-mono">{formatCOP(total)}</span>
                </div>
              </div>

              {/* LÍNEA DIVISORIA */}
              <div className="border-t border-dashed border-black/80 my-2" />

              {/* 5. CIERRE DEL COMPROBANTE */}
              <div className="space-y-2 text-center text-[10px]">
                <div className="flex justify-between items-center bg-gray-100 p-1.5 rounded">
                  <span className="font-semibold">Método de pago:</span>
                  <span className="font-bold uppercase">{getPaymentLabel(paymentMethod)}</span>
                </div>

                {paymentStatus && (
                  <div className="text-[10px] font-bold">
                    Estado:{" "}
                    <span
                      className={
                        paymentStatus === "paid"
                          ? "uppercase tracking-wider text-emerald-800"
                          : "uppercase tracking-wider text-amber-800"
                      }
                    >
                      {paymentStatus === "paid" ? "PAGADO" : "PENDIENTE DE PAGO"}
                    </span>
                  </div>
                )}

                {notes && (
                  <div className="italic text-gray-600 text-[10px] text-left pt-1 border-t border-dotted border-gray-300">
                    Observaciones: {notes}
                  </div>
                )}

                {documentObservations && (
                  <div className="text-[9px] text-gray-600 leading-tight">
                    {documentObservations}
                  </div>
                )}

                {/* MENSAJE DE AGRADECIMIENTO */}
                <p className="font-bold text-xs pt-2 uppercase tracking-wide">
                  {thankYouNote || "¡Gracias por su compra / visita!"}
                </p>

                {footerText && (
                  <p className="text-[9px] text-gray-500 pt-1 leading-tight">
                    {footerText}
                  </p>
                )}

                <p className="text-[8px] text-gray-400 pt-1">
                  NEGOVA SaaS • Control Comercial
                </p>
              </div>
            </div>
          </div>

          {/* BARRA INFERIOR DE ACCIONES */}
          <div className="p-4 border-t border-slate-200 dark:border-white/[0.08] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#0B0E14] shrink-0">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center sm:text-left leading-snug max-w-xs sm:max-w-sm">
              Márgenes recomendados: <strong>«Ninguno»</strong> en el diálogo de impresión.
            </p>

            <div className="flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/[0.08] transition-colors cursor-pointer shrink-0"
              >
                Cerrar
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#ED500A] hover:bg-[#d94608] text-white shadow-md shadow-[#ED500A]/20 transition-all cursor-pointer active:scale-[0.98] shrink-0 whitespace-nowrap"
              >
                <Printer className="w-4 h-4 shrink-0" />
                <span>Imprimir Tiquete</span>
                <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[10px] font-mono font-medium">
                  {paperWidth}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
