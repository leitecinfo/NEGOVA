"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";

import { usePathname } from "next/navigation";

/**
 * GlobalScrollbar
 * 
 * Barra de scroll vertical principal para la ventana y el contenedor principal (<main> o body/html).
 * - Ultra delgada y compacta: altura fija y pequeña (~44px en lugar del enorme thumb nativo).
 * - Color naranja primario del proyecto (#ED500A) sin fondo (pista transparente).
 * - Soporte interactivo para arrastre con mouse (drag) y clic en la pista para salto rápido.
 * - Desactivada automáticamente en pantallas táctiles / celulares para preservar el scroll inercial nativo.
 */
export function GlobalScrollbar() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [thumbTop, setThumbTop] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [containerBounds, setContainerBounds] = useState({ top: 0, height: 0, right: 2 });

  const activeTargetRef = useRef<HTMLElement | null>(null);
  const dragStartYRef = useRef(0);
  const dragStartScrollYRef = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const THUMB_HEIGHT = 44; // Altura pequeña, fija y compacta
  const INSET_VERTICAL = 22; // Margen superior e inferior respecto al contenedor para los botones de flecha

  // Determinar el elemento scrollable principal activo (main de la app o ventana de la página)
  const getActiveScrollTarget = useCallback((): HTMLElement | null => {
    if (typeof window === "undefined") return null;

    // 1. Priorizar el contenedor <main> de la shell del Workspace o Admin
    const mainEl =
      document.getElementById("app-main-viewport") ||
      document.querySelector<HTMLElement>(".app-main-viewport") ||
      document.querySelector<HTMLElement>("main.overflow-y-auto");

    if (mainEl && mainEl.scrollHeight > mainEl.clientHeight + 10) {
      return mainEl;
    }

    // 2. Si no es un layout con <main> scrollable, evaluar scroll de window / html
    const docHeight = document.documentElement.scrollHeight;
    const winHeight = window.innerHeight;
    if (docHeight > winHeight + 10) {
      return document.documentElement;
    }

    // Si el <main> existe pero aún no desborda, lo retornamos como referencia para escuchar cambios
    return mainEl || document.documentElement;
  }, []);

  const updateScrollMetrics = useCallback(() => {
    if (typeof window === "undefined") return;

    const target = getActiveScrollTarget();
    activeTargetRef.current = target;

    if (!target) {
      setVisible(false);
      return;
    }

    const isWindowTarget = target === document.documentElement || target === document.body;

    let scrollHeight = 0;
    let clientHeight = 0;
    let scrollTop = 0;
    let rectTop = 0;
    let rectHeight = 0;
    let rectRight = 2;

    if (isWindowTarget) {
      scrollHeight = document.documentElement.scrollHeight;
      clientHeight = window.innerHeight;
      scrollTop = window.scrollY || document.documentElement.scrollTop;
      rectTop = 0;
      rectHeight = clientHeight;
      rectRight = 2;
    } else {
      const rect = target.getBoundingClientRect();
      scrollHeight = target.scrollHeight;
      clientHeight = target.clientHeight;
      scrollTop = target.scrollTop;
      rectTop = rect.top;
      rectHeight = rect.height;
      rectRight = Math.max(2, window.innerWidth - rect.right + 2);
    }

    const maxScroll = scrollHeight - clientHeight;

    if (maxScroll <= 15) {
      setVisible(false);
      return;
    }

    setVisible(true);
    setContainerBounds({ top: rectTop, height: rectHeight, right: rectRight });

    const availableTravel = rectHeight - INSET_VERTICAL * 2 - THUMB_HEIGHT;
    if (availableTravel <= 0) return;

    const scrollRatio = Math.min(1, Math.max(0, scrollTop / maxScroll));
    const calculatedTop = rectTop + INSET_VERTICAL + scrollRatio * availableTravel;

    setThumbTop(calculatedTop);
  }, [getActiveScrollTarget]);

  // Recalcular al cambiar de ruta
  useEffect(() => {
    updateScrollMetrics();
    const timer = setTimeout(updateScrollMetrics, 120);
    return () => clearTimeout(timer);
  }, [pathname, updateScrollMetrics]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!isFinePointer) return;

    updateScrollMetrics();

    let rafId: number;
    const scheduleUpdate = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateScrollMetrics);
    };

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });

    // Escuchar scroll en capture mode para atrapar el evento de <main> o cualquier contenedor
    window.addEventListener("scroll", scheduleUpdate, { passive: true, capture: true });

    // Observador de cambios de tamaño
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(document.body);

    const mainEl = document.getElementById("app-main-viewport");
    if (mainEl) {
      resizeObserver.observe(mainEl);
    }

    // Observador de mutaciones en el DOM para capturar carga diferida de datos o componentes
    const mutationObserver = new MutationObserver(() => {
      scheduleUpdate();
      const currentMain = document.getElementById("app-main-viewport");
      if (currentMain && currentMain !== mainEl) {
        try {
          resizeObserver.observe(currentMain);
        } catch {
          // Ignorar si ya está siendo observado
        }
      }
    });

    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, { capture: true });
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [updateScrollMetrics]);

  // Arrastre con mouse (drag & drop)
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const target = activeTargetRef.current;
    if (!target) return;

    const isWindowTarget = target === document.documentElement || target === document.body;

    setIsDragging(true);
    dragStartYRef.current = e.clientY;
    dragStartScrollYRef.current = isWindowTarget ? window.scrollY : target.scrollTop;

    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - dragStartYRef.current;
      const targetEl = activeTargetRef.current;
      if (!targetEl) return;

      const isWin = targetEl === document.documentElement || targetEl === document.body;
      const scrollHeight = isWin ? document.documentElement.scrollHeight : targetEl.scrollHeight;
      const clientHeight = isWin ? window.innerHeight : targetEl.clientHeight;
      const maxScroll = scrollHeight - clientHeight;
      const availableTravel = containerBounds.height - INSET_VERTICAL * 2 - THUMB_HEIGHT;

      if (availableTravel <= 0) return;

      const scrollDelta = (deltaY / availableTravel) * maxScroll;
      const newScroll = Math.min(maxScroll, Math.max(0, dragStartScrollYRef.current + scrollDelta));

      if (isWin) {
        window.scrollTo({ top: newScroll, behavior: "instant" as ScrollBehavior });
      } else {
        targetEl.scrollTop = newScroll;
      }
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

  // Clic en la pista para salto rápido
  const handleTrackClick = (e: React.MouseEvent) => {
    if (e.target !== trackRef.current) return;

    const target = activeTargetRef.current;
    if (!target) return;

    const isWin = target === document.documentElement || target === document.body;
    const scrollHeight = isWin ? document.documentElement.scrollHeight : target.scrollHeight;
    const clientHeight = isWin ? window.innerHeight : target.clientHeight;
    const maxScroll = scrollHeight - clientHeight;
    const availableTravel = containerBounds.height - INSET_VERTICAL * 2 - THUMB_HEIGHT;

    if (availableTravel <= 0) return;

    const clickRelY = e.clientY - containerBounds.top - INSET_VERTICAL - THUMB_HEIGHT / 2;
    const ratio = Math.min(1, Math.max(0, clickRelY / availableTravel));

    if (isWin) {
      window.scrollTo({ top: ratio * maxScroll, behavior: "smooth" });
    } else {
      target.scrollTo({ top: ratio * maxScroll, behavior: "smooth" });
    }
  };

  // Desplazamiento por clic o presión continua en flechas arriba / abajo
  const scrollByDelta = useCallback((delta: number) => {
    const target = activeTargetRef.current;
    if (!target) return;
    const isWin = target === document.documentElement || target === document.body;
    if (isWin) {
      window.scrollBy({ top: delta, behavior: "smooth" });
    } else {
      target.scrollBy({ top: delta, behavior: "smooth" });
    }
  }, []);

  const handleArrowMouseDown = (direction: "up" | "down", e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = direction === "up" ? -120 : 120;
    scrollByDelta(delta);

    let intervalId: ReturnType<typeof setInterval> | null = null;
    const timeoutId = setTimeout(() => {
      intervalId = setInterval(() => {
        scrollByDelta(delta);
      }, 70);
    }, 280);

    const handleMouseUp = () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    window.addEventListener("mouseup", handleMouseUp);
  };

  if (!visible) return null;

  return (
    <div
      ref={trackRef}
      onClick={handleTrackClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        top: `${containerBounds.top}px`,
        height: `${containerBounds.height}px`,
        right: `${containerBounds.right}px`,
      }}
      className="hidden md:flex flex-col items-center fixed w-3.5 z-[9999] pointer-events-auto select-none bg-transparent"
      title="Desplazamiento vertical"
    >
      {/* Botón Flecha Arriba */}
      <button
        type="button"
        onMouseDown={(e) => handleArrowMouseDown("up", e)}
        title="Desplazar hacia arriba"
        className="absolute top-1 right-0 w-3.5 h-3.5 flex items-center justify-center rounded text-[#ED500A] opacity-75 hover:opacity-100 hover:bg-[#ED500A]/15 active:scale-90 transition-all cursor-pointer"
      >
        <svg
          className="w-2.5 h-2.5"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1.5 6.5L5 3l3.5 3.5" />
        </svg>
      </button>

      {/* Tirador compacto (Thumb) de altura pequeña controlada */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          transform: `translateY(${thumbTop - containerBounds.top}px)`,
          height: `${THUMB_HEIGHT}px`,
        }}
        className={`absolute right-1 rounded-full transition-all duration-150 cursor-grab active:cursor-grabbing ${
          isHovered || isDragging
            ? "w-2 bg-[#D44405] shadow-xs shadow-[#ED500A]/40 opacity-100"
            : "w-1.5 bg-[#ED500A] opacity-80 hover:opacity-100"
        }`}
      />

      {/* Botón Flecha Abajo */}
      <button
        type="button"
        onMouseDown={(e) => handleArrowMouseDown("down", e)}
        title="Desplazar hacia abajo"
        className="absolute bottom-1 right-0 w-3.5 h-3.5 flex items-center justify-center rounded text-[#ED500A] opacity-75 hover:opacity-100 hover:bg-[#ED500A]/15 active:scale-90 transition-all cursor-pointer"
      >
        <svg
          className="w-2.5 h-2.5"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1.5 3.5L5 7l3.5-3.5" />
        </svg>
      </button>
    </div>
  );
}
