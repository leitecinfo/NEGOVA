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
  Lock,
  KeyRound,
  Filter,
  RefreshCw,
  AlertTriangle,
  Mail,
  Phone,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  UserModel,
  UserListResult,
  UserStatus,
} from "@/lib/auth/users-service";
import {
  getUsersListAction,
  changeUserStatusAction,
} from "./actions";
import {
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

interface UsuariosClientProps {
  initialData: UserListResult | null;
  businesses: Array<{ id: string; name: string; slug: string; status: string }>;
  currentUserId: string;
  isSuperAdmin: boolean;
}

// Configuración: cambiar a true o false para activar/desactivar la primera columna fija (Sticky Column en scroll X)
const STICKY_FIRST_COLUMN = true;

export function UsuariosClient({
  initialData,
  businesses,
  currentUserId,
  isSuperAdmin,
}: UsuariosClientProps) {
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

  // Filtros interactivos
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedScope, setSelectedScope] = useState<"all" | "platform" | "business">("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Estado para el modal de confirmación de acción destructiva
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    user: UserModel | null;
    targetStatus: UserStatus | null;
    title: string;
    description: string;
    confirmLabel: string;
    variant: "destructive" | "warning" | "primary" | "success";
  }>({
    isOpen: false,
    user: null,
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
    scope = selectedScope,
    status = selectedStatus,
    bizId = selectedBusinessId,
    search = searchQuery
  ) => {
    startTransition(async () => {
      const res = await getUsersListAction({
        page,
        pageSize: 10,
        scope: scope === "all" ? undefined : scope,
        status: status === "all" ? undefined : status,
        businessId: bizId === "all" ? undefined : bizId,
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
    fetchUsers(1, selectedScope, selectedStatus, selectedBusinessId, searchQuery);
  };

  const handleScopeChange = (scope: "all" | "platform" | "business") => {
    setSelectedScope(scope);
    setCurrentPage(1);
    fetchUsers(1, scope, selectedStatus, selectedBusinessId, searchQuery);
  };

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    setCurrentPage(1);
    fetchUsers(1, selectedScope, status, selectedBusinessId, searchQuery);
  };

  const handleBusinessChange = (bizId: string) => {
    setSelectedBusinessId(bizId);
    setCurrentPage(1);
    fetchUsers(1, selectedScope, selectedStatus, bizId, searchQuery);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= data.totalPages) {
      setCurrentPage(newPage);
      fetchUsers(newPage, selectedScope, selectedStatus, selectedBusinessId, searchQuery);
    }
  };

  // Abrir modal de confirmación
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
      description = `El usuario ${user.fullName} no podrá iniciar sesión en NEGOVA mientras permanezca deshabilitado.`;
      confirmLabel = "Deshabilitar Usuario";
      variant = "warning";
    } else if (newStatus === "blocked") {
      title = "Bloquear Usuario";
      description = `El usuario ${user.fullName} será bloqueado por seguridad de manera inmediata.`;
      confirmLabel = "Bloquear Acceso";
      variant = "destructive";
    } else if (newStatus === "active") {
      title = "Reactivar Usuario";
      description = `Se restaurará el acceso a la plataforma para ${user.fullName}.`;
      confirmLabel = "Reactivar Cuenta";
      variant = "success";
    }

    setConfirmModal({
      isOpen: true,
      user,
      targetStatus: newStatus,
      title,
      description,
      confirmLabel,
      variant,
    });
  };

  // Ejecutar cambio de estado confirmado
  const executeStatusChange = () => {
    if (!confirmModal.user || !confirmModal.targetStatus) return;

    const user = confirmModal.user;
    const targetStatus = confirmModal.targetStatus;

    setConfirmModal((prev) => ({ ...prev, isOpen: false }));

    startTransition(async () => {
      const res = await changeUserStatusAction(user.id, targetStatus);
      if (res.success) {
        toast.success(`Estado de ${user.fullName} actualizado correctamente.`);
        fetchUsers();
      } else {
        toast.error(res.error || "No fue posible actualizar el estado.");
      }
    });
  };

  return (
    <div className="space-y-6 font-body">
      <AdminKpiGrid cols={4}>
        <AdminKpiCard
          title="Total Usuarios"
          value={data.stats.total}
          subtext="Todas las cuentas"
          icon={<Users className="w-4 h-4" />}
          variant="blue"
          isSelected={selectedScope === "all" && selectedStatus === "all"}
          onClick={() => {
            handleScopeChange("all");
            handleStatusChange("all");
          }}
        />

        <AdminKpiCard
          title="Equipo NEGOVA"
          value={data.stats.platformCount}
          subtext="Personal de plataforma"
          icon={<Shield className="w-4 h-4" />}
          variant="orange"
          isSelected={selectedScope === "platform"}
          onClick={() => handleScopeChange("platform")}
        />

        <AdminKpiCard
          title="En Negocios"
          value={data.stats.businessCount}
          subtext="Membresías activas"
          icon={<Building2 className="w-4 h-4" />}
          variant="purple"
          isSelected={selectedScope === "business"}
          onClick={() => handleScopeChange("business")}
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
        tabs={
          <AdminTabs
            activeTab={selectedScope}
            onChange={(val) => handleScopeChange(val as "all" | "platform" | "business")}
            tabs={[
              { id: "all", label: "Todos", count: data.stats.total },
              { id: "platform", label: "Equipo NEGOVA", count: data.stats.platformCount },
              { id: "business", label: "Usuarios de Negocios", count: data.stats.businessCount },
            ]}
          />
        }
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

            {selectedScope !== "platform" && businesses.length > 0 && (
              <AdminSelect
                value={selectedBusinessId}
                onChange={(val) => handleBusinessChange(val)}
                className="max-w-[200px]"
                options={[
                  { value: "all", label: "Todos los comercios" },
                  ...businesses.map((b) => ({ value: b.id, label: b.name })),
                ]}
              />
            )}
          </>
        }
      />

      {data.users.length === 0 ? (
        <AdminEmptyState
          icon={Users}
          title="No se encontraron usuarios"
          description="No existen registros que coincidan con los filtros o el término de búsqueda actual."
          onReset={() => {
            setSearchQuery("");
            setSelectedScope("all");
            setSelectedStatus("all");
            setSelectedBusinessId("all");
            fetchUsers(1, "all", "all", "all", "");
          }}
          resetLabel="Limpiar Filtros"
        />
      ) : (
        <div className="space-y-4">
          {/* VISTA TABULAR PARA DESKTOP */}
          <div className="hidden md:block rounded-2xl bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className={`w-full text-left border-collapse ${STICKY_FIRST_COLUMN ? "min-w-[850px]" : ""}`}>
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                    <th
                      className={`py-3.5 px-4 ${
                        STICKY_FIRST_COLUMN
                          ? "sticky left-0 z-20 bg-slate-50/95 dark:bg-[#0D0E12]/95 backdrop-blur-xs border-r border-slate-200/80 dark:border-white/10 shadow-[4px_0_12px_-2px_rgba(0,0,0,0.06)] dark:shadow-[4px_0_12px_-2px_rgba(0,0,0,0.4)]"
                          : ""
                      }`}
                    >
                      Usuario
                    </th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Tipo & Contexto</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Negocio / Entorno</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Rol Asignado</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Estado</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] text-xs">
                  {data.users.map((user) => {
                    const isCurrentUser = user.id === currentUserId;
                    const isPlatform = user.type === "platform";

                    return (
                      <tr
                        key={user.id}
                        onClick={() => router.push(`/admin/usuarios/${user.id}`)}
                        className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer"
                      >
                        {/* 1. Identidad de Usuario (Sticky cuando activo) */}
                        <td
                          className={`py-3.5 px-4 ${
                            STICKY_FIRST_COLUMN
                              ? "sticky left-0 z-10 bg-white group-hover:bg-slate-50/90 dark:bg-[#0D0E12] dark:group-hover:bg-[#14161F] border-r border-slate-200/80 dark:border-white/10 shadow-[4px_0_12px_-2px_rgba(0,0,0,0.06)] dark:shadow-[4px_0_12px_-2px_rgba(0,0,0,0.4)]"
                              : ""
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-slate-200 to-slate-100 dark:from-white/10 dark:to-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-200 shrink-0">
                              {user.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Link
                                  href={`/admin/usuarios/${user.id}`}
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
                        </td>

                        {/* 2. Tipo */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isPlatform ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20">
                              <Shield className="w-3 h-3" />
                              Equipo NEGOVA
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-purple-500/10 text-purple-600 border border-purple-500/20 dark:text-purple-400">
                              <Building2 className="w-3 h-3" />
                              Usuario de Negocio
                            </span>
                          )}
                        </td>

                        {/* 3. Negocio / Entorno */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isPlatform ? (
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
                          )}
                        </td>

                        {/* 4. Rol */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border ${user.primaryRole.badgeColor}`}
                          >
                            {user.primaryRole.name}
                          </span>
                        </td>

                        {/* 5. Estado */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
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
                        </td>

                        {/* 7. Acciones (Menú de 3 puntos) */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* VISTA DE TARJETAS PARA DISPOSITIVOS MÓVILES */}
          <div className="md:hidden space-y-3">
            {data.users.map((user) => (
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
                    href={`/admin/usuarios/${user.id}`}
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
            ))}
          </div>

          {/* 4. PAGINACIÓN REUTILIZABLE */}
          <AdminPagination
            currentPage={currentPage}
            totalPages={data.totalPages}
            totalItems={data.total}
            currentCount={data.users.length}
            itemLabel="usuarios"
            onPageChange={handlePageChange}
            isPending={isPending}
          />
        </div>
      )}

      {/* 5. MODAL REUTILIZABLE DE CONFIRMACIÓN */}
      <AdminConfirmDialog
        isOpen={confirmModal.isOpen && !!confirmModal.user}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={executeStatusChange}
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
              ]
            : undefined
        }
      />
      {/* 6. MENÚ FLOTANTE VÍA PORTAL (Sin alterar la altura de la tabla ni recortarse) */}
      {menuAnchor &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            data-user-actions-menu
            style={{ top: `${menuAnchor.top}px`, left: `${menuAnchor.left}px` }}
            className="fixed w-52 rounded-xl bg-white dark:bg-[#12141C] border border-slate-200 dark:border-white/10 shadow-2xl z-[9999] py-1 text-left ring-1 ring-black/5 dark:ring-white/10 animate-in fade-in zoom-in-95 duration-100 font-body"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 border-b border-slate-100 dark:border-white/[0.06] text-[11px] font-semibold text-slate-400 font-mono truncate">
              {menuAnchor.user.fullName}
            </div>

            <Link
              href={`/admin/usuarios/${menuAnchor.user.id}`}
              onClick={() => setMenuAnchor(null)}
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              <Eye className="w-4 h-4 text-slate-400" />
              <span>Ver Detalle y Permisos</span>
            </Link>

            <Link
              href={`/admin/usuarios/${menuAnchor.user.id}?tab=info&edit=true`}
              onClick={() => setMenuAnchor(null)}
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              <Edit className="w-4 h-4 text-blue-500" />
              <span>Editar Perfil</span>
            </Link>

            <div className="my-1 border-t border-slate-100 dark:border-white/[0.06]" />

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
          </div>,
          document.body
        )}
    </div>
  );
}
