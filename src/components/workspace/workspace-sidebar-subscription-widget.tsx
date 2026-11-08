"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, ArrowUpRight, Clock, AlertTriangle } from "lucide-react";
import { PlanId, NEGOVA_PLANS, PlanLimits } from "@/config/plans";
import { PlanFeatureKey } from "@/config/commercial-activities";

export interface WorkspaceSidebarSubscriptionWidgetProps {
  businessId: string;
  planId?: PlanId | string;
  planName?: string;
  enabledFeatures?: PlanFeatureKey[];
  planLimits?: PlanLimits;
  productCount?: number;
  userCount?: number; // Conteo canónico de usuarios del negocio (Propietario + Empleados)
  employeeCount?: number; // Retrocompatibilidad
  locationCount?: number;
  trialRemainingDays?: number | null;
  isTrialing?: boolean;
  upgradeUrl?: string;
  isCollapsed?: boolean;
  className?: string;
}

/**
 * Widget de suscripción, límites y recursos del Sidebar de NEGOVA [SUB-002 / NAV-003].
 *
 * Principios de diseño y UX:
 * 1. Indicadores independientes por recurso: Usuarios y Productos tienen sus propias métricas y barras.
 * 2. Cero falsas alarmas globales: no muestra "Plan agotado" cuando solo un recurso ha alcanzado su cupo.
 * 3. Identificación precisa: cuando un recurso específico llega al 100%, muestra claramente
 *    "Límite de usuarios alcanzado" o "Límite de productos alcanzado".
 * 4. Tipografía y espaciado limpios: jerarquía visual clara para valores actuales y máximos.
 * 5. Adaptación responsiva: excelente presentación en sidebar expandido y botón interactivo en modo colapsado.
 */
export function WorkspaceSidebarSubscriptionWidget({
  businessId,
  planId = "inicio",
  planName: customPlanName,
  enabledFeatures = [],
  planLimits,
  productCount = 0,
  userCount,
  employeeCount = 1,
  locationCount = 1,
  trialRemainingDays = null,
  isTrialing = false,
  upgradeUrl = "/planes",
  isCollapsed = false,
  className = "",
}: WorkspaceSidebarSubscriptionWidgetProps) {
  // 1. Resolver clave y definición canónica del plan
  const rawId = (planId || "").toLowerCase();
  const canonicalKey: PlanId =
    rawId.includes("crece") || rawId.includes("avanzado") || rawId.includes("professional")
      ? "crece"
      : rawId.includes("negocio") || rawId.includes("enterprise")
      ? "negocio"
      : "inicio";

  const planDef = NEGOVA_PLANS[canonicalKey] || NEGOVA_PLANS.inicio;

  // Nombre visible del plan (respeta "Avanzado" o nombres personalizados si existen)
  const resolvedPlanName =
    customPlanName ||
    (rawId.includes("avanzado")
      ? "Avanzado"
      : rawId.includes("profesional") || rawId.includes("professional")
      ? "Profesional"
      : planDef.name);

  // 2. Conteo y límites de Usuarios (1 Propietario + N Colaboradores)
  const effectiveUserCount = Math.max(0, userCount ?? employeeCount ?? 1);
  const maxUsers = planLimits?.maxUsers ?? planDef.limits.maxUsers ?? 4;
  const isUsersUnlimited = maxUsers === Infinity || maxUsers <= 0;
  const userPercentage = isUsersUnlimited
    ? 0
    : Math.min(100, Math.max(0, Math.round((effectiveUserCount / maxUsers) * 100)));

  const isUserWarning = !isUsersUnlimited && userPercentage >= 80 && effectiveUserCount < maxUsers;
  const isUserLimitReached = !isUsersUnlimited && effectiveUserCount >= maxUsers;

  const getUserBarColor = () => {
    if (isUserLimitReached) return "bg-rose-500 dark:bg-rose-400";
    if (isUserWarning) return "bg-amber-500 dark:bg-amber-400";
    return "bg-blue-600 dark:bg-blue-500";
  };

  // 3. Conteo y límites de Productos del catálogo
  const effectiveProductCount = Math.max(0, productCount ?? 0);
  const maxProducts = planLimits?.maxProducts ?? planDef.limits.maxProducts ?? 200;
  const isProductsUnlimited = maxProducts === Infinity || maxProducts <= 0;
  const productPercentage = isProductsUnlimited
    ? 0
    : Math.min(100, Math.max(0, Math.round((effectiveProductCount / maxProducts) * 100)));

  const isProductLimitReached = !isProductsUnlimited && effectiveProductCount >= maxProducts;
  const isProductCritical = !isProductsUnlimited && (productPercentage >= 90 || isProductLimitReached);
  const isProductWarning = !isProductsUnlimited && productPercentage >= 70 && !isProductCritical;

  const getProductBarColor = () => {
    if (isProductLimitReached || isProductCritical) return "bg-rose-500 dark:bg-rose-500";
    if (isProductWarning) return "bg-amber-500 dark:bg-amber-400";
    return "bg-[#ED500A]";
  };

  // Estados agregados para alertas del modo colapsado y cabecera
  const areBothLimitsReached = isUserLimitReached && isProductLimitReached;
  const hasAnyLimitReached = isUserLimitReached || isProductLimitReached;
  const hasAnyWarning = isUserWarning || isProductWarning;

  // Tooltips descriptivos
  const productTooltip = isProductsUnlimited
    ? "Productos: catálogo ilimitado."
    : `Productos: ${effectiveProductCount} de ${maxProducts} usados (${productPercentage}%). Te quedan ${Math.max(0, maxProducts - effectiveProductCount)} disponibles.`;

  const userTooltip = isUsersUnlimited
    ? "Usuarios: acceso ilimitado."
    : `Usuarios: ${effectiveUserCount} de ${maxUsers} usados (${userPercentage}%). Te quedan ${Math.max(0, maxUsers - effectiveUserCount)} disponibles.`;

  // 4. MODO COLAPSADO (Sidebar estrecho)
  if (isCollapsed) {
    const collapsedTitle = `Plan ${resolvedPlanName} — Actualizar plan`;

    return (
      <div className={`flex justify-center my-1 ${className}`}>
        <Link
          href={upgradeUrl}
          className="group relative w-10 h-10 rounded-xl flex items-center justify-center bg-white hover:bg-orange-50 dark:bg-white/[0.04] dark:hover:bg-[#ED500A]/10 border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:text-[#ED500A] dark:hover:text-[#ED500A] transition-all focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
          title={collapsedTitle}
          aria-label={collapsedTitle}
        >
          <Sparkles className="w-4 h-4 text-[#ED500A]" />
          <span className="sr-only">Actualizar plan</span>
          {hasAnyLimitReached ? (
            <span
              className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse ring-2 ring-white dark:ring-[#0B0E14]"
              title="Uno o más recursos alcanzaron su límite"
            />
          ) : hasAnyWarning ? (
            <span
              className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-[#0B0E14]"
              title="Capacidad cerca del límite (80%+)"
            />
          ) : isTrialing && trialRemainingDays !== null ? (
            <span
              className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${
                trialRemainingDays <= 0 ? "bg-rose-500" : "bg-amber-500"
              } animate-pulse ring-2 ring-white dark:ring-[#0B0E14]`}
              title={trialRemainingDays <= 0 ? "Prueba vencida" : `${trialRemainingDays} días de prueba restantes`}
            />
          ) : null}
        </Link>
      </div>
    );
  }

  // 5. MODO EXPANDIDO (Sidebar completo)
  return (
    <div
      data-testid="workspace-sidebar-subscription-widget"
      className={`rounded-xl p-3 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs space-y-2.5 ${className}`}
    >
      {/* Cabecera: Identificación clara del plan y estado */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className="w-4 h-4 rounded-md flex items-center justify-center shrink-0 text-white text-[10px] font-bold shadow-2xs"
            style={{ backgroundColor: planDef.color || "#ED500A" }}
          >
            {resolvedPlanName.charAt(0)}
          </div>
          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
            Plan {resolvedPlanName}
          </span>
        </div>

        {/* Badge contextual: solo alerta si ambos están al tope; si no, refleja estado activo o prueba */}
        {isTrialing && trialRemainingDays !== null ? (
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border shrink-0 ${
              trialRemainingDays <= 0
                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
            }`}
          >
            <Clock className="w-2.5 h-2.5 animate-pulse" />
            <span>{trialRemainingDays <= 0 ? "Prueba vencida" : `${trialRemainingDays}d prueba`}</span>
          </span>
        ) : areBothLimitsReached ? (
          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
            Límite alcanzado
          </span>
        ) : (
          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
            Activo
          </span>
        )}
      </div>

      {/* =====================================================================
          MÉTRICAS INDEPENDIENTES DE RECURSOS
          ===================================================================== */}
      <div className="space-y-2">
        {/* RECURSO 1: USUARIOS (Propietario + Colaboradores) */}
        <div
          className="space-y-1"
          title={userTooltip}
        >
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-slate-600 dark:text-slate-300">
              Usuarios
            </span>
            <span className="font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200">
              {effectiveUserCount} / {isUsersUnlimited ? "∞" : maxUsers} ({userPercentage}%)
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={userPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Porcentaje de usuarios ocupados: ${userPercentage}%`}
            className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.08] overflow-hidden"
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${getUserBarColor()}`}
              style={{ width: `${userPercentage}%` }}
            />
          </div>

          {/* Advertencia contextual solo para Usuarios */}
          {isUserLimitReached ? (
            <div className="flex items-center gap-1 pt-0.5 text-[9.5px] font-semibold text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
              <span>Usuarios: límite alcanzado</span>
            </div>
          ) : isUserWarning ? (
            <div className="text-[9.5px] font-medium text-amber-600 dark:text-amber-400 pt-0.5">
              {maxUsers - effectiveUserCount} cupo(s) disponible(s)
            </div>
          ) : null}
        </div>

        {/* RECURSO 2: PRODUCTOS */}
        <div
          className="space-y-1"
          title={productTooltip}
        >
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-slate-600 dark:text-slate-300">
              Productos
            </span>
            <span className="font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200">
              {effectiveProductCount} / {isProductsUnlimited ? "∞" : maxProducts} ({productPercentage}%)
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={productPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Porcentaje de productos utilizados: ${productPercentage}%`}
            className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.08] overflow-hidden"
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${getProductBarColor()}`}
              style={{ width: `${productPercentage}%` }}
            />
          </div>

          {/* Advertencia contextual solo para Productos */}
          {isProductLimitReached ? (
            <div className="flex items-center gap-1 pt-0.5 text-[9.5px] font-semibold text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
              <span>Productos: límite alcanzado</span>
            </div>
          ) : isProductWarning ? (
            <div className="text-[9.5px] font-medium text-amber-600 dark:text-amber-400 pt-0.5">
              {maxProducts - effectiveProductCount} disponibles
            </div>
          ) : null}
        </div>
      </div>

      {/* Botón Mejorar Plan: limpio, moderno y accesible */}
      <div className="pt-0.5">
        <Link
          href={upgradeUrl}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-[#ED500A] dark:text-slate-300 dark:hover:text-[#ED500A] bg-slate-50 hover:bg-orange-50/70 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-slate-200/80 hover:border-[#ED500A]/30 dark:border-white/[0.08] transition-all shadow-2xs group"
          title="Ver planes disponibles y cuotas de uso (Actualizar plan)"
          aria-label="Mejorar plan — Actualizar plan"
        >
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#ED500A] group-hover:scale-110 transition-transform" />
            <span>Mejorar plan</span>
            <span className="sr-only">Actualizar plan</span>
          </span>
          <ArrowUpRight className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all text-slate-400 group-hover:text-[#ED500A]" />
        </Link>
      </div>
    </div>
  );
}
