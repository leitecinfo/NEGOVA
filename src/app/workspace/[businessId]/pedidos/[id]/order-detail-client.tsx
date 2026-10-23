"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UtensilsCrossed,
  ArrowLeft,
  Clock,
  ChefHat,
  CheckCircle2,
  PackageCheck,
  XCircle,
  Calendar,
  Store,
  MessageSquare,
  Bike,
  ShoppingBag,
  Printer,
  Sparkles,
  Phone,
  MapPin,
  FileText,
  AlertTriangle,
  Receipt,
  DollarSign,
  Banknote,
  CreditCard,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { AdminConfirmDialog } from "@/components/admin/ui";
import {
  RestaurantOrderWithDetails,
  VALID_ORDER_STATUS_TRANSITIONS,
} from "@/lib/restaurant/types";
import { BusinessDocumentConfig } from "@/lib/documents/types";
import { PublicPaymentMethodDTO } from "@/lib/payments/types";
import { OrderPaymentModal } from "@/components/payments/order-payment-modal";
import { ThermalTicketModal } from "@/components/printing/thermal-ticket";
import {
  updateRestaurantOrderStatusAction,
  cancelRestaurantOrderAction,
  registerRestaurantOrderPaymentAction,
} from "../actions";

interface OrderDetailClientProps {
  businessId: string;
  businessName: string;
  tradeName?: string;
  businessTimezone: string;
  initialOrder: RestaurantOrderWithDetails;
  config?: BusinessDocumentConfig;
  paymentMethods?: PublicPaymentMethodDTO[];
  canUpdateOrder: boolean;
  canCancelOrder: boolean;
  canRegisterPayment?: boolean;
}

export function OrderDetailClient({
  businessId,
  businessName,
  tradeName,
  businessTimezone,
  initialOrder,
  config,
  paymentMethods = [],
  canUpdateOrder,
  canCancelOrder,
  canRegisterPayment = false,
}: OrderDetailClientProps) {
  const router = useRouter();
  const [order, setOrder] = useState<RestaurantOrderWithDetails>(initialOrder);
  const [isPending, startTransition] = useTransition();

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);

  const handleConfirmPayment = async (method: string) => {
    setIsPaymentSubmitting(true);
    try {
      const res = await registerRestaurantOrderPaymentAction(businessId, order.id, method);
      if (res.success) {
        toast.success(`Pago registrado correctamente para el pedido #${order.order_number}`);
        setOrder((prev) => ({ ...prev, payment_status: "paid" }));
        setPaymentModalOpen(false);
        startTransition(() => {
          router.refresh();
        });
      } else {
        toast.error(res.error || "No se pudo registrar el cobro.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al registrar el cobro.");
    } finally {
      setIsPaymentSubmitting(false);
    }
  };

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("es-CO", {
        timeZone: businessTimezone,
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const getOrderStatusConfig = (status: string) => {
    switch (status) {
      case "received":
        return {
          label: "Recibido",
          icon: Clock,
          color: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20",
          description: "La orden fue registrada y está a la espera de preparación.",
        };
      case "in_preparation":
        return {
          label: "En preparación",
          icon: ChefHat,
          color: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
          description: "La orden se encuentra actualmente en cocina o barra de elaboración.",
        };
      case "ready":
        return {
          label: "Listo",
          icon: CheckCircle2,
          color: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
          description: "La orden está cocinada y lista para ser servida en mesa o empacada.",
        };
      case "delivered":
        return {
          label: "Entregado",
          icon: PackageCheck,
          color: "bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/[0.08]",
          description: "La orden fue despachada y entregada al cliente.",
        };
      case "cancelled":
        return {
          label: "Cancelado",
          icon: XCircle,
          color: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20",
          description: "Esta comanda fue anulada operativamente.",
        };
      default:
        return {
          label: status,
          icon: Clock,
          color: "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/[0.08]",
          description: "Estado de la comanda.",
        };
    }
  };

  const getOrderTypeConfig = (type: string, tableName?: string | null) => {
    switch (type) {
      case "dine_in":
        return {
          label: tableName ? `Consumo en Mesa: ${tableName}` : "Consumo en Mesa",
          icon: UtensilsCrossed,
          color: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20",
        };
      case "takeout":
        return {
          label: "Para llevar (Recogida)",
          icon: ShoppingBag,
          color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20",
        };
      case "delivery":
        return {
          label: "Entrega a Domicilio",
          icon: Bike,
          color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20",
        };
      default:
        return {
          label: type,
          icon: UtensilsCrossed,
          color: "text-slate-600 bg-slate-50 border-slate-200",
        };
    }
  };

  const getChannelConfig = (channel: string) => {
    switch (channel) {
      case "in_person":
        return { label: "Presencial / Mostrador", icon: Store };
      case "whatsapp":
        return { label: "WhatsApp", icon: MessageSquare };
      case "digital_menu":
        return { label: "Menú Digital QR", icon: Sparkles };
      default:
        return { label: channel, icon: Store };
    }
  };

  const getPaymentStatusConfig = (payStatus: string) => {
    switch (payStatus) {
      case "paid":
        return {
          label: "Pagado",
          color: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
          subtext: "Cobro completado.",
        };
      case "partial":
        return {
          label: "Parcialmente pagado",
          color: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
          subtext: "Resta un saldo por cobrar.",
        };
      case "pending":
      default:
        return {
          label: "Pendiente de pago",
          color: "bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/[0.08]",
          subtext: "El pago aún no ha sido registrado.",
        };
    }
  };

  const handleStatusTransition = async (targetStatus: string) => {
    if (!canUpdateOrder) {
      toast.error("No tienes permisos para modificar el estado de pedidos.");
      return;
    }

    startTransition(async () => {
      const res = await updateRestaurantOrderStatusAction(businessId, order.id, targetStatus);
      if (res.success && res.order) {
        setOrder(res.order);
        toast.success(`Pedido #${order.order_number} actualizado a '${getOrderStatusConfig(targetStatus).label}'.`);
        router.refresh();
      } else {
        toast.error(res.error || "No se pudo actualizar el estado del pedido.");
      }
    });
  };

  const handleConfirmCancel = async () => {
    setIsCancelModalOpen(false);
    startTransition(async () => {
      const res = await cancelRestaurantOrderAction(businessId, order.id);
      if (res.success) {
        toast.success(`Pedido #${order.order_number} cancelado correctamente.`);
        setOrder((prev) => ({ ...prev, status: "cancelled" }));
        router.refresh();
      } else {
        toast.error(res.error || "No se pudo cancelar el pedido.");
      }
    });
  };

  const statusConfig = getOrderStatusConfig(order.status);
  const StatusIcon = statusConfig.icon;
  const typeConfig = getOrderTypeConfig(order.order_type, order.tableName);
  const TypeIcon = typeConfig.icon;
  const channelConfig = getChannelConfig(order.channel_origin);
  const ChannelIcon = channelConfig.icon;
  const paymentConfig = getPaymentStatusConfig(order.payment_status);

  const allowedTransitions = VALID_ORDER_STATUS_TRANSITIONS[order.status] || [];

  return (
    <AppPageContainer
      title={`Pedido #${order.order_number}`}
      description={`Comanda registrada en ${businessName} el ${formatDate(order.created_at)}.`}
      badge={
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusConfig.color}`}>
          <StatusIcon className="w-3.5 h-3.5" />
          <span>{statusConfig.label}</span>
        </span>
      }
      actions={
        <div className="flex items-center gap-2">
          <Link
            href={`/workspace/${businessId}/pedidos`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver a Pedidos</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsTicketModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20 transition-colors cursor-pointer"
            title="Imprimir tiquete térmico"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Imprimir Tiquete</span>
          </button>
        </div>
      }
      maxWidth="6xl"
    >
      <div className="space-y-6 font-body">
        {/* 1. FLUJO DE TRANSICIONES OPERATIVAS DISPONIBLES */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <StatusIcon className="w-4 h-4 text-[#ED500A]" />
                <span>Estado Operativo: {statusConfig.label}</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {statusConfig.description}
              </p>
            </div>

            {/* BOTONES DE TRANSICIÓN */}
            {canUpdateOrder && allowedTransitions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {allowedTransitions.includes("in_preparation") && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleStatusTransition("in_preparation")}
                      disabled={isPending}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmar Pedido (A Cocina)</span>
                    </button>

                    {canCancelOrder && (
                      <button
                        type="button"
                        onClick={() => setIsCancelModalOpen(true)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                        <span>Rechazar Pedido</span>
                      </button>
                    )}
                  </>
                )}

                {allowedTransitions.includes("ready") && (
                  <button
                    type="button"
                    onClick={() => handleStatusTransition("ready")}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Marcar como Listo</span>
                  </button>
                )}

                {allowedTransitions.includes("delivered") && (
                  <button
                    type="button"
                    onClick={() => handleStatusTransition("delivered")}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#ED500A] hover:bg-[#D44405] text-white shadow-xs transition-colors disabled:opacity-50"
                  >
                    <PackageCheck className="w-4 h-4" />
                    <span>Marcar como Entregado</span>
                  </button>
                )}

                {canCancelOrder && allowedTransitions.includes("cancelled") && (
                  <button
                    type="button"
                    onClick={() => setIsCancelModalOpen(true)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-rose-300 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Cancelar Pedido</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 2. GRILLA PRINCIPAL: DETALLE DE ARTÍCULOS (IZQUIERDA) + INFO GENERAL Y PAGO (DERECHA) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* COLUMNA IZQUIERDA: PRODUCTOS Y LÍNEAS DE LA COMANDA */}
          <div className="lg:col-span-7 xl:col-span-7 space-y-6">
            <div className="rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center font-bold">
                    <UtensilsCrossed className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Artículos de la Comanda
                    </h4>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {order.items?.length || 0} líneas registradas
                    </span>
                  </div>
                </div>
              </div>

              {/* LISTADO DE ITEMS */}
              <div className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {(order.items || []).map((item, idx) => {
                  const mods: any[] = Array.isArray(item.modifiers) ? item.modifiers : [];

                  return (
                    <div key={item.id || idx} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center font-mono">
                              {item.quantity}x
                            </span>
                            <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                              {item.product_name}
                            </h5>
                          </div>

                          {/* MODIFICADORES CONGELADOS */}
                          {mods.length > 0 && (
                            <div className="space-y-0.5 mt-1.5 pl-8 text-xs text-slate-500 dark:text-slate-400">
                              {mods.map((m: any, mIdx: number) => (
                                <div key={mIdx} className="flex items-center gap-1.5">
                                  <span className="text-slate-400">•</span>
                                  <span>{m.optionName || m.option_name || m.name}</span>
                                  {Number(m.price || 0) > 0 && (
                                    <span className="text-slate-600 dark:text-slate-300 font-mono font-medium">
                                      (+{formatCOP(Number(m.price))})
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* NOTAS ESPECÍFICAS DE PREPARACIÓN */}
                          {item.notes && (
                            <div className="mt-1.5 pl-8 text-xs italic text-amber-700 dark:text-amber-400 bg-amber-50/70 dark:bg-amber-500/10 p-1.5 rounded-lg border border-amber-200/50 dark:border-amber-500/20 inline-block">
                              «{item.notes}»
                            </div>
                          )}
                        </div>

                        {/* PRECIO UNITARIO Y TOTAL LÍNEA */}
                        <div className="text-right shrink-0">
                          <span className="text-xs text-slate-400 block font-mono">
                            {formatCOP(item.unit_price)} c/u
                          </span>
                          <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                            {formatCOP(item.subtotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* OBSERVACIONES GENERALES */}
              {order.notes && (
                <div className="p-4 bg-slate-50/70 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>Instrucciones generales del pedido:</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-[#0D0F16] p-2.5 rounded-xl border border-slate-200/60 dark:border-white/5 leading-relaxed">
                    {order.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* COLUMNA DERECHA: DESTINO, CLIENTE Y RESUMEN FINANCIERO */}
          <div className="lg:col-span-5 xl:col-span-5 space-y-5">
            {/* 3. CARD DE DATOS DE ENTREGA */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-white/5">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono whitespace-nowrap">
                  Datos de Entrega
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border shrink-0 whitespace-nowrap self-start sm:self-auto ${typeConfig.color}`}>
                  <TypeIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">{typeConfig.label}</span>
                </span>
              </div>

              <div className="space-y-3 text-xs">
                {/* Detalle del destino según tipo de comanda */}
                {order.order_type === "dine_in" && (
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                      <UtensilsCrossed className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-mono">Ubicación asignada</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                        {order.tableName ? `Mesa: ${order.tableName}` : "Salón principal"}
                      </span>
                    </div>
                  </div>
                )}

                {order.order_type === "delivery" && order.delivery_address && (
                  <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 space-y-1">
                    <span className="text-[10px] text-slate-400 block font-mono">Dirección de entrega</span>
                    <div className="flex items-start gap-2 text-slate-700 dark:text-slate-300 mt-0.5">
                      <MapPin className="w-4 h-4 text-[#ED500A] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                          {order.delivery_address}
                        </p>
                        {order.delivery_reference && (
                          <p className="text-[11px] text-slate-400 mt-1">
                            Ref: {order.delivery_reference}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {order.order_type === "takeout" && (
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-mono">Modalidad</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                        Para llevar (Recogida en mostrador)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 4. CARD DE DATOS DEL PEDIDO */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-4">
              <div className="pb-3 border-b border-slate-100 dark:border-white/5">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono whitespace-nowrap">
                  Datos del Pedido
                </span>
              </div>

              <div className="space-y-3 text-xs">
                {/* Canal de origen */}
                <div>
                  <span className="text-[10px] text-slate-400 block font-mono">Canal de origen</span>
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    <ChannelIcon className="w-3.5 h-3.5 text-[#ED500A]" />
                    <span>{channelConfig.label}</span>
                  </div>
                </div>

                {/* Cliente */}
                <div className="pt-2 border-t border-slate-100 dark:border-white/5">
                  <span className="text-[10px] text-slate-400 block font-mono">Cliente</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm block mt-0.5">
                    {order.customer_name || "Cliente mostrador"}
                  </span>
                  {order.customer_phone && (
                    <div className="flex items-center gap-1 text-slate-500 font-mono mt-0.5">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{order.customer_phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 5. CARD DE INFORMACIÓN DEL PAGO */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono whitespace-nowrap">
                  Información del Pago
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold border whitespace-nowrap ${paymentConfig.color}`}>
                  {paymentConfig.label}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {formatCOP(order.subtotal)}
                  </span>
                </div>

                {order.delivery_fee > 0 && (
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Domicilio</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {formatCOP(order.delivery_fee)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-base font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200/80 dark:border-white/[0.08]">
                  <span>Total Pedido</span>
                  <span className="text-[#ED500A] font-mono">{formatCOP(order.total)}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/5 text-[11px] text-slate-500 space-y-1">
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  Estado del cobro: {paymentConfig.label}
                </p>
                <p>
                  {order.payment_status === "paid"
                    ? "El pago ha sido registrado y conciliado con la orden."
                    : "El cobro puede registrarse aquí o conciliarse como comprobante fiscal en Ventas / POS."}
                </p>
              </div>

              {/* BOTÓN REGISTRAR COBRO SI ESTÁ PENDIENTE */}
              {order.payment_status === "pending" && order.status !== "cancelled" && canRegisterPayment && (
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-xs transition-colors cursor-pointer"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Registrar Cobro</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* MODAL PARA REGISTRAR PAGO CON MÉTODOS CONFIGURADOS */}
        <OrderPaymentModal
          isOpen={paymentModalOpen}
          order={order}
          paymentMethods={paymentMethods}
          isSubmitting={isPaymentSubmitting}
          onClose={() => setPaymentModalOpen(false)}
          onConfirm={handleConfirmPayment}
          formatCOP={formatCOP}
        />

        {/* MODAL DE CONFIRMACIÓN DE CANCELACIÓN */}
        <AdminConfirmDialog
          isOpen={isCancelModalOpen}
          onClose={() => setIsCancelModalOpen(false)}
          onConfirm={handleConfirmCancel}
          title="¿Confirmar cancelación de la comanda?"
          description={`El pedido #${order.order_number} será cancelado operativamente. Esta acción no se puede deshacer.`}
          confirmLabel="Sí, Cancelar Comanda"
          variant="destructive"
          isLoading={isPending}
          itemDetails={[
            { label: "Número de Pedido", value: `#${order.order_number}` },
            { label: "Destino", value: typeConfig.label },
            { label: "Total", value: formatCOP(order.total) },
          ]}
        />

        {/* MODAL DE TIQUETE TÉRMICO (58mm / 80mm) */}
        <ThermalTicketModal
          documentNumber={`ORD-${order.order_number}`}
          issuedAt={order.created_at}
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
          orderType={order.order_type}
          tableName={order.tableName || undefined}
          customer={{
            name: order.customer_name,
            phone: order.customer_phone,
            address: order.delivery_address,
            deliveryReference: order.delivery_reference,
          }}
          items={
            order.items?.map((it) => ({
              description: it.product_name,
              quantity: it.quantity,
              unitPrice: it.unit_price,
              total: it.subtotal,
              notes: it.notes,
              modifiers: it.modifiers,
            })) || []
          }
          subtotal={order.subtotal}
          deliveryFee={order.delivery_fee}
          total={order.total}
          paymentMethod="cash"
          paymentStatus={order.payment_status}
          notes={order.notes}
          thankYouNote={config?.thankYouNote}
          documentObservations={config?.documentObservations}
          footerText={config?.footerText}
          headerText={config?.headerText}
          defaultPaperWidth={config?.paperWidth || "80mm"}
          isOpen={isTicketModalOpen}
          onClose={() => setIsTicketModalOpen(false)}
        />
      </div>
    </AppPageContainer>
  );
}
