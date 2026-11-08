"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Input, SearchSelect, Button } from "@/components/ui";
import { formatNumberWithDots, parseNumberFromDots } from "@/lib/pos/types";
import { compressImageForUpload } from "@/lib/storage/client-image-optimizer";
import {
  X,
  Apple,
  Package,
  Layers,
  DollarSign,
  Barcode,
  Tag,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Plus,
  UploadCloud,
  ImageIcon,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Location } from "@/lib/inventory/types";
import {
  Ingredient,
  MaterialType,
  INGREDIENT_UNITS,
} from "@/lib/recipes/types";
import {
  createIngredientAction,
  updateIngredientAction,
  createMaterialCategoryAction,
  uploadMaterialImageAction,
} from "./actions";

interface Props {
  businessId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (ingredient: Ingredient) => void;
  locations?: Location[];
  categories?: { id: string; name: string }[];
  ingredientToEdit?: Ingredient | null;
  availableUnits?: { value: string; label: string }[];
}

export function IngredientFormModal({
  businessId,
  isOpen,
  onClose,
  onSuccess,
  locations = [],
  categories = [],
  ingredientToEdit,
  availableUnits,
}: Props) {
  const isEditing = Boolean(ingredientToEdit);

  // Fusionar unidades estándar completas con las configuradas del negocio para que nunca falte 'paquete', 'caja', 'bolsa', etc.
  const unitOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string }>();
    INGREDIENT_UNITS.forEach((u) => {
      map.set(u.value.toLowerCase(), { value: u.value, label: u.label });
    });
    if (availableUnits && availableUnits.length > 0) {
      availableUnits.forEach((u) => {
        const key = u.value.toLowerCase();
        if (!map.has(key)) {
          map.set(key, u);
        }
      });
    }
    return Array.from(map.values());
  }, [availableUnits]);

  // Información Básica
  const [name, setName] = useState("");
  const [type, setType] = useState<MaterialType>("ingredient");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [unit, setUnit] = useState("unidad");
  const [status, setStatus] = useState<"active" | "inactive">("active");

  // Categorías locales y creación rápida en el formulario [CAT-SCOPE-001]
  const [localCategories, setLocalCategories] = useState<{ id: string; name: string }[]>(categories);
  const [showQuickCategory, setShowQuickCategory] = useState(false);
  const [quickCategoryName, setQuickCategoryName] = useState("");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  const handleQuickCategoryCreate = async () => {
    const trimmed = quickCategoryName.trim();
    if (!trimmed) return;
    setIsCreatingCategory(true);
    try {
      const res = await createMaterialCategoryAction(businessId, { name: trimmed });
      if (res.success && res.data) {
        setLocalCategories((prev) => [...prev, res.data!]);
        setCategoryId(res.data.id);
        setShowQuickCategory(false);
        setQuickCategoryName("");
        toast.success(`Categoría «${res.data.name}» creada y asignada`);
      } else {
        toast.error("Error al crear categoría", { description: res.error });
      }
    } catch (err: any) {
      toast.error("Error al crear categoría", { description: err?.message });
    } finally {
      setIsCreatingCategory(false);
    }
  };

  // Información de Inventario
  const [trackStock, setTrackStock] = useState(true);
  const [initialStock, setInitialStock] = useState("0");
  const [minStock, setMinStock] = useState("0");
  const [maxStock, setMaxStock] = useState("");
  const [costDisplay, setCostDisplay] = useState(
    ingredientToEdit?.costPerUnit ? formatNumberWithDots(ingredientToEdit.costPerUnit) : ""
  );
  const [costPerUnit, setCostPerUnit] = useState(
    ingredientToEdit?.costPerUnit ? String(ingredientToEdit.costPerUnit) : ""
  );
  const [locationId, setLocationId] = useState(locations[0]?.id || "");
  const [availableInPos, setAvailableInPos] = useState(false);
  const [availableInQr, setAvailableInQr] = useState(false);

  // Fotografía opcional del material
  const [imageUrl, setImageUrl] = useState<string | null>(ingredientToEdit?.imageUrl || null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(ingredientToEdit?.imageUrl || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Formato no compatible", {
        description: "Por favor selecciona un archivo JPG, PNG o WebP.",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Archivo demasiado pesado", {
        description: "La fotografía original no debe superar 5MB.",
      });
      return;
    }

    try {
      setIsUploadingImage(true);
      const compressed = await compressImageForUpload(file, 800, 0.82);
      setSelectedFile(compressed);
      setPreviewUrl(URL.createObjectURL(compressed));
    } catch (err: any) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveImage = () => {
    setImageUrl(null);
    setPreviewUrl(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Opciones normalizadas para el componente personalizado SearchSelect
  const unitSelectOptions = useMemo(() => {
    return unitOptions.map((u) => ({
      value: u.value,
      label: u.label,
    }));
  }, [unitOptions]);

  const categorySelectOptions = useMemo(() => {
    const list: Array<{ value: string; label: string }> = [
      { value: "", label: "-- Sin categoría asignada --" },
    ];
    localCategories.forEach((c) => {
      list.push({ value: c.id, label: c.name });
    });
    return list;
  }, [localCategories]);

  const statusSelectOptions = useMemo(
    () => [
      { value: "active", label: "Activo (Disponible para recetas y compras)" },
      { value: "inactive", label: "Inactivo (Oculto para nuevas recetas)" },
    ],
    []
  );

  useEffect(() => {
    if (ingredientToEdit) {
      setName(ingredientToEdit.name);
      setType(ingredientToEdit.type || "ingredient");
      setDescription(ingredientToEdit.notes || "");
      setCategoryId(ingredientToEdit.categoryId || "");
      setSku(ingredientToEdit.sku || "");
      setBarcode(ingredientToEdit.barcode || "");
      setUnit(ingredientToEdit.unit || "unidad");
      setStatus(ingredientToEdit.isAvailable ? "active" : "inactive");
      setCostDisplay(ingredientToEdit.costPerUnit ? formatNumberWithDots(ingredientToEdit.costPerUnit) : "");
      setCostPerUnit(ingredientToEdit.costPerUnit ? String(ingredientToEdit.costPerUnit) : "");
      setInitialStock(String(ingredientToEdit.stockQuantity || "0"));
      setMinStock(String(ingredientToEdit.minStock || "0"));
      setMaxStock(
        ingredientToEdit.maxStock !== null &&
        ingredientToEdit.maxStock !== undefined &&
        Number(ingredientToEdit.maxStock) > 0
          ? String(ingredientToEdit.maxStock)
          : ""
      );
      setLocationId(ingredientToEdit.locationId || locations[0]?.id || "");
      setImageUrl(ingredientToEdit.imageUrl || null);
      setPreviewUrl(ingredientToEdit.imageUrl || null);
      setSelectedFile(null);
      setAvailableInPos(Boolean(ingredientToEdit.availableInPos));
      setAvailableInQr(Boolean(ingredientToEdit.availableInQr));
      setTrackStock(true);
      setErrors({});
    } else {
      setName("");
      setType("ingredient");
      setDescription("");
      setCategoryId("");
      setSku("");
      setBarcode("");
      setUnit("unidad");
      setStatus("active");
      setCostDisplay("");
      setCostPerUnit("");
      setInitialStock("0");
      setMinStock("0");
      setMaxStock("");
      setLocationId(locations[0]?.id || "");
      setImageUrl(null);
      setPreviewUrl(null);
      setSelectedFile(null);
      setAvailableInPos(false);
      setAvailableInQr(false);
      setTrackStock(true);
      setErrors({});
    }
  }, [ingredientToEdit, isOpen, locations]);

  if (!isOpen) return null;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "El nombre del material es obligatorio.";
    }

    if (!unit.trim()) {
      newErrors.unit = "La unidad de medida es requerida.";
    }

    const costNum = parseFloat(costPerUnit) || 0;
    if (costNum < 0) {
      newErrors.costPerUnit = "El costo unitario no puede ser negativo.";
    }

    const initialNum = parseFloat(initialStock) || 0;
    if (initialNum < 0) {
      newErrors.initialStock = "El stock inicial no puede ser negativo.";
    }

    const minNum = parseFloat(minStock) || 0;
    if (minNum < 0) {
      newErrors.minStock = "El stock mínimo no puede ser negativo.";
    }

    const maxNum = maxStock && maxStock.trim() !== "" ? parseFloat(maxStock) : null;
    // El stock máximo es opcional: vacío o 0 significa "sin límite". Solo es inválido si se ingresa un valor positivo menor al mínimo
    if (maxNum !== null && !isNaN(maxNum) && maxNum > 0 && maxNum < minNum) {
      newErrors.maxStock = "El stock máximo no puede ser menor que el stock mínimo.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Por favor revisa los campos señalados.");
      return;
    }

    const costNum = Math.max(0, parseNumberFromDots(costDisplay) || parseFloat(costPerUnit) || 0);
    const initialNum = Math.max(0, parseFloat(initialStock) || 0);
    const minNum = Math.max(0, parseFloat(minStock) || 0);
    const maxNum =
      maxStock && maxStock.trim() !== "" && parseFloat(maxStock) > 0
        ? parseFloat(maxStock)
        : null;

    setIsSubmitting(true);
    let finalImageUrl = imageUrl;

    try {
      // Subir archivo nuevo a Supabase Storage si se seleccionó uno
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        if (ingredientToEdit?.imageUrl) {
          formData.append("previousUrl", ingredientToEdit.imageUrl);
        }
        if (ingredientToEdit?.id) {
          formData.append("ingredientId", ingredientToEdit.id);
        }
        const uploadRes = await uploadMaterialImageAction(businessId, formData);
        if (uploadRes.success && uploadRes.url) {
          finalImageUrl = uploadRes.url;
        } else {
          toast.error("Error al subir la fotografía", {
            description: uploadRes.error || "No se pudo almacenar la imagen en Storage.",
          });
          setIsSubmitting(false);
          return;
        }
      }

      if (isEditing && ingredientToEdit) {
        const res = await updateIngredientAction(businessId, ingredientToEdit.id, {
          name: name.trim(),
          type,
          unit,
          costPerUnit: costNum,
          currentStock: initialNum,
          minStock: minNum,
          maxStock: maxNum,
          sku: sku.trim() || null,
          barcode: barcode.trim() || null,
          locationId: locationId || undefined,
          categoryId: categoryId || undefined,
          imageUrl: finalImageUrl,
          availableInPos,
          availableInQr,
          isAvailable: status === "active",
          status,
          notes: description.trim() || undefined,
        });

        if (!res.success || !res.data) {
          const errMsg = res.error || "Verifica los datos e intenta nuevamente.";
          if (errMsg.toLowerCase().includes("sku")) {
            setErrors((prev) => ({ ...prev, sku: errMsg }));
          } else if (errMsg.toLowerCase().includes("código de barras")) {
            setErrors((prev) => ({ ...prev, barcode: errMsg }));
          }
          toast.error("Error al actualizar material", { description: errMsg });
          return;
        }

        toast.success(
          type === "supply" ? "Insumo actualizado exitosamente" : "Ingrediente actualizado exitosamente"
        );
        onSuccess(res.data);
      } else {
        const res = await createIngredientAction(businessId, {
          name: name.trim(),
          type,
          unit,
          costPerUnit: costNum,
          initialStock: initialNum,
          minStock: minNum,
          maxStock: maxNum,
          sku: sku.trim() || null,
          barcode: barcode.trim() || null,
          locationId: locationId || undefined,
          categoryId: categoryId || undefined,
          imageUrl: finalImageUrl,
          availableInPos,
          availableInQr,
          availableOnline: false,
          notes: description.trim() || undefined,
        });

        if (!res.success || !res.data) {
          const errMsg = res.error || "Verifica los datos e intenta nuevamente.";
          if (errMsg.toLowerCase().includes("sku")) {
            setErrors((prev) => ({ ...prev, sku: errMsg }));
          } else if (errMsg.toLowerCase().includes("código de barras")) {
            setErrors((prev) => ({ ...prev, barcode: errMsg }));
          }
          toast.error("Error al registrar material", { description: errMsg });
          return;
        }

        toast.success(
          type === "supply" ? "Insumo creado exitosamente" : "Ingrediente creado exitosamente",
          {
            description: `«${res.data.name}» fue dado de alta con ${res.data.stockQuantity} ${res.data.unit} en Inventario.`,
          }
        );
        onSuccess(res.data);
      }

      onClose();
    } catch (err: any) {
      toast.error("Error inesperado al guardar", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#ED500A]/10 border border-[#ED500A]/20 flex items-center justify-center text-[#ED500A] shrink-0">
                {type === "supply" ? <Layers className="w-5 h-5" /> : <Apple className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {isEditing
                    ? `Editar ${type === "supply" ? "Insumo" : "Ingrediente"}`
                    : `Crear Nuevo ${type === "supply" ? "Insumo" : "Ingrediente"}`}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {type === "supply"
                    ? "Material o suministro operativo (empaques, envases, limpieza)"
                    : "Materia prima utilizada para preparar productos y recetas"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Formulario */}
          <form id="ingredient-form" onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
            {/* SECCIÓN 1: INFORMACIÓN BÁSICA */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.08] pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-[#ED500A]" />
                  <span>1. Información Básica</span>
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">Entidad única de material</span>
              </div>

              {/* Selector de Tipo (Ingrediente vs Insumo) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Clasificación del Material <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setType("ingredient")}
                    className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      type === "ingredient"
                        ? "border-[#ED500A] bg-[#ED500A]/10 text-slate-900 dark:text-white shadow-xs font-semibold ring-1 ring-[#ED500A]"
                        : "border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/[0.15]"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        type === "ingredient"
                          ? "bg-[#ED500A]/15 text-[#ED500A]"
                          : "bg-slate-100 dark:bg-white/[0.06] text-slate-400"
                      }`}
                    >
                      <Apple className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">Ingrediente</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Para recetas y platos</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType("supply")}
                    className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      type === "supply"
                        ? "border-[#ED500A] bg-[#ED500A]/10 text-slate-900 dark:text-white shadow-xs font-semibold ring-1 ring-[#ED500A]"
                        : "border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/[0.15]"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        type === "supply"
                          ? "bg-[#ED500A]/15 text-[#ED500A]"
                          : "bg-slate-100 dark:bg-white/[0.06] text-slate-400"
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">Insumo</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Empaques, bolsas, aseo</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Fotografía Opcional del Material */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 font-body">
                    Fotografía del Artículo (Opcional)
                  </label>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">1 imagen • Máx 5MB</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageSelect}
                  className="hidden"
                />

                {previewUrl ? (
                  <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08]">
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 shrink-0 shadow-xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Vista previa"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        Fotografía adjunta
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        {selectedFile
                          ? `Archivo optimizado (${Math.round(selectedFile.size / 1024)} KB)`
                          : "Fotografía cargada"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingImage || isSubmitting}
                          className="text-[11px] text-[#ED500A] hover:underline font-bold cursor-pointer"
                        >
                          Cambiar
                        </button>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          disabled={isUploadingImage || isSubmitting}
                          className="text-[11px] text-rose-500 hover:underline font-bold cursor-pointer"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage || isSubmitting}
                    className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl border border-dashed border-slate-300 dark:border-white/15 hover:border-[#ED500A]/50 bg-slate-50/50 dark:bg-white/[0.02] hover:bg-[#ED500A]/5 transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    {isUploadingImage ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#ED500A]" />
                    ) : (
                      <UploadCloud className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="text-xs font-semibold">Subir fotografía del artículo</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">(JPG, PNG o WebP)</span>
                  </button>
                )}
              </div>

              {/* Nombre y Unidad */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Nombre del {type === "supply" ? "Insumo" : "Ingrediente"} <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
                    }}
                    placeholder={type === "supply" ? "Ej: Caja de Hamburguesa Kraft" : "Ej: Carne de Res Molida"}
                    inputSize="md"
                    className={errors.name ? "border-rose-500 focus:ring-rose-500" : ""}
                  />
                  {errors.name && (
                    <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{errors.name}</span>
                    </p>
                  )}
                </div>

                <div>
                  <SearchSelect
                    label="Unidad de Medida"
                    required
                    options={unitSelectOptions}
                    value={unit}
                    onChange={(val) => {
                      setUnit(val);
                      if (errors.unit) setErrors((prev) => ({ ...prev, unit: "" }));
                    }}
                    placeholder="Seleccionar unidad..."
                    searchPlaceholder="Buscar unidad (kg, g, lt, un)..."
                    emptyText="No se encontró la unidad"
                    clearable={false}
                    error={errors.unit}
                    selectSize="md"
                  />
                </div>
              </div>

              {/* Categoría y Estado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 font-body">
                      Categoría
                    </label>
                    {!showQuickCategory && (
                      <button
                        type="button"
                        onClick={() => setShowQuickCategory(true)}
                        className="text-[11px] text-[#ED500A] hover:underline font-bold flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Nueva</span>
                      </button>
                    )}
                  </div>

                  {showQuickCategory ? (
                    <div className="p-2.5 rounded-2xl border border-[#ED500A]/30 bg-[#ED500A]/5 space-y-2 animate-in fade-in duration-150">
                      <Input
                        type="text"
                        inputSize="sm"
                        value={quickCategoryName}
                        onChange={(e) => setQuickCategoryName(e.target.value)}
                        placeholder="Ej. Lácteos, Carnes, Empaques..."
                        autoFocus
                        onKeyDown={(e) =>
                          e.key === "Enter" && (e.preventDefault(), handleQuickCategoryCreate())
                        }
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setShowQuickCategory(false);
                            setQuickCategoryName("");
                          }}
                          className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleQuickCategoryCreate}
                          disabled={isCreatingCategory || !quickCategoryName.trim()}
                          className="text-[11px] h-7 px-2.5 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white"
                        >
                          {isCreatingCategory ? "Creando..." : "Crear"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <SearchSelect
                      options={categorySelectOptions}
                      value={categoryId}
                      onChange={(val) => setCategoryId(val)}
                      placeholder="Seleccionar categoría..."
                      searchPlaceholder="Buscar categoría..."
                      emptyText="No se encontraron categorías"
                      clearable={false}
                      selectSize="md"
                    />
                  )}
                </div>

                <div>
                  <SearchSelect
                    label="Estado Operativo"
                    options={statusSelectOptions}
                    value={status}
                    onChange={(val) => setStatus(val as "active" | "inactive")}
                    placeholder="Seleccionar estado..."
                    searchPlaceholder="Buscar estado..."
                    clearable={false}
                    selectSize="md"
                  />
                </div>
              </div>

              {/* SKU y Código de Barras */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    SKU o Referencia Interna (Opcional)
                  </label>
                  <Input
                    type="text"
                    value={sku}
                    onChange={(e) => {
                      setSku(e.target.value);
                      if (errors.sku) setErrors((prev) => ({ ...prev, sku: "" }));
                    }}
                    placeholder="Ej: MAT-0012"
                    inputSize="md"
                    className={errors.sku ? "border-rose-500" : ""}
                  />
                  {errors.sku && (
                    <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{errors.sku}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Código de Barras (Opcional)
                  </label>
                  <Input
                    type="text"
                    value={barcode}
                    onChange={(e) => {
                      setBarcode(e.target.value);
                      if (errors.barcode) setErrors((prev) => ({ ...prev, barcode: "" }));
                    }}
                    placeholder="Ej: 7701234567890"
                    startAdornment={<Barcode className="w-4 h-4 text-slate-400" />}
                    inputSize="md"
                    className={errors.barcode ? "border-rose-500" : ""}
                  />
                  {errors.barcode && (
                    <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{errors.barcode}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: INFORMACIÓN DE INVENTARIO */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.08] pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 text-[#ED500A]" />
                  <span>2. Control de Existencias y Costos ({unit})</span>
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  Integrado con Kardex
                </span>
              </div>

              {/* Costo Unitario / Costo por Paquete */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 font-body">
                  {unit === "paquete"
                    ? "Costo por Paquete (COP)"
                    : `Costo Unitario por ${unit} (COP)`}
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={costDisplay}
                  onChange={(e) => {
                    const formatted = formatNumberWithDots(e.target.value);
                    setCostDisplay(formatted);
                    const raw = parseNumberFromDots(e.target.value);
                    setCostPerUnit(raw > 0 ? String(raw) : "");
                  }}
                  placeholder="Ej: 10.500"
                  startAdornment={<span className="text-sm font-bold text-slate-400">$</span>}
                  inputSize="md"
                  className="font-mono font-bold"
                />
              </div>

              {/* Parámetros de Stock */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isEditing ? "Stock Actual (Existencias)" : "Stock Inicial (Apertura)"}
                  </label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={initialStock}
                    onChange={(e) => {
                      setInitialStock(e.target.value);
                      if (errors.initialStock) setErrors((prev) => ({ ...prev, initialStock: "" }));
                    }}
                    placeholder="0"
                    inputSize="md"
                    className={errors.initialStock ? "border-rose-500" : ""}
                  />
                  {errors.initialStock && (
                    <p className="text-[11px] text-rose-500 mt-1">{errors.initialStock}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Stock Mínimo (Alerta)
                  </label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={minStock}
                    onChange={(e) => {
                      setMinStock(e.target.value);
                      if (errors.minStock) setErrors((prev) => ({ ...prev, minStock: "" }));
                      if (errors.maxStock) setErrors((prev) => ({ ...prev, maxStock: "" }));
                    }}
                    placeholder="0"
                    inputSize="md"
                    className={errors.minStock ? "border-rose-500" : ""}
                  />
                  {errors.minStock && (
                    <p className="text-[11px] text-rose-500 mt-1">{errors.minStock}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Stock Máximo (Opcional)
                  </label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={maxStock}
                    onChange={(e) => {
                      setMaxStock(e.target.value);
                      if (errors.maxStock) setErrors((prev) => ({ ...prev, maxStock: "" }));
                    }}
                    placeholder="Sin límite"
                    inputSize="md"
                    className={errors.maxStock ? "border-rose-500" : ""}
                  />
                  {errors.maxStock && (
                    <p className="text-[11px] text-rose-500 mt-1">{errors.maxStock}</p>
                  )}
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: NOTAS Y OBSERVACIONES */}
            <div className="space-y-1.5 pt-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Descripción u Observaciones (Opcional)</span>
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Proveedor sugerido, temperatura de conservación, notas de manipulación..."
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#0B0D14] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] transition-all resize-none"
              />
            </div>
          </form>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="ingredient-form"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <span>
                  {isEditing
                    ? `Guardar ${type === "supply" ? "Insumo" : "Ingrediente"}`
                    : `Crear ${type === "supply" ? "Insumo" : "Ingrediente"}`}
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
