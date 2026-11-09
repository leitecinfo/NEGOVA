"use client";

import React, { useState } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  X,
  Building2,
  Calendar,
  FileText,
  CreditCard,
  Banknote,
  Boxes,
  Package,
  Store,
  Printer,
  Ban,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Plus,
  Layers,
  Receipt,
  Scale,
} from "lucide-react";
import { Purchase, PurchaseItem, PurchasePaymentStatus } from "@/lib/purchases/types";
import { formatCOP } from "@/config/plans";

interface Props {
  businessId: string;
  purchase: Purchase | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenPayment?: (purchase: Purchase) => void;
  onRequestCancel?: (purchase: Purchase) => void;
  onPrint?: (purchase: Purchase) => void;
}

export function PurchaseDetailModal({
  businessId,
  purchase,
  isOpen,
  onClose,
  onOpenPayment,
  onRequestCancel,
  onPrint,
}: Props) {
  if (!isOpen || !purchase) return null;

  const isCancelled = purchase.status === "cancelled";
  const isCredit = purchase.paymentType === "credit";
  const hasPendingBalance = (purchase.balance ?? 0) > 0 && !isCancelled;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat("es-CO", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  const getPaymentStatusBadge = (status?: PurchasePaymentStatus) => {
    switch (status) {
      case "paid":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            <span>Pagada</span>
          </span>
        );
      case "partially_paid":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            <span>Abono Parcial</span>
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-white/[0.05] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/[0.1]">
            <Ban className="w-3 h-3" />
            <span>Anulada</span>
          </span>
        );
      case "pending":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3 h-3" />
            <span>Pendiente de Pago</span>
          </span>
        );
    }
  };

  const items = purchase.items || [];
  const inventoryImpacts = purchase.impactSummary?.inventoryImpacts || [];

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-4xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* 1. ENCABEZADO */}
          <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="p-2.5 rounded-xl bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold font-title text-slate-900 dark:text-white">
                    Factura de Compra
                  </h3>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20">
                    {purchase.purchaseNumber}
                  </span>
                  {purchase.invoiceNumber && (
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/[0.1]">
                      Ref: {purchase.invoiceNumber}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Registrada el {formatDate(purchase.purchaseDate)} • Tipo:{" "}
                  <span className="font-semibold capitalize">{purchase.documentType || "Factura"}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {getPaymentStatusBadge(purchase.paymentStatus)}
              {isCancelled && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  Compra Anulada
                </span>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
                title="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 2. CONTENIDO DESPLAZABLE */}
          <div className="p-5 sm:p-6 space-y-6 overflow-y-auto">
            {/* Si está anulada, mostrar alerta de anulación */}
            {isCancelled && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
                <Ban className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <div>
                  <span className="font-bold">Esta compra se encuentra anulada.</span>
                  <p className="mt-0.5 text-rose-700 dark:text-rose-300/80">
                    Las existencias ingresadas fueron revertidas del inventario y cualquier cuenta por pagar asociada quedó cancelada.
                    {purchase.cancellationReason && ` Motivo: "${purchase.cancellationReason}"`}
                  </p>
                </div>
              </div>
            )}

            {/* GRID DE DATOS GENERALES */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {/* Proveedor */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-slate-400 font-semibold mb-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Proveedor</span>
                </div>
                <p className="font-bold text-slate-900 dark:text-white truncate">
                  {purchase.supplierName || "Compra Libre / Sin Proveedor"}
                </p>
                {purchase.supplierTaxId && (
                  <span className="text-3xs text-slate-400 font-mono">
                    NIT: {purchase.supplierTaxId}
                  </span>
                )}
              </div>

              {/* Fecha de compra */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-slate-400 font-semibold mb-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Fecha de Compra</span>
                </div>
                <p className="font-bold text-slate-900 dark:text-white">
                  {formatDate(purchase.purchaseDate)}
                </p>
                {purchase.dueDate && isCredit && (
                  <span className="text-3xs text-amber-600 dark:text-amber-400 font-semibold">
                    Vence: {formatDate(purchase.dueDate)}
                  </span>
                )}
              </div>

              {/* Condición de Pago */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-slate-400 font-semibold mb-1">
                  <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                  <span>Condición de Pago</span>
                </div>
                <p className="font-bold text-slate-900 dark:text-white">
                  {isCredit ? "A Crédito" : "De Contado"}
                </p>
                <span className="text-3xs text-slate-400 capitalize">
                  Medio: {purchase.paymentMethod === "cash" ? "Efectivo" : purchase.paymentMethod === "transfer" ? "Transferencia" : purchase.paymentMethod || "Otro"}
                </span>
              </div>

              {/* Origen de Fondos / Caja */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-slate-400 font-semibold mb-1">
                  <Store className="w-3.5 h-3.5 text-slate-400" />
                  <span>Afectación de Caja</span>
                </div>
                <p className="font-bold text-slate-900 dark:text-white">
                  {purchase.deductFromCashRegister
                    ? (purchase.cashRegisterName || "Caja Principal")
                    : "Sin egreso de caja"}
                </p>
                <span className="text-3xs text-slate-400">
                  {purchase.deductFromCashRegister ? "Deducido de turno activo" : "Pago externo o crédito"}
                </span>
              </div>
            </div>

            {/* NOTAS U OBSERVACIONES */}
            {purchase.notes && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.06] text-xs">
                <span className="font-bold text-slate-500 dark:text-slate-400">Observaciones:</span>
                <p className="text-slate-700 dark:text-slate-300 mt-0.5">{purchase.notes}</p>
              </div>
            )}

            {/* TABLA DE ARTÍCULOS DETALLADA CON UNIDADES Y CONVERSIONES */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-[#ED500A]" />
                  <span>Artículos Adquiridos ({items.length})</span>
                </h4>
              </div>

              <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-white/[0.03] border-b border-slate-200/80 dark:border-white/[0.08] text-slate-500 font-semibold">
                    <tr>
                      <th className="px-3.5 py-2.5">Artículo / Concepto</th>
                      <th className="px-3.5 py-2.5 text-center">Tipo</th>
                      <th className="px-3.5 py-2.5 text-right">Cant. Compra</th>
                      <th className="px-3.5 py-2.5 text-right">Conversión Stock</th>
                      <th className="px-3.5 py-2.5 text-right">Costo Unit.</th>
                      <th className="px-3.5 py-2.5 text-right">Total Línea</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-slate-400 italic">
                          No hay detalle de artículos guardado para esta compra.
                        </td>
                      </tr>
                    ) : (
                      items.map((item, idx) => {
                        const hasConversion =
                          item.purchaseUnit &&
                          item.inventoryUnit &&
                          item.purchaseUnit.toLowerCase() !== item.inventoryUnit.toLowerCase();

                        return (
                          <tr key={item.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01]">
                            <td className="px-3.5 py-3">
                              <div className="font-bold text-slate-900 dark:text-white">
                                {item.itemName}
                              </div>
                              {item.locationName && (
                                <span className="text-3xs text-slate-400 flex items-center gap-1">
                                  <span>Bodega: {item.locationName}</span>
                                </span>
                              )}
                            </td>
                            <td className="px-3.5 py-3 text-center whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-md text-3xs font-bold ${
                                  item.itemCategory === "ingredient"
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                    : item.itemCategory === "resale"
                                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                    : "bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/[0.1]"
                                }`}
                              >
                                {item.itemCategory === "ingredient"
                                  ? "Materia Prima"
                                  : item.itemCategory === "resale"
                                  ? "Reventa Directa"
                                  : "Gasto Libre"}
                              </span>
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                              {item.quantity}{" "}
                              <span className="text-3xs text-slate-400 font-sans">
                                {item.purchaseUnit || "und"}
                              </span>
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono text-slate-600 dark:text-slate-300">
                              {hasConversion ? (
                                <div className="flex flex-col items-end">
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                    {item.inventoryQuantity || (item.quantity * (item.conversionFactor || 1))}{" "}
                                    {item.inventoryUnit}
                                  </span>
                                  <span className="text-3xs text-slate-400">
                                    (x{item.conversionFactor || 1})
                                  </span>
                                </div>
                              ) : (
                                <span>
                                  {item.quantity} {item.inventoryUnit || item.purchaseUnit || "und"}
                                </span>
                              )}
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                              {formatCOP(item.unitCost)}
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                              {formatCOP(item.totalCost)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* RESUMEN FINANCIERO Y BALANCES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Información de saldo y cuenta por pagar */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/[0.04] pb-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Estado Financiero de la Factura
                  </span>
                  {getPaymentStatusBadge(purchase.paymentStatus)}
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Monto Total de la Compra:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {formatCOP(purchase.total)}
                    </span>
                  </div>
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Total Pagado / Abonado:</span>
                    <span className="font-mono font-bold">
                      {formatCOP(purchase.paidAmount ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-rose-600 dark:text-rose-400 pt-1.5 border-t border-slate-200/60 dark:border-white/[0.04]">
                    <span className="font-bold">Saldo Pendiente por Pagar:</span>
                    <span className="font-mono font-black text-sm">
                      {formatCOP(purchase.balance ?? 0)}
                    </span>
                  </div>
                </div>

                {/* Botón directo de abono si tiene deuda */}
                {hasPendingBalance && onOpenPayment && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenPayment(purchase);
                    }}
                    className="w-full mt-2 inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm cursor-pointer"
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Registrar Abono a Proveedor</span>
                  </button>
                )}
              </div>

              {/* Desglose de Subtotal, Impuestos y Retenciones */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] space-y-2 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal Bruto:</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {formatCOP(purchase.subtotal + (purchase.discountAmount || 0))}
                  </span>
                </div>

                {(purchase.discountAmount ?? 0) > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Descuento Aplicado:</span>
                    <span className="font-mono font-semibold">
                      -{formatCOP(purchase.discountAmount ?? 0)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Subtotal Neto:</span>
                  <span className="font-mono font-bold">
                    {formatCOP(purchase.subtotal)}
                  </span>
                </div>

                <div className="flex justify-between text-slate-500">
                  <span>Impuestos (IVA):</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    +{formatCOP(purchase.taxAmount)}
                  </span>
                </div>

                {(purchase.retentionAmount ?? 0) > 0 && (
                  <div className="flex justify-between text-amber-600 dark:text-amber-400">
                    <span>Retención en la Fuente:</span>
                    <span className="font-mono font-semibold">
                      -{formatCOP(purchase.retentionAmount ?? 0)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-slate-200/80 dark:border-white/[0.08] text-sm">
                  <span className="font-bold text-slate-900 dark:text-white">Total a Pagar:</span>
                  <span className="font-mono font-black text-[#ED500A] text-base">
                    {formatCOP(purchase.total)}
                  </span>
                </div>
              </div>
            </div>

            {/* TRAZABILIDAD DE KARDEX E IMPACTO DE INVENTARIO */}
            {inventoryImpacts.length > 0 && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>Trazabilidad de Abastecimiento en Kardex</span>
                </div>
                <div className="space-y-1.5">
                  {inventoryImpacts.map((imp, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.04] flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">{imp.itemName}</span>
                        <div className="text-3xs text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>Stock: {imp.previousStock} {imp.unit} → <strong className="text-emerald-600">{imp.newStock} {imp.unit}</strong></span>
                          <span>•</span>
                          <span>Costo Promedio: {formatCOP(imp.newAverageCost)}</span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        +{imp.quantityAdded} {imp.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. PIE DE ACCIONES */}
          <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02] flex flex-wrap items-center justify-between gap-3">
            <div>
              {!isCancelled && onRequestCancel && (
                <button
                  type="button"
                  onClick={() => onRequestCancel(purchase)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Anular esta compra</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              {onPrint && (
                <button
                  type="button"
                  onClick={() => onPrint(purchase)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-all cursor-pointer shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5 text-[#ED500A]" />
                  <span>Imprimir comprobante</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-200 dark:bg-white/[0.1] text-slate-700 dark:text-white hover:bg-slate-300 dark:hover:bg-white/[0.15] transition-colors cursor-pointer"
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
