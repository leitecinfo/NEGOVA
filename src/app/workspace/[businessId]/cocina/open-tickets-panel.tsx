"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Receipt,
  Clock,
  AlertTriangle,
  Flame,
  Search,
  RefreshCw,
  ArrowUpRight,
  CreditCard,
  User,
  Phone,
  Users,
  UtensilsCrossed,
  ShoppingBag,
  Bike,
  ExternalLink,
  ChevronRight,
  SlidersHorizontal,
  DollarSign,
  ChefHat,
  Filter,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  OpenTicketDetails,
  OpenTicketsSummary,
  KdsTimeAlertConfig,
  DEFAULT_KDS_TIME_ALERTS,
  getKdsAlertLevel,
} from "@/lib/restaurant/types";
import { getKdsOpenTicketsAction } from "./actions";

interface OpenTicketsPanelProps {
  businessId: string;
  initialTickets?: OpenTicketDetails[];
  initialSummary?: OpenTicketsSummary;
  alertConfig?: KdsTimeAlertConfig;
  onSwitchToKds?: () => void;
}

export function OpenTicketsPanel({
  businessId,
  initialTickets = [],
  initialSummary,
  alertConfig = DEFAULT_KDS_TIME_ALERTS,
  onSwitchToKds,
}: OpenTicketsPanelProps) {
  const [tickets, setTickets] = useState<OpenTicketDetails[]>(initialTickets);
  const [summary, setSummary] = useState<OpenTicketsSummary>(
    initialSummary || {
      totalCount: initialTickets.length,
      totalAmount: initialTickets.reduce((sum, t) => sum + (t.total || 0), 0),
      delayedCount: initialTickets.filter((t) => t.alertLevel === "warning").length,
      delayedAmount: initialTickets
        .filter((t) => t.alertLevel === "warning")
        .reduce((sum, t) => sum + (t.total || 0), 0),
      criticalCount: initialTickets.filter((t) => t.alertLevel === "critical").length,
      criticalAmount: initialTickets
        .filter((t) => t.alertLevel === "critical")
        .reduce((sum, t) => sum + (t.total || 0), 0),
    }
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [alertFilter, setAlertFilter] = useState<"all" | "delayed" | "critical">("all");
  const [sortOrder, setSortOrder] = useState<"oldest" | "newest">("oldest");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Actualizar reloj interno cada 15 segundos para recalcular demoras
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);

  const formatCOP = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await getKdsOpenTicketsAction(businessId);
      if (res.success && res.data) {
        setTickets(res.data.tickets);
        setSummary(res.data.summary);
        toast.success("Tickets abiertos actualizados.");
      } else {
        toast.error(res.error || "No se pudieron refrescar los tickets.");
      }
    } catch {
      toast.error("Error al actualizar la lista de tickets abiertos.");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filtrado y ordenamiento de tickets
  const filteredTickets = useMemo(() => {
    let result = tickets.filter((ticket) => {
      // 1. Filtro por canal
      if (channelFilter !== "all" && ticket.channel_origin !== channelFilter) {
        return false;
      }

      // 2. Filtro por tipo de servicio
      if (serviceFilter !== "all" && ticket.order_type !== serviceFilter) {
        return false;
      }

      // 3. Filtro por nivel de alerta
      const alert = getKdsAlertLevel(ticket.created_at, alertConfig);
      if (alertFilter === "delayed" && alert.level !== "warning") {
        return false;
      }
      if (alertFilter === "critical" && alert.level !== "critical") {
        return false;
      }

      // 4. Búsqueda de texto
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesNumber = String(ticket.order_number).includes(q.replace(/^#/, ""));
        const matchesCustomer = ticket.customer_name?.toLowerCase().includes(q);
        const matchesPhone = ticket.customer_phone?.toLowerCase().includes(q);
        const matchesTable = ticket.tableName?.toLowerCase().includes(q);
        const matchesRoom = ticket.roomName?.toLowerCase().includes(q);
        const matchesCashier = ticket.cashierName?.toLowerCase().includes(q);
        const matchesItems = ticket.items?.some((it) =>
          it.product_name.toLowerCase().includes(q)
        );

        if (
          !matchesNumber &&
          !matchesCustomer &&
          !matchesPhone &&
          !matchesTable &&
          !matchesRoom &&
          !matchesCashier &&
          !matchesItems
        ) {
          return false;
        }
      }

      return true;
    });

    // Ordenamiento
    result.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === "oldest" ? dateA - dateB : dateB - dateA;
    });

    return result;
  }, [tickets, channelFilter, serviceFilter, alertFilter, searchQuery, sortOrder, alertConfig, currentTime]);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-[#0B0E14] text-slate-900 dark:text-[#F8F9FD] min-h-full">
      {/* HEADER DE LA SECCIÓN DE TICKETS ABIERTOS */}
      <div className="bg-white/95 dark:bg-[#0D0F16]/95 backdrop-blur-xs border-b border-slate-200/80 dark:border-white/[0.08] px-4 py-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
                  Panel de Tickets Abiertos
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
                  <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse" />
                  Cuentas por Cobrar
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Cuentas activas en salón, pedidos para llevar y domicilios pendientes de facturar.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {onSwitchToKds && (
              <button
                type="button"
                onClick={onSwitchToKds}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#131620] hover:bg-slate-100 dark:hover:bg-white/[0.05] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/[0.1] text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
              >
                <ChefHat className="w-4 h-4 text-[#ED500A]" />
                <span>Ver Monitor de Cocina</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-3 py-2 rounded-xl bg-white dark:bg-[#131620] hover:bg-slate-100 dark:hover:bg-white/[0.05] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/[0.1] text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-2xs"
              title="Refrescar lista"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-amber-500 dark:text-amber-400" : ""}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
          </div>
        </div>

        {/* 3 TARJETAS KPIS: EN ESTA VISTA, DEMORADOS, CRÍTICOS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-4">
          {/* KPI 1: EN ESTA VISTA */}
          <div
            onClick={() => setAlertFilter("all")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              alertFilter === "all"
                ? "bg-white dark:bg-[#0D0F16] border-[#ED500A] shadow-md ring-1 ring-[#ED500A]/30"
                : "bg-white dark:bg-[#0D0F16] border-slate-200/80 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15] shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
              <span className="flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                En esta vista
              </span>
              <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">
                {summary.totalCount} {summary.totalCount === 1 ? "ticket" : "tickets"}
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {formatCOP(summary.totalAmount)}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Valor acumulado total pendiente de cobro en caja.
            </p>
          </div>

          {/* KPI 2: DEMORADOS */}
          <div
            onClick={() => setAlertFilter(alertFilter === "delayed" ? "all" : "delayed")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              alertFilter === "delayed"
                ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-400 shadow-md ring-2 ring-amber-400"
                : "bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-500/30 hover:border-amber-300 dark:hover:border-amber-500/50 shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 animate-bounce" />
                Demorados (&gt;{alertConfig.warningMinutes}m)
              </span>
              <span className="font-mono bg-amber-100 dark:bg-amber-500/20 px-2 py-0.5 rounded-full text-amber-800 dark:text-amber-300 font-black">
                {summary.delayedCount}
              </span>
            </div>
            <div className="text-2xl font-black text-amber-800 dark:text-amber-300 tracking-tight">
              {formatCOP(summary.delayedAmount)}
            </div>
            <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-1">
              Tickets que superan {alertConfig.warningMinutes} min sin registrar pago.
            </p>
          </div>

          {/* KPI 3: CRÍTICOS */}
          <div
            onClick={() => setAlertFilter(alertFilter === "critical" ? "all" : "critical")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              alertFilter === "critical"
                ? "bg-rose-50/80 dark:bg-rose-950/40 border-rose-500 shadow-md ring-2 ring-rose-400"
                : "bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-500/30 hover:border-rose-300 dark:hover:border-rose-500/50 shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-rose-700 dark:text-rose-400 mb-1">
              <span className="flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-rose-500 dark:text-rose-400 animate-pulse" />
                Críticos (&gt;{alertConfig.criticalMinutes}m)
              </span>
              <span className="font-mono bg-rose-100 dark:bg-rose-500/20 px-2 py-0.5 rounded-full text-rose-800 dark:text-rose-300 font-black">
                {summary.criticalCount}
              </span>
            </div>
            <div className="text-2xl font-black text-rose-700 dark:text-rose-400 tracking-tight">
              {formatCOP(summary.criticalAmount)}
            </div>
            <p className="text-[11px] text-rose-700/80 dark:text-rose-400/80 mt-1">
              Atención urgente: más de {alertConfig.criticalMinutes} min abiertos.
            </p>
          </div>
        </div>

        {/* BARRA DE FILTROS Y BÚSQUEDA */}
        <div className="mt-4 pt-4 border-t border-slate-200/80 dark:border-white/[0.08] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* INPUT DE BÚSQUEDA */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por # ticket, mesa, cliente, cajero o plato..."
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#131620] border border-slate-200 dark:border-white/[0.1] rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-[#ED500A] shadow-2xs transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white text-xs font-bold px-1 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* FILTROS RÁPIDOS */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* CANAL */}
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="bg-white dark:bg-[#131620] border border-slate-200 dark:border-white/[0.1] rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-[#ED500A] shadow-2xs"
            >
              <option value="all">Todos los canales</option>
              <option value="in_person">POS / Mostrador</option>
              <option value="digital_menu">Menú QR</option>
              <option value="whatsapp">Domicilio / WhatsApp</option>
            </select>

            {/* SERVICIO */}
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="bg-white dark:bg-[#131620] border border-slate-200 dark:border-white/[0.1] rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-[#ED500A] shadow-2xs"
            >
              <option value="all">Todos los servicios</option>
              <option value="dine_in">Mesa (Salón)</option>
              <option value="takeout">Para Llevar</option>
              <option value="delivery">Domicilio</option>
            </select>

            {/* ORDEN */}
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "oldest" | "newest")}
              className="bg-white dark:bg-[#131620] border border-slate-200 dark:border-white/[0.1] rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-[#ED500A] shadow-2xs"
            >
              <option value="oldest">Más antiguos primero (FIFO)</option>
              <option value="newest">Más recientes primero</option>
            </select>
          </div>
        </div>
      </div>

      {/* LISTA / GRID DE TICKETS ABIERTOS */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
        {filteredTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] flex items-center justify-center text-slate-400 dark:text-slate-500 mb-4 shadow-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500/80" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              No hay tickets abiertos con estos filtros
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
              Todas las órdenes han sido liquidadas en caja o no coinciden con los criterios de búsqueda seleccionados.
            </p>
            {(searchQuery || channelFilter !== "all" || serviceFilter !== "all" || alertFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setChannelFilter("all");
                  setServiceFilter("all");
                  setAlertFilter("all");
                }}
                className="mt-4 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200 dark:hover:bg-white/[0.1] text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08] cursor-pointer"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTickets.map((ticket) => {
              const alert = getKdsAlertLevel(ticket.created_at, alertConfig);
              const isCritical = alert.level === "critical";
              const isWarning = alert.level === "warning";

              // Canal badge
              let channelLabel = "POS";
              let channelBadgeClass = "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700";
              if (ticket.channel_origin === "digital_menu") {
                channelLabel = "Menú QR";
                channelBadgeClass = "bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30";
              } else if (ticket.channel_origin === "whatsapp") {
                channelLabel = "WhatsApp";
                channelBadgeClass = "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30";
              } else {
                channelBadgeClass = "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30";
              }

              // Servicio badge
              let serviceLabel = "Mesa";
              let serviceIcon = <UtensilsCrossed className="w-3 h-3" />;
              if (ticket.order_type === "takeout") {
                serviceLabel = "Para Llevar";
                serviceIcon = <ShoppingBag className="w-3 h-3" />;
              } else if (ticket.order_type === "delivery") {
                serviceLabel = "Domicilio";
                serviceIcon = <Bike className="w-3 h-3" />;
              }

              // Estado operativo
              const statusLabels: Record<string, { text: string; color: string }> = {
                received: { text: "Recibido", color: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700/50" },
                in_preparation: { text: "En Preparación", color: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700/50" },
                ready: { text: "Listo", color: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/50" },
                delivered: { text: "Entregado (Por Cobrar)", color: "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700/50" },
              };
              const statusInfo = statusLabels[ticket.status] || { text: ticket.status, color: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700" };

              return (
                <div
                  key={ticket.id}
                  className={`rounded-2xl border flex flex-col justify-between transition-all duration-200 overflow-hidden shadow-xs ${
                    isCritical
                      ? "bg-rose-50/40 dark:bg-[#0D0F16] border-rose-400 dark:border-rose-500/70 shadow-md shadow-rose-500/10 ring-1 ring-rose-500/30"
                      : isWarning
                      ? "bg-amber-50/40 dark:bg-[#0D0F16] border-amber-400 dark:border-amber-500/60 shadow-md shadow-amber-500/10"
                      : "bg-white dark:bg-[#0D0F16] border-slate-200/80 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15]"
                  }`}
                >
                  {/* CABECERA DEL TICKET */}
                  <div className="p-4 border-b border-slate-100 dark:border-white/[0.06]">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                          #{ticket.order_number}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${channelBadgeClass}`}>
                          {channelLabel}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08]">
                          {serviceIcon}
                          {serviceLabel}
                        </span>
                      </div>

                      {/* TIEMPO Y ALERTA */}
                      <div
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${
                          isCritical
                            ? "bg-rose-600 text-white border border-rose-600 animate-pulse"
                            : isWarning
                            ? "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/50"
                            : "bg-slate-100 dark:bg-[#131620] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08]"
                        }`}
                        suppressHydrationWarning
                      >
                        {isCritical ? (
                          <Flame className="w-3.5 h-3.5 text-white" />
                        ) : isWarning ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        )}
                        <span suppressHydrationWarning>{alert.elapsedFormatted}</span>
                      </div>
                    </div>

                    {/* MESA Y SALA */}
                    <div className="flex items-center justify-between text-xs mt-1">
                      <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <UtensilsCrossed className="w-3.5 h-3.5 text-[#ED500A]" />
                        <span>
                          {ticket.tableName
                            ? `${ticket.tableName}${ticket.roomName ? ` · ${ticket.roomName}` : ""}`
                            : ticket.order_type === "dine_in"
                            ? "Mesa sin asignar"
                            : serviceLabel}
                        </span>
                      </div>

                      {/* COMENSALES */}
                      <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-[11px] font-medium font-mono">
                        <Users className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                        <span>
                          {ticket.dinersCount || 1} {ticket.dinersCount === 1 ? "comensal" : "comensales"}
                        </span>
                      </div>
                    </div>

                    {/* CLIENTE Y CAJERO */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-white/[0.06] grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 block text-[10px] uppercase font-bold">Cliente</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200 truncate block">
                          {ticket.customer_name || "Comensal ocasional"}
                        </span>
                        {ticket.customer_phone && (
                          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 font-mono text-[10px]">
                            <Phone className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500" />
                            {ticket.customer_phone}
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="text-slate-400 dark:text-slate-500 block text-[10px] uppercase font-bold">Atendido por</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200 truncate block" title={ticket.cashierName || undefined}>
                          {ticket.cashierName || "Caja Principal"}
                        </span>
                        <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${statusInfo.color}`}>
                          {statusInfo.text}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* RESUMEN DE ITEMS DEL TICKET */}
                  <div className="px-4 py-3 bg-slate-50/70 dark:bg-[#0B0E14]/60 text-xs">
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold mb-1.5 flex items-center justify-between">
                      <span>Artículos ({ticket.itemsCount || 0})</span>
                      <span className="font-mono text-slate-500 dark:text-slate-400">Total</span>
                    </div>

                    <div className="space-y-1 max-h-28 overflow-y-auto pr-1 scrollbar-none">
                      {ticket.items && ticket.items.length > 0 ? (
                        ticket.items.map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
                            <span className="truncate pr-2">
                              <strong className="text-[#ED500A] font-mono">{it.quantity}x</strong>{" "}
                              {it.product_name}
                            </span>
                            <span className="font-mono text-slate-500 dark:text-slate-400 shrink-0 text-[11px]">
                              {formatCOP(it.subtotal || it.unit_price * it.quantity)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-slate-400 dark:text-slate-500 italic text-[11px]">Sin artículos desglosados</p>
                      )}
                    </div>
                  </div>

                  {/* FOOTER DEL TICKET: TOTAL Y ACCIONES DIRECTAS */}
                  <div className="p-4 bg-slate-50/50 dark:bg-[#0D0F16] border-t border-slate-100 dark:border-white/[0.06]">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Total a Pagar</span>
                        <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                          {formatCOP(ticket.total)}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
                        {ticket.payment_status === "partial" ? "Abono Parcial" : "Pendiente Cobro"}
                      </span>
                    </div>

                    {/* ENLACES DIRECTOS: MIS ÓRDENES & FACTURA / COBRAR */}
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href={`/workspace/${businessId}/pedidos/${ticket.id}`}
                        className="px-3 py-2 rounded-xl bg-white dark:bg-[#131620] hover:bg-slate-100 dark:hover:bg-white/[0.05] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/[0.1] text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                        title="Ver detalle en Mis Órdenes"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                        <span>Mis Órdenes</span>
                      </Link>

                      {ticket.table_id ? (
                        <Link
                          href={`/workspace/${businessId}/mesas?mesaId=${ticket.table_id}`}
                          className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs"
                          title="Cobrar cuenta de mesa"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Cobrar / Factura</span>
                        </Link>
                      ) : (
                        <Link
                          href={`/workspace/${businessId}/pedidos/${ticket.id}`}
                          className="px-3 py-2 rounded-xl bg-[#ED500A] hover:bg-[#d94608] text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs"
                          title="Liquidar / Facturar pedido"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Factura / Cobro</span>
                        </Link>
                      )}
                    </div>
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

