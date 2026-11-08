"use client";

import React, { useState, useMemo, useTransition } from "react";
import {
  Plus,
  Search,
  FolderKanban,
  Pencil,
  Power,
  Trash2,
  CornerDownRight,
  CheckCircle2,
  XCircle,
  Package,
  Percent,
  Layers,
  ArrowUpDown,
  Filter,
  AlertTriangle,
} from "lucide-react";
import { Category, Product, STANDARD_TAX_RATES } from "@/lib/products/types";
import { CategoryFormModal } from "./category-form-modal";
import {
  updateCategoryAction,
  deleteCategoryAction,
  getCategoryProductCountAction,
} from "./actions";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { toast } from "sonner";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";

interface CategoriesTabProps {
  businessId: string;
  categories: Category[];
  products: Product[];
  onCategoriesChange: () => void;
}

export function CategoriesTab({
  businessId,
  categories,
  products,
  onCategoriesChange,
}: CategoriesTabProps) {
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Estados de modal de creación / edición
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Estados de eliminación con confirmación segura
  const [categoryToDelete, setCategoryToDelete] = useState<{
    id: string;
    name: string;
    productCount: number;
  } | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState<string>("");

  // Conteo de productos asociados por categoría
  const productCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      if (p.category_id && p.status !== "archived") {
        map.set(p.category_id, (map.get(p.category_id) || 0) + 1);
      }
    }
    return map;
  }, [products]);

  // Jerarquía organizada: Categorías principales seguidas de sus subcategorías
  const hierarchicalCategories = useMemo(() => {
    const nonArchived = categories.filter((c) => c.status !== "archived");
    const roots = nonArchived.filter((c) => !c.parent_category_id);
    const childrenMap = new Map<string, Category[]>();

    for (const c of nonArchived) {
      if (c.parent_category_id) {
        const list = childrenMap.get(c.parent_category_id) || [];
        list.push(c);
        childrenMap.set(c.parent_category_id, list);
      }
    }

    const ordered: {
      category: Category;
      isChild: boolean;
      parentName?: string;
    }[] = [];

    // Ordenar raíces por sort_order y luego alfabéticamente
    const sortedRoots = [...roots].sort((a, b) => {
      const diff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });

    for (const root of sortedRoots) {
      ordered.push({ category: root, isChild: false });
      const children = childrenMap.get(root.id) || [];
      const sortedChildren = [...children].sort((a, b) => {
        const diff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
      });
      for (const child of sortedChildren) {
        ordered.push({
          category: child,
          isChild: true,
          parentName: root.name,
        });
      }
    }

    // Agregar subcategorías huérfanas si existieran
    for (const c of nonArchived) {
      if (
        c.parent_category_id &&
        !ordered.some((item) => item.category.id === c.id)
      ) {
        const parent = nonArchived.find((p) => p.id === c.parent_category_id);
        ordered.push({
          category: c,
          isChild: true,
          parentName: parent?.name,
        });
      }
    }

    return ordered;
  }, [categories]);

  // Filtrado por texto de búsqueda y estado
  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return hierarchicalCategories.filter(({ category, parentName }) => {
      // Filtro de estado
      if (statusFilter !== "all" && category.status !== statusFilter) {
        return false;
      }
      // Filtro de búsqueda
      if (!q) return true;
      const matchName = category.name.toLowerCase().includes(q);
      const matchDesc = (category.description || "").toLowerCase().includes(q);
      const matchParent = (parentName || "").toLowerCase().includes(q);
      return matchName || matchDesc || matchParent;
    });
  }, [hierarchicalCategories, search, statusFilter]);

  // Manejador para abrir modal en creación
  const handleOpenCreate = () => {
    setEditingCategory(null);
    setIsFormModalOpen(true);
  };

  // Manejador para abrir modal en edición
  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat);
    setIsFormModalOpen(true);
  };

  // Manejador para activar / desactivar
  const handleToggleStatus = (cat: Category) => {
    const nextStatus = cat.status === "active" ? "inactive" : "active";
    startTransition(async () => {
      const res = await updateCategoryAction(businessId, cat.id, {
        status: nextStatus,
      });

      if (res.success) {
        toast.success(
          nextStatus === "active"
            ? `Categoría «${cat.name}» activada`
            : `Categoría «${cat.name}» desactivada`
        );
        onCategoriesChange();
      } else {
        toast.error("Error al cambiar estado", { description: res.error });
      }
    });
  };

  // Solicitar eliminación de categoría
  const handleRequestDelete = async (cat: Category) => {
    const localCount = productCountMap.get(cat.id) || 0;
    // Confirmar conteo en servidor
    const res = await getCategoryProductCountAction(businessId, cat.id);
    const count = res.success ? res.count ?? localCount : localCount;

    setCategoryToDelete({ id: cat.id, name: cat.name, productCount: count });
    setReassignTargetId("");
  };

  // Confirmar eliminación de categoría
  const handleConfirmDelete = () => {
    if (!categoryToDelete) return;

    startTransition(async () => {
      const res = await deleteCategoryAction(
        businessId,
        categoryToDelete.id,
        reassignTargetId || null
      );

      if (res.success) {
        toast.success(`Categoría «${categoryToDelete.name}» eliminada`);
        setCategoryToDelete(null);
        onCategoriesChange();
      } else {
        toast.error("Error al eliminar categoría", { description: res.error });
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* BARRA SUPERIOR: BÚSQUEDA, FILTRO DE ESTADO Y BOTÓN NUEVA CATEGORÍA */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xs">
        <div className="flex flex-1 items-center gap-2.5">
          {/* Buscador */}
          <div className="flex-1 max-w-md">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch("")}
              placeholder="Buscar categoría por nombre o descripción..."
            />
          </div>

          {/* Filtro por estado */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/[0.04] p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === "all"
                  ? "bg-white dark:bg-[#0D0F16] text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Todas ({hierarchicalCategories.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === "active"
                  ? "bg-white dark:bg-[#0D0F16] text-emerald-600 dark:text-emerald-400 shadow-2xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Activas
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("inactive")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === "inactive"
                  ? "bg-white dark:bg-[#0D0F16] text-slate-700 dark:text-slate-300 shadow-2xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Inactivas
            </button>
          </div>
        </div>

        {/* Botón Nueva Categoría */}
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Categoría</span>
        </button>
      </div>

      {/* TABLA DE CATEGORÍAS */}
      <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/[0.08] text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3.5 w-16 text-center">Orden</th>
                <th className="px-4 py-3.5">Nombre</th>
                <th className="px-4 py-3.5">Descripción</th>
                <th className="px-4 py-3.5">Impuesto por Defecto</th>
                <th className="px-4 py-3.5 text-center">Productos asociados</th>
                <th className="px-4 py-3.5 text-center">Estado</th>
                <th className="px-4 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.05]">
              {filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
                      <FolderKanban className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        No se encontraron categorías
                      </p>
                      <p className="text-xs text-slate-500">
                        {search.trim()
                          ? "Intenta modificar el término de búsqueda o filtro de estado."
                          : "Comienza creando tu primera categoría con el botón «Nueva Categoría»."}
                      </p>
                      {!search.trim() && (
                        <button
                          type="button"
                          onClick={handleOpenCreate}
                          className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#ED500A] text-white rounded-xl text-xs font-bold hover:bg-[#ED500A]/90 transition-all cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Nueva Categoría</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCategories.map(({ category, isChild, parentName }) => {
                  const productCount = productCountMap.get(category.id) || 0;
                  const isActive = category.status === "active";
                  const taxRate = category.default_tax_rate;

                  return (
                    <tr
                      key={category.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Orden */}
                      <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-500">
                        {category.sort_order ?? 0}
                      </td>

                      {/* Nombre con indicador jerárquico */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          {isChild ? (
                            <div className="flex items-center gap-1.5 pl-4 text-slate-400">
                              <CornerDownRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {category.name}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Subcategoría de: {parentName}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-[#ED500A]/10 text-[#ED500A]">
                                <FolderKanban className="w-3.5 h-3.5" />
                              </div>
                              <span className="font-bold text-slate-900 dark:text-white text-sm">
                                {category.name}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Descripción */}
                      <td className="px-4 py-3.5 max-w-xs">
                        <span className="text-slate-600 dark:text-slate-400 line-clamp-2">
                          {category.description?.trim() ? category.description : "—"}
                        </span>
                      </td>

                      {/* Impuesto por Defecto */}
                      <td className="px-4 py-3.5">
                        {taxRate !== null && taxRate !== undefined ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-500/20">
                            <Percent className="w-3 h-3" />
                            <span>
                              {taxRate}%{" "}
                              {STANDARD_TAX_RATES.find((r) => r.value === taxRate)?.label.replace(
                                `${taxRate}% `,
                                ""
                              ) || ""}
                            </span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Sin impuesto por defecto
                          </span>
                        )}
                      </td>

                      {/* Productos asociados */}
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            productCount > 0
                              ? "bg-slate-100 dark:bg-white/[0.06] text-slate-800 dark:text-slate-200"
                              : "text-slate-400 bg-slate-50 dark:bg-white/[0.02]"
                          }`}
                        >
                          <Package className="w-3 h-3 text-slate-400" />
                          <span>{productCount}</span>
                        </span>
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3.5 text-center">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Activa</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/[0.08]">
                            <XCircle className="w-3 h-3" />
                            <span>Inactiva</span>
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          {/* Editar */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(category)}
                            title="Editar categoría"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Desactivar / Activar */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(category)}
                            title={isActive ? "Desactivar categoría" : "Activar categoría"}
                            disabled={isPending}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isActive
                                ? "text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                                : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>

                          {/* Eliminar */}
                          <button
                            type="button"
                            onClick={() => handleRequestDelete(category)}
                            title="Eliminar categoría"
                            disabled={isPending}
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
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
      </div>

      {/* Modal de Crear / Editar Categoría */}
      {isFormModalOpen && (
        <CategoryFormModal
          businessId={businessId}
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          onSuccess={onCategoriesChange}
          category={editingCategory}
          allCategories={categories}
        />
      )}

      {/* Modal Seguro de Confirmación para Eliminar Categoría */}
      {categoryToDelete && (
        <ConfirmModal
          isOpen={Boolean(categoryToDelete)}
          onClose={() => setCategoryToDelete(null)}
          onConfirm={handleConfirmDelete}
          title={`¿Eliminar categoría «${categoryToDelete.name}»?`}
          description={
            categoryToDelete.productCount > 0
              ? `Esta categoría tiene ${categoryToDelete.productCount} producto(s) asociado(s). Puedes reasignarlos a otra categoría o dejarlos sin categoría asignada.`
              : "Esta categoría no tiene productos asociados y será eliminada definitivamente."
          }
          confirmText="Eliminar categoría"
          cancelText="Cancelar"
          variant="danger"
        >
          {categoryToDelete.productCount > 0 && (
            <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Reasignar productos a otra categoría (opcional):
              </label>
              <Select
                value={reassignTargetId}
                onChange={(e) => setReassignTargetId(e.target.value)}
              >
                <option value="">Dejar productos sin categoría asignada</option>
                {categories
                  .filter((c) => c.id !== categoryToDelete.id && c.status !== "archived")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </Select>
            </div>
          )}
        </ConfirmModal>
      )}
    </div>
  );
}
