"use client";

import React, { useState } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  X,
  FileText,
  User,
  CreditCard,
  Banknote,
  ClipboardList,
  Calendar,
  Package,
  Download,
  Receipt,
  UtensilsCrossed,
  ShoppingBag,
  Bike,
  Store,
  DollarSign,
  Loader2,
  ExternalLink,
  CheckCircle2,
  Clock,
  Phone,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { RestaurantOrderWithDetails } from "@/lib/restaurant/types";
import { formatCOP } from "@/config/plans";
import { downloadOrderPdfAction } from "./actions";
import { ThermalTicketModal } from "@/components/printing/thermal-ticket";
import Link from "next/link";

interface OrderDetailModalProps {
  businessId: string;
  businessName: string;
  isOpen: boolean;
  order: RestaurantOrderWithDetails | null;
  onClose: () => void;
  canUpdateOrder?: boolean;
  canCancelOrder?: boolean;
  onPay?: (order: RestaurantOrderWithDetails) => void;
  onCancel?: (order: RestaurantOrderWithDetails) => void;
  onStatusTransition?: (order: RestaurantOrderWithDetails, nextStatus: string) => void;
  isUpdatingStatus?: boolean;
  updatingOrderId?: string | null;
}

/**
 * Formatea la fecha y hora para el subtítulo:
 * Ejemplo: "lunes, 2 nov · 01:46"
 */
function formatOrderSubtitleDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const dayName = d.toLocaleDateString("es-CO", { weekday: "long" });
    const day = d.getDate();
    const month = d.toLocaleDateString("es-CO", { month: "short" }).replace(".", "");
    const time = d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${dayName}, ${day} ${month} · ${time}`;
  } catch {
    return dateStr;
  }
}

/**
 * Formatea la fecha y hora completa de creación:
 * Ejemplo: "2 Noviembre 2026 · 01:46"
 */
function formatOrderCreationDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.toLocaleDateString("es-CO", { month: "long" });
    const monthCapitalized = month.charAt(0).toUpperCase() + month.slice(1);
    const year = d.getFullYear();
    const time = d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${day} ${monthCapitalized} ${year} · ${time}`;
  } catch {
    return dateStr;
  }
}

/**
 * Componente SVG de puntos decorativos para la esquina inferior derecha
 */
function CornerDecorativeDots() {
  return (
    <svg
      className="absolute bottom-1.5 right-1.5 w-7 h-7 text-slate-300/40 dark:text-white/10 pointer-events-none"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <circle cx="6" cy="6" r="1.3" />
      <circle cx="12" cy="6" r="1.3" />
      <circle cx="18" cy="6" r="1.3" />
      <circle cx="6" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="18" cy="12" r="1.3" />
      <circle cx="6" cy="18" r="1.3" />
      <circle cx="12" cy="18" r="1.3" />
      <circle cx="18" cy="18" r="1.3" />
    </svg>
  );
}

export function OrderDetailModal({
  businessId,
  businessName,
  isOpen,
  order,
  onClose,
  canUpdateOrder = false,
  canCancelOrder = false,
  onPay,
  onCancel,
  onStatusTransition,
  isUpdatingStatus = false,
  updatingOrderId = null,
}: OrderDetailModalProps) {
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [ticketModalConfig, setTicketModalConfig] = useState<{
    isOpen: boolean;
    orderType: string;
    documentTitle?: string;
    documentNumber?: string;
  }>({
    isOpen: false,
    orderType: "takeout",
  });

  if (!isOpen || !order) return null;

  // 1. Identificador principal (Nombre de la orden o cajero / responsable)
  const orderIdentifier =
    order.tableName ? `${businessName} (${order.tableName})` : businessName || "Pedido";

  // 2. Subtítulo descriptivo
  const customerLabel = order.customer_name || "Público general";
  const subtitle = `Orden para ${customerLabel} · ${formatOrderSubtitleDate(order.created_at)}`;

  // 3. Mapeo de estados y badges
  const isCompleted = order.status === "delivered" || (order.status as string) === "completed";
  const statusLabel =
    order.status === "delivered"
      ? "Completado"
      : order.status === "ready"
      ? "Listo"
      : order.status === "in_preparation"
      ? "En preparación"
      : order.status === "received"
      ? "Recibido"
      : order.status === "cancelled"
      ? "Cancelado"
      : "Pendiente";

  const statusDotColor = isCompleted
    ? "bg-emerald-500"
    : order.status === "cancelled"
    ? "bg-rose-500"
    : order.status === "ready"
    ? "bg-blue-500"
    : order.status === "in_preparation"
    ? "bg-amber-500"
    : "bg-orange-500";

  // Origen
  const originLabel =
    order.channel_origin === "in_person"
      ? "POS"
      : order.channel_origin === "digital_menu"
      ? "MENÚ QR"
      : order.channel_origin === "whatsapp"
      ? "WHATSAPP"
      : "POS";

  // Modalidad del servicio
  const serviceLabel =
    order.order_type === "takeout"
      ? "Para Recoger"
      : order.order_type === "dine_in"
      ? order.tableName
        ? `Mesa ${order.tableName}`
        : "Para Comer Aquí"
      : "A Domicilio";

  // Método de pago
  const paymentMethodLabel =
    order.payment_status === "paid"
      ? "Efectivo"
      : order.payment_status === "credit"
      ? "A Crédito"
      : order.payment_status === "partial"
      ? "Abono Parcial"
      : "Efectivo";

  // Cantidad total de ítems
  const itemsCount = order.items?.length || order.itemsCount || 0;

  // Descarga de PDF con server action
  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const res = await downloadOrderPdfAction(businessId, order.id);
      if (!res.success || !res.base64) {
        toast.error("Error al descargar PDF", {
          description: res.error || "No se pudo generar el documento PDF.",
        });
        return;
      }

      const byteCharacters = atob(res.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = res.filename || `Orden_${order.order_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("PDF descargado correctamente");
    } catch (err: any) {
      toast.error("Error al descargar el PDF", {
        description: err?.message || "Ocurrió un error inesperado.",
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <>
      <ModalPortal>
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
          onClick={onClose}
        >
          <div
            className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-xl md:max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ========================================================= */}
            {/* 1. ENCABEZADO SUPERIOR                                    */}
            {/* ========================================================= */}
            <div className="flex items-start justify-between p-5 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.01]">
              <div className="flex items-start gap-3.5 min-w-0 pr-2">
                {/* Icono representativo: Contenedor cuadrado alineado a la izquierda con icono de documento */}
                <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/[0.08] flex items-center justify-center text-slate-700 dark:text-slate-200 shrink-0">
                  <Receipt className="w-5 h-5 text-[#ED500A]" />
                </div>

                <div className="space-y-1 min-w-0">
                  {/* Identificador principal: Nombre de la orden o cajero/responsable */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">
                      {orderIdentifier}
                    </h3>
                    <span className="font-mono text-xs font-bold text-slate-400">
                      #{order.order_number}
                    </span>
                  </div>

                  {/* Subtítulo descriptivo: Cadena continua con tipo de destinatario, día, fecha y hora */}
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {subtitle}
                  </p>

                  {/* Badges de estado: Etiqueta con punto indicador de estado y Etiqueta de origen */}
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    {/* Etiqueta con punto indicador de estado */}
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor}`} />
                      <span>{statusLabel}</span>
                    </span>

                    {/* Etiqueta de origen */}
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/[0.08]">
                      {originLabel}
                    </span>

                    {/* Badge de pago */}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                        order.payment_status === "paid"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                      }`}
                    >
                      {order.payment_status === "paid" ? "Pagado" : "Pago Pendiente"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Botón de cierre: Icono ✕ circular situado en el extremo superior derecho */}
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors cursor-pointer shrink-0"
                title="Cerrar modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* CUERPO DEL MODAL */}
            <div className="overflow-y-auto p-5 sm:p-6 space-y-5 flex-1 [scrollbar-width:thin]">
              {/* ========================================================= */}
              {/* 2. SECCIÓN: INFORMACIÓN DE LA ORDEN                       */}
              {/* ========================================================= */}
              <div className="space-y-3">
                {/* Título de sección: Texto precedido por un icono de usuario */}
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <User className="w-4 h-4 text-[#ED500A]" />
                  <span>Información de la orden</span>
                </div>

                {/* Disposición visual: Cuadrícula de 2 columnas por 2 filas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Tarjeta 1 (Cliente) */}
                  <div className="relative p-3.5 sm:p-4 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded-lg bg-slate-200/60 dark:bg-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        CLIENTE
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      {order.customer_name || "Público General"}
                    </p>
                    {order.customer_phone && (
                      <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                        Tel: {order.customer_phone}
                      </span>
                    )}
                    <CornerDecorativeDots />
                  </div>

                  {/* Tarjeta 2 (Método de Pago) */}
                  <div className="relative p-3.5 sm:p-4 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded-lg bg-slate-200/60 dark:bg-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300">
                        <CreditCard className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        MÉTODO DE PAGO
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      {paymentMethodLabel}
                    </p>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {order.payment_status === "paid" ? "Transacción liquidada" : "Cobro pendiente"}
                    </span>
                    <CornerDecorativeDots />
                  </div>

                  {/* Tarjeta 3 (Servicio) */}
                  <div className="relative p-3.5 sm:p-4 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded-lg bg-slate-200/60 dark:bg-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300">
                        <ClipboardList className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        SERVICIO
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      {serviceLabel}
                    </p>
                    {order.delivery_address && (
                      <span className="text-[11px] text-slate-400 truncate block mt-0.5">
                        {order.delivery_address}
                      </span>
                    )}
                    <CornerDecorativeDots />
                  </div>

                  {/* Tarjeta 4 (Fecha de creación) */}
                  <div className="relative p-3.5 sm:p-4 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded-lg bg-slate-200/60 dark:bg-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300">
                        <Calendar className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        CREADA
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      {formatOrderCreationDate(order.created_at)}
                    </p>
                    <span className="text-[11px] text-slate-400 block mt-0.5 font-mono">
                      Registro de entrada
                    </span>
                    <CornerDecorativeDots />
                  </div>
                </div>
              </div>

              {/* ========================================================= */}
              {/* 3. SECCIÓN: PRODUCTOS                                     */}
              {/* ========================================================= */}
              <div className="space-y-3 pt-2">
                {/* Cabecera de lista: Título a la izquierda con icono de caja + Contador lateral en badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <Package className="w-4 h-4 text-[#ED500A]" />
                    <span>Productos</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/[0.08]">
                    {itemsCount} {itemsCount === 1 ? "ítem" : "ítems"}
                  </span>
                </div>

                {/* Listado de Tarjetas de ítem */}
                <div className="space-y-2">
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Imagen / Thumbnail con badge superpuesto en la esquina inferior derecha con la cantidad */}
                          <div className="relative w-12 h-12 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] flex items-center justify-center shrink-0">
                            {(item as any).image_url ? (
                              <img
                                src={(item as any).image_url}
                                alt={item.product_name}
                                className="w-full h-full object-cover rounded-xl"
                              />
                            ) : (
                              <UtensilsCrossed className="w-5 h-5 text-slate-400" />
                            )}
                            <span className="absolute -bottom-1 -right-1 min-w-4 h-4 px-1 rounded-md bg-[#ED500A] text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                              {item.quantity}
                            </span>
                          </div>

                          {/* Información central (alineada a la izquierda) */}
                          <div className="min-w-0 space-y-0.5">
                            <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm uppercase block truncate">
                              {item.product_name}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-mono">
                              {formatCOP(item.unit_price)} por unidad
                            </span>

                            {/* Modificadores o notas */}
                            {item.modifiers && Array.isArray(item.modifiers) && item.modifiers.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {item.modifiers.map((mod: any, mIdx: number) => (
                                  <span
                                    key={mIdx}
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300"
                                  >
                                    + {mod.optionName || mod.option_name || mod.name || ""}
                                  </span>
                                ))}
                              </div>
                            )}

                            {item.notes && (
                              <p className="text-[10px] text-slate-400 italic">
                                Nota: {item.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Valor total (alineado al extremo derecho) */}
                        <div className="text-right shrink-0">
                          <span className="font-bold font-mono text-sm text-slate-900 dark:text-white block">
                            {formatCOP(item.subtotal)}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-400 bg-slate-50/50 dark:bg-white/[0.01] rounded-2xl border border-slate-200/80 dark:border-white/[0.08]">
                      Sin desglose de productos registrado
                    </div>
                  )}
                </div>
              </div>

              {/* Separación: Línea divisoria horizontal completa hacia el pie del modal */}
              <div className="border-t border-slate-200/80 dark:border-white/[0.08]" />

              {/* ========================================================= */}
              {/* 4. PIE DEL MODAL: ACCIONES Y RESUMEN FINANCIERO           */}
              {/* ========================================================= */}
              <div className="space-y-4">
                {/* Fila superior: Acciones de la orden */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                    ACCIONES DE LA ORDEN
                  </span>

                  {/* Fila de 3 botones con bordes y distribución horizontal equivalente */}
                  <div className="grid grid-cols-3 gap-2.5">
                    {/* Botón 1: Factura */}
                    <button
                      type="button"
                      onClick={() =>
                        setTicketModalConfig({
                          isOpen: true,
                          orderType: "sale",
                          documentTitle: "COMPROBANTE DE FACTURA / VENTA",
                          documentNumber: `FAC-${order.order_number}`,
                        })
                      }
                      className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#0D0F16] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-800 dark:text-slate-200 text-xs font-semibold transition-all shadow-2xs hover:scale-[1.01] cursor-pointer"
                      title="Ver e imprimir factura de la orden"
                    >
                      <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span>Factura</span>
                    </button>

                    {/* Botón 2: Descargar PDF */}
                    <button
                      type="button"
                      disabled={isDownloadingPdf}
                      onClick={handleDownloadPdf}
                      className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#0D0F16] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-800 dark:text-slate-200 text-xs font-semibold transition-all shadow-2xs hover:scale-[1.01] cursor-pointer disabled:opacity-50"
                      title="Descargar comprobante en formato PDF"
                    >
                      {isDownloadingPdf ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#ED500A]" />
                      ) : (
                        <Download className="w-4 h-4 text-emerald-500 shrink-0" />
                      )}
                      <span>Descargar PDF</span>
                    </button>

                    {/* Botón 3: Ver comanda */}
                    <button
                      type="button"
                      onClick={() =>
                        setTicketModalConfig({
                          isOpen: true,
                          orderType: order.order_type || "takeout",
                          documentTitle: "COMANDA OPERATIVA DE COCINA",
                          documentNumber: `CMD-${order.order_number}`,
                        })
                      }
                      className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#0D0F16] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-800 dark:text-slate-200 text-xs font-semibold transition-all shadow-2xs hover:scale-[1.01] cursor-pointer"
                      title="Visualizar tiquete de comanda para cocina"
                    >
                      <Receipt className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Ver comanda</span>
                    </button>
                  </div>
                </div>

                {/* Bloque inferior: Resumen de pago */}
                <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] space-y-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                    RESUMEN DE PAGO
                  </span>

                  {/* Subtotal */}
                  <div className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-300">
                    <span>Subtotal</span>
                    <span className="font-mono font-medium">{formatCOP(order.subtotal)}</span>
                  </div>

                  {/* Domicilio si aplica */}
                  {order.order_type === "delivery" && (
                    <div className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-300">
                      <span>Costo de Domicilio</span>
                      <span className="font-mono font-medium text-[#ED500A]">
                        {order.delivery_fee > 0 ? formatCOP(order.delivery_fee) : "Gratis"}
                      </span>
                    </div>
                  )}

                  {/* Total de la orden: Barra destacada a todo el ancho interior con fondo en contraste */}
                  <div className="p-3.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 flex justify-between items-center shadow-xs">
                    <span className="text-xs sm:text-sm font-bold tracking-tight">
                      Total de la orden
                    </span>
                    <span className="text-base sm:text-lg font-black font-mono">
                      {formatCOP(order.total)}
                    </span>
                  </div>
                </div>

                {/* Barra de opciones operativas secundarias (Cobrar, Transicionar de estado) */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <Link
                    href={`/workspace/${businessId}/pedidos/${order.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
                  >
                    <span>Ficha completa</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>

                  <div className="flex items-center gap-2">
                    {order.payment_status === "pending" && onPay && (
                      <button
                        type="button"
                        onClick={() => onPay(order)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 transition-colors cursor-pointer"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Cobrar</span>
                      </button>
                    )}

                    {canUpdateOrder && order.status === "received" && onStatusTransition && (
                      <button
                        type="button"
                        disabled={isUpdatingStatus || updatingOrderId === order.id}
                        onClick={() => onStatusTransition(order, "in_preparation")}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer disabled:opacity-50"
                      >
                        {updatingOrderId === order.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>Aceptar Comanda</span>
                      </button>
                    )}

                    {canUpdateOrder && order.status === "in_preparation" && onStatusTransition && (
                      <button
                        type="button"
                        disabled={isUpdatingStatus || updatingOrderId === order.id}
                        onClick={() => onStatusTransition(order, "ready")}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer disabled:opacity-50"
                      >
                        {updatingOrderId === order.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>Marcar Listo</span>
                      </button>
                    )}

                    {canUpdateOrder && order.status === "ready" && onStatusTransition && (
                      <button
                        type="button"
                        disabled={isUpdatingStatus || updatingOrderId === order.id}
                        onClick={() => onStatusTransition(order, "delivered")}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer disabled:opacity-50"
                      >
                        {updatingOrderId === order.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>Entregar</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={onClose}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>

      {/* MODAL DE TIQUETE TÉRMICO PARA 'FACTURA' O 'VER COMANDA' */}
      <ThermalTicketModal
        documentNumber={ticketModalConfig.documentNumber || `ORD-${order.order_number}`}
        issuedAt={order.created_at}
        business={{
          name: businessName,
          tradeName: businessName,
        }}
        orderType={ticketModalConfig.orderType}
        tableName={order.tableName || undefined}
        customer={{
          name: order.customer_name,
          phone: order.customer_phone,
          address: order.delivery_address,
          deliveryReference: order.delivery_reference,
        }}
        items={
          order.items?.map((it) => ({
            description: it.product_name,
            quantity: it.quantity,
            unitPrice: it.unit_price,
            total: it.subtotal,
            notes: it.notes,
            modifiers: it.modifiers,
          })) || []
        }
        subtotal={order.subtotal}
        deliveryFee={order.delivery_fee}
        total={order.total}
        paymentMethod={order.payment_status === "paid" ? "cash" : undefined}
        paymentStatus={order.payment_status}
        notes={order.notes}
        isOpen={ticketModalConfig.isOpen}
        onClose={() => setTicketModalConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </>
  );
}
