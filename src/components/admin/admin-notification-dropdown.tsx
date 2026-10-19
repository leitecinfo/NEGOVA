"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Headphones,
  CheckCheck,
  Clock,
  UserPlus,
  Building2,
  ShieldAlert,
  CreditCard,
  Info,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import {
  getNotificationsAction,
  markNotificationAsReadAction,
} from "@/app/admin/notificaciones/actions";
import { PlatformNotification } from "@/lib/notifications/notifications-service";

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

function getNotificationIcon(type: string) {
  switch (type) {
    case "support_interaction":
    case "support_ticket":
      return <Headphones className="w-4 h-4 text-[#ED500A]" />;
    case "ticket_assigned":
      return <ShieldAlert className="w-4 h-4 text-amber-500" />;
    case "user_created":
      return <UserPlus className="w-4 h-4 text-blue-500 dark:text-blue-400" />;
    case "business_created":
      return <Building2 className="w-4 h-4 text-[#ED500A]" />;
    case "security":
      return <ShieldAlert className="w-4 h-4 text-rose-500 dark:text-rose-400" />;
    case "billing":
      return <CreditCard className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />;
    default:
      return <Info className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />;
  }
}

export function AdminNotificationDropdown() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cargar notificaciones recientes
  const fetchRecent = useCallback(async () => {
    try {
      const res = await getNotificationsAction({ limit: 10 });
      if (res.success && res.data) {
        setNotifications(res.data.slice(0, 3));
        const unread = res.data.filter((n) => !n.isRead).length;
        setUnreadCount(unread);
      }
    } catch {
      // Silenciar error en background
    }
  }, []);

  useEffect(() => {
    fetchRecent();
    // Sondeo ligero cada 30 segundos
    const interval = setInterval(fetchRecent, 30000);
    return () => clearInterval(interval);
  }, [fetchRecent]);

  // Manejador de hover con debounce suave para evitar parpadeos
  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOpen(true);
      fetchRecent();
    }, 120);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  // Clic en la campana: Abre directamente el módulo de notificaciones
  const handleBellClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsOpen(false);
    router.push("/admin/notificaciones");
  };

  // Clic en un item de la vista previa
  const handleItemClick = async (notif: PlatformNotification) => {
    setIsOpen(false);
    if (!notif.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      await markNotificationAsReadAction(notif.id);
    }

    if (notif.link) {
      router.push(notif.link);
    } else {
      router.push("/admin/notificaciones");
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative inline-block text-left"
    >
      {/* Botón de Campana: al hacer clic abre /admin/notificaciones */}
      <button
        type="button"
        onClick={handleBellClick}
        aria-label="Abrir módulo de notificaciones de plataforma"
        title="Abrir módulo de Notificaciones"
        className="relative p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06] border border-transparent hover:border-slate-200 dark:hover:border-white/[0.08] transition-colors focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
      >
        <Bell className="w-4 h-4" />

        {/* Indicador de no leídas */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-[#ED500A] text-[10px] font-bold text-white shadow-xs animate-in zoom-in-50">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Menú Desplegable al hacer Hover con los 3 más recientes */}
      {isOpen && (
        <div
          role="region"
          aria-label="Vista previa de notificaciones"
          className="absolute right-0 mt-1.5 w-80 sm:w-96 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="p-3.5 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between bg-slate-50/80 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white font-title">
                Notificaciones Recientes
              </span>
              {unreadCount > 0 ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#ED500A]/10 text-[#ED500A]">
                  {unreadCount} nueva{unreadCount > 1 ? "s" : ""}
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400">
                  Al día
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleBellClick}
              className="text-[11px] font-semibold text-[#ED500A] hover:underline flex items-center gap-1"
            >
              Ver todas
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Listado de 3 más recientes */}
          {notifications.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-white/[0.06] max-h-[320px] overflow-y-auto">
              {notifications.map((notif) => (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => handleItemClick(notif)}
                  className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.04] ${
                    !notif.isRead
                      ? "bg-orange-500/5 dark:bg-[#ED500A]/5"
                      : ""
                  }`}
                >
                  <div className="mt-0.5 p-2 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200/60 dark:border-white/[0.08] shrink-0">
                    {getNotificationIcon(notif.type)}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <p
                        className={`text-xs truncate font-medium ${
                          !notif.isRead
                            ? "text-slate-900 dark:text-white font-semibold"
                            : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {notif.title}
                      </p>
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-[#ED500A] shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed font-body">
                      {notif.message}
                    </p>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{getRelativeTime(notif.createdAt)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            /* Estado Vacío */
            <div className="p-6 text-center space-y-2.5">
              <div className="w-9 h-9 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCheck className="w-4 h-4" />
              </div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Bandeja al día
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                No hay notificaciones recientes pendientes.
              </p>
            </div>
          )}

          {/* Footer botón que abre módulo */}
          <div className="p-2.5 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50/80 dark:bg-white/[0.02]">
            <button
              type="button"
              onClick={handleBellClick}
              className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-xs font-semibold text-slate-800 dark:text-white flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Abrir Módulo de Notificaciones</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#ED500A]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
