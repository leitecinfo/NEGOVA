"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  UtensilsCrossed,
  Clock,
  ChefHat,
  CheckCircle2,
  PackageCheck,
  XCircle,
  Calendar,
  ArrowRight,
  RotateCcw,
  Bike,
  Store,
  MessageSquare,
  ShoppingBag,
  Layers,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { AppPageContainer } from "@/components/layout/app-page-container";
import {
  AdminDataTable,
  AdminDataTableColumn,
  AdminTableToolbar,
  AdminSelect,
  AdminPagination,
  AdminEmptyState,
  AdminKpiGrid,
  AdminKpiCard,
  AdminConfirmDialog,
} from "@/components/admin/ui";
import {
  RestaurantOrderWithDetails,
  RestaurantOrdersListResult,
  RestaurantOrdersSummary,
  VALID_ORDER_STATUS_TRANSITIONS,
} from "@/lib/restaurant/types";
import {
  updateRestaurantOrderStatusAction,
  cancelRestaurantOrderAction,
} from "./actions";

interface OrdersListClientProps {
  businessId: string;
  businessName: string;
  businessTimezone: string;
  initialData: RestaurantOrdersListResult;
  summary: RestaurantOrdersSummary;
  canUpdateOrder: boolean;
  canCancelOrder: boolean;
  filters: {
    search: string;
    status: string;
    paymentStatus: string;
    orderType: string;
    channelOrigin: string;
    startDate: string;
    endDate: string;
  };
}

export function OrdersListClient({
  businessId,
  businessName,
  businessTimezone,
  initialData,
  summary,
  canUpdateOrder,
  canCancelOrder,
  filters,
}: OrdersListClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(filters.search);
  const [status, setStatus] = useState(filters.status);
  const [paymentStatus, setPaymentStatus] = useState(filters.paymentStatus);
  const [orderType, setOrderType] = useState(filters.orderType);
  const [channelOrigin, setChannelOrigin] = useState(filters.channelOrigin);
  const [startDate, setStartDate] = useState(filters.startDate);
  const [endDate, setEndDate] = useState(filters.endDate);

  // Modal de confirmación para cancelar pedido
  const [cancelModal, setCancelModal] = useState<{
    isOpen: boolean;
    order: RestaurantOrderWithDetails | null;
  }>({
    isOpen: false,
    order: null,
  });

  const applyFilters = (newParams: Record<string, string>) => {
    startTransition(() => {
      const params = new URLSearchParams();
      const current = {
        search,
        status,
        paymentStatus,
        orderType,
        channelOrigin,
        startDate,
        endDate,
        page: "1",
        ...newParams,
      };

      if (current.search.trim()) params.set("search", current.search.trim());
      if (current.status && current.status !== "all") params.set("status", current.status);
      if (current.paymentStatus && current.paymentStatus !== "all") params.set("paymentStatus", current.paymentStatus);
      if (current.orderType && current.orderType !== "all") params.set("orderType", current.orderType);
      if (current.channelOrigin && current.channelOrigin !== "all") params.set("channelOrigin", current.channelOrigin);
      if (current.startDate) params.set("startDate", current.startDate);
      if (current.endDate) params.set("endDate", current.endDate);
      if (current.page && current.page !== "1") params.set("page", current.page);

      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters({ search });
  };

  const handleClearFilters = () => {
    setSearch("");
    setStatus("all");
    setPaymentStatus("all");
    setOrderType("all");
    setChannelOrigin("all");
    setStartDate("");
    setEndDate("");
    startTransition(() => {
      router.push(pathname);
    });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > initialData.totalPages) return;
    applyFilters({ page: String(newPage) });
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
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  // Badges y utilidades de estado operativo
  const getOrderStatusBadge = (orderStatus: string) => {
    switch (orderStatus) {
      case "received":
        return {
          label: "Recibido",
          icon: Clock,
          color: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20",
          nextAction: { targetStatus: "in_preparation", label: "Preparar" },
        };
      case "in_preparation":
        return {
          label: "En preparación",
          icon: ChefHat,
          color: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
          nextAction: { targetStatus: "ready", label: "Listo" },
        };
      case "ready":
        return {
          label: "Listo",
          icon: CheckCircle2,
          color: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
          nextAction: { targetStatus: "delivered", label: "Entregar" },
        };
      case "delivered":
        return {
          label: "Entregado",
          icon: PackageCheck,
          color: "bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10",
          nextAction: null,
        };
      case "cancelled":
        return {
          label: "Cancelado",
          icon: XCircle,
          color: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20",
          nextAction: null,
        };
      default:
        return {
          label: orderStatus,
          icon: Clock,
          color: "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10",
          nextAction: null,
        };
    }
  };

  // Badges de Destino / Tipo de Orden
  const getOrderTypeBadge = (type: string, tableName?: string | null) => {
    switch (type) {
      case "dine_in":
        return {
          label: tableName ? `Mesa: ${tableName}` : "En mesa",
          icon: UtensilsCrossed,
          color: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20",
        };
      case "takeout":
        return {
          label: "Para llevar",
          icon: ShoppingBag,
          color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20",
        };
      case "delivery":
        return {
          label: "Domicilio",
          icon: Bike,
          color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20",
        };
      default:
        return {
          label: type,
          icon: Layers,
          color: "text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/20",
        };
    }
  };

  // Badges de Canal de Origen
  const getChannelBadge = (channel: string) => {
    switch (channel) {
      case "in_person":
        return { label: "Presencial", icon: Store, color: "text-slate-600 dark:text-slate-300" };
      case "whatsapp":
        return { label: "WhatsApp", icon: MessageSquare, color: "text-emerald-600 dark:text-emerald-400" };
      case "digital_menu":
        return { label: "Menú Digital", icon: Sparkles, color: "text-[#ED500A]" };
      default:
        return { label: channel, icon: Store, color: "text-slate-500" };
    }
  };

  // Badges de Estado de Pago
  const getPaymentStatusBadge = (payStatus: string) => {
    switch (payStatus) {
      case "paid":
        return {
          label: "Pagado",
          color: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
        };
      case "partial":
        return {
          label: "Parcial",
          color: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
        };
      case "pending":
      default:
        return {
          label: "Pendiente",
          color: "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10",
        };
    }
  };

  // Transición rápida de estado
  const handleQuickStatusTransition = async (order: RestaurantOrderWithDetails, targetStatus: string) => {
    if (!canUpdateOrder) {
      toast.error("No tienes permisos para modificar el estado de pedidos.");
      return;
    }

    startTransition(async () => {
      const res = await updateRestaurantOrderStatusAction(businessId, order.id, targetStatus);
      if (res.success) {
        toast.success(`Pedido #${order.order_number} actualizado exitosamente.`);
        router.refresh();
      } else {
        toast.error(res.error || "No se pudo actualizar el estado del pedido.");
      }
    });
  };

  // Confirmar cancelación
  const handleConfirmCancel = async () => {
    if (!cancelModal.order) return;
    const order = cancelModal.order;
    setCancelModal({ isOpen: false, order: null });

    startTransition(async () => {
      const res = await cancelRestaurantOrderAction(businessId, order.id);
      if (res.success) {
        toast.success(`Pedido #${order.order_number} cancelado correctamente.`);
        router.refresh();
      } else {
        toast.error(res.error || "No se pudo cancelar el pedido.");
      }
    });
  };

  const hasActiveFilters = Boolean(
    filters.search ||
    (filters.status && filters.status !== "all") ||
    (filters.paymentStatus && filters.paymentStatus !== "all") ||
    (filters.orderType && filters.orderType !== "all") ||
    (filters.channelOrigin && filters.channelOrigin !== "all") ||
    filters.startDate ||
    filters.endDate
  );

  return (
    <AppPageContainer
      title="Gestión de Pedidos"
      description={`Control operativo de comandas, preparación y despacho en ${businessName}.`}
      badge={
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20">
          <UtensilsCrossed className="w-3.5 h-3.5" />
          Operación de Cocina & Salón
        </span>
      }
      maxWidth="6xl"
    >
      <div className="space-y-6 font-body">
        {/* 1. INDICADORES RESUMIDOS DE PEDIDOS (KPIs) */}
        <AdminKpiGrid cols={4}>
          <AdminKpiCard
            title="Total Pedidos"
            value={summary.total}
            subtext="Comandas registradas"
            icon={<UtensilsCrossed className="w-4 h-4" />}
            variant="blue"
            isSelected={status === "all"}
            onClick={() => {
              setStatus("all");
              applyFilters({ status: "all" });
            }}
          />

          <AdminKpiCard
            title="Recibidos"
            value={summary.received}
            subtext="Pendientes de cocción"
            icon={<Clock className="w-4 h-4" />}
            variant="purple"
            isSelected={status === "received"}
            onClick={() => {
              setStatus("received");
              applyFilters({ status: "received" });
            }}
          />

          <AdminKpiCard
            title="En Preparación"
            value={summary.inPreparation}
            subtext="En cocina o barra"
            icon={<ChefHat className="w-4 h-4" />}
            variant="amber"
            isSelected={status === "in_preparation"}
            onClick={() => {
              setStatus("in_preparation");
              applyFilters({ status: "in_preparation" });
            }}
          />

          <AdminKpiCard
            title="Listos"
            value={summary.ready}
            subtext="Para servir o despachar"
            icon={<CheckCircle2 className="w-4 h-4" />}
            variant="emerald"
            isSelected={status === "ready"}
            onClick={() => {
              setStatus("ready");
              applyFilters({ status: "ready" });
            }}
          />
        </AdminKpiGrid>

        {/* 2. BARRA DE HERRAMIENTAS: BÚSQUEDA Y FILTROS ESTANDARIZADOS */}
        <AdminTableToolbar
          layout="stacked"
          searchQuery={search}
          onSearchChange={setSearch}
          onSearchSubmit={handleSearchSubmit}
          searchPlaceholder="Buscar por # (1001) o cliente..."
          onRefresh={() => router.refresh()}
          onClearSearch={() => {
            setSearch("");
            applyFilters({ search: "" });
          }}
          isPending={isPending}
          filters={
            <>
              {/* Filtro de Estado Operativo */}
              <AdminSelect
                value={status}
                onChange={(val) => {
                  setStatus(val);
                  applyFilters({ status: val });
                }}
                options={[
                  { value: "all", label: "Todos los estados" },
                  { value: "received", label: "Recibido" },
                  { value: "in_preparation", label: "En preparación" },
                  { value: "ready", label: "Listo" },
                  { value: "delivered", label: "Entregado" },
                  { value: "cancelled", label: "Cancelado" },
                ]}
              />

              {/* Filtro de Destino / Tipo de Orden */}
              <AdminSelect
                value={orderType}
                onChange={(val) => {
                  setOrderType(val);
                  applyFilters({ orderType: val });
                }}
                options={[
                  { value: "all", label: "Todos los destinos" },
                  { value: "dine_in", label: "En mesa" },
                  { value: "takeout", label: "Para llevar" },
                  { value: "delivery", label: "Domicilio" },
                ]}
              />

              {/* Filtro de Estado de Pago */}
              <AdminSelect
                value={paymentStatus}
                onChange={(val) => {
                  setPaymentStatus(val);
                  applyFilters({ paymentStatus: val });
                }}
                options={[
                  { value: "all", label: "Todos los pagos" },
                  { value: "pending", label: "Pendiente" },
                  { value: "paid", label: "Pagado" },
                  { value: "partial", label: "Parcial" },
                ]}
              />

              {/* Filtro de Canal de Origen */}
              <AdminSelect
                value={channelOrigin}
                onChange={(val) => {
                  setChannelOrigin(val);
                  applyFilters({ channelOrigin: val });
                }}
                options={[
                  { value: "all", label: "Todos los canales" },
                  { value: "in_person", label: "Presencial" },
                  { value: "whatsapp", label: "WhatsApp" },
                  { value: "digital_menu", label: "Menú Digital" },
                ]}
              />

              {/* Filtros de Rango de Fechas */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-600 dark:text-slate-300 shrink-0">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-[11px] text-slate-400 font-mono">Desde:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    applyFilters({ startDate: e.target.value });
                  }}
                  className="bg-transparent text-xs text-slate-700 dark:text-slate-200 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-600 dark:text-slate-300 shrink-0">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-[11px] text-slate-400 font-mono">Hasta:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    applyFilters({ endDate: e.target.value });
                  }}
                  className="bg-transparent text-xs text-slate-700 dark:text-slate-200 focus:outline-none"
                />
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
                  title="Restablecer filtros"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpiar</span>
                </button>
              )}
            </>
          }
        />

        {/* TABLA UNIFICADA CON ADMIN-DATA-TABLE */}
        <AdminDataTable<RestaurantOrderWithDetails>
          data={initialData.orders}
          columns={[
            {
              header: "Pedido",
              render: (order) => (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-slate-200 to-slate-100 dark:from-white/10 dark:to-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-200 shrink-0">
                    <UtensilsCrossed className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <Link
                      href={`/workspace/${businessId}/pedidos/${order.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-mono font-bold text-slate-900 dark:text-white hover:text-[#ED500A] dark:hover:text-[#ED500A] transition-colors truncate block"
                    >
                      #{order.order_number}
                    </Link>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ID: {order.id.slice(0, 8)}
                    </span>
                  </div>
                </div>
              ),
            },
            {
              header: "Cliente",
              headerClassName: "whitespace-nowrap",
              render: (order) => (
                <div className="space-y-0.5 min-w-0">
                  <span className="font-semibold text-slate-900 dark:text-white block truncate">
                    {order.customer_name || "Cliente mostrador"}
                  </span>
                  {order.customer_phone && (
                    <span className="text-[11px] text-slate-400 font-mono block">
                      {order.customer_phone}
                    </span>
                  )}
                </div>
              ),
            },
            {
              header: "Destino & Ubicación",
              headerClassName: "whitespace-nowrap",
              className: "whitespace-nowrap",
              render: (order) => {
                const typeBadge = getOrderTypeBadge(order.order_type, order.tableName);
                const TypeIcon = typeBadge.icon;
                return (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${typeBadge.color}`}>
                    <TypeIcon className="w-3.5 h-3.5" />
                    <span>{typeBadge.label}</span>
                  </span>
                );
              },
            },
            {
              header: "Canal",
              headerClassName: "whitespace-nowrap",
              className: "whitespace-nowrap",
              render: (order) => {
                const channelBadge = getChannelBadge(order.channel_origin);
                const ChannelIcon = channelBadge.icon;
                return (
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${channelBadge.color}`}>
                    <ChannelIcon className="w-3.5 h-3.5" />
                    <span>{channelBadge.label}</span>
                  </span>
                );
              },
            },
            {
              header: "Fecha",
              headerClassName: "whitespace-nowrap",
              className: "whitespace-nowrap text-slate-500 dark:text-slate-400 text-xs font-mono",
              render: (order) => formatDate(order.created_at),
            },
            {
              header: "Artículos",
              headerClassName: "whitespace-nowrap text-center",
              className: "whitespace-nowrap text-center font-mono font-bold text-slate-800 dark:text-slate-200",
              align: "center",
              render: (order) => order.itemsCount || 0,
            },
            {
              header: "Estado Operativo",
              headerClassName: "whitespace-nowrap",
              className: "whitespace-nowrap",
              render: (order) => {
                const statusBadge = getOrderStatusBadge(order.status);
                const StatusIcon = statusBadge.icon;
                return (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusBadge.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    <span>{statusBadge.label}</span>
                  </span>
                );
              },
            },
            {
              header: "Pago",
              headerClassName: "whitespace-nowrap",
              className: "whitespace-nowrap",
              render: (order) => {
                const payBadge = getPaymentStatusBadge(order.payment_status);
                return (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium border ${payBadge.color}`}>
                    {payBadge.label}
                  </span>
                );
              },
            },
            {
              header: "Total",
              headerClassName: "whitespace-nowrap text-right",
              className: "whitespace-nowrap text-right font-mono font-extrabold text-slate-900 dark:text-white text-sm",
              align: "right",
              render: (order) => formatCOP(order.total),
            },
            {
              header: "Acciones",
              headerClassName: "whitespace-nowrap text-right",
              className: "whitespace-nowrap text-right",
              align: "right",
              render: (order) => {
                const statusBadge = getOrderStatusBadge(order.status);
                return (
                  <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {canUpdateOrder && statusBadge.nextAction && (
                      <button
                        type="button"
                        onClick={() =>
                          handleQuickStatusTransition(order, statusBadge.nextAction!.targetStatus)
                        }
                        disabled={isPending}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#ED500A]/10 hover:bg-[#ED500A] text-[#ED500A] hover:text-white transition-colors"
                        title={`Pasar a estado ${statusBadge.nextAction.label}`}
                      >
                        <span>{statusBadge.nextAction.label}</span>
                      </button>
                    )}

                    <Link
                      href={`/workspace/${businessId}/pedidos/${order.id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-800 dark:text-white transition-colors"
                    >
                      <span>Ver</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                );
              },
            },
          ]}
          keyExtractor={(order) => order.id}
          onRowClick={(order) => router.push(`/workspace/${businessId}/pedidos/${order.id}`)}
          emptyState={{
            icon: UtensilsCrossed,
            title: hasActiveFilters ? "Sin resultados para estos filtros" : "No hay pedidos registrados todavía",
            description: hasActiveFilters
              ? "Prueba cambiando o limpiando los criterios de búsqueda para visualizar comandas."
              : "Las órdenes generadas desde el Punto de venta (POS) aparecerán aquí de forma automática para el seguimiento operativo de cocina y entrega.",
            onReset: hasActiveFilters ? handleClearFilters : undefined,
            resetLabel: hasActiveFilters ? "Limpiar Filtros" : undefined,
          }}
          renderMobileCard={(order) => {
            const statusBadge = getOrderStatusBadge(order.status);
            const StatusIcon = statusBadge.icon;
            const typeBadge = getOrderTypeBadge(order.order_type, order.tableName);
            const TypeIcon = typeBadge.icon;
            const payBadge = getPaymentStatusBadge(order.payment_status);

            return (
              <div
                key={order.id}
                className="p-4 rounded-2xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 shadow-xs space-y-3 font-body"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200">
                      <UtensilsCrossed className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-mono font-bold text-sm text-slate-900 dark:text-white truncate">
                        Pedido #{order.order_number}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {order.customer_name || "Cliente mostrador"}
                      </p>
                    </div>
                  </div>

                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${statusBadge.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    <span>{statusBadge.label}</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100 dark:border-white/[0.04]">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">Destino</span>
                    <span className={`inline-flex items-center gap-1 font-semibold text-[11px] mt-0.5 ${typeBadge.color.split(" ")[0]}`}>
                      <TypeIcon className="w-3 h-3" />
                      <span>{typeBadge.label}</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">Pago</span>
                    <span className={`inline-flex items-center px-2 py-0.2 rounded text-[10px] font-semibold mt-0.5 border ${payBadge.color}`}>
                      {payBadge.label}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-white/[0.04]">
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block font-mono">Total ({order.itemsCount || 0} ítems)</span>
                    <span className="text-base font-mono font-extrabold text-[#ED500A]">
                      {formatCOP(order.total)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {canUpdateOrder && statusBadge.nextAction && (
                      <button
                        type="button"
                        onClick={() =>
                          handleQuickStatusTransition(order, statusBadge.nextAction!.targetStatus)
                        }
                        disabled={isPending}
                        className="inline-flex items-center justify-center px-3 py-2 rounded-xl bg-[#ED500A]/10 text-[#ED500A] font-semibold text-xs transition-colors"
                      >
                        <span>{statusBadge.nextAction.label}</span>
                      </button>
                    )}

                    <Link
                      href={`/workspace/${businessId}/pedidos/${order.id}`}
                      className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/[0.04] text-xs font-semibold text-slate-800 dark:text-white hover:bg-slate-200 transition-colors"
                    >
                      <span>Detalle</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          }}
          pagination={{
            currentPage: initialData.currentPage,
            totalPages: initialData.totalPages,
            totalItems: initialData.totalCount,
            currentCount: initialData.orders.length,
            itemLabel: "pedidos",
            onPageChange: handlePageChange,
            isPending,
          }}
        />

        {/* 5. MODAL DE CONFIRMACIÓN PARA CANCELAR PEDIDO */}
        <AdminConfirmDialog
          isOpen={cancelModal.isOpen && !!cancelModal.order}
          onClose={() => setCancelModal({ isOpen: false, order: null })}
          onConfirm={handleConfirmCancel}
          title="¿Cancelar este pedido?"
          description={`El pedido #${cancelModal.order?.order_number} cambiará a estado cancelado. Esta acción detendrá su proceso operativo.`}
          confirmLabel="Cancelar Pedido"
          variant="destructive"
          isLoading={isPending}
          itemDetails={
            cancelModal.order
              ? [
                  { label: "Número de Pedido", value: `#${cancelModal.order.order_number}` },
                  { label: "Cliente", value: cancelModal.order.customer_name || "Cliente mostrador" },
                  { label: "Total", value: formatCOP(cancelModal.order.total) },
                ]
              : undefined
          }
        />
      </div>
    </AppPageContainer>
  );
}
