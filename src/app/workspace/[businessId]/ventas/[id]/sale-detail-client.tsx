"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Receipt,
  Download,
  Mail,
  Ban,
  ChevronRight,
  ArrowLeft,
  Calendar,
  User,
  CreditCard,
  Banknote,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Loader2,
  X,
  Info,
  Printer,
} from "lucide-react";
import type { BusinessSaleDocument, BusinessDocumentConfig } from "@/lib/documents/types";
import { downloadSalePdfAction, cancelSaleAction } from "../actions";
import { ModalPortal } from "@/components/ui/modal-portal";
import { ThermalTicketModal } from "@/components/printing/thermal-ticket";

interface SaleDetailClientProps {
  businessId: string;
  businessName: string;
  tradeName: string;
  businessTimezone: string;
  canCancelSale: boolean;
  initialDocument: BusinessSaleDocument;
  config: BusinessDocumentConfig;
}

export function SaleDetailClient({
  businessId,
  businessName,
  tradeName,
  businessTimezone,
  canCancelSale,
  initialDocument,
  config,
}: SaleDetailClientProps) {
  const [doc, setDoc] = useState<BusinessSaleDocument>(initialDocument);

  // Estados de acciones
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("es-CO", {
        timeZone: businessTimezone,
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
      case "paid":
        return {
          label: "Pagado",
          color: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
        };
      case "issued":
        return {
          label: "Emitido",
          color: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20",
        };
      case "cancelled":
        return {
          label: "Cancelado",
          color: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20",
        };
      case "refunded":
        return {
          label: "Reembolsado",
          color: "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20",
        };
      default:
        return {
          label: status,
          color: "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10",
        };
    }
  };

  const getPaymentBadge = (method: string) => {
    switch (method) {
      case "cash":
        return { label: "Efectivo", icon: Banknote };
      case "transfer":
        return { label: "Transferencia", icon: CreditCard };
      case "card":
      case "credit":
        return { label: "Tarjeta", icon: CreditCard };
      default:
        return { label: method || "Otro", icon: Receipt };
    }
  };

  const statusBadge = getStatusBadge(doc.status);
  const paymentBadge = getPaymentBadge(doc.paymentMethod);
  const PayIcon = paymentBadge.icon;

  // Descarga real de PDF
  const handleDownloadPdf = async () => {
    setActionError(null);
    setIsDownloadingPdf(true);

    try {
      const res = await downloadSalePdfAction(businessId, doc.id);
      if (!res.success || !res.base64) {
        setActionError(res.error || "No se pudo generar el archivo PDF.");
        setIsDownloadingPdf(false);
        return;
      }

      // Convertir base64 a Blob y disparar descarga nativa del navegador
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
      link.download = res.filename || `${doc.documentNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setActionSuccess("PDF descargado correctamente.");
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err?.message || "Error al descargar el PDF comercial.");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Confirmar cancelación comercial
  const handleConfirmCancel = async () => {
    if (!cancelReason.trim() || cancelReason.trim().length < 3) {
      setActionError("Debe ingresar un motivo de anulación válido (mínimo 3 caracteres).");
      return;
    }

    setActionError(null);
    setIsCancelling(true);

    try {
      const res = await cancelSaleAction(businessId, doc.id, cancelReason.trim());
      if (!res.success) {
        setActionError(res.error || "No se pudo anular el documento.");
        setIsCancelling(false);
        return;
      }

      // Actualizar estado local inmutable
      setDoc((prev) => ({
        ...prev,
        status: "cancelled",
        notes: prev.notes
          ? `${prev.notes} | Cancelación: ${cancelReason.trim()}`
          : `Cancelación: ${cancelReason.trim()}`,
      }));

      setShowCancelModal(false);
      setCancelReason("");
      setActionSuccess("Documento comercial anulado con éxito. El estado se ha actualizado a Cancelado.");
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err?.message || "Error al cancelar el comprobante.");
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <main className="flex-1 p-6 lg:p-8 space-y-6 max-w-5xl lg:max-w-6xl mx-auto w-full">
      {/* NAVEGACIÓN Y ACCIONES SUPERIORES */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-white/5">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 gap-2 mb-1">
            <Link href={`/workspace/${businessId}`} className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Inicio
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <Link href={`/workspace/${businessId}/ventas`} className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Ventas
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-mono text-slate-900 dark:text-white font-medium truncate">{doc.documentNumber}</span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white tracking-tight whitespace-nowrap">
              {doc.documentNumber}
            </h1>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border shrink-0 ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
          </div>

          {/* Subtítulo espacioso y sin saltos de línea antiestéticos */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
            <span className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
              {tradeName || businessName}
            </span>
            <span className="text-slate-400 shrink-0">•</span>
            <span className="whitespace-nowrap">
              {formatDate(doc.issuedAt)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Botón Descargar PDF */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-700 dark:text-slate-300 transition-colors shadow-xs disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {isDownloadingPdf ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
            ) : (
              <Download className="w-3.5 h-3.5 text-blue-600" />
            )}
            <span>Descargar PDF</span>
          </button>

          {/* Botón Imprimir Tiquete Térmico */}
          <button
            type="button"
            onClick={() => setShowTicketModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20 transition-colors shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-600" />
            <span>Imprimir Tiquete</span>
          </button>

          {/* Botón Enviar por Correo */}
          <button
            type="button"
            onClick={() => setShowEmailModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-700 dark:text-slate-300 transition-colors shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Mail className="w-3.5 h-3.5 text-indigo-500" />
            <span>Enviar por correo</span>
          </button>

          {/* Botón Cancelar Comprobante */}
          {canCancelSale && doc.status !== "cancelled" && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Anular venta</span>
            </button>
          )}
        </div>
      </div>

      {/* BANNER DE COMPROBANTE CANCELADO */}
      {doc.status === "cancelled" && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-start gap-3">
          <Ban className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-rose-800 dark:text-rose-300">
              Comprobante de Venta Anulado / Cancelado
            </h4>
            <p className="text-xs text-rose-700 dark:text-rose-400">
              Este documento comercial no tiene validez operativa ni fiscal activa. Se conserva inmutable en el historial contable por auditoría.
            </p>
            {doc.notes && doc.notes.includes("Cancelación:") && (
              <p className="text-xs font-medium text-rose-800 dark:text-rose-300 pt-1">
                Motivo registrado: <span className="font-semibold underline">{doc.notes.split("Cancelación:")[1]?.trim()}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* ALERTAS DE ESTADO */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-start gap-3 text-emerald-800 dark:text-emerald-300 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <div className="font-medium">{actionSuccess}</div>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-start gap-3 text-rose-800 dark:text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <div className="font-medium">{actionError}</div>
        </div>
      )}

      {/* COMPROBANTE VISUAL TIPO RECIBO */}
      <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-sm overflow-hidden">
        {/* Encabezado del comprobante */}
        <div className="p-6 lg:p-8 bg-slate-50/70 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.08] flex flex-col sm:flex-row justify-between gap-6">
          <div className="space-y-1">
            <span className="text-[11px] font-bold tracking-widest uppercase text-blue-600 dark:text-blue-400">
              {config.documentTitleDefault || "COMPROBANTE DE VENTA"}
            </span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {tradeName || businessName}
            </h2>
            {config.taxId && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                NIT / Identificación: {config.taxId}
              </p>
            )}
            {config.address && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {config.address} {config.city ? `• ${config.city}` : ""}
              </p>
            )}
          </div>

          <div className="sm:text-right space-y-1 text-xs text-slate-500 dark:text-slate-400">
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Número: </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{doc.documentNumber}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Fecha de emisión: </span>
              <span>{formatDate(doc.issuedAt)}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Método de pago: </span>
              <span className="capitalize">{paymentBadge.label}</span>
            </div>
          </div>
        </div>

        {/* Datos del Cliente */}
        <div className="p-6 lg:p-8 border-b border-slate-200 dark:border-white/10">
          <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
            Receptor / Cliente
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block">Nombre:</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {doc.customerName || "Consumidor Final"}
              </span>
            </div>
            {doc.customerId && (
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Cédula / NIT:</span>
                <span className="font-mono text-slate-900 dark:text-white">{doc.customerId}</span>
              </div>
            )}
            {doc.customerPhone && (
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Teléfono:</span>
                <span className="text-slate-900 dark:text-white">{doc.customerPhone}</span>
              </div>
            )}
            {doc.customerEmail && (
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Correo:</span>
                <span className="text-slate-900 dark:text-white">{doc.customerEmail}</span>
              </div>
            )}
            {doc.customerAddress && (
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Dirección:</span>
                <span className="text-slate-900 dark:text-white">{doc.customerAddress}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tabla de Items */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                <th className="py-3.5 px-4">Descripción</th>
                <th className="py-3.5 px-4 text-center">Cant.</th>
                <th className="py-3.5 px-4 text-right">Precio Unitario</th>
                <th className="py-3.5 px-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] text-xs">
              {doc.items.map((it, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-white">
                    {it.description}
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono text-slate-700 dark:text-slate-300">
                    {it.quantity}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                    {formatCOP(it.unitPrice)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                    {formatCOP(it.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Resumen de Totales y Notas */}
        <div className="p-6 lg:p-8 bg-slate-50/50 dark:bg-white/[0.01] border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row justify-between gap-6">
          <div className="space-y-2 sm:max-w-md">
            {doc.notes && (
              <div>
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  Observaciones
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap mt-0.5">
                  {doc.notes}
                </p>
              </div>
            )}
          </div>

          <div className="sm:w-72 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Subtotal:</span>
              <span className="font-mono text-slate-900 dark:text-white">{formatCOP(doc.subtotal)}</span>
            </div>

            {Number(doc.discountTotal || 0) > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Descuento:</span>
                <span className="font-mono">-{formatCOP(doc.discountTotal || 0)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Impuestos:</span>
              <span className="font-mono text-slate-900 dark:text-white">{formatCOP(doc.taxTotal || 0)}</span>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex justify-between items-baseline">
              <span className="font-bold text-base text-slate-900 dark:text-white">Total:</span>
              <span className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
                {formatCOP(doc.total)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL PERSONALIZADO: ANULAR COMPROBANTE (Sin alertas nativas) */}
      {showCancelModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/[0.06]">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-base">
                  <Ban className="w-5 h-5" />
                  <span>Anular Comprobante de Venta</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Esta acción actualizará el estado del comprobante <span className="font-mono font-bold text-slate-900 dark:text-white">{doc.documentNumber}</span> a <strong className="text-rose-600">Cancelado</strong>. El registro se conservará inmutable en el historial contable por normatividad.
              </p>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Motivo de anulación <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ej. Devolución de producto / Error de digitación en punto de venta / Comanda cancelada..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-900 dark:text-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                >
                  Cerrar
                </button>

                <button
                  type="button"
                  disabled={isCancelling || cancelReason.trim().length < 3}
                  onClick={handleConfirmCancel}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isCancelling ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Anulando...</span>
                    </>
                  ) : (
                    <span>Confirmar anulación</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL PERSONALIZADO: ENVIAR POR CORREO (Información transparente) */}
      {showEmailModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/[0.06]">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-base">
                  <Mail className="w-5 h-5" />
                  <span>Envío de Comprobante por Correo</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-start gap-3 text-blue-900 dark:text-blue-300 text-xs leading-relaxed">
                <Info className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
                <div>
                  <strong>Módulo de Notificación en Preparación:</strong>
                  <p className="mt-1">
                    La integración de despacho automatizado de comprobantes por correo para clientes finales está programada para la siguiente etapa de conectores.
                  </p>
                  <p className="mt-1 font-medium">
                    Actualmente puedes usar el botón <strong>Descargar PDF</strong> para enviar o imprimir el comprobante al cliente.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL DE TIQUETE TÉRMICO (58mm / 80mm) */}
      <ThermalTicketModal
        documentNumber={doc.documentNumber}
        issuedAt={doc.issuedAt}
        business={{
          name: businessName,
          tradeName: tradeName || config?.tradeName || businessName,
          legalName: config?.legalName,
          taxId: config?.taxId,
          address: config?.address,
          city: config?.city,
          phone: config?.phone,
          whatsapp: config?.whatsapp,
          logoUrl: config?.logoUrl,
        }}
        orderType={doc.documentType === "order" ? "order" : "sale"}
        customer={{
          name: doc.customerName,
          phone: doc.customerPhone,
          address: doc.customerAddress,
        }}
        items={doc.items.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: it.total,
        }))}
        subtotal={doc.subtotal}
        discountTotal={doc.discountTotal}
        taxTotal={doc.taxTotal}
        total={doc.total}
        paymentMethod={doc.paymentMethod}
        paymentStatus={doc.status}
        notes={doc.notes}
        thankYouNote={config?.thankYouNote}
        documentObservations={config?.documentObservations}
        footerText={config?.footerText}
        headerText={config?.headerText}
        defaultPaperWidth={config?.paperWidth || "80mm"}
        isOpen={showTicketModal}
        onClose={() => setShowTicketModal(false)}
      />
    </main>
  );
}
