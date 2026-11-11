"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Clock,
  CheckCircle2,
  PackageCheck,
  XCircle,
  Calendar,
  ArrowRight,
  RotateCcw,
  Bike,
  Store,
  Receipt,
  MessageSquare,
  ShoppingBag,
  Layers,
  Sparkles,
  Kanban,
  Table as TableIcon,
  CreditCard,
  Banknote,
  MapPin,
  User,
  Phone,
  AlertCircle,
  X,
  FileText,
  DollarSign,
  Loader2,
  GripVertical,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowRightLeft,
  ExternalLink,
  Flame,
  AlertTriangle,
  SlidersHorizontal,
  UserCheck,
  KeyRound,
  Boxes,
  ClipboardList,
  Inbox,
  PackageOpen,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { ConfirmPickupModal } from "@/components/pedidos/confirm-pickup-modal";
import { EditOrderModal } from "@/components/pedidos/edit-order-modal";
import {
  DataTable,
  TableToolbar,
  Select,
  Pagination,
  KpiGrid,
  KpiCard,
  ConfirmDialog,
} from "@/components/ui";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  RestaurantOrderWithDetails,
  RestaurantOrdersListResult,
  RestaurantOrdersSummary,
  VALID_ORDER_STATUS_TRANSITIONS,
  ProcessOrderPaymentInput,
  KdsTimeAlertConfig,
  DEFAULT_KDS_TIME_ALERTS,
  getKdsAlertLevel,
} from "@/lib/restaurant/types";
import { PublicPaymentMethodDTO } from "@/lib/payments/types";
import { OrderPaymentModal } from "@/components/payments/order-payment-modal";
import { OrderDetailModal } from "./order-detail-modal";
import {
  updateRestaurantOrderStatusAction,
  cancelRestaurantOrderAction,
  registerRestaurantOrderPaymentAction,
} from "./actions";

interface OrdersListClientProps {
  businessId: string;
  businessName: string;
  businessTimezone: string;
  initialData: RestaurantOrdersListResult;
  summary: RestaurantOrdersSummary;
  paymentMethods?: PublicPaymentMethodDTO[];
  alertConfig?: KdsTimeAlertConfig;
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
  paymentMethods = [],
  alertConfig,
  canUpdateOrder,
  canCancelOrder,
  filters,
}: OrdersListClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // Umbrales de alertas de preparación [KDS-002]
  const resolvedAlertConfig = alertConfig || DEFAULT_KDS_TIME_ALERTS;
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [alertFilter, setAlertFilter] = useState<"all" | "delayed" | "critical">("all");

  // Reloj de tiempo transcurrido en vivo (actualiza cada 15s para mover pedidos a demorado/crítico)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Sincronización en tiempo real al recibir eventos de nuevos pedidos o pedidos listos
  useEffect(() => {
    const handleLiveOrderEvent = () => {
      router.refresh();
    };

    window.addEventListener("negova:new_order", handleLiveOrderEvent);
    window.addEventListener("negova:order_ready", handleLiveOrderEvent);

    return () => {
      window.removeEventListener("negova:new_order", handleLiveOrderEvent);
      window.removeEventListener("negova:order_ready", handleLiveOrderEvent);
    };
  }, [router]);

  // Modo de visualización: "queue" (Cola Operativa / Tablero) o "table" (Tabla / Historial)
  const [viewMode, setViewMode] = useState<"queue" | "table">("queue");

  // Tab activo en la cola operativa para vista responsive / móvil
  const [activeQueueTab, setActiveQueueTab] = useState<string>("active");

  // Estado local sincronizado de pedidos para actualizaciones fluidas e instantáneas
  const [localOrders, setLocalOrders] = useState<RestaurantOrderWithDetails[]>(initialData.orders);

  useEffect(() => {
    setLocalOrders(initialData.orders);
  }, [initialData.orders]);

  // Estados para Drag & Drop
  const [draggingOrderId, setDraggingOrderId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const draggingOrderIdRef = React.useRef<string | null>(null);

  // Modal para cambio de estado accesible (alternativa accesible y táctil al drag & drop)
  const [moveModal, setMoveModal] = useState<{
    isOpen: boolean;
    order: RestaurantOrderWithDetails | null;
  }>({
    isOpen: false,
    order: null,
  });

  // Modal para vista rápida y detalles completos de pedido
  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean;
    order: RestaurantOrderWithDetails | null;
  }>({
    isOpen: false,
    order: null,
  });

  // Mantener actualizado el pedido en el modal de detalle si cambia en tiempo real
  useEffect(() => {
    if (detailModal.isOpen && detailModal.order) {
      const fresh = localOrders.find((o) => o.id === detailModal.order?.id);
      if (fresh) {
        setDetailModal((prev) => ({ ...prev, order: fresh }));
      }
    }
  }, [localOrders, detailModal.isOpen]);

  // Modal para edición de ítems y responsable de comanda
  const [editingOrder, setEditingOrder] = useState<RestaurantOrderWithDetails | null>(null);

  // Estado de actualización por tarjeta
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Filtros locales
  const [search, setSearch] = useState(filters.search);
  const [status, setStatus] = useState(filters.status);
  const [paymentStatus, setPaymentStatus] = useState(filters.paymentStatus);
  const [orderType, setOrderType] = useState(filters.orderType);
  const [channelOrigin, setChannelOrigin] = useState(filters.channelOrigin);
  const [startDate, setStartDate] = useState(filters.startDate);
  const [endDate, setEndDate] = useState(filters.endDate);

  // Sincronizar estado local si cambian los props del servidor
  useEffect(() => {
    setSearch(filters.search);
  }, [filters.search]);

  useEffect(() => {
    setStatus(filters.status);
  }, [filters.status]);

  // Modal de confirmación para cancelar pedido
  const [cancelModal, setCancelModal] = useState<{
    isOpen: boolean;
    order: RestaurantOrderWithDetails | null;
    reason: string;
  }>({
    isOpen: false,
    order: null,
    reason: "",
  });

  // Modal para registrar cobro rápido de pedido
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    order: RestaurantOrderWithDetails | null;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    order: null,
    isSubmitting: false,
  });

  // Modal para confirmar recogida de pedido con PIN [POS-008]
  const [pickupModal, setPickupModal] = useState<{
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

  // Filtrado reactivo en tiempo real al escribir (debounce 300ms)
  const isSearchInitialMount = React.useRef(true);
  useEffect(() => {
    if (isSearchInitialMount.current) {
      isSearchInitialMount.current = false;
      return;
    }
    if (search === filters.search) return;

    const timer = setTimeout(() => {
      applyFilters({ search });
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

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

  const formatOrderTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const timeStr = d.toLocaleTimeString("es-CO", {
        timeZone: businessTimezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      const dateStr = d.toLocaleDateString("es-CO", {
        timeZone: businessTimezone,
        day: "numeric",
        month: "short",
      });
      return `${timeStr} · ${dateStr}`;
    } catch {
      return iso;
    }
  };

  const getWaitTimeInfo = (isoDate: string) => {
    try {
      const diffMs = Date.now() - new Date(isoDate).getTime();
      const diffMin = Math.floor(diffMs / 60000);
      let label = "Hace un momento";
      if (diffMin >= 1 && diffMin < 60) label = `Hace ${diffMin} min`;
      else if (diffMin >= 60 && diffMin < 1440) {
        const diffHr = Math.floor(diffMin / 60);
        label = `Hace ${diffHr} h`;
      } else if (diffMin >= 1440) {
        const diffDays = Math.floor(diffMin / 1440);
        label = `Hace ${diffDays} d`;
      }
      return {
        label,
        diffMin,
        isUrgent: diffMin >= 30,
      };
    } catch {
      return { label: "", diffMin: 0, isUrgent: false };
    }
  };

  const getTimeAgo = (isoDate: string): string => {
    return getWaitTimeInfo(isoDate).label;
  };

  // Badges y utilidades de estado operativo
  const getOrderStatusBadge = (orderStatus: string) => {
    switch (orderStatus) {
      case "pending":
      case "received":
        return {
          label: "Recibido",
          icon: Clock,
          color: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20",
          headerColor: "border-t-blue-500",
          nextAction: { targetStatus: "in_preparation", label: "Confirmar Pedido", icon: CheckCircle2 },
        };
      case "in_preparation":
        return {
          label: "En preparación",
          icon: Boxes,
          color: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
          headerColor: "border-t-amber-500",
          nextAction: { targetStatus: "ready", label: "Marcar Listo", icon: CheckCircle2 },
        };
      case "ready":
        return {
          label: "Listo",
          icon: CheckCircle2,
          color: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
          headerColor: "border-t-emerald-500",
          nextAction: { targetStatus: "delivered", label: "Entregar", icon: PackageCheck },
        };
      case "delivered":
        return {
          label: "Entregado",
          icon: PackageCheck,
          color: "bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/[0.08]",
          headerColor: "border-t-slate-400",
          nextAction: null,
        };
      case "cancelled":
        return {
          label: "Cancelado",
          icon: XCircle,
          color: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20",
          headerColor: "border-t-rose-500",
          nextAction: null,
        };
      default:
        return {
          label: orderStatus,
          icon: Clock,
          color: "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/[0.08]",
          headerColor: "border-t-slate-300",
          nextAction: null,
        };
    }
  };

  // Badges de Destino / Tipo de Orden
  const getOrderTypeBadge = (type: string, tableName?: string | null, isPickup?: boolean) => {
    switch (type) {
      case "dine_in":
        return {
          label: tableName ? (tableName.toLowerCase().startsWith("mesa") ? tableName : `Mesa ${tableName}`) : "En local",
          icon: Store,
          color: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20",
        };
      case "takeout":
        if (isPickup) {
          return {
            label: "Para recoger",
            icon: Receipt,
            color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20",
          };
        }
        return {
          label: "Para llevar",
          icon: ShoppingBag,
          color: "text-[#ED500A] dark:text-[#ED500A] bg-orange-50 dark:bg-[#ED500A]/10 border-orange-200 dark:border-[#ED500A]/25",
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
          icon: CheckCircle2,
        };
      case "partial":
        return {
          label: "Pago parcial",
          color: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
          icon: Clock,
        };
      case "pending":
      default:
        return {
          label: "Pago pendiente",
          color: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
          icon: AlertCircle,
        };
    }
  };

  // Etiquetas semánticas de estados para mensajes y accesibilidad
  const statusLabels: Record<string, string> = {
    pending: "Recibidos",
    received: "Recibidos",
    in_preparation: "En Preparación",
    ready: "Listos para Entrega",
    delivered: "Entregados",
    cancelled: "Cancelados",
  };

  // Transición de estado con validación estricta, actualización optimista y rollback
  const handleStatusTransition = async (order: RestaurantOrderWithDetails, targetStatus: string) => {
    if (!canUpdateOrder) {
      toast.error("No tienes permisos para modificar el estado de pedidos.");
      return;
    }

    // No-op si es el mismo estado
    if (order.status === targetStatus) {
      return;
    }

    // 1. Validar máquina de estados oficial (VALID_ORDER_STATUS_TRANSITIONS)
    const allowed = VALID_ORDER_STATUS_TRANSITIONS[order.status] || [];
    if (!allowed.includes(targetStatus)) {
      const fromLabel = getOrderStatusBadge(order.status).label || order.status;
      const toLabel = statusLabels[targetStatus] || targetStatus;
      toast.error(`Transición no permitida: un pedido en '${fromLabel}' no puede pasar a '${toLabel}'.`);
      return;
    }

    // 2. Si el destino es cancelado, requerir confirmación modal obligatoria para evitar accidentes
    if (targetStatus === "cancelled") {
      setCancelModal({
        isOpen: true,
        order,
        reason: "",
      });
      return;
    }

    // 3. Prevenir peticiones duplicadas simultáneas
    if (updatingOrderId === order.id) {
      return;
    }

    // 4. Actualización optimista de la interfaz
    const prevOrders = localOrders;
    setLocalOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status: targetStatus as any } : o))
    );
    setUpdatingOrderId(order.id);

    // 5. Persistencia en el servidor
    try {
      const res = await updateRestaurantOrderStatusAction(businessId, order.id, targetStatus);
      if (res.success) {
        toast.success(`Pedido #${order.order_number} movido a ${statusLabels[targetStatus] || targetStatus}.`);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("negova:order-status-updated"));
        }
        startTransition(() => {
          router.refresh();
        });
      } else {
        // Rollback automático en caso de rechazo del servidor
        setLocalOrders(prevOrders);
        toast.error(res.error || "No se pudo actualizar el estado del pedido.");
      }
    } catch (err: any) {
      // Rollback ante excepción de red o servidor
      setLocalOrders(prevOrders);
      toast.error(err?.message || "Error al actualizar el estado del pedido.");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Transición rápida de estado (compatibilidad con botones existentes)
  const handleQuickStatusTransition = async (order: RestaurantOrderWithDetails, targetStatus: string) => {
    await handleStatusTransition(order, targetStatus);
  };

  // Confirmar cancelación segura con rollback
  const handleConfirmCancel = async () => {
    if (!cancelModal.order) return;
    const order = cancelModal.order;
    const reason = cancelModal.reason;
    setCancelModal({ isOpen: false, order: null, reason: "" });

    // Actualización optimista
    const prevOrders = localOrders;
    setLocalOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status: "cancelled" } : o))
    );
    setUpdatingOrderId(order.id);

    try {
      const res = await cancelRestaurantOrderAction(businessId, order.id, reason);
      if (res.success) {
        if (res.refundNotice) {
          toast.warning(res.refundNotice, { duration: 9000 });
        }
        toast.success(`Pedido #${order.order_number} cancelado correctamente.`);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("negova:order-status-updated"));
        }
        startTransition(() => {
          router.refresh();
        });
      } else {
        setLocalOrders(prevOrders);
        toast.error(res.error || "No se pudo cancelar el pedido.");
      }
    } catch (err: any) {
      setLocalOrders(prevOrders);
      toast.error(err?.message || "Error al cancelar el pedido.");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Confirmar registro de pago [POS-002: soporte para pagos múltiples, descuentos y propinas]
  const handleConfirmPayment = async (data: string | ProcessOrderPaymentInput) => {
    if (!paymentModal.order) return;
    const order = paymentModal.order;

    setPaymentModal((prev) => ({ ...prev, isSubmitting: true }));
    setUpdatingOrderId(order.id);

    try {
      const res = await registerRestaurantOrderPaymentAction(businessId, order.id, data);
      if (res.success) {
        toast.success(`Pago del Pedido #${order.order_number} registrado correctamente.`);
        setPaymentModal({ isOpen: false, order: null, isSubmitting: false });
        startTransition(() => {
          router.refresh();
        });
      } else {
        toast.error(res.error || "No se pudo registrar el pago del pedido.");
        setPaymentModal((prev) => ({ ...prev, isSubmitting: false }));
      }
    } catch (err: any) {
      toast.error(err?.message || "Error inesperado al registrar el pago.");
      setPaymentModal((prev) => ({ ...prev, isSubmitting: false }));
    } finally {
      setUpdatingOrderId(null);
    }
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

  // Conteo en tiempo real de pedidos demorados y críticos [KDS-002]
  const alertMetrics = React.useMemo(() => {
    let delayedCount = 0;
    let criticalCount = 0;

    for (const ord of localOrders) {
      if (ord.status !== "delivered" && ord.status !== "cancelled") {
        const { level } = getKdsAlertLevel(ord.created_at, resolvedAlertConfig);
        if (level === "warning") delayedCount++;
        else if (level === "critical") criticalCount++;
      }
    }

    return {
      delayedCount,
      criticalCount,
      totalAlerts: delayedCount + criticalCount,
    };
  }, [localOrders, resolvedAlertConfig, currentTime]);

  // Filtrado de pedidos locales según filtro de alerta seleccionado (todos, demorados o críticos)
  const filteredLocalOrders = React.useMemo(() => {
    if (alertFilter === "all") return localOrders;
    return localOrders.filter((o) => {
      if (o.status === "delivered" || o.status === "cancelled") return false;
      const alert = getKdsAlertLevel(o.created_at, resolvedAlertConfig);
      if (alertFilter === "delayed") return alert.level === "warning";
      if (alertFilter === "critical") return alert.level === "critical";
      return true;
    });
  }, [localOrders, alertFilter, resolvedAlertConfig, currentTime]);

  // Agrupamiento dinámico de pedidos basado en el estado local optimista
  const ordersByStatus = {
    received: filteredLocalOrders.filter((o) => o.status === "received" || (o.status as string) === "pending"),
    in_preparation: filteredLocalOrders.filter((o) => o.status === "in_preparation"),
    ready: filteredLocalOrders.filter((o) => o.status === "ready"),
    delivered: filteredLocalOrders.filter((o) => o.status === "delivered"),
    cancelled: filteredLocalOrders.filter((o) => o.status === "cancelled"),
  };

  // Columnas operativas con contadores dinámicos e instantáneos
  const queueColumns = [
    {
      id: "received",
      title: "Recibidos",
      icon: Clock,
      count: ordersByStatus.received.length,
      orders: ordersByStatus.received,
      badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
      borderTop: "border-t-blue-500",
    },
    {
      id: "in_preparation",
      title: "En Preparación",
      icon: Boxes,
      count: ordersByStatus.in_preparation.length,
      orders: ordersByStatus.in_preparation,
      badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
      borderTop: "border-t-amber-500",
    },
    {
      id: "ready",
      title: "Listos para Entrega",
      icon: CheckCircle2,
      count: ordersByStatus.ready.length,
      orders: ordersByStatus.ready,
      badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
      borderTop: "border-t-emerald-500",
    },
    {
      id: "delivered",
      title: "Entregados",
      icon: PackageCheck,
      count: ordersByStatus.delivered.length,
      orders: ordersByStatus.delivered,
      badgeColor: "bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-300",
      borderTop: "border-t-slate-400",
    },
    {
      id: "cancelled",
      title: "Cancelados",
      icon: XCircle,
      count: ordersByStatus.cancelled.length,
      orders: ordersByStatus.cancelled,
      badgeColor: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
      borderTop: "border-t-rose-500",
    },
  ];

  // Componente de Tarjeta Operativa de Pedido Rediseñada
  const renderOrderCard = (order: RestaurantOrderWithDetails) => {
    const statusBadge = getOrderStatusBadge(order.status);
    const StatusIcon = statusBadge.icon;
    const typeBadge = getOrderTypeBadge(
      order.order_type,
      order.tableName,
      Boolean(order.pickup_code || order.notes?.includes("[PICKUP_PIN:"))
    );
    const TypeIcon = typeBadge.icon;
    const channelBadge = getChannelBadge(order.channel_origin);
    const ChannelIcon = channelBadge.icon;
    const payBadge = getPaymentStatusBadge(order.payment_status);
    const PayIcon = payBadge.icon;
    const isThisOrderUpdating = updatingOrderId === order.id;
    const isBeingDragged = draggingOrderId === order.id;
    const isDraggable = canUpdateOrder && order.status !== "cancelled";
    const waitInfo = getWaitTimeInfo(order.created_at);

    // Próxima acción permitida según transiciones de estado
    const nextAction = statusBadge.nextAction;
    const isCancelled = order.status === "cancelled";

    // Cálculo de nivel de alerta de cocina [KDS-002]
    const alert = getKdsAlertLevel(order.created_at, resolvedAlertConfig);
    const isDeliveredOrCancelled = order.status === "delivered" || isCancelled;

    return (
      <div
        key={order.id}
        draggable={isDraggable && !isThisOrderUpdating}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", order.id);
          e.dataTransfer.effectAllowed = "move";
          draggingOrderIdRef.current = order.id;
          setDraggingOrderId(order.id);
        }}
        onDragEnd={() => {
          draggingOrderIdRef.current = null;
          setDraggingOrderId(null);
          setDragOverColumnId(null);
        }}
        onClick={() => setDetailModal({ isOpen: true, order })}
        className={`bg-white dark:bg-[#161A24] border rounded-2xl p-3.5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-3 relative select-none group ${statusBadge.headerColor} border-t-2 ${
          !isDeliveredOrCancelled && alert.level === "critical"
            ? "border-rose-400 dark:border-rose-500/80 ring-2 ring-rose-500/30 bg-rose-50/[0.04]"
            : !isDeliveredOrCancelled && alert.level === "warning"
            ? "border-amber-400 dark:border-amber-500/80 ring-1 ring-amber-500/30 bg-amber-50/[0.04]"
            : "border-slate-200/90 dark:border-white/[0.08]"
        } ${
          isDraggable ? "lg:cursor-grab lg:active:cursor-grabbing cursor-pointer" : "cursor-pointer"
        } ${
          isBeingDragged ? "opacity-40 scale-[0.98] ring-2 ring-[#ED500A] shadow-lg" : ""
        }`}
      >
        {/* 1. ENCABEZADO: #Orden, Modalidad y Tiempo / Alertas [KDS-002] */}
        <div className="flex items-start justify-between gap-2">
          {/* Izquierda: Drag, #Orden y Modalidad */}
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            {isDraggable && (
              <span
                onClick={(e) => e.stopPropagation()}
                className="cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 -ml-0.5 p-0.5 rounded transition-colors shrink-0"
                title="Arrastrar comanda"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </span>
            )}
            <span className="font-mono font-black text-base text-slate-900 dark:text-white group-hover:text-[#ED500A] transition-colors shrink-0">
              #{order.order_number}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${typeBadge.color} truncate max-w-[130px]`}
              title={typeBadge.label}
            >
              <TypeIcon className="w-3 h-3 shrink-0" />
              <span className="truncate">{typeBadge.label}</span>
            </span>

            {order.order_type === "takeout" && order.pickup_code && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                title={`Código de recogida: #${order.pickup_code}`}
              >
                <KeyRound className="w-2.5 h-2.5" />
                <span>#{order.pickup_code}</span>
              </span>
            )}
          </div>

          {/* Derecha: Badge de Tiempo o Alerta y Botón de Edición */}
          <div className="flex items-center gap-1.5 shrink-0" suppressHydrationWarning>
            {canUpdateOrder && !isDeliveredOrCancelled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingOrder(order);
                }}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-[#ED500A] transition-colors cursor-pointer"
                title="Editar comanda (productos, cantidades, responsable)"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {!isDeliveredOrCancelled && alert.level === "critical" ? (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40 animate-pulse whitespace-nowrap"
                title={`Abierto hace ${alert.elapsedFormatted}`}
                suppressHydrationWarning
              >
                <Flame className="w-3 h-3 text-rose-500 shrink-0" />
                <span suppressHydrationWarning>{alert.elapsedFormatted}</span>
              </span>
            ) : !isDeliveredOrCancelled && alert.level === "warning" ? (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40 whitespace-nowrap"
                title={`Abierto hace ${alert.elapsedFormatted}`}
                suppressHydrationWarning
              >
                <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                <span suppressHydrationWarning>{alert.elapsedFormatted}</span>
              </span>
            ) : (
              <span
                className={`text-[11px] font-medium whitespace-nowrap ${
                  waitInfo.isUrgent && order.status !== "delivered" && !isCancelled
                    ? "text-amber-600 dark:text-amber-400 font-bold"
                    : "text-slate-400 dark:text-slate-500"
                }`}
                suppressHydrationWarning
              >
                {waitInfo.label}
              </span>
            )}
          </div>
        </div>

        {/* 2. CLIENTE Y RESPONSABLE */}
        <div className="space-y-0.5">
          {order.customer_name && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 min-w-0">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{order.customer_name}</span>
            </div>
          )}
          {order.assigned_staff_name && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 min-w-0">
              <UserCheck className="w-3 h-3 text-[#ED500A] shrink-0" />
              <span className="truncate">
                Resp: <strong className="font-semibold text-slate-700 dark:text-slate-300">{order.assigned_staff_name}</strong>
              </span>
              {order.assigned_staff_role && (
                <span className="text-[9px] px-1 py-0.2 rounded font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 truncate">
                  {order.assigned_staff_role.split(",")[0]}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 3. RESUMEN DE PLATOS (Sin tablas ni cajas oscuras sofocadas) */}
        <div className="text-xs space-y-1 text-slate-700 dark:text-slate-300">
          {order.items && order.items.length > 0 ? (
            <>
              {order.items.slice(0, 2).map((item, idx) => (
                <div key={idx} className="flex items-center gap-1.5 min-w-0">
                  <span className="font-black text-[#ED500A] text-xs shrink-0">
                    {item.quantity}×
                  </span>
                  <span className="truncate font-medium text-slate-800 dark:text-slate-200" title={item.product_name}>
                    {item.product_name}
                  </span>
                </div>
              ))}
              {order.items.length > 2 && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium pt-0.5">
                  + {order.items.length - 2} producto{order.items.length - 2 > 1 ? "s" : ""} más
                </p>
              )}
            </>
          ) : (
            <p className="text-slate-400 text-xs">
              {order.itemsCount || 0} productos
            </p>
          )}
        </div>

        {/* 4. TOTAL Y ESTADO DE PAGO */}
        <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-base font-mono font-black text-slate-900 dark:text-white">
              {formatCOP(order.total)}
            </span>

            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${payBadge.color} shrink-0`}>
              <PayIcon className="w-3 h-3 shrink-0" />
              <span>{payBadge.label}</span>
            </span>
          </div>

          {/* Acción rápida de Recogida para modalidad Para recoger */}
          {order.order_type === "takeout" && Boolean(order.pickup_code) && order.status !== "delivered" && !isCancelled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPickupModal({ isOpen: true, order });
              }}
              className="w-full py-1.5 px-3 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs hover:scale-[1.01] active:scale-[0.99]"
              title="Confirmar entrega de recogida con PIN"
            >
              <PackageCheck className="w-3.5 h-3.5" />
              <span>Confirmar recogida (#{order.pickup_code})</span>
            </button>
          )}

          {order.order_type === "takeout" && Boolean(order.pickup_code) && (order.status === "delivered" || order.pickup_confirmed_at) && (
            <div className="flex items-center justify-end gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 pt-0.5">
              <PackageCheck className="w-3 h-3" />
              <span>Recogida confirmada</span>
            </div>
          )}

          {order.payment_status === "pending" && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPaymentModal({
                  isOpen: true,
                  order,
                  isSubmitting: false,
                });
              }}
              className="w-full py-1.5 px-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs hover:scale-[1.01] active:scale-[0.99]"
              title="Registrar y confirmar pago de este pedido"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Confirmar pago</span>
            </button>
          )}

          {order.payment_status === "partial" && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPaymentModal({
                  isOpen: true,
                  order,
                  isSubmitting: false,
                });
              }}
              className="w-full py-1.5 px-3 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs hover:scale-[1.01] active:scale-[0.99]"
              title="Registrar saldo pendiente del pedido"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Cobrar saldo pendiente</span>
            </button>
          )}
        </div>

        {/* 5. ACCIONES DIRECTAS Y RÁPIDAS DE MOVIMIENTO (SOLO MÓVIL / TABLET; EN PC SE USA DRAG & DROP) */}
        <div className="pt-0.5 lg:hidden" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1.5">
            {/* Selector rápido para mover a cualquier estado permitido */}
            {canUpdateOrder && !isCancelled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMoveModal({ isOpen: true, order });
                }}
                className="h-9 w-9 rounded-xl border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Mover a otra columna..."
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Acciones en Columna: Recibidos */}
            {canUpdateOrder && order.status === "received" ? (
              <div className="flex-1 grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={isPending || isThisOrderUpdating}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuickStatusTransition(order, "in_preparation");
                  }}
                  className="h-9 inline-flex items-center justify-center gap-1 px-2.5 rounded-xl text-xs font-bold bg-[#ED500A] hover:bg-[#ED500A]/90 text-white shadow-xs transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  title="Mover comanda a En Preparación (Cocina)"
                >
                  {isThisOrderUpdating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <span>Preparar</span>
                      <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                    </>
                  )}
                </button>

                {canCancelOrder && (
                  <button
                    type="button"
                    disabled={isPending || isThisOrderUpdating}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCancelModal({
                        isOpen: true,
                        order,
                        reason: "",
                      });
                    }}
                    className="h-9 inline-flex items-center justify-center gap-1 px-2 rounded-xl text-xs font-semibold border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors disabled:opacity-50 cursor-pointer"
                    title="Rechazar o cancelar comanda"
                  >
                    <X className="w-3.5 h-3.5 shrink-0" />
                    <span>Rechazar</span>
                  </button>
                )}
              </div>
            ) : canUpdateOrder && (order.status === "in_preparation" || order.status === "ready") ? (
              /* Acciones Bidireccionales para En Preparación y Listos para Entrega */
              <div className="flex-1 grid grid-cols-2 gap-1.5">
                {/* Botón Mover a la Izquierda (Atrás) */}
                <button
                  type="button"
                  disabled={isPending || isThisOrderUpdating}
                  onClick={(e) => {
                    e.stopPropagation();
                    const leftTarget = order.status === "in_preparation" ? "received" : "in_preparation";
                    handleQuickStatusTransition(order, leftTarget);
                  }}
                  className="h-9 inline-flex items-center justify-center gap-1 px-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50 cursor-pointer"
                  title={
                    order.status === "in_preparation"
                      ? "Mover a la izquierda: Recibidos"
                      : "Mover a la izquierda: En Preparación (Cocina)"
                  }
                >
                  <ChevronLeft className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                  <span className="truncate">
                    {order.status === "in_preparation" ? "Recibidos" : "Cocina"}
                  </span>
                </button>

                {/* Botón Mover a la Derecha (Adelante) */}
                <button
                  type="button"
                  disabled={isPending || isThisOrderUpdating}
                  onClick={(e) => {
                    e.stopPropagation();
                    const rightTarget = order.status === "in_preparation" ? "ready" : "delivered";
                    handleQuickStatusTransition(order, rightTarget);
                  }}
                  className="h-9 inline-flex items-center justify-center gap-1 px-2 rounded-xl text-xs font-bold bg-[#ED500A] hover:bg-[#ED500A]/90 text-white shadow-xs transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  title={
                    order.status === "in_preparation"
                      ? "Mover a la derecha: Listos para Entrega"
                      : "Mover a la derecha: Entregar pedido"
                  }
                >
                  {isThisOrderUpdating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <span className="truncate">
                        {order.status === "in_preparation" ? "Listo" : "Entregar"}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                    </>
                  )}
                </button>
              </div>
            ) : canUpdateOrder && order.status === "delivered" ? (
              /* Acción en Columna: Entregados (Permite regresar a Listos o Ver Detalles) */
              <div className="flex-1 grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={isPending || isThisOrderUpdating}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuickStatusTransition(order, "ready");
                  }}
                  className="h-9 inline-flex items-center justify-center gap-1 px-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50 cursor-pointer"
                  title="Devolver pedido a la izquierda: Listos para Entrega"
                >
                  <ChevronLeft className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                  <span className="truncate">A Listos</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDetailModal({ isOpen: true, order })}
                  className="h-9 inline-flex items-center justify-center gap-1 px-2.5 rounded-xl text-xs font-semibold border border-slate-200/80 dark:border-white/10 bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  <span>Detalles</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setDetailModal({ isOpen: true, order })}
                className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 px-3 rounded-xl text-xs font-semibold border border-slate-200/80 dark:border-white/10 bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                <span>Ver detalles</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <AppPageContainer
      title="Gestión de Pedidos"
      description={`Control operativo, preparación y despacho de pedidos en ${businessName}.`}
      badge={
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20">
          <ClipboardList className="w-3.5 h-3.5" />
          Control Operativo y Despacho
        </span>
      }
      actions={
        <Link
          href={`/workspace/${businessId}/cocina`}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#ED500A] hover:bg-[#ED500A]/90 text-white shadow-xs transition-all active:scale-[0.98]"
        >
          <ClipboardList className="w-4 h-4" />
          <span>Monitor Operativo / KDS</span>
        </Link>
      }
      maxWidth="7xl"
    >
      <div className="space-y-6 font-body">
        {/* 1. INDICADORES RESUMIDOS DE PEDIDOS (KPIs) */}
        <KpiGrid cols={4}>
          <KpiCard
            title="Total Pedidos"
            value={summary.total}
            subtext="Pedidos registrados"
            icon={<ShoppingBag className="w-4 h-4" />}
            variant="blue"
            isSelected={status === "all"}
            onClick={() => {
              setStatus("all");
              applyFilters({ status: "all" });
            }}
          />

          <KpiCard
            title="Recibidos"
            value={summary.received}
            subtext="Pendientes de preparación"
            icon={<Clock className="w-4 h-4" />}
            variant="purple"
            isSelected={status === "received"}
            onClick={() => {
              setStatus("received");
              applyFilters({ status: "received" });
            }}
          />

          <KpiCard
            title="En Preparación"
            value={summary.inPreparation}
            subtext="En alistamiento"
            icon={<Boxes className="w-4 h-4" />}
            variant="amber"
            isSelected={status === "in_preparation"}
            onClick={() => {
              setStatus("in_preparation");
              applyFilters({ status: "in_preparation" });
            }}
          />

          <KpiCard
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
        </KpiGrid>

        {/* 1B. INDICADORES DE TIEMPO Y ALERTAS DE DEMORA DE COMANDAS [KDS-002] */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            onClick={() => setAlertFilter(alertFilter === "delayed" ? "all" : "delayed")}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
              alertFilter === "delayed"
                ? "bg-amber-500/15 border-amber-500 text-amber-950 dark:text-amber-200 ring-2 ring-amber-500/40"
                : "bg-amber-50/50 dark:bg-amber-500/[0.04] border-amber-200/80 dark:border-amber-500/20 hover:border-amber-400"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Comandas Demoradas
                  </span>
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                    &gt; {resolvedAlertConfig.warningMinutes} min
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {alertMetrics.delayedCount === 1
                    ? "1 comanda esperando atención"
                    : `${alertMetrics.delayedCount} comandas esperando atención`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-mono font-black text-amber-600 dark:text-amber-400">
                {alertMetrics.delayedCount}
              </span>
              {alertFilter === "delayed" && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">Filtrado activo</p>
              )}
            </div>
          </div>

          <div
            onClick={() => setAlertFilter(alertFilter === "critical" ? "all" : "critical")}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
              alertFilter === "critical"
                ? "bg-rose-500/15 border-rose-500 text-rose-950 dark:text-rose-200 ring-2 ring-rose-500/40"
                : "bg-rose-50/50 dark:bg-rose-500/[0.04] border-rose-200/80 dark:border-rose-500/20 hover:border-rose-400"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
                <Flame className={`w-5 h-5 text-rose-500 ${alertMetrics.criticalCount > 0 ? "animate-pulse" : ""}`} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Comandas Críticas
                  </span>
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-500/30">
                    &gt; {resolvedAlertConfig.criticalMinutes} min
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {alertMetrics.criticalCount === 1
                    ? "1 comanda requiere atención urgente"
                    : `${alertMetrics.criticalCount} comandas requieren atención urgente`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-mono font-black text-rose-600 dark:text-rose-400">
                {alertMetrics.criticalCount}
              </span>
              {alertFilter === "critical" && (
                <p className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">Filtrado activo</p>
              )}
            </div>
          </div>
        </div>

        {/* 2. BARRA DE CONTROL Y SELECTOR DE VISTA (COLA vs TABLA) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-white/[0.08]">
          {/* BOTONES DE VISTA: COLA OPERATIVA vs TABLA */}
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#131620] border border-slate-200/80 dark:border-white/[0.08] self-start">
            <button
              type="button"
              onClick={() => setViewMode("queue")}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "queue"
                  ? "bg-[#ED500A] text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Kanban className="w-4 h-4" />
              <span>Cola Operativa</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-[#ED500A] text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <TableIcon className="w-4 h-4" />
              <span>Tabla / Historial</span>
            </button>
          </div>

          {/* ACCIÓN DIRECTA: POS */}
          <div className="flex items-center gap-2">
            <Link
              href={`/workspace/${businessId}/pos`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#ED500A]/10 text-[#ED500A] hover:bg-[#ED500A] hover:text-white transition-colors"
            >
              <Store className="w-4 h-4" />
              <span>Nuevo Pedido en POS</span>
            </Link>
          </div>
        </div>

        {/* 3. BARRA DE HERRAMIENTAS: BÚSQUEDA Y FILTROS ESTANDARIZADOS */}
        <TableToolbar
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
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 w-full items-center">
              {/* Filtro de Estado Operativo */}
              <Select
                value={status}
                containerClassName="w-full"
                className="w-full"
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
              <Select
                value={orderType}
                containerClassName="w-full"
                className="w-full"
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
              <Select
                value={paymentStatus}
                containerClassName="w-full"
                className="w-full"
                onChange={(val) => {
                  setPaymentStatus(val);
                  applyFilters({ paymentStatus: val });
                }}
                options={[
                  { value: "all", label: "Todos los pagos" },
                  { value: "pending", label: "Pendiente de pago" },
                  { value: "paid", label: "Pagado" },
                  { value: "partial", label: "Pago parcial" },
                ]}
              />

              {/* Filtro de Canal de Origen */}
              <Select
                value={channelOrigin}
                containerClassName="w-full"
                className="w-full"
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

              {/* Filtro Fecha Desde */}
              <div className="relative flex items-center h-10 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-[#0B0D14] px-2.5 sm:px-3 focus-within:ring-2 focus-within:ring-[#ED500A]/30 focus-within:border-[#ED500A] transition-all w-full [color-scheme:light] dark:[color-scheme:dark]">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-1.5" />
                <span className="text-[11px] text-slate-400 font-medium mr-1 shrink-0 hidden sm:inline">Desde:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    applyFilters({ startDate: e.target.value });
                  }}
                  className="w-full bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer min-w-0"
                  title="Fecha inicial"
                />
              </div>

              {/* Filtro Fecha Hasta */}
              <div className="relative flex items-center h-10 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-[#0B0D14] px-2.5 sm:px-3 focus-within:ring-2 focus-within:ring-[#ED500A]/30 focus-within:border-[#ED500A] transition-all w-full [color-scheme:light] dark:[color-scheme:dark]">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-1.5" />
                <span className="text-[11px] text-slate-400 font-medium mr-1 shrink-0 hidden sm:inline">Hasta:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    applyFilters({ endDate: e.target.value });
                  }}
                  className="w-full bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer min-w-0"
                  title="Fecha final"
                />
              </div>

              {/* Botón Restablecer Filtros */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="col-span-2 sm:col-span-2 md:col-span-3 lg:col-span-6 h-10 inline-flex items-center justify-center gap-1.5 px-3 rounded-xl border border-rose-200 dark:border-rose-500/20 bg-rose-50/60 dark:bg-rose-500/10 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all cursor-pointer whitespace-nowrap w-full"
                  title="Restablecer todos los filtros"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpiar filtros</span>
                </button>
              )}
            </div>
          }
        />

        {/* 4. CONTENIDO PRINCIPAL SEGÚN MODO DE VISTA */}
        {viewMode === "queue" ? (
          <div className="space-y-4">
            {/* ======================================================== */}
            {/* CARRUSEL SNAP-SCROLL DE COLUMNAS KANBAN PARA MÓVIL */}
            {/* ======================================================== */}
            <div
              className="lg:hidden flex overflow-x-auto snap-x snap-mandatory gap-3.5 pb-4 -mx-4 px-4 scroll-smooth no-scrollbar touch-pan-x"
            >
              {queueColumns.map((col) => {
                const Icon = col.icon;
                return (
                  <div
                    key={col.id}
                    className={`w-[85vw] max-w-[340px] shrink-0 snap-center flex flex-col rounded-2xl bg-slate-100/70 dark:bg-[#10131B] border border-slate-200/90 dark:border-white/[0.08] p-3.5 shadow-sm h-[calc(100vh-270px)] min-h-[500px] max-h-[750px] border-t-4 ${col.borderTop}`}
                  >
                    {/* CABECERA DE LA COLUMNA MÓVIL */}
                    <div className="flex items-center justify-between pb-3 mb-2.5 border-b border-slate-200/80 dark:border-white/5 shrink-0">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                        <h3 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                          {col.title}
                        </h3>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${col.badgeColor}`}>
                        {col.count}
                      </span>
                    </div>

                    {/* LISTADO DE TARJETAS EN ESTA COLUMNA */}
                    <div className="space-y-3 flex-1 overflow-y-auto pr-1 py-1 focus:outline-none">
                      {col.orders.length === 0 ? (
                        <div className="h-full min-h-[180px] flex flex-col items-center justify-center p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-white/[0.08] text-slate-400 text-xs">
                          <Inbox className="w-7 h-7 text-slate-300 dark:text-slate-600 mb-2 opacity-50" />
                          <span className="font-semibold">Sin pedidos en {col.title.toLowerCase()}</span>
                          <span className="text-[11px] text-slate-400 mt-0.5">
                            Los pedidos aparecerán aquí según avancen en el flujo.
                          </span>
                        </div>
                      ) : (
                        col.orders.map(renderOrderCard)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* VISTA TABLERO MULTICOLUMNA PARA ESCRITORIO (LG+) CON DRAG & DROP Y ALTURA UNIFORME */}
            <div className="hidden lg:block overflow-x-auto pb-4 -mx-1 px-1">
              <div className="grid grid-cols-5 gap-4 items-stretch min-w-[1250px]">
              {queueColumns.map((col) => {
                const isColOver = dragOverColumnId === col.id;
                const activeDragId = draggingOrderIdRef.current || draggingOrderId;
                const draggingOrder = activeDragId ? localOrders.find((o) => o.id === activeDragId) : null;
                const isSelf = draggingOrder?.status === col.id;
                const isAllowedTarget = Boolean(
                  draggingOrder &&
                  !isSelf &&
                  VALID_ORDER_STATUS_TRANSITIONS[draggingOrder.status]?.includes(col.id as any)
                );

                return (
                  <div
                    key={col.id}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const currentDragId = draggingOrderIdRef.current || draggingOrderId;
                      if (!currentDragId) return;
                      if (dragOverColumnId !== col.id) {
                        setDragOverColumnId(col.id);
                      }
                      const currentOrder = localOrders.find((o) => o.id === currentDragId);
                      const isAllowed = Boolean(
                        currentOrder &&
                        currentOrder.status !== col.id &&
                        VALID_ORDER_STATUS_TRANSITIONS[currentOrder.status]?.includes(col.id as any)
                      );
                      e.dataTransfer.dropEffect = isAllowed ? "move" : "none";
                    }}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (dragOverColumnId !== col.id) {
                        setDragOverColumnId(col.id);
                      }
                    }}
                    onDragLeave={(e) => {
                      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                      if (dragOverColumnId === col.id) {
                        setDragOverColumnId(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const orderId = e.dataTransfer.getData("text/plain") || draggingOrderIdRef.current || draggingOrderId;
                      draggingOrderIdRef.current = null;
                      setDragOverColumnId(null);
                      setDraggingOrderId(null);
                      if (!orderId) return;
                      const targetOrder = localOrders.find((o) => o.id === orderId);
                      if (!targetOrder || targetOrder.status === col.id) return;
                      handleStatusTransition(targetOrder, col.id as any);
                    }}
                    className={`bg-slate-100/70 dark:bg-[#10131B] border rounded-2xl p-3.5 flex flex-col h-[calc(100vh-270px)] min-h-[620px] max-h-[820px] transition-all duration-200 border-t-4 ${col.borderTop} ${
                      isColOver
                        ? isAllowedTarget
                          ? "border-emerald-500/80 bg-emerald-50/20 dark:bg-emerald-500/10 ring-2 ring-emerald-500/30"
                          : "border-rose-500/80 bg-rose-50/20 dark:bg-rose-500/10 ring-2 ring-rose-500/30"
                        : "border-slate-200/90 dark:border-white/[0.08]"
                    }`}
                  >
                    {/* CABECERA DE LA COLUMNA (FIJA EN LA PARTE SUPERIOR) */}
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/80 dark:border-white/5 shrink-0">
                      <div className="flex items-center gap-2">
                        <col.icon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                        <h3 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                          {col.title}
                        </h3>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${col.badgeColor}`}>
                        {col.count}
                      </span>
                    </div>

                    {/* INDICADOR VISUAL DE ZONA DE SOLTAR CUANDO SE ARRASTRA */}
                    {isColOver && draggingOrder && !isSelf && (
                      <div
                        className={`shrink-0 mb-3 p-3 rounded-xl border-2 border-dashed text-xs font-bold text-center transition-all animate-in fade-in ${
                          isAllowedTarget
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                        }`}
                      >
                        {isAllowedTarget ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>Soltar para pasar a &ldquo;{col.title}&rdquo;</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>Transición no permitida</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* LISTADO DE TARJETAS EN LA COLUMNA CON SCROLL INDEPENDIENTE */}
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className="space-y-3 flex-1 min-h-0 overflow-y-auto pr-1.5 focus:outline-none"
                    >
                      {col.orders.length === 0 ? (
                        <div className="h-full min-h-[160px] flex flex-col items-center justify-center p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-white/[0.08] text-slate-400 text-xs">
                          <Inbox className="w-6 h-6 text-slate-300 dark:text-slate-600 mb-2 opacity-60" />
                          <span>Sin pedidos en este estado</span>
                        </div>
                      ) : (
                        col.orders.map(renderOrderCard)
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>

            {/* SECCIÓN COLAPSABLE O SECUNDARIA PARA CANCELADOS SI HAY REGISTROS */}
            {ordersByStatus.cancelled.length > 0 && (
              <details className="group rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] p-4">
                <summary className="flex items-center justify-between cursor-pointer list-none font-bold text-xs text-rose-600 dark:text-rose-400">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    <span>Pedidos Cancelados ({summary.cancelled})</span>
                  </div>
                  <span className="text-[11px] text-slate-400 group-open:rotate-180 transition-transform">
                    ▼
                  </span>
                </summary>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-white/5">
                  {ordersByStatus.cancelled.map(renderOrderCard)}
                </div>
              </details>
            )}

            {/* PAGINACIÓN INFERIOR PARA NAVEGAR HISTORIAL */}
            {initialData.totalPages > 1 && (
              <div className="pt-2">
                <Pagination
                  currentPage={initialData.currentPage}
                  totalPages={initialData.totalPages}
                  totalItems={initialData.totalCount}
                  currentCount={initialData.orders.length}
                  pageSize={30}
                  itemLabel="pedidos"
                  onPageChange={handlePageChange}
                  isPending={isPending}
                />
              </div>
            )}
          </div>
        ) : (
          /* TABLA TRADICIONAL / HISTORIAL COMPLETO */
          <DataTable<RestaurantOrderWithDetails>
            isLoading={isPending}
            data={filteredLocalOrders}
            columns={[
              {
                header: "Pedido",
                render: (order) => (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-slate-200 to-slate-100 dark:from-white/10 dark:to-white/5 border border-slate-200 dark:border-white/[0.08] flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-200 shrink-0">
                      <ShoppingBag className="w-4 h-4 text-slate-600 dark:text-slate-300" />
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
                  const typeBadge = getOrderTypeBadge(
      order.order_type,
      order.tableName,
      Boolean(order.pickup_code || order.notes?.includes("[PICKUP_PIN:"))
    );
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
                  const alert = getKdsAlertLevel(order.created_at, resolvedAlertConfig);
                  const isDeliveredOrCancelled = order.status === "delivered" || order.status === "cancelled";
                  return (
                    <div className="flex flex-col gap-1 items-start">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusBadge.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        <span>{statusBadge.label}</span>
                      </span>
                      {!isDeliveredOrCancelled && alert.level === "critical" && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 animate-pulse">
                          <Flame className="w-3 h-3 text-rose-500" />
                          <span>Crítico (+{alert.elapsedMinutes}m)</span>
                        </span>
                      )}
                      {!isDeliveredOrCancelled && alert.level === "warning" && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                          <span>Demorado (+{alert.elapsedMinutes}m)</span>
                        </span>
                      )}
                    </div>
                  );
                },
              },
              {
                header: "Pago",
                headerClassName: "whitespace-nowrap",
                className: "whitespace-nowrap",
                render: (order) => {
                  const payBadge = getPaymentStatusBadge(order.payment_status);
                  const PayIcon = payBadge.icon;
                  return (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium border ${payBadge.color}`}>
                      <PayIcon className="w-3 h-3 shrink-0" />
                      <span>{payBadge.label}</span>
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
                      {canUpdateOrder && order.status !== "delivered" && order.status !== "cancelled" && (
                        <button
                          type="button"
                          onClick={() => setEditingOrder(order)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#ED500A]/10 hover:bg-[#ED500A]/20 text-[#ED500A] transition-colors cursor-pointer"
                          title="Editar productos o responsable del pedido"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>
                      )}

                      {canUpdateOrder && statusBadge.nextAction && (
                        <button
                          type="button"
                          onClick={() =>
                            handleQuickStatusTransition(order, statusBadge.nextAction!.targetStatus)
                          }
                          disabled={isPending || updatingOrderId === order.id}
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
              icon: PackageOpen,
              title: hasActiveFilters ? "Sin resultados para estos filtros" : "No hay pedidos registrados todavía",
              description: hasActiveFilters
                ? "Prueba cambiando o limpiando los criterios de búsqueda para visualizar pedidos."
                : "Las órdenes generadas desde el Punto de venta (POS) o canales de venta aparecerán aquí de forma automática para el seguimiento operativo de preparación y entrega.",
              onReset: hasActiveFilters ? handleClearFilters : undefined,
              resetLabel: hasActiveFilters ? "Limpiar Filtros" : undefined,
            }}
            pagination={{
              currentPage: initialData.currentPage,
              totalPages: initialData.totalPages,
              totalItems: initialData.totalCount,
              currentCount: initialData.orders.length,
              pageSize: 30,
              itemLabel: "pedidos",
              onPageChange: handlePageChange,
              isPending,
            }}
          />
        )}

        {/* 5. MODAL DE CONFIRMACIÓN PARA CANCELAR PEDIDO */}
        <ConfirmDialog
          isOpen={cancelModal.isOpen && !!cancelModal.order}
          onClose={() => setCancelModal({ isOpen: false, order: null, reason: "" })}
          onConfirm={handleConfirmCancel}
          title="¿Cancelar este pedido?"
          description={
            cancelModal.order?.payment_status === "paid"
              ? `El pedido #${cancelModal.order?.order_number} cambiará a estado cancelado. ⚠️ ATENCIÓN: Este pedido ya registra pago (${formatCOP(cancelModal.order.total)}). Deberás tramitar la devolución correspondiente del dinero al cliente. Esta acción liberará la mesa (si aplica) y finalizará el pedido.`
              : `El pedido #${cancelModal.order?.order_number} cambiará a estado cancelado. Esta acción liberará la mesa asociada (si aplica) y detendrá su proceso operativo.`
          }
          confirmLabel="Cancelar Pedido"
          variant="destructive"
          isLoading={isPending}
          reasonValue={cancelModal.reason}
          onReasonChange={(val: string) => setCancelModal((prev) => ({ ...prev, reason: val }))}
          reasonLabel="Motivo de cancelación (Opcional)"
          reasonPlaceholder="Ej. Solicitud del cliente, error en comanda..."
          itemDetails={
            cancelModal.order
              ? [
                  { label: "Número de Pedido", value: `#${cancelModal.order.order_number}` },
                  { label: "Cliente", value: cancelModal.order.customer_name || "Cliente mostrador" },
                  { label: "Total", value: formatCOP(cancelModal.order.total) },
                  ...(cancelModal.order.payment_status === "paid"
                    ? [{ label: "⚠️ Devolución requerida", value: formatCOP(cancelModal.order.total) }]
                    : []),
                ]
              : undefined
          }
        />

        {/* 6. MODAL PARA REGISTRAR PAGO DEL PEDIDO CON MÉTODOS CONFIGURADOS */}
        <OrderPaymentModal
          isOpen={paymentModal.isOpen}
          order={paymentModal.order}
          paymentMethods={paymentMethods}
          isSubmitting={paymentModal.isSubmitting}
          onClose={() => setPaymentModal({ isOpen: false, order: null, isSubmitting: false })}
          onConfirm={handleConfirmPayment}
          formatCOP={formatCOP}
        />

        {/* 7. MODAL ACCESIBLE Y TÁCTIL PARA MOVER PEDIDO ENTRE COLUMNAS */}
        {moveModal.isOpen && moveModal.order && (
          <ModalPortal>
            <div className="fixed inset-0 m-0 p-4 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="move-modal-title"
                className="w-full max-w-md bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col font-body"
              >
                {/* HEADER */}
                <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center font-bold">
                      <Kanban className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 id="move-modal-title" className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                        Mover Pedido #{moveModal.order.order_number}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Estado actual: <span className="font-semibold text-slate-700 dark:text-slate-200">{statusLabels[moveModal.order.status] || moveModal.order.status}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMoveModal({ isOpen: false, order: null })}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* BODY */}
                <div className="p-5 space-y-3">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Selecciona el destino permitido para esta comanda según las reglas operativas:
                  </p>

                  <div className="space-y-2">
                    {(() => {
                      const order = moveModal.order;
                      const allowed = VALID_ORDER_STATUS_TRANSITIONS[order.status] || [];
                      if (allowed.length === 0) {
                        return (
                          <div className="p-4 text-center rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] text-xs text-slate-400">
                            Este pedido se encuentra en un estado final y no admite más transiciones.
                          </div>
                        );
                      }

                      const options = [
                        {
                          id: "received",
                          label: "Recibido",
                          desc: "Comanda pendiente en cocina",
                          icon: Clock,
                          color: "hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-500/10",
                        },
                        {
                          id: "in_preparation",
                          label: "En Preparación",
                          desc: "En proceso de alistamiento o preparación",
                          icon: Boxes,
                          color: "hover:border-amber-500 hover:bg-amber-50/50 dark:hover:bg-amber-500/10",
                        },
                        {
                          id: "ready",
                          label: "Listo para Entrega",
                          desc: "Artículos listos esperando despacho o entrega",
                          icon: CheckCircle2,
                          color: "hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-500/10",
                        },
                        {
                          id: "delivered",
                          label: "Entregado",
                          desc: "Despachado y entregado al cliente",
                          icon: PackageCheck,
                          color: "hover:border-slate-500 hover:bg-slate-50/50 dark:hover:bg-white/5",
                        },
                        {
                          id: "cancelled",
                          label: "Cancelar Pedido",
                          desc: "Anular pedido registrando motivo",
                          icon: XCircle,
                          color: "hover:border-rose-500 hover:bg-rose-50/50 dark:hover:bg-rose-500/10 text-rose-600 dark:text-rose-400",
                        },
                      ].filter((opt) => allowed.includes(opt.id as any) && opt.id !== order.status);

                      return options.map((opt) => {
                        const Icon = opt.icon;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              const target = moveModal.order;
                              setMoveModal({ isOpen: false, order: null });
                              if (target) {
                                handleStatusTransition(target, opt.id as any);
                              }
                            }}
                            className={`w-full p-3 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] flex items-center justify-between text-left transition-all ${opt.color}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center shrink-0">
                                <Icon className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="text-xs font-bold block text-slate-900 dark:text-white">
                                  {opt.label}
                                </span>
                                <span className="text-[11px] text-slate-400 block">{opt.desc}</span>
                              </div>
                            </div>
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* FOOTER */}
                <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setMoveModal({ isOpen: false, order: null })}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5 transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </ModalPortal>
        )}

        {/* MODAL DE DETALLE COMPLETO DE COMANDA / PEDIDO (4 SECCIONES CON ACCIONES DIRECTAS) */}
        <OrderDetailModal
          businessId={businessId}
          businessName={businessName}
          isOpen={detailModal.isOpen}
          order={detailModal.order}
          onClose={() => setDetailModal({ isOpen: false, order: null })}
          canUpdateOrder={canUpdateOrder}
          canCancelOrder={canCancelOrder}
          onEdit={(orderToEdit) => {
            setDetailModal({ isOpen: false, order: null });
            setEditingOrder(orderToEdit);
          }}
          onPay={(orderToPay) => {
            setDetailModal({ isOpen: false, order: null });
            setPaymentModal({
              isOpen: true,
              order: orderToPay,
              isSubmitting: false,
            });
          }}
          onCancel={(orderToCancel) => {
            setDetailModal({ isOpen: false, order: null });
            setCancelModal({
              isOpen: true,
              order: orderToCancel,
              reason: "",
            });
          }}
          onStatusTransition={(targetOrder, nextStatus) => {
            handleQuickStatusTransition(targetOrder, nextStatus);
          }}
          isUpdatingStatus={isPending}
          updatingOrderId={updatingOrderId}
        />

        {/* 8. MODAL PARA CONFIRMAR RECOGIDA CON PIN [POS-008] */}
        <ConfirmPickupModal
          businessId={businessId}
          isOpen={pickupModal.isOpen}
          order={pickupModal.order}
          onClose={() => setPickupModal({ isOpen: false, order: null })}
          onSuccess={(orderId) => {
            setLocalOrders((prev) =>
              prev.map((o) =>
                o.id === orderId
                  ? {
                      ...o,
                      status: "delivered",
                      pickup_confirmed_at: new Date().toISOString(),
                    }
                  : o
              )
            );
            router.refresh();
          }}
        />

        {/* 9. MODAL DE EDICIÓN DE COMANDA (PRODUCTOS, CANTIDADES, RESPONSABLE, DIFERENCIAS DE PAGO) */}
        {editingOrder && (
          <EditOrderModal
            businessId={businessId}
            order={editingOrder}
            isOpen={!!editingOrder}
            onClose={() => setEditingOrder(null)}
            onSave={(updatedOrder) => {
              setLocalOrders((prev) =>
                prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
              );
              setEditingOrder(null);
              startTransition(() => {
                router.refresh();
              });
            }}
          />
        )}
      </div>
    </AppPageContainer>
  );
}

// Icono auxiliar para transferencia móvil
function SmartphoneIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" strokeWidth="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
