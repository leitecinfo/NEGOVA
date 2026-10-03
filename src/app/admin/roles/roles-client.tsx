"use client";

import React, { useState, useMemo } from "react";
import {
  Shield,
  Key,
  Users,
  Building2,
  Lock,
  Server,
  Store,
  Grid,
  List as ListIcon,
  ChevronRight,
  Eye,
} from "lucide-react";
import Link from "next/link";
import { RoleModel, RoleScope, RoleType } from "@/lib/auth/permissions";
import {
  AdminKpiCard,
  AdminKpiGrid,
  AdminTableToolbar,
  AdminTabs,
  AdminSelect,
  AdminEmptyState,
  AdminBadge,
  AdminButton,
  AdminIconButton,
} from "@/components/admin/ui";

interface RolesClientProps {
  initialRoles: RoleModel[];
  currentUserRole?: string;
}

export function RolesClient({
  initialRoles,
  currentUserRole = "super_admin",
}: RolesClientProps) {
  const [roles] = useState<RoleModel[]>(initialRoles);
  const [selectedScope, setSelectedScope] = useState<"all" | RoleScope>("all");
  const [selectedType, setSelectedType] = useState<"all" | RoleType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Conteo estadístico
  const stats = useMemo(() => {
    const total = roles.length;
    const platform = roles.filter((r) => r.scope === "platform").length;
    const business = roles.filter((r) => r.scope === "business").length;
    const system = roles.filter((r) => r.type === "system").length;
    const custom = roles.filter((r) => r.type === "custom").length;
    return { total, platform, business, system, custom };
  }, [roles]);

  // Filtrado reactivo
  const filteredRoles = useMemo(() => {
    return roles.filter((role) => {
      // Filtro por Ámbito
      if (selectedScope !== "all" && role.scope !== selectedScope) {
        return false;
      }
      // Filtro por Tipo
      if (selectedType !== "all" && role.type !== selectedType) {
        return false;
      }
      // Filtro por Búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = role.name.toLowerCase().includes(q);
        const matchesCode = role.code.toLowerCase().includes(q);
        const matchesDesc = role.description.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesDesc) {
          return false;
        }
      }
      return true;
    });
  }, [roles, selectedScope, selectedType, searchQuery]);

  return (
    <div className="space-y-6 font-body">
      {/* 1. TARJETAS DE MÉTRICAS (KPIS) */}
      <AdminKpiGrid cols={4}>
        <AdminKpiCard
          title="Total Roles"
          value={stats.total}
          subtext={`${stats.system} Sistema · ${stats.custom} Personalizados`}
          icon={<Shield className="w-4 h-4" />}
          variant="default"
          isSelected={selectedScope === "all" && selectedType === "all"}
          onClick={() => {
            setSelectedScope("all");
            setSelectedType("all");
          }}
        />

        <AdminKpiCard
          title="Ámbito Plataforma"
          value={stats.platform}
          subtext="Personal Interno NEGOVA Core"
          icon={<Server className="w-4 h-4" />}
          variant="orange"
          isSelected={selectedScope === "platform"}
          onClick={() => setSelectedScope("platform")}
        />

        <AdminKpiCard
          title="Ámbito Negocios"
          value={stats.business}
          subtext="Tenants y Comercios"
          icon={<Store className="w-4 h-4" />}
          variant="emerald"
          isSelected={selectedScope === "business"}
          onClick={() => setSelectedScope("business")}
        />

        <AdminKpiCard
          title="Protección RBAC"
          value="100%"
          subtext="Aislamiento Multi-Tenant Activo"
          icon={<Lock className="w-4 h-4" />}
          variant="blue"
        />
      </AdminKpiGrid>

      {/* 2. BARRA DE HERRAMIENTAS: BÚSQUEDA, TABS, SELECTS Y VISTAS */}
      <AdminTableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Buscar rol por nombre, código o descripción..."
        tabs={
          <AdminTabs
            activeTab={selectedScope}
            onChange={(val) => setSelectedScope(val as "all" | RoleScope)}
            tabs={[
              { id: "all", label: "Todos", count: stats.total },
              { id: "platform", label: "Plataforma", count: stats.platform, icon: <Server className="w-3.5 h-3.5" /> },
              { id: "business", label: "Negocio", count: stats.business, icon: <Store className="w-3.5 h-3.5" /> },
            ]}
          />
        }
        filters={
          <>
            <AdminSelect
              value={selectedType}
              onChange={(val) => setSelectedType(val as "all" | RoleType)}
              options={[
                { value: "all", label: "Todos los tipos" },
                { value: "system", label: "Sistema" },
                { value: "custom", label: "Personalizados" },
              ]}
            />
          </>
        }
        actions={
          <div className="hidden sm:flex items-center p-1 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "grid"
                  ? "bg-white dark:bg-[#0D0E12] text-[#ED500A] shadow-2xs"
                  : "text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
              title="Vista de cuadrícula"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-white dark:bg-[#0D0E12] text-[#ED500A] shadow-2xs"
                  : "text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
              title="Vista de tabla"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {/* 3. LISTADO DE ROLES (GRID O TABLA) */}
      {filteredRoles.length === 0 ? (
        <AdminEmptyState
          icon={Shield}
          title="No se encontraron roles"
          description="No hay roles que coincidan con los criterios de búsqueda o filtros seleccionados."
          onReset={() => {
            setSearchQuery("");
            setSelectedScope("all");
            setSelectedType("all");
          }}
          resetLabel="Restablecer Filtros"
        />
      ) : viewMode === "grid" ? (
        /* VISTA GRID DE TARJETAS */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRoles.map((role) => {
            const isPlatform = role.scope === "platform";

            return (
              <div
                key={role.code}
                className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 shadow-xs hover:border-[#ED500A]/40 transition-all flex flex-col justify-between space-y-5 relative group"
              >
                <div className="space-y-3.5">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AdminBadge variant={isPlatform ? "orange" : "emerald"} size="sm">
                        {isPlatform ? "Plataforma" : "Negocio"}
                      </AdminBadge>

                      {role.type === "system" && (
                        <AdminBadge variant="slate" size="sm" icon={<Lock className="w-2.5 h-2.5" />}>
                          Sistema
                        </AdminBadge>
                      )}
                    </div>

                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-50 dark:bg-white/[0.02] text-slate-400 font-medium">
                      {role.status === "active" ? "Activo" : "Inactivo"}
                    </span>
                  </div>

                  {/* Título y Código */}
                  <div>
                    <h3 className="text-base font-bold font-title text-slate-900 dark:text-white group-hover:text-[#ED500A] transition-colors">
                      {role.name}
                    </h3>
                    <span className="text-xs font-mono text-slate-400 block mt-0.5">
                      code: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{role.code}</strong>
                    </span>
                  </div>

                  {/* Descripción */}
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed min-h-[3.5rem]">
                    {role.description}
                  </p>
                </div>

                {/* Footer de Tarjeta con métricas y botón */}
                <div className="pt-4 border-t border-slate-100 dark:border-white/[0.06] space-y-3.5">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        <strong className="text-slate-900 dark:text-white font-semibold">
                          {role.userCount || 0}
                        </strong>{" "}
                        usuarios
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        <strong className="text-slate-900 dark:text-white font-semibold">
                          {role.permissionCount || role.permissions?.length || 0}
                        </strong>{" "}
                        permisos
                      </span>
                    </div>
                  </div>

                  <AdminButton
                    href={`/admin/roles/${role.id || role.code}`}
                    variant="outline"
                    size="md"
                    className="w-full justify-between"
                    rightIcon={<ChevronRight className="w-4 h-4" />}
                  >
                    Ver matriz y permisos
                  </AdminButton>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VISTA TABLA */
        <div className="rounded-2xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
              <thead className="bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/10 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                <tr>
                  <th className="py-3.5 px-4">Nombre del Rol</th>
                  <th className="py-3.5 px-4">Código</th>
                  <th className="py-3.5 px-4">Ámbito</th>
                  <th className="py-3.5 px-4">Tipo</th>
                  <th className="py-3.5 px-4">Usuarios</th>
                  <th className="py-3.5 px-4">Permisos</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {filteredRoles.map((role) => {
                  const isPlatform = role.scope === "platform";

                  return (
                    <tr
                      key={role.code}
                      className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/admin/roles/${role.id || role.code}`}
                          className="font-bold text-slate-900 dark:text-white block font-title hover:text-[#ED500A] transition-colors"
                        >
                          {role.name}
                        </Link>
                        <span className="text-[11px] text-slate-400 line-clamp-1 font-body">
                          {role.description}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300 font-semibold">
                        {role.code}
                      </td>
                      <td className="py-3.5 px-4">
                        <AdminBadge variant={isPlatform ? "orange" : "emerald"} size="sm">
                          {isPlatform ? "Plataforma" : "Negocio"}
                        </AdminBadge>
                      </td>
                      <td className="py-3.5 px-4">
                        <AdminBadge variant="slate" size="sm">
                          {role.type === "system" ? "Sistema" : "Personalizado"}
                        </AdminBadge>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                        {role.userCount || 0}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                        {role.permissionCount || role.permissions?.length || 0}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <Link
                          href={`/admin/roles/${role.id || role.code}`}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors inline-flex items-center"
                          title="Ver matriz de permisos"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

