"use client";

import React, { useState, useTransition, useEffect } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Building2,
  Users,
  CreditCard,
  Eye,
  Calendar,
  X,
  Filter,
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
  AdminInput,
} from "@/components/admin/ui";
import { ModalPortal } from "@/components/ui/modal-portal";
import { fetchAuditLogsAction, fetchAuditFilterUsersAction } from "./actions";
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
  const [selectedUserId, setSelectedUserId] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLogModel | null>(null);

  // Cargar lista de usuarios para filtro
  useEffect(() => {
    fetchAuditFilterUsersAction().then((res) => {
      if (res.success && res.data) {
        setAvailableUsers(res.data);
      }
    });
  }, []);

  const fetchLogs = (
    page: number = data.page,
    action = selectedAction,
    entity = selectedEntity,
    userId = selectedUserId,
    sDate = startDate,
    eDate = endDate,
    q = searchQuery
  ) => {
    startTransition(async () => {
      const res = await fetchAuditLogsAction({
        page,
        pageSize: data.pageSize,
        action,
        entityType: entity,
        userId: userId !== "all" ? userId : undefined,
        startDate: sDate ? `${sDate}T00:00:00.000Z` : undefined,
        endDate: eDate ? `${eDate}T23:59:59.999Z` : undefined,
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
    fetchLogs(1, selectedAction, selectedEntity, selectedUserId, startDate, endDate, searchQuery);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedAction("all");
    setSelectedEntity("all");
    setSelectedUserId("all");
    setStartDate("");
    setEndDate("");
    fetchLogs(1, "all", "all", "all", "", "", "");
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

  const hasActiveFilters =
    searchQuery ||
    selectedAction !== "all" ||
    selectedEntity !== "all" ||
    selectedUserId !== "all" ||
    startDate ||
    endDate;

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
        searchPlaceholder="Buscar por entidad o acción..."
        onRefresh={() => fetchLogs()}
        isPending={isPending}
        filters={
          <>
            <AdminSelect
              value={selectedAction}
              onChange={(val) => {
                setSelectedAction(val);
                fetchLogs(1, val, selectedEntity, selectedUserId, startDate, endDate, searchQuery);
              }}
              options={[
                { value: "all", label: "Todas las acciones" },
                { value: "create", label: "Creación (create)" },
                { value: "update", label: "Actualización (update)" },
                { value: "delete", label: "Eliminación (delete)" },
                { value: "login", label: "Inicio de Sesión (login)" },
                { value: "logout", label: "Cierre de Sesión (logout)" },
                { value: "status_change", label: "Cambio de Estado (status_change)" },
                { value: "permission_change", label: "Permisos y Roles (permission_change)" },
                { value: "subscription_change", label: "Suscripción (subscription_change)" },
                { value: "other", label: "Otros Eventos (other)" },
              ]}
            />
            <AdminSelect
              value={selectedEntity}
              onChange={(val) => {
                setSelectedEntity(val);
                fetchLogs(1, selectedAction, val, selectedUserId, startDate, endDate, searchQuery);
              }}
              options={[
                { value: "all", label: "Todas las entidades" },
                { value: "business", label: "Negocios" },
                { value: "user", label: "Usuarios" },
                { value: "subscription", label: "Suscripciones" },
                { value: "account_security", label: "Seguridad de Cuenta" },
                { value: "membership", label: "Membresías" },
                { value: "platform_settings", label: "Configuración" },
                { value: "billing_receipt", label: "Comprobantes / Facturas" },
                { value: "platform_expense", label: "Egresos Plataforma" },
                { value: "support_ticket", label: "Tickets de Soporte" },
                { value: "support_interaction", label: "Interacciones Soporte" },
              ]}
            />
            <AdminSelect
              value={selectedUserId}
              onChange={(val) => {
                setSelectedUserId(val);
                fetchLogs(1, selectedAction, selectedEntity, val, startDate, endDate, searchQuery);
              }}
              options={[
                { value: "all", label: "Todos los usuarios" },
                ...availableUsers.map((u) => ({ value: u.id, label: u.label })),
              ]}
            />
          </>
        }
      />

      {/* Rango de fechas y Reset */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] text-xs">
        <div className="flex items-center gap-2 text-slate-500 font-semibold">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Rango de Fecha:</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              fetchLogs(1, selectedAction, selectedEntity, selectedUserId, e.target.value, endDate, searchQuery);
            }}
            className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-xs text-slate-700 dark:text-slate-300"
            title="Fecha inicial"
          />
          <span className="text-slate-400">a</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              fetchLogs(1, selectedAction, selectedEntity, selectedUserId, startDate, e.target.value, searchQuery);
            }}
            className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-xs text-slate-700 dark:text-slate-300"
            title="Fecha final"
          />
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 transition-colors"
          >
            <X className="w-3 h-3 text-slate-400" />
            Limpiar Filtros
          </button>
        )}
      </div>

      {/* 3. TABLA DE REGISTROS DE AUDITORÍA */}
      {data.logs.length === 0 ? (
        <AdminEmptyState
          icon={ShieldCheck}
          title="No hay registros de auditoría"
          description="No se encontraron eventos que coincidan con los filtros seleccionados."
          onReset={handleResetFilters}
          resetLabel="Limpiar Filtros"
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                    <th className="py-3.5 px-4">Fecha y Hora</th>
                    <th className="py-3.5 px-4">Acción / Evento</th>
                    <th className="py-3.5 px-4">Entidad Afectada</th>
                    <th className="py-3.5 px-4">Negocio</th>
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

                      {/* Negocio */}
                      <td className="py-3.5 px-4">
                        {log.businessName ? (
                          <span className="inline-flex items-center gap-1 font-medium text-slate-800 dark:text-slate-200">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            {log.businessName}
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono text-slate-400 italic">
                            Plataforma Global
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
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition-colors"
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
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
            <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
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
                  <span className="text-[10px] text-slate-400 font-mono block">Negocio Asociado</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedLog.businessName || "Plataforma Global (NULL)"}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04]">
                  <span className="text-[10px] text-slate-400 font-mono block">Autor</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedLog.userName}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04]">
                  <span className="text-[10px] text-slate-400 font-mono block">Dirección IP</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{selectedLog.ipAddress || "No registrada"}</span>
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
        </ModalPortal>
      )}
    </div>
  );
}
