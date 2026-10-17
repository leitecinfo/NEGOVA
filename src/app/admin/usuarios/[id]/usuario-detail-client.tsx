"use client";

import React, { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  User,
  Mail,
  Phone,
  Calendar,
  Clock,
  Shield,
  Building2,
  KeyRound,
  CheckCircle2,
  XCircle,
  Edit3,
  UserCheck,
  UserX,
  Lock,
  History,
  Check,
  Copy,
  AlertTriangle,
  FileText,
  Sliders,
  Sparkles,
  Plus,
  Trash2,
  RefreshCw,
  ExternalLink,
  Info,
  ShieldAlert,
  ArrowRight,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  UserModel,
  UserStatus,
  BusinessMembershipDetail,
} from "@/lib/auth/users-service";
import {
  ALL_PERMISSION_MODULES,
  RoleDefinitionMeta,
} from "@/lib/auth/permissions";
import { UserEffectivePermissionsDetail } from "@/lib/auth/user-permissions-service";
import {
  updateUserProfileAction,
  changeUserRoleAction,
  changeUserStatusAction,
  resetUserPasswordAction,
  assignUserToBusinessAction,
  removeUserFromBusinessAction,
  checkBusinessPlanCapacityAction,
  deleteUserAction,
  saveAdminUserCustomPermissionsAction,
} from "../actions";
import {
  AdminButton,
  AdminIconButton,
  AdminBadge,
  AdminStatusBadge,
  AdminTabs,
  AdminInput,
  AdminSelect,
  AdminSearchSelect,
  AdminConfirmDialog,
} from "@/components/admin/ui";
import { ModalPortal } from "@/components/ui/modal-portal";
import { UserPermissionsMatrixEditor } from "@/components/permissions/user-permissions-matrix-editor";

interface UsuarioDetailClientProps {
  user: UserModel;
  effectivePermissions: string[];
  permissionsDetail?: UserEffectivePermissionsDetail | null;
  auditLogs: any[];
  businesses?: Array<{ id: string; name: string; slug: string; status: string }>;
  platformRoles: RoleDefinitionMeta[];
  businessRoles: RoleDefinitionMeta[];
  currentUserId: string;
  isSuperAdmin: boolean;
}

export function UsuarioDetailClient({
  user: initialUser,
  effectivePermissions: initialEffectivePermissions,
  permissionsDetail,
  auditLogs,
  businesses = [],
  platformRoles,
  businessRoles,
  currentUserId,
  isSuperAdmin,
}: UsuarioDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [user, setUser] = useState<UserModel>(initialUser);
  const [effectivePermissions, setEffectivePermissions] = useState<string[]>(initialEffectivePermissions);
  const [activeTab, setActiveTab] = useState<"permissions" | "info" | "memberships" | "audit">(
    (searchParams.get("tab") as any) || "permissions"
  );

  // Estado de permisos interactivos
  const [permissionsData, setPermissionsData] = useState<UserEffectivePermissionsDetail | null>(
    permissionsDetail || null
  );

  useEffect(() => {
    if (permissionsDetail) {
      setPermissionsData(permissionsDetail);
      setEffectivePermissions(permissionsDetail.effectivePermissions);
    }
  }, [permissionsDetail]);

  // Modales existentes
  const [isEditModalOpen, setIsEditModalOpen] = useState(searchParams.get("edit") === "true");
  const [editFullName, setEditFullName] = useState(user.fullName);
  const [editPhone, setEditPhone] = useState(user.phone || "");
  const [editBio, setEditBio] = useState(user.bio || "");

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedNewRole, setSelectedNewRole] = useState(user.primaryRole.code);

  const [isResetPassModalOpen, setIsResetPassModalOpen] = useState(false);
  const [generatedPass, setGeneratedPass] = useState<string | null>(null);
  const [copiedPass, setCopiedPass] = useState(false);

  // Diálogo para Desvincular de Negocio
  const [membershipToRemove, setMembershipToRemove] = useState<BusinessMembershipDetail | null>(null);

  // Modal de Eliminación Permanente
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [confirmDeleteEmail, setConfirmDeleteEmail] = useState("");
  const [deleteReason, setDeleteReason] = useState("");

  const isCurrentUser = user.id === currentUserId;
  const isPlatform = user.type === "platform";


  // 1. Manejo de Actualización de Perfil
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFullName.trim()) {
      toast.error("El nombre completo es requerido.");
      return;
    }

    startTransition(async () => {
      const res = await updateUserProfileAction(user.id, {
        fullName: editFullName,
        phone: editPhone.trim() || undefined,
        bio: editBio.trim() || undefined,
      });

      if (res.success) {
        toast.success("Perfil actualizado exitosamente.");
        setUser((prev) => ({
          ...prev,
          fullName: editFullName,
          phone: editPhone || null,
          bio: editBio || null,
        }));
        setIsEditModalOpen(false);
      } else {
        toast.error(res.error || "Error al actualizar perfil.");
      }
    });
  };

  // 2. Manejo de Cambio de Rol
  const handleChangeRole = async () => {
    if (selectedNewRole === user.primaryRole.code) {
      setIsRoleModalOpen(false);
      return;
    }

    startTransition(async () => {
      const res = await changeUserRoleAction(user.id, selectedNewRole);
      if (res.success) {
        toast.success(`Rol modificado a '${selectedNewRole}'.`);
        const roleMeta = (isPlatform ? platformRoles : businessRoles).find((r) => r.code === selectedNewRole);
        setUser((prev) => ({
          ...prev,
          primaryRole: {
            code: selectedNewRole,
            name: roleMeta?.name || selectedNewRole,
            scope: isPlatform ? "platform" : "business",
            badgeColor: roleMeta?.badgeColor || "bg-slate-100",
          },
        }));
        setIsRoleModalOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || "No fue posible actualizar el rol.");
      }
    });
  };

  // 3. Manejo de Cambio de Estado
  const handleChangeStatus = async (targetStatus: UserStatus) => {
    if (isCurrentUser) {
      toast.error("No puedes desactivar tu propia cuenta en sesión.");
      return;
    }

    startTransition(async () => {
      const res = await changeUserStatusAction(user.id, targetStatus);
      if (res.success) {
        toast.success(`Estado de cuenta actualizado a '${targetStatus}'.`);
        setUser((prev) => ({ ...prev, status: targetStatus }));
        router.refresh();
      } else {
        toast.error(res.error || "Error al modificar estado.");
      }
    });
  };

  // 4. Manejo de Reseteo de Contraseña
  const handleResetPassword = async () => {
    startTransition(async () => {
      const res = await resetUserPasswordAction(user.id);
      if (res.success && res.temporaryPassword) {
        setGeneratedPass(res.temporaryPassword);
        toast.success("Contraseña temporal generada con éxito.");
      } else {
        toast.error(res.error || "Error al generar contraseña temporal.");
      }
    });
  };

  // 5. Manejo de Desvincular de Negocio (Eliminar Membresía)
  const handleConfirmRemoveMembership = async () => {
    if (!membershipToRemove) return;

    startTransition(async () => {
      const res = await removeUserFromBusinessAction(
        membershipToRemove.membershipId,
        user.id,
        membershipToRemove.businessId
      );

      if (res.success) {
        toast.success(`Usuario desvinculado de '${membershipToRemove.businessName}'.`);
        setUser((prev) => ({
          ...prev,
          businessMemberships: prev.businessMemberships.filter(
            (m) => m.membershipId !== membershipToRemove.membershipId
          ),
        }));
        setMembershipToRemove(null);
        router.refresh();
      } else {
        toast.error(res.error || "No fue posible desvincular al usuario.");
      }
    });
  };

  // 6. Manejo de Eliminación Permanente de Usuario
  const handleDeleteUser = async () => {
    if (confirmDeleteEmail.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      toast.error("El correo de confirmación no coincide.");
      return;
    }

    startTransition(async () => {
      const res = await deleteUserAction(user.id, confirmDeleteEmail, deleteReason);
      if (res.success) {
        toast.success(`Usuario ${user.fullName} eliminado permanentemente.`);
        setIsDeleteModalOpen(false);
        router.push("/admin/usuarios");
      } else {
        toast.error(res.error || "No fue posible eliminar el usuario.");
      }
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPass(true);
    toast.success("Copiado al portapapeles.");
    setTimeout(() => setCopiedPass(false), 2500);
  };

  const handleSaveAdminPermissions = async (granted: string[], revoked: string[]) => {
    if (!permissionsData) return;
    const targetBusinessId = permissionsData.businessId;
    if (!targetBusinessId) {
      toast.error("No se encontró el negocio asociado para guardar los permisos.");
      return;
    }

    const res = await saveAdminUserCustomPermissionsAction(
      targetBusinessId,
      user.id,
      granted,
      revoked
    );

    if (res.success) {
      toast.success(`Permisos individuales de ${user.fullName} guardados correctamente.`);
      return res;
    } else {
      toast.error(res.error || "No se pudieron guardar los permisos.");
      throw new Error(res.error || "Error al guardar permisos.");
    }
  };

  // Agrupador de Permisos Efectivos por Módulo
  const permissionGroups = ALL_PERMISSION_MODULES.filter((module) => {
    return isPlatform ? module.scope === "platform" : module.scope === "business";
  });

  return (
    <div className="space-y-6 font-body">
      {/* 1. TARJETA PRINCIPAL DE PERFIL */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Avatar e Identidad */}
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/10 dark:to-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center font-title text-xl sm:text-2xl font-bold text-slate-800 dark:text-white shrink-0 shadow-xs">
              {user.fullName.charAt(0).toUpperCase()}
            </div>

            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold font-title text-slate-900 dark:text-white truncate">
                  {user.fullName}
                </h2>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${user.primaryRole.badgeColor}`}>
                  {user.primaryRole.name}
                </span>
                <AdminStatusBadge
                  status={user.status}
                  label={
                    user.status === "active"
                      ? "Activo"
                      : user.status === "blocked"
                      ? "Bloqueado"
                      : "Deshabilitado"
                  }
                />
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap font-mono">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {user.email}
                </span>
                {user.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {user.phone}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Alta: {new Date(user.createdAt).toLocaleDateString("es-CO")}
                </span>
              </div>
            </div>
          </div>

          {/* Acciones Rápidas */}
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <AdminButton
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(true)}
              leftIcon={<Edit3 className="w-3.5 h-3.5" />}
            >
              Editar Perfil
            </AdminButton>

            <AdminButton
              variant="outline"
              size="sm"
              onClick={() => setIsRoleModalOpen(true)}
              leftIcon={<Sliders className="w-3.5 h-3.5 text-[#ED500A]" />}
            >
              Cambiar Rol
            </AdminButton>

            <AdminButton
              variant="outline"
              size="sm"
              onClick={() => {
                setGeneratedPass(null);
                setIsResetPassModalOpen(true);
              }}
              leftIcon={<KeyRound className="w-3.5 h-3.5" />}
            >
              Restablecer Clave
            </AdminButton>

            {/* Toggle Estado */}
            {user.status === "active" ? (
              <AdminButton
                variant="outline"
                size="sm"
                disabled={isCurrentUser || isPending}
                onClick={() => handleChangeStatus("disabled")}
                className="text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                leftIcon={<UserX className="w-3.5 h-3.5" />}
              >
                Deshabilitar
              </AdminButton>
            ) : (
              <AdminButton
                variant="primary"
                size="sm"
                disabled={isPending}
                onClick={() => handleChangeStatus("active")}
                className="bg-emerald-600 hover:bg-emerald-700"
                leftIcon={<UserCheck className="w-3.5 h-3.5" />}
              >
                Habilitar
              </AdminButton>
            )}

            {/* Eliminar Usuario (Solo Superadmin y no a uno mismo) */}
            {isSuperAdmin && !isCurrentUser && (
              <AdminButton
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => {
                  setConfirmDeleteEmail("");
                  setDeleteReason("");
                  setIsDeleteModalOpen(true);
                }}
                className="text-red-600 dark:text-red-400 hover:bg-red-500/10 border-red-200 dark:border-red-500/20"
                leftIcon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
              >
                Eliminar
              </AdminButton>
            )}
          </div>
        </div>
      </div>

      {/* 2. BARRA DE PESTAÑAS (TABS) */}
      <AdminTabs
        activeTab={activeTab}
        onChange={(tab) => setActiveTab(tab as any)}
        tabs={[
          { id: "permissions", label: "Permisos Calculados", count: effectivePermissions.length },
          { id: "memberships", label: "Comercios Asociados", count: user.businessMemberships.length },
          { id: "info", label: "Datos de Cuenta" },
          { id: "audit", label: "Auditoría Forense", count: auditLogs.length },
        ]}
      />

      {/* 3. CONTENIDO DE PESTAÑAS */}

      {/* TAB A: PERMISOS CALCULADOS Y GESTIÓN INDIVIDUAL */}
      {activeTab === "permissions" && (
        <div className="space-y-6">
          {/* Si hay datos de permisos de negocio con desglose interactivo */}
          {permissionsData ? (
            <UserPermissionsMatrixEditor
              permissionsData={permissionsData}
              userName={user.fullName}
              userRoleName={user.primaryRole.name}
              isOwnerOrSuperAdmin={user.primaryRole.code === "owner" || user.primaryRole.code === "super_admin"}
              isCurrentUser={isCurrentUser}
              canEdit={user.primaryRole.code !== "owner" && user.primaryRole.code !== "super_admin" && !isCurrentUser}
              onSave={handleSaveAdminPermissions}
              onPermissionsUpdated={(updated) => {
                setPermissionsData(updated);
                setEffectivePermissions(updated.effectivePermissions);
              }}
            />
          ) : (
            /* Vista de catálogo por defecto para usuarios sin membresía de negocio */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#ED500A]" />
                  <span>
                    Ámbito de Seguridad: <strong>{isPlatform ? "Plataforma NEGOVA (Global)" : "Comercio (Tenant)"}</strong>
                  </span>
                </div>
                <span className="font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {effectivePermissions.length} permisos habilitados
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {permissionGroups.map((group) => {
                  const activeInGroup = group.permissions.filter((p) =>
                    effectivePermissions.includes(p.code)
                  ).length;

                  return (
                    <div
                      key={group.moduleId}
                      className="p-5 rounded-3xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 shadow-xs space-y-3"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/[0.04]">
                        <div>
                          <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                            {group.moduleName}
                          </h4>
                          <p className="text-[10px] text-slate-400">{group.description}</p>
                        </div>
                        <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300">
                          {activeInGroup} / {group.permissions.length}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {group.permissions.map((perm) => {
                          const isGranted = effectivePermissions.includes(perm.code);

                          return (
                            <div
                              key={perm.code}
                              className={`p-2.5 rounded-xl border flex items-start justify-between gap-2 text-xs ${
                                isGranted
                                  ? "bg-emerald-500/5 border-emerald-500/20 text-slate-800 dark:text-slate-200"
                                  : "bg-slate-50/50 dark:bg-white/[0.01] border-slate-100 dark:border-white/5 opacity-50"
                              }`}
                            >
                              <div className="space-y-0.5">
                                <span className="font-semibold block text-[11px]">{perm.name}</span>
                                <span className="text-[10px] font-mono text-slate-400 block">{perm.code}</span>
                              </div>
                              {isGranted ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                              ) : (
                                <XCircle className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0 mt-0.5" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB B: MEMBRESÍAS DE NEGOCIOS */}
      {activeTab === "memberships" && (
        <div className="p-6 rounded-3xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-white/[0.06]">
            <div>
              <h3 className="text-base font-bold font-title text-slate-900 dark:text-white">
                Comercios y Negocios Asociados ({user.businessMemberships.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Relación canónica bidireccional gestionada a través de `business_users`.
              </p>
            </div>

            {!isPlatform && (
              <AdminButton
                type="button"
                variant="primary"
                size="sm"
                onClick={() => router.push("/admin/negocios/nuevo")}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Crear / Asignar Negocio
              </AdminButton>
            )}
          </div>

          {/* Banner si el usuario de negocio no tiene membresías */}
          {!isPlatform && user.businessMemberships.length === 0 && (
            <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Usuario sin negocio asignado</span>
              </div>
              <p className="leading-relaxed">
                Esta cuenta está registrada como usuario de negocio pero todavía no tiene membresía en ningún comercio. No puede operar ventas ni acceder a ningún workspace de negocio hasta que se le asigne un comercio.
              </p>
              <AdminButton
                type="button"
                variant="primary"
                size="sm"
                onClick={() => router.push("/admin/negocios/nuevo")}
                leftIcon={<Building2 className="w-4 h-4" />}
              >
                Crear o Vincular Negocio
              </AdminButton>
            </div>
          )}

          {/* Listado de Membresías */}
          {user.businessMemberships.length > 0 && (
            <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {user.businessMemberships.map((m) => (
                <div key={m.membershipId} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0 font-bold">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/negocios/${m.businessId}`}
                          className="font-bold text-sm text-slate-900 dark:text-white hover:text-[#ED500A] transition-colors flex items-center gap-1"
                        >
                          {m.businessName}
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </Link>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 capitalize">
                          {m.status}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono block">
                        app.negova.co/{m.businessSlug}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 justify-between sm:justify-end">
                    <span className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-slate-200">
                      Rol: <strong>{m.roleName}</strong> ({m.roleCode})
                    </span>

                    <button
                      type="button"
                      onClick={() => setMembershipToRemove(m)}
                      className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      title="Desvincular del negocio"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB C: INFORMACIÓN GENERAL */}
      {activeTab === "info" && (
        <div className="p-6 rounded-3xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white font-title">
            Detalles Técnicos de Identidad
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1">
              <span className="text-[10px] text-slate-400 font-mono">ID de Usuario (UUID):</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 block truncate">{user.id}</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1">
              <span className="text-[10px] text-slate-400 font-mono">Correo de Autenticación:</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 block">{user.email}</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1">
              <span className="text-[10px] text-slate-400 font-mono">Nombre Completo:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 block">{user.fullName}</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1">
              <span className="text-[10px] text-slate-400 font-mono">Teléfono:</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 block">
                {user.phone || "No registrado"}
              </span>
            </div>
            <div className="sm:col-span-2 p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1">
              <span className="text-[10px] text-slate-400 font-mono">Biografía / Notas Internas:</span>
              <span className="text-slate-700 dark:text-slate-300 block">
                {user.bio || "Sin notas registradas para este usuario."}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB D: AUDITORÍA */}
      {activeTab === "audit" && (
        <div className="p-6 rounded-3xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white font-title">
            Historial de Auditoría y Trazabilidad
          </h3>

          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-400">No hay registros de auditoría recientes para este usuario.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10 text-[10px] uppercase font-mono text-slate-400">
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Acción</th>
                    <th className="py-2.5 px-3">Tipo de Entidad</th>
                    <th className="py-2.5 px-3">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01]">
                      <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("es-CO")}
                      </td>
                      <td className="py-2.5 px-3 font-semibold uppercase text-[10px] text-slate-800 dark:text-slate-200">
                        {log.action}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{log.entity_type}</td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 text-[11px]">
                        {log.metadata?.event || JSON.stringify(log.new_data || {})}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. MODAL DE CONFIRMACIÓN PARA DESVINCULAR */}
      {membershipToRemove && (
        <AdminConfirmDialog
          isOpen={!!membershipToRemove}
          title="Desvincular Usuario del Comercio"
          description={`¿Estás seguro de que deseas revocar la membresía de ${user.fullName} en '${membershipToRemove.businessName}'? El usuario perderá acceso operativo a este negocio de inmediato.`}
          confirmLabel="Desvincular"
          cancelLabel="Cancelar"
          variant="destructive"
          isLoading={isPending}
          onConfirm={handleConfirmRemoveMembership}
          onClose={() => setMembershipToRemove(null)}
        />
      )}


      {/* 6. MODAL DE EDICIÓN DE PERFIL */}
      {isEditModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
              <h3 className="font-bold text-base text-slate-900 dark:text-white font-title">
                Editar Datos de Perfil
              </h3>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <AdminInput
                  label="Nombre Completo"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                />

                <AdminInput
                  label="Teléfono de Contacto"
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Biografía / Notas
                  </label>
                  <textarea
                    rows={3}
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3">
                  <AdminButton
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditModalOpen(false)}
                  >
                    Cancelar
                  </AdminButton>
                  <AdminButton
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isPending}
                  >
                    Guardar Cambios
                  </AdminButton>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* 7. MODAL DE CAMBIO DE ROL PRINCIPAL */}
      {isRoleModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
              <h3 className="font-bold text-base text-slate-900 dark:text-white font-title">
                Cambiar Rol de {user.fullName}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Selecciona el nuevo rol correspondiente al ámbito <strong>{user.primaryRole.scope}</strong>.
              </p>

              <div className="grid grid-cols-1 gap-2 max-h-[350px] overflow-y-auto pr-1">
                {(isPlatform ? platformRoles : businessRoles).map((role) => {
                  const isSelected = selectedNewRole === role.code;

                  return (
                    <div
                      key={role.code}
                      onClick={() => setSelectedNewRole(role.code)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? isPlatform
                            ? "bg-[#ED500A]/5 border-[#ED500A] dark:bg-[#ED500A]/10 shadow-xs ring-1 ring-[#ED500A]/30"
                            : "bg-purple-500/5 border-purple-500 dark:bg-purple-500/10 shadow-xs ring-1 ring-purple-500/30"
                          : "bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 hover:border-slate-300"
                      }`}
                    >
                      <div>
                        <span className={`font-bold text-xs block ${isSelected ? "text-slate-900 dark:text-white" : "text-slate-800 dark:text-slate-200"}`}>
                          {role.name}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {role.description}
                        </span>
                      </div>
                      <span
                        className={`text-[9px] font-mono px-2 py-0.5 rounded-md border shrink-0 ${role.badgeColor}`}
                      >
                        {role.code}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3">
                <AdminButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRoleModalOpen(false)}
                >
                  Cancelar
                </AdminButton>
                <AdminButton
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleChangeRole}
                  isLoading={isPending}
                >
                  Confirmar Nuevo Rol
                </AdminButton>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* 8. MODAL DE RESETEO DE CONTRASEÑA */}
      {isResetPassModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white font-title">
                  Restablecer Contraseña
                </h3>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Esta acción generará una nueva contraseña temporal segura para <strong>{user.fullName}</strong> y forzará la actualización obligatoria de contraseña en su próximo inicio de sesión.
              </p>

              {generatedPass ? (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-[#ED500A]/30 space-y-2 font-mono text-xs">
                  <span className="text-[10px] text-[#ED500A] font-bold block">
                    Nueva Contraseña Temporal:
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {generatedPass}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(generatedPass)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#ED500A]/10 text-[#ED500A] text-[11px] font-semibold transition-all cursor-pointer font-body"
                    >
                      {copiedPass ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedPass ? "Copiada" : "Copiar"}</span>
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <AdminButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsResetPassModalOpen(false)}
                >
                  {generatedPass ? "Cerrar" : "Cancelar"}
                </AdminButton>

                {!generatedPass && (
                  <AdminButton
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleResetPassword}
                    isLoading={isPending}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    Generar Clave Temporal
                  </AdminButton>
                )}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* 9. MODAL DE ELIMINACIÓN PERMANENTE CON VERIFICACIÓN */}
      {isDeleteModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white dark:bg-[#0D0E12] border border-red-500/20 dark:border-red-500/30 rounded-3xl p-6 shadow-2xl space-y-4 font-body animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white font-title">
                    Eliminar Usuario Permanentemente
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    Acción irreversible de Superadministrador
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/15 space-y-2 text-xs text-slate-700 dark:text-slate-300">
                <p className="leading-relaxed">
                  Esta acción eliminará de forma definitiva la cuenta de <strong>{user.fullName}</strong> (<span className="font-mono text-slate-900 dark:text-white">{user.email}</span>).
                </p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <li>Se revocarán todas sus sesiones activas de Supabase Auth inmediatamente.</li>
                  <li>Se desvincularán sus membresías de comercios y perfiles asociados.</li>
                  <li>Los registros comerciales históricos (ventas, compras, comprobantes) se conservarán íntegros.</li>
                </ul>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                    Para confirmar, escribe el correo del usuario: <span className="font-mono text-red-600 dark:text-red-400 select-all font-bold">{user.email}</span>
                  </label>
                  <input
                    type="text"
                    autoFocus
                    placeholder={user.email}
                    value={confirmDeleteEmail}
                    onChange={(e) => setConfirmDeleteEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                    Motivo de la eliminación (opcional para auditoría):
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Solicitud de baja definitiva / cuenta duplicada"
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={
                    isPending ||
                    confirmDeleteEmail.trim().toLowerCase() !== user.email.trim().toLowerCase()
                  }
                  onClick={handleDeleteUser}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                >
                  {isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Eliminar Permanentemente</span>
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
