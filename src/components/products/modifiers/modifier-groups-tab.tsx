"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  CreateModifierGroupInput,
  ModifierGroup,
  ModifierGroupKPIs,
  ModifierOption,
  ModifierStatus,
  UpdateModifierGroupInput,
} from "@/lib/modifiers/types";
import { Category, Product } from "@/lib/products/types";
import { formatCOP } from "@/lib/pos/types";
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
import { ConfirmModal } from "@/components/ui/confirm-modal";
import {
  Layers,
  Sparkles,
  Plus,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Power,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Package,
  SlidersHorizontal,
  Check,
  FolderTree,
  Loader2,
  Tag,
  CheckSquare,
  ArrowRightLeft,
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

  // Estado del acordeón (qué grupos están expandidos)
  const [expandedGroupIds, setExpandedGroupIds] = useState<Record<string, boolean>>({});

  // Modales
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
  const loadData = async () => {
    try {
      setIsLoading(true);
      const res = await getModifierGroupsAction(businessId);
      if (res.success && res.data) {
        setGroups(res.data.groups);
        setKpis(res.data.kpis);

        // Expandir por defecto el primer grupo si hay datos
        if (res.data.groups.length > 0 && Object.keys(expandedGroupIds).length === 0) {
          setExpandedGroupIds({ [res.data.groups[0].id]: true });
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

  // Manejo de acordeón
  const toggleGroupAccordion = (groupId: string) => {
    setExpandedGroupIds((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    groups.forEach((g) => {
      all[g.id] = true;
    });
    setExpandedGroupIds(all);
  };

  const collapseAll = () => {
    setExpandedGroupIds({});
  };

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
        await loadData();
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
        await loadData();
      } else {
        throw new Error(res.error || "No se pudo actualizar el grupo");
      }
    } else {
      const res = await createModifierGroupAction(businessId, data);
      if (res.success && res.data) {
        toast.success("Grupo de modificadores creado correctamente");
        setExpandedGroupIds((prev) => ({ ...prev, [res.data!.id]: true }));
        await loadData();
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
        await loadData();
      } else {
        throw new Error(res.error || "No se pudo actualizar el modificador");
      }
    } else {
      const res = await createModifierGroupAction(businessId, data);
      if (res.success && res.data) {
        toast.success(data.product_ids && data.product_ids.length > 0 ? "Modificador creado y asignado a productos" : "Modificador creado correctamente");
        setExpandedGroupIds((prev) => ({ ...prev, [res.data!.id]: true }));
        await loadData();
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
        await loadData();
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
        await loadData();
      } else {
        throw new Error(res.error || "Error al actualizar opción");
      }
    } else {
      const res = await addModifierOptionAction(businessId, targetGroupId, data);
      if (res.success) {
        toast.success("Opción agregada al grupo");
        await loadData();
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
        await loadData();
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
        await loadData();
      } else {
        toast.error(res.error || "Error al eliminar la opción");
      }
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar la opción");
    } finally {
      setIsDeleting(false);
    }
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
          {/* Botón 1: Nuevo Modificador (Individual) */}
          <button
            type="button"
            onClick={() => {
              setEditingSingleModifier(null);
              setIsSingleModalOpen(true);
            }}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#ED500A] hover:bg-[#ED500A]/90 active:scale-[0.99] text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer"
            title="Crear un modificador o adicional individual (ej. Queso extra, Tocineta)"
          >
            <Sparkles className="w-4 h-4" />
            <span>+ Nuevo modificador</span>
          </button>

          {/* Botón 2: Nuevo Grupo (Múltiples opciones) */}
          <button
            type="button"
            onClick={() => {
              setEditingGroup(null);
              setIsGroupModalOpen(true);
            }}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-[0.99]"
            title="Crear un grupo con múltiples opciones (ej. Tamaños, Presentaciones, Opciones de personalización)"
          >
            <Layers className="w-4 h-4 text-[#ED500A]" />
            <span>+ Nuevo grupo</span>
          </button>
        </div>
      </div>

      {/* 1. KPIS SUPERIORES */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Total Grupos */}
        <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
              Total Grupos
            </span>
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 block">
              {kpis.totalGroups}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Contenedores de personalización
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Opciones Activas */}
        <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
              Opciones Activas
            </span>
            <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">
              {kpis.activeOptions}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Modificadores listos para venta
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        {/* Productos Vinculados */}
        <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
              Productos Vinculados
            </span>
            <span className="text-2xl font-bold font-mono text-[#ED500A] mt-1 block">
              {kpis.linkedProductsCount}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Productos con modificadores
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. BARRA DE HERRAMIENTAS: BÚSQUEDA, FILTROS Y ACCIÓN NUEVO GRUPO */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-3 sm:p-4 shadow-xs">
        {/* Buscador y Filtros */}
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          {/* Buscador */}
          <div className="relative flex-1 min-w-[200px] sm:min-w-[260px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por grupo u opción (ej: Tamaño, Extra, Color)..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtro Estado */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 rounded-xl text-xs focus:outline-hidden cursor-pointer"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>

          {/* Filtro Requerido */}
          <select
            value={requiredFilter}
            onChange={(e) => setRequiredFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 rounded-xl text-xs focus:outline-hidden cursor-pointer"
          >
            <option value="all">Obligatorio / Opcional</option>
            <option value="required">Obligatorios (Mín 1)</option>
            <option value="optional">Opcionales (Mín 0)</option>
          </select>

          {/* Filtro Selección */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 rounded-xl text-xs focus:outline-hidden cursor-pointer"
          >
            <option value="all">Tipo de selección</option>
            <option value="single">Única (Radio, Máx 1)</option>
            <option value="multiple">Múltiple (Checkboxes)</option>
          </select>

          {/* Filtro Modalidad */}
          <select
            value={commercialTypeFilter}
            onChange={(e) => setCommercialTypeFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 rounded-xl text-xs focus:outline-hidden cursor-pointer"
          >
            <option value="all">Todas las modalidades</option>
            <option value="additional">Adicionales / Extras</option>
            <option value="replacement">Reemplazos / Sustituciones</option>
          </select>

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

        {/* Acciones Globales */}
        <div className="flex items-center gap-2 justify-end shrink-0">
          <div className="hidden sm:flex items-center gap-1 border-r border-slate-200/80 dark:border-white/[0.08] pr-2">
            <button
              onClick={expandAll}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
              title="Expandir todos los grupos"
            >
              Expandir todos
            </button>
            <button
              onClick={collapseAll}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
              title="Colapsar todos los grupos"
            >
              Colapsar
            </button>
          </div>

          {/* Botón 1: Nuevo Modificador (Creación individual rápida) */}
          <button
            type="button"
            onClick={() => {
              setEditingSingleModifier(null);
              setIsSingleModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#ED500A] hover:bg-[#ED500A]/90 active:scale-[0.99] text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer shrink-0"
            title="Crear un modificador o adicional individual rápidamente (ej. Queso extra, Tocineta)"
          >
            <Sparkles className="w-4 h-4" />
            <span>+ Nuevo modificador</span>
          </button>

          {/* Botón 2: Nuevo Grupo (Creación de grupo con varias opciones) */}
          <button
            type="button"
            onClick={() => {
              setEditingGroup(null);
              setIsGroupModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 active:scale-[0.99]"
            title="Crear un grupo con múltiples opciones y reglas avanzadas"
          >
            <Layers className="w-4 h-4 text-[#ED500A]" />
            <span>+ Nuevo grupo</span>
          </button>
        </div>
      </div>

      {/* 3. VISTA TIPO ACORDEÓN / TABLA CON SUBFILAS */}
      {isLoading ? (
        <div className="p-12 text-center bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl space-y-3">
          <Loader2 className="w-7 h-7 animate-spin text-[#ED500A] mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Cargando grupos de modificadores...</p>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="p-10 text-center bg-white dark:bg-[#0D0F16] border border-dashed border-slate-200/80 dark:border-white/[0.08] rounded-2xl space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {hasActiveFilters
                ? "No se encontraron modificadores con los filtros aplicados"
                : "No tienes grupos de modificadores creados"}
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              {hasActiveFilters
                ? "Intenta modificar el término de búsqueda o limpia los filtros activos."
                : "Crea modificadores o grupos de opciones (ej. Tamaños, Adicionales, Variantes) para que tus clientes personalicen sus productos."}
            </p>
          </div>
          {!hasActiveFilters && (
            <div className="flex items-center justify-center gap-2.5 flex-wrap mt-2">
              <button
                type="button"
                onClick={() => {
                  setEditingSingleModifier(null);
                  setIsSingleModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>+ Nuevo modificador</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingGroup(null);
                  setIsGroupModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <Layers className="w-4 h-4 text-[#ED500A]" />
                <span>+ Nuevo grupo</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => {
            const isExpanded = Boolean(expandedGroupIds[group.id]);
            const activeOptionsCount = group.options.filter((o) => o.status === "active").length;
            const isSingleModifier =
              group.options.length === 1 && group.max_select === 1 && !group.required;

            // Nombres de los productos vinculados
            const linkedProducts = products.filter((p) =>
              group.applied_product_ids.includes(p.id)
            );

            return (
              <div
                key={group.id}
                className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xs overflow-hidden transition-all"
              >
                {/* FILA PRINCIPAL: ACORDEÓN / GRUPO */}
                <div
                  className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    isExpanded
                      ? "bg-purple-500/[0.03] dark:bg-purple-500/[0.06] border-b border-slate-200/60 dark:border-white/[0.06]"
                      : "hover:bg-slate-50/70 dark:hover:bg-white/[0.02]"
                  }`}
                >
                  {/* Lado izquierdo: Botón expandir, Nombre, Reglas y Badges */}
                  <div
                    onClick={() => toggleGroupAccordion(group.id)}
                    className="flex items-start sm:items-center gap-3 flex-1 cursor-pointer select-none"
                  >
                    <button
                      type="button"
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-transform mt-0.5 sm:mt-0"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </button>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                          {group.name}
                        </h4>

                        {/* Modalidad Comercial */}
                        {group.commercial_type === "replacement" ? (
                          <span className="text-2xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 inline-flex items-center gap-1">
                            <ArrowRightLeft className="w-2.5 h-2.5" />
                            <span>Reemplazo</span>
                          </span>
                        ) : group.commercial_type === "size" ? (
                          <span className="text-2xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 inline-flex items-center gap-1">
                            <span>Tamaño (Legacy)</span>
                          </span>
                        ) : (
                          <span className="text-2xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20 inline-flex items-center gap-1">
                            <Tag className="w-2.5 h-2.5" />
                            <span>Adicional</span>
                          </span>
                        )}

                        {/* Indicador de Modificador Individual vs Grupo de Opciones */}
                        {isSingleModifier && (
                          <span className="text-2xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 inline-flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>Modificador individual</span>
                          </span>
                        )}

                        {/* Badge de Obligatorio / Opcional */}
                        <span
                          className={`text-2xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            group.required
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                              : "bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {group.required ? "Obligatorio" : "Opcional"}
                        </span>

                        {/* Badge de Tipo de Selección */}
                        <span
                          className={`text-2xs px-2 py-0.5 rounded-full font-semibold ${
                            group.selection_type === "single"
                              ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20"
                              : "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20"
                          }`}
                        >
                          {group.selection_type === "single"
                            ? "Única (Radio, Máx 1)"
                            : `Múltiple (Checkboxes, Máx ${group.max_select})`}
                        </span>

                        {/* Regla Min / Max */}
                        <span className="text-2xs font-mono font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.04] px-2 py-0.5 rounded-md">
                          Mín: {group.min_select} · Máx: {group.max_select}
                        </span>
                      </div>

                      {group.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                          {group.description}
                        </p>
                      )}

                      {/* Resumen de opciones y productos vinculados */}
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                          <span>
                            {group.options.length}{" "}
                            {group.options.length === 1 ? "opción" : "opciones"} (
                            {activeOptionsCount} activas)
                          </span>
                        </span>

                        <span>·</span>

                        <span
                          className={`inline-flex items-center gap-1 font-medium ${
                            linkedProducts.length === 0
                              ? "text-slate-400 dark:text-slate-500"
                              : "text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          <Package className={`w-3.5 h-3.5 ${linkedProducts.length === 0 ? "text-slate-400" : "text-[#ED500A]"}`} />
                          <span>
                            {linkedProducts.length === 0
                              ? "Sin productos vinculados"
                              : `${linkedProducts.length} ${
                                  linkedProducts.length === 1
                                    ? "producto vinculado"
                                    : "productos vinculados"
                                }`}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Lado derecho: Acciones del Grupo */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    {/* Botón para convertir modificador individual en grupo */}
                    {isSingleModifier && (
                      <button
                        type="button"
                        onClick={() => handleConvertToGroup(group)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/20 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                        title="Añadir más opciones para convertirlo en un grupo completo de modificadores"
                      >
                        <Layers className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        <span className="hidden md:inline">Convertir en grupo</span>
                      </button>
                    )}

                    {!isSingleModifier && (
                      <button
                        type="button"
                        onClick={() => {
                          setTargetGroupId(group.id);
                          setTargetGroupName(group.name);
                          setEditingOption(null);
                          setIsOptionModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                        title="Añadir opción rápida a este grupo"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#ED500A]" />
                        <span className="hidden md:inline">Añadir opción</span>
                      </button>
                    )}

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
                      className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
                      title={
                        isSingleModifier
                          ? "Editar modificador individual y asignación a productos"
                          : "Editar grupo de modificadores y productos asignados"
                      }
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleGroupStatus(group)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        group.status === "active"
                          ? "text-emerald-600 hover:bg-emerald-500/10"
                          : "text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/[0.06]"
                      }`}
                      title={group.status === "active" ? "Pausar todo el grupo" : "Activar grupo"}
                    >
                      <Power className="w-4 h-4" />
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
                </div>

                {/* SUBFILAS EXPANDIDAS: TABLA DE OPCIONES DEL GRUPO */}
                {isExpanded && (
                  <div className="p-3.5 sm:p-5 space-y-4 bg-slate-50/40 dark:bg-white/[0.01]">
                    {/* Tabla de opciones */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16]">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/[0.08] text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                            <th className="py-2.5 px-3 w-10 text-center">#</th>
                            <th className="py-2.5 px-4 min-w-[200px]">Nombre de la opción</th>
                            <th className="py-2.5 px-4 text-right">Ajuste de Precio</th>
                            <th className="py-2.5 px-4 text-center">Estado</th>
                            <th className="py-2.5 px-4 text-center w-24">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                          {group.options.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-6 text-center text-slate-500">
                                Sin opciones configuradas en este grupo.{" "}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTargetGroupId(group.id);
                                    setTargetGroupName(group.name);
                                    setEditingOption(null);
                                    setIsOptionModalOpen(true);
                                  }}
                                  className="text-[#ED500A] font-semibold hover:underline cursor-pointer"
                                >
                                  + Añadir primera opción
                                </button>
                              </td>
                            </tr>
                          ) : (
                            group.options.map((opt, oIdx) => {
                              const isPositivePrice = opt.price > 0;

                              return (
                                <tr
                                  key={opt.id}
                                  className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors"
                                >
                                  <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                                    {oIdx + 1}
                                  </td>
                                  <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">
                                    {opt.name}
                                  </td>
                                  <td className="py-2.5 px-4 text-right">
                                    {isPositivePrice ? (
                                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                        +{formatCOP(opt.price)}
                                      </span>
                                    ) : (
                                      <span className="font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.04] px-2 py-0.5 rounded-md">
                                        $0 COP (Sin recargo)
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-4 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleOptionStatus(opt)}
                                      className={`px-2.5 py-1 rounded-full text-2xs font-bold transition-all cursor-pointer ${
                                        opt.status === "active"
                                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                          : "bg-slate-200 dark:bg-white/10 text-slate-500"
                                      }`}
                                    >
                                      {opt.status === "active" ? "Activo" : "Inactivo"}
                                    </button>
                                  </td>
                                  <td className="py-2.5 px-4 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setTargetGroupId(group.id);
                                          setTargetGroupName(group.name);
                                          setEditingOption(opt);
                                          setIsOptionModalOpen(true);
                                        }}
                                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
                                        title="Editar opción"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setOptionToDelete({ id: opt.id, name: opt.name })
                                        }
                                        className="p-1 text-slate-400 hover:text-rose-500 rounded-md hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
                                        title="Eliminar opción"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Resumen de Productos donde aplica */}
                    <div className="p-3 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          Aplica en:
                        </span>
                        {linkedProducts.length === 0 ? (
                          <span className="text-xs text-amber-600 dark:text-amber-400 italic">
                            No está vinculado a ningún producto todavía.
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {linkedProducts.slice(0, 6).map((p) => (
                              <span
                                key={p.id}
                                className="inline-flex items-center gap-1 text-[11px] pl-2 pr-1.5 py-0.5 bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 rounded-md font-medium group/pbadge"
                              >
                                <Package className="w-3 h-3 text-[#ED500A]" />
                                <span>{p.name}</span>
                                <button
                                  type="button"
                                  onClick={() => handleUnassignProduct(group.id, p.id, p.name)}
                                  className="ml-0.5 text-slate-400 hover:text-rose-500 rounded cursor-pointer"
                                  title={`Retirar grupo de «${p.name}»`}
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </span>
                            ))}
                            {linkedProducts.length > 6 && (
                              <span className="text-[11px] px-2 py-0.5 bg-[#ED500A]/10 text-[#ED500A] rounded-md font-bold">
                                +{linkedProducts.length - 6} más
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingGroup(group);
                          setIsGroupModalOpen(true);
                        }}
                        className="text-xs font-semibold text-[#ED500A] hover:underline self-end sm:self-auto cursor-pointer"
                      >
                        Gestionar productos vinculados →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
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

      {/* MODAL CREAR / EDITAR GRUPO */}
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
      {isOptionModalOpen && targetGroupId && (
        <ModifierOptionModal
          isOpen={isOptionModalOpen}
          groupId={targetGroupId}
          groupName={targetGroupName}
          option={editingOption}
          onClose={() => setIsOptionModalOpen(false)}
          onSave={handleSaveOption}
        />
      )}

      {/* MODAL CONFIRMAR ELIMINACIÓN DE GRUPO */}
      <ConfirmModal
        isOpen={Boolean(groupToDelete)}
        onClose={() => setGroupToDelete(null)}
        onConfirm={handleConfirmDeleteGroup}
        title="¿Eliminar grupo de modificadores?"
        description={`¿Estás seguro de que deseas eliminar «${groupToDelete?.name}»? Esta acción lo desvinculará de todos los productos asociados y no se podrá deshacer.`}
        confirmText="Eliminar grupo"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* MODAL CONFIRMAR ELIMINACIÓN DE OPCIÓN */}
      <ConfirmModal
        isOpen={Boolean(optionToDelete)}
        onClose={() => setOptionToDelete(null)}
        onConfirm={handleConfirmDeleteOption}
        title="¿Eliminar opción de modificador?"
        description={`¿Estás seguro de que deseas eliminar «${optionToDelete?.name}»?`}
        confirmText="Eliminar opción"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
