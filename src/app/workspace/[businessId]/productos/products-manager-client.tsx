"use client";

import React, { useState, useTransition, useMemo } from "react";
import {
  Plus,
  Search,
  Filter,
  FolderKanban,
  PackageSearch,
  MoreVertical,
  Archive,
  Layers,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  Sparkles,
  Layers3,
  Loader2,
  Download,
  Upload,
  Package,
  AlertTriangle,
  Warehouse,
  MapPin,
  Boxes,
  History,
  SlidersHorizontal,
  Store,
  QrCode,
  Globe,
  Barcode,
  Pencil,
  Power,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LayoutGrid,
  List,
  X,
  Trash2,
  Copy,
} from "lucide-react";
import { BarcodeScannerModal } from "@/components/scanner/barcode-scanner-modal";
import {
  Product,
  Category,
  SalesChannel,
  isProductAvailableInPos,
  isProductAvailableInQr,
  isProductAvailableOnline,
  resolveProductVerticalContext,
} from "@/lib/products/types";
import { formatCOP } from "@/lib/pos/types";
import {
  broadcastProductUpdate,
  broadcastProductDelete,
  subscribeToCatalogUpdates,
} from "@/lib/products/channel-sync";
import { CommercialActivity } from "@/config/commercial-activities";
import { ProductFormModal } from "./product-form-modal";
import { CategoryManagerModal } from "./category-manager-modal";
import { CategoriesTab } from "./categories-tab";
import { ModifierGroupsTab } from "@/components/products/modifiers/modifier-groups-tab";
import { ProductImportModal } from "./product-import-modal";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import {
  EmptyState,
  ErrorState,
  CardSkeleton,
} from "@/components/ui";
import {
  toggleProductAvailabilityAction,
  toggleProductChannelAction,
  archiveProductAction,
  getCategoriesAction,
  exportProductsCSVAction,
} from "./actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Props {
  businessId: string;
  businessType?: string;
  commercialActivities?: CommercialActivity[];
  initialProducts: Product[];
  initialCategories: Category[];
}

export function ProductsManagerClient({
  businessId,
  businessType = "restaurant",
  commercialActivities,
  initialProducts,
  initialCategories,
}: Props) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categories, setCategories] = useState<Category[]>(initialCategories);

  React.useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  React.useEffect(() => {
    handleRefreshCategories();
  }, []);

  // Únicamente las 3 pestañas autorizadas para el módulo de Productos
  const [activeTab, setActiveTab] = useState<"products" | "categories" | "modifiers">("products");

  // Suscripción en tiempo real para cambios de productos y canales (CAT-005)
  React.useEffect(() => {
    const unsubscribe = subscribeToCatalogUpdates(businessId, {
      onProductUpsert: (updatedProduct) => {
        setProducts((prev) => {
          if (updatedProduct.status === "archived") {
            return prev.filter((p) => p.id !== updatedProduct.id);
          }
          const idx = prev.findIndex((p) => p.id === updatedProduct.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...updatedProduct };
            return next;
          }
          return [updatedProduct, ...prev];
        });
      },
      onProductDelete: (productId) => {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
      },
    });
    return unsubscribe;
  }, [businessId]);

  const verticalCtx = useMemo(
    () => resolveProductVerticalContext(businessType, commercialActivities),
    [businessType, commercialActivities]
  );

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [variantsFilter, setVariantsFilter] = useState<"all" | "with_variants" | "without_variants">("all");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [productToArchive, setProductToArchive] = useState<{ id: string; name: string } | null>(null);

  const [isPending, startTransition] = useTransition();

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const res = await exportProductsCSVAction(businessId);
      if (!res.success || !res.csvContent) {
        toast.error("Error al exportar", {
          description: res.error || "No se pudo generar el archivo de exportación.",
        });
        return;
      }

      const blob = new Blob([res.csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", res.filename || `productos_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Catálogo exportado exitosamente", {
        description: `Se exportaron ${res.count} productos.`,
      });
    } catch (err: any) {
      toast.error("Error inesperado al exportar", {
        description: err.message || "Ocurrió un problema al procesar la exportación.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleRefreshCategories = async () => {
    const res = await getCategoriesAction(businessId);
    if (res.success && res.data) {
      setCategories(res.data);
    }
    router.refresh();
  };

  const handleToggleAvailability = async (productId: string, currentVal: boolean) => {
    const targetProduct = products.find((p) => p.id === productId);
    const optimisticProduct = targetProduct
      ? { ...targetProduct, is_available: !currentVal }
      : null;

    // Optimistic UI update + broadcast en tiempo real
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, is_available: !currentVal } : p))
    );
    if (optimisticProduct) {
      broadcastProductUpdate(businessId, optimisticProduct);
    }

    startTransition(async () => {
      const res = await toggleProductAvailabilityAction(businessId, productId, !currentVal);
      if (!res.success) {
        toast.error("Error al actualizar disponibilidad", {
          description: res.error || "No se pudo actualizar el estado.",
        });
        // Revert optimistic update
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, is_available: currentVal } : p))
        );
        if (targetProduct) {
          broadcastProductUpdate(businessId, targetProduct);
        }
      } else {
        toast.success(
          !currentVal ? "Producto marcado como disponible" : "Producto marcado como agotado"
        );
      }
    });
  };

  const handleToggleChannel = (
    product: Product,
    channel: SalesChannel,
    currentVal: boolean
  ) => {
    const nextVal = !currentVal;
    const fieldKey =
      channel === "pos"
        ? "available_in_pos"
        : channel === "qr"
        ? "available_in_qr"
        : "available_online";

    const optimisticProduct: Product = {
      ...product,
      [fieldKey]: nextVal,
      metadata: {
        ...product.metadata,
        [fieldKey]: nextVal,
        ...(channel === "qr" ? { show_in_qr_menu: nextVal } : {}),
      },
    };

    // Actualización optimista inmediata y broadcast en tiempo real sin recargar
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? optimisticProduct : p))
    );
    broadcastProductUpdate(businessId, optimisticProduct);

    const channelLabel =
      channel === "pos" ? "POS" : channel === "qr" ? "Menú QR" : "Tienda Online";

    startTransition(async () => {
      const res = await toggleProductChannelAction(
        businessId,
        product.id,
        channel,
        nextVal
      );
      if (!res.success) {
        toast.error(`Error al actualizar canal ${channelLabel}`, {
          description: res.error || "No se pudo guardar el cambio.",
        });
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? product : p))
        );
        broadcastProductUpdate(businessId, product);
      } else {
        if (res.data) {
          setProducts((prev) =>
            prev.map((p) => (p.id === product.id ? res.data! : p))
          );
          broadcastProductUpdate(businessId, res.data);
        }
        toast.success(
          nextVal
            ? `Activado en ${channelLabel}`
            : `Ocultado de ${channelLabel}`
        );
      }
    });
  };

  const handleConfirmArchive = () => {
    if (!productToArchive) return;
    const archivedId = productToArchive.id;

    startTransition(async () => {
      const res = await archiveProductAction(businessId, archivedId);
      if (res.success) {
        toast.success("Producto archivado", {
          description: `«${productToArchive.name}» fue archivado y liberó espacio en el catálogo.`,
        });
        setProducts((prev) => prev.filter((p) => p.id !== archivedId));
        broadcastProductDelete(businessId, archivedId);
        setProductToArchive(null);
      } else {
        toast.error("Error al archivar producto", {
          description: res.error || "No se pudo archivar el producto.",
        });
      }
    });
  };

  const handleProductSaved = (savedProduct: Product) => {
    setProducts((prev) => {
      const index = prev.findIndex((p) => p.id === savedProduct.id);
      if (index >= 0) {
        const next = [...prev];
        next[index] = savedProduct;
        return next;
      }
      return [savedProduct, ...prev];
    });
    broadcastProductUpdate(businessId, savedProduct);
  };

  const commercialProducts = useMemo(() => {
    return products.filter((p) => (p.metadata as any)?.product_type !== "ingredient");
  }, [products]);

  const kpiTotal = commercialProducts.length;

  const kpiActivos = useMemo(() => {
    return commercialProducts.filter((p) => p.is_available && p.status !== "inactive").length;
  }, [commercialProducts]);

  const kpiInactivos = useMemo(() => {
    return commercialProducts.filter((p) => !p.is_available || p.status === "inactive").length;
  }, [commercialProducts]);

  const kpiStockBajo = useMemo(() => {
    return commercialProducts.filter((p) => {
      const meta = (p.metadata || {}) as Record<string, any>;
      // Solo productos que controlan stock físico directo y no sean de tipo servicio
      if (!meta.track_stock || meta.product_type === "service") return false;
      const stock = Number(meta.stock_quantity ?? 0);
      const minStock = typeof meta.min_stock === "number" ? meta.min_stock : 5;
      return stock <= minStock;
    }).length;
  }, [commercialProducts]);

  const handleDuplicateProduct = (product: Product) => {
    const meta = { ...((product.metadata || {}) as Record<string, any>) };
    delete meta.sku;
    delete meta.barcode;
    const duplicatedProduct: Product = {
      ...product,
      id: "", // Cadena vacía para indicar que es un nuevo producto al guardar
      name: `${product.name} (Copia)`,
      metadata: meta as any,
    };
    setEditingProduct(duplicatedProduct);
    setIsProductModalOpen(true);
  };

  const filteredProducts = useMemo(() => {
    return commercialProducts.filter((p) => {
      const q = search.trim().toLowerCase();
      const meta = (p.metadata || {}) as Record<string, any>;
      const skuMatches = String(meta.sku || "").toLowerCase().includes(q);
      const barcodeMatches = String(meta.barcode || "").toLowerCase().includes(q);
      const pAny = p as any;
      const variantMatches = Array.isArray(pAny.variants) && pAny.variants.some((v: any) =>
        String(v.name || "").toLowerCase().includes(q) ||
        String(v.sku || "").toLowerCase().includes(q) ||
        String(v.barcode || "").toLowerCase().includes(q)
      );

      // 1. Búsqueda libre
      if (q) {
        const matchesSearch =
          p.name.toLowerCase().includes(q) ||
          (p.description?.toLowerCase().includes(q) ?? false) ||
          skuMatches ||
          barcodeMatches ||
          variantMatches;
        if (!matchesSearch) return false;
      }

      // 2. Categoría
      if (selectedCategory !== "all") {
        const matchesCat =
          p.category_id === selectedCategory ||
          categories.some(
            (c) => c.parent_category_id === selectedCategory && p.category_id === c.id
          );
        if (!matchesCat) return false;
      }

      // 3. Estado
      if (statusFilter === "active") {
        if (!p.is_available || p.status === "inactive") return false;
      } else if (statusFilter === "inactive") {
        if (p.is_available && p.status !== "inactive") return false;
      }

      // 4. Variantes
      const pVariants = Array.isArray(meta.variants) ? meta.variants : [];
      const hasVariants = Boolean(meta.has_variants || pVariants.length > 0);
      if (variantsFilter === "with_variants" && !hasVariants) return false;
      if (variantsFilter === "without_variants" && hasVariants) return false;

      return true;
    });
  }, [
    commercialProducts,
    search,
    selectedCategory,
    statusFilter,
    variantsFilter,
    categories,
  ]);

  const hasActiveFilters = Boolean(
    search.trim() !== "" ||
    selectedCategory !== "all" ||
    statusFilter !== "all" ||
    variantsFilter !== "all"
  );

  const handleResetFilters = () => {
    setSearch("");
    setSelectedCategory("all");
    setStatusFilter("all");
    setVariantsFilter("all");
    setCurrentPage(1);
  };

  const totalItems = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedProducts = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, safeCurrentPage, pageSize]);

  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safeCurrentPage > 3) pages.push("...");
      const start = Math.max(2, safeCurrentPage - 1);
      const end = Math.min(totalPages - 1, safeCurrentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (safeCurrentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, safeCurrentPage]);

  const hierarchicalCategories = useMemo(() => {
    const active = categories.filter((c) => c.status === "active");
    const roots = active.filter((c) => !c.parent_category_id);
    const childrenMap = new Map<string, Category[]>();
    for (const c of active) {
      if (c.parent_category_id) {
        const list = childrenMap.get(c.parent_category_id) || [];
        list.push(c);
        childrenMap.set(c.parent_category_id, list);
      }
    }

    const result: {
      category: Category;
      displayName: string;
      isChild: boolean;
      count: number;
    }[] = [];

    for (const root of roots) {
      const kids = childrenMap.get(root.id) || [];
      const childIds = new Set(kids.map((k) => k.id));
      const rootCount = products.filter(
        (p) => p.category_id === root.id || (p.category_id && childIds.has(p.category_id))
      ).length;

      result.push({
        category: root,
        displayName: root.name,
        isChild: false,
        count: rootCount,
      });

      for (const kid of kids) {
        const kidCount = products.filter((p) => p.category_id === kid.id).length;
        result.push({
          category: kid,
          displayName: `${root.name} › ${kid.name}`,
          isChild: true,
          count: kidCount,
        });
      }
    }

    // Huérfanas si existieran
    for (const c of active) {
      if (!result.some((r) => r.category.id === c.id)) {
        const parent = categories.find((p) => p.id === c.parent_category_id);
        const count = products.filter((p) => p.category_id === c.id).length;
        result.push({
          category: c,
          displayName: parent ? `${parent.name} › ${c.name}` : c.name,
          isChild: Boolean(c.parent_category_id),
          count,
        });
      }
    }

    return result;
  }, [categories, products]);

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const activeCount = products.filter((p) => p.is_available).length;
  const outOfStockCount = products.filter((p) => !p.is_available).length;

  return (
    <div className="space-y-6">
      {/* PESTAÑAS PRINCIPALES DEL MÓDULO (PRODUCTOS / CATEGORÍAS / MODIFICADORES) */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-white/[0.08] pb-1 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab("products")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 cursor-pointer ${
            activeTab === "products"
              ? "bg-[#ED500A]/10 text-[#ED500A] dark:bg-[#ED500A]/20"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.02]"
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Productos</span>
          <span className="ml-1 text-2xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 font-bold">
            {filteredProducts.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("categories")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 cursor-pointer ${
            activeTab === "categories"
              ? "bg-[#ED500A]/10 text-[#ED500A] dark:bg-[#ED500A]/20 font-bold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.02]"
          }`}
        >
          <FolderKanban className="w-4 h-4 text-[#ED500A]" />
          <span>Categorías</span>
          <span className="ml-1 text-2xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 font-bold">
            {categories.filter((c) => c.status !== "archived").length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("modifiers")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 cursor-pointer ${
            activeTab === "modifiers"
              ? "bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 font-bold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.02]"
          }`}
        >
          <Layers className="w-4 h-4 text-purple-500" />
          <span>Modificadores</span>
        </button>
      </div>

      {activeTab === "categories" ? (
        <CategoriesTab
          businessId={businessId}
          categories={categories}
          products={products}
          onCategoriesChange={handleRefreshCategories}
        />
      ) : activeTab === "modifiers" ? (
        <ModifierGroupsTab
          businessId={businessId}
          categories={categories}
          products={products}
        />
      ) : (
        <div className="space-y-5">
          {/* 1. KPIS SUPERIORES */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Productos */}
            <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Total Productos</span>
                <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 block">
                  {kpiTotal}
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">En catálogo comercial</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5" />
              </div>
            </div>

            {/* Activos */}
            <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Activos</span>
                <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">
                  {kpiActivos}
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">Disponibles para venta</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            {/* Inactivos */}
            <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Inactivos</span>
                <span className="text-2xl font-bold font-mono text-slate-600 dark:text-slate-400 mt-1 block">
                  {kpiInactivos}
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">Agotados u ocultos</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0">
                <XCircle className="w-5 h-5" />
              </div>
            </div>

            {/* Stock Bajo */}
            <div className="p-4 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Stock Bajo</span>
                <span className={`text-2xl font-bold font-mono mt-1 block ${kpiStockBajo > 0 ? "text-amber-500 dark:text-amber-400" : "text-slate-900 dark:text-white"}`}>
                  {kpiStockBajo}
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">Por debajo del mínimo</span>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${kpiStockBajo > 0 ? "bg-amber-500/10 text-amber-500 dark:text-amber-400" : "bg-slate-100 dark:bg-white/[0.04] text-slate-400"}`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* 2. BARRA SUPERIOR: ACCIONES Y SELECTOR DE VISTA */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            {/* Selector de Vista (Tabla / Cuadrícula) */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-white/[0.04] rounded-xl border border-slate-200/80 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-white dark:bg-[#1E2028] text-slate-900 dark:text-white shadow-2xs font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Tabla</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-white dark:bg-[#1E2028] text-slate-900 dark:text-white shadow-2xs font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cuadrícula</span>
              </button>
            </div>

            {/* Acciones principales */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              <button
                onClick={handleExportCSV}
                disabled={isExporting}
                title="Exportar catálogo completo a CSV"
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                {isExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                )}
                <span>Exportar</span>
              </button>

              <button
                onClick={() => setIsImportModalOpen(true)}
                title="Importar productos por lote desde CSV"
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#ED500A]" />
                <span>Importar</span>
              </button>

              <button
                onClick={() => {
                  setEditingProduct(null);
                  setIsProductModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Producto</span>
              </button>
            </div>
          </div>

          {/* 3. BARRA DE FILTROS */}
          <div className="p-3.5 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Búsqueda libre */}
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, SKU, código de barras o variantes..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 pr-16 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] text-slate-900 dark:text-white placeholder:text-slate-400 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/50 w-full"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setCurrentPage(1);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                      title="Borrar búsqueda"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsBarcodeScannerOpen(true)}
                    title="Escanear código de barras o SKU con cámara"
                    className="p-1 text-slate-400 hover:text-[#ED500A] transition-colors cursor-pointer"
                  >
                    <Barcode className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Categoría */}
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 bg-slate-50 dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 rounded-xl text-xs focus:outline-hidden cursor-pointer"
              >
                <option value="all">Todas las categorías ({kpiTotal})</option>
                {hierarchicalCategories.map(({ category: c, displayName, count }) => (
                  <option key={c.id} value={c.id}>
                    {displayName} ({count})
                  </option>
                ))}
              </select>

              {/* Estado */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 bg-slate-50 dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 rounded-xl text-xs focus:outline-hidden cursor-pointer"
              >
                <option value="all">Todos los estados</option>
                <option value="active">Activos ({kpiActivos})</option>
                <option value="inactive">Inactivos ({kpiInactivos})</option>
              </select>

              {/* Variantes */}
              <select
                value={variantsFilter}
                onChange={(e) => {
                  setVariantsFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 bg-slate-50 dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 rounded-xl text-xs focus:outline-hidden cursor-pointer"
              >
                <option value="all">Todas las presentaciones</option>
                <option value="with_variants">Con variantes</option>
                <option value="without_variants">Sin variantes</option>
              </select>

              {/* Botón 'Limpiar filtros' */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 border border-rose-200/60 dark:border-rose-500/20 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpiar filtros</span>
                </button>
              )}
            </div>
          </div>

          {/* 4. BARRA HORIZONTAL DE CATEGORÍAS (PILLS) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar border-b border-slate-200/60 dark:border-white/[0.06]">
            <button
              onClick={() => {
                setSelectedCategory("all");
                setCurrentPage(1);
              }}
              className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedCategory === "all"
                  ? "bg-[#ED500A] text-white shadow-xs font-bold"
                  : "bg-slate-100 dark:bg-white/[0.04] border border-transparent dark:border-white/[0.06] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-white/[0.08]"
              }`}
            >
              Todas ({kpiTotal})
            </button>

            {hierarchicalCategories.map(({ category: c, displayName, count, isChild }) => {
              const isSelected = selectedCategory === c.id;

              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCategory(c.id);
                    setCurrentPage(1);
                  }}
                  className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? "bg-[#ED500A] text-white shadow-xs font-bold"
                      : isChild
                      ? "bg-slate-50 dark:bg-white/[0.02] border border-dashed border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100"
                      : "bg-slate-100 dark:bg-white/[0.04] border border-transparent dark:border-white/[0.06] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-white/[0.08]"
                  }`}
                >
                  <span>{displayName}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 dark:bg-white/[0.08] text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            <button
              onClick={() => {
                handleRefreshCategories();
                setActiveTab("categories");
              }}
              title="Administrar categorías del catálogo"
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-slate-300 dark:border-white/[0.12] text-slate-500 dark:text-slate-400 hover:text-[#ED500A] dark:hover:text-[#ED500A] rounded-xl text-xs font-medium hover:border-[#ED500A]/40 transition-colors cursor-pointer"
            >
              <FolderKanban className="w-3.5 h-3.5" />
              <span>Administrar categorías</span>
            </button>
          </div>

          {/* 5. VISTA DE PRODUCTOS: TABLA O CUADRÍCULA */}
          {isPending ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
              {Array.from({ length: 8 }).map((_, i) => (
                <CardSkeleton key={i} className="h-64" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="No se encontraron productos"
              description={
                hasActiveFilters
                  ? "No hay resultados para los filtros seleccionados. Intenta cambiar los criterios de búsqueda o categoría."
                  : "Tu catálogo está listo. Haz clic en 'Nuevo Producto' para comenzar a añadir tus platos, artículos o servicios."
              }
              actionLabel={
                selectedCategory !== "all"
                  ? "Añadir producto en esta categoría"
                  : "Nuevo Producto"
              }
              onAction={() => {
                setEditingProduct(null);
                setIsProductModalOpen(true);
              }}
              resetLabel={hasActiveFilters ? "Limpiar filtros" : undefined}
              onReset={hasActiveFilters ? handleResetFilters : undefined}
            />
          ) : viewMode === "table" ? (
            /* TABLA DE PRODUCTOS */
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-3 text-center w-12">#</th>
                      <th className="py-3 px-4 min-w-[220px]">Nombre</th>
                      <th className="py-3 px-3">SKU</th>
                      <th className="py-3 px-3">Categoría</th>
                      <th className="py-3 px-3">Variantes</th>
                      <th className="py-3 px-3">Stock</th>
                      <th className="py-3 px-3 text-right">Costo</th>
                      <th className="py-3 px-4 text-right">Precio</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                      <th className="py-3 px-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                    {paginatedProducts.map((product, idx) => {
                      const cat = categories.find((c) => c.id === product.category_id);
                      const meta = (product.metadata || {}) as Record<string, any>;
                      const productVariants = Array.isArray(meta.variants) ? meta.variants : [];
                      const hasVariants = Boolean(meta.has_variants || productVariants.length > 0);
                      const minVariantPrice = hasVariants && productVariants.length > 0
                        ? Math.min(...productVariants.map((v: any) => Number(v.price) || 0))
                        : null;

                      const hasRecipe = Boolean(meta.has_recipe || meta.recipe_id);

                      const rawCost = Number(meta.cost ?? meta.average_cost ?? (product as any).cost_price ?? 0);
                      const orderNumber = (safeCurrentPage - 1) * pageSize + idx + 1;

                      return (
                        <tr
                          key={product.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors group"
                        >
                          {/* 1. Orden */}
                          <td className="py-3 px-3 text-center font-mono text-slate-400 font-medium">
                            {orderNumber}
                          </td>

                          {/* 2. Nombre e imagen */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.08] shrink-0 flex items-center justify-center">
                                {product.image_url ? (
                                  <img
                                    src={product.image_url}
                                    alt={product.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <ImageIcon className="w-4 h-4 text-slate-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <span
                                  onClick={() => {
                                    setEditingProduct(product);
                                    setIsProductModalOpen(true);
                                  }}
                                  className="font-bold text-slate-900 dark:text-white block truncate max-w-[240px] hover:text-[#ED500A] transition-colors cursor-pointer"
                                  title={product.name}
                                >
                                  {product.name}
                                </span>
                                {product.description && (
                                  <span
                                    className="text-[11px] text-slate-400 dark:text-slate-500 block truncate max-w-[240px]"
                                    title={product.description}
                                  >
                                    {product.description}
                                  </span>
                                )}
                                <div className="flex items-center gap-1 mt-1">
                                  {isProductAvailableInPos(product) && (
                                    <span
                                      className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300"
                                      title="Visible en POS"
                                    >
                                      POS
                                    </span>
                                  )}
                                  {isProductAvailableInQr(product) && (
                                    <span
                                      className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300"
                                      title="Visible en Menú QR"
                                    >
                                      QR
                                    </span>
                                  )}
                                  {isProductAvailableOnline(product) && (
                                    <span
                                      className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300"
                                      title="Visible en Tienda Online"
                                    >
                                      WEB
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 3. SKU */}
                          <td className="py-3 px-3">
                            {meta.sku || meta.barcode ? (
                              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-white/[0.06]">
                                {meta.sku || meta.barcode}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* 4. Categoría */}
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-white/[0.06]">
                              {cat?.name || "Sin categoría"}
                            </span>
                          </td>

                          {/* 5. Variantes */}
                          <td className="py-3 px-3">
                            {hasVariants ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-orange-50 dark:orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-200/60 dark:border-orange-500/20">
                                {productVariants.length}{" "}
                                {productVariants.length === 1 ? "variante" : "variantes"}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Sin variantes</span>
                            )}
                          </td>

                          {/* 7. Stock */}
                          <td className="py-3 px-3">
                            {meta.track_stock ? (
                              <span
                                className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                                  typeof meta.min_stock === "number" &&
                                  typeof meta.stock_quantity === "number" &&
                                  meta.stock_quantity <= meta.min_stock
                                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                }`}
                              >
                                {typeof meta.min_stock === "number" &&
                                  typeof meta.stock_quantity === "number" &&
                                  meta.stock_quantity <= meta.min_stock && (
                                    <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                                  )}
                                <span>{meta.stock_quantity ?? 0} uds</span>
                              </span>
                            ) : hasRecipe ? (
                              typeof meta.recipe_portions_available === "number" ? (
                                <span
                                  className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                                    meta.recipe_portions_available > 0
                                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                  }`}
                                >
                                  {meta.recipe_portions_available} porc.
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400">Por receta</span>
                              )
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* 8. Costo */}
                          <td className="py-3 px-3 text-right font-mono font-medium text-slate-600 dark:text-slate-400">
                            {rawCost > 0 ? formatCOP(rawCost) : "—"}
                          </td>

                          {/* 9. Precio */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex flex-col items-end">
                              {hasVariants && (
                                <span className="text-[10px] text-slate-400 font-mono leading-none">Desde</span>
                              )}
                              <span className="font-mono font-bold text-slate-900 dark:text-white">
                                {formatCOP(hasVariants && minVariantPrice !== null ? minVariantPrice : product.price)}
                              </span>
                            </div>
                          </td>

                          {/* 10. Estado (Activo / Inactivo con switch) */}
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleAvailability(product.id, product.is_available)}
                              disabled={isPending}
                              title={product.is_available ? "Clic para marcar como agotado" : "Clic para marcar como disponible"}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                                product.is_available
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
                                  : "bg-slate-100 dark:bg-white/[0.04] text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-white/[0.08] hover:bg-slate-200/80"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  product.is_available ? "bg-emerald-500" : "bg-slate-400"
                                }`}
                              />
                              <span>{product.is_available ? "Activo" : "Inactivo"}</span>
                            </button>
                          </td>

                          {/* 11. Acciones (Editar, Desactivar/Activar, Eliminar) */}
                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center gap-1">
                              {/* Editar */}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingProduct(product);
                                  setIsProductModalOpen(true);
                                }}
                                title="Editar producto"
                                className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>

                              {/* Duplicar */}
                              <button
                                type="button"
                                onClick={() => handleDuplicateProduct(product)}
                                title="Duplicar producto"
                                className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>

                              {/* Desactivar / Activar */}
                              <button
                                type="button"
                                onClick={() => handleToggleAvailability(product.id, product.is_available)}
                                disabled={isPending}
                                title={product.is_available ? "Desactivar producto" : "Activar producto"}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  product.is_available
                                    ? "text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                                    : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                                }`}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>

                              {/* Eliminar / Archivar */}
                              <button
                                type="button"
                                onClick={() => setProductToArchive({ id: product.id, name: product.name })}
                                disabled={isPending}
                                title="Eliminar / Archivar producto"
                                className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* VISTA DE CUADRÍCULA (CARDS) */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginatedProducts.map((product) => {
                const cat = categories.find((c) => c.id === product.category_id);
                const meta = (product.metadata || {}) as Record<string, any>;
                const modifierGroups = (meta.modifier_groups || []) as any[];
                const hasModifiers = modifierGroups.length > 0;
                const productVariants = Array.isArray(meta.variants) ? meta.variants : [];
                const hasVariants = Boolean(meta.has_variants || productVariants.length > 0);
                const minVariantPrice = hasVariants && productVariants.length > 0
                  ? Math.min(...productVariants.map((v: any) => Number(v.price) || 0))
                  : null;

                return (
                  <div
                    key={product.id}
                    className="group relative bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 flex flex-col justify-between hover:border-slate-300 dark:hover:border-white/[0.18] transition-all shadow-xs"
                  >
                    <div>
                      {/* Encabezado: Nombre, Categoría y Acciones */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900 dark:text-white leading-snug truncate">
                            {product.name}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {cat?.name || "Sin categoría"}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setEditingProduct(product);
                              setIsProductModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                            title="Editar producto"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDuplicateProduct(product)}
                            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                            title="Duplicar producto"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Imagen */}
                      <div className="mt-3 relative h-36 rounded-xl overflow-hidden bg-slate-100 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.06] flex items-center justify-center">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 gap-1.5 p-4 text-center">
                            <ImageIcon className="w-8 h-8 stroke-[1.5]" />
                            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">Sin fotografía</span>
                          </div>
                        )}

                        <div className="absolute top-2 left-2 flex gap-1">
                          {meta.product_type === "service" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/90 text-white backdrop-blur-xs shadow-xs">
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>Servicio</span>
                            </span>
                          )}
                          {meta.sku && (
                            <span className="inline-flex items-center text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-black/60 text-white backdrop-blur-xs">
                              {meta.sku}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Badges de Atributos */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {hasModifiers && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-500/20">
                            <Layers className="w-3 h-3" />
                            <span>{modifierGroups.length} extras</span>
                          </span>
                        )}
                        {hasVariants && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-200/60 dark:border-orange-500/20">
                            <Sparkles className="w-3 h-3 text-[#ED500A]" />
                            <span>{productVariants.length} var.</span>
                          </span>
                        )}
                        {meta.track_stock && (
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                              typeof meta.min_stock === "number" &&
                              typeof meta.stock_quantity === "number" &&
                              meta.stock_quantity <= meta.min_stock
                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                                : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                            }`}
                          >
                            <PackageSearch className="w-3 h-3" />
                            <span>Stock: {meta.stock_quantity ?? 0}</span>
                          </span>
                        )}
                      </div>

                      {/* Canales de Venta (Contextuales al Vertical) */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100/80 dark:border-white/[0.04] flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Canales:</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleChannel(product, "pos", isProductAvailableInPos(product))}
                            title={isProductAvailableInPos(product) ? "Disponible en POS / Caja" : "Oculto en POS / Caja"}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                              isProductAvailableInPos(product)
                                ? "bg-[#ED500A]/10 text-[#ED500A] border-[#ED500A]/30"
                                : "bg-slate-100 dark:bg-white/[0.03] text-slate-400 line-through opacity-70"
                            }`}
                          >
                            POS
                          </button>
                          {verticalCtx.availableChannels.includes("qr") && (
                            <button
                              type="button"
                              onClick={() => handleToggleChannel(product, "qr", isProductAvailableInQr(product))}
                              title={isProductAvailableInQr(product) ? "Visible en Menú QR" : "Oculto en Menú QR"}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                                isProductAvailableInQr(product)
                                  ? "bg-[#ED500A]/10 text-[#ED500A] border-[#ED500A]/30"
                                  : "bg-slate-100 dark:bg-white/[0.03] text-slate-400 line-through opacity-70"
                              }`}
                            >
                              QR
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Pie de tarjeta */}
                    <div className="mt-4 pt-3.5 flex items-center justify-between border-t border-slate-100 dark:border-white/[0.06]">
                      <div className="flex flex-col">
                        {hasVariants && (
                          <span className="text-[10px] text-slate-400 font-mono leading-none">Desde</span>
                        )}
                        <span className="text-base font-bold text-slate-900 dark:text-white">
                          {formatCOP(hasVariants && minVariantPrice !== null ? minVariantPrice : product.price)}
                        </span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <button
                            onClick={() => handleToggleAvailability(product.id, product.is_available)}
                            disabled={isPending}
                            className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                              product.is_available ? "bg-emerald-500" : "bg-slate-300 dark:bg-white/[0.15]"
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                                product.is_available ? "translate-x-3" : "translate-x-0"
                              }`}
                            />
                          </button>
                          <span className={`text-[11px] font-medium ${product.is_available ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}`}>
                            {product.is_available ? "Disponible" : "Agotado"}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => setProductToArchive({ id: product.id, name: product.name })}
                        disabled={isPending}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Archivar producto"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 6. PAGINACIÓN */}
          {filteredProducts.length > 0 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-slate-200/60 dark:border-white/[0.06] text-xs">
              {/* Selector de Filas por página y conteo */}
              <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span>Filas por página:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <span className="hidden sm:inline-block">•</span>

                <span>
                  Mostrando {(safeCurrentPage - 1) * pageSize + 1} -{" "}
                  {Math.min(safeCurrentPage * pageSize, filteredProducts.length)} de{" "}
                  <strong className="text-slate-900 dark:text-white font-mono">{filteredProducts.length}</strong>{" "}
                  productos
                </span>
              </div>

              {/* Navegación de páginas */}
              <div className="flex items-center gap-1">
                {/* Primera página */}
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={safeCurrentPage === 1}
                  title="Primera página"
                  className="p-1.5 rounded-lg border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>

                {/* Página anterior */}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage === 1}
                  title="Página anterior"
                  className="p-1.5 rounded-lg border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Números de página */}
                <div className="flex items-center gap-1 px-1">
                  {pageNumbers.map((p, i) =>
                    typeof p === "number" ? (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className={`min-w-8 h-8 px-2 rounded-lg font-mono text-xs font-semibold transition-all cursor-pointer ${
                          safeCurrentPage === p
                            ? "bg-[#ED500A] text-white shadow-2xs font-bold"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                        }`}
                      >
                        {p}
                      </button>
                    ) : (
                      <span key={i} className="px-1 text-slate-400 font-mono">
                        ...
                      </span>
                    )
                  )}
                </div>

                {/* Página siguiente */}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage === totalPages}
                  title="Página siguiente"
                  className="p-1.5 rounded-lg border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Última página */}
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safeCurrentPage === totalPages}
                  title="Última página"
                  className="p-1.5 rounded-lg border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de Crear / Editar Producto */}
      {isProductModalOpen && (
        <ProductFormModal
          businessId={businessId}
          businessType={businessType}
          commercialActivities={commercialActivities}
          categories={categories}
          existingProducts={products}
          product={editingProduct}
          isOpen={isProductModalOpen}
          onClose={() => setIsProductModalOpen(false)}
          onSuccess={handleProductSaved}
          onCategoryCreated={(newCat) => {
            setCategories((prev) => [...prev, newCat]);
            setSelectedCategory(newCat.id);
          }}
          initialCategoryId={selectedCategory !== "all" ? selectedCategory : undefined}
        />
      )}

      {/* Modal de Categorías */}
      {isCategoryModalOpen && (
        <CategoryManagerModal
          businessId={businessId}
          categories={categories}
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
          onSuccess={handleRefreshCategories}
        />
      )}

      {/* Modal de Importación Masiva CSV */}
      <ProductImportModal
        businessId={businessId}
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          handleRefreshCategories();
          router.refresh();
        }}
      />

      {/* Modal de Confirmación para Archivar Producto */}
      <ConfirmModal
        isOpen={Boolean(productToArchive)}
        onClose={() => setProductToArchive(null)}
        onConfirm={handleConfirmArchive}
        title="¿Archivar producto?"
        description={`¿Seguro que deseas archivar «${productToArchive?.name}»? El producto dejará de estar visible para la venta y liberará espacio en el límite de tu plan.`}
        confirmText="Archivar producto"
        variant="danger"
        isLoading={isPending}
      />

      {/* Modal de Escáner de Código de Barras / SKU */}
      <BarcodeScannerModal
        isOpen={isBarcodeScannerOpen}
        onClose={() => setIsBarcodeScannerOpen(false)}
        onScan={(code: string) => {
          setSearch(code);
          toast.success("Código detectado", {
            description: `Filtrando catálogo por: ${code}`,
          });
        }}
      />
    </div>
  );
}
