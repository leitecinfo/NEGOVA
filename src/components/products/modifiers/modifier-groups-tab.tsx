"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  CreateModifierGroupInput,
  ModifierGroup,
  ModifierGroupKPIs,
  ModifierOption,
  ModifierStatus,
} from "@/lib/modifiers/types";
import { Category, Product } from "@/lib/products/types";
import {
  addModifierOptionAction,
  createModifierGroupAction,
  deleteModifierGroupAction,
  deleteModifierOptionAction,
  getModifierGroupsAction,
  toggleModifierGroupStatusAction,
  updateModifierGroupAction,
  updateModifierOptionAction,
  unassignProductFromGroupAction,
} from "@/app/workspace/[businessId]/productos/modifiers-actions";
import { ModifierGroupModal } from "./modifier-group-modal";
import { ModifierOptionModal } from "./modifier-option-modal";
import { SingleModifierModal } from "./single-modifier-modal";
import { ModifierGroupDetailModal } from "./modifier-group-detail-modal";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Button, Badge, KpiCard, SearchInput, Select } from "@/components/ui";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import {
  Layers,
  Sparkles,
  Search,
  ChevronRight,
  Pencil,
  Trash2,
  Power,
  RotateCcw,
  Package,
  Eye,
  Tag,
  ArrowRightLeft,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

interface ModifierGroupsTabProps {
  businessId: string;
  categories: Category[];
  products: Product[];
}

export function ModifierGroupsTab({
  businessId,
  categories,
  products,
}: ModifierGroupsTabProps) {
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [kpis, setKpis] = useState<ModifierGroupKPIs>({
    totalGroups: 0,
    activeOptions: 0,
    linkedProductsCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [requiredFilter, setRequiredFilter] = useState<"all" | "required" | "optional">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "single" | "multiple">("all");
  const [commercialTypeFilter, setCommercialTypeFilter] = useState<"all" | "additional" | "replacement">("all");

  // Paginación Canónica
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal de Detalle al hacer clic en una fila
  const [selectedDetailGroup, setSelectedDetailGroup] = useState<ModifierGroup | null>(null);

  // Modales de Creación y Edición
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null);

  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [editingSingleModifier, setEditingSingleModifier] = useState<ModifierGroup | null>(null);

  const [isOptionModalOpen, setIsOptionModalOpen] = useState(false);
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null);
  const [targetGroupName, setTargetGroupName] = useState<string>("");
  const [editingOption, setEditingOption] = useState<ModifierOption | null>(null);

  // Confirmaciones de eliminación
  const [groupToDelete, setGroupToDelete] = useState<ModifierGroup | null>(null);
  const [optionToDelete, setOptionToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Cargar datos
  const loadData = async (keepDetailId?: string) => {
    try {
      setIsLoading(true);
      const res = await getModifierGroupsAction(businessId);
      if (res.success && res.data) {
        setGroups(res.data.groups);
        setKpis(res.data.kpis);

        // Mantener sincronizado el grupo en vista de detalle si está abierto
        const activeDetailId = keepDetailId || selectedDetailGroup?.id;
        if (activeDetailId) {
          const freshGroup = res.data.groups.find((g) => g.id === activeDetailId);
          setSelectedDetailGroup(freshGroup || null);
        }
      } else {
        toast.error(res.error || "Error al cargar grupos de modificadores");
      }
    } catch (err: any) {
      toast.error(err.message || "Error al cargar modificadores");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [businessId]);

  // Filtrado reactivo por nombre de grupo o nombre de cualquiera de sus opciones
  const filteredGroups = useMemo(() => {
    return groups.filter((group) => {
      // Búsqueda por texto (nombre de grupo u opciones)
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesGroupName = group.name.toLowerCase().includes(q);
        const matchesOptionName = group.options.some((opt) =>
          opt.name.toLowerCase().includes(q)
        );
        if (!matchesGroupName && !matchesOptionName) return false;
      }

      // Estado
      if (statusFilter !== "all" && group.status !== statusFilter) {
        return false;
      }

      // Requerido
      if (requiredFilter === "required" && !group.required) return false;
      if (requiredFilter === "optional" && group.required) return false;

      // Tipo de selección
      if (typeFilter !== "all" && group.selection_type !== typeFilter) {
        return false;
      }

      // Modalidad comercial
      if (commercialTypeFilter !== "all" && group.commercial_type !== commercialTypeFilter) {
        return false;
      }

      return true;
    });
  }, [groups, search, statusFilter, requiredFilter, typeFilter, commercialTypeFilter]);

  // Restablecer a página 1 al filtrar
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, requiredFilter, typeFilter, commercialTypeFilter]);

  // Segmentación para paginación
  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / pageSize));
  const paginatedGroups = useMemo(() => {
    const from = (currentPage - 1) * pageSize;
    return filteredGroups.slice(from, from + pageSize);
  }, [filteredGroups, currentPage, pageSize]);

  const hasActiveFilters =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    requiredFilter !== "all" ||
    typeFilter !== "all" ||
    commercialTypeFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setRequiredFilter("all");
    setTypeFilter("all");
    setCommercialTypeFilter("all");
  };

  // Desasignar producto individual rápidamente del grupo
  const handleUnassignProduct = async (
    groupId: string,
    productId: string,
    productName: string
  ) => {
    try {
      const res = await unassignProductFromGroupAction(businessId, groupId, productId);
      if (res.success) {
        toast.success(`Producto «${productName}» retirado del grupo`);
        await loadData(groupId);
      } else {
        toast.error(res.error || "No se pudo retirar el producto del grupo");
      }
    } catch (err: any) {
      toast.error(err.message || "Error al retirar producto");
    }
  };

  // Guardar Grupo Completo (Crear o Editar)
  const handleSaveGroup = async (data: CreateModifierGroupInput) => {
    if (editingGroup) {
      const res = await updateModifierGroupAction(businessId, editingGroup.id, data);
      if (res.success) {
        toast.success("Grupo de modificadores actualizado correctamente");
        await loadData(editingGroup.id);
      } else {
        throw new Error(res.error || "No se pudo actualizar el grupo");
      }
    } else {
      const res = await createModifierGroupAction(businessId, data);
      if (res.success && res.data) {
        toast.success("Grupo de modificadores creado correctamente");
        await loadData(res.data.id);
      } else {
        throw new Error(res.error || "No se pudo crear el grupo");
      }
    }
  };

  // Guardar Modificador Individual (Crear o Editar)
  const handleSaveSingleModifier = async (data: CreateModifierGroupInput) => {
    if (editingSingleModifier) {
      const res = await updateModifierGroupAction(businessId, editingSingleModifier.id, data);
      if (res.success) {
        toast.success("Modificador actualizado correctamente");
        await loadData(editingSingleModifier.id);
      } else {
        throw new Error(res.error || "No se pudo actualizar el modificador");
      }
    } else {
      const res = await createModifierGroupAction(businessId, data);
      if (res.success && res.data) {
        toast.success(
          data.product_ids && data.product_ids.length > 0
            ? "Modificador creado y asignado a productos"
            : "Modificador creado correctamente"
        );
        await loadData(res.data.id);
      } else {
        throw new Error(res.error || "No se pudo crear el modificador");
      }
    }
  };

  // Convertir modificador individual a grupo completo
  const handleConvertToGroup = (group: ModifierGroup) => {
    setEditingGroup(group);
    setIsGroupModalOpen(true);
  };

  // Confirmar eliminación de grupo
  const handleConfirmDeleteGroup = async () => {
    if (!groupToDelete) return;
    try {
      setIsDeleting(true);
      const res = await deleteModifierGroupAction(businessId, groupToDelete.id);
      if (res.success) {
        toast.success(`Grupo «${groupToDelete.name}» eliminado`);
        if (selectedDetailGroup?.id === groupToDelete.id) {
          setSelectedDetailGroup(null);
        }
        setGroupToDelete(null);
        await loadData();
      } else {
        toast.error(res.error || "Error al eliminar el grupo");
      }
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar el grupo");
    } finally {
      setIsDeleting(false);
    }
  };

  // Alternar estado de grupo
  const handleToggleGroupStatus = async (group: ModifierGroup) => {
    const nextStatus: ModifierStatus = group.status === "active" ? "inactive" : "active";
    try {
      const res = await toggleModifierGroupStatusAction(businessId, group.id, nextStatus);
      if (res.success) {
        toast.success(
          nextStatus === "active"
            ? `Grupo «${group.name}» activado`
            : `Grupo «${group.name}» pausado`
        );
        await loadData(group.id);
      } else {
        toast.error(res.error || "Error al cambiar estado");
      }
    } catch (err: any) {
      toast.error(err.message || "Error al cambiar estado");
    }
  };

  // Guardar Opción individual (Crear o Editar)
  const handleSaveOption = async (data: {
    name: string;
    price: number;
    status: ModifierStatus;
  }) => {
    if (!targetGroupId) return;

    if (editingOption) {
      const res = await updateModifierOptionAction(businessId, editingOption.id, data);
      if (res.success) {
        toast.success("Opción actualizada");
        await loadData(targetGroupId);
      } else {
        throw new Error(res.error || "Error al actualizar opción");
      }
    } else {
      const res = await addModifierOptionAction(businessId, targetGroupId, data);
      if (res.success) {
        toast.success("Opción agregada al grupo");
        await loadData(targetGroupId);
      } else {
        throw new Error(res.error || "Error al agregar opción");
      }
    }
  };

  // Alternar estado de opción rápida
  const handleToggleOptionStatus = async (opt: ModifierOption) => {
    const nextStatus: ModifierStatus = opt.status === "active" ? "inactive" : "active";
    try {
      const res = await updateModifierOptionAction(businessId, opt.id, {
        status: nextStatus,
      });
      if (res.success) {
        toast.success(
          nextStatus === "active"
            ? `Opción «${opt.name}» activada`
            : `Opción «${opt.name}» pausada`
        );
        await loadData(selectedDetailGroup?.id);
      } else {
        toast.error(res.error || "Error al actualizar estado");
      }
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar estado");
    }
  };

  // Confirmar eliminación de opción
  const handleConfirmDeleteOption = async () => {
    if (!optionToDelete) return;
    try {
      setIsDeleting(true);
      const res = await deleteModifierOptionAction(businessId, optionToDelete.id);
      if (res.success) {
        toast.success(`Opción «${optionToDelete.name}» eliminada`);
        setOptionToDelete(null);
        await loadData(selectedDetailGroup?.id);
      } else {
        toast.error(res.error || "Error al eliminar la opción");
      }
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar la opción");
    } finally {
      setIsDeleting(false);
    }
  };

  // Definición de Columnas de la Tabla Canónica
  const columns: DataTableColumn<ModifierGroup>[] = [
    {
      header: "Modificador / Grupo",
      accessor: "name",
      render: (group) => {
        const isSingleModifier =
          group.options.length === 1 && group.max_select === 1 && !group.required;

        return (
          <div className="space-y-1 py-1 max-w-xs sm:max-w-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                {group.name}
              </span>

              {group.commercial_type === "replacement" ? (
                <Badge variant="blue" size="sm" icon={<ArrowRightLeft className="w-2.5 h-2.5" />}>
                  Reemplazo
                </Badge>
              ) : group.commercial_type === "size" ? (
                <Badge variant="slate" size="sm">
                  Tamaño
                </Badge>
              ) : (
                <Badge variant="orange" size="sm" icon={<Tag className="w-2.5 h-2.5" />}>
                  Adicional
                </Badge>
              )}

              {isSingleModifier && (
                <Badge variant="emerald" size="sm" icon={<Sparkles className="w-2.5 h-2.5" />}>
                  Individual
                </Badge>
              )}
            </div>

            {group.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {group.description}
              </p>
            )}
          </div>
        );
      },
    },
    {
      header: "Reglas de Selección",
      render: (group) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant={group.required ? "amber" : "slate"} size="sm">
            {group.required ? "Obligatorio" : "Opcional"}
          </Badge>
          <Badge variant="slate" size="sm">
            {group.selection_type === "single"
              ? "Única (Radio)"
              : `Múltiple (Máx ${group.max_select})`}
          </Badge>
          <span className="text-[10px] font-mono font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.04] px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-white/[0.06]">
            {group.min_select} - {group.max_select}
          </span>
        </div>
      ),
    },
    {
      header: "Opciones",
      render: (group) => {
        const activeCount = group.options.filter((o) => o.status === "active").length;
        return (
          <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="font-semibold">{group.options.length}</span>
            <span className="text-slate-400 text-[11px]">({activeCount} activas)</span>
          </div>
        );
      },
    },
    {
      header: "Productos",
      render: (group) => {
        const count = group.applied_product_ids.length;
        return (
          <div className="flex items-center gap-1.5 text-xs">
            <Package
              className={`w-3.5 h-3.5 shrink-0 ${
                count > 0 ? "text-[#ED500A]" : "text-slate-400"
              }`}
            />
            <span
              className={
                count > 0
                  ? "font-semibold text-slate-800 dark:text-slate-200"
                  : "text-slate-400"
              }
            >
              {count === 0
                ? "Sin vincular"
                : `${count} ${count === 1 ? "producto" : "productos"}`}
            </span>
          </div>
        );
      },
    },
    {
      header: "Estado",
      align: "center",
      render: (group) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleToggleGroupStatus(group);
          }}
          className="cursor-pointer"
          title={group.status === "active" ? "Pausar grupo" : "Activar grupo"}
        >
          <Badge
            size="sm"
            variant={group.status === "active" ? "emerald" : "slate"}
            dot
          >
            {group.status === "active" ? "Activo" : "Pausado"}
          </Badge>
        </button>
      ),
    },
    {
      header: "Acciones",
      align: "center",
      render: (group) => {
        const isSingleModifier =
          group.options.length === 1 && group.max_select === 1 && !group.required;

        return (
          <div
            className="flex items-center justify-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedDetailGroup(group)}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
              title="Ver detalle del modificador"
            >
              <Eye className="w-4 h-4 text-[#ED500A]" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (isSingleModifier) {
                  setEditingSingleModifier(group);
                  setIsSingleModalOpen(true);
                } else {
                  setEditingGroup(group);
                  setIsGroupModalOpen(true);
                }
              }}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
              title="Editar configuración"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setGroupToDelete(group)}
              className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Eliminar grupo"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      },
    },
  ];

  // Render para Tarjetas Móviles
  const renderMobileCard = (group: ModifierGroup) => {
    const isSingleModifier =
      group.options.length === 1 && group.max_select === 1 && !group.required;
    const activeCount = group.options.filter((o) => o.status === "active").length;

    return (
      <div
        onClick={() => setSelectedDetailGroup(group)}
        className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs space-y-3 cursor-pointer hover:border-[#ED500A]/40 transition-colors"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              {group.name}
            </h4>
            {group.description && (
              <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                {group.description}
              </p>
            )}
          </div>
          <Badge
            size="sm"
            variant={group.status === "active" ? "emerald" : "slate"}
            dot
          >
            {group.status === "active" ? "Activo" : "Pausado"}
          </Badge>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {group.commercial_type === "replacement" ? (
            <Badge variant="blue" size="sm">
              Reemplazo
            </Badge>
          ) : (
            <Badge variant="orange" size="sm">
              Adicional
            </Badge>
          )}
          {isSingleModifier && (
            <Badge variant="emerald" size="sm">
              Individual
            </Badge>
          )}
          <Badge variant={group.required ? "amber" : "slate"} size="sm">
            {group.required ? "Obligatorio" : "Opcional"}
          </Badge>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-white/[0.04]">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            {group.options.length} opciones ({activeCount} activas)
          </span>
          <span className="text-[#ED500A] font-semibold inline-flex items-center gap-0.5">
            Ver detalles <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* 0. CABECERA PRINCIPAL CON ACCIONES DESTACADAS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#ED500A]/10 border border-[#ED500A]/20 flex items-center justify-center text-[#ED500A] shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Modificadores y Personalización
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Crea modificadores individuales o grupos de opciones para personalizar tus productos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
          <Button
            variant="primary"
            onClick={() => {
              setEditingSingleModifier(null);
              setIsSingleModalOpen(true);
            }}
            title="Crear un modificador o adicional individual (ej. Queso extra, Tocineta)"
          >
            <Sparkles className="w-4 h-4" />
            <span>Nuevo modificador</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              setEditingGroup(null);
              setIsGroupModalOpen(true);
            }}
            title="Crear un grupo con múltiples opciones (ej. Tamaños, Presentaciones, Opciones de personalización)"
          >
            <Layers className="w-4 h-4 text-[#ED500A]" />
            <span>Nuevo grupo</span>
          </Button>
        </div>
      </div>

      {/* 1. KPIS SUPERIORES (CANÓNICOS DEL SISTEMA DE DISEÑO) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <KpiCard
          title="Total Grupos"
          value={kpis.totalGroups}
          subtext="Contenedores de personalización"
          icon={<Layers className="w-5 h-5 text-slate-700 dark:text-slate-300" />}
          variant="default"
        />

        <KpiCard
          title="Opciones Activas"
          value={kpis.activeOptions}
          subtext="Modificadores listos para venta"
          icon={<Sparkles className="w-5 h-5" />}
          variant="emerald"
        />

        <KpiCard
          title="Productos Vinculados"
          value={kpis.linkedProductsCount}
          subtext="Productos con modificadores"
          icon={<Package className="w-5 h-5" />}
          variant="orange"
        />
      </div>

      {/* 2. BARRA DE HERRAMIENTAS: BÚSQUEDA Y FILTROS */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-3 sm:p-4 shadow-xs">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <div className="flex-1 min-w-[200px] sm:min-w-[260px]">
            <SearchInput
              value={search}
              onChange={setSearch}
              onClear={() => setSearch("")}
              placeholder="Buscar por grupo u opción (ej: Tamaño, Extra, Color)..."
            />
          </div>

          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-auto min-w-[150px]"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </Select>

          <Select
            value={requiredFilter}
            onChange={(e) => setRequiredFilter(e.target.value as any)}
            className="w-auto min-w-[160px]"
          >
            <option value="all">Obligatorio / Opcional</option>
            <option value="required">Obligatorios (Mín 1)</option>
            <option value="optional">Opcionales (Mín 0)</option>
          </Select>

          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="w-auto min-w-[160px]"
          >
            <option value="all">Tipo de selección</option>
            <option value="single">Única (Radio, Máx 1)</option>
            <option value="multiple">Múltiple (Checkboxes)</option>
          </Select>

          <Select
            value={commercialTypeFilter}
            onChange={(e) => setCommercialTypeFilter(e.target.value as any)}
            className="w-auto min-w-[170px]"
          >
            <option value="all">Todas las modalidades</option>
            <option value="additional">Adicionales / Extras</option>
            <option value="replacement">Reemplazos / Sustituciones</option>
          </Select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
              title="Restablecer filtros"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. TABLA CANÓNICA DE MODIFICADORES (DATATABLE CON PAGINACIÓN) */}
      <DataTable
        columns={columns}
        data={paginatedGroups}
        keyExtractor={(group) => group.id}
        isLoading={isLoading}
        onRowClick={(group) => setSelectedDetailGroup(group)}
        renderMobileCard={renderMobileCard}
        pagination={{
          currentPage,
          totalPages,
          totalItems: filteredGroups.length,
          pageSize,
          pageSizeOptions: [10, 20, 50],
          itemLabel: "modificadores",
          onPageChange: (page) => setCurrentPage(page),
          onPageSizeChange: (size) => {
            setPageSize(size);
            setCurrentPage(1);
          },
        }}
        emptyState={{
          title: hasActiveFilters
            ? "No se encontraron modificadores con los filtros aplicados"
            : "No tienes grupos de modificadores creados",
          description: hasActiveFilters
            ? "Intenta modificar el término de búsqueda o limpia los filtros activos."
            : "Crea modificadores o grupos de opciones (ej. Tamaños, Adicionales, Variantes) para que tus clientes personalicen sus productos.",
          icon: Layers,
          actionLabel: !hasActiveFilters ? "Nuevo modificador" : undefined,
          onAction: !hasActiveFilters
            ? () => {
                setEditingSingleModifier(null);
                setIsSingleModalOpen(true);
              }
            : undefined,
          resetLabel: hasActiveFilters ? "Limpiar filtros" : undefined,
          onReset: hasActiveFilters ? clearFilters : undefined,
        }}
      />

      {/* MODAL DE DETALLE COMPLETO (AL HACER CLIC EN CUALQUIER FILA) */}
      {selectedDetailGroup && (
        <ModifierGroupDetailModal
          isOpen={Boolean(selectedDetailGroup)}
          onClose={() => setSelectedDetailGroup(null)}
          group={selectedDetailGroup}
          products={products}
          onEdit={(group) => {
            const isSingleModifier =
              group.options.length === 1 && group.max_select === 1 && !group.required;
            if (isSingleModifier) {
              setEditingSingleModifier(group);
              setIsSingleModalOpen(true);
            } else {
              setEditingGroup(group);
              setIsGroupModalOpen(true);
            }
          }}
          onDelete={(group) => setGroupToDelete(group)}
          onConvertToGroup={handleConvertToGroup}
          onAddOption={(groupId, groupName) => {
            setTargetGroupId(groupId);
            setTargetGroupName(groupName);
            setEditingOption(null);
            setIsOptionModalOpen(true);
          }}
          onEditOption={(groupId, groupName, option) => {
            setTargetGroupId(groupId);
            setTargetGroupName(groupName);
            setEditingOption(option);
            setIsOptionModalOpen(true);
          }}
          onDeleteOption={(optionId, optionName) => {
            setOptionToDelete({ id: optionId, name: optionName });
          }}
          onToggleOptionStatus={handleToggleOptionStatus}
          onToggleGroupStatus={handleToggleGroupStatus}
          onUnassignProduct={handleUnassignProduct}
        />
      )}

      {/* MODAL CREAR / EDITAR MODIFICADOR INDIVIDUAL */}
      {isSingleModalOpen && (
        <SingleModifierModal
          isOpen={isSingleModalOpen}
          businessId={businessId}
          categories={categories}
          products={products}
          modifier={editingSingleModifier}
          onClose={() => setIsSingleModalOpen(false)}
          onSave={handleSaveSingleModifier}
          onConvertToGroup={handleConvertToGroup}
        />
      )}

      {/* MODAL CREAR / EDITAR GRUPO DE MODIFICADORES */}
      {isGroupModalOpen && (
        <ModifierGroupModal
          isOpen={isGroupModalOpen}
          businessId={businessId}
          categories={categories}
          products={products}
          group={editingGroup}
          onClose={() => setIsGroupModalOpen(false)}
          onSave={handleSaveGroup}
        />
      )}

      {/* MODAL CREAR / EDITAR OPCIÓN INDIVIDUAL */}
      {isOptionModalOpen && (
        <ModifierOptionModal
          isOpen={isOptionModalOpen}
          groupId={targetGroupId || ""}
          groupName={targetGroupName}
          option={editingOption}
          onClose={() => setIsOptionModalOpen(false)}
          onSave={handleSaveOption}
        />
      )}

      {/* MODAL CONFIRMAR ELIMINACIÓN DE GRUPO */}
      {groupToDelete && (
        <ConfirmModal
          isOpen={Boolean(groupToDelete)}
          title={`¿Eliminar grupo «${groupToDelete.name}»?`}
          description="Esta acción eliminará el grupo y todas sus opciones configuradas. Los productos vinculados dejarán de mostrar este modificador en caja y tienda en línea."
          confirmText="Sí, eliminar grupo"
          cancelText="Cancelar"
          variant="destructive"
          isLoading={isDeleting}
          onConfirm={handleConfirmDeleteGroup}
          onClose={() => setGroupToDelete(null)}
        />
      )}

      {/* MODAL CONFIRMAR ELIMINACIÓN DE OPCIÓN */}
      {optionToDelete && (
        <ConfirmModal
          isOpen={Boolean(optionToDelete)}
          title={`¿Eliminar opción «${optionToDelete.name}»?`}
          description="Esta opción será retirada permanentemente de este grupo de modificadores."
          confirmText="Sí, eliminar opción"
          cancelText="Cancelar"
          variant="destructive"
          isLoading={isDeleting}
          onConfirm={handleConfirmDeleteOption}
          onClose={() => setOptionToDelete(null)}
        />
      )}
    </div>
  );
}
