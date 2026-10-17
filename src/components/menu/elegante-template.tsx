"use client";

import React, { useState, useMemo } from "react";
import {
  UtensilsCrossed,
  Phone,
  MapPin,
  MessageCircle,
  Share2,
  Clock,
  Layers,
  Search,
  X,
  ShoppingBag,
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

export function EleganteMenuTemplate({
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

  // Paleta Gastronomía de Autor & Lujo Contemporáneo
  const gold = settings?.primaryColor || "#C5A059";
  const bgNoir = settings?.secondaryColor || "#0C0D11";
  const surfaceNoir = "#13151C";

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
          text: `Carta gastronómica de ${business.name}`,
          url: window.location.href,
        }).catch(() => {});
      } else {
        navigator.clipboard.writeText(window.location.href);
        toast.success("Enlace de la carta copiado");
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
      } text-stone-200 antialiased selection:bg-[#C5A059]/25 relative`}
      style={{
        backgroundColor: bgNoir,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* 1. ENCABEZADO ELEGANTE */}
      <header className="pt-8 pb-7 px-4 border-b border-[#C5A059]/20 bg-gradient-to-b from-[#C5A059]/[0.04] to-transparent text-center">
        <div className="max-w-3xl mx-auto flex flex-col items-center">
          {business.logo_url ? (
            <div className="mb-3.5">
              <img
                src={business.logo_url}
                alt={business.name}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border border-[#C5A059]/40 shadow-xl bg-black/60"
              />
            </div>
          ) : (
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center border border-[#C5A059]/40 shadow-xl mb-3.5 bg-black/60"
              style={{ color: gold }}
            >
              <UtensilsCrossed className="w-8 h-8" />
            </div>
          )}

          <h1
            className="text-2xl sm:text-4xl font-normal tracking-[0.08em] uppercase text-stone-100"
            style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}
          >
            {settings?.bannerTitle || business.name}
          </h1>

          <p className="text-xs sm:text-sm text-stone-400 font-light tracking-wide mt-2 max-w-md mx-auto leading-relaxed">
            {settings?.bannerSubtitle || "Carta gastronómica & creaciones culinarias"}
          </p>

          {showContact && (
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 mt-5 text-xs font-light tracking-wide">
              {business.phone && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-[#C5A059]/20 text-stone-300">
                  <Phone className="w-3.5 h-3.5" style={{ color: gold }} />
                  <span>{business.phone}</span>
                </div>
              )}

              {showAddress && business.address && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-[#C5A059]/20 text-stone-300">
                  <MapPin className="w-3.5 h-3.5" style={{ color: gold }} />
                  <span>
                    {business.address}
                    {business.city ? `, ${business.city}` : ""}
                  </span>
                </div>
              )}

              {business.schedule && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-[#C5A059]/20 text-stone-300">
                  <Clock className="w-3.5 h-3.5" style={{ color: gold }} />
                  <span>{business.schedule}</span>
                </div>
              )}

              {!isPreview && (
                <button
                  onClick={handleShare}
                  className="p-2 rounded-full bg-white/[0.03] border border-[#C5A059]/20 hover:border-[#C5A059]/40 text-stone-400 hover:text-stone-200 transition-colors"
                  title="Compartir carta"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* 2. BUSCADOR & BARRA STICKY DE CATEGORÍAS */}
      <nav className="sticky top-0 z-30 bg-[#0C0D11]/95 backdrop-blur-md border-b border-[#C5A059]/20 px-3 py-2.5 shadow-md">
        <div className="max-w-4xl mx-auto space-y-2">
          {/* Buscador */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar en la carta..."
              className="w-full bg-white/[0.03] border border-[#C5A059]/20 focus:border-[#C5A059]/50 rounded-xl pl-9 pr-8 py-1.5 text-xs text-stone-200 placeholder-stone-500 outline-none transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-stone-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Categorías en Chips */}
          <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-1">
            <button
              onClick={() => setSelectedCat("all")}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs transition-all ${
                selectedCat === "all"
                  ? "font-semibold shadow-xs text-stone-900"
                  : "bg-white/[0.03] text-stone-400 hover:text-stone-200 border border-[#C5A059]/15"
              }`}
              style={{
                backgroundColor: selectedCat === "all" ? gold : undefined,
              }}
            >
              Toda la Carta ({products.length})
            </button>

            {categories.map((cat) => {
              const count = products.filter((p) => p.category_id === cat.id).length;
              if (count === 0) return null;
              const isSelected = selectedCat === cat.id;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCat(cat.id)}
                  className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs transition-all ${
                    isSelected
                      ? "font-semibold shadow-xs text-stone-900"
                      : "bg-white/[0.03] text-stone-400 hover:text-stone-200 border border-[#C5A059]/15"
                  }`}
                  style={{
                    backgroundColor: isSelected ? gold : undefined,
                  }}
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
        className={`mx-auto px-4 mt-8 pb-16 sm:pb-20 flex-1 w-full ${
          isList || isText ? "max-w-[720px] space-y-8" : isMobile ? "max-w-full space-y-10" : "max-w-4xl space-y-10"
        }`}
      >
        {groupedProducts.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white/[0.02] border border-[#C5A059]/15 rounded-2xl max-w-md mx-auto shadow-xl">
            <UtensilsCrossed className="w-10 h-10 mx-auto text-stone-600 mb-2" />
            <h3
              className="text-base text-stone-300 tracking-wider uppercase"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Carta en preparación
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              Las creaciones estarán disponibles en breve.
            </p>
          </div>
        ) : (
          groupedProducts.map((group) => (
            <section key={group.categoryId} className="w-full">
              {/* Encabezado Elegante Noir & Oro */}
              <div className="flex items-center gap-4 mb-5 mt-2 first:mt-0 text-center">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#C5A059]/40 to-transparent" />
                <h2
                  className="text-sm sm:text-base uppercase tracking-[0.2em] font-light text-stone-200"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  {group.categoryName} ({group.products.length})
                </h2>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#C5A059]/40 to-transparent" />
              </div>

              {/* Grid / Lista de platos */}
              <div
                className={
                  isList || isText
                    ? "flex flex-col gap-3 w-full"
                    : isMobile
                    ? "grid grid-cols-1 gap-4 w-full"
                    : "grid grid-cols-1 sm:grid-cols-2 gap-5 w-full"
                }
              >
                {group.products.map((p) => (
                  <EleganteProductCard
                    key={p.id}
                    product={p}
                    layout={layout}
                    goldColor={gold}
                    surfaceNoir={surfaceNoir}
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

      {/* FOOTER */}
      <footer className="mt-auto pt-12 pb-24 sm:pb-28 text-center border-t border-[#C5A059]/20 px-4 w-full">
        <p
          className="text-xs tracking-[0.1em] uppercase text-stone-300"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          {business.name}
        </p>
        <p className="text-[11px] text-stone-500 mt-1.5">
          Experiencia gastronómica impulsada por{" "}
          <span className="font-semibold" style={{ color: gold }}>
            NEGOVA
          </span>
        </p>
      </footer>

      {/* MODAL INTERACTIVO DE DETALLES & VARIANTES */}
      <ProductDetailModal
        product={modalProduct}
        isOpen={!!modalProduct}
        onClose={() => setModalProduct(null)}
        business={business}
        primaryColor={gold}
        theme="dark"
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

      {/* CARRITO FLOTANTE DESPLEGABLE & WHATSAPP (DEMO HTML) */}
      <MenuCartDrawer
        cart={cart}
        onUpdateQuantity={updateCartQuantity}
        onClearCart={clearCart}
        currency={business.currency || "COP"}
        businessName={business.name}
        whatsappPhone={cleanWhatsapp}
        theme="elegante"
        accentColor={gold}
        isPreview={isPreview}
      />
    </div>
  );
}

function EleganteProductCard({
  product,
  layout,
  goldColor,
  surfaceNoir,
  showPhotos,
  showDescriptions,
  showPrices,
  formatPrice,
  onOpenModal,
  onAddToCart,
}: {
  product: Product;
  layout: "grid" | "list" | "compact" | "text";
  goldColor: string;
  surfaceNoir: string;
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
      <div
        onClick={() => onOpenModal(product)}
        className="w-full py-2.5 px-2 border-b border-[#C5A059]/20 hover:bg-white/[0.02] transition-colors cursor-pointer flex flex-col gap-1.5"
      >
        <div>
          <h3 className="font-normal text-sm sm:text-base text-stone-100 leading-tight">
            {product.name}
          </h3>
          {showDescriptions && product.description && (
            <p className="font-light text-xs text-stone-400 mt-0.5 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          {showPrices && (
            <span className="font-medium text-sm text-[#C5A059]">
              {hasVariants ? `Desde ${formatPrice(minPrice)}` : formatPrice(product.price)}
            </span>
          )}

          <button
            type="button"
            onClick={handleAddClick}
            className="px-3.5 py-1 rounded-full border text-xs font-medium transition-colors"
            style={{
              borderColor: `${goldColor}60`,
              color: goldColor,
              backgroundColor: `${goldColor}10`,
            }}
          >
            {hasVariants ? "Opciones" : "+ Agregar"}
          </button>
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
        className="w-full h-24 sm:h-28 rounded-xl border border-[#C5A059]/20 hover:border-[#C5A059]/40 transition-all cursor-pointer flex flex-row overflow-hidden shadow-xs group items-stretch"
        style={{ backgroundColor: surfaceNoir }}
      >
        {hasPhoto && (
          <div className="w-22 sm:w-24 h-full shrink-0 bg-black/60 relative overflow-hidden">
            <img
              src={product.image_url!}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}

        <div className="p-2 sm:p-2.5 flex flex-col justify-between flex-1 min-w-0 h-full">
          <div>
            <h3 className="font-medium text-xs sm:text-sm text-stone-100 group-hover:text-amber-200 transition-colors leading-tight line-clamp-1">
              {product.name}
            </h3>

            {showDescriptions && product.description && (
              <p className="text-[11px] text-stone-400 font-light mt-0.5 line-clamp-1 leading-snug">
                {product.description}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-[#C5A059]/15">
            {showPrices && (
              <span className="font-semibold text-xs sm:text-sm text-stone-200">
                {hasVariants ? `Desde ${formatPrice(minPrice)}` : formatPrice(product.price)}
              </span>
            )}

            <button
              type="button"
              onClick={handleAddClick}
              className="px-3 py-0.5 rounded-full text-[11px] font-medium transition-colors hover:bg-white/10 border"
              style={{
                borderColor: `${goldColor}60`,
                color: goldColor,
                backgroundColor: `${goldColor}10`,
              }}
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
      className="w-full rounded-2xl border border-[#C5A059]/20 hover:border-[#C5A059]/40 transition-all cursor-pointer flex flex-col justify-between overflow-hidden shadow-xs group"
      style={{ backgroundColor: surfaceNoir }}
    >
      <div>
        {hasPhoto && (
          <div className="aspect-[16/10] w-full bg-black/60 relative overflow-hidden">
            <img
              src={product.image_url!}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {hasVariants && (
              <span className="absolute top-2.5 left-2.5 text-stone-200 bg-black/80 font-medium text-[10px] px-2.5 py-0.5 rounded-full border border-[#C5A059]/40">
                Opciones
              </span>
            )}
          </div>
        )}

        <div className="p-4">
          <h3 className="font-medium text-base text-stone-100 group-hover:text-amber-200 transition-colors leading-snug">
            {product.name}
          </h3>

          {showDescriptions && product.description && (
            <p className="text-xs text-stone-400 font-light mt-1.5 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}

          {hasVariants && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
              {variants.slice(0, 2).map((v) => (
                <span
                  key={v.id}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.03] border border-[#C5A059]/20 text-stone-300"
                >
                  {v.name}: {formatPrice(v.price)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 pt-0">
        <div className="flex items-center justify-between pt-3 border-t border-[#C5A059]/15">
          {showPrices && (
            <span className="font-semibold text-sm sm:text-base text-stone-200">
              {hasVariants ? `Desde ${formatPrice(minPrice)}` : formatPrice(product.price)}
            </span>
          )}

          <button
            type="button"
            onClick={handleAddClick}
            className="px-4 py-1.5 rounded-full text-xs font-medium transition-colors hover:bg-white/10 border"
            style={{
              borderColor: `${goldColor}60`,
              color: goldColor,
              backgroundColor: `${goldColor}10`,
            }}
          >
            {hasVariants ? "Elegir" : "+ Agregar"}
          </button>
        </div>
      </div>
    </div>
  );
}
