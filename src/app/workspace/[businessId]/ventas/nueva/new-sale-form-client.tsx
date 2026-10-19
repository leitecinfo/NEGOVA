"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Receipt,
  Plus,
  Trash2,
  ChevronRight,
  User,
  CreditCard,
  Banknote,
  Clock,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  ShoppingBag,
  Store,
} from "lucide-react";
import { createSaleAction, type CreateSaleItemInput } from "../actions";
import type { BusinessPaymentMethod } from "@/lib/documents/types";

interface NewSaleFormClientProps {
  businessId: string;
  businessName: string;
  tradeName: string;
  primaryColor?: string;
  onSwitchToPos?: () => void;
  posSettings?: {
    printReceipt?: boolean;
    receiptCopies?: number;
    defaultPaymentMethod?: "cash" | "transfer" | "card";
    askCustomerName?: boolean;
  };
}

interface SaleLineItem {
  id: string;
  description: string;
  quantity: number | "";
  unitPrice: number | "";
  discount: number | "";
}

export function NewSaleFormClient({
  businessId,
  businessName,
  tradeName,
  primaryColor = "#0284C7",
  onSwitchToPos,
  posSettings,
}: NewSaleFormClientProps) {
  const router = useRouter();

  // 1. Datos del cliente (consume askCustomerName si está configurado)
  const [customerName, setCustomerName] = useState(
    posSettings?.askCustomerName ? "" : "Consumidor Final"
  );
  const [customerId, setCustomerId] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  // 2. Líneas de productos / servicios
  const [items, setItems] = useState<SaleLineItem[]>([
    { id: "1", description: "", quantity: 1, unitPrice: "", discount: 0 },
  ]);

  // 3. Método de pago (consume defaultPaymentMethod desde las preferencias del POS)
  const [paymentMethod, setPaymentMethod] = useState<BusinessPaymentMethod>(
    posSettings?.defaultPaymentMethod || "cash"
  );
  const [notes, setNotes] = useState("");

  // 4. Descuentos globales e impuestos
  const [globalDiscount, setGlobalDiscount] = useState<number | "">("");
  const [globalTax, setGlobalTax] = useState<number | "">("");

  // 5. Estados de envío y validación
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Cálculos en vivo
  const calculatedItems = items.map((it) => {
    const qty = Number(it.quantity) || 0;
    const price = Number(it.unitPrice) || 0;
    const disc = Number(it.discount) || 0;
    const lineTotal = Math.max(0, qty * price - disc);
    return { ...it, qty, price, disc, lineTotal };
  });

  const subtotal = calculatedItems.reduce((acc, it) => acc + it.qty * it.price, 0);
  const itemsDiscount = calculatedItems.reduce((acc, it) => acc + it.disc, 0);
  const discountTotal = itemsDiscount + (Number(globalDiscount) || 0);
  const taxTotal = Math.max(0, Number(globalTax) || 0);
  const total = Math.max(0, subtotal - discountTotal + taxTotal);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { id: String(Date.now()), description: "", quantity: 1, unitPrice: "", discount: 0 },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      setErrorMessage("La venta debe incluir al menos un producto o servicio.");
      return;
    }
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleItemChange = (id: string, field: keyof SaleLineItem, value: any) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
    if (errorMessage) setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);

    // Resolver nombre del cliente (opcional en venta presencial/mostrador, por defecto Consumidor Final)
    const effectiveCustomerName = customerName.trim() || "Consumidor Final";

    // Validar líneas
    if (items.length === 0) {
      setErrorMessage("Agregue al menos un producto o concepto a la venta.");
      return;
    }

    const payloadItems: CreateSaleItemInput[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.description.trim()) {
        setErrorMessage(`La línea ${i + 1} no tiene descripción del producto o servicio.`);
        return;
      }
      const qty = Number(it.quantity);
      if (isNaN(qty) || qty <= 0) {
        setErrorMessage(`La cantidad en la línea ${i + 1} ("${it.description}") debe ser mayor a 0.`);
        return;
      }
      const price = Number(it.unitPrice);
      if (isNaN(price) || price < 0) {
        setErrorMessage(`El precio unitario en la línea ${i + 1} ("${it.description}") no puede ser negativo.`);
        return;
      }

      payloadItems.push({
        description: it.description.trim(),
        quantity: qty,
        unitPrice: price,
        discount: Number(it.discount) || 0,
      });
    }

    setIsSubmitting(true);

    try {
      const res = await createSaleAction(businessId, {
        customerName: effectiveCustomerName,
        customerId: customerId.trim() || null,
        customerPhone: customerPhone.trim() || null,
        customerEmail: customerEmail.trim() || null,
        customerAddress: customerAddress.trim() || null,
        documentType: "sale",
        paymentMethod,
        notes: notes.trim() || null,
        items: payloadItems,
        discountTotal: Number(globalDiscount) || 0,
        taxTotal: taxTotal,
      });

      if (!res.success || !res.documentId) {
        setErrorMessage(res.error || "Ocurrió un error al registrar la venta.");
        setIsSubmitting(false);
        return;
      }

      // Redirigir al detalle del comprobante generado
      router.push(`/workspace/${businessId}/ventas/${res.documentId}`);
    } catch (err: any) {
      setErrorMessage(err?.message || "Error inesperado al procesar la venta.");
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex-1 p-6 lg:p-8 space-y-8 max-w-5xl mx-auto w-full">
      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-white/5">
        <div className="space-y-1">
          <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 gap-2 mb-1">
            <Link href={`/workspace/${businessId}`} className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Inicio
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <Link href={`/workspace/${businessId}/ventas`} className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Ventas
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-900 dark:text-white font-medium">Nueva</span>
          </div>

          <h1 className="text-2xl font-bold font-title text-slate-900 dark:text-white flex items-center gap-2.5">
            <ShoppingBag className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>Registrar Nueva Venta</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Emite un comprobante comercial para {tradeName || businessName}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onSwitchToPos && (
            <button
              type="button"
              onClick={onSwitchToPos}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#ED500A] text-white hover:bg-[#ED500A]/90 transition-all shadow-xs shrink-0"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Modo POS (Catálogo)</span>
            </button>
          )}

          <Link
            href={`/workspace/${businessId}/ventas`}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 transition-colors shadow-xs shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver al historial</span>
          </Link>
        </div>
      </div>

      {/* MENSAJE DE ERROR */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-start gap-3 text-rose-800 dark:text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
          <div className="flex-1 font-medium">{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECCIÓN 1: DATOS DEL CLIENTE */}
        <div className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-white/5">
            <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Información del Cliente</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nombre del cliente <span className="text-slate-400 font-normal">(Opcional — Consumidor Final)</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Consumidor Final"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Identificación / Cédula / NIT <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <input
                type="text"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder="Ej. 1098234567"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Teléfono <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Ej. 300 123 4567"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Correo Electrónico <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="cliente@correo.com"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Dirección <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Calle 10 # 5-20"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: LÍNEAS DE PRODUCTOS / SERVICIOS */}
        <div className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Conceptos / Productos a Facturar</span>
            </div>

            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar línea</span>
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => {
              const qty = Number(item.quantity) || 0;
              const price = Number(item.unitPrice) || 0;
              const disc = Number(item.discount) || 0;
              const lineTotal = Math.max(0, qty * price - disc);

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                >
                  {/* Descripción */}
                  <div className="sm:col-span-5 space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Descripción #{idx + 1}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Hamburguesa Especial / Reparación"
                      value={item.description}
                      onChange={(e) => handleItemChange(item.id, "description", e.target.value)}
                      className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Cantidad */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Cant.
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(item.id, "quantity", e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-center font-mono"
                    />
                  </div>

                  {/* Precio Unitario */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Precio Unit.
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="100"
                      placeholder="0"
                      value={item.unitPrice}
                      onChange={(e) => handleItemChange(item.id, "unitPrice", e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-right font-mono"
                    />
                  </div>

                  {/* Subtotal de línea */}
                  <div className="sm:col-span-2 space-y-1 text-right">
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Subtotal
                    </label>
                    <div className="py-1.5 font-mono font-bold text-sm text-slate-900 dark:text-white">
                      {formatCOP(lineTotal)}
                    </div>
                  </div>

                  {/* Eliminar */}
                  <div className="sm:col-span-1 flex items-center justify-end sm:justify-center pt-2 sm:pt-4">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={items.length <= 1}
                      title="Eliminar línea"
                      className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-20 disabled:hover:text-slate-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECCIÓN 3: PAGO, OBSERVACIONES Y TOTALES */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Método de pago y Notas */}
          <div className="lg:col-span-7 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-white/5">
              <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Condiciones de Pago y Notas</span>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Método de pago registrado
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "cash", label: "Efectivo", icon: Banknote },
                  { id: "transfer", label: "Transferencia", icon: CreditCard },
                  { id: "card", label: "Tarjeta", icon: CreditCard },
                  { id: "other", label: "Otro", icon: Receipt },
                ].map((m) => {
                  const Icon = m.icon;
                  const isSelected = paymentMethod === m.id;
                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => setPaymentMethod(m.id as BusinessPaymentMethod)}
                      className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition-all ${
                        isSelected
                          ? "border-blue-600 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-xs"
                          : "border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Observaciones / Notas del Comprobante <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. Mesa 4 / Garantía de 30 días / Entregado al cliente..."
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white resize-none"
              />
            </div>
          </div>

          {/* Tarjeta de Resumen y Confirmación */}
          <div className="lg:col-span-5 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="text-sm font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-white/5">
                Resumen de la Venta
              </div>

              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Subtotal:</span>
                  <span className="font-mono font-medium text-slate-900 dark:text-white">
                    {formatCOP(subtotal)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span className="text-xs">Descuento ($):</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={globalDiscount}
                    onChange={(e) => setGlobalDiscount(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
                    className="w-28 px-2.5 py-1 text-right text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-lg font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span className="text-xs">Impuestos / IVA ($):</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={globalTax}
                    onChange={(e) => setGlobalTax(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
                    className="w-28 px-2.5 py-1 text-right text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-lg font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-white/[0.08] flex justify-between items-baseline">
                  <span className="text-base font-bold text-slate-900 dark:text-white">Total a Cobrar:</span>
                  <span className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
                    {formatCOP(total)}
                  </span>
                </div>
              </div>
            </div>

            {/* BOTÓN REGISTRAR VENTA (Protección contra doble clic) */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || total <= 0}
                className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Registrando venta...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Registrar comprobante</span>
                  </>
                )}
              </button>
              <p className="text-[11px] text-center text-slate-400 mt-2">
                Asigna correlativo seguro e inmutable en PostgreSQL.
              </p>
            </div>
          </div>
        </div>
      </form>
    </main>
  );
}
