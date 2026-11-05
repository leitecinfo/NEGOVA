"use client";

import React from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  CheckCircle2,
  X,
  Building2,
  Calendar,
  FileText,
  DollarSign,
  CreditCard,
  Banknote,
  Boxes,
  Package,
  Store,
  ArrowRight,
  Plus,
  Check,
  ShieldCheck,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { Purchase, PurchaseItemImpact } from "@/lib/purchases/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRegisterAnother: () => void;
  purchase: Purchase | null;
}

export function PurchaseConfirmationModal({
  isOpen,
  onClose,
  onRegisterAnother,
  purchase,
}: Props) {
  if (!isOpen || !purchase) return null;

  const formatCOP = (val?: number | null) => {
    if (val === null || val === undefined) return "$ 0";
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "Hoy";
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat("es-CO", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  // Extraer impacto en inventario y caja desde impactSummary o calcular fallback desde items
  const impactSummary = purchase.impactSummary;
  const inventoryImpacts: PurchaseItemImpact[] =
    impactSummary?.inventoryImpacts ||
    (purchase.items || []).map((it) => ({
      productId: it.productId,
      itemName: it.itemName,
      itemCategory: (it.itemCategory as any) || (it.isInventoryItem ? "ingredient" : "free"),
      quantityAdded: it.quantity,
      previousStock: 0,
      newStock: it.quantity,
      previousCost: it.unitCost,
      newAverageCost: it.unitCost,
      unit: "unidad",
      locationName: "Bodega Principal",
    }));

  const cashImpact = impactSummary?.cashImpact || {
    deducted: Boolean(
      purchase.deductFromCashRegister ??
      (purchase.paymentType === "cash" && purchase.paymentMethod === "cash")
    ),
    amount: purchase.paymentType === "cash" ? purchase.total : 0,
    cashRegisterName: purchase.cashRegisterName || "Caja Principal",
    sessionId: null,
  };

  const isCredit = purchase.paymentType === "credit";
  const balanceDue = isCredit
    ? purchase.accountPayable?.balance ?? purchase.total
    : 0;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-3xl bg-white dark:bg-[#0E131F] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          {/* ========================================================= */}
          {/* 1. ENCABEZADO CON VERIFICACIÓN VERDE Y METADATOS          */}
          {/* ========================================================= */}
          <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 ring-4 ring-emerald-500/5">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold font-title text-slate-900 dark:text-white">
                      Compra Registrada
                    </h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20">
                      {purchase.purchaseNumber}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-2xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <ShieldCheck className="w-3 h-3" />
                      Asentada en Kardex
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      {purchase.supplierName || "Proveedor General"}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {formatDate(purchase.purchaseDate)}
                    </span>
                    {purchase.invoiceNumber && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1.5 font-mono">
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          Fac: #{purchase.invoiceNumber}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Botón de cierre '✕' */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                title="Cerrar"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* CONTENIDO SCROLLABLE                                      */}
          {/* ========================================================= */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {/* ========================================================= */}
            {/* 2. TARJETAS: VALOR LIQUIDADO, FORMA DE PAGO, SALDO        */}
            {/* ========================================================= */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Tarjeta 1: Valor liquidado */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium">Valor liquidado</span>
                    <DollarSign className="w-4 h-4 text-slate-400" />
                  </div>
                  <p className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                    {formatCOP(purchase.total)}
                  </p>
                </div>
                <div className="mt-2 text-2xs text-slate-500 dark:text-slate-400 border-t border-slate-200/50 dark:border-white/[0.05] pt-1.5 flex justify-between">
                  <span>Subtotal: {formatCOP(purchase.subtotal)}</span>
                  <span>Impuestos: {formatCOP(purchase.taxAmount)}</span>
                </div>
              </div>

              {/* Tarjeta 2: Forma de pago */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium">Forma de pago</span>
                    {isCredit ? (
                      <CreditCard className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Banknote className="w-4 h-4 text-emerald-500" />
                    )}
                  </div>
                  <div className="mt-1">
                    {isCredit ? (
                      <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        A Crédito (Proveedor)
                      </span>
                    ) : cashImpact.deducted ? (
                      <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        De Contado (Caja)
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        De Contado (Bancos)
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-2xs text-slate-500 dark:text-slate-400 border-t border-slate-200/50 dark:border-white/[0.05] pt-1.5">
                  Método: <span className="font-semibold capitalize">{purchase.paymentMethod}</span>
                </div>
              </div>

              {/* Tarjeta 3: Saldo por pagar */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium">Saldo por pagar</span>
                    <Clock className="w-4 h-4 text-slate-400" />
                  </div>
                  <p
                    className={`text-xl font-bold font-mono mt-1 ${
                      isCredit
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {formatCOP(balanceDue)}
                  </p>
                </div>
                <div className="mt-2 text-2xs text-slate-500 dark:text-slate-400 border-t border-slate-200/50 dark:border-white/[0.05] pt-1.5">
                  {isCredit ? (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      Cuenta por Pagar pendiente
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      Pagado en totalidad
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ========================================================= */}
            {/* 3. SECCIÓN EXPLICATIVA: 'QUÉ PASÓ'                         */}
            {/* ========================================================= */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-200/80 dark:border-white/[0.08]">
                <Sparkles className="w-4 h-4 text-[#ED500A]" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  ¿Qué pasó con esta compra?
                </h4>
              </div>

              {/* A. IMPACTO EN INVENTARIO */}
              <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Impacto en Inventario & Kardex
                    </span>
                  </div>
                  <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    {inventoryImpacts.filter((i) => i.itemCategory !== "free").length} artículos inventariados
                  </span>
                </div>

                <div className="space-y-2">
                  {inventoryImpacts.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white dark:bg-[#141A28] border border-slate-200/60 dark:border-white/[0.06] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {item.itemCategory === "ingredient" ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-3xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                              <Boxes className="w-2.5 h-2.5" />
                              Insumo / Material
                            </span>
                          ) : item.itemCategory === "resale" ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-3xs font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                              <Package className="w-2.5 h-2.5" />
                              Producto para Reventa
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-3xs font-semibold bg-slate-500/10 text-slate-700 dark:text-slate-400 border border-slate-500/20">
                              Gasto Operativo Libre
                            </span>
                          )}
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {item.itemName}
                          </span>
                        </div>
                        {item.locationName && (
                          <p className="text-2xs text-slate-500 dark:text-slate-400">
                            Bodega / Ubicación: <span className="font-medium">{item.locationName}</span>
                          </p>
                        )}
                      </div>

                      {item.itemCategory !== "free" ? (
                        <div className="flex items-center gap-4 text-right shrink-0">
                          {/* Aumento de stock */}
                          <div>
                            <span className="text-2xs text-slate-400 block">Existencias</span>
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              +{item.quantityAdded} {item.unit}
                            </span>
                            <span className="text-3xs text-slate-400 block">
                              (Total: {item.newStock} {item.unit})
                            </span>
                          </div>

                          {/* Costo promedio ponderado */}
                          <div className="border-l border-slate-200 dark:border-white/[0.08] pl-3">
                            <span className="text-2xs text-slate-400 block">Costo Promedio Ponderado</span>
                            <div className="flex items-center gap-1 justify-end font-mono">
                              <span className="text-slate-400 line-through text-2xs">
                                {formatCOP(item.previousCost)}
                              </span>
                              <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                              <span className="font-bold text-slate-900 dark:text-white">
                                {formatCOP(item.newAverageCost)}
                              </span>
                            </div>
                            <span className="text-3xs text-[#ED500A] font-semibold block">
                              Recalculado con CPP
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-2xs text-slate-400 italic">
                          Gasto no inventariable
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* B. IMPACTO EN CAJA */}
              <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Impacto en Caja & Arqueo
                    </span>
                  </div>
                  {cashImpact.deducted ? (
                    <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                      Egreso Registrado
                    </span>
                  ) : (
                    <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400">
                      Sin afectación en efectivo
                    </span>
                  )}
                </div>

                <div className="p-3 bg-white dark:bg-[#141A28] border border-slate-200/60 dark:border-white/[0.06] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    {cashImpact.deducted ? (
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          Caja afectada: <span className="text-[#ED500A]">{cashImpact.cashRegisterName || "Caja Principal"}</span>
                        </p>
                        <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Egreso automático vinculado al turno activo de caja en cash_transactions para cuadre exacto de arqueo.
                        </p>
                      </div>
                    ) : isCredit ? (
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          Compra asentada a crédito
                        </p>
                        <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                          No se extrajo efectivo de la caja física. El compromiso quedó programado en Cuentas por Pagar.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          Pago bancario / Cuenta comercial
                        </p>
                        <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                          No afecta el cajón de efectivo del turno actual de POS.
                        </p>
                      </div>
                    )}
                  </div>

                  {cashImpact.deducted && (
                    <div className="text-right shrink-0">
                      <span className="text-2xs text-slate-400 block">Monto descontado</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">
                        -{formatCOP(cashImpact.amount)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 4. BOTONES: '+ REGISTRAR OTRA COMPRA' Y 'LISTO'           */}
          {/* ========================================================= */}
          <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onRegisterAnother}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-white/[0.06] hover:bg-slate-100 dark:hover:bg-white/[0.1] border border-slate-200 dark:border-white/[0.1] text-xs font-semibold text-slate-700 dark:text-slate-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="w-4 h-4 text-[#ED500A]" />
              <span>+ Registrar otra compra</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Listo</span>
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
