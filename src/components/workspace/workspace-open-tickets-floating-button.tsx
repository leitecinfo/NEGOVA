"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Receipt,
  X,
  RefreshCw,
  Search,
  CreditCard,
  Clock,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Flame,
  UtensilsCrossed,
  ShoppingBag,
  Bike,
  Store,
  QrCode,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  OpenTicketDetails,
  OpenTicketsSummary,
  getKdsAlertLevel,
  DEFAULT_KDS_TIME_ALERTS,
} from "@/lib/restaurant/types";
import { getKdsOpenTicketsAction } from "@/app/workspace/[businessId]/cocina/actions";

interface WorkspaceOpenTicketsFloatingButtonProps {
  businessId: string;
}

export function WorkspaceOpenTicketsFloatingButton({
  businessId,
}: WorkspaceOpenTicketsFloatingButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tickets, setTickets] = useState<OpenTicketDetails[]>([]);
  const [summary, setSummary] = useState<OpenTicketsSummary | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // Estado y referencias para posicionamiento arrastrable del botón
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    btnX: number;
    btnY: number;
    hasMoved: boolean;
  } | null>(null);

  // Cargar posición persistida de localStorage al montar
  useEffect(() => {
    try {
      const saved = localStorage.getItem("negova_open_tickets_btn_pos");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
          const btnSize = 56;
          const clampedX = Math.max(12, Math.min(parsed.x, window.innerWidth - btnSize - 12));
          const clampedY = Math.max(12, Math.min(parsed.y, window.innerHeight - btnSize - 12));
          const initialPos = { x: clampedX, y: clampedY };
          currentPosRef.current = initialPos;
          setPosition(initialPos);
        }
      }
    } catch (err) {
      console.warn("[WorkspaceOpenTicketsFloatingButton] Error al cargar posición guardada:", err);
    }
  }, []);

  // Mantener el botón dentro de la ventana al cambiar tamaño de pantalla
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        if (!prev) return null;
        const btnSize = 56;
        const clampedX = Math.max(12, Math.min(prev.x, window.innerWidth - btnSize - 12));
        const clampedY = Math.max(12, Math.min(prev.y, window.innerHeight - btnSize - 12));
        const updated = { x: clampedX, y: clampedY };
        currentPosRef.current = updated;
        return updated;
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return; // Solo responder a click izquierdo o toque principal
    const btn = e.currentTarget;
    try {
      btn.setPointerCapture(e.pointerId);
    } catch {}

    const rect = btn.getBoundingClientRect();
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      btnX: rect.left,
      btnY: rect.top,
      hasMoved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStartRef.current) return;

    const deltaX = e.clientX - dragStartRef.current.pointerX;
    const deltaY = e.clientY - dragStartRef.current.pointerY;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance > 5) {
      dragStartRef.current.hasMoved = true;
      setIsDragging(true);
    }

    if (dragStartRef.current.hasMoved) {
      const btnSize = 56;
      const newX = Math.max(
        12,
        Math.min(dragStartRef.current.btnX + deltaX, window.innerWidth - btnSize - 12)
      );
      const newY = Math.max(
        12,
        Math.min(dragStartRef.current.btnY + deltaY, window.innerHeight - btnSize - 12)
      );
      const newPos = { x: newX, y: newY };
      currentPosRef.current = newPos;
      setPosition(newPos);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStartRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const hadMoved = dragStartRef.current.hasMoved;
    dragStartRef.current = null;
    setIsDragging(false);

    if (hadMoved) {
      // Se arrastró y soltó: guardar la posición final
      if (currentPosRef.current) {
        try {
          localStorage.setItem(
            "negova_open_tickets_btn_pos",
            JSON.stringify(currentPosRef.current)
          );
        } catch {}
      }
    } else {
      // Clic simple: abrir drawer
      setIsOpen(true);
      if (!hasLoadedOnce) fetchTickets(true);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    dragStartRef.current = null;
    setIsDragging(false);
  };

  const handleDoubleClick = () => {
    try {
      localStorage.removeItem("negova_open_tickets_btn_pos");
    } catch {}
    currentPosRef.current = null;
    setPosition(null);
    toast.info("Posición de tickets restablecida a la esquina inferior.");
  };

  // Filtros locales del drawer (idéntico a Image 2 y 3)
  const [searchQuery, setSearchQuery] = useState("");
  const [originFilter, setOriginFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const fetchTickets = useCallback(
    async (silent: boolean = false) => {
      if (!silent) setIsRefreshing(true);
      try {
        const res = await getKdsOpenTicketsAction(businessId);
        if (res.success && res.data) {
          setTickets(res.data.tickets || []);
          setSummary(res.data.summary || null);
          setHasLoadedOnce(true);
          if (!silent) toast.success("Tickets abiertos actualizados.");
        }
      } catch (err) {
        if (!silent) toast.error("Error al consultar tickets abiertos.");
      } finally {
        if (!silent) setIsRefreshing(false);
      }
    },
    [businessId]
  );

  // Carga inicial y sondeo periódico
  useEffect(() => {
    fetchTickets(true);

    // Actualizar ante eventos en tiempo real
    const handleLiveEvent = () => {
      fetchTickets(true);
    };

    window.addEventListener("negova:new_order", handleLiveEvent);
    window.addEventListener("negova:order_ready", handleLiveEvent);

    // Sondeo de respaldo cada 25 segundos
    const interval = setInterval(() => {
      fetchTickets(true);
    }, 25000);

    return () => {
      window.removeEventListener("negova:new_order", handleLiveEvent);
      window.removeEventListener("negova:order_ready", handleLiveEvent);
      clearInterval(interval);
    };
  }, [fetchTickets]);

  const openCount = summary?.totalCount ?? tickets.length;

  // Filtrado de tickets
  const filteredTickets = useMemo(() => {
    let result = [...tickets];

    if (originFilter !== "all") {
      result = result.filter((t) => t.channel_origin === originFilter);
    }

    if (statusFilter !== "all") {
      result = result.filter((t) => t.status === statusFilter);
    }

    if (serviceFilter !== "all") {
      result = result.filter((t) => t.order_type === serviceFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          String(t.order_number).includes(q) ||
          t.customer_name?.toLowerCase().includes(q) ||
          t.tableName?.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
    });

    return result;
  }, [tickets, originFilter, statusFilter, serviceFilter, searchQuery, sortOrder]);

  const getOriginBadge = (origin: string) => {
    switch (origin) {
      case "pos":
        return { label: "POS", icon: Store, color: "text-slate-500" };
      case "tables":
      case "in_person":
        return { label: "Mesas", icon: UtensilsCrossed, color: "text-emerald-500" };
      case "whatsapp":
        return { label: "WhatsApp", icon: MessageSquare, color: "text-emerald-600" };
      case "digital_menu":
      case "qr":
        return { label: "Menú QR", icon: QrCode, color: "text-purple-500" };
      default:
        return { label: origin, icon: Store, color: "text-slate-500" };
    }
  };

  const getServiceLabel = (type: string) => {
    switch (type) {
      case "dine_in":
        return "Comer aquí";
      case "takeout":
        return "Para llevar";
      case "delivery":
        return "A domicilio";
      default:
        return type;
    }
  };

  return (
    <>
      {/* BOTÓN FLOTANTE INFERIOR DERECHO (ARRASTRABLE) */}
      <div
        ref={containerRef}
        style={
          position
            ? {
                position: "fixed",
                left: `${position.x}px`,
                top: `${position.y}px`,
                zIndex: 40,
              }
            : undefined
        }
        className={
          position
            ? "z-40 flex items-center group font-body touch-none select-none"
            : "fixed bottom-5 right-5 z-40 flex items-center group font-body touch-none select-none"
        }
      >
        <button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onDoubleClick={handleDoubleClick}
          aria-label="Abrir tickets en curso (arrastra para mover)"
          title="Tickets Abiertos (Arrastra para mover • Doble clic para restablecer)"
          className={`relative w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-[#EF4444] hover:bg-[#DC2626] text-white flex items-center justify-center border-2 border-white/30 dark:border-white/20 focus:outline-hidden focus:ring-2 focus:ring-red-400 focus:ring-offset-2 select-none touch-none ${
            isDragging
              ? "cursor-grabbing scale-105 shadow-[0_4px_20px_rgba(239,68,68,0.45)] ring-4 ring-red-400/30 transition-none"
              : "cursor-grab shadow-[0_2px_12px_rgba(0,0,0,0.2),0_0_1px_rgba(0,0,0,0.15)] dark:shadow-[0_2px_14px_rgba(0,0,0,0.6)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.25)] transition-all hover:scale-105 active:scale-95"
          }`}
        >
          <Receipt className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.2] pointer-events-none" />

          {/* BADGE NUMÉRICO ROJO CON BORDE */}
          {openCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-rose-600 text-white font-black text-xs border-2 border-white dark:border-[#0D0F16] flex items-center justify-center shadow-[0_1px_4px_rgba(0,0,0,0.3)] animate-in zoom-in duration-200 pointer-events-none">
              {openCount}
            </span>
          )}
        </button>
      </div>

      {/* DRAWER LATERAL DE TICKETS ABIERTOS */}
      {isOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9989] bg-black/50 backdrop-blur-xs animate-in fade-in duration-200" onClick={() => setIsOpen(false)} />

          <aside
            aria-label="Panel de tickets abiertos"
            className="fixed inset-y-0 right-0 z-[9990] w-full max-w-md sm:max-w-lg bg-white dark:bg-[#0D0F16] border-l border-slate-200 dark:border-white/[0.08] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden font-body"
          >
            {/* HEADER DEL DRAWER */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/[0.08] flex items-start justify-between gap-3 shrink-0 bg-slate-50/50 dark:bg-white/[0.02]">
              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Tu operación
                </span>
                <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                  Tickets Abiertos
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Consulta tus pedidos en curso y continúa cada venta desde un solo lugar.
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => fetchTickets(false)}
                  disabled={isRefreshing}
                  title="Refrescar lista"
                  className="p-2 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Cerrar panel"
                  className="p-2 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* CONTENIDO DESPLAZABLE */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
              {/* RESUMEN DE ESTA VISTA (4 CARDS) */}
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">
                  <span>Resumen de esta vista</span>
                  <span className="text-[11px]">Según filtros</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {/* Card 1: Tickets Abiertos */}
                  <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <div className="w-6 h-6 rounded-md bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <Receipt className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[11px]">Tickets abiertos</span>
                    </div>
                    <div className="mt-2 text-xl font-black text-slate-900 dark:text-white">
                      {summary?.totalCount ?? tickets.length}
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      En esta vista
                    </span>
                  </div>

                  {/* Card 2: Valor de tickets */}
                  <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <div className="w-6 h-6 rounded-md bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                        <CreditCard className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[11px]">Valor de tickets</span>
                    </div>
                    <div className="mt-2 text-lg sm:text-xl font-black text-slate-900 dark:text-white truncate">
                      {formatCOP(summary?.totalAmount ?? 0)}
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      No equivale a cobros
                    </span>
                  </div>

                  {/* Card 3: Demorados */}
                  <div className="p-3.5 rounded-xl border border-amber-200/60 dark:border-amber-500/20 bg-amber-50/30 dark:bg-amber-500/5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                      <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span className="text-[11px]">Demorados</span>
                    </div>
                    <div className="mt-2 text-xl font-black text-amber-800 dark:text-amber-300">
                      {summary?.delayedCount ?? 0}
                    </div>
                    <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80">
                      Desde 5 min
                    </span>
                  </div>

                  {/* Card 4: Críticos */}
                  <div className="p-3.5 rounded-xl border border-rose-200/60 dark:border-rose-500/20 bg-rose-50/30 dark:bg-rose-500/5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-400">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      <span className="text-[11px]">Críticos</span>
                    </div>
                    <div className="mt-2 text-xl font-black text-rose-800 dark:text-rose-300">
                      {summary?.criticalCount ?? 0}
                    </div>
                    <span className="text-[10px] text-rose-600/80 dark:text-rose-400/80">
                      Desde 15 min
                    </span>
                  </div>
                </div>
              </div>

              {/* BUSCAR Y FILTRAR */}
              <div className="p-4 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/40 dark:bg-white/[0.02] space-y-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5" />
                  Buscar y filtrar
                </span>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="N.º, nombre, cliente o mesa..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-white/[0.1] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Origen</label>
                    <select
                      value={originFilter}
                      onChange={(e) => setOriginFilter(e.target.value)}
                      className="w-full p-1.5 rounded-lg bg-white dark:bg-[#131620] border border-slate-200 dark:border-white/[0.1] text-slate-900 dark:text-white text-xs"
                    >
                      <option value="all">Todos los orígenes</option>
                      <option value="pos">POS</option>
                      <option value="tables">Mesas</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="digital_menu">Menú QR</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Estado</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full p-1.5 rounded-lg bg-white dark:bg-[#131620] border border-slate-200 dark:border-white/[0.1] text-slate-900 dark:text-white text-xs"
                    >
                      <option value="all">Todos los estados</option>
                      <option value="received">Recibido</option>
                      <option value="in_preparation">En preparación</option>
                      <option value="ready">Listo</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Servicio</label>
                    <select
                      value={serviceFilter}
                      onChange={(e) => setServiceFilter(e.target.value)}
                      className="w-full p-1.5 rounded-lg bg-white dark:bg-[#131620] border border-slate-200 dark:border-white/[0.1] text-slate-900 dark:text-white text-xs"
                    >
                      <option value="all">Todos los servicios</option>
                      <option value="dine_in">Comer aquí</option>
                      <option value="takeout">Para llevar</option>
                      <option value="delivery">A domicilio</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Ordenar por</label>
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as any)}
                      className="w-full p-1.5 rounded-lg bg-white dark:bg-[#131620] border border-slate-200 dark:border-white/[0.1] text-slate-900 dark:text-white text-xs"
                    >
                      <option value="newest">Más recientes</option>
                      <option value="oldest">Más antiguos</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* LISTADO DE PEDIDOS EN CURSO */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  <span>Pedidos en curso</span>
                  <span className="text-slate-400 font-normal">
                    {filteredTickets.length} de {tickets.length} tickets
                  </span>
                </div>

                {filteredTickets.length === 0 ? (
                  <div className="p-8 text-center rounded-xl border border-dashed border-slate-200 dark:border-white/[0.08]">
                    <Receipt className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      No hay tickets abiertos con estos filtros
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredTickets.map((ticket) => {
                      const origin = getOriginBadge(ticket.channel_origin);
                      const OriginIcon = origin.icon;
                      const alert = getKdsAlertLevel(ticket.created_at, DEFAULT_KDS_TIME_ALERTS);

                      const isCritical = alert.level === "critical";
                      const isWarning = alert.level === "warning";

                      return (
                        <div
                          key={ticket.id}
                          className={`p-4 rounded-xl border transition-all ${
                            isCritical
                              ? "border-rose-300 dark:border-rose-500/40 bg-rose-50/20 dark:bg-rose-950/10 shadow-xs"
                              : isWarning
                              ? "border-amber-300 dark:border-amber-500/40 bg-amber-50/20 dark:bg-amber-950/10"
                              : "border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#131620]"
                          }`}
                        >
                          {/* CABECERA: ORIGEN Y CORRELATIVO */}
                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                            <span className="flex items-center gap-1 font-medium">
                              <OriginIcon className={`w-3.5 h-3.5 ${origin.color}`} />
                              <span>{origin.label}</span>
                              <span className="text-slate-300 dark:text-slate-600">•</span>
                              <span className="font-mono">#{ticket.order_number}</span>
                            </span>

                            <Link
                              href={`/workspace/${businessId}/pedidos/${ticket.id}`}
                              onClick={() => setIsOpen(false)}
                              className="text-xs font-semibold text-[#ED500A] hover:underline flex items-center gap-0.5"
                            >
                              <span>Ver detalle</span>
                              <ChevronRight className="w-3 h-3" />
                            </Link>
                          </div>

                          {/* NOMBRE DE MESA O CLIENTE + TOTAL */}
                          <div className="flex items-start justify-between gap-3 mt-1.5">
                            <div>
                              <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                                {ticket.tableName
                                  ? `Mesa ${ticket.tableName.replace(/^Mesa\s*/i, "")}`
                                  : ticket.customer_name || `Pedido #${ticket.order_number}`}
                              </h3>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {ticket.customer_name ? ticket.customer_name : "Sin cliente asignado"}
                                {ticket.cashierName && ` • ${ticket.cashierName}`}
                              </p>
                              <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-400 mt-1 font-medium bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 rounded-md">
                                {getServiceLabel(ticket.order_type)}
                              </span>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="text-base font-black text-slate-900 dark:text-white">
                                {formatCOP(ticket.total || 0)}
                              </div>
                            </div>
                          </div>

                          {/* ALERTAS DE TIEMPO Y ESTADO */}
                          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              {isCritical && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>{alert.elapsedFormatted} • Crítico</span>
                                </span>
                              )}
                              {isWarning && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>{alert.elapsedFormatted} • Demorado</span>
                                </span>
                              )}
                              {!isCritical && !isWarning && (
                                <span className="text-[11px] text-slate-500 font-mono">
                                  {alert.elapsedFormatted}
                                </span>
                              )}
                            </div>

                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                ticket.status === "ready"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                                  : ticket.status === "in_preparation"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                              }`}
                            >
                              {ticket.status === "ready"
                                ? "Listo"
                                : ticket.status === "in_preparation"
                                ? "En preparación"
                                : "Pendiente"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* PIE DEL DRAWER: ENLACE A MIS ÓRDENES */}
            <div className="p-4 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02] shrink-0">
              <Link
                href={`/workspace/${businessId}/pedidos`}
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#131620] hover:bg-slate-50 dark:hover:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] transition-colors text-xs font-semibold text-slate-900 dark:text-white group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold">Ir a Mis Órdenes</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                      Tablero completo, filtros y facturación
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white group-hover:translate-x-0.5 transition-all" />
              </Link>
            </div>
          </aside>
        </ModalPortal>
      )}
    </>
  );
}
