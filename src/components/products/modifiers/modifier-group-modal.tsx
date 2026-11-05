"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  CreateModifierGroupInput,
  ModifierCommercialType,
  ModifierGroup,
  ModifierOptionInput,
  ModifierSelectionType,
  ModifierStatus,
} from "@/lib/modifiers/types";
import { Category, Product } from "@/lib/products/types";
import { formatCOP, formatNumberWithDots, parseNumberFromDots } from "@/lib/pos/types";
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
  Loader2,
  ArrowRightLeft,
  Tag,
  ChevronUp,
  ChevronDown,
  Info,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";

interface ModifierGroupModalProps {
  isOpen: boolean;
  businessId: string;
  categories: Category[];
  products: Product[];
  group?: ModifierGroup | null;
  initialProductId?: string | null;
  onClose: () => void;
  onSave: (data: CreateModifierGroupInput) => Promise<void>;
}

export function ModifierGroupModal({
  isOpen,
  businessId,
  categories,
  products,
  group,
  initialProductId,
  onClose,
  onSave,
}: ModifierGroupModalProps) {
  const isEditing = Boolean(group);

  // Datos básicos del grupo
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [commercialType, setCommercialType] = useState<ModifierCommercialType>("additional");
  const [required, setRequired] = useState(false);
  const [selectionType, setSelectionType] = useState<ModifierSelectionType>("multiple");
  const [minSelect, setMinSelect] = useState<number>(0);
  const [maxSelect, setMaxSelect] = useState<number>(1);

  // Opciones del grupo
  const [options, setOptions] = useState<ModifierOptionInput[]>([]);

  // Asignación de productos y categorías
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"general" | "options" | "assignment">("general");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inicializar estado cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      if (group) {
        setName(group.name);
        setDescription(group.description || "");
        setCommercialType(group.commercial_type || "additional");
        setRequired(group.required);
        setSelectionType(group.selection_type || (group.max_select === 1 ? "single" : "multiple"));
        setMinSelect(group.min_select);
        setMaxSelect(group.max_select);
        setOptions(
          group.options.map((o, idx) => ({
            id: o.id,
            name: o.name,
            price: o.price,
            status: o.status || "active",
            sort_order: typeof o.sort_order === "number" ? o.sort_order : idx,
          }))
        );
        setSelectedProductIds(group.applied_product_ids || []);
      } else {
        setName("");
        setDescription("");
        setCommercialType("additional");
        setRequired(false);
        setSelectionType("multiple");
        setMinSelect(0);
        setMaxSelect(1);
        setOptions([
          { name: "", price: 0, status: "active", sort_order: 0 },
        ]);
        setSelectedProductIds(initialProductId ? [initialProductId] : []);
      }
      setActiveTab("general");
      setProductSearch("");
      setSelectedCategoryFilter("all");
    }
  }, [isOpen, group, initialProductId]);

  // Sincronizar límites al cambiar required o selectionType
  const handleToggleRequired = (val: boolean) => {
    setRequired(val);
    if (val) {
      if (selectionType === "single") {
        setMinSelect(1);
        setMaxSelect(1);
      } else {
        if (minSelect < 1) setMinSelect(1);
      }
    } else {
      if (selectionType === "single") {
        setMinSelect(0);
        setMaxSelect(1);
      } else {
        setMinSelect(0);
      }
    }
  };

  const handleSelectionTypeChange = (type: ModifierSelectionType) => {
    setSelectionType(type);
    if (type === "single") {
      setMaxSelect(1);
      setMinSelect(required ? 1 : 0);
    } else {
      if (maxSelect === 1) {
        setMaxSelect(3);
      }
      if (!required) {
        setMinSelect(0);
      } else if (minSelect < 1) {
        setMinSelect(1);
      }
    }
  };

  // Manejo de Opciones
  const handleAddOption = () => {
    setOptions((prev) => [
      ...prev,
      {
        name: "",
        price: 0,
        status: "active",
        sort_order: prev.length,
      },
    ]);
  };

  const handleRemoveOption = (index: number) => {
    setOptions((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleOptionChange = (
    index: number,
    field: keyof ModifierOptionInput,
    value: any
  ) => {
    setOptions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleMoveOption = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === options.length - 1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    setOptions((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy.map((o, idx) => ({ ...o, sort_order: idx }));
    });
  };

  // Filtrado de productos comerciales (excluye ingredientes puros)
  const commercialProducts = useMemo(() => {
    return products.filter((p) => (p.metadata as any)?.product_type !== "ingredient");
  }, [products]);

  const filteredProducts = useMemo(() => {
    return commercialProducts.filter((p) => {
      if (selectedCategoryFilter !== "all" && p.category_id !== selectedCategoryFilter) {
        return false;
      }
      if (productSearch.trim()) {
        const q = productSearch.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesSku = ((p.metadata as any)?.sku || "").toLowerCase().includes(q);
        if (!matchesName && !matchesSku) return false;
      }
      return true;
    });
  }, [commercialProducts, selectedCategoryFilter, productSearch]);

  const handleToggleProduct = (productId: string) => {
    if (selectedProductIds.includes(productId)) {
      setSelectedProductIds(selectedProductIds.filter((id) => id !== productId));
    } else {
      setSelectedProductIds([...selectedProductIds, productId]);
    }
  };

  const handleSelectAllFilteredProducts = () => {
    const filteredIds = filteredProducts.map((p) => p.id);
    const merged = Array.from(new Set([...selectedProductIds, ...filteredIds]));
    setSelectedProductIds(merged);
  };

  const handleDeselectAllFilteredProducts = () => {
    const filteredIdsSet = new Set(filteredProducts.map((p) => p.id));
    setSelectedProductIds(selectedProductIds.filter((id) => !filteredIdsSet.has(id)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("El nombre del grupo es obligatorio");
      setActiveTab("general");
      return;
    }

    const validOptions = options
      .map((opt, idx) => ({
        ...opt,
        name: opt.name.trim(),
        price: Math.max(0, Number(opt.price) || 0),
        status: opt.status || "active",
        sort_order: typeof opt.sort_order === "number" ? opt.sort_order : idx,
      }))
      .filter((opt) => opt.name.length > 0);

    if (validOptions.length === 0) {
      toast.error("Debes agregar al menos una opción con nombre al grupo");
      setActiveTab("options");
      return;
    }

    const calculatedMaxSelect = selectionType === "single" ? 1 : Math.max(1, maxSelect);
    const calculatedMinSelect = required
      ? selectionType === "single"
        ? 1
        : Math.max(1, minSelect)
      : minSelect;

    if (calculatedMinSelect > calculatedMaxSelect) {
      toast.error("La cantidad mínima no puede ser mayor que la cantidad máxima");
      setActiveTab("general");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave({
        name: trimmedName,
        description: description.trim() || null,
        commercial_type: commercialType,
        required,
        selection_type: selectionType,
        min_select: calculatedMinSelect,
        max_select: calculatedMaxSelect,
        sort_order: group?.sort_order ?? 0,
        status: group?.status ?? "active",
        options: validOptions,
        product_ids: selectedProductIds,
        category_ids: group?.applied_category_ids ?? [],
      });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar el grupo de modificadores");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[10050] flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl w-full max-w-2xl max-h-[92vh] shadow-2xl overflow-hidden flex flex-col">
          {/* Cabecera */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200/80 dark:border-white/[0.08] shrink-0 bg-slate-50/50 dark:bg-white/[0.01]">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {isEditing ? "Editar Grupo de Modificadores" : "Nuevo Grupo de Modificadores"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configura modalidad comercial, reglas de selección y opciones disponibles
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Selector de Sección Integrada */}
          <div className="flex items-center gap-1 px-4 sm:px-5 pt-3 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/30 dark:bg-white/[0.01] shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("general")}
              className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "general"
                  ? "border-[#ED500A] text-[#ED500A]"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white"
              }`}
            >
              1. Modalidad y Reglas
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
              3. Productos ({selectedProductIds.length})
            </button>
          </div>

          {/* Contenido del Formulario */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
            {/* ============================================================ */}
            {/* SECCIÓN 1: MODALIDAD Y REGLAS */}
            {/* ============================================================ */}
            {activeTab === "general" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Nombre y descripción */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Nombre del grupo *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ej. Acabados premium, Opciones de presentación, Adicionales"
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Descripción o instrucción opcional
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ej. Selecciona las opciones deseadas o añade complementos"
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]"
                    />
                  </div>
                </div>

                {/* Modalidad Comercial */}
                <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-white/5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Modalidad comercial del grupo *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Opción: Adicional */}
                    <div
                      onClick={() => setCommercialType("additional")}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        commercialType === "additional"
                          ? "border-[#ED500A] bg-[#ED500A]/5 dark:bg-[#ED500A]/10 shadow-xs"
                          : "border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Tag className={`w-4 h-4 ${commercialType === "additional" ? "text-[#ED500A]" : "text-slate-400"}`} />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Adicional / Extra
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Para incorporar componentes, adiciones o extras sumados al producto (ej. empaques, accesorios, complementos).
                      </p>
                    </div>

                    {/* Opción: Reemplazo */}
                    <div
                      onClick={() => setCommercialType("replacement")}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        commercialType === "replacement"
                          ? "border-[#ED500A] bg-[#ED500A]/5 dark:bg-[#ED500A]/10 shadow-xs"
                          : "border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <ArrowRightLeft className={`w-4 h-4 ${commercialType === "replacement" ? "text-[#ED500A]" : "text-slate-400"}`} />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Reemplazo / Sustitución
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Para sustituir un componente o especificación base del producto (ej. cambio de material, color o alternativa).
                      </p>
                    </div>
                  </div>

                  {commercialType === "size" && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                      <Info className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        Este grupo tiene configurada la modalidad histórica <strong>Tamaño</strong>. En NEGOVA las presentaciones comerciales se gestionan preferentemente con el sistema de <strong>Variantes</strong> (con SKU y stock propio).
                      </span>
                    </div>
                  )}
                </div>

                {/* Reglas de Selección */}
                <div className="p-4 bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 block">
                        Obligatorio para la venta
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Exige al cliente o cajero elegir opciones antes de confirmar el producto.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={required}
                        onChange={(e) => handleToggleRequired(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ED500A]"></div>
                    </label>
                  </div>

                  {/* Modo de selección */}
                  <div className="pt-3 border-t border-slate-200/60 dark:border-white/5 space-y-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Modo de selección
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectionTypeChange("single")}
                        className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                          selectionType === "single"
                            ? "bg-[#ED500A] text-white border-[#ED500A] shadow-xs"
                            : "bg-white dark:bg-[#0D0F16] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/[0.08] hover:bg-slate-100"
                        }`}
                      >
                        Selección única (Máx. 1)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectionTypeChange("multiple")}
                        className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                          selectionType === "multiple"
                            ? "bg-[#ED500A] text-white border-[#ED500A] shadow-xs"
                            : "bg-white dark:bg-[#0D0F16] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/[0.08] hover:bg-slate-100"
                        }`}
                      >
                        Selección múltiple (Varias)
                      </button>
                    </div>
                  </div>

                  {/* Límites de cantidad si es múltiple */}
                  {selectionType === "multiple" && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          Cantidad mínima
                        </label>
                        <input
                          type="number"
                          min={required ? 1 : 0}
                          max={maxSelect}
                          value={minSelect}
                          onChange={(e) =>
                            setMinSelect(
                              Math.max(
                                required ? 1 : 0,
                                Math.min(maxSelect, parseInt(e.target.value, 10) || 0)
                              )
                            )
                          }
                          className="w-full px-3 py-1.5 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs font-mono font-bold text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          Cantidad máxima
                        </label>
                        <input
                          type="number"
                          min={Math.max(1, minSelect)}
                          value={maxSelect}
                          onChange={(e) =>
                            setMaxSelect(
                              Math.max(
                                Math.max(1, minSelect),
                                parseInt(e.target.value, 10) || 1
                              )
                            )
                          }
                          className="w-full px-3 py-1.5 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs font-mono font-bold text-center"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("options")}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#ED500A] text-white rounded-xl text-xs font-bold transition-all hover:bg-[#ED500A]/90 cursor-pointer shadow-xs"
                  >
                    <span>Continuar a Opciones</span>
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* SECCIÓN 2: OPCIONES DEL GRUPO */}
            {/* ============================================================ */}
            {activeTab === "options" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Opciones disponibles en «{name.trim() || "el grupo"}»
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {options.length}{" "}
                      {options.length === 1 ? "opción registrada" : "opciones registradas"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir opción</span>
                  </button>
                </div>

                {options.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 dark:bg-white/[0.02] border border-dashed border-slate-200 dark:border-white/[0.08] rounded-2xl space-y-2">
                    <Tag className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold">
                      No hay opciones registradas en este grupo
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      Haz clic en «Añadir opción» para agregar alternativas, adiciones o especificaciones.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {options.map((opt, idx) => (
                      <div
                        key={opt.id || idx}
                        className="p-3 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl flex items-center gap-2.5 shadow-2xs group"
                      >
                        {/* Control de orden */}
                        <div className="flex flex-col gap-0.5 shrink-0 text-slate-300 group-hover:text-slate-400">
                          <button
                            type="button"
                            onClick={() => handleMoveOption(idx, "up")}
                            disabled={idx === 0}
                            className="hover:text-slate-700 dark:hover:text-white disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                            title="Subir opción"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveOption(idx, "down")}
                            disabled={idx === options.length - 1}
                            className="hover:text-slate-700 dark:hover:text-white disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                            title="Bajar opción"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Nombre de la opción */}
                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            value={opt.name}
                            onChange={(e) => handleOptionChange(idx, "name", e.target.value)}
                            placeholder="Nombre (ej. Queso mozzarella, Salsa BBQ)"
                            className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
                          />
                        </div>

                        {/* Precio adicional formateado */}
                        <div className="w-28 relative shrink-0">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                            +$
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={opt.price ? formatNumberWithDots(opt.price) : ""}
                            onChange={(e) =>
                              handleOptionChange(
                                idx,
                                "price",
                                parseNumberFromDots(e.target.value)
                              )
                            }
                            placeholder="0"
                            className="w-full pl-7 pr-2.5 py-1.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#ED500A]"
                          />
                        </div>

                        {/* Estado Activo / Inactivo */}
                        <button
                          type="button"
                          onClick={() =>
                            handleOptionChange(
                              idx,
                              "status",
                              opt.status === "inactive" ? "active" : "inactive"
                            )
                          }
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors shrink-0 cursor-pointer ${
                            opt.status !== "inactive"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                              : "bg-slate-100 dark:bg-white/5 text-slate-400 border-slate-200 dark:border-white/10"
                          }`}
                          title={opt.status !== "inactive" ? "Opción activa (en venta)" : "Opción suspendida / agotada"}
                        >
                          {opt.status !== "inactive" ? "Activa" : "Inactiva"}
                        </button>

                        {/* Eliminar opción */}
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(idx)}
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shrink-0 cursor-pointer"
                          title="Eliminar opción"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("general")}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer font-semibold"
                  >
                    ← Reglas y Modalidad
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("assignment")}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#ED500A] text-white rounded-xl text-xs font-bold transition-all hover:bg-[#ED500A]/90 cursor-pointer shadow-xs"
                  >
                    <span>Asignar a Productos</span>
                    <Package className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* SECCIÓN 3: ASIGNACIÓN A PRODUCTOS */}
            {/* ============================================================ */}
            {activeTab === "assignment" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Productos que utilizan este grupo
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {selectedProductIds.length}{" "}
                      {selectedProductIds.length === 1 ? "producto vinculado" : "productos vinculados"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllFilteredProducts}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
                    >
                      Seleccionar visibles
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllFilteredProducts}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      Limpiar visibles
                    </button>
                  </div>
                </div>

                {/* Filtro y buscador de productos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Buscar por nombre o SKU..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    <option value="all">Todas las categorías</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Lista de productos con checkbox */}
                {filteredProducts.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 dark:bg-white/[0.02] border border-dashed border-slate-200 dark:border-white/[0.08] rounded-xl space-y-1">
                    <p className="text-xs text-slate-500">No se encontraron productos coincidentes.</p>
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-1.5 p-1 border border-slate-200/60 dark:border-white/5 rounded-xl">
                    {filteredProducts.map((p) => {
                      const isSelected = selectedProductIds.includes(p.id);
                      const cat = categories.find((c) => c.id === p.category_id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => handleToggleProduct(p.id)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-[#ED500A]/5 border-[#ED500A]/40 text-slate-900 dark:text-white"
                              : "bg-white dark:bg-[#0D0F16] border-slate-100 dark:border-white/[0.04] text-slate-700 dark:text-slate-300 hover:border-slate-200"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // Manejado por el onClick del contenedor
                              className="w-4 h-4 text-[#ED500A] rounded border-slate-300 focus:ring-[#ED500A]"
                            />
                            <div className="min-w-0">
                              <span className="text-xs font-bold block truncate">
                                {p.name}
                              </span>
                              {cat && (
                                <span className="text-[10px] text-slate-400 block truncate">
                                  {cat.name}
                                </span>
                              )}
                            </div>
                          </div>

                          <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 shrink-0">
                            {formatCOP(p.price || 0)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Footer con acciones */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200/80 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Guardando grupo...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{isEditing ? "Guardar cambios" : "Crear grupo"}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
