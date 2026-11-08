"use client";

import React, { useState, useEffect, useTransition } from "react";
import { CustomModal } from "@/components/ui/custom-modal";
import { Input, Select } from "@/components/ui";
import { Category, STANDARD_TAX_RATES } from "@/lib/products/types";
import { createCategoryAction, updateCategoryAction } from "./actions";
import { toast } from "sonner";
import { Loader2, FolderKanban, Percent, Layers, Hash } from "lucide-react";

interface CategoryFormModalProps {
  businessId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  category?: Category | null;
  allCategories: Category[];
}

export function CategoryFormModal({
  businessId,
  isOpen,
  onClose,
  onSuccess,
  category,
  allCategories,
}: CategoryFormModalProps) {
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentCategoryId, setParentCategoryId] = useState<string>("");
  const [defaultTaxRate, setDefaultTaxRate] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<number>(0);

  const isEditing = Boolean(category?.id);

  // Verificar si la categoría que se edita ya tiene subcategorías hijas
  const hasSubcategories = React.useMemo(() => {
    if (!category?.id) return false;
    return allCategories.some(
      (c) => c.parent_category_id === category.id && c.status !== "archived"
    );
  }, [category, allCategories]);

  // Lista de categorías que pueden ser padres (nivel raíz y distintas de sí misma)
  const availableParentCategories = React.useMemo(() => {
    return allCategories.filter(
      (c) =>
        !c.parent_category_id &&
        c.status !== "archived" &&
        (!category?.id || c.id !== category.id)
    );
  }, [allCategories, category]);

  useEffect(() => {
    if (category) {
      setName(category.name || "");
      setDescription(category.description || "");
      setParentCategoryId(category.parent_category_id || "");
      setDefaultTaxRate(
        category.default_tax_rate !== undefined && category.default_tax_rate !== null
          ? Number(category.default_tax_rate)
          : null
      );
      setSortOrder(category.sort_order ?? 0);
    } else {
      setName("");
      setDescription("");
      setParentCategoryId("");
      setDefaultTaxRate(null);
      // Auto-asignar el siguiente orden
      const maxOrder = allCategories.reduce(
        (max, c) => Math.max(max, c.sort_order || 0),
        0
      );
      setSortOrder(maxOrder + 10);
    }
  }, [category, allCategories, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("El nombre de la categoría es obligatorio");
      return;
    }

    startTransition(async () => {
      if (isEditing && category) {
        const res = await updateCategoryAction(businessId, category.id, {
          name: trimmedName,
          description: description.trim() || null,
          parent_category_id: parentCategoryId.trim() ? parentCategoryId.trim() : null,
          default_tax_rate: defaultTaxRate,
          sort_order: Number(sortOrder) || 0,
        });

        if (res.success) {
          toast.success(`Categoría «${trimmedName}» actualizada exitosamente`);
          onSuccess();
          onClose();
        } else {
          toast.error("Error al actualizar la categoría", {
            description: res.error,
          });
        }
      } else {
        const res = await createCategoryAction(businessId, {
          name: trimmedName,
          description: description.trim() || null,
          parent_category_id: parentCategoryId.trim() ? parentCategoryId.trim() : null,
          default_tax_rate: defaultTaxRate,
          sort_order: Number(sortOrder) || 0,
        });

        if (res.success) {
          toast.success(`Categoría «${trimmedName}» creada exitosamente`);
          onSuccess();
          onClose();
        } else {
          toast.error("Error al crear la categoría", {
            description: res.error,
          });
        }
      }
    });
  };

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Editar Categoría: ${category?.name}` : "Nueva Categoría"}
      description="Organiza tu catálogo, estructura de menú e impuestos predeterminados."
      maxWidth="lg"
      showConfirmButton={false}
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {/* Nombre * */}
        <Input
          label="Nombre"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Bebidas, Comidas, Postres"
          disabled={isPending}
          autoFocus
        />

        {/* Descripción (opcional) */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
            Descripción <span className="text-slate-400 font-normal lowercase">(opcional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Breve detalle de los productos incluidos en esta categoría..."
            rows={2}
            disabled={isPending}
            className="w-full px-3.5 py-2 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/50 transition-all resize-none"
          />
        </div>

        {/* Categoría Padre (opcional) */}
        <div>
          {hasSubcategories ? (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-400">
              Esta categoría contiene subcategorías asociadas y no puede ser convertida en subcategoría.
            </div>
          ) : (
            <Select
              label="Categoría Padre (opcional)"
              helperText={
                parentCategoryId
                  ? "Esta categoría se mostrará agrupada bajo la categoría principal seleccionada."
                  : "Aparecerá en el primer nivel del catálogo y del menú."
              }
              value={parentCategoryId}
              onChange={setParentCategoryId}
              disabled={isPending}
            >
              <option value="">Ninguna (categoría principal)</option>
              {availableParentCategories.map((p) => (
                <option key={p.id} value={p.id}>
                  Subcategoría de: {p.name}
                </option>
              ))}
            </Select>
          )}
        </div>

        {/* Impuesto por Defecto (opcional) */}
        <div className="p-3.5 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-2xl space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4 text-[#ED500A]" />
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Impuesto por Defecto
              </label>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-white/10 text-slate-700 dark:text-slate-200">
              {defaultTaxRate !== null ? `${defaultTaxRate}%` : "Sin impuesto"}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setDefaultTaxRate(null)}
              disabled={isPending}
              className={`px-2.5 py-2 text-xs font-semibold rounded-xl border transition-all text-center ${
                defaultTaxRate === null
                  ? "bg-[#ED500A] border-[#ED500A] text-white shadow-2xs"
                  : "bg-white dark:bg-[#0D0F16] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:border-[#ED500A]/40"
              }`}
            >
              Sin impuesto por defecto
            </button>

            {STANDARD_TAX_RATES.map((rate) => {
              const isSelected = defaultTaxRate === rate.value;
              return (
                <button
                  key={rate.value}
                  type="button"
                  onClick={() => setDefaultTaxRate(rate.value)}
                  disabled={isPending}
                  className={`px-2.5 py-2 text-xs font-semibold rounded-xl border transition-all text-center ${
                    isSelected
                      ? "bg-[#ED500A] border-[#ED500A] text-white shadow-2xs"
                      : "bg-white dark:bg-[#0D0F16] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:border-[#ED500A]/40"
                  }`}
                >
                  {rate.label}
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Los productos creados bajo esta categoría heredarán este impuesto por defecto.
          </p>
        </div>

        {/* Orden */}
        <Input
          label="Orden de visualización"
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
          disabled={isPending}
          leftIcon={<Hash className="w-3.5 h-3.5 text-slate-400" />}
          helperText="Los números menores aparecen primero en el menú y en la pantalla de ventas."
          className="sm:w-36 font-mono font-bold"
        />

        {/* Botones de acción */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200/80 dark:border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending || !name.trim()}
            className="inline-flex items-center gap-2 px-5 py-2 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <span>{isEditing ? "Guardar cambios" : "Crear categoría"}</span>
            )}
          </button>
        </div>
      </form>
    </CustomModal>
  );
}
