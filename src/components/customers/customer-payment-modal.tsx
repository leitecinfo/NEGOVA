"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  CreditCard,
  DollarSign,
  Calendar,
  FileText,
  User,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Clock,
  History,
  Phone,
} from "lucide-react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Input, Select } from "@/components/ui";
import { toast } from "sonner";
import { formatNumberWithDots, parseNumberFromDots } from "@/lib/pos/types";
import {
  AccountReceivable,
  CustomerPayment,
  RegisterCustomerPaymentInput,
} from "@/lib/customers/types";
import { registerCustomerPaymentAction } from "@/app/workspace/[businessId]/clientes/actions";

interface Props {
  businessId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (payment: CustomerPayment, updatedReceivable?: AccountReceivable) => void;
  initialReceivable?: AccountReceivable | null;
  availableReceivables?: AccountReceivable[];
}

export function CustomerPaymentModal({
  businessId,
  isOpen,
  onClose,
  onSuccess,
  initialReceivable,
  availableReceivables = [],
}: Props) {
  const [selectedReceivableId, setSelectedReceivableId] = useState<string>(
    initialReceivable?.id || ""
  );
  const [amountDisplay, setAmountDisplay] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [reference, setReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sincronizar cuenta seleccionada
  useEffect(() => {
    if (initialReceivable) {
      setSelectedReceivableId(initialReceivable.id);
    } else if (availableReceivables.length > 0 && !selectedReceivableId) {
      setSelectedReceivableId(availableReceivables[0].id);
    }
  }, [initialReceivable, availableReceivables]);

  // Obtener la cuenta actualmente activa
  const currentReceivable =
    initialReceivable && initialReceivable.id === selectedReceivableId
      ? initialReceivable
      : availableReceivables.find((r) => r.id === selectedReceivableId) ||
        initialReceivable;

  const currentBalance = currentReceivable ? Number(currentReceivable.balance || 0) : 0;

  const formatCOP = (val: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val || 0);

  // Reset del formulario cuando se abre/cierra
  useEffect(() => {
    if (isOpen) {
      setAmountDisplay("");
      setReference("");
      setNotes("");
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setPaymentMethod("cash");
    }
  }, [isOpen]);

  const handlePayFullBalance = () => {
    if (currentBalance > 0) {
      setAmountDisplay(formatNumberWithDots(currentBalance));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedReceivableId) {
      toast.error("Selecciona una cuenta por cobrar para abonar.");
      return;
    }

    const cleanAmount = parseNumberFromDots(amountDisplay);
    if (!cleanAmount || cleanAmount <= 0) {
      toast.error("Ingresa un monto válido para el abono.");
      return;
    }

    if (cleanAmount > currentBalance) {
      toast.error(
        `El monto ($${cleanAmount.toLocaleString("es-CO")}) supera el saldo pendiente ($${currentBalance.toLocaleString("es-CO")}).`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: RegisterCustomerPaymentInput = {
        receivableId: selectedReceivableId,
        amount: cleanAmount,
        paymentMethod,
        paymentDate: new Date(paymentDate).toISOString(),
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      const res = await registerCustomerPaymentAction(businessId, payload);
      if (res.success && res.payment) {
        toast.success(
          cleanAmount >= currentBalance
            ? "¡Cuenta por cobrar pagada en su totalidad!"
            : `Abono de ${formatCOP(cleanAmount)} registrado con éxito.`
        );
        if (onSuccess) {
          onSuccess(res.payment, res.receivable);
        }
        onClose();
      } else {
        toast.error("Error al registrar abono", {
          description: res.error || "No se pudo procesar el pago del cliente.",
        });
      }
    } catch (err: any) {
      toast.error("Error inesperado al registrar el abono", {
        description: err?.message || "Ocurrió un problema de comunicación.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Registrar Abono de Cliente
                </h3>
                <p className="text-xs text-muted-foreground">
                  Abono a cuenta por cobrar y liberación de cupo de crédito
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Selector de Cuenta por Cobrar (si hay varias disponibles) */}
            {availableReceivables.length > 1 && !initialReceivable && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Seleccionar Cuenta por Cobrar *
                </label>
                <Select
                  value={selectedReceivableId}
                  onChange={(e) => setSelectedReceivableId(e.target.value)}
                  required
                >
                  <option value="">-- Elige una cuenta --</option>
                  {availableReceivables.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.customerName || "Cliente"} - Saldo: {formatCOP(r.balance)} (Vence:{" "}
                      {new Date(r.dueDate).toLocaleDateString("es-CO")})
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {/* Resumen de la Cuenta Seleccionada */}
            {currentReceivable ? (
              <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    <span className="font-bold text-sm text-foreground">
                      {currentReceivable.customerName || "Cliente"}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      currentReceivable.status === "paid"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : currentReceivable.status === "overdue"
                        ? "bg-red-500/10 text-red-600 dark:text-red-400"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {currentReceivable.status === "paid"
                      ? "Pagada"
                      : currentReceivable.status === "overdue"
                      ? "Vencida"
                      : currentReceivable.status === "partial"
                      ? "Abono Parcial"
                      : "Pendiente"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-border/60">
                  <div>
                    <span className="text-[10px] text-muted-foreground">Total Deuda</span>
                    <div className="font-bold text-foreground">
                      {formatCOP(currentReceivable.amount)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground">Ya Abonado</span>
                    <div className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCOP(currentReceivable.paidAmount)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground">Saldo Pendiente</span>
                    <div className="font-black text-red-600 dark:text-red-400 text-sm">
                      {formatCOP(currentReceivable.balance)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                  <span>
                    Vencimiento:{" "}
                    <strong>
                      {new Date(currentReceivable.dueDate).toLocaleDateString("es-CO")}
                    </strong>
                  </span>
                  {currentReceivable.isOverdue && (
                    <span className="text-red-500 font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Vencida hace {currentReceivable.daysOverdue} días
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                Selecciona una cuenta por cobrar para continuar con el abono.
              </div>
            )}

            {/* Input de Monto con Atajo "Pagar saldo total" */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Monto del Abono (COP) *
                </label>
                {currentBalance > 0 && (
                  <button
                    type="button"
                    onClick={handlePayFullBalance}
                    className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Pagar saldo total ({formatCOP(currentBalance)})</span>
                  </button>
                )}
              </div>
              <Input
                inputMode="numeric"
                value={amountDisplay}
                onChange={(e) => {
                  const raw = parseNumberFromDots(e.target.value);
                  setAmountDisplay(formatNumberWithDots(raw));
                }}
                placeholder="0"
                startAdornment={<span className="text-sm font-bold text-muted-foreground">$</span>}
                required
                className="text-base font-bold"
              />
            </div>

            {/* Medio de Pago y Fecha */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Medio de Pago"
                required
                value={paymentMethod}
                onChange={setPaymentMethod}
                options={[
                  { value: "cash", label: "Efectivo" },
                  { value: "transfer", label: "Transferencia Bancaria" },
                  { value: "check", label: "Cheque" },
                  { value: "other", label: "Otro" },
                ]}
              />

              <Input
                label="Fecha del Pago"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                leftIcon={<Calendar className="w-4 h-4" />}
                required
              />
            </div>

            {/* Referencia o Comprobante */}
            <Input
              label="N° de Referencia / Comprobante (Opcional)"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ej. Transf. Nequi #198283, Recibo caja #45..."
            />

            {/* Notas / Observaciones */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Notas del Abono (Opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Detalles adicionales sobre el acuerdo de pago o recibo..."
                className="w-full px-3.5 py-2 rounded-xl border border-input bg-background text-foreground text-xs focus:outline-hidden focus:ring-2 focus:ring-primary/40 resize-none"
              />
            </div>

            {/* Historial de Abonos Previos de la Cuenta */}
            {currentReceivable?.payments && currentReceivable.payments.length > 0 && (
              <div className="pt-2 border-t border-border">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-2">
                  <History className="w-3.5 h-3.5 text-primary" />
                  <span>Abonos Anteriores ({currentReceivable.payments.length})</span>
                </div>
                <div className="border border-border rounded-xl divide-y divide-border text-xs max-h-36 overflow-y-auto">
                  {currentReceivable.payments.map((p) => (
                    <div
                      key={p.id}
                      className="p-2.5 flex items-center justify-between hover:bg-muted/30"
                    >
                      <div>
                        <div className="font-bold text-foreground">
                          {formatCOP(p.amount)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(p.paymentDate).toLocaleDateString("es-CO")} •{" "}
                          {p.paymentMethod === "cash"
                            ? "Efectivo"
                            : p.paymentMethod === "transfer"
                            ? "Transferencia"
                            : p.paymentMethod}
                          {p.reference ? ` (${p.reference})` : ""}
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        Abonado
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>

          {/* Footer de Acciones */}
          <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedReceivableId || currentBalance <= 0}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Procesando abono...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Registrar Abono</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
