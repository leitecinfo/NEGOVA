"use client";

import React from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  CreditCard,
  Settings,
  ShieldCheck,
  PlusCircle,
  Download,
  FileSpreadsheet,
} from "lucide-react";

export function AdminQuickActions() {
  const actions = [
    {
      title: "Registrar Tenant",
      description: "Alta manual de negocio",
      href: "/admin/negocios?action=new",
      icon: Building2,
      color: "text-[#ED500A] bg-orange-50 dark:bg-[#ED500A]/10 border-orange-200/60 dark:border-[#ED500A]/20",
    },
    {
      title: "Gestionar Usuarios",
      description: "Permisos y roles de plataforma",
      href: "/admin/usuarios",
      icon: Users,
      color: "text-blue-600 bg-blue-50 dark:bg-blue-500/10 border-blue-200/60 dark:border-blue-500/20",
    },
    {
      title: "Ajustar Planes",
      description: "Precios y cuotas de uso",
      href: "/admin/planes",
      icon: CreditCard,
      color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200/60 dark:border-emerald-500/20",
    },
    {
      title: "Variables Globales",
      description: "Configuración de pasarelas",
      href: "/admin/configuracion",
      icon: Settings,
      color: "text-purple-600 bg-purple-50 dark:bg-purple-500/10 border-purple-200/60 dark:border-purple-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {actions.map((act) => {
        const Icon = act.icon;
        return (
          <Link
            key={act.title}
            href={act.href}
            className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] hover:border-[#ED500A]/40 dark:hover:border-[#ED500A]/40 transition-all flex items-center gap-3.5 shadow-xs group"
          >
            <div className={`p-2.5 rounded-xl border ${act.color} shrink-0 group-hover:scale-105 transition-transform`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-slate-800 dark:text-white group-hover:text-[#ED500A] transition-colors truncate font-title">
                {act.title}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {act.description}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
