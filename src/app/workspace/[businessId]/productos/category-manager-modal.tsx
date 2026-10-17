"use client";

import React, { useState, useTransition } from "react";
import { CustomModal } from "@/components/ui/custom-modal";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Category } from "@/lib/products/types";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  getCategoryProductCountAction,
} from "./actions";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Search,
  FolderKanban,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface Props {
  businessId: string;
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CategoryManagerModal({
  businessId,
  categories,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  // Estado para crear nueva categoría
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Estado para editar categoría existente
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "inactive">("active");

  // Estado para confirmación segura de eliminación
  const [categoryToDelete, setCategoryToDelete] = useState<{
    id: string;
    name: string;
    productCount: number;
  } | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState<string>("");

  const handleStartCreate = () => {
    setIsCreating(true);
    setNewName("");
    setNewDesc("");
  };

  const handleSaveCreate = () => {
    if (!newName.trim()) {
      toast.error("El nombre de la categoría es obligatorio");
      return;
    }

    startTransition(async () => {
      const res = await createCategoryAction(businessId, {
        name: newName.trim(),
        description: newDesc.trim() || null,
        sort_order: (categories.length + 1) * 10,
      });

      if (res.success) {
        toast.success(`Categoría «${newName.trim()}» creada`);
        setIsCreating(false);
        setNewName("");
        setNewDesc("");
        if (onSuccess) onSuccess();
      } else {
        toast.error("Error al crear categoría", { description: res.error });
      }
    });
  };

  const handleStartEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditDesc(cat.description || "");
    setEditStatus((cat.status as "active" | "inactive") || "active");
  };

  const handleSaveEdit = (categoryId: string) => {
    if (!editName.trim()) {
      toast.error("El nombre no puede estar vacío");
      return;
    }

    startTransition(async () => {
      const res = await updateCategoryAction(businessId, categoryId, {
        name: editName.trim(),
        description: editDesc.trim() || null,
        status: editStatus,
      });

      if (res.success) {
        toast.success("Categoría actualizada");
        setEditingId(null);
        if (onSuccess) onSuccess();
      } else {
        toast.error("Error al actualizar", { description: res.error });
      }
    });
  };

  const handleToggleStatus = (cat: Category) => {
    const nextStatus = cat.status === "active" ? "inactive" : "active";
    startTransition(async () => {
      const res = await updateCategoryAction(businessId, cat.id, {
        status: nextStatus,
      });

      if (res.success) {
        toast.success(
          nextStatus === "active"
            ? `«${cat.name}» activada`
            : `«${cat.name}» desactivada`
        );
        if (onSuccess) onSuccess();
      } else {
        toast.error("Error al cambiar estado", { description: res.error });
      }
    });
  };

  const handleRequestDelete = async (cat: Category) => {
    // Consultar conteo real de productos asociados
    const res = await getCategoryProductCountAction(businessId, cat.id);
    const count = res.success ? res.count ?? 0 : 0;
    setCategoryToDelete({ id: cat.id, name: cat.name, productCount: count });
    setReassignTargetId("");
  };

  const handleConfirmDelete = () => {
    if (!categoryToDelete) return;

    startTransition(async () => {
      const res = await deleteCategoryAction(
        businessId,
        categoryToDelete.id,
        reassignTargetId || null
      );

      if (res.success) {
        toast.success(`Categoría «${categoryToDelete.name}» eliminada`, {
          description:
            categoryToDelete.productCount > 0
              ? `${categoryToDelete.productCount} productos fueron ${
                  reassignTargetId ? "reasignados" : "dejados sin categoría"
                } de forma segura.`
              : undefined,
        });
        setCategoryToDelete(null);
        if (onSuccess) onSuccess();
      } else {
        toast.error("Error al eliminar categoría", { description: res.error });
      }
    });
  };

  React.useEffect(() => {
    if (isOpen && onSuccess) {
      onSuccess();
    }
  }, [isOpen]);

  // Deduplicación defensiva estricta para garantizar que nunca se muestren categorías repetidas
  const uniqueCategories = React.useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories) {
      const key = c.name.toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, c);
      }
    }
    return Array.from(map.values());
  }, [categories]);

  const filteredCategories = uniqueCategories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <CustomModal
        isOpen={isOpen}
        onClose={onClose}
        title="Módulo de Categorías"
        description="Organiza, activa, edita o elimina las categorías comerciales de tu negocio."
        showConfirmButton={false}
        maxWidth="2xl"
      >
        <div className="space-y-4 mt-2">
          {/* Barra de herramientas: Búsqueda y Botón Nueva Categoría */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar categoría..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-white/10 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#ED500A]/50"
              />
            </div>

            {!isCreating && (
              <button
                type="button"
                onClick={handleStartCreate}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-xl text-xs font-semibold transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nueva Categoría</span>
              </button>
            )}
          </div>

          {/* Formulario rápido para crear categoría */}
          {isCreating && (
            <div className="p-4 bg-slate-50 dark:bg-white/[0.03] border border-[#ED500A]/30 rounded-2xl space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Crear Nueva Categoría
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Nombre de la categoría *
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ej. Hamburguesas, Salchipapas..."
                    className="w-full px-3 py-1.5 bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-white/10 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#ED500A]"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Descripción (opcional)
                  </label>
                  <input
                    type="text"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Breve detalle..."
                    className="w-full px-3 py-1.5 bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-white/10 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#ED500A]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  disabled={isPending}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/5 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveCreate}
                  disabled={isPending || !newName.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#ED500A] text-white rounded-xl text-xs font-semibold hover:bg-[#ED500A]/90 disabled:opacity-50 transition-colors shadow-2xs"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Guardar Categoría</span>
                </button>
              </div>
            </div>
          )}

          {/* Listado de categorías */}
          <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
            {filteredCategories.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-200 dark:border-white/10 rounded-2xl bg-slate-50/50 dark:bg-white/[0.02]">
                <FolderKanban className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {search ? "No se encontraron categorías" : "Sin categorías configuradas"}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {search
                    ? "Intenta con otro término de búsqueda."
                    : "Haz clic en 'Nueva Categoría' para comenzar a agrupar tus productos."}
                </p>
              </div>
            ) : (
              filteredCategories.map((cat) => {
                const isEditingThis = editingId === cat.id;

                if (isEditingThis) {
                  return (
                    <div
                      key={cat.id}
                      className="p-3 bg-white dark:bg-[#10141d] border border-[#ED500A]/40 rounded-xl space-y-2 shadow-xs animate-in fade-in duration-100"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="px-2.5 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-semibold"
                          placeholder="Nombre"
                        />
                        <input
                          type="text"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="px-2.5 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs"
                          placeholder="Descripción"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-white/5">
                        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editStatus === "active"}
                            onChange={(e) =>
                              setEditStatus(e.target.checked ? "active" : "inactive")
                            }
                            className="w-3.5 h-3.5 text-[#ED500A] rounded border-slate-300"
                          />
                          <span>Categoría Activa</span>
                        </label>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                            title="Cancelar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(cat.id)}
                            disabled={isPending || !editName.trim()}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs"
                            title="Guardar cambios"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Guardar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-3 bg-white dark:bg-[#10141d] border border-slate-200 dark:border-white/10 rounded-xl hover:border-slate-300 dark:hover:border-white/20 transition-all shadow-2xs"
                  >
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {cat.name}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            cat.status === "active"
                              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20"
                              : "bg-slate-100 dark:bg-white/5 text-slate-500"
                          }`}
                        >
                          {cat.status === "active" ? "Activa" : "Inactiva"}
                        </span>
                      </div>
                      {cat.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {cat.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(cat)}
                        disabled={isPending}
                        className={`p-1.5 rounded-lg transition-colors ${
                          cat.status === "active"
                            ? "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                            : "text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                        }`}
                        title={cat.status === "active" ? "Desactivar categoría" : "Activar categoría"}
                      >
                        {cat.status === "active" ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStartEdit(cat)}
                        disabled={isPending}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                        title="Editar categoría"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRequestDelete(cat)}
                        disabled={isPending}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        title="Eliminar categoría"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pie del modal */}
          <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-white/5">
            <span className="text-[11px] text-slate-500">
              Total: {uniqueCategories.length} {uniqueCategories.length === 1 ? "categoría" : "categorías"}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </CustomModal>

      {/* ConfirmModal Seguro para Eliminar Categoría */}
      <ConfirmModal
        isOpen={Boolean(categoryToDelete)}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="¿Eliminar categoría?"
        description={
          categoryToDelete?.productCount && categoryToDelete.productCount > 0
            ? `«${categoryToDelete.name}» tiene ${categoryToDelete.productCount} productos asociados. Los productos NO se eliminarán ni perderán sus precios; puedes reasignarlos a otra categoría o dejarlos sin categoría.`
            : `¿Seguro que deseas eliminar «${categoryToDelete?.name}»? Esta acción solo afecta a este negocio.`
        }
        confirmText="Eliminar categoría"
        variant="danger"
        isLoading={isPending}
      >
        {categoryToDelete && categoryToDelete.productCount > 0 && (
          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 rounded-xl space-y-2">
            <label className="block text-[11px] font-semibold text-amber-800 dark:text-amber-300">
              Reasignar productos a:
            </label>
            <select
              value={reassignTargetId}
              onChange={(e) => setReassignTargetId(e.target.value)}
              className="w-full px-3 py-1.5 bg-white dark:bg-[#0B0E14] border border-amber-300 dark:border-amber-500/30 rounded-lg text-xs focus:outline-none"
            >
              <option value="">Dejar sin categoría (categoría = null)</option>
              {uniqueCategories
                .filter((c) => c.id !== categoryToDelete.id && c.status === "active")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    Mover a «{c.name}»
                  </option>
                ))}
            </select>
          </div>
        )}
      </ConfirmModal>
    </>
  );
}
