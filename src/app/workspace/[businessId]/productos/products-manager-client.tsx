"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
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
  BookOpen,
  Loader2,
} from "lucide-react";
import { Product, Category } from "@/lib/products/types";
import { CommercialActivity } from "@/config/commercial-activities";
import { ProductFormModal } from "./product-form-modal";
import { CategoryManagerModal } from "./category-manager-modal";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import {
  toggleProductAvailabilityAction,
  archiveProductAction,
  getCategoriesAction,
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

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "available" | "unavailable">("all");

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [productToArchive, setProductToArchive] = useState<{ id: string; name: string } | null>(null);

  const [isPending, startTransition] = useTransition();
  const [isNavigatingMenu, startNavigatingMenu] = useTransition();

  const handleOpenDigitalMenu = () => {
    startNavigatingMenu(() => {
      router.push(`/workspace/${businessId}/productos/menu`);
    });
  };

  const handleRefreshCategories = async () => {
    const res = await getCategoriesAction(businessId);
    if (res.success && res.data) {
      setCategories(res.data);
    }
    router.refresh();
  };

  const handleToggleAvailability = async (productId: string, currentVal: boolean) => {
    // Optimistic UI update
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, is_available: !currentVal } : p))
    );

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
      } else {
        toast.success(
          !currentVal ? "Producto marcado como disponible" : "Producto marcado como agotado"
        );
      }
    });
  };

  const handleConfirmArchive = () => {
    if (!productToArchive) return;

    startTransition(async () => {
      const res = await archiveProductAction(businessId, productToArchive.id);
      if (res.success) {
        toast.success("Producto archivado", {
          description: `«${productToArchive.name}» fue archivado y liberó espacio en el catálogo.`,
        });
        setProducts((prev) => prev.filter((p) => p.id !== productToArchive.id));
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
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesCat = selectedCategory === "all" || p.category_id === selectedCategory;
    const matchesAvail =
      availabilityFilter === "all"
        ? true
        : availabilityFilter === "available"
        ? p.is_available
        : !p.is_available;
    return matchesSearch && matchesCat && matchesAvail;
  });

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
      {/* Resumen Superior & Filtros */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Búsqueda y Filtros de Disponibilidad */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o descripción..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white dark:bg-[#10141d] border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ED500A]/50 w-full"
            />
          </div>

          <select
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value as any)}
            className="px-3 py-2 bg-white dark:bg-[#10141d] border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none"
          >
            <option value="all">Todos ({products.length})</option>
            <option value="available">Disponibles ({activeCount})</option>
            <option value="unavailable">Agotados ({outOfStockCount})</option>
          </select>
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
          <button
            onClick={handleOpenDigitalMenu}
            disabled={isNavigatingMenu}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold transition-all disabled:opacity-75 cursor-pointer shadow-sm active:scale-95"
            title="Abrir configuración del Menú Digital"
          >
            {isNavigatingMenu ? (
              <Loader2 className="w-4 h-4 text-[#ED500A] animate-spin" />
            ) : (
              <BookOpen className="w-4 h-4 text-[#ED500A]" />
            )}
            <span>{isNavigatingMenu ? "Cargando menú..." : "Menú Digital"}</span>
          </button>

          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold transition-colors"
          >
            <FolderKanban className="w-4 h-4 text-[#ED500A]" />
            <span>Categorías ({categories.length})</span>
          </button>

          <button
            onClick={() => {
              setEditingProduct(null);
              setIsProductModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* BARRA HORIZONTAL DE CATEGORÍAS (PILLS) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar border-b border-slate-200/60 dark:border-white/5">
        <button
          onClick={() => setSelectedCategory("all")}
          className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            selectedCategory === "all"
              ? "bg-[#ED500A] text-white shadow-xs"
              : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          Todas ({products.length})
        </button>

        {Array.from(
          new Map(
            categories
              .filter((c) => c.status === "active")
              .map((c) => [c.name.toLowerCase().trim(), c])
          ).values()
        ).map((c) => {
            const countInCat = products.filter((p) => p.category_id === c.id).length;
            const isSelected = selectedCategory === c.id;

            return (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-[#ED500A] text-white shadow-xs"
                    : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>{c.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-slate-200 dark:bg-white/10 text-slate-500"
                  }`}
                >
                  {countInCat}
                </span>
              </button>
            );
          })}

        <button
          onClick={() => {
            handleRefreshCategories();
            setIsCategoryModalOpen(true);
          }}
          className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 border border-dashed border-slate-300 dark:border-white/15 text-slate-500 hover:text-[#ED500A] rounded-xl text-xs font-medium hover:border-[#ED500A]/40 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Gestionar</span>
        </button>
      </div>

      {/* Grid de Productos */}
      {filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-slate-300 dark:border-white/10 rounded-2xl bg-slate-50/50 dark:bg-white/5">
          <PackageSearch className="w-12 h-12 text-slate-400 mb-3" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            No se encontraron productos
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mt-1">
            {search || selectedCategory !== "all" || availabilityFilter !== "all"
              ? "No hay resultados para los filtros seleccionados. Intenta cambiar los criterios de búsqueda o categoría."
              : "Tu catálogo está listo. Haz clic en 'Nuevo Producto' para comenzar a añadir tus platos, artículos o servicios."}
          </p>
          {selectedCategory !== "all" && (
            <button
              onClick={() => {
                setEditingProduct(null);
                setIsProductModalOpen(true);
              }}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#ED500A] text-white text-xs font-semibold rounded-xl shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Añadir producto en esta categoría</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((product) => {
            const cat = categories.find((c) => c.id === product.category_id);
            const modifierGroups = ((product.metadata as any)?.modifier_groups || []) as any[];
            const hasModifiers = modifierGroups.length > 0;

            return (
              <div
                key={product.id}
                className="group relative bg-white dark:bg-[#10141d] border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-300 dark:hover:border-white/20 transition-all shadow-xs"
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

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          setEditingProduct(product);
                          setIsProductModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                        title="Editar producto"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Imagen del producto con fallback profesional */}
                  <div className="mt-3 relative h-36 rounded-xl overflow-hidden bg-slate-100 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 flex items-center justify-center">
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

                    {/* Badge de tipo de producto en la esquina superior */}
                    <div className="absolute top-2 left-2 flex gap-1">
                      {((product.metadata as any)?.product_type === "service") && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/90 text-white backdrop-blur-xs shadow-xs">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>Servicio</span>
                        </span>
                      )}
                      {(product.metadata as any)?.sku && (
                        <span className="inline-flex items-center text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-black/60 text-white backdrop-blur-xs">
                          {(product.metadata as any).sku}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Descripción */}
                  {product.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2.5 line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>
                  )}

                  {/* Badges de Atributos: Modificadores / Duración / Unidad */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {hasModifiers && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-500/20">
                        <Layers className="w-3 h-3" />
                        <span>
                          {modifierGroups.length}{" "}
                          {modifierGroups.length === 1 ? "grupo extras" : "grupos extras"}
                        </span>
                      </span>
                    )}

                    {(product.metadata as any)?.duration_minutes && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-500/20">
                        <span>⏱ {(product.metadata as any).duration_minutes} min</span>
                      </span>
                    )}

                    {(product.metadata as any)?.unit && (product.metadata as any).unit !== "unidad" && (
                      <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300">
                        {(product.metadata as any).unit}
                      </span>
                    )}

                    {Array.isArray((product.metadata as any)?.allergens) &&
                      (product.metadata as any).allergens.length > 0 && (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-500/20"
                          title={`Alérgenos conocidos: ${(product.metadata as any).allergens.join(", ")}`}
                        >
                          <span>⚠️ {(product.metadata as any).allergens.join(", ")}</span>
                        </span>
                      )}
                  </div>
                </div>

                {/* Pie de la tarjeta: Estado, Precio y Archivar */}
                <div className="mt-4 pt-3.5 flex items-center justify-between border-t border-slate-100 dark:border-white/5">
                  <div className="flex flex-col">
                    <span className="text-base font-bold text-slate-900 dark:text-white">
                      {formatCOP(product.price)}
                    </span>

                    {/* Estado de disponibilidad con botón switch interactivo */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <button
                        onClick={() => handleToggleAvailability(product.id, product.is_available)}
                        disabled={isPending}
                        className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          product.is_available
                            ? "bg-emerald-500"
                            : "bg-slate-300 dark:bg-slate-700"
                        }`}
                        title={product.is_available ? "Cambiar a Agotado" : "Cambiar a Disponible"}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            product.is_available ? "translate-x-3" : "translate-x-0"
                          }`}
                        />
                      </button>
                      <span
                        className={`text-[11px] font-medium ${
                          product.is_available
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {product.is_available ? "Disponible" : "Agotado"}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setProductToArchive({ id: product.id, name: product.name })}
                    disabled={isPending}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
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

      {/* Modal de Crear / Editar Producto */}
      {isProductModalOpen && (
        <ProductFormModal
          businessId={businessId}
          businessType={businessType}
          commercialActivities={commercialActivities}
          categories={categories}
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

      {/* Pantalla Completa de Carga al Navegar a Menú Digital */}
      {isNavigatingMenu && (
        <AppLoadingScreen title="NEGOVA" subtitle="Cargando Menú Digital..." fullScreen={true} />
      )}
    </div>
  );
}
