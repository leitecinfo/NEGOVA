"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Input, SearchSelect, Select } from "@/components/ui";
import {
  X,
  ChefHat,
  Clock,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Sparkles,
  TrendingUp,
  PackageCheck,
  Loader2,
  UtensilsCrossed,
  Package,
  AlertTriangle,
  Info,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { Location } from "@/lib/inventory/types";
import { Product } from "@/lib/products/types";
import {
  RecipeWithDetails,
  RecipeIngredient,
  CreateRecipeInput,
  UpdateRecipeInput,
  Ingredient,
} from "@/lib/recipes/types";
import {
  createRecipeAction,
  updateRecipeAction,
  getIngredientsAction,
  getRecipesAction,
} from "./actions";
import { getProductsAction } from "../productos/actions";
import {
  calculateLineCostWithConversion,
  getRecipeUnitOptions,
  convertQuantity,
} from "@/lib/recipes/unit-conversion";

interface Props {
  businessId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (recipe?: any) => void;
  locations: Location[];
  recipeToEdit?: RecipeWithDetails | null;
  initialProductId?: string;
  availableUnits?: { value: string; label: string }[];
}

export interface FormIngredientLine {
  tempId: string;
  ingredientId: string;
  quantity: number | string;
  unit: string;
  isOptional: boolean;
}

export function RecipeFormModal({
  businessId,
  isOpen,
  onClose,
  onSuccess,
  locations,
  recipeToEdit,
  initialProductId,
  availableUnits,
}: Props) {
  const isEditing = Boolean(recipeToEdit);

  // Estados de carga de catálogos
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [availableIngredients, setAvailableIngredients] = useState<Ingredient[]>([]);
  const [existingRecipes, setExistingRecipes] = useState<RecipeWithDetails[]>([]);

  // Estados del formulario
  const [productId, setProductId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [portions, setPortions] = useState<number | string>(1);
  const [prepTimeMinutes, setPrepTimeMinutes] = useState<number | string>("15");
  const [locationId, setLocationId] = useState<string>("");
  const [lines, setLines] = useState<FormIngredientLine[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Formato de moneda COP
  const formatCOP = (val: number | null | undefined): string => {
    if (val === null || val === undefined || isNaN(val)) return "$0";
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Cargar catálogos al abrir modal
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadData() {
      setIsLoadingCatalogs(true);
      try {
        const [prodsRes, ingsRes, recipesRes] = await Promise.all([
          getProductsAction(businessId),
          getIngredientsAction(businessId),
          getRecipesAction(businessId),
        ]);

        if (!isMounted) return;

        if (recipesRes.success && recipesRes.data) {
          setExistingRecipes(recipesRes.data);
        }

        if (prodsRes.success && prodsRes.data) {
          // Filtrar productos válidos: excluir ingredientes e items marcados como servicio
          const candidates = prodsRes.data.filter((p) => {
            const meta = (p.metadata as any) || {};
            if (meta.product_type === "ingredient") return false;
            if (meta.product_kind === "service") return false;
            return true;
          });
          setAvailableProducts(candidates);
        }

        const baseIngredients: Ingredient[] = ingsRes.success && ingsRes.data ? ingsRes.data : [];
        const existingRecs = recipesRes.success && recipesRes.data ? recipesRes.data : [];

        // Integrar productos comerciales con stock directo como ingredientes elegibles en recetas [AUD-006]
        const commercialAsIngredients: Ingredient[] = (prodsRes.data || [])
          .filter((p) => {
            const meta = (p.metadata as any) || {};
            if (meta.product_type === "ingredient") return false;
            if (meta.product_type === "service" || meta.product_kind === "service") return false;
            // Excluir productos elaborados con recetas para prevenir dependencias circulares
            const hasRecipe = existingRecs.some((r) => r.productId === p.id && r.status === "active");
            if (hasRecipe) return false;
            // Solo productos comerciales con control de existencias
            return Boolean(meta.track_stock);
          })
          .map((p) => {
            const meta = (p.metadata as any) || {};
            const cost = Number(meta.cost ?? meta.average_cost ?? 0);
            return {
              id: p.id,
              businessId,
              name: `${p.name} (Catálogo Comercial)`,
              type: "supply" as const,
              sku: meta.sku || null,
              barcode: meta.barcode || null,
              unit: meta.unit || "unidad",
              costPerUnit: cost,
              stockQuantity: Number(meta.stock_quantity ?? 0),
              minStock: Number(meta.min_stock ?? 0),
              locationId: null,
              categoryId: p.category_id,
              categoryName: p.categories?.name || null,
              availableInPos: true,
              availableInQr: false,
              availableOnline: false,
              isAvailable: p.is_available,
              notes: p.description || null,
              createdAt: p.created_at,
              updatedAt: p.updated_at,
            };
          });

        setAvailableIngredients([...baseIngredients, ...commercialAsIngredients]);
      } catch (err) {
        console.error("Error al cargar datos para formulario de recetas:", err);
      } finally {
        if (isMounted) setIsLoadingCatalogs(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [isOpen, businessId]);

  // Inicializar campos según edición o creación
  useEffect(() => {
    if (!isOpen) return;

    if (recipeToEdit) {
      setProductId(recipeToEdit.productId);
      setName(recipeToEdit.name);
      setDescription(recipeToEdit.description || "");
      setPortions(recipeToEdit.portions || 1);
      setPrepTimeMinutes(
        recipeToEdit.prepTimeMinutes !== null && recipeToEdit.prepTimeMinutes !== undefined
          ? recipeToEdit.prepTimeMinutes
          : ""
      );
      setLocationId(recipeToEdit.locationId || "");

      const mappedLines: FormIngredientLine[] = (recipeToEdit.ingredients || []).map((ing, idx) => ({
        tempId: `line-${idx}-${Date.now()}`,
        ingredientId: ing.ingredientId,
        quantity: ing.quantity,
        unit: ing.unit,
        isOptional: Boolean(ing.isOptional),
      }));
      setLines(mappedLines.length > 0 ? mappedLines : [createEmptyLine()]);
    } else {
      setProductId(initialProductId || "");
      setName("");
      setDescription("");
      setPortions(1);
      setPrepTimeMinutes("15");
      setLocationId("");
      setLines([createEmptyLine()]);
    }
  }, [isOpen, recipeToEdit, initialProductId]);

  // Producto seleccionado actual
  const selectedProduct = useMemo(() => {
    return availableProducts.find((p) => p.id === productId);
  }, [availableProducts, productId]);

  // Sugerir nombre de receta automáticamente al seleccionar producto
  const handleProductChange = (newProductId: string) => {
    setProductId(newProductId);
    const prod = availableProducts.find((p) => p.id === newProductId);
    if (prod && (!name || name.trim() === "" || name.startsWith("Receta de "))) {
      setName(`Receta de ${prod.name}`);
    }
  };

  // Validar si el producto seleccionado ya tiene una receta activa
  const duplicateRecipeConflict = useMemo(() => {
    if (!productId) return null;
    return existingRecipes.find(
      (r) =>
        r.productId === productId &&
        r.status === "active" &&
        (!recipeToEdit || r.id !== recipeToEdit.id)
    );
  }, [existingRecipes, productId, recipeToEdit]);

  // Helper para crear una línea vacía de ingrediente
  function createEmptyLine(): FormIngredientLine {
    return {
      tempId: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ingredientId: "",
      quantity: 1,
      unit: "unidad",
      isOptional: false,
    };
  }

  // Agregar nueva fila de ingrediente
  const handleAddLine = () => {
    setLines((prev) => [...prev, createEmptyLine()]);
  };

  // Eliminar fila de ingrediente
  const handleRemoveLine = (tempId: string) => {
    setLines((prev) => {
      const filtered = prev.filter((l) => l.tempId !== tempId);
      return filtered.length === 0 ? [createEmptyLine()] : filtered;
    });
  };

  // Modificar campo de una fila
  const handleUpdateLine = (tempId: string, updates: Partial<FormIngredientLine>) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.tempId !== tempId) return l;

        const updated = { ...l, ...updates };

        // Si cambió el ingrediente, sugerir la unidad del ingrediente por defecto
        if (updates.ingredientId && updates.ingredientId !== l.ingredientId) {
          const ing = availableIngredients.find((i) => i.id === updates.ingredientId);
          if (ing) {
            updated.unit = ing.unit || "unidad";
          }
        }
        return updated;
      })
    );
  };

  // Opciones de productos para SearchSelect
  const productOptions = useMemo(() => {
    return availableProducts.map((p) => {
      const hasRecipe = existingRecipes.some((r) => r.productId === p.id && r.status === "active");
      const isCurrent = recipeToEdit && recipeToEdit.productId === p.id;
      return {
        value: p.id,
        label: p.name,
        description: `${formatCOP(p.price)} · ${p.categories?.name || (p as any).category_name || "Sin categoría"} ${
          hasRecipe && !isCurrent ? "(Ya tiene receta activa)" : ""
        }`,
      };
    });
  }, [availableProducts, existingRecipes, recipeToEdit]);

  // Mapa rápido de ingredientes
  const ingredientsMap = useMemo(() => {
    const map = new Map<string, Ingredient>();
    availableIngredients.forEach((i) => map.set(i.id, i));
    return map;
  }, [availableIngredients]);

  // IDs de ingredientes ya utilizados para evitar duplicación
  const usedIngredientIds = useMemo(() => {
    return new Set(lines.map((l) => l.ingredientId).filter(Boolean));
  }, [lines]);

  // Cálculos en vivo de líneas, costos y conversiones
  const calculatedLines = useMemo(() => {
    return lines.map((line) => {
      const ing = ingredientsMap.get(line.ingredientId);
      const qtyNum = Math.max(0, parseFloat(String(line.quantity)) || 0);

      if (!ing) {
        return {
          ...line,
          ingredient: null,
          unitCost: 0,
          subtotalCost: 0,
          isCompatible: true,
          conversionExplanation: undefined,
        };
      }

      const costResult = calculateLineCostWithConversion({
        recipeQuantity: qtyNum,
        recipeUnit: line.unit,
        ingredientStockUnit: ing.unit,
        ingredientUnitCost: ing.costPerUnit,
      });

      return {
        ...line,
        ingredient: ing,
        unitCost: costResult.unitCostInRecipeUnit,
        subtotalCost: costResult.subtotalCost,
        quantityInStockUnit: costResult.quantityInStockUnit,
        isCompatible: costResult.isCompatible,
        conversionExplanation: costResult.conversionExplanation,
      };
    });
  }, [lines, ingredientsMap]);

  // Costo total y métricas financieras
  const numericPortions = Math.max(1, parseInt(String(portions), 10) || 1);
  const totalCost = calculatedLines.reduce((acc, l) => acc + (l.subtotalCost || 0), 0);
  const costPerPortion = Number((totalCost / numericPortions).toFixed(2));
  const productPrice = selectedProduct?.price || 0;
  const marginPercentage =
    productPrice > 0
      ? Number((((productPrice - costPerPortion) / productPrice) * 100).toFixed(1))
      : 0;

  // Cálculo de capacidad estimada según existencias reales (Ingrediente Limitante)
  const capacityEstimate = useMemo(() => {
    let minPortions = Infinity;
    let limitingIngName = "";
    let limitingStock = 0;
    let limitingRequired = 0;
    let limitingUnit = "";
    let hasMandatory = false;

    for (const line of calculatedLines) {
      if (!line.ingredient || line.isOptional) continue;
      const ing = line.ingredient;
      const qtyNum = Math.max(0, parseFloat(String(line.quantity)) || 0);
      if (qtyNum <= 0) continue;

      hasMandatory = true;
      const requiredPerPortion = qtyNum / numericPortions;

      // Convertir stock a la unidad de la receta
      const convertedStock = convertQuantity(ing.stockQuantity, ing.unit, line.unit);
      const stockInRecipeUnit = convertedStock.isCompatible
        ? convertedStock.convertedQuantity
        : ing.stockQuantity;

      const portionsPossible =
        requiredPerPortion > 0 ? stockInRecipeUnit / requiredPerPortion : 0;

      if (portionsPossible < minPortions) {
        minPortions = portionsPossible;
        limitingIngName = ing.name;
        limitingStock = ing.stockQuantity;
        limitingRequired = requiredPerPortion;
        limitingUnit = ing.unit;
      }
    }

    if (!hasMandatory || minPortions === Infinity) {
      return {
        portionsAvailable: 0,
        exactPortions: 0,
        limitingName: null,
        limitingStock: 0,
        limitingRequired: 0,
        limitingUnit: "",
      };
    }

    return {
      portionsAvailable: Math.floor(Math.max(0, minPortions)),
      exactPortions: Number(minPortions.toFixed(1)),
      limitingName: limitingIngName,
      limitingStock,
      limitingRequired,
      limitingUnit,
    };
  }, [calculatedLines, numericPortions]);

  // Guardar receta
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!productId) {
      toast.error("Selecciona el producto preparado para la receta.");
      return;
    }

    if (duplicateRecipeConflict) {
      toast.error(
        `Este producto ya cuenta con la receta activa «${duplicateRecipeConflict.name}». Edítala o desactívala.`
      );
      return;
    }

    if (!name.trim()) {
      toast.error("El nombre de la receta es obligatorio.");
      return;
    }

    const validLines = lines.filter((l) => l.ingredientId && parseFloat(String(l.quantity)) > 0);
    if (validLines.length === 0) {
      toast.error("Debes agregar al menos un ingrediente con cantidad mayor a cero.");
      return;
    }

    // Validar compatibilidad de unidades en cada línea
    for (const l of calculatedLines) {
      if (l.ingredient && !l.isCompatible) {
        toast.error(
          `La unidad «${l.unit}» no es compatible con la unidad de inventario de «${l.ingredient.name}» (${l.ingredient.unit}).`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const ingredientsPayload = validLines.map((l, idx) => ({
        ingredientId: l.ingredientId,
        quantity: parseFloat(String(l.quantity)),
        unit: l.unit.trim(),
        isOptional: Boolean(l.isOptional),
        sortOrder: idx,
      }));

      if (isEditing && recipeToEdit) {
        const payload: UpdateRecipeInput = {
          name: name.trim(),
          description: description.trim() || null,
          portions: numericPortions,
          prepTimeMinutes: prepTimeMinutes ? parseInt(String(prepTimeMinutes), 10) : null,
          locationId: locationId || null,
          ingredients: ingredientsPayload,
        };

        const res = await updateRecipeAction(businessId, recipeToEdit.id, payload);
        if (res.success && res.data) {
          toast.success("Receta actualizada exitosamente.", {
            description: `Se recalcularon los costos y escandallos de «${res.data.name}».`,
          });
          onSuccess(res.data);
          onClose();
        } else {
          toast.error(res.error || "No se pudo actualizar la receta.");
        }
      } else {
        const payload: CreateRecipeInput = {
          productId,
          name: name.trim(),
          description: description.trim() || null,
          portions: numericPortions,
          prepTimeMinutes: prepTimeMinutes ? parseInt(String(prepTimeMinutes), 10) : null,
          locationId: locationId || null,
          ingredients: ingredientsPayload,
        };

        const res = await createRecipeAction(businessId, payload);
        if (res.success && res.data) {
          toast.success("¡Receta creada exitosamente!", {
            description: `Ficha técnica vinculada a «${res.data.productName}».`,
          });
          onSuccess(res.data);
          onClose();
        } else {
          toast.error(res.error || "No se pudo registrar la receta.");
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Ocurrió un error al guardar la receta.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-4xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* CABECERA DEL MODAL */}
          <div className="px-5 py-4 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center font-bold shrink-0">
                <ChefHat className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {isEditing ? `Editar Receta: ${recipeToEdit?.name}` : "Nueva Receta de Producto"}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Define los ingredientes, cantidades y costo de elaboración del producto preparado.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* FORMULARIO PRINCIPAL */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {isLoadingCatalogs ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-[#ED500A]" />
                <span className="text-xs font-semibold">Cargando catálogo y materias primas...</span>
              </div>
            ) : (
              <>
                {/* 1. SELECCIÓN DEL PRODUCTO PREPARADO */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Package className="w-4 h-4 text-[#ED500A]" />
                      <span>1. Producto Preparado</span>
                    </span>
                    {selectedProduct && (
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        Precio de venta: {formatCOP(selectedProduct.price)}
                      </span>
                    )}
                  </div>

                  {availableProducts.length === 0 ? (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs space-y-1.5">
                      <p className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        No tienes productos preparados registrados
                      </p>
                      <p>
                        Para crear una receta primero debes registrar el producto en el catálogo
                        (por ejemplo, Hamburguesa, Perro caliente, Pizza, etc.).
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <SearchSelect
                        label="Seleccionar Producto del Catálogo"
                        required
                        disabled={isEditing}
                        options={productOptions}
                        value={productId}
                        onChange={handleProductChange}
                        placeholder="Buscar producto preparado por nombre o SKU..."
                        searchPlaceholder="Escribe el nombre del producto..."
                        emptyText="No se encontraron productos preparados"
                      />

                      {/* Alerta si ya existe receta activa para este producto */}
                      {duplicateRecipeConflict && (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2 animate-in fade-in">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold">Este producto ya cuenta con una receta activa</p>
                            <p className="text-[11px] opacity-90 mt-0.5">
                              «{duplicateRecipeConflict.name}» ya está asociada a este producto. No se
                              permite crear recetas duplicadas para evitar inconsistencias en el POS.
                              Edita la receta existente desde el listado.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Campos básicos de la receta */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
                        <div className="sm:col-span-2">
                          <Input
                            label="Nombre de la Receta"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ej. Receta Hamburguesa Doble Carne"
                          />
                        </div>

                        <div>
                          <Input
                            label="Rendimiento (Porciones)"
                            type="number"
                            required
                            min={1}
                            step={1}
                            value={portions}
                            onChange={(e) => setPortions(e.target.value)}
                            placeholder="1"
                            helperText="Unidades que rinde"
                          />
                        </div>

                        <div>
                          <Input
                            label="Tiempo Estimado (min)"
                            type="number"
                            min={0}
                            value={prepTimeMinutes}
                            onChange={(e) => setPrepTimeMinutes(e.target.value)}
                            placeholder="15"
                            helperText="Preparación"
                            leftIcon={<Clock className="w-3.5 h-3.5 text-slate-400" />}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. TABLA DINÁMICA DE INGREDIENTES E INSUMOS */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <UtensilsCrossed className="w-4 h-4 text-[#ED500A]" />
                        <span>2. Ingredientes e Insumos Consumidos</span>
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Indica los materiales que se consumen para elaborar {numericPortions}{" "}
                        {numericPortions === 1 ? "unidad" : "unidades"}.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddLine}
                      disabled={availableIngredients.length === 0}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ED500A]/10 hover:bg-[#ED500A]/20 text-[#ED500A] text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar Ingrediente</span>
                    </button>
                  </div>

                  {availableIngredients.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] text-center text-xs text-slate-500 space-y-1">
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        No hay materias primas ni ingredientes registrados
                      </p>
                      <p>
                        Primero debes dar de alta tus insumos en la sección de Ingredientes e Insumos.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Tabla responsiva de líneas */}
                      <div className="overflow-x-auto -mx-2 sm:mx-0">
                        <table className="w-full text-left text-xs border-collapse min-w-[640px]">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 font-bold">
                              <th className="py-2 px-2.5 w-[36%]">Ingrediente / Insumo</th>
                              <th className="py-2 px-2.5 w-[15%]">Cantidad</th>
                              <th className="py-2 px-2.5 w-[23%]">Unidad</th>
                              <th className="py-2 px-2.5 w-[16%] text-right">Costo Subtotal</th>
                              <th className="py-2 px-2 text-center w-[10%]">Acción</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                            {calculatedLines.map((line, idx) => {
                              const ing = line.ingredient;
                              const recipeUnitOptions = getRecipeUnitOptions(ing?.unit);

                              // Opciones para el selector de ingrediente (deshabilita los ya usados en otras filas y excluye el producto padre)
                              const ingredientSelectOptions = availableIngredients
                                .filter((i) => i.id !== productId)
                                .map((i) => ({
                                  value: i.id,
                                  label: i.name,
                                  description: `${formatCOP(i.costPerUnit)} / ${i.unit} · Stock: ${
                                    i.stockQuantity
                                  } ${i.unit}`,
                                  disabled: usedIngredientIds.has(i.id) && i.id !== line.ingredientId,
                                }));

                              return (
                                <tr key={line.tempId} className="group hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                                  {/* Columna 1: Selector de Ingrediente */}
                                  <td className="py-2.5 px-2.5 align-top">
                                    <SearchSelect
                                      options={ingredientSelectOptions}
                                      value={line.ingredientId}
                                      onChange={(val) => handleUpdateLine(line.tempId, { ingredientId: val })}
                                      placeholder="Seleccionar materia prima..."
                                      searchPlaceholder="Buscar ingrediente..."
                                      selectSize="sm"
                                    />
                                    {ing && (
                                      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                                        <span>Compra: {formatCOP(ing.costPerUnit)} / {ing.unit}</span>
                                        <span>·</span>
                                        <span>Stock: {ing.stockQuantity} {ing.unit}</span>
                                      </div>
                                    )}
                                  </td>

                                  {/* Columna 2: Cantidad */}
                                  <td className="py-2.5 px-2.5 align-top">
                                    <Input
                                      type="number"
                                      step="any"
                                      min="0.0001"
                                      value={line.quantity}
                                      onChange={(e) =>
                                        handleUpdateLine(line.tempId, { quantity: e.target.value })
                                      }
                                      placeholder="0"
                                      className="font-mono text-xs"
                                    />
                                  </td>

                                  {/* Columna 3: Selector de Unidad Personalizado NEGOVA */}
                                  <td className="py-2.5 px-2.5 align-top min-w-[150px]">
                                    <SearchSelect
                                      options={recipeUnitOptions}
                                      value={line.unit}
                                      onChange={(val) =>
                                        handleUpdateLine(line.tempId, { unit: val })
                                      }
                                      placeholder="Unidad..."
                                      searchPlaceholder="Buscar unidad (g, lb, porc)..."
                                      selectSize="sm"
                                      clearable={false}
                                    />
                                    {line.conversionExplanation && (
                                      <span className="block mt-1 text-[10px] text-amber-600 dark:text-amber-400 font-mono leading-tight">
                                        {line.conversionExplanation}
                                      </span>
                                    )}
                                  </td>

                                  {/* Columna 4: Costo Subtotal */}
                                  <td className="py-2.5 px-2.5 align-top text-right">
                                    <div className="font-mono font-bold text-slate-900 dark:text-white pt-1.5">
                                      {formatCOP(line.subtotalCost)}
                                    </div>
                                    {line.unitCost > 0 && line.unit !== ing?.unit && (
                                      <div className="text-[10px] font-mono text-slate-400">
                                        {formatCOP(line.unitCost)}/{line.unit}
                                      </div>
                                    )}
                                  </td>

                                  {/* Columna 5: Eliminar */}
                                  <td className="py-2.5 px-2 align-top text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveLine(line.tempId)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
                                      title="Eliminar ingrediente"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Botón rápido para añadir más filas */}
                      <button
                        type="button"
                        onClick={handleAddLine}
                        className="w-full py-2 border border-dashed border-slate-300 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-500 hover:text-[#ED500A] hover:border-[#ED500A]/40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Agregar otra línea de ingrediente</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 3. RESUMEN FINANCIERO Y CAPACIDAD ESTIMADA EN TIEMPO REAL */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-orange-50/30 dark:from-white/[0.02] dark:to-[#ED500A]/5 border border-slate-200/80 dark:border-white/[0.08] space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-[#ED500A]" />
                      <span>3. Resumen de Costos y Capacidad Estimada</span>
                    </span>
                    <span className="text-2xs text-slate-400">Cálculo dinámico en vivo</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Costo Total */}
                    <div className="p-3 rounded-xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                        Costo Total Receta
                      </span>
                      <span className="text-lg font-bold font-mono text-slate-900 dark:text-white block mt-0.5">
                        {formatCOP(totalCost)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {numericPortions} {numericPortions === 1 ? "porción" : "porciones"}
                      </span>
                    </div>

                    {/* Costo por Porción */}
                    <div className="p-3 rounded-xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                        Costo por Unidad
                      </span>
                      <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 block mt-0.5">
                        {formatCOP(costPerPortion)}
                      </span>
                      <span className="text-[10px] text-slate-400">Costo de elaboración</span>
                    </div>

                    {/* Margen Bruto */}
                    <div className="p-3 rounded-xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                        Margen Bruto Est.
                      </span>
                      <span
                        className={`text-lg font-bold font-mono block mt-0.5 ${
                          marginPercentage >= 40
                            ? "text-emerald-600 dark:text-emerald-400"
                            : marginPercentage > 0
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {marginPercentage}%
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatCOP(productPrice - costPerPortion)} / un.
                      </span>
                    </div>

                    {/* Capacidad Estimada */}
                    <div className="p-3 rounded-xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                        Capacidad Estimada
                      </span>
                      <span
                        className={`text-lg font-bold font-mono block mt-0.5 ${
                          capacityEstimate.portionsAvailable > 0
                            ? "text-[#ED500A]"
                            : "text-slate-400 dark:text-slate-500"
                        }`}
                      >
                        {capacityEstimate.portionsAvailable} un.
                      </span>
                      <span className="text-[10px] text-slate-400 truncate block">
                        {capacityEstimate.limitingName
                          ? `Limitado por ${capacityEstimate.limitingName}`
                          : "Sin existencias"}
                      </span>
                    </div>
                  </div>

                  {/* Detalle del ingrediente limitante */}
                  {capacityEstimate.limitingName && (
                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs flex items-center gap-2">
                      <Info className="w-4 h-4 shrink-0" />
                      <span>
                        <strong>Cuello de botella:</strong> Con el stock actual de «
                        {capacityEstimate.limitingName}» ({capacityEstimate.limitingStock}{" "}
                        {capacityEstimate.limitingUnit}) puedes preparar hasta{" "}
                        <strong>{capacityEstimate.portionsAvailable} unidades</strong> completas.
                        Este dato es informativo y no reserva existencias físicas.
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* BOTONES DE ACCIÓN INFERIORES */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200/80 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.05] text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSubmitting || Boolean(duplicateRecipeConflict) || availableProducts.length === 0}
                className="px-5 py-2.5 rounded-xl bg-[#ED500A] hover:bg-[#ED500A]/90 text-white text-xs font-bold shadow-md shadow-[#ED500A]/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando receta...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isEditing ? "Guardar Cambios" : "Crear Receta"}</span>
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
