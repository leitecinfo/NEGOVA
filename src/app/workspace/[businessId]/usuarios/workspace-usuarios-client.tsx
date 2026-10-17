"use client";

import React, { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Users,
  Shield,
  Building2,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Eye,
  Edit,
  UserCheck,
  UserX,
  UserMinus,
  Lock,
  KeyRound,
  Filter,
  RefreshCw,
  AlertTriangle,
  Mail,
  Phone,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  UserModel,
  UserListResult,
  UserStatus,
} from "@/lib/auth/users-service";
import {
  getWorkspaceUsersListAction,
  changeWorkspaceUserStatusAction,
  resetWorkspaceUserPasswordAction,
  removeWorkspaceUserAction,
} from "./actions";
import {
  AdminDataTable,
  AdminDataTableColumn,
  AdminPagination,
  AdminEmptyState,
  AdminTableToolbar,
  AdminKpiCard,
  AdminKpiGrid,
  AdminTabs,
  AdminSelect,
  AdminConfirmDialog,
  AdminStatusBadge,
} from "@/components/admin/ui";
import { ModalPortal } from "@/components/ui/modal-portal";

interface WorkspaceUsuariosClientProps {
  initialData: UserListResult | null;
  currentUserId: string;
  businessId: string;
  businessName: string;
}

const STICKY_FIRST_COLUMN = true;

export function WorkspaceUsuariosClient({
  initialData,
  currentUserId,
  businessId,
  businessName,
}: WorkspaceUsuariosClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Estados de listado y paginación
  const [data, setData] = useState<UserListResult>(
    initialData || {
      users: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
      stats: { total: 0, platformCount: 0, businessCount: 0, activeCount: 0, disabledCount: 0 },
    }
  );

  useEffect(() => {
    if (initialData) {
      setData(initialData);
    }
  }, [initialData]);

  // Filtros interactivos
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Estado para modal de contraseña temporal
  const [tempPasswordModal, setTempPasswordModal] = useState<{
    isOpen: boolean;
    userName: string;
    password: string;
    copied: boolean;
  }>({
    isOpen: false,
    userName: "",
    password: "",
    copied: false,
  });

  // Estado para el modal de confirmación de acción destructiva
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    user: UserModel | null;
    actionType: "status" | "reset_password" | "remove";
    targetStatus: UserStatus | null;
    title: string;
    description: string;
    confirmLabel: string;
    variant: "destructive" | "warning" | "primary" | "success";
  }>({
    isOpen: false,
    user: null,
    actionType: "status",
    targetStatus: null,
    title: "",
    description: "",
    confirmLabel: "",
    variant: "destructive",
  });

  // Menú contextual flotante de 3 puntos (Portal)
  const [menuAnchor, setMenuAnchor] = useState<{
    id: string;
    top: number;
    left: number;
    user: UserModel;
  } | null>(null);

  useEffect(() => {
    const handleClose = (e: MouseEvent | Event) => {
      const target = e.target as HTMLElement;
      if (target?.closest?.("[data-user-actions-menu]")) return;
      setMenuAnchor(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuAnchor(null);
    };

    if (menuAnchor) {
      document.addEventListener("mousedown", handleClose);
      window.addEventListener("scroll", handleClose, true);
      window.addEventListener("resize", handleClose);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClose);
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuAnchor]);

  // Función para recargar listado con filtros actuales
  const fetchUsers = (
    page = currentPage,
    status = selectedStatus,
    role = selectedRole,
    search = searchQuery
  ) => {
    startTransition(async () => {
      const res = await getWorkspaceUsersListAction(businessId, {
        page,
        pageSize: 10,
        status: status === "all" ? undefined : status,
        roleCode: role === "all" ? undefined : role,
        search: search.trim() || undefined,
      });

      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast.error(res.error || "Error al actualizar usuarios.");
      }
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchUsers(1, selectedStatus, selectedRole, searchQuery);
  };

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    setCurrentPage(1);
    fetchUsers(1, status, selectedRole, searchQuery);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= data.totalPages) {
      setCurrentPage(newPage);
      fetchUsers(newPage, selectedStatus, selectedRole, searchQuery);
    }
  };

  // Abrir modal de confirmación de estado
  const openStatusConfirmModal = (user: UserModel, newStatus: UserStatus) => {
    if (user.id === currentUserId && newStatus !== "active") {
      toast.error("No puedes deshabilitar ni bloquear tu propia cuenta.");
      return;
    }

    let title = "Confirmar acción";
    let description = "¿Estás seguro de realizar este cambio?";
    let confirmLabel = "Confirmar";
    let variant: "destructive" | "warning" | "primary" | "success" = "destructive";

    if (newStatus === "disabled") {
      title = "Deshabilitar Usuario";
      description = `El usuario ${user.fullName} no podrá acceder al sistema en este comercio mientras permanezca deshabilitado.`;
      confirmLabel = "Deshabilitar Acceso";
      variant = "warning";
    } else if (newStatus === "blocked") {
      title = "Bloquear Usuario";
      description = `El usuario ${user.fullName} será bloqueado de manera inmediata por seguridad.`;
      confirmLabel = "Bloquear Acceso";
      variant = "destructive";
    } else if (newStatus === "active") {
      title = "Reactivar Usuario";
      description = `Se restaurará el acceso al espacio de trabajo para ${user.fullName}.`;
      confirmLabel = "Reactivar Cuenta";
      variant = "success";
    }

    setConfirmModal({
      isOpen: true,
      user,
      actionType: "status",
      targetStatus: newStatus,
      title,
      description,
      confirmLabel,
      variant,
    });
  };

  // Abrir modal para restablecer clave
  const openResetPasswordModal = (user: UserModel) => {
    setConfirmModal({
      isOpen: true,
      user,
      actionType: "reset_password",
      targetStatus: null,
      title: "Restablecer Contraseña Temporal",
      description: `Se generará una nueva contraseña segura temporal para ${user.fullName}. El usuario deberá cambiarla obligatoriamente al iniciar sesión.`,
      confirmLabel: "Generar Nueva Contraseña",
      variant: "primary",
    });
  };

  // Abrir modal para desvincular
  const openRemoveConfirmModal = (user: UserModel) => {
    if (user.id === currentUserId) {
      toast.error("No puedes desvincular tu propia cuenta.");
      return;
    }

    setConfirmModal({
      isOpen: true,
      user,
      actionType: "remove",
      targetStatus: null,
      title: "Desvincular Usuario del Comercio",
      description: `¿Estás seguro de desvincular a ${user.fullName} de ${businessName}? El usuario perderá el acceso a este negocio.`,
      confirmLabel: "Desvincular Usuario",
      variant: "destructive",
    });
  };

  // Ejecutar acción confirmada
  const executeConfirmAction = () => {
    if (!confirmModal.user) return;

    const user = confirmModal.user;
    const targetStatus = confirmModal.targetStatus;
    const actionType = confirmModal.actionType;

    setConfirmModal((prev) => ({ ...prev, isOpen: false }));

    startTransition(async () => {
      if (actionType === "remove") {
        const res = await removeWorkspaceUserAction(businessId, user.id);
        if (res.success) {
          toast.success(`${user.fullName} ha sido desvinculado del comercio.`);
          fetchUsers();
        } else {
          toast.error(res.error || "No fue posible desvincular al usuario.");
        }
      } else if (actionType === "reset_password") {
        const res = await resetWorkspaceUserPasswordAction(businessId, user.id);
        if (res.success && res.temporaryPassword) {
          toast.success("Contraseña restablecida exitosamente.");
          setTempPasswordModal({
            isOpen: true,
            userName: user.fullName,
            password: res.temporaryPassword,
            copied: false,
          });
          fetchUsers();
        } else {
          toast.error(res.error || "No fue posible restablecer la contraseña.");
        }
      } else if (targetStatus) {
        const res = await changeWorkspaceUserStatusAction(businessId, user.id, targetStatus);
        if (res.success) {
          const statusLabels: Record<string, string> = {
            active: "Activo",
            disabled: "Deshabilitado",
            blocked: "Bloqueado",
          };
          toast.success(`Estado de ${user.fullName} actualizado a '${statusLabels[targetStatus] || targetStatus}'.`);
          // Actualización inmediata en el estado de la vista
          setData((prev) => {
            const updatedUsers = prev.users.map((u) =>
              u.id === user.id ? { ...u, status: targetStatus } : u
            );
            return {
              ...prev,
              users: updatedUsers,
              stats: {
                ...prev.stats,
                activeCount: updatedUsers.filter((u) => u.status === "active").length,
                disabledCount: updatedUsers.filter(
                  (u) => u.status === "disabled" || u.status === "inactive"
                ).length,
              },
            };
          });
          router.refresh();
          fetchUsers();
        } else {
          toast.error(res.error || "No fue posible actualizar el estado.");
        }
      }
    });
  };

  return (
    <div className="space-y-6 font-body">
      <AdminKpiGrid cols={3}>
        <AdminKpiCard
          title="Total Usuarios"
          value={data.stats.total}
          subtext="Colaboradores del negocio"
          icon={<Users className="w-4 h-4" />}
          variant="blue"
          isSelected={selectedStatus === "all"}
          onClick={() => {
            handleStatusChange("all");
          }}
        />

        <AdminKpiCard
          title="Cuentas Activas"
          value={data.stats.activeCount}
          subtext="Operativas sin restricción"
          icon={<CheckCircle2 className="w-4 h-4" />}
          variant="emerald"
          isSelected={selectedStatus === "active"}
          onClick={() => handleStatusChange("active")}
        />
      </AdminKpiGrid>

      <AdminTableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        searchPlaceholder="Buscar por nombre, correo, teléfono o negocio..."
        onRefresh={() => fetchUsers()}
        isPending={isPending}
        filters={
          <>
            <AdminSelect
              value={selectedStatus}
              onChange={(val) => handleStatusChange(val)}
              options={[
                { value: "all", label: "Todos los estados" },
                { value: "active", label: "Activo" },
                { value: "invited", label: "Invitación pendiente" },
                { value: "disabled", label: "Deshabilitado" },
                { value: "blocked", label: "Bloqueado" },
              ]}
            />
          </>
        }
      />

      {/* TABLA UNIFICADA CON ADMIN-DATA-TABLE */}
      <AdminDataTable<UserModel>
        data={data.users}
        columns={[
          {
            header: "Usuario",
            render: (user) => {
              const isCurrentUser = user.id === currentUserId;
              return (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-slate-200 to-slate-100 dark:from-white/10 dark:to-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-200 shrink-0">
                    {user.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/workspace/${businessId}/usuarios/${user.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-slate-900 dark:text-white hover:text-[#ED500A] dark:hover:text-[#ED500A] transition-colors truncate"
                      >
                        {user.fullName}
                      </Link>
                      {isCurrentUser && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#ED500A]/10 text-[#ED500A]">
                          TÚ
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono truncate">{user.email}</p>
                    {user.mustChangePassword && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                        <KeyRound className="w-3 h-3" /> Clave temporal activa
                      </span>
                    )}
                  </div>
                </div>
              );
            },
          },
          {
            header: "Tipo & Contexto",
            headerClassName: "whitespace-nowrap",
            className: "whitespace-nowrap",
            render: (user) => {
              const isPlatform = user.type === "platform";
              return isPlatform ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20">
                  <Shield className="w-3 h-3" />
                  Equipo NEGOVA
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-purple-500/10 text-purple-600 border border-purple-500/20 dark:text-purple-400">
                  <Building2 className="w-3 h-3" />
                  Usuario de Negocio
                </span>
              );
            },
          },
          {
            header: "Negocio / Entorno",
            headerClassName: "whitespace-nowrap",
            className: "whitespace-nowrap",
            render: (user) => {
              const isPlatform = user.type === "platform";
              return isPlatform ? (
                <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                  Plataforma Core
                </span>
              ) : user.businessMemberships.length > 0 ? (
                <div className="space-y-0.5">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate max-w-[160px]">
                    {user.businessMemberships[0].businessName}
                  </span>
                  {user.businessMemberships.length > 1 && (
                    <span className="text-[10px] text-slate-400 block font-mono">
                      +{user.businessMemberships.length - 1} comercio(s)
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-slate-400 italic text-[11px]">Sin asignar</span>
              );
            },
          },
          {
            header: "Rol Asignado",
            headerClassName: "whitespace-nowrap",
            className: "whitespace-nowrap",
            render: (user) => (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border ${user.primaryRole.badgeColor}`}
              >
                {user.primaryRole.name}
              </span>
            ),
          },
          {
            header: "Estado",
            headerClassName: "whitespace-nowrap",
            className: "whitespace-nowrap",
            render: (user) => (
              <>
                {user.status === "active" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Activo
                  </span>
                )}
                {user.status === "invited" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    Invitación
                  </span>
                )}
                {(user.status === "disabled" || user.status === "inactive") && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Deshabilitado
                  </span>
                )}
                {user.status === "blocked" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-red-500/10 text-red-600 dark:text-red-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    Bloqueado
                  </span>
                )}
              </>
            ),
          },
          {
            header: "Acciones",
            headerClassName: "whitespace-nowrap text-right",
            className: "whitespace-nowrap text-right",
            align: "right",
            render: (user) => (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (menuAnchor?.id === user.id) {
                    setMenuAnchor(null);
                  } else {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const menuWidth = 208;
                    const menuHeight = 220;
                    const spaceBelow = window.innerHeight - rect.bottom;
                    const openUp = spaceBelow < menuHeight && rect.top > menuHeight;
                    const top = openUp ? rect.top - menuHeight : rect.bottom + 6;
                    const left = Math.max(10, rect.right - menuWidth);
                    setMenuAnchor({ id: user.id, top, left, user });
                  }
                }}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                  menuAnchor?.id === user.id
                    ? "bg-slate-200 dark:bg-white/20 text-slate-900 dark:text-white border-slate-300 dark:border-white/20 shadow-xs"
                    : "bg-slate-50/50 dark:bg-white/[0.03] text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] border-slate-200/80 dark:border-white/10"
                }`}
                title="Acciones del Usuario"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            ),
          },
        ]}
        keyExtractor={(user) => user.id}
        onRowClick={(user) => router.push(`/workspace/${businessId}/usuarios/${user.id}`)}
        stickyFirstColumn={STICKY_FIRST_COLUMN}
        emptyState={{
          icon: Users,
          title: "No se encontraron usuarios",
          description: "No existen registros que coincidan con los filtros o el término de búsqueda actual.",
          onReset: () => {
            setSearchQuery("");
            setSelectedStatus("all");
            fetchUsers(1, "all", "all", "");
          },
          resetLabel: "Limpiar Filtros",
        }}
        renderMobileCard={(user) => (
          <div
            key={user.id}
            className="p-4 rounded-2xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 shadow-xs space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200">
                  {user.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                    {user.fullName}
                  </h4>
                  <p className="text-xs text-slate-400 font-mono">{user.email}</p>
                </div>
              </div>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${user.primaryRole.badgeColor}`}
              >
                {user.primaryRole.name}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100 dark:border-white/[0.04]">
              <div>
                <span className="text-[10px] text-slate-400 block font-mono">Tipo</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {user.type === "platform" ? "Equipo NEGOVA" : "Usuario de Negocio"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-mono">Estado</span>
                <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">
                  {user.status}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.04]">
              <Link
                href={`/workspace/${businessId}/usuarios/${user.id}`}
                className="flex-1 text-center py-2 rounded-xl bg-slate-100 dark:bg-white/[0.04] text-xs font-semibold text-slate-800 dark:text-white"
              >
                Ver Detalle
              </Link>
              {user.status === "active" ? (
                <button
                  type="button"
                  onClick={() => openStatusConfirmModal(user, "disabled")}
                  disabled={user.id === currentUserId}
                  className="px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-500/20 text-xs font-semibold text-amber-600 disabled:opacity-30"
                >
                  Desactivar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openStatusConfirmModal(user, "active")}
                  className="px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-500/20 text-xs font-semibold text-emerald-600"
                >
                  Activar
                </button>
              )}
            </div>
          </div>
        )}
        pagination={{
          currentPage,
          totalPages: data.totalPages,
          totalItems: data.total,
          currentCount: data.users.length,
          itemLabel: "usuarios",
          onPageChange: handlePageChange,
          isPending,
        }}
      />

      {/* 5. MODAL REUTILIZABLE DE CONFIRMACIÓN */}
      <AdminConfirmDialog
        isOpen={confirmModal.isOpen && !!confirmModal.user}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={executeConfirmAction}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmLabel={confirmModal.confirmLabel}
        variant={confirmModal.variant}
        isLoading={isPending}
        itemDetails={
          confirmModal.user
            ? [
                { label: "Usuario", value: confirmModal.user.fullName },
                { label: "Email", value: confirmModal.user.email },
                { label: "Rol Actual", value: confirmModal.user.primaryRole.name },
              ]
            : undefined
        }
      />

      {/* MODAL DE CONTRASEÑA TEMPORAL GENERADA */}
      {tempPasswordModal.isOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#12141C] border border-slate-200 dark:border-white/10 shadow-2xl p-6 space-y-4">
              <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Contraseña Restablecida
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Para {tempPasswordModal.userName}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Copia esta clave temporal y compártela de forma segura con el colaborador. El sistema le exigirá crear una contraseña definitiva en su primer inicio de sesión:
              </p>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 font-mono text-xs font-bold text-slate-900 dark:text-white">
                <span className="select-all tracking-wider">{tempPasswordModal.password}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(tempPasswordModal.password);
                    setTempPasswordModal((prev) => ({ ...prev, copied: true }));
                    toast.success("Contraseña copiada al portapapeles.");
                    setTimeout(() => {
                      setTempPasswordModal((prev) => ({ ...prev, copied: false }));
                    }, 2000);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 transition-colors text-xs font-sans cursor-pointer"
                >
                  {tempPasswordModal.copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setTempPasswordModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold text-xs hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Entendido y Cerrar
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* 6. MENÚ FLOTANTE VÍA PORTAL */}
      {menuAnchor &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            data-user-actions-menu
            style={{ top: `${menuAnchor.top}px`, left: `${menuAnchor.left}px` }}
            className="fixed w-56 rounded-xl bg-white dark:bg-[#12141C] border border-slate-200 dark:border-white/10 shadow-2xl z-[9999] py-1 text-left ring-1 ring-black/5 dark:ring-white/10 animate-in fade-in zoom-in-95 duration-100 font-body"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 border-b border-slate-100 dark:border-white/[0.06] text-[11px] font-semibold text-slate-400 font-mono truncate">
              {menuAnchor.user.fullName}
            </div>

            {/* Ver y Gestionar Permisos */}
            <button
              type="button"
              onClick={() => {
                const u = menuAnchor.user;
                setMenuAnchor(null);
                router.push(`/workspace/${businessId}/usuarios/${u.id}`);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors cursor-pointer"
            >
              <Shield className="w-4 h-4" />
              <span>Gestionar Permisos</span>
            </button>

            {/* Restablecer Contraseña */}
            <button
              type="button"
              onClick={() => {
                const u = menuAnchor.user;
                setMenuAnchor(null);
                openResetPasswordModal(u);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-slate-400" />
              <span>Restablecer Contraseña</span>
            </button>

            <div className="my-1 border-t border-slate-100 dark:border-white/[0.06]" />

            {/* Deshabilitar o Reactivar */}
            {menuAnchor.user.status === "active" ? (
              <button
                type="button"
                onClick={() => {
                  const u = menuAnchor.user;
                  setMenuAnchor(null);
                  openStatusConfirmModal(u, "disabled");
                }}
                disabled={menuAnchor.user.id === currentUserId}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors disabled:opacity-40 cursor-pointer"
              >
                <UserX className="w-4 h-4" />
                <span>Deshabilitar Acceso</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const u = menuAnchor.user;
                  setMenuAnchor(null);
                  openStatusConfirmModal(u, "active");
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span>Reactivar Cuenta</span>
              </button>
            )}

            {/* Bloquear */}
            {menuAnchor.user.status !== "blocked" && (
              <button
                type="button"
                onClick={() => {
                  const u = menuAnchor.user;
                  setMenuAnchor(null);
                  openStatusConfirmModal(u, "blocked");
                }}
                disabled={menuAnchor.user.id === currentUserId}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-40 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>Bloquear Cuenta</span>
              </button>
            )}

            {/* Desvincular del negocio (Solo colaboradores, no el dueño) */}
            {menuAnchor.user.primaryRole.code !== "owner" && (
              <>
                <div className="my-1 border-t border-slate-100 dark:border-white/[0.06]" />
                <button
                  type="button"
                  onClick={() => {
                    const u = menuAnchor.user;
                    setMenuAnchor(null);
                    openRemoveConfirmModal(u);
                  }}
                  disabled={menuAnchor.user.id === currentUserId}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <UserMinus className="w-4 h-4" />
                  <span>Desvincular del Comercio</span>
                </button>
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
