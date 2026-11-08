"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Bike,
  Clock,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Users,
  User,
  Phone,
  MapPin,
  ExternalLink,
  MessageCircle,
  Printer,
  ChevronDown,
  ChevronUp,
  Search,
  RefreshCw,
  Plus,
  Share2,
  Copy,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  Check,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { RestaurantOrderWithDetails } from "@/lib/restaurant/types";
import { OperationalDeliveryDriver } from "@/lib/delivery/delivery-service";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";

interface DeliveryByDriverTabProps {
  businessId: string;
  orders: RestaurantOrderWithDetails[];
  drivers: OperationalDeliveryDriver[];
  businessTimezone: string;
  onAssignDriver: (orderId: string, driverName: string) => Promise<void> | void;
  onDispatch: (order: RestaurantOrderWithDetails) => Promise<void> | void;
  onConfirmException: (order: RestaurantOrderWithDetails) => void;
  onOpenTicket: (order: RestaurantOrderWithDetails) => void;
  onOpenDriverModal?: () => void;
}

export function DeliveryByDriverTab({
  businessId,
  orders,
  drivers,
  businessTimezone,
  onAssignDriver,
  onDispatch,
  onConfirmException,
  onOpenTicket,
  onOpenDriverModal,
}: DeliveryByDriverTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "active_only" | "available_only">("all");
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [collapsedCompleted, setCollapsedCompleted] = useState<Record<string, boolean>>({});
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);

  // Actualizador de reloj en tiempo real cada 1 segundo para los cronómetros de pedidos
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  /**
   * Calcula el tiempo transcurrido formateado (MM:SS o Xh Ym) y su nivel de urgencia
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

      let level: "normal" | "warning" | "critical" = "normal";
      if (minutes >= 40) {
        level = "critical";
      } else if (minutes >= 20) {
        level = "warning";
      }

      return { minutes, seconds, formatted, level };
    } catch {
      return { minutes: 0, seconds: 0, formatted: "--:--", level: "normal" as const };
    }
  };

  // 1. Pedidos sin asignar (delivery_status === 'pending' o sin driver_name)
  const unassignedOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        o.order_type === "delivery" &&
        o.status !== "cancelled" &&
        (!o.driver_name || o.delivery_status === "pending" || !o.delivery_status)
    );
  }, [orders]);

  // 2. Mapeo de pedidos por repartidor
  const ordersByDriver = useMemo(() => {
    const map = new Map<string, { active: RestaurantOrderWithDetails[]; delivered: RestaurantOrderWithDetails[] }>();

    for (const d of drivers) {
      map.set(d.name.toLowerCase().trim(), { active: [], delivered: [] });
    }

    for (const order of orders) {
      if (order.order_type !== "delivery" || order.status === "cancelled") continue;
      if (!order.driver_name) continue;

      const key = order.driver_name.toLowerCase().trim();
      let entry = map.get(key);
      if (!entry) {
        entry = { active: [], delivered: [] };
        map.set(key, entry);
      }

      if (order.delivery_status === "delivered") {
        entry.delivered.push(order);
      } else {
        entry.active.push(order);
      }
    }

    return map;
  }, [orders, drivers]);

  // Lista de repartidores filtrada
  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      const entry = ordersByDriver.get(d.name.toLowerCase().trim()) || { active: [], delivered: [] };
      const hasActive = entry.active.length > 0;

      if (filterMode === "active_only" && !hasActive) return false;
      if (filterMode === "available_only" && hasActive) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = d.name.toLowerCase().includes(q);
        const matchesPhone = d.phone?.includes(q) || false;
        const matchesOrder = entry.active.some(
          (o) =>
            String(o.order_number).includes(q) ||
            o.delivery_address?.toLowerCase().includes(q) ||
            o.customer_name?.toLowerCase().includes(q)
        );
        if (!matchesName && !matchesPhone && !matchesOrder) {
          return false;
        }
      }

      return true;
    });
  }, [drivers, ordersByDriver, filterMode, searchQuery]);

  const toggleCollapseCompleted = (driverId: string) => {
    setCollapsedCompleted((prev) => ({
      ...prev,
      [driverId]: !prev[driverId],
    }));
  };

  const copyDriverPortalLink = (driverPin: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/reparto/${businessId}?pin=${driverPin}`;
    navigator.clipboard.writeText(url);
    toast.success("Enlace del portal de repartidor copiado al portapapeles.");
  };

  return (
    <div className="space-y-6">
      {/* BARRA SUPERIOR DE RESUMEN Y BÚSQUEDA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#ED500A]/10 border border-[#ED500A]/20 flex items-center justify-center text-[#ED500A]">
            <Bike className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black tracking-tight text-slate-900 dark:text-white uppercase">
                Vista por Repartidor
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Monitoreo en Vivo
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Supervisión de pedidos activos, tiempos de entrega y asignación por domiciliario.
            </p>
          </div>
        </div>

        {/* CONTROLES: FILTROS Y GESTIÓN */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-64">
            <SearchInput
              inputSize="sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery("")}
              placeholder="Buscar repartidor o pedido..."
            />
          </div>

          <div className="flex items-center bg-slate-100 dark:bg-white/[0.04] p-0.5 rounded-xl border border-slate-200 dark:border-white/[0.08] text-xs">
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                filterMode === "all"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Todos ({drivers.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("active_only")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                filterMode === "active_only"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              En Ruta
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("available_only")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                filterMode === "available_only"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Disponibles
            </button>
          </div>

          {onOpenDriverModal && (
            <button
              type="button"
              onClick={onOpenDriverModal}
              className="px-3 py-1.5 rounded-xl bg-[#ED500A] hover:bg-[#d84606] text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Gestionar Repartidores</span>
            </button>
          )}
        </div>
      </div>

      {/* SECCIÓN 1: GRUPO ESPECIAL "SIN ASIGNAR" (CRITERIO OBLIGATORIO) */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
          unassignedOrders.length > 0
            ? "bg-amber-50/70 dark:bg-amber-950/20 border-amber-300 dark:border-amber-500/40 shadow-xs"
            : "bg-white dark:bg-[#0D0F16] border-slate-200 dark:border-white/[0.08]"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/80 dark:border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                unassignedOrders.length > 0
                  ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Pedidos Sin Asignar
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-black ${
                    unassignedOrders.length > 0
                      ? "bg-amber-500 text-slate-950 animate-pulse"
                      : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {unassignedOrders.length} {unassignedOrders.length === 1 ? "pedido" : "pedidos"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {unassignedOrders.length > 0
                  ? "Atención requerida: Asigna un repartidor para coordinar la recogida y despacho."
                  : "Todos los pedidos de domicilio cuentan con repartidor asignado actualmente."}
              </p>
            </div>
          </div>
        </div>

        {unassignedOrders.length === 0 ? (
          <div className="py-6 flex items-center justify-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>Sin pedidos pendientes de asignación en este momento.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-4">
            {unassignedOrders.map((order) => {
              const elapsed = getElapsedInfo(order.created_at);
              return (
                <div
                  key={order.id}
                  className="p-3.5 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-white dark:bg-slate-900/90 shadow-sm flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                        #{order.order_number}
                      </span>

                      {/* Cronómetro en tiempo real */}
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-bold ${
                          elapsed.level === "critical"
                            ? "bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40 animate-pulse"
                            : elapsed.level === "warning"
                            ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                        }`}
                        title="Tiempo transcurrido desde creación"
                      >
                        <Clock className="w-3 h-3" />
                        <span>{elapsed.formatted}</span>
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
                      <p className="font-bold flex items-center gap-1.5 truncate">
                        <User className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{order.customer_name || "Cliente ocasional"}</span>
                      </p>
                      {order.customer_phone && (
                        <p className="text-[11px] text-slate-500 flex items-center gap-1.5 font-mono">
                          <Phone className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                          <span>{order.customer_phone}</span>
                        </p>
                      )}
                      <p className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                        <MapPin className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{order.delivery_address || "Sin dirección especificada"}</span>
                      </p>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 dark:border-white/[0.06] flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-500">Monto:</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        {formatCOP(order.total)}
                      </span>
                    </div>

                    {/* Selector de asignación inmediata */}
                    <div className="flex items-center gap-1.5">
                      <Select
                        selectSize="sm"
                        defaultValue=""
                        disabled={assigningOrderId === order.id}
                        onChange={async (e) => {
                          const driverName = e.target.value;
                          if (!driverName) return;
                          setAssigningOrderId(order.id);
                          try {
                            await onAssignDriver(order.id, driverName);
                          } finally {
                            setAssigningOrderId(null);
                          }
                        }}
                      >
                        <option value="" disabled>
                          Asignar repartidor...
                        </option>
                        {drivers
                          .filter((d) => d.isActive)
                          .map((d) => (
                            <option key={d.id} value={d.name}>
                              🛵 {d.name}
                            </option>
                          ))}
                      </Select>

                      <button
                        type="button"
                        onClick={() => onOpenTicket(order)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                        title="Imprimir comanda de entrega"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECCIÓN 2: VISTA AGRUPADA POR CADA REPARTIDOR (CRITERIO OBLIGATORIO) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
            <Users className="w-4 h-4 text-[#ED500A]" />
            <span>Repartidores y Entregas Asignadas</span>
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            {filteredDrivers.length} de {drivers.length} repartidores
          </span>
        </div>

        {filteredDrivers.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl">
            <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No hay repartidores que coincidan con el filtro
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Prueba cambiando el criterio de búsqueda o el filtro de disponibilidad.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredDrivers.map((driver) => {
              const driverEntry = ordersByDriver.get(driver.name.toLowerCase().trim()) || {
                active: [],
                delivered: [],
              };
              const activeOrders = driverEntry.active;
              const deliveredOrders = driverEntry.delivered;
              const hasActive = activeOrders.length > 0;
              const onTheWayCount = activeOrders.filter((o) => o.delivery_status === "on_the_way").length;
              const isCollapsed = collapsedCompleted[driver.id] !== true;

              return (
                <div
                  key={driver.id}
                  className={`rounded-2xl border transition-all flex flex-col justify-between overflow-hidden shadow-xs ${
                    hasActive
                      ? "bg-white dark:bg-[#0D0F16] border-slate-300 dark:border-white/[0.12] ring-1 ring-[#ED500A]/10"
                      : "bg-slate-50/60 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.06]"
                  }`}
                >
                  {/* CABECERA DEL REPARTIDOR */}
                  <div className="p-4 border-b border-slate-200 dark:border-white/[0.06] bg-slate-50/70 dark:bg-white/[0.02]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold relative ${
                            driver.isActive
                              ? "bg-[#ED500A]/15 text-[#ED500A] border border-[#ED500A]/30"
                              : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                          }`}
                        >
                          <Bike className="w-5 h-5" />
                          <span
                            className={`w-2.5 h-2.5 rounded-full absolute -top-0.5 -right-0.5 border-2 border-white dark:border-[#0D0F16] ${
                              driver.isActive ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black text-slate-900 dark:text-white">
                              {driver.name}
                            </h4>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                driver.isActive
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                  : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                              }`}
                            >
                              {driver.isActive ? "Activo" : "Inactivo"}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {driver.phone ? (
                              <a
                                href={`tel:${driver.phone}`}
                                className="flex items-center gap-1 hover:text-[#ED500A] font-mono text-[11px]"
                              >
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{driver.phone}</span>
                              </a>
                            ) : (
                              <span className="italic text-[11px]">Sin teléfono</span>
                            )}

                            {driver.phone && (
                              <a
                                href={`https://wa.me/57${driver.phone.replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline"
                                title="Enviar mensaje de WhatsApp"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>WhatsApp</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* ACCIÓN: COPIAR ENLACE DE ACCESO AL PORTAL */}
                      <button
                        type="button"
                        onClick={() => copyDriverPortalLink(driver.accessPin)}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-[#ED500A] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        title="Copiar enlace de acceso directo al portal de entregas del repartidor"
                      >
                        <Share2 className="w-3 h-3" />
                        <span className="hidden sm:inline">Portal</span>
                      </button>
                    </div>

                    {/* CHIPS DE RESUMEN RÁPIDO */}
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-200/60 dark:border-white/[0.04] text-xs">
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.06]">
                        <span className="text-[10px] text-slate-400 block font-bold">Activos</span>
                        <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                          {activeOrders.length}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.06]">
                        <span className="text-[10px] text-indigo-500 block font-bold">En Camino 🛵</span>
                        <span className="font-mono font-black text-sm text-indigo-600 dark:text-indigo-400">
                          {onTheWayCount}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.06]">
                        <span className="text-[10px] text-emerald-500 block font-bold">Entregados Hoy</span>
                        <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                          {deliveredOrders.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* CUERPO: PEDIDOS ACTIVOS ASIGNADOS A ESTE REPARTIDOR */}
                  <div className="p-4 flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">
                        Pedidos en Curso ({activeOrders.length})
                      </span>
                    </div>

                    {activeOrders.length === 0 ? (
                      <div className="py-8 text-center bg-slate-50/50 dark:bg-white/[0.01] rounded-xl border border-dashed border-slate-200 dark:border-white/[0.08]">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500/80 mx-auto mb-1.5" />
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Disponible para despacho
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Este domiciliario no tiene pedidos pendientes ni en ruta.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {activeOrders.map((order) => {
                          const elapsed = getElapsedInfo(order.created_at);
                          const isOnTheWay = order.delivery_status === "on_the_way";

                          return (
                            <div
                              key={order.id}
                              className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                                isOnTheWay
                                  ? "bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-500/30 shadow-xs"
                                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-black font-mono text-sm text-slate-900 dark:text-white">
                                    #{order.order_number}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                      isOnTheWay
                                        ? "bg-indigo-500 text-white"
                                        : "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                                    }`}
                                  >
                                    {isOnTheWay ? "En camino 🛵" : "Asignado (En espera)"}
                                  </span>
                                </div>

                                {/* CRONÓMETRO EN TIEMPO REAL */}
                                <div
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-bold ${
                                    elapsed.level === "critical"
                                      ? "bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40 animate-pulse"
                                      : elapsed.level === "warning"
                                      ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40"
                                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                  }`}
                                  title="Tiempo transcurrido en tiempo real"
                                >
                                  <Clock className="w-3 h-3" />
                                  <span>{elapsed.formatted}</span>
                                </div>
                              </div>

                              {/* DIRECCIÓN Y CLIENTE */}
                              <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
                                <p className="flex items-start gap-1.5 font-medium">
                                  <MapPin className="w-3.5 h-3.5 text-[#ED500A] shrink-0 mt-0.5" />
                                  <span className="line-clamp-2">{order.delivery_address || "Sin dirección"}</span>
                                </p>
                                <p className="text-[11px] text-slate-500 flex items-center justify-between">
                                  <span>{order.customer_name || "Cliente ocasional"}</span>
                                  <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                    {formatCOP(order.total)}
                                  </span>
                                </p>
                              </div>

                              {/* ACCIONES OPERATIVAS DIRECTAS */}
                              <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  {order.delivery_status === "assigned" && (
                                    <button
                                      type="button"
                                      onClick={() => onDispatch(order)}
                                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                                      title="Despachar pedido"
                                    >
                                      <Bike className="w-3 h-3" />
                                      <span>Despachar</span>
                                    </button>
                                  )}

                                  {order.delivery_status === "on_the_way" && (
                                    <button
                                      type="button"
                                      onClick={() => onConfirmException(order)}
                                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                                      title="Confirmar entrega"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>Entregado</span>
                                    </button>
                                  )}

                                  {/* REASIGNAR A OTRO DOMICILIARIO */}
                                  <Select
                                    selectSize="sm"
                                    defaultValue=""
                                    onChange={(e) => {
                                      const nextDriver = e.target.value;
                                      if (nextDriver && nextDriver !== driver.name) {
                                        onAssignDriver(order.id, nextDriver);
                                      }
                                    }}
                                    title="Reasignar a otro repartidor"
                                  >
                                    <option value="" disabled>
                                      Reasignar...
                                    </option>
                                    {drivers
                                      .filter((d) => d.isActive && d.name !== driver.name)
                                      .map((d) => (
                                        <option key={d.id} value={d.name}>
                                          → {d.name}
                                        </option>
                                      ))}
                                  </Select>
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => onOpenTicket(order)}
                                    className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                                    title="Imprimir comanda térmica"
                                  >
                                    <Printer className="w-3 h-3" />
                                  </button>

                                  <Link
                                    href={`/workspace/${businessId}/pedidos/${order.id}`}
                                    className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                                    title="Ver detalle del pedido"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </Link>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* SECCIÓN COLAPSABLE: ENTREGAS COMPLETADAS HOY */}
                    {deliveredOrders.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-white/[0.06]">
                        <button
                          type="button"
                          onClick={() => toggleCollapseCompleted(driver.id)}
                          className="w-full flex items-center justify-between text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white font-semibold cursor-pointer py-1"
                        >
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Entregas completadas hoy ({deliveredOrders.length})</span>
                          </span>
                          {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                        </button>

                        {!isCollapsed && (
                          <div className="space-y-1.5 mt-2">
                            {deliveredOrders.map((ord) => (
                              <div
                                key={ord.id}
                                className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-500/20 text-slate-700 dark:text-slate-300"
                              >
                                <span className="font-mono font-bold">#{ord.order_number}</span>
                                <span className="truncate max-w-[140px] text-slate-500">{ord.delivery_address}</span>
                                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                  {formatCOP(ord.total)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

