"use client";

import React, { useState, useEffect } from "react";
import {
  UtensilsCrossed,
  ShoppingBag,
  Bike,
  User,
  Phone,
  MapPin,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Receipt,
  Layers,
  Sparkles,
} from "lucide-react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { PosCartItem, PosOrderSummary, formatCOP } from "@/lib/pos/types";
import { RestaurantTable, CreateRestaurantOrderInput } from "@/lib/restaurant/types";
import { createRestaurantOrderAction } from "@/app/workspace/[businessId]/ventas/order-actions";
import { toast } from "sonner";

interface OrderDestinationModalProps {
  isOpen: boolean;
  businessId: string;
  businessName: string;
  tradeName?: string;
  cartItems: PosCartItem[];
  summary: PosOrderSummary;
  tables: RestaurantTable[];
  initialTableId?: string;
  onClose: () => void;
  onOrderSuccess: (orderNumber: number, orderId: string) => void;
}

export function OrderDestinationModal({
  isOpen,
  businessId,
  businessName,
  tradeName,
  cartItems,
  summary,
  tables,
  initialTableId,
  onClose,
  onOrderSuccess,
}: OrderDestinationModalProps) {
  // Destino del pedido (En POS físico el canal es siempre in_person)
  const [orderType, setOrderType] = useState<"dine_in" | "takeout" | "delivery">("dine_in");
  const channelOrigin = "in_person";

  // Mesa (Dine-in)
  const [selectedTableId, setSelectedTableId] = useState<string>(initialTableId || "");

  useEffect(() => {
    if (initialTableId) {
      setSelectedTableId(initialTableId);
    }
  }, [initialTableId]);

  // Domicilio (Delivery)
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [deliveryReference, setDeliveryReference] = useState<string>("");

  // Notas generales
  const [generalNotes, setGeneralNotes] = useState<string>("");

  // Estados de envío y validación
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");

  // Manejo de cambio de destino
  const handleSelectOrderType = (type: "dine_in" | "takeout" | "delivery") => {
    setOrderType(type);
    setErrorMessage(null);
    if (type === "dine_in") {
      if (tables.length > 0) {
        const isCurrentValid = tables.some((t) => t.id === selectedTableId && t.status === "available");
        if (!selectedTableId || !isCurrentValid) {
          const firstAvail = tables.find((t) => t.status === "available") || tables[0];
          setSelectedTableId(firstAvail.id);
        }
      }
    }
  };

  // Inicializar estado cada vez que se abre el modal
  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
      setErrorMessage(null);
      setIdempotencyKey(crypto.randomUUID());

      // Si hay mesas y ninguna seleccionada (o la seleccionada ya no existe), preseleccionar la primera disponible
      if (tables.length > 0) {
        const isCurrentValid = tables.some((t) => t.id === selectedTableId && t.status === "available");
        if (!selectedTableId || !isCurrentValid) {
          const firstAvail = tables.find((t) => t.status === "available") || tables[0];
          setSelectedTableId(firstAvail.id);
        }
      } else if (orderType === "dine_in") {
        // Si no hay mesas configuradas, sugerir Para llevar
        setOrderType("takeout");
      }
    } else {
      setIsSubmitting(false);
      setErrorMessage(null);
      setIdempotencyKey("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);

    // 1. Validaciones de interfaz
    if (orderType === "dine_in") {
      if (!selectedTableId) {
        setErrorMessage("Debes seleccionar una mesa para consumo en el local.");
        return;
      }
    }

    if (orderType === "delivery") {
      if (!deliveryAddress.trim()) {
        setErrorMessage("Por favor ingresa la dirección completa de entrega.");
        return;
      }
    }

    if (cartItems.length === 0) {
      setErrorMessage("No hay productos en la comanda.");
      return;
    }

    // Para consumo en local, el canal de recepción siempre es in_person
    const effectiveChannelOrigin = orderType === "dine_in" ? "in_person" : channelOrigin;

    // 2. Construir payload tipado
    const payload: CreateRestaurantOrderInput = {
      orderType,
      channelOrigin: effectiveChannelOrigin,
      tableId: orderType === "dine_in" ? selectedTableId : null,
      customerName: ["delivery", "takeout"].includes(orderType)
        ? customerName.trim() || (orderType === "delivery" ? "Cliente Domicilio" : null)
        : null,
      customerPhone: ["delivery", "takeout"].includes(orderType) ? customerPhone.trim() || null : null,
      deliveryAddress: orderType === "delivery" ? deliveryAddress.trim() : null,
      deliveryReference: orderType === "delivery" ? deliveryReference.trim() || null : null,
      notes: generalNotes.trim() || null,
      idempotencyKey,
      items: cartItems.map((item) => ({
        productId: item.productId,
        variantId: item.variantId || null,
        variantName: item.variantName || null,
        quantity: item.quantity,
        notes: item.notes,
        selectedModifiers: item.selectedModifiers.map((m) => ({
          groupId: m.groupId,
          groupName: m.groupName,
          optionId: m.optionId,
          optionName: m.optionName,
          price: m.price,
        })),
      })),
    };

    setIsSubmitting(true);

    try {
      const res = await createRestaurantOrderAction(businessId, payload);

      if (!res.success || !res.orderNumber || !res.orderId) {
        setErrorMessage(res.error || "Ocurrió un error al registrar el pedido.");
        setIsSubmitting(false);
        return;
      }

      toast.success(`¡Pedido #${res.orderNumber} registrado!`, {
        description: `Comanda guardada con éxito para ${
          orderType === "dine_in"
            ? "Mesa"
            : orderType === "takeout"
            ? "Para llevar"
            : "Domicilio"
        }.`,
      });

      setIsSubmitting(false);
      onOrderSuccess(res.orderNumber, res.orderId);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || "Error inesperado al conectar con el servidor.");
      setIsSubmitting(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 m-0 p-4 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* HEADER */}
          <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center font-bold">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Destino del Pedido
                </h3>
                <p className="text-xs text-slate-500">
                  {tradeName || businessName} · Total: {formatCOP(summary.total)}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* FORMULARIO */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{errorMessage}</span>
              </div>
            )}

            {/* 1. SELECCIÓN DE DESTINO */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                1. Destino del pedido *
              </label>

              <div className="grid grid-cols-3 gap-2.5">
                {[
                  {
                    id: "dine_in",
                    label: "Mesa",
                    icon: UtensilsCrossed,
                    desc: "Consumo en local",
                  },
                  {
                    id: "takeout",
                    label: "Para llevar",
                    icon: ShoppingBag,
                    desc: "Recoge en mostrador",
                  },
                  {
                    id: "delivery",
                    label: "Domicilio",
                    icon: Bike,
                    desc: "Envío al cliente",
                  },
                ].map((d) => {
                  const Icon = d.icon;
                  const isSel = orderType === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleSelectOrderType(d.id as any)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                        isSel
                          ? "bg-[#ED500A]/10 text-[#ED500A] border-[#ED500A] ring-1 ring-[#ED500A] shadow-xs"
                          : "bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20"
                      }`}
                    >
                      <Icon className="w-5 h-5 mb-1.5" />
                      <span className="text-xs font-bold leading-tight">{d.label}</span>
                      <span className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                        {d.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. CAMPOS ESPECÍFICOS SEGÚN DESTINO */}

            {/* CASO A: MESA (DINE_IN) */}
            {orderType === "dine_in" && (
              <div className="p-4 bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <UtensilsCrossed className="w-3.5 h-3.5 text-[#ED500A]" />
                    <span>2. Seleccionar Mesa para Consumo en Salón *</span>
                  </label>
                  {tables.length > 0 && (
                    <span className="text-[11px] text-slate-500">
                      {tables.length} mesas registradas
                    </span>
                  )}
                </div>

                {tables.length === 0 ? (
                  <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 rounded-lg text-xs text-amber-800 dark:text-amber-300 space-y-1">
                    <p className="font-semibold">Sin mesas configuradas en este negocio</p>
                    <p className="text-[11px] leading-relaxed">
                      Aún no hay mesas creadas en la base de datos. Para registrar pedidos en mesa,
                      crea mesas en la configuración o selecciona <strong>Para llevar</strong> o{" "}
                      <strong>Domicilio</strong>.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
                    {tables.map((tbl) => {
                      const isSel = selectedTableId === tbl.id;
                      const isAvailable = tbl.status === "available";

                      return (
                        <button
                          key={tbl.id}
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => setSelectedTableId(tbl.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            isSel
                              ? "bg-white dark:bg-[#0D0F16] border-[#ED500A] ring-2 ring-[#ED500A]/30 shadow-xs"
                              : "bg-white dark:bg-[#0D0F16] border-slate-200 dark:border-white/[0.08] hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {tbl.name_or_number}
                            </span>
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isAvailable ? "bg-emerald-500" : "bg-amber-500"
                              }`}
                              title={isAvailable ? "Libre" : "Ocupada"}
                            />
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                            <span>Cap: {tbl.capacity || 4}</span>
                            <span className={isAvailable ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
                              {isAvailable ? "Libre" : "Ocupada"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* CASO B: DOMICILIO (DELIVERY) */}
            {orderType === "delivery" && (
              <div className="p-4 bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] rounded-xl space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                  <Bike className="w-3.5 h-3.5 text-[#ED500A]" />
                  <span>2. Datos de entrega a domicilio *</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nombre del cliente / destinatario (Opcional)
                    </label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        disabled={isSubmitting}
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Ej. Carlos Mendoza (Opcional)"
                        className="w-full pl-8 pr-3 py-2 text-xs bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Teléfono de contacto (Opcional)
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="tel"
                        disabled={isSubmitting}
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Ej. 300 123 4567"
                        className="w-full pl-8 pr-3 py-2 text-xs bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Dirección de entrega *
                  </label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      disabled={isSubmitting}
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Ej. Calle 45 # 12 - 34, Barrio El Poblado"
                      className="w-full pl-8 pr-3 py-2 text-xs bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Punto de referencia / Instrucciones de llegada (Opcional)
                  </label>
                  <input
                    type="text"
                    disabled={isSubmitting}
                    value={deliveryReference}
                    onChange={(e) => setDeliveryReference(e.target.value)}
                    placeholder="Ej. Torre 2, apto 504 / Portón negro frente al parque"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}

            {/* CASO C: PARA LLEVAR (TAKEOUT) */}
            {orderType === "takeout" && (
              <div className="p-4 bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                  <ShoppingBag className="w-4 h-4 text-[#ED500A] shrink-0" />
                  <span>2. Datos para retiro en mostrador (Opcional)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60 dark:border-white/5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nombre de quien recoge (Opcional)
                    </label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        disabled={isSubmitting}
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Ej. Andrés R."
                        className="w-full pl-8 pr-3 py-2 text-xs bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Teléfono de contacto (Opcional)
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="tel"
                        disabled={isSubmitting}
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Ej. 311 234 5678"
                        className="w-full pl-8 pr-3 py-2 text-xs bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. NOTAS GENERALES DE LA COMANDA */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                3. Instrucciones generales de la comanda (Opcional)
              </label>
              <input
                type="text"
                disabled={isSubmitting}
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                placeholder="Ej. Empacar salsas por separado, cliente espera con prisa..."
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 text-slate-900 dark:text-white"
              />
            </div>

            {/* 4. RESUMEN COMPACTO DE LA COMANDA */}
            <div className="p-3.5 bg-slate-100/70 dark:bg-white/5 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 font-medium">
                <span>{summary.itemsCount} productos seleccionados</span>
                <span>Subtotal: {formatCOP(summary.subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-black text-slate-900 dark:text-white pt-1.5 border-t border-slate-200 dark:border-white/[0.08]">
                <span>Total comanda</span>
                <span className="text-[#ED500A]">{formatCOP(summary.total)}</span>
              </div>
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors disabled:opacity-50"
              >
                Modificar carrito
              </button>

              <button
                type="submit"
                disabled={isSubmitting || (orderType === "dine_in" && tables.length === 0)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs bg-[#ED500A] hover:bg-[#ED500A]/90 text-white shadow-md shadow-[#ED500A]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Registrando comanda...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Registrar Pedido — {formatCOP(summary.total)}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
