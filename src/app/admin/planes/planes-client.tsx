"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  Layers,
  CheckCircle2,
  XCircle,
  Sparkles,
  Users,
  Package,
  Store,
  CreditCard,
  TrendingUp,
  Headphones,
  ShieldCheck,
  Zap,
  Info,
  ArrowRight,
  Bot,
  Receipt,
  Percent,
  Settings,
  Save,
  Check,
} from "lucide-react";
import {
  COMPARISON_FEATURES,
  PlanId,
  CommercialPlan,
  getCommercialPlans,
} from "@/config/plans";
import { AnnualDiscountConfig } from "@/lib/subscriptions/types";
import {
  AdminButton,
  AdminBadge,
  AdminKpiGrid,
  AdminKpiCard,
} from "@/components/admin/ui";
import { updateAnnualDiscountAction } from "./actions";
import { toast } from "sonner";

interface PlanesClientProps {
  planCounts: Record<PlanId, number>;
  totalBusinesses: number;
  initialDiscountConfig?: AnnualDiscountConfig;
}

export function PlanesClient({
  planCounts,
  totalBusinesses,
  initialDiscountConfig = { isEnabled: false, percentage: 0 },
}: PlanesClientProps) {
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  const [isPending, startTransition] = useTransition();

  // Configuración de Descuento Anual
  const [discountConfig, setDiscountConfig] = useState<AnnualDiscountConfig>(initialDiscountConfig);
  const [savedConfig, setSavedConfig] = useState<AnnualDiscountConfig>(initialDiscountConfig);

  const hasUnsavedChanges =
    discountConfig.isEnabled !== savedConfig.isEnabled ||
    discountConfig.percentage !== savedConfig.percentage;

  const isDiscountActive = discountConfig.isEnabled && discountConfig.percentage > 0;

  // Lista de planes con precios dinámicos según la configuración
  const dynamicPlans = getCommercialPlans(discountConfig);

  const handleSaveDiscount = () => {
    startTransition(async () => {
      const res = await updateAnnualDiscountAction(discountConfig);
      if (res.success && res.data) {
        setSavedConfig(res.data);
        setDiscountConfig(res.data);
        toast.success(
          res.data.isEnabled
            ? `Descuento anual del ${res.data.percentage}% activado exitosamente.`
            : "Descuento anual desactivado. Los planes se facturarán por valor neto de 12 meses."
        );
      } else {
        toast.error(res.error || "No fue posible guardar la configuración.");
      }
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* 1. KPIS DE DISTRIBUCIÓN COMERCIAL */}
      <AdminKpiGrid cols={4}>
        <AdminKpiCard
          title="Total Comercios"
          value={totalBusinesses}
          subtext="Tenants en catálogo"
          icon={<Store className="w-5 h-5 text-slate-700 dark:text-slate-300" />}
          variant="default"
        />
        <AdminKpiCard
          title="Plan Inicio"
          value={planCounts.inicio || 0}
          subtext="$29.900 / mes"
          icon={<Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
          variant="blue"
        />
        <AdminKpiCard
          title="Plan Crece"
          value={planCounts.crece || 0}
          subtext="$59.900 / mes (Más elegido)"
          icon={<Sparkles className="w-5 h-5 text-[#ED500A]" />}
          variant="orange"
        />
        <AdminKpiCard
          title="Plan Negocio"
          value={planCounts.negocio || 0}
          subtext="$99.900 / mes"
          icon={<Zap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
          variant="emerald"
        />
      </AdminKpiGrid>

      {/* 2. PANEL DE CONFIGURACIÓN COMERCIAL DE DESCUENTO ANUAL */}
      <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0E12] p-6 sm:p-7 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-500/10 text-[#ED500A] flex items-center justify-center shrink-0 border border-orange-200/60 dark:border-orange-500/20">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-title text-slate-900 dark:text-white">
                Configuración de Descuento por Facturación Anual
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Define si se ofrece un incentivo por pago anual adelantado y el porcentaje aplicable en toda la plataforma.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                Cambios pendientes
              </span>
            )}
            <AdminButton
              variant="primary"
              size="sm"
              onClick={handleSaveDiscount}
              isLoading={isPending}
              disabled={!hasUnsavedChanges || isPending}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Guardar Configuración
            </AdminButton>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-center">
          {/* Switch de activación */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Descuento Anual
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {discountConfig.isEnabled ? "Habilitado comercialmente" : "Deshabilitado (Precio regular x 12)"}
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                setDiscountConfig((prev) => ({
                  ...prev,
                  isEnabled: !prev.isEnabled,
                  percentage: !prev.isEnabled && prev.percentage === 0 ? 10 : prev.percentage,
                }))
              }
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                discountConfig.isEnabled ? "bg-[#ED500A]" : "bg-slate-300 dark:bg-slate-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  discountConfig.isEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Porcentaje de descuento editable libremente */}
          <div className={`p-4 rounded-2xl border transition-all space-y-3 ${
            discountConfig.isEnabled
              ? "bg-slate-50/70 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/[0.06]"
              : "bg-slate-50/30 dark:bg-white/[0.01] border-slate-200/40 dark:border-white/[0.03] opacity-50 pointer-events-none"
          }`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Porcentaje de Descuento
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={discountConfig.percentage || ""}
                  onChange={(e) => {
                    const val = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                    if (!isNaN(val)) {
                      setDiscountConfig((prev) => ({
                        ...prev,
                        percentage: Math.max(0, Math.min(99, val)),
                      }));
                    }
                  }}
                  className="w-16 px-2 py-1 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#12141A] text-right font-mono font-bold text-sm text-[#ED500A] focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30"
                  placeholder="0"
                />
                <span className="text-xs font-bold text-slate-500 font-mono">%</span>
              </div>
            </div>

            {/* Slider continuo */}
            <input
              type="range"
              min="1"
              max="90"
              step="1"
              value={discountConfig.percentage || 1}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setDiscountConfig((prev) => ({ ...prev, percentage: val }));
              }}
              className="w-full accent-[#ED500A] cursor-pointer h-1.5 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none"
            />

            {/* Botones de selección rápida para cualquier rango */}
            <div className="flex items-center gap-1 pt-1">
              {[10, 20, 30, 50, 70, 80].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setDiscountConfig((prev) => ({ ...prev, percentage: pct }))}
                  className={`flex-1 py-1 rounded-md text-[11px] font-mono font-bold transition-all cursor-pointer ${
                    discountConfig.percentage === pct
                      ? "bg-[#ED500A] text-white shadow-xs"
                      : "bg-white dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:border-orange-300"
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Resumen del impacto */}
          <div className="p-4 rounded-2xl bg-orange-50/50 dark:bg-orange-500/5 border border-orange-200/50 dark:border-orange-500/10 space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#ED500A] block">
              Vista Previa
            </span>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {isDiscountActive ? (
                <>
                  La vista pública y administrativa mostrará la etiqueta <strong>Ahorra {discountConfig.percentage}%</strong> y calculará el ahorro anual correspondiente.
                </>
              ) : (
                <>
                  Sin descuento anual activo. Los comercios verán el costo exacto equivalente a 12 mensualidades sin etiquetas de descuento.
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* 3. CONMUTADOR DE FACTURACIÓN (MENSUAL / ANUAL) */}
      <div className="flex flex-col items-center justify-center space-y-3 pt-2">
        <div className="inline-flex items-center p-1.5 rounded-2xl bg-slate-100 dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/10">
          <button
            type="button"
            onClick={() => setBillingInterval("monthly")}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              billingInterval === "monthly"
                ? "bg-white dark:bg-[#12141A] text-slate-900 dark:text-white shadow-xs"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Facturación Mensual
          </button>
          <button
            type="button"
            onClick={() => setBillingInterval("annual")}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              billingInterval === "annual"
                ? "bg-white dark:bg-[#12141A] text-slate-900 dark:text-white shadow-xs"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Facturación Anual</span>
            {isDiscountActive && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Ahorra {discountConfig.percentage}%
              </span>
            )}
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Todos los planes incluyen 30 días de prueba gratuita para nuevos negocios.
        </p>
      </div>

      {/* 4. TARJETAS DE PLANES CANÓNICOS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {dynamicPlans.map((plan) => {
          const isCrece = plan.id === "crece";
          const count = planCounts[plan.id] || 0;

          const priceFormatted =
            billingInterval === "annual"
              ? plan.pricing.annualMonthlyFormatted
              : plan.pricing.monthlyFormatted;

          const billingSubtext =
            billingInterval === "annual"
              ? isDiscountActive
                ? `COP / mes (facturado ${plan.pricing.annualTotalFormatted} al año con ${discountConfig.percentage}% dto.)`
                : `COP / mes (facturado ${plan.pricing.annualTotalFormatted} al año)`
              : "COP / mes";

          return (
            <div
              key={plan.id}
              className={`relative rounded-3xl border transition-all flex flex-col justify-between ${
                isCrece
                  ? "border-[#ED500A] bg-white dark:bg-[#0E1017] shadow-xl shadow-orange-500/5 ring-1 ring-[#ED500A]/30"
                  : "border-slate-200/90 dark:border-white/10 bg-white dark:bg-[#0D0E12] shadow-xs hover:border-slate-300 dark:hover:border-white/20"
              } p-6 sm:p-7 space-y-6`}
            >
              {/* Badge Más Elegido */}
              {isCrece && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="px-3.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-[#ED500A] text-white shadow-md">
                    {plan.badgeText || "Más Elegido"}
                  </span>
                </div>
              )}

              {/* Cabecera del Plan */}
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                        plan.id === "negocio"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : plan.id === "crece"
                          ? "bg-orange-500/10 text-[#ED500A] border-orange-500/20"
                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                      }`}
                    >
                      Plan {plan.name}
                    </span>
                    <h3 className="text-xl font-bold font-title text-slate-900 dark:text-white mt-2">
                      {plan.concept}
                    </h3>
                  </div>

                  <div className="text-right">
                    <span className="px-2 py-1 rounded-md text-[11px] font-mono font-semibold bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300">
                      {count} activo{count === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {plan.description}
                </p>

                {/* Precio */}
                <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-extrabold font-title text-slate-900 dark:text-white">
                      {priceFormatted}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-slate-400 mt-1">
                    {billingSubtext}
                  </p>
                </div>

                {/* Límites y Capacidades */}
                <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04] space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Users className="w-3.5 h-3.5" />
                      Usuarios:
                    </span>
                    <span className="font-bold font-mono">
                      Hasta {plan.limits.maxUsers} usuario{plan.limits.maxUsers > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Package className="w-3.5 h-3.5" />
                      Productos:
                    </span>
                    <span className="font-bold font-mono">
                      Hasta {plan.limits.maxProducts.toLocaleString("es-CO")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Bot className="w-3.5 h-3.5" />
                      NEGOVA AI:
                    </span>
                    <span
                      className={`font-semibold ${
                        plan.limits.canUseAiAssistant
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-slate-400"
                      }`}
                    >
                      {plan.limits.canUseAiAssistant ? "Incluido" : "No disponible"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Headphones className="w-3.5 h-3.5" />
                      Soporte:
                    </span>
                    <span className="font-semibold capitalize">
                      {plan.limits.supportLevel === "direct"
                        ? "Acompañamiento Directo"
                        : plan.limits.supportLevel === "priority"
                        ? "Prioritario"
                        : "Estándar"}
                    </span>
                  </div>
                </div>

                {/* Lista de Funcionalidades */}
                <div className="space-y-2 pt-2">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                    Incluye:
                  </p>
                  <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    {plan.featureGroups.flatMap((g) => g.items).map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Botón Acción hacia Suscripciones */}
              <div className="pt-6 border-t border-slate-100 dark:border-white/[0.06]">
                <Link
                  href={`/admin/suscripciones?planId=${plan.id}`}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
                    isCrece
                      ? "bg-[#ED500A] text-white hover:bg-[#d94806] shadow-sm shadow-orange-500/20"
                      : "bg-slate-100 dark:bg-white/[0.06] text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/10"
                  }`}
                >
                  <span>Ver Comercios con Plan {plan.name}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. MATRIZ COMPARATIVA DE CAPACIDADES */}
      <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0E12] p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-white/[0.06]">
          <div>
            <h3 className="text-lg font-bold font-title text-slate-900 dark:text-white">
              Matriz Comparativa de Capacidades Oficiales
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Solo características reales y garantizadas por la arquitectura de NEGOVA.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-orange-50 text-[#ED500A] border border-orange-200 dark:bg-orange-500/10 dark:border-orange-500/20">
            Catálogo Canónico
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                <th className="py-3.5 px-4">Funcionalidad / Módulo</th>
                <th className="py-3.5 px-4 text-center w-36">Inicio</th>
                <th className="py-3.5 px-4 text-center w-36 bg-orange-500/[0.03]">Crece</th>
                <th className="py-3.5 px-4 text-center w-36">Negocio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
              {COMPARISON_FEATURES.map((feat, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {feat.name}
                    </span>
                    {feat.notes && (
                      <span className="block text-[11px] text-slate-400 font-mono mt-0.5">
                        {feat.notes}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {feat.inicio ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                    ) : (
                      <XCircle className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-auto" />
                    )}
                  </td>
                  <td className="py-3 px-4 text-center bg-orange-500/[0.03]">
                    {feat.crece ? (
                      <CheckCircle2 className="w-4 h-4 text-[#ED500A] mx-auto" />
                    ) : (
                      <XCircle className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-auto" />
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {feat.negocio ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                    ) : (
                      <XCircle className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
