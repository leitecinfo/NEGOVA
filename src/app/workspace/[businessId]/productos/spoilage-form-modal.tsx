"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  AlertTriangle,
  Package,
  Layers,
  Calendar,
  DollarSign,
  Search,
  CheckCircle2,
  Loader2,
  X,
  FileText,
  Boxes,
} from "lucide-react";
import { toast } from "sonner";
import { CustomModal } from "@/components/ui/custom-modal";
import { Product } from "@/lib/products/types";
import { Ingredient } from "@/lib/recipes/types";
import {
  SpoilageCause,
  SpoilageItemType,
  SPOILAGE_CAUSES,
  SPOILAGE_CAUSE_LABELS,
} from "@/lib/spoilage/types";
import { createSpoilageRecordAction } from "./actions";
import { getIngredientsAction } from "../recetas/actions";
import { formatCOP } from "@/lib/pos/types";

interface Props {
  businessId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  products: Product[];
}

export function SpoilageFormModal({
  businessId,
  isOpen,
  onClose,
  onSuccess,
  products,
}: Props) {
  // Selector de Origen: ¿Qué se perdió? -> [Producto] o [Ingrediente]
  const [itemType, setItemType] = useState<SpoilageItemType>("product");

  // Búsqueda y selección
  const [productSearch, setProductSearch] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [ingredientSearch, setIngredientSearch] = useState<string>("");
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [customIngredientName, setCustomIngredientName] = useState<string>("");

  // Lista de ingredientes cargada desde el servidor
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isLoadingIngredients, setIsLoadingIngredients] = useState<boolean>(false);

  // Formulario de merma
  const [cause, setCause] = useState<SpoilageCause>("expired");
  const [quantity, setQuantity] = useState<string>("");
  const [unitCost, setUnitCost] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [date, setDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar ingredientes al abrir el modal
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setIsLoadingIngredients(true);

    getIngredientsAction(businessId)
      .then((res) => {
        if (isMounted && res.success && res.data) {
          setIngredients(res.data);
        }
      })
      .catch((err) => {
        console.warn("No se pudieron cargar ingredientes para merma:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingIngredients(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, businessId]);

  // Limpiar campos al cambiar de pestaña / origen
  const handleSwitchItemType = (type: SpoilageItemType) => {
    setItemType(type);
    setSelectedProduct(null);
    setProductSearch("");
    setSelectedIngredient(null);
    setIngredientSearch("");
    setCustomIngredientName("");
    setUnitCost("");
  };

  // Filtrar productos disponibles por búsqueda
  const filteredProducts = useMemo(() => {
    const list = products.filter((p) => p.status !== "archived");
    if (!productSearch.trim()) return list.slice(0, 8);
    const q = productSearch.toLowerCase();
    return list
      .filter((p) => p.name.toLowerCase().includes(q) || (p.categories?.name && p.categories.name.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [products, productSearch]);

  // Filtrar ingredientes disponibles por búsqueda
  const filteredIngredients = useMemo(() => {
    if (!ingredientSearch.trim()) return ingredients.slice(0, 8);
    const q = ingredientSearch.toLowerCase();
    return ingredients
      .filter((ing) => ing.name.toLowerCase().includes(q) || (ing.unit && ing.unit.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [ingredients, ingredientSearch]);

  // Manejador al seleccionar producto
  const handleSelectProduct = (prod: Product) => {
    setSelectedProduct(prod);
    setProductSearch(prod.name);
    const cost = (prod.metadata as any)?.cost ?? (prod.metadata as any)?.average_cost ?? 0;
    setUnitCost(cost > 0 ? String(cost) : "0");
  };

  // Manejador al seleccionar ingrediente
  const handleSelectIngredient = (ing: Ingredient) => {
    setSelectedIngredient(ing);
    setIngredientSearch(ing.name);
    setCustomIngredientName(ing.name);
    setUnitCost(ing.costPerUnit > 0 ? String(ing.costPerUnit) : "0");
  };

  const parsedQty = parseFloat(quantity) || 0;
  const parsedCost = parseFloat(unitCost) || 0;
  const totalCost = parsedQty * parsedCost;

  // Reset del modal al cerrar
  const handleClose = () => {
    setSelectedProduct(null);
    setProductSearch("");
    setSelectedIngredient(null);
    setIngredientSearch("");
    setCustomIngredientName("");
    setQuantity("");
    setUnitCost("");
    setNotes("");
    setDate(new Date().toISOString().split("T")[0]);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (itemType === "product" && !selectedProduct) {
      toast.error("Selecciona un producto a mermar.");
      return;
    }

    if (itemType === "ingredient" && !selectedIngredient && !customIngredientName.trim()) {
      toast.error("Selecciona o ingresa el nombre del ingrediente a mermar.");
      return;
    }

    if (parsedQty <= 0) {
      toast.error("La cantidad a mermar debe ser mayor a 0.");
      return;
    }

    if (parsedCost < 0) {
      toast.error("El costo unitario no puede ser negativo.");
      return;
    }

    const itemId =
      itemType === "product"
        ? selectedProduct!.id
        : selectedIngredient
        ? selectedIngredient.id
        : `ing_${Date.now()}`;

    const itemName =
      itemType === "product"
        ? selectedProduct!.name
        : selectedIngredient
        ? selectedIngredient.name
        : customIngredientName.trim();

    setIsSubmitting(true);
    try {
      const res = await createSpoilageRecordAction(businessId, {
        itemType,
        itemId,
        itemName,
        cause,
        quantity: parsedQty,
        unitCost: parsedCost,
        notes: notes.trim() || undefined,
        date: date ? new Date(`${date}T12:00:00Z`).toISOString() : undefined,
      });

      if (!res.success || !res.data) {
        toast.error("Error al registrar la merma", {
          description: res.error || "No se pudo procesar la merma.",
        });
        return;
      }

      toast.success("Merma registrada exitosamente", {
        description: `Se descontaron ${parsedQty} un. de «${itemName}» del stock disponible.`,
      });

      handleClose();
      onSuccess?.();
    } catch (err: any) {
      toast.error("Error inesperado", {
        description: err?.message || "Ocurrió un error al registrar la merma.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Registrar Nueva Merma"
      description="Registra la pérdida de producto o materia prima. El inventario se actualizará automáticamente."
      maxWidth="2xl"
      showConfirmButton={false}
    >
      <form onSubmit={handleSubmit} className="space-y-4.5 mt-2">
        {/* AVISO DESTACADO OBLIGATORIO */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
              Aviso: El stock se descontará automáticamente
            </p>
            <p className="text-[11px] text-amber-700/90 dark:text-amber-300/80 mt-0.5 leading-relaxed">
              Al confirmar esta merma, las cantidades registradas se restarán directamente de tus existencias
              de inventario y quedarán registradas de manera inmutable en el kardex de la empresa.
            </p>
          </div>
        </div>

        {/* SELECTOR DE ORIGEN: ¿Qué se perdió? -> [Producto] o [Ingrediente] */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            ¿Qué se perdió? *
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleSwitchItemType("product")}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-xs font-bold transition-all ${
                itemType === "product"
                  ? "bg-[#ED500A] text-white border-[#ED500A] shadow-xs"
                  : "bg-white dark:bg-[#0D0F16] border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:border-[#ED500A]/40"
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Producto</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchItemType("ingredient")}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-xs font-bold transition-all ${
                itemType === "ingredient"
                  ? "bg-[#ED500A] text-white border-[#ED500A] shadow-xs"
                  : "bg-white dark:bg-[#0D0F16] border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:border-[#ED500A]/40"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Ingrediente</span>
            </button>
          </div>
        </div>

        {/* BUSCADOR RESPECTIVO */}
        {itemType === "product" ? (
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Buscar producto... <span className="text-rose-500">*</span>
            </label>

            {selectedProduct ? (
              <div className="p-3 bg-white dark:bg-[#0D0F16] border border-[#ED500A]/50 rounded-xl flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {selectedProduct.name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Stock actual:{" "}
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {(selectedProduct.metadata as any)?.stock_quantity ?? "0"} un.
                      </span>{" "}
                      {selectedProduct.categories?.name && `• ${selectedProduct.categories.name}`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProduct(null);
                    setProductSearch("");
                  }}
                  className="text-xs text-[#ED500A] hover:underline font-semibold shrink-0"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Buscar producto..."
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/40"
                  />
                </div>

                {filteredProducts.length > 0 && (
                  <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-white/[0.08] rounded-xl bg-white dark:bg-[#0D0F16] divide-y divide-slate-100 dark:divide-white/[0.04]">
                    {filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectProduct(p)}
                        className="w-full p-2.5 text-left flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {p.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {p.categories?.name ? `${p.categories.name} • ` : ""}
                            Stock: {(p.metadata as any)?.stock_quantity ?? 0} un.
                          </p>
                        </div>
                        <span className="text-[11px] font-bold text-[#ED500A] shrink-0">
                          {formatCOP(Number(p.price))}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Buscar ingrediente... <span className="text-rose-500">*</span>
            </label>

            {selectedIngredient ? (
              <div className="p-3 bg-white dark:bg-[#0D0F16] border border-[#ED500A]/50 rounded-xl flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {selectedIngredient.name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Stock actual:{" "}
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {selectedIngredient.stockQuantity} {selectedIngredient.unit}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIngredient(null);
                    setIngredientSearch("");
                    setCustomIngredientName("");
                  }}
                  className="text-xs text-[#ED500A] hover:underline font-semibold shrink-0"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={ingredientSearch}
                    onChange={(e) => {
                      setIngredientSearch(e.target.value);
                      setCustomIngredientName(e.target.value);
                    }}
                    placeholder="Buscar ingrediente..."
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/40"
                  />
                </div>

                {isLoadingIngredients ? (
                  <div className="p-2 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ED500A]" />
                    <span>Cargando insumos e ingredientes...</span>
                  </div>
                ) : filteredIngredients.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-white/[0.08] rounded-xl bg-white dark:bg-[#0D0F16] divide-y divide-slate-100 dark:divide-white/[0.04]">
                    {filteredIngredients.map((ing) => (
                      <button
                        key={ing.id}
                        type="button"
                        onClick={() => handleSelectIngredient(ing)}
                        className="w-full p-2.5 text-left flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <div>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {ing.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Stock: {ing.stockQuantity} {ing.unit}
                          </p>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500">
                          {formatCOP(ing.costPerUnit)} / {ing.unit}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : ingredientSearch.trim().length > 0 ? (
                  <div className="p-2.5 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
                    <span>
                      Registrar como nuevo insumo: <strong>«{ingredientSearch.trim()}»</strong>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-semibold">
                      Listo
                    </span>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* SELECTOR DE CAUSA Y FECHA */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Causa: Vencido, Dañado, Derramado, Robo, Otro */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Causa de la Pérdida *
            </label>
            <select
              value={cause}
              onChange={(e) => setCause(e.target.value as SpoilageCause)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/40 transition-colors"
            >
              <option value="expired">Vencido</option>
              <option value="damaged">Dañado</option>
              <option value="spilled">Derramado</option>
              <option value="stolen">Robo</option>
              <option value="other">Otro</option>
            </select>
          </div>

          {/* Fecha * (por defecto hoy) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Fecha del Incidente *
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/40 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* CANTIDAD * Y COSTO UNITARIO * */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Cantidad Mermada *
            </label>
            <input
              type="number"
              step="any"
              min="0.001"
              placeholder="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/40"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Costo Unitario ($ COP) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                $
              </span>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="0"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                required
                className="w-full pl-7 pr-3.5 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/40"
              />
            </div>
          </div>
        </div>

        {/* CÁLCULO DE VALOR TOTAL */}
        <div className="p-3.5 rounded-xl bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Pérdida económica calculada:
          </span>
          <span className="text-base font-extrabold text-rose-600 dark:text-rose-400">
            {formatCOP(totalCost)}
          </span>
        </div>

        {/* DETALLES ADICIONALES: Descripción / Motivo */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Descripción / Motivo
          </label>
          <textarea
            rows={2}
            placeholder="Detalles adicionales sobre cómo ocurrió la pérdida, lote afectado o responsable..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3.5 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/40 resize-none transition-colors"
          />
        </div>

        {/* BOTONES DE ACCIÓN */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200/80 dark:border-white/[0.08]">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Descontando Stock...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar y Descontar Stock</span>
              </>
            )}
          </button>
        </div>
      </form>
    </CustomModal>
  );
}
