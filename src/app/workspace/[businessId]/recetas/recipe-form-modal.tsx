"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  X,
  ChefHat,
  Apple,
  Clock,
  MapPin,
  DollarSign,
  Layers,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Sparkles,
  TrendingUp,
  PackageCheck,
  Search,
  Loader2,
  Tag,
  UtensilsCrossed,
  Package,
  AlertTriangle,
  Check,
  Percent,
} from "lucide-react";
import { toast } from "sonner";
import { Location } from "@/lib/inventory/types";
import { Product, Category, PRODUCT_UNITS } from "@/lib/products/types";
import {
  RecipeWithDetails,
  RecipeIngredient,
  CreateRecipeInput,
  UpdateRecipeInput,
  Ingredient,
  INGREDIENT_UNITS,
  CreateIngredientInput,
} from "@/lib/recipes/types";
import {
  createRecipeAction,
  updateRecipeAction,
  getIngredientsAction,
  createIngredientAction,
} from "./actions";
import {
  getProductsAction,
  getCategoriesAction,
  createProductAction,
} from "../productos/actions";

interface Props {
  businessId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (recipe?: any) => void;
  locations: Location[];
  recipe?: RecipeWithDetails | null;
  recipeToEdit?: RecipeWithDetails | null;
  initialProductId?: string;
  availableUnits?: { value: string; label: string }[];
  categories?: Category[];
}

export interface LocalIngredientItem {
  ingredientId: string;
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
  subtotalCost: number;
  isOptional: boolean;
  stockQuantity: number;
  originType: "ingredient" | "product";
}

export function RecipeFormModal({
  businessId,
  isOpen,
  onClose,
  onSuccess,
  locations,
  recipe,
  recipeToEdit,
  initialProductId,
  availableUnits,
  categories: initialCategories,
}: Props) {
  const currentRecipe = recipeToEdit || recipe || null;
  const isEditing = Boolean(currentRecipe);

  const unitOptions =
    availableUnits && availableUnits.length > 0 ? availableUnits : INGREDIENT_UNITS;

  // Pasos del Wizard: 1 = Información, 2 = Ingredientes, 3 = Resumen
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Catálogos
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [availableIngredients, setAvailableIngredients] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<Category[]>(initialCategories || []);
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(false);

  // ==========================================
  // PASO 1: INFORMACIÓN
  // ==========================================
  const [productId, setProductId] = useState("");
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [portions, setPortions] = useState<number>(1);
  const [prepTimeMinutes, setPrepTimeMinutes] = useState<string>("15");
  const [locationId, setLocationId] = useState<string>("");

  // Submodal: Creación rápida de producto
  const [isQuickProductModalOpen, setIsQuickProductModalOpen] = useState(false);
  const [quickProductName, setQuickProductName] = useState("");
  const [quickProductCategory, setQuickProductCategory] = useState("");
  const [quickProductPrice, setQuickProductPrice] = useState("");
  const [quickProductCost, setQuickProductCost] = useState("");
  const [quickProductUnit, setQuickProductUnit] = useState("unidad");
  const [isSubmittingQuickProduct, setIsSubmittingQuickProduct] = useState(false);

  // ==========================================
  // PASO 2: INGREDIENTES
  // ==========================================
  const [originType, setOriginType] = useState<"ingredient" | "product">("ingredient");
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [ingredientQuantity, setIngredientQuantity] = useState<string>("1");
  const [ingredientUnit, setIngredientUnit] = useState<string>("unidad");
  const [ingredientIsOptional, setIngredientIsOptional] = useState<boolean>(false);
  const [ingredientsList, setIngredientsList] = useState<LocalIngredientItem[]>([]);

  // Submodal: Creación rápida de ingrediente
  const [isQuickIngredientModalOpen, setIsQuickIngredientModalOpen] = useState(false);
  const [quickIngName, setQuickIngName] = useState("");
  const [quickIngUnit, setQuickIngUnit] = useState("unidad");
  const [quickIngCost, setQuickIngCost] = useState("");
  const [quickIngStock, setQuickIngStock] = useState("");
  const [quickIngMinStock, setQuickIngMinStock] = useState("0");
  const [isSubmittingQuickIngredient, setIsSubmittingQuickIngredient] = useState(false);

  // Cargar catálogos al abrir modal
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadCatalogs() {
      setIsLoadingCatalogs(true);
      try {
        const [prodsRes, ingsRes, catsRes] = await Promise.all([
          getProductsAction(businessId),
          getIngredientsAction(businessId),
          getCategoriesAction(businessId),
        ]);

        if (isMounted) {
          if (prodsRes.success && prodsRes.data) {
            setAvailableProducts(
              prodsRes.data.filter((p) => (p as any).metadata?.product_type !== "ingredient")
            );
          }
          if (ingsRes.success && ingsRes.data) {
            setAvailableIngredients(ingsRes.data);
          }
          if (catsRes.success && catsRes.data) {
            setCategories(catsRes.data);
          }
        }
      } catch (err) {
        console.error("Error al cargar catálogos para receta:", err);
      } finally {
        if (isMounted) setIsLoadingCatalogs(false);
      }
    }

    loadCatalogs();
    return () => {
      isMounted = false;
    };
  }, [isOpen, businessId]);

  // Inicializar estado al editar o crear
  useEffect(() => {
    if (!isOpen) return;

    setStep(1);
    setProductSearchQuery("");
    setSelectedCategoryFilter("");
    setItemSearchQuery("");
    setSelectedItemId("");

    if (currentRecipe) {
      setProductId(currentRecipe.productId);
      setName(currentRecipe.name);
      setDescription(currentRecipe.description || "");
      setPortions(currentRecipe.portions || 1);
      setPrepTimeMinutes(
        currentRecipe.prepTimeMinutes !== null && currentRecipe.prepTimeMinutes !== undefined
          ? String(currentRecipe.prepTimeMinutes)
          : ""
      );
      setLocationId(currentRecipe.locationId || "");

      const mapped: LocalIngredientItem[] = (currentRecipe.ingredients || []).map((ing) => ({
        ingredientId: ing.ingredientId,
        name: ing.ingredientName,
        quantity: ing.quantity,
        unit: ing.unit,
        unitCost: ing.unitCost,
        subtotalCost: ing.subtotalCost,
        isOptional: ing.isOptional,
        stockQuantity: ing.stockQuantity,
        originType: "ingredient",
      }));
      setIngredientsList(mapped);
    } else {
      setProductId(initialProductId || "");
      setName("");
      setDescription("");
      setPortions(1);
      setPrepTimeMinutes("15");
      setLocationId("");
      setIngredientsList([]);
    }
  }, [isOpen, currentRecipe, initialProductId]);

  // Producto actualmente seleccionado
  const selectedProduct = useMemo(() => {
    return availableProducts.find((p) => p.id === productId);
  }, [availableProducts, productId]);

  // Al seleccionar producto en creación, sugerir el nombre de la receta
  const handleProductSelect = (prod: Product) => {
    setProductId(prod.id);
    if (!isEditing && (!name || name === "")) {
      setName(`Receta de ${prod.name}`);
    }
  };

  // Filtrado de productos para el paso 1
  const filteredProducts = useMemo(() => {
    return availableProducts.filter((p) => {
      const matchesSearch =
        !productSearchQuery.trim() ||
        p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
        (p.metadata?.sku &&
          p.metadata.sku.toLowerCase().includes(productSearchQuery.toLowerCase()));

      const matchesCategory =
        !selectedCategoryFilter || p.category_id === selectedCategoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [availableProducts, productSearchQuery, selectedCategoryFilter]);

  // Manejo de creación rápida de producto en paso 1
  const handleCreateQuickProduct = async () => {
    if (!quickProductName.trim()) {
      toast.error("El nombre del producto es obligatorio.");
      return;
    }
    const priceNum = parseFloat(quickProductPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error("El precio debe ser un número válido igual o mayor a 0.");
      return;
    }

    setIsSubmittingQuickProduct(true);
    try {
      const payload = {
        name: quickProductName.trim(),
        category_id: quickProductCategory || null,
        price: priceNum,
        description: null,
        is_available: true,
        status: "active" as const,
        metadata: {
          product_type: "product" as const,
          cost: quickProductCost ? parseFloat(quickProductCost) : null,
          unit: quickProductUnit || "unidad",
          available_in_pos: true,
          available_in_qr: true,
          available_online: true,
          track_stock: false,
        },
      };

      const res = await createProductAction(businessId, payload);
      if (!res.success || !res.data) {
        throw new Error(res.error || "No se pudo crear el producto.");
      }

      const created = res.data;
      setAvailableProducts((prev) => [created, ...prev]);
      setProductId(created.id);
      if (!name || name === "") {
        setName(`Receta de ${created.name}`);
      }

      toast.success(`Producto "${created.name}" creado y vinculado.`);
      setIsQuickProductModalOpen(false);
      setQuickProductName("");
      setQuickProductCategory("");
      setQuickProductPrice("");
      setQuickProductCost("");
      setQuickProductUnit("unidad");
    } catch (err: any) {
      toast.error(err.message || "Error al crear el producto.");
    } finally {
      setIsSubmittingQuickProduct(false);
    }
  };

  // Manejo de creación rápida de ingrediente en paso 2
  const handleCreateQuickIngredient = async () => {
    if (!quickIngName.trim()) {
      toast.error("El nombre del ingrediente es obligatorio.");
      return;
    }
    const costNum = parseFloat(quickIngCost);
    if (isNaN(costNum) || costNum < 0) {
      toast.error("El costo unitario no puede ser negativo.");
      return;
    }

    setIsSubmittingQuickIngredient(true);
    try {
      const input: CreateIngredientInput = {
        name: quickIngName.trim(),
        unit: quickIngUnit || "unidad",
        costPerUnit: costNum,
        initialStock: quickIngStock ? parseFloat(quickIngStock) : 0,
        minStock: quickIngMinStock ? parseFloat(quickIngMinStock) : 0,
        availableInPos: false,
        availableInQr: false,
        availableOnline: false,
      };

      const res = await createIngredientAction(businessId, input);
      if (!res.success || !res.data) {
        throw new Error(res.error || "Error al registrar el ingrediente.");
      }

      const created = res.data;
      setAvailableIngredients((prev) => [created, ...prev]);
      setOriginType("ingredient");
      setSelectedItemId(created.id);
      setIngredientUnit(created.unit || "unidad");

      toast.success(`Ingrediente "${created.name}" creado y seleccionado.`);
      setIsQuickIngredientModalOpen(false);
      setQuickIngName("");
      setQuickIngCost("");
      setQuickIngStock("");
      setQuickIngMinStock("0");
      setQuickIngUnit("unidad");
    } catch (err: any) {
      toast.error(err.message || "Error al crear el ingrediente.");
    } finally {
      setIsSubmittingQuickIngredient(false);
    }
  };

  // Ítems disponibles para seleccionar en el Paso 2 según el origen
  const selectableSourceItems = useMemo(() => {
    if (originType === "ingredient") {
      return availableIngredients
        .filter((ing) => {
          if (!itemSearchQuery.trim()) return true;
          return ing.name.toLowerCase().includes(itemSearchQuery.toLowerCase());
        })
        .map((ing) => ({
          id: ing.id,
          name: ing.name,
          unit: ing.unit,
          cost: ing.costPerUnit,
          stock: ing.stockQuantity,
          type: "ingredient" as const,
        }));
    } else {
      // Sub-receta / Producto terminado (excluye el propio producto de la receta para evitar ciclos)
      return availableProducts
        .filter((prod) => prod.id !== productId)
        .filter((prod) => {
          if (!itemSearchQuery.trim()) return true;
          return prod.name.toLowerCase().includes(itemSearchQuery.toLowerCase());
        })
        .map((prod) => {
          const cost = Number(
            (prod as any).metadata?.cost ?? (prod as any).cost ?? prod.price ?? 0
          );
          const unit = (prod as any).metadata?.unit || "unidad";
          const stock = Number((prod as any).metadata?.stock_quantity ?? 0);
          return {
            id: prod.id,
            name: prod.name,
            unit,
            cost,
            stock,
            type: "product" as const,
          };
        });
    }
  }, [originType, availableIngredients, availableProducts, itemSearchQuery, productId]);

  const currentSelectedItem = useMemo(() => {
    return selectableSourceItems.find((it) => it.id === selectedItemId);
  }, [selectableSourceItems, selectedItemId]);

  // Al seleccionar un ítem de la lista de orígenes
  const handleSelectItem = (item: {
    id: string;
    name: string;
    unit: string;
    cost: number;
    stock: number;
    type: "ingredient" | "product";
  }) => {
    setSelectedItemId(item.id);
    setIngredientUnit(item.unit || "unidad");
  };

  // Agregar ingrediente o sub-receta a la lista de la receta
  const handleAddIngredient = () => {
    if (!currentSelectedItem) {
      toast.error("Por favor selecciona un ingrediente o sub-receta.");
      return;
    }

    const qty = parseFloat(ingredientQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error("La cantidad requerida debe ser un número positivo mayor a 0.");
      return;
    }

    const unitCost = currentSelectedItem.cost || 0;
    const subtotal = Number((qty * unitCost).toFixed(4));

    // Verificar si ya existe en la lista
    const existingIndex = ingredientsList.findIndex(
      (it) => it.ingredientId === currentSelectedItem.id
    );

    if (existingIndex >= 0) {
      const updated = [...ingredientsList];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: qty,
        unit: ingredientUnit,
        isOptional: ingredientIsOptional,
        unitCost,
        subtotalCost: subtotal,
        originType: currentSelectedItem.type,
      };
      setIngredientsList(updated);
      toast.success(`Componente "${currentSelectedItem.name}" actualizado.`);
    } else {
      setIngredientsList((prev) => [
        ...prev,
        {
          ingredientId: currentSelectedItem.id,
          name: currentSelectedItem.name,
          quantity: qty,
          unit: ingredientUnit,
          unitCost,
          subtotalCost: subtotal,
          isOptional: ingredientIsOptional,
          stockQuantity: currentSelectedItem.stock,
          originType: currentSelectedItem.type,
        },
      ]);
      toast.success(`"${currentSelectedItem.name}" agregado a la receta.`);
    }

    // Resetear selección
    setSelectedItemId("");
    setIngredientQuantity("1");
    setIngredientIsOptional(false);
  };

  const handleRemoveIngredient = (indexToRemove: number) => {
    setIngredientsList((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // ==========================================
  // CÁLCULOS EN VIVO DEL RESUMEN (PASO 3)
  // ==========================================
  const productPrice = selectedProduct ? Number(selectedProduct.price || 0) : 0;

  const calculations = useMemo<{
    totalCost: number;
    costPerPortion: number;
    marginPercentage: number;
    portionsAvailable: number;
    limitingItem: LocalIngredientItem | null;
    hasMandatory: boolean;
  }>(() => {
    const p = Math.max(1, portions);
    let totalCost = 0;
    let minBatches = Infinity;
    let limitingItem: LocalIngredientItem | null = null;
    let hasMandatory = false;

    ingredientsList.forEach((item) => {
      // Regla: ingredientes opcionales NO afectan costo base ni frenan disponibilidad
      if (!item.isOptional) {
        hasMandatory = true;
        totalCost += item.subtotalCost;

        const batches =
          item.quantity > 0
            ? Math.floor(Math.max(0, item.stockQuantity) / item.quantity)
            : 0;

        if (batches < minBatches) {
          minBatches = batches;
          limitingItem = item;
        }
      }
    });

    const costPerPortion = Number((totalCost / p).toFixed(4));
    const margin =
      productPrice > 0
        ? Number((((productPrice - costPerPortion) / productPrice) * 100).toFixed(2))
        : 0;

    const portionsAvailable = hasMandatory
      ? Math.max(0, (minBatches === Infinity ? 0 : minBatches) * p)
      : 0;

    return {
      totalCost,
      costPerPortion,
      marginPercentage: margin,
      portionsAvailable,
      limitingItem,
      hasMandatory,
    };
  }, [portions, ingredientsList, productPrice]);

  // Validaciones para pasar de paso
  const handleNextStep = () => {
    if (step === 1) {
      if (!productId) {
        toast.error("Debes seleccionar un producto del catálogo para vincular la receta.");
        return;
      }
      if (!name.trim()) {
        toast.error("El nombre de la receta es obligatorio.");
        return;
      }
      if (portions < 1) {
        toast.error("El rendimiento debe ser de al menos 1 porción.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (ingredientsList.length === 0) {
        toast.error("La receta debe incluir al menos un ingrediente o insumo.");
        return;
      }
      setStep(3);
    }
  };

  const handlePrevStep = () => {
    if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
  };

  // Guardar receta final
  const handleSubmit = async () => {
    if (ingredientsList.length === 0) {
      toast.error("Debes agregar al menos un ingrediente a la receta.");
      return;
    }

    setIsSubmitting(true);
    try {
      const itemsPayload = ingredientsList.map((item, idx) => ({
        ingredientId: item.ingredientId,
        quantity: item.quantity,
        unit: item.unit,
        isOptional: item.isOptional,
        sortOrder: idx,
      }));

      if (isEditing && currentRecipe) {
        const payload: UpdateRecipeInput = {
          name: name.trim(),
          description: description.trim() || null,
          portions: portions,
          prepTimeMinutes: prepTimeMinutes ? parseInt(prepTimeMinutes, 10) : null,
          locationId: locationId || null,
          ingredients: itemsPayload,
        };

        const res = await updateRecipeAction(businessId, currentRecipe.id, payload);
        if (!res.success || !res.data) {
          throw new Error(res.error || "Error al actualizar la receta.");
        }

        toast.success("Receta actualizada exitosamente.");
        onSuccess(res.data);
        onClose();
      } else {
        const payload: CreateRecipeInput = {
          productId,
          name: name.trim(),
          description: description.trim() || null,
          portions: portions,
          prepTimeMinutes: prepTimeMinutes ? parseInt(prepTimeMinutes, 10) : null,
          locationId: locationId || null,
          ingredients: itemsPayload,
        };

        const res = await createRecipeAction(businessId, payload);
        if (!res.success || !res.data) {
          throw new Error(res.error || "Error al registrar la receta.");
        }

        toast.success("Receta creada exitosamente.");
        onSuccess(res.data);
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || "Ocurrió un error al guardar la receta.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-4xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <ChefHat className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {isEditing ? "Editar Receta y Ficha Técnica" : "Asistente de Recetas y Escandallos"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isEditing
                    ? "Modifica ingredientes, proporciones y rendimiento de la preparación."
                    : "[1 Información] → [2 Ingredientes] → [3 Resumen]"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stepper Wizard Indicator */}
          <div className="px-6 py-3 bg-muted/15 border-b border-border flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`flex items-center gap-2 transition-all ${
                step === 1
                  ? "text-primary font-bold"
                  : step > 1
                  ? "text-foreground font-medium hover:text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                  step === 1
                    ? "bg-primary text-primary-foreground shadow"
                    : step > 1
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold"
                    : "bg-muted"
                }`}
              >
                {step > 1 ? <Check className="w-3.5 h-3.5" /> : "1"}
              </span>
              <span>1 Información</span>
            </button>

            <div className={`flex-1 h-0.5 mx-4 ${step > 1 ? "bg-primary/50" : "bg-border"}`} />

            <button
              type="button"
              onClick={() => {
                if (productId && name.trim()) setStep(2);
              }}
              className={`flex items-center gap-2 transition-all ${
                step === 2
                  ? "text-primary font-bold"
                  : step > 2
                  ? "text-foreground font-medium hover:text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                  step === 2
                    ? "bg-primary text-primary-foreground shadow"
                    : step > 2
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold"
                    : "bg-muted"
                }`}
              >
                {step > 2 ? <Check className="w-3.5 h-3.5" /> : "2"}
              </span>
              <span>2 Ingredientes ({ingredientsList.length})</span>
            </button>

            <div className={`flex-1 h-0.5 mx-4 ${step > 2 ? "bg-primary/50" : "bg-border"}`} />

            <button
              type="button"
              onClick={() => {
                if (productId && name.trim() && ingredientsList.length > 0) setStep(3);
              }}
              className={`flex items-center gap-2 transition-all ${
                step === 3 ? "text-primary font-bold" : "text-muted-foreground"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                  step === 3
                    ? "bg-primary text-primary-foreground shadow"
                    : "bg-muted"
                }`}
              >
                3
              </span>
              <span>3 Resumen</span>
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {isLoadingCatalogs ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-sm font-medium">Cargando catálogo gastronómico...</span>
              </div>
            ) : (
              <>
                {/* ======================================================== */}
                {/* PASO 1: INFORMACIÓN                                      */}
                {/* ======================================================== */}
                {step === 1 && (
                  <div className="space-y-6">
                    {/* Sección Producto Asociado (*) */}
                    <div className="p-4 rounded-xl border border-border bg-muted/10 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <UtensilsCrossed className="w-4 h-4 text-primary" />
                            Producto Asociado en Menú / Carta *
                          </label>
                          <p className="text-[11px] text-muted-foreground">
                            Selecciona el plato, bebida o artículo terminado al que pertenece esta receta.
                          </p>
                        </div>

                        {!isEditing && (
                          <button
                            type="button"
                            onClick={() => setIsQuickProductModalOpen(true)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            + Crear producto nuevo
                          </button>
                        )}
                      </div>

                      {/* Si está editando, mostrar producto fijo */}
                      {isEditing ? (
                        <div className="p-3 rounded-lg border border-border bg-card flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-foreground">
                              {selectedProduct?.name || currentRecipe?.productName || "Producto vinculado"}
                            </span>
                            <span className="block text-[11px] text-muted-foreground">
                              El producto no puede cambiarse en modo de edición.
                            </span>
                          </div>
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            ${(selectedProduct?.price || currentRecipe?.productPrice || 0).toLocaleString()}
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Buscador por nombre y Selector por categorías */}
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                            <div className="sm:col-span-7 relative">
                              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                              <input
                                type="text"
                                value={productSearchQuery}
                                onChange={(e) => setProductSearchQuery(e.target.value)}
                                placeholder="Buscar producto por nombre..."
                                className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </div>

                            <div className="sm:col-span-5">
                              <select
                                value={selectedCategoryFilter}
                                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                              >
                                <option value="">Todas las categorías</option>
                                {categories.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Producto actualmente seleccionado destacado */}
                          {selectedProduct && (
                            <div className="p-2.5 rounded-lg border border-primary/30 bg-primary/5 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                                <div>
                                  <span className="font-bold text-foreground">
                                    {selectedProduct.name}
                                  </span>
                                  {selectedProduct.categories?.name && (
                                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                                      {selectedProduct.categories.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                ${Number(selectedProduct.price || 0).toLocaleString()}
                              </span>
                            </div>
                          )}

                          {/* Lista de selección rápida de productos */}
                          <div>
                            <span className="text-[11px] font-semibold text-muted-foreground block mb-1.5">
                              Lista de selección rápida ({filteredProducts.length} productos disponibles):
                            </span>
                            <div className="max-h-40 overflow-y-auto border border-border rounded-lg divide-y divide-border bg-background">
                              {filteredProducts.length === 0 ? (
                                <div className="p-4 text-center text-xs text-muted-foreground">
                                  No se encontraron productos con los filtros actuales.
                                </div>
                              ) : (
                                filteredProducts.map((p) => {
                                  const isSelected = p.id === productId;
                                  return (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => handleProductSelect(p)}
                                      className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs transition-colors ${
                                        isSelected
                                          ? "bg-primary/10 font-semibold text-primary"
                                          : "hover:bg-muted/40 text-foreground"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 truncate">
                                        <div
                                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                                            isSelected
                                              ? "border-primary bg-primary text-primary-foreground"
                                              : "border-muted-foreground/40"
                                          }`}
                                        >
                                          {isSelected && <Check className="w-2.5 h-2.5" />}
                                        </div>
                                        <span className="truncate">{p.name}</span>
                                        {p.categories?.name && (
                                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-normal">
                                            {p.categories.name}
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-muted-foreground shrink-0 font-medium ml-2">
                                        ${Number(p.price || 0).toLocaleString()}
                                      </span>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Nombre de la Receta */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Nombre de la Receta / Ficha Técnica *
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ej: Hamburguesa Artesanal Clásica 200g"
                        className="w-full h-10 px-3 rounded-lg border border-border bg-background text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    {/* Porciones y Tiempo de preparación */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-primary" />
                          Rendimiento en Porciones (Raciones) *
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={portions}
                          onChange={(e) =>
                            setPortions(Math.max(1, parseInt(e.target.value, 10) || 1))
                          }
                          className="w-full h-10 px-3 rounded-lg border border-border bg-background text-xs sm:text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Número de platos o raciones individuales que rinde esta receta (ej. 1).
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-primary" />
                          Tiempo de Preparación en Minutos
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={prepTimeMinutes}
                          onChange={(e) => setPrepTimeMinutes(e.target.value)}
                          placeholder="Ej: 15"
                          className="w-full h-10 px-3 rounded-lg border border-border bg-background text-xs sm:text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Tiempo estimado en cocina para alistar o despachar el plato.
                        </p>
                      </div>
                    </div>

                    {/* Centro de Producción / Ubicación */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-primary" />
                        Centro de Producción o Cocina (Opcional)
                      </label>
                      <select
                        value={locationId}
                        onChange={(e) => setLocationId(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-border bg-background text-xs sm:text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">Todas las ubicaciones (Stock Global)</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name} ({loc.type})
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Si seleccionas una cocina o bodega específica, la disponibilidad de stock se calculará sobre esa sede.
                      </p>
                    </div>

                    {/* Descripción / Notas de elaboración */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Descripción / Notas de Elaboración e Instrucciones
                      </label>
                      <textarea
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Ej: Cocinar la carne a la plancha a 200°C por 3 minutos por lado, tostar pan brioche..."
                        className="w-full p-3 rounded-lg border border-border bg-background text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* ======================================================== */}
                {/* PASO 2: INGREDIENTES                                     */}
                {/* ======================================================== */}
                {step === 2 && (
                  <div className="space-y-6">
                    {/* Selector de Origen: Pestaña 'Ingrediente' vs Pestaña 'Producto' */}
                    <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setOriginType("ingredient");
                              setSelectedItemId("");
                            }}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              originType === "ingredient"
                                ? "bg-primary text-primary-foreground shadow"
                                : "bg-card border border-border text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <Apple className="w-3.5 h-3.5" />
                            Ingrediente (Materias primas)
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setOriginType("product");
                              setSelectedItemId("");
                            }}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              originType === "product"
                                ? "bg-primary text-primary-foreground shadow"
                                : "bg-card border border-border text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <Package className="w-3.5 h-3.5" />
                            Producto (Sub-recetas / Artículos)
                          </button>
                        </div>

                        {originType === "ingredient" && (
                          <button
                            type="button"
                            onClick={() => setIsQuickIngredientModalOpen(true)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600/20 text-xs font-semibold transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            + Crear ingrediente
                          </button>
                        )}
                      </div>

                      {/* Buscador de ítems con indicación de unidad de medida y costo unitario */}
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <input
                            type="text"
                            value={itemSearchQuery}
                            onChange={(e) => setItemSearchQuery(e.target.value)}
                            placeholder={
                              originType === "ingredient"
                                ? "Buscar ingrediente o materia prima por nombre..."
                                : "Buscar producto o sub-receta elaborada previamente..."
                            }
                            className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>

                        {/* Lista desplegable / selección de ítems disponibles */}
                        <div className="max-h-36 overflow-y-auto border border-border rounded-lg divide-y divide-border bg-background text-xs">
                          {selectableSourceItems.length === 0 ? (
                            <div className="p-3 text-center text-muted-foreground">
                              No hay {originType === "ingredient" ? "ingredientes" : "productos"} que coincidan.
                            </div>
                          ) : (
                            selectableSourceItems.map((item) => {
                              const isSelected = item.id === selectedItemId;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => handleSelectItem(item)}
                                  className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors ${
                                    isSelected
                                      ? "bg-primary/10 text-primary font-semibold"
                                      : "hover:bg-muted/30 text-foreground"
                                  }`}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                        item.type === "ingredient"
                                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                      }`}
                                    >
                                      {item.type === "ingredient" ? "Materia Prima" : "Sub-receta"}
                                    </span>
                                    <span className="truncate">{item.name}</span>
                                  </div>

                                  <div className="flex items-center gap-3 shrink-0 text-muted-foreground">
                                    <span>
                                      Unidad: <strong className="text-foreground">{item.unit}</strong>
                                    </span>
                                    <span>
                                      Costo:{" "}
                                      <strong className="text-emerald-600 dark:text-emerald-400">
                                        ${item.cost.toLocaleString()}
                                      </strong>{" "}
                                      / {item.unit}
                                    </span>
                                    <span className="text-[10px]">
                                      ({item.stock} disp.)
                                    </span>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Configuración de adición del ítem seleccionado */}
                      {currentSelectedItem && (
                        <div className="pt-2 border-t border-primary/20 space-y-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-foreground">
                              Configurar: <u>{currentSelectedItem.name}</u>
                            </span>
                            <span className="text-muted-foreground">
                              Costo unitario base: ${currentSelectedItem.cost.toLocaleString()} / {currentSelectedItem.unit}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                            <div className="sm:col-span-4">
                              <label className="block text-[11px] font-semibold text-foreground mb-1">
                                Cantidad Requerida *
                              </label>
                              <input
                                type="number"
                                min="0.0001"
                                step="any"
                                value={ingredientQuantity}
                                onChange={(e) => setIngredientQuantity(e.target.value)}
                                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </div>

                            <div className="sm:col-span-3">
                              <label className="block text-[11px] font-semibold text-foreground mb-1">
                                Unidad de Medida
                              </label>
                              <select
                                value={ingredientUnit}
                                onChange={(e) => setIngredientUnit(e.target.value)}
                                className="w-full h-9 px-2.5 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                              >
                                {unitOptions.map((u) => (
                                  <option key={u.value} value={u.value}>
                                    {u.label || u.value}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="sm:col-span-5 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={handleAddIngredient}
                                className="w-full h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 shadow"
                              >
                                <Plus className="w-4 h-4" />
                                Agregar a la receta
                              </button>
                            </div>
                          </div>

                          {/* Checkbox opcional */}
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="checkbox"
                              id="is_optional_check"
                              checked={ingredientIsOptional}
                              onChange={(e) => setIngredientIsOptional(e.target.checked)}
                              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                            />
                            <label
                              htmlFor="is_optional_check"
                              className="text-xs text-muted-foreground cursor-pointer select-none"
                            >
                              Marcar como <strong className="text-foreground">Opcional</strong> (aderezos, guarniciones alternativas o salsas que no forman parte del costo base)
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Lista de ingredientes agregados con cálculo acumulado en vivo */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">
                          Ingredientes en la Receta ({ingredientsList.length})
                        </span>
                        <div className="text-xs font-bold text-foreground flex items-center gap-3">
                          <span className="text-muted-foreground">
                            Costo acumulado en vivo:
                          </span>
                          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            ${calculations.totalCost.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {ingredientsList.length === 0 ? (
                        <div className="py-10 text-center border border-dashed border-border rounded-xl text-muted-foreground text-xs space-y-1">
                          <p className="font-semibold text-foreground">Aún no has agregado ingredientes o insumos</p>
                          <p>Utiliza el panel superior para buscar y agregar materias primas o sub-recetas.</p>
                        </div>
                      ) : (
                        <div className="border border-border rounded-xl overflow-hidden divide-y divide-border text-xs">
                          <div className="bg-muted/40 px-3 py-2 grid grid-cols-12 font-semibold text-muted-foreground">
                            <div className="col-span-5">Componente / Insumo</div>
                            <div className="col-span-2 text-right">Cantidad</div>
                            <div className="col-span-2 text-right">Costo Unit.</div>
                            <div className="col-span-2 text-right">Costo Parcial</div>
                            <div className="col-span-1 text-center">Acción</div>
                          </div>

                          {ingredientsList.map((item, idx) => (
                            <div
                              key={item.ingredientId + idx}
                              className="px-3 py-2.5 grid grid-cols-12 items-center hover:bg-muted/20 transition-colors"
                            >
                              <div className="col-span-5 flex items-center gap-1.5 truncate">
                                <span className="font-medium text-foreground truncate">
                                  {item.name}
                                </span>
                                <span
                                  className={`px-1 py-0.2 rounded text-[9px] font-semibold ${
                                    item.originType === "product"
                                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {item.originType === "product" ? "Sub-receta" : "Insumo"}
                                </span>
                                {item.isOptional && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                    Opcional
                                  </span>
                                )}
                              </div>

                              <div className="col-span-2 text-right text-muted-foreground">
                                {item.quantity} {item.unit}
                              </div>

                              <div className="col-span-2 text-right text-muted-foreground">
                                ${item.unitCost.toLocaleString()}
                              </div>

                              <div className="col-span-2 text-right font-bold text-foreground">
                                {item.isOptional ? (
                                  <span className="text-muted-foreground line-through font-normal">
                                    ${item.subtotalCost.toLocaleString()}
                                  </span>
                                ) : (
                                  `$${item.subtotalCost.toLocaleString()}`
                                )}
                              </div>

                              <div className="col-span-1 flex items-center justify-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveIngredient(idx)}
                                  className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                  title="Eliminar de la receta"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ======================================================== */}
                {/* PASO 3: RESUMEN                                          */}
                {/* ======================================================== */}
                {step === 3 && (
                  <div className="space-y-6">
                    {/* Encabezado con datos generales y badges de métricas */}
                    <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-bold">
                            Ficha Técnica & Resumen
                          </div>
                          <h3 className="text-base font-bold text-foreground">
                            {name}
                          </h3>
                          <span className="text-xs text-muted-foreground">
                            Producto vinculado:{" "}
                            <strong className="text-foreground">
                              {selectedProduct?.name || currentRecipe?.productName || "No definido"}
                            </strong>
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[11px] text-muted-foreground block">
                            Precio de Venta
                          </span>
                          <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                            ${productPrice.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Badges de métricas generales */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card border border-border text-xs font-medium text-foreground">
                          <Layers className="w-3.5 h-3.5 text-primary" />
                          Rendimiento: <strong>{portions} {portions === 1 ? "porción" : "porciones"}</strong>
                        </span>

                        {prepTimeMinutes && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card border border-border text-xs font-medium text-foreground">
                            <Clock className="w-3.5 h-3.5 text-primary" />
                            Tiempo: <strong>{prepTimeMinutes} min</strong>
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card border border-border text-xs font-medium text-foreground">
                          <MapPin className="w-3.5 h-3.5 text-primary" />
                          {locationId
                            ? locations.find((l) => l.id === locationId)?.name || "Ubicación asignada"
                            : "Todas las sedes (Stock Global)"}
                        </span>

                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card border border-border text-xs font-medium text-foreground">
                          <Tag className="w-3.5 h-3.5 text-primary" />
                          {ingredientsList.length} componentes ({ingredientsList.filter((i) => !i.isOptional).length} base)
                        </span>
                      </div>

                      {description && (
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap bg-background p-2.5 rounded-lg border border-border">
                          {description}
                        </p>
                      )}
                    </div>

                    {/* Costeo total, porciones y costo por porción */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3.5 rounded-xl border border-border bg-card space-y-1">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          Costo Total Base
                        </span>
                        <div className="text-lg font-bold text-foreground">
                          ${calculations.totalCost.toLocaleString()}
                        </div>
                        <span className="text-[10px] text-muted-foreground block">
                          Suma de insumos base
                        </span>
                      </div>

                      <div className="p-3.5 rounded-xl border border-border bg-card space-y-1">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          Rendimiento
                        </span>
                        <div className="text-lg font-bold text-foreground">
                          {portions}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            {portions === 1 ? "porción" : "porciones"}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground block">
                          Preparación por tanda
                        </span>
                      </div>

                      <div className="p-3.5 rounded-xl border border-border bg-card space-y-1">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          Costo por Porción
                        </span>
                        <div className="text-lg font-bold text-primary">
                          ${calculations.costPerPortion.toLocaleString()}
                        </div>
                        <span className="text-[10px] text-muted-foreground block">
                          Costo unitario del plato
                        </span>
                      </div>

                      <div className="p-3.5 rounded-xl border border-border bg-card space-y-1">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          Margen Bruto
                        </span>
                        <div
                          className={`text-lg font-bold ${
                            calculations.marginPercentage >= 50
                              ? "text-emerald-600 dark:text-emerald-400"
                              : calculations.marginPercentage >= 30
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-red-500"
                          }`}
                        >
                          {calculations.marginPercentage}%
                        </div>
                        <span className="text-[10px] text-muted-foreground block">
                          Ganancia: ${(productPrice - calculations.costPerPortion).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Indicador de proyección ('¿Cuánto me alcanza?') */}
                    <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <PackageCheck className="w-4 h-4" />
                          Indicador de Proyección: ¿Cuánto me alcanza?
                        </span>
                        <span className="text-xs font-bold text-foreground">
                          {calculations.portionsAvailable}{" "}
                          {calculations.portionsAvailable === 1 ? "porción producible" : "porciones producibles"}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Cálculo en vivo basado en las existencias físicas actuales de los insumos en inventario.
                      </p>

                      {/* Alerta de limitante / cuello de botella */}
                      {calculations.limitingItem && (
                        <div
                          className={`p-3 rounded-lg border flex items-start gap-2.5 ${
                            calculations.portionsAvailable > 0
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300"
                              : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
                          }`}
                        >
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div className="text-xs space-y-0.5">
                            <span className="font-bold block">
                              Cuello de botella de inventario: {calculations.limitingItem.name}
                            </span>
                            <span>
                              Tienes <strong>{calculations.limitingItem.stockQuantity} {calculations.limitingItem.unit}</strong> en existencias y cada preparación requiere{" "}
                              <strong>{calculations.limitingItem.quantity} {calculations.limitingItem.unit}</strong>.
                              {calculations.portionsAvailable > 0
                                ? ` Por tanto, el stock actual limita la producción a ${calculations.portionsAvailable} porciones.`
                                : " El stock actual es insuficiente para preparar una tanda completa."}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Tabla desglosada de ingredientes con cantidades y costos */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-foreground">
                        Tabla Desglosada de Ingredientes y Escandallo
                      </span>
                      <div className="border border-border rounded-xl divide-y divide-border text-xs max-h-48 overflow-y-auto">
                        <div className="bg-muted/40 px-3 py-2 grid grid-cols-12 font-semibold text-muted-foreground">
                          <div className="col-span-5">Componente</div>
                          <div className="col-span-2 text-right">Cantidad</div>
                          <div className="col-span-2 text-right">Costo Unit.</div>
                          <div className="col-span-3 text-right">Subtotal</div>
                        </div>

                        {ingredientsList.map((item, idx) => (
                          <div
                            key={idx}
                            className="px-3 py-2 grid grid-cols-12 items-center hover:bg-muted/20"
                          >
                            <div className="col-span-5 flex items-center gap-1.5 truncate">
                              <span className="font-medium text-foreground truncate">
                                {item.name}
                              </span>
                              {item.originType === "product" && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold">
                                  Sub-receta
                                </span>
                              )}
                              {item.isOptional && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold">
                                  Opcional
                                </span>
                              )}
                            </div>

                            <div className="col-span-2 text-right text-muted-foreground">
                              {item.quantity} {item.unit}
                            </div>

                            <div className="col-span-2 text-right text-muted-foreground">
                              ${item.unitCost.toLocaleString()}
                            </div>

                            <div className="col-span-3 text-right font-bold text-foreground">
                              {item.isOptional ? (
                                <span className="text-muted-foreground line-through font-normal">
                                  ${item.subtotalCost.toLocaleString()}
                                </span>
                              ) : (
                                `$${item.subtotalCost.toLocaleString()}`
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
            {step > 1 ? (
              <button
                type="button"
                onClick={handlePrevStep}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                Atrás
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNextStep}
                disabled={isSubmitting || isLoadingCatalogs}
                className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow"
              >
                Siguiente
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando receta...
                  </>
                ) : isEditing ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    ✓ Guardar Cambios
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    ✓ Crear Receta
                  </>
                )}
              </button>
            )}
          </div>

          {/* ======================================================== */}
          {/* SUBMODAL: CREACIÓN RÁPIDA DE PRODUCTO (PASO 1)          */}
          {/* ======================================================== */}
          {isQuickProductModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4 text-primary" />
                    <h4 className="text-sm font-bold text-foreground">Crear Producto Rápido</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsQuickProductModalOpen(false)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-foreground mb-1">
                      Nombre del Producto *
                    </label>
                    <input
                      type="text"
                      value={quickProductName}
                      onChange={(e) => setQuickProductName(e.target.value)}
                      placeholder="Ej: Pizza Napolitana 30cm"
                      className="w-full h-8 px-2.5 rounded border border-border bg-background text-foreground"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-foreground mb-1">
                      Categoría
                    </label>
                    <select
                      value={quickProductCategory}
                      onChange={(e) => setQuickProductCategory(e.target.value)}
                      className="w-full h-8 px-2 rounded border border-border bg-background text-foreground"
                    >
                      <option value="">-- Sin categoría --</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-foreground mb-1">
                        Precio de Venta ($) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={quickProductPrice}
                        onChange={(e) => setQuickProductPrice(e.target.value)}
                        placeholder="25000"
                        className="w-full h-8 px-2.5 rounded border border-border bg-background text-foreground"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-foreground mb-1">
                        Costo Estimado ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={quickProductCost}
                        onChange={(e) => setQuickProductCost(e.target.value)}
                        placeholder="8000"
                        className="w-full h-8 px-2.5 rounded border border-border bg-background text-foreground"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-foreground mb-1">
                      Unidad de Medida
                    </label>
                    <select
                      value={quickProductUnit}
                      onChange={(e) => setQuickProductUnit(e.target.value)}
                      className="w-full h-8 px-2 rounded border border-border bg-background text-foreground"
                    >
                      {PRODUCT_UNITS.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsQuickProductModalOpen(false)}
                    disabled={isSubmittingQuickProduct}
                    className="px-3 py-1.5 rounded border border-border text-xs font-medium text-muted-foreground hover:bg-muted"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateQuickProduct}
                    disabled={isSubmittingQuickProduct}
                    className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 flex items-center gap-1.5"
                  >
                    {isSubmittingQuickProduct && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Guardar y Seleccionar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SUBMODAL: CREACIÓN RÁPIDA DE INGREDIENTE (PASO 2)        */}
          {/* ======================================================== */}
          {isQuickIngredientModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <Apple className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <h4 className="text-sm font-bold text-foreground">Crear Ingrediente al Vuelo</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsQuickIngredientModalOpen(false)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-foreground mb-1">
                      Nombre del Ingrediente / Insumo *
                    </label>
                    <input
                      type="text"
                      value={quickIngName}
                      onChange={(e) => setQuickIngName(e.target.value)}
                      placeholder="Ej: Harina de Trigo Especial"
                      className="w-full h-8 px-2.5 rounded border border-border bg-background text-foreground"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-foreground mb-1">
                        Unidad de Medida *
                      </label>
                      <select
                        value={quickIngUnit}
                        onChange={(e) => setQuickIngUnit(e.target.value)}
                        className="w-full h-8 px-2 rounded border border-border bg-background text-foreground"
                      >
                        {INGREDIENT_UNITS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-foreground mb-1">
                        Costo Unitario ($) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={quickIngCost}
                        onChange={(e) => setQuickIngCost(e.target.value)}
                        placeholder="3500"
                        className="w-full h-8 px-2.5 rounded border border-border bg-background text-foreground"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-foreground mb-1">
                        Stock Inicial Disponible
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={quickIngStock}
                        onChange={(e) => setQuickIngStock(e.target.value)}
                        placeholder="10"
                        className="w-full h-8 px-2.5 rounded border border-border bg-background text-foreground"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-foreground mb-1">
                        Stock Mínimo
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={quickIngMinStock}
                        onChange={(e) => setQuickIngMinStock(e.target.value)}
                        placeholder="2"
                        className="w-full h-8 px-2.5 rounded border border-border bg-background text-foreground"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsQuickIngredientModalOpen(false)}
                    disabled={isSubmittingQuickIngredient}
                    className="px-3 py-1.5 rounded border border-border text-xs font-medium text-muted-foreground hover:bg-muted"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateQuickIngredient}
                    disabled={isSubmittingQuickIngredient}
                    className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5"
                  >
                    {isSubmittingQuickIngredient && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Guardar y Seleccionar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
