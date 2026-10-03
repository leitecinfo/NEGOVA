"use client";

import React, { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  Building2,
  Users,
  CheckCircle2,
  Clock,
  Ban,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  MoreVertical,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Calendar,
  Sparkles,
  Layers,
  ArrowRight,
  Wallet,
  ShieldAlert,
  Edit,
  X,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import {
  SubscriptionModel,
  SubscriptionsListResult,
  SubscriptionStatus,
} from "@/lib/subscriptions/types";
import {
  NEGOVA_PLANS,
  COMMERCIAL_PLANS_LIST,
  PlanId,
  BillingInterval,
  formatVigenciaDate,
  formatVigenciaDuration,
  calculatePeriodDates,
} from "@/config/plans";
import {
  getSubscriptionsListAction,
  renewSubscriptionAction,
  changeSubscriptionStatusAction,
  changeSubscriptionPlanAction,
} from "./actions";
import {
  AdminPagination,
  AdminEmptyState,
  AdminTableToolbar,
  AdminKpiCard,
  AdminKpiGrid,
  AdminInput,
  AdminSelect,
  AdminConfirmDialog,
  AdminBadge,
  AdminStatusBadge,
  AdminButton,
} from "@/components/admin/ui";

interface SuscripcionesClientProps {
  initialData: SubscriptionsListResult | null;
  currentUserId: string;
  isSuperAdmin: boolean;
}

export function SuscripcionesClient({
  initialData,
  currentUserId,
  isSuperAdmin,
}: SuscripcionesClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [data, setData] = useState<SubscriptionsListResult>(
    initialData || {
      subscriptions: [],
      totalCount: 0,
      page: 1,
      pageSize: 15,
      totalPages: 1,
      kpis: {
        total: 0,
        active: 0,
        trial: 0,
        expiringSoon: 0,
        suspendedOrPastDue: 0,
        monthlyEstimatedRevenue: 0,
      },
    }
  );

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPlan, setSelectedPlan] = useState<string>("all");
  const [selectedInterval, setSelectedInterval] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Menú Flotante de Acciones en Portal (evita problemas de z-index en tablas)
  const [menuAnchor, setMenuAnchor] = useState<{
    id: string;
    top: number;
    left: number;
    subscription: SubscriptionModel;
  } | null>(null);

  // Modal para Renovar / Extender Vigencia
  const [renewModal, setRenewModal] = useState<{
    isOpen: boolean;
    subscription: SubscriptionModel | null;
    months: number;
    planId: PlanId;
  }>({
    isOpen: false,
    subscription: null,
    months: 1,
    planId: "inicio",
  });

  // Modal para Cambiar Plan
  const [planModal, setPlanModal] = useState<{
    isOpen: boolean;
    subscription: SubscriptionModel | null;
    newPlanId: PlanId;
  }>({
    isOpen: false,
    subscription: null,
    newPlanId: "inicio",
  });

  // Modal para Cambiar Estado
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    subscription: SubscriptionModel | null;
    targetStatus: SubscriptionStatus | null;
    reason: string;
  }>({
    isOpen: false,
    subscription: null,
    targetStatus: null,
    reason: "",
  });

  // Cerrar menú contextual al hacer scroll o click afuera
  useEffect(() => {
    const handleScrollOrClick = (e: MouseEvent | Event) => {
      if (menuAnchor) {
        const target = e.target as HTMLElement;
        if (!target.closest("#subscription-actions-portal-menu")) {
          setMenuAnchor(null);
        }
      }
    };
    window.addEventListener("scroll", handleScrollOrClick, true);
    window.addEventListener("click", handleScrollOrClick, true);
    return () => {
      window.removeEventListener("scroll", handleScrollOrClick, true);
      window.removeEventListener("click", handleScrollOrClick, true);
    };
  }, [menuAnchor]);

  // Cargar lista filtrada
  const fetchSubscriptions = (page: number = 1) => {
    startTransition(async () => {
      const res = await getSubscriptionsListAction({
        page,
        pageSize: 15,
        search: searchQuery,
        status: selectedStatus,
        planId: selectedPlan,
        billingInterval: selectedInterval,
      });
      setData(res);
      setCurrentPage(page);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSubscriptions(1);
  };

  const handleFilterChange = (type: "status" | "plan" | "interval", val: string) => {
    if (type === "status") setSelectedStatus(val);
    if (type === "plan") setSelectedPlan(val);
    if (type === "interval") setSelectedInterval(val);
  };

  useEffect(() => {
    fetchSubscriptions(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatus, selectedPlan, selectedInterval]);

  // Manejadores de acciones
  const handleRenewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewModal.subscription) return;

    startTransition(async () => {
      const res = await renewSubscriptionAction(
        renewModal.subscription!.businessId,
        renewModal.months,
        renewModal.planId
      );

      if (res.success) {
        toast.success(
          `Suscripción de "${renewModal.subscription!.businessName}" extendida por ${renewModal.months} mes(es) exitosamente.`
        );
        setRenewModal({ isOpen: false, subscription: null, months: 1, planId: "inicio" });
        fetchSubscriptions(currentPage);
        router.refresh();
      } else {
        toast.error(res.error || "No fue posible renovar la suscripción.");
      }
    });
  };

  const handlePlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!planModal.subscription) return;

    startTransition(async () => {
      const res = await changeSubscriptionPlanAction(
        planModal.subscription!.id,
        planModal.newPlanId
      );

      if (res.success) {
        toast.success(
          `Plan de "${planModal.subscription!.businessName}" actualizado a ${
            NEGOVA_PLANS[planModal.newPlanId]?.name || planModal.newPlanId
          } exitosamente.`
        );
        setPlanModal({ isOpen: false, subscription: null, newPlanId: "inicio" });
        fetchSubscriptions(currentPage);
        router.refresh();
      } else {
        toast.error(res.error || "No fue posible modificar el plan.");
      }
    });
  };

  const handleStatusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModal.subscription || !statusModal.targetStatus) return;

    startTransition(async () => {
      const res = await changeSubscriptionStatusAction(
        statusModal.subscription!.id,
        statusModal.targetStatus!,
        statusModal.reason
      );

      if (res.success) {
        toast.success(
          `Estado de suscripción de "${statusModal.subscription!.businessName}" actualizado a "${statusModal.targetStatus}" exitosamente.`
        );
        setStatusModal({ isOpen: false, subscription: null, targetStatus: null, reason: "" });
        fetchSubscriptions(currentPage);
        router.refresh();
      } else {
        toast.error(res.error || "No fue posible modificar el estado.");
      }
    });
  };

  const formatCOP = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* 1. KPIS GLOBALES DE SUSCRIPCIONES */}
      <AdminKpiGrid cols={5}>
        <AdminKpiCard
          title="Total Suscripciones"
          value={data.kpis.total}
          subtext="Comercios registrados"
          icon={<CreditCard className="w-5 h-5 text-orange-600 dark:text-orange-400" />}
          variant="orange"
        />
        <AdminKpiCard
          title="Suscripciones Activas"
          value={data.kpis.active}
          subtext="Con vigencia regular"
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
          variant="emerald"
        />
        <AdminKpiCard
          title="Periodo de Prueba"
          value={data.kpis.trial}
          subtext="Trial 30 días"
          icon={<Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
          variant="amber"
        />
        <AdminKpiCard
          title="Próximas a Vencer"
          value={data.kpis.expiringSoon}
          subtext="1 a 15 días restantes"
          icon={<AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />}
          variant="red"
        />
        <AdminKpiCard
          title="MRR Estimado"
          value={formatCOP(data.kpis.monthlyEstimatedRevenue)}
          subtext="Ingreso mensual base"
          icon={<Wallet className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
          variant="blue"
        />
      </AdminKpiGrid>

      {/* 2. BARRA DE HERRAMIENTAS Y FILTROS */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0E12] p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por negocio, slug, propietario, email o plan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
              />
            </div>
            <AdminButton
              type="submit"
              variant="secondary"
              size="sm"
              isLoading={isPending}
            >
              Buscar
            </AdminButton>
          </form>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filtro Plan */}
            <select
              value={selectedPlan}
              onChange={(e) => handleFilterChange("plan", e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0E12] text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30"
            >
              <option value="all">Todos los Planes</option>
              <option value="inicio">Plan Inicio ($29.900)</option>
              <option value="crece">Plan Crece ($59.900)</option>
              <option value="negocio">Plan Negocio ($99.900)</option>
            </select>

            {/* Filtro Estado */}
            <select
              value={selectedStatus}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0E12] text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30"
            >
              <option value="all">Todos los Estados</option>
              <option value="active">Activas</option>
              <option value="trial">Periodo de Prueba (Trial)</option>
              <option value="expiring_soon">Próximas a Vencer (1-15d)</option>
              <option value="suspended">Suspendidas</option>
              <option value="past_due">En Mora / Vencidas</option>
            </select>

            {/* Filtro Modalidad */}
            <select
              value={selectedInterval}
              onChange={(e) => handleFilterChange("interval", e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0E12] text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30"
            >
              <option value="all">Todas las Modalidades</option>
              <option value="monthly">Mensual</option>
              <option value="annual">Anual</option>
            </select>

            <AdminButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedStatus("all");
                setSelectedPlan("all");
                setSelectedInterval("all");
              }}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Restablecer
            </AdminButton>
          </div>
        </div>
      </div>

      {/* 3. TABLA DE SUSCRIPCIONES */}
      {data.subscriptions.length === 0 ? (
        <AdminEmptyState
          icon={CreditCard}
          title="No se encontraron suscripciones"
          description={
            searchQuery || selectedStatus !== "all" || selectedPlan !== "all" || selectedInterval !== "all"
              ? "No hay suscripciones que coincidan con los filtros aplicados."
              : "Aún no existen registros de suscripciones en la plataforma."
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Vista Desktop */}
          <div className="hidden lg:block rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0E12] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                    <th className="py-3.5 px-4">Negocio</th>
                    <th className="py-3.5 px-4">Propietario</th>
                    <th className="py-3.5 px-4">Plan</th>
                    <th className="py-3.5 px-4">Modalidad</th>
                    <th className="py-3.5 px-4">Vigencia</th>
                    <th className="py-3.5 px-4">Días Restantes</th>
                    <th className="py-3.5 px-4">Estado</th>
                    <th className="py-3.5 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] text-xs">
                  {data.subscriptions.map((sub) => {
                    const planConfig = NEGOVA_PLANS[sub.planId] || NEGOVA_PLANS.inicio;

                    return (
                      <tr
                        key={sub.id}
                        onClick={() => router.push(`/admin/negocios/${sub.businessId}?tab=suscripcion`)}
                        className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer"
                      >
                        {/* Negocio */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-[#ED500A] font-bold text-xs flex items-center justify-center shrink-0 border border-orange-200/50 dark:border-orange-500/20">
                              {sub.businessName.charAt(0).toUpperCase()}
                            </div>
                            <div className="space-y-0.5 min-w-0">
                              <Link
                                href={`/admin/negocios/${sub.businessId}?tab=suscripcion`}
                                onClick={(e) => e.stopPropagation()}
                                className="font-semibold text-slate-900 dark:text-white hover:text-[#ED500A] dark:hover:text-[#ED500A] transition-colors truncate block"
                              >
                                {sub.businessName}
                              </Link>
                              <p className="text-[11px] text-slate-400 font-mono truncate">/{sub.businessSlug}</p>
                            </div>
                          </div>
                        </td>

                        {/* Propietario */}
                        <td className="py-3.5 px-4">
                          {sub.owner ? (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-xs font-semibold text-slate-700 dark:text-slate-200 shrink-0">
                                {sub.owner.fullName.charAt(0).toUpperCase()}
                              </div>
                              <div className="truncate max-w-[140px]">
                                <p className="font-semibold text-slate-900 dark:text-white truncate">{sub.owner.fullName}</p>
                                <p className="text-[11px] text-slate-400 font-mono truncate">{sub.owner.email}</p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono text-xs">Sin asignar</span>
                          )}
                        </td>

                        {/* Plan */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                sub.planId === "negocio"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                  : sub.planId === "crece"
                                  ? "bg-orange-500/10 text-[#ED500A] border-orange-500/20"
                                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                              }`}
                            >
                              <Layers className="w-3.5 h-3.5" />
                              <span>Plan {sub.planName}</span>
                            </span>
                            {sub.isTrial ? (
                              <div>
                                <span className="text-xs font-bold font-mono text-amber-600 dark:text-amber-400 block">
                                  $0 COP <span className="text-[10px] font-normal text-slate-400 font-sans">(Prueba)</span>
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono block">
                                  Plan: {formatCOP(sub.planPrice || sub.price)}/mes
                                </span>
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                {formatCOP(sub.currentPrice ?? sub.price)} COP
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Modalidad */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {sub.isTrial ? "Prueba Gratuita" : sub.billingInterval === "annual" ? "Anual" : "Mensual"}
                            </span>
                            <p className="text-[11px] text-slate-400 font-mono">
                              {sub.isTrial ? "Evaluación 30 días" : sub.durationFormatted}
                            </p>
                          </div>
                        </td>

                        {/* Vigencia */}
                        <td className="py-3.5 px-4 font-mono text-[11px]">
                          <div className="space-y-0.5">
                            <span className="text-slate-500 dark:text-slate-400">
                              {formatVigenciaDate(sub.currentPeriodStart)}
                            </span>
                            <span className="text-slate-400 mx-1">→</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {formatVigenciaDate(sub.isTrial && sub.trialEndsAt ? sub.trialEndsAt : sub.currentPeriodEnd)}
                            </span>
                            {sub.isTrial && (
                              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-sans">
                                Límite de prueba
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Días Restantes / Semáforo */}
                        <td className="py-3.5 px-4">
                          <AdminBadge
                            variant={
                              sub.vigenciaBadge.badgeVariant === "red"
                                ? "red"
                                : sub.vigenciaBadge.badgeVariant === "amber"
                                ? "amber"
                                : "emerald"
                            }
                            size="sm"
                          >
                            {sub.vigenciaBadge.label}
                          </AdminBadge>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {sub.vigenciaBadge.text}
                          </p>
                        </td>

                        {/* Estado */}
                        <td className="py-3.5 px-4">
                          <AdminStatusBadge
                            status={sub.isTrial ? "trial" : sub.status}
                            label={
                              sub.isTrial
                                ? sub.isExpired
                                  ? "Prueba vencida"
                                  : "En prueba"
                                : sub.status === "active"
                                ? "Activa"
                                : sub.status === "suspended"
                                ? "Suspendida"
                                : "Inactiva"
                            }
                          />
                        </td>

                        {/* Acciones */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              const menuWidth = 220;
                              const padding = 12;
                              let left = rect.right - menuWidth;
                              if (left + menuWidth > window.innerWidth - padding) {
                                left = window.innerWidth - menuWidth - padding;
                              }
                              if (left < padding) left = padding;

                              setMenuAnchor({
                                id: sub.id,
                                top: rect.bottom + 6,
                                left,
                                subscription: sub,
                              });
                            }}
                            className={`p-2 rounded-xl border transition-all cursor-pointer ${
                              menuAnchor?.id === sub.id
                                ? "bg-orange-50 dark:bg-white/10 border-orange-200 dark:border-white/20 text-[#ED500A]"
                                : "text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5"
                            }`}
                            title="Gestionar Suscripción"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Vista Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {data.subscriptions.map((sub) => (
              <div
                key={sub.id}
                onClick={() => router.push(`/admin/negocios/${sub.businessId}?tab=suscripcion`)}
                className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0E12] shadow-xs space-y-3 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-[#ED500A] font-bold text-xs flex items-center justify-center shrink-0 border border-orange-200/50 dark:border-orange-500/20">
                      {sub.businessName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-900 dark:text-white">
                        {sub.businessName}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        /{sub.businessSlug}
                      </p>
                    </div>
                  </div>

                  <AdminBadge
                    variant={
                      sub.vigenciaBadge.badgeVariant === "red"
                        ? "red"
                        : sub.vigenciaBadge.badgeVariant === "amber"
                        ? "amber"
                        : "emerald"
                    }
                    size="sm"
                  >
                    {sub.vigenciaBadge.label}
                  </AdminBadge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-100 dark:border-white/[0.04]">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Plan Contratado</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      Plan {sub.planName}
                    </span>
                    {sub.isTrial && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-mono font-bold">
                        $0 COP (En prueba)
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Modalidad</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {sub.isTrial ? "Prueba 30 días" : sub.billingInterval === "annual" ? "Anual" : "Mensual"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Vencimiento / Fin</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {formatVigenciaDate(sub.isTrial && sub.trialEndsAt ? sub.trialEndsAt : sub.currentPeriodEnd)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Estado</span>
                    <AdminStatusBadge
                      status={sub.isTrial ? "trial" : sub.status}
                      label={sub.isTrial ? "En prueba" : sub.status === "active" ? "Activa" : sub.status}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.04]">
                  <AdminButton
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRenewModal({
                        isOpen: true,
                        subscription: sub,
                        months: 1,
                        planId: sub.planId,
                      });
                    }}
                    leftIcon={<RefreshCw className="w-3 h-3 text-[#ED500A]" />}
                  >
                    Renovar
                  </AdminButton>
                  <Link
                    href={`/admin/negocios/${sub.businessId}?tab=suscripcion`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.05] text-[11px] font-semibold text-slate-700 dark:text-slate-300"
                  >
                    <span>Ver Ficha</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Paginación */}
          <AdminPagination
            currentPage={data.page}
            totalPages={data.totalPages}
            totalItems={data.totalCount}
            currentCount={data.subscriptions.length}
            pageSize={data.pageSize}
            onPageChange={(p) => fetchSubscriptions(p)}
          />
        </div>
      )}

      {/* 4. MENÚ FLOTANTE DE ACCIONES (PORTAL CON Z-INDEX ELEVADO) */}
      {menuAnchor &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            id="subscription-actions-portal-menu"
            className="fixed z-[9999] w-56 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#12141A] shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-100 text-xs"
            style={{
              top: `${menuAnchor.top}px`,
              left: `${menuAnchor.left}px`,
            }}
          >
            <div className="px-3 py-1.5 border-b border-slate-100 dark:border-white/[0.06] mb-1">
              <p className="font-bold text-slate-900 dark:text-white truncate">
                {menuAnchor.subscription.businessName}
              </p>
              <p className="text-[10px] text-slate-400 font-mono">
                Plan {menuAnchor.subscription.planName} • {menuAnchor.subscription.vigenciaBadge.label}
              </p>
            </div>

            {/* Renovar / Extender */}
            <button
              type="button"
              onClick={() => {
                setRenewModal({
                  isOpen: true,
                  subscription: menuAnchor.subscription,
                  months: 1,
                  planId: menuAnchor.subscription.planId,
                });
                setMenuAnchor(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-[#ED500A] dark:hover:text-[#ED500A] transition-colors cursor-pointer font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#ED500A]" />
              <span>Renovar / Extender</span>
            </button>

            {/* Cambiar Plan */}
            <button
              type="button"
              onClick={() => {
                setPlanModal({
                  isOpen: true,
                  subscription: menuAnchor.subscription,
                  newPlanId: menuAnchor.subscription.planId,
                });
                setMenuAnchor(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer font-medium"
            >
              <Layers className="w-3.5 h-3.5 text-blue-500" />
              <span>Cambiar Plan Comercial</span>
            </button>

            {/* Cambiar Estado */}
            <button
              type="button"
              onClick={() => {
                setStatusModal({
                  isOpen: true,
                  subscription: menuAnchor.subscription,
                  targetStatus:
                    menuAnchor.subscription.status === "active" ? "suspended" : "active",
                  reason: "",
                });
                setMenuAnchor(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer font-medium"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              <span>
                {menuAnchor.subscription.status === "active"
                  ? "Suspender Suscripción"
                  : "Activar Suscripción"}
              </span>
            </button>

            <div className="my-1 border-t border-slate-100 dark:border-white/[0.06]" />

            {/* Ver Negocio */}
            <Link
              href={`/admin/negocios/${menuAnchor.subscription.businessId}?tab=suscripcion`}
              onClick={() => setMenuAnchor(null)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors font-medium"
            >
              <span className="flex items-center gap-2.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Ver Ficha del Negocio</span>
              </span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
            </Link>
          </div>,
          document.body
        )}

      {/* 5. MODAL: RENOVAR / EXTENDER VIGENCIA */}
      {renewModal.isOpen && renewModal.subscription && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0F16] p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-[#ED500A] flex items-center justify-center">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Extender / Renovar Suscripción
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {renewModal.subscription.businessName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRenewModal({ isOpen: false, subscription: null, months: 1, planId: "inicio" })}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRenewSubmit} className="space-y-4">
              {/* Selección de Plan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Plan a Contratar
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {COMMERCIAL_PLANS_LIST.map((p) => {
                    const isSelected = renewModal.planId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setRenewModal((prev) => ({ ...prev, planId: p.id }))}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? "border-[#ED500A] bg-orange-50/50 dark:bg-orange-500/10 text-slate-900 dark:text-white"
                            : "border-slate-200 dark:border-white/10 bg-slate-50/30 dark:bg-white/[0.02] text-slate-600 dark:text-slate-400 hover:border-slate-300"
                        }`}
                      >
                        <p className="font-bold text-xs">{p.name}</p>
                        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                          {p.pricing.monthlyFormatted}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selección de Duración */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Duración / Meses a Añadir
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "1 mes", months: 1 },
                    { label: "3 meses", months: 3 },
                    { label: "6 meses", months: 6 },
                    { label: "1 año (12m)", months: 12 },
                    { label: "2 años (24m)", months: 24 },
                  ].map((opt) => {
                    const isSelected = renewModal.months === opt.months;
                    return (
                      <button
                        key={opt.months}
                        type="button"
                        onClick={() => setRenewModal((prev) => ({ ...prev, months: opt.months }))}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          isSelected
                            ? "border-[#ED500A] bg-orange-500/10 text-[#ED500A] font-bold text-xs"
                            : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 text-xs hover:border-slate-300"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Resumen de Cálculo en Vivo */}
              {(() => {
                const targetPlan = NEGOVA_PLANS[renewModal.planId] || NEGOVA_PLANS.inicio;
                const isAnnual = renewModal.months >= 12;
                const price = isAnnual
                  ? (targetPlan.pricing.annualTotal * Math.round(renewModal.months / 12))
                  : (targetPlan.pricing.monthly * renewModal.months);

                const currentEnd = renewModal.subscription.currentPeriodEnd
                  ? new Date(renewModal.subscription.currentPeriodEnd)
                  : new Date();
                const baseDate = currentEnd > new Date() ? currentEnd : new Date();
                const { endDate } = calculatePeriodDates(
                  baseDate,
                  isAnnual ? "annual" : "monthly",
                  isAnnual ? Math.round(renewModal.months / 12) : renewModal.months
                );

                return (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Nuevo Vencimiento Estimado:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {formatVigenciaDate(endDate)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Importe Total Calculado:</span>
                      <span className="font-mono font-bold text-[#ED500A] text-sm">
                        {formatCOP(price)} COP
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
                <AdminButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRenewModal({ isOpen: false, subscription: null, months: 1, planId: "inicio" })}
                  disabled={isPending}
                >
                  Cancelar
                </AdminButton>
                <AdminButton
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isPending}
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                >
                  Confirmar Extensión
                </AdminButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: CAMBIAR PLAN COMERCIAL */}
      {planModal.isOpen && planModal.subscription && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0F16] p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Cambiar Plan Comercial
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {planModal.subscription.businessName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPlanModal({ isOpen: false, subscription: null, newPlanId: "inicio" })}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePlanSubmit} className="space-y-4">
              <div className="space-y-2.5">
                {COMMERCIAL_PLANS_LIST.map((p) => {
                  const isSelected = planModal.newPlanId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlanModal((prev) => ({ ...prev, newPlanId: p.id }))}
                      className={`w-full p-4 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "border-[#ED500A] bg-orange-50/50 dark:bg-orange-500/10"
                          : "border-slate-200 dark:border-white/10 bg-slate-50/30 dark:bg-white/[0.02] hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          Plan {p.name}
                        </span>
                        <span className="font-mono font-bold text-xs text-[#ED500A]">
                          {p.pricing.monthlyFormatted} / mes
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {p.tagline}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                        <span>• Hasta {p.limits.maxUsers} usuarios</span>
                        <span>• Hasta {p.limits.maxProducts} productos</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
                <AdminButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPlanModal({ isOpen: false, subscription: null, newPlanId: "inicio" })}
                  disabled={isPending}
                >
                  Cancelar
                </AdminButton>
                <AdminButton
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isPending}
                >
                  Actualizar Plan
                </AdminButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: CAMBIAR ESTADO DE SUSCRIPCIÓN */}
      {statusModal.isOpen && statusModal.subscription && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0F16] p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Modificar Estado de Suscripción
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {statusModal.subscription.businessName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStatusModal({ isOpen: false, subscription: null, targetStatus: null, reason: "" })}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStatusSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nuevo Estado
                </label>
                <select
                  value={statusModal.targetStatus || "active"}
                  onChange={(e) =>
                    setStatusModal((prev) => ({
                      ...prev,
                      targetStatus: e.target.value as SubscriptionStatus,
                    }))
                  }
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30"
                >
                  <option value="active">Activa (Habilitada)</option>
                  <option value="trial">Periodo de Prueba (Trial)</option>
                  <option value="suspended">Suspendida (Bloqueo temporal)</option>
                  <option value="canceled">Cancelada (Baja definitiva)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Motivo o justificación del cambio
                </label>
                <textarea
                  rows={3}
                  value={statusModal.reason}
                  onChange={(e) => setStatusModal((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="Explica la razón del cambio de estado para el registro de auditoría..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
                <AdminButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStatusModal({ isOpen: false, subscription: null, targetStatus: null, reason: "" })}
                  disabled={isPending}
                >
                  Cancelar
                </AdminButton>
                <AdminButton
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isPending}
                >
                  Confirmar Cambio
                </AdminButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
