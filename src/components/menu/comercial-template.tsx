"use client";

import React, { useState, useMemo } from "react";
import {
  Phone,
  MapPin,
  MessageCircle,
  Share2,
  Clock,
  Layers,
  Search,
  X,
  ShoppingBag,
  Store,
} from "lucide-react";
import { Product, Category, ProductVariant } from "@/lib/products/types";
import { DigitalMenuCustomSettings, DigitalMenuPublicBusiness } from "@/lib/menu/types";
import { ProductDetailModal } from "./product-detail-modal";
import { MenuCartDrawer } from "./menu-cart-drawer";
import { CartItem } from "./menu-cart-types";
import { toast } from "sonner";

interface Props {
  business: DigitalMenuPublicBusiness;
  categories: Category[];
  products: Product[];
  settings?: DigitalMenuCustomSettings;
  isPreview?: boolean;
  isMobile?: boolean;
}

export function ComercialMenuTemplate({
  business,
  categories,
  products,
  settings,
  isPreview = false,
  isMobile = false,
}: Props) {
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<Record<string, CartItem>>({});

  // Paleta Blanco Minimal (Inspirada en el HTML Demo de Burger Brava: data-theme="blanco")
  const bgMain = settings?.secondaryColor || "#FAFAF8";
  const cardBg = "#FFFFFF";
  const borderTone = "#EBEBE7";
  const textMain = "#1A1A1A";

  const layout = settings?.layoutStyle || "grid"; // 'grid' | 'list' | 'text' | 'compact'
  const isList = layout === "list";
  const isText = layout === "text" || layout === "compact";

  const showPhotos = settings?.showPhotos ?? true;
  const showDescriptions = settings?.showDescriptions ?? true;
  const showPrices = settings?.showPrices ?? true;
  const showContact = settings?.showContactInfo ?? true;
  const showAddress = settings?.showAddress ?? true;

  const formatPrice = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: business.currency || "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleShare = () => {
    if (typeof window !== "undefined") {
      if (navigator.share) {
        navigator.share({
          title: business.name,
          text: `Menú de ${business.name}`,
          url: window.location.href,
        }).catch(() => {});
      } else {
        navigator.clipboard.writeText(window.location.href);
        toast.success("Enlace copiado al portapapeles");
      }
    }
  };

  const cleanWhatsapp = (business.whatsapp || business.phone || "").replace(/[^0-9]/g, "");

  const addToCart = (product: Product, variant?: ProductVariant, quantity = 1) => {
    const cartKey = variant ? `${product.id}_${variant.id}` : product.id;
    const unitPrice = variant ? variant.price : product.price;
    const variantName = variant ? variant.name : undefined;

    setCart((prev) => {
      const current = prev[cartKey];
      const newQty = (current ? current.quantity : 0) + quantity;
      return {
        ...prev,
        [cartKey]: {
          id: cartKey,
          productId: product.id,
          name: product.name,
          variantName,
          unitPrice,
          quantity: newQty,
          image_url: product.image_url,
        },
      };
    });
    toast.success(`Agregado: ${product.name}`);
  };

  const updateCartQuantity = (id: string, delta: number) => {
    setCart((prev) => {
      const item = prev[id];
      if (!item) return prev;
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return {
        ...prev,
        [id]: { ...item, quantity: newQty },
      };
    });
  };

  const clearCart = () => setCart({});

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description?.toLowerCase().includes(search.toLowerCase()) ?? false);
      const matchesCat = selectedCat === "all" || p.category_id === selectedCat;
      return matchesSearch && matchesCat;
    });
  }, [products, search, selectedCat]);

  // Agrupación ordenada por categoría
  const groupedProducts = useMemo(() => {
    if (filteredProducts.length === 0) return [];

    if (selectedCat !== "all") {
      const cat = categories.find((c) => c.id === selectedCat);
      return [
        {
          categoryId: selectedCat,
          categoryName: cat?.name || "Categoría",
          products: filteredProducts,
        },
      ];
    }

    if (search.trim() !== "") {
      return [
        {
          categoryId: "search-results",
          categoryName: "Resultados de búsqueda",
          products: filteredProducts,
        },
      ];
    }

    const groups: { categoryId: string; categoryName: string; products: Product[] }[] = [];

    categories.forEach((cat) => {
      const catProducts = products.filter((p) => p.category_id === cat.id);
      if (catProducts.length > 0) {
        groups.push({
          categoryId: cat.id,
          categoryName: cat.name,
          products: catProducts,
        });
      }
    });

    const uncategorized = products.filter(
      (p) => !p.category_id || !categories.some((c) => c.id === p.category_id)
    );
    if (uncategorized.length > 0) {
      groups.push({
        categoryId: "uncategorized",
        categoryName: "Otros",
        products: uncategorized,
      });
    }

    return groups;
  }, [products, categories, selectedCat, search, filteredProducts]);

  return (
    <div
      className={`w-full ${
        isPreview ? "min-h-full flex-1 flex flex-col" : "min-h-screen flex flex-col"
      } text-[#1A1A1A] antialiased selection:bg-slate-200 relative`}
      style={{
        backgroundColor: bgMain,
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* 1. ENCABEZADO BLANCO MINIMAL (ESTILO HTML DEMO data-theme="blanco") */}
      <header className="pt-8 pb-4 px-4 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
          <div className="flex items-center gap-3.5 text-center sm:text-left">
            {business.logo_url ? (
              <img
                src={business.logo_url}
                alt={business.name}
                className="w-16 h-16 rounded-full object-cover border border-[#EBEBE7] shadow-xs"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[#111111] text-white flex items-center justify-center font-bold">
                <Store className="w-8 h-8" />
              </div>
            )}
            <div>
              <h1 className="text-2xl sm:text-4xl font-light tracking-tight text-[#111111] leading-none">
                {settings?.bannerTitle || business.name}
              </h1>
              <p className="text-[11px] sm:text-xs tracking-widest uppercase text-slate-500 font-semibold mt-1">
                {settings?.bannerSubtitle || "Catálogo oficial & pedidos directos"}
              </p>
            </div>
          </div>

          {!isPreview && (
            <button
              onClick={handleShare}
              className="p-2.5 rounded-full border border-[#EBEBE7] bg-white hover:bg-slate-50 transition-colors shadow-xs text-slate-700"
              title="Compartir catálogo"
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* 2. BUSCADOR & BARRA STICKY DE CATEGORÍAS */}
      <nav className="sticky top-0 z-30 bg-[#FAFAF8]/95 backdrop-blur-md border-b border-[#EBEBE7] px-4 py-2.5">
        <div className="max-w-4xl mx-auto space-y-2">
          {/* Buscador */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar en el catálogo..."
              className="w-full bg-white border border-[#EBEBE7] rounded-full pl-10 pr-9 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 outline-none shadow-xs"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Categorías en Chips Redondeados */}
          <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-1">
            <button
              onClick={() => setSelectedCat("all")}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                selectedCat === "all"
                  ? "bg-[#111111] text-white shadow-xs"
                  : "bg-white border border-[#EBEBE7] text-slate-700 hover:bg-slate-100"
              }`}
            >
              Todos ({products.length})
            </button>

            {categories.map((cat) => {
              const count = products.filter((p) => p.category_id === cat.id).length;
              if (count === 0) return null;
              const isSelected = selectedCat === cat.id;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCat(cat.id)}
                  className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    isSelected
                      ? "bg-[#111111] text-white shadow-xs"
                      : "bg-white border border-[#EBEBE7] text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* 3. PRODUCTOS SEGÚN DISPOSICIÓN AGRUPADOS POR CATEGORÍA */}
      <main
        className={`mx-auto px-4 mt-8 pb-16 sm:pb-20 w-full flex-1 ${
          isList ? "max-w-[720px] space-y-8" : isText ? "max-w-[720px] space-y-8" : isMobile ? "max-w-full space-y-10" : "max-w-4xl space-y-10"
        }`}
      >
        {groupedProducts.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white border border-[#EBEBE7] rounded-2xl max-w-md mx-auto shadow-xs">
            <ShoppingBag className="w-10 h-10 mx-auto text-slate-400 mb-2" />
            <h3 className="text-base font-bold text-slate-800">No encontramos resultados</h3>
            <p className="text-xs text-slate-500 mt-1">
              Prueba con otra búsqueda o selecciona otra categoría.
            </p>
          </div>
        ) : (
          groupedProducts.map((group) => (
            <section key={group.categoryId} className="w-full">
              {/* Encabezado limpio de categoría */}
              <div className="flex items-center justify-between pb-2 mb-4 mt-2 first:mt-0 border-b border-[#EBEBE7]">
                <h2 className="text-base sm:text-lg font-light tracking-tight text-[#111111]">
                  {group.categoryName}
                </h2>
                <span className="text-xs text-slate-400 font-mono">
                  {group.products.length} {group.products.length === 1 ? "opción" : "opciones"}
                </span>
              </div>

              {/* Grid / Lista de platos */}
              <div
                className={
                  isList
                    ? "flex flex-col gap-3 w-full"
                    : isText
                    ? "flex flex-col w-full"
                    : isMobile
                    ? "grid grid-cols-1 gap-4 w-full"
                    : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 w-full"
                }
              >
                {group.products.map((p) => (
                  <BlancoProductCard
                    key={p.id}
                    product={p}
                    layout={layout}
                    cardBg={cardBg}
                    borderTone={borderTone}
                    showPhotos={showPhotos}
                    showDescriptions={showDescriptions}
                    showPrices={showPrices}
                    formatPrice={formatPrice}
                    onOpenModal={(prod) => setModalProduct(prod)}
                    onAddToCart={(prod, v) => addToCart(prod, v)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {/* 4. PIE DE INFORMACIÓN ELEGANTE EN 3 COLUMNAS (ESTILO HTML DEMO data-theme="blanco") */}
      {showContact && (
        <section className="max-w-4xl mx-auto px-4 mt-auto pt-12 pb-24 sm:pb-28 border-t border-[#EBEBE7] w-full">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center sm:text-left">
            {showAddress && business.address && (
              <div className="sm:border-l sm:border-[#EBEBE7] sm:pl-6 first:border-l-0 first:pl-0">
                <small className="block tracking-widest text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Punto físico
                </small>
                <p className="font-light text-sm sm:text-base text-slate-800 leading-relaxed">
                  {business.address}
                  {business.city ? `, ${business.city}` : ""}
                </p>
              </div>
            )}

            {business.schedule && (
              <div className="sm:border-l sm:border-[#EBEBE7] sm:pl-6">
                <small className="block tracking-widest text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Horario de atención
                </small>
                <p className="font-light text-sm sm:text-base text-slate-800 leading-relaxed">
                  {business.schedule}
                </p>
              </div>
            )}

            {business.phone && (
              <div className="sm:border-l sm:border-[#EBEBE7] sm:pl-6">
                <small className="block tracking-widest text-[10px] font-bold text-slate-400 uppercase mb-1">
                  WhatsApp / Pedidos
                </small>
                <p className="font-light text-sm sm:text-base text-slate-800 leading-relaxed">
                  {business.phone}
                </p>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-slate-400 mt-10">
            {business.name} &bull; Impulsado por <b>NEGOVA</b>
          </p>
        </section>
      )}

      {/* 5. MODAL INTERACTIVO DE DETALLES & VARIANTES */}
      <ProductDetailModal
        product={modalProduct}
        isOpen={!!modalProduct}
        onClose={() => setModalProduct(null)}
        business={business}
        primaryColor="#111111"
        theme="light"
        onAddToCart={(item) => {
          setCart((prev) => {
            const cartKey = item.variantName ? `${item.productId}_${item.variantName}` : item.productId;
            const current = prev[cartKey];
            const newQty = (current ? current.quantity : 0) + item.quantity;
            return {
              ...prev,
              [cartKey]: {
                id: cartKey,
                productId: item.productId,
                name: item.name,
                variantName: item.variantName,
                unitPrice: item.unitPrice,
                quantity: newQty,
                image_url: item.image_url,
              },
            };
          });
          toast.success(`Agregado al pedido: ${item.name}`);
        }}
      />

      {/* 6. CARRITO FLOTANTE DESPLEGABLE & WHATSAPP (DEMO HTML) */}
      <MenuCartDrawer
        cart={cart}
        onUpdateQuantity={updateCartQuantity}
        onClearCart={clearCart}
        currency={business.currency || "COP"}
        businessName={business.name}
        whatsappPhone={cleanWhatsapp}
        theme="light"
        accentColor="#111111"
        isPreview={isPreview}
      />
    </div>
  );
}

function BlancoProductCard({
  product,
  layout,
  cardBg,
  borderTone,
  showPhotos,
  showDescriptions,
  showPrices,
  formatPrice,
  onOpenModal,
  onAddToCart,
}: {
  product: Product;
  layout: "grid" | "list" | "compact" | "text";
  cardBg: string;
  borderTone: string;
  showPhotos: boolean;
  showDescriptions: boolean;
  showPrices: boolean;
  formatPrice: (p: number) => string;
  onOpenModal: (p: Product) => void;
  onAddToCart: (p: Product, variant?: ProductVariant) => void;
}) {
  const hasPhoto = showPhotos && !!product.image_url;
  const isList = layout === "list";
  const isText = layout === "text" || layout === "compact";

  const variants: ProductVariant[] = useMemo(() => {
    const meta = product.metadata as any;
    if (meta?.has_variants && Array.isArray(meta?.variants) && meta.variants.length > 0) {
      return meta.variants.filter((v: ProductVariant) => v.is_available !== false);
    }
    return [];
  }, [product]);

  const hasVariants = variants.length > 0;
  const minPrice = hasVariants ? Math.min(...variants.map((v) => v.price)) : product.price;

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasVariants) {
      onOpenModal(product);
    } else {
      onAddToCart(product);
    }
  };

  // ==========================================
  // DISPOSICIÓN 3: SOLO TEXTO (≡ Solo texto)
  // ==========================================
  if (isText) {
    return (
      <div className="w-full border-b-[1.5px] border-dashed border-black pb-2 mb-1">
        <div
          onClick={() => onOpenModal(product)}
          className="w-full py-3 px-2 rounded-xl transform transition-all duration-200 ease-out hover:scale-[1.015] hover:bg-black/[0.03] cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <h3 className="font-bold text-lg text-black tracking-tight leading-snug group-hover:text-neutral-700 transition-colors">
              {product.name}
            </h3>
            {showDescriptions && product.description && (
              <p className="font-normal text-xs sm:text-[13px] text-neutral-600 mt-1 line-clamp-2 leading-relaxed">
                {product.description}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between mt-3 pt-1">
            {showPrices && (
              <span className="font-bold text-xl text-black tracking-tight">
                {hasVariants ? `Desde ${formatPrice(minPrice)}` : formatPrice(product.price)}
              </span>
            )}

            <button
              type="button"
              onClick={handleAddClick}
              className="px-4 py-2 bg-black hover:bg-neutral-800 text-white font-bold text-xs rounded-full transition-all duration-150 hover:scale-105 active:scale-95 shadow-sm"
            >
              {hasVariants ? "+ Opciones" : "+ Agregar"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // DISPOSICIÓN 2: LISTA HORIZONTAL (☰ Lista)
  // ==========================================
  if (isList) {
    return (
      <div
        onClick={() => onOpenModal(product)}
        className="w-full h-24 sm:h-28 rounded-[14px] border border-[#EBEBE7] hover:border-slate-300 transition-all cursor-pointer flex flex-row overflow-hidden shadow-xs hover:shadow-sm group items-stretch"
        style={{ backgroundColor: cardBg }}
      >
        {hasPhoto && (
          <div className="w-22 sm:w-24 h-full shrink-0 bg-slate-100 relative overflow-hidden">
            <img
              src={product.image_url!}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}

        <div className="p-2 sm:p-2.5 flex flex-col justify-between flex-1 min-w-0 h-full">
          <div>
            <h3 className="font-bold text-xs sm:text-sm text-[#111111] leading-tight line-clamp-1">
              {product.name}
            </h3>

            {showDescriptions && product.description && (
              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1 leading-snug">
                {product.description}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-[#EBEBE7]">
            {showPrices && (
              <span className="font-semibold text-xs sm:text-sm text-slate-900">
                {hasVariants ? `Desde ${formatPrice(minPrice)}` : formatPrice(product.price)}
              </span>
            )}

            <button
              type="button"
              onClick={handleAddClick}
              className="px-2.5 py-1 bg-[#111111] hover:bg-slate-800 text-white font-medium text-[11px] rounded-full transition-transform active:scale-95 shadow-xs"
            >
              {hasVariants ? "Opciones" : "+ Agregar"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // DISPOSICIÓN 1: TARJETAS EN CUADRÍCULA (▦ Tarjetas)
  // ==========================================
  return (
    <div
      onClick={() => onOpenModal(product)}
      className="w-full rounded-[18px] border border-[#EBEBE7] hover:border-slate-300 transition-all cursor-pointer flex flex-col justify-between overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:shadow-md group"
      style={{ backgroundColor: cardBg }}
    >
      <div>
        {hasPhoto && (
          <div className="m-2 rounded-[12px] h-36 sm:h-40 overflow-hidden bg-slate-100 relative">
            <img
              src={product.image_url!}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {hasVariants && (
              <span className="absolute top-2 left-2 text-slate-900 bg-white/95 backdrop-blur-xs font-semibold text-[10px] px-2 py-0.5 rounded-full shadow-xs">
                Opciones
              </span>
            )}
          </div>
        )}

        <div className="p-4 pt-2">
          <h3 className="font-bold text-base text-[#111111] leading-snug">
            {product.name}
          </h3>

          {showDescriptions && product.description && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}

          {hasVariants && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
              {variants.slice(0, 2).map((v) => (
                <span
                  key={v.id}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
                >
                  {v.name}: {formatPrice(v.price)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 pt-0">
        <div className="flex items-center justify-between pt-3 border-t border-[#EBEBE7]">
          {showPrices && (
            <span className="font-semibold text-sm sm:text-base text-slate-900">
              {hasVariants ? `Desde ${formatPrice(minPrice)}` : formatPrice(product.price)}
            </span>
          )}

          <button
            type="button"
            onClick={handleAddClick}
            className="px-4 py-1.5 bg-[#111111] hover:bg-slate-800 text-white font-medium text-xs rounded-full transition-transform active:scale-95 shadow-xs"
          >
            {hasVariants ? "Elegir" : "+ Agregar"}
          </button>
        </div>
      </div>
    </div>
  );
}
