"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  DollarSign,
  X,
  CheckCircle2,
  Loader2,
  Sparkles,
  Info,
  ShieldCheck,
} from "lucide-react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { PaymentMethodLogo } from "@/components/payments/payment-method-logo";
import { RestaurantOrderWithDetails } from "@/lib/restaurant/types";
import { PublicPaymentMethodDTO } from "@/lib/payments/types";

export interface SelectablePaymentOption {
  code: string;
  name: string;
  destinationType?: string | null;
  destinationValue?: string | null;
  accountHolder?: string | null;
  instructions?: string | null;
  isTransfer?: boolean;
}

export function parseOrderProposedPayment(notes: string | null | undefined): {
  proposedMethodLabel?: string;
  proposedMethodCode?: string;
  cashAmount?: number;
} {
  if (!notes) return {};

  const matchMethod = notes.match(/M[ée]todo de pago propuesto:\s*([^|\n\[]+)/i);
  const proposedMethodLabel = matchMethod ? matchMethod[1].trim() : undefined;

  let proposedMethodCode: string | undefined = undefined;
  if (proposedMethodLabel) {
    const lower = proposedMethodLabel.toLowerCase();
    if (lower.includes("efectivo") || lower === "cash") proposedMethodCode = "cash";
    else if (lower.includes("nequi")) proposedMethodCode = "nequi";
    else if (lower.includes("daviplata") || lower.includes("davi plata")) proposedMethodCode = "daviplata";
    else if (lower.includes("bancolombia")) proposedMethodCode = "bancolombia";
    else if (lower.includes("bre-b") || lower.includes("bre_b") || lower.includes("bre b")) proposedMethodCode = "bre_b";
    else if (lower.includes("davivienda")) proposedMethodCode = "davivienda";
    else if (lower.includes("nu")) proposedMethodCode = "nu";
    else if (lower.includes("tarjeta") || lower.includes("card")) proposedMethodCode = "card";
    else if (lower.includes("transferencia")) proposedMethodCode = "transfer";
  }

  const matchCash = notes.match(/Paga en efectivo con:\s*\$?\s*([\d\.,]+)/i);
  let cashAmount: number | undefined = undefined;
  if (matchCash) {
    const rawNum = matchCash[1].replace(/\./g, "").replace(/,/g, "");
    cashAmount = Number(rawNum) || undefined;
  }

  return { proposedMethodLabel, proposedMethodCode, cashAmount };
}

function formatDestinationType(type: string | null | undefined): string {
  switch (type) {
    case "phone":
      return "Celular";
    case "savings_account":
      return "Cta. Ahorros";
    case "current_account":
      return "Cta. Corriente";
    case "merchant_code":
      return "Código Bre-B";
    case "national_id":
      return "Cédula";
    case "email":
      return "Correo";
    default:
      return "Dato";
  }
}

interface OrderPaymentModalProps {
  isOpen: boolean;
  order: RestaurantOrderWithDetails | null;
  paymentMethods?: PublicPaymentMethodDTO[];
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (selectedMethod: string) => Promise<void> | void;
  formatCOP?: (val: number) => string;
}

export function OrderPaymentModal({
  isOpen,
  order,
  paymentMethods = [],
  isSubmitting = false,
  onClose,
  onConfirm,
  formatCOP = (val) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val),
}: OrderPaymentModalProps) {
  // Construcción dinámica de métodos de pago combinando los configurados del comercio + opciones presenciales POS
  const availableOptions: SelectablePaymentOption[] = useMemo(() => {
    const list: SelectablePaymentOption[] = [];

    const sourceList =
      paymentMethods && paymentMethods.length > 0
        ? paymentMethods
        : [
            {
              code: "cash",
              name: "Efectivo",
              isEnabled: true,
              isConfigured: true,
              destinationType: "phone",
              destinationValue: null,
              accountHolder: null,
              instructions: null,
              breBKeyType: null,
              qrUrl: null,
            },
          ];

    for (const m of sourceList) {
      list.push({
        code: m.code,
        name: m.name,
        destinationType: m.destinationType,
        destinationValue: m.destinationValue,
        accountHolder: m.accountHolder,
        instructions: m.instructions,
        isTransfer: m.code !== "cash",
      });
    }

    // Asegurar Tarjeta / Datáfono para cobros presenciales
    if (!list.some((it) => it.code === "card")) {
      list.push({
        code: "card",
        name: "Tarjeta / Datáfono",
        isTransfer: false,
      });
    }

    // Asegurar Otro medio como contingencia
    if (!list.some((it) => it.code === "other")) {
      list.push({
        code: "other",
        name: "Otro medio",
        isTransfer: false,
      });
    }

    return list;
  }, [paymentMethods]);

  const proposedInfo = useMemo(() => {
    return parseOrderProposedPayment(order?.notes);
  }, [order?.notes]);

  const [selectedMethod, setSelectedMethod] = useState<string>("cash");

  // Al abrir o cambiar de orden, inicializar con el método propuesto por el cliente si existe
  useEffect(() => {
    if (order) {
      if (proposedInfo.proposedMethodCode) {
        const found = availableOptions.find(
          (opt) =>
            opt.code === proposedInfo.proposedMethodCode ||
            (opt.isTransfer && proposedInfo.proposedMethodCode === "transfer")
        );
        if (found) {
          setSelectedMethod(found.code);
          return;
        }
      }
      setSelectedMethod("cash");
    }
  }, [order, proposedInfo.proposedMethodCode, availableOptions]);

  if (!isOpen || !order) return null;

  const currentOption = availableOptions.find((opt) => opt.code === selectedMethod);
  const changeAmount =
    proposedInfo.cashAmount && proposedInfo.cashAmount > order.total
      ? proposedInfo.cashAmount - order.total
      : 0;

  return (
    <ModalPortal>
      <div className="fixed inset-0 m-0 p-4 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-lg bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col font-body max-h-[90vh]"
        >
          {/* HEADER */}
          <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Registrar Cobro
                </h3>
                <p className="text-xs text-slate-500">
                  Pedido #{order.order_number}
                  {order.channel_origin === "digital_menu" && " · Menú Digital"}
                  {order.order_type === "delivery" && " · Domicilio"}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* CONTENIDO SCROLLABLE */}
          <div className="p-5 space-y-4 overflow-y-auto">
            {/* TOTAL A COBRAR */}
            <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-xl text-center space-y-1">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total a Cobrar
              </span>
              <div className="text-3xl font-mono font-extrabold text-[#ED500A]">
                {formatCOP(order.total)}
              </div>
              {order.customer_name && (
                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                  Cliente: <span className="text-slate-900 dark:text-white font-semibold">{order.customer_name}</span>
                  {order.customer_phone && ` (${order.customer_phone})`}
                </p>
              )}
            </div>

            {/* AVISO DE MÉTODO PROPUESTO POR EL CLIENTE (Si existe en las notas del pedido) */}
            {proposedInfo.proposedMethodLabel && (
              <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl flex items-start gap-2.5">
                <div className="shrink-0 mt-0.5">
                  <PaymentMethodLogo
                    code={proposedInfo.proposedMethodCode || "other"}
                    size="sm"
                  />
                </div>
                <div className="text-xs min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-amber-800 dark:text-amber-300">
                      Solicitado por el cliente:
                    </span>
                    <span className="font-bold text-amber-950 dark:text-amber-100 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/30">
                      {proposedInfo.proposedMethodLabel}
                    </span>
                  </div>
                  {proposedInfo.cashAmount && (
                    <p className="mt-1 text-amber-700 dark:text-amber-400 text-[11px] font-mono">
                      Indicó que pagará con billete de {formatCOP(proposedInfo.cashAmount)}.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* SELECCIÓN DE MÉTODO DE PAGO */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Método de pago recibido
                </label>
                <span className="text-[11px] text-slate-400">
                  {availableOptions.length} métodos disponibles
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                {availableOptions.map((opt) => {
                  const isSel = selectedMethod === opt.code;
                  const isProposed =
                    proposedInfo.proposedMethodCode === opt.code ||
                    (opt.isTransfer && proposedInfo.proposedMethodCode === "transfer");

                  return (
                    <button
                      key={opt.code}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setSelectedMethod(opt.code)}
                      className={`p-3 rounded-xl border flex items-center gap-3 text-left transition-all cursor-pointer relative ${
                        isSel
                          ? "bg-[#ED500A]/10 text-[#ED500A] border-[#ED500A] ring-1 ring-[#ED500A] shadow-2xs"
                          : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      <PaymentMethodLogo code={opt.code} size="md" />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold truncate">
                            {opt.name}
                          </span>
                        </div>
                        {opt.destinationValue ? (
                          <p className="text-[10px] text-slate-400 font-mono truncate">
                            {formatDestinationType(opt.destinationType)}: {opt.destinationValue}
                          </p>
                        ) : opt.code === "cash" ? (
                          <p className="text-[10px] text-slate-400 truncate">
                            Contra entrega / caja
                          </p>
                        ) : opt.code === "card" ? (
                          <p className="text-[10px] text-slate-400 truncate">
                            Datáfono / POS
                          </p>
                        ) : null}
                      </div>

                      {isProposed && (
                        <span
                          className={`absolute top-1.5 right-1.5 px-1 py-0.2 rounded text-[9px] font-bold ${
                            isSel
                              ? "bg-[#ED500A] text-white"
                              : "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30"
                          }`}
                          title="Método seleccionado por el cliente en el pedido"
                        >
                          Cliente
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* DETALLES DINÁMICOS SEGÚN EL MÉTODO SELECCIONADO */}
            {currentOption && currentOption.isTransfer && currentOption.destinationValue && (
              <div className="p-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs space-y-1.5">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-semibold text-[11px]">
                  <span>Datos de destino ({currentOption.name})</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Entidad Activa
                  </span>
                </div>
                <div className="flex items-baseline justify-between font-mono">
                  <span className="text-slate-500 text-[11px]">
                    {formatDestinationType(currentOption.destinationType)}:
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white select-all text-sm">
                    {currentOption.destinationValue}
                  </span>
                </div>
                {currentOption.accountHolder && (
                  <div className="flex items-baseline justify-between text-[11px]">
                    <span className="text-slate-500">Titular:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {currentOption.accountHolder}
                    </span>
                  </div>
                )}
                <p className="text-[10px] text-slate-500 italic pt-1 border-t border-slate-200/50 dark:border-white/5">
                  Verifica en tu app bancaria que el dinero haya ingresado antes de confirmar.
                </p>
              </div>
            )}

            {/* SI ES EFECTIVO Y HAY CÁLCULO DE VUELTAS */}
            {selectedMethod === "cash" && proposedInfo.cashAmount && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Cliente paga con:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {formatCOP(proposedInfo.cashAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-emerald-200/50 dark:border-emerald-500/20">
                  <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                    Cambio a entregar:
                  </span>
                  <span className="font-mono font-black text-emerald-700 dark:text-emerald-400 text-sm">
                    {formatCOP(changeAmount)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* FOOTER */}
          <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => onConfirm(selectedMethod)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#ED500A] hover:bg-[#ED500A]/90 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Registrando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar Cobro</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
