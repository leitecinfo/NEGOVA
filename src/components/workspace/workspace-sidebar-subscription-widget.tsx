"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, ArrowUpRight, Clock, Package, Users, AlertTriangle } from "lucide-react";
import { PlanId, NEGOVA_PLANS, PlanLimits } from "@/config/plans";
import { PlanFeatureKey } from "@/config/commercial-activities";

export interface WorkspaceSidebarSubscriptionWidgetProps {
  businessId: string;
  planId?: PlanId | string;
  planName?: string;
  enabledFeatures?: PlanFeatureKey[];
  planLimits?: PlanLimits;
  productCount?: number;
  employeeCount?: number; // [SUB-002] Conteo de empleados / usuarios activos
  locationCount?: number;
  trialRemainingDays?: number | null;
  isTrialing?: boolean;
  upgradeUrl?: string;
  isCollapsed?: boolean;
  className?: string;
}

/**
 * [SUB-002 / NAV-003] Widget de plan, límites y uso en la parte inferior del Sidebar.
 * 
 * Alcance y Criterios:
 * - Muestra nombre del plan actual con badge (ej. Plan Inicio, Plan Crece, Plan Profesional, Plan Negocio).
 * - Barras de progreso de uso para Productos ("Productos: 45/500") y Empleados ("Empleados: 8/15").
 * - Al alcanzar el 80% de un recurso, la barra cambia a color de advertencia amarillo (bg-amber-500).
 * - Al alcanzar el 100%, la barra es roja (bg-rose-500) y muestra "Límite alcanzado".
 * - Badge de alerta en el header cuando un recurso está al 80%+ del límite.
 * - Tooltip con detalle completo al hacer hover en cada barra.
 * - Enlace "Mejorar plan" que lleva a la página de suscripción o configuración.
 */
export function WorkspaceSidebarSubscriptionWidget({
  businessId,
  planId = "inicio",
  planName: customPlanName,
  enabledFeatures = [],
  planLimits,
  productCount = 0,
  employeeCount = 1,
  locationCount = 1,
  trialRemainingDays = null,
  isTrialing = false,
  upgradeUrl = "/planes",
  isCollapsed = false,
  className = "",
}: WorkspaceSidebarSubscriptionWidgetProps) {
  // 1. Resolver nombre y definición canónica del plan
  const canonicalKey: PlanId =
    planId === "crece" || planId === "negocio" ? planId : "inicio";
  const planDef = NEGOVA_PLANS[canonicalKey] || NEGOVA_PLANS.inicio;

  // Soporte para nombres personalizados como "Plan Profesional"
  const resolvedPlanName =
    customPlanName ||
    (planId.toLowerCase().includes("profesional")
      ? "Profesional"
      : planDef.name);

  // 2. Límites y porcentajes de Productos
  const maxProducts = planLimits?.maxProducts ?? planDef.limits.maxProducts ?? 200;
  const isProductsUnlimited = maxProducts === Infinity || maxProducts <= 0;
  const productPercentage = isProductsUnlimited
    ? 0
    : Math.min(100, Math.max(0, Math.round((productCount / maxProducts) * 100)));

  const isProductWarning = !isProductsUnlimited && productPercentage >= 80 && productPercentage < 100;
  const isProductLimitReached = !isProductsUnlimited && (productCount >= maxProducts || productPercentage >= 100);

  // Color de barra de productos:
  // - >= 100%: Rojo
  // - >= 80%: Amarillo / Ámbar
  // - < 80%: Naranja corporativo
  const getProductBarColor = () => {
    if (isProductLimitReached) return "bg-rose-500 dark:bg-rose-400";
    if (productPercentage >= 90) return "bg-rose-500 dark:bg-rose-400";
    if (isProductWarning) return "bg-amber-500 dark:bg-amber-400";
    return "bg-[#ED500A]";
  };

  // 3. Límites y porcentajes de Empleados / Usuarios
  const maxUsers = planLimits?.maxUsers ?? planDef.limits.maxUsers ?? 2;
  const isUsersUnlimited = maxUsers === Infinity || maxUsers <= 0;
  const userPercentage = isUsersUnlimited
    ? 0
    : Math.min(100, Math.max(0, Math.round((employeeCount / maxUsers) * 100)));

  const isUserWarning = !isUsersUnlimited && userPercentage >= 80 && userPercentage < 100;
  const isUserLimitReached = !isUsersUnlimited && (employeeCount >= maxUsers || userPercentage >= 100);

  const getUserBarColor = () => {
    if (isUserLimitReached) return "bg-rose-500 dark:bg-rose-400";
    if (isUserWarning) return "bg-amber-500 dark:bg-amber-400";
    return "bg-blue-600 dark:bg-blue-500";
  };

  // 4. Estado de alerta global (si cualquier recurso alcanza 80% o 100%)
  const hasLimitReached = isProductLimitReached || isUserLimitReached;
  const hasWarning = isProductWarning || isUserWarning;

  // 5. Modo colapsado: icono compacto con badge pulsante
  if (isCollapsed) {
    return (
      <div className={`flex justify-center my-1 ${className}`}>
        <Link
          href={upgradeUrl}
          className="group relative w-10 h-10 rounded-xl flex items-center justify-center bg-white hover:bg-orange-50 dark:bg-white/[0.04] dark:hover:bg-[#ED500A]/10 border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:text-[#ED500A] dark:hover:text-[#ED500A] transition-all focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
          title={`Plan ${resolvedPlanName} — ${productPercentage}% productos (${productCount}/${isProductsUnlimited ? "∞" : maxProducts}), ${userPercentage}% empleados (${employeeCount}/${isUsersUnlimited ? "∞" : maxUsers}). Actualizar plan — Mejorar plan`}
          aria-label={`Plan ${resolvedPlanName} — Actualizar plan — Mejorar plan`}
        >
          <Sparkles className="w-4 h-4 text-[#ED500A]" />
          {hasLimitReached ? (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse ring-2 ring-white dark:ring-[#0B0E14]" />
          ) : hasWarning ? (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse ring-2 ring-white dark:ring-[#0B0E14]" />
          ) : isTrialing && trialRemainingDays !== null ? (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse ring-2 ring-white dark:ring-[#0B0E14]" />
          ) : null}
        </Link>
      </div>
    );
  }

  // 6. Modo expandido (sidebar completo)
  return (
    <div
      data-testid="workspace-sidebar-subscription-widget"
      className={`rounded-2xl p-3 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs space-y-2.5 ${className}`}
    >
      {/* Cabecera: Nombre del Plan y Badge de Estado */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-white text-[11px] font-bold shadow-2xs"
            style={{ backgroundColor: planDef.color || "#ED500A" }}
          >
            {resolvedPlanName.charAt(0)}
          </div>
          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
            Plan {resolvedPlanName}
          </span>
        </div>

        {/* Badge contextual de alerta o estado */}
        {hasLimitReached ? (
          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
            Límite alcanzado
          </span>
        ) : hasWarning ? (
          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
            80%+ límite
          </span>
        ) : isTrialing && trialRemainingDays !== null ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
            <Clock className="w-2.5 h-2.5 animate-pulse" />
            <span>{trialRemainingDays}d prueba</span>
          </span>
        ) : (
          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
            Activo
          </span>
        )}
      </div>

      {/* =====================================================================
          BARRAS DE PROGRESO DE USO DE RECURSOS [SUB-002]
          ===================================================================== */}
      <div className="space-y-2">
        {/* BARRA 1: PRODUCTOS */}
        <div
          className="space-y-1"
          title={`Productos: ${productCount} de ${isProductsUnlimited ? "Ilimitados" : maxProducts} usados (${productPercentage}%). ${
            isProductLimitReached
              ? "Límite alcanzado."
              : isProductsUnlimited
              ? "Capacidad ilimitada."
              : `Te quedan ${maxProducts - productCount} disponibles.`
          }`}
        >
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Package className="w-3 h-3 text-slate-400" />
              <span>Productos</span>
            </span>
            <div className="flex items-center gap-1">
              {isProductLimitReached && (
                <span className="text-[9.5px] font-bold text-rose-600 dark:text-rose-400">
                  Límite alcanzado
                </span>
              )}
              <span className={`font-mono font-medium ${isProductLimitReached ? "text-rose-600 font-bold" : isProductWarning ? "text-amber-600 font-bold" : "text-slate-700 dark:text-slate-300"}`}>
                {productCount} / {isProductsUnlimited ? "∞" : maxProducts} ({productPercentage}%)
              </span>
            </div>
          </div>

          <div
            role="progressbar"
            aria-valuenow={productPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Porcentaje de productos usados: ${productPercentage}%`}
            className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden"
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${getProductBarColor()}`}
              style={{ width: `${productPercentage}%` }}
            />
          </div>
        </div>

        {/* BARRA 2: EMPLEADOS / COLABORADORES */}
        <div
          className="space-y-1"
          title={`Empleados: ${employeeCount} de ${isUsersUnlimited ? "Ilimitados" : maxUsers} usados (${userPercentage}%). ${
            isUserLimitReached
              ? "Límite alcanzado."
              : isUsersUnlimited
              ? "Capacidad ilimitada."
              : `Te quedan ${maxUsers - employeeCount} disponibles.`
          }`}
        >
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Users className="w-3 h-3 text-slate-400" />
              <span>Empleados</span>
            </span>
            <div className="flex items-center gap-1">
              {isUserLimitReached && (
                <span className="text-[9.5px] font-bold text-rose-600 dark:text-rose-400">
                  Límite alcanzado
                </span>
              )}
              <span className={`font-mono font-medium ${isUserLimitReached ? "text-rose-600 font-bold" : isUserWarning ? "text-amber-600 font-bold" : "text-slate-700 dark:text-slate-300"}`}>
                {employeeCount} / {isUsersUnlimited ? "∞" : maxUsers} ({userPercentage}%)
              </span>
            </div>
          </div>

          <div
            role="progressbar"
            aria-valuenow={userPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Porcentaje de empleados usados: ${userPercentage}%`}
            className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden"
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${getUserBarColor()}`}
              style={{ width: `${userPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Botón Mejorar Plan (con compatibilidad de atajos y accesibilidad) */}
      <div className="pt-0.5">
        <Link
          href={upgradeUrl}
          className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-orange-50 text-slate-800 hover:text-[#ED500A] dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-slate-200 dark:hover:text-white border border-slate-200/80 dark:border-white/[0.08] transition-all shadow-2xs group"
          title="Ver planes disponibles y cuotas de uso (Actualizar plan)"
          aria-label="Mejorar plan — Actualizar plan"
        >
          <Sparkles className="w-3 h-3 text-[#ED500A] group-hover:scale-110 transition-transform" />
          <span>Mejorar plan</span>
          <ArrowUpRight className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity ml-auto" />
        </Link>
      </div>
    </div>
  );
}
