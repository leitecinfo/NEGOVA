"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  Bike,
  Clock,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Phone,
  User,
  ExternalLink,
  Copy,
  Printer,
  ChevronRight,
  ArrowLeft,
  Users,
  Plus,
  Key,
  ShieldCheck,
  Share2,
  MessageCircle,
  FileText,
  Search,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { RestaurantOrderWithDetails } from "@/lib/restaurant/types";
import { BusinessDocumentConfig } from "@/lib/documents/types";
import { OperationalDeliveryDriver } from "@/lib/delivery/delivery-service";
import { ThermalTicketModal } from "@/components/printing/thermal-ticket";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  assignDriverToOrderAction,
  dispatchDeliveryOrderAction,
  confirmDeliveryWithExceptionAction,
  createOperationalDriverAction,
  toggleDriverStatusAction,
} from "./actions";

interface DeliveriesClientProps {
  businessId: string;
  businessName: string;
  tradeName?: string;
  businessTimezone: string;
  initialOrders: RestaurantOrderWithDetails[];
  initialDrivers: OperationalDeliveryDriver[];
  config: BusinessDocumentConfig;
}

export function DeliveriesClient({
  businessId,
  businessName,
  tradeName,
  businessTimezone,
  initialOrders,
  initialDrivers,
  config,
}: DeliveriesClientProps) {
  const [orders, setOrders] = useState<RestaurantOrderWithDetails[]>(initialOrders);
  const [drivers, setDrivers] = useState<OperationalDeliveryDriver[]>(initialDrivers);
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "on_the_way" | "delivered">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [isPending, startTransition] = useTransition();

  // Estados de modales
  const [isDriversModalOpen, setIsDriversModalOpen] = useState(false);
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverPhone, setNewDriverPhone] = useState("");
  const [isCreatingDriver, setIsCreatingDriver] = useState(false);

  // Modal de excepción de entrega
  const [exceptionOrder, setExceptionOrder] = useState<RestaurantOrderWithDetails | null>(null);
  const [exceptionReason, setExceptionReason] = useState("");
  const [isSubmittingException, setIsSubmittingException] = useState(false);

  // Modal de tiquete térmico
  const [ticketOrder, setTicketOrder] = useState<RestaurantOrderWithDetails | null>(null);

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return `${d.toLocaleDateString("es-CO", { timeZone: businessTimezone })} · ${d.toLocaleTimeString("es-CO", {
        timeZone: businessTimezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })}`;
    } catch {
      return iso;
    }
  };

  // Filtrado de órdenes
  const filteredOrders = orders.filter((o) => {
    if (activeTab === "pending" && !["pending", "assigned"].includes(o.delivery_status || "pending")) {
      return false;
    }
    if (activeTab === "on_the_way" && o.delivery_status !== "on_the_way") {
      return false;
    }
    if (activeTab === "delivered" && o.delivery_status !== "delivered") {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = String(o.order_number).includes(q);
      const matchAddress = o.delivery_address?.toLowerCase().includes(q) || false;
      const matchCust = o.customer_name?.toLowerCase().includes(q) || false;
      const matchPhone = o.customer_phone?.includes(q) || false;
      const matchDriver = o.driver_name?.toLowerCase().includes(q) || false;
      if (!matchNum && !matchAddress && !matchCust && !matchPhone && !matchDriver) {
        return false;
      }
    }

    return true;
  });

  // Estadísticas rápidas
  const countPending = orders.filter((o) => ["pending", "assigned"].includes(o.delivery_status || "pending")).length;
  const countOnTheWay = orders.filter((o) => o.delivery_status === "on_the_way").length;
  const countDelivered = orders.filter((o) => o.delivery_status === "delivered").length;

  // Asignar domiciliario
  const handleAssignDriver = async (orderId: string, driverName: string) => {
    if (!driverName) return;
    startTransition(async () => {
      const res = await assignDriverToOrderAction(businessId, orderId, driverName);
      if (res.success) {
        toast.success(`Domiciliario asignado: ${driverName}`);
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? { ...o, driver_name: driverName, delivery_status: "assigned" }
              : o
          )
        );
      } else {
        toast.error(res.error || "Error al asignar domiciliario");
      }
    });
  };

  // Despachar pedido
  const handleDispatch = async (order: RestaurantOrderWithDetails) => {
    startTransition(async () => {
      const res = await dispatchDeliveryOrderAction(businessId, order.id);
      if (res.success) {
        toast.success(`Pedido #${order.order_number} marcado como en camino 🛵`);
        setOrders((prev) =>
          prev.map((o) =>
            o.id === order.id ? { ...o, delivery_status: "on_the_way" } : o
          )
        );
      } else {
        toast.error(res.error || "Error al despachar pedido");
      }
    });
  };

  // Confirmar por excepción
  const handleConfirmException = async () => {
    if (!exceptionOrder) return;
    if (!exceptionReason.trim() || exceptionReason.trim().length < 4) {
      toast.error("Ingresa un motivo válido para la excepción (mínimo 4 caracteres).");
      return;
    }

    setIsSubmittingException(true);
    const res = await confirmDeliveryWithExceptionAction(
      businessId,
      exceptionOrder.id,
      exceptionReason.trim()
    );
    setIsSubmittingException(false);

    if (res.success) {
      toast.success(`Entrega confirmada por excepción para pedido #${exceptionOrder.order_number}`);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === exceptionOrder.id
            ? { ...o, delivery_status: "delivered", status: "delivered" }
            : o
        )
      );
      setExceptionOrder(null);
      setExceptionReason("");
    } else {
      toast.error(res.error || "Error al autorizar excepción.");
    }
  };

  // Crear repartidor operativo
  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriverName.trim()) return;

    setIsCreatingDriver(true);
    const res = await createOperationalDriverAction(
      businessId,
      newDriverName.trim(),
      newDriverPhone.trim() || null
    );
    setIsCreatingDriver(false);

    if (res.success && res.driver) {
      toast.success(`Domiciliario creado con PIN: ${res.driver.accessPin}`);
      setDrivers((prev) => [...prev, res.driver!]);
      setNewDriverName("");
      setNewDriverPhone("");
    } else {
      toast.error(res.error || "No se pudo crear el domiciliario.");
    }
  };

  // Activar/desactivar repartidor
  const handleToggleDriverStatus = async (driverId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    const res = await toggleDriverStatusAction(businessId, driverId, newStatus);
    if (res.success) {
      toast.success(newStatus ? "Acceso de domiciliario habilitado" : "Acceso revocado");
      setDrivers((prev) =>
        prev.map((d) => (d.id === driverId ? { ...d, isActive: newStatus } : d))
      );
    } else {
      toast.error(res.error || "Error al cambiar estado.");
    }
  };

  const copyToClipboard = (text: string, msg: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success(msg);
    }
  };

  return (
    <AppPageContainer
      title="Gestión de Domicilios y Reparto"
      description="Seguimiento de entregas, asignación de domiciliarios y códigos de verificación segura."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsDriversModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20 transition-all cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Repartidores Operativos ({drivers.filter((d) => d.isActive).length})</span>
          </button>

          <Link
            href={`/workspace/${businessId}/pedidos`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Ver todos los pedidos</span>
          </Link>
        </div>
      }
      maxWidth="6xl"
    >
      <div className="space-y-6">
        {/* TARJETAS RESUMEN DE DOMICILIOS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs">
            <span className="text-xs text-slate-500 dark:text-slate-400">Total Domicilios</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {orders.length}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs">
            <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">Por Despachar</span>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
              {countPending}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs">
            <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">En Camino 🛵</span>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
              {countOnTheWay}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Entregados</span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {countDelivered}
            </div>
          </div>
        </div>

        {/* PESTAÑAS Y BUSCADOR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#0D0F16] p-3 rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-xs">
          <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-100 dark:bg-white/5 rounded-xl">
            {[
              { id: "all", label: `Todos (${orders.length})` },
              { id: "pending", label: `Por despachar (${countPending})` },
              { id: "on_the_way", label: `En camino (${countOnTheWay})` },
              { id: "delivered", label: `Entregados (${countDelivered})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-white dark:bg-[#0D0F16] text-[#ED500A] shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar dirección, cliente, #"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* LISTADO DE PEDIDOS DE DOMICILIO */}
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] space-y-3">
            <Bike className="w-12 h-12 text-slate-300 dark:text-white/20 mx-auto" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No hay pedidos a domicilio en esta pestaña
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Los nuevos pedidos registrados con destino Domicilio en el POS o WhatsApp aparecerán automáticamente aquí.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const isDelivered = order.delivery_status === "delivered";
              const isOnTheWay = order.delivery_status === "on_the_way";
              const isPendingDispatch = !isDelivered && !isOnTheWay;
              const isPaid = order.payment_status === "paid";

              return (
                <div
                  key={order.id}
                  className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-xs p-5 space-y-4 transition-all hover:border-slate-300"
                >
                  {/* ENCABEZADO DE ORDEN */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center font-mono font-bold text-sm shrink-0">
                        #{order.order_number}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white font-mono">
                            ORD-{order.order_number}
                          </h3>

                          {/* BADGE DE ESTADO DE ENTREGA */}
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                              isDelivered
                                ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200"
                                : isOnTheWay
                                ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200"
                                : "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200"
                            }`}
                          >
                            {isDelivered
                              ? "Entregado"
                              : isOnTheWay
                              ? "En Camino 🛵"
                              : order.driver_name
                              ? "Asignado"
                              : "Listo para Despacho"}
                          </span>

                          {/* BADGE DE PAGO (SEPARADO DE LA ENTREGA) */}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              isPaid
                                ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 dark:bg-amber-500/10 text-amber-800 border-amber-200"
                            }`}
                          >
                            {isPaid ? "PAGADO" : "COBRAR AL CLIENTE"}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {formatDate(order.created_at)}
                        </p>
                      </div>
                    </div>

                    {/* VALOR Y ACCIONES RÁPIDAS */}
                    <div className="sm:text-right flex sm:flex-col justify-between items-center sm:items-end gap-1">
                      <span className="text-xs text-slate-400">Total del pedido</span>
                      <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                        {formatCOP(order.total)}
                      </span>
                    </div>
                  </div>

                  {/* DATOS DE ENTREGA Y CÓDIGO DE VERIFICACIÓN */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/70 dark:bg-white/[0.02] p-4 rounded-xl border border-slate-200/80 dark:border-white/5">
                    {/* DIRECCIÓN Y CLIENTE */}
                    <div className="space-y-1.5 md:col-span-2">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-[#ED500A] shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            {order.delivery_address || "Sin dirección especificada"}
                          </p>
                          {order.delivery_reference && (
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 italic mt-0.5">
                              Ref: {order.delivery_reference}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-600 dark:text-slate-400">
                        {order.customer_name && (
                          <div className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{order.customer_name}</span>
                          </div>
                        )}

                        {order.customer_phone && (
                          <div className="flex items-center gap-2">
                            <a
                              href={`tel:${order.customer_phone}`}
                              className="flex items-center gap-1 font-semibold text-blue-600 hover:underline"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{order.customer_phone}</span>
                            </a>

                            <a
                              href={`https://wa.me/57${order.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                                `Hola! Tu pedido #${order.order_number} de ${
                                  tradeName || businessName
                                } va en camino a ${order.delivery_address}. Tu código de entrega es: ${
                                  order.delivery_verification_code || ""
                                }`
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold hover:opacity-90"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>WhatsApp</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* BLOQUE DESTACADO: CÓDIGO DE VERIFICACIÓN */}
                    <div className="p-3 bg-white dark:bg-[#0D0F16] rounded-xl border border-slate-200 dark:border-white/[0.08] flex flex-col justify-between gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Código de Entrega</span>
                        </span>
                        {order.delivery_verification_attempts && order.delivery_verification_attempts > 0 ? (
                          <span className="text-[9px] text-amber-600 font-semibold">
                            {order.delivery_verification_attempts}/5 intentos
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="text-2xl font-black font-mono tracking-widest text-[#ED500A]">
                          {order.delivery_verification_code || "----"}
                        </div>

                        {order.delivery_verification_code && (
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                order.delivery_verification_code || "",
                                "Código de verificación copiado al portapapeles."
                              )
                            }
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 transition-colors"
                            title="Copiar código"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <p className="text-[10px] text-slate-500 leading-tight">
                        El destinatario debe comunicar este código al domiciliario al recibir.
                      </p>
                    </div>
                  </div>

                  {/* RESUMEN DE PRODUCTOS DE LA COMANDA */}
                  <div className="text-xs space-y-1">
                    <span className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider">
                      Detalle del pedido ({order.itemsCount} productos):
                    </span>
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {order.items?.map((it, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-medium"
                        >
                          <strong>{it.quantity}x</strong> {it.product_name}
                        </span>
                      ))}
                    </div>
                    {order.notes && (
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 p-2 rounded-lg mt-1 italic">
                        Observación: {order.notes}
                      </p>
                    )}
                  </div>

                  {/* BARRA DE ASIGNACIÓN Y ACCIONES */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-white/5">
                    {/* Selector / Asignación de Domiciliario */}
                    <div className="flex items-center gap-2 min-w-[200px]">
                      <span className="text-xs text-slate-500">Repartidor:</span>
                      <select
                        disabled={isPending || isDelivered}
                        value={order.driver_name || ""}
                        onChange={(e) => handleAssignDriver(order.id, e.target.value)}
                        className="text-xs font-semibold bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl px-2.5 py-1.5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 cursor-pointer"
                      >
                        <option value="">-- Sin asignar --</option>
                        {drivers
                          .filter((d) => d.isActive)
                          .map((d) => (
                            <option key={d.id} value={d.name}>
                              {d.name}
                            </option>
                          ))}
                        {order.driver_name &&
                          !drivers.some((d) => d.name === order.driver_name) && (
                            <option value={order.driver_name}>{order.driver_name}</option>
                          )}
                      </select>
                    </div>

                    {/* Botones de acción del pedido */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Botón Imprimir Comanda Térmica */}
                      <button
                        type="button"
                        onClick={() => setTicketOrder(order)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Imprimir Tiquete</span>
                      </button>

                      {/* Botón Marcar En Camino / Despachar */}
                      {!isDelivered && !isOnTheWay && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleDispatch(order)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#ED500A] hover:bg-[#ED500A]/90 text-white shadow-xs transition-all cursor-pointer"
                        >
                          <Bike className="w-3.5 h-3.5" />
                          <span>Despachar (En camino)</span>
                        </button>
                      )}

                      {/* Botón Confirmar Excepción (cuando el cliente extravió el código) */}
                      {!isDelivered && (
                        <button
                          type="button"
                          onClick={() => {
                            setExceptionOrder(order);
                            setExceptionReason("");
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                          title="Autorizar entrega si el cliente no tiene código"
                        >
                          <span>Excepción</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MODAL GESTIÓN DE REPARTIDORES OPERATIVOS (SIN CONSUMIR ASIENTOS) */}
        {isDriversModalOpen && (
          <ModalPortal>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 m-0 animate-in fade-in">
              <div className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between bg-slate-50 dark:bg-white/[0.02]">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-xl">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Repartidores Operativos
                      </h3>
                      <p className="text-xs text-slate-500">
                        Acceso exclusivo a entregas por PIN • No consume cupos de tu plan
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDriversModalOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg"
                  >
                    ×
                  </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                  {/* FORMULARIO PARA CREAR REPARTIDOR */}
                  <form onSubmit={handleCreateDriver} className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Registrar Nuevo Domiciliario
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Nombre del repartidor *
                        </label>
                        <input
                          type="text"
                          required
                          value={newDriverName}
                          onChange={(e) => setNewDriverName(e.target.value)}
                          placeholder="Ej. Carlos Domicilios"
                          className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Teléfono celular (Opcional)
                        </label>
                        <input
                          type="tel"
                          value={newDriverPhone}
                          onChange={(e) => setNewDriverPhone(e.target.value)}
                          placeholder="Ej. 310 123 4567"
                          className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isCreatingDriver || !newDriverName.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isCreatingDriver ? "Generando PIN..." : "Generar Acceso con PIN"}</span>
                    </button>
                  </form>

                  {/* LISTA DE REPARTIDORES EXISTENTES */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Domiciliarios Activos ({drivers.length})
                    </h4>

                    {drivers.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">
                        Aún no tienes repartidores operativos registrados.
                      </p>
                    ) : (
                      drivers.map((d) => (
                        <div
                          key={d.id}
                          className="p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#0D0F16]"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900 dark:text-white">
                                {d.name}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  d.isActive
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-rose-50 text-rose-700 border border-rose-200"
                                }`}
                              >
                                {d.isActive ? "Activo" : "Revocado"}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              <span className="font-mono bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded text-slate-800 dark:text-slate-200 font-bold">
                                PIN: {d.accessPin}
                              </span>
                              {d.phone && <span>Tel: {d.phone}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Copiar enlace móvil directo para el repartidor */}
                            <button
                              type="button"
                              onClick={() => {
                                const origin = typeof window !== "undefined" ? window.location.origin : "";
                                const url = `${origin}/reparto/${businessId}?pin=${d.accessPin}`;
                                copyToClipboard(url, "Enlace directo para el repartidor copiado.");
                              }}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors"
                              title="Copiar enlace móvil"
                            >
                              Copiar enlace
                            </button>

                            {/* Revocar o Habilitar */}
                            <button
                              type="button"
                              onClick={() => handleToggleDriverStatus(d.id, d.isActive)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                d.isActive
                                  ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                              }`}
                            >
                              {d.isActive ? "Revocar PIN" : "Reactivar"}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02] flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsDriversModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </ModalPortal>
        )}

        {/* MODAL DE CONFIRMACIÓN DE ENTREGA POR EXCEPCIÓN */}
        {exceptionOrder && (
          <ModalPortal>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 m-0 animate-in fade-in">
              <div className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                <div className="flex items-center gap-2.5 text-amber-600">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Confirmar Entrega por Excepción
                  </h3>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Utiliza este procedimiento cuando el destinatario haya extraviado su código o no pueda comunicarlo verbalmente. Esta acción quedará registrada en el log de auditoría.
                </p>

                <div className="p-3 bg-slate-50 dark:bg-white/[0.02] rounded-xl text-xs space-y-1 font-mono">
                  <div>Pedido: #{exceptionOrder.order_number}</div>
                  <div>Destinatario: {exceptionOrder.customer_name || "Cliente mostrador"}</div>
                  <div>Dirección: {exceptionOrder.delivery_address}</div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Motivo de la excepción *
                  </label>
                  <textarea
                    rows={2}
                    value={exceptionReason}
                    onChange={(e) => setExceptionReason(e.target.value)}
                    placeholder="Ej. Cliente recibió personalmente, código no recibido por falla telefónica..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setExceptionOrder(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    disabled={isSubmittingException || exceptionReason.trim().length < 4}
                    onClick={handleConfirmException}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs disabled:opacity-50"
                  >
                    {isSubmittingException ? "Registrando..." : "Autorizar Entrega"}
                  </button>
                </div>
              </div>
            </div>
          </ModalPortal>
        )}

        {/* MODAL DE TIQUETE TÉRMICO */}
        {ticketOrder && (
          <ThermalTicketModal
            documentNumber={`ORD-${ticketOrder.order_number}`}
            issuedAt={ticketOrder.created_at}
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
            orderType="delivery"
            customer={{
              name: ticketOrder.customer_name,
              phone: ticketOrder.customer_phone,
              address: ticketOrder.delivery_address,
              deliveryReference: ticketOrder.delivery_reference,
            }}
            items={
              ticketOrder.items?.map((it) => ({
                description: it.product_name,
                quantity: it.quantity,
                unitPrice: it.unit_price,
                total: it.subtotal,
                notes: it.notes,
                modifiers: it.modifiers,
              })) || []
            }
            subtotal={ticketOrder.subtotal}
            deliveryFee={ticketOrder.delivery_fee}
            total={ticketOrder.total}
            paymentMethod="cash"
            paymentStatus={ticketOrder.payment_status}
            notes={ticketOrder.notes}
            thankYouNote={config?.thankYouNote}
            documentObservations={config?.documentObservations}
            footerText={config?.footerText}
            headerText={config?.headerText}
            defaultPaperWidth={config?.paperWidth || "80mm"}
            isOpen={Boolean(ticketOrder)}
            onClose={() => setTicketOrder(null)}
          />
        )}
      </div>
    </AppPageContainer>
  );
}
