"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Receipt, Users, Award, Boxes, TrendingDown, Flame, Bike, FileSpreadsheet } from "lucide-react";

interface ReportNavTabsProps {
  businessId: string;
}

export function ReportNavTabs({ businessId }: ReportNavTabsProps) {
  const pathname = usePathname() || "";

  const tabs = [
    {
      id: "dashboard",
      label: "Dashboard de Ventas",
      icon: BarChart3,
      href: `/workspace/${businessId}/dashboard`,
      active: pathname.endsWith("/dashboard"),
    },
    {
      id: "ventas",
      label: "Reporte de Ventas",
      icon: Receipt,
      href: `/workspace/${businessId}/reportes/ventas`,
      active: pathname.includes("/reportes/ventas"),
    },
    {
      id: "empleados",
      label: "Reporte de Empleados",
      icon: Users,
      href: `/workspace/${businessId}/reportes/empleados`,
      active: pathname.includes("/reportes/empleados"),
    },
    {
      id: "inventario",
      label: "Reporte de Inventario",
      icon: Boxes,
      href: `/workspace/${businessId}/reportes/inventario`,
      active: pathname.includes("/reportes/inventario"),
    },
    {
      id: "gastos",
      label: "Gastos y Compras",
      icon: TrendingDown,
      href: `/workspace/${businessId}/reportes/gastos`,
      active: pathname.includes("/reportes/gastos"),
    },
    {
      id: "horas-pico",
      label: "Horas Pico",
      icon: Flame,
      href: `/workspace/${businessId}/reportes/horas-pico`,
      active: pathname.includes("/reportes/horas-pico"),
    },
    {
      id: "domicilios",
      label: "Domicilios",
      icon: Bike,
      href: `/workspace/${businessId}/reportes/domicilios`,
      active: pathname.includes("/reportes/domicilios"),
    },
    {
      id: "recetas",
      label: "Recetas y Costos",
      icon: FileSpreadsheet,
      href: `/workspace/${businessId}/reportes/recetas`,
      active: pathname.includes("/reportes/recetas"),
    },
  ];

  return (
    <nav className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-white/[0.04] rounded-xl border border-slate-200 dark:border-white/[0.06] overflow-x-auto no-scrollbar">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              tab.active
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-semibold border border-slate-200/60 dark:border-white/[0.08]"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/[0.02]"
            }`}
          >
            <Icon className={`w-4 h-4 ${tab.active ? "text-[#ED500A]" : "opacity-70"}`} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

