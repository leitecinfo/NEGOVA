"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  CreateModifierGroupInput,
  ModifierGroup,
  ModifierOptionInput,
  ModifierSelectionType,
  ModifierStatus,
} from "@/lib/modifiers/types";
import { Category, Product } from "@/lib/products/types";
import { formatCOP } from "@/lib/pos/types";
import {
  X,
  Layers,
  Sparkles,
  Plus,
  Trash2,
  Check,
  Search,
  CheckSquare,
  Square,
  FolderTree,
  Package,
  HelpCircle,
  Loader2,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";

interface ModifierGroupModalProps {
  isOpen: boolean;
  businessId: string;
  categories: Category[];
  products: Product[];
  group?: ModifierGroup | null;
  onClose: () => void;
  onSave: (data: CreateModifierGroupInput) => Promise<void>;
}

export function ModifierGroupModal({
  isOpen,
  businessId,
  categories,
  products,
  group,
  onClose,
  onSave,
}: ModifierGroupModalProps) {
  const isEditing = Boolean(group);

  // Datos básicos del grupo
  const [name, setName] = useState("");
  const [required, setRequired] = useState(false);
  const [selectionType, setSelectionType] = useState<ModifierSelectionType>("multiple");
  const [minSelect, setMinSelect] = useState<number>(0);
  const [maxSelect, setMaxSelect] = useState<number>(1);

  // Opciones del grupo
  const [options, setOptions] = useState<ModifierOptionInput[]>([]);

  // Asignación de productos y categorías
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"general" | "options" | "assignment">("general");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inicializar estado cuando se abre
  useEffect(() => {
    if (isOpen) {
      if (group) {
        setName(group.name);
        setRequired(group.required);
        setSelectionType(group.selection_type);
        setMinSelect(group.min_select);
        setMaxSelect(group.max_select);
        setOptions(
          group.options.map((o) => ({
            id: o.id,
            name: o.name,
            price: o.price,
            status: o.status,
            sort_order: o.sort_order,
          }))
        );
        setSelectedProductIds(group.applied_product_ids || []);
      } else {
        setName("");
        setRequired(false);
        setSelectionType("multiple");
        setMinSelect(0);
        setMaxSelect(1);
        setOptions([
          { name: "", price: 0, status: "active", sort_order: 0 },
        ]);
        setSelectedProductIds([]);
      }
      setActiveTab("general");
      setProductSearch("");
    }
  }, [isOpen, group]);

  // Cuando cambia required o selectionType, sincronizar límites
  const handleToggleRequired = (val: boolean) => {
    setRequired(val);
    if (val) {
      if (minSelect < 1) setMinSelect(1);
    } else {
      setMinSelect(0);
    }
  };

  const handleSelectionTypeChange = (type: ModifierSelectionType) => {
    setSelectionType(type);
    if (type === "single") {
      setMaxSelect(1);
      if (required) {
        setMinSelect(1);
      } else {
        setMinSelect(0);
      }
    } else {
      if (maxSelect === 1) {
        setMaxSelect(3);
      }
    }
  };

  // Manejadores de opciones
  const handleAddOption = () => {
    setOptions([
      ...options,
      {
        name: "",
        price: 0,
        status: "active",
        sort_order: options.length,
      },
    ]);
  };

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, idx) => idx !== index));
  };

  const handleOptionChange = (
    index: number,
    field: keyof ModifierOptionInput,
    value: any
  ) => {
    const next = [...options];
    next[index] = { ...next[index], [field]: value };
    setOptions(next);
  };

  // Asignación de productos y categorías
  const commercialProducts = useMemo(() => {
    return products.filter((p) => (p.metadata as any)?.product_type !== "ingredient");
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return commercialProducts;
    const q = productSearch.toLowerCase().trim();
    return commercialProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.metadata as any)?.sku?.toLowerCase().includes(q)
    );
  }, [commercialProducts, productSearch]);

  const handleToggleProduct = (productId: string) => {
    if (selectedProductIds.includes(productId)) {
      setSelectedProductIds(selectedProductIds.filter((id) => id !== productId));
    } else {
      setSelectedProductIds([...selectedProductIds, productId]);
    }
  };

  const handleToggleCategory = (categoryId: string) => {
    const categoryProducts = commercialProducts.filter((p) => p.category_id === categoryId);
    const categoryProductIds = categoryProducts.map((p) => p.id);
    const allSelected = categoryProductIds.every((id) => selectedProductIds.includes(id));

    if (allSelected) {
      // Deseleccionar todos los productos de esta categoría
      setSelectedProductIds(selectedProductIds.filter((id) => !categoryProductIds.includes(id)));
    } else {
      // Seleccionar todos los productos de esta categoría
      const next = Array.from(new Set([...selectedProductIds, ...categoryProductIds]));
      setSelectedProductIds(next);
    }
  };

  const handleSelectAllProducts = () => {
    setSelectedProductIds(commercialProducts.map((p) => p.id));
  };

  const handleClearAllProducts = () => {
    setSelectedProductIds([]);
  };

  // Guardado
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("El nombre del grupo es obligatorio");
      setActiveTab("general");
      return;
    }

    if (selectionType === "multiple" && minSelect > maxSelect) {
      toast.error("La selección mínima no puede ser mayor que la máxima");
      setActiveTab("general");
      return;
    }

    // Validar opciones
    const validOptions = options
      .map((opt, idx) => ({
        ...opt,
        name: opt.name.trim(),
        price: Number(opt.price ?? 0),
        sort_order: idx,
      }))
      .filter((opt) => opt.name.length > 0);

    if (validOptions.length === 0) {
      toast.error("Debes agregar al menos una opción válida al grupo");
      setActiveTab("options");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave({
        name: trimmedName,
        required,
        selection_type: selectionType,
        min_select: selectionType === "single" ? (required ? 1 : 0) : minSelect,
        max_select: selectionType === "single" ? 1 : maxSelect,
        sort_order: group?.sort_order ?? 0,
        status: group?.status ?? "active",
        options: validOptions,
        product_ids: selectedProductIds,
        category_ids: group?.applied_category_ids ?? [],
      });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar el grupo");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200/80 dark:border-white/[0.08] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {isEditing ? "Editar Grupo de Modificadores" : "Nuevo Grupo de Modificadores"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configura reglas de personalización, complementos y productos donde aplica
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sub-tabs */}
          <div className="flex items-center gap-2 px-4 sm:px-5 pt-3 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.01] shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("general")}
              className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "general"
                  ? "border-[#ED500A] text-[#ED500A]"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white"
              }`}
            >
              1. Reglas Generales
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("options")}
              className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "options"
                  ? "border-[#ED500A] text-[#ED500A]"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white"
              }`}
            >
              2. Opciones ({options.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("assignment")}
              className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "assignment"
                  ? "border-[#ED500A] text-[#ED500A]"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white"
              }`}
            >
              3. Asignación ({selectedProductIds.length})
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
            {/* TAB 1: REGLAS GENERALES */}
            {activeTab === "general" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Nombre del grupo *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ej: Término de la carne, Salsas, Acompañamiento, Adicionales"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Este nombre se mostrará en el POS, en el Menú Digital y en la comanda de cocina.
                  </p>
                </div>

                {/* Obligatorio / Requerido */}
                <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      ¿Es obligatorio seleccionar este modificador?
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      {required
                        ? "Sí: el cajero o cliente debe elegir obligatoriamente al menos 1 opción para ordenar."
                        : "No: el cliente puede continuar sin seleccionar ninguna opción de este grupo."}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleRequired(!required)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      required ? "bg-[#ED500A]" : "bg-slate-300 dark:bg-white/20"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        required ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Tipo de Selección */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Tipo de selección
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label
                      onClick={() => handleSelectionTypeChange("single")}
                      className={`p-3.5 border rounded-xl flex items-start gap-3 cursor-pointer transition-all ${
                        selectionType === "single"
                          ? "border-[#ED500A] bg-[#ED500A]/5 dark:bg-[#ED500A]/10 text-slate-900 dark:text-white ring-1 ring-[#ED500A]"
                          : "border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] text-slate-600 dark:text-slate-400 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="selectionType"
                        checked={selectionType === "single"}
                        onChange={() => handleSelectionTypeChange("single")}
                        className="mt-0.5 text-[#ED500A] focus:ring-[#ED500A]"
                      />
                      <div>
                        <span className="text-xs font-bold block text-slate-900 dark:text-white">
                          Única (Radio, Máx 1)
                        </span>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          El usuario solo puede elegir una sola opción (ej: Término de carne, Tamaño).
                        </span>
                      </div>
                    </label>

                    <label
                      onClick={() => handleSelectionTypeChange("multiple")}
                      className={`p-3.5 border rounded-xl flex items-start gap-3 cursor-pointer transition-all ${
                        selectionType === "multiple"
                          ? "border-[#ED500A] bg-[#ED500A]/5 dark:bg-[#ED500A]/10 text-slate-900 dark:text-white ring-1 ring-[#ED500A]"
                          : "border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] text-slate-600 dark:text-slate-400 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="selectionType"
                        checked={selectionType === "multiple"}
                        onChange={() => handleSelectionTypeChange("multiple")}
                        className="mt-0.5 text-[#ED500A] focus:ring-[#ED500A]"
                      />
                      <div>
                        <span className="text-xs font-bold block text-slate-900 dark:text-white">
                          Múltiple (Checkboxes, Máx N)
                        </span>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          El usuario puede elegir varias opciones (ej: Adicionales, Salsas, Toppings).
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Límites de Selección si es Múltiple */}
                {selectionType === "multiple" && (
                  <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] rounded-xl">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Selección Mínima
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={maxSelect}
                        value={minSelect}
                        onChange={(e) => setMinSelect(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-3 py-2 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]"
                      />
                      <span className="text-[10px] text-slate-400">0 si es opcional</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Selección Máxima
                      </label>
                      <input
                        type="number"
                        min={Math.max(1, minSelect)}
                        value={maxSelect}
                        onChange={(e) => setMaxSelect(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]"
                      />
                      <span className="text-[10px] text-slate-400">Límite permitido</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: OPCIONES DEL GRUPO */}
            {activeTab === "options" && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Opciones y Precios
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Define los elementos que el cliente podrá escoger dentro de este grupo.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir opción</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-[45vh] overflow-y-auto pr-1">
                  {options.map((opt, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] rounded-xl flex items-center gap-2.5"
                    >
                      <span className="text-xs font-mono font-bold text-slate-400 w-5 shrink-0 text-center">
                        #{idx + 1}
                      </span>

                      {/* Nombre */}
                      <input
                        type="text"
                        value={opt.name}
                        onChange={(e) => handleOptionChange(idx, "name", e.target.value)}
                        placeholder="Nombre de la opción (ej: Extra Queso)"
                        required
                        className="flex-1 px-3 py-2 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]"
                      />

                      {/* Precio */}
                      <div className="w-28 sm:w-32 relative shrink-0">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">
                          $
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="50"
                          value={opt.price}
                          onChange={(e) =>
                            handleOptionChange(idx, "price", Math.max(0, parseFloat(e.target.value) || 0))
                          }
                          placeholder="0"
                          title="Ajuste de precio en COP (0 = sin recargo)"
                          className="w-full pl-6 pr-2 py-2 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]"
                        />
                      </div>

                      {/* Estado */}
                      <button
                        type="button"
                        onClick={() =>
                          handleOptionChange(
                            idx,
                            "status",
                            opt.status === "active" ? "inactive" : "active"
                          )
                        }
                        title={opt.status === "active" ? "Opción activa" : "Opción pausada"}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold shrink-0 transition-colors cursor-pointer ${
                          opt.status === "active"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-slate-200 dark:bg-white/10 text-slate-500"
                        }`}
                      >
                        {opt.status === "active" ? "Activa" : "Pausada"}
                      </button>

                      {/* Eliminar */}
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        disabled={options.length <= 1}
                        title="Eliminar opción"
                        className="p-1.5 text-slate-400 hover:text-rose-500 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: ASIGNACIÓN A PRODUCTOS Y CATEGORÍAS */}
            {activeTab === "assignment" && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Vincular a Productos y Categorías
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Selecciona en qué productos o categorías completas estará disponible este grupo de modificadores.
                  </p>
                </div>

                {/* Categorías Rápidas */}
                {categories.length > 0 && (
                  <div className="p-3 bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] rounded-xl space-y-2">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                      Vincular por Categoría Completa:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {categories.map((cat) => {
                        const catProducts = commercialProducts.filter((p) => p.category_id === cat.id);
                        if (catProducts.length === 0) return null;
                        const allSelected = catProducts.every((p) => selectedProductIds.includes(p.id));
                        const someSelected =
                          !allSelected && catProducts.some((p) => selectedProductIds.includes(p.id));

                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => handleToggleCategory(cat.id)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              allSelected
                                ? "bg-[#ED500A] text-white shadow-2xs"
                                : someSelected
                                ? "bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/30"
                                : "bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:border-slate-300"
                            }`}
                          >
                            <FolderTree className="w-3 h-3" />
                            <span>{cat.name}</span>
                            <span className="text-[10px] opacity-80">({catProducts.length})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Barra de Búsqueda y Selección Masiva */}
                <div className="flex items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Buscar producto por nombre o SKU..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleSelectAllProducts}
                      className="px-2.5 py-1 text-xs font-semibold text-[#ED500A] hover:bg-[#ED500A]/10 rounded-lg transition-colors cursor-pointer"
                    >
                      Marcar todos
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllProducts}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.04] rounded-lg transition-colors cursor-pointer"
                    >
                      Desmarcar
                    </button>
                  </div>
                </div>

                {/* Lista de Productos con Checkboxes */}
                <div className="border border-slate-200/80 dark:border-white/[0.08] rounded-xl divide-y divide-slate-100 dark:divide-white/[0.04] max-h-60 overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      No se encontraron productos coincidentes.
                    </div>
                  ) : (
                    filteredProducts.map((p) => {
                      const isSelected = selectedProductIds.includes(p.id);
                      const cat = categories.find((c) => c.id === p.category_id);

                      return (
                        <label
                          key={p.id}
                          className={`flex items-center justify-between p-2.5 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] cursor-pointer transition-colors ${
                            isSelected ? "bg-purple-500/5 dark:bg-purple-500/10" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleProduct(p.id)}
                              className="rounded border-slate-300 text-[#ED500A] focus:ring-[#ED500A] cursor-pointer"
                            />
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">
                                {p.name}
                              </span>
                              <span className="text-[10px] text-slate-400 block truncate">
                                {cat ? cat.name : "Sin categoría"}
                              </span>
                            </div>
                          </div>

                          <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-400 shrink-0">
                            {formatCOP(p.price)}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>

                <div className="p-2.5 bg-slate-50 dark:bg-white/[0.02] rounded-xl flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <span>Productos asignados:</span>
                  <span className="font-mono text-[#ED500A] font-bold">
                    {selectedProductIds.length} de {commercialProducts.length} productos
                  </span>
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200/80 dark:border-white/[0.08] shrink-0">
              <span className="text-xs text-slate-500">
                {activeTab === "general" && "Paso 1 de 3"}
                {activeTab === "options" && "Paso 2 de 3"}
                {activeTab === "assignment" && "Paso 3 de 3"}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.04] rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                {activeTab !== "assignment" ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab(activeTab === "general" ? "options" : "assignment")}
                    className="px-4 py-2 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-slate-800 dark:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Siguiente
                  </button>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isEditing ? "Guardar Cambios" : "Crear Grupo"}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
