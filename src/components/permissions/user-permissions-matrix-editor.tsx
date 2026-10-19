"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  Lock,
  Info,
  RotateCcw,
  Save,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { UserEffectivePermissionsDetail } from "@/lib/auth/user-permissions-service";
import { AdminButton, AdminConfirmDialog } from "@/components/admin/ui";

export interface UserPermissionsMatrixEditorProps {
  permissionsData: UserEffectivePermissionsDetail;
  userName: string;
  userRoleName: string;
  isOwnerOrSuperAdmin?: boolean;
  isCurrentUser?: boolean;
  canEdit?: boolean;
  onSave: (
    granted: string[],
    revoked: string[]
  ) => Promise<{ success: boolean; error?: string; effectivePermissions?: string[] } | void>;
  onPermissionsUpdated?: (updatedDetail: UserEffectivePermissionsDetail) => void;
}

export function UserPermissionsMatrixEditor({
  permissionsData: initialPermissionsData,
  userName,
  userRoleName,
  isOwnerOrSuperAdmin = false,
  isCurrentUser = false,
  canEdit,
  onSave,
  onPermissionsUpdated,
}: UserPermissionsMatrixEditorProps) {
  const [data, setData] = useState<UserEffectivePermissionsDetail>(initialPermissionsData);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  // Mapa de estado editable para cada permiso
  const [toggles, setToggles] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    if (initialPermissionsData?.moduleBreakdown) {
      initialPermissionsData.moduleBreakdown.forEach((mod) => {
        mod.permissions.forEach((p) => {
          map[p.code] = p.isEffective;
        });
      });
    }
    return map;
  });

  const [hasChanges, setHasChanges] = useState(false);

  // Sincronizar si cambian los datos de origen externamente
  useEffect(() => {
    setData(initialPermissionsData);
    const map: Record<string, boolean> = {};
    if (initialPermissionsData?.moduleBreakdown) {
      initialPermissionsData.moduleBreakdown.forEach((mod) => {
        mod.permissions.forEach((p) => {
          map[p.code] = p.isEffective;
        });
      });
    }
    setToggles(map);
    setHasChanges(false);
  }, [initialPermissionsData]);

  const canEditUser =
    canEdit !== undefined ? canEdit : !isOwnerOrSuperAdmin && !isCurrentUser;

  const toggleModuleCollapse = (moduleId: string) => {
    setExpandedModules((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }));
  };

  const handlePermToggle = (code: string, isAssignable: boolean) => {
    if (isCurrentUser) {
      toast.error("No puedes modificar tus propios permisos.");
      return;
    }
    if (isOwnerOrSuperAdmin) {
      toast.error(
        "Los usuarios con rol Dueño o Superadmin disponen de permisos totales canónicos y no admiten excepciones individuales."
      );
      return;
    }
    if (!isAssignable) {
      toast.error(
        "Este privilegio crítico está restringido y reservado exclusivamente para dueños de negocio."
      );
      return;
    }
    if (!canEditUser) {
      toast.error("No tienes permisos suficientes para modificar las facultades de este usuario.");
      return;
    }

    setToggles((prev) => {
      const updated = { ...prev, [code]: !prev[code] };
      setHasChanges(true);
      return updated;
    });
  };

  const handleReset = () => {
    const map: Record<string, boolean> = {};
    data.moduleBreakdown.forEach((mod) => {
      mod.permissions.forEach((p) => {
        map[p.code] = p.isInherited;
      });
    });
    setToggles(map);
    setHasChanges(true);
    toast.info("Valores restablecidos a los permisos por defecto del rol.");
  };

  const handleConfirmSave = async () => {
    setIsSaving(true);
    try {
      const inheritedSet = new Set(data.inheritedPermissions);
      const granted: string[] = [];
      const revoked: string[] = [];

      Object.entries(toggles).forEach(([code, isEnabled]) => {
        if (isEnabled && !inheritedSet.has(code)) {
          granted.push(code);
        } else if (!isEnabled && inheritedSet.has(code)) {
          revoked.push(code);
        }
      });

      const res = await onSave(granted, revoked);

      if (!res || res.success) {
        setHasChanges(false);
        setConfirmModalOpen(false);

        const updatedEffective = Object.entries(toggles)
          .filter(([_, isEnabled]) => isEnabled)
          .map(([code]) => code);

        const updatedBreakdown = data.moduleBreakdown.map((mod) => ({
          ...mod,
          permissions: mod.permissions.map((p) => {
            const isEff = Boolean(toggles[p.code]);
            const isInherited = p.isInherited;
            const isCustomGranted = isEff && !isInherited;
            const isCustomRevoked = !isEff && isInherited;
            return {
              ...p,
              isEffective: isEff,
              isCustomGranted,
              isCustomRevoked,
              status: !p.isAssignable
                ? ("restricted" as const)
                : isCustomGranted
                ? ("custom_granted" as const)
                : isCustomRevoked
                ? ("custom_revoked" as const)
                : isInherited
                ? ("inherited" as const)
                : ("not_assigned" as const),
            };
          }),
        }));

        const nextDetail: UserEffectivePermissionsDetail = {
          ...data,
          effectivePermissions: updatedEffective,
          customGrantedPermissions: granted,
          customRevokedPermissions: revoked,
          moduleBreakdown: updatedBreakdown,
        };

        setData(nextDetail);
        onPermissionsUpdated?.(nextDetail);
      }
    } catch (err: any) {
      toast.error(err?.message || "Ocurrió un error inesperado al guardar permisos.");
    } finally {
      setIsSaving(false);
    }
  };

  // Contadores dinámicos calculados
  const inheritedSet = new Set(data.inheritedPermissions);
  const totalEffectiveCount = Object.values(toggles).filter(Boolean).length;
  const grantedCount = Object.entries(toggles).filter(
    ([code, isEnabled]) => isEnabled && !inheritedSet.has(code)
  ).length;
  const revokedCount = Object.entries(toggles).filter(
    ([code, isEnabled]) => !isEnabled && inheritedSet.has(code)
  ).length;

  return (
    <div className="space-y-6">
      {/* 1. BARRA SUPERIOR DE ESTADO Y ACCIONES */}
      <div className="p-5 rounded-3xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#ED500A]" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white font-title">
              Matriz de Permisos Efectivos
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 font-mono text-slate-600 dark:text-slate-300">
              {`Rol: ${data.roleCode}`}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Permisos calculados con excepciones individuales en el comercio.
          </p>
        </div>

        {/* Acciones de Edición */}
        {canEditUser && (
          <div className="flex items-center gap-2.5">
            <AdminButton
              type="button"
              variant="outline"
              size="sm"
              disabled={isSaving || !hasChanges}
              onClick={handleReset}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Restablecer al Rol
            </AdminButton>
            <AdminButton
              type="button"
              variant="primary"
              size="sm"
              disabled={isSaving || !hasChanges}
              isLoading={isSaving}
              onClick={() => setConfirmModalOpen(true)}
              leftIcon={<Save className="w-3.5 h-3.5" />}
            >
              Guardar Permisos
            </AdminButton>
          </div>
        )}
      </div>

      {/* 2. BANNERS INFORMATIVOS */}
      {isOwnerOrSuperAdmin && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Rol con facultades completas</span>
            <span>
              Este usuario dispone del rol canónico <strong>{userRoleName}</strong>, el cual posee todos los permisos operativos por definición arquitectónica y no admite restricciones individuales.
            </span>
          </div>
        </div>
      )}

      {isCurrentUser && (
        <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Cuenta personal en sesión</span>
            <span>
              Por directrices estrictas de auditoría y seguridad, no puedes alterar tus propios permisos de usuario.
            </span>
          </div>
        </div>
      )}

      {/* 3. RESUMEN DE INDICADORES NUMÉRICOS (KPI CARDS) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08]">
          <span className="text-[11px] text-slate-400 font-medium block">Total Efectivos</span>
          <span className="text-xl font-bold font-title text-slate-900 dark:text-white">
            {totalEffectiveCount}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08]">
          <span className="text-[11px] text-slate-400 font-medium block">Heredados por Rol</span>
          <span className="text-xl font-bold font-title text-slate-900 dark:text-white">
            {data.inheritedPermissions.length}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08]">
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium block">
            Excepciones Concedidas
          </span>
          <span className="text-xl font-bold font-title text-emerald-600 dark:text-emerald-400">
            {`+${grantedCount}`}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08]">
          <span className="text-[11px] text-red-600 dark:text-red-400 font-medium block">
            Excepciones Revocadas
          </span>
          <span className="text-xl font-bold font-title text-red-600 dark:text-red-400">
            {`-${revokedCount}`}
          </span>
        </div>
      </div>

      {/* 4. DESGLOSE MODULAR DE PERMISOS */}
      <div className="space-y-4">
        {data.moduleBreakdown.map((mod) => {
          const isCollapsed = expandedModules[mod.moduleId] === true;
          const activeCount = mod.permissions.filter((p) => toggles[p.code]).length;

          return (
            <div
              key={mod.moduleId}
              className="rounded-3xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] overflow-hidden shadow-xs"
            >
              <button
                type="button"
                onClick={() => toggleModuleCollapse(mod.moduleId)}
                className="w-full p-5 flex items-center justify-between text-left hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors cursor-pointer"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      {mod.moduleName}
                    </h4>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                      {activeCount} / {mod.permissions.length} activos
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{mod.description}</p>
                </div>
                <div className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                </div>
              </button>

              {!isCollapsed && (
                <div className="p-5 pt-0 border-t border-slate-100 dark:border-white/[0.04]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                    {mod.permissions.map((perm) => {
                      const isEnabled = Boolean(toggles[perm.code]);
                      const isInherited = perm.isInherited;
                      const isGrantedException = isEnabled && !isInherited;
                      const isRevokedException = !isEnabled && isInherited;
                      const canToggle = canEditUser && perm.isAssignable;

                      return (
                        <div
                          key={perm.code}
                          className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3 text-xs ${
                            isEnabled
                              ? "bg-slate-50/70 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.08]"
                              : "bg-slate-50/20 dark:bg-transparent border-slate-100 dark:border-white/5 opacity-60"
                          }`}
                        >
                          <div className="space-y-1.5 min-w-0 pr-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-900 dark:text-white text-xs">
                                {perm.name}
                              </span>

                              {/* Etiquetas de Procedencia */}
                              {isGrantedException && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  + Concedido
                                </span>
                              )}
                              {isRevokedException && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                                  - Revocado
                                </span>
                              )}
                              {!isGrantedException && !isRevokedException && isInherited && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5">
                                  Heredado
                                </span>
                              )}
                              {!perm.isAssignable && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 flex items-center gap-1">
                                  <Lock className="w-2.5 h-2.5" />
                                  Solo Dueño
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                              {perm.description}
                            </p>
                            <span className="text-[10px] font-mono text-slate-400 block truncate">
                              {perm.code}
                            </span>
                          </div>

                          {/* Control de Toggle o Candado */}
                          <div className="shrink-0 pt-0.5">
                            {canToggle ? (
                              <button
                                type="button"
                                role="switch"
                                aria-checked={isEnabled}
                                disabled={isSaving}
                                onClick={() => handlePermToggle(perm.code, perm.isAssignable)}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 ${
                                  isEnabled ? "bg-[#ED500A]" : "bg-slate-200 dark:bg-white/20"
                                }`}
                              >
                                <span
                                  aria-hidden="true"
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                    isEnabled ? "translate-x-5" : "translate-x-0"
                                  }`}
                                />
                              </button>
                            ) : (
                              <div
                                className="p-1.5 text-slate-300 dark:text-slate-600"
                                title={
                                  !perm.isAssignable
                                    ? "Permiso exclusivo de Dueño de negocio"
                                    : "Edición restringida"
                                }
                              >
                                <Lock className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 5. MODAL DE CONFIRMACIÓN */}
      <AdminConfirmDialog
        isOpen={confirmModalOpen}
        title="Guardar Permisos Individuales"
        description={`¿Estás seguro de que deseas actualizar los permisos individuales de ${userName}? Los cambios afectarán de inmediato las acciones y accesos que este colaborador puede ejecutar en el comercio.`}
        confirmLabel="Guardar Permisos"
        cancelLabel="Cancelar"
        variant="primary"
        isLoading={isSaving}
        onConfirm={handleConfirmSave}
        onClose={() => setConfirmModalOpen(false)}
      />
    </div>
  );
}
