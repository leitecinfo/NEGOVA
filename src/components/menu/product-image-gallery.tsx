"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, Package, Sparkles } from "lucide-react";

interface ProductImageGalleryProps {
  images: string[];
  productName: string;
  theme?: "dark" | "light";
  primaryColor?: string;
  className?: string;
  children?: React.ReactNode; // Permite proyectar elementos flotantes como badges o botones de cierre
}

export function ProductImageGallery({
  images,
  productName,
  theme = "dark",
  primaryColor = "#ED500A",
  className = "",
  children,
}: ProductImageGalleryProps) {
  const isDark = theme === "dark";
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const touchStartX = useRef<number | null>(null);

  // Reiniciar al índice 0 si cambia la lista de imágenes
  useEffect(() => {
    setActiveIndex(0);
  }, [images]);

  const handlePrev = useCallback(() => {
    if (images.length <= 1) return;
    setActiveIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  }, [images.length]);

  const handleNext = useCallback(() => {
    if (images.length <= 1) return;
    setActiveIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  }, [images.length]);

  // Navegación por teclado (Flechas izquierda y derecha)
  useEffect(() => {
    if (images.length <= 1) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [images.length, handlePrev, handleNext]);

  // Manejo de gestos táctiles (Swipe en móviles)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      touchStartX.current = e.touches[0].clientX;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || e.changedTouches.length === 0) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    const threshold = 40; // Mínimo deslizamiento en píxeles

    if (diff > threshold) {
      handlePrev();
    } else if (diff < -threshold) {
      handleNext();
    }
    touchStartX.current = null;
  };

  // CASO 1: Producto sin imágenes (Fallback visual neutro y profesional)
  if (!images || images.length === 0) {
    return (
      <div className={`relative w-full ${className}`}>
        <div
          className={`h-28 sm:h-32 w-full flex flex-col items-center justify-center gap-1.5 border-b transition-colors ${
            isDark
              ? "bg-[#181B26] border-white/10 text-slate-400"
              : "bg-slate-100 border-slate-200 text-slate-500"
          }`}
        >
          <div className="w-10 h-10 rounded-2xl bg-black/10 dark:bg-white/5 flex items-center justify-center">
            <Package className="w-5 h-5 opacity-50" />
          </div>
          <span className="text-[11px] font-medium tracking-wide">
            Fotografía no disponible
          </span>
        </div>
        {children}
      </div>
    );
  }

  // CASO 2: Producto con exactamente 1 imagen (Sin controles innecesarios ni galería vacía)
  if (images.length === 1) {
    return (
      <div className={`relative w-full overflow-hidden ${className}`}>
        <div className="h-60 sm:h-72 w-full bg-black/20 overflow-hidden relative">
          <img
            src={images[0]}
            alt={productName}
            className="w-full h-full object-cover"
            loading="eager"
          />
          <div
            className={`absolute inset-0 bg-gradient-to-t ${
              isDark
                ? "from-[#12141C] via-transparent to-transparent"
                : "from-white via-transparent to-transparent"
            }`}
          />
        </div>
        {children}
      </div>
    );
  }

  // CASO 3: Producto con múltiples imágenes (2 o 3 imágenes con carrusel y miniaturas interactivas)
  const currentImage = images[activeIndex] || images[0];

  return (
    <div className={`relative w-full overflow-hidden select-none ${className}`}>
      {/* Contenedor principal de la fotografía */}
      <div
        className="h-60 sm:h-72 w-full bg-black/40 overflow-hidden relative touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          key={currentImage}
          src={currentImage}
          alt={`${productName} — Foto ${activeIndex + 1}`}
          className="w-full h-full object-cover transition-opacity duration-200 animate-in fade-in"
          loading="eager"
        />

        {/* Degradado inferior para legibilidad de títulos y badges */}
        <div
          className={`absolute inset-0 pointer-events-none bg-gradient-to-t ${
            isDark
              ? "from-[#12141C] via-black/20 to-transparent"
              : "from-white via-black/10 to-transparent"
          }`}
        />

        {/* Indicador de posición (ej. '1/3') */}
        <div className="absolute top-3 left-3 z-20 pointer-events-none">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-md text-white text-[10px] font-extrabold tracking-wider border border-white/15 shadow-sm">
            <span>{activeIndex + 1}</span>
            <span className="opacity-60">/</span>
            <span>{images.length}</span>
          </span>
        </div>

        {/* Flecha de Navegación Izquierda */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handlePrev();
          }}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/55 hover:bg-black/80 text-white backdrop-blur-md transition-all active:scale-90 border border-white/10 shadow-lg cursor-pointer"
          aria-label="Ver imagen anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Flecha de Navegación Derecha */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/55 hover:bg-black/80 text-white backdrop-blur-md transition-all active:scale-90 border border-white/10 shadow-lg cursor-pointer"
          aria-label="Ver imagen siguiente"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Indicador de puntos (Paginación móvil sutil) */}
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 pointer-events-none">
          {images.map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                activeIndex === idx
                  ? "w-5 bg-white shadow-xs"
                  : "w-1.5 bg-white/40"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Tira de Miniaturas Interactivas (Inferior) */}
      <div
        className={`px-4 py-2.5 border-b flex items-center justify-center gap-2 overflow-x-auto ${
          isDark
            ? "bg-[#0F1117] border-white/10"
            : "bg-slate-50 border-slate-200/80"
        }`}
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline-block">
          Galería:
        </span>
        {images.map((imgUrl, idx) => {
          const isSelected = activeIndex === idx;
          return (
            <button
              key={imgUrl + idx}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 transition-all cursor-pointer shrink-0 focus:outline-hidden ${
                isSelected
                  ? "scale-105 shadow-md shadow-black/20"
                  : isDark
                  ? "border-white/10 opacity-55 hover:opacity-100 hover:border-white/30"
                  : "border-slate-200 opacity-55 hover:opacity-100 hover:border-slate-400"
              }`}
              style={{
                borderColor: isSelected ? primaryColor : undefined,
              }}
              title={`Foto ${idx + 1}${idx === 0 ? " (Principal)" : ""}`}
            >
              <img
                src={imgUrl}
                alt={`Miniatura ${idx + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {idx === 0 && (
                <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-[#ED500A]" />
              )}
            </button>
          );
        })}
      </div>

      {children}
    </div>
  );
}

