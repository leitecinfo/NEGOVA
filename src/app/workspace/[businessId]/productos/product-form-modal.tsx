"use client";

import React, { useState, useTransition, useRef, useEffect, useMemo } from "react";
import { CustomModal } from "@/components/ui/custom-modal";
import {
  Product,
  Category,
  ProductModifierGroup,
  ProductModifierOption,
  ProductVariant,
  PRODUCT_UNITS,
  ProductUnit,
  getEffectiveVariantIngredients,
  CreateProductSchema,
  isProductAvailableInPos,
  isProductAvailableInQr,
  isProductAvailableOnline,
} from "@/lib/products/types";
import { broadcastProductUpdate } from "@/lib/products/channel-sync";
import {
  createProductAction,
  updateProductAction,
  uploadProductImageAction,
  createCategoryAction,
} from "./actions";
import { toast } from "sonner";
import { formatCOP, formatNumberWithDots, parseNumberFromDots } from "@/lib/pos/types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Trash2,
  Image as ImageIcon,
  Loader2,
  Package,
  Sparkles,
  UploadCloud,
  Clock,
  Barcode,
  UtensilsCrossed,
  Percent,
  Store,
  QrCode,
  Globe,
  ChefHat,
  Camera,
  Layers,
  Copy,
  Check,
  AlertCircle,
  HelpCircle,
  ArrowRightLeft,
  Maximize2,
  ShieldAlert,
} from "lucide-react";
import { BarcodeScannerModal } from "@/components/scanner/barcode-scanner-modal";
import {
  CommercialActivity,
  getDefaultActivitiesForBusinessType,
  hasCommercialActivity,
} from "@/config/commercial-activities";

export const DEFAULT_MODIFIER_TEMPLATES: ProductModifierGroup[] = [
  {
    id: "tpl_adicionales",
    name: "Adiciones y Extras",
    type: "additional",
    required: false,
    min_select: 0,
    max_select: 5,
    options: [
      { id: "opt_tpl_1", name: "Queso mozzarella extra", price: 3500, is_available: true },
      { id: "opt_tpl_2", name: "Tocineta crocante (2 lonjas)", price: 4000, is_available: true },
      { id: "opt_tpl_3", name: "Huevo frito de campo", price: 2500, is_available: true },
      { id: "opt_tpl_4", name: "Champiñones salteados", price: 3500, is_available: true },
      { id: "opt_tpl_5", name: "Aguacate fresco en rodajas", price: 3000, is_available: true },
    ],
  },
  {
    id: "tpl_salsas",
    name: "Salsas de la Casa",
    type: "additional",
    required: false,
    min_select: 0,
    max_select: 3,
    options: [
      { id: "opt_tpl_s1", name: "Salsa de ajo casera", price: 0, is_available: true },
      { id: "opt_tpl_s2", name: "Salsa tártara tradicional", price: 0, is_available: true },
      { id: "opt_tpl_s3", name: "Salsa BBQ ahumada", price: 0, is_available: true },
      { id: "opt_tpl_s4", name: "Mostaza dulce con miel", price: 0, is_available: true },
      { id: "opt_tpl_s5", name: "Salsa picante habanero", price: 500, is_available: true },
    ],
  },
  {
    id: "tpl_tamanos",
    name: "Tamaño / Porción",
    type: "size",
    required: true,
    min_select: 1,
    max_select: 1,
    options: [
      { id: "opt_tpl_t1", name: "Personal (1 persona)", price: 0, is_available: true },
      { id: "opt_tpl_t2", name: "Mediana (2-3 personas)", price: 8000, is_available: true },
      { id: "opt_tpl_t3", name: "Familiar (4-5 personas)", price: 16000, is_available: true },
    ],
  },
  {
    id: "tpl_reemplazos",
    name: "Cambio de Acompañamiento",
    type: "replacement",
    required: false,
    min_select: 0,
    max_select: 1,
    options: [
      { id: "opt_tpl_r1", name: "Papas a la francesa (Estándar)", price: 0, is_available: true },
      { id: "opt_tpl_r2", name: "Cambiar por papas rústicas en casco", price: 2000, is_available: true },
      { id: "opt_tpl_r3", name: "Cambiar por ensalada fresca de la huerta", price: 1500, is_available: true },
      { id: "opt_tpl_r4", name: "Cambiar por aros de cebolla apanados", price: 3000, is_available: true },
      { id: "opt_tpl_r5", name: "Cambiar por yuca frita con hogao", price: 2000, is_available: true },
    ],
  },
  {
    id: "tpl_termino",
    name: "Término de Cocción",
    type: "replacement",
    required: true,
    min_select: 1,
    max_select: 1,
    options: [
      { id: "opt_tpl_tc1", name: "Término medio (Jugoso)", price: 0, is_available: true },
      { id: "opt_tpl_tc2", name: "Tres cuartos (Al punto)", price: 0, is_available: true },
      { id: "opt_tpl_tc3", name: "Bien asada / Bien cocida", price: 0, is_available: true },
    ],
  },
];

interface Props {
  businessId: string;
  businessType?: string;
  commercialActivities?: CommercialActivity[];
  categories: Category[];
  existingProducts?: Product[];
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (product: Product) => void;
  onCategoryCreated?: (newCategory: Category) => void;
  initialCategoryId?: string | null;
}

type FormData = z.input<typeof CreateProductSchema>;

function generateId(prefix: string) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID().substring(0, 8)}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
}

export function ProductFormModal({
  businessId,
  businessType = "restaurant",
  commercialActivities,
  categories,
  existingProducts = [],
  product,
  isOpen,
  onClose,
  onSuccess,
  onCategoryCreated,
  initialCategoryId,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Categorías locales (para reflejar al instante categorías creadas al vuelo)
  const [localCategories, setLocalCategories] = useState<Category[]>(categories);
  const [showQuickCategory, setShowQuickCategory] = useState(false);
  const [quickCategoryName, setQuickCategoryName] = useState("");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  const hierarchicalCategories = useMemo(() => {
    const active = localCategories.filter((c) => c.status === "active");
    const roots = active.filter((c) => !c.parent_category_id);
    const childrenMap = new Map<string, Category[]>();
    for (const c of active) {
      if (c.parent_category_id) {
        const list = childrenMap.get(c.parent_category_id) || [];
        list.push(c);
        childrenMap.set(c.parent_category_id, list);
      }
    }
    const result: { id: string; label: string; isChild: boolean }[] = [];
    for (const r of roots) {
      result.push({ id: r.id, label: r.name, isChild: false });
      const kids = childrenMap.get(r.id) || [];
      for (const k of kids) {
        result.push({ id: k.id, label: `${r.name} › ${k.name}`, isChild: true });
      }
    }
    for (const c of active) {
      if (!result.some((item) => item.id === c.id)) {
        const parent = localCategories.find((p) => p.id === c.parent_category_id);
        result.push({
          id: c.id,
          label: parent ? `${parent.name} › ${c.name}` : c.name,
          isChild: Boolean(c.parent_category_id),
        });
      }
    }
    return result;
  }, [localCategories]);

  // Metadatos existentes
  const existingMeta = (product?.metadata as any) || {};

  // Resolución de actividades comerciales
  const activities =
    commercialActivities && commercialActivities.length > 0
      ? commercialActivities
      : getDefaultActivitiesForBusinessType(businessType);

  const canSellProducts = hasCommercialActivity(activities, "sell_products");
  const canProvideServices = hasCommercialActivity(activities, "provide_services");
  const canManageAppointments = hasCommercialActivity(activities, "manage_appointments") && canProvideServices;
  const isHybrid = canSellProducts && canProvideServices;

  // Detección del tipo de negocio
  const normalizedBizType = (businessType || "").toLowerCase();
  const isFoodBusiness =
    canSellProducts &&
    (normalizedBizType.includes("rest") ||
      normalizedBizType.includes("food") ||
      normalizedBizType.includes("comida") ||
      normalizedBizType.includes("gastronom") ||
      normalizedBizType.includes("cafe") ||
      normalizedBizType.includes("bar") ||
      normalizedBizType.includes("pizz") ||
      normalizedBizType.includes("baker") ||
      normalizedBizType.includes("helad") ||
      normalizedBizType.includes("ice_cream"));

  const isServiceBusiness =
    canProvideServices &&
    (normalizedBizType.includes("serv") ||
      normalizedBizType.includes("barber") ||
      normalizedBizType.includes("belleza") ||
      normalizedBizType.includes("spa") ||
      normalizedBizType.includes("odontol") ||
      normalizedBizType.includes("consult"));

  // Estado del tipo de producto (Producto físico vs Servicio)
  const defaultProductType = !canSellProducts ? "service" : (canProvideServices && isServiceBusiness ? "service" : "product");
  const [productType, setProductType] = useState<"product" | "service">(
    isFoodBusiness || !canProvideServices
      ? "product"
      : !canSellProducts
      ? "service"
      : existingMeta.product_type || (product ? "product" : defaultProductType)
  );

  // Imagen principal y estado de carga
  const [imageUrl, setImageUrl] = useState<string>(product?.image_url || "");
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [imagePreview, setImagePreview] = useState<string | null>(product?.image_url || null);

  // Campos base
  const [sku, setSku] = useState<string>(existingMeta.sku || "");
  const [barcode, setBarcode] = useState<string>(existingMeta.barcode || "");
  const [unit, setUnit] = useState<string>(existingMeta.unit || "unidad");
  const [brand, setBrand] = useState<string>(existingMeta.brand || "");

  // Selector de stock: Limitado vs Ilimitado
  const [stockMode, setStockMode] = useState<"unlimited" | "limited">(
    existingMeta.track_stock ? "limited" : "unlimited"
  );
  const [stockQuantity, setStockQuantity] = useState<number>(existingMeta.stock_quantity ?? 0);
  const [minStock, setMinStock] = useState<number | null>(existingMeta.min_stock ?? null);
  const [maxStock, setMaxStock] = useState<number | null>(existingMeta.max_stock ?? null);
  const [averageCost, setAverageCost] = useState<number>(
    Number(existingMeta.cost ?? existingMeta.average_cost ?? (product as any)?.cost_price ?? 0)
  );

  // Escáner de código de barras
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState<boolean>(false);
  const [barcodeTarget, setBarcodeTarget] = useState<"product" | number | null>(null);

  // Variantes
  const initialVariants: ProductVariant[] = existingMeta.variants || [];
  const [hasVariants, setHasVariants] = useState<boolean>(
    Boolean(existingMeta.has_variants || initialVariants.length > 0)
  );
  const [variants, setVariants] = useState<ProductVariant[]>(initialVariants);
  const [previewVariantId, setPreviewVariantId] = useState<string | null>(
    initialVariants[0]?.id || null
  );

  // Modificadores
  const initialGroups: ProductModifierGroup[] = existingMeta.modifier_groups || [];
  const [modifierGroups, setModifierGroups] = useState<ProductModifierGroup[]>(initialGroups);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false);

  // Impuestos
  const [taxPercentage, setTaxPercentage] = useState<number>(
    existingMeta.tax_percentage !== undefined ? Number(existingMeta.tax_percentage) : 0
  );
  const [taxIncludedInPrice, setTaxIncludedInPrice] = useState<boolean>(
    existingMeta.tax_included_in_price !== undefined ? Boolean(existingMeta.tax_included_in_price) : true
  );

  // Canales de venta
  const [availableInPos, setAvailableInPos] = useState<boolean>(() =>
    product ? isProductAvailableInPos(product) : true
  );
  const [availableInQr, setAvailableInQr] = useState<boolean>(() =>
    product ? isProductAvailableInQr(product) : true
  );
  const [availableOnline, setAvailableOnline] = useState<boolean>(() =>
    product ? isProductAvailableOnline(product) : true
  );

  // Gastronomía adicional
  const [allergensText, setAllergensText] = useState<string>(
    Array.isArray(existingMeta.allergens) ? existingMeta.allergens.join(", ") : ""
  );
  const [ingredients, setIngredients] = useState<string>(existingMeta.ingredients || "");
  const [durationMinutes, setDurationMinutes] = useState<number>(existingMeta.duration_minutes ?? 30);

  // Receta info
  const [recipeInfo, setRecipeInfo] = useState<{
    portionsAvailable: number;
    limitingIngredient?: { name: string; availablePortions: number; displayText?: string } | null;
  } | null>(() => {
    const meta = (product?.metadata as any) || {};
    if (meta.has_recipe || meta.recipe_id) {
      return {
        portionsAvailable: meta.recipe_portions_available ?? 0,
        limitingIngredient: meta.recipe_limiting_ingredient || null,
      };
    }
    return null;
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(CreateProductSchema),
    defaultValues: {
      name: product?.name || "",
      description: product?.description || "",
      image_url: product?.image_url || "",
      price: product?.price || 0,
      category_id: product?.category_id || initialCategoryId || "",
      is_available: product ? product.is_available : true,
      status: product?.status || "active",
      sort_order: product?.sort_order || 0,
      metadata: product?.metadata || {},
    },
  });

  const [priceDisplay, setPriceDisplay] = useState<string>(
    product?.price ? formatNumberWithDots(product.price) : ""
  );

  useEffect(() => {
    if (product) {
      setValue("name", product.name);
      setValue("description", product.description || "");
      setValue("price", product.price);
      setValue("category_id", product.category_id || "");
      setValue("is_available", product.is_available);
      setPriceDisplay(product.price ? formatNumberWithDots(product.price) : "");
      setImageUrl(product.image_url || "");
      setImagePreview(product.image_url || null);

      const meta = (product.metadata as any) || {};
      setSku(meta.sku || "");
      setBarcode(meta.barcode || "");
      setUnit(meta.unit || "unidad");
      setBrand(meta.brand || "");
      setStockMode(meta.track_stock ? "limited" : "unlimited");
      setStockQuantity(meta.stock_quantity ?? 0);
      setMinStock(meta.min_stock ?? null);
      setMaxStock(meta.max_stock ?? null);
      setAverageCost(Number(meta.cost ?? meta.average_cost ?? (product as any)?.cost_price ?? 0));
      setTaxPercentage(meta.tax_percentage !== undefined ? Number(meta.tax_percentage) : 0);
      setTaxIncludedInPrice(meta.tax_included_in_price !== undefined ? Boolean(meta.tax_included_in_price) : true);
      setAvailableInPos(isProductAvailableInPos(product));
      setAvailableInQr(isProductAvailableInQr(product));
      setAvailableOnline(isProductAvailableOnline(product));
      setHasVariants(Boolean(meta.has_variants || (meta.variants && meta.variants.length > 0)));
      setVariants(meta.variants || []);
      setModifierGroups(meta.modifier_groups || []);
      setAllergensText(Array.isArray(meta.allergens) ? meta.allergens.join(", ") : "");
      setIngredients(meta.ingredients || "");
      setDurationMinutes(meta.duration_minutes ?? 30);
      setProductType(
        isFoodBusiness
          ? "product"
          : meta.product_type || (product ? "product" : defaultProductType)
      );
    } else if (initialCategoryId) {
      // Al crear un nuevo producto con categoría inicial, heredar su impuesto por defecto
      const initialCat = localCategories.find((c) => c.id === initialCategoryId);
      if (
        initialCat &&
        initialCat.default_tax_rate !== null &&
        initialCat.default_tax_rate !== undefined
      ) {
        setTaxPercentage(Number(initialCat.default_tax_rate));
      }
    }
  }, [product, isFoodBusiness, defaultProductType, setValue, initialCategoryId, localCategories]);

  const productNameWatch = watch("name");
  const priceWatch = watch("price");

  // Creación rápida de categoría
  const handleQuickCategoryCreate = async () => {
    if (!quickCategoryName.trim()) {
      toast.error("Ingresa el nombre de la categoría.");
      return;
    }

    setIsCreatingCategory(true);
    try {
      const res = await createCategoryAction(businessId, {
        name: quickCategoryName.trim(),
        sort_order: (localCategories.length + 1) * 10,
      });

      if (res.success && res.data) {
        setLocalCategories((prev) => [...prev, res.data!]);
        setValue("category_id", res.data.id);
        if (
          !product &&
          res.data.default_tax_rate !== null &&
          res.data.default_tax_rate !== undefined
        ) {
          setTaxPercentage(Number(res.data.default_tax_rate));
        }
        if (onCategoryCreated) onCategoryCreated(res.data);
        setShowQuickCategory(false);
        setQuickCategoryName("");
        toast.success(`Categoría «${res.data.name}» creada y seleccionada`);
      } else {
        toast.error("Error al crear categoría", { description: res.error });
      }
    } catch (err: any) {
      toast.error("Error al crear categoría", { description: err?.message });
    } finally {
      setIsCreatingCategory(false);
    }
  };

  // Carga de imágenes
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Formato no compatible", {
        description: "Por favor selecciona una imagen JPG, PNG o WEBP.",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Archivo demasiado pesado", {
        description: "La imagen debe pesar un máximo de 5MB.",
      });
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setImagePreview(localUrl);
    setIsUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (imageUrl) {
        formData.append("previousUrl", imageUrl);
      }
      if (product?.id) {
        formData.append("productId", product.id);
      }

      const res = await uploadProductImageAction(businessId, formData);
      if (res.success && res.url) {
        setImageUrl(res.url);
        setImagePreview(res.url);
        toast.success("Fotografía cargada correctamente.");
      } else {
        toast.error("Error al cargar la imagen", {
          description: res.error || "Ocurrió un error al procesar el archivo.",
        });
        setImagePreview(imageUrl || null);
      }
    } catch (err: any) {
      toast.error("Error al cargar la imagen", {
        description: err?.message || "No se pudo completar la carga del archivo.",
      });
      setImagePreview(imageUrl || null);
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveImage = () => {
    setImageUrl("");
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    toast.info("Fotografía removida.");
  };

  // Manejo de Variantes
  const handleAddVariant = () => {
    const newVariant: ProductVariant = {
      id: generateId("var"),
      name: "",
      price: 0,
      sku: "",
      barcode: "",
      cost: 0,
      stock_quantity: stockMode === "limited" ? 0 : null,
      tax_percentage: null, // null hereda el impuesto base del producto
      is_available: true,
      sort_order: variants.length,
      inherit_base_ingredients: true,
      specific_ingredients: "",
    };
    const next = [...variants, newVariant];
    setVariants(next);
    if (!previewVariantId) {
      setPreviewVariantId(newVariant.id);
    }
  };

  const handleRemoveVariant = (index: number) => {
    const next = variants.filter((_, idx) => idx !== index);
    setVariants(next);
    if (previewVariantId && !next.some((v) => v.id === previewVariantId)) {
      setPreviewVariantId(next[0]?.id || null);
    }
  };

  const handleUpdateVariant = (index: number, updates: Partial<ProductVariant>) => {
    setVariants(variants.map((v, idx) => (idx === index ? { ...v, ...updates } : v)));
  };

  // Manejo de Modificadores
  const handleAddGroup = () => {
    const newGroup: ProductModifierGroup = {
      id: generateId("grp"),
      name: "",
      type: "additional",
      required: false,
      min_select: 0,
      max_select: 1,
      options: [
        {
          id: generateId("opt"),
          name: "",
          price: 0,
          is_available: true,
        },
      ],
    };
    setModifierGroups([...modifierGroups, newGroup]);
  };

  const handleRemoveGroup = (index: number) => {
    setModifierGroups(modifierGroups.filter((_, idx) => idx !== index));
  };

  const handleUpdateGroup = (index: number, updates: Partial<ProductModifierGroup>) => {
    setModifierGroups(
      modifierGroups.map((g, idx) => {
        if (idx !== index) return g;
        const next = { ...g, ...updates };
        // Si se marca como obligatorio y min_select es 0, ajustar a 1 por conveniencia
        if (updates.required === true && (!next.min_select || next.min_select < 1)) {
          next.min_select = 1;
        } else if (updates.required === false && next.min_select === 1) {
          next.min_select = 0;
        }
        return next;
      })
    );
  };

  const handleAddOption = (groupIndex: number) => {
    const newOpt: ProductModifierOption = {
      id: generateId("opt"),
      name: "",
      price: 0,
      is_available: true,
    };
    setModifierGroups(
      modifierGroups.map((g, idx) =>
        idx === groupIndex ? { ...g, options: [...g.options, newOpt] } : g
      )
    );
  };

  const handleRemoveOption = (groupIndex: number, optionIndex: number) => {
    setModifierGroups(
      modifierGroups.map((g, idx) =>
        idx === groupIndex
          ? { ...g, options: g.options.filter((_, oIdx) => oIdx !== optionIndex) }
          : g
      )
    );
  };

  const handleUpdateOption = (
    groupIndex: number,
    optionIndex: number,
    updates: Partial<ProductModifierOption>
  ) => {
    setModifierGroups(
      modifierGroups.map((g, gIdx) =>
        gIdx === groupIndex
          ? {
              ...g,
              options: g.options.map((opt, oIdx) =>
                oIdx === optionIndex ? { ...opt, ...updates } : opt
              ),
            }
          : g
      )
    );
  };

  // Modificadores existentes de otros productos para "Asignar existentes"
  const availableExistingGroups = useMemo(() => {
    const list: { group: ProductModifierGroup; sourceProductName: string }[] = [];
    if (existingProducts && existingProducts.length > 0) {
      for (const p of existingProducts) {
        if (product && p.id === product.id) continue;
        const meta = (p.metadata as any) || {};
        const pGroups: ProductModifierGroup[] = meta.modifier_groups || [];
        for (const grp of pGroups) {
          if (grp && grp.name && !list.some((item) => item.group.name.toLowerCase() === grp.name.toLowerCase())) {
            list.push({ group: grp, sourceProductName: p.name });
          }
        }
      }
    }
    return list;
  }, [existingProducts, product]);

  const handleImportModifierGroup = (sourceGroup: ProductModifierGroup) => {
    const cloned: ProductModifierGroup = {
      id: generateId("grp"),
      name: sourceGroup.name,
      type: sourceGroup.type || "additional",
      required: Boolean(sourceGroup.required),
      min_select: sourceGroup.min_select ?? 0,
      max_select: sourceGroup.max_select ?? 1,
      options: (sourceGroup.options || []).map((o) => ({
        id: generateId("opt"),
        name: o.name,
        price: Number(o.price) || 0,
        is_available: o.is_available !== false,
      })),
    };
    setModifierGroups([...modifierGroups, cloned]);
    toast.success(`Grupo «${sourceGroup.name}» asignado al producto.`);
    setIsAssignModalOpen(false);
  };

  // Escaneo de código de barras
  const handleBarcodeScanned = (scanned: string) => {
    if (barcodeTarget === "product") {
      setBarcode(scanned);
      toast.success(`Código de barras capturado: ${scanned}`);
    } else if (typeof barcodeTarget === "number" && barcodeTarget >= 0 && barcodeTarget < variants.length) {
      handleUpdateVariant(barcodeTarget, { barcode: scanned });
      toast.success(
        `Código asignado a variante ${variants[barcodeTarget].name || `#${barcodeTarget + 1}`}: ${scanned}`
      );
    }
    setIsBarcodeScannerOpen(false);
    setBarcodeTarget(null);
  };

  // Submit
  const onSubmit = (data: FormData) => {
    if (hasVariants) {
      if (variants.length === 0) {
        toast.error("Has activado variantes. Debes añadir al menos una variante.");
        return;
      }
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        if (!v.name.trim()) {
          toast.error(`La variante #${i + 1} requiere un nombre (ej. Pequeño, Talla M, etc.).`);
          return;
        }
        if (v.price < 0 || !Number.isFinite(v.price)) {
          toast.error(`El precio de la variante «${v.name}» debe ser un valor válido y no negativo.`);
          return;
        }
      }
    }

    for (let i = 0; i < modifierGroups.length; i++) {
      const grp = modifierGroups[i];
      if (!grp.name.trim()) {
        toast.error(`El grupo de modificadores #${i + 1} requiere un nombre.`);
        return;
      }
      if (grp.min_select !== undefined && grp.max_select !== undefined && grp.min_select > grp.max_select) {
        toast.error(`En el grupo «${grp.name}», la cantidad mínima no puede ser mayor que la máxima.`);
        return;
      }
      for (let j = 0; j < grp.options.length; j++) {
        const opt = grp.options[j];
        if (!opt.name.trim()) {
          toast.error(`La opción #${j + 1} del grupo «${grp.name}» requiere un nombre.`);
          return;
        }
        if (opt.price < 0 || !Number.isFinite(opt.price)) {
          toast.error(`El precio adicional de «${opt.name}» debe ser un número válido.`);
          return;
        }
      }
    }

    startTransition(async () => {
      const cleanedCategoryId = data.category_id === "" ? null : data.category_id;
      const rawAllergens = allergensText
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a.length > 0);

      const seenAllergens = new Set<string>();
      const allergensArray: string[] = [];
      for (const item of rawAllergens) {
        const lower = item.toLowerCase();
        if (!seenAllergens.has(lower)) {
          seenAllergens.add(lower);
          allergensArray.push(item);
        }
      }

      const isTrackingStock = productType === "product" && stockMode === "limited";

      const payloadMetadata = {
        ...existingMeta,
        product_type: isFoodBusiness ? "product" : productType,
        sku: sku.trim() || null,
        barcode: barcode.trim() || null,
        brand: brand.trim() || null,
        unit: unit.trim() || "unidad",
        track_stock: isTrackingStock,
        stock_quantity: isTrackingStock ? stockQuantity : null,
        min_stock: isTrackingStock ? minStock : null,
        max_stock: isTrackingStock ? maxStock : null,
        cost: productType === "product" ? Math.max(0, Number(averageCost) || 0) : 0,
        average_cost: productType === "product" ? Math.max(0, Number(averageCost) || 0) : 0,
        duration_minutes: productType === "service" ? durationMinutes : null,
        tax_percentage: taxPercentage,
        tax_included_in_price: taxIncludedInPrice,
        available_in_pos: availableInPos,
        available_in_qr: availableInQr,
        available_online: availableOnline,
        show_in_qr_menu: availableInQr,
        allergens: allergensArray,
        ingredients: ingredients.trim() || null,
        has_variants: hasVariants,
        variants: hasVariants
          ? variants.map((v, i) => ({
              ...v,
              sort_order: typeof v.sort_order === "number" ? v.sort_order : i,
              name: v.name.trim(),
              price: Math.max(0, Number(v.price) || 0),
              sku: v.sku?.trim() || null,
              barcode: v.barcode?.trim() || null,
              cost: v.cost !== null && v.cost !== undefined ? Math.max(0, Number(v.cost) || 0) : null,
              stock_quantity: isTrackingStock && v.stock_quantity !== null && v.stock_quantity !== undefined
                ? Math.max(0, Number(v.stock_quantity) || 0)
                : null,
              tax_percentage: v.tax_percentage !== null && v.tax_percentage !== undefined ? Number(v.tax_percentage) : null,
              is_available: v.is_available !== false,
            }))
          : [],
        modifier_groups: modifierGroups.map((g) => ({
          ...g,
          type: g.type || "additional",
          name: g.name.trim(),
          required: Boolean(g.required),
          min_select: g.min_select !== undefined ? Math.max(0, Number(g.min_select) || 0) : 0,
          max_select: g.max_select !== undefined ? Math.max(1, Number(g.max_select) || 1) : 1,
          options: g.options.map((opt) => ({
            ...opt,
            name: opt.name.trim(),
            price: Math.max(0, Number(opt.price) || 0),
            is_available: opt.is_available !== false,
          })),
        })),
      };

      let calculatedBasePrice = data.price;
      if (hasVariants && variants.length > 0 && (!calculatedBasePrice || calculatedBasePrice === 0)) {
        calculatedBasePrice = Math.min(...variants.map((v) => v.price));
      }

      const payload = {
        ...data,
        price: calculatedBasePrice,
        tax_percentage: taxPercentage,
        tax_included_in_price: taxIncludedInPrice,
        available_in_pos: availableInPos,
        available_in_qr: availableInQr,
        available_online: availableOnline,
        category_id: cleanedCategoryId,
        image_url: imageUrl.trim() || null,
        metadata: payloadMetadata,
      };

      let res;
      if (product) {
        res = await updateProductAction(businessId, product.id, payload);
      } else {
        res = await createProductAction(businessId, payload);
      }

      if (res.success && res.data) {
        broadcastProductUpdate(businessId, res.data);
        toast.success(product ? "Producto actualizado correctamente" : "Producto creado con éxito");
        if (onSuccess) {
          onSuccess(res.data);
        }
        onClose();
        reset();
      } else {
        toast.error("Error al guardar producto", {
          description: res.error || "Verifica los datos e inténtalo nuevamente.",
        });
      }
    });
  };

  return (
    <>
      <CustomModal
        isOpen={isOpen}
        onClose={onClose}
        title={
          product
            ? isFoodBusiness
              ? "Editar Producto"
              : productType === "service"
              ? "Editar Servicio"
              : "Editar Producto"
            : isFoodBusiness
            ? "Nuevo Producto"
            : productType === "service"
            ? "Nuevo Servicio"
            : "Nuevo Producto"
        }
        description="Configura los datos del producto, unidades, control de stock, variantes y modificadores de personalización."
        showConfirmButton={false}
        maxWidth="5xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-1 max-h-[82vh] overflow-y-auto px-2 py-1">
          {/* Selector de Tipo si el negocio es híbrido (Producto Físico vs Servicio) */}
          {isHybrid && (
            <div className="flex items-center gap-3 p-1.5 bg-slate-100 dark:bg-white/[0.04] rounded-2xl border border-slate-200 dark:border-white/[0.08] w-full sm:w-fit">
              <button
                type="button"
                onClick={() => setProductType("product")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  productType === "product"
                    ? "bg-white dark:bg-[#0D0F16] text-[#ED500A] shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Package className="w-4 h-4" />
                <span>Producto Físico</span>
              </button>

              <button
                type="button"
                onClick={() => setProductType("service")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  productType === "service"
                    ? "bg-white dark:bg-[#0D0F16] text-[#ED500A] shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Servicio</span>
              </button>
            </div>
          )}

          {/* GRID PRINCIPAL: 2 Columnas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* ======================================================== */}
            {/* COLUMNA IZQUIERDA: Campos Base, Stock, Precios y Variantes */}
            {/* ======================================================== */}
            <div className="space-y-5">
              {/* SECCIÓN 1: CAMPOS BASE */}
              <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-2xl space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#ED500A]" />
                  <span>Información Base</span>
                </span>

                {/* Nombre */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Nombre del {productType === "service" ? "servicio" : "producto"} *
                  </label>
                  <input
                    {...register("name")}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ED500A]/50 transition-all font-medium"
                    placeholder={
                      productType === "service"
                        ? "Ej. Corte de cabello degradado, Asesoría contable..."
                        : isFoodBusiness
                        ? "Ej. Hamburguesa Doble Carne, Salchipapa Especial..."
                        : "Ej. Camiseta Polo Algodón, Pintura Acrílica 1 Gal..."
                    }
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                </div>

                {/* Descripción */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Descripción comercial
                  </label>
                  <textarea
                    {...register("description")}
                    rows={2}
                    className="w-full px-3.5 py-2 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ED500A]/50 resize-none transition-all"
                    placeholder="Detalles, porciones, beneficios o preparación..."
                  />
                </div>

                {/* Unidad de Medida y Categoría */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Unidad de Medida */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Unidad de Medida
                    </label>
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#ED500A]/50 transition-all"
                    >
                      {PRODUCT_UNITS.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                      {/* En caso de que tenga un valor personalizado antiguo */}
                      {!PRODUCT_UNITS.some((u) => u.value === unit) && unit && (
                        <option value={unit}>{unit}</option>
                      )}
                    </select>
                  </div>

                  {/* Categoría */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Categoría
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowQuickCategory(!showQuickCategory)}
                        className="text-[11px] text-[#ED500A] hover:underline font-semibold flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>+ Nueva</span>
                      </button>
                    </div>

                    {showQuickCategory ? (
                      <div className="p-2 bg-white dark:bg-[#0D0F16] border border-[#ED500A]/40 rounded-xl space-y-2 animate-in fade-in duration-100">
                        <input
                          type="text"
                          value={quickCategoryName}
                          onChange={(e) => setQuickCategoryName(e.target.value)}
                          placeholder="Nombre de categoría..."
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-lg text-xs"
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleQuickCategoryCreate())}
                        />
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setShowQuickCategory(false)}
                            className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-700"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={handleQuickCategoryCreate}
                            disabled={isCreatingCategory || !quickCategoryName.trim()}
                            className="px-2.5 py-1 bg-[#ED500A] text-white rounded text-[11px] font-semibold hover:bg-[#ED500A]/90 disabled:opacity-50"
                          >
                            {isCreatingCategory ? "Creando..." : "Crear"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <select
                        {...register("category_id")}
                        onChange={(e) => {
                          const catId = e.target.value;
                          register("category_id").onChange(e);
                          if (!product && catId) {
                            const foundCat = localCategories.find((c) => c.id === catId);
                            if (
                              foundCat &&
                              foundCat.default_tax_rate !== null &&
                              foundCat.default_tax_rate !== undefined
                            ) {
                              setTaxPercentage(Number(foundCat.default_tax_rate));
                            }
                          }
                        }}
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#ED500A]/50 transition-all truncate"
                      >
                        <option value="">Sin categoría asignada</option>
                        {hierarchicalCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* SKU y Código de Barras Base */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Código SKU
                    </label>
                    <input
                      type="text"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      placeholder="Ej. REF-001"
                      className="w-full px-3 py-2 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#ED500A]/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Código de Barras
                    </label>
                    <div className="flex gap-1.5">
                      <div className="relative flex-1">
                        <Barcode className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={barcode}
                          onChange={(e) => setBarcode(e.target.value)}
                          placeholder="770... o escanear"
                          className="w-full pl-8 pr-2.5 py-2 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#ED500A]/50"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setBarcodeTarget("product");
                          setIsBarcodeScannerOpen(true);
                        }}
                        className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 rounded-xl text-xs flex items-center gap-1 border border-slate-200 dark:border-white/[0.08] transition-colors cursor-pointer shrink-0"
                        title="Escanear con cámara"
                      >
                        <Camera className="w-3.5 h-3.5 text-[#ED500A]" />
                        <span className="hidden sm:inline">Escanear</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Canales de Venta (POS, Menú QR, Tienda Online) */}
                <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                    Canales de Venta Habilitados
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setAvailableInPos(!availableInPos)}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
                        availableInPos
                          ? "bg-[#ED500A]/10 border-[#ED500A]/50 text-[#ED500A] font-bold shadow-2xs"
                          : "bg-white dark:bg-[#0D0F16] border-slate-200 dark:border-white/[0.08] text-slate-400"
                      }`}
                    >
                      <Store className="w-4 h-4 mb-0.5" />
                      <span className="text-[11px] leading-tight">POS / Caja</span>
                      <span className="text-[9px] opacity-80">{availableInPos ? "Activo" : "Oculto"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAvailableInQr(!availableInQr)}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
                        availableInQr
                          ? "bg-[#ED500A]/10 border-[#ED500A]/50 text-[#ED500A] font-bold shadow-2xs"
                          : "bg-white dark:bg-[#0D0F16] border-slate-200 dark:border-white/[0.08] text-slate-400"
                      }`}
                    >
                      <QrCode className="w-4 h-4 mb-0.5" />
                      <span className="text-[11px] leading-tight">Menú QR</span>
                      <span className="text-[9px] opacity-80">{availableInQr ? "Activo" : "Oculto"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAvailableOnline(!availableOnline)}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
                        availableOnline
                          ? "bg-[#ED500A]/10 border-[#ED500A]/50 text-[#ED500A] font-bold shadow-2xs"
                          : "bg-white dark:bg-[#0D0F16] border-slate-200 dark:border-white/[0.08] text-slate-400"
                      }`}
                    >
                      <Globe className="w-4 h-4 mb-0.5" />
                      <span className="text-[11px] leading-tight">Tienda Online</span>
                      <span className="text-[9px] opacity-80">{availableOnline ? "Activo" : "Oculto"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* SECCIÓN 2: SELECTOR DE STOCK (LIMITADO VS ILIMITADO) */}
              {productType === "product" && (
                <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#ED500A]" />
                      <span>Gestión de Stock e Inventario</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        stockMode === "limited"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      }`}
                    >
                      {stockMode === "limited" ? "Stock Limitado" : "Stock Ilimitado"}
                    </span>
                  </div>

                  {/* Selector Visual Limitado vs Ilimitado */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setStockMode("unlimited")}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        stockMode === "unlimited"
                          ? "bg-[#ED500A]/10 border-[#ED500A] text-slate-900 dark:text-white shadow-2xs"
                          : "bg-white dark:bg-[#0D0F16] border-slate-200 dark:border-white/[0.08] text-slate-500 hover:border-[#ED500A]/30"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold">Stock Ilimitado</span>
                        <div
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                            stockMode === "unlimited"
                              ? "border-[#ED500A] bg-[#ED500A]"
                              : "border-slate-300 dark:border-white/20"
                          }`}
                        >
                          {stockMode === "unlimited" && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        Venta continua sin control físico de unidades (platos preparados al momento, bajo demanda).
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStockMode("limited")}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        stockMode === "limited"
                          ? "bg-[#ED500A]/10 border-[#ED500A] text-slate-900 dark:text-white shadow-2xs"
                          : "bg-white dark:bg-[#0D0F16] border-slate-200 dark:border-white/[0.08] text-slate-500 hover:border-[#ED500A]/30"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold">Stock Limitado</span>
                        <div
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                            stockMode === "limited"
                              ? "border-[#ED500A] bg-[#ED500A]"
                              : "border-slate-300 dark:border-white/20"
                          }`}
                        >
                          {stockMode === "limited" && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        Control físico estricto de existencias con alertas de stock mínimo y reposición.
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {/* SECCIÓN 3: CASILLA 'TIENE VARIANTES' */}
              <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#ED500A]" />
                      <span>¿Tiene variantes o presentaciones?</span>
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Activa si se vende en varios tamaños, colores o referencias con precios independientes.
                    </p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={hasVariants}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setHasVariants(checked);
                        if (checked && variants.length === 0) {
                          handleAddVariant();
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#ED500A]"></div>
                  </label>
                </div>

                {/* CASO A: NO TIENE VARIANTES -> PRECIOS Y STOCK BASE */}
                {!hasVariants ? (
                  <div className="space-y-3.5 pt-3 border-t border-slate-200/60 dark:border-white/5 animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Precio de Venta Base */}
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                          Precio de Venta (COP) *
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
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
                              setValue("price", raw, { shouldValidate: true });
                            }}
                            className="w-full pl-8 pr-3.5 py-2.5 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/50 transition-all"
                            placeholder="0"
                          />
                        </div>
                        {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price.message}</p>}
                      </div>

                      {/* Costo del Producto */}
                      {productType === "product" && (
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                            Costo de Adquisición (COP)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
                              $
                            </span>
                            <input
                              type="number"
                              min="0"
                              value={averageCost || ""}
                              onChange={(e) => setAverageCost(Math.max(0, parseFloat(e.target.value) || 0))}
                              placeholder="0"
                              className="w-full pl-8 pr-3.5 py-2.5 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#ED500A]/50"
                            />
                          </div>
                          {Number(priceWatch) > 0 && averageCost > 0 && (
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
                              Margen estimado:{" "}
                              {(((Number(priceWatch) - averageCost) / Number(priceWatch)) * 100).toFixed(1)}%
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Si es de Stock Limitado: Stock Inicial, Mínimo y Máximo */}
                    {productType === "product" && stockMode === "limited" && (
                      <div className="p-3.5 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl space-y-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                          Niveles de Stock Físico
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                              Stock Inicial *
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={stockQuantity}
                              onChange={(e) => setStockQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))}
                              placeholder="0"
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-[#ED500A]"
                            />
                            <p className="text-[10px] text-slate-400 mt-0.5">Unidades disponibles</p>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                              Stock Mínimo
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={minStock ?? ""}
                              onChange={(e) => {
                                const v = e.target.value.trim();
                                setMinStock(v === "" ? null : Math.max(0, parseInt(v, 10) || 0));
                              }}
                              placeholder="Opcional"
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-[#ED500A]"
                            />
                            <p className="text-[10px] text-slate-400 mt-0.5">Alerta de reposición</p>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                              Stock Máximo
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={maxStock ?? ""}
                              onChange={(e) => {
                                const v = e.target.value.trim();
                                setMaxStock(v === "" ? null : Math.max(0, parseInt(v, 10) || 0));
                              }}
                              placeholder="Opcional"
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-[#ED500A]"
                            />
                            <p className="text-[10px] text-slate-400 mt-0.5">Capacidad máxima</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* CASO B: SÍ TIENE VARIANTES -> SECCIÓN DINÁMICA DE VARIANTES */
                  <div className="space-y-4 pt-3 border-t border-slate-200/60 dark:border-white/5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Cada variante tiene su propio nombre, SKU, código de barras, costo, precio, stock e impuestos.
                      </p>
                      <button
                        type="button"
                        onClick={handleAddVariant}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#ED500A]/10 text-[#ED500A] hover:bg-[#ED500A]/20 rounded-xl text-xs font-bold transition-colors shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Añadir variante</span>
                      </button>
                    </div>

                    {variants.length === 0 ? (
                      <div className="text-center py-5 text-xs text-slate-400 border border-dashed rounded-xl">
                        No has añadido ninguna variante. Haz clic en "Añadir variante" para comenzar.
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        {variants.map((v, vIdx) => (
                          <div
                            key={v.id || vIdx}
                            className="p-3.5 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl space-y-3 shadow-2xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                Presentación #{vIdx + 1}
                              </span>
                              <div className="flex items-center gap-2">
                                <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={v.is_available}
                                    onChange={(e) =>
                                      handleUpdateVariant(vIdx, { is_available: e.target.checked })
                                    }
                                    className="w-3.5 h-3.5 text-[#ED500A] rounded border-slate-300 focus:ring-[#ED500A]"
                                  />
                                  <span>Disponible</span>
                                </label>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveVariant(vIdx)}
                                  className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                                  title="Eliminar variante"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Nombre, SKU y Código de Barras */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                  Nombre *
                                </label>
                                <input
                                  type="text"
                                  value={v.name}
                                  onChange={(e) => handleUpdateVariant(vIdx, { name: e.target.value })}
                                  placeholder="Ej. Pequeño, Mediano, Talla L..."
                                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-lg text-xs font-semibold focus:ring-1 focus:ring-[#ED500A]"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                  SKU
                                </label>
                                <input
                                  type="text"
                                  value={v.sku || ""}
                                  onChange={(e) => handleUpdateVariant(vIdx, { sku: e.target.value })}
                                  placeholder="REF-MED"
                                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-lg text-xs font-mono focus:ring-1 focus:ring-[#ED500A]"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                  Código de Barras
                                </label>
                                <div className="flex gap-1">
                                  <input
                                    type="text"
                                    value={v.barcode || ""}
                                    onChange={(e) => handleUpdateVariant(vIdx, { barcode: e.target.value })}
                                    placeholder="770..."
                                    className="flex-1 px-2.5 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-lg text-xs font-mono focus:ring-1 focus:ring-[#ED500A]"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setBarcodeTarget(vIdx);
                                      setIsBarcodeScannerOpen(true);
                                    }}
                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 rounded-lg text-slate-600 dark:text-slate-300"
                                    title="Escanear código para esta variante"
                                  >
                                    <Camera className="w-3.5 h-3.5 text-[#ED500A]" />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Costo, Precio de Venta, Stock Inicial e Impuestos */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                  Costo (COP)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={v.cost ?? ""}
                                  onChange={(e) =>
                                    handleUpdateVariant(vIdx, {
                                      cost: e.target.value === "" ? null : Math.max(0, parseFloat(e.target.value) || 0),
                                    })
                                  }
                                  placeholder="0"
                                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-lg text-xs font-mono focus:ring-1 focus:ring-[#ED500A]"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                  Precio Venta *
                                </label>
                                <div className="relative">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                                    $
                                  </span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={v.price ? formatNumberWithDots(v.price) : ""}
                                    onChange={(e) =>
                                      handleUpdateVariant(vIdx, {
                                        price: parseNumberFromDots(e.target.value),
                                      })
                                    }
                                    placeholder="0"
                                    className="w-full pl-5 pr-2 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-lg text-xs font-bold text-slate-900 dark:text-white focus:ring-1 focus:ring-[#ED500A]"
                                  />
                                </div>
                              </div>

                              {stockMode === "limited" ? (
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                    Stock Inicial
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={v.stock_quantity ?? ""}
                                    onChange={(e) =>
                                      handleUpdateVariant(vIdx, {
                                        stock_quantity:
                                          e.target.value === "" ? null : Math.max(0, parseInt(e.target.value, 10) || 0),
                                      })
                                    }
                                    placeholder="0"
                                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-[#ED500A]"
                                  />
                                </div>
                              ) : (
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                    Stock
                                  </label>
                                  <div className="px-2 py-1.5 bg-slate-50 dark:bg-white/5 rounded-lg text-[11px] text-slate-400 italic">
                                    Ilimitado
                                  </div>
                                </div>
                              )}

                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                  Impuesto
                                </label>
                                <select
                                  value={v.tax_percentage !== null && v.tax_percentage !== undefined ? v.tax_percentage : ""}
                                  onChange={(e) =>
                                    handleUpdateVariant(vIdx, {
                                      tax_percentage: e.target.value === "" ? null : Number(e.target.value),
                                    })
                                  }
                                  className="w-full px-2 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-lg text-xs font-medium focus:ring-1 focus:ring-[#ED500A]"
                                >
                                  <option value="">Heredar ({taxPercentage}%)</option>
                                  <option value="0">0% Exento</option>
                                  <option value="5">5% Especial</option>
                                  <option value="8">8% Impoconsumo</option>
                                  <option value="19">19% General</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SECCIÓN IMPUESTOS GENERALES */}
              <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-2xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Percent className="w-4 h-4 text-[#ED500A]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Configuración de Impuestos (IVA / Impoconsumo)
                    </span>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-white/10 text-slate-700 dark:text-slate-200">
                    {taxPercentage}%
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: "0% (Exento)", value: 0 },
                    { label: "5% (Especial)", value: 5 },
                    { label: "8% (Impoconsumo)", value: 8 },
                    { label: "19% (General)", value: 19 },
                  ].map((preset) => {
                    const isSelected = taxPercentage === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setTaxPercentage(preset.value)}
                        className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all text-center ${
                          isSelected
                            ? "bg-[#ED500A] border-[#ED500A] text-white shadow-sm"
                            : "bg-white dark:bg-[#0D0F16] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:border-[#ED500A]/40"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      ¿El precio de venta incluye impuestos?
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {taxIncludedInPrice
                        ? "Sí: El cliente paga el precio fijado. El impuesto se desglosa internamente."
                        : "No: El impuesto se sumará al subtotal durante el cobro en el POS."}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={taxIncludedInPrice}
                      onChange={(e) => setTaxIncludedInPrice(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#ED500A]"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* ======================================================== */}
            {/* COLUMNA DERECHA: Imagen, Modificadores y Vista Previa */}
            {/* ======================================================== */}
            <div className="space-y-5">
              {/* SECCIÓN CARGA DE FOTOGRAFÍA */}
              <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-[#ED500A]" />
                    <span>Fotografía del Producto</span>
                  </span>
                  {imagePreview && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar foto</span>
                    </button>
                  )}
                </div>

                <div className="relative border-2 border-dashed border-slate-200 dark:border-white/15 rounded-2xl p-4 bg-white dark:bg-[#0D0F16] transition-colors hover:border-[#ED500A]/50 text-center">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                  />

                  {imagePreview ? (
                    <div className="space-y-3">
                      <div className="relative w-full h-40 rounded-xl overflow-hidden bg-slate-100 dark:bg-black/20 border border-slate-200/50 dark:border-white/[0.08] group">
                        <img
                          src={imagePreview}
                          alt="Vista previa"
                          className="w-full h-full object-cover"
                        />
                        {isUploadingImage && (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2">
                            <Loader2 className="w-6 h-6 animate-spin text-[#ED500A]" />
                            <span className="text-xs font-medium">Subiendo fotografía...</span>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingImage}
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all shadow-2xs"
                      >
                        <UploadCloud className="w-3.5 h-3.5 text-[#ED500A]" />
                        <span>Cambiar fotografía</span>
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="py-6 px-4 flex flex-col items-center justify-center cursor-pointer group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                        {isUploadingImage ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          <UploadCloud className="w-6 h-6" />
                        )}
                      </div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {isUploadingImage ? "Subiendo fotografía..." : "Haz clic para subir fotografía"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Formatos JPG, PNG o WEBP (máx. 5MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* SECCIÓN MODIFICADORES (PERSONALIZACIÓN DE PRODUCTO) */}
              <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-2xl space-y-4">
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200/60 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4 text-[#ED500A]" />
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        Modificadores y Personalización
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {modifierGroups.length}{" "}
                        {modifierGroups.length === 1 ? "grupo configurado" : "grupos configurados"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAssignModalOpen(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-200/80 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
                      title="Copiar modificadores de otros productos o plantillas"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#ED500A]" />
                      <span className="hidden sm:inline">Asignar existentes</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleAddGroup}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Crear nuevo grupo</span>
                    </button>
                  </div>
                </div>

                {/* Lista de Grupos de Modificadores */}
                {modifierGroups.length === 0 ? (
                  <div className="p-4 text-center bg-white dark:bg-[#0D0F16] border border-dashed border-slate-200 dark:border-white/[0.08] rounded-xl space-y-1">
                    <p className="text-xs text-slate-500 font-medium">
                      Sin modificadores configurados.
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Usa <strong>"Crear nuevo grupo"</strong> o <strong>"Asignar existentes"</strong> para agregar adiciones, tamaños o reemplazos.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {modifierGroups.map((group, gIdx) => (
                      <div
                        key={group.id || gIdx}
                        className="p-3.5 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl space-y-3 shadow-2xs"
                      >
                        {/* Fila 1: Nombre del grupo, Tipo y Eliminar */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                Nombre del grupo *
                              </label>
                              <input
                                type="text"
                                value={group.name}
                                onChange={(e) => handleUpdateGroup(gIdx, { name: e.target.value })}
                                placeholder="Ej. Toppings extra, Salsas, Guarnición..."
                                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-lg text-xs font-semibold focus:ring-1 focus:ring-[#ED500A]"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                Tipo de modificador
                              </label>
                              <select
                                value={group.type || "additional"}
                                onChange={(e) =>
                                  handleUpdateGroup(gIdx, {
                                    type: e.target.value as "additional" | "size" | "replacement",
                                  })
                                }
                                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-lg text-xs font-semibold focus:ring-1 focus:ring-[#ED500A]"
                              >
                                <option value="additional">Adicional (Extra queso, tocineta...)</option>
                                <option value="size">Tamaño (Pequeño, Mediano, Grande...)</option>
                                <option value="replacement">Reemplazo (Sustituir acompañamiento...)</option>
                              </select>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveGroup(gIdx)}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors mt-5"
                            title="Eliminar grupo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Fila 2: Casilla Obligatorio y Cantidad Máxima */}
                        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200/50 dark:border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                            <input
                              type="checkbox"
                              checked={Boolean(group.required)}
                              onChange={(e) => handleUpdateGroup(gIdx, { required: e.target.checked })}
                              className="w-4 h-4 text-[#ED500A] rounded border-slate-300 focus:ring-[#ED500A]"
                            />
                            <span>Obligatorio / Requerido para venta</span>
                          </label>

                          <div className="flex items-center gap-2">
                            <label className="text-[11px] text-slate-500">Cantidad máxima:</label>
                            <input
                              type="number"
                              min="1"
                              value={group.max_select ?? 1}
                              onChange={(e) =>
                                handleUpdateGroup(gIdx, {
                                  max_select: Math.max(1, parseInt(e.target.value, 10) || 1),
                                })
                              }
                              className="w-14 px-2 py-1 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded text-xs font-mono font-bold text-center focus:ring-1 focus:ring-[#ED500A]"
                            />
                          </div>
                        </div>

                        {/* Fila 3: Opciones del Grupo */}
                        <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-white/5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase text-slate-400">
                              Opciones del grupo ({group.options.length})
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAddOption(gIdx)}
                              className="text-[11px] text-[#ED500A] hover:underline font-semibold flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Añadir opción</span>
                            </button>
                          </div>

                          <div className="space-y-1.5">
                            {group.options.map((opt, oIdx) => (
                              <div
                                key={opt.id || oIdx}
                                className="flex items-center gap-2 p-1.5 bg-slate-50 dark:bg-white/[0.03] rounded-lg border border-slate-200/50 dark:border-white/5"
                              >
                                <input
                                  type="text"
                                  value={opt.name}
                                  onChange={(e) =>
                                    handleUpdateOption(gIdx, oIdx, { name: e.target.value })
                                  }
                                  placeholder="Nombre (ej. Queso cheddar)"
                                  className="flex-1 px-2.5 py-1 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded text-xs font-medium focus:ring-1 focus:ring-[#ED500A]"
                                />

                                <div className="w-24 relative">
                                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-semibold">
                                    +$
                                  </span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={opt.price ? formatNumberWithDots(opt.price) : ""}
                                    onChange={(e) =>
                                      handleUpdateOption(gIdx, oIdx, {
                                        price: parseNumberFromDots(e.target.value),
                                      })
                                    }
                                    placeholder="0"
                                    className="w-full pl-5 pr-1.5 py-1 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded text-xs font-mono font-semibold"
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveOption(gIdx, oIdx)}
                                  className="p-1 text-slate-400 hover:text-red-500 rounded"
                                  title="Eliminar opción"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECCIÓN VISTA PREVIA INTERACTIVA */}
              <div className="p-4 bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#ED500A]" />
                    <span>Vista previa interactiva en Catálogo / POS</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">En vivo</span>
                </div>

                <div className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl p-3.5 space-y-3 shadow-2xs">
                  <div className="flex items-start gap-3">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Vista previa"
                        className="w-14 h-14 rounded-lg object-cover border border-slate-200 dark:border-white/[0.08] shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center shrink-0">
                        <Package className="w-6 h-6" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h5 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {productNameWatch || "Nombre del producto"}
                        </h5>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase shrink-0 ${
                            stockMode === "limited"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {stockMode === "limited" ? "Stock Limitado" : "Ilimitado"}
                        </span>
                      </div>

                      <p className="text-xs font-extrabold text-[#ED500A] mt-0.5">
                        {hasVariants && variants.length > 0
                          ? (() => {
                              const activeVar = variants.find((v) => v.id === previewVariantId) || variants[0];
                              return `${activeVar?.name || "Variante"}: ${formatCOP(Number(activeVar?.price || 0))}`;
                            })()
                          : formatCOP(Number(priceWatch || 0))}
                      </p>
                    </div>
                  </div>

                  {/* Variantes en vista previa */}
                  {hasVariants && variants.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-white/5">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase">
                        Presentación activa:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {variants.map((v) => {
                          const isSelected = (previewVariantId || variants[0]?.id) === v.id;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => setPreviewVariantId(v.id)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                                isSelected
                                  ? "bg-[#ED500A] text-white shadow-xs"
                                  : "bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                              }`}
                            >
                              {v.name || "Sin nombre"} ({formatCOP(Number(v.price || 0))})
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Modificadores en vista previa */}
                  {modifierGroups.length > 0 && (
                    <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-white/5">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase">
                        Modificadores disponibles:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {modifierGroups.map((g, idx) => (
                          <span
                            key={g.id || idx}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              g.required
                                ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                                : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300"
                            }`}
                          >
                            {g.name || "Sin nombre"}{" "}
                            {g.required && "*"} ({g.options.length} opciones)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/5">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending || isUploadingImage}
              className="px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending || isUploadingImage}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#ED500A] hover:bg-[#ED500A]/90 rounded-xl transition-all shadow-sm disabled:opacity-50"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isPending ? "Guardando..." : "Guardar Producto"}</span>
            </button>
          </div>
        </form>

        {/* Modal de Escáner de Código de Barras */}
        <BarcodeScannerModal
          isOpen={isBarcodeScannerOpen}
          onClose={() => {
            setIsBarcodeScannerOpen(false);
            setBarcodeTarget(null);
          }}
          onScan={handleBarcodeScanned}
          title={
            barcodeTarget === "product"
              ? "Escanear Código de Barras del Producto"
              : typeof barcodeTarget === "number" && variants[barcodeTarget]
              ? `Escanear Código para ${variants[barcodeTarget].name || `Variante #${barcodeTarget + 1}`}`
              : "Escanear Código de Barras"
          }
        />

        {/* Modal para 'Asignar Modificadores Existentes' */}
        {isAssignModalOpen && (
          <CustomModal
            isOpen={isAssignModalOpen}
            onClose={() => setIsAssignModalOpen(false)}
            title="Asignar Modificadores Existentes"
            description="Selecciona un grupo ya configurado en otro producto o una plantilla estándar para añadirlo a este producto."
            showConfirmButton={false}
            maxWidth="2xl"
          >
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Plantillas recomendadas */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  Plantillas estándar recomendadas
                </span>
                <div className="space-y-2">
                  {DEFAULT_MODIFIER_TEMPLATES.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="p-3 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl flex items-center justify-between gap-3 shadow-2xs hover:border-[#ED500A]/40 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {tpl.name}
                          </h5>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                            {tpl.type === "additional"
                              ? "Adicional"
                              : tpl.type === "size"
                              ? "Tamaño"
                              : "Reemplazo"}
                          </span>
                          {tpl.required && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-red-500/10 text-red-600">
                              Requerido
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {tpl.options.map((o) => o.name).join(", ")}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleImportModifierGroup(tpl)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#ED500A]/10 text-[#ED500A] hover:bg-[#ED500A] hover:text-white rounded-xl text-xs font-bold transition-all shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Añadir</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modificadores de otros productos del catálogo */}
              {availableExistingGroups.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/10">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                    Modificadores de otros productos de tu catálogo ({availableExistingGroups.length})
                  </span>
                  <div className="space-y-2">
                    {availableExistingGroups.map(({ group: grp, sourceProductName }, idx) => (
                      <div
                        key={grp.id || idx}
                        className="p-3 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl flex items-center justify-between gap-3 shadow-2xs hover:border-[#ED500A]/40 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {grp.name}
                            </h5>
                            <span className="text-[10px] text-slate-400">
                              (de: {sourceProductName})
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {grp.options?.map((o) => o.name).join(", ") || "Sin opciones"}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleImportModifierGroup(grp)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#ED500A]/10 text-[#ED500A] hover:bg-[#ED500A] hover:text-white rounded-xl text-xs font-bold transition-all shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Copiar</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </CustomModal>
        )}
      </CustomModal>
    </>
  );
}
