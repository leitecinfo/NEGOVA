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

export function UrbanaMenuTemplate({
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

  // Paleta Oscuro Rojo & Blanco (Inspirada en el HTML Demo de Burger Brava: data-theme="rojo")
  const primary = settings?.primaryColor || "#E10600"; // Rojo de alto voltaje
  const bgMain = settings?.secondaryColor || "#0A0A0A"; // Fondo negro puro
  const cardBg = "#161616";
  const borderTone = "#2A2A2A";

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
      } text-white antialiased selection:bg-[#E10600]/30 overflow-x-hidden relative`}
      style={{
        backgroundColor: bgMain,
        fontFamily: "'Outfit', 'Arial Narrow', Impact, sans-serif",
      }}
    >
      {/* 1. ENCABEZADO OSCURO ROJO Y BLANCO */}
      <header className="pt-7 pb-4 px-4 text-center">
        {business.logo_url && (
          <div className="flex justify-center mb-3">
            <img
              src={business.logo_url}
              alt={business.name}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover border-2 border-[#2A2A2A] shadow-xl bg-[#161616]"
            />
          </div>
        )}

        <h1 className="text-3xl sm:text-5xl font-black italic tracking-wider uppercase text-white drop-shadow-md">
          {settings?.bannerTitle || business.name}
        </h1>

        {/* Línea decorativa roja en ángulo (como en el HTML de referencia) */}
        <div
          className="w-24 h-1.5 mx-auto mt-2 rounded-xs"
          style={{
            backgroundColor: primary,
            transform: "skewX(-25deg)",
          }}
        />

        <p className="font-sans text-xs sm:text-sm text-slate-300 font-medium tracking-wide mt-2 max-w-md mx-auto">
          {settings?.bannerSubtitle || "Comida rápida · Domicilios y para llevar"}
        </p>

        {!isPreview && (
          <div className="mt-3 flex justify-center">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs font-bold uppercase text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Compartir Menú</span>
            </button>
          </div>
        )}
      </header>

      {/* 2. HERO SLANTED BANNER (SANGRADO COMPLETO: SOBRESALE DE EXTREMO A EXTREMO SIN BORDES) */}
      {showContact && (business.address || business.schedule || business.phone) && (
        <section className="w-full my-4 overflow-hidden">
          <div
            className="w-full py-8 px-4 sm:px-8 flex flex-wrap gap-6 items-center justify-around text-center shadow-2xl relative"
            style={{
              backgroundColor: primary,
              clipPath: "polygon(0 0, 100% 8%, 100% 100%, 0 92%)",
            }}
          >
            {showAddress && business.address && (
              <div>
                <span className="text-[10px] tracking-widest font-black uppercase text-white/80 block">
                  Visítanos
                </span>
                <p className="font-black text-base sm:text-xl uppercase text-white mt-0.5">
                  {business.address}
                </p>
                {business.city && (
                  <p className="text-xs text-white/90 font-sans">{business.city}</p>
                )}
              </div>
            )}

            {business.schedule && (
              <div>
                <span className="text-[10px] tracking-widest font-black uppercase text-white/80 block">
                  Abierto
                </span>
                <p className="font-black text-base sm:text-xl uppercase text-white mt-0.5">
                  {business.schedule}
                </p>
              </div>
            )}

            {business.phone && (
              <a
                href={cleanWhatsapp ? `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent("Hola, quiero hacer un pedido")}` : `tel:${business.phone}`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 py-3 px-6 font-black text-xs uppercase shadow-md transition-all hover:scale-105 active:scale-95 text-[#E10600] bg-white rounded-xs"
                style={{
                  transform: "skewX(-8deg)",
                }}
              >
                <span>📲 {business.phone}</span>
              </a>
            )}
          </div>
        </section>
      )}

      {/* 3. BUSCADOR & BARRA STICKY DE CATEGORÍAS */}
      <nav className="sticky top-0 z-30 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-[#2A2A2A] px-3 py-2.5 shadow-md">
        <div className="max-w-4xl mx-auto space-y-2">
          {/* Buscador */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar platillo o ingrediente..."
              className="w-full bg-[#161616] border border-[#2A2A2A] focus:border-[#E10600] rounded-lg pl-9 pr-8 py-1.5 text-xs text-white placeholder-slate-500 outline-none transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Categorías en Chips con ángulo sesgado en seleccionado */}
          <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-1">
            <button
              onClick={() => setSelectedCat("all")}
              className={`whitespace-nowrap px-4 py-1.5 rounded-sm text-xs font-black uppercase tracking-wider border transition-all ${
                selectedCat === "all"
                  ? "bg-[#E10600] border-[#E10600] text-white shadow-md"
                  : "bg-[#161616] border-[#2A2A2A] text-slate-300 hover:border-slate-500"
              }`}
              style={{
                transform: selectedCat === "all" ? "skewX(-8deg)" : undefined,
              }}
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
                  className={`whitespace-nowrap px-4 py-1.5 rounded-sm text-xs font-black uppercase tracking-wider border transition-all ${
                    isSelected
                      ? "bg-[#E10600] border-[#E10600] text-white shadow-md"
                      : "bg-[#161616] border-[#2A2A2A] text-slate-300 hover:border-slate-500"
                  }`}
                  style={{
                    transform: isSelected ? "skewX(-8deg)" : undefined,
                  }}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* 4. PRODUCTOS SEGÚN DISPOSICIÓN SELECCIONADA AGRUPADOS POR CATEGORÍA */}
      <main
        className={`mx-auto px-4 mt-8 pb-16 sm:pb-20 flex-1 w-full ${
          isList || isText ? "max-w-[720px] space-y-8" : isMobile ? "max-w-full space-y-10" : "max-w-5xl space-y-10"
        }`}
      >
        {groupedProducts.length === 0 ? (
          <div className="text-center py-16 px-4 bg-[#161616] border border-[#2A2A2A] rounded-xl max-w-md mx-auto">
            <ShoppingBag className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <h3 className="text-base font-black uppercase text-white">Sin coincidencias</h3>
            <p className="text-xs text-slate-400 mt-1 font-sans">
              Prueba con otra búsqueda o selecciona otra categoría arriba.
            </p>
          </div>
        ) : (
          groupedProducts.map((group) => (
            <section key={group.categoryId} className="w-full">
              {/* Título de la Categoría */}
              <div className="flex items-center gap-3 mb-4 mt-2 first:mt-0">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-5 rounded-full" style={{ backgroundColor: primary }} />
                  <h2 className="text-base sm:text-lg font-black italic uppercase tracking-wider text-white">
                    {group.categoryName}
                  </h2>
                  <span className="text-xs font-bold text-slate-500 font-sans">
                    ({group.products.length})
                  </span>
                </div>
                <div className="flex-1 h-px bg-[#2A2A2A]" />
              </div>

              {/* Grid / Lista de platos */}
              <div
                className={
                  isList || isText
                    ? "flex flex-col gap-3 w-full"
                    : isMobile
                    ? "grid grid-cols-1 gap-4 w-full"
                    : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full"
                }
              >
                {group.products.map((p) => (
                  <UrbanaProductCard
                    key={p.id}
                    product={p}
                    layout={layout}
                    primaryColor={primary}
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

      {/* FOOTER */}
      <footer className="mt-auto pt-12 pb-24 sm:pb-28 text-center border-t border-[#2A2A2A] px-4 w-full">
        <p className="text-xs font-black uppercase tracking-wider text-white">
          {business.name}
        </p>
        <p className="font-sans text-[11px] text-slate-500 mt-1.5">
          Menú interactivo impulsado por{" "}
          <span className="font-black" style={{ color: primary }}>
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
        primaryColor={primary}
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
        theme="dark"
        accentColor={primary}
        isPreview={isPreview}
      />
    </div>
  );
}

function UrbanaProductCard({
  product,
  layout,
  primaryColor,
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
  primaryColor: string;
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
      <div
        onClick={() => onOpenModal(product)}
        className="w-full py-2.5 px-2 border-b border-dashed border-[#E10600]/40 hover:bg-white/[0.03] transition-colors cursor-pointer flex flex-col gap-1.5"
      >
        <div>
          <h3 className="font-black text-sm sm:text-base uppercase tracking-wide text-white hover:text-amber-300 transition-colors leading-tight">
            {product.name}
          </h3>
          {showDescriptions && product.description && (
            <p className="font-sans text-xs text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          {showPrices && (
            <span
              className="font-black text-xs sm:text-sm px-2.5 py-0.5 text-white"
              style={{
                backgroundColor: primaryColor,
                transform: "skewX(-10deg)",
              }}
            >
              {hasVariants ? `Desde ${formatPrice(minPrice)}` : formatPrice(product.price)}
            </span>
          )}

          <button
            type="button"
            onClick={handleAddClick}
            className="px-3 py-1 bg-white hover:bg-slate-200 text-black font-black text-xs uppercase tracking-wider transition-transform active:scale-95 rounded-sm"
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
        className="w-full h-24 sm:h-28 rounded-lg border border-[#2A2A2A] hover:border-[#E10600]/60 transition-all cursor-pointer flex flex-row overflow-hidden shadow-md group items-stretch"
        style={{
          backgroundColor: cardBg,
          borderLeft: `4px solid ${primaryColor}`,
        }}
      >
        {hasPhoto && (
          <div className="w-24 sm:w-28 h-full shrink-0 bg-black/60 relative overflow-hidden">
            <img
              src={product.image_url!}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}

        <div className="p-2 sm:p-2.5 flex flex-col justify-between flex-1 min-w-0 h-full">
          <div>
            <h3 className="font-black text-xs sm:text-sm uppercase tracking-wide text-white group-hover:text-amber-300 transition-colors leading-tight line-clamp-1">
              {product.name}
            </h3>

            {showDescriptions && product.description && (
              <p className="font-sans text-[11px] text-slate-400 mt-0.5 line-clamp-1 leading-snug">
                {product.description}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-[#2A2A2A]">
            {showPrices && (
              <span
                className="font-black text-[11px] sm:text-xs px-2 py-0.5 text-white"
                style={{
                  backgroundColor: primaryColor,
                  transform: "skewX(-10deg)",
                }}
              >
                {hasVariants ? `Desde ${formatPrice(minPrice)}` : formatPrice(product.price)}
              </span>
            )}

            <button
              type="button"
              onClick={handleAddClick}
              className="px-2.5 py-1 bg-white hover:bg-slate-200 text-black font-black text-[11px] uppercase tracking-wider transition-transform active:scale-95 rounded-sm"
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
      className="w-full rounded-lg border border-[#2A2A2A] hover:border-[#E10600]/80 hover:-translate-y-1 hover:shadow-[0_8px_26px_rgba(225,6,0,0.35)] transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden shadow-md group"
      style={{
        backgroundColor: cardBg,
        borderLeft: `4px solid ${primaryColor}`,
      }}
    >
      <div>
        {hasPhoto && (
          <div className="aspect-[16/10] w-full bg-black/50 relative overflow-hidden">
            <img
              src={product.image_url!}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {hasVariants && (
              <span
                className="absolute top-2.5 left-2.5 text-white font-black text-[10px] px-2 py-0.5 uppercase shadow-md"
                style={{
                  backgroundColor: primaryColor,
                  transform: "skewX(-10deg)",
                }}
              >
                Opciones
              </span>
            )}
          </div>
        )}

        <div className="p-4">
          <h3 className="font-black text-base uppercase tracking-wide text-white group-hover:text-amber-300 transition-colors leading-snug">
            {product.name}
          </h3>

          {showDescriptions && product.description && (
            <p className="font-sans text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}

          {hasVariants && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
              {variants.slice(0, 2).map((v) => (
                <span
                  key={v.id}
                  className="font-sans text-[10px] font-bold px-2 py-0.5 rounded-xs bg-white/5 border border-white/10 text-slate-300"
                >
                  {v.name}: {formatPrice(v.price)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 pt-0">
        <div className="flex items-center justify-between pt-3 border-t border-[#2A2A2A]">
          {showPrices && (
            <span
              className="font-black text-xs sm:text-sm px-2.5 py-0.5 text-white"
              style={{
                backgroundColor: primaryColor,
                transform: "skewX(-10deg)",
              }}
            >
              {hasVariants ? `Desde ${formatPrice(minPrice)}` : formatPrice(product.price)}
            </span>
          )}

          <button
            type="button"
            onClick={handleAddClick}
            className="px-4 py-1.5 bg-white hover:bg-slate-200 text-black font-black text-xs uppercase tracking-wider transition-all duration-150 hover:scale-105 active:scale-90 rounded-sm"
          >
            {hasVariants ? "Elegir" : "+ Agregar"}
          </button>
        </div>
      </div>
    </div>
  );
}
