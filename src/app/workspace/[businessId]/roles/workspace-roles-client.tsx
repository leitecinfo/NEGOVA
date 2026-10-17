"use client";

import React, { useState, useMemo } from "react";
import {
  ShieldCheck,
  Shield,
  Users,
  Store,
  Lock,
  Search,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Sparkles,
  Layers,
  Receipt,
  ShoppingCart,
  Package,
  UserCheck,
  Coins,
  Settings,
  BarChart3,
  FileText,
} from "lucide-react";
import {
  RoleModel,
  PermissionModuleGroup,
  getPermissionModulesForBusinessType,
  isGastronomyBusinessType,
} from "@/lib/auth/permissions";
import {
  AdminKpiCard,
  AdminKpiGrid,
  AdminTableToolbar,
  AdminTabs,
  AdminSearchInput,
  AdminBadge,
  AdminEmptyState,
} from "@/components/admin/ui";

interface WorkspaceRolesClientProps {
  initialRoles: RoleModel[];
  businessId: string;
  businessType?: string;
}

// Iconos contextuales para los módulos del comercio
const MODULE_ICONS: Record<string, React.ReactNode> = {
  ventas: <Receipt className="w-4 h-4 text-[#ED500A]" />,
  pedidos: <ShoppingCart className="w-4 h-4 text-amber-500" />,
  productos: <Package className="w-4 h-4 text-emerald-500" />,
  clientes: <Users className="w-4 h-4 text-blue-500" />,
  inventario: <Layers className="w-4 h-4 text-indigo-500" />,
  gastos: <Coins className="w-4 h-4 text-rose-500" />,
  empleados: <UserCheck className="w-4 h-4 text-teal-500" />,
  configuracion_negocio: <Settings className="w-4 h-4 text-purple-500" />,
  reportes: <BarChart3 className="w-4 h-4 text-sky-500" />,
};

export function WorkspaceRolesClient({
  initialRoles,
  businessId,
  businessType = "restaurant",
}: WorkspaceRolesClientProps) {
  const [roles] = useState<RoleModel[]>(initialRoles);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<"all" | "owner" | "auxiliar">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Módulos de permisos filtrados y compatibles con el tipo de negocio del comercio
  const businessModules = useMemo(() => {
    return getPermissionModulesForBusinessType(businessType, "business");
  }, [businessType]);

  // Filtrado de roles
  const filteredRoles = useMemo(() => {
    return roles.filter((role) => {
      if (selectedRoleFilter !== "all" && role.code !== selectedRoleFilter) {
        return false;
      }
      return true;
    });
  }, [roles, selectedRoleFilter]);

  // Filtrado de permisos dentro de cada módulo según búsqueda
  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return businessModules;
    const q = searchQuery.toLowerCase().trim();

    return businessModules
      .map((mod) => {
        const matchingPerms = mod.permissions.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q)
        );

        const moduleMatches =
          mod.moduleName.toLowerCase().includes(q) ||
          mod.description.toLowerCase().includes(q);

        if (moduleMatches) return mod;
        if (matchingPerms.length > 0) {
          return {
            ...mod,
            permissions: matchingPerms,
          };
        }
        return null;
      })
      .filter(Boolean) as PermissionModuleGroup[];
  }, [businessModules, searchQuery]);

  const ownerRole = roles.find((r) => r.code === "owner");
  const auxiliarRole = roles.find((r) => r.code === "auxiliar");
  const isGastronomy = isGastronomyBusinessType(businessType);

  return (
    <div className="space-y-6 font-body">
      {/* 1. TARJETAS DE MÉTRICAS (KPIS) */}
      <AdminKpiGrid cols={4}>
        <AdminKpiCard
          title="Roles de Negocio"
          value={roles.length}
          subtext={isGastronomy ? "Vertical Gastronómico / Restaurante" : `Vertical: ${businessType}`}
          icon={<Shield className="w-4 h-4" />}
          variant="default"
          isSelected={selectedRoleFilter === "all"}
          onClick={() => setSelectedRoleFilter("all")}
        />

        <AdminKpiCard
          title="Dueño / Propietario"
          value={ownerRole?.userCount || 0}
          subtext="Máxima Autoridad Comercial"
          icon={<Sparkles className="w-4 h-4" />}
          variant="orange"
          isSelected={selectedRoleFilter === "owner"}
          onClick={() => setSelectedRoleFilter("owner")}
        />

        <AdminKpiCard
          title="Auxiliar / Ayudante"
          value={auxiliarRole?.userCount || 0}
          subtext="Operación y Punto de Venta"
          icon={<Users className="w-4 h-4" />}
          variant="blue"
          isSelected={selectedRoleFilter === "auxiliar"}
          onClick={() => setSelectedRoleFilter("auxiliar")}
        />

        <AdminKpiCard
          title="Aislamiento Seguro"
          value="100%"
          subtext="Validación de Vertical Activa"
          icon={<Lock className="w-4 h-4" />}
          variant="emerald"
        />
      </AdminKpiGrid>

      {/* 2. BARRA DE HERRAMIENTAS: TABS Y BÚSQUEDA */}
      <AdminTableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Buscar permiso o capacidad operativa..."
        tabs={
          <AdminTabs
            activeTab={selectedRoleFilter}
            onChange={(val) => setSelectedRoleFilter(val as "all" | "owner" | "auxiliar")}
            tabs={[
              { id: "all", label: "Todos los Roles", count: roles.length },
              { id: "owner", label: "Dueño / Propietario", count: ownerRole?.userCount || 0 },
              { id: "auxiliar", label: "Auxiliar / Ayudante", count: auxiliarRole?.userCount || 0 },
            ]}
          />
        }
      />

      {/* 3. LISTADO DE ROLES Y MATRIZ DE CAPACIDADES */}
      {filteredRoles.length === 0 ? (
        <AdminEmptyState
          title="No se encontraron roles"
          description="No hay roles disponibles que coincidan con los filtros seleccionados."
          icon={Shield}
        />
      ) : (
        <div className="space-y-8">
          {filteredRoles.map((role) => {
            const isOwner = role.code === "owner";

            return (
              <div
                key={role.code}
                className="bg-white dark:bg-[#0D0F16] rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-sm overflow-hidden transition-all duration-200"
              >
                {/* Cabecera del Rol */}
                <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                          isOwner
                            ? "bg-orange-500/10 text-[#ED500A] border-orange-500/20"
                            : "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400"
                        }`}
                      >
                        {isOwner ? <Sparkles className="w-6 h-6" /> : <Users className="w-6 h-6" />}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-bold font-title text-slate-900 dark:text-white">
                            {role.name}
                          </h3>
                          <AdminBadge variant={isOwner ? "orange" : "blue"}>
                            {role.code}
                          </AdminBadge>
                          <AdminBadge variant="slate">Rol del Sistema</AdminBadge>
                          <AdminBadge variant="emerald">
                            {role.userCount} {role.userCount === 1 ? "usuario asignado" : "usuarios asignados"}
                          </AdminBadge>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
                          {role.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Matriz de Permisos por Módulo */}
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span>Matriz de Capacidades Operativas ({role.permissions?.length || 0} permisos autorizados)</span>
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredModules.map((mod) => {
                      const moduleIcon = MODULE_ICONS[mod.moduleId] || <Layers className="w-4 h-4 text-slate-400" />;

                      // Conteo de permisos activos para este rol en este módulo
                      const totalInMod = mod.permissions.length;
                      const activeInMod = mod.permissions.filter((p) =>
                        role.permissions?.includes(p.code)
                      ).length;

                      const allActive = activeInMod === totalInMod && totalInMod > 0;
                      const noneActive = activeInMod === 0;

                      return (
                        <div
                          key={mod.moduleId}
                          className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/40 dark:bg-white/[0.01] p-4 flex flex-col justify-between hover:border-slate-300 dark:hover:border-white/20 transition-all"
                        >
                          {/* Header del Módulo */}
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="p-1.5 rounded-lg bg-white dark:bg-[#141824] border border-slate-200/60 dark:border-white/5 shrink-0">
                                  {moduleIcon}
                                </div>
                                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {mod.moduleName}
                                </span>
                              </div>

                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold shrink-0 border ${
                                  allActive
                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
                                    : noneActive
                                    ? "bg-slate-100 text-slate-400 border-slate-200 dark:bg-white/5 dark:border-white/10"
                                    : "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400"
                                }`}
                              >
                                {activeInMod}/{totalInMod}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-400 line-clamp-1 mb-3">
                              {mod.description}
                            </p>

                            {/* Lista de Permisos */}
                            <div className="space-y-2 pt-2 border-t border-slate-200/50 dark:border-white/5">
                              {mod.permissions.map((perm) => {
                                const isAllowed = role.permissions?.includes(perm.code);
                                const isOwnerOnly = perm.minRoleLevel === "owner";

                                return (
                                  <div
                                    key={perm.code}
                                    className="flex items-start justify-between gap-2 text-xs"
                                  >
                                    <div className="flex items-start gap-1.5 min-w-0">
                                      {isAllowed ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                      ) : (
                                        <XCircle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0 mt-0.5" />
                                      )}
                                      <div className="min-w-0">
                                        <p
                                          className={`text-xs font-medium leading-tight ${
                                            isAllowed
                                              ? "text-slate-800 dark:text-slate-200"
                                              : "text-slate-400 dark:text-slate-500 line-through"
                                          }`}
                                        >
                                          {perm.name}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                      {isOwnerOnly && !isOwner && (
                                        <span className="text-[9px] font-medium text-amber-600/80 dark:text-amber-400/80 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                          Solo Dueño
                                        </span>
                                      )}
                                      <span
                                        className={`text-[9px] font-mono font-bold uppercase tracking-wider shrink-0 ${
                                          isAllowed
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : "text-slate-400 dark:text-slate-600"
                                        }`}
                                      >
                                        {isAllowed ? "Permitido" : "Denegado"}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
