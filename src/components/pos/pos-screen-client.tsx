"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Search,
  X,
  Plus,
  Minus,
  Trash2,
  Layers,
  Store,
  Receipt,
  FileText,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Filter,
  Info,
  ArrowRight,
} from "lucide-react";
import { Product, Category, ProductVariant } from "@/lib/products/types";
import {
  PosCartItem,
  PosSelectedModifier,
  PosOrderSummary,
  calculateCartSummary,
  createCartItem,
  formatCOP,
} from "@/lib/pos/types";
import { RestaurantTable } from "@/lib/restaurant/types";
import { ModifierSelectionModal } from "./modifier-selection-modal";
import { OrderDestinationModal } from "./order-destination-modal";
import { OrderSuccessModal } from "./order-success-modal";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { ModalPortal } from "@/components/ui/modal-portal";
import { toast } from "sonner";

interface PosScreenClientProps {
  businessId: string;
  businessName: string;
  tradeName?: string;
  primaryColor?: string;
  initialProducts: Product[];
  initialCategories: Category[];
  initialTables?: RestaurantTable[];
  initialSelectedTableId?: string;
  onSwitchToManualForm?: () => void;
  onOrderReady?: (order: PosOrderSummary) => void;
}

export function PosScreenClient({
  businessId,
  businessName,
  tradeName,
  primaryColor = "#ED500A",
  initialProducts,
  initialCategories,
  initialTables = [],
  initialSelectedTableId,
  onSwitchToManualForm,
  onOrderReady,
}: PosScreenClientProps) {
  const router = useRouter();

  // 1. Estado del catálogo
  const [products] = useState<Product[]>(initialProducts);
  const [categories] = useState<Category[]>(initialCategories);
  const tables = initialTables;

  // 2. Filtros y búsqueda
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);

  // 3. Estado del Carrito / Pedido Temporal en memoria (Etapa 2)
  const [cartItems, setCartItems] = useState<PosCartItem[]>([]);

  // 4. Estados de modales
  const [productForModifiers, setProductForModifiers] = useState<Product | null>(null);
  const [isClearCartConfirmOpen, setIsClearCartConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<PosCartItem | null>(null);
  const [isDestinationModalOpen, setIsDestinationModalOpen] = useState(false);
  const [successOrder, setSuccessOrder] = useState<{
    orderNumber: number;
    orderId: string;
    total: number;
  } | null>(null);

  // 5. Mobile bottom sheet drawer toggle
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // Cálculo del resumen en tiempo real (puro, sin impuestos ni descuentos extra en esta fase)
  const summary: PosOrderSummary = useMemo(() => {
    return calculateCartSummary(cartItems);
  }, [cartItems]);

  // Filtrado de productos en memoria
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      // Filtro de texto por nombre o descripción
      if (q) {
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesDesc = p.description?.toLowerCase().includes(q) || false;
        if (!matchesName && !matchesDesc) return false;
      }
      // Filtro de categoría
      if (selectedCategory !== "all" && p.category_id !== selectedCategory) {
        return false;
      }
      // Filtro de disponibilidad
      if (showOnlyAvailable && !p.is_available) {
        return false;
      }
      return true;
    });
  }, [products, search, selectedCategory, showOnlyAvailable]);

  // Conteo de productos por categoría
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: products.length };
    products.forEach((p) => {
      if (p.category_id) {
        counts[p.category_id] = (counts[p.category_id] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

  // Manejo de clic en producto
  const handleProductClick = (product: Product) => {
    if (!product.is_available) {
      toast.error(`«${product.name}» está agotado temporalmente.`);
      return;
    }

    const modifierGroups = (product.metadata as any)?.modifier_groups || [];
    const hasVariants = Boolean(
      (product.metadata as any)?.has_variants &&
      Array.isArray((product.metadata as any)?.variants) &&
      (product.metadata as any).variants.length > 0
    );

    if (modifierGroups.length > 0 || hasVariants) {
      // Abre modal de personalización (variante y/o complementos)
      setProductForModifiers(product);
    } else {
      // Producto directo sin variantes ni complementos: agregar inmediatamente con 1 clic
      handleAddToCart(product, [], 1);
    }
  };

  // Agregar al carrito en memoria
  const handleAddToCart = (
    product: Product,
    selectedModifiers: PosSelectedModifier[] = [],
    quantity: number = 1,
    notes?: string,
    variant?: ProductVariant | null
  ) => {
    const newItem = createCartItem(product, selectedModifiers, quantity, notes, variant);

    setCartItems((prev) => {
      const existingIdx = prev.findIndex((item) => item.id === newItem.id);
      if (existingIdx >= 0) {
        // Misma combinación idéntica: incrementar cantidad
        const updated = [...prev];
        const existing = updated[existingIdx];
        const newQty = existing.quantity + quantity;
        updated[existingIdx] = {
          ...existing,
          quantity: newQty,
          lineTotal: existing.unitPrice * newQty,
        };
        return updated;
      } else {
        // Nueva combinación de producto o complementos: agregar como nueva línea
        return [...prev, newItem];
      }
    });

    toast.success(`«${product.name}» agregado al pedido`, {
      description:
        selectedModifiers.length > 0
          ? `${selectedModifiers.length} complementos incluidos`
          : undefined,
      duration: 2000,
    });
  };

  // Modificar cantidad en una línea
  const handleUpdateQuantity = (itemId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.id !== itemId) return item;
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null; // Será filtrado
          return {
            ...item,
            quantity: nextQty,
            lineTotal: item.unitPrice * nextQty,
          };
        })
        .filter(Boolean) as PosCartItem[]
    );
  };

  // Eliminar una línea del pedido
  const handleRemoveItem = (itemId: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== itemId));
    setItemToDelete(null);
    toast.info("Producto eliminado del pedido");
  };

  // Vaciar carrito con confirmación
  const handleClearCart = () => {
    setCartItems([]);
    setIsClearCartConfirmOpen(false);
    toast.success("Comanda vaciada");
  };


  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-[1600px] mx-auto w-full p-2.5 sm:p-4 lg:p-3.5 xl:p-4 gap-3 sm:gap-3.5 overflow-hidden">
      {/* 1. TOP BAR / CABECERA DEL POS */}
      <header className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center font-black text-lg shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Punto de Venta (POS)
              </h1>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400">
                Selección de pedido
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {tradeName || businessName} · Catálogo y comanda temporal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onSwitchToManualForm && (
            <button
              type="button"
              onClick={onSwitchToManualForm}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Facturación Manual</span>
            </button>
          )}

          <Link
            href={`/workspace/${businessId}/productos`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-colors"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Gestionar Catálogo</span>
          </Link>

          {/* Botón flotante móvil para ver carrito */}
          <button
            type="button"
            onClick={() => setIsMobileCartOpen(true)}
            className="lg:hidden relative inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold bg-[#ED500A] text-white rounded-xl shadow-sm"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Ver Pedido</span>
            {summary.itemsCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-white text-[#ED500A] text-[10px] font-black flex items-center justify-center">
                {summary.itemsCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* 2. CONTENEDOR PRINCIPAL: CATÁLOGO (IZQUIERDA) + COMANDA (DERECHA) */}
      <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
        {/* PANEL IZQUIERDO: CATÁLOGO Y FILTROS */}
        <section className="flex-1 flex flex-col gap-2.5 sm:gap-3 min-w-0 bg-white dark:bg-[#0B0E14] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-2.5 sm:p-3.5 shadow-xs overflow-hidden">
          {/* BUSCADOR Y TOGGLE DE DISPONIBILIDAD */}
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o descripción..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowOnlyAvailable(!showOnlyAvailable)}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-colors shrink-0 ${
                showOnlyAvailable
                  ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                  : "bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/[0.08]"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Solo disponibles</span>
            </button>
          </div>

          {/* PÍLDORAS DE CATEGORÍAS (SCROLL HORIZONTAL) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === "all"
                  ? "bg-[#ED500A] text-white shadow-xs"
                  : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10"
              }`}
            >
              Todas ({categoryCounts.all || 0})
            </button>

            {categories.map((cat) => {
              const count = categoryCounts[cat.id] || 0;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    isSelected
                      ? "bg-[#ED500A] text-white shadow-xs"
                      : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10"
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>

          {/* GRID DE PRODUCTOS */}
          <div className={`flex-1 overflow-y-auto pr-1 ${summary.itemsCount > 0 ? "pb-28 lg:pb-2" : "pb-4"}`}>
            {products.length === 0 ? (
              // Catálogo vacío total
              <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Layers className="w-8 h-8" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Catálogo sin productos
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Aún no has registrado productos en tu negocio. Registra platos, bebidas o
                    artículos para habilitar el POS.
                  </p>
                </div>
                <Link
                  href={`/workspace/${businessId}/productos`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#ED500A] text-white hover:bg-[#ED500A]/90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Crear productos ahora</span>
                </Link>
              </div>
            ) : filteredProducts.length === 0 ? (
              // Búsqueda sin coincidencias
              <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-400 flex items-center justify-center">
                  <Search className="w-7 h-7" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    No hay productos coincidentes
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No encontramos ningún producto que coincida con tus criterios de búsqueda o
                    categoría.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSelectedCategory("all");
                    setShowOnlyAvailable(false);
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                >
                  Limpiar filtros
                </button>
              </div>
            ) : (
              // Cuadrícula adaptativa basada en el ancho real disponible del contenedor
              <div className="grid grid-cols-[repeat(auto-fill,minmax(145px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(155px,1fr))] xl:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2.5 sm:gap-3.5">
                {filteredProducts.map((prod) => {
                  const hasModifiers =
                    ((prod.metadata as any)?.modifier_groups || []).length > 0;
                  const rawVariants: any[] = (prod.metadata as any)?.variants || [];
                  const hasVariants = Boolean(
                    (prod.metadata as any)?.has_variants && rawVariants.length > 0
                  );
                  const minVariantPrice = hasVariants
                    ? Math.min(...rawVariants.map((v) => v.price || 0))
                    : null;
                  const isAvailable = prod.is_available;
                  const catName =
                    prod.categories?.name ||
                    categories.find((c) => c.id === prod.category_id)?.name ||
                    "Sin categoría";

                  return (
                    <div
                      key={prod.id}
                      onClick={() => handleProductClick(prod)}
                      className={`group relative flex flex-col bg-white dark:bg-[#0D0F16] border rounded-2xl overflow-hidden transition-all text-left shadow-xs ${
                        !isAvailable
                          ? "border-slate-200/60 dark:border-white/5 opacity-60 cursor-not-allowed"
                          : "border-slate-200/80 dark:border-white/[0.08] hover:border-[#ED500A]/50 hover:shadow-md cursor-pointer active:scale-[0.99]"
                      }`}
                    >
                      {/* IMAGEN O ICONO DEL PRODUCTO */}
                      <div className="relative w-full aspect-[4/3] bg-slate-100 dark:bg-white/5 overflow-hidden shrink-0">
                        {prod.image_url ? (
                          <img
                            src={prod.image_url}
                            alt={prod.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-white/20">
                            <Layers className="w-7 h-7 sm:w-8 sm:h-8" />
                          </div>
                        )}

                        {/* BADGES SUPERIORES */}
                        <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-none gap-1">
                          {hasVariants ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-[#ED500A] text-white shadow-xs backdrop-blur-xs flex items-center gap-1 shrink-0">
                              <Sparkles className="w-2 h-2" />
                              <span>{rawVariants.length} Opc.</span>
                            </span>
                          ) : hasModifiers ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-purple-600/90 text-white shadow-xs backdrop-blur-xs flex items-center gap-1 shrink-0">
                              <Sparkles className="w-2 h-2" />
                              <span>Opciones</span>
                            </span>
                          ) : (
                            <span />
                          )}

                          {!isAvailable && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-red-600 text-white shadow-xs shrink-0">
                              Agotado
                            </span>
                          )}
                        </div>
                      </div>

                      {/* INFORMACIÓN DEL PRODUCTO */}
                      <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between gap-1.5 min-w-0">
                        <div className="min-w-0 space-y-0.5">
                          <div className="text-[9px] sm:text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono truncate">
                            {catName}
                          </div>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-[#ED500A] transition-colors break-words min-h-[2.3em]">
                            {prod.name}
                          </h4>
                        </div>

                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-white/5 gap-1.5 mt-auto">
                          <div className="min-w-0 flex-1">
                            {hasVariants && (
                              <span className="text-[9px] text-slate-400 block font-mono leading-none">Desde</span>
                            )}
                            <span className="text-xs sm:text-sm font-black text-[#ED500A] font-mono truncate block">
                              {hasVariants && minVariantPrice !== null
                                ? formatCOP(minVariantPrice)
                                : formatCOP(prod.price)}
                            </span>
                          </div>

                          <button
                            type="button"
                            disabled={!isAvailable}
                            aria-label={`Agregar ${prod.name}`}
                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                              !isAvailable
                                ? "bg-slate-100 dark:bg-white/5 text-slate-400 cursor-not-allowed"
                                : "bg-[#ED500A]/10 text-[#ED500A] group-hover:bg-[#ED500A] group-hover:text-white hover:scale-105 active:scale-95 shadow-xs"
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* PANEL DERECHO: COMANDA / CARRITO DE COMPRAS (DESKTOP) */}
        <aside className="hidden lg:flex w-[290px] xl:w-[330px] 2xl:w-[360px] shrink-0 flex-col bg-white dark:bg-[#0B0E14] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs overflow-hidden">
          {/* Header de la comanda */}
          <div className="p-3 sm:p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                  Comanda actual
                </h3>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {summary.itemsCount} {summary.itemsCount === 1 ? "artículo" : "artículos"}
                </span>
              </div>
            </div>

            {cartItems.length > 0 && (
              <button
                type="button"
                onClick={() => setIsClearCartConfirmOpen(true)}
                className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                title="Vaciar comanda"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Lista de productos de la comanda */}
          <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-2.5">
            {cartItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-2 text-slate-400">
                <ShoppingBag className="w-10 h-10 stroke-[1.5] text-slate-300 dark:text-white/20" />
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 max-w-[200px]">
                  Tu comanda está vacía. Selecciona productos para iniciar el pedido.
                </p>
              </div>
            ) : (
              cartItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 rounded-xl space-y-2 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {item.productName}
                      </h4>
                      <p className="text-[11px] text-[#ED500A] font-semibold">
                        {formatCOP(item.unitPrice)} c/u
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setItemToDelete(item)}
                      className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Modificadores detallados */}
                  {item.selectedModifiers.length > 0 && (
                    <div className="space-y-0.5 pt-1 border-t border-slate-200/50 dark:border-white/5">
                      {item.selectedModifiers.map((mod, mIdx) => (
                        <div
                          key={mIdx}
                          className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400"
                        >
                          <span className="truncate">
                            • {mod.groupName}: {mod.optionName}
                          </span>
                          {mod.price > 0 && (
                            <span className="text-slate-600 dark:text-slate-300 shrink-0 font-medium">
                              +{formatCOP(mod.price)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Nota */}
                  {item.notes && (
                    <p className="text-[10px] italic text-slate-500 dark:text-slate-400 bg-amber-50/60 dark:bg-amber-500/5 p-1 rounded border border-amber-200/40">
                      «{item.notes}»
                    </p>
                  )}

                  {/* Selector de cantidad y total de la línea */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-white/5">
                    <div className="flex items-center bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.id, -1)}
                        className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-xs font-bold text-slate-900 dark:text-white">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.id, 1)}
                        className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      {formatCOP(item.lineTotal)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Resumen de totales y botón de acción (Etapa 2) */}
          <div className="p-3 sm:p-4 bg-slate-50/90 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 space-y-3">
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span>Subtotal ({summary.itemsCount} productos)</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {formatCOP(summary.subtotal)}
                </span>
              </div>
              <div className="flex items-center justify-between text-base font-black text-slate-900 dark:text-white pt-1 border-t border-slate-200/80 dark:border-white/5">
                <span>Total comanda</span>
                <span className="text-[#ED500A]">{formatCOP(summary.total)}</span>
              </div>
            </div>

            <button
              type="button"
              disabled={cartItems.length === 0}
              onClick={() => setIsDestinationModalOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-bold text-xs sm:text-sm bg-[#ED500A] hover:bg-[#ED500A]/90 text-white shadow-md shadow-[#ED500A]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
            >
              <span className="truncate">Continuar pedido · {formatCOP(summary.total)}</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </aside>
      </div>

      {/* 3. MODAL DE COMPLEMENTOS Y MODIFICADORES */}
      <ModifierSelectionModal
        isOpen={Boolean(productForModifiers)}
        product={productForModifiers}
        onClose={() => setProductForModifiers(null)}
        onConfirm={(selectedMods, qty, notes, selectedVariant) => {
          if (productForModifiers) {
            handleAddToCart(productForModifiers, selectedMods, qty, notes, selectedVariant);
          }
        }}
      />

      {/* 4. MODAL DE CONFIRMACIÓN PARA VACIAR COMANDA */}
      <ConfirmModal
        isOpen={isClearCartConfirmOpen}
        onClose={() => setIsClearCartConfirmOpen(false)}
        onConfirm={handleClearCart}
        title="¿Vaciar comanda completa?"
        description="Se eliminarán todos los productos y configuraciones seleccionados en este pedido."
        confirmText="Vaciar pedido"
        variant="danger"
      />

      {/* 5. MODAL DE CONFIRMACIÓN PARA ELIMINAR ÍTEM INDIVIDUAL */}
      <ConfirmModal
        isOpen={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => {
          if (itemToDelete) {
            handleRemoveItem(itemToDelete.id);
          }
        }}
        title={`¿Eliminar «${itemToDelete?.productName}»?`}
        description="Este producto será removido de la comanda actual."
        confirmText="Eliminar"
        variant="danger"
      />

      {/* 6. MODAL DE DESTINO Y CANAL DEL PEDIDO (ETAPA 3) */}
      <OrderDestinationModal
        isOpen={isDestinationModalOpen}
        businessId={businessId}
        businessName={businessName}
        tradeName={tradeName}
        cartItems={cartItems}
        summary={summary}
        tables={tables}
        initialTableId={initialSelectedTableId}
        onClose={() => setIsDestinationModalOpen(false)}
        onOrderSuccess={(orderNumber, orderId) => {
          setIsDestinationModalOpen(false);
          setIsMobileCartOpen(false);
          setSuccessOrder({
            orderNumber,
            orderId,
            total: summary.total,
          });
          setCartItems([]);
          router.refresh();
          if (onOrderReady) {
            onOrderReady(summary);
          }
        }}
      />

      {/* 7. MODAL DE CONFIRMACIÓN DE ÉXITO (ETAPA 3) */}
      <OrderSuccessModal
        isOpen={Boolean(successOrder)}
        orderNumber={successOrder?.orderNumber || 0}
        orderId={successOrder?.orderId || ""}
        total={successOrder?.total || 0}
        businessId={businessId}
        onClose={() => {
          setSuccessOrder(null);
          setCartItems([]);
        }}
        onNewOrder={() => {
          setCartItems([]);
          setSuccessOrder(null);
        }}
      />

      {/* 7. DRAWER MÓVIL DEL CARRITO / COMANDA (MOBILE-FIRST) */}
      {isMobileCartOpen && (
        <ModalPortal>
          <div className="fixed inset-0 m-0 z-[9999] lg:hidden flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-h-[88vh] bg-white dark:bg-[#0D0F16] rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
              {/* Header del drawer */}
              <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center font-bold">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                      Comanda actual
                    </h3>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {summary.itemsCount} {summary.itemsCount === 1 ? "artículo" : "artículos"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {cartItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsClearCartConfirmOpen(true)}
                      className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      title="Vaciar comanda"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsMobileCartOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Lista de productos con scroll táctil */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cartItems.length === 0 ? (
                  <div className="h-full py-12 flex flex-col items-center justify-center text-center space-y-2 text-slate-400">
                    <ShoppingBag className="w-12 h-12 stroke-[1.5] text-slate-300 dark:text-white/20" />
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 max-w-[220px]">
                      Tu comanda está vacía. Selecciona productos del catálogo para armar el pedido.
                    </p>
                  </div>
                ) : (
                  cartItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 bg-slate-50/90 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/5 rounded-2xl space-y-2.5"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {item.productName}
                          </h4>
                          <span className="text-xs text-[#ED500A] font-semibold">
                            {formatCOP(item.unitPrice)} c/u
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setItemToDelete(item)}
                          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Modificadores detallados */}
                      {item.selectedModifiers.length > 0 && (
                        <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-200/50 dark:border-white/5">
                          {item.selectedModifiers.map((m, idx) => (
                            <div key={idx} className="flex justify-between items-center">
                              <span className="truncate">• {m.optionName}</span>
                              {m.price > 0 && (
                                <span className="font-medium text-slate-600 dark:text-slate-300 shrink-0">
                                  +{formatCOP(m.price)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Nota del ítem */}
                      {item.notes && (
                        <p className="text-[11px] italic text-slate-600 dark:text-slate-300 bg-amber-50/80 dark:bg-amber-500/10 p-2 rounded-xl border border-amber-200/50 dark:border-amber-500/20">
                          «{item.notes}»
                        </p>
                      )}

                      {/* Controles táctiles de cantidad y subtotal */}
                      <div className="flex justify-between items-center pt-2 border-t border-slate-200/50 dark:border-white/5">
                        <div className="flex items-center bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl p-1">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.id, -1)}
                            className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center text-xs font-bold text-slate-900 dark:text-white">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.id, 1)}
                            className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <span className="text-sm font-black text-slate-900 dark:text-white">
                          {formatCOP(item.lineTotal)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Totales y botón de confirmación en mobile drawer */}
              <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 space-y-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>Subtotal ({summary.itemsCount} productos)</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {formatCOP(summary.subtotal)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-base font-black text-slate-900 dark:text-white pt-1 border-t border-slate-200/70 dark:border-white/5">
                  <span>Total comanda</span>
                  <span className="text-[#ED500A]">{formatCOP(summary.total)}</span>
                </div>

                <button
                  type="button"
                  disabled={cartItems.length === 0}
                  onClick={() => {
                    setIsMobileCartOpen(false);
                    setIsDestinationModalOpen(true);
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm bg-[#ED500A] hover:bg-[#ED500A]/90 text-white shadow-lg shadow-[#ED500A]/25 min-h-[48px] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Continuar pedido — {formatCOP(summary.total)}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* 8. BARRA INFERIOR PERSISTENTE PARA CELULARES (MOBILE-FIRST) */}
      {summary.itemsCount > 0 && !isMobileCartOpen && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 p-2.5 sm:p-3 bg-white/95 dark:bg-[#0D0F16]/95 backdrop-blur-md border-t border-slate-200/90 dark:border-white/[0.08] shadow-[0_-8px_20px_rgba(0,0,0,0.12)] pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-all">
          <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => setIsMobileCartOpen(true)}
              className="flex items-center gap-2.5 text-left min-w-0 flex-1 hover:opacity-90 active:scale-[0.99] transition-transform"
            >
              <div className="relative w-11 h-11 rounded-xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center shrink-0">
                <ShoppingBag className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#ED500A] text-white text-[11px] font-black flex items-center justify-center shadow-xs">
                  {summary.itemsCount}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {summary.itemsCount} {summary.itemsCount === 1 ? "artículo" : "artículos"}
                </div>
                <div className="text-sm font-black text-slate-900 dark:text-white truncate">
                  {formatCOP(summary.total)}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setIsMobileCartOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl font-bold text-xs bg-[#ED500A] hover:bg-[#ED500A]/90 text-white shadow-md shadow-[#ED500A]/25 shrink-0 active:scale-[0.98] transition-transform min-h-[44px]"
            >
              <span>Ver Pedido</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
