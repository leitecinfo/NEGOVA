"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Building2,
  Search,
  ExternalLink,
  ChevronRight,
  Utensils,
  ShoppingBag,
  Store,
  Briefcase,
  Layers,
  ArrowUpRight,
} from "lucide-react";

export interface TenantRecord {
  id: string;
  name: string;
  slug: string;
  business_type?: string;
  email?: string | null;
  status: "active" | "trial" | "suspended" | "inactive" | string;
  created_at: string;
  city?: string | null;
}

interface AdminTenantsTableProps {
  initialTenants: TenantRecord[];
}

export function AdminTenantsTable({ initialTenants }: AdminTenantsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredTenants = useMemo(() => {
    return initialTenants.filter((tenant) => {
      const matchesSearch =
        tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenant.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tenant.email && tenant.email.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = statusFilter === "all" || tenant.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [initialTenants, searchTerm, statusFilter]);

  const getBusinessTypeIcon = (type?: string) => {
    switch (type) {
      case "restaurant":
      case "gastronomicos":
        return Utensils;
      case "retail":
      case "comercio":
        return ShoppingBag;
      case "market":
      case "mercados":
        return Store;
      default:
        return Briefcase;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Activo
          </span>
        );
      case "trial":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Prueba (Trial)
          </span>
        );
      case "suspended":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Suspendido
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-white/[0.06] dark:text-slate-400 dark:border-white/[0.08]">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs overflow-hidden space-y-4 p-5 sm:p-6">
      {/* Cabecera & Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold font-title text-slate-900 dark:text-white">
              Tenants y Negocios Recientes
            </h3>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400">
              {filteredTenants.length} registros
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-body">
            Supervisión directa de las instancias registradas en el ecosistema.
          </p>
        </div>

        {/* Herramientas de búsqueda y filtro */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o slug..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="trial">En Prueba</option>
            <option value="suspended">Suspendidos</option>
          </select>

          <Link
            href="/admin/negocios"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#ED500A] bg-orange-50 dark:bg-[#ED500A]/10 hover:bg-orange-100 dark:hover:bg-[#ED500A]/20 transition-colors"
          >
            <span>Ver todos</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Tabla Responsiva */}
      <div className="overflow-x-auto -mx-5 sm:-mx-6">
        <table className="w-full text-left border-collapse min-w-[640px]">
          <thead>
            <tr className="border-y border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02] text-[11px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-5 sm:px-6">Negocio / Tenant</th>
              <th className="py-3 px-4">Slug / Identificador</th>
              <th className="py-3 px-4">Contacto</th>
              <th className="py-3 px-4">Estado</th>
              <th className="py-3 px-4">Fecha Alta</th>
              <th className="py-3 px-5 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] text-xs">
            {filteredTenants.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400 font-body">
                  No hay negocios que coincidan con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              filteredTenants.map((tenant) => {
                const CategoryIcon = getBusinessTypeIcon(tenant.business_type);
                const formattedDate = new Date(tenant.created_at).toLocaleDateString("es-CO", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                });

                return (
                  <tr
                    key={tenant.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Negocio */}
                    <td className="py-3.5 px-5 sm:px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-white/[0.06] border border-orange-200/60 dark:border-white/[0.08] flex items-center justify-center text-[#ED500A] shrink-0 shadow-2xs">
                          <CategoryIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white font-title truncate">
                            {tenant.name}
                          </p>
                          <span className="text-[10px] text-slate-400 capitalize">
                            {tenant.business_type || "Comercio"} {tenant.city ? `• ${tenant.city}` : ""}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Slug */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400">negova.app/</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {tenant.slug}
                      </span>
                    </td>

                    {/* Contacto */}
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 truncate max-w-[160px]">
                      {tenant.email || "—"}
                    </td>

                    {/* Estado */}
                    <td className="py-3.5 px-4">{getStatusBadge(tenant.status)}</td>

                    {/* Fecha */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {formattedDate}
                    </td>

                    {/* Acciones */}
                    <td className="py-3.5 px-5 text-right">
                      <Link
                        href={`/admin/negocios?id=${tenant.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-[#ED500A] dark:text-slate-400 dark:hover:text-white transition-colors"
                      >
                        <span>Gestionar</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
