"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  FileText,
  Calendar,
  User,
  Phone,
  Mail,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Search,
  Check,
  Loader2,
  Copy,
  Printer,
} from "lucide-react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { PosCartItem, PosOrderSummary, formatCOP } from "@/lib/pos/types";
import { Quotation } from "@/lib/quotations/types";
import { toast } from "sonner";

interface CustomerOption {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}

interface CreateQuotationModalProps {
  isOpen: boolean;
  businessId: string;
  cartItems: PosCartItem[];
  summary: PosOrderSummary;
  onClose: () => void;
  onSuccess: (quotation: Quotation) => void;
}

export function CreateQuotationModal({
  isOpen,
  businessId,
  cartItems,
  summary,
  onClose,
  onSuccess,
}: CreateQuotationModalProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Selector de vigencia
  const [validityDays, setValidityDays] = useState<number>(7);
  const [customDate, setCustomDate] = useState<string>("");
  const [useCustomDate, setUseCustomDate] = useState<boolean>(false);

  // Notas
  const [notes, setNotes] = useState<string>("");

  // Búsqueda de clientes registrados
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Estado de envío
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdQuotation, setCreatedQuotation] = useState<Quotation | null>(null);

  // Calcular fecha de vencimiento resultante
  const computedExpirationDate = useMemo(() => {
    if (useCustomDate && customDate) {
      const d = new Date(customDate + "T23:59:59");
      return d;
    }
    const d = new Date();
    d.setDate(d.getDate() + validityDays);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [validityDays, useCustomDate, customDate]);

  const formattedExpiration = useMemo(() => {
    return computedExpirationDate.toLocaleDateString("es-CO", {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }, [computedExpirationDate]);

  // Búsqueda de clientes debounce
  useEffect(() => {
    if (!customerSearch.trim() || customerSearch.length < 2) {
      setCustomerResults([]);
      setShowCustomerDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingCustomers(true);
      try {
        const { searchCustomersForPosAction } = await import(
          "@/app/workspace/[businessId]/clientes/actions"
        );
        const res = await searchCustomersForPosAction(businessId, customerSearch.trim());
        const list = Array.isArray(res) ? res : (res as any)?.customers || [];
        if (list.length > 0) {
          setCustomerResults(
            list.map((c: any) => ({
              id: c.id,
              name: c.fullName || c.name,
              phone: c.phone,
              email: c.email,
            }))
          );
          setShowCustomerDropdown(true);
        }
      } catch {
        // Silencioso
      } finally {
        setIsSearchingCustomers(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [customerSearch, businessId]);

  const handleSelectCustomer = (cust: CustomerOption) => {
    setSelectedCustomerId(cust.id);
    setCustomerName(cust.name);
    setCustomerPhone(cust.phone || "");
    setCustomerEmail(cust.email || "");
    setCustomerSearch(cust.name);
    setShowCustomerDropdown(false);
  };

  const handleClearCustomer = () => {
    setSelectedCustomerId(null);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setCustomerSearch("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0) {
      toast.error("El carrito está vacío. Agrega productos para cotizar.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { createQuotationAction } = await import(
        "@/app/workspace/[businessId]/ventas/quotation-actions"
      );

      const res = await createQuotationAction(businessId, {
        customerId: selectedCustomerId,
        customerName: customerName.trim() || "Cliente General",
        customerPhone: customerPhone.trim() || null,
        customerEmail: customerEmail.trim() || null,
        items: cartItems,
        validDays: useCustomDate ? undefined : validityDays,
        validUntilDate: useCustomDate ? customDate : undefined,
        notes: notes.trim() || null,
      });

      if (res.success && res.quotation) {
        toast.success(`¡Cotización ${res.quotation.quotationNumber} creada exitosamente!`);
        setCreatedQuotation(res.quotation);
        onSuccess(res.quotation);
      } else {
        toast.error(res.error || "No se pudo crear la cotización.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Ocurrió un error al procesar la cotización.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
        <div className="relative w-full max-w-xl bg-white dark:bg-[#0E131F] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  {createdQuotation ? "Cotización Generada" : "Crear Cotización"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {createdQuotation
                    ? `Comprobante comercial #${createdQuotation.quotationNumber}`
                    : "No reserva inventario ni altera el efectivo de caja"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Si ya fue creada, muestra pantalla de éxito con opciones */}
          {createdQuotation ? (
            <div className="p-6 space-y-5 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center animate-in zoom-in-50 duration-300">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#ED500A]/10 text-[#ED500A] mb-2">
                  {createdQuotation.quotationNumber}
                </span>
                <h4 className="text-lg font-black text-slate-900 dark:text-white">
                  Cotización Emitida con Éxito
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  Válida hasta el{" "}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {new Date(createdQuotation.validUntil).toLocaleDateString("es-CO", {
                      dateStyle: "long",
                    })}
                  </strong>{" "}
                  para <span className="font-semibold">{createdQuotation.customerName}</span>.
                </p>
              </div>

              {/* Tarjeta de resumen de valores */}
              <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 rounded-xl p-4 text-left space-y-2 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Productos ({createdQuotation.items.length})</span>
                  <span>{formatCOP(createdQuotation.subtotal)}</span>
                </div>
                {createdQuotation.taxTotal > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>IVA liquidado</span>
                    <span>{formatCOP(createdQuotation.taxTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-white/5">
                  <span>Total Cotizado</span>
                  <span className="text-[#ED500A]">{formatCOP(createdQuotation.total)}</span>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const text = `Cotización ${createdQuotation.quotationNumber} - Total: ${formatCOP(
                      createdQuotation.total
                    )} - Válida hasta: ${new Date(createdQuotation.validUntil).toLocaleDateString("es-CO")}`;
                    navigator.clipboard?.writeText(text);
                    toast.success("Resumen copiado al portapapeles.");
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 font-bold text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  <span>Copiar resumen</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-[#ED500A] hover:bg-[#ED500A]/90 text-white shadow-md shadow-[#ED500A]/20 transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Listo</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Resumen rápido de productos en el carrito */}
              <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>Productos a cotizar ({summary.itemsCount} unid.)</span>
                  <span className="text-[#ED500A] font-black text-sm">
                    {formatCOP(summary.total)}
                  </span>
                </div>
                <div className="max-h-24 overflow-y-auto space-y-1 pr-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-center">
                      <span className="truncate pr-2">
                        {item.quantity}x {item.productName}{" "}
                        {item.variantName ? `(${item.variantName})` : ""}
                      </span>
                      <span className="font-mono font-medium text-slate-700 dark:text-slate-300 shrink-0">
                        {formatCOP(item.lineTotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 1. Datos del Cliente / Destinatario */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    Cliente o Prospecto
                  </span>
                  {selectedCustomerId && (
                    <button
                      type="button"
                      onClick={handleClearCustomer}
                      className="text-[11px] font-normal text-rose-500 hover:underline"
                    >
                      Limpiar selección
                    </button>
                  )}
                </label>

                {/* Buscador de clientes */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar cliente por nombre o teléfono, o escribir uno nuevo..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setCustomerName(e.target.value);
                    }}
                    onFocus={() => customerResults.length > 0 && setShowCustomerDropdown(true)}
                    className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                  {isSearchingCustomers && (
                    <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
                  )}

                  {/* Dropdown de resultados */}
                  {showCustomerDropdown && customerResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white dark:bg-[#151A28] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl max-h-44 overflow-y-auto py-1">
                      {customerResults.map((cust) => (
                        <button
                          key={cust.id}
                          type="button"
                          onClick={() => handleSelectCustomer(cust)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-white/5 flex items-center justify-between"
                        >
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">{cust.name}</p>
                            <p className="text-[10px] text-slate-500">{cust.phone || "Sin teléfono"}</p>
                          </div>
                          {selectedCustomerId === cust.id && (
                            <Check className="w-4 h-4 text-emerald-500" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      placeholder="Teléfono / WhatsApp (opcional)"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#ED500A]/40 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      placeholder="Email de contacto (opcional)"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#ED500A]/40 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Vigencia / Vencimiento Configurable */}
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-white/5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Plazo de Vigencia de la Cotización
                </label>

                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: "3 días", days: 3 },
                    { label: "7 días", days: 7 },
                    { label: "15 días", days: 15 },
                    { label: "30 días", days: 30 },
                  ].map((preset) => (
                    <button
                      key={preset.days}
                      type="button"
                      onClick={() => {
                        setUseCustomDate(false);
                        setValidityDays(preset.days);
                      }}
                      className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
                        !useCustomDate && validityDays === preset.days
                          ? "bg-[#ED500A] text-white border-[#ED500A] shadow-xs"
                          : "bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Fecha personalizada opcional */}
                <div className="flex items-center gap-2 pt-1">
                  <label className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCustomDate}
                      onChange={(e) => {
                        setUseCustomDate(e.target.checked);
                        if (e.target.checked && !customDate) {
                          const def = new Date();
                          def.setDate(def.getDate() + 7);
                          setCustomDate(def.toISOString().split("T")[0]);
                        }
                      }}
                      className="rounded border-slate-300 text-[#ED500A] focus:ring-[#ED500A]/30"
                    />
                    <span>Elegir fecha de vencimiento específica</span>
                  </label>

                  {useCustomDate && (
                    <input
                      type="date"
                      min={new Date().toISOString().split("T")[0]}
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="px-2.5 py-1 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
                    />
                  )}
                </div>

                <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-[11px] text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>
                    Vence el: <strong className="capitalize">{formattedExpiration}</strong>
                  </span>
                </div>
              </div>

              {/* 3. Notas u Observaciones */}
              <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-white/5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Notas u Observaciones (opcional)
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  placeholder="Ej: Precios válidos según disponibilidad de stock en el momento de confirmar la compra."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#ED500A]/40 text-slate-900 dark:text-white placeholder:text-slate-400 resize-none"
                />
              </div>

              {/* Nota de garantía de invariante contable */}
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  <strong>Garantía contable:</strong> Esta cotización no descuenta existencias ni
                  genera movimientos de caja.
                </span>
              </div>

              {/* Botón de Submit */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || cartItems.length === 0}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#ED500A] hover:bg-[#ED500A]/90 text-white shadow-md shadow-[#ED500A]/20 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Emitiendo cotización...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-3.5 h-3.5" />
                      <span>Crear cotización · {formatCOP(summary.total)}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
