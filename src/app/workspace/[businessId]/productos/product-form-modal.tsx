"use client";

import React, { useState, useTransition, useRef, useEffect, useMemo } from "react";
import { CustomModal } from "@/components/ui/custom-modal";
import { Input, Select } from "@/components/ui";
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
  ProductKind,
  ProductVerticalContext,
  resolveProductVerticalContext,
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
  SlidersHorizontal,
  Percent,
  Store,
  QrCode,
  Globe,
  Camera,
  Layers,
  Copy,
  Check,
  AlertCircle,
  HelpCircle,
  ArrowRightLeft,
  Maximize2,
  ShieldAlert,
  Link2,
  Star,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Tag,
  Pencil,
} from "lucide-react";
import { BarcodeScannerModal } from "@/components/scanner/barcode-scanner-modal";
import {
  CommercialActivity,
  getDefaultActivitiesForBusinessType,
  hasCommercialActivity,
} from "@/config/commercial-activities";
import { getModifierGroupsAction, createModifierGroupAction,
  updateModifierGroupAction, syncProductModifierGroupLinksAction } from "./modifiers-actions";
import { ModifierGroup, CreateModifierGroupInput } from "@/lib/modifiers/types";
import { SingleModifierModal } from "@/components/products/modifiers/single-modifier-modal";
import { ModifierGroupModal } from "@/components/products/modifiers/modifier-group-modal";

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

  // Contexto base del vertical (para determinar comportamiento predeterminado del sector)
  const baseVerticalCtx = useMemo<ProductVerticalContext>(
    () => resolveProductVerticalContext(businessType, commercialActivities),
    [businessType, commercialActivities]
  );

  // Clasificación funcional: "stock" (con existencias) | "prepared" (elaborado) | "service" (servicio / sin stock)
  const initialProductKind: ProductKind = useMemo(() => {
    if (existingMeta.product_type === "service") return "service";
    if (existingMeta.track_stock === true) return "stock";
    if (existingMeta.has_recipe || existingMeta.recipe_id) return "prepared";
    // Si no tiene receta ni es servicio:
    // Para gastronomía, los platos de cocina se elaboran al momento ("prepared")
    if (baseVerticalCtx.isGastronomy) {
      return "prepared";
    }
    // Para comercio/servicios/retail: productos físicos por defecto son con existencias ("stock")
    return "stock";
  }, [existingMeta, baseVerticalCtx.isGastronomy]);

  // Contexto del vertical de negocio: define qué modalidades y canales están realmente implementados y permitidos
  const verticalCtx = useMemo<ProductVerticalContext>(
    () => resolveProductVerticalContext(businessType, commercialActivities, product ? initialProductKind : null),
    [businessType, commercialActivities, product, initialProductKind]
  );

  // Modalidad inicial segura acorde al vertical
  const defaultKindForVertical: ProductKind = useMemo(() => {
    if (product) {
      return initialProductKind;
    }
    // Para nuevos productos:
    if (verticalCtx.availableKinds.includes("stock") && !verticalCtx.isGastronomy) {
      return "stock";
    }
    if (verticalCtx.isGastronomy && verticalCtx.availableKinds.includes("prepared")) {
      return "prepared";
    }
    return verticalCtx.availableKinds[0] || "stock";
  }, [verticalCtx, product, initialProductKind]);

  const [productKind, setProductKind] = useState<ProductKind>(defaultKindForVertical);
  const [productType, setProductType] = useState<"product" | "service">(
    defaultKindForVertical === "service" ? "service" : "product"
  );

  // Fotografías del producto (máximo 3 imágenes: 1 principal + 2 adicionales)
  const initialImages: string[] = useMemo(() => {
    const list: string[] = [];
    if (product?.image_url) list.push(product.image_url);
    const gallery = Array.isArray(existingMeta.gallery_images)
      ? existingMeta.gallery_images
      : [];
    for (const img of gallery) {
      if (typeof img === "string" && img.trim() && !list.includes(img.trim()) && list.length < 3) {
        list.push(img.trim());
      }
    }
    return list;
  }, [product, existingMeta.gallery_images]);

  const [images, setImages] = useState<string[]>(initialImages);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [urlInput, setUrlInput] = useState<string>("");
  const [showUrlInput, setShowUrlInput] = useState<boolean>(false);

  // Modificadores reales creados en el negocio (tabla product_option_groups)
  const [businessGroups, setBusinessGroups] = useState<ModifierGroup[]>([]);
  const [isLoadingBusinessGroups, setIsLoadingBusinessGroups] = useState<boolean>(false);

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
  const initialCostValue = Number(
    existingMeta.cost ?? existingMeta.average_cost ?? (product as any)?.cost_price ?? 0
  );
  const [averageCost, setAverageCost] = useState<number>(initialCostValue);
  const [costDisplay, setCostDisplay] = useState<string>(
    initialCostValue ? formatNumberWithDots(initialCostValue) : ""
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
  const [isSingleModifierModalOpen, setIsSingleModifierModalOpen] = useState<boolean>(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState<boolean>(false);
  const [editingGroupForModal, setEditingGroupForModal] = useState<ModifierGroup | null>(null);

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

      const meta = (product.metadata as any) || {};
      const prodImages: string[] = [];
      if (product.image_url) prodImages.push(product.image_url);
      if (Array.isArray(meta.gallery_images)) {
        for (const img of meta.gallery_images) {
          if (typeof img === "string" && img.trim() && !prodImages.includes(img.trim()) && prodImages.length < 3) {
            prodImages.push(img.trim());
          }
        }
      }
      setImages(prodImages);

      setSku(meta.sku || "");
      setBarcode(meta.barcode || "");
      setUnit(meta.unit || "unidad");
      setBrand(meta.brand || "");
      setStockMode(meta.track_stock ? "limited" : "unlimited");
      setStockQuantity(meta.stock_quantity ?? 0);
      setMinStock(meta.min_stock ?? null);
      setMaxStock(meta.max_stock ?? null);
      const loadedCost = Number(meta.cost ?? meta.average_cost ?? (product as any)?.cost_price ?? 0);
      setAverageCost(loadedCost);
      setCostDisplay(loadedCost ? formatNumberWithDots(loadedCost) : "");
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

      if (meta.product_type === "service") {
        setProductKind("service");
        setProductType("service");
        setStockMode("unlimited");
      } else if (meta.track_stock) {
        setProductKind("stock");
        setProductType("product");
        setStockMode("limited");
      } else {
        setProductKind("prepared");
        setProductType("product");
        setStockMode("unlimited");
      }
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
  }, [product, setValue, initialCategoryId, localCategories]);

  // Consultar modificadores globales del negocio al abrir modal de asignación
  useEffect(() => {
    if (isAssignModalOpen && businessGroups.length === 0) {
      setIsLoadingBusinessGroups(true);
      getModifierGroupsAction(businessId)
        .then((res) => {
          if (res.success && res.data?.groups) {
            setBusinessGroups(res.data.groups);
          }
        })
        .finally(() => setIsLoadingBusinessGroups(false));
    }
  }, [isAssignModalOpen, businessId, businessGroups.length]);

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

  // Carga de imágenes (máximo 3 fotografías)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (images.length >= 3) {
      toast.warning("Límite de fotografías alcanzado", {
        description: "Se permite un máximo de 3 imágenes por producto. Elimina una para añadir otra.",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

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

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (product?.id) {
        formData.append("productId", product.id);
      }

      const res = await uploadProductImageAction(businessId, formData);
      if (res.success && res.url) {
        setImages((prev) => (prev.length < 3 ? [...prev, res.url!] : prev));
        toast.success("Fotografía cargada correctamente.");
      } else {
        toast.error("Error al cargar la imagen", {
          description: res.error || "Ocurrió un error al procesar el archivo.",
        });
      }
    } catch (err: any) {
      toast.error("Error al cargar la imagen", {
        description: err?.message || "No se pudo completar la carga del archivo.",
      });
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleAddImageUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (!/^https?:\/\/.+/i.test(trimmed)) {
      toast.error("URL no válida", { description: "Ingresa una dirección web válida (ej. https://...)" });
      return;
    }
    if (images.length >= 3) {
      toast.warning("Límite de fotografías alcanzado", {
        description: "Cada producto permite un máximo de 3 imágenes.",
      });
      return;
    }
    setImages((prev) => (prev.length < 3 ? [...prev, trimmed] : prev));
    setUrlInput("");
    setShowUrlInput(false);
    toast.success("Imagen añadida por URL.");
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== index));
    toast.info("Fotografía eliminada.");
  };

  const handleSetPrimaryImage = (index: number) => {
    if (index === 0) return;
    setImages((prev) => {
      const target = prev[index];
      const remaining = prev.filter((_, idx) => idx !== index);
      return [target, ...remaining];
    });
    toast.success("Imagen principal actualizada.");
  };

  const handleMoveImage = (fromIndex: number, direction: "prev" | "next") => {
    const toIndex = direction === "prev" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= images.length) return;
    setImages((prev) => {
      const copy = [...prev];
      const temp = copy[fromIndex];
      copy[fromIndex] = copy[toIndex];
      copy[toIndex] = temp;
      return copy;
    });
    if (toIndex === 0 || fromIndex === 0) {
      toast.info("Orden actualizado. La primera foto es ahora la principal.");
    }
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

  const handleSaveSingleModifierInProduct = async (data: CreateModifierGroupInput) => {
    const productIdsToAssign = product?.id
      ? Array.from(new Set([...(data.product_ids || []), product.id]))
      : data.product_ids || [];

    const res = await createModifierGroupAction(businessId, {
      ...data,
      product_ids: productIdsToAssign,
    });

    if (res.success && res.data) {
      toast.success("Modificador creado y vinculado");
      const newLocalGroup: ProductModifierGroup = {
        id: res.data.id,
        name: res.data.name,
        type: res.data.commercial_type || "additional",
        commercial_type: res.data.commercial_type || "additional",
        required: false,
        selection_type: "single",
        min_select: 0,
        max_select: 1,
        options: res.data.options.map((o) => ({
          id: o.id,
          name: o.name,
          price: o.price,
          is_available: o.status !== "inactive",
          status: o.status || "active",
        })),
      };
      setModifierGroups((prev) => [...prev, newLocalGroup]);
    } else {
      throw new Error(res.error || "No se pudo crear el modificador");
    }
  };

  const handleSaveGroupInProduct = async (data: CreateModifierGroupInput) => {
    if (editingGroupForModal) {
      const res = await updateModifierGroupAction(businessId, editingGroupForModal.id, data);
      if (res.success && res.data) {
        toast.success("Grupo de modificadores actualizado");
        const updatedLocalGroup: ProductModifierGroup = {
          id: res.data.id,
          name: res.data.name,
          type: (res.data.commercial_type || (res.data as any).type || (res.data.selection_type === "single" ? "size" : "additional")) as "additional" | "size" | "replacement",
          commercial_type: res.data.commercial_type || undefined,
          required: Boolean(res.data.required),
          selection_type: res.data.selection_type || "multiple",
          min_select: res.data.min_select ?? 0,
          max_select: res.data.max_select ?? 1,
          options: (res.data.options || []).map((o) => ({
            id: o.id,
            name: o.name,
            price: Number(o.price) || 0,
            is_available: o.status !== "inactive",
            status: o.status || "active",
          })),
        };
        setModifierGroups((prev) =>
          prev.map((g) => (g.id === editingGroupForModal.id ? updatedLocalGroup : g))
        );
        setIsGroupModalOpen(false);
        setEditingGroupForModal(null);
      } else {
        throw new Error(res.error || "No se pudo actualizar el grupo de modificadores");
      }
    } else {
      const productIdsToAssign = product?.id
        ? Array.from(new Set([...(data.product_ids || []), product.id]))
        : data.product_ids || [];

      const res = await createModifierGroupAction(businessId, {
        ...data,
        product_ids: productIdsToAssign,
      });

      if (res.success && res.data) {
        toast.success("Grupo de modificadores creado y asignado");
        const newLocalGroup: ProductModifierGroup = {
          id: res.data.id,
          name: res.data.name,
          type: (res.data.commercial_type || (res.data as any).type || (res.data.selection_type === "single" ? "size" : "additional")) as "additional" | "size" | "replacement",
          commercial_type: res.data.commercial_type || undefined,
          required: Boolean(res.data.required),
          selection_type: res.data.selection_type || "multiple",
          min_select: res.data.min_select ?? 0,
          max_select: res.data.max_select ?? 1,
          options: (res.data.options || []).map((o) => ({
            id: o.id,
            name: o.name,
            price: Number(o.price) || 0,
            is_available: o.status !== "inactive",
            status: o.status || "active",
          })),
        };
        setModifierGroups((prev) => [...prev, newLocalGroup]);
        setIsGroupModalOpen(false);
        setEditingGroupForModal(null);
      } else {
        throw new Error(res.error || "No se pudo crear el grupo de modificadores");
      }
    }
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

  // Combina modificadores reales creados en el negocio (tabla product_option_groups) y de otros productos
  const allAvailableGroups = useMemo(() => {
    const list: { group: ProductModifierGroup; source: string }[] = [];

    // 1. Grupos globales de la base de datos creados por el negocio
    for (const bg of businessGroups) {
      const isSingleBg = (bg.options?.length ?? 0) <= 1 && (bg.max_select ?? 1) === 1 && !bg.required;
      list.push({
        group: {
          id: bg.id,
          name: bg.name,
          type: (bg.commercial_type || (bg as any).type || (isSingleBg ? "additional" : (bg.selection_type === "single" ? "size" : "additional"))) as "additional" | "size" | "replacement",
          required: Boolean(bg.required),
          min_select: bg.min_select ?? 0,
          max_select: bg.max_select ?? 1,
          options: (bg.options || []).map((o) => ({
            id: o.id,
            name: o.name,
            price: Number(o.price) || 0,
            is_available: o.status !== "inactive",
          })),
        },
        source: isSingleBg ? "Modificador individual" : "Grupo global del negocio",
      });
    }

    // 2. Grupos configurados en otros productos reales del catálogo
    for (const { group, sourceProductName } of availableExistingGroups) {
      if (!list.some((item) => item.group.name.toLowerCase() === group.name.toLowerCase())) {
        list.push({ group, source: `Producto: ${sourceProductName}` });
      }
    }

    return list;
  }, [businessGroups, availableExistingGroups]);

  const handleImportModifierGroup = (sourceGroup: ProductModifierGroup) => {
    const groupId = sourceGroup.id && !sourceGroup.id.startsWith("grp_temp_")
      ? sourceGroup.id
      : generateId("grp");

    const cloned: ProductModifierGroup = {
      id: groupId,
      name: sourceGroup.name,
      type: sourceGroup.type || "additional",
      required: Boolean(sourceGroup.required),
      min_select: sourceGroup.min_select ?? 0,
      max_select: sourceGroup.max_select ?? 1,
      options: (sourceGroup.options || []).map((o) => ({
        id: o.id || generateId("opt"),
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

      const isTrackingStock = productKind === "stock" && stockMode === "limited";

      const payloadMetadata = {
        ...existingMeta,
        product_type: productKind === "service" ? "service" : "product",
        sku: sku.trim() || null,
        barcode: barcode.trim() || null,
        brand: brand.trim() || null,
        unit: unit.trim() || "unidad",
        track_stock: isTrackingStock,
        stock_quantity: isTrackingStock ? stockQuantity : null,
        min_stock: isTrackingStock ? minStock : null,
        max_stock: isTrackingStock ? maxStock : null,
        cost: productKind === "service" ? 0 : Math.max(0, Number(averageCost) || 0),
        average_cost: productKind === "service" ? 0 : Math.max(0, Number(averageCost) || 0),
        duration_minutes: productKind === "service" ? durationMinutes : null,
        tax_percentage: taxPercentage,
        tax_included_in_price: taxIncludedInPrice,
        available_in_pos: availableInPos,
        available_in_qr: verticalCtx.availableChannels.includes("qr")
          ? availableInQr
          : Boolean(existingMeta.available_in_qr ?? false),
        available_online: Boolean(existingMeta.available_online ?? false),
        show_in_qr_menu: verticalCtx.availableChannels.includes("qr")
          ? availableInQr
          : Boolean(existingMeta.show_in_qr_menu ?? false),
        allergens: allergensArray,
        ingredients: ingredients.trim() || null,
        gallery_images: images.slice(1),
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
        available_in_qr: verticalCtx.availableChannels.includes("qr")
          ? availableInQr
          : Boolean(existingMeta.available_in_qr ?? false),
        available_online: Boolean(existingMeta.available_online ?? false),
        category_id: cleanedCategoryId,
        image_url: images[0] || null,
        metadata: payloadMetadata,
      };

      let res;
      if (product && product.id) {
        res = await updateProductAction(businessId, product.id, payload);
      } else {
        res = await createProductAction(businessId, payload);
      }

      if (res.success && res.data) {
        const savedProductId = res.data.id;
        const assignedRealGroupIds = modifierGroups
          .map((g) => g.id)
          .filter((id): id is string => Boolean(id && !id.startsWith("grp_temp_")));

        if (savedProductId) {
          syncProductModifierGroupLinksAction(businessId, savedProductId, assignedRealGroupIds).catch((err) => {
            console.error("[product-form] Error al sincronizar vínculos de modificadores:", err);
          });
        }

        broadcastProductUpdate(businessId, res.data);
        toast.success(product && product.id ? "Producto actualizado correctamente" : "Producto creado con éxito");
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
          product && product.id
            ? productKind === "service"
              ? "Editar Servicio"
              : "Editar Producto"
            : product && !product.id
            ? "Duplicar Producto"
            : productKind === "service"
            ? "Nuevo Servicio"
            : "Nuevo Producto"
        }
        description="Configura los datos del producto o servicio, precios, inventario, variantes, imágenes y modificadores."
        showConfirmButton={false}
        maxWidth="5xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-1 max-h-[82vh] overflow-y-auto px-2 py-1">
          {/* Clasificación y Comportamiento del Artículo según Actividad Comercial del Negocio */}
          <div className="p-3.5 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Modalidad del producto *
              </label>
              {verticalCtx.availableKinds.length === 1 && (
                <span className="text-[11px] font-medium text-slate-400">
                  Modalidad comercial única del negocio
                </span>
              )}
            </div>
            <div
              className={`grid grid-cols-1 ${
                verticalCtx.availableKinds.length === 1
                  ? "max-w-md"
                  : verticalCtx.availableKinds.length === 2
                  ? "sm:grid-cols-2"
                  : "sm:grid-cols-3"
              } gap-2.5`}
            >
              {verticalCtx.availableKinds.includes("stock") && (
                <button
                  type="button"
                  onClick={() => {
                    setProductKind("stock");
                    setProductType("product");
                    setStockMode("limited");
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    productKind === "stock"
                      ? "border-[#ED500A] bg-[#ED500A]/10 text-slate-900 dark:text-white ring-1 ring-[#ED500A]"
                      : "border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] text-slate-600 dark:text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="w-4 h-4 text-[#ED500A]" />
                    <span className="font-bold text-xs">Con existencias</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    Control de stock físico directo (bebidas, abarrotes, ropa, artículos).
                  </p>
                </button>
              )}

              {verticalCtx.availableKinds.includes("prepared") && (
                <button
                  type="button"
                  onClick={() => {
                    setProductKind("prepared");
                    setProductType("product");
                    setStockMode("unlimited");
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    productKind === "prepared"
                      ? "border-[#ED500A] bg-[#ED500A]/10 text-slate-900 dark:text-white ring-1 ring-[#ED500A]"
                      : "border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] text-slate-600 dark:text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Layers className="w-4 h-4 text-[#ED500A]" />
                    <span className="font-bold text-xs">Preparado / Elaborado</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    Elaborado al momento bajo demanda. Sin stock de producto terminado.
                  </p>
                </button>
              )}

              {verticalCtx.availableKinds.includes("service") && (
                <button
                  type="button"
                  onClick={() => {
                    setProductKind("service");
                    setProductType("service");
                    setStockMode("unlimited");
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    productKind === "service"
                      ? "border-[#ED500A] bg-[#ED500A]/10 text-slate-900 dark:text-white ring-1 ring-[#ED500A]"
                      : "border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] text-slate-600 dark:text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-[#ED500A]" />
                    <span className="font-bold text-xs">Servicio / Sin stock</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    Servicios o ítems sin inventario (corte de cabello, asesorías, transporte).
                  </p>
                </button>
              )}
            </div>
          </div>

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
                <Input
                  label={`Nombre del ${productType === "service" ? "servicio" : "producto"}`}
                  required
                  {...register("name")}
                  placeholder={
                    productType === "service"
                      ? "Ej. Corte de cabello degradado, Asesoría contable..."
                      : isFoodBusiness
                      ? "Ej. Hamburguesa Doble Carne, Salchipapa Especial..."
                      : "Ej. Camiseta Polo Algodón, Pintura Acrílica 1 Gal..."
                  }
                  error={errors.name?.message}
                />

                {/* Descripción */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Descripción comercial
                  </label>
                  <textarea
                    {...register("description")}
                    rows={2}
                    className="w-full px-3.5 py-2 bg-slate-50/70 dark:bg-[#0B0D14] border border-slate-200/80 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ED500A]/50 resize-none transition-all placeholder:text-slate-400"
                    placeholder="Detalles, porciones, beneficios o preparación..."
                  />
                </div>

                {/* Unidad de Medida y Categoría */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Unidad de Medida */}
                  <Select
                    label="Unidad de Medida"
                    value={unit}
                    onChange={setUnit}
                  >
                    {PRODUCT_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                    {!PRODUCT_UNITS.some((u) => u.value === unit) && unit && (
                      <option value={unit}>{unit}</option>
                    )}
                  </Select>

                  {/* Categoría */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Categoría
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowQuickCategory(!showQuickCategory)}
                        className="text-[11px] text-[#ED500A] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Nueva</span>
                      </button>
                    </div>

                    {showQuickCategory ? (
                      <div className="p-2 bg-white dark:bg-[#0D0F16] border border-[#ED500A]/40 rounded-xl space-y-2 animate-in fade-in duration-100">
                        <Input
                          inputSize="sm"
                          value={quickCategoryName}
                          onChange={(e) => setQuickCategoryName(e.target.value)}
                          placeholder="Nombre de categoría..."
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
                      <Select
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
                      >
                        <option value="">Sin categoría asignada</option>
                        {hierarchicalCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </div>
                </div>

                {/* SKU y Código de Barras Base */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Input
                    label="Código SKU"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="Ej. REF-001"
                    className="font-mono"
                  />

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Código de Barras
                    </label>
                    <div className="flex gap-1.5">
                      <Input
                        value={barcode}
                        onChange={(e) => setBarcode(e.target.value)}
                        placeholder="770... o escanear"
                        leftIcon={<Barcode className="w-3.5 h-3.5 text-slate-400" />}
                        className="font-mono flex-1"
                        containerClassName="flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setBarcodeTarget("product");
                          setIsBarcodeScannerOpen(true);
                        }}
                        className="px-2.5 h-10 bg-[#ED500A]/10 hover:bg-[#ED500A]/20 text-[#ED500A] rounded-xl text-xs flex items-center gap-1.5 border border-[#ED500A]/25 transition-all cursor-pointer shrink-0 font-bold active:scale-95 shadow-xs"
                        title="Escanear con cámara"
                      >
                        <Camera className="w-3.5 h-3.5 text-[#ED500A]" />
                        <span className="hidden sm:inline">Escanear</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Canales de Venta Habilitados (Contextuales al Vertical) */}
                <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                    Canales de Venta Habilitados
                  </span>
                  <div
                    className={
                      verticalCtx.availableChannels.length > 1
                        ? "grid grid-cols-2 gap-2"
                        : "grid grid-cols-1 gap-2"
                    }
                  >
                    {/* Canal POS / Caja */}
                    {verticalCtx.availableChannels.includes("pos") && (
                      <button
                        type="button"
                        onClick={() => setAvailableInPos(!availableInPos)}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          availableInPos
                            ? "bg-[#ED500A]/10 border-[#ED500A]/50 text-[#ED500A] font-bold shadow-2xs"
                            : "bg-white dark:bg-[#0D0F16] border-slate-200 dark:border-white/[0.08] text-slate-400"
                        }`}
                      >
                        <Store className="w-4 h-4 mb-0.5" />
                        <span className="text-[11px] leading-tight">POS / Caja</span>
                        <span className="text-[9px] opacity-80">{availableInPos ? "Activo" : "Oculto"}</span>
                      </button>
                    )}

                    {/* Canal Menú QR (Únicamente para negocios gastronómicos / restaurantes) */}
                    {verticalCtx.availableChannels.includes("qr") && (
                      <button
                        type="button"
                        onClick={() => setAvailableInQr(!availableInQr)}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          availableInQr
                            ? "bg-[#ED500A]/10 border-[#ED500A]/50 text-[#ED500A] font-bold shadow-2xs"
                            : "bg-white dark:bg-[#0D0F16] border-slate-200 dark:border-white/[0.08] text-slate-400"
                        }`}
                      >
                        <QrCode className="w-4 h-4 mb-0.5" />
                        <span className="text-[11px] leading-tight">Menú QR</span>
                        <span className="text-[9px] opacity-80">{availableInQr ? "Activo" : "Oculto"}</span>
                      </button>
                    )}
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
                      className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                        stockMode === "unlimited"
                          ? "bg-[#ED500A]/10 border-[#ED500A] text-slate-900 dark:text-white shadow-2xs"
                          : "bg-white dark:bg-[#0D0F16] border-slate-200 dark:border-white/[0.08] text-slate-500 hover:border-[#ED500A]/30"
                      }`}
                    >
                      <span className="text-xs font-bold">Stock Ilimitado</span>
                      <div
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                          stockMode === "unlimited"
                            ? "border-[#ED500A] bg-[#ED500A]"
                            : "border-slate-300 dark:border-white/20"
                        }`}
                      >
                        {stockMode === "unlimited" && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStockMode("limited")}
                      className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                        stockMode === "limited"
                          ? "bg-[#ED500A]/10 border-[#ED500A] text-slate-900 dark:text-white shadow-2xs"
                          : "bg-white dark:bg-[#0D0F16] border-slate-200 dark:border-white/[0.08] text-slate-500 hover:border-[#ED500A]/30"
                      }`}
                    >
                      <span className="text-xs font-bold">Stock Limitado</span>
                      <div
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                          stockMode === "limited"
                            ? "border-[#ED500A] bg-[#ED500A]"
                            : "border-slate-300 dark:border-white/20"
                        }`}
                      >
                        {stockMode === "limited" && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
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
                      <Input
                        label="Precio de Venta (COP)"
                        required
                        inputMode="numeric"
                        value={priceDisplay}
                        onChange={(e) => {
                          const raw = parseNumberFromDots(e.target.value);
                          const formatted = formatNumberWithDots(e.target.value);
                          setPriceDisplay(formatted);
                          setValue("price", raw, { shouldValidate: true });
                        }}
                        placeholder="0"
                        startAdornment={<span className="text-sm font-bold text-slate-400">$</span>}
                        className="font-bold"
                        error={errors.price?.message}
                      />

                      {/* Costo del Producto */}
                      {productType === "product" && (
                        <Input
                          label="Costo de Adquisición (COP)"
                          inputMode="numeric"
                          value={costDisplay}
                          onChange={(e) => {
                            const raw = parseNumberFromDots(e.target.value);
                            const formatted = formatNumberWithDots(e.target.value);
                            setCostDisplay(formatted);
                            setAverageCost(raw);
                          }}
                          placeholder="0"
                          startAdornment={<span className="text-sm font-bold text-slate-400">$</span>}
                          className="font-mono font-bold"
                          helperText={
                            Number(priceWatch) > 0 && averageCost > 0
                              ? `Margen estimado: ${(((Number(priceWatch) - averageCost) / Number(priceWatch)) * 100).toFixed(1)}%`
                              : undefined
                          }
                        />
                      )}
                    </div>

                    {/* Si es de Stock Limitado: Stock Inicial, Mínimo y Máximo */}
                    {productType === "product" && stockMode === "limited" && (
                      <div className="p-3.5 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl space-y-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                          Niveles de Stock Físico
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <Input
                            label="Stock Inicial"
                            required
                            type="number"
                            min="0"
                            value={stockQuantity}
                            onChange={(e) => setStockQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))}
                            placeholder="0"
                            helperText="Unidades disponibles"
                            className="font-mono font-bold"
                            inputSize="sm"
                          />

                          <Input
                            label="Stock Mínimo"
                            type="number"
                            min="0"
                            value={minStock ?? ""}
                            onChange={(e) => {
                              const v = e.target.value.trim();
                              setMinStock(v === "" ? null : Math.max(0, parseInt(v, 10) || 0));
                            }}
                            placeholder="Opcional"
                            helperText="Alerta de reposición"
                            className="font-mono font-bold"
                            inputSize="sm"
                          />

                          <Input
                            label="Stock Máximo"
                            type="number"
                            min="0"
                            value={maxStock ?? ""}
                            onChange={(e) => {
                              const v = e.target.value.trim();
                              setMaxStock(v === "" ? null : Math.max(0, parseInt(v, 10) || 0));
                            }}
                            placeholder="Opcional"
                            helperText="Capacidad máxima"
                            className="font-mono font-bold"
                            inputSize="sm"
                          />
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
                                <Input
                                  inputSize="sm"
                                  value={v.name}
                                  onChange={(e) => handleUpdateVariant(vIdx, { name: e.target.value })}
                                  placeholder="Ej. Pequeño, Mediano, Talla L..."
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                  SKU
                                </label>
                                <Input
                                  inputSize="sm"
                                  value={v.sku || ""}
                                  onChange={(e) => handleUpdateVariant(vIdx, { sku: e.target.value })}
                                  placeholder="REF-MED"
                                  className="font-mono"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                  Código de Barras
                                </label>
                                <div className="flex gap-1">
                                  <div className="flex-1">
                                    <Input
                                      inputSize="sm"
                                      value={v.barcode || ""}
                                      onChange={(e) => handleUpdateVariant(vIdx, { barcode: e.target.value })}
                                      placeholder="770..."
                                      className="font-mono"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setBarcodeTarget(vIdx);
                                      setIsBarcodeScannerOpen(true);
                                    }}
                                    className="p-1.5 bg-[#ED500A]/10 hover:bg-[#ED500A]/20 text-[#ED500A] border border-[#ED500A]/25 rounded-lg transition-colors cursor-pointer shrink-0 self-stretch flex items-center justify-center"
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
                                <Input
                                  inputSize="sm"
                                  type="number"
                                  min="0"
                                  value={v.cost ?? ""}
                                  onChange={(e) =>
                                    handleUpdateVariant(vIdx, {
                                      cost: e.target.value === "" ? null : Math.max(0, parseFloat(e.target.value) || 0),
                                    })
                                  }
                                  placeholder="0"
                                  className="font-mono"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                  Precio Venta *
                                </label>
                                <Input
                                  inputSize="sm"
                                  startAdornment={<span className="text-[10px] font-bold text-slate-400">$</span>}
                                  value={v.price ? formatNumberWithDots(v.price) : ""}
                                  onChange={(e) =>
                                    handleUpdateVariant(vIdx, {
                                      price: parseNumberFromDots(e.target.value),
                                    })
                                  }
                                  placeholder="0"
                                  className="font-bold"
                                />
                              </div>

                              {stockMode === "limited" ? (
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                    Stock Inicial
                                  </label>
                                  <Input
                                    inputSize="sm"
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
                                    className="font-mono font-bold"
                                  />
                                </div>
                              ) : (
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                    Stock
                                  </label>
                                  <div className="h-8 flex items-center px-2 bg-slate-50 dark:bg-white/5 rounded-lg text-[11px] text-slate-400 italic">
                                    Ilimitado
                                  </div>
                                </div>
                              )}

                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                  Impuesto
                                </label>
                                <Select
                                  selectSize="sm"
                                  value={v.tax_percentage !== null && v.tax_percentage !== undefined ? v.tax_percentage : ""}
                                  onChange={(e) =>
                                    handleUpdateVariant(vIdx, {
                                      tax_percentage: e.target.value === "" ? null : Number(e.target.value),
                                    })
                                  }
                                >
                                  <option value="">Heredar ({taxPercentage}%)</option>
                                  <option value="0">0% Exento</option>
                                  <option value="5">5% Especial</option>
                                  <option value="8">8% Impoconsumo</option>
                                  <option value="19">19% General</option>
                                </Select>
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
              {/* SECCIÓN CARGA DE FOTOGRAFÍA (MÁXIMO 3 IMÁGENES) */}
              <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-2xl space-y-3.5">
                {/* Cabecera del Módulo de Fotos */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-[#ED500A]" />
                      <span>Fotografías del Producto</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        images.length === 3
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : images.length > 0
                          ? "bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20"
                          : "bg-slate-200/70 dark:bg-white/10 text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {images.length === 3 ? "3/3 (Límite)" : `${images.length} de 3`}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    className="text-xs text-[#ED500A] hover:text-[#d44507] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>{showUrlInput ? "Ocultar URL" : "Añadir por URL"}</span>
                  </button>
                </div>

                {/* Input condicional de URL */}
                {showUrlInput && (
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddImageUrl();
                        }
                      }}
                      placeholder="https://ejemplo.com/foto.jpg"
                      className="flex-1 px-3 py-1.5 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs focus:ring-1 focus:ring-[#ED500A] outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddImageUrl}
                      disabled={images.length >= 3}
                      className="px-3 py-1.5 bg-[#ED500A] text-white rounded-xl text-xs font-semibold hover:bg-[#d44507] transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      Añadir
                    </button>
                  </div>
                )}

                {/* Contenido Visual: Estado Vacío vs Galería Organizada */}
                {images.length === 0 ? (
                  /* Estado Vacío: Dropzone Moderno */
                  <div
                    onClick={() => !isUploadingImage && fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 dark:border-white/15 rounded-2xl hover:border-[#ED500A]/50 hover:bg-slate-100/50 dark:hover:bg-white/[0.02] bg-white dark:bg-[#0D0F16] transition-all cursor-pointer text-center group"
                  >
                    {isUploadingImage ? (
                      <div className="py-4 flex flex-col items-center gap-2">
                        <Loader2 className="w-7 h-7 animate-spin text-[#ED500A]" />
                        <span className="text-xs text-slate-500 font-medium">Subiendo fotografía...</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                          <UploadCloud className="w-6 h-6" />
                        </div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Haz clic para subir la imagen principal
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Formatos JPG, PNG, WEBP (hasta 5MB). Podrás añadir hasta 3 imágenes.
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  /* Galería Activa: Principal destacada + Miniaturas secundarias */
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      {/* 1. FOTO PRINCIPAL DESTACADA (Span 7) */}
                      <div className="sm:col-span-7">
                        <div className="relative group rounded-2xl overflow-hidden border border-slate-200 dark:border-white/[0.08] bg-slate-100 dark:bg-black/30 aspect-[4/3] sm:h-48 w-full shadow-2xs">
                          <img
                            src={images[0]}
                            alt="Foto principal"
                            className="w-full h-full object-cover"
                          />

                          {/* Badge Permanente de Principal */}
                          <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-[#ED500A] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md">
                            <Star className="w-3 h-3 fill-current" />
                            <span>Principal</span>
                          </div>

                          {/* Overlay de Acciones (Eliminar y Mover) */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between p-3">
                            <div className="flex items-center gap-1.5">
                              {images.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleMoveImage(0, "next")}
                                  className="p-1.5 bg-black/70 hover:bg-[#ED500A] text-white rounded-lg transition-colors cursor-pointer"
                                  title="Mover al orden 2"
                                >
                                  <ArrowRight className="w-4 h-4" />
                                </button>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveImage(0)}
                              className="p-1.5 bg-black/70 hover:bg-red-600 text-white rounded-lg transition-colors cursor-pointer"
                              title="Eliminar foto principal"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1.5 truncate">
                          ★ Portada en Menú QR, POS y Comandas
                        </p>
                      </div>

                      {/* 2. FOTOS SECUNDARIAS (SLOTS 2 Y 3) (Span 5) */}
                      <div className="sm:col-span-5 flex flex-col gap-2.5 justify-between">
                        {/* Slot 2 */}
                        {images[1] ? (
                          <div className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-white/[0.08] bg-slate-100 dark:bg-black/20 h-22 sm:h-[90px] w-full flex items-center shadow-2xs">
                            <img
                              src={images[1]}
                              alt="Foto secundaria 1"
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute top-1.5 left-1.5 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                              Foto 2
                            </span>

                            {/* Controles Slot 2 */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 p-1">
                              <button
                                type="button"
                                onClick={() => handleSetPrimaryImage(1)}
                                className="p-1 bg-black/70 hover:bg-[#ED500A] text-white rounded-md transition-colors cursor-pointer"
                                title="Establecer como Principal"
                              >
                                <Star className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveImage(1, "prev")}
                                className="p-1 bg-black/70 hover:bg-blue-600 text-white rounded-md transition-colors cursor-pointer"
                                title="Mover a la izquierda"
                              >
                                <ArrowLeft className="w-3.5 h-3.5" />
                              </button>
                              {images.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => handleMoveImage(1, "next")}
                                  className="p-1 bg-black/70 hover:bg-blue-600 text-white rounded-md transition-colors cursor-pointer"
                                  title="Mover a la derecha"
                                >
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveImage(1)}
                                className="p-1 bg-black/70 hover:bg-red-600 text-white rounded-md transition-colors cursor-pointer"
                                title="Eliminar foto"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => !isUploadingImage && fileInputRef.current?.click()}
                            className="h-22 sm:h-[90px] w-full flex flex-col items-center justify-center p-2 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl hover:border-[#ED500A]/50 bg-white dark:bg-[#0D0F16] transition-colors cursor-pointer text-center group"
                          >
                            <Plus className="w-4 h-4 text-slate-400 group-hover:text-[#ED500A] transition-colors mb-0.5" />
                            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                              + Foto secundaria
                            </span>
                            <span className="text-[9px] text-slate-400">(Slot 2 disponible)</span>
                          </div>
                        )}

                        {/* Slot 3 */}
                        {images[2] ? (
                          <div className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-white/[0.08] bg-slate-100 dark:bg-black/20 h-22 sm:h-[90px] w-full flex items-center shadow-2xs">
                            <img
                              src={images[2]}
                              alt="Foto secundaria 2"
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute top-1.5 left-1.5 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                              Foto 3
                            </span>

                            {/* Controles Slot 3 */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 p-1">
                              <button
                                type="button"
                                onClick={() => handleSetPrimaryImage(2)}
                                className="p-1 bg-black/70 hover:bg-[#ED500A] text-white rounded-md transition-colors cursor-pointer"
                                title="Establecer como Principal"
                              >
                                <Star className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveImage(2, "prev")}
                                className="p-1 bg-black/70 hover:bg-blue-600 text-white rounded-md transition-colors cursor-pointer"
                                title="Mover a la izquierda"
                              >
                                <ArrowLeft className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveImage(2)}
                                className="p-1 bg-black/70 hover:bg-red-600 text-white rounded-md transition-colors cursor-pointer"
                                title="Eliminar foto"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : images[1] ? (
                          <div
                            onClick={() => !isUploadingImage && fileInputRef.current?.click()}
                            className="h-22 sm:h-[90px] w-full flex flex-col items-center justify-center p-2 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl hover:border-[#ED500A]/50 bg-white dark:bg-[#0D0F16] transition-colors cursor-pointer text-center group"
                          >
                            <Plus className="w-4 h-4 text-slate-400 group-hover:text-[#ED500A] transition-colors mb-0.5" />
                            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                              + Foto secundaria
                            </span>
                            <span className="text-[9px] text-slate-400">(Slot 3 disponible)</span>
                          </div>
                        ) : (
                          <div className="h-22 sm:h-[90px] w-full flex flex-col items-center justify-center p-2 border border-dashed border-slate-200/50 dark:border-white/5 rounded-xl bg-slate-50/50 dark:bg-white/[0.01] text-center opacity-60">
                            <span className="text-[10px] text-slate-400 font-medium">
                              Slot 3 libre
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                />

                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Hasta 3 fotografías. Usa las flechas para ordenar o la estrella ⭐ para fijar la foto principal.
                </p>
              </div>

              {/* SECCIÓN MODIFICADORES (PERSONALIZACIÓN DE PRODUCTO) */}
              <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-2xl space-y-4">
                {/* Cabecera: Título y Contador */}
                <div className="pb-3 border-b border-slate-200/60 dark:border-white/5 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-[#ED500A]/10 border border-[#ED500A]/20 flex items-center justify-center shrink-0">
                        <SlidersHorizontal className="w-4 h-4 text-[#ED500A]" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                          Modificadores y Personalización
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Personaliza opciones, adiciones, especificaciones o variantes
                        </p>
                      </div>
                    </div>
                    {(() => {
                      const singles = modifierGroups.filter((g) => g.options.length <= 1 && (g.max_select ?? 1) === 1 && !g.required).length;
                      const groups = modifierGroups.length - singles;
                      const parts: string[] = [];
                      if (singles > 0) parts.push(`${singles} ${singles === 1 ? "individual" : "individuales"}`);
                      if (groups > 0) parts.push(`${groups} ${groups === 1 ? "grupo" : "grupos"}`);
                      return (
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20 font-bold shrink-0">
                          {parts.length > 0 ? parts.join(" · ") : "0 configurados"}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Tarjetas de acción estilo cuadros (espaciosas e intuitivas) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    {/* Tarjeta 1: Nuevo Modificador */}
                    <button
                      type="button"
                      onClick={() => setIsSingleModifierModalOpen(true)}
                      className="flex flex-col items-center justify-center p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] hover:bg-[#ED500A]/5 hover:border-[#ED500A]/50 text-slate-800 dark:text-slate-200 transition-all cursor-pointer group shadow-2xs active:scale-[0.98] text-center"
                    >
                      <div className="w-9 h-9 rounded-xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#ED500A] transition-colors">
                        Nuevo modificador
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                        Adición individual rápida
                      </span>
                    </button>

                    {/* Tarjeta 2: Nuevo Grupo */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingGroupForModal(null);
                        setIsGroupModalOpen(true);
                      }}
                      className="flex flex-col items-center justify-center p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] hover:border-[#ED500A]/50 text-slate-800 dark:text-slate-200 transition-all cursor-pointer group shadow-2xs active:scale-[0.98] text-center"
                    >
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 flex items-center justify-center mb-2 group-hover:scale-110 group-hover:text-[#ED500A] transition-all">
                        <Layers className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#ED500A] transition-colors">
                        Nuevo grupo
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                        Múltiples opciones y reglas
                      </span>
                    </button>

                    {/* Tarjeta 3: Asignar Existentes */}
                    <button
                      type="button"
                      onClick={() => setIsAssignModalOpen(true)}
                      className="flex flex-col items-center justify-center p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] hover:bg-blue-500/5 hover:border-blue-500/50 text-slate-800 dark:text-slate-200 transition-all cursor-pointer group shadow-2xs active:scale-[0.98] text-center"
                    >
                      <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                        <Copy className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        Asignar existentes
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                        Reutilizar de tu catálogo
                      </span>
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
                      Usa <strong>"Nuevo modificador"</strong>, <strong>"Nuevo grupo"</strong> o <strong>"Asignar existentes"</strong> para agregar adiciones, tamaños o reemplazos.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {modifierGroups.map((group, gIdx) => {
                      const isSingle = group.options.length <= 1 && (group.max_select ?? 1) === 1 && !group.required;

                      if (isSingle) {
                        const opt = group.options[0] || { id: "opt_0", name: group.name, price: 0, is_available: true };
                        return (
                          <div
                            key={group.id || gIdx}
                            className="p-3 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl flex items-center gap-3 shadow-2xs hover:border-[#ED500A]/40 transition-colors"
                          >
                            {/* Icono con badge */}
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                group.type === "replacement"
                                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                  : "bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20"
                              }`}
                              title={group.type === "replacement" ? "Reemplazo" : "Adicional"}
                            >
                              {group.type === "replacement" ? (
                                <ArrowRightLeft className="w-4 h-4" />
                              ) : (
                                <Tag className="w-4 h-4" />
                              )}
                            </div>

                            {/* Campo 1: Nombre del modificador */}
                            <div className="flex-1 min-w-[140px]">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  Modificador
                                </span>
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md uppercase tracking-wider ${
                                    group.type === "replacement"
                                      ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                                      : "bg-[#ED500A]/15 text-[#ED500A]"
                                  }`}
                                >
                                  {group.type === "replacement" ? "Reemplazo" : "Adicional"}
                                </span>
                              </div>
                              <Input
                                inputSize="sm"
                                value={group.name}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  handleUpdateGroup(gIdx, {
                                    name: val,
                                    options: [{ ...opt, name: val }],
                                  });
                                }}
                                placeholder="Nombre del modificador"
                              />
                            </div>

                            {/* Campo 2: Precio Adicional */}
                            <div className="w-32 sm:w-36 shrink-0">
                              <div className="mb-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                  Precio adicional
                                </span>
                              </div>
                              <Input
                                inputSize="sm"
                                startAdornment={<span className="text-xs font-bold text-slate-400">+$</span>}
                                value={opt.price ? formatNumberWithDots(opt.price) : "0"}
                                onChange={(e) => {
                                  const raw = parseNumberFromDots(e.target.value);
                                  handleUpdateOption(gIdx, 0, { price: raw });
                                }}
                                placeholder="0"
                                className="font-bold font-mono"
                              />
                            </div>

                            {/* Acción: Eliminar */}
                            <div className="shrink-0 self-end mb-0.5">
                              <button
                                type="button"
                                onClick={() => handleRemoveGroup(gIdx)}
                                className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                                title="Quitar modificador de este producto"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
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
                                <Input
                                  inputSize="sm"
                                  value={group.name}
                                  onChange={(e) => handleUpdateGroup(gIdx, { name: e.target.value })}
                                  placeholder="Ej. Opciones de presentación, Tamaños..."
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                  Tipo de modificador
                                </label>
                                <Select
                                  selectSize="sm"
                                  value={group.type || "additional"}
                                  onChange={(e) =>
                                    handleUpdateGroup(gIdx, {
                                      type: e.target.value as "additional" | "size" | "replacement",
                                    })
                                  }
                                >
                                  <option value="additional">Adicional (Extra, accesorio, suplemento...)</option>
                                  <option value="size">Tamaño (Pequeño, Mediano, Grande...)</option>
                                  <option value="replacement">Reemplazo (Sustitución de componente...)</option>
                                </Select>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 mt-5">
                              <button
                                type="button"
                                onClick={() => {
                                  const foundBg = businessGroups.find((bg) => bg.id === group.id);
                                  const groupToEdit: ModifierGroup = foundBg || {
                                    id: group.id || generateId("grp"),
                                    business_id: businessId,
                                    name: group.name,
                                    description: null,
                                    commercial_type: group.type || "additional",
                                    required: Boolean(group.required),
                                    selection_type: (group.max_select ?? 1) === 1 ? "single" : "multiple",
                                    min_select: group.min_select ?? 0,
                                    max_select: group.max_select ?? 1,
                                    sort_order: 0,
                                    status: "active",
                                    applied_product_ids: product?.id ? [product.id] : [],
                                    applied_category_ids: [],
                                    options: group.options.map((o, idx) => ({
                                      id: o.id || generateId("opt"),
                                      option_group_id: group.id || "",
                                      name: o.name,
                                      price: Number(o.price) || 0,
                                      status: o.is_available === false ? "inactive" : "active",
                                      sort_order: idx,
                                    })),
                                  };
                                  setEditingGroupForModal(groupToEdit);
                                  setIsGroupModalOpen(true);
                                }}
                                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
                                title="Editar grupo en ventana completa"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveGroup(gIdx)}
                                className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                                title="Eliminar grupo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
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
                            <div className="w-16">
                              <Input
                                inputSize="sm"
                                type="number"
                                min="1"
                                value={group.max_select ?? 1}
                                onChange={(e) =>
                                  handleUpdateGroup(gIdx, {
                                    max_select: Math.max(1, parseInt(e.target.value, 10) || 1),
                                  })
                                }
                                className="font-mono font-bold text-center"
                              />
                            </div>
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
                                <div className="flex-1">
                                  <Input
                                    inputSize="sm"
                                    value={opt.name}
                                    onChange={(e) =>
                                      handleUpdateOption(gIdx, oIdx, { name: e.target.value })
                                    }
                                    placeholder="Nombre (ej. Queso cheddar)"
                                  />
                                </div>

                                <div className="w-28">
                                  <Input
                                    inputSize="sm"
                                    startAdornment={<span className="text-[10px] text-slate-400 font-bold">+$</span>}
                                    value={opt.price ? formatNumberWithDots(opt.price) : ""}
                                    onChange={(e) =>
                                      handleUpdateOption(gIdx, oIdx, {
                                        price: parseNumberFromDots(e.target.value),
                                      })
                                    }
                                    placeholder="0"
                                    className="font-mono font-bold"
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
                      );
                    })}
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
                    {images[0] ? (
                      <div className="relative shrink-0">
                        <img
                          src={images[0]}
                          alt="Vista previa"
                          className="w-14 h-14 rounded-lg object-cover border border-slate-200 dark:border-white/[0.08]"
                        />
                        {images.length > 1 && (
                          <span className="absolute -bottom-1 -right-1 bg-black/85 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full border border-white/20 shadow-xs">
                            +{images.length - 1}
                          </span>
                        )}
                      </div>
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
                      <div className="flex flex-wrap gap-1.5">
                        {modifierGroups.map((g, idx) => {
                          const isSingle = g.options.length <= 1 && (g.max_select ?? 1) === 1 && !g.required;
                          const optPrice = g.options[0]?.price || 0;
                          return (
                            <span
                              key={g.id || idx}
                              className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                                g.required
                                  ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                                  : isSingle
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                                  : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300"
                              }`}
                            >
                              {isSingle ? (
                                <>
                                  +{g.name || "Modificador"}{" "}
                                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                    {optPrice > 0 ? `(+$ ${formatNumberWithDots(optPrice)})` : "(Gratis)"}
                                  </span>
                                </>
                              ) : (
                                <>
                                  {g.name || "Sin nombre"} {g.required && "*"} ({g.options.length} opciones)
                                </>
                              )}
                            </span>
                          );
                        })}
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
      </CustomModal>

      {/* Modal para 'Asignar Modificadores Existentes' */}
      {isAssignModalOpen && (
        <CustomModal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          title="Asignar Modificadores Existentes"
          description="Selecciona un grupo ya creado en el negocio o en otro producto del catálogo para añadirlo a este producto."
          showConfirmButton={false}
          maxWidth="2xl"
          zIndex="z-[10050]"
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {isLoadingBusinessGroups ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-[#ED500A]" />
                <span className="text-xs">Cargando grupos de modificadores...</span>
              </div>
            ) : allAvailableGroups.length === 0 ? (
              <div className="py-8 px-4 text-center bg-slate-50 dark:bg-white/[0.02] border border-dashed border-slate-200 dark:border-white/[0.08] rounded-xl space-y-2">
                <SlidersHorizontal className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  No hay grupos de modificadores creados aún
                </h5>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Aún no has configurado grupos en la pestaña <strong>Modificadores</strong> ni en otros productos. Puedes crear un grupo directamente desde este producto usando el botón <strong>"Nuevo grupo"</strong>.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  Grupos de modificadores disponibles ({allAvailableGroups.length})
                </span>
                <div className="space-y-2">
                  {allAvailableGroups.map(({ group: grp, source }, idx) => (
                    <div
                      key={grp.id || idx}
                      className="p-3 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl flex items-center justify-between gap-3 shadow-2xs hover:border-[#ED500A]/40 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {grp.name}
                          </h5>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                            {grp.type === "additional"
                              ? "Adicional"
                              : grp.type === "size"
                              ? "Tamaño"
                              : "Reemplazo"}
                          </span>
                          {grp.required && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-red-500/10 text-red-600">
                              Requerido
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400">
                            ({source})
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {grp.options?.map((o) => o.name).join(", ") || "Sin opciones"}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          handleImportModifierGroup(grp);
                          setIsAssignModalOpen(false);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#ED500A]/10 text-[#ED500A] hover:bg-[#ED500A] hover:text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Añadir</span>
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

      {/* Modal de Crear Modificador Individual Directo */}
      {isSingleModifierModalOpen && (
        <SingleModifierModal
          isOpen={isSingleModifierModalOpen}
          businessId={businessId}
          categories={categories}
          products={existingProducts || []}
          initialProductId={product?.id || null}
          onClose={() => setIsSingleModifierModalOpen(false)}
          onSave={handleSaveSingleModifierInProduct}
        />
      )}

      {/* Modal de Crear / Editar Grupo de Modificadores */}
      {isGroupModalOpen && (
        <ModifierGroupModal
          isOpen={isGroupModalOpen}
          businessId={businessId}
          categories={categories}
          products={existingProducts || []}
          group={editingGroupForModal}
          initialProductId={product?.id || null}
          onClose={() => {
            setIsGroupModalOpen(false);
            setEditingGroupForModal(null);
          }}
          onSave={handleSaveGroupInProduct}
        />
      )}
    </>
  );
}
