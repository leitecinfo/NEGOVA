"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Receipt,
  Download,
  MessageCircle,
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
  KeyRound,
  Eye,
  EyeOff,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
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
  requiresPin?: boolean;
  initialDocument: BusinessSaleDocument;
  config: BusinessDocumentConfig;
}

export function SaleDetailClient({
  businessId,
  businessName,
  tradeName,
  businessTimezone,
  canCancelSale,
  requiresPin = true,
  initialDocument,
  config,
}: SaleDetailClientProps) {
  const [doc, setDoc] = useState<BusinessSaleDocument>(initialDocument);

  // Estados de acciones
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [showWhatsappModal, setShowWhatsappModal] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState(initialDocument.customerPhone || "");
  const [consultationUrl, setConsultationUrl] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelPin, setCancelPin] = useState("");
  const [showCancelPin, setShowCancelPin] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setConsultationUrl(`${window.location.origin}/workspace/${businessId}/ventas/${doc.id}`);
    }
  }, [businessId, doc.id]);

  const handleOpenWhatsappModal = () => {
    setWhatsappPhone(doc.customerPhone || "");
    setShowWhatsappModal(true);
  };

  const buildStructuredWhatsappMessage = (
    businessTradeName: string,
    targetDoc: BusinessSaleDocument,
    linkUrl: string
  ) => {
    const paymentLabel = getPaymentBadge(targetDoc.paymentMethod).label;
    const itemsLines = targetDoc.items && targetDoc.items.length > 0
      ? targetDoc.items.map((it) => `• ${it.quantity}x ${it.description} (${formatCOP(it.total)})`).join("\n")
      : "";

    return [
      `¡Hola! Te compartimos el comprobante de tu compra en *${businessTradeName}*:`,
      ``,
      `📄 *Comprobante:* ${targetDoc.documentNumber}`,
      `📅 *Fecha:* ${formatDate(targetDoc.issuedAt)}`,
      `👤 *Cliente:* ${targetDoc.customerName || "Consumidor Final"}`,
      itemsLines ? `\n🛍️ *Detalle de compra:*\n${itemsLines}\n` : "",
      `💳 *Método de pago:* ${paymentLabel}`,
      `💰 *Total:* ${formatCOP(targetDoc.total)}`,
      linkUrl ? `🔗 *Enlace de consulta:* ${linkUrl}` : "",
      ``,
      `¡Muchas gracias por tu compra!`,
    ].filter((line) => line !== undefined && line !== null).join("\n");
  };

  const handleSendWhatsapp = () => {
    const cleanDigits = whatsappPhone.replace(/\D/g, "");

    if (whatsappPhone.trim().length > 0 && cleanDigits.length < 7) {
      toast.error("Por favor ingresa un número de teléfono válido (mínimo 7 dígitos).");
      return;
    }

    let targetNumber = cleanDigits;
    if (targetNumber.length === 10 && targetNumber.startsWith("3")) {
      targetNumber = `57${targetNumber}`;
    }

    const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
    const activeConsultationLink =
      consultationUrl || (currentOrigin ? `${currentOrigin}/workspace/${businessId}/ventas/${doc.id}` : "");

    const msg = buildStructuredWhatsappMessage(
      tradeName || businessName,
      doc,
      activeConsultationLink
    );

    const encodedMsg = encodeURIComponent(msg);
    const waUrl = targetNumber
      ? `https://wa.me/${targetNumber}?text=${encodedMsg}`
      : `https://wa.me/?text=${encodedMsg}`;

    if (typeof window !== "undefined") {
      const waWin = window.open(waUrl, "_blank", "noopener,noreferrer");
      if (waWin) {
        waWin.opener = null;
      }
    }

    setShowWhatsappModal(false);
    toast.success("Abriendo WhatsApp con el comprobante...");
  };

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
          label: "Cancelada",
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

  // Confirmar cancelación comercial con PIN de autorización [EMP-002 / POS-005]
  const handleConfirmCancel = async () => {
    if (!cancelReason.trim() || cancelReason.trim().length < 3) {
      setActionError("Debe ingresar un motivo de anulación válido (mínimo 3 caracteres).");
      return;
    }

    if (requiresPin && (!cancelPin.trim() || cancelPin.trim().length < 4 || cancelPin.trim().length > 6)) {
      setActionError("Debe ingresar el PIN de autorización numérico (4 a 6 dígitos).");
      return;
    }

    if (!requiresPin && cancelPin.trim().length > 0 && (cancelPin.trim().length < 4 || cancelPin.trim().length > 6)) {
      setActionError("El PIN de autorización debe tener entre 4 y 6 dígitos numéricos.");
      return;
    }

    setActionError(null);
    setIsCancelling(true);

    try {
      const res = await cancelSaleAction(
        businessId,
        doc.id,
        cancelReason.trim(),
        cancelPin.trim()
      );
      if (!res.success) {
        setActionError(res.error || "No se pudo anular el documento.");
        toast.error(res.error || "Error al anular la venta.");
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
      setCancelPin("");
      const successMsg = res.authorizerName
        ? `Venta anulada con éxito. Autorizado por: ${res.authorizerName}.`
        : "Documento comercial anulado con éxito.";
      toast.success(successMsg);
      setActionSuccess(successMsg);
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err?.message || "Error al cancelar el comprobante.");
      toast.error(err?.message || "Error al anular la venta.");
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

          {/* Botón Enviar por WhatsApp */}
          <button
            type="button"
            onClick={handleOpenWhatsappModal}
            aria-label="Enviar comprobante por WhatsApp"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer whitespace-nowrap focus:outline-hidden focus:ring-2 focus:ring-emerald-500/40"
            title="Enviar comprobante por WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5 text-white" aria-hidden="true" />
            <span>Enviar por WhatsApp</span>
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
        {/* Banner de Facturación Electrónica DIAN si aplica */}
        {doc.notes && doc.notes.includes("CUFE") && (
          <div className="p-3.5 bg-blue-50/90 dark:bg-blue-500/10 border-b border-blue-200/60 dark:border-blue-500/20 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-600 text-white shadow-xs">
                <FileText className="w-3.5 h-3.5" />
                Factura Electrónica DIAN
              </span>
              <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px] truncate max-w-sm sm:max-w-lg">
                {doc.notes}
              </span>
            </div>
            {(() => {
              const cufeMatch = doc.notes.match(/CUFE:\s*([a-f0-9]+)/i);
              if (cufeMatch && cufeMatch[1]) {
                return (
                  <Link
                    href={`https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${cufeMatch[1]}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                  >
                    <span>Verificar en DIAN</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                );
              }
              return null;
            })()}
          </div>
        )}

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
          <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
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
                  rows={2}
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ej. Devolución de producto / Error de digitación en punto de venta / Comanda cancelada..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-900 dark:text-white resize-none"
                />
              </div>

              {/* PIN de Autorización [EMP-002] */}
              <div className="space-y-1.5 p-3 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                    PIN de Autorización (Supervisor) <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {cancelPin.length}/6 dígitos
                  </span>
                </div>
                <div className="relative">
                  <input
                    type={showCancelPin ? "text" : "password"}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    placeholder="PIN de 4 a 6 dígitos"
                    value={cancelPin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setCancelPin(val);
                    }}
                    className="w-full h-10 px-3.5 pr-10 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0F16] text-slate-900 dark:text-white font-mono text-center tracking-widest text-base focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowCancelPin(!showCancelPin)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showCancelPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Operación sensible auditada: se validará que el colaborador posea permisos de anulación y se registrará en el historial de seguridad.
                </p>
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
                  disabled={
                    isCancelling ||
                    cancelReason.trim().length < 3 ||
                    (requiresPin && cancelPin.trim().length < 4)
                  }
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

      {/* MODAL PERSONALIZADO: ENVIAR POR WHATSAPP */}
      {showWhatsappModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/[0.06]">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-base">
                  <MessageCircle className="w-5 h-5" />
                  <span>Enviar Comprobante por WhatsApp</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWhatsappModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
                  aria-label="Cerrar modal de WhatsApp"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                {/* Indicador de Teléfono Registrado vs No Registrado */}
                {doc.customerPhone ? (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span className="truncate">
                      Teléfono registrado del cliente: <strong className="font-mono">{doc.customerPhone}</strong>
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
                    <Info className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>
                      El cliente no tiene teléfono registrado. Ingresa el número de WhatsApp destinatario:
                    </span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="whatsapp-recipient-phone" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Número de WhatsApp destinatario
                  </label>
                  <div className="relative">
                    <input
                      id="whatsapp-recipient-phone"
                      type="tel"
                      value={whatsappPhone}
                      onChange={(e) => setWhatsappPhone(e.target.value)}
                      placeholder="Ej. 300 123 4567 o +57 300 123 4567"
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-white font-mono placeholder:text-slate-400"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    {whatsappPhone.trim()
                      ? "Se abrirá el chat con el número indicado."
                      : "Si no ingresas número, se abrirá WhatsApp para que elijas el chat manualmente."}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.06] space-y-1.5 text-xs">
                  <span className="font-semibold text-slate-500 dark:text-slate-400 block text-[11px] uppercase tracking-wider">
                    Vista previa del mensaje:
                  </span>
                  <div className="text-slate-700 dark:text-slate-300 text-[11px] font-mono whitespace-pre-line bg-white dark:bg-white/[0.03] p-2.5 rounded-lg border border-slate-100 dark:border-white/5 max-h-48 overflow-y-auto">
                    {buildStructuredWhatsappMessage(
                      tradeName || businessName,
                      doc,
                      consultationUrl || (typeof window !== "undefined" ? `${window.location.origin}/workspace/${businessId}/ventas/${doc.id}` : "")
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowWhatsappModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSendWhatsapp}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500/40"
                >
                  <MessageCircle className="w-4 h-4 text-white" />
                  <span>Enviar por WhatsApp</span>
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
