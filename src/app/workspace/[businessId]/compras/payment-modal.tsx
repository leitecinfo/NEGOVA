"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  X,
  CreditCard,
  Banknote,
  Building2,
  Calendar,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  History,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Input, Select, SearchSelect, DatePicker } from "@/components/ui";
import { AccountsPayableWithDetails, AccountPayablePayment } from "@/lib/purchases/types";
import { registerAccountPayablePaymentAction, getAccountPayableDetailsAction } from "./actions";
import { formatCOP } from "@/config/plans";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  account: AccountsPayableWithDetails | null;
  onSuccess: () => void;
}

const PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "Efectivo" },
  { value: "transfer", label: "Transferencia Bancaria" },
  { value: "card", label: "Tarjeta Débito / Crédito" },
  { value: "other", label: "Otro Medio" },
];

export function PaymentModal({
  isOpen,
  onClose,
  businessId,
  account,
  onSuccess,
}: Props) {
  const [amountInput, setAmountInput] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [reference, setReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  // Historial de pagos recargado en vivo
  const [detailedAccount, setDetailedAccount] = useState<AccountsPayableWithDetails | null>(account);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !account) return;

    setDetailedAccount(account);
    setAmountInput(account.balance.toString());
    setPaymentMethod("cash");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setReference("");
    setNotes("");

    // Cargar historial fresco de abonos
    let isMounted = true;
    async function loadFreshDetails() {
      setIsLoadingDetails(true);
      try {
        const res = await getAccountPayableDetailsAction(businessId, account!.id);
        if (isMounted && res.success && res.data) {
          setDetailedAccount(res.data);
          setAmountInput(res.data.balance.toString());
        }
      } catch (err) {
        console.error("Error al refrescar cuenta por pagar:", err);
      } finally {
        if (isMounted) setIsLoadingDetails(false);
      }
    }

    loadFreshDetails();
    return () => {
      isMounted = false;
    };
  }, [isOpen, account, businessId]);

  if (!isOpen || !detailedAccount) return null;

  const currentBalance = detailedAccount.balance;
  const isPaid = detailedAccount.status === "paid" || currentBalance <= 0;

  const handlePayFullBalance = () => {
    setAmountInput(currentBalance.toString());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const amt = parseFloat(amountInput);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Monto inválido", {
        description: "El monto a abonar debe ser mayor a 0.",
      });
      return;
    }

    if (amt > currentBalance) {
      toast.error("Monto excede el saldo", {
        description: `El monto a pagar (${formatCOP(amt)}) no puede superar el saldo pendiente (${formatCOP(currentBalance)}).`,
      });
      return;
    }

    startTransition(async () => {
      try {
        const res = await registerAccountPayablePaymentAction(businessId, {
          accountPayableId: detailedAccount.id,
          amount: amt,
          paymentMethod,
          paymentDate: new Date(paymentDate).toISOString(),
          reference: reference.trim() || null,
          notes: notes.trim() || null,
        });

        if (res.success && res.data) {
          const isSettled = res.data.updatedAccount.status === "paid";
          toast.success(
            isSettled ? "Cuenta liquidada en su totalidad" : "Abono registrado exitosamente",
            {
              description: `Se registró un pago de ${formatCOP(amt)} a ${detailedAccount.supplierName || "Proveedor"}.`,
            }
          );
          onSuccess();
          onClose();
        } else {
          toast.error("Error al registrar abono", {
            description: res.error || "No se pudo procesar el pago a proveedor.",
          });
        }
      } catch (err: any) {
        toast.error("Error inesperado", {
          description: err?.message || "Fallo en la comunicación con el servidor.",
        });
      }
    });
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
        <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]">
          {/* ENCABEZADO */}
          <div className="flex items-center justify-between p-5 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Registrar Abono a Proveedor
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {detailedAccount.supplierName || "Proveedor no especificado"} &bull; Compra #{detailedAccount.purchaseNumber}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isPending}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* CUERPO DEL MODAL */}
          <div className="p-5 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
            {/* RESUMEN FINANCIERO DE LA CUENTA */}
            <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08]">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block">Total Deuda</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {formatCOP(detailedAccount.totalAmount)}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block">Total Abonado</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCOP(detailedAccount.paidAmount)}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block">Saldo Pendiente</span>
                <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                  {formatCOP(currentBalance)}
                </span>
              </div>
            </div>

            {/* FORMULARIO DE PAGO */}
            {!isPaid ? (
              <form id="payment-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Monto a Abonar (COP)
                    </label>
                    <button
                      type="button"
                      onClick={handlePayFullBalance}
                      className="text-2xs font-bold text-[#ED500A] hover:underline cursor-pointer"
                    >
                      Pagar saldo total ({formatCOP(currentBalance)})
                    </button>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    min="1"
                    max={currentBalance}
                    required
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    disabled={isPending}
                    inputSize="md"
                    className="font-bold text-base"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Método de pago */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Medio de Pago
                    </label>
                    <SearchSelect
                      options={PAYMENT_METHOD_OPTIONS}
                      value={paymentMethod}
                      onChange={(val) => setPaymentMethod(val)}
                      disabled={isPending}
                      selectSize="sm"
                      searchable={false}
                      clearable={false}
                    />
                  </div>

                  {/* Fecha de abono */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Fecha del Pago
                    </label>
                    <DatePicker
                      value={paymentDate}
                      onChange={(val) => setPaymentDate(val)}
                      disabled={isPending}
                      size="sm"
                      clearable={false}
                    />
                  </div>
                </div>

                {/* Comprobante / Referencia */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Comprobante / Referencia Bancaria (opcional)
                  </label>
                  <Input
                    type="text"
                    placeholder="p. ej. Transf. #948271 o Recibo de Caja #12"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    disabled={isPending}
                    inputSize="sm"
                  />
                </div>

                {/* Notas */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Notas u Observaciones (opcional)
                  </label>
                  <Input
                    type="text"
                    placeholder="Abono a cuenta corriente, liquidación de factura..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={isPending}
                    inputSize="sm"
                  />
                </div>
              </form>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span className="font-semibold">
                  Esta cuenta por pagar ya fue liquidada en su totalidad ($0 saldo pendiente).
                </span>
              </div>
            )}

            {/* HISTORIAL DE ABONOS PREVIOS */}
            <div className="space-y-2 pt-2 border-t border-slate-200/80 dark:border-white/[0.08]">
              <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-slate-400" />
                <span>Historial de Pagos Realizados ({detailedAccount.payments?.length || 0})</span>
              </h4>

              {isLoadingDetails ? (
                <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ED500A]" />
                  <span>Cargando abonos...</span>
                </div>
              ) : !detailedAccount.payments || detailedAccount.payments.length === 0 ? (
                <p className="text-xs text-slate-400 italic p-3 bg-slate-50 dark:bg-white/[0.01] rounded-xl text-center">
                  Aún no se han registrado abonos a esta cuenta.
                </p>
              ) : (
                <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/[0.08] text-slate-500 text-2xs font-semibold uppercase">
                      <tr>
                        <th className="py-2 px-3">Fecha</th>
                        <th className="py-2 px-3">Medio</th>
                        <th className="py-2 px-3">Referencia</th>
                        <th className="py-2 px-3 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                      {detailedAccount.payments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01]">
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {new Date(p.paymentDate).toLocaleDateString("es-CO")}
                          </td>
                          <td className="py-2 px-3 text-slate-700 dark:text-slate-300 font-medium">
                            {p.paymentMethod === "cash"
                              ? "Efectivo"
                              : p.paymentMethod === "transfer"
                              ? "Transferencia"
                              : p.paymentMethod === "card"
                              ? "Tarjeta"
                              : p.paymentMethod}
                          </td>
                          <td className="py-2 px-3 text-slate-500 truncate max-w-[120px]">
                            {p.reference || "—"}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCOP(p.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* PIE DEL MODAL CON BOTONES */}
          <div className="p-4 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            {!isPaid && (
              <button
                type="submit"
                form="payment-form"
                disabled={isPending || parseFloat(amountInput) <= 0 || parseFloat(amountInput) > currentBalance}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-98"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Procesando pago...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirmar Abono</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

