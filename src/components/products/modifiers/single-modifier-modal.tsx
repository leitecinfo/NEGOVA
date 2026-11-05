"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  CreateModifierGroupInput,
  ModifierCommercialType,
  ModifierGroup,
  ModifierOptionInput,
  ModifierStatus,
} from "@/lib/modifiers/types";
import { Category, Product } from "@/lib/products/types";
import { formatCOP, formatNumberWithDots, parseNumberFromDots } from "@/lib/pos/types";
import {
  X,
  Sparkles,
  Tag,
  ArrowRightLeft,
  Search,
  Check,
  CheckSquare,
  Square,
  Package,
  Layers,
  Loader2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";

interface SingleModifierModalProps {
  isOpen: boolean;
  businessId: string;
  categories: Category[];
  products: Product[];
  modifier?: ModifierGroup | null;
  initialProductId?: string | null;
  onClose: () => void;
  onSave: (data: CreateModifierGroupInput) => Promise<void>;
  onConvertToGroup?: (group: ModifierGroup) => void;
}

export function SingleModifierModal({
  isOpen,
  businessId,
  categories,
  products,
  modifier,
  initialProductId,
  onClose,
  onSave,
  onConvertToGroup,
}: SingleModifierModalProps) {
  const isEditing = Boolean(modifier);

  // Nombre del modificador
  const [name, setName] = useState("");
  // Precio adicional en COP
  const [priceNumber, setPriceNumber] = useState<number>(0);
  const [priceDisplay, setPriceDisplay] = useState<string>("0");
  // Modalidad comercial
  const [commercialType, setCommercialType] = useState<ModifierCommercialType>("additional");
  // Estado activo / inactivo
  const [status, setStatus] = useState<ModifierStatus>("active");

  // Asignación de productos
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inicializar estado cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      if (modifier) {
        setName(modifier.name);
        const singleOption = modifier.options?.[0];
        const initialPrice = singleOption ? Number(singleOption.price || 0) : 0;
        setPriceNumber(initialPrice);
        setPriceDisplay(formatNumberWithDots(initialPrice));
        setCommercialType(modifier.commercial_type || "additional");
        setStatus(modifier.status || "active");
        setSelectedProductIds(modifier.applied_product_ids || []);
      } else {
        setName("");
        setPriceNumber(0);
        setPriceDisplay("0");
        setCommercialType("additional");
        setStatus("active");
        setSelectedProductIds(initialProductId ? [initialProductId] : []);
      }
      setProductSearch("");
      setSelectedCategoryFilter("all");
    }
  }, [isOpen, modifier, initialProductId]);

  // Manejo de tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  // Filtrado de productos para asignación
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategoryFilter !== "all" && p.category_id !== selectedCategoryFilter) {
        return false;
      }
      if (!productSearch.trim()) return true;
      const q = productSearch.trim().toLowerCase();
      const meta = (p.metadata || {}) as Record<string, any>;
      return (
        p.name.toLowerCase().includes(q) ||
        (meta.sku && String(meta.sku).toLowerCase().includes(q)) ||
        (meta.barcode && String(meta.barcode).toLowerCase().includes(q))
      );
    });
  }, [products, selectedCategoryFilter, productSearch]);

  const toggleProduct = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const selectAllFiltered = () => {
    const idsToAdd = filteredProducts.map((p) => p.id);
    setSelectedProductIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
  };

  const deselectAllFiltered = () => {
    const idsToRemove = new Set(filteredProducts.map((p) => p.id));
    setSelectedProductIds((prev) => prev.filter((id) => !idsToRemove.has(id)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("El nombre del modificador es requerido");
      return;
    }

    try {
      setIsSubmitting(true);

      const singleOption: ModifierOptionInput = {
        id: modifier?.options?.[0]?.id,
        name: name.trim(),
        price: Math.max(0, priceNumber),
        status: status,
        sort_order: 0,
      };

      const payload: CreateModifierGroupInput = {
        name: name.trim(),
        description: null,
        commercial_type: commercialType,
        required: false,
        selection_type: "single",
        min_select: 0,
        max_select: 1,
        sort_order: modifier?.sort_order ?? 0,
        status: status,
        product_ids: selectedProductIds,
        category_ids: [],
        options: [singleOption],
      };

      await onSave(payload);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar el modificador");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[10050] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-150"
        >
          {/* 1. ENCABEZADO */}
          <div className="px-5 py-4 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#ED500A]/10 border border-[#ED500A]/20 flex items-center justify-center shrink-0 text-[#ED500A]">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                  {isEditing ? "Editar Modificador Individual" : "Nuevo Modificador"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  Crea un adicional, extra o reemplazo individual para tu catálogo o productos
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 2. CUERPO SCROLLABLE */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
            {/* Si estamos editando y existe la opción de convertir a grupo completo */}
            {isEditing && modifier && onConvertToGroup && (
              <div className="p-3.5 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-bold text-purple-900 dark:text-purple-200">
                      ¿Necesitas agregar más alternativas a este modificador?
                    </h5>
                    <p className="text-[11px] text-purple-700 dark:text-purple-300">
                      Puedes convertirlo en un grupo de opciones completo conservando los productos asignados.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onConvertToGroup(modifier);
                  }}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer text-center"
                >
                  Convertir en grupo
                </button>
              </div>
            )}

            {/* 1. Nombre del Modificador (Ancho completo) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Nombre del modificador *
              </label>
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Accesorio extra, Estuche protector, Adición especial..."
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]"
              />
            </div>

            {/* 2. Modalidad Comercial (Selector espacioso de 2 tarjetas completas) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Modalidad comercial
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Opción Adicional */}
                <button
                  type="button"
                  onClick={() => setCommercialType("additional")}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 relative ${
                    commercialType === "additional"
                      ? "border-[#ED500A] bg-[#ED500A]/5 dark:bg-[#ED500A]/10 ring-1 ring-[#ED500A] shadow-xs"
                      : "border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      commercialType === "additional"
                        ? "bg-[#ED500A] text-white shadow-xs"
                        : "bg-slate-200/70 dark:bg-white/10 text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    <Tag className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        Adicional / Suplemento
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#ED500A]/15 text-[#ED500A]">
                        + Extra
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                      Suma un componente o producto complementario sobre el precio base.
                    </p>
                  </div>
                </button>

                {/* Opción Reemplazo */}
                <button
                  type="button"
                  onClick={() => setCommercialType("replacement")}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 relative ${
                    commercialType === "replacement"
                      ? "border-blue-500 bg-blue-500/5 dark:bg-blue-500/10 ring-1 ring-blue-500 shadow-xs"
                      : "border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      commercialType === "replacement"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-slate-200/70 dark:bg-white/10 text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        Reemplazo / Sustitución
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400">
                        ⇄ Cambio
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                      Sustituye o intercambia un componente base o estándar del producto.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* 3. Precio Adicional (Ubicado abajo de la Modalidad Comercial) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {commercialType === "replacement" ? "Costo adicional por reemplazo (COP)" : "Precio adicional (COP)"}
                </label>
                <span className="text-[11px] text-slate-400 font-medium">
                  $ 0 = Sin costo adicional
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                  $
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={priceDisplay}
                  onChange={(e) => {
                    const raw = parseNumberFromDots(e.target.value);
                    const formatted = formatNumberWithDots(e.target.value);
                    setPriceDisplay(formatted);
                    setPriceNumber(raw);
                  }}
                  placeholder="0"
                  className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]"
                />
              </div>
            </div>

            {/* Campo 3: Estado Activo / Inactivo */}
            <div className="p-3 bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Estado del modificador
                </span>
                <span className="text-[11px] text-slate-500">
                  {status === "active"
                    ? "Disponible para selección en POS y Menú QR"
                    : "Pausado (no aparecerá disponible temporalmente)"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStatus(status === "active" ? "inactive" : "active")}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                  status === "active"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    : "bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400 border-transparent"
                }`}
              >
                {status === "active" ? "● Activo" : "○ Inactivo"}
              </button>
            </div>

            {/* Campo 4: Asignación a Productos (Opcional) */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Asignar a productos
                    </label>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400">
                      Opcional
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Puedes asignar este modificador a productos ahora o hacerlo posteriormente desde Productos.
                  </span>
                </div>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-colors ${
                    selectedProductIds.length === 0
                      ? "bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-white/[0.06]"
                      : "bg-[#ED500A]/10 text-[#ED500A] border-[#ED500A]/20"
                  }`}
                >
                  {selectedProductIds.length === 0
                    ? "Sin asignar (Opcional)"
                    : `${selectedProductIds.length} ${
                        selectedProductIds.length === 1
                          ? "producto vinculado"
                          : "productos vinculados"
                      }`}
                </span>
              </div>

              {/* Barra de Filtro y Búsqueda de Productos */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Buscar producto..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs"
                  />
                </div>

                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-hidden"
                >
                  <option value="all">Todas las categorías</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={selectAllFiltered}
                    className="px-2 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-[#ED500A] rounded-lg transition-colors cursor-pointer"
                  >
                    Todos
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={deselectAllFiltered}
                    className="px-2 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                  >
                    Ninguno
                  </button>
                </div>
              </div>

              {/* Lista Scrollable de Productos */}
              <div className="max-h-56 overflow-y-auto border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-2 bg-slate-50/50 dark:bg-white/[0.01] divide-y divide-slate-100 dark:divide-white/[0.04]">
                {filteredProducts.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No se encontraron productos que coincidan con la búsqueda.
                  </div>
                ) : (
                  filteredProducts.map((p) => {
                    const isSelected = selectedProductIds.includes(p.id);
                    const cat = categories.find((c) => c.id === p.category_id);

                    return (
                      <div
                        key={p.id}
                        onClick={() => toggleProduct(p.id)}
                        className={`flex items-center justify-between p-2 rounded-xl transition-colors cursor-pointer select-none ${
                          isSelected
                            ? "bg-[#ED500A]/10 text-slate-900 dark:text-white"
                            : "hover:bg-slate-100/70 dark:hover:bg-white/[0.04]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                              isSelected
                                ? "bg-[#ED500A] border-[#ED500A] text-white"
                                : "border-slate-300 dark:border-white/20"
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>

                          <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.08] shrink-0 flex items-center justify-center">
                            {p.image_url ? (
                              <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <span className="text-xs font-semibold block truncate">{p.name}</span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {cat?.name || "Sin categoría"}
                            </span>
                          </div>
                        </div>

                        <span className="text-xs font-mono font-medium text-slate-600 dark:text-slate-400 shrink-0">
                          {formatCOP(p.price)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </form>

          {/* 3. PIE DE ACCIONES */}
          <div className="px-5 py-3.5 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-200/60 dark:hover:bg-white/[0.04] transition-all cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !name.trim()}
              className="inline-flex items-center gap-2 px-5 py-2 bg-[#ED500A] hover:bg-[#ED500A]/90 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isEditing ? "Guardar cambios" : "Crear modificador"}</span>
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

