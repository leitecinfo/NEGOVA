"use client";

import React, { useState, useMemo, useTransition } from "react";
import {
  ShieldCheck,
  Shield,
  Key,
  Users,
  Building2,
  Lock,
  Search,
  Check,
  X,
  Info,
  Server,
  Sparkles,
  Sliders,
  Eye,
  CheckCircle2,
  Layers,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Save,
  RotateCcw,
  CheckSquare,
  Square,
  AlertTriangle,
  Store,
  Calendar,
  Clock,
  UserCheck,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  RoleModel,
  ALL_PERMISSION_MODULES,
  PermissionModuleGroup,
} from "@/lib/auth/permissions";
import { updateRolePermissionsAction } from "../actions";
import {
  AdminButton,
  AdminBadge,
  AdminTabs,
  AdminSearchInput,
  AdminEmptyState,
} from "@/components/admin/ui";

interface AssignedUser {
  id: string;
  email: string;
  fullName?: string;
  status: string;
  joinedAt?: string;
}

interface RoleDetailClientProps {
  role: RoleModel;
  assignedUsers: AssignedUser[];
  currentUserRole?: string;
}

export function RoleDetailClient({
  role,
  assignedUsers,
  currentUserRole = "super_admin",
}: RoleDetailClientProps) {
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
    role.permissions || []
  );
  const [initialPermissions] = useState<string[]>(role.permissions || []);
  const [activeTab, setActiveTab] = useState<"permissions" | "users" | "info">(
    "permissions"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>(() => {
    // Expandir todos los módulos por defecto
    const map: Record<string, boolean> = {};
    ALL_PERMISSION_MODULES.forEach((m) => {
      map[m.moduleId] = true;
    });
    return map;
  });

  const [isPending, startTransition] = useTransition();

  // Módulos aplicables según el ámbito del rol (Plataforma vs Negocio)
  const applicableModules = useMemo(() => {
    return ALL_PERMISSION_MODULES.filter((m) => m.scope === role.scope);
  }, [role.scope]);

  // Filtrado de módulos según búsqueda
  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return applicableModules;
    const q = searchQuery.toLowerCase().trim();
    return applicableModules
      .map((moduleGroup) => {
        const matchingPermissions = moduleGroup.permissions.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q)
        );
        const moduleMatches =
          moduleGroup.moduleName.toLowerCase().includes(q) ||
          moduleGroup.description.toLowerCase().includes(q);

        if (moduleMatches) {
          return moduleGroup;
        }
        if (matchingPermissions.length > 0) {
          return {
            ...moduleGroup,
            permissions: matchingPermissions,
          };
        }
        return null;
      })
      .filter(Boolean) as PermissionModuleGroup[];
  }, [applicableModules, searchQuery]);

  // Detección de cambios sin guardar
  const hasUnsavedChanges = useMemo(() => {
    if (selectedPermissions.length !== initialPermissions.length) return true;
    const sortedSelected = [...selectedPermissions].sort();
    const sortedInitial = [...initialPermissions].sort();
    return sortedSelected.some((val, idx) => val !== sortedInitial[idx]);
  }, [selectedPermissions, initialPermissions]);

  // Toggle de permiso individual
  const togglePermission = (code: string) => {
    // Si es super_admin y se intenta retirar un permiso crítico, advertir
    if (
      role.code === "super_admin" &&
      ["roles.view", "roles.manage", "platform_settings.view", "platform_settings.update"].includes(
        code
      ) &&
      selectedPermissions.includes(code)
    ) {
      toast.warning("Permiso crítico protegido", {
        description: `El permiso '${code}' no puede ser retirado del Super Administrador para garantizar la gobernanza del sistema.`,
      });
      return;
    }

    setSelectedPermissions((prev) =>
      prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code]
    );
  };

  // Toggle masivo de todos los permisos de un módulo
  const toggleAllInModule = (moduleGroup: PermissionModuleGroup) => {
    const moduleCodes = moduleGroup.permissions.map((p) => p.code);
    const allSelected = moduleCodes.every((c) => selectedPermissions.includes(c));

    if (allSelected) {
      // Desmarcar todos excepto los críticos si es super_admin
      setSelectedPermissions((prev) =>
        prev.filter((c) => {
          if (!moduleCodes.includes(c)) return true;
          if (
            role.code === "super_admin" &&
            ["roles.view", "roles.manage", "platform_settings.view", "platform_settings.update"].includes(
              c
            )
          ) {
            return true;
          }
          return false;
        })
      );
    } else {
      // Marcar todos
      setSelectedPermissions((prev) => {
        const next = new Set([...prev, ...moduleCodes]);
        return Array.from(next);
      });
    }
  };

  // Toggle colapsar/expandir módulo
  const toggleAccordion = (moduleId: string) => {
    setExpandedModules((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }));
  };

  // Guardar cambios
  const handleSaveChanges = () => {
    startTransition(async () => {
      const res = await updateRolePermissionsAction(role.id || role.code, selectedPermissions);
      if (res.success) {
        toast.success("Permisos actualizados", {
          description: res.message || "La matriz de autorización ha sido guardada en la base de datos.",
        });
      } else {
        toast.error("Error al guardar", {
          description: res.error || "No se pudo actualizar la matriz de permisos.",
        });
      }
    });
  };

  // Descartar cambios
  const handleDiscardChanges = () => {
    setSelectedPermissions(initialPermissions);
    toast.info("Cambios descartados", {
      description: "Se han restaurado los permisos previamente guardados.",
    });
  };

  const isPlatform = role.scope === "platform";

  return (
    <div className="space-y-6 pb-20">
      {/* 1. BARRA DE ACCIÓN Y REGRESO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 shadow-xs">
        <div className="flex items-center gap-3">
          <AdminButton
            href="/admin/roles"
            variant="outline"
            size="sm"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Volver a Roles
          </AdminButton>

          <div className="h-6 w-px bg-slate-200 dark:bg-white/10 hidden sm:block" />

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-slate-400">Código:</span>
            <AdminBadge variant="slate" size="sm">
              {role.code}
            </AdminBadge>
          </div>
        </div>

        {/* Acciones de Guardado */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          {hasUnsavedChanges && (
            <AdminButton
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDiscardChanges}
              disabled={isPending}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Descartar
            </AdminButton>
          )}

          <AdminButton
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSaveChanges}
            disabled={isPending || !hasUnsavedChanges}
            isLoading={isPending}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Guardar Cambios
          </AdminButton>
        </div>
      </div>

      {/* 2. PESTAÑAS DE NAVEGACIÓN DE SECCIÓN */}
      <AdminTabs
        activeTab={activeTab}
        onChange={(tab) => setActiveTab(tab as any)}
        tabs={[
          {
            id: "permissions",
            label: "Matriz de Permisos",
            count: selectedPermissions.length,
            icon: <Key className="w-4 h-4" />,
          },
          {
            id: "users",
            label: "Usuarios Asignados",
            count: assignedUsers.length,
            icon: <Users className="w-4 h-4" />,
          },
          {
            id: "info",
            label: "Información General",
            icon: <Info className="w-4 h-4" />,
          },
        ]}
      />

      {/* 3. CONTENIDO SEGÚN PESTAÑA ACTIVA */}

      {/* --- SECCIÓN A: MATRIZ DE PERMISOS --- */}
      {activeTab === "permissions" && (
        <div className="space-y-6">
          {/* Barra de Búsqueda y Herramientas dentro de Permisos */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 shadow-xs">
            <div className="flex-1">
              <AdminSearchInput
                placeholder="Buscar permiso por acción (ej. users.create, view, cancel)..."
                value={searchQuery}
                onChange={(val) => setSearchQuery(val)}
                onClear={() => setSearchQuery("")}
              />
            </div>

            <div className="flex items-center gap-2 font-mono text-xs text-slate-500 dark:text-slate-400 shrink-0">
              <span className="font-semibold text-[#ED500A]">
                {selectedPermissions.length}
              </span>
              <span>permisos activos en este rol</span>
            </div>
          </div>

          {/* Módulos de Permisos Expandibles */}
          <div className="space-y-4">
            {filteredModules.map((moduleGroup) => {
              const isExpanded = expandedModules[moduleGroup.moduleId] ?? true;
              const moduleCodes = moduleGroup.permissions.map((p) => p.code);
              const activeInModule = moduleCodes.filter((c) =>
                selectedPermissions.includes(c)
              ).length;
              const isAllSelected =
                activeInModule === moduleCodes.length && moduleCodes.length > 0;
              const isPartiallySelected =
                activeInModule > 0 && activeInModule < moduleCodes.length;

              return (
                <div
                  key={moduleGroup.moduleId}
                  className="rounded-2xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 shadow-xs overflow-hidden transition-all"
                >
                  {/* Header del Módulo */}
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-white/[0.01] border-b border-slate-100 dark:border-white/[0.04]">
                    <div
                      onClick={() => toggleAccordion(moduleGroup.moduleId)}
                      className="flex items-start sm:items-center gap-3 cursor-pointer flex-1 select-none"
                    >
                      <button
                        type="button"
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>

                      <div>
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-sm font-bold font-title text-slate-900 dark:text-white">
                            {moduleGroup.moduleName}
                          </h3>
                          <span
                            className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                              activeInModule > 0
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : "bg-slate-100 text-slate-400 dark:bg-white/[0.04]"
                            }`}
                          >
                            {activeInModule} / {moduleCodes.length} activos
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {moduleGroup.description}
                        </p>
                      </div>
                    </div>

                    {/* Botón Acción Masiva de Módulo */}
                    <div className="flex items-center gap-2 self-start sm:self-auto pt-1 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => toggleAllInModule(moduleGroup)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0E12] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-[#ED500A] hover:text-[#ED500A] transition-all cursor-pointer shadow-2xs"
                      >
                        {isAllSelected ? "Desmarcar todos" : "Marcar todos"}
                      </button>
                    </div>
                  </div>

                  {/* Cuerpo del Módulo: Lista de Permisos */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-3 divide-y-0">
                      {moduleGroup.permissions.map((perm) => {
                        const isChecked = selectedPermissions.includes(perm.code);
                        const isCritical =
                          role.code === "super_admin" &&
                          [
                            "roles.view",
                            "roles.manage",
                            "platform_settings.view",
                            "platform_settings.update",
                          ].includes(perm.code);

                        return (
                          <label
                            key={perm.code}
                            className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 cursor-pointer select-none ${
                              isChecked
                                ? "bg-orange-50/40 dark:bg-[#ED500A]/5 border-[#ED500A]/30 text-slate-900 dark:text-white"
                                : "bg-slate-50/50 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/[0.06] text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isCritical}
                              onChange={() => togglePermission(perm.code)}
                              className="w-4 h-4 accent-[#ED500A] mt-0.5 shrink-0 rounded cursor-pointer"
                            />
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-xs text-slate-900 dark:text-white block font-title">
                                  {perm.name}
                                </span>
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200/60 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-medium shrink-0">
                                  {perm.code}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                                {perm.description}
                              </p>
                              {isCritical && (
                                <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 flex items-center gap-1 font-semibold pt-0.5">
                                  <Lock className="w-2.5 h-2.5" />
                                  <span>Permiso crítico inmutable</span>
                                </span>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- SECCIÓN B: USUARIOS ASIGNADOS --- */}
      {activeTab === "users" && (
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold font-title text-slate-900 dark:text-white">
                Usuarios con el Rol "{role.name}"
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Cuentas activas en la base de datos que poseen este rol asignado.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-[#ED500A]">
              {assignedUsers.length} usuarios registrados
            </span>
          </div>

          {assignedUsers.length === 0 ? (
            <div className="p-12 text-center rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.04] space-y-2">
              <Users className="w-8 h-8 text-slate-400 mx-auto opacity-50" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                No hay usuarios asignados a este rol actualmente.
              </p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Puedes asignar este rol al invitar o editar usuarios en el módulo de Gestión de Usuarios.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/[0.04]">
              {assignedUsers.map((user) => (
                <div
                  key={user.id}
                  className="py-3.5 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center font-bold font-mono text-xs shrink-0">
                      {user.email.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-semibold text-xs text-slate-900 dark:text-white block font-title">
                        {user.fullName || "Usuario sin nombre registrado"}
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        {user.email}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                      {user.status === "active" ? "Activo" : user.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- SECCIÓN C: INFORMACIÓN GENERAL & METADATOS --- */}
      {activeTab === "info" && (
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 shadow-xs space-y-5">
          <div>
            <h3 className="text-sm font-bold font-title text-slate-900 dark:text-white">
              Ficha Técnica del Rol
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Identidad estructural, inmutabilidad y alcances de gobernanza.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] space-y-1">
              <span className="text-[11px] text-slate-400 font-medium">Nombre Oficial</span>
              <span className="font-bold text-xs text-slate-900 dark:text-white block font-title">
                {role.name}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] space-y-1">
              <span className="text-[11px] text-slate-400 font-medium">Identificador Técnico (Code)</span>
              <span className="font-mono text-xs text-[#ED500A] font-bold block">
                {role.code}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] space-y-1">
              <span className="text-[11px] text-slate-400 font-medium">Ámbito de Autorización</span>
              <span className="font-semibold text-xs text-slate-900 dark:text-white block">
                {isPlatform ? "Plataforma Core (NEGOVA)" : "Tenant / Negocio"}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] space-y-1">
              <span className="text-[11px] text-slate-400 font-medium">Tipo de Rol</span>
              <span className="font-semibold text-xs text-slate-900 dark:text-white block">
                {role.type === "system" ? "Rol del Sistema (Inmutable)" : "Rol Personalizado"}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] space-y-1 sm:col-span-2">
              <span className="text-[11px] text-slate-400 font-medium">Descripción y Propósito</span>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {role.description}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. BANNER FLOTANTE INFERIOR DE CAMBIOS SIN GUARDAR */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-2xl animate-in slide-in-from-bottom-5 duration-300">
          <div className="p-4 rounded-2xl bg-slate-950/90 dark:bg-[#0D0E12]/95 backdrop-blur-md border border-[#ED500A]/40 text-white shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#ED500A]/20 text-[#ED500A]">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="font-bold block font-title">
                  Tienes modificaciones pendientes en la matriz
                </span>
                <span className="text-[11px] text-slate-400">
                  {selectedPermissions.length} permisos seleccionados actualmente.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleDiscardChanges}
                disabled={isPending}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-slate-300 transition-all cursor-pointer"
              >
                Descartar
              </button>

              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ED500A] hover:bg-[#d44508] text-white text-xs font-semibold shadow-md transition-all active:scale-95 cursor-pointer"
              >
                {isPending ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{isPending ? "Guardando..." : "Guardar Cambios"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
