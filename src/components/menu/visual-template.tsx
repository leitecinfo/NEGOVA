"use client";

import React, { useState, useMemo } from "react";
import {
  Phone,
  MapPin,
  MessageCircle,
  Share2,
  ShoppingBag,
  Clock,
  Layers,
  Search,
  X,
  Plus,
  UtensilsCrossed,
} from "lucide-react";
import { Product, Category, ProductVariant } from "@/lib/products/types";
import { DigitalMenuCustomSettings, DigitalMenuPublicBusiness } from "@/lib/menu/types";
import { ProductDetailModal } from "./product-detail-modal";
import { MenuCartDrawer } from "./menu-cart-drawer";
import { CartItem } from "./menu-cart-types";
import { toast } from "sonner";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp/order-whatsapp-service";
import { PublicPaymentMethodDTO } from "@/lib/payments/types";

interface Props {
  business: DigitalMenuPublicBusiness;
  categories: Category[];
  products: Product[];
  settings?: DigitalMenuCustomSettings;
  paymentMethods?: PublicPaymentMethodDTO[];
  isPreview?: boolean;
  isMobile?: boolean;
  activeTable?: { id: string; name_or_number: string } | null;
  tableToken?: string | null;
}

export function VisualMenuTemplate({
  business,
  categories,
  products,
  settings,
  paymentMethods,
  isPreview = false,
  isMobile = false,
  activeTable,
  tableToken,
}: Props) {
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<Record<string, CartItem>>({});

  // Paleta Neo-Brutalista (Inspirada en el HTML Demo de Burger Brava)
  const bg = settings?.secondaryColor || "#FFF7E0"; // Fondo crema / amarillo cálido
  const ac = settings?.primaryColor || "#FF3B30"; // Rojo de acento
  const ac2 = settings?.accentColor || "#FFD60A"; // Amarillo eléctrico

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

  const normWa = normalizeWhatsAppNumber(business.whatsapp || business.phone);
  const cleanWhatsapp = normWa.isValid ? normWa.normalized : "";

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
          variantId: variant?.id || null,
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

  // Ticker marquee categories dinámico y continuo
  const categoryTickerString = useMemo(() => {
    const rawList =
      categories.length > 0
        ? categories.map((c) => c.name.trim().toUpperCase())
        : ["HAMBURGUESAS", "SALCHIPAPAS", "PERROS CALIENTES", "BEBIDAS", "PIZZAS", "COMBOS"];

    // Formato con la estrella ✦ como pidió el usuario
    const formatted = rawList.map((name) => `✦ ${name}`).join(" ") + " ✦ ";
    return (formatted + " ").repeat(4);
  }, [categories]);

  return (
    <div
      className={`w-full ${
        isPreview ? "min-h-full flex-1 flex flex-col" : "min-h-screen flex flex-col"
      } text-[#111111] antialiased selection:bg-[#FFD60A] relative`}
      style={{
        backgroundColor: bg,
        fontFamily: "'Arial Black', 'Impact', 'Outfit', sans-serif",
      }}
    >
      {/* Inline styles para animación ininterrumpida de marquesina */}
      <style>{`
        @keyframes brutalMarquee {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-50%, 0, 0);
          }
        }
        .brutal-marquee-track {
          display: flex;
          width: max-content;
          animation: brutalMarquee 24s linear infinite;
          will-change: transform;
        }
        .brutal-marquee-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* 1. STICKERS NEO-BRUTALISTAS SUPERIORES */}
      {showContact && (
        <section className="flex flex-wrap gap-3 justify-center pt-4 px-4">
          {showAddress && business.address && (
            <div
              className="p-2.5 px-3.5 text-xs text-[#111111] border-[3px] border-[#111111] shadow-[4px_4px_0_#111111] max-w-[260px] leading-snug"
              style={{
                backgroundColor: ac2,
                transform: "rotate(-2deg)",
              }}
            >
              <div className="flex items-center gap-1 font-black text-xs uppercase">
                <MapPin className="w-3.5 h-3.5" />
                <span>Punto físico</span>
              </div>
              <p className="font-sans font-bold text-[11px] mt-0.5">
                {business.address}
                {business.city ? `, ${business.city}` : ""}
              </p>
            </div>
          )}

          {business.schedule && (
            <div
              className="p-2.5 px-3.5 text-xs text-[#111111] border-[3px] border-[#111111] shadow-[4px_4px_0_#111111] max-w-[260px] leading-snug bg-white"
              style={{
                transform: "rotate(1.5deg)",
              }}
            >
              <div className="flex items-center gap-1 font-black text-xs uppercase">
                <Clock className="w-3.5 h-3.5" />
                <span>Horario</span>
              </div>
              <p className="font-sans font-bold text-[11px] mt-0.5">{business.schedule}</p>
            </div>
          )}

          {business.phone && (
            <div
              className="p-2.5 px-3.5 text-xs text-white border-[3px] border-[#111111] shadow-[4px_4px_0_#111111] max-w-[260px] leading-snug"
              style={{
                backgroundColor: ac,
                transform: "rotate(-1deg)",
              }}
            >
              <div className="flex items-center gap-1 font-black text-xs uppercase">
                <Phone className="w-3.5 h-3.5" />
                <span>Contacto</span>
              </div>
              <p className="font-sans font-bold text-[11px] mt-0.5">{business.phone}</p>
            </div>
          )}
        </section>
      )}

      {/* 2. ENCABEZADO NEO-BRUTALISTA */}
      <header className="pt-6 pb-4 px-4 text-center">
        {business.logo_url && (
          <div className="flex justify-center mb-3">
            <img
              src={business.logo_url}
              alt={business.name}
              className="w-20 h-20 sm:w-24 sm:h-24 object-cover border-[3px] border-[#111111] shadow-[4px_4px_0_#111111] bg-white"
            />
          </div>
        )}

        <h1
          className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-[#111111] drop-shadow-[3px_3px_0_#FFD60A] leading-tight"
        >
          {settings?.bannerTitle || business.name}
        </h1>

        {settings?.bannerSubtitle && (
          <p className="font-sans font-bold text-xs sm:text-sm text-[#111111]/80 mt-1 max-w-md mx-auto">
            {settings.bannerSubtitle}
          </p>
        )}

        {activeTable && (
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-[#FFD60A] border-[2px] border-[#111111] shadow-[2px_2px_0_#111111] text-xs font-black uppercase text-[#111111]">
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>Mesa: <strong>{activeTable.name_or_number}</strong></span>
          </div>
        )}

        {!isPreview && (
          <div className="mt-3 flex justify-center">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border-[2px] border-[#111111] shadow-[2px_2px_0_#111111] bg-white text-xs font-black uppercase hover:bg-[#FFD60A] transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Compartir Menú</span>
            </button>
          </div>
        )}
      </header>

      {/* 3. TICKER CONTINUO CON MARQUESINA */}
      <div className="overflow-hidden whitespace-nowrap bg-[#111111] text-[#FFD60A] py-2.5 border-y-[3px] border-[#111111] my-3 select-none">
        <div className="brutal-marquee-track">
          <span className="font-black text-xs sm:text-sm uppercase tracking-widest px-2">
            {categoryTickerString}
          </span>
          <span className="font-black text-xs sm:text-sm uppercase tracking-widest px-2" aria-hidden="true">
            {categoryTickerString}
          </span>
        </div>
      </div>

      {/* 4. BUSCADOR & BARRA STICKY DE CATEGORÍAS */}
      <nav className="sticky top-0 z-30 bg-[#FFF7E0]/95 backdrop-blur-md border-b-[3px] border-[#111111] px-3 py-2.5 shadow-[0_4px_0_#111111]">
        <div className="max-w-4xl mx-auto space-y-2">
          {/* Buscador */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#111111] pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="BUSCAR EN EL MENÚ..."
              className="w-full bg-white border-[3px] border-[#111111] shadow-[3px_3px_0_#111111] pl-9 pr-8 py-1.5 text-xs font-bold text-[#111111] placeholder-[#111111]/50 outline-none uppercase"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-[#111111]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Categorías en Chips con Borde Brutalista */}
          <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-1">
            <button
              onClick={() => setSelectedCat("all")}
              className={`whitespace-nowrap px-4 py-1.5 text-xs font-black uppercase tracking-wider border-[3px] border-[#111111] shadow-[3px_3px_0_#111111] transition-transform active:translate-x-[2px] active:translate-y-[2px] ${
                selectedCat === "all"
                  ? "bg-[#FF3B30] text-white"
                  : "bg-white text-[#111111] hover:bg-[#FFD60A]"
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
                  className={`whitespace-nowrap px-4 py-1.5 text-xs font-black uppercase tracking-wider border-[3px] border-[#111111] shadow-[3px_3px_0_#111111] transition-transform active:translate-x-[2px] active:translate-y-[2px] ${
                    isSelected
                      ? "bg-[#FF3B30] text-white"
                      : "bg-white text-[#111111] hover:bg-[#FFD60A]"
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* 5. GRID / LISTA / TEXTO DE PRODUCTOS AGRUPADOS POR CATEGORÍA */}
      <main
        className={`mx-auto px-4 mt-8 pb-16 sm:pb-20 w-full flex-1 ${
          isList ? "max-w-[720px] space-y-8" : isText ? "max-w-[720px] space-y-8" : isMobile ? "max-w-full space-y-10" : "max-w-5xl space-y-10"
        }`}
      >
        {groupedProducts.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white border-[3px] border-[#111111] shadow-[5px_5px_0_#111111] max-w-md mx-auto">
            <ShoppingBag className="w-10 h-10 mx-auto text-[#111111] mb-2" />
            <h3 className="text-base font-black uppercase">Sin coincidencias</h3>
            <p className="font-sans text-xs text-[#111111]/70 mt-1">
              Prueba con otra búsqueda o selecciona otra categoría.
            </p>
          </div>
        ) : (
          groupedProducts.map((group) => (
            <section key={group.categoryId} className="w-full">
              {/* Encabezado Sticker Neo-Brutalista de Categoría */}
              <div className="flex items-center gap-3 mb-4 mt-2 first:mt-0">
                <div
                  className="px-3.5 py-1.5 border-[3px] border-[#111111] font-black uppercase text-xs sm:text-sm tracking-wider shadow-[3px_3px_0_#111111]"
                  style={{ backgroundColor: ac2 }}
                >
                  {group.categoryName} ({group.products.length})
                </div>
                <div className="flex-1 h-[3px] bg-[#111111]" />
              </div>

              {/* Grid / Lista de platos de este grupo */}
              <div
                className={
                  isList
                    ? "flex flex-col gap-3 w-full"
                    : isText
                    ? "flex flex-col gap-0 w-full"
                    : isMobile
                    ? "grid grid-cols-1 gap-4 w-full"
                    : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full"
                }
              >
                {group.products.map((p) => (
                  <BrutalProductCard
                    key={p.id}
                    product={p}
                    layout={layout}
                    backgroundColor={bg}
                    primaryColor={ac}
                    accentColor={ac2}
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

      {/* FOOTER CON SEPARACIÓN AMPLIA Y RESPIRO GENEROSO */}
      <footer className="mt-auto pt-12 pb-24 sm:pb-28 text-center border-t-[3px] border-[#111111] px-4 w-full">
        <p className="text-sm font-black uppercase tracking-wider text-[#111111]">
          {business.name}
        </p>
        <p className="font-sans text-xs text-[#111111]/75 mt-1.5">
          Menú digital interactivo impulsado por <b>NEGOVA</b>
        </p>
      </footer>

      {/* 6. MODAL INTERACTIVO DE DETALLES & VARIANTES */}
      <ProductDetailModal
        product={modalProduct}
        isOpen={!!modalProduct}
        onClose={() => setModalProduct(null)}
        business={business}
        primaryColor={ac}
        theme="light"
        onAddToCart={(item) => {
          setCart((prev) => {
            const modHash = (item.selectedModifiers || [])
              .map((m) => `${m.groupId}:${m.optionId}`)
              .sort()
              .join("|");
            const cartKey = item.variantId
              ? `${item.productId}_${item.variantId}${modHash ? `_${modHash}` : ""}`
              : `${item.productId}${modHash ? `_${modHash}` : ""}`;
            const current = prev[cartKey];
            const newQty = (current ? current.quantity : 0) + item.quantity;
            return {
              ...prev,
              [cartKey]: {
                id: cartKey,
                productId: item.productId,
                variantId: item.variantId || null,
                name: item.name,
                variantName: item.variantName,
                unitPrice: item.unitPrice,
                quantity: newQty,
                image_url: item.image_url,
                selectedModifiers: item.selectedModifiers,
              },
            };
          });
          toast.success(`Agregado al pedido: ${item.name}`);
        }}
      />

      {/* 7. CARRITO FLOTANTE DESPLEGABLE & MODALIDADES */}
      <MenuCartDrawer
        cart={cart}
        onUpdateQuantity={updateCartQuantity}
        onClearCart={clearCart}
        currency={business.currency || "COP"}
        businessId={business.id}
        businessName={business.name}
        whatsappPhone={cleanWhatsapp}
        theme="brutal"
        accentColor={ac}
        isPreview={isPreview}
        activeTable={activeTable}
        tableToken={tableToken}
        deliveryFee={settings?.deliveryFee || 0}
        deliveryEnabled={settings?.deliveryEnabled !== false}
        paymentMethods={paymentMethods}
      />
    </div>
  );
}

function BrutalProductCard({
  product,
  layout,
  backgroundColor,
  primaryColor,
  accentColor,
  showPhotos,
  showDescriptions,
  showPrices,
  formatPrice,
  onOpenModal,
  onAddToCart,
}: {
  product: Product;
  layout: "grid" | "list" | "compact" | "text";
  backgroundColor: string;
  primaryColor: string;
  accentColor: string;
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
      <div className="w-full border-b-[1.5px] border-dashed border-[#FF3B30] pb-2 mb-2 last:border-b-0">
        <div
          onClick={() => onOpenModal(product)}
          style={{ backgroundColor }}
          className="w-full p-3 sm:p-4 rounded-none cursor-pointer transition-all duration-150 border-[2.5px] border-transparent hover:border-[#111111] hover:shadow-[4px_4px_0_#111111] hover:-translate-x-[2px] hover:-translate-y-[2px] flex flex-col gap-2 group"
        >
          <div>
            <h3 className="font-black text-base sm:text-lg uppercase text-[#111111] leading-tight tracking-tight">
              {product.name}
            </h3>
            {showDescriptions && product.description && (
              <p className="font-sans font-normal text-xs sm:text-[13px] text-[#111111]/80 mt-1 leading-relaxed">
                {product.description}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            {showPrices && (
              <span className="font-black text-xl sm:text-2xl text-[#FF3B30] tracking-tight">
                {hasVariants ? `Desde ${formatPrice(minPrice)}` : formatPrice(product.price)}
              </span>
            )}

            <button
              type="button"
              onClick={handleAddClick}
              className="px-4 py-2 bg-[#FFD60A] text-[#111111] border-[2px] border-[#111111] font-black text-xs sm:text-sm uppercase tracking-wider shadow-[2px_2px_0_#111111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-transform"
            >
              {hasVariants ? "Opciones" : "+ Agregar"}
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
        className="w-full h-24 sm:h-28 bg-white border-[3px] border-[#111111] shadow-[4px_4px_0_#111111] hover:shadow-[6px_6px_0_#111111] hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all cursor-pointer flex flex-row overflow-hidden items-stretch"
      >
        {/* Foto miniatura izquierda */}
        {hasPhoto ? (
          <div className="w-22 sm:w-24 h-full shrink-0 border-r-[3px] border-[#111111] bg-[#FFD60A] relative overflow-hidden">
            <img
              src={product.image_url!}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-20 h-full shrink-0 border-r-[3px] border-[#111111] bg-[#FFD60A] flex items-center justify-center font-black text-lg">
            🍔
          </div>
        )}

        <div className="p-2 sm:p-2.5 flex flex-col justify-between flex-1 min-w-0 h-full">
          <div>
            <h3 className="font-black text-xs sm:text-sm uppercase text-[#111111] leading-tight line-clamp-1">
              {product.name}
            </h3>

            {showDescriptions && product.description && (
              <p className="font-sans text-[11px] text-[#111111]/75 mt-0.5 line-clamp-1 leading-snug">
                {product.description}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between pt-1 border-t-[2px] border-[#111111]/15">
            {showPrices && (
              <span className="font-black text-xs sm:text-sm text-[#FF3B30]">
                {hasVariants ? `Desde ${formatPrice(minPrice)}` : formatPrice(product.price)}
              </span>
            )}

            <button
              type="button"
              onClick={handleAddClick}
              className="px-2.5 py-1 bg-[#FFD60A] hover:bg-[#FF3B30] hover:text-white border-[2px] border-[#111111] font-black text-[11px] uppercase tracking-wider transition-all shadow-[2px_2px_0_#111111] active:translate-x-[1px] active:translate-y-[1px]"
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
      className="w-full bg-white border-[3px] border-[#111111] shadow-[5px_5px_0_#111111] hover:shadow-[8px_8px_0_#111111] hover:-translate-x-[2px] hover:-translate-y-[2px] transition-all cursor-pointer flex flex-col justify-between overflow-hidden group"
    >
      <div>
        {/* Imagen / Placeholder enérgico */}
        {hasPhoto ? (
          <div className="h-44 sm:h-48 w-full border-b-[3px] border-[#111111] bg-[#FFD60A] relative overflow-hidden">
            <img
              src={product.image_url!}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {hasVariants && (
              <span className="absolute top-2.5 left-2.5 bg-white text-[#111111] font-black text-[11px] px-2 py-0.5 border-[2px] border-[#111111] shadow-[2px_2px_0_#111111] -rotate-3 uppercase">
                Opciones disponibles
              </span>
            )}
          </div>
        ) : (
          <div className="h-32 w-full border-b-[3px] border-[#111111] bg-gradient-to-tr from-[#FFD60A] to-[#FF3B30] flex items-center justify-center text-4xl">
            🍔
          </div>
        )}

        <div className="p-4">
          <h3 className="font-black text-base uppercase text-[#111111] group-hover:text-[#FF3B30] transition-colors leading-snug">
            {product.name}
          </h3>

          {showDescriptions && product.description && (
            <p className="font-sans text-xs text-[#111111]/75 mt-1.5 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}

          {hasVariants && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
              {variants.slice(0, 2).map((v) => (
                <span
                  key={v.id}
                  className="font-sans text-[10px] font-bold px-2 py-0.5 border-[1.5px] border-[#111111] bg-[#FFF7E0] text-[#111111]"
                >
                  {v.name}: {formatPrice(v.price)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 pt-0">
        <div className="flex items-center justify-between pt-3 border-t-[2px] border-[#111111]/10">
          {showPrices && (
            <span className="font-black text-base sm:text-lg text-[#FF3B30]">
              {hasVariants ? `Desde ${formatPrice(minPrice)}` : formatPrice(product.price)}
            </span>
          )}

          <button
            type="button"
            onClick={handleAddClick}
            className="px-4 py-2 bg-[#FFD60A] hover:bg-[#FF3B30] hover:text-white border-[2.5px] border-[#111111] font-black text-xs uppercase tracking-wider transition-all shadow-[3px_3px_0_#111111] active:translate-x-[2px] active:translate-y-[2px]"
          >
            {hasVariants ? "Elegir" : "+ Agregar"}
          </button>
        </div>
      </div>
    </div>
  );
}
