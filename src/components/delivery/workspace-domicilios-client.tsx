"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import Link from "next/link";
import {
  Bike,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  MapPin,
  Phone,
  User,
  ExternalLink,
  Copy,
  Printer,
  Users,
  Plus,
  Key,
  ShieldCheck,
  Share2,
  MessageCircle,
  FileText,
  Search,
  Filter,
  RefreshCw,
  DollarSign,
  ArrowRight,
  Check,
  X,
  Navigation,
  Settings,
  Sliders,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Flame,
  ArrowLeft,
  Briefcase,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { RestaurantOrderWithDetails } from "@/lib/restaurant/types";
import { BusinessDocumentConfig } from "@/lib/documents/types";
import {
  OperationalDeliveryDriver,
  calculateDeliverySettlements,
} from "@/lib/delivery/delivery-service";
import {
  DeliveryBusinessConfig,
  DeliverySettlementSummary,
  DeliveryIssueType,
  DELIVERY_ISSUE_LABELS,
} from "@/lib/delivery/types";
import { ThermalTicketModal } from "@/components/printing/thermal-ticket";
import { ModalPortal } from "@/components/ui/modal-portal";
import { DeliveryZonesTab } from "@/components/delivery/delivery-zones-tab";
import { DeliveryConfigTab } from "@/components/delivery/delivery-config-tab";
import { DeliveryIntegrationsTab } from "@/components/delivery/delivery-integrations-tab";
import { createClient } from "@/lib/supabase/client";
import {
  getBusinessDeliveryOrdersAction,
  assignDriverToOrderAction,
  dispatchDeliveryOrderAction,
  confirmDeliveryWithExceptionAction,
  createOperationalDriverAction,
  toggleDriverStatusAction,
  updateOperationalDriverAction,
  getActiveCashSessionForLiquidationAction,
  liquidateDriverCashAction,
  reportDeliveryIssueAction,
} from "@/app/workspace/[businessId]/pedidos/domicilios/actions";

interface WorkspaceDomiciliosClientProps {
  businessId: string;
  businessName: string;
  tradeName?: string;
  businessTimezone: string;
  initialOrders: RestaurantOrderWithDetails[];
  initialDrivers: OperationalDeliveryDriver[];
  config: BusinessDocumentConfig;
  initialDeliveryConfig?: DeliveryBusinessConfig;
  defaultTab?: "dispatch" | "drivers" | "settlement" | "zones";
}

export function WorkspaceDomiciliosClient({
  businessId,
  businessName,
  tradeName,
  businessTimezone,
  initialOrders,
  initialDrivers,
  config,
  initialDeliveryConfig,
  defaultTab = "dispatch",
}: WorkspaceDomiciliosClientProps) {
  const [orders, setOrders] = useState<RestaurantOrderWithDetails[]>(initialOrders);
  const [drivers, setDrivers] = useState<OperationalDeliveryDriver[]>(initialDrivers);
  const [mainTab, setMainTab] = useState<"dispatch" | "drivers" | "settlement" | "zones">(defaultTab);
  const [dispatchFilter, setDispatchFilter] = useState<"all" | "pending" | "on_the_way" | "delivered" | "with_issue">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [isPending, startTransition] = useTransition();

  // Reloj reactivo de 1 segundo para semáforos y cronómetros de pedidos
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Supabase Realtime para reflejar nuevas comandas automáticamente
  useEffect(() => {
    let supabase: any = null;
    let channel: any = null;
    try {
      supabase = createClient();
      channel = supabase
        .channel(`workspace-domicilios-live-${businessId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "restaurant_orders",
            filter: `business_id=eq.${businessId}`,
          },
          () => {
            startTransition(async () => {
              const res = await getBusinessDeliveryOrdersAction(businessId);
              if (res.success && res.data) {
                setOrders(res.data);
              }
            });
          }
        )
        .subscribe();
    } catch (err) {
      console.warn("[WorkspaceDomiciliosClient] Error en Supabase Realtime:", err);
    }

    return () => {
      if (supabase && channel) {
        supabase.removeChannel(channel).catch(() => {});
      }
    };
  }, [businessId]);

  // Modales
  const [isNewDriverModalOpen, setIsNewDriverModalOpen] = useState(false);
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverPhone, setNewDriverPhone] = useState("");
  const [newDriverPin, setNewDriverPin] = useState("");
  const [isCreatingDriver, setIsCreatingDriver] = useState(false);

  // Modal de edición de repartidor
  const [editingDriver, setEditingDriver] = useState<OperationalDeliveryDriver | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPin, setEditPin] = useState("");
  const [isSavingDriver, setIsSavingDriver] = useState(false);

  // Modal de excepción de entrega
  const [exceptionOrder, setExceptionOrder] = useState<RestaurantOrderWithDetails | null>(null);
  const [exceptionReason, setExceptionReason] = useState("");
  const [isSubmittingException, setIsSubmittingException] = useState(false);

  // Modal de reporte de novedad
  const [issueOrder, setIssueOrder] = useState<RestaurantOrderWithDetails | null>(null);
  const [issueType, setIssueType] = useState<DeliveryIssueType>("customer_absent");
  const [issueNotes, setIssueNotes] = useState("");
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);

  // Modal de liquidación de caja
  const [settleModalDriver, setSettleModalDriver] = useState<DeliverySettlementSummary | null>(null);
  const [activeCashSession, setActiveCashSession] = useState<{ id: string; registerId: string; openedAt: string } | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [settleNotes, setSettleNotes] = useState("");
  const [isSubmittingSettlement, setIsSubmittingSettlement] = useState(false);
  const [settledRecordIds, setSettledRecordIds] = useState<string[]>([]);

  // Modal de tiquete térmico
  const [ticketOrder, setTicketOrder] = useState<RestaurantOrderWithDetails | null>(null);

  // Visibilidad de PINs en directorio
  const [visiblePins, setVisiblePins] = useState<Record<string, boolean>>({});

  // Sub-tab en Zonas y Tarifas
  const [zonesSubTab, setZonesSubTab] = useState<"tariffs" | "zones_map" | "integrations">("tariffs");

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

  /**
   * Cálculo de tiempos y semáforo visual para pedidos activos:
   * Verde: < 25 min (En tiempo)
   * Amarillo: 25 - 40 min (Atención)
   * Rojo: > 40 min (Retrasado / Urgente)
   */
  const getElapsedInfo = (isoDate: string) => {
    try {
      const createdMs = new Date(isoDate).getTime();
      const elapsedSeconds = Math.max(0, Math.floor((currentTime - createdMs) / 1000));
      const minutes = Math.floor(elapsedSeconds / 60);
      const seconds = elapsedSeconds % 60;

      const pad = (n: number) => n.toString().padStart(2, "0");
      const formatted = minutes >= 60
        ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
        : `${pad(minutes)}:${pad(seconds)}`;

      let level: "green" | "yellow" | "red" = "green";
      let label = "En tiempo";
      if (minutes >= 40) {
        level = "red";
        label = "Retrasado (>40 min)";
      } else if (minutes >= 25) {
        level = "yellow";
        label = "Atención requerida (25-40 min)";
      }

      return { minutes, seconds, formatted, level, label };
    } catch {
      return { minutes: 0, seconds: 0, formatted: "--:--", level: "green" as const, label: "En tiempo" };
    }
  };

  // 1. KPIs Superiores [DOM-006]
  const kpis = useMemo(() => {
    const activeDeliveryOrders = orders.filter(
      (o) => o.order_type === "delivery" && o.status !== "cancelled" && o.delivery_status !== "delivered"
    );
    const inRouteOrders = orders.filter(
      (o) => o.order_type === "delivery" && o.status !== "cancelled" && o.delivery_status === "on_the_way"
    );

    // Entregados hoy
    const todayStr = new Date().toISOString().slice(0, 10);
    const deliveredToday = orders.filter(
      (o) =>
        o.order_type === "delivery" &&
        (o.delivery_status === "delivered" || o.status === "delivered") &&
        (o.created_at?.slice(0, 10) === todayStr || o.updated_at?.slice(0, 10) === todayStr)
    );

    // Tiempo promedio de entrega hoy en minutos
    let avgDeliveryMinutes = 24; // fallback estimado si no hay suficientes datos
    if (deliveredToday.length > 0) {
      let totalMins = 0;
      let validCount = 0;
      for (const ord of deliveredToday) {
        const start = new Date(ord.created_at).getTime();
        const end = new Date(ord.updated_at || ord.created_at).getTime();
        const diffMins = Math.max(1, Math.round((end - start) / (1000 * 60)));
        if (diffMins < 240) { // filtrar outliers atípicos
          totalMins += diffMins;
          validCount += 1;
        }
      }
      if (validCount > 0) {
        avgDeliveryMinutes = Math.round(totalMins / validCount);
      }
    }

    // Liquidaciones de recaudos
    const settlements = calculateDeliverySettlements(orders, drivers, initialDeliveryConfig, settledRecordIds);
    const totalPendingCash = settlements.reduce((acc, s) => acc + s.pendingCashToSettle, 0);

    return {
      activeCount: activeDeliveryOrders.length,
      inRouteCount: inRouteOrders.length,
      avgDeliveryMinutes,
      deliveredTodayCount: deliveredToday.length,
      totalPendingCash,
      settlements,
    };
  }, [orders, drivers, initialDeliveryConfig, settledRecordIds]);

  // 2. Mapeo del estado en vivo de cada repartidor (Libre vs En ruta)
  const driversAvailability = useMemo(() => {
    const map = new Map<string, { activeCount: number; isEnRoute: boolean }>();
    for (const d of drivers) {
      const activeForDriver = orders.filter(
        (o) =>
          o.order_type === "delivery" &&
          o.status !== "cancelled" &&
          o.delivery_status !== "delivered" &&
          o.driver_name?.toLowerCase().trim() === d.name.toLowerCase().trim()
      );
      map.set(d.id, {
        activeCount: activeForDriver.length,
        isEnRoute: activeForDriver.length > 0,
      });
    }
    return map;
  }, [orders, drivers]);

  // 3. Filtrado de órdenes para la pestaña 'Despacho en Vivo'
  const filteredDispatchOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.order_type !== "delivery" || o.status === "cancelled") return false;

      const isDelivered = o.delivery_status === "delivered" || o.status === "delivered";
      const isOnTheWay = o.delivery_status === "on_the_way";
      const isPendingDispatch = !isDelivered && !isOnTheWay;
      const hasIssue = o.notes?.includes("[NOVEDAD:");

      if (dispatchFilter === "pending" && !isPendingDispatch) return false;
      if (dispatchFilter === "on_the_way" && !isOnTheWay) return false;
      if (dispatchFilter === "delivered" && !isDelivered) return false;
      if (dispatchFilter === "with_issue" && !hasIssue) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNum = String(o.order_number).includes(q);
        const matchAddr = o.delivery_address?.toLowerCase().includes(q) || false;
        const matchCust = o.customer_name?.toLowerCase().includes(q) || false;
        const matchPhone = o.customer_phone?.includes(q) || false;
        const matchDriver = o.driver_name?.toLowerCase().includes(q) || false;
        if (!matchNum && !matchAddr && !matchCust && !matchPhone && !matchDriver) {
          return false;
        }
      }

      return true;
    });
  }, [orders, dispatchFilter, searchQuery]);

  // Manejo de asignación rápida de domiciliario (1-clic)
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

  // Despachar comanda (en camino)
  const handleDispatch = async (order: RestaurantOrderWithDetails) => {
    startTransition(async () => {
      const res = await dispatchDeliveryOrderAction(businessId, order.id);
      if (res.success) {
        toast.success(`Pedido #${order.order_number} en camino con ${order.driver_name || "repartidor"} 🛵`);
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

  // Crear repartidor operativo con PIN de 6 dígitos
  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriverName.trim()) {
      toast.error("Ingresa el nombre del domiciliario.");
      return;
    }

    setIsCreatingDriver(true);
    const res = await createOperationalDriverAction(
      businessId,
      newDriverName.trim(),
      newDriverPhone.trim() || null
    );
    setIsCreatingDriver(false);

    if (res.success && res.driver) {
      toast.success(`Domiciliario creado. PIN de acceso: ${res.driver.accessPin}`);
      setDrivers((prev) => [...prev, res.driver!]);
      setNewDriverName("");
      setNewDriverPhone("");
      setNewDriverPin("");
      setIsNewDriverModalOpen(false);
    } else {
      toast.error(res.error || "No se pudo registrar el domiciliario.");
    }
  };

  // Guardar edición de repartidor
  const handleSaveDriverEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriver) return;
    if (!editName.trim()) {
      toast.error("El nombre no puede estar vacío.");
      return;
    }

    setIsSavingDriver(true);
    const res = await updateOperationalDriverAction(businessId, editingDriver.id, {
      name: editName.trim(),
      phone: editPhone.trim() || null,
      pin: editPin.trim() || undefined,
    });
    setIsSavingDriver(false);

    if (res.success && res.driver) {
      toast.success(`Datos de ${res.driver.name} actualizados.`);
      setDrivers((prev) =>
        prev.map((d) => (d.id === editingDriver.id ? res.driver! : d))
      );
      setEditingDriver(null);
    } else {
      toast.error(res.error || "Error al actualizar domiciliario.");
    }
  };

  // Regenerar PIN de 6 dígitos
  const handleRegeneratePin = async (driverId: string) => {
    const res = await updateOperationalDriverAction(businessId, driverId, {
      regeneratePin: true,
    });
    if (res.success && res.driver) {
      toast.success(`Nuevo PIN generado para ${res.driver.name}: ${res.driver.accessPin}`);
      setDrivers((prev) =>
        prev.map((d) => (d.id === driverId ? res.driver! : d))
      );
      if (editingDriver && editingDriver.id === driverId) {
        setEditPin(res.driver.accessPin);
      }
    } else {
      toast.error(res.error || "No se pudo regenerar el PIN.");
    }
  };

  // Habilitar / Revocar repartidor
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

  // Confirmar por excepción supervisada
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

  // Registrar novedad
  const handleReportIssue = async () => {
    if (!issueOrder) return;
    if (!issueNotes.trim() || issueNotes.trim().length < 3) {
      toast.error("Describe la novedad ocurrida.");
      return;
    }

    setIsSubmittingIssue(true);
    const res = await reportDeliveryIssueAction(
      businessId,
      issueOrder.id,
      issueType,
      issueNotes.trim()
    );
    setIsSubmittingIssue(false);

    if (res.success) {
      toast.success("Novedad registrada con éxito en el pedido.");
      const updatedNotes = issueOrder.notes
        ? `${issueOrder.notes}\n[NOVEDAD: ${DELIVERY_ISSUE_LABELS[issueType]}: ${issueNotes.trim()}]`
        : `[NOVEDAD: ${DELIVERY_ISSUE_LABELS[issueType]}: ${issueNotes.trim()}]`;

      setOrders((prev) =>
        prev.map((o) => (o.id === issueOrder.id ? { ...o, notes: updatedNotes } : o))
      );
      setIssueOrder(null);
      setIssueNotes("");
    } else {
      toast.error(res.error || "Error al registrar la novedad.");
    }
  };

  // Abrir modal de liquidación de caja
  const handleOpenSettlement = async (settlement: DeliverySettlementSummary) => {
    setSettleModalDriver(settlement);
    setSettleNotes("");
    setIsLoadingSession(true);
    const sessionRes = await getActiveCashSessionForLiquidationAction(businessId);
    setIsLoadingSession(false);

    if (sessionRes.success && sessionRes.session) {
      setActiveCashSession(sessionRes.session);
    } else {
      setActiveCashSession(null);
    }
  };

  // Confirmar liquidación a caja activa
  const handleConfirmSettlement = async () => {
    if (!settleModalDriver) return;
    if (!activeCashSession) {
      toast.error("No hay ninguna sesión de caja abierta en este momento.");
      return;
    }

    setIsSubmittingSettlement(true);
    const res = await liquidateDriverCashAction(businessId, {
      driverId: settleModalDriver.driverId,
      driverName: settleModalDriver.driverName,
      amount: settleModalDriver.pendingCashToSettle,
      sessionId: activeCashSession.id,
      notes: settleNotes.trim() || undefined,
      orderIds: settleModalDriver.orderIds,
    });
    setIsSubmittingSettlement(false);

    if (res.success) {
      toast.success(
        `¡Liquidación exitosa! Se ingresaron ${formatCOP(settleModalDriver.pendingCashToSettle)} a la caja activa.`
      );
      setSettledRecordIds((prev) => [...prev, ...settleModalDriver.orderIds]);
      setSettleModalDriver(null);
    } else {
      toast.error(res.error || "Error al procesar la liquidación a caja.");
    }
  };

  // Copiar al portapapeles
  const copyToClipboard = (text: string, msg: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success(msg);
    }
  };

  return (
    <AppPageContainer
      title="Gestión de Domicilios y Reparto"
      description="Despacho en vivo, directorio de repartidores sin consumo de licencias, liquidación de caja y tarifas."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setNewDriverName("");
              setNewDriverPhone("");
              setIsNewDriverModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#ED500A] hover:bg-[#ED500A]/90 text-white shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nuevo Repartidor</span>
          </button>

          <Link
            href={`/workspace/${businessId}/pedidos`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Ver Comandas</span>
          </Link>
        </div>
      }
      maxWidth="7xl"
    >
      <div className="space-y-6">
        {/* 5 KPIS PRINCIPALES [DOM-006] */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* 1. Domicilios Activos */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Activos
              </span>
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1.5">
              {kpis.activeCount}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              En cocina o por entregar
            </p>
          </div>

          {/* 2. En Ruta */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                En Ruta 🛵
              </span>
              <Bike className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1.5">
              {kpis.inRouteCount}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              En tránsito con repartidor
            </p>
          </div>

          {/* 3. Tiempo Promedio de Entrega */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                Tiempo Prom.
              </span>
              <Clock className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1.5 font-mono">
              {kpis.avgDeliveryMinutes} min
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              ETA promedio hoy
            </p>
          </div>

          {/* 4. Entregados Hoy */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Entregados Hoy
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5">
              {kpis.deliveredTodayCount}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Comandas completadas
            </p>
          </div>

          {/* 5. Efectivo Pendiente por Liquidar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                Efectivo a Liquidar
              </span>
              <DollarSign className="w-4 h-4 text-orange-500" />
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-1.5 font-mono truncate">
              {formatCOP(kpis.totalPendingCash)}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              En manos de repartidores
            </p>
          </div>
        </div>

        {/* NAVEGACIÓN PRINCIPAL POR PESTAÑAS */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/[0.08] pb-3 overflow-x-auto">
          <button
            type="button"
            onClick={() => setMainTab("dispatch")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              mainTab === "dispatch"
                ? "bg-[#ED500A] text-white shadow-xs"
                : "bg-white dark:bg-[#0D0F16] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/[0.08] hover:bg-slate-50"
            }`}
          >
            <Bike className="w-3.5 h-3.5" />
            <span>Despacho en Vivo</span>
            {kpis.activeCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                mainTab === "dispatch" ? "bg-white text-[#ED500A]" : "bg-[#ED500A] text-white"
              }`}>
                {kpis.activeCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMainTab("drivers")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              mainTab === "drivers"
                ? "bg-[#ED500A] text-white shadow-xs"
                : "bg-white dark:bg-[#0D0F16] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/[0.08] hover:bg-slate-50"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Repartidores ({drivers.filter((d) => d.isActive).length})</span>
          </button>

          <button
            type="button"
            onClick={() => setMainTab("settlement")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              mainTab === "settlement"
                ? "bg-[#ED500A] text-white shadow-xs"
                : "bg-white dark:bg-[#0D0F16] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/[0.08] hover:bg-slate-50"
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Liquidación y Arqueo</span>
            {kpis.totalPendingCash > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                mainTab === "settlement" ? "bg-white text-[#ED500A]" : "bg-amber-500 text-white"
              }`}>
                $
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMainTab("zones")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              mainTab === "zones"
                ? "bg-[#ED500A] text-white shadow-xs"
                : "bg-white dark:bg-[#0D0F16] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/[0.08] hover:bg-slate-50"
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Zonas y Tarifas</span>
          </button>
        </div>

        {/* ============================================================ */}
        {/* PESTAÑA 1: DESPACHO EN VIVO */}
        {/* ============================================================ */}
        {mainTab === "dispatch" && (
          <div className="space-y-4">
            {/* SUB-FILTROS Y BUSCADOR */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#0D0F16] p-3 rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-xs">
              <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-100 dark:bg-white/5 rounded-xl">
                {[
                  { id: "all", label: `Todos (${orders.filter((o) => o.order_type === "delivery" && o.status !== "cancelled").length})` },
                  { id: "pending", label: `Por Despachar (${kpis.activeCount - kpis.inRouteCount})` },
                  { id: "on_the_way", label: `En Camino 🛵 (${kpis.inRouteCount})` },
                  { id: "delivered", label: `Entregados (${orders.filter((o) => o.order_type === "delivery" && o.delivery_status === "delivered").length})` },
                  { id: "with_issue", label: `Con Novedad (${orders.filter((o) => o.notes?.includes("[NOVEDAD:")).length})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDispatchFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      dispatchFilter === tab.id
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
                  placeholder="Buscar comanda, dirección, cliente..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* LISTADO DE PEDIDOS DE DESPACHO */}
            {filteredDispatchOrders.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] space-y-3">
                <Bike className="w-12 h-12 text-slate-300 dark:text-white/20 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  No hay pedidos a domicilio en este filtro
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Los nuevos pedidos con destino Domicilio registrados en POS o WhatsApp aparecerán automáticamente aquí en tiempo real.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDispatchOrders.map((order) => {
                  const isDelivered = order.delivery_status === "delivered" || order.status === "delivered";
                  const isOnTheWay = order.delivery_status === "on_the_way";
                  const isPaid = order.payment_status === "paid";
                  const elapsed = getElapsedInfo(order.created_at);
                  const hasIssue = order.notes?.includes("[NOVEDAD:");

                  return (
                    <div
                      key={order.id}
                      className={`bg-white dark:bg-[#0D0F16] border rounded-2xl shadow-xs p-5 space-y-4 transition-all ${
                        hasIssue
                          ? "border-rose-300 dark:border-rose-500/40 bg-rose-50/20"
                          : elapsed.level === "red" && !isDelivered
                          ? "border-rose-300 dark:border-rose-500/30"
                          : elapsed.level === "yellow" && !isDelivered
                          ? "border-amber-300 dark:border-amber-500/30"
                          : "border-slate-200 dark:border-white/[0.08] hover:border-slate-300"
                      }`}
                    >
                      {/* ENCABEZADO DE ORDEN */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center font-mono font-bold text-sm shrink-0">
                            #{order.order_number}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base font-bold text-slate-900 dark:text-white font-mono">
                                ORD-{order.order_number}
                              </h3>

                              {/* SEMÁFORO VISUAL DE TIEMPO (VERDE <25m, AMARILLO 25-40m, ROJO >40m) */}
                              {!isDelivered && (
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                    elapsed.level === "red"
                                      ? "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-500/30 animate-pulse"
                                      : elapsed.level === "yellow"
                                      ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/30"
                                      : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30"
                                  }`}
                                  title={elapsed.label}
                                >
                                  <Clock className="w-3 h-3" />
                                  <span className="font-mono">{elapsed.formatted}</span>
                                </span>
                              )}

                              {/* BADGE DE ESTADO */}
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

                              {/* BADGE DE PAGO */}
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  isPaid
                                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 border-emerald-200"
                                    : "bg-amber-50 dark:bg-amber-500/10 text-amber-800 border-amber-200"
                                }`}
                              >
                                {isPaid ? "PAGADO" : "COBRAR AL CLIENTE"}
                              </span>

                              {hasIssue && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  NOVEDAD REGISTRADA
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {formatDate(order.created_at)}
                            </p>
                          </div>
                        </div>

                        {/* TOTAL */}
                        <div className="sm:text-right flex sm:flex-col justify-between items-center sm:items-end gap-1">
                          <span className="text-xs text-slate-400">Total comanda</span>
                          <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                            {formatCOP(order.total)}
                          </span>
                        </div>
                      </div>

                      {/* DETALLES DE ENTREGA Y CÓDIGO */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/70 dark:bg-white/[0.02] p-4 rounded-xl border border-slate-200/80 dark:border-white/5">
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
                                    `Hola ${order.customer_name || ""}! Tu pedido #${order.order_number} de ${
                                      tradeName || businessName
                                    } va en camino a ${order.delivery_address}. Tu código de entrega de 4 dígitos es: ${
                                      order.delivery_verification_code || ""
                                    }. ¡Gracias por tu compra!`
                                  )}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold hover:opacity-90"
                                >
                                  <MessageCircle className="w-3 h-3" />
                                  <span>WhatsApp Cliente</span>
                                </a>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* BLOQUE CÓDIGO DE VERIFICACIÓN (4 DÍGITOS) */}
                        <div className="p-3 bg-white dark:bg-[#0D0F16] rounded-xl border border-slate-200 dark:border-white/[0.08] flex flex-col justify-between gap-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                              <span>PIN de Entrega</span>
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
                                    "Código PIN de verificación copiado."
                                  )
                                }
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                                title="Copiar código"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <p className="text-[10px] text-slate-400 leading-tight">
                            El cliente debe dictar este PIN al repartidor en puerta.
                          </p>
                        </div>
                      </div>

                      {/* NOTAS Y NOVEDADES REGISTRADAS */}
                      {order.notes && (
                        <div className="text-xs bg-slate-50 dark:bg-white/[0.02] p-2.5 rounded-xl border border-slate-200/60 dark:border-white/5 space-y-1">
                          <span className="font-semibold text-slate-500 text-[10px] uppercase">
                            Notas del pedido y auditoría:
                          </span>
                          <p className="text-slate-700 dark:text-slate-300 whitespace-pre-line font-mono text-[11px]">
                            {order.notes}
                          </p>
                        </div>
                      )}

                      {/* BARRA DE ASIGNACIÓN 1-CLIC Y ACCIONES */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-white/5">
                        {/* Selector de Repartidor con Indicador de Estado */}
                        <div className="flex items-center gap-2 min-w-[240px]">
                          <span className="text-xs text-slate-500 font-semibold">Repartidor:</span>
                          <select
                            disabled={isPending || isDelivered}
                            value={order.driver_name || ""}
                            onChange={(e) => handleAssignDriver(order.id, e.target.value)}
                            className="text-xs font-semibold bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl px-2.5 py-1.5 text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 cursor-pointer disabled:opacity-50"
                          >
                            <option value="">-- Sin asignar --</option>
                            {drivers
                              .filter((d) => d.isActive)
                              .map((d) => {
                                const availability = driversAvailability.get(d.id);
                                const statusText = availability?.isEnRoute
                                  ? `🟡 (En ruta - ${availability.activeCount})`
                                  : "🟢 (Libre)";
                                return (
                                  <option key={d.id} value={d.name}>
                                    {d.name} {statusText}
                                  </option>
                                );
                              })}
                            {order.driver_name &&
                              !drivers.some((d) => d.name === order.driver_name) && (
                                <option value={order.driver_name}>{order.driver_name}</option>
                              )}
                          </select>
                        </div>

                        {/* Botones de acción */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Imprimir Comanda */}
                          <button
                            type="button"
                            onClick={() => setTicketOrder(order)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Tiquete</span>
                          </button>

                          {/* Despachar pedido */}
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

                          {/* Reportar Novedad */}
                          {!isDelivered && (
                            <button
                              type="button"
                              onClick={() => {
                                setIssueOrder(order);
                                setIssueType("customer_absent");
                                setIssueNotes("");
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 transition-colors cursor-pointer"
                              title="Registrar incidencia en la entrega"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              <span>Novedad</span>
                            </button>
                          )}

                          {/* Excepción supervisada */}
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
          </div>
        )}

        {/* ============================================================ */}
        {/* PESTAÑA 2: REPARTIDORES OPERATIVOS (SIN CONSUMO DE LICENCIAS) */}
        {/* ============================================================ */}
        {mainTab === "drivers" && (
          <div className="space-y-4">
            {/* BANNER INFORMATIVO */}
            <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-indigo-600 text-white shrink-0 mt-0.5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                    Perfiles Operativos Ligeros sin Consumo de Cupos
                  </h4>
                  <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80 mt-0.5 leading-relaxed">
                    Los domiciliarios acceden únicamente a su portal móvil de entregas con un PIN numérico de 6 dígitos o enlace seguro. <strong>No consumen cupos de usuarios de tu plan NEGOVA</strong>.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setNewDriverName("");
                  setNewDriverPhone("");
                  setIsNewDriverModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Nuevo Domiciliario</span>
              </button>
            </div>

            {/* DIRECTORIO DE DOMICILIARIOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {drivers.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] col-span-full space-y-2">
                  <Users className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-400">
                    Aún no tienes repartidores configurados. Haz clic en "+ Nuevo Domiciliario" para generar el primer acceso.
                  </p>
                </div>
              ) : (
                drivers.map((d) => {
                  const availability = driversAvailability.get(d.id);
                  const isVisible = visiblePins[d.id] || false;
                  const origin = typeof window !== "undefined" ? window.location.origin : "";
                  const portalUrl = `${origin}/reparto/${businessId}?pin=${d.accessPin}`;

                  // Pedidos asignados y entregados hoy por este repartidor
                  const assignedOrders = orders.filter(
                    (o) =>
                      o.order_type === "delivery" &&
                      o.status !== "cancelled" &&
                      o.delivery_status !== "delivered" &&
                      o.driver_name?.toLowerCase().trim() === d.name.toLowerCase().trim()
                  );
                  const deliveredOrders = orders.filter(
                    (o) =>
                      o.order_type === "delivery" &&
                      o.delivery_status === "delivered" &&
                      o.driver_name?.toLowerCase().trim() === d.name.toLowerCase().trim()
                  );

                  return (
                    <div
                      key={d.id}
                      className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-3">
                        {/* CABECERA CON ESTADO */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-700 dark:text-slate-300 font-bold text-sm">
                              {d.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                {d.name}
                              </h3>
                              <p className="text-xs text-slate-400">
                                {d.phone ? `Tel: ${d.phone}` : "Sin celular registrado"}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              !d.isActive
                                ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400"
                                : availability?.isEnRoute
                                ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400"
                            }`}
                          >
                            {!d.isActive
                              ? "Revocado"
                              : availability?.isEnRoute
                              ? `En ruta (${availability.activeCount})`
                              : "Libre"}
                          </span>
                        </div>

                        {/* PIN DE ACCESO OPERATIVO (6 DÍGITOS) */}
                        <div className="p-3 bg-slate-50 dark:bg-white/[0.02] rounded-xl border border-slate-200 dark:border-white/5 space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="font-semibold flex items-center gap-1">
                              <Key className="w-3 h-3 text-[#ED500A]" />
                              PIN de Acceso
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setVisiblePins((prev) => ({ ...prev, [d.id]: !prev[d.id] }))
                              }
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                            >
                              {isVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-lg font-mono font-black text-slate-900 dark:text-white tracking-widest">
                              {isVisible ? d.accessPin : "••••••"}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(d.accessPin, "PIN copiado al portapapeles.")}
                              className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-white"
                              title="Copiar PIN"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* RESUMEN OPERATIVO */}
                        <div className="grid grid-cols-2 gap-2 text-center text-xs">
                          <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5">
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">En curso</span>
                            <div className="font-bold text-slate-900 dark:text-white text-sm">
                              {assignedOrders.length}
                            </div>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5">
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">Entregados hoy</span>
                            <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                              {deliveredOrders.length}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ACCIONES DEL DOMICILIARIO */}
                      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/5">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(portalUrl, "Enlace directo del portal copiado.")}
                            className="w-full py-1.5 px-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copiar link</span>
                          </button>

                          {d.phone ? (
                            <a
                              href={`https://wa.me/57${d.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                                `¡Hola ${d.name}! Tu portal de domicilios en ${
                                  tradeName || businessName
                                } está listo. Accede con este enlace: ${portalUrl} o utiliza tu PIN: ${d.accessPin}`
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="w-full py-1.5 px-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20 hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>WhatsApp</span>
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingDriver(d);
                                setEditName(d.name);
                                setEditPhone("");
                                setEditPin(d.accessPin);
                              }}
                              className="w-full py-1.5 px-2 rounded-xl text-xs font-semibold text-slate-400 bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10"
                            >
                              + Celular
                            </button>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDriver(d);
                              setEditName(d.name);
                              setEditPhone(d.phone || "");
                              setEditPin(d.accessPin);
                            }}
                            className="text-slate-500 hover:text-slate-900 dark:hover:text-white font-semibold cursor-pointer"
                          >
                            Editar datos
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleDriverStatus(d.id, d.isActive)}
                            className={`font-semibold cursor-pointer ${
                              d.isActive
                                ? "text-rose-600 hover:text-rose-700"
                                : "text-emerald-600 hover:text-emerald-700"
                            }`}
                          >
                            {d.isActive ? "Revocar PIN" : "Reactivar"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* PESTAÑA 3: CONTROL DE RECAUDO, LIQUIDACIÓN Y ARQUEO */}
        {/* ============================================================ */}
        {mainTab === "settlement" && (
          <div className="space-y-6">
            {/* RESUMEN FINANCIERO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs">
                <span className="text-xs text-slate-500 font-semibold uppercase">Total Recaudado en Efectivo</span>
                <div className="text-xl font-black text-slate-900 dark:text-white mt-1 font-mono">
                  {formatCOP(
                    kpis.settlements.reduce((acc, s) => acc + s.totalCashCollected, 0)
                  )}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs">
                <span className="text-xs text-slate-500 font-semibold uppercase">Cobros Digitales / Online</span>
                <div className="text-xl font-black text-slate-900 dark:text-white mt-1 font-mono">
                  {formatCOP(
                    kpis.settlements.reduce((acc, s) => acc + s.totalDigitalCollected, 0)
                  )}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs">
                <span className="text-xs text-slate-500 font-semibold uppercase">Fletes Asignados</span>
                <div className="text-xl font-black text-slate-900 dark:text-white mt-1 font-mono">
                  {formatCOP(
                    kpis.settlements.reduce((acc, s) => acc + s.driverDeliveryFeeShare, 0)
                  )}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-orange-200 dark:border-orange-500/20 bg-orange-50/20 shadow-xs">
                <span className="text-xs text-orange-600 dark:text-orange-400 font-bold uppercase">
                  Pendiente por Ingresar a Caja
                </span>
                <div className="text-xl font-black text-orange-600 dark:text-orange-400 mt-1 font-mono">
                  {formatCOP(kpis.totalPendingCash)}
                </div>
              </div>
            </div>

            {/* TABLA DE LIQUIDACIÓN POR REPARTIDOR */}
            <div className="bg-white dark:bg-[#0D0F16] rounded-2xl border border-slate-200 dark:border-white/[0.08] overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Arqueo de Recaudos por Domiciliario
                  </h3>
                  <p className="text-xs text-slate-500">
                    Liquida el efectivo físico recaudado directamente a una sesión de caja activa de NEGOVA.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-white/[0.02] text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-100 dark:border-white/5">
                    <tr>
                      <th className="p-3.5">Domiciliario</th>
                      <th className="p-3.5 text-center">Entregas</th>
                      <th className="p-3.5 text-right">Efectivo Cobrado</th>
                      <th className="p-3.5 text-right">Digital / Transferencia</th>
                      <th className="p-3.5 text-right">Total Pedidos</th>
                      <th className="p-3.5 text-center">Estado</th>
                      <th className="p-3.5 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                    {kpis.settlements.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400 font-sans">
                          No hay repartidores registrados en este negocio.
                        </td>
                      </tr>
                    ) : (
                      kpis.settlements.map((s) => (
                        <tr key={s.driverId} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01]">
                          <td className="p-3.5 font-sans">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {s.driverName}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {s.driverPhone || "Sin celular"}
                            </div>
                          </td>

                          <td className="p-3.5 text-center font-bold text-slate-700 dark:text-slate-300">
                            {s.totalOrdersDelivered}
                          </td>

                          <td className="p-3.5 text-right font-black text-slate-900 dark:text-white">
                            {formatCOP(s.totalCashCollected)}
                          </td>

                          <td className="p-3.5 text-right text-slate-600 dark:text-slate-400">
                            {formatCOP(s.totalDigitalCollected)}
                          </td>

                          <td className="p-3.5 text-right font-bold text-slate-900 dark:text-white">
                            {formatCOP(s.totalRevenue)}
                          </td>

                          <td className="p-3.5 text-center font-sans">
                            {s.pendingCashToSettle === 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                                <Check className="w-3 h-3" />
                                Al Día
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20">
                                Pendiente: {formatCOP(s.pendingCashToSettle)}
                              </span>
                            )}
                          </td>

                          <td className="p-3.5 text-right font-sans">
                            {s.pendingCashToSettle > 0 ? (
                              <button
                                type="button"
                                onClick={() => handleOpenSettlement(s)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                                <span>Liquidar Turno</span>
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Liquidado</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* PESTAÑA 4: ZONAS Y TARIFAS */}
        {/* ============================================================ */}
        {mainTab === "zones" && (
          <div className="space-y-4">
            {/* SUB-PESTAÑAS DE CONFIGURACIÓN */}
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/[0.08] pb-2">
              <button
                type="button"
                onClick={() => setZonesSubTab("tariffs")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  zonesSubTab === "tariffs"
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                }`}
              >
                Reglas de Tarifas y Tiempos
              </button>
              <button
                type="button"
                onClick={() => setZonesSubTab("zones_map")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  zonesSubTab === "zones_map"
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                }`}
              >
                Zonas Geográficas
              </button>
              <button
                type="button"
                onClick={() => setZonesSubTab("integrations")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  zonesSubTab === "integrations"
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                }`}
              >
                Integraciones (Rappi / Justo)
              </button>
            </div>

            {zonesSubTab === "tariffs" && (
              <DeliveryConfigTab
                businessId={businessId}
                initialConfig={initialDeliveryConfig}
              />
            )}

            {zonesSubTab === "zones_map" && (
              <DeliveryZonesTab businessId={businessId} />
            )}

            {zonesSubTab === "integrations" && (
              <DeliveryIntegrationsTab businessId={businessId} />
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL CREAR REPARTIDOR OPERATIVO */}
        {/* ============================================================ */}
        {isNewDriverModalOpen && (
          <ModalPortal>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 m-0 animate-in fade-in">
              <div className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-[#ED500A]/10 text-[#ED500A]">
                      <Bike className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        Nuevo Domiciliario
                      </h3>
                      <p className="text-xs text-slate-500">
                        No consume cupos de usuarios de tu plan
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNewDriverModalOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateDriver} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nombre del Domiciliario *
                    </label>
                    <input
                      type="text"
                      required
                      value={newDriverName}
                      onChange={(e) => setNewDriverName(e.target.value)}
                      placeholder="Ej. Carlos Domicilios"
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Teléfono Celular (Opcional)
                    </label>
                    <input
                      type="tel"
                      value={newDriverPhone}
                      onChange={(e) => setNewDriverPhone(e.target.value)}
                      placeholder="Ej. 310 123 4567"
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Permite enviar el enlace privado con PIN directamente por WhatsApp.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-white/[0.02] rounded-xl border border-slate-100 dark:border-white/5 text-xs text-slate-500 space-y-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      PIN Numérico Autogenerado
                    </span>
                    <p className="text-[11px]">
                      Se generará automáticamente un PIN seguro de 6 dígitos para su acceso exclusivo al portal móvil de reparto.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                    <button
                      type="button"
                      onClick={() => setIsNewDriverModalOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingDriver || !newDriverName.trim()}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-[#ED500A] hover:bg-[#ED500A]/90 text-white shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      {isCreatingDriver ? "Creando..." : "Crear Domiciliario"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </ModalPortal>
        )}

        {/* ============================================================ */}
        {/* MODAL EDITAR REPARTIDOR */}
        {/* ============================================================ */}
        {editingDriver && (
          <ModalPortal>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 m-0 animate-in fade-in">
              <div className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Editar Domiciliario
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingDriver(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveDriverEdit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Teléfono Celular
                    </label>
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="Ej. 310 123 4567"
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        PIN de Acceso (6 dígitos)
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRegeneratePin(editingDriver.id)}
                        className="text-[11px] font-bold text-[#ED500A] hover:underline cursor-pointer"
                      >
                        Regenerar PIN Aleatorio
                      </button>
                    </div>
                    <input
                      type="text"
                      maxLength={6}
                      value={editPin}
                      onChange={(e) => setEditPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="w-full px-3 py-2 text-sm font-mono font-bold tracking-widest bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                    <button
                      type="button"
                      onClick={() => setEditingDriver(null)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingDriver || !editName.trim()}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-[#ED500A] hover:bg-[#ED500A]/90 text-white shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      {isSavingDriver ? "Guardando..." : "Guardar Cambios"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </ModalPortal>
        )}

        {/* ============================================================ */}
        {/* MODAL DE LIQUIDACIÓN A CAJA ACTIVA */}
        {/* ============================================================ */}
        {settleModalDriver && (
          <ModalPortal>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 m-0 animate-in fade-in">
              <div className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                <div className="flex items-center gap-2.5 text-emerald-600">
                  <DollarSign className="w-6 h-6 shrink-0" />
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Liquidar Recaudo a Caja Activa
                    </h3>
                    <p className="text-xs text-slate-500">
                      Domiciliario: {settleModalDriver.driverName}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 space-y-1">
                  <span className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
                    Monto Físico a Ingresar a Caja:
                  </span>
                  <div className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400">
                    {formatCOP(settleModalDriver.pendingCashToSettle)}
                  </div>
                  <p className="text-[11px] text-emerald-700/80">
                    Correspondiente a {settleModalDriver.cashOrdersCount} pedidos cobrados en efectivo.
                  </p>
                </div>

                {isLoadingSession ? (
                  <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#ED500A]" />
                    <span>Verificando sesiones de caja abiertas...</span>
                  </div>
                ) : activeCashSession ? (
                  <div className="p-3 bg-slate-50 dark:bg-white/[0.02] rounded-xl border border-slate-200 dark:border-white/5 space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Caja Activa Detectada</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                      Sesión ID: {activeCashSession.id}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      El dinero ingresará con trazabilidad y concepto de "Liquidación de domiciliario".
                    </p>
                  </div>
                ) : (
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertCircle className="w-4 h-4" />
                      <span>No hay ninguna caja abierta</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      Para ingresar este efectivo físico a NEGOVA, debes abrir primero un turno en el módulo de Cajas.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Observaciones / Notas (Opcional)
                  </label>
                  <input
                    type="text"
                    value={settleNotes}
                    onChange={(e) => setSettleNotes(e.target.value)}
                    placeholder="Ej. Liquidación turno tarde entregada en sobre..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => setSettleModalDriver(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isSubmittingSettlement || !activeCashSession}
                    onClick={handleConfirmSettlement}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingSettlement ? "Registrando..." : "Confirmar Ingreso a Caja"}
                  </button>
                </div>
              </div>
            </div>
          </ModalPortal>
        )}

        {/* ============================================================ */}
        {/* MODAL REPORTAR NOVEDAD */}
        {/* ============================================================ */}
        {issueOrder && (
          <ModalPortal>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 m-0 animate-in fade-in">
              <div className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                <div className="flex items-center gap-2.5 text-rose-600">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Reportar Novedad de Entrega
                  </h3>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-white/[0.02] rounded-xl text-xs space-y-1 font-mono">
                  <div>Pedido: #{issueOrder.order_number}</div>
                  <div>Destinatario: {issueOrder.customer_name || "Cliente"}</div>
                  <div>Dirección: {issueOrder.delivery_address}</div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Tipo de Incidencia *
                    </label>
                    <select
                      value={issueType}
                      onChange={(e) => setIssueType(e.target.value as DeliveryIssueType)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white font-semibold cursor-pointer"
                    >
                      {Object.entries(DELIVERY_ISSUE_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Detalle de la novedad *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={issueNotes}
                      onChange={(e) => setIssueNotes(e.target.value)}
                      placeholder="Ej. Se llamó 3 veces al timbre y celular sin respuesta. Repartidor esperó 10 min..."
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/30"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => setIssueOrder(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isSubmittingIssue || issueNotes.trim().length < 3}
                    onClick={handleReportIssue}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingIssue ? "Guardando..." : "Registrar Novedad"}
                  </button>
                </div>
              </div>
            </div>
          </ModalPortal>
        )}

        {/* ============================================================ */}
        {/* MODAL EXCEPCIÓN SUPERVISADA */}
        {/* ============================================================ */}
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
                  Utiliza este procedimiento cuando el destinatario haya extraviado su código o no tenga batería en su teléfono. Esta acción quedará registrada en el log de auditoría.
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
                    placeholder="Ej. Cliente recibió personalmente, código no recibido por falla en teléfono..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => setExceptionOrder(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isSubmittingException || exceptionReason.trim().length < 4}
                    onClick={handleConfirmException}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingException ? "Registrando..." : "Autorizar Entrega"}
                  </button>
                </div>
              </div>
            </div>
          </ModalPortal>
        )}

        {/* ============================================================ */}
        {/* MODAL DE TIQUETE TÉRMICO */}
        {/* ============================================================ */}
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
