"use client";

import React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Zap,
  UserPlus,
  CreditCard,
  Building,
  ArrowUpRight,
  Database,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { AuditLogModel } from "@/lib/audit/types";

interface AdminAuditFeedProps {
  initialLogs?: AuditLogModel[];
  totalLogsCount?: number;
}

export function AdminAuditFeed({ initialLogs = [], totalLogsCount = 0 }: AdminAuditFeedProps) {
  const getEventIcon = (variant: AuditLogModel["actionVariant"], entityType: string) => {
    if (entityType === "business" || entityType === "businesses") return Building;
    if (entityType === "subscription" || entityType === "subscriptions") return CreditCard;
    if (entityType === "user" || entityType === "users") return UserPlus;
    if (variant === "security") return ShieldCheck;
    if (variant === "delete") return AlertTriangle;
    return Zap;
  };

  const getSeverityBadge = (variant: AuditLogModel["actionVariant"]) => {
    switch (variant) {
      case "create":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
      case "security":
        return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20";
      case "delete":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20";
      case "status":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
      default:
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20";
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return "Justo ahora";
      if (diffMins < 60) return `Hace ${diffMins} min`;
      if (diffHours < 24) return `Hace ${diffHours} h`;
      return `Hace ${diffDays} d`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] p-5 sm:p-6 shadow-xs space-y-5 flex flex-col justify-between">
      <div className="space-y-4">
        {/* Cabecera */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
              Auditoría en Tiempo Real
            </span>
            <h3 className="text-base sm:text-lg font-bold font-title text-slate-900 dark:text-white">
              Eventos de Plataforma
            </h3>
          </div>

          <Link
            href="/admin/auditoria"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            title="Ver registro completo de auditoría"
          >
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Lista de Eventos Reales */}
        <div className="space-y-3">
          {initialLogs.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              Sin registros de auditoría recientes en la base de datos.
            </div>
          ) : (
            initialLogs.slice(0, 4).map((log) => {
              const Icon = getEventIcon(log.actionVariant, log.entityType);
              const badgeStyle = getSeverityBadge(log.actionVariant);

              return (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.04] space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="w-3.5 h-3.5 text-[#ED500A] shrink-0" />
                      <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                        {log.actionLabel}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      {formatRelativeTime(log.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="truncate">
                      {log.userName || log.userEmail || "Sistema / Servidor"}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 uppercase">
                      {log.entityType}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer link */}
      <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
        <span className="text-[11px] text-slate-400 font-mono">Consola de Seguridad</span>
        <Link
          href="/admin/auditoria"
          className="text-[11px] font-semibold text-[#ED500A] hover:underline"
        >
          Explorar Logs ({totalLogsCount > 0 ? `${totalLogsCount} registros` : "Ver todos"})
        </Link>
      </div>
    </div>
  );
}
