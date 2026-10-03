"use client";

import React, { useState } from "react";
import {
  TrendingUp,
  Building2,
  Users,
  CreditCard,
  Activity,
  Plus,
  Download,
  Calendar,
  Layers,
  ShieldCheck,
  Server,
  DollarSign,
  ArrowUpRight,
  Filter,
  Headphones,
  Receipt,
} from "lucide-react";
import { AdminGrowthChart, MonthlyTrendData } from "./admin-growth-chart";
import { AdminPlanDistribution, PlanDistributionItem } from "./admin-plan-distribution";
import { AdminTenantsTable, TenantRecord } from "./admin-tenants-table";
import { AdminAuditFeed } from "./admin-audit-feed";
import { AdminQuickActions } from "./admin-quick-actions";
import { AdminCreateTenantModal } from "./admin-create-tenant-modal";
import { AuditLogModel } from "@/lib/audit/types";
import { formatCOP } from "@/config/plans";

interface AdminDashboardClientProps {
  initialBusinessesCount: number;
  initialActiveBusinessesCount: number;
  initialUsersCount: number;
  initialSubscriptionsCount: number;
  initialActiveSubscriptionsCount: number;
  initialExpiringSoonCount: number;
  initialMrr: number;
  initialArr: number;
  initialTenants: TenantRecord[];
  initialAuditLogs: AuditLogModel[];
  totalAuditLogsCount: number;
  planDistribution: PlanDistributionItem[];
  monthlyTrend: MonthlyTrendData[];
  formattedDate: string;
}

export function AdminDashboardClient({
  initialBusinessesCount,
  initialActiveBusinessesCount,
  initialUsersCount,
  initialSubscriptionsCount,
  initialActiveSubscriptionsCount,
  initialExpiringSoonCount,
  initialMrr,
  initialArr,
  initialTenants,
  initialAuditLogs,
  totalAuditLogsCount,
  planDistribution,
  monthlyTrend,
  formattedDate,
}: AdminDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "tenants" | "finance" | "infra">("overview");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [tenantsList, setTenantsList] = useState<TenantRecord[]>(initialTenants);

  const handleTenantCreated = (newTenant: TenantRecord) => {
    setTenantsList((prev) => [newTenant, ...prev]);
  };

  const handleExportMetrics = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(
        JSON.stringify(
          {
            plataforma: "NEGOVA Core Admin",
            mrr_cop: initialMrr,
            arr_cop: initialArr,
            negocios_totales: initialBusinessesCount,
            negocios_activos: initialActiveBusinessesCount,
            usuarios_globales: initialUsersCount,
            suscripciones_totales: initialSubscriptionsCount,
            suscripciones_activas: initialActiveSubscriptionsCount,
            suscripciones_por_vencer: initialExpiringSoonCount,
            distribucion_planes: planDistribution,
            fecha_exportacion: new Date().toISOString(),
          },
          null,
          2
        )
      );
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `negova-metricas-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* 0. Barra Contextual Superior con Filtro de Tiempo & Acciones */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs">
        {/* Fecha y Región */}
        <div className="flex items-center gap-3 text-xs">
          <span className="capitalize font-semibold text-slate-800 dark:text-white">
            {formattedDate}
          </span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Datos Reales Supabase
          </span>
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Exportar */}
          <button
            type="button"
            onClick={handleExportMetrics}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/[0.08] transition-colors"
            title="Exportar archivo de métricas consolidadas"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Exportar JSON</span>
          </button>

          {/* Nuevo Negocio Modal Trigger */}
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-[#ED500A] hover:bg-[#d94608] transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Negocio</span>
          </button>
        </div>
      </div>

      {/* 1. Selector de Pestañas Principales (Vistas de Plataforma) */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-white/[0.08] overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold font-title border-b-2 transition-all whitespace-nowrap ${
            activeTab === "overview"
              ? "border-[#ED500A] text-[#ED500A]"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Visión General</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("tenants")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold font-title border-b-2 transition-all whitespace-nowrap ${
            activeTab === "tenants"
              ? "border-[#ED500A] text-[#ED500A]"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Negocios ({initialBusinessesCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("finance")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold font-title border-b-2 transition-all whitespace-nowrap ${
            activeTab === "finance"
              ? "border-[#ED500A] text-[#ED500A]"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Finanzas & MRR</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("infra")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold font-title border-b-2 transition-all whitespace-nowrap ${
            activeTab === "infra"
              ? "border-[#ED500A] text-[#ED500A]"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Infraestructura & Seguridad</span>
        </button>
      </div>

      {/* 2. Contenido según pestaña seleccionada */}
      {activeTab === "overview" && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          {/* Bento Grid de 5 KPIs Reales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* MRR Mensual */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15] transition-all space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 font-medium">
                  MRR Mensual
                </span>
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold font-title text-slate-900 dark:text-white tracking-tight">
                  {formatCOP(initialMrr)}
                </p>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                  <span>ARR: {formatCOP(initialArr)}</span>
                </div>
              </div>
            </div>

            {/* Negocios */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15] transition-all space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 font-medium">
                  Negocios Registrados
                </span>
                <div className="p-2 rounded-xl bg-orange-50 text-[#ED500A] dark:bg-[#ED500A]/10 dark:text-[#ED500A]">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold font-title text-slate-900 dark:text-white tracking-tight">
                  {initialBusinessesCount}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-1">
                  {initialActiveBusinessesCount} activos con RLS
                </p>
              </div>
            </div>

            {/* Usuarios Totales */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15] transition-all space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 font-medium">
                  Usuarios Globales
                </span>
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold font-title text-slate-900 dark:text-white tracking-tight">
                  {initialUsersCount}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-1">
                  Cuentas de plataforma y negocio
                </p>
              </div>
            </div>

            {/* Suscripciones */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15] transition-all space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 font-medium">
                  Suscripciones
                </span>
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold font-title text-slate-900 dark:text-white tracking-tight">
                  {initialActiveSubscriptionsCount}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-1">
                  {initialExpiringSoonCount > 0
                    ? `${initialExpiringSoonCount} próximas a vencer`
                    : `${initialSubscriptionsCount} contratos totales`}
                </p>
              </div>
            </div>

            {/* Auditoría / Seguridad */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15] transition-all space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 font-medium">
                  Eventos Auditados
                </span>
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold font-title text-slate-900 dark:text-white tracking-tight">
                  {totalAuditLogsCount}
                </p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                  Logs inmutables audit_logs
                </p>
              </div>
            </div>
          </div>

          {/* Acciones Rápidas */}
          <AdminQuickActions />

          {/* Gráficos Recharts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <AdminGrowthChart monthlyData={monthlyTrend} currentMrr={initialMrr} />
            </div>
            <div>
              <AdminPlanDistribution distribution={planDistribution} />
            </div>
          </div>

          {/* Tabla de Negocios Reales */}
          <AdminTenantsTable initialTenants={tenantsList} />

          {/* Feed de Auditoría */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <AdminAuditFeed
                initialLogs={initialAuditLogs}
                totalLogsCount={totalAuditLogsCount}
              />
            </div>
            {/* Resumen de Plataforma */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] space-y-4 shadow-xs">
              <h3 className="text-sm font-bold font-title text-slate-900 dark:text-white">
                Especificaciones de Plataforma
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/[0.04]">
                  <span className="text-slate-500">Versión Core</span>
                  <span className="font-mono font-semibold">NEGOVA Core v1.0.0</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/[0.04]">
                  <span className="text-slate-500">Mecanismo Aislamiento</span>
                  <span className="font-mono font-semibold text-[#ED500A]">Postgres RLS Policies</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/[0.04]">
                  <span className="text-slate-500">Moneda Base</span>
                  <span className="font-mono font-semibold">COP (Pesos Colombianos)</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Modelo Facturación</span>
                  <span className="font-mono font-semibold text-emerald-600">Cobro Manual / Transferencia</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pestaña: Directorio de Negocios */}
      {activeTab === "tenants" && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold font-title text-slate-900 dark:text-white">
                Gestión Central de Negocios
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Supervisa y administra el ciclo de vida de cada negocio registrado en NEGOVA.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-[#ED500A] hover:bg-[#d94608] transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar Negocio</span>
            </button>
          </div>

          <AdminTenantsTable initialTenants={tenantsList} />
        </div>
      )}

      {/* Pestaña: Finanzas & MRR */}
      {activeTab === "finance" && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-2">
              <span className="text-xs font-mono text-slate-400">MRR Mensual</span>
              <p className="text-2xl font-bold font-title text-slate-900 dark:text-white">
                {formatCOP(initialMrr)}
              </p>
              <span className="text-[11px] font-mono text-emerald-600">Basado en suscripciones activas</span>
            </div>
            <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-2">
              <span className="text-xs font-mono text-slate-400">ARR Proyectado Anual</span>
              <p className="text-2xl font-bold font-title text-slate-900 dark:text-white">
                {formatCOP(initialArr)}
              </p>
              <span className="text-[11px] font-mono text-blue-600">MRR × 12 meses</span>
            </div>
            <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-2">
              <span className="text-xs font-mono text-slate-400">Suscripciones Activas</span>
              <p className="text-2xl font-bold font-title text-slate-900 dark:text-white">
                {initialActiveSubscriptionsCount}
              </p>
              <span className="text-[11px] font-mono text-slate-400">
                de {initialSubscriptionsCount} registradas
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AdminPlanDistribution distribution={planDistribution} />
            <AdminGrowthChart monthlyData={monthlyTrend} currentMrr={initialMrr} />
          </div>
        </div>
      )}

      {/* Pestaña: Infraestructura & Seguridad */}
      {activeTab === "infra" && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-1">
              <span className="text-[11px] text-slate-500">Aislamiento RLS</span>
              <p className="text-xl font-bold font-title text-slate-900 dark:text-white">Activo</p>
              <span className="text-[10px] text-emerald-600 font-mono">100% de tablas protegidas</span>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-1">
              <span className="text-[11px] text-slate-500">Base de Datos</span>
              <p className="text-xl font-bold font-title text-slate-900 dark:text-white">PostgreSQL</p>
              <span className="text-[10px] text-emerald-600 font-mono">Supabase Auth & Storage</span>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-1">
              <span className="text-[11px] text-slate-500">Registro Forense</span>
              <p className="text-xl font-bold font-title text-slate-900 dark:text-white">
                {totalAuditLogsCount} logs
              </p>
              <span className="text-[10px] text-blue-600 font-mono">Tabla audit_logs</span>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-1">
              <span className="text-[11px] text-slate-500">Entorno</span>
              <p className="text-xl font-bold font-title text-slate-900 dark:text-white">Next.js 16</p>
              <span className="text-[10px] text-emerald-600 font-mono">App Router & Server Actions</span>
            </div>
          </div>

          <AdminAuditFeed
            initialLogs={initialAuditLogs}
            totalLogsCount={totalAuditLogsCount}
          />
        </div>
      )}

      {/* Modal de Creación de Negocio */}
      <AdminCreateTenantModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onTenantCreated={handleTenantCreated}
      />
    </div>
  );
}
