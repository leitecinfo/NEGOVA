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
  Search,
} from "lucide-react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { PosCartItem, PosOrderSummary, formatCOP } from "@/lib/pos/types";
import { RestaurantTable, CreateRestaurantOrderInput } from "@/lib/restaurant/types";
import { DeliveryZone, DeliveryBusinessConfig, calculateDeliveryFeeForOrder } from "@/lib/delivery/types";
import { createRestaurantOrderAction, getActiveWaitersAction, type ActiveWaiterItem } from "@/app/workspace/[businessId]/ventas/order-actions";
import { searchCustomersForPosAction } from "@/app/workspace/[businessId]/clientes/actions";
import {
  getDeliveryZonesAction,
  getDeliveryConfigAction,
  getOperationalDriversAction,
} from "@/app/workspace/[businessId]/pedidos/domicilios/actions";
import { type OperationalDeliveryDriver } from "@/lib/delivery/delivery-service";
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
  onOrderSuccess: (
    orderNumber: number,
    orderId: string,
    details?: {
      orderType: string;
      tableName?: string | null;
      customerName?: string | null;
      diners?: number;
    }
  ) => void;
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
  const [waiters, setWaiters] = useState<ActiveWaiterItem[]>([]);
  const [selectedWaiterId, setSelectedWaiterId] = useState<string>("");
  const [selectedWaiterName, setSelectedWaiterName] = useState<string>("");
  const [isCustomWaiter, setIsCustomWaiter] = useState<boolean>(false);
  const [customWaiterName, setCustomWaiterName] = useState<string>("");

  useEffect(() => {
    if (initialTableId) {
      setSelectedTableId(initialTableId);
    }
  }, [initialTableId]);

  // Domicilio (Delivery)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [deliveryReference, setDeliveryReference] = useState<string>("");
  const [drivers, setDrivers] = useState<OperationalDeliveryDriver[]>([]);
  const [selectedDriverName, setSelectedDriverName] = useState<string>("");
  const [isCustomDriver, setIsCustomDriver] = useState<boolean>(false);
  const [customDriverName, setCustomDriverName] = useState<string>("");

  // Zonas y Configuración de entrega [DOM-001, DOM-002]
  const [deliveryConfig, setDeliveryConfig] = useState<DeliveryBusinessConfig | null>(null);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [isOutsideZones, setIsOutsideZones] = useState<boolean>(false);

  // Búsqueda de cliente frecuente (opcional)
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>("");
  const [customerSearchResults, setCustomerSearchResults] = useState<
    Array<{
      id: string;
      fullName: string;
      phone: string | null;
      addresses: string[];
      notes: string | null;
    }>
  >([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [customerAlertNote, setCustomerAlertNote] = useState<string | null>(null);

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
      setCustomerSearchQuery("");
      setCustomerSearchResults([]);
      setCustomerAlertNote(null);
      setSelectedCustomerId(null);
    }
  }, [isOpen]);

  // Cargar zonas, repartidores, camareros y configuración completa de entrega [DOM-001, DOM-002, PED-006]
  useEffect(() => {
    if (!isOpen || !businessId) return;
    let isSubscribed = true;

    Promise.all([
      getDeliveryZonesAction(businessId),
      getDeliveryConfigAction(businessId),
      getActiveWaitersAction(businessId),
      getOperationalDriversAction(businessId),
    ]).then(([zonesRes, configRes, waitersRes, driversRes]) => {
      if (!isSubscribed) return;

      if (waitersRes?.success && waitersRes.data) {
        setWaiters(waitersRes.data);
      }
      if (driversRes?.success && driversRes.drivers) {
        setDrivers(driversRes.drivers);
      }

      const loadedConfig = configRes.success && configRes.config ? configRes.config : null;
      setDeliveryConfig(loadedConfig);

      const active = zonesRes.success && zonesRes.data ? zonesRes.data.filter((z: any) => z.status === "active") : [];
      setDeliveryZones(active);

      // Si la tarifa configurada es fija:
      if (loadedConfig && loadedConfig.tariffMode === "fixed") {
        const feeResult = calculateDeliveryFeeForOrder(loadedConfig, summary.subtotal);
        setDeliveryFee(feeResult.customerDeliveryFee);
        setSelectedZoneId("");
        setIsOutsideZones(false);
      } else if (active.length > 0) {
        // Modo por zonas
        setSelectedZoneId(active[0].id);
        const feeResult = loadedConfig
          ? calculateDeliveryFeeForOrder(loadedConfig, summary.subtotal, { zoneTariff: active[0].tariff })
          : { customerDeliveryFee: Number(active[0].tariff || 0) };
        setDeliveryFee(feeResult.customerDeliveryFee);
        setIsOutsideZones(false);
      } else {
        setSelectedZoneId("outside");
        setIsOutsideZones(true);
        const fallback = loadedConfig ? loadedConfig.fallbackZoneFee : 0;
        setDeliveryFee(fallback);
      }
    });

    return () => {
      isSubscribed = false;
    };
  }, [isOpen, businessId, summary.subtotal]);

  const handleZoneChange = (zoneId: string) => {
    setSelectedZoneId(zoneId);
    if (zoneId === "outside") {
      setIsOutsideZones(true);
      const fallback = deliveryConfig ? deliveryConfig.fallbackZoneFee : 0;
      setDeliveryFee(fallback);
    } else {
      setIsOutsideZones(false);
      const found = deliveryZones.find((z) => z.id === zoneId);
      if (found) {
        const feeResult = deliveryConfig
          ? calculateDeliveryFeeForOrder(deliveryConfig, summary.subtotal, { zoneTariff: found.tariff })
          : { customerDeliveryFee: Number(found.tariff || 0) };
        setDeliveryFee(feeResult.customerDeliveryFee);
      }
    }
  };

  const handleCustomerSearchChange = async (val: string) => {
    setCustomerSearchQuery(val);
    if (val.trim().length >= 2) {
      setIsSearchingCustomers(true);
      try {
        const results = await searchCustomersForPosAction(businessId, val.trim());
        setCustomerSearchResults(results);
      } catch {
        setCustomerSearchResults([]);
      } finally {
        setIsSearchingCustomers(false);
      }
    } else {
      setCustomerSearchResults([]);
    }
  };

  const handleSelectCustomer = (c: {
    id: string;
    fullName: string;
    phone: string | null;
    addresses: string[];
    notes: string | null;
  }) => {
    setSelectedCustomerId(c.id);
    setCustomerName(c.fullName);
    if (c.phone) setCustomerPhone(c.phone);
    if (c.addresses && c.addresses.length > 0) {
      setDeliveryAddress(c.addresses[0]);
    }
    if (c.notes) {
      setCustomerAlertNote(c.notes);
    } else {
      setCustomerAlertNote(null);
    }
    setCustomerSearchResults([]);
    setCustomerSearchQuery("");
    toast.success(`Datos de ${c.fullName} autocompletados`);
  };

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

    const effectiveDeliveryFee = orderType === "delivery" ? deliveryFee : 0;
    const effectiveDeliveryZoneId =
      orderType === "delivery" && selectedZoneId !== "outside" && selectedZoneId ? selectedZoneId : null;

    const effectiveWaiterName = isCustomWaiter
      ? customWaiterName.trim()
      : selectedWaiterName.trim();
    const effectiveDriverName = isCustomDriver
      ? customDriverName.trim()
      : selectedDriverName.trim();

    // 2. Construir payload tipado
    const payload: CreateRestaurantOrderInput = {
      orderType,
      channelOrigin: effectiveChannelOrigin,
      tableId: orderType === "dine_in" ? selectedTableId : null,
      waiterId: orderType === "dine_in" ? (selectedWaiterId || null) : null,
      waiterName: orderType === "dine_in" ? (effectiveWaiterName || null) : null,
      driverName: orderType === "delivery" ? (effectiveDriverName || null) : null,
      customerId: selectedCustomerId,
      customerName: ["delivery", "takeout"].includes(orderType)
        ? customerName.trim() || (orderType === "delivery" ? "Cliente Domicilio" : null)
        : null,
      customerPhone: ["delivery", "takeout"].includes(orderType) ? customerPhone.trim() || null : null,
      deliveryAddress: orderType === "delivery" ? deliveryAddress.trim() : null,
      deliveryReference: orderType === "delivery" ? deliveryReference.trim() || null : null,
      deliveryFee: effectiveDeliveryFee,
      deliveryZoneId: effectiveDeliveryZoneId,
      notes: generalNotes.trim() || null,
      idempotencyKey,
      taxTotal: summary.tax,
      items: cartItems.map((item) => ({
        productId: item.productId,
        variantId: item.variantId || null,
        variantName: item.variantName || null,
        quantity: item.quantity,
        notes: item.notes,
        taxPercentage: item.taxPercentage,
        taxIncludedInPrice: item.taxIncludedInPrice,
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
      const tableName = tables.find((t) => t.id === selectedTableId)?.name_or_number || null;
      onOrderSuccess(res.orderNumber, res.orderId, {
        orderType,
        tableName,
        customerName: customerName.trim() || null,
        diners: 1,
      });
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

                {/* ASIGNACIÓN DE CAMARERO / PERSONAL DE SERVICIO [PED-006] */}
                <div className="pt-3 border-t border-slate-200/60 dark:border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#ED500A]" />
                      <span>Camarero / Mesero responsable</span>
                    </label>
                    {waiters.length > 0 && (
                      <span className="text-[10px] text-slate-400">
                        {waiters.length} colaboradores activos
                      </span>
                    )}
                  </div>

                  <select
                    disabled={isSubmitting}
                    value={isCustomWaiter ? "custom" : selectedWaiterId || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "custom") {
                        setIsCustomWaiter(true);
                        setSelectedWaiterId("");
                        setSelectedWaiterName("");
                      } else if (val === "") {
                        setIsCustomWaiter(false);
                        setSelectedWaiterId("");
                        setSelectedWaiterName("");
                      } else {
                        setIsCustomWaiter(false);
                        setSelectedWaiterId(val);
                        const found = waiters.find((w) => w.id === val);
                        setSelectedWaiterName(found ? `${found.name} (${found.code})` : "");
                      }
                    }}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30"
                  >
                    <option value="">Sin camarero asignado (Atención general)</option>
                    {waiters.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} — {w.code}
                      </option>
                    ))}
                    <option value="custom">✏️ Otro / Ingresar nombre manualmente...</option>
                  </select>

                  {isCustomWaiter && (
                    <input
                      type="text"
                      disabled={isSubmitting}
                      value={customWaiterName}
                      onChange={(e) => setCustomWaiterName(e.target.value)}
                      placeholder="Nombre del camarero o persona que atiende..."
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 text-slate-900 dark:text-white mt-1.5"
                    />
                  )}
                </div>
              </div>
            )}

            {/* CASO B: DOMICILIO (DELIVERY) */}
            {orderType === "delivery" && (
              <div className="p-4 bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                    <Bike className="w-3.5 h-3.5 text-[#ED500A]" />
                    <span>2. Datos de entrega a domicilio *</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Cliente frecuente o nuevo</span>
                </div>

                {/* Buscador predictivo opcional */}
                <div className="relative">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      disabled={isSubmitting}
                      value={customerSearchQuery}
                      onChange={(e) => handleCustomerSearchChange(e.target.value)}
                      placeholder="Buscar cliente frecuente por celular o nombre..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-[#0D0F16] border border-dashed border-slate-300 dark:border-white/20 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
                    />
                  </div>

                  {/* Resultados predictivos */}
                  {customerSearchResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.06]">
                      {customerSearchResults.map((res) => (
                        <button
                          key={res.id}
                          type="button"
                          onClick={() => handleSelectCustomer(res)}
                          className="w-full p-2.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors flex items-start justify-between gap-2"
                        >
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {res.fullName}
                            </div>
                            {res.phone && (
                              <div className="text-[11px] text-slate-500 font-mono">
                                {res.phone}
                              </div>
                            )}
                            {res.addresses.length > 0 && (
                              <div className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">
                                {res.addresses[0]}
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-[#ED500A] font-semibold uppercase shrink-0 mt-0.5">
                            Seleccionar
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Aviso de preferencia/alergia del cliente */}
                {customerAlertNote && (
                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900 text-[11px] flex items-start gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                    <span>Nota del cliente: {customerAlertNote}</span>
                  </div>
                )}

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

                {/* MODALIDAD Y TARIFA DE ENTREGA [DOM-001, DOM-002] */}
                <div className="space-y-2 pt-1 border-t border-slate-200/60 dark:border-white/5">
                  {deliveryConfig && deliveryConfig.tariffMode === "fixed" ? (
                    <div className="p-3 rounded-xl bg-orange-50/40 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-500/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bike className="w-4 h-4 text-[#ED500A]" />
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            Tarifa fija de entrega configurada:
                          </span>
                        </div>
                        <span className="text-sm font-bold font-mono text-[#ED500A]">
                          {formatCOP(deliveryConfig.fixedFee)}
                        </span>
                      </div>

                      {/* BADGES SEGÚN QUIÉN PAGA */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {deliveryConfig.payer === "business" && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            ✓ Envío gratis (asumido por el comercio)
                          </span>
                        )}
                        {deliveryConfig.payer === "split_50_50" && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                            🤝 Tarifa compartida 50/50 (Cliente: {formatCOP(deliveryFee)})
                          </span>
                        )}
                        {deliveryConfig.payer === "customer" && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            👤 Paga el cliente
                          </span>
                        )}
                        {deliveryConfig.freeDeliveryThreshold && summary.subtotal >= deliveryConfig.freeDeliveryThreshold && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            🎉 Envío gratis por compra &gt; {formatCOP(deliveryConfig.freeDeliveryThreshold)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-orange-200/60 dark:border-white/5">
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                          Tarifa a cobrar en esta orden (COP):
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="500"
                          value={deliveryFee}
                          onChange={(e) => setDeliveryFee(Math.max(0, Number(e.target.value) || 0))}
                          className="w-28 px-2 py-1 text-xs font-mono font-bold bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          Zona de entrega y cobertura *
                        </label>
                        {selectedZoneId && selectedZoneId !== "outside" && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Zona verificada
                          </span>
                        )}
                      </div>

                      <select
                        value={selectedZoneId}
                        onChange={(e) => handleZoneChange(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30"
                      >
                        {deliveryZones.length === 0 ? (
                          <option value="outside">Sin zonas configuradas (Tarifa manual)</option>
                        ) : (
                          <>
                            {deliveryZones.map((z) => (
                              <option key={z.id} value={z.id}>
                                {z.name} — Tarifa: {formatCOP(z.tariff)} (~{z.estimated_time_min} min)
                              </option>
                            ))}
                            <option value="outside">⚠️ Fuera de cobertura habitual / Tarifa personalizada</option>
                          </>
                        )}
                      </select>

                      {/* ADVERTENCIA FUERA DE COBERTURA */}
                      {isOutsideZones && (
                        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                          <div className="flex-1">
                            <span className="font-bold">Dirección fuera de cobertura habitual:</span>
                            <p className="text-[11px] mt-0.5">
                              Esta dirección está fuera de las zonas registradas. Puedes fijar una tarifa manual para procesar el pedido o rechazarlo si no hay cobertura disponible.
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <label className="text-[11px] font-semibold">Tarifa manual (COP):</label>
                              <input
                                type="number"
                                min="0"
                                step="500"
                                value={deliveryFee}
                                onChange={(e) => setDeliveryFee(Math.max(0, Number(e.target.value) || 0))}
                                className="w-28 px-2 py-1 text-xs font-mono font-bold bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ADVERTENCIA PEDIDO MÍNIMO */}
                      {selectedZoneId && selectedZoneId !== "outside" && (() => {
                        const activeZone = deliveryZones.find((z) => z.id === selectedZoneId);
                        if (activeZone && activeZone.min_order > 0 && summary.subtotal < activeZone.min_order) {
                          return (
                            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600 mt-0.5" />
                              <span>
                                Pedido mínimo para {activeZone.name}: <strong>{formatCOP(activeZone.min_order)}</strong>.
                                (Faltan {formatCOP(activeZone.min_order - summary.subtotal)}).
                              </span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </>
                  )}

                  {/* ADVERTENCIA PEDIDO MÍNIMO GENERAL DEL NEGOCIO */}
                  {deliveryConfig && deliveryConfig.minOrderAmount > 0 && summary.subtotal < deliveryConfig.minOrderAmount && (
                    <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600 mt-0.5" />
                      <span>
                        Pedido mínimo de domicilios: <strong>{formatCOP(deliveryConfig.minOrderAmount)}</strong>.
                        (Faltan {formatCOP(deliveryConfig.minOrderAmount - summary.subtotal)}).
                      </span>
                    </div>
                  )}
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

                {/* ASIGNACIÓN DE DOMICILIARIO [PED-006] */}
                <div className="pt-3 border-t border-slate-200/60 dark:border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Bike className="w-3.5 h-3.5 text-[#ED500A]" />
                      <span>Domiciliario / Repartidor asignado</span>
                    </label>
                    {drivers.length > 0 && (
                      <span className="text-[10px] text-slate-400">
                        {drivers.length} repartidores registrados
                      </span>
                    )}
                  </div>

                  <select
                    disabled={isSubmitting}
                    value={isCustomDriver ? "custom" : selectedDriverName || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "custom") {
                        setIsCustomDriver(true);
                        setSelectedDriverName("");
                      } else if (val === "") {
                        setIsCustomDriver(false);
                        setSelectedDriverName("");
                      } else {
                        setIsCustomDriver(false);
                        setSelectedDriverName(val);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30"
                  >
                    <option value="">Por asignar (Asignar luego de preparar comanda)</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name} {d.phone ? `(${d.phone})` : ""} {!d.isActive ? "— [Inactivo]" : ""}
                      </option>
                    ))}
                    <option value="custom">✏️ Otro repartidor / Ingresar nombre manualmente...</option>
                  </select>

                  {isCustomDriver && (
                    <input
                      type="text"
                      disabled={isSubmitting}
                      value={customDriverName}
                      onChange={(e) => setCustomDriverName(e.target.value)}
                      placeholder="Nombre o empresa del repartidor (ej. Juan Repartos / Rappi)..."
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 text-slate-900 dark:text-white mt-1.5"
                    />
                  )}
                </div>
              </div>
            )}

            {/* CASO C: PARA LLEVAR (TAKEOUT) */}
            {orderType === "takeout" && (
              <div className="p-4 bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                    <ShoppingBag className="w-4 h-4 text-[#ED500A] shrink-0" />
                    <span>2. Datos para retiro en mostrador (Opcional)</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Cliente habitual o anónimo</span>
                </div>

                {/* Buscador predictivo opcional */}
                <div className="relative">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      disabled={isSubmitting}
                      value={customerSearchQuery}
                      onChange={(e) => handleCustomerSearchChange(e.target.value)}
                      placeholder="Buscar cliente frecuente por celular o nombre..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-[#0D0F16] border border-dashed border-slate-300 dark:border-white/20 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
                    />
                  </div>

                  {/* Resultados predictivos */}
                  {customerSearchResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.06]">
                      {customerSearchResults.map((res) => (
                        <button
                          key={res.id}
                          type="button"
                          onClick={() => handleSelectCustomer(res)}
                          className="w-full p-2.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors flex items-start justify-between gap-2"
                        >
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {res.fullName}
                            </div>
                            {res.phone && (
                              <div className="text-[11px] text-slate-500 font-mono">
                                {res.phone}
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-[#ED500A] font-semibold uppercase shrink-0 mt-0.5">
                            Seleccionar
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Aviso de preferencia del cliente */}
                {customerAlertNote && (
                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900 text-[11px] flex items-start gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                    <span>Nota del cliente: {customerAlertNote}</span>
                  </div>
                )}

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

              {summary.includedTax > 0 && (
                <div className="flex justify-between items-center text-[11px] text-slate-500">
                  <span>Base gravable neta (IVA incluido)</span>
                  <span>{formatCOP(summary.netSubtotal)}</span>
                </div>
              )}

              {summary.includedTax > 0 && (
                <div className="flex justify-between items-center text-[11px] text-slate-500">
                  <span>IVA incluido desagregado</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{formatCOP(summary.includedTax)}</span>
                </div>
              )}

              {summary.additionalTax > 0 && (
                <div className="flex justify-between items-center text-xs text-slate-700 dark:text-slate-300 font-medium">
                  <span>+ Impuesto adicional</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{formatCOP(summary.additionalTax)}</span>
                </div>
              )}

              {orderType === "delivery" && deliveryFee > 0 && (
                <div className="flex justify-between items-center text-xs text-slate-700 dark:text-slate-300 font-medium">
                  <span>+ Tarifa de domicilio</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{formatCOP(deliveryFee)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-sm font-black text-slate-900 dark:text-white pt-1.5 border-t border-slate-200 dark:border-white/[0.08]">
                <span>Total comanda</span>
                <span className="text-[#ED500A]">
                  {formatCOP(summary.total + (orderType === "delivery" ? deliveryFee : 0))}
                </span>
              </div>
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors disabled:opacity-50 min-h-[44px] flex items-center justify-center cursor-pointer"
              >
                Modificar carrito
              </button>

              <button
                type="submit"
                disabled={isSubmitting || (orderType === "dine_in" && tables.length === 0)}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs bg-[#ED500A] hover:bg-[#ED500A]/90 text-white shadow-md shadow-[#ED500A]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] min-h-[44px] cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Registrando comanda...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      Registrar Pedido — {formatCOP(summary.total + (orderType === "delivery" ? deliveryFee : 0))}
                    </span>
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
