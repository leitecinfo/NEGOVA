"use client";

import React, { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, Users, DollarSign } from "lucide-react";
import { useAdminTheme } from "../admin-theme-context";
import { formatCOP } from "@/config/plans";

export interface MonthlyTrendData {
  month: string;
  tenants: number;
  mrr: number;
  activeUsers: number;
}

interface AdminGrowthChartProps {
  monthlyData?: MonthlyTrendData[];
  currentMrr?: number;
}

export function AdminGrowthChart({ monthlyData, currentMrr = 0 }: AdminGrowthChartProps) {
  const [metric, setMetric] = useState<"tenants" | "mrr" | "activeUsers">("tenants");
  const [isMounted, setIsMounted] = useState(false);
  const { theme } = useAdminTheme();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const data = monthlyData && monthlyData.length > 0 ? monthlyData : [
    { month: "Mes Actual", tenants: 0, mrr: currentMrr, activeUsers: 0 }
  ];

  const metricConfig = {
    tenants: {
      label: "Tenants / Negocios",
      unit: "negocios",
      stroke: "#ED500A",
      fill: "url(#colorTenants)",
      formatter: (val: number) => `${val} negocios`,
      icon: TrendingUp,
      colorClass: "text-[#ED500A]",
    },
    mrr: {
      label: "MRR Recurrente",
      unit: "COP",
      stroke: "#10B981",
      fill: "url(#colorMrr)",
      formatter: (val: number) => formatCOP(val),
      icon: DollarSign,
      colorClass: "text-emerald-500",
    },
    activeUsers: {
      label: "Usuarios Activos",
      unit: "usuarios",
      stroke: "#3B82F6",
      fill: "url(#colorUsers)",
      formatter: (val: number) => `${val} cuentas`,
      icon: Users,
      colorClass: "text-blue-500",
    },
  };

  const activeConf = metricConfig[metric];

  if (!isMounted) {
    return (
      <div className="h-72 w-full rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] p-6 animate-pulse flex items-center justify-center">
        <span className="text-xs text-slate-400 font-mono">Cargando visualización interactiva...</span>
      </div>
    );
  }

  const gridColor = theme === "dark" ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)";
  const textColor = theme === "dark" ? "#64748B" : "#94A3B8";

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] p-5 sm:p-6 shadow-xs space-y-4">
      {/* Cabecera del Gráfico con Controles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
              Analítica de Plataforma
            </span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-orange-50 dark:bg-[#ED500A]/10 text-[#ED500A] border border-orange-200 dark:border-[#ED500A]/20 font-semibold">
              Métricas Reales
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-bold font-title text-slate-900 dark:text-white">
            Evolución y Crecimiento del Ecosistema
          </h3>
        </div>

        {/* Selector de métricas */}
        <div className="inline-flex p-1 bg-slate-100 dark:bg-white/[0.04] rounded-xl border border-slate-200 dark:border-white/[0.08] shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMetric("tenants")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              metric === "tenants"
                ? "bg-white dark:bg-white/[0.1] text-[#ED500A] shadow-xs font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Tenants
          </button>
          <button
            type="button"
            onClick={() => setMetric("mrr")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              metric === "mrr"
                ? "bg-white dark:bg-white/[0.1] text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            MRR
          </button>
          <button
            type="button"
            onClick={() => setMetric("activeUsers")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              metric === "activeUsers"
                ? "bg-white dark:bg-white/[0.1] text-blue-600 dark:text-blue-400 shadow-xs font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Usuarios
          </button>
        </div>
      </div>

      {/* Gráfico Recharts */}
      <div className="h-64 sm:h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorTenants" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ED500A" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#ED500A" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />

            <XAxis
              dataKey="month"
              stroke={textColor}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              dy={5}
            />

            <YAxis
              stroke={textColor}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) =>
                metric === "mrr"
                  ? val >= 1000000
                    ? `$${(val / 1000000).toFixed(1)}M`
                    : val >= 1000
                    ? `$${(val / 1000).toFixed(0)}k`
                    : `$${val}`
                  : `${val}`
              }
            />

            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-xl bg-slate-900 text-white dark:bg-[#131722] dark:text-white p-3 border border-slate-700 dark:border-[#1E2333] shadow-xl text-xs space-y-1">
                      <p className="font-mono text-slate-400 font-semibold">{label}</p>
                      <p className="font-title font-bold text-sm">
                        {activeConf.formatter(payload[0].value as number)}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />

            <Area
              type="monotone"
              dataKey={metric}
              stroke={activeConf.stroke}
              strokeWidth={2.5}
              fill={activeConf.fill}
              dot={{ r: 3, fill: activeConf.stroke }}
              activeDot={{ r: 6, fill: activeConf.stroke, strokeWidth: 2, stroke: "#fff" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
