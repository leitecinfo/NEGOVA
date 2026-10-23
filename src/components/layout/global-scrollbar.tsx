"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";

/**
 * GlobalScrollbar
 * 
 * Barra de scroll vertical principal para la ventana (body/html).
 * - Ultra delgada y compacta (altura pequeña y fija: ~46px en lugar del enorme thumb nativo).
 * - Color naranja primario del proyecto (#ED500A) sin fondo (pista transparente).
 * - Soporte para arrastre con mouse (drag & drop) y clic en la pista para salto rápido.
 * - Desactivada automáticamente en pantallas táctiles / celulares para preservar el scroll inercial nativo.
 */
export function GlobalScrollbar() {
  const [visible, setVisible] = useState(false);
  const [thumbTop, setThumbTop] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const dragStartYRef = useRef(0);
  const dragStartScrollYRef = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const THUMB_HEIGHT = 46; // Altura pequeña, compacta y fija
  const INSET_TOP = 14;    // Margen superior
  const INSET_BOTTOM = 14; // Margen inferior

  // Actualizar la posición del tirador proporcionalmente al scroll de la ventana
  const updateScrollPosition = useCallback(() => {
    if (typeof window === "undefined") return;

    const docHeight = document.documentElement.scrollHeight;
    const winHeight = window.innerHeight;
    const maxScroll = docHeight - winHeight;

    if (maxScroll <= 20) {
      setVisible(false);
      return;
    }

    setVisible(true);

    const currentScroll = window.scrollY;
    const availableTrackHeight = winHeight - INSET_TOP - INSET_BOTTOM - THUMB_HEIGHT;
    const scrollRatio = Math.min(1, Math.max(0, currentScroll / maxScroll));
    const newTop = INSET_TOP + scrollRatio * availableTrackHeight;

    setThumbTop(newTop);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Solo habilitar en dispositivos con cursor / puntero fino (Desktop / Mouse)
    const isFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!isFinePointer) return;

    updateScrollPosition();

    let rafId: number;
    const handleScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateScrollPosition);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });

    // Observar cambios en el DOM para recalcular si el contenido cambia dinámicamente
    const observer = new ResizeObserver(handleScroll);
    observer.observe(document.body);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      observer.disconnect();
    };
  }, [updateScrollPosition]);

  // Manejo de arrastre (drag) con el puntero del mouse
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    dragStartYRef.current = e.clientY;
    dragStartScrollYRef.current = window.scrollY;

    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - dragStartYRef.current;
      const winHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      const maxScroll = docHeight - winHeight;
      const availableTrackHeight = winHeight - INSET_TOP - INSET_BOTTOM - THUMB_HEIGHT;

      if (availableTrackHeight <= 0) return;

      const scrollDelta = (deltaY / availableTrackHeight) * maxScroll;
      const newScrollY = Math.min(maxScroll, Math.max(0, dragStartScrollYRef.current + scrollDelta));

      window.scrollTo({
        top: newScrollY,
        behavior: "instant" as ScrollBehavior,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Clic en la pista para salto rápido de scroll
  const handleTrackClick = (e: React.MouseEvent) => {
    if (e.target !== trackRef.current) return;

    const clickY = e.clientY;
    const winHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;
    const maxScroll = docHeight - winHeight;
    const availableTrackHeight = winHeight - INSET_TOP - INSET_BOTTOM - THUMB_HEIGHT;

    if (availableTrackHeight <= 0) return;

    const targetTop = clickY - INSET_TOP - THUMB_HEIGHT / 2;
    const ratio = Math.min(1, Math.max(0, targetTop / availableTrackHeight));

    window.scrollTo({
      top: ratio * maxScroll,
      behavior: "smooth",
    });
  };

  if (!visible) return null;

  return (
    <div
      ref={trackRef}
      onClick={handleTrackClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="hidden md:block fixed right-0 top-0 bottom-0 w-3 z-[9999] pointer-events-auto select-none bg-transparent"
      title="Desplazamiento"
    >
      {/* Tirador compacto (Thumb) */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          transform: `translateY(${thumbTop}px)`,
          height: `${THUMB_HEIGHT}px`,
        }}
        className={`absolute right-1 rounded-full transition-all duration-150 cursor-grab active:cursor-grabbing ${
          isHovered || isDragging
            ? "w-2 bg-[#D44405] shadow-sm shadow-[#ED500A]/30 opacity-100"
            : "w-1.5 bg-[#ED500A] opacity-80 hover:opacity-100"
        }`}
      />
    </div>
  );
}
