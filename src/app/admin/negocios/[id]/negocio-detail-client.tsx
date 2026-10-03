"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  Store,
  UtensilsCrossed,
  Briefcase,
  Users,
  CreditCard,
  History,
  Info,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Clock,
  CheckCircle2,
  Ban,
  AlertCircle,
  Edit,
  Save,
  User,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  ChevronRight,
  X,
  Package,
  Plus,
  Trash2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  BusinessModel,
  BusinessUserMembership,
  BusinessStatus,
  BusinessType,
  BusinessCategory,
  BUSINESS_CATEGORIES,
  getCategoryFromBusinessType,
  BUSINESS_TYPE_LABELS,
  BUSINESS_STATUS_LABELS,
} from "@/lib/businesses/types";
import {
  updateBusinessAction,
  changeBusinessStatusAction,
  deleteBusinessAction,
  renewSubscriptionAction,
} from "../actions";
import {
  assignUserToBusinessAction,
  removeUserFromBusinessAction,
} from "@/app/admin/usuarios/actions";
import { formatVigenciaDate, PlanId, NEGOVA_PLANS } from "@/config/plans";
import {
  AdminButton,
  AdminBadge,
  AdminStatusBadge,
  AdminTabs,
  AdminKpiCard,
  AdminKpiGrid,
  AdminInput,
  AdminSelect,
  AdminSearchSelect,
  AdminConfirmDialog,
} from "@/components/admin/ui";
import {
  getDepartmentOptions,
  getCitiesOptions,
} from "@/config/colombia-locations";

interface NegocioDetailClientProps {
  business: BusinessModel;
  memberships: BusinessUserMembership[];
  auditLogs: any[];
  candidateOwners: Array<{ id: string; fullName: string; email: string }>;
  currentUserId: string;
  isSuperAdmin: boolean;
}

export function NegocioDetailClient({
  business,
  memberships,
  auditLogs,
  candidateOwners,
  currentUserId,
  isSuperAdmin,
}: NegocioDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "resumen";
  const shouldAutoEdit = searchParams.get("edit") === "true";

  // Tabs: 'resumen' | 'informacion' | 'usuarios' | 'suscripcion' | 'actividad'
  const [activeTab, setActiveTab] = useState<"resumen" | "informacion" | "usuarios" | "suscripcion" | "actividad">(
    initialTab === "informacion" || initialTab === "usuarios" || initialTab === "suscripcion" || initialTab === "actividad"
      ? initialTab
      : "resumen"
  );

  // Estado del formulario de edición
  const [isEditing, setIsEditing] = useState(shouldAutoEdit || initialTab === "informacion");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<BusinessCategory>(
    getCategoryFromBusinessType(business.businessType)
  );
  const [editForm, setEditForm] = useState({
    name: business.name,
    slug: business.slug,
    businessType: business.businessType,
    description: business.description || "",
    phone: business.phone || "",
    email: business.email || "",
    address: business.address || "",
    city: business.city || "",
    department: business.department || "",
    timezone: business.timezone || "America/Bogota",
  });

  const handleDetailCategoryChange = (catId: string) => {
    const newCat = catId as BusinessCategory;
    setSelectedCategory(newCat);
    const catDef = BUSINESS_CATEGORIES.find((c) => c.id === newCat) || BUSINESS_CATEGORIES[0];
    const defaultType = catDef.types[0]?.value || "other";
    setEditForm((prev) => ({
      ...prev,
      businessType: defaultType,
    }));
  };

  // Modal de confirmación para cambio de estado
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    targetStatus: BusinessStatus | null;
    reason: string;
  }>({
    isOpen: false,
    targetStatus: null,
    reason: "",
  });

  const shouldAutoOpenAssign =
    searchParams.get("action") === "assign-owner" ||
    (!business.owner && searchParams.get("created") === "true");

  // Modal para Asignar Propietario / Miembro al Equipo
  const [assignModal, setAssignModal] = useState<{
    isOpen: boolean;
    mode: "owner" | "member";
    selectedUserId: string;
    selectedRole: string;
  }>({
    isOpen: shouldAutoOpenAssign,
    mode: "owner",
    selectedUserId: "",
    selectedRole: "owner",
  });

  // Diálogo para Desvincular Miembro del Equipo
  const [memberToRemove, setMemberToRemove] = useState<BusinessUserMembership | null>(null);

  // Modal de confirmación para eliminación definitiva del negocio
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Modal para Renovación / Extensión Manual de Suscripción
  const [renewModal, setRenewModal] = useState<{
    isOpen: boolean;
    months: number;
    planId: PlanId;
  }>({
    isOpen: false,
    months: 1,
    planId: (business.plan?.planId as PlanId) || "inicio",
  });

  const typeMeta = BUSINESS_TYPE_LABELS[business.businessType] || BUSINESS_TYPE_LABELS.other;
  const statusMeta = BUSINESS_STATUS_LABELS[business.status] || BUSINESS_STATUS_LABELS.inactive;

  const handleRenewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await renewSubscriptionAction(
        business.id,
        renewModal.months,
        renewModal.planId
      );
      if (res.success) {
        toast.success(`Suscripción extendida por ${renewModal.months} mes(es) exitosamente.`);
        setRenewModal({
          isOpen: false,
          months: 1,
          planId: (business.plan?.planId as PlanId) || "inicio",
        });
        router.refresh();
      } else {
        toast.error(res.error || "No fue posible renovar la suscripción.");
      }
    });
  };

  const handleConfirmDeleteBusiness = () => {
    startTransition(async () => {
      const res = await deleteBusinessAction(business.id);
      if (res.success) {
        toast.success(`Negocio '${business.name}' eliminado permanentemente.`);
        setIsDeleteModalOpen(false);
        router.push("/admin/negocios");
      } else {
        toast.error(res.error || "No fue posible eliminar el negocio.");
      }
    });
  };

  const handleSaveInfo = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateBusinessAction(business.id, {
        name: editForm.name,
        slug: editForm.slug,
        businessType: editForm.businessType,
        description: editForm.description,
        phone: editForm.phone,
        email: editForm.email,
        address: editForm.address,
        city: editForm.city,
        department: editForm.department,
        timezone: editForm.timezone,
      });

      if (res.success) {
        toast.success("Información del negocio actualizada exitosamente.");
        setIsEditing(false);
        setIsEditModalOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || "No fue posible actualizar el negocio.");
      }
    });
  };

  const confirmStatusChange = () => {
    if (!statusModal.targetStatus) return;

    const targetStatus = statusModal.targetStatus;
    const reason = statusModal.reason;

    startTransition(async () => {
      const res = await changeBusinessStatusAction(business.id, targetStatus, reason);
      if (res.success) {
        const label = BUSINESS_STATUS_LABELS[targetStatus]?.label || targetStatus;
        toast.success(`Estado actualizado a: ${label}.`);
        setStatusModal({ isOpen: false, targetStatus: null, reason: "" });
        router.refresh();
      } else {
        toast.error(res.error || "No fue posible cambiar el estado.");
      }
    });
  };

  // Manejador para Asignar Propietario o Miembro al Equipo
  const handleAssignMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModal.selectedUserId) {
      toast.error("Por favor selecciona un usuario.");
      return;
    }

    startTransition(async () => {
      const res = await assignUserToBusinessAction(
        assignModal.selectedUserId,
        business.id,
        assignModal.selectedRole
      );

      if (res.success) {
        toast.success(
          assignModal.mode === "owner"
            ? "Propietario (Owner) asignado exitosamente al negocio."
            : "Colaborador agregado exitosamente al equipo del negocio."
        );
        setAssignModal({ isOpen: false, mode: "owner", selectedUserId: "", selectedRole: "owner" });
        router.refresh();
      } else {
        toast.error(res.error || "No fue posible realizar la asignación.");
      }
    });
  };

  // Manejador para Desvincular Miembro
  const handleConfirmRemoveMember = () => {
    if (!memberToRemove) return;

    startTransition(async () => {
      const res = await removeUserFromBusinessAction(
        memberToRemove.id,
        memberToRemove.userId,
        business.id
      );

      if (res.success) {
        toast.success(`'${memberToRemove.fullName}' ha sido desvinculado del comercio.`);
        setMemberToRemove(null);
        router.refresh();
      } else {
        toast.error(res.error || "No fue posible desvincular al colaborador.");
      }
    });
  };

  return (
    <div className="space-y-6 font-body">
      {/* 1. CABECERA HERO CON KPI RESUMEN */}
      <div className="p-5 sm:p-7 md:p-8 rounded-3xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          <div className="flex items-start gap-4 sm:gap-5 min-w-0 flex-1">
            <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-orange-50 to-orange-100 dark:from-[#ED500A]/20 dark:to-[#ED500A]/5 border border-orange-200 dark:border-[#ED500A]/30 flex items-center justify-center font-title text-xl sm:text-2xl md:text-3xl font-bold text-[#ED500A] shrink-0 shadow-xs">
              {business.name.charAt(0).toUpperCase()}
            </div>

            <div className="space-y-2 min-w-0 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold font-title text-slate-900 dark:text-white leading-tight">
                  {business.name}
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${typeMeta.badgeColor}`}
                >
                  <span>{typeMeta.categoryLabel}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/10 hover:bg-orange-50 hover:text-[#ED500A] dark:hover:bg-white/15 transition-all cursor-pointer group"
                  title="Haz clic para cambiar el rubro o datos"
                >
                  <span>{typeMeta.label}</span>
                  <Edit className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                </button>
                <AdminStatusBadge
                  status={business.status}
                  label={statusMeta.label}
                />
              </div>

              <div className="flex items-center gap-x-5 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap font-mono">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>slug: <strong>{business.slug}</strong></span>
                </span>
                {business.city && (
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{business.city}, {business.department || "Colombia"}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Alta: {new Date(business.createdAt).toLocaleDateString("es-CO")}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Acciones de Estado Operacional y Edición */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap pt-3 xl:pt-0 border-t xl:border-t-0 border-slate-100 dark:border-white/[0.06] shrink-0">
            <AdminButton
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(true)}
              leftIcon={<Edit className="w-3.5 h-3.5" />}
            >
              Editar Negocio / Rubro
            </AdminButton>

            {business.status !== "active" && (
              <AdminButton
                variant="primary"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => setStatusModal({ isOpen: true, targetStatus: "active", reason: "" })}
                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
              >
                Activar Negocio
              </AdminButton>
            )}

            {business.status === "active" && (
              <AdminButton
                variant="outline"
                size="sm"
                className="text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                onClick={() => setStatusModal({ isOpen: true, targetStatus: "suspended", reason: "" })}
                leftIcon={<Ban className="w-3.5 h-3.5" />}
              >
                Suspender Operación
              </AdminButton>
            )}

            {business.status !== "inactive" && (
              <AdminButton
                variant="outline"
                size="sm"
                className="text-red-600 dark:text-red-400 hover:bg-red-500/10"
                onClick={() => setStatusModal({ isOpen: true, targetStatus: "inactive", reason: "" })}
                leftIcon={<AlertCircle className="w-3.5 h-3.5" />}
              >
                Desactivar
              </AdminButton>
            )}

            <AdminButton
              variant="outline"
              size="sm"
              className="text-red-600 dark:text-red-400 hover:bg-red-500/10"
              onClick={() => setIsDeleteModalOpen(true)}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Eliminar Negocio
            </AdminButton>
          </div>
        </div>
      </div>

      {/* 2. PESTAÑAS (TABS) */}
      <AdminTabs
        activeTab={activeTab}
        onChange={(tab) => setActiveTab(tab as any)}
        tabs={[
          { id: "resumen", label: "Resumen Operativo" },
          { id: "usuarios", label: "Equipo & Colaboradores", count: memberships.length },
          { id: "informacion", label: "Información & Edición" },
          { id: "suscripcion", label: "Plan & Suscripción" },
          { id: "actividad", label: "Auditoría Forense", count: auditLogs.length },
        ]}
      />

      {/* 3. CONTENIDO DE PESTAÑAS */}

      {/* TAB 1: RESUMEN OPERATIVO */}
      {activeTab === "resumen" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* KPI Grid */}
          <AdminKpiGrid cols={4}>
            <AdminKpiCard
              title="Colaboradores Activos"
              value={`${business.userCount} / ${business.plan?.maxUsers || 1}`}
              icon={<Users className="w-4 h-4" />}
              trend={{
                value: `${(business.plan?.maxUsers || 1) - business.userCount} libres`,
                isPositive: business.userCount < (business.plan?.maxUsers || 1),
              }}
            />
            <AdminKpiCard
              title="Plan Contratado"
              value={business.plan?.name || "Plan Inicio"}
              icon={<CreditCard className="w-4 h-4" />}
              trend={{
                value: `${business.plan?.price ? `$${business.plan.price.toLocaleString("es-CO")}` : "Sin costo"}`,
                isPositive: true,
              }}
            />
            <AdminKpiCard
              title="Estado Operacional"
              value={statusMeta.label}
              icon={<Building2 className="w-4 h-4" />}
              trend={{
                value: business.status === "trial" ? "Evaluación" : "Operativo",
                isPositive: business.status === "active",
              }}
            />
            <AdminKpiCard
              title="Eventos Registrados"
              value={auditLogs.length}
              icon={<History className="w-4 h-4" />}
              trend={{ value: "Auditoría", isPositive: true }}
            />
          </AdminKpiGrid>

          {/* Tarjetas de Detalle Rápido */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Propietario (Owner) */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
                <h3 className="text-xs font-bold font-title uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <User className="w-4 h-4 text-purple-500" />
                  Propietario del Negocio (Owner)
                </h3>
                <AdminButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setAssignModal({
                      isOpen: true,
                      mode: "owner",
                      selectedUserId: business.owner?.userId || "",
                      selectedRole: "owner",
                    })
                  }
                >
                  {business.owner ? "Cambiar Propietario" : "Asignar Propietario"}
                </AdminButton>
              </div>

              {business.owner ? (
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center font-bold text-base shrink-0">
                    {business.owner.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {business.owner.fullName}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      {business.owner.email}
                    </p>
                    {business.owner.phone && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Tel: {business.owner.phone}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Negocio sin propietario asignado</span>
                  </div>
                  <p className="leading-relaxed">
                    Este comercio fue registrado pero todavía no cuenta con un usuario propietario (Owner) vinculado en `business_users`.
                  </p>
                  <AdminButton
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() =>
                      setAssignModal({
                        isOpen: true,
                        mode: "owner",
                        selectedUserId: "",
                        selectedRole: "owner",
                      })
                    }
                    leftIcon={<User className="w-3.5 h-3.5" />}
                  >
                    Asignar Propietario Ahora
                  </AdminButton>
                </div>
              )}
            </div>

            {/* Contacto y Ubicación */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
                <h3 className="text-xs font-bold font-title uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-500" />
                  Identidad, Rubro y Contacto
                </h3>
                <AdminButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditModalOpen(true)}
                  leftIcon={<Edit className="w-3.5 h-3.5" />}
                >
                  Cambiar Rubro / Datos
                </AdminButton>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Tipo de Negocio / Rubro:</span>
                  <span className="font-semibold text-[#ED500A]">{typeMeta.label}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Identificador Slug:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 font-mono">/{business.slug}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Dirección:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {business.address || "No registrada"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Ciudad:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {business.city ? `${business.city}, ${business.department || ""}` : "No registrada"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Teléfono:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {business.phone || "No registrado"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Email Comercial:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 font-mono">
                    {business.email || "No registrado"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EQUIPO & COLABORADORES */}
      {activeTab === "usuarios" && (
        <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] shadow-xs overflow-hidden animate-in fade-in duration-150 space-y-6 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-white/[0.08]">
            <div>
              <h2 className="text-base font-bold font-title text-slate-900 dark:text-white">
                Colaboradores del Negocio ({memberships.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Membresías canónicas en `business_users` con roles de ámbito negocio (`owner`, `auxiliar`).
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <AdminButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setAssignModal({
                    isOpen: true,
                    mode: "owner",
                    selectedUserId: business.owner?.userId || "",
                    selectedRole: "owner",
                  })
                }
                leftIcon={<User className="w-3.5 h-3.5 text-purple-500" />}
              >
                {business.owner ? "Cambiar Propietario" : "Asignar Propietario"}
              </AdminButton>

              <AdminButton
                type="button"
                variant="primary"
                size="sm"
                onClick={() =>
                  setAssignModal({
                    isOpen: true,
                    mode: "member",
                    selectedUserId: "",
                    selectedRole: "auxiliar",
                  })
                }
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Agregar Colaborador
              </AdminButton>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/75 dark:bg-white/[0.02] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Usuario</th>
                  <th className="py-3 px-4">Rol en Comercio</th>
                  <th className="py-3 px-4">Estado Membresía</th>
                  <th className="py-3 px-4">Incorporación</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.06] text-xs">
                {memberships.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 dark:text-slate-400">
                      No hay colaboradores ni propietario registrados en este comercio.
                    </td>
                  </tr>
                ) : (
                  memberships.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center font-bold text-xs">
                            {m.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <Link
                              href={`/admin/usuarios/${m.userId}`}
                              className="font-bold text-slate-900 dark:text-white hover:text-[#ED500A] transition-colors"
                            >
                              {m.fullName}
                            </Link>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                          m.roleCode === "owner"
                            ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20"
                            : "bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-slate-200"
                        }`}>
                          {m.roleName} ({m.roleCode})
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 capitalize">
                          <CheckCircle2 className="w-3 h-3" />
                          {m.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString("es-CO") : "Pendiente"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setMemberToRemove(m)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          title="Desvincular del equipo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: INFORMACIÓN & EDICIÓN */}
      {activeTab === "informacion" && (
        <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] p-6 sm:p-8 shadow-xs space-y-6 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.06]">
            <div>
              <h2 className="text-base font-bold font-title text-slate-900 dark:text-white">
                Información del Tenant
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Edita los datos comerciales y ubicación física del negocio.
              </p>
            </div>
            {!isEditing ? (
              <AdminButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsEditing(true)}
                leftIcon={<Edit className="w-3.5 h-3.5" />}
              >
                Habilitar Edición
              </AdminButton>
            ) : (
              <AdminButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(false)}
              >
                Cancelar
              </AdminButton>
            )}
          </div>

          <form onSubmit={handleSaveInfo} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Nombre */}
              <AdminInput
                label="Nombre Comercial"
                disabled={!isEditing}
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />

              {/* Slug */}
              <AdminInput
                label="Identificador Slug"
                disabled={!isEditing}
                value={editForm.slug}
                onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
              />

              {/* 1. Categoría Principal */}
              <AdminSelect
                label="1. Categoría Principal / Sector"
                disabled={!isEditing}
                value={selectedCategory}
                onChange={handleDetailCategoryChange}
                options={BUSINESS_CATEGORIES.map((c) => ({
                  value: c.id,
                  label: c.label,
                }))}
                helperText="Sector macro de actividad comercial"
              />

              {/* 2. Tipo de Negocio */}
              <AdminSelect
                label="2. Tipo de Negocio / Formato"
                disabled={!isEditing}
                value={editForm.businessType}
                onChange={(val) => setEditForm({ ...editForm, businessType: val as BusinessType })}
                options={(
                  BUSINESS_CATEGORIES.find((c) => c.id === selectedCategory) || BUSINESS_CATEGORIES[0]
                ).types.map((t) => ({
                  value: t.value,
                  label: t.label,
                }))}
                helperText="Especialidad o formato comercial específico"
              />

              {/* Teléfono */}
              <AdminInput
                label="Teléfono"
                disabled={!isEditing}
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />

              {/* Email */}
              <AdminInput
                label="Email Comercial"
                type="email"
                disabled={!isEditing}
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />

              {/* Dirección */}
              <div className="md:col-span-2">
                <AdminInput
                  label="Dirección"
                  disabled={!isEditing}
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                />
              </div>

              {/* Departamento */}
              {isEditing ? (
                <div>
                  <AdminSearchSelect
                    label="Departamento"
                    placeholder="Seleccionar departamento..."
                    searchPlaceholder="Buscar departamento..."
                    options={getDepartmentOptions()}
                    value={editForm.department}
                    onChange={(val) => setEditForm({ ...editForm, department: val || "" })}
                  />
                </div>
              ) : (
                <AdminInput
                  label="Departamento"
                  disabled
                  value={editForm.department || "No especificado"}
                />
              )}

              {/* Ciudad */}
              {isEditing ? (
                <div>
                  <AdminSearchSelect
                    label="Ciudad / Municipio"
                    placeholder={
                      editForm.department
                        ? "Seleccionar municipio..."
                        : "Primero selecciona un departamento"
                    }
                    searchPlaceholder="Buscar municipio..."
                    options={getCitiesOptions(editForm.department)}
                    value={editForm.city}
                    onChange={(val) => setEditForm({ ...editForm, city: val || "" })}
                    disabled={!editForm.department}
                  />
                </div>
              ) : (
                <AdminInput
                  label="Ciudad"
                  disabled
                  value={editForm.city || "No especificado"}
                />
              )}
            </div>

            {isEditing && (
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
                <AdminButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  disabled={isPending}
                >
                  Cancelar
                </AdminButton>
                <AdminButton
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isPending}
                  leftIcon={<Save className="w-3.5 h-3.5" />}
                >
                  Guardar Cambios
                </AdminButton>
              </div>
            )}
          </form>
        </div>
      )}

      {/* TAB 4: PLAN & SUSCRIPCIÓN */}
      {activeTab === "suscripcion" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* TARJETA PRINCIPAL DE VIGENCIA */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-[#ED500A] flex items-center justify-center">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-bold font-title text-slate-900 dark:text-white">
                      Plan {business.plan?.name || "Inicio"}
                    </h2>
                    {business.plan?.isTrial ? (
                      <AdminBadge variant="amber" size="sm">
                        Prueba Gratuita (30 días)
                      </AdminBadge>
                    ) : (
                      <AdminBadge
                        variant={
                          business.plan?.vigenciaBadge.badgeVariant === "red"
                            ? "red"
                            : business.plan?.vigenciaBadge.badgeVariant === "amber"
                            ? "amber"
                            : "emerald"
                        }
                        size="sm"
                      >
                        {business.plan?.vigenciaBadge.label}
                      </AdminBadge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {business.plan?.isTrial
                      ? "Suscripción en período de evaluación gratuita — Cobro actual $0 COP"
                      : "Suscripción del tenant comercial y gestión de vigencia"}
                  </p>
                </div>
              </div>

              <AdminButton
                variant="primary"
                size="sm"
                onClick={() =>
                  setRenewModal({
                    isOpen: true,
                    months: 1,
                    planId: (business.plan?.planId as PlanId) || "inicio",
                  })
                }
                leftIcon={<Sparkles className="w-4 h-4" />}
              >
                Renovar / Extender
              </AdminButton>
            </div>

            {/* GRILLA DE METADATOS CLAROS DE VIGENCIA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* PLAN Y PRECIO ACTUAL */}
              <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.06] space-y-1">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Plan Comercial</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {business.plan?.name || "Inicio"}
                </p>
                {business.plan?.isTrial ? (
                  <div className="space-y-0.5">
                    <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      Cobro actual: $0 COP
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Tarifa: ${(business.plan?.planPrice || 29900).toLocaleString("es-CO")} COP/mes
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <p className="text-xs font-mono text-[#ED500A] font-bold">
                      ${(business.plan?.currentPrice ?? business.plan?.price ?? 29900).toLocaleString("es-CO")} COP/{business.plan?.billingInterval === "annual" ? "año" : "mes"}
                    </p>
                    <p className="text-[10px] text-slate-400">Tarifa de renovación</p>
                  </div>
                )}
              </div>

              {/* INICIO */}
              <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.06] space-y-1">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Inicio</span>
                <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                  {formatVigenciaDate(business.plan?.trialStartsAt || business.plan?.currentPeriodStart || business.plan?.startedAt)}
                </p>
                <p className="text-[11px] text-slate-400">
                  {business.plan?.isTrial ? "Inicio de prueba" : "Vinculación inicial"}
                </p>
              </div>

              {/* VENCIMIENTO / FIN DE PRUEBA */}
              <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.06] space-y-1">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  {business.plan?.isTrial ? "Finaliza la Prueba" : "Vencimiento"}
                </span>
                <p className={`text-sm font-mono font-bold ${business.plan?.isExpired ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-white"}`}>
                  {formatVigenciaDate(business.plan?.trialEndsAt || business.plan?.currentPeriodEnd)}
                </p>
                <p className="text-[11px] text-slate-400">
                  {business.plan?.isTrial ? "Fin de evaluación (30d)" : "Fecha límite de corte"}
                </p>
              </div>

              {/* MODALIDAD */}
              <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.06] space-y-1">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Modalidad</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {business.plan?.isTrial
                    ? "Prueba Gratuita"
                    : business.plan?.billingInterval === "annual"
                    ? "Anual"
                    : "Mensual"}
                </p>
                <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  {business.plan?.isTrial
                    ? "30 días sin costo"
                    : business.plan?.durationFormatted || (business.plan?.monthsContracted ? `${business.plan.monthsContracted} mes(es)` : "1 mes")}
                </p>
              </div>

              {/* DÍAS RESTANTES */}
              <div className={`p-4 rounded-xl border space-y-1 ${
                business.plan?.vigenciaBadge.badgeVariant === "red"
                  ? "bg-red-500/5 border-red-500/20"
                  : business.plan?.vigenciaBadge.badgeVariant === "amber"
                  ? "bg-amber-500/5 border-amber-500/20"
                  : "bg-emerald-500/5 border-emerald-500/20"
              }`}>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  {business.plan?.isTrial ? "Días de Prueba" : "Días Restantes"}
                </span>
                <p className={`text-sm font-mono font-bold ${business.plan?.vigenciaBadge.color}`}>
                  {business.plan?.remainingDays !== undefined && business.plan.remainingDays > 0
                    ? `${business.plan.remainingDays} días`
                    : "0 días (Vencido)"}
                </p>
                <p className={`text-[11px] font-semibold ${business.plan?.vigenciaBadge.color}`}>
                  {business.plan?.vigenciaBadge.text}
                </p>
              </div>
            </div>

            {/* SECCIÓN SI ES PRUEBA */}
            {business.plan?.isTrial && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-3">
                <Info className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="space-y-1">
                  <p className="font-bold">Período de Evaluación Gratuita Activo</p>
                  <p className="leading-relaxed">
                    Este comercio cuenta con una prueba gratuita de 30 días iniciada el{" "}
                    <strong>{formatVigenciaDate(business.plan.trialStartsAt || business.plan.startedAt)}</strong> y con vencimiento el{" "}
                    <strong>{formatVigenciaDate(business.plan.trialEndsAt)}</strong> ({business.plan.trialRemainingDays ?? 0} días restantes). Al vencer, requerirá una renovación para continuar operando.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* CUOTAS Y CAPACIDADES DEL PLAN */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] p-6 sm:p-8 shadow-xs space-y-5">
            <h3 className="text-sm font-bold font-title text-slate-900 dark:text-white">
              Cuotas y Límites de Capacidad Operativa
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.06] space-y-1">
                <span className="text-xs text-slate-400 font-medium">Usuarios / Colaboradores</span>
                <p className="text-lg font-bold font-title text-slate-900 dark:text-white">
                  {business.userCount} / {business.plan?.maxUsers || 1}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {Math.max(0, (business.plan?.maxUsers || 1) - business.userCount)} cupos disponibles
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.06] space-y-1">
                <span className="text-xs text-slate-400 font-medium">Catálogo de Productos</span>
                <p className="text-lg font-bold font-title text-slate-900 dark:text-white">
                  Hasta {business.plan?.maxProducts || 200}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Límite de inventario</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.06] space-y-1">
                <span className="text-xs text-slate-400 font-medium">Asistente IA NEGOVA</span>
                <p className="text-lg font-bold font-title text-slate-900 dark:text-white">
                  {business.plan?.planId === "inicio" ? "No disponible" : "Habilitado"}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {business.plan?.planId === "inicio" ? "Disponible desde Plan Crece" : "Consultas operativas activas"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ACTIVIDAD & AUDITORÍA */}
      {activeTab === "actividad" && (
        <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] p-6 shadow-xs space-y-4 animate-in fade-in duration-150">
          <h2 className="text-base font-bold font-title text-slate-900 dark:text-white">
            Trazabilidad de Auditoría ({auditLogs.length})
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/75 dark:bg-white/[0.02] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Acción</th>
                  <th className="py-3 px-4">Entidad</th>
                  <th className="py-3 px-4">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.06] text-xs">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500 dark:text-slate-400">
                      No hay eventos forenses registrados para este negocio.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {new Date(log.created_at).toLocaleString("es-CO")}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold uppercase text-[10px] text-slate-800 dark:text-slate-200">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{log.entity_type}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-[11px]">
                        {log.metadata?.event || JSON.stringify(log.new_data || {})}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL PARA ASIGNAR PROPIETARIO O AGREGAR COLABORADOR */}
      {assignModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white font-title">
                  {assignModal.mode === "owner" ? "Asignar Propietario (Owner)" : "Agregar Colaborador al Equipo"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {assignModal.mode === "owner"
                    ? `Asigna el usuario principal responsable del comercio '${business.name}'.`
                    : `Vincula un miembro de equipo con rol operativo a '${business.name}'.`}
                </p>
              </div>
            </div>

            <form onSubmit={handleAssignMemberSubmit} className="space-y-4">
              {/* Selector de Usuario Candidato */}
              <div>
                <AdminSearchSelect
                  label="Seleccionar Usuario"
                  required
                  placeholder="Buscar usuario..."
                  searchPlaceholder="Buscar por nombre o correo..."
                  value={assignModal.selectedUserId}
                  onChange={(val) => setAssignModal({ ...assignModal, selectedUserId: val || "" })}
                  options={candidateOwners.map((u) => ({
                    value: u.id,
                    label: u.fullName,
                    description: u.email,
                  }))}
                />
              </div>

              {/* Selector de Rol si es modo miembro */}
              {assignModal.mode === "member" ? (
                <div>
                  <AdminSelect
                    label="Rol Operativo en el Comercio"
                    value={assignModal.selectedRole}
                    onChange={(val) => setAssignModal({ ...assignModal, selectedRole: val })}
                    options={[
                      { value: "auxiliar", label: "Auxiliar / Ayudante de Negocio (auxiliar)" },
                    ]}
                  />
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-800 dark:text-purple-300">
                  El usuario seleccionado recibirá el rol canónico de <strong>Propietario (owner)</strong> en este comercio.
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
                <AdminButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAssignModal({ ...assignModal, isOpen: false })}
                >
                  Cancelar
                </AdminButton>
                <AdminButton
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isPending}
                >
                  Confirmar Asignación
                </AdminButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE DESVINCULACIÓN */}
      {memberToRemove && (
        <AdminConfirmDialog
          isOpen={!!memberToRemove}
          title="Desvincular Miembro del Equipo"
          description={`¿Estás seguro de que deseas desvincular a '${memberToRemove.fullName}' del comercio '${business.name}'? El usuario perderá acceso a este negocio de inmediato.`}
          confirmLabel="Desvincular"
          cancelLabel="Cancelar"
          variant="destructive"
          isLoading={isPending}
          onConfirm={handleConfirmRemoveMember}
          onClose={() => setMemberToRemove(null)}
        />
      )}

      {/* MODAL DE CONFIRMACIÓN DE CAMBIO DE ESTADO */}
      {statusModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <h3 className="font-bold text-base text-slate-900 dark:text-white font-title">
              Cambiar Estado Operacional
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ¿Confirmas la transición de estado del negocio <strong>{business.name}</strong> a{" "}
              <strong>{BUSINESS_STATUS_LABELS[statusModal.targetStatus!]?.label}</strong>?
            </p>

            <AdminInput
              label="Motivo o Justificación (Opcional)"
              placeholder="Ej. Activación tras verificación de pago..."
              value={statusModal.reason}
              onChange={(e) => setStatusModal({ ...statusModal, reason: e.target.value })}
            />

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <AdminButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStatusModal({ isOpen: false, targetStatus: null, reason: "" })}
              >
                Cancelar
              </AdminButton>
              <AdminButton
                type="button"
                variant="primary"
                size="sm"
                onClick={confirmStatusChange}
                isLoading={isPending}
              >
                Confirmar Cambio
              </AdminButton>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PARA ELIMINACIÓN DEFINITIVA */}
      {isDeleteModalOpen && (
        <AdminConfirmDialog
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleConfirmDeleteBusiness}
          title="Eliminar Negocio Definitivamente"
          description={`¿Estás completamente seguro de que deseas eliminar permanentemente el comercio '${business.name}' (${business.slug})? Se desvincularán todos los usuarios y suscripciones asociadas. Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar Definitivamente"
          cancelLabel="Cancelar"
          variant="destructive"
          isLoading={isPending}
          itemDetails={[
            { label: "Negocio", value: business.name },
            { label: "Slug", value: `/${business.slug}` },
            { label: "Plan", value: business.plan?.name || "Sin plan" },
            { label: "Colaboradores", value: `${business.userCount} vinculados` },
          ]}
        />
      )}

      {/* MODAL PARA RENOVAR / EXTENDER SUSCRIPCIÓN (GESTIÓN MANUAL) */}
      {renewModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-[#ED500A] flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white font-title">
                    Renovar / Extender
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Comercio: <strong>{business.name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRenewModal({ ...renewModal, isOpen: false })}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRenewSubmit} className="space-y-4">
              {/* Seleccionar Plan */}
              <div>
                <AdminSelect
                  label="Plan Comercial a Aplicar"
                  required
                  value={renewModal.planId}
                  onChange={(val) => setRenewModal({ ...renewModal, planId: val as PlanId })}
                  options={[
                    { value: "inicio", label: "Inicio — Hasta 1 usuario ($29.900/mes)" },
                    { value: "crece", label: "Crece — Hasta 3 usuarios + IA ($59.900/mes)" },
                    { value: "negocio", label: "Negocio — Hasta 6 usuarios + IA Avanzada ($99.900/mes)" },
                  ]}
                />
              </div>

              {/* Período / Meses a extender */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Período de Extensión Contratado:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { months: 1, label: "1 Mes" },
                    { months: 3, label: "3 Meses" },
                    { months: 6, label: "6 Meses" },
                    { months: 12, label: "12 Meses (1 año)" },
                  ].map((item) => {
                    const isSelected = renewModal.months === item.months;
                    return (
                      <button
                        key={item.months}
                        type="button"
                        onClick={() => setRenewModal({ ...renewModal, months: item.months })}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer text-xs font-bold ${
                          isSelected
                            ? "bg-orange-50 dark:bg-orange-500/10 border-[#ED500A] text-[#ED500A]"
                            : "bg-slate-50/60 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Resumen Calculado de Nueva Vigencia */}
              <div className="p-4 rounded-2xl bg-orange-50/50 dark:bg-[#ED500A]/5 border border-orange-500/20 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-800 dark:text-slate-200 font-bold">
                  <span>Nueva Fecha de Vencimiento Estimada:</span>
                  <span className="font-mono text-[#ED500A] text-sm">
                    {(() => {
                      const now = new Date();
                      let base = now;
                      if (business.plan?.currentPeriodEnd) {
                        const curEnd = new Date(business.plan.currentPeriodEnd);
                        if (curEnd > now) base = curEnd;
                      }
                      const newD = new Date(base);
                      newD.setMonth(newD.getMonth() + renewModal.months);
                      return formatVigenciaDate(newD.toISOString());
                    })()}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Esta acción actualiza la vigencia del plan y reactiva automáticamente la operación del negocio si se encontraba en estado suspendido o vencido.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
                <AdminButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRenewModal({ ...renewModal, isOpen: false })}
                  disabled={isPending}
                >
                  Cancelar
                </AdminButton>
                <AdminButton
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isPending}
                  leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                >
                  Confirmar Extensión
                </AdminButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL DE EDICIÓN RÁPIDA DE NEGOCIO Y RUBRO */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#0E1017] border border-slate-200 dark:border-white/10 shadow-2xl p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-150 font-body max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-500/10 text-[#ED500A] flex items-center justify-center font-bold text-base">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-title text-slate-900 dark:text-white">
                    Editar Datos del Negocio
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Modifica el rubro/tipo, nombre e información comercial.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario de Edición */}
            <form onSubmit={handleSaveInfo} className="space-y-4">
              {/* 2 Niveles: Categoría Principal y Tipo de Negocio */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.06]">
                <AdminSelect
                  label="1. Categoría Principal"
                  required
                  value={selectedCategory}
                  onChange={handleDetailCategoryChange}
                  options={BUSINESS_CATEGORIES.map((c) => ({
                    value: c.id,
                    label: c.label,
                  }))}
                  helperText="Sector macro"
                />

                <AdminSelect
                  label="2. Tipo de Negocio"
                  required
                  value={editForm.businessType}
                  onChange={(val) =>
                    setEditForm({
                      ...editForm,
                      businessType: val as BusinessType,
                    })
                  }
                  options={(
                    BUSINESS_CATEGORIES.find((c) => c.id === selectedCategory) || BUSINESS_CATEGORIES[0]
                  ).types.map((t) => ({
                    value: t.value,
                    label: t.label,
                  }))}
                  helperText="Formato específico"
                />
              </div>

              {/* Nombre Comercial */}
              <AdminInput
                label="Nombre Comercial"
                required
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    name: e.target.value,
                  })
                }
              />

              {/* Identificador Slug */}
              <AdminInput
                label="Identificador Slug"
                required
                value={editForm.slug}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    slug: e.target.value,
                  })
                }
                helperText="Identificador único para URLs"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Teléfono */}
                <AdminInput
                  label="Teléfono / WhatsApp"
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      phone: e.target.value,
                    })
                  }
                  placeholder="+57 300 123 4567"
                />

                {/* Email */}
                <AdminInput
                  label="Email Comercial"
                  type="email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      email: e.target.value,
                    })
                  }
                  placeholder="contacto@negocio.com"
                />
              </div>

              {/* Dirección */}
              <AdminInput
                label="Dirección"
                value={editForm.address}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    address: e.target.value,
                  })
                }
                placeholder="Calle o Carrera..."
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Ciudad */}
                <AdminInput
                  label="Ciudad"
                  value={editForm.city}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      city: e.target.value,
                    })
                  }
                  placeholder="Ej: Bogotá"
                />

                {/* Departamento */}
                <AdminInput
                  label="Departamento"
                  value={editForm.department}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      department: e.target.value,
                    })
                  }
                  placeholder="Ej: Cundinamarca"
                />
              </div>

              {/* Botones de Acción */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-[#ED500A] text-white text-xs font-semibold shadow-xs hover:bg-[#d44505] transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
