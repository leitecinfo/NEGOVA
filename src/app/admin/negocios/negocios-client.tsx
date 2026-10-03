"use client";

import React, { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Building2,
  Store,
  UtensilsCrossed,
  Coffee,
  Wine,
  Briefcase,
  Users,
  Eye,
  MoreVertical,
  CheckCircle2,
  Clock,
  Ban,
  ShieldAlert,
  Edit,
  ArrowRight,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  User,
  Sparkles,
  MapPin,
  X,
  CreditCard,
  AlertCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  BusinessModel,
  BusinessListResult,
  BusinessStatus,
  BusinessType,
  BusinessCategory,
  BUSINESS_CATEGORIES,
  getCategoryFromBusinessType,
  BUSINESS_TYPE_LABELS,
  BUSINESS_STATUS_LABELS,
  VALID_STATUS_TRANSITIONS,
} from "@/lib/businesses/types";
import { formatVigenciaDate } from "@/config/plans";
import {
  getBusinessesListAction,
  changeBusinessStatusAction,
  deleteBusinessAction,
  updateBusinessAction,
} from "./actions";
import {
  AdminPagination,
  AdminEmptyState,
  AdminTableToolbar,
  AdminKpiCard,
  AdminKpiGrid,
  AdminInput,
  AdminSelect,
  AdminConfirmDialog,
  AdminBadge,
  AdminStatusBadge,
} from "@/components/admin/ui";

interface NegociosClientProps {
  initialData: BusinessListResult | null;
  currentUserId: string;
  isSuperAdmin: boolean;
}

export function NegociosClient({
  initialData,
  currentUserId,
  isSuperAdmin,
}: NegociosClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [data, setData] = useState<BusinessListResult>(
    initialData || {
      businesses: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
      stats: { total: 0, activeCount: 0, trialCount: 0, suspendedCount: 0, inactiveCount: 0 },
    }
  );

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Modal de confirmación para cambio de estado
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    business: BusinessModel | null;
    targetStatus: BusinessStatus | null;
    reason: string;
  }>({
    isOpen: false,
    business: null,
    targetStatus: null,
    reason: "",
  });

  // Modal de confirmación para eliminación definitiva
  const [businessToDelete, setBusinessToDelete] = useState<BusinessModel | null>(null);

  // Modal para Edición Rápida de Negocio (cambio de rubro/tipo, nombre, etc.)
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    business: BusinessModel | null;
    category: BusinessCategory;
    form: {
      name: string;
      slug: string;
      businessType: BusinessType;
      phone: string;
      email: string;
      address: string;
      city: string;
      department: string;
    };
  }>({
    isOpen: false,
    business: null,
    category: "gastronomy",
    form: {
      name: "",
      slug: "",
      businessType: "restaurant",
      phone: "",
      email: "",
      address: "",
      city: "",
      department: "",
    },
  });

  const openEditModal = (biz: BusinessModel) => {
    const cat = getCategoryFromBusinessType(biz.businessType);
    setEditModal({
      isOpen: true,
      business: biz,
      category: cat,
      form: {
        name: biz.name,
        slug: biz.slug,
        businessType: biz.businessType,
        phone: biz.phone || "",
        email: biz.email || "",
        address: biz.address || "",
        city: biz.city || "",
        department: biz.department || "",
      },
    });
  };

  const handleEditModalCategoryChange = (catId: string) => {
    const newCat = catId as BusinessCategory;
    const catDef = BUSINESS_CATEGORIES.find((c) => c.id === newCat) || BUSINESS_CATEGORIES[0];
    const defaultType = catDef.types[0]?.value || "other";
    setEditModal((prev) => ({
      ...prev,
      category: newCat,
      form: {
        ...prev.form,
        businessType: defaultType,
      },
    }));
  };

  const handleSaveEditModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal.business) return;
    const bizId = editModal.business.id;

    startTransition(async () => {
      const res = await updateBusinessAction(bizId, {
        name: editModal.form.name,
        slug: editModal.form.slug,
        businessType: editModal.form.businessType,
        phone: editModal.form.phone,
        email: editModal.form.email,
        address: editModal.form.address,
        city: editModal.form.city,
        department: editModal.form.department,
      });

      if (res.success) {
        toast.success("Negocio actualizado exitosamente.");
        setData((prev) => ({
          ...prev,
          businesses: prev.businesses.map((b) =>
            b.id === bizId
              ? {
                  ...b,
                  name: editModal.form.name,
                  slug: editModal.form.slug,
                  businessType: editModal.form.businessType,
                  phone: editModal.form.phone || null,
                  email: editModal.form.email || null,
                  address: editModal.form.address || null,
                  city: editModal.form.city || null,
                  department: editModal.form.department || null,
                }
              : b
          ),
        }));
        setEditModal((prev) => ({ ...prev, isOpen: false, business: null }));
        router.refresh();
      } else {
        toast.error(res.error || "No se pudo actualizar el negocio.");
      }
    });
  };

  // Menú contextual flotante de 3 puntos (Portal)
  const [menuAnchor, setMenuAnchor] = useState<{
    id: string;
    top: number;
    left: number;
    business: BusinessModel;
  } | null>(null);

  useEffect(() => {
    const handleClose = (e: MouseEvent | Event) => {
      const target = e.target as HTMLElement;
      if (target?.closest?.("[data-actions-menu]")) return;
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

  // Cargar datos
  const fetchBusinesses = (
    page = currentPage,
    status = selectedStatus,
    type = selectedType,
    search = searchQuery
  ) => {
    startTransition(async () => {
      const res = await getBusinessesListAction({
        page,
        pageSize: 10,
        status: status === "all" ? undefined : status,
        businessType: type === "all" ? undefined : type,
        search: search.trim() || undefined,
      });

      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast.error(res.error || "Error al actualizar listado de negocios.");
      }
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchBusinesses(1, selectedStatus, selectedType, searchQuery);
  };

  const handleStatusFilter = (status: string) => {
    setSelectedStatus(status);
    setCurrentPage(1);
    fetchBusinesses(1, status, selectedType, searchQuery);
  };

  const handleTypeFilter = (type: string) => {
    setSelectedType(type);
    setCurrentPage(1);
    fetchBusinesses(1, selectedStatus, type, searchQuery);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= data.totalPages) {
      setCurrentPage(newPage);
      fetchBusinesses(newPage, selectedStatus, selectedType, searchQuery);
    }
  };

  // Abrir modal de cambio de estado
  const promptStatusChange = (biz: BusinessModel, newStatus: BusinessStatus) => {
    setStatusModal({
      isOpen: true,
      business: biz,
      targetStatus: newStatus,
      reason: "",
    });
  };

  // Ejecutar cambio de estado confirmado
  const confirmStatusChange = () => {
    if (!statusModal.business || !statusModal.targetStatus) return;

    const biz = statusModal.business;
    const targetStatus = statusModal.targetStatus;
    const reason = statusModal.reason;

    startTransition(async () => {
      const res = await changeBusinessStatusAction(biz.id, targetStatus, reason);
      if (res.success) {
        const label = BUSINESS_STATUS_LABELS[targetStatus].label;
        toast.success(`Estado de '${biz.name}' actualizado a: ${label}.`);
        setStatusModal({ isOpen: false, business: null, targetStatus: null, reason: "" });
        fetchBusinesses();
      } else {
        toast.error(res.error || "No fue posible cambiar el estado.");
      }
    });
  };

  // Ejecutar eliminación definitiva confirmada
  const handleConfirmDelete = () => {
    if (!businessToDelete) return;
    const biz = businessToDelete;

    startTransition(async () => {
      const res = await deleteBusinessAction(biz.id);
      if (res.success) {
        toast.success(`Negocio '${biz.name}' eliminado permanentemente.`);
        setBusinessToDelete(null);
        fetchBusinesses();
      } else {
        toast.error(res.error || "No fue posible eliminar el negocio.");
      }
    });
  };

  const getTypeIcon = (type: BusinessType) => {
    switch (type) {
      case "cafe":
        return <Coffee className="w-3.5 h-3.5" />;
      case "bar":
      case "liquor_store":
        return <Wine className="w-3.5 h-3.5" />;
      case "restaurant":
      case "fast_food":
      case "bakery":
      case "pizzeria":
      case "ice_cream":
      case "gastronomy":
      case "gastronomy_other":
        return <UtensilsCrossed className="w-3.5 h-3.5" />;
      case "supermarket":
      case "fashion":
      case "hardware":
      case "pharmacy":
      case "technology":
      case "stationery":
      case "pets":
      case "retail":
      case "retail_other":
        return <Store className="w-3.5 h-3.5" />;
      case "barbershop":
      case "gym":
      case "health":
      case "automotive":
      case "veterinary":
      case "laundry":
      case "professional":
      case "service":
      case "service_other":
        return <Briefcase className="w-3.5 h-3.5" />;
      default:
        return <Building2 className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="space-y-6 font-body">
      {/* 1. TARJETAS DE MÉTRICAS SUPERIORES (KPIS) */}
      <AdminKpiGrid cols={5}>
        <AdminKpiCard
          title="Total Registrados"
          value={data.stats.total}
          subtext="Negocios en plataforma"
          icon={<Store className="w-4 h-4" />}
          variant="default"
          isSelected={selectedStatus === "all"}
          onClick={() => handleStatusFilter("all")}
        />

        <AdminKpiCard
          title="Activos"
          value={data.stats.activeCount}
          subtext="Operando normalmente"
          icon={<CheckCircle2 className="w-4 h-4" />}
          variant="emerald"
          isSelected={selectedStatus === "active"}
          onClick={() => handleStatusFilter("active")}
        />

        <AdminKpiCard
          title="En Período Trial"
          value={data.stats.trialCount}
          subtext="Prueba de 30 días"
          icon={<Clock className="w-4 h-4" />}
          variant="amber"
          isSelected={selectedStatus === "trial"}
          onClick={() => handleStatusFilter("trial")}
        />

        <AdminKpiCard
          title="Suspendidos"
          value={data.stats.suspendedCount}
          subtext="Acceso restringido"
          icon={<Ban className="w-4 h-4" />}
          variant="red"
          isSelected={selectedStatus === "suspended"}
          onClick={() => handleStatusFilter("suspended")}
        />

        <AdminKpiCard
          title="Inactivos"
          value={data.stats.inactiveCount}
          subtext="Cuentas pausadas"
          icon={<AlertCircle className="w-4 h-4" />}
          variant="default"
          isSelected={selectedStatus === "inactive"}
          onClick={() => handleStatusFilter("inactive")}
        />
      </AdminKpiGrid>

      {/* 2. BARRA DE HERRAMIENTAS Y FILTROS REUTILIZABLE */}
      <AdminTableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        searchPlaceholder="Buscar por nombre, slug, ciudad, propietario o correo..."
        onRefresh={() => fetchBusinesses()}
        isPending={isPending}
        filters={
          <>
            {/* Filtro Tipo */}
            <AdminSelect
              value={selectedType}
              onChange={(val) => handleTypeFilter(val)}
              options={[
                { value: "all", label: "Todos los rubros" },
                { value: "gastronomy", label: "Gastronomía (Todos)" },
                { value: "restaurant", label: "Restaurante" },
                { value: "cafe", label: "Cafetería" },
                { value: "fast_food", label: "Comidas Rápidas" },
                { value: "bar", label: "Bar / Gastrobar" },
                { value: "bakery", label: "Panadería / Pastelería" },
                { value: "pizzeria", label: "Pizzería" },
                { value: "liquor_store", label: "Licorera / Estanco" },
                { value: "retail", label: "Comercio / Retail" },
                { value: "service", label: "Servicios" },
                { value: "other", label: "Otros sectores" },
              ]}
            />

            {/* Filtro Estado */}
            <AdminSelect
              value={selectedStatus}
              onChange={(val) => handleStatusFilter(val)}
              options={[
                { value: "all", label: "Todos los estados" },
                { value: "active", label: "Activos" },
                { value: "trial", label: "En prueba" },
                { value: "suspended", label: "Suspendidos" },
                { value: "inactive", label: "Inactivos" },
              ]}
            />
          </>
        }
        actions={
          <Link
            href="/admin/negocios/nuevo"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ED500A] text-white text-xs font-semibold shadow-xs hover:bg-[#d44505] transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Negocio</span>
          </Link>
        }
      />

      {/* 3. TABLA Y LISTADO DE NEGOCIOS */}
      {data.businesses.length === 0 ? (
        <AdminEmptyState
          icon={Building2}
          title="No se encontraron negocios"
          description={
            searchQuery || selectedStatus !== "all" || selectedType !== "all"
              ? "No hay negocios que coincidan con los criterios de búsqueda o filtros seleccionados."
              : "Aún no se han registrado comercios o establecimientos en la plataforma."
          }
          actionHref="/admin/negocios/nuevo"
          actionLabel="Nuevo Negocio"
        />
      ) : (
        <div className="space-y-4">
          {/* Vista Desktop */}
          <div className="hidden md:block rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0E12] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                    <th className="py-3.5 px-4">Negocio</th>
                    <th className="py-3.5 px-4">Rubro / Categoría</th>
                    <th className="py-3.5 px-4">Propietario</th>
                    <th className="py-3.5 px-4">Estado</th>
                    <th className="py-3.5 px-4">Plan</th>
                    <th className="py-3.5 px-4">Colaboradores</th>
                    <th className="py-3.5 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] text-xs">
                  {data.businesses.map((biz) => {
                    const typeMeta = BUSINESS_TYPE_LABELS[biz.businessType] || BUSINESS_TYPE_LABELS.other;
                    const statusMeta = BUSINESS_STATUS_LABELS[biz.status] || BUSINESS_STATUS_LABELS.inactive;

                    return (
                      <tr
                        key={biz.id}
                        onClick={() => router.push(`/admin/negocios/${biz.id}`)}
                        className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer"
                      >
                        {/* Negocio */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-100 to-amber-50 dark:from-white/10 dark:to-white/5 border border-orange-200/60 dark:border-white/10 flex items-center justify-center text-xs font-bold text-[#ED500A] dark:text-orange-400 shrink-0">
                              {biz.logoUrl ? (
                                <img src={biz.logoUrl} alt={biz.name} className="w-full h-full object-cover rounded-xl" />
                              ) : (
                                biz.name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="space-y-0.5 min-w-0">
                              <Link
                                href={`/admin/negocios/${biz.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="font-semibold text-slate-900 dark:text-white hover:text-[#ED500A] dark:hover:text-[#ED500A] transition-colors truncate block"
                              >
                                {biz.name}
                              </Link>
                              <p className="text-[11px] text-slate-400 font-mono truncate">/{biz.slug}</p>
                            </div>
                          </div>
                        </td>

                        {/* Rubro */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${typeMeta.badgeColor}`}
                            >
                              {getTypeIcon(biz.businessType)}
                              <span>{typeMeta.categoryLabel}</span>
                            </span>
                            <p className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                              {typeMeta.label}
                            </p>
                          </div>
                        </td>

                        {/* Propietario */}
                        <td className="py-3.5 px-4">
                          {biz.owner ? (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-xs font-semibold text-slate-700 dark:text-slate-200 shrink-0">
                                {biz.owner.fullName.charAt(0).toUpperCase()}
                              </div>
                              <div className="truncate max-w-[130px]">
                                <p className="font-semibold text-slate-900 dark:text-white truncate">{biz.owner.fullName}</p>
                                <p className="text-[11px] text-slate-400 font-mono truncate">{biz.owner.email}</p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono text-xs">—</span>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="py-3.5 px-4">
                          <AdminStatusBadge
                            status={biz.status}
                            label={statusMeta.label}
                          />
                        </td>

                        {/* Plan Comercial */}
                        <td className="py-3.5 px-4">
                          {biz.plan ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-orange-500/10 text-[#ED500A] border border-orange-500/20">
                              <span>Plan {biz.plan.name}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono text-xs">—</span>
                          )}
                        </td>

                        {/* Colaboradores */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-mono">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {biz.plan?.maxUsers ? `${biz.userCount} / ${biz.plan.maxUsers}` : `${biz.userCount}`}
                            </span>
                          </div>
                        </td>

                        {/* Acciones */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              const menuWidth = 208;
                              const padding = 12;
                              let left = rect.right - menuWidth;
                              if (left + menuWidth > window.innerWidth - padding) {
                                left = window.innerWidth - menuWidth - padding;
                              }
                              if (left < padding) left = padding;

                              setMenuAnchor({
                                id: biz.id,
                                top: rect.bottom + 6,
                                left,
                                business: biz,
                              });
                            }}
                            className={`p-2 rounded-xl border transition-all cursor-pointer ${
                              menuAnchor?.id === biz.id
                                ? "bg-orange-50 dark:bg-white/10 border-orange-200 dark:border-white/20 text-[#ED500A]"
                                : "text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5"
                            }`}
                            title="Acciones del Negocio"
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

          {/* Vista Mobile / Tablet */}
          <div className="block md:hidden divide-y divide-slate-100 dark:divide-white/[0.04]">
            {data.businesses.map((biz) => {
              const typeMeta = BUSINESS_TYPE_LABELS[biz.businessType] || BUSINESS_TYPE_LABELS.other;
              const statusMeta = BUSINESS_STATUS_LABELS[biz.status] || BUSINESS_STATUS_LABELS.inactive;

              return (
                <div key={biz.id} className="p-4 space-y-3 bg-white dark:bg-[#0D0E12] border border-slate-200 dark:border-white/10 rounded-2xl mb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-[#ED500A] font-bold text-xs flex items-center justify-center shrink-0">
                        {biz.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <Link
                          href={`/admin/negocios/${biz.id}`}
                          className="font-bold text-xs text-slate-900 dark:text-white"
                        >
                          {biz.name}
                        </Link>
                        <p className="text-[11px] font-mono text-slate-400">/{biz.slug}</p>
                      </div>
                    </div>
                    <AdminStatusBadge status={biz.status} label={statusMeta.label} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-100 dark:border-white/[0.04]">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Rubro / Tipo</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {typeMeta.categoryLabel} • {typeMeta.label}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Plan</span>
                      {biz.plan ? (
                        <span className="font-semibold text-xs text-[#ED500A]">
                          Plan {biz.plan.name}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-xs">—</span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Propietario</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                        {biz.owner?.fullName || "Sin asignar"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Colaboradores</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {biz.plan?.maxUsers ? `${biz.userCount} / ${biz.plan.maxUsers}` : `${biz.userCount}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setBusinessToDelete(biz)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(biz)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>
                    <Link
                      href={`/admin/negocios/${biz.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.05] text-[11px] font-semibold text-slate-700 dark:text-slate-300"
                    >
                      <span>Ver Ficha</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 4. PAGINACIÓN REUTILIZABLE */}
          <AdminPagination
            currentPage={currentPage}
            totalPages={data.totalPages}
            totalItems={data.total}
            currentCount={data.businesses.length}
            itemLabel="negocios"
            onPageChange={handlePageChange}
            isPending={isPending}
          />
        </div>
      )}

      {/* 5. MODAL REUTILIZABLE DE EDICIÓN RÁPIDA DE NEGOCIO Y RUBRO */}
      {editModal.isOpen && editModal.business && (
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
                    Modifica la categoría, tipo de negocio, nombre e información comercial.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditModal((prev) => ({ ...prev, isOpen: false, business: null }))}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario de Edición */}
            <form onSubmit={handleSaveEditModal} className="space-y-4">
              {/* 2 Niveles: Categoría Principal y Tipo de Negocio */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.06]">
                <AdminSelect
                  label="1. Categoría Principal"
                  required
                  value={editModal.category}
                  onChange={handleEditModalCategoryChange}
                  options={BUSINESS_CATEGORIES.map((c) => ({
                    value: c.id,
                    label: c.label,
                  }))}
                  helperText="Sector macro"
                />

                <AdminSelect
                  label="2. Tipo de Negocio"
                  required
                  value={editModal.form.businessType}
                  onChange={(val) =>
                    setEditModal({
                      ...editModal,
                      form: { ...editModal.form, businessType: val as BusinessType },
                    })
                  }
                  options={(
                    BUSINESS_CATEGORIES.find((c) => c.id === editModal.category) || BUSINESS_CATEGORIES[0]
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
                value={editModal.form.name}
                onChange={(e) =>
                  setEditModal({
                    ...editModal,
                    form: { ...editModal.form, name: e.target.value },
                  })
                }
              />

              {/* Identificador Slug */}
              <AdminInput
                label="Identificador Slug"
                required
                value={editModal.form.slug}
                onChange={(e) =>
                  setEditModal({
                    ...editModal,
                    form: { ...editModal.form, slug: e.target.value },
                  })
                }
                helperText="Identificador único para URLs"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Teléfono */}
                <AdminInput
                  label="Teléfono / WhatsApp"
                  value={editModal.form.phone}
                  onChange={(e) =>
                    setEditModal({
                      ...editModal,
                      form: { ...editModal.form, phone: e.target.value },
                    })
                  }
                  placeholder="+57 300 123 4567"
                />

                {/* Email */}
                <AdminInput
                  label="Email Comercial"
                  type="email"
                  value={editModal.form.email}
                  onChange={(e) =>
                    setEditModal({
                      ...editModal,
                      form: { ...editModal.form, email: e.target.value },
                    })
                  }
                  placeholder="contacto@negocio.com"
                />
              </div>

              {/* Dirección */}
              <AdminInput
                label="Dirección"
                value={editModal.form.address}
                onChange={(e) =>
                  setEditModal({
                    ...editModal,
                    form: { ...editModal.form, address: e.target.value },
                  })
                }
                placeholder="Calle o Carrera..."
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Ciudad */}
                <AdminInput
                  label="Ciudad"
                  value={editModal.form.city}
                  onChange={(e) =>
                    setEditModal({
                      ...editModal,
                      form: { ...editModal.form, city: e.target.value },
                    })
                  }
                  placeholder="Ej: Bogotá"
                />

                {/* Departamento */}
                <AdminInput
                  label="Departamento"
                  value={editModal.form.department}
                  onChange={(e) =>
                    setEditModal({
                      ...editModal,
                      form: { ...editModal.form, department: e.target.value },
                    })
                  }
                  placeholder="Ej: Cundinamarca"
                />
              </div>

              {/* Botones de Acción */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setEditModal((prev) => ({ ...prev, isOpen: false, business: null }))}
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

      {/* 6. MODAL REUTILIZABLE DE CAMBIO DE ESTADO */}
      <AdminConfirmDialog
        isOpen={statusModal.isOpen && !!statusModal.business && !!statusModal.targetStatus}
        onClose={() => setStatusModal({ isOpen: false, business: null, targetStatus: null, reason: "" })}
        onConfirm={confirmStatusChange}
        title="Cambiar estado de negocio"
        description={
          statusModal.business && statusModal.targetStatus
            ? `¿Confirmas que deseas cambiar el estado operacional de ${statusModal.business.name} a '${BUSINESS_STATUS_LABELS[statusModal.targetStatus].label}'?`
            : ""
        }
        confirmLabel="Confirmar Cambio"
        variant={statusModal.targetStatus === "suspended" ? "destructive" : "success"}
        isLoading={isPending}
        itemDetails={
          statusModal.business
            ? [
                { label: "Negocio", value: statusModal.business.name },
                { label: "Slug", value: `/${statusModal.business.slug}` },
              ]
            : undefined
        }
        reasonValue={statusModal.reason}
        onReasonChange={(val) => setStatusModal({ ...statusModal, reason: val })}
        reasonLabel="Motivo / Justificación de Auditoría (Opcional):"
        reasonPlaceholder="Ej: Solicitud de reactivación, mora en pago, baja definitiva..."
      />

      {/* 7. MODAL DE CONFIRMACIÓN PARA ELIMINACIÓN DEFINITIVA */}
      {businessToDelete && (
        <AdminConfirmDialog
          isOpen={!!businessToDelete}
          onClose={() => setBusinessToDelete(null)}
          onConfirm={handleConfirmDelete}
          title="Eliminar Negocio Definitivamente"
          description={`¿Estás completamente seguro de que deseas eliminar permanentemente el negocio '${businessToDelete.name}' (${businessToDelete.slug})? Esta acción eliminará el tenant y todas sus vinculaciones operativas. No se puede deshacer.`}
          confirmLabel="Eliminar Definitivamente"
          cancelLabel="Cancelar"
          variant="destructive"
          isLoading={isPending}
          itemDetails={[
            { label: "Negocio", value: businessToDelete.name },
            { label: "Slug", value: `/${businessToDelete.slug}` },
            { label: "Propietario", value: businessToDelete.owner?.fullName || "Sin propietario" },
            { label: "Estado Actual", value: BUSINESS_STATUS_LABELS[businessToDelete.status].label },
          ]}
        />
      )}
      {/* 8. MENÚ FLOTANTE VÍA PORTAL (Sin alterar la altura de la tabla ni recortarse) */}
      {menuAnchor &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            data-actions-menu
            style={{ top: `${menuAnchor.top}px`, left: `${menuAnchor.left}px` }}
            className="fixed w-52 rounded-xl bg-white dark:bg-[#12141C] border border-slate-200 dark:border-white/10 shadow-2xl z-[9999] py-1 text-left ring-1 ring-black/5 dark:ring-white/10 animate-in fade-in zoom-in-95 duration-100 font-body"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 border-b border-slate-100 dark:border-white/[0.06] text-[11px] font-semibold text-slate-400 font-mono truncate">
              {menuAnchor.business.name}
            </div>

            <Link
              href={`/admin/negocios/${menuAnchor.business.id}`}
              onClick={() => setMenuAnchor(null)}
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              <Eye className="w-4 h-4 text-slate-400" />
              <span>Ver Detalle y Ficha</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                const b = menuAnchor.business;
                setMenuAnchor(null);
                openEditModal(b);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <Edit className="w-4 h-4 text-blue-500" />
              <span>Editar Negocio / Rubro</span>
            </button>

            <div className="my-1 border-t border-slate-100 dark:border-white/[0.06]" />

            {menuAnchor.business.status === "active" ? (
              <button
                type="button"
                onClick={() => {
                  const b = menuAnchor.business;
                  setMenuAnchor(null);
                  promptStatusChange(b, "suspended");
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors cursor-pointer"
              >
                <Ban className="w-4 h-4" />
                <span>Suspender Operación</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const b = menuAnchor.business;
                  setMenuAnchor(null);
                  promptStatusChange(b, "active");
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Activar Negocio</span>
              </button>
            )}

            {menuAnchor.business.status !== "inactive" && (
              <button
                type="button"
                onClick={() => {
                  const b = menuAnchor.business;
                  setMenuAnchor(null);
                  promptStatusChange(b, "inactive");
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <AlertCircle className="w-4 h-4 text-slate-400" />
                <span>Marcar como Inactivo</span>
              </button>
            )}

            <div className="my-1 border-t border-slate-100 dark:border-white/[0.06]" />

            <button
              type="button"
              onClick={() => {
                const b = menuAnchor.business;
                setMenuAnchor(null);
                setBusinessToDelete(b);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Eliminar Negocio</span>
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}
