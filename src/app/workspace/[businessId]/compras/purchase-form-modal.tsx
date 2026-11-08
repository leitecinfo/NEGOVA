"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Input, Select, SearchSelect } from "@/components/ui";
import {
  X,
  ShoppingCart,
  Building2,
  Calendar,
  FileText,
  Plus,
  Trash2,
  Package,
  Boxes,
  Layers,
  MapPin,
  CreditCard,
  Banknote,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  FolderKanban,
  Calculator,
  Check,
  Tag,
  Store,
  FileCheck,
  Percent,
  HelpCircle,
  AlertTriangle,
  ShieldCheck,
  Apple,
  Wrench,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { Product, Category } from "@/lib/products/types";
import { Location } from "@/lib/inventory/types";
import { Supplier, PurchaseItemInput, Purchase, PurchaseDocumentType } from "@/lib/purchases/types";
import { Ingredient } from "@/lib/recipes/types";
import { convertQuantity } from "@/lib/recipes/unit-conversion";
import { createPurchaseAction, getSuppliersAction } from "./actions";
import { getCategoriesAction } from "@/app/workspace/[businessId]/productos/actions";
import { getIngredientsAction, getRecipesAction } from "@/app/workspace/[businessId]/recetas/actions";
import { QuickSupplierModal } from "./quick-supplier-modal";
import { SupplierSelector } from "@/components/purchases/supplier-selector";
import { CategoryManagerModal } from "@/app/workspace/[businessId]/productos/category-manager-modal";
import { formatCOP } from "@/config/plans";

interface Props {
  businessId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (purchase: Purchase) => void;
  products: Product[];
  locations: Location[];
  categories?: Category[];
  initialProductId?: string | null;
  initialSupplierId?: string | null;
}

export interface LoadedItem {
  id: string;
  itemCategory: "ingredient" | "resale" | "free";
  isInventoryItem: boolean;
  productId?: string;
  productName?: string;
  sku?: string;
  itemName: string;
  unit?: string;
  purchaseUnit?: string;
  inventoryUnit?: string;
  conversionFactor?: number;
  inventoryQuantity?: number;
  discount?: number;
  locationId?: string;
  locationName?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

interface TaxRateOption {
  rate: number;
  label: string;
}

export function PurchaseFormModal({
  businessId,
  isOpen,
  onClose,
  onSuccess,
  products,
  locations,
  categories: initialCategories = [],
  initialProductId,
  initialSupplierId,
}: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipeProductIds, setRecipeProductIds] = useState<Set<string>>(new Set());
  const [isQuickSupplierOpen, setIsQuickSupplierOpen] = useState(false);
  const [quickSupplierPrefillName, setQuickSupplierPrefillName] = useState("");
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isCustomTaxModalOpen, setIsCustomTaxModalOpen] = useState(false);
  const [customTaxRate, setCustomTaxRate] = useState("");
  const [customTaxLabel, setCustomTaxLabel] = useState("");

  // ==========================================
  // PASO 1: PROVEEDOR Y DOCUMENTO
  // ==========================================
  const [supplierId, setSupplierId] = useState("");
  const [documentType, setDocumentType] = useState<PurchaseDocumentType>("factura");
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [invoiceNumber, setInvoiceNumber] = useState("");

  // ==========================================
  // PASO 2: SELECTOR TRIFÁSICO DE ÍTEMS Y CONVERSIONES
  // ==========================================
  // "ingredient" = [Insumo / Ingrediente]
  // "resale"     = [Bebida / Reventa Directa]
  // "free"       = [Ítem Libre / Gasto]
  const [triphasicType, setTriphasicType] = useState<"ingredient" | "resale" | "free">("ingredient");

  const defaultLocationId = locations[0]?.id || "";
  const [selectedIngredientId, setSelectedIngredientId] = useState("");
  const [selectedResaleProductId, setSelectedResaleProductId] = useState("");
  const [freeItemName, setFreeItemName] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState<string>(defaultLocationId);
  const [itemQuantity, setItemQuantity] = useState("1");
  const [purchaseUnit, setPurchaseUnit] = useState("unidad");
  const [itemUnitCost, setItemUnitCost] = useState("");
  const [itemDiscount, setItemDiscount] = useState("");

  // Tabla temporal de ítems cargados
  const [loadedItems, setLoadedItems] = useState<LoadedItem[]>([]);

  // ==========================================
  // PASO 3: DESCUENTO GLOBAL, IMPUESTOS Y PAGO
  // ==========================================
  const [globalDiscount, setGlobalDiscount] = useState("");

  // IVA
  const [hasTax, setHasTax] = useState(false);
  const [taxOptions, setTaxOptions] = useState<TaxRateOption[]>([
    { rate: 0, label: "0% (Exento)" },
    { rate: 5, label: "5% (Canasta Básica)" },
    { rate: 19, label: "19% (General)" },
  ]);
  const [selectedTaxRate, setSelectedTaxRate] = useState<number>(0);
  const [ivaIncluded, setIvaIncluded] = useState(false);

  // Retención en la fuente
  const [hasRetention, setHasRetention] = useState(false);
  const [retentionPercentage, setRetentionPercentage] = useState("2.5");

  // Condición y medios de pago
  const [paymentType, setPaymentType] = useState<"cash" | "credit">("cash");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [creditDays, setCreditDays] = useState("30");
  const [dueDate, setDueDate] = useState("");
  const [initialPaymentAmount, setInitialPaymentAmount] = useState("");
  const [initialPaymentMethod, setInitialPaymentMethod] = useState("cash");
  const [deductFromCashRegister, setDeductFromCashRegister] = useState(true);
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedPurchase, setConfirmedPurchase] = useState<Purchase | null>(null);

  // Cargar catálogos auxiliares (proveedores, categorías, ingredientes, recetas)
  const refreshCatalogs = async () => {
    try {
      const [suppsRes, catsRes, ingsRes, recipesRes] = await Promise.all([
        getSuppliersAction(businessId),
        getCategoriesAction(businessId),
        getIngredientsAction(businessId),
        getRecipesAction(businessId),
      ]);

      if (suppsRes.success && suppsRes.data) {
        setSuppliers(suppsRes.data);
      }
      if (catsRes.success && catsRes.data) {
        setCategories(catsRes.data);
      }
      if (ingsRes.success && ingsRes.data) {
        setIngredients(ingsRes.data);
      }
      if (recipesRes.success && recipesRes.data) {
        const ids = new Set(recipesRes.data.map((r) => r.productId));
        setRecipeProductIds(ids);
      }
    } catch (err) {
      console.error("Error al cargar catálogos para compra:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshCatalogs();
      setConfirmedPurchase(null);

      if (initialSupplierId) {
        setSupplierId(initialSupplierId);
      }

      // Pre-cargar producto inicial si se especificó
      if (initialProductId) {
        const prod = products.find((p) => p.id === initialProductId);
        if (prod) {
          const isIng = (prod.metadata as any)?.product_type === "ingredient";
          if (isIng) {
            setTriphasicType("ingredient");
            setSelectedIngredientId(prod.id);
          } else {
            setTriphasicType("resale");
            setSelectedResaleProductId(prod.id);
          }
          const prodCost = Number(
            (prod.metadata as any)?.cost ??
            (prod.metadata as any)?.average_cost ??
            (prod as any)?.cost_price ??
            0
          );
          if (prodCost > 0) {
            setItemUnitCost(String(prodCost));
          }
        }
      }
    }
  }, [isOpen, businessId, initialProductId, initialSupplierId]);

  // Opciones normalizadas para selector de insumos / ingredientes
  const ingredientOptions = useMemo(() => {
    return ingredients.map((ing) => ({
      value: ing.id,
      label: ing.name,
      description: `${ing.stockQuantity} ${ing.unit} disp. | Costo: $${ing.costPerUnit}`,
    }));
  }, [ingredients]);

  // Opciones normalizadas para selector de productos de reventa directa
  const resaleProductOptions = useMemo(() => {
    return products
      .filter((p) => (p.metadata as any)?.product_type !== "ingredient")
      .map((p) => {
        const isPreparedWithRecipe = recipeProductIds.has(p.id);
        return {
          value: p.id,
          label: p.name,
          description: isPreparedWithRecipe
            ? "🔒 Bloqueado: Plato con receta"
            : `$${Number(p.price || 0).toLocaleString()}`,
          disabled: isPreparedWithRecipe,
        };
      });
  }, [products, recipeProductIds]);

  // Si cambia el proveedor, actualizar días de crédito por defecto si los tiene
  const handleSupplierChange = (id: string) => {
    setSupplierId(id);
    const selected = suppliers.find((s) => s.id === id);
    if (selected && selected.paymentTermsDays > 0) {
      setCreditDays(String(selected.paymentTermsDays));
    }
  };

  // Al crear un nuevo proveedor desde el submodal rápido: se añade a la lista y se selecciona automáticamente
  const handleSupplierCreated = (newSupplier: Supplier) => {
    setSuppliers((prev) => {
      const exists = prev.some((s) => s.id === newSupplier.id);
      if (exists) return prev;
      return [...prev, newSupplier].sort((a, b) => a.name.localeCompare(b.name));
    });
    setSupplierId(newSupplier.id);
    if (newSupplier.paymentTermsDays && newSupplier.paymentTermsDays > 0) {
      setCreditDays(String(newSupplier.paymentTermsDays));
    }
    setIsQuickSupplierOpen(false);
  };

  // Al seleccionar un insumo del catálogo de ingredientes
  const handleSelectIngredient = (ingId: string) => {
    setSelectedIngredientId(ingId);
    const ing = ingredients.find((i) => i.id === ingId);
    if (ing) {
      setPurchaseUnit(ing.unit || "unidad");
      if (ing.costPerUnit > 0) {
        setItemUnitCost(String(ing.costPerUnit));
      }
    }
  };

  // Al seleccionar un producto terminado para reventa directa
  const handleSelectResaleProduct = (prodId: string) => {
    if (recipeProductIds.has(prodId)) {
      toast.warning("Plato preparado con receta", {
        description: "Este producto se cocina mediante receta y escandallo. Adquiere sus materias primas en la pestaña [Insumo / Ingrediente].",
      });
      return;
    }

    setSelectedResaleProductId(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      setPurchaseUnit((prod.metadata as any)?.unit || "unidad");
      const prodCost = Number(
        (prod.metadata as any)?.cost ??
        (prod.metadata as any)?.average_cost ??
        (prod as any)?.cost_price ??
        0
      );
      if (prodCost > 0) {
        setItemUnitCost(String(prodCost));
      }
    }
  };

  // Agregar nueva tarifa personalizada de IVA
  const handleAddCustomTaxRate = () => {
    const rateNum = parseFloat(customTaxRate);
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
      toast.error("Ingresa un porcentaje de IVA válido entre 0 y 100.");
      return;
    }

    const label = customTaxLabel.trim() || `${rateNum}% (Personalizado)`;
    const newOption: TaxRateOption = { rate: rateNum, label };

    setTaxOptions((prev) => [...prev, newOption]);
    setSelectedTaxRate(rateNum);
    setHasTax(true);
    setIsCustomTaxModalOpen(false);
    setCustomTaxRate("");
    setCustomTaxLabel("");
    toast.success(`Tarifa de IVA ${rateNum}% agregada.`);
  };

  // Manejador del botón: '+ Agregar a la lista'
  const handleAddItemToList = () => {
    const q = parseFloat(itemQuantity);
    const c = parseFloat(itemUnitCost);
    const lineDiscount = Math.max(0, parseFloat(itemDiscount) || 0);

    if (isNaN(q) || q <= 0) {
      toast.error("La cantidad debe ser mayor a 0.");
      return;
    }

    if (isNaN(c) || c < 0) {
      toast.error("El costo unitario no puede ser negativo.");
      return;
    }

    const targetLocId = selectedLocationId || defaultLocationId;
    const targetLoc = locations.find((l) => l.id === targetLocId);

    if (triphasicType === "ingredient") {
      // 1. Insumo / Ingrediente
      if (!selectedIngredientId) {
        toast.error("Por favor selecciona un insumo o materia prima.");
        return;
      }
      const ing = ingredients.find((i) => i.id === selectedIngredientId);
      if (!ing) {
        toast.error("Insumo no encontrado en el catálogo.");
        return;
      }

      // Evitar duplicados consolidando cantidades si ya está en la lista
      const existingIdx = loadedItems.findIndex((it) => it.productId === ing.id);
      if (existingIdx !== -1) {
        toast.info(`El insumo "${ing.name}" ya estaba en la lista. Se consolidó la cantidad.`);
        setLoadedItems((prev) => {
          const updated = [...prev];
          const curr = updated[existingIdx];
          const combinedQty = curr.quantity + q;
          const combinedGross = combinedQty * c;
          const combinedDiscount = (curr.discount || 0) + lineDiscount;
          const combinedTotal = Math.max(0, combinedGross - combinedDiscount);
          updated[existingIdx] = {
            ...curr,
            quantity: combinedQty,
            unitCost: c,
            discount: combinedDiscount,
            totalCost: Number(combinedTotal.toFixed(2)),
            inventoryQuantity: curr.conversionFactor ? combinedQty * curr.conversionFactor : combinedQty,
          };
          return updated;
        });
        setItemQuantity("1");
        setItemDiscount("");
        return;
      }

      const invUnit = ing.unit || "unidad";
      let convFactor = 1;
      let invQty = q;

      if (purchaseUnit && purchaseUnit.toLowerCase() !== invUnit.toLowerCase()) {
        const conv = convertQuantity(q, purchaseUnit, invUnit);
        if (!conv.isCompatible) {
          toast.error(`Unidades incompatibles: no se puede convertir "${purchaseUnit}" a "${invUnit}".`);
          return;
        }
        convFactor = conv.factor;
        invQty = conv.convertedQuantity;
      }

      const lineTotal = Math.max(0, q * c - lineDiscount);

      const newItem: LoadedItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        itemCategory: "ingredient",
        isInventoryItem: true,
        productId: ing.id,
        productName: ing.name,
        itemName: ing.name,
        unit: invUnit,
        purchaseUnit: purchaseUnit || invUnit,
        inventoryUnit: invUnit,
        conversionFactor: convFactor,
        inventoryQuantity: invQty,
        discount: lineDiscount,
        locationId: targetLocId || undefined,
        locationName: targetLoc?.name || undefined,
        quantity: q,
        unitCost: c,
        totalCost: Number(lineTotal.toFixed(2)),
      };

      setLoadedItems((prev) => [...prev, newItem]);
      toast.success(`Insumo agregado: ${ing.name}`);
    } else if (triphasicType === "resale") {
      // 2. Bebida / Reventa Directa
      if (!selectedResaleProductId) {
        toast.error("Por favor selecciona un artículo de reventa directa.");
        return;
      }
      if (recipeProductIds.has(selectedResaleProductId)) {
        toast.error("No se pueden comprar directamente platos con receta.");
        return;
      }

      const prod = products.find((p) => p.id === selectedResaleProductId);
      if (!prod) {
        toast.error("Producto de reventa no encontrado.");
        return;
      }

      // Evitar duplicados consolidando cantidades si ya está en la lista
      const existingIdx = loadedItems.findIndex((it) => it.productId === prod.id);
      if (existingIdx !== -1) {
        toast.info(`El producto "${prod.name}" ya estaba en la lista. Se consolidó la cantidad.`);
        setLoadedItems((prev) => {
          const updated = [...prev];
          const curr = updated[existingIdx];
          const combinedQty = curr.quantity + q;
          const combinedGross = combinedQty * c;
          const combinedDiscount = (curr.discount || 0) + lineDiscount;
          const combinedTotal = Math.max(0, combinedGross - combinedDiscount);
          updated[existingIdx] = {
            ...curr,
            quantity: combinedQty,
            unitCost: c,
            discount: combinedDiscount,
            totalCost: Number(combinedTotal.toFixed(2)),
            inventoryQuantity: curr.conversionFactor ? combinedQty * curr.conversionFactor : combinedQty,
          };
          return updated;
        });
        setItemQuantity("1");
        setItemDiscount("");
        return;
      }

      const invUnit = (prod.metadata as any)?.unit || "unidad";
      let convFactor = 1;
      let invQty = q;

      if (purchaseUnit && purchaseUnit.toLowerCase() !== invUnit.toLowerCase()) {
        const conv = convertQuantity(q, purchaseUnit, invUnit);
        if (!conv.isCompatible) {
          toast.error(`Unidades incompatibles: no se puede convertir "${purchaseUnit}" a "${invUnit}".`);
          return;
        }
        convFactor = conv.factor;
        invQty = conv.convertedQuantity;
      }

      const lineTotal = Math.max(0, q * c - lineDiscount);

      const newItem: LoadedItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        itemCategory: "resale",
        isInventoryItem: true,
        productId: prod.id,
        productName: prod.name,
        sku: (prod.metadata as any)?.sku || undefined,
        itemName: prod.name,
        unit: invUnit,
        purchaseUnit: purchaseUnit || invUnit,
        inventoryUnit: invUnit,
        conversionFactor: convFactor,
        inventoryQuantity: invQty,
        discount: lineDiscount,
        locationId: targetLocId || undefined,
        locationName: targetLoc?.name || undefined,
        quantity: q,
        unitCost: c,
        totalCost: Number(lineTotal.toFixed(2)),
      };

      setLoadedItems((prev) => [...prev, newItem]);
      toast.success(`Artículo agregado: ${prod.name}`);
    } else {
      // 3. Ítem Libre / Gasto
      if (!freeItemName.trim()) {
        toast.error("Ingresa el concepto del ítem o gasto (ej. Aseo, Bombillos).");
        return;
      }

      const lineTotal = Math.max(0, q * c - lineDiscount);

      const newItem: LoadedItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        itemCategory: "free",
        isInventoryItem: false,
        itemName: freeItemName.trim(),
        unit: purchaseUnit || "unidad",
        purchaseUnit: purchaseUnit || "unidad",
        inventoryUnit: "unidad",
        conversionFactor: 1,
        inventoryQuantity: q,
        discount: lineDiscount,
        quantity: q,
        unitCost: c,
        totalCost: Number(lineTotal.toFixed(2)),
      };

      setLoadedItems((prev) => [...prev, newItem]);
      toast.success(`Gasto agregado: ${freeItemName.trim()}`);
    }

    // Resetear formulario para el siguiente ítem
    setFreeItemName("");
    setItemQuantity("1");
    setItemDiscount("");
  };

  // Eliminar un ítem de la tabla temporal
  const handleRemoveLoadedItem = (id: string) => {
    setLoadedItems((prev) => prev.filter((it) => it.id !== id));
    toast.info("Ítem removido de la lista de compra.");
  };

  // ==========================================
  // CÁLCULOS EN VIVO PARA LA COLUMNA DERECHA
  // ==========================================
  const rawSubtotal = useMemo(() => {
    return loadedItems.reduce((acc, it) => acc + it.totalCost, 0);
  }, [loadedItems]);

  const totalUnits = useMemo(() => {
    return loadedItems.reduce((acc, it) => acc + it.quantity, 0);
  }, [loadedItems]);

  const activeTaxPercentage = hasTax ? selectedTaxRate : 0;
  const activeRetentionPercentage = hasRetention ? parseFloat(retentionPercentage) || 0 : 0;
  const parsedGlobalDiscount = Math.max(0, parseFloat(globalDiscount) || 0);

  // Manejo de IVA incluido vs IVA sumado
  const { subtotal, taxAmount, total } = useMemo(() => {
    const discountedGross = Math.max(0, rawSubtotal - parsedGlobalDiscount);

    if (ivaIncluded && activeTaxPercentage > 0) {
      // Los precios ingresados ya contienen el IVA -> Desglosamos
      const baseSubtotal = discountedGross / (1 + activeTaxPercentage / 100);
      const computedTax = discountedGross - baseSubtotal;
      const computedRetention = (baseSubtotal * activeRetentionPercentage) / 100;
      const netTotal = Math.max(0, discountedGross - computedRetention);

      return {
        subtotal: Number(baseSubtotal.toFixed(2)),
        taxAmount: Number(computedTax.toFixed(2)),
        retentionAmount: Number(computedRetention.toFixed(2)),
        total: Number(netTotal.toFixed(2)),
      };
    } else {
      // IVA sumado sobre el subtotal
      const computedTax = (discountedGross * activeTaxPercentage) / 100;
      const computedRetention = (discountedGross * activeRetentionPercentage) / 100;
      const netTotal = Math.max(0, discountedGross + computedTax - computedRetention);

      return {
        subtotal: Number(discountedGross.toFixed(2)),
        taxAmount: Number(computedTax.toFixed(2)),
        retentionAmount: Number(computedRetention.toFixed(2)),
        total: Number(netTotal.toFixed(2)),
      };
    }
  }, [rawSubtotal, parsedGlobalDiscount, activeTaxPercentage, activeRetentionPercentage, ivaIncluded]);

  const retentionAmount = useMemo(() => {
    return Number(((subtotal * activeRetentionPercentage) / 100).toFixed(2));
  }, [subtotal, activeRetentionPercentage]);

  // Proveedor seleccionado
  const selectedSupplierObj = useMemo(() => {
    return suppliers.find((s) => s.id === supplierId) || null;
  }, [suppliers, supplierId]);

  // Resolver Badge de Origen de Fondos
  const fundsOriginBadge = useMemo(() => {
    if (paymentType === "credit") {
      return {
        label: `Cuenta por Pagar (Crédito ${creditDays} días)`,
        color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        icon: CreditCard,
      };
    }
    if (deductFromCashRegister) {
      return {
        label: "Caja Activa (Efectivo)",
        color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        icon: Banknote,
      };
    }
    return {
      label: "Bancos / Cuenta Comercial",
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      icon: Store,
    };
  }, [paymentType, deductFromCashRegister, creditDays]);

  // Envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierId) {
      toast.error("Selecciona un proveedor para la compra (*)");
      return;
    }

    if (!purchaseDate) {
      toast.error("La fecha de compra es obligatoria (*)");
      return;
    }

    if (loadedItems.length === 0) {
      toast.error("Debes agregar al menos un ítem a la lista antes de registrar.");
      return;
    }

    // Normalizar costos unitarios si el IVA estaba incluido en el precio
    const cleanItems: PurchaseItemInput[] = loadedItems.map((it) => {
      const normalizedUnitCost =
        ivaIncluded && activeTaxPercentage > 0
          ? Number((it.unitCost / (1 + activeTaxPercentage / 100)).toFixed(4))
          : it.unitCost;

      return {
        productId: it.isInventoryItem ? it.productId : undefined,
        itemName: it.itemName.trim(),
        quantity: it.quantity,
        unitCost: normalizedUnitCost,
        locationId: it.isInventoryItem ? it.locationId : undefined,
        isInventoryItem: it.isInventoryItem,
        itemCategory: it.itemCategory,
        purchaseUnit: it.purchaseUnit || it.unit,
        inventoryUnit: it.inventoryUnit || it.unit,
        conversionFactor: it.conversionFactor || 1,
        inventoryQuantity: it.inventoryQuantity || it.quantity,
        discount: it.discount || 0,
      };
    });

    // Calcular fecha de vencimiento si es crédito
    let calculatedDueDate = dueDate;
    if (paymentType === "credit" && !calculatedDueDate) {
      const days = parseInt(creditDays, 10) || 30;
      const target = new Date(purchaseDate);
      target.setDate(target.getDate() + days);
      calculatedDueDate = target.toISOString();
    }

    const initPayNum = paymentType === "credit" ? Math.min(total, Math.max(0, parseFloat(initialPaymentAmount) || 0)) : 0;

    setIsSubmitting(true);
    try {
      const res = await createPurchaseAction(businessId, {
        supplierId: supplierId || undefined,
        documentType,
        invoiceNumber: invoiceNumber.trim() || undefined,
        purchaseDate: new Date(purchaseDate).toISOString(),
        paymentType,
        paymentMethod,
        dueDate: paymentType === "credit" ? calculatedDueDate : undefined,
        discountAmount: parsedGlobalDiscount > 0 ? parsedGlobalDiscount : undefined,
        taxPercentage: activeTaxPercentage,
        retentionPercentage: activeRetentionPercentage,
        initialPaymentAmount: initPayNum > 0 ? initPayNum : undefined,
        initialPaymentMethod: initPayNum > 0 ? initialPaymentMethod : undefined,
        notes: notes.trim()
          ? `${notes.trim()}${ivaIncluded ? " (Precios originales con IVA incluido)" : ""}`
          : ivaIncluded
          ? "Precios originales con IVA incluido"
          : undefined,
        items: cleanItems,
        deductFromCashRegister: deductFromCashRegister && paymentType === "cash",
      });

      if (!res.success || !res.data) {
        toast.error("Error al registrar compra: " + (res.error || "Verifica los datos ingresados."));
        return;
      }

      toast.success(`Compra registrada exitosamente: ${res.data.purchaseNumber}`);
      setConfirmedPurchase(res.data);
    } catch (err: any) {
      toast.error("Error inesperado al registrar compra: " + (err.message || "Error en el servidor."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSupplierId("");
    setDocumentType("factura");
    setPurchaseDate(new Date().toISOString().split("T")[0]);
    setInvoiceNumber("");
    setSelectedIngredientId("");
    setSelectedResaleProductId("");
    setFreeItemName("");
    setItemQuantity("1");
    setPurchaseUnit("unidad");
    setItemUnitCost("");
    setItemDiscount("");
    setGlobalDiscount("");
    setLoadedItems([]);
    setHasTax(false);
    setSelectedTaxRate(0);
    setIvaIncluded(false);
    setHasRetention(false);
    setRetentionPercentage("2.5");
    setPaymentType("cash");
    setPaymentMethod("cash");
    setCreditDays("30");
    setDueDate("");
    setInitialPaymentAmount("");
    setInitialPaymentMethod("cash");
    setNotes("");
    setDeductFromCashRegister(true);
    setConfirmedPurchase(null);
  };

  if (!isOpen) return null;

  return (
    <>
      <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-5xl xl:max-w-6xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header del Modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <span>Nueva compra</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      Entrada a Inventario & Kardex
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Registro de compras en 2 columnas con selector trifásico para materias primas, reventa y gastos.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* PANTALLA DE CONFIRMACIÓN ÉXITO O FORMULARIO */}
            {confirmedPurchase ? (
              <div className="p-8 text-center space-y-6 my-auto">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 mx-auto flex items-center justify-center ring-8 ring-emerald-500/5">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                    {confirmedPurchase.purchaseNumber}
                  </span>
                  <h4 className="text-xl font-bold text-foreground">
                    ¡Compra Registrada Exitosamente!
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Se actualizaron las existencias en inventario, se recalculó el costo promedio ponderado y se registraron los movimientos correspondientes.
                  </p>
                </div>

                <div className="max-w-md mx-auto p-4 rounded-xl bg-muted/40 border border-border text-left space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total de la compra:</span>
                    <strong className="font-mono text-foreground">{formatCOP(confirmedPurchase.total)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Condición de pago:</span>
                    <strong className="capitalize text-foreground">
                      {confirmedPurchase.paymentType === "cash" ? "Contado" : "A Crédito"}
                    </strong>
                  </div>
                  {confirmedPurchase.deductFromCashRegister && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                      <span>Salida de caja:</span>
                      <span>Deducido de la caja activa</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center gap-3 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => {
                      const p = confirmedPurchase;
                      setConfirmedPurchase(null);
                      onClose();
                      if (p) onSuccess(p);
                    }}
                    className="px-5 py-2.5 rounded-xl border border-border text-xs font-bold hover:bg-muted transition-all cursor-pointer"
                  >
                    Cerrar ventana
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const p = confirmedPurchase;
                      resetForm();
                      if (p) onSuccess(p);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-md cursor-pointer"
                  >
                    + Registrar otra compra
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-0">
                {/* ========================================================= */}
                {/* COLUMNA IZQUIERDA (POR PASOS)                             */}
                {/* ========================================================= */}
                <div className="lg:col-span-7 xl:col-span-7 overflow-y-auto p-5 sm:p-6 space-y-6 border-b lg:border-b-0 lg:border-r border-border">
                  {/* PASO 1: PROVEEDOR Y FECHA */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-border pb-2">
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center shrink-0">
                        1
                      </span>
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Paso 1: Proveedor y Fecha de compra
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Proveedor (*) con botón directo '+' al lado del selector */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-foreground mb-1.5">
                          <span>Proveedor</span>
                          <span className="text-red-500 font-bold ml-1">*</span>
                        </label>
                        <SupplierSelector
                          suppliers={suppliers}
                          value={supplierId}
                          onChange={handleSupplierChange}
                          onOpenCreateSupplier={(prefill) => {
                            setQuickSupplierPrefillName(prefill || "");
                            setIsQuickSupplierOpen(true);
                          }}
                          placeholder="Buscar o seleccionar proveedor..."
                        />
                      </div>

                      {/* Tipo de Documento */}
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1.5">
                          Tipo de Documento
                        </label>
                        <Select
                          value={documentType}
                          onChange={(e) => setDocumentType(e.target.value as PurchaseDocumentType)}
                          selectSize="sm"
                        >
                          <option value="factura">Factura de Venta</option>
                          <option value="remision">Remisión / Entrada</option>
                          <option value="cuenta_cobro">Cuenta de Cobro</option>
                          <option value="ticket">Ticket / Comprobante</option>
                        </Select>
                      </div>

                      {/* N° Factura / Remisión (Opcional) */}
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1.5">
                          N° Factura / Referencia <span className="text-muted-foreground font-normal">(Opcional)</span>
                        </label>
                        <Input
                          type="text"
                          value={invoiceNumber}
                          onChange={(e) => setInvoiceNumber(e.target.value)}
                          placeholder="Ej: FAC-10492"
                          inputSize="sm"
                        />
                      </div>

                      {/* Fecha de compra (*) */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-foreground mb-1.5">
                          Fecha de Compra <span className="text-red-500 font-bold">*</span>
                        </label>
                        <Input
                          type="date"
                          required
                          value={purchaseDate}
                          onChange={(e) => setPurchaseDate(e.target.value)}
                          inputSize="sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* PASO 2: ÍTEMS DE COMPRA CON SELECTOR TRIFÁSICO */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center shrink-0">
                          2
                        </span>
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                          Paso 2: Ítems de compra
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsCategoryModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition-all border border-border cursor-pointer"
                      >
                        <FolderKanban className="w-3.5 h-3.5 text-primary" />
                        <span>Categorías</span>
                      </button>
                    </div>

                    {/* SELECTOR TRIFÁSICO LIMPIO */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* Opción 1: Insumo / Ingrediente */}
                      <button
                        type="button"
                        onClick={() => setTriphasicType("ingredient")}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          triphasicType === "ingredient"
                            ? "bg-amber-500/10 border-amber-500/60 text-foreground shadow-sm ring-1 ring-amber-500/30"
                            : "border-border text-muted-foreground hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Apple className={`w-4 h-4 ${triphasicType === "ingredient" ? "text-amber-500" : "text-muted-foreground"}`} />
                          <span className="font-bold text-xs text-foreground">Insumo / Ingrediente</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                          Materias primas (queso, carne, papas, pan, empaques). Suma existencias y recalcula costo promedio.
                        </p>
                      </button>

                      {/* Opción 2: Bebida / Reventa Directa */}
                      <button
                        type="button"
                        onClick={() => setTriphasicType("resale")}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          triphasicType === "resale"
                            ? "bg-blue-500/10 border-blue-500/60 text-foreground shadow-sm ring-1 ring-blue-500/30"
                            : "border-border text-muted-foreground hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Package className={`w-4 h-4 ${triphasicType === "resale" ? "text-blue-500" : "text-muted-foreground"}`} />
                          <span className="font-bold text-xs text-foreground">Producto / Reventa</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                          Artículos que se compran y venden directamente sin transformación. Aumenta stock en el inventario.
                        </p>
                      </button>

                      {/* Opción 3: Ítem Libre / Gasto */}
                      <button
                        type="button"
                        onClick={() => setTriphasicType("free")}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          triphasicType === "free"
                            ? "bg-purple-500/10 border-purple-500/60 text-foreground shadow-sm ring-1 ring-purple-500/30"
                            : "border-border text-muted-foreground hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Wrench className={`w-4 h-4 ${triphasicType === "free" ? "text-purple-500" : "text-muted-foreground"}`} />
                          <span className="font-bold text-xs text-foreground">Ítem Libre / Gasto</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                          Compras no gastronómicas (artículos de aseo, bombillos, mantenimiento).
                        </p>
                      </button>
                    </div>

                    {/* Campos de entrada: Selector respectivo, Cantidad (*), Costo unitario (*) y botón '+ Agregar a la lista' */}
                    <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        {/* Selector dinámico según el Selector Trifásico */}
                        <div className="sm:col-span-5">
                          <label className="block text-[11px] font-semibold text-foreground mb-1">
                            {triphasicType === "ingredient" ? (
                              <span>
                                Insumo o Materia Prima <span className="text-red-500 font-bold">*</span>
                              </span>
                            ) : triphasicType === "resale" ? (
                              <span>
                                Producto de Reventa Directa <span className="text-red-500 font-bold">*</span>
                              </span>
                            ) : (
                              <span>
                                Concepto del Gasto / Ítem Libre <span className="text-red-500 font-bold">*</span>
                              </span>
                            )}
                          </label>

                          {triphasicType === "ingredient" ? (
                            <SearchSelect
                              value={selectedIngredientId}
                              onChange={(val) => handleSelectIngredient(val)}
                              options={ingredientOptions}
                              placeholder="-- Seleccionar insumo / ingrediente --"
                              searchPlaceholder="Buscar insumo o materia prima..."
                              emptyText="No se encontraron insumos"
                              selectSize="sm"
                            />
                          ) : triphasicType === "resale" ? (
                            <SearchSelect
                              value={selectedResaleProductId}
                              onChange={(val) => handleSelectResaleProduct(val)}
                              options={resaleProductOptions}
                              placeholder="-- Seleccionar artículo terminado --"
                              searchPlaceholder="Buscar producto para reventa..."
                              emptyText="No se encontraron productos"
                              selectSize="sm"
                            />
                          ) : (
                            <Input
                              type="text"
                              value={freeItemName}
                              onChange={(e) => setFreeItemName(e.target.value)}
                              placeholder="Ej: Jabón desengrasante 5L, Bombillos LED..."
                              inputSize="sm"
                            />
                          )}
                        </div>

                        {/* Cantidad (*) */}
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-foreground mb-1">
                            Cantidad <span className="text-red-500 font-bold">*</span>
                          </label>
                          <Input
                            type="number"
                            step="any"
                            min="0.0001"
                            value={itemQuantity}
                            onChange={(e) => setItemQuantity(e.target.value)}
                            placeholder="1"
                            inputSize="sm"
                            className="text-right font-mono"
                          />
                        </div>

                        {/* Unidad de Compra */}
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-foreground mb-1">
                            Unidad
                          </label>
                          <Select
                            value={purchaseUnit}
                            onChange={(e) => setPurchaseUnit(e.target.value)}
                            selectSize="sm"
                          >
                            <option value="unidad">Unidad (und)</option>
                            <option value="kg">Kilogramos (kg)</option>
                            <option value="g">Gramos (g)</option>
                            <option value="lb">Libras (lb)</option>
                            <option value="lt">Litros (lt)</option>
                            <option value="ml">Mililitros (ml)</option>
                            <option value="paquete">Paquete</option>
                            <option value="caja">Caja</option>
                            <option value="docena">Docena</option>
                          </Select>
                        </div>

                        {/* Costo unitario (*) */}
                        <div className="sm:col-span-3">
                          <label className="block text-[11px] font-semibold text-foreground mb-1">
                            Costo Unitario ($) <span className="text-red-500 font-bold">*</span>
                          </label>
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            value={itemUnitCost}
                            onChange={(e) => setItemUnitCost(e.target.value)}
                            placeholder="0"
                            inputSize="sm"
                            className="text-right font-mono"
                          />
                        </div>
                      </div>

                      {/* Descuento por línea opcional */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                        <div className="sm:col-span-6">
                          {/* Live preview de conversión si la unidad de compra difiere de la de inventario */}
                          {(() => {
                            const selectedProdOrIng =
                              triphasicType === "ingredient"
                                ? ingredients.find((i) => i.id === selectedIngredientId)
                                : products.find((p) => p.id === selectedResaleProductId);
                            const targetInvUnit =
                              (selectedProdOrIng as any)?.unit ||
                              (selectedProdOrIng as any)?.metadata?.unit ||
                              "unidad";

                            if (
                              purchaseUnit &&
                              targetInvUnit &&
                              purchaseUnit.toLowerCase() !== targetInvUnit.toLowerCase()
                            ) {
                              const q = parseFloat(itemQuantity) || 1;
                              const conv = convertQuantity(q, purchaseUnit, targetInvUnit);
                              return (
                                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 font-medium">
                                  {conv.isCompatible ? (
                                    <span>
                                      🔄 Conversión: {q} {purchaseUnit} = <strong>{conv.convertedQuantity} {targetInvUnit}</strong> en inventario (factor x{conv.factor})
                                    </span>
                                  ) : (
                                    <span className="text-red-500">
                                      ⚠️ {conv.error || "Unidades incompatibles"}
                                    </span>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <div className="sm:col-span-6 flex items-center justify-end gap-2">
                          <label className="text-[11px] text-muted-foreground whitespace-nowrap">
                            Descuento línea ($):
                          </label>
                          <div className="w-32">
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              value={itemDiscount}
                              onChange={(e) => setItemDiscount(e.target.value)}
                              placeholder="0"
                              inputSize="sm"
                              className="text-right font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Subtotal estimado y botón '+ Agregar a la lista' */}
                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <div className="text-[11px] text-muted-foreground">
                          Subtotal estimado:{" "}
                          <strong className="text-foreground font-mono">
                            {formatCOP(
                              (parseFloat(itemQuantity) || 0) * (parseFloat(itemUnitCost) || 0)
                            )}
                          </strong>
                        </div>

                        <button
                          type="button"
                          onClick={handleAddItemToList}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Agregar a la lista</span>
                        </button>
                      </div>
                    </div>

                    {/* TABLA TEMPORAL CON SUBTOTALES */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                        <span className="font-semibold uppercase tracking-wider text-[11px]">
                          Artículos cargados en esta compra ({loadedItems.length})
                        </span>
                        {loadedItems.length > 0 && (
                          <span className="font-mono text-[11px] font-bold text-foreground">
                            {totalUnits} unidades en total
                          </span>
                        )}
                      </div>

                      <div className="border border-border rounded-xl overflow-hidden bg-card">
                        {loadedItems.length === 0 ? (
                          <div className="p-6 text-center text-muted-foreground space-y-1">
                            <ShoppingCart className="w-6 h-6 mx-auto text-muted-foreground/40" />
                            <p className="text-xs font-semibold text-foreground">
                              Aún no has agregado artículos a la compra
                            </p>
                            <p className="text-[11px]">
                              Usa el selector trifásico arriba y haz clic en «+ Agregar a la lista».
                            </p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto max-h-44 overflow-y-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-muted/40 border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground sticky top-0">
                                <tr>
                                  <th className="px-3 py-2">Tipo</th>
                                  <th className="px-3 py-2">Concepto / Producto</th>
                                  <th className="px-3 py-2 text-center">Cant.</th>
                                  <th className="px-3 py-2 text-right">Costo Unit.</th>
                                  <th className="px-3 py-2 text-right">Subtotal</th>
                                  <th className="px-2 py-2 text-center w-8"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {loadedItems.map((it) => (
                                  <tr key={it.id} className="hover:bg-muted/20">
                                    <td className="px-3 py-2">
                                      {it.itemCategory === "ingredient" ? (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                          Insumo
                                        </span>
                                      ) : it.itemCategory === "resale" ? (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                          Reventa
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400">
                                          Gasto
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 font-medium text-foreground">
                                      <div className="truncate max-w-[200px]" title={it.itemName}>
                                        {it.itemName}
                                      </div>
                                    </td>
                                    <td className="px-3 py-2 text-center font-mono font-semibold">
                                      {it.quantity} {it.unit || ""}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                                      {formatCOP(it.unitCost)}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono font-bold text-foreground">
                                      {formatCOP(it.totalCost)}
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveLoadedItem(it.id)}
                                        className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                        title="Quitar de la compra"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* PASO 3: IMPUESTOS Y PAGO */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-border pb-2">
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center shrink-0">
                        3
                      </span>
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Paso 3: Impuestos y Pago
                      </h4>
                    </div>

                    {/* Descuento Comercial Global */}
                    <div className="p-3.5 rounded-xl border border-border bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-foreground">
                          Descuento Comercial Global ($)
                        </label>
                        {parsedGlobalDiscount > 0 && (
                          <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            -{formatCOP(parsedGlobalDiscount)}
                          </span>
                        )}
                      </div>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={globalDiscount}
                        onChange={(e) => setGlobalDiscount(e.target.value)}
                        placeholder="0 (Sin descuento global)"
                        inputSize="sm"
                        className="text-right font-mono"
                      />
                    </div>

                    {/* Subtotal de productos */}
                    <div className="p-3 rounded-xl bg-muted/20 border border-border flex items-center justify-between text-xs">
                      <span className="font-semibold text-muted-foreground">
                        Subtotal de productos cargados:
                      </span>
                      <span className="text-sm font-bold font-mono text-foreground">
                        {formatCOP(rawSubtotal)}
                      </span>
                    </div>

                    {/* Configuración de IVA */}
                    <div className="p-3.5 rounded-xl border border-border bg-card space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="switch_has_tax"
                            checked={hasTax}
                            onChange={(e) => {
                              setHasTax(e.target.checked);
                              if (e.target.checked && selectedTaxRate === 0) {
                                setSelectedTaxRate(19);
                              }
                            }}
                            className="w-4 h-4 rounded text-primary border-border focus:ring-primary cursor-pointer"
                          />
                          <label htmlFor="switch_has_tax" className="text-xs font-bold text-foreground cursor-pointer select-none">
                            Configuración de IVA (Impuesto al Valor Agregado)
                          </label>
                        </div>

                        {hasTax && (
                          <button
                            type="button"
                            onClick={() => setIsCustomTaxModalOpen(true)}
                            className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            + Nueva tarifa
                          </button>
                        )}
                      </div>

                      {hasTax && (
                        <div className="space-y-2 pt-1 border-t border-border animate-in fade-in">
                          <div className="flex flex-wrap items-center gap-2">
                            {taxOptions.map((opt) => (
                              <button
                                key={opt.rate}
                                type="button"
                                onClick={() => setSelectedTaxRate(opt.rate)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                  selectedTaxRate === opt.rate
                                    ? "bg-primary text-primary-foreground shadow-xs"
                                    : "bg-muted text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>

                          {/* Checkbox: IVA incluido */}
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="checkbox"
                              id="check_iva_included"
                              checked={ivaIncluded}
                              onChange={(e) => setIvaIncluded(e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-primary border-border focus:ring-primary cursor-pointer"
                            />
                            <label
                              htmlFor="check_iva_included"
                              className="text-xs text-muted-foreground cursor-pointer select-none"
                            >
                              Los precios unitarios ingresados ya tienen el <strong className="text-foreground">IVA incluido</strong> (desglosar automáticamente)
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Retención en la fuente */}
                    <div className="p-3.5 rounded-xl border border-border bg-card space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="switch_has_retention"
                            checked={hasRetention}
                            onChange={(e) => setHasRetention(e.target.checked)}
                            className="w-4 h-4 rounded text-primary border-border focus:ring-primary cursor-pointer"
                          />
                          <label htmlFor="switch_has_retention" className="text-xs font-bold text-foreground cursor-pointer select-none">
                            Retención en la Fuente (Cálculo automático)
                          </label>
                        </div>

                        {hasRetention && (
                          <span className="text-[11px] font-mono font-bold text-red-500">
                            -{formatCOP(retentionAmount)}
                          </span>
                        )}
                      </div>

                      {hasRetention && (
                        <div className="pt-2 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-3 items-center animate-in fade-in">
                          <div>
                            <label className="block text-[11px] text-muted-foreground mb-1">
                              Tarifa de Retención
                            </label>
                            <Select
                              value={retentionPercentage}
                              onChange={(e) => setRetentionPercentage(e.target.value)}
                              selectSize="sm"
                            >
                              <option value="2.5">2.5% (Compras Generales)</option>
                              <option value="3.5">3.5% (Servicios / No declarantes)</option>
                              <option value="1.0">1.0% (Combustibles / Especial)</option>
                            </Select>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Se deducirá del total a pagar al proveedor en la liquidación de la compra.
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Condición de Pago: Contado vs Crédito */}
                    <div className="space-y-3">
                      <label className="block text-xs font-semibold text-foreground">
                        Condición de Pago
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentType("cash")}
                          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            paymentType === "cash"
                              ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 shadow-xs"
                              : "border-border text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <Banknote className="w-4 h-4" />
                          <span>Contado</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentType("credit")}
                          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            paymentType === "credit"
                              ? "bg-amber-500/10 border-amber-500/50 text-amber-600 dark:text-amber-400 shadow-xs"
                              : "border-border text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <CreditCard className="w-4 h-4" />
                          <span>Crédito (Por pagar)</span>
                        </button>
                      </div>

                      {/* Si es crédito: plazo en días, fecha de vencimiento y abono inicial */}
                      {paymentType === "credit" && (
                        <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3 animate-in fade-in">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Se generará una cuenta por pagar automáticamente</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] text-muted-foreground mb-1">
                                Plazo en Días
                              </label>
                              <Input
                                type="number"
                                min="1"
                                max="180"
                                value={creditDays}
                                onChange={(e) => setCreditDays(e.target.value)}
                                inputSize="sm"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-muted-foreground mb-1">
                                Fecha Vencimiento
                              </label>
                              <Input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                inputSize="sm"
                              />
                            </div>
                          </div>

                          {/* Abono inicial / Pago parcial opcional */}
                          <div className="pt-2 border-t border-amber-500/20 space-y-2">
                            <label className="block text-[11px] font-bold text-foreground">
                              ¿Se realizó un abono o anticipo inicial?
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-3xs text-muted-foreground mb-0.5">
                                  Monto Abonado ($)
                                </label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={initialPaymentAmount}
                                  onChange={(e) => setInitialPaymentAmount(e.target.value)}
                                  placeholder="0 (Sin abono inicial)"
                                  inputSize="sm"
                                  className="text-right font-mono"
                                />
                              </div>
                              <div>
                                <label className="block text-3xs text-muted-foreground mb-0.5">
                                  Medio del Abono
                                </label>
                                <Select
                                  value={initialPaymentMethod}
                                  onChange={(e) => setInitialPaymentMethod(e.target.value)}
                                  selectSize="sm"
                                >
                                  <option value="cash">Efectivo</option>
                                  <option value="transfer">Transferencia</option>
                                  <option value="card">Tarjeta</option>
                                </Select>
                              </div>
                            </div>
                            {parseFloat(initialPaymentAmount) > 0 && (
                              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-3xs flex justify-between font-mono">
                                <span>Abono inicial: {formatCOP(parseFloat(initialPaymentAmount))}</span>
                                <span>Saldo pendiente: {formatCOP(Math.max(0, total - (parseFloat(initialPaymentAmount) || 0)))}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Medio de pago y Salida de caja */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1">
                          Medio de Pago
                        </label>
                        <Select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          selectSize="sm"
                        >
                          <option value="cash">Efectivo</option>
                          <option value="transfer">Transferencia Bancaria</option>
                          <option value="card">Tarjeta Débito / Crédito</option>
                          <option value="other">Otro</option>
                        </Select>
                      </div>

                      {/* Salida de caja: Checkbox 'Deducir automáticamente de la caja activa' */}
                      <div className="sm:col-span-2 p-3 rounded-xl bg-muted/20 border border-border">
                        <label className="flex items-start gap-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={deductFromCashRegister}
                            onChange={(e) => setDeductFromCashRegister(e.target.checked)}
                            className="w-4 h-4 mt-0.5 rounded text-primary focus:ring-primary border-border"
                          />
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-foreground block">
                              Deducir automáticamente de la caja activa
                            </span>
                            <p className="text-[11px] text-muted-foreground">
                              Registra un egreso de efectivo en el turno de caja abierto actual para mantener cuadrado el arqueo de caja.
                            </p>
                          </div>
                        </label>
                      </div>

                      {/* Observaciones */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-foreground mb-1">
                          Observaciones <span className="text-muted-foreground font-normal">(Opcional)</span>
                        </label>
                        <textarea
                          rows={2}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Ej: Mercancía recibida en bodega central, lote #4902..."
                          className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ========================================================= */}
                {/* COLUMNA DERECHA (RESUMEN EN VIVO)                         */}
                {/* ========================================================= */}
                <div className="lg:col-span-5 xl:col-span-5 p-5 sm:p-6 bg-muted/10 border-t lg:border-t-0 lg:border-l border-border flex flex-col justify-between overflow-y-auto space-y-6">
                  <div className="space-y-5">
                    {/* Header del Resumen */}
                    <div className="flex items-center justify-between pb-3 border-b border-border">
                      <div className="flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-primary" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Resumen en Vivo
                        </h4>
                      </div>
                      <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>En tiempo real</span>
                      </span>
                    </div>

                    {/* Ficha Informativa del Proveedor y Fecha */}
                    <div className="space-y-2.5 text-xs">
                      {/* Proveedor */}
                      <div className="p-3 rounded-xl bg-card border border-border">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                          Proveedor
                        </span>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs font-bold text-foreground truncate">
                            {selectedSupplierObj ? selectedSupplierObj.name : "Sin proveedor seleccionado"}
                          </span>
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        </div>
                        {selectedSupplierObj?.taxId && (
                          <span className="text-[10px] font-mono text-muted-foreground block mt-0.5">
                            NIT: {selectedSupplierObj.taxId}
                          </span>
                        )}
                      </div>

                      {/* Fecha de Compra */}
                      <div className="p-3 rounded-xl bg-card border border-border">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                          Fecha de Compra
                        </span>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs font-semibold text-foreground">
                            {purchaseDate
                              ? new Date(purchaseDate + "T12:00:00").toLocaleDateString("es-CO", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })
                              : "—"}
                          </span>
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                      </div>

                      {/* Conteo de ítems */}
                      <div className="p-3 rounded-xl bg-card border border-border">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                          Conteo de Ítems
                        </span>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs font-bold text-foreground">
                            {loadedItems.length} {loadedItems.length === 1 ? "artículo" : "artículos"} cargados
                          </span>
                          <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg">
                            {totalUnits} un.
                          </span>
                        </div>
                      </div>

                      {/* Badge de Origen de Fondos */}
                      <div className="p-3 rounded-xl bg-card border border-border">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                          Origen de Fondos
                        </span>
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${fundsOriginBadge.color}`}>
                          <fundsOriginBadge.icon className="w-3.5 h-3.5" />
                          <span>{fundsOriginBadge.label}</span>
                        </div>
                      </div>
                    </div>

                    {/* Desglose Financiero */}
                    <div className="p-4 rounded-xl bg-card border border-border space-y-3">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block border-b border-border pb-1.5">
                        Liquidación de la Compra
                      </span>

                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Subtotal Bruto:</span>
                          <span className="font-mono font-semibold text-foreground">
                            {formatCOP(rawSubtotal)}
                          </span>
                        </div>

                        {parsedGlobalDiscount > 0 && (
                          <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                            <span>Descuento Global:</span>
                            <span className="font-mono font-semibold">
                              -{formatCOP(parsedGlobalDiscount)}
                            </span>
                          </div>
                        )}

                        <div className="flex justify-between text-muted-foreground">
                          <span>Subtotal Neto:</span>
                          <span className="font-mono font-semibold text-foreground">
                            {formatCOP(subtotal)}
                          </span>
                        </div>

                        {activeTaxPercentage > 0 && (
                          <div className="flex justify-between text-muted-foreground">
                            <span>
                              IVA ({activeTaxPercentage}%){ivaIncluded ? " [Incluido]" : ""}:
                            </span>
                            <span className="font-mono font-semibold text-foreground">
                              {ivaIncluded ? formatCOP(taxAmount) : `+${formatCOP(taxAmount)}`}
                            </span>
                          </div>
                        )}

                        {retentionAmount > 0 && (
                          <div className="flex justify-between text-red-500 font-medium">
                            <span>Retención ({retentionPercentage}%):</span>
                            <span className="font-mono font-semibold">
                              -{formatCOP(retentionAmount)}
                            </span>
                          </div>
                        )}

                        {/* Neto a pagar (Destacado) */}
                        <div className="pt-2.5 border-t border-border flex items-baseline justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                            Neto a Pagar:
                          </span>
                          <span className="text-2xl font-black font-mono text-primary">
                            {formatCOP(total)}
                          </span>
                        </div>

                        {paymentType === "credit" && (
                          <div className="pt-2 border-t border-dashed border-border space-y-1">
                            {parseFloat(initialPaymentAmount) > 0 && (
                              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                                <span>Abono inicial inmediato:</span>
                                <span className="font-mono font-semibold">
                                  {formatCOP(parseFloat(initialPaymentAmount))}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between text-rose-600 dark:text-rose-400 font-bold">
                              <span>Saldo por Pagar (CXP):</span>
                              <span className="font-mono">
                                {formatCOP(Math.max(0, total - (parseFloat(initialPaymentAmount) || 0)))}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* BOTONES DE ACCIÓN: 'Registrar compra' y 'Cancelar' */}
                  <div className="pt-4 border-t border-border space-y-2">
                    <button
                      type="submit"
                      disabled={isSubmitting || loadedItems.length === 0 || !supplierId}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Registrando compra...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Registrar compra</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isSubmitting}
                      className="w-full py-2.5 px-4 text-xs font-semibold rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all text-center cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      </ModalPortal>

      {/* MODAL CREAR PROVEEDOR RÁPIDO */}
      <QuickSupplierModal
        businessId={businessId}
        isOpen={isQuickSupplierOpen}
        onClose={() => setIsQuickSupplierOpen(false)}
        onSuccess={(newSupplier) => {
          setSuppliers((prev) => [newSupplier, ...prev]);
          setSupplierId(newSupplier.id);
          if (newSupplier.paymentTermsDays > 0) {
            setCreditDays(String(newSupplier.paymentTermsDays));
          }
        }}
      />

      {/* MODAL GESTIONAR CATEGORÍAS */}
      <CategoryManagerModal
        businessId={businessId}
        categories={categories}
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSuccess={() => {
          refreshCatalogs();
        }}
      />

      {/* MODAL NUEVA TARIFA DE IVA */}
      {isCustomTaxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h4 className="text-xs font-bold text-foreground">Nueva Tarifa de IVA</h4>
              <button
                type="button"
                onClick={() => setIsCustomTaxModalOpen(false)}
                className="p-1 rounded text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Porcentaje de IVA (%) *
                </label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  value={customTaxRate}
                  onChange={(e) => setCustomTaxRate(e.target.value)}
                  placeholder="Ej: 8"
                  inputSize="sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Etiqueta / Descripción
                </label>
                <Input
                  type="text"
                  value={customTaxLabel}
                  onChange={(e) => setCustomTaxLabel(e.target.value)}
                  placeholder="Ej: 8% (Impoconsumo)"
                  inputSize="sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setIsCustomTaxModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddCustomTaxRate}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90"
              >
                Guardar Tarifa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBMODAL RÁPIDO PARA DAR DE ALTA PROVEEDORES */}
      <QuickSupplierModal
        businessId={businessId}
        isOpen={isQuickSupplierOpen}
        initialName={quickSupplierPrefillName}
        onClose={() => setIsQuickSupplierOpen(false)}
        onSuccess={handleSupplierCreated}
      />
    </>
  );
}
