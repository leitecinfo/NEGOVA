"use client";

import React, { useState, useTransition } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Building2,
  Users,
  CreditCard,
  KeyRound,
  Eye,
  Calendar,
  X,
  RefreshCw,
  Clock,
} from "lucide-react";
import { AuditLogsResult, AuditLogModel } from "@/lib/audit/types";
import {
  AdminKpiGrid,
  AdminKpiCard,
  AdminTableToolbar,
  AdminSelect,
  AdminBadge,
  AdminPagination,
  AdminEmptyState,
  AdminButton,
} from "@/components/admin/ui";
import { fetchAuditLogsAction } from "./actions";
import { toast } from "sonner";

interface AuditoriaClientProps {
  initialData: AuditLogsResult;
}

export function AuditoriaClient({ initialData }: AuditoriaClientProps) {
  const [data, setData] = useState<AuditLogsResult>(initialData);
  const [isPending, startTransition] = useTransition();

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAction, setSelectedAction] = useState("all");
  const [selectedEntity, setSelectedEntity] = useState("all");
  const [selectedLog, setSelectedLog] = useState<AuditLogModel | null>(null);

  const fetchLogs = (page: number = data.page, action = selectedAction, entity = selectedEntity, q = searchQuery) => {
    startTransition(async () => {
      const res = await fetchAuditLogsAction({
        page,
        pageSize: data.pageSize,
        action,
        entityType: entity,
        search: q,
      });

      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast.error("No fue posible cargar los registros de auditoría.");
      }
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(1, selectedAction, selectedEntity, searchQuery);
  };

  const formatDate = (isoStr: string) => {
    if (!isoStr) return "—";
    const d = new Date(isoStr);
    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  };

  const getVariantBadge = (variant: AuditLogModel["actionVariant"]) => {
    switch (variant) {
      case "create":
        return "emerald";
      case "security":
        return "red";
      case "status":
        return "amber";
      case "update":
        return "orange";
      case "delete":
        return "red";
      default:
        return "default";
    }
  };

  return (
    <div className="space-y-6 font-body">
      {/* 1. KPIS DE EVENTOS */}
      <AdminKpiGrid cols={4}>
        <AdminKpiCard
          title="Total Registros"
          value={data.stats.totalEvents}
          subtext="Historial inmutable"
          icon={<ShieldCheck className="w-4 h-4 text-slate-700 dark:text-slate-300" />}
          variant="default"
        />
        <AdminKpiCard
          title="Eventos de Seguridad"
          value={data.stats.securityEvents}
          subtext="Bloqueos y autenticación"
          icon={<ShieldAlert className="w-4 h-4 text-red-500" />}
          variant="red"
        />
        <AdminKpiCard
          title="Eventos de Negocios"
          value={data.stats.businessEvents}
          subtext="Altas, bajas y cambios"
          icon={<Building2 className="w-4 h-4 text-blue-500" />}
          variant="blue"
        />
        <AdminKpiCard
          title="Suscripciones"
          value={data.stats.subscriptionEvents}
          subtext="Renovaciones y planes"
          icon={<CreditCard className="w-4 h-4 text-emerald-500" />}
          variant="emerald"
        />
      </AdminKpiGrid>

      {/* 2. BARRA DE HERRAMIENTAS Y FILTROS */}
      <AdminTableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        searchPlaceholder="Buscar por acción, entidad o ID..."
        onRefresh={() => fetchLogs()}
        isPending={isPending}
        filters={
          <>
            <AdminSelect
              value={selectedEntity}
              onChange={(val) => {
                setSelectedEntity(val);
                fetchLogs(1, selectedAction, val, searchQuery);
              }}
              options={[
                { value: "all", label: "Todas las entidades" },
                { value: "business", label: "Negocios" },
                { value: "user", label: "Usuarios" },
                { value: "subscription", label: "Suscripciones" },
                { value: "platform_settings", label: "Configuración" },
              ]}
            />
            <AdminSelect
              value={selectedAction}
              onChange={(val) => {
                setSelectedAction(val);
                fetchLogs(1, val, selectedEntity, searchQuery);
              }}
              options={[
                { value: "all", label: "Todas las acciones" },
                { value: "create_business", label: "Crear Negocio" },
                { value: "update_business", label: "Actualizar Negocio" },
                { value: "suspend_business", label: "Suspender Negocio" },
                { value: "renew_subscription", label: "Renovar Suscripción" },
                { value: "create_user", label: "Crear Usuario" },
                { value: "security_lockout", label: "Bloqueo de Seguridad" },
              ]}
            />
          </>
        }
      />

      {/* 3. TABLA DE REGISTROS DE AUDITORÍA */}
      {data.logs.length === 0 ? (
        <AdminEmptyState
          icon={ShieldCheck}
          title="No hay registros de auditoría"
          description="No se encontraron eventos que coincidan con los filtros seleccionados."
          onReset={() => {
            setSearchQuery("");
            setSelectedAction("all");
            setSelectedEntity("all");
            fetchLogs(1, "all", "all", "");
          }}
          resetLabel="Limpiar Filtros"
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0E12] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                    <th className="py-3.5 px-4">Fecha y Hora</th>
                    <th className="py-3.5 px-4">Acción / Evento</th>
                    <th className="py-3.5 px-4">Entidad Afectada</th>
                    <th className="py-3.5 px-4">Autor del Evento</th>
                    <th className="py-3.5 px-4 text-right">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                  {data.logs.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer"
                    >
                      {/* Fecha */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </td>

                      {/* Acción */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <AdminBadge variant={getVariantBadge(log.actionVariant)} size="sm">
                            {log.actionLabel}
                          </AdminBadge>
                          <p className="text-[10px] text-slate-400 font-mono">{log.action}</p>
                        </div>
                      </td>

                      {/* Entidad */}
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                          {log.entityType}
                        </span>
                        {log.entityId && (
                          <span className="block text-[10px] font-mono text-slate-400 truncate max-w-[140px]">
                            ID: {log.entityId.slice(0, 12)}...
                          </span>
                        )}
                      </td>

                      {/* Autor */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {log.userName}
                          </p>
                          {log.userEmail && (
                            <p className="text-[10px] text-slate-400 font-mono">{log.userEmail}</p>
                          )}
                        </div>
                      </td>

                      {/* Botón Ver Detalle */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition-colors"
                          title="Ver Detalle Técnico"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <AdminPagination
            currentPage={data.page}
            totalPages={data.totalPages}
            pageSize={data.pageSize}
            totalItems={data.totalCount}
            currentCount={data.logs.length}
            onPageChange={(p) => fetchLogs(p)}
          />
        </div>
      )}

      {/* 4. MODAL: DETALLE TÉCNICO DEL LOG */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0F16] p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-[#ED500A] flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Detalle de Evento de Auditoría
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    ID: {selectedLog.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04]">
                <span className="text-[10px] text-slate-400 font-mono block">Acción</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedLog.actionLabel}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04]">
                <span className="text-[10px] text-slate-400 font-mono block">Fecha y Hora</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">{formatDate(selectedLog.createdAt)}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04]">
                <span className="text-[10px] text-slate-400 font-mono block">Entidad</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedLog.entityType} ({selectedLog.entityId || "N/A"})</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04]">
                <span className="text-[10px] text-slate-400 font-mono block">Autor</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedLog.userName}</span>
              </div>
            </div>

            {/* Metadata JSON */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">
                Carga de Metadatos (Metadata Payload)
              </span>
              <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto max-h-56 border border-slate-800">
                {JSON.stringify(selectedLog.metadata, null, 2) || "Sin metadatos adicionales."}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <AdminButton variant="secondary" size="sm" onClick={() => setSelectedLog(null)}>
                Cerrar
              </AdminButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
