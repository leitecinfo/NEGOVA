"use client";

import React from "react";
import { Layers, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { formatCOP } from "@/config/plans";

export interface PlanDistributionItem {
  id: string;
  name: string;
  count: number;
  percentage: number;
  monthlyPrice: number;
  color: string;
  badgeClass?: string;
}

interface AdminPlanDistributionProps {
  distribution?: PlanDistributionItem[];
  conversionRate?: number;
}

const DEFAULT_PLANS: PlanDistributionItem[] = [
  {
    id: "inicio",
    name: "Plan Inicio",
    count: 0,
    percentage: 0,
    monthlyPrice: 29900,
    color: "bg-blue-500",
  },
  {
    id: "crece",
    name: "Plan Crece",
    count: 0,
    percentage: 0,
    monthlyPrice: 59900,
    color: "bg-[#ED500A]",
  },
  {
    id: "negocio",
    name: "Plan Negocio",
    count: 0,
    percentage: 0,
    monthlyPrice: 99900,
    color: "bg-emerald-500",
  },
];

export function AdminPlanDistribution({
  distribution = DEFAULT_PLANS,
  conversionRate = 0,
}: AdminPlanDistributionProps) {
  const plans = distribution && distribution.length > 0 ? distribution : DEFAULT_PLANS;
  const totalSubscribers = plans.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] p-5 sm:p-6 shadow-xs space-y-5 flex flex-col justify-between">
      <div className="space-y-3">
        {/* Cabecera */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
              Monetización
            </span>
            <h3 className="text-base sm:text-lg font-bold font-title text-slate-900 dark:text-white">
              Distribución de Planes
            </h3>
          </div>

          <Link
            href="/admin/planes"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            title="Ver catálogo de planes"
          >
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Barra de Distribución Proporcional */}
        <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden flex">
          {totalSubscribers === 0 ? (
            <div className="bg-slate-300 dark:bg-white/10 h-full w-full" />
          ) : (
            plans.map((plan) => (
              <div
                key={plan.id}
                className={`${plan.color} h-full transition-all duration-500`}
                style={{ width: `${plan.percentage}%` }}
                title={`${plan.name}: ${plan.percentage}% (${plan.count} tenants)`}
              />
            ))
          )}
        </div>
      </div>

      {/* Lista de Planes con Métricas Reales */}
      <div className="space-y-3">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.04] flex items-center justify-between gap-3"
          >
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${plan.color}`} />
                <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                  {plan.name}
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                {formatCOP(plan.monthlyPrice)} / mes
              </span>
            </div>

            <div className="text-right shrink-0">
              <span className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                {plan.percentage}%
              </span>
              <p className="text-[10px] text-slate-400 font-mono">
                {plan.count} {plan.count === 1 ? "suscripción" : "suscripciones"}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer info */}
      <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
        <span>Suscripciones Activas</span>
        <span className="font-bold text-emerald-600 dark:text-emerald-400">
          {totalSubscribers} contratos
        </span>
      </div>
    </div>
  );
}
