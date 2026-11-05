"use client";

import React, { useState } from "react";
import {
  Printer,
  Receipt,
  FileText,
  Clock,
  User,
  Users,
  MapPin,
  Building2,
  Phone,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { printThermalElement } from "@/lib/printing/print-thermal-element";
import {
  TicketTemplateConfig,
  KitchenCommandTemplateConfig,
} from "@/lib/printing/types";
import {
  getSampleTicketMock,
  getSampleKitchenCommandMock,
} from "@/lib/printing/mock-templates";

interface TicketLivePreviewProps {
  businessMaster: {
    name: string;
    tradeName?: string;
    legalName?: string;
    taxId?: string;
    address?: string;
    city?: string;
    phone?: string;
    logoUrl?: string | null;
  };
  ticketTemplate: TicketTemplateConfig;
  kitchenTemplate: KitchenCommandTemplateConfig;
  activeView?: "ticket" | "kitchen";
  onViewChange?: (view: "ticket" | "kitchen") => void;
  className?: string;
}

export function TicketLivePreview({
  businessMaster,
  ticketTemplate,
  kitchenTemplate,
  activeView: controlledView,
  onViewChange,
  className = "",
}: TicketLivePreviewProps) {
  const [internalView, setInternalView] = useState<"ticket" | "kitchen">("ticket");
  const [paperWidth, setPaperWidth] = useState<"80mm" | "58mm">(
    ticketTemplate.paperWidth || "80mm"
  );

  const activeView = controlledView !== undefined ? controlledView : internalView;
  const setView = (v: "ticket" | "kitchen") => {
    if (onViewChange) onViewChange(v);
    else setInternalView(v);
  };

  const sampleTicket = getSampleTicketMock(businessMaster, ticketTemplate);
  const sampleKitchen = getSampleKitchenCommandMock(kitchenTemplate);

  // Formato COP
  const formatCOP = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(Math.round(val || 0));
  };

  const is58mm = paperWidth === "58mm";

  const effectiveLogo =
    ticketTemplate.customLogoUrl !== undefined
      ? ticketTemplate.customLogoUrl
      : businessMaster.logoUrl;

  const handlePrintSample = () => {
    printThermalElement("ticket-preview-paper", "Muestra Térmica NEGOVA");
  };

  return (
    <div className={`flex flex-col h-full bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden ${className}`}>
      {/* Barra de control superior de la vista previa */}
      <div className="p-3 bg-slate-950/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Selector de modo: Ticket vs Comanda */}
        <div className="inline-flex rounded-xl bg-slate-900 p-0.5 border border-slate-800">
          <button
            type="button"
            onClick={() => setView("ticket")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              activeView === "ticket"
                ? "bg-orange-500 text-white shadow-xs font-semibold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Ticket Venta</span>
          </button>
          <button
            type="button"
            onClick={() => setView("kitchen")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              activeView === "kitchen"
                ? "bg-orange-500 text-white shadow-xs font-semibold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Tique Preparación</span>
          </button>
        </div>

        {/* Selector de ancho térmico */}
        <div className="flex items-center gap-1.5">
          <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-800 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => setPaperWidth("80mm")}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                paperWidth === "80mm"
                  ? "bg-slate-800 text-orange-400 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              80 mm
            </button>
            <button
              type="button"
              onClick={() => setPaperWidth("58mm")}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                paperWidth === "58mm"
                  ? "bg-slate-800 text-orange-400 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              58 mm
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrintSample}
            title="Imprimir muestra"
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Contenedor con simulación de papel térmico */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950/50 flex justify-center items-start">
        {activeView === "ticket" ? (
          /* =================================================================
             1. SIMULACIÓN TICKET DE VENTA / COMPROBANTE COMERCIAL
             ================================================================= */
          <div
            id="ticket-preview-paper"
            className={`bg-white text-black font-mono transition-all duration-300 shadow-2xl relative select-none ${
              is58mm
                ? "w-[240px] text-[10px] p-3 leading-tight"
                : "w-[310px] text-[11px] p-4 leading-normal"
            }`}
            style={{
              boxShadow: "0 10px 30px rgba(0,0,0,0.5), 0 0 1px rgba(0,0,0,0.2)",
            }}
          >
            {/* Efecto borde rasgado superior */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-[radial-gradient(circle,_transparent_3px,_#fff_3px)] bg-[length:8px_8px] -translate-y-1 rotate-180" />

            {/* LOGOTIPO DEL NEGOCIO */}
            {ticketTemplate.showLogo && (
              <div className="flex justify-center mb-2.5">
                {effectiveLogo ? (
                  <img
                    src={effectiveLogo}
                    alt="Logo del negocio"
                    className="max-h-14 max-w-[130px] object-contain"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg border border-dashed border-gray-400 flex flex-col items-center justify-center text-gray-400 text-[8px]">
                    <Building2 className="w-4 h-4 mb-0.5 text-gray-500" />
                    <span>Sin logo</span>
                  </div>
                )}
              </div>
            )}

            {/* ENCABEZADO FISCAL & COMERCIAL */}
            <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-gray-400">
              <h2 className="font-bold text-xs uppercase tracking-tight">
                {ticketTemplate.businessName || businessMaster.tradeName || businessMaster.name}
              </h2>
              {ticketTemplate.legalName && (
                <p className="text-[9px] text-gray-700 uppercase">
                  {ticketTemplate.legalName}
                </p>
              )}
              {ticketTemplate.taxId && (
                <p className="font-bold text-[9px]">NIT: {ticketTemplate.taxId}</p>
              )}
              {ticketTemplate.address && (
                <p className="text-[9px] text-gray-800">{ticketTemplate.address}</p>
              )}
              {ticketTemplate.phone && (
                <p className="text-[9px] text-gray-800">TEL: {ticketTemplate.phone}</p>
              )}
              {ticketTemplate.headerText && (
                <p className="text-[8.5px] italic text-gray-600 mt-1">
                  {ticketTemplate.headerText}
                </p>
              )}
            </div>

            {/* METADATOS DEL COMPROBANTE */}
            <div className="py-2 border-b border-dashed border-gray-400 space-y-0.5 text-[9.5px]">
              <div className="flex justify-between font-bold">
                <span>COMPROBANTE:</span>
                <span>{sampleTicket.documentNumber}</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span>FECHA:</span>
                <span>01/11/2026 18:30</span>
              </div>
              {ticketTemplate.showWaiterInfo && (
                <div className="flex justify-between text-gray-700">
                  <span>ATENDIÓ:</span>
                  <span>{sampleTicket.waiterName}</span>
                </div>
              )}
              {ticketTemplate.showCustomerInfo && (
                <div className="flex justify-between text-gray-700">
                  <span>CLIENTE:</span>
                  <span className="truncate max-w-[150px]">{sampleTicket.customer.name}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-700">
                <span>ORIGEN:</span>
                <span>{sampleTicket.tableName}</span>
              </div>
            </div>

            {/* TABLA DE PRODUCTOS E IMPORTES */}
            <div className="py-2 border-b border-dashed border-gray-400">
              <div className="flex justify-between font-bold border-b border-black pb-1 mb-1 text-[9.5px]">
                <span className="w-7">CANT</span>
                <span className="flex-1 text-left px-1">DESCRIPCIÓN</span>
                <span className="text-right">TOTAL</span>
              </div>
              <div className="space-y-1.5">
                {sampleTicket.items.map((item, idx) => (
                  <div key={idx} className="text-[9.5px]">
                    <div className="flex justify-between items-start">
                      <span className="w-7 font-bold">{item.quantity}x</span>
                      <span className="flex-1 px-1 font-semibold">{item.description}</span>
                      <span className="text-right font-bold">{formatCOP(item.total)}</span>
                    </div>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div className="pl-7 text-[8px] text-gray-600 space-y-0.5">
                        {item.modifiers.map((m, mIdx) => (
                          <div key={mIdx} className="flex justify-between">
                            <span>+ {m.optionName}</span>
                            {m.price > 0 && <span>{formatCOP(m.price)}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {item.notes && (
                      <p className="pl-7 text-[8px] italic text-gray-500">
                        * {item.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* TOTALES Y FORMA DE PAGO */}
            <div className="py-2 border-b border-dashed border-gray-400 space-y-1 text-[9.5px]">
              <div className="flex justify-between">
                <span>SUBTOTAL:</span>
                <span>{formatCOP(sampleTicket.subtotal)}</span>
              </div>
              <div className="flex justify-between font-bold text-xs pt-1 border-t border-black">
                <span>TOTAL A PAGAR:</span>
                <span>{formatCOP(sampleTicket.total)}</span>
              </div>
              {ticketTemplate.showPaymentDetails && (
                <div className="flex justify-between text-[9px] text-gray-700 pt-0.5">
                  <span>MÉTODO:</span>
                  <span>{sampleTicket.paymentMethod} (PAGADO)</span>
                </div>
              )}
            </div>

            {/* PIE DE PÁGINA & AGRADECIMIENTO */}
            <div className="pt-2.5 text-center space-y-1 text-[8.5px]">
              {ticketTemplate.thankYouNote && (
                <p className="font-bold uppercase tracking-tight">
                  {ticketTemplate.thankYouNote}
                </p>
              )}
              {ticketTemplate.footerText && (
                <p className="text-gray-600 leading-tight">
                  {ticketTemplate.footerText}
                </p>
              )}
              <div className="text-[7.5px] text-gray-400 pt-1">
                NEGOVA POS · Sistema de Gestión
              </div>
            </div>

            {/* Efecto borde rasgado inferior */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-[radial-gradient(circle,_transparent_3px,_#fff_3px)] bg-[length:8px_8px] translate-y-1" />
          </div>
        ) : (
          /* =================================================================
             2. SIMULACIÓN COMANDA DE COCINA (SIN PRECIOS, MODIFICADORES RESALTADOS)
             ================================================================= */
          <div
            id="kitchen-command-preview-paper"
            className={`bg-white text-black font-mono transition-all duration-300 shadow-2xl relative select-none ${
              is58mm
                ? "w-[240px] text-[10px] p-3 leading-tight"
                : "w-[310px] text-[11px] p-4 leading-normal"
            }`}
            style={{
              boxShadow: "0 10px 30px rgba(0,0,0,0.5), 0 0 1px rgba(0,0,0,0.2)",
            }}
          >
            {/* Efecto borde rasgado superior */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-[radial-gradient(circle,_transparent_3px,_#fff_3px)] bg-[length:8px_8px] -translate-y-1 rotate-180" />

            {/* TÍTULO Y NÚMERO DE COMANDA GRANDE */}
            <div className="text-center pb-2 border-b-2 border-black">
              <h1 className="font-bold text-xs tracking-wider uppercase">
                {kitchenTemplate.headerTitle || "*** COMANDA DE COCINA ***"}
              </h1>
              <div className="flex items-center justify-center gap-2 my-1">
                <span className="text-2xl font-black bg-black text-white px-2.5 py-0.5 rounded">
                  #{sampleKitchen.orderNumber}
                </span>
              </div>
              <div className="text-[9px] uppercase font-bold text-gray-800">
                {sampleKitchen.area}
              </div>
            </div>

            {/* METADATOS DE SALÓN / MESA */}
            <div className="py-2 border-b border-dashed border-gray-500 space-y-0.5 text-[10px]">
              {kitchenTemplate.showTableNumber && (
                <div className="flex justify-between font-bold">
                  <span>UBICACIÓN:</span>
                  <span className="bg-gray-200 px-1 rounded">{sampleKitchen.tableName}</span>
                </div>
              )}
              {kitchenTemplate.showWaiterName && (
                <div className="flex justify-between">
                  <span>MESERO:</span>
                  <span className="font-semibold">{sampleKitchen.waiterName}</span>
                </div>
              )}
              {kitchenTemplate.showDinersCount && (
                <div className="flex justify-between">
                  <span>COMENSALES:</span>
                  <span>{sampleKitchen.dinersCount} Personas</span>
                </div>
              )}
              <div className="flex justify-between text-gray-700 text-[9px]">
                <span>HORA ENVÍO:</span>
                <span>18:32:15</span>
              </div>
            </div>

            {/* ITEMS DE COCINA - ¡SIN PRECIOS! Y CON MODIFICADORES RESALTADOS */}
            <div className="py-2.5 space-y-3 border-b-2 border-black">
              {sampleKitchen.items.map((item, idx) => (
                <div key={item.id} className="space-y-1 border-b border-gray-200 pb-2 last:border-0 last:pb-0">
                  {/* Cantidad y Nombre del Plato */}
                  <div className="flex items-start gap-1.5">
                    <span className="text-sm font-black bg-black text-white px-1.5 py-0.2 rounded shrink-0">
                      {item.quantity}
                    </span>
                    <span className="font-bold text-xs uppercase leading-snug">
                      {item.name}
                    </span>
                  </div>

                  {/* Modificadores resaltados */}
                  {item.modifiers && item.modifiers.length > 0 && (
                    <div className="pl-6 space-y-0.5 text-[9.5px]">
                      {item.modifiers.map((mod, mIdx) => {
                        const isAdd = mod.type === "add";
                        const isRemove = mod.type === "remove";
                        return (
                          <div
                            key={mIdx}
                            className={`font-bold flex items-center gap-1 ${
                              kitchenTemplate.highlightModifiers
                                ? isAdd
                                  ? "text-emerald-700 bg-emerald-50 px-1 rounded"
                                  : isRemove
                                  ? "text-rose-700 bg-rose-50 line-through decoration-rose-600 px-1 rounded"
                                  : "text-blue-800 bg-blue-50 px-1 rounded"
                                : "text-black"
                            }`}
                          >
                            <span>→ {mod.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Notas operativas específicas */}
                  {item.notes && (
                    <div className="pl-6 text-[9px] font-bold text-amber-900 bg-amber-50 p-1 rounded border-l-2 border-amber-600">
                      NOTA: {item.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* NOTA GENERAL DE LA COMANDA */}
            {sampleKitchen.generalNotes && (
              <div className="py-2 border-b border-dashed border-gray-500">
                <div className="text-[9px] font-bold uppercase text-red-700 bg-red-50 p-1.5 rounded border border-red-200">
                  ⚠️ ALERTA GENERAL: {sampleKitchen.generalNotes}
                </div>
              </div>
            )}

            {/* PIE DE COMANDA - CONFIRMACIÓN DE QUE NO HAY PRECIOS */}
            <div className="pt-2 text-center text-[8.5px] text-gray-500 space-y-0.5">
              <div className="font-bold text-gray-800">
                [ COMANDA OPERATIVA SIN PRECIOS ]
              </div>
              <p>Total platos ordenados: 4 unidades</p>
              <div className="text-[7.5px] text-gray-400">
                Estación: Despacho Cocina · NEGOVA KDS
              </div>
            </div>

            {/* Efecto borde rasgado inferior */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-[radial-gradient(circle,_transparent_3px,_#fff_3px)] bg-[length:8px_8px] translate-y-1" />
          </div>
        )}
      </div>

      {/* Indicador inferior de estado de vista previa */}
      <div className="p-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-orange-400" />
          <span>
            {activeView === "ticket"
              ? "Vista previa con datos reales del comercio"
              : "Comanda de cocina: Modificadores resaltados y sin precios"}
          </span>
        </div>
        <span className="font-mono text-slate-500">{paperWidth}</span>
      </div>
    </div>
  );
}

