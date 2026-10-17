"use client";

import React, { useState, useTransition, useRef, useEffect } from "react";
import { CustomModal } from "@/components/ui/custom-modal";
import {
  Product,
  Category,
  ProductModifierGroup,
  ProductModifierOption,
  ProductVariant,
  getEffectiveVariantIngredients,
  CreateProductSchema,
} from "@/lib/products/types";
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
  Layers,
  Image as ImageIcon,
  Loader2,
  Package,
  Sparkles,
  UploadCloud,
  X,
  Clock,
  Tag,
  Barcode,
  UtensilsCrossed,
  FolderPlus,
  Calendar,
} from "lucide-react";
import {
  CommercialActivity,
  getDefaultActivitiesForBusinessType,
  hasCommercialActivity,
} from "@/config/commercial-activities";


interface Props {
  businessId: string;
  businessType?: string;
  commercialActivities?: CommercialActivity[];
  categories: Category[];
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (product: Product) => void;
  onCategoryCreated?: (newCategory: Category) => void;
  initialCategoryId?: string | null;
}

type FormData = z.input<typeof CreateProductSchema>;

export function ProductFormModal({
  businessId,
  businessType = "restaurant",
  commercialActivities,
  categories,
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

  const isRetailBusiness =
    canSellProducts &&
    (normalizedBizType.includes("tienda") ||
      normalizedBizType.includes("retail") ||
      normalizedBizType.includes("ferret") ||
      normalizedBizType.includes("moda") ||
      normalizedBizType.includes("fashion") ||
      normalizedBizType.includes("hardware") ||
      normalizedBizType.includes("stationery") ||
      normalizedBizType.includes("technology") ||
      normalizedBizType.includes("pharmacy") ||
      normalizedBizType.includes("pets") ||
      normalizedBizType.includes("mercado"));

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

  // Campos comerciales opcionales (SKU, código de barras, marca, stock para comercios minoristas)
  const [sku, setSku] = useState<string>(existingMeta.sku || "");
  const [barcode, setBarcode] = useState<string>(existingMeta.barcode || "");
  const [brand, setBrand] = useState<string>(existingMeta.brand || "");
  const [unit, setUnit] = useState<string>(existingMeta.unit || "unidad");
  const [trackStock, setTrackStock] = useState<boolean>(Boolean(existingMeta.track_stock));
  const [stockQuantity, setStockQuantity] = useState<number>(existingMeta.stock_quantity ?? 0);
  const [durationMinutes, setDurationMinutes] = useState<number>(existingMeta.duration_minutes ?? 30);

  // Gastronomía opcional
  const initialGroups: ProductModifierGroup[] = existingMeta.modifier_groups || [];
  const [modifierGroups, setModifierGroups] = useState<ProductModifierGroup[]>(initialGroups);
  const [allergensText, setAllergensText] = useState<string>(
    Array.isArray(existingMeta.allergens) ? existingMeta.allergens.join(", ") : ""
  );
  const [ingredients, setIngredients] = useState<string>(existingMeta.ingredients || "");
  const [showGastronomySection, setShowGastronomySection] = useState<boolean>(
    isFoodBusiness ||
      initialGroups.length > 0 ||
      Boolean(existingMeta.ingredients) ||
      Boolean(existingMeta.allergens?.length)
  );

  // Variantes y tamaños comerciales
  const initialVariants: ProductVariant[] = existingMeta.variants || [];
  const [hasVariants, setHasVariants] = useState<boolean>(
    Boolean(existingMeta.has_variants || initialVariants.length > 0)
  );
  const [variants, setVariants] = useState<ProductVariant[]>(initialVariants);
  const [previewVariantId, setPreviewVariantId] = useState<string | null>(
    initialVariants[0]?.id || null
  );

  const handleAddVariant = () => {
    const newVariant: ProductVariant = {
      id: crypto.randomUUID ? crypto.randomUUID() : `var_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: "",
      price: 0,
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

  const handleRemoveVariant = (variantIndex: number) => {
    const next = variants.filter((_, idx) => idx !== variantIndex);
    setVariants(next);
    if (previewVariantId && !next.some((v) => v.id === previewVariantId)) {
      setPreviewVariantId(next[0]?.id || null);
    }
  };

  const handleUpdateVariant = (variantIndex: number, updates: Partial<ProductVariant>) => {
    setVariants(
      variants.map((v, idx) => (idx === variantIndex ? { ...v, ...updates } : v))
    );
  };

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
    setPriceDisplay(product?.price ? formatNumberWithDots(product.price) : "");
    const meta = (product?.metadata as any) || {};
    setAllergensText(Array.isArray(meta.allergens) ? meta.allergens.join(", ") : "");
    setIngredients(meta.ingredients || "");
    setProductType(
      isFoodBusiness
        ? "product"
        : meta.product_type || (product ? "product" : defaultProductType)
    );
  }, [product, isFoodBusiness, defaultProductType]);

  const productNameWatch = watch("name");
  const priceWatch = watch("price");

  // Creación rápida de categoría al vuelo sin salir del formulario
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

  // Manejo de carga de imagen física a Supabase Storage
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

  // Modificadores gastronómicos
  const handleAddGroup = () => {
    const newGroup: ProductModifierGroup = {
      id: crypto.randomUUID ? crypto.randomUUID() : `group_${Date.now()}`,
      name: "",
      required: false,
      min_select: 0,
      max_select: 1,
      options: [],
    };
    setModifierGroups([...modifierGroups, newGroup]);
    setShowGastronomySection(true);
  };

  const handleRemoveGroup = (groupIndex: number) => {
    setModifierGroups(modifierGroups.filter((_, idx) => idx !== groupIndex));
  };

  const handleUpdateGroup = (groupIndex: number, updates: Partial<ProductModifierGroup>) => {
    setModifierGroups(
      modifierGroups.map((grp, idx) => (idx === groupIndex ? { ...grp, ...updates } : grp))
    );
  };

  const handleAddOption = (groupIndex: number) => {
    const newOption: ProductModifierOption = {
      id: crypto.randomUUID ? crypto.randomUUID() : `opt_${Date.now()}_${Math.random()}`,
      name: "",
      price: 0,
      is_available: true,
    };
    setModifierGroups(
      modifierGroups.map((grp, idx) =>
        idx === groupIndex ? { ...grp, options: [...grp.options, newOption] } : grp
      )
    );
  };

  const handleRemoveOption = (groupIndex: number, optionIndex: number) => {
    setModifierGroups(
      modifierGroups.map((grp, idx) =>
        idx === groupIndex
          ? { ...grp, options: grp.options.filter((_, oIdx) => oIdx !== optionIndex) }
          : grp
      )
    );
  };

  const handleUpdateOption = (
    groupIndex: number,
    optionIndex: number,
    updates: Partial<ProductModifierOption>
  ) => {
    setModifierGroups(
      modifierGroups.map((grp, gIdx) =>
        gIdx === groupIndex
          ? {
              ...grp,
              options: grp.options.map((opt, oIdx) =>
                oIdx === optionIndex ? { ...opt, ...updates } : opt
              ),
            }
          : grp
      )
    );
  };

  const onSubmit = (data: FormData) => {
    // Validar variantes si están activadas
    if (hasVariants) {
      if (variants.length === 0) {
        toast.error("Has activado tamaños/variantes. Debes añadir al menos una variante.");
        return;
      }
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        if (!v.name.trim()) {
          toast.error(`La presentación #${i + 1} requiere un nombre (ej. Personal, Mediana, etc.).`);
          return;
        }
        if (v.price < 0 || !Number.isFinite(v.price)) {
          toast.error(`El precio de la presentación «${v.name}» debe ser numérico y no negativo.`);
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
        toast.error(`En "${grp.name}", la cantidad mínima no puede ser mayor que la máxima.`);
        return;
      }
      for (let j = 0; j < grp.options.length; j++) {
        const opt = grp.options[j];
        if (!opt.name.trim()) {
          toast.error(`La opción #${j + 1} del grupo "${grp.name}" requiere un nombre.`);
          return;
        }
        if (opt.price < 0 || !Number.isFinite(opt.price)) {
          toast.error(`El precio adicional de "${opt.name}" debe ser numérico y no negativo.`);
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

      // Normalizar manteniendo nombres legibles y sin duplicados
      const seenAllergens = new Set<string>();
      const allergensArray: string[] = [];
      for (const item of rawAllergens) {
        const lower = item.toLowerCase();
        if (!seenAllergens.has(lower)) {
          seenAllergens.add(lower);
          allergensArray.push(item);
        }
      }

      const payloadMetadata = {
        ...existingMeta,
        product_type: isFoodBusiness ? "product" : productType,
        sku:
          !isFoodBusiness && productType === "product" && sku.trim()
            ? sku.trim()
            : isFoodBusiness
            ? existingMeta.sku || null
            : null,
        barcode:
          !isFoodBusiness && productType === "product" && barcode.trim()
            ? barcode.trim()
            : isFoodBusiness
            ? existingMeta.barcode || null
            : null,
        brand:
          !isFoodBusiness && productType === "product" && brand.trim()
            ? brand.trim()
            : isFoodBusiness
            ? existingMeta.brand || null
            : null,
        unit:
          !isFoodBusiness && productType === "product"
            ? unit.trim() || "unidad"
            : isFoodBusiness
            ? existingMeta.unit || "unidad"
            : null,
        track_stock:
          !isFoodBusiness && productType === "product"
            ? trackStock
            : isFoodBusiness
            ? Boolean(existingMeta.track_stock)
            : false,
        stock_quantity:
          !isFoodBusiness && productType === "product" && trackStock
            ? stockQuantity
            : isFoodBusiness
            ? existingMeta.stock_quantity ?? null
            : null,
        duration_minutes: productType === "service" ? durationMinutes : null,
        allergens: allergensArray,
        ingredients: ingredients.trim() || null,
        has_variants: hasVariants,
        variants: hasVariants ? variants : [],
        modifier_groups: modifierGroups.length > 0 ? modifierGroups : [],
      };

      let calculatedBasePrice = data.price;
      if (hasVariants && variants.length > 0 && (!calculatedBasePrice || calculatedBasePrice === 0)) {
        calculatedBasePrice = Math.min(...variants.map((v) => v.price));
      }

      const payload = {
        ...data,
        price: calculatedBasePrice,
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
        toast.success(product ? "Producto actualizado" : "Producto creado con éxito");
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
      description={
        isFoodBusiness
          ? "Configura la información gastronómica, receta, variantes y disponibilidad de tu producto."
          : "Configura la información comercial, fotografía y atributos adaptados a tu negocio."
      }
      showConfirmButton={false}
      maxWidth="5xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-1 max-h-[80vh] overflow-y-auto px-2 py-1">
        {/* Selector de Tipo: Oculto para negocios de actividad única (ej. restaurante de comida rápida); visible ÚNICAMENTE para negocios híbridos que venden productos Y prestan servicios */}
        {isHybrid && (
          <div className="flex items-center gap-3 p-1.5 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 w-full sm:w-fit">
            <button
              type="button"
              onClick={() => setProductType("product")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                productType === "product"
                  ? "bg-white dark:bg-[#10141d] text-[#ED500A] shadow-xs"
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
                  ? "bg-white dark:bg-[#10141d] text-[#ED500A] shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Servicio</span>
            </button>
          </div>
        )}

        {/* Contenido en 2 Columnas Balanceadas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Columna Izquierda: Información Principal, Comercial y Receta */}
          <div className="space-y-4">
            {/* Nombre */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Nombre del {isFoodBusiness ? "producto" : productType === "service" ? "servicio" : "producto"} *
              </label>
              <input
                {...register("name")}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ED500A]/50 transition-all"
                placeholder={
                  productType === "service"
                    ? "Ej. Corte de cabello degradado, Asesoría contable..."
                    : isFoodBusiness
                    ? "Ej. Salchipapa Especial, Hamburguesa Doble, Perro Suizo..."
                    : "Ej. Camiseta Polo, Taladro Percutor, Pantalón Jean..."
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
                rows={3}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ED500A]/50 resize-none transition-all"
                placeholder="Detalla los beneficios, características o presentación..."
              />
            </div>

            {/* Precio y Categoría con Creador Rápido Integrado */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  {hasVariants ? "Precio de Referencia (COP)" : "Precio Base (COP) *"}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
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
                    className="w-full pl-8 pr-3.5 py-2.5 bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-white/10 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#ED500A]/50 transition-all"
                    placeholder="0"
                  />
                </div>
                {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price.message}</p>}
              </div>

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
                  <div className="p-2.5 bg-slate-50 dark:bg-white/5 border border-[#ED500A]/40 rounded-xl space-y-2 animate-in fade-in duration-100">
                    <input
                      type="text"
                      value={quickCategoryName}
                      onChange={(e) => setQuickCategoryName(e.target.value)}
                      placeholder="Nombre de categoría..."
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-white/10 rounded-lg text-xs"
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
                        {isCreatingCategory ? "Creando..." : "Crear y seleccionar"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <select
                    {...register("category_id")}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ED500A]/50 transition-all"
                  >
                    <option value="">Sin categoría asignada</option>
                    {Array.from(
                      new Map(
                        localCategories
                          .filter((c) => c.status === "active")
                          .map((c) => [c.name.toLowerCase().trim(), c])
                      ).values()
                    ).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* INGREDIENTES Y ALÉRGENOS (Para restaurantes / gastronomía / comida rápida) */}
            {isFoodBusiness && (
              <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <UtensilsCrossed className="w-4 h-4 text-[#ED500A]" />
                  <span>Receta e Ingredientes</span>
                </span>

                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Ingredientes principales
                    </label>
                    <input
                      type="text"
                      value={ingredients}
                      onChange={(e) => setIngredients(e.target.value)}
                      placeholder="Ej. Carne artesanal 150g, queso cheddar, tocineta, pan brioche..."
                      className="w-full px-3 py-2 bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-white/10 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#ED500A]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Alérgenos conocidos
                    </label>
                    <input
                      type="text"
                      value={allergensText}
                      onChange={(e) => setAllergensText(e.target.value)}
                      placeholder="Ej. Leche, huevo, trigo (gluten), maní"
                      className="w-full px-3 py-2 bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-white/10 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#ED500A]"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                      Indica los alérgenos presentes en el producto según sus ingredientes y las etiquetas de los productos utilizados. Separa los alérgenos con comas.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* SECCIÓN DE VARIANTES, TAMAÑOS Y PRESENTACIONES */}
            <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#ED500A]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    ¿Ofrece diferentes tamaños o presentaciones?
                  </span>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasVariants}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setHasVariants(enabled);
                      if (enabled && variants.length === 0) {
                        handleAddVariant();
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#ED500A]"></div>
                </label>
              </div>

              {hasVariants && (
                <div className="space-y-3 pt-2 border-t border-slate-200/60 dark:border-white/5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Configura cada presentación con su propio precio, disponibilidad e ingredientes.
                    </p>
                    <button
                      type="button"
                      onClick={handleAddVariant}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#ED500A]/10 text-[#ED500A] hover:bg-[#ED500A]/20 rounded-lg text-xs font-semibold transition-colors shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Añadir variante</span>
                    </button>
                  </div>

                  {variants.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-400 border border-dashed rounded-xl">
                      No has añadido ninguna variante. Haz clic en "Añadir variante" para crear la primera.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {variants.map((variant, vIdx) => (
                        <div
                          key={variant.id || vIdx}
                          className="p-3.5 bg-white dark:bg-[#10141d] border border-slate-200 dark:border-white/10 rounded-xl space-y-3 shadow-2xs"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                                  Nombre de la presentación / tamaño *
                                </label>
                                <input
                                  type="text"
                                  value={variant.name}
                                  onChange={(e) =>
                                    handleUpdateVariant(vIdx, { name: e.target.value })
                                  }
                                  placeholder="Ej. Personal, Mediana, Familiar, $10.000, Talla M..."
                                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-semibold focus:outline-none"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                                  Precio de venta (COP) *
                                </label>
                                <div className="relative">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                    $
                                  </span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={variant.price ? formatNumberWithDots(variant.price) : ""}
                                    onChange={(e) =>
                                      handleUpdateVariant(vIdx, {
                                        price: parseNumberFromDots(e.target.value),
                                      })
                                    }
                                    placeholder="0"
                                    className="w-full pl-6 pr-2.5 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-semibold focus:outline-none"
                                  />
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveVariant(vIdx)}
                              className="p-1.5 text-slate-400 hover:text-red-500 rounded mt-5"
                              title="Eliminar variante"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Configuración de ingredientes / características específicas */}
                          <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-600 dark:text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={variant.inherit_base_ingredients}
                                  onChange={(e) =>
                                    handleUpdateVariant(vIdx, {
                                      inherit_base_ingredients: e.target.checked,
                                    })
                                  }
                                  className="w-3.5 h-3.5 text-[#ED500A] rounded border-slate-300 focus:ring-[#ED500A]"
                                />
                                <span>Heredar ingredientes del producto base</span>
                              </label>

                              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-600 dark:text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={variant.is_available}
                                  onChange={(e) =>
                                    handleUpdateVariant(vIdx, {
                                      is_available: e.target.checked,
                                    })
                                  }
                                  className="w-3.5 h-3.5 text-[#ED500A] rounded border-slate-300 focus:ring-[#ED500A]"
                                />
                                <span>Disponible</span>
                              </label>
                            </div>

                            {!variant.inherit_base_ingredients && (
                              <div className="animate-in fade-in duration-150 pt-1">
                                <label className="block text-[11px] font-medium text-amber-700 dark:text-amber-400 mb-1">
                                  Ingredientes o configuración específica de esta presentación:
                                </label>
                                <textarea
                                  rows={2}
                                  value={variant.specific_ingredients || ""}
                                  onChange={(e) =>
                                    handleUpdateVariant(vIdx, {
                                      specific_ingredients: e.target.value,
                                    })
                                  }
                                  placeholder="Ej. Papas criollas, doble salchicha manguera, tocineta, queso rallado..."
                                  className="w-full px-2.5 py-1.5 bg-amber-50/50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-lg text-xs focus:outline-none"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SECCIÓN ADAPTATIVA SEGÚN TIPO: SERVICIO */}
            {productType === "service" && (
              <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#ED500A]" />
                    <span>Duración Estimada (Minutos)</span>
                  </label>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Math.max(5, parseInt(e.target.value, 10) || 30))}
                    className="w-full sm:w-48 px-3 py-2 bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ED500A]/50"
                    placeholder="30"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Permite estimar el tiempo del servicio en la atención al cliente o agendamiento.
                  </p>
                </div>

                {canManageAppointments && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs">
                    <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>Este servicio estará disponible para reserva en la gestión de citas y turnos.</span>
                  </div>
                )}
              </div>
            )}

            {/* SECCIÓN ADAPTATIVA: DATOS COMERCIALES Y RETAIL (Solo para comercios minoristas y tiendas; oculta en restaurantes y comida rápida) */}
            {!isFoodBusiness && productType === "product" && (
              <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-[#ED500A]" />
                    <span>Datos de Comercio e Inventario</span>
                  </span>
                </div>

                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">
                        Código / Referencia SKU
                      </label>
                      <input
                        type="text"
                        value={sku}
                        onChange={(e) => setSku(e.target.value)}
                        placeholder="Ej. REF-001"
                        className="w-full px-3 py-2 bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-white/10 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#ED500A]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">
                        Código de Barras
                      </label>
                      <div className="relative">
                        <Barcode className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={barcode}
                          onChange={(e) => setBarcode(e.target.value)}
                          placeholder="770..."
                          className="w-full pl-8 pr-3 py-2 bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-white/10 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#ED500A]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">
                        Marca
                      </label>
                      <input
                        type="text"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        placeholder="Ej. Propia, Nike, Genérico"
                        className="w-full px-3 py-2 bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-white/10 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#ED500A]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">
                        Unidad de Medida
                      </label>
                      <select
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-white/10 rounded-xl text-xs focus:outline-none"
                      >
                        <option value="unidad">Unidad (ud)</option>
                        <option value="porción">Porción / Plato</option>
                        <option value="kg">Kilogramo (kg)</option>
                        <option value="g">Gramo (g)</option>
                        <option value="litro">Litro (L)</option>
                        <option value="metro">Metro (m)</option>
                        <option value="paquete">Paquete</option>
                        <option value="caja">Caja</option>
                      </select>
                    </div>
                  </div>

                  {/* Control de existencias */}
                  <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={trackStock}
                        onChange={(e) => setTrackStock(e.target.checked)}
                        className="w-4 h-4 text-[#ED500A] rounded border-slate-300 focus:ring-[#ED500A]"
                      />
                      <span>Seguimiento de existencias (Stock)</span>
                    </label>

                    {trackStock && (
                      <div className="pt-1">
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">
                          Cantidad disponible en inventario
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={stockQuantity}
                          onChange={(e) => setStockQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))}
                          className="w-full sm:w-48 px-3 py-1.5 bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-white/10 rounded-xl text-xs focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Disponibilidad para venta */}
            <div className="flex items-center gap-2.5 p-3 bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-xl">
              <input
                type="checkbox"
                id="is_available"
                {...register("is_available")}
                className="w-4 h-4 text-[#ED500A] border-slate-300 rounded focus:ring-[#ED500A]"
              />
              <label htmlFor="is_available" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                Disponible para la venta y visibilidad en catálogo / menú
              </label>
            </div>
          </div>

          {/* Columna Derecha: Almacenamiento de Imagen, Modificadores y Vista Previa */}
          <div className="space-y-4">
            {/* Carga de Imagen */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-[#ED500A]" />
                  <span>Fotografía del producto</span>
                </label>
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

              {/* Contenedor Dropzone / Preview */}
              <div className="relative border-2 border-dashed border-slate-200 dark:border-white/15 rounded-2xl p-4 bg-slate-50/50 dark:bg-white/[0.02] transition-colors hover:border-[#ED500A]/50 text-center">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                />

                {imagePreview ? (
                  <div className="space-y-3">
                    <div className="relative w-full h-44 rounded-xl overflow-hidden bg-slate-100 dark:bg-black/20 border border-slate-200/50 dark:border-white/10 group">
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
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold transition-all shadow-2xs"
                    >
                      <UploadCloud className="w-3.5 h-3.5 text-[#ED500A]" />
                      <span>Cambiar fotografía</span>
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="py-5 px-4 flex flex-col items-center justify-center cursor-pointer group"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                      {isUploadingImage ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <UploadCloud className="w-5 h-5" />
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

            {/* SECCIÓN ADAPTATIVA: OPCIONES, SALSAS Y EXTRAS */}
            <div className="border border-slate-200 dark:border-white/10 rounded-2xl p-4 bg-slate-50/50 dark:bg-white/[0.02] space-y-3.5">
              <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-slate-200/60 dark:border-white/5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center shrink-0">
                    <UtensilsCrossed className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200 truncate">
                      {isFoodBusiness ? "Opciones y Adicionales" : "Personalizaciones"}
                    </h4>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {modifierGroups.length} {modifierGroups.length === 1 ? "grupo configurado" : "grupos configurados"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddGroup}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir grupo</span>
                </button>
              </div>

              {/* Grupos de opciones */}
              <div className="space-y-3">
                {modifierGroups.length === 0 ? (
                  <div className="p-3 text-center bg-white dark:bg-[#10141d] border border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                    <p className="text-xs text-slate-500 italic">
                      Sin opciones configuradas. Haz clic en <strong>"Añadir grupo"</strong> para salsas o extras.
                    </p>
                  </div>
                ) : (
                  modifierGroups.map((group, groupIdx) => (
                    <div
                      key={group.id || groupIdx}
                      className="p-3 bg-white dark:bg-[#10141d] border border-slate-200 dark:border-white/10 rounded-xl space-y-2.5 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <label className="block text-[10px] font-medium text-slate-500 mb-1">
                            Nombre del grupo *
                          </label>
                          <input
                            type="text"
                            value={group.name}
                            onChange={(e) => handleUpdateGroup(groupIdx, { name: e.target.value })}
                            placeholder="Ej. Salsas, Tamaño, Adiciones..."
                            className="w-full px-2.5 py-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-semibold focus:outline-none"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveGroup(groupIdx)}
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded"
                          title="Eliminar grupo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Opciones */}
                      <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-white/5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase text-slate-400">
                            Opciones ({group.options.length})
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddOption(groupIdx)}
                            className="text-[11px] text-[#ED500A] hover:underline font-semibold flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Opción</span>
                          </button>
                        </div>

                        {group.options.map((opt, optIdx) => (
                          <div
                            key={opt.id || optIdx}
                            className="flex items-center gap-2 p-1.5 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200/50 dark:border-white/5"
                          >
                            <input
                              type="text"
                              value={opt.name}
                              onChange={(e) =>
                                handleUpdateOption(groupIdx, optIdx, { name: e.target.value })
                              }
                              placeholder="Nombre (ej. Queso extra)"
                              className="flex-1 px-2 py-0.5 bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-white/10 rounded text-xs"
                            />

                            <div className="w-24 relative">
                              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                                +$
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={opt.price ? formatNumberWithDots(opt.price) : ""}
                                onChange={(e) =>
                                  handleUpdateOption(groupIdx, optIdx, {
                                    price: parseNumberFromDots(e.target.value),
                                  })
                                }
                                placeholder="0"
                                className="w-full pl-5 pr-1 py-0.5 bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-white/10 rounded text-xs"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveOption(groupIdx, optIdx)}
                              className="p-1 text-slate-400 hover:text-red-500 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* VISTA PREVIA INTERACTIVA EN MENÚ / POS */}
            <div className="p-4 bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#ED500A]" />
                  <span>Vista previa en Menú / POS</span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Interactiva</span>
              </div>

              <div className="bg-white dark:bg-[#10141d] border border-slate-200 dark:border-white/10 rounded-xl p-3.5 space-y-3 shadow-2xs">
                <div className="flex items-start gap-3">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Vista previa"
                      className="w-14 h-14 rounded-lg object-cover border border-slate-200 dark:border-white/10 shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center shrink-0">
                      <Package className="w-6 h-6" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h5 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {productNameWatch || "Nombre del producto"}
                    </h5>
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
                      Selecciona presentación:
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

                {/* Ingredientes mostrados en vista previa */}
                {(() => {
                  const activeVar = hasVariants ? variants.find((v) => v.id === previewVariantId) || variants[0] : null;
                  const effIngr = getEffectiveVariantIngredients(ingredients, activeVar);
                  if (!effIngr) return null;
                  return (
                    <div className="p-2 bg-slate-50 dark:bg-white/5 rounded-lg text-[11px] text-slate-600 dark:text-slate-300">
                      <span className="font-semibold text-slate-800 dark:text-white">Ingredientes: </span>
                      <span>{effIngr}</span>
                    </div>
                  );
                })()}

                {/* Alérgenos conocidos en vista previa interactiva */}
                {(() => {
                  const allergensList = allergensText
                    .split(",")
                    .map((a) => a.trim())
                    .filter((a) => a.length > 0);
                  if (allergensList.length === 0) return null;
                  return (
                    <div className="p-2 bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 rounded-lg text-[11px] text-amber-900 dark:text-amber-200">
                      <span className="font-semibold">Alérgenos conocidos: </span>
                      <span>{allergensList.join(", ")}</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Acciones de Guardar / Cancelar */}
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
    </CustomModal>
  );
}
