"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Headphones,
  CheckCheck,
  Clock,
  Receipt,
  ShieldAlert,
  CreditCard,
  Info,
  Search,
  Check,
  RefreshCw,
  ExternalLink,
  ArrowRight,
  Tag,
  Sparkles,
  X,
} from "lucide-react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { toast } from "sonner";
import {
  AppNotification,
  sanitizeWorkspaceNotificationLink,
} from "@/lib/notifications/types";
import {
  getWorkspaceNotificationsAction,
  markWorkspaceNotificationAsReadAction,
  markAllWorkspaceNotificationsAsReadAction,
} from "./actions";

interface WorkspaceNotificacionesClientProps {
  businessId: string;
  currentUserId: string;
  initialNotifications: AppNotification[];
  initialError?: string | null;
}

type FilterTab = "all" | "unread" | "documents" | "support" | "system";

function formatFullDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Bogota",
    }).format(d);
  } catch {
    return isoString;
  }
}

function getRelativeTime(dateString: string): string {
  try {
    const diff = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return "Hace un momento";
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours} h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days} d`;
  } catch {
    return "Reciente";
  }
}

export function WorkspaceNotificacionesClient({
  businessId,
  currentUserId,
  initialNotifications,
  initialError = null,
}: WorkspaceNotificacionesClientProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>(
    initialNotifications
  );
  const [error, setError] = useState<string | null>(initialError);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<AppNotification | null>(null);

  // Recargar datos
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await getWorkspaceNotificationsAction(businessId, { limit: 50 });
      if (res.success && res.data) {
        setNotifications(res.data);
        setError(null);
        toast.success("Bandeja de notificaciones actualizada");
      } else {
        const errMsg = res.error || "No se pudo refrescar la bandeja de notificaciones.";
        setError(errMsg);
        toast.error(errMsg);
      }
    } catch (err: any) {
      const errMsg = err?.message || "Error al conectar con el servidor.";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Marcar una como leída
  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true, read: true } : n))
    );
    const res = await markWorkspaceNotificationAsReadAction(businessId, id);
    if (res.success) {
      toast.success("Notificación marcada como leída");
    }
  };

  // Marcar todas como leídas
  const handleMarkAllAsRead = async () => {
    if (isMarkingAll) return;
    setIsMarkingAll(true);
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, read: true })));
      const res = await markAllWorkspaceNotificationsAsReadAction(businessId);
      if (res.success) {
        toast.success("Todas las notificaciones fueron marcadas como leídas");
      }
    } catch {
      toast.error("Ocurrió un error al procesar la acción.");
    } finally {
      setIsMarkingAll(false);
    }
  };

  // Contadores
  const counts = useMemo(() => {
    return {
      all: notifications.length,
      unread: notifications.filter((n) => !n.isRead && !n.read).length,
      documents: notifications.filter((n) => n.type === "document_generated").length,
      support: notifications.filter((n) =>
        [
          "support_interaction",
          "support_ticket",
          "support_chat",
          "ticket_assigned",
          "chat_escalated",
        ].includes(n.type)
      ).length,
      system: notifications.filter((n) =>
        ["security", "system", "billing"].includes(n.type)
      ).length,
    };
  }, [notifications]);

  // Filtrado
  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      const isUnread = !notif.isRead && !notif.read;
      if (activeTab === "unread" && !isUnread) return false;
      if (activeTab === "documents" && notif.type !== "document_generated") return false;
      if (
        activeTab === "support" &&
        ![
          "support_interaction",
          "support_ticket",
          "support_chat",
          "ticket_assigned",
          "chat_escalated",
        ].includes(notif.type)
      ) {
        return false;
      }
      if (
        activeTab === "system" &&
        !["security", "system", "billing"].includes(notif.type)
      ) {
        return false;
      }

      // Filtro por término de búsqueda
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const inTitle = notif.title.toLowerCase().includes(query);
        const inMessage = notif.message.toLowerCase().includes(query);
        const inMetadata = JSON.stringify(notif.metadata || {}).toLowerCase().includes(query);
        return inTitle || inMessage || inMetadata;
      }

      return true;
    });
  }, [notifications, activeTab, searchTerm]);

  return (
    <div className="space-y-6">
      {/* 1. Tarjetas de Resumen Rápido */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-500/10 text-[#ED500A]">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              No leídas
            </p>
            <p className="text-lg sm:text-xl font-bold font-title text-slate-900 dark:text-white">
              {counts.unread}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Comprobantes
            </p>
            <p className="text-lg sm:text-xl font-bold font-title text-slate-900 dark:text-white">
              {counts.documents}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Soporte / Ayuda
            </p>
            <p className="text-lg sm:text-xl font-bold font-title text-slate-900 dark:text-white">
              {counts.support}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Total Alertas
            </p>
            <p className="text-lg sm:text-xl font-bold font-title text-slate-900 dark:text-white">
              {counts.all}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Barra de Control: Pestañas de Filtro, Búsqueda y Botones de Acción */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs">
        {/* Pestañas */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 ${
              activeTab === "all"
                ? "bg-[#ED500A] text-white shadow-xs"
                : "bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/[0.08]"
            }`}
          >
            Todas ({counts.all})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("unread")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === "unread"
                ? "bg-[#ED500A] text-white shadow-xs"
                : "bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/[0.08]"
            }`}
          >
            No leídas
            {counts.unread > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === "unread"
                    ? "bg-white text-[#ED500A]"
                    : "bg-[#ED500A] text-white"
                }`}
              >
                {counts.unread}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("documents")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 ${
              activeTab === "documents"
                ? "bg-[#ED500A] text-white shadow-xs"
                : "bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/[0.08]"
            }`}
          >
            Comprobantes ({counts.documents})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("support")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 ${
              activeTab === "support"
                ? "bg-[#ED500A] text-white shadow-xs"
                : "bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/[0.08]"
            }`}
          >
            Soporte ({counts.support})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("system")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 ${
              activeTab === "system"
                ? "bg-[#ED500A] text-white shadow-xs"
                : "bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/[0.08]"
            }`}
          >
            Avisos y Sistema ({counts.system})
          </button>
        </div>

        {/* Búsqueda y Botón Marcar Todas */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar alerta o comprobante..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
            />
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Refrescar notificaciones"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-400 transition-colors shrink-0"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-[#ED500A]" : ""}`}
            />
          </button>

          {counts.unread > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              disabled={isMarkingAll}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <CheckCheck className="w-3.5 h-3.5 text-[#ED500A]" />
              <span className="hidden sm:inline">Marcar todas leídas</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Listado de Notificaciones */}
      <div className="space-y-3">
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((notif) => {
            const isUnread = !notif.isRead && !notif.read;
            const isSupport = [
              "support_interaction",
              "support_ticket",
              "support_chat",
              "ticket_assigned",
              "chat_escalated",
            ].includes(notif.type);
            const isDoc = notif.type === "document_generated";
            const isSecurity = notif.type === "security";
            const isBilling = notif.type === "billing";

            return (
              <div
                key={notif.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 bg-white dark:bg-[#0D0F16] ${
                  isUnread
                    ? "border-orange-500/30 dark:border-[#ED500A]/30 shadow-xs ring-1 ring-[#ED500A]/10"
                    : "border-slate-200/80 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15]"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  {/* Icono + Contenido */}
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {/* Icono distintivo */}
                    <div
                      className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                        isSupport
                          ? "bg-orange-500/10 text-[#ED500A]"
                          : isDoc
                          ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400"
                          : isSecurity
                          ? "bg-rose-500/10 text-rose-500 dark:text-rose-400"
                          : isBilling
                          ? "bg-blue-500/10 text-blue-500 dark:text-blue-400"
                          : "bg-indigo-500/10 text-indigo-500 dark:text-indigo-400"
                      }`}
                    >
                      {isSupport && <Headphones className="w-5 h-5" />}
                      {isDoc && <Receipt className="w-5 h-5" />}
                      {isSecurity && <ShieldAlert className="w-5 h-5" />}
                      {isBilling && <CreditCard className="w-5 h-5" />}
                      {!isSupport && !isDoc && !isSecurity && !isBilling && (
                        <Info className="w-5 h-5" />
                      )}
                    </div>

                    {/* Textos y Detalles */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            isSupport
                              ? "bg-orange-50 dark:bg-orange-500/10 text-[#ED500A]"
                              : isDoc
                              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : isSecurity
                              ? "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              : isBilling
                              ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                              : "bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {isSupport
                            ? "Soporte"
                            : isDoc
                            ? "Comprobante"
                            : isSecurity
                            ? "Seguridad"
                            : isBilling
                            ? "Facturación"
                            : "Sistema"}
                        </span>

                        <h3 className="text-sm font-bold text-slate-900 dark:text-white font-title">
                          {notif.title}
                        </h3>

                        {isUnread && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ED500A] text-white">
                            Nuevo
                          </span>
                        )}
                      </div>

                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-body leading-relaxed">
                        {notif.message}
                      </p>

                      {/* Metadatos y Badges dinámicos */}
                      {notif.metadata && Object.keys(notif.metadata).length > 0 && (
                        <div className="flex items-center gap-2 pt-1 flex-wrap text-xs">
                          {notif.metadata.documentNumber && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 text-[11px] font-mono">
                              <Receipt className="w-3 h-3 text-[#ED500A]" />
                              {notif.metadata.documentNumber}
                            </span>
                          )}

                          {notif.metadata.total && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[11px] font-mono font-semibold">
                              ${Number(notif.metadata.total).toLocaleString("es-CO")}
                            </span>
                          )}

                          {notif.entityNumber && !notif.metadata.documentNumber && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 text-[11px] font-mono">
                              <Tag className="w-3 h-3 text-[#ED500A]" />
                              {notif.entityNumber}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Timestamps */}
                      <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {getRelativeTime(notif.createdAt)}
                        </span>
                        <span>•</span>
                        <span>{formatFullDate(notif.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Botones de Acción */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-end gap-2 shrink-0 pt-2 sm:pt-0">
                    <button
                      type="button"
                      onClick={() => setSelectedNotif(notif)}
                      className="px-3 py-1.5 rounded-xl bg-[#ED500A] hover:bg-[#ED500A]/90 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <span>Ver Detalles</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    {isUnread && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkAsRead(notif.id, e)}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Marcar leída</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : error ? (
          /* Estado de Error Real */
          <div className="p-12 text-center rounded-2xl bg-rose-50/50 dark:bg-rose-500/5 border border-rose-200/80 dark:border-rose-500/20 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-100 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center text-rose-500">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200 font-title">
                Error al consultar notificaciones
              </h4>
              <p className="text-xs text-rose-600 dark:text-rose-400 max-w-sm mx-auto font-body">
                {error}
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                <span>Reintentar conexión</span>
              </button>
            </div>
          </div>
        ) : (
          /* Estado Vacío Auténtico cuando no hay resultados */
          <div className="p-12 text-center rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] flex items-center justify-center text-slate-400">
              <CheckCheck className="w-6 h-6 text-emerald-500" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white font-title">
                No tienes notificaciones
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto font-body">
                {searchTerm
                  ? "No se encontraron eventos que coincidan con los criterios de búsqueda."
                  : "Todas las notificaciones de esta categoría están al día y revisadas."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE DETALLE DE NOTIFICACIÓN */}
      {selectedNotif && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
            <div className="w-full max-w-md bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl p-6 relative animate-in zoom-in-95 duration-150">
              <button
                type="button"
                onClick={() => setSelectedNotif(null)}
                className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-orange-50 dark:bg-[#ED500A]/10 text-[#ED500A]">
                  <Bell className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white font-title">
                    Detalle del Evento
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatFullDate(selectedNotif.createdAt)}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                    {selectedNotif.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {selectedNotif.message}
                  </p>
                </div>

                {selectedNotif.metadata &&
                  Object.keys(selectedNotif.metadata).length > 0 && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.04]">
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">
                        Información Adicional
                      </h4>
                      <div className="space-y-2 text-xs">
                        {Object.entries(selectedNotif.metadata).map(([key, value]) => (
                          <div
                            key={key}
                            className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2"
                          >
                            <span className="text-slate-500 dark:text-slate-400 font-medium sm:w-1/3 truncate">
                              {key}:
                            </span>
                            <span className="font-mono text-slate-700 dark:text-slate-300 bg-white dark:bg-[#1A1D27] px-2 py-0.5 rounded border border-slate-200 dark:border-white/[0.08] flex-1 break-all">
                              {String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setSelectedNotif(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                >
                  Cerrar
                </button>

                {(() => {
                  const sanitizedLink = sanitizeWorkspaceNotificationLink(
                    selectedNotif.href || selectedNotif.link,
                    businessId
                  );
                  if (!sanitizedLink) return null;

                  return (
                    <Link
                      href={sanitizedLink}
                      onClick={() => setSelectedNotif(null)}
                      className="px-4 py-2 rounded-xl bg-[#ED500A] text-white text-xs font-semibold hover:bg-[#ab3500] transition-colors shadow-xs flex items-center gap-1.5"
                    >
                      <span>Ir a la página</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  );
                })()}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
