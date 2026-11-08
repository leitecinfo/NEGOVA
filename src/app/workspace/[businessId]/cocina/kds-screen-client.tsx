"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  ChefHat,
  Clock,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Play,
  RotateCcw,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  RefreshCw,
  Search,
  ShoppingBag,
  Bike,
  LayoutGrid,
  Check,
  Radio,
  ArrowRight,
  Info,
  Timer,
  SlidersHorizontal,
  X,
  AlertCircle,
  Receipt,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { ModalPortal } from "@/components/ui/modal-portal";
import { EmptyState } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import {
  initOrderAudioUnlock,
  playOrderSoundAlert,
} from "@/lib/audio/order-sound-player";
import {
  RestaurantOrderWithDetails,
  KdsTabFilter,
  getKdsAlertLevel,
  KdsTimeAlertConfig,
  DEFAULT_KDS_TIME_ALERTS,
  OpenTicketDetails,
  OpenTicketsSummary,
} from "@/lib/restaurant/types";
import {
  getKdsOrdersAction,
  updateKdsOrderStatusAction,
  saveKdsAlertConfigAction,
} from "./actions";
import { OpenTicketsPanel } from "./open-tickets-panel";
import {
  KitchenCommandTicketModal,
  KitchenCommandTicketData,
} from "@/components/printing/kitchen-command-ticket-modal";

interface KdsScreenClientProps {
  businessId: string;
  initialOrders: RestaurantOrderWithDetails[];
  initialAlertConfig?: KdsTimeAlertConfig;
  initialOpenTickets?: OpenTicketDetails[];
  initialOpenSummary?: OpenTicketsSummary;
  defaultView?: "kds" | "open_tickets";
}

export function KdsScreenClient({
  businessId,
  initialOrders,
  initialAlertConfig,
  initialOpenTickets = [],
  initialOpenSummary,
  defaultView = "kds",
}: KdsScreenClientProps) {
  // Conmutador de vistas [KDS-003]
  const [viewMode, setViewMode] = useState<"kds" | "open_tickets">(defaultView);
  const [openTicketsCount, setOpenTicketsCount] = useState<number>(
    initialOpenSummary?.totalCount ?? initialOpenTickets.length
  );

  // Estado principal de órdenes
  const [orders, setOrders] = useState<RestaurantOrderWithDetails[]>(initialOrders);
  const [activeTab, setActiveTab] = useState<KdsTabFilter>("received");
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>("all");
  const [alertFilter, setAlertFilter] = useState<"all" | "delayed" | "critical">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [mounted, setMounted] = useState<boolean>(false);

  // Umbrales de alerta de tiempo KDS [KDS-002]
  const [alertConfig, setAlertConfig] = useState<KdsTimeAlertConfig>(
    initialAlertConfig || DEFAULT_KDS_TIME_ALERTS
  );
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
  const [tempWarningMinutes, setTempWarningMinutes] = useState<number>(
    alertConfig.warningMinutes
  );
  const [tempCriticalMinutes, setTempCriticalMinutes] = useState<number>(
    alertConfig.criticalMinutes
  );
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [printingOrder, setPrintingOrder] = useState<KitchenCommandTicketData | null>(null);

  const handleOpenTicket = (order: RestaurantOrderWithDetails) => {
    setPrintingOrder({
      orderNumber: order.order_number,
      orderId: order.id,
      orderType: order.order_type,
      tableName: order.tableName,
      customerName: order.customer_name,
      diners: (order as any).diners_count || 1,
      createdAt: order.created_at,
      cashierName: (order as any).cashier_name || "Cajero",
      items: (order.items || []).map((i) => ({
        quantity: i.quantity,
        name: i.product_name,
        notes: i.notes,
        modifiers: (Array.isArray(i.modifiers) ? i.modifiers : []).map(
          (m: any) => m.optionName || m.name || m.option_name || ""
        ),
      })),
      total: order.total,
    });
  };

  const processedOrderIdsRef = useRef<Set<string>>(new Set(initialOrders.map((o) => o.id)));

  // Cargar preferencia de sonido desde localStorage
  useEffect(() => {
    try {
      const storedSound = localStorage.getItem("negova_kds_sound");
      if (storedSound !== null) {
        setSoundEnabled(storedSound === "true");
      }
      initOrderAudioUnlock();
    } catch {}
  }, []);

  const toggleSound = () => {
    const nextSound = !soundEnabled;
    setSoundEnabled(nextSound);
    try {
      localStorage.setItem("negova_kds_sound", String(nextSound));
    } catch {}
    if (nextSound) {
      toast.success("Alertas sonoras activadas");
    } else {
      toast.info("Alertas sonoras silenciadas");
    }
  };

  // Fullscreen controller
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {
          toast.error("Tu navegador bloqueó el modo pantalla completa.");
        });
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Intervalo de 1 segundo para actualizar timers y alertas visuales
  useEffect(() => {
    setMounted(true);
    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Función para refrescar órdenes desde el servidor
  const refreshOrders = useCallback(
    async (silent: boolean = false) => {
      if (!silent) setIsRefreshing(true);
      try {
        const res = await getKdsOrdersAction(businessId);
        if (res.success && res.data) {
          setOrders(res.data);
          // Registrar IDs para evitar alertas duplicadas
          res.data.forEach((o) => processedOrderIdsRef.current.add(o.id));
        } else if (!silent && res.error) {
          toast.error(res.error);
        }
      } catch (err: any) {
        if (!silent) toast.error("Error al sincronizar comandas.");
      } finally {
        if (!silent) setIsRefreshing(false);
      }
    },
    [businessId]
  );

  // Sincronización Realtime con Supabase y Eventos del Navegador
  useEffect(() => {
    if (!businessId) return;

    const supabase = createClient();
    const channelName = `kds-orders-channel:${businessId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "restaurant_orders",
          filter: `business_id=eq.${businessId}`,
        },
        async (payload) => {
          const newOrUpdated = payload.new as any;
          if (!newOrUpdated) return;

          if (payload.eventType === "INSERT") {
            // Sonido de alerta si es nuevo pedido
            if (!processedOrderIdsRef.current.has(newOrUpdated.id)) {
              processedOrderIdsRef.current.add(newOrUpdated.id);
              if (soundEnabled) {
                playOrderSoundAlert(newOrUpdated.id);
              }
              toast(`Nuevo pedido recibido #${newOrUpdated.order_number || ""}`, {
                icon: <ChefHat className="w-5 h-5 text-[#ED500A]" />,
                description: newOrUpdated.customer_name
                  ? `Cliente: ${newOrUpdated.customer_name}`
                  : "Listo para preparación",
              });
            }
          }

          // Refrescar lista completa para traer items y nombres de mesas actualizados
          refreshOrders(true);
        }
      )
      .subscribe();

    // Escuchar también evento emitido por WorkspaceRealtimeListener
    const handleWindowNewOrder = (event: Event) => {
      const customEvt = event as CustomEvent;
      const orderData = customEvt.detail;
      if (orderData?.id && !processedOrderIdsRef.current.has(orderData.id)) {
        processedOrderIdsRef.current.add(orderData.id);
        if (soundEnabled) {
          playOrderSoundAlert(orderData.id);
        }
        refreshOrders(true);
      }
    };

    window.addEventListener("negova:new_order", handleWindowNewOrder);

    const handleWindowOrderReady = () => {
      refreshOrders(true);
    };
    window.addEventListener("negova:order_ready", handleWindowOrderReady);

    // Fallback de polling cada 15 segundos
    const pollInterval = setInterval(() => {
      refreshOrders(true);
    }, 15000);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("negova:new_order", handleWindowNewOrder);
      window.removeEventListener("negova:order_ready", handleWindowOrderReady);
      clearInterval(pollInterval);
    };
  }, [businessId, refreshOrders, soundEnabled]);

  // Transición de estado de un pedido
  const handleTransitionStatus = async (
    order: RestaurantOrderWithDetails,
    newStatus: RestaurantOrderWithDetails["status"],
    actionLabel: string
  ) => {
    setUpdatingOrderId(order.id);
    try {
      const res = await updateKdsOrderStatusAction(businessId, order.id, newStatus);
      if (res.success) {
        toast.success(`Pedido #${order.order_number}: ${actionLabel}`);
        // Actualizar estado local inmediatamente para reactividad instantánea
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, status: newStatus } : o))
        );
      } else {
        toast.error(res.error || "No se pudo actualizar el estado del pedido.");
      }
    } catch {
      toast.error("Error al procesar la comanda.");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Conteo cuantitativo por pestañas
  const counts = useMemo(() => {
    let received = 0;
    let inPreparation = 0;
    let ready = 0;
    let delivered = 0;
    let delayed = 0;
    let critical = 0;

    for (const ord of orders) {
      if (ord.status === "received") received++;
      else if (ord.status === "in_preparation") inPreparation++;
      else if (ord.status === "ready") ready++;
      else if (ord.status === "delivered") delivered++;

      if (ord.status !== "delivered" && ord.status !== "cancelled") {
        const { level } = getKdsAlertLevel(ord.created_at, alertConfig);
        if (level === "warning") delayed++;
        if (level === "critical") critical++;
      }
    }

    const activeTotal = received + inPreparation + ready;
    return {
      received,
      inPreparation,
      ready,
      delivered,
      delayed,
      critical,
      activeTotal,
      all: orders.length,
    };
  }, [orders, alertConfig, currentTime]);

  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tempCriticalMinutes <= tempWarningMinutes) {
      setConfigError("El umbral crítico (rojo) debe ser mayor al umbral de advertencia (amarillo).");
      return;
    }

    setIsSavingConfig(true);
    setConfigError(null);

    try {
      const res = await saveKdsAlertConfigAction(businessId, {
        warningMinutes: tempWarningMinutes,
        criticalMinutes: tempCriticalMinutes,
      });

      if (res.success && res.config) {
        setAlertConfig(res.config);
        toast.success(
          `Umbrales actualizados: Demorado ${res.config.warningMinutes}m / Crítico ${res.config.criticalMinutes}m.`
        );
        setIsConfigModalOpen(false);
      } else {
        setConfigError(res.error || "No se pudo guardar la configuración.");
        toast.error(res.error || "Error al actualizar umbrales.");
      }
    } catch {
      setConfigError("Error de comunicación al guardar umbrales.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Filtrado de pedidos según pestaña, tipo, búsqueda y alerta
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      // 1. Filtro por pestaña
      if (activeTab === "received" && ord.status !== "received") return false;
      if (activeTab === "in_preparation" && ord.status !== "in_preparation") return false;
      if (activeTab === "ready" && ord.status !== "ready") return false;
      if (activeTab === "delivered" && ord.status !== "delivered") return false;
      if (activeTab === "all" && ord.status === "cancelled") return false;

      // 2. Filtro por tipo de orden
      if (orderTypeFilter !== "all" && ord.order_type !== orderTypeFilter) return false;

      // 3. Filtro por nivel de alerta [KDS-002]
      if (alertFilter !== "all") {
        if (ord.status === "delivered" || ord.status === "cancelled") return false;
        const { level } = getKdsAlertLevel(ord.created_at, alertConfig);
        if (alertFilter === "delayed" && level !== "warning") return false;
        if (alertFilter === "critical" && level !== "critical") return false;
      }

      // 4. Filtro por búsqueda de texto
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesNumber = String(ord.order_number).includes(q.replace(/^#/, ""));
        const matchesCustomer = ord.customer_name?.toLowerCase().includes(q);
        const matchesTable = ord.tableName?.toLowerCase().includes(q);
        const matchesProduct = ord.items?.some((it) =>
          it.product_name.toLowerCase().includes(q)
        );
        if (!matchesNumber && !matchesCustomer && !matchesTable && !matchesProduct) {
          return false;
        }
      }

      return true;
    });
  }, [orders, activeTab, orderTypeFilter, alertFilter, searchQuery, alertConfig, currentTime]);

  return (
    <div className="flex-1 flex flex-col w-full bg-slate-50 dark:bg-[#0B0E14] text-slate-900 dark:text-[#F8F9FD] font-sans select-none">
      {/* BARRA SUPERIOR / HEADER KDS */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0D0F16]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-white/[0.08] px-4 py-3 sm:px-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* IDENTIFICACIÓN Y RELOJ */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/70 dark:bg-[#ED500A]/10 dark:border-[#ED500A]/20 flex items-center justify-center text-[#ED500A]">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white uppercase">
                  Monitor de Cocina
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/25">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                  KDS Realtime
                </span>
              </div>
              <p
                className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-mono"
                suppressHydrationWarning
              >
                <Timer className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                <span suppressHydrationWarning>
                  {mounted && currentTime
                    ? currentTime.toLocaleTimeString("es-CO", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })
                    : "--:--:--"}
                </span>
              </p>
            </div>
          </div>

          {/* CONMUTADOR DE VISTAS: MONITOR KDS vs TICKETS ABIERTOS [KDS-003] */}
          <div className="flex items-center bg-slate-100 dark:bg-[#131620] p-1 rounded-xl border border-slate-200/80 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => setViewMode("kds")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === "kds"
                  ? "bg-[#ED500A] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <ChefHat className="w-3.5 h-3.5" />
              <span>Monitor Cocina</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("open_tickets")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === "open_tickets"
                  ? "bg-amber-500 text-slate-950 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Tickets Abiertos</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  viewMode === "open_tickets"
                    ? "bg-slate-950 text-amber-300"
                    : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                }`}
              >
                {openTicketsCount}
              </span>
            </button>
          </div>

          {/* CHIPS DE ESTADO / ALERTAS CRÍTICAS [KDS-002] */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#131620] border border-slate-200/80 dark:border-white/[0.08] flex items-center gap-2 text-xs shadow-2xs">
              <span className="text-slate-500 dark:text-slate-400">Activas:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                {counts.activeTotal}
              </span>
            </div>

            {counts.delayed > 0 && (
              <button
                type="button"
                onClick={() => setAlertFilter(alertFilter === "delayed" ? "all" : "delayed")}
                className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs transition-all cursor-pointer shadow-2xs ${
                  alertFilter === "delayed"
                    ? "bg-amber-500 text-slate-950 font-black border-amber-400 ring-2 ring-amber-400"
                    : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-300 dark:hover:bg-amber-500/25"
                }`}
                title={`Filtrar comandas demoradas (> ${alertConfig.warningMinutes}m)`}
              >
                <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 animate-bounce" />
                <span>Demorados (+{alertConfig.warningMinutes}m):</span>
                <span className="font-mono font-black text-sm">{counts.delayed}</span>
              </button>
            )}

            {counts.critical > 0 && (
              <button
                type="button"
                onClick={() => setAlertFilter(alertFilter === "critical" ? "all" : "critical")}
                className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs transition-all cursor-pointer shadow-2xs ${
                  alertFilter === "critical"
                    ? "bg-rose-600 text-white font-black border-rose-400 ring-2 ring-rose-400"
                    : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100 dark:bg-rose-600/15 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-600/25 animate-pulse"
                }`}
                title={`Filtrar comandas críticas (> ${alertConfig.criticalMinutes}m)`}
              >
                <Flame className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                <span>Críticos (+{alertConfig.criticalMinutes}m):</span>
                <span className="font-mono font-black text-sm">{counts.critical}</span>
              </button>
            )}

            {/* BOTÓN CONFIGURAR UMBRALES [KDS-002] */}
            <button
              type="button"
              onClick={() => {
                setTempWarningMinutes(alertConfig.warningMinutes);
                setTempCriticalMinutes(alertConfig.criticalMinutes);
                setConfigError(null);
                setIsConfigModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 dark:bg-[#131620] dark:hover:bg-white/[0.06] border border-slate-200/80 dark:border-white/[0.08] hover:border-amber-500/60 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Configurar umbrales de tiempo para alertas de demora y órdenes críticas"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span className="hidden lg:inline">Umbrales:</span>
              <span className="font-mono text-amber-600 dark:text-amber-300 font-bold">
                {alertConfig.warningMinutes}m / {alertConfig.criticalMinutes}m
              </span>
            </button>
          </div>

          {/* ACCIONES DEL HEADER: SONIDO, PANTALLA COMPLETA, REFRESCAR */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSound}
              type="button"
              className={`p-2.5 rounded-xl border transition-all text-xs font-medium flex items-center gap-1.5 shadow-2xs ${
                soundEnabled
                  ? "bg-white hover:bg-slate-50 dark:bg-[#131620] dark:hover:bg-white/[0.06] border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-300"
                  : "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800/50 dark:text-rose-300"
              }`}
              title={soundEnabled ? "Silenciar alertas" : "Activar sonido"}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              )}
              <span className="hidden md:inline">
                {soundEnabled ? "Audio ON" : "Audio OFF"}
              </span>
            </button>

            <button
              onClick={() => refreshOrders(false)}
              disabled={isRefreshing}
              type="button"
              className="p-2.5 rounded-xl bg-white hover:bg-slate-50 dark:bg-[#131620] dark:hover:bg-white/[0.06] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 transition-all text-xs font-medium disabled:opacity-50 shadow-2xs"
              title="Refrescar comandas"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-[#ED500A]" : ""}`} />
            </button>

            <button
              onClick={toggleFullscreen}
              type="button"
              className="p-2.5 rounded-xl bg-[#ED500A] hover:bg-[#d94608] text-white font-bold transition-all shadow-xs active:scale-95 flex items-center gap-1.5 text-xs"
              title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            >
              {isFullscreen ? (
                <>
                  <Minimize className="w-4 h-4" />
                  <span className="hidden sm:inline">Restaurar</span>
                </>
              ) : (
                <>
                  <Maximize className="w-4 h-4" />
                  <span className="hidden sm:inline">Pantalla Completa</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* PESTAÑAS Y BARRA DE FILTROS (SOLO EN MONITOR KDS) */}
        {viewMode === "kds" && (
          <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* TABS DE ESTADO */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                onClick={() => setActiveTab("received")}
                type="button"
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                  activeTab === "received"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-white hover:bg-slate-50 dark:bg-[#131620] dark:hover:bg-white/[0.06] border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-2xs"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Pendiente</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                    activeTab === "received"
                      ? "bg-blue-800 text-white"
                      : "bg-slate-100 text-slate-700 dark:bg-white/[0.08] dark:text-slate-300"
                  }`}
                >
                  {counts.received}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("in_preparation")}
                type="button"
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                  activeTab === "in_preparation"
                    ? "bg-[#ED500A] text-white shadow-xs"
                    : "bg-white hover:bg-slate-50 dark:bg-[#131620] dark:hover:bg-white/[0.06] border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-2xs"
                }`}
              >
                <ChefHat className="w-3.5 h-3.5" />
                <span>Preparando</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                    activeTab === "in_preparation"
                      ? "bg-[#c44107] text-white"
                      : "bg-slate-100 text-slate-700 dark:bg-white/[0.08] dark:text-slate-300"
                  }`}
                >
                  {counts.inPreparation}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("ready")}
                type="button"
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                  activeTab === "ready"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-white hover:bg-slate-50 dark:bg-[#131620] dark:hover:bg-white/[0.06] border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-2xs"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Listo</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                    activeTab === "ready"
                      ? "bg-emerald-800 text-white"
                      : "bg-slate-100 text-slate-700 dark:bg-white/[0.08] dark:text-slate-300"
                  }`}
                >
                  {counts.ready}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("delivered")}
                type="button"
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                  activeTab === "delivered"
                    ? "bg-teal-700 text-white shadow-xs"
                    : "bg-white hover:bg-slate-50 dark:bg-[#131620] dark:hover:bg-white/[0.06] border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-2xs"
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Entregado</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                    activeTab === "delivered"
                      ? "bg-teal-900 text-white"
                      : "bg-slate-100 text-slate-700 dark:bg-white/[0.08] dark:text-slate-300"
                  }`}
                >
                  {counts.delivered}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("all")}
                type="button"
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                  activeTab === "all"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-white hover:bg-slate-50 dark:bg-[#131620] dark:hover:bg-white/[0.06] border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-2xs"
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Todas</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                    activeTab === "all"
                      ? "bg-purple-800 text-white"
                      : "bg-slate-100 text-slate-700 dark:bg-white/[0.08] dark:text-slate-300"
                  }`}
                >
                  {counts.all}
                </span>
              </button>
            </div>

            {/* FILTRO DE DESTINO Y BÚSQUEDA */}
            <div className="flex items-center gap-2 shrink-0">
              {/* TIPO DE DESTINO */}
              <div className="flex items-center bg-slate-100 dark:bg-[#131620] border border-slate-200/80 dark:border-white/[0.08] rounded-xl p-0.5 text-xs">
                <button
                  onClick={() => setOrderTypeFilter("all")}
                  type="button"
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    orderTypeFilter === "all"
                      ? "bg-white dark:bg-[#0D0F16] text-slate-900 dark:text-white font-bold shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setOrderTypeFilter("dine_in")}
                  type="button"
                  className={`px-2 py-1 rounded-lg font-medium flex items-center gap-1 transition-all ${
                    orderTypeFilter === "dine_in"
                      ? "bg-white dark:bg-[#0D0F16] text-slate-900 dark:text-white font-bold shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  title="Solo mesas"
                >
                  <LayoutGrid className="w-3 h-3" />
                  <span className="hidden sm:inline">Mesa</span>
                </button>
                <button
                  onClick={() => setOrderTypeFilter("takeout")}
                  type="button"
                  className={`px-2 py-1 rounded-lg font-medium flex items-center gap-1 transition-all ${
                    orderTypeFilter === "takeout"
                      ? "bg-white dark:bg-[#0D0F16] text-slate-900 dark:text-white font-bold shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  title="Para llevar"
                >
                  <ShoppingBag className="w-3 h-3" />
                  <span className="hidden sm:inline">Llevar</span>
                </button>
                <button
                  onClick={() => setOrderTypeFilter("delivery")}
                  type="button"
                  className={`px-2 py-1 rounded-lg font-medium flex items-center gap-1 transition-all ${
                    orderTypeFilter === "delivery"
                      ? "bg-white dark:bg-[#0D0F16] text-slate-900 dark:text-white font-bold shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  title="Domicilios"
                >
                  <Bike className="w-3 h-3" />
                  <span className="hidden sm:inline">Domicilio</span>
                </button>
              </div>

              {/* BÚSQUEDA */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-28 sm:w-36 bg-white dark:bg-[#131620] border border-slate-200 dark:border-white/[0.1] rounded-xl pl-8 pr-2.5 py-1 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-[#ED500A] shadow-2xs"
                />
              </div>
            </div>
          </div>
        )}
      </header>

      {/* CUERPO PRINCIPAL: MONITOR KDS O TICKETS ABIERTOS [KDS-003] */}
      {viewMode === "open_tickets" ? (
        <OpenTicketsPanel
          businessId={businessId}
          initialTickets={initialOpenTickets}
          initialSummary={initialOpenSummary}
          alertConfig={alertConfig}
          onSwitchToKds={() => setViewMode("kds")}
        />
      ) : (
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
        {filteredOrders.length === 0 ? (
          <EmptyState
            icon={ChefHat}
            title="No hay comandas en este estado"
            description="Las órdenes generadas desde el POS, Mesas o Menú Digital aparecerán aquí automáticamente en tiempo real."
            resetLabel={
              searchQuery.trim() || orderTypeFilter !== "all" || alertFilter !== "all"
                ? "Limpiar filtros"
                : undefined
            }
            onReset={
              searchQuery.trim() || orderTypeFilter !== "all" || alertFilter !== "all"
                ? () => {
                    setSearchQuery("");
                    setOrderTypeFilter("all");
                    setAlertFilter("all");
                  }
                : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {filteredOrders.map((order) => {
              const { level, elapsedMinutes, elapsedFormatted } = getKdsAlertLevel(
                order.created_at,
                alertConfig
              );
              const isUpdating = updatingOrderId === order.id;

              // Estilos según nivel de alerta visual (>15 min = amarillo, >30 min = rojo parpadeante)
              let borderStyle = "border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16]";
              let badgeColor = "bg-slate-100 dark:bg-[#131620] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/[0.08]";
              let cardShadow = "shadow-xs";

              if (order.status !== "delivered" && order.status !== "cancelled") {
                if (level === "critical") {
                  borderStyle = "border-rose-400 dark:border-rose-500/60 bg-rose-50/40 dark:bg-rose-950/20";
                  badgeColor = "bg-rose-600 text-white border-rose-600 animate-pulse";
                  cardShadow = "shadow-md shadow-rose-500/10 ring-1 ring-rose-500/20";
                } else if (level === "warning") {
                  borderStyle = "border-amber-400 dark:border-amber-500/50 bg-amber-50/40 dark:bg-amber-950/20";
                  badgeColor = "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40";
                  cardShadow = "shadow-md shadow-amber-500/10";
                }
              }

              // Estilo del tipo de comanda
              const orderTypeBadge = () => {
                if (order.order_type === "dine_in") {
                  return (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 flex items-center gap-1">
                      <LayoutGrid className="w-3 h-3" />
                      {order.tableName || "Mesa"}
                    </span>
                  );
                }
                if (order.order_type === "takeout") {
                  return (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 flex items-center gap-1">
                      <ShoppingBag className="w-3 h-3" />
                      Para Llevar
                    </span>
                  );
                }
                return (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30 flex items-center gap-1">
                    <Bike className="w-3 h-3" />
                    Domicilio
                  </span>
                );
              };

              return (
                <div
                  key={order.id}
                  className={`rounded-2xl border flex flex-col justify-between transition-all duration-300 ${borderStyle} ${cardShadow}`}
                >
                  {/* ENCABEZADO DE LA TARJETA */}
                  <div className="p-3.5 border-b border-slate-100 dark:border-white/[0.06]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-black font-mono text-slate-900 dark:text-white tracking-tight">
                          #{order.order_number}
                        </span>
                        {orderTypeBadge()}
                      </div>

                      {/* BADGE DE TIEMPO TRANSCURRIDO CON ALERTAS */}
                      <div
                        className={`px-2 py-0.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-1 ${badgeColor}`}
                        suppressHydrationWarning
                      >
                        {level === "critical" && (
                          <Flame className="w-3.5 h-3.5 text-white" />
                        )}
                        {level === "warning" && (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                        )}
                        {level === "normal" && (
                          <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        )}
                        <span suppressHydrationWarning>{elapsedFormatted}</span>
                      </div>
                    </div>

                    {/* CLIENTE Y DETALLES */}
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="truncate max-w-[150px] font-medium">
                        {order.customer_name || "Cliente salón"}
                      </span>
                      <span className="font-mono text-slate-400 dark:text-slate-500 text-[10px]" suppressHydrationWarning>
                        {new Date(order.created_at).toLocaleTimeString("es-CO", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {/* NOTA GENERAL DE LA COMANDA */}
                    {order.notes && (
                      <div className="mt-2 p-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 text-[11px] text-amber-800 dark:text-amber-300 italic flex items-start gap-1.5">
                        <Info className="w-3 h-3 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{order.notes}</span>
                      </div>
                    )}
                  </div>

                  {/* LISTADO DE PRODUCTOS Y MODIFICADORES */}
                  <div className="p-3.5 flex-1 divide-y divide-slate-100 dark:divide-white/[0.06] max-h-72 overflow-y-auto scrollbar-thin">
                    {(order.items || []).map((item, idx) => {
                      const mods = Array.isArray(item.modifiers) ? item.modifiers : [];

                      return (
                        <div key={item.id || idx} className="py-2 first:pt-0 last:pb-0">
                          <div className="flex items-start gap-2">
                            <span className="w-6 h-6 rounded-md bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white font-mono font-black text-xs flex items-center justify-center shrink-0">
                              {item.quantity}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                                {item.product_name}
                              </p>
                              {item.variant_name && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                  {item.variant_name}
                                </p>
                              )}

                              {/* MODIFICADORES */}
                              {mods.length > 0 && (
                                <div className="mt-1 space-y-0.5 pl-1">
                                  {mods.map((m: any, mIdx: number) => (
                                    <div
                                      key={mIdx}
                                      className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1"
                                    >
                                      <span className="text-slate-400 dark:text-slate-600">•</span>
                                      <span>{m.optionName || m.name || m.option_name}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* NOTAS ESPECÍFICAS DE PREPARACIÓN */}
                              {item.notes && (
                                <div className="mt-1 text-[11px] font-medium text-amber-800 dark:text-amber-300 italic bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 px-1.5 py-0.5 rounded-lg">
                                  «{item.notes}»
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* PIE DE ACCIONES: TRANSICIONES DE ESTADO */}
                  <div className="p-3 bg-slate-50/70 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/[0.06] flex items-center gap-2">
                    {/* ESTADO: RECIBIDO / PENDIENTE */}
                    {order.status === "received" && (
                      <div className="w-full flex items-center gap-2">
                        <button
                          onClick={() =>
                            handleTransitionStatus(order, "in_preparation", "En preparación")
                          }
                          disabled={isUpdating}
                          type="button"
                          className="flex-1 py-2.5 px-3 rounded-xl bg-[#ED500A] hover:bg-[#d94608] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {isUpdating ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Iniciar Preparación</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenTicket(order)}
                          className="p-2.5 rounded-xl bg-white dark:bg-[#131620] hover:bg-slate-100 dark:hover:bg-white/[0.05] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/[0.1] transition-all text-xs cursor-pointer shrink-0"
                          title="Ver e imprimir comanda de cocina"
                        >
                          <Printer className="w-4 h-4 text-slate-500 hover:text-slate-900 dark:hover:text-white" />
                        </button>
                      </div>
                    )}

                    {/* ESTADO: EN PREPARACIÓN */}
                    {order.status === "in_preparation" && (
                      <div className="w-full flex items-center gap-2">
                        <button
                          onClick={() =>
                            handleTransitionStatus(order, "received", "Devuelto a pendientes")
                          }
                          disabled={isUpdating}
                          type="button"
                          className="p-2.5 rounded-xl bg-white dark:bg-[#131620] hover:bg-slate-100 dark:hover:bg-white/[0.05] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/[0.1] transition-all text-xs cursor-pointer"
                          title="Regresar a Pendiente"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            handleTransitionStatus(order, "ready", "Marcado como Listo")
                          }
                          disabled={isUpdating}
                          type="button"
                          className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {isUpdating ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Marcar Listo</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenTicket(order)}
                          className="p-2.5 rounded-xl bg-white dark:bg-[#131620] hover:bg-slate-100 dark:hover:bg-white/[0.05] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/[0.1] transition-all text-xs cursor-pointer shrink-0"
                          title="Ver e imprimir comanda de cocina"
                        >
                          <Printer className="w-4 h-4 text-slate-500 hover:text-slate-900 dark:hover:text-white" />
                        </button>
                      </div>
                    )}

                    {/* ESTADO: LISTO */}
                    {order.status === "ready" && (
                      <div className="w-full flex items-center gap-2">
                        <button
                          onClick={() =>
                            handleTransitionStatus(order, "in_preparation", "Regresado a preparación")
                          }
                          disabled={isUpdating}
                          type="button"
                          className="p-2.5 rounded-xl bg-white dark:bg-[#131620] hover:bg-slate-100 dark:hover:bg-white/[0.05] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/[0.1] transition-all text-xs cursor-pointer"
                          title="Regresar a Preparando"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            handleTransitionStatus(order, "delivered", "Pedido entregado")
                          }
                          disabled={isUpdating}
                          type="button"
                          className="flex-1 py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {isUpdating ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              <span>Entregar Pedido</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenTicket(order)}
                          className="p-2.5 rounded-xl bg-white dark:bg-[#131620] hover:bg-slate-100 dark:hover:bg-white/[0.05] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/[0.1] transition-all text-xs cursor-pointer shrink-0"
                          title="Ver e imprimir comanda de cocina"
                        >
                          <Printer className="w-4 h-4 text-slate-500 hover:text-slate-900 dark:hover:text-white" />
                        </button>
                      </div>
                    )}

                    {/* ESTADO: ENTREGADO */}
                    {order.status === "delivered" && (
                      <div className="w-full flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 py-1">
                        <span className="flex items-center gap-1 text-teal-600 dark:text-teal-400 font-semibold">
                          <CheckCircle2 className="w-4 h-4" />
                          Entregado
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              handleTransitionStatus(order, "ready", "Reabierto a Listo")
                            }
                            disabled={isUpdating}
                            type="button"
                            className="text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline cursor-pointer"
                          >
                            Reabrir
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenTicket(order)}
                            className="p-1 rounded-md bg-white dark:bg-[#131620] hover:bg-slate-100 dark:hover:bg-white/[0.05] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/[0.1] transition-all text-xs cursor-pointer"
                            title="Ver e imprimir comanda de cocina"
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-500 hover:text-slate-900 dark:hover:text-white" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      )}

      {/* MODAL CONFIGURACIÓN DE UMBRALES DE TIEMPO [KDS-002] */}
      {isConfigModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm font-sans">
            <div className="relative w-full max-w-md bg-white dark:bg-[#0D0F16] border border-slate-200/90 dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                    <SlidersHorizontal className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      Umbrales de Tiempo y Alertas
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Configura cuándo alertar demoras en cocina
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveThresholds} className="p-5 space-y-4 text-slate-700 dark:text-slate-200">
                {configError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{configError}</span>
                  </div>
                )}

                {/* Preajustes rápidos */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                    Plantillas Rápidas
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTempWarningMinutes(8);
                        setTempCriticalMinutes(15);
                        setConfigError(null);
                      }}
                      className="py-1.5 px-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-white/[0.04] hover:bg-slate-200 dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                    >
                      Rápido (8m/15m)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTempWarningMinutes(15);
                        setTempCriticalMinutes(30);
                        setConfigError(null);
                      }}
                      className="py-1.5 px-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-white/[0.04] hover:bg-slate-200 dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                    >
                      Estándar (15m/30m)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTempWarningMinutes(20);
                        setTempCriticalMinutes(40);
                        setConfigError(null);
                      }}
                      className="py-1.5 px-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-white/[0.04] hover:bg-slate-200 dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                    >
                      Gourmet (20m/40m)
                    </button>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                      <span>Alerta Amarilla — Comanda Demorada (Minutos)</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={120}
                      value={tempWarningMinutes}
                      onChange={(e) =>
                        setTempWarningMinutes(Math.max(1, parseInt(e.target.value, 10) || 1))
                      }
                      className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#131620] text-slate-900 dark:text-white text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Las tarjetas pasarán a borde ámbar al superar este tiempo.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                      <Flame className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                      <span>Alerta Roja — Comanda Crítica (Minutos)</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={tempWarningMinutes + 1}
                      max={240}
                      value={tempCriticalMinutes}
                      onChange={(e) =>
                        setTempCriticalMinutes(
                          Math.max(
                            tempWarningMinutes + 1,
                            parseInt(e.target.value, 10) || tempWarningMinutes + 1
                          )
                        )
                      }
                      className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#131620] text-slate-900 dark:text-white text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Las tarjetas pasarán a borde rojo parpadeante al superar este tiempo.
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsConfigModalOpen(false)}
                    disabled={isSavingConfig}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200 dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08] transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingConfig || tempCriticalMinutes <= tempWarningMinutes}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#ED500A] hover:bg-[#d94608] text-white shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isSavingConfig ? "Guardando..." : "Guardar Umbrales"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL DE TICKET / COMANDA DE COCINA */}
      <KitchenCommandTicketModal
        isOpen={Boolean(printingOrder)}
        onClose={() => setPrintingOrder(null)}
        order={printingOrder}
      />
    </div>
  );
}
