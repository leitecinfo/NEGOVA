"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { AdminButton } from "@/components/admin/ui/admin-button";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Crop,
  X,
  Check,
  Move,
  Maximize2,
  Minimize2,
  RefreshCw,
} from "lucide-react";

export type AspectRatioOption = "1:1" | "16:9" | "4:3" | "free";

interface ImageCropperModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  fileName?: string;
  onClose: () => void;
  onCropComplete: (croppedFile: File) => void;
  initialAspectRatio?: AspectRatioOption;
}

export function ImageCropperModal({
  isOpen,
  imageSrc,
  fileName = "logo.png",
  onClose,
  onCropComplete,
  initialAspectRatio = "1:1",
}: ImageCropperModalProps) {
  const [aspectOption, setAspectOption] = useState<AspectRatioOption>(initialAspectRatio);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [isProcessing, setIsProcessing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Dimensiones del cuadro de recorte según el aspect ratio seleccionado
  const boxDimensions = useMemo(() => {
    switch (aspectOption) {
      case "16:9":
        return { width: 320, height: 180, ratio: 16 / 9 };
      case "4:3":
        return { width: 280, height: 210, ratio: 4 / 3 };
      case "free":
        if (naturalSize.width > 0 && naturalSize.height > 0) {
          const natRatio = naturalSize.width / naturalSize.height;
          if (natRatio >= 1) {
            return { width: 300, height: Math.round(300 / natRatio), ratio: natRatio };
          } else {
            return { width: Math.round(260 * natRatio), height: 260, ratio: natRatio };
          }
        }
        return { width: 280, height: 280, ratio: 1 };
      case "1:1":
      default:
        return { width: 280, height: 280, ratio: 1 };
    }
  }, [aspectOption, naturalSize]);

  // Dimensiones base calculadas para que a zoom=1 la imagen completa quepa sin cortes
  const baseDimensions = useMemo(() => {
    if (naturalSize.width === 0 || naturalSize.height === 0) {
      return { width: boxDimensions.width, height: boxDimensions.height, fitScale: 1 };
    }
    const fitScale = Math.min(
      boxDimensions.width / naturalSize.width,
      boxDimensions.height / naturalSize.height
    );
    return {
      width: naturalSize.width * fitScale,
      height: naturalSize.height * fitScale,
      fitScale,
    };
  }, [boxDimensions, naturalSize]);

  // Factor de escala para que la imagen llene el cuadro completamente
  const fillZoom = useMemo(() => {
    if (baseDimensions.width === 0 || baseDimensions.height === 0) return 1;
    const scaleX = boxDimensions.width / baseDimensions.width;
    const scaleY = boxDimensions.height / baseDimensions.height;
    return Number(Math.max(scaleX, scaleY).toFixed(2));
  }, [baseDimensions, boxDimensions]);

  // Reiniciar estado al abrir o cambiar imagen
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      setAspectOption(initialAspectRatio);
    }
  }, [isOpen, imageSrc, initialAspectRatio]);

  // Manejar carga inicial de imagen
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    setPosition({ x: 0, y: 0 });
    setZoom(1);
  };

  // Drag mouse/touch handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPosition({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setZoom((prev) => Math.min(3, Math.max(0.3, Number((prev + delta).toFixed(2)))));
  };

  const handleFit = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleFill = () => {
    setZoom(fillZoom);
    setPosition({ x: 0, y: 0 });
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  // Generar imagen recortada usando Canvas HTML5
  const handleCrop = useCallback(() => {
    if (!naturalSize.width || !naturalSize.height || !containerRef.current) return;
    setIsProcessing(true);

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        // Tamaño objetivo de salida HD
        const outWidth = boxDimensions.ratio >= 1 ? 600 : Math.round(600 * boxDimensions.ratio);
        const outHeight = Math.round(outWidth / boxDimensions.ratio);

        const canvas = document.createElement("canvas");
        canvas.width = outWidth;
        canvas.height = outHeight;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          setIsProcessing(false);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // Fondo transparente
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Factor de escala entre el visor en pantalla y la salida Canvas HD
        const scaleToCanvas = outWidth / boxDimensions.width;

        // Centrar contexto en el lienzo
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);

        // Posición y dimensiones dibujadas
        const drawX = position.x * scaleToCanvas;
        const drawY = position.y * scaleToCanvas;
        const drawW = baseDimensions.width * zoom * scaleToCanvas;
        const drawH = baseDimensions.height * zoom * scaleToCanvas;

        ctx.drawImage(img, drawX - drawW / 2, drawY - drawH / 2, drawW, drawH);

        canvas.toBlob(
          (blob) => {
            setIsProcessing(false);
            if (!blob) return;

            const baseName = fileName.replace(/\.[^/.]+$/, "");
            const croppedFile = new File([blob], `${baseName}-cropped.png`, {
              type: "image/png",
              lastModified: Date.now(),
            });

            onCropComplete(croppedFile);
          },
          "image/png",
          0.95
        );
      };

      img.onerror = () => {
        setIsProcessing(false);
      };

      img.src = imageSrc || "";
    } catch (err) {
      console.error("[ImageCropperModal] Error al recortar imagen:", err);
      setIsProcessing(false);
    }
  }, [
    baseDimensions,
    boxDimensions,
    fileName,
    imageSrc,
    naturalSize,
    onCropComplete,
    position,
    rotation,
    zoom,
  ]);

  if (!isOpen || !imageSrc) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        onMouseUp={handleMouseUp}
      >
        <div className="bg-white dark:bg-[#0D0F16] rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-500/20">
                <Crop className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-title">
                  Recortar y ajustar logotipo
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Ajusta la posición, escala y proporción para tu comercio.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Selector de proporción (Aspect Ratio) */}
          <div className="px-4 py-2 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between flex-wrap gap-2 text-xs">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">Encuadre:</span>
            <div className="flex items-center gap-1.5">
              {[
                { id: "1:1", label: "1:1 Cuadrado" },
                { id: "16:9", label: "16:9 Banner" },
                { id: "4:3", label: "4:3 Estándar" },
                { id: "free", label: "Proporción original" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setAspectOption(opt.id as AspectRatioOption);
                    setPosition({ x: 0, y: 0 });
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                    aspectOption === opt.id
                      ? "bg-orange-500 text-white shadow-xs"
                      : "bg-slate-200/60 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/15"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Área interactiva de recorte con cuadrícula */}
          <div className="p-4 sm:p-6 bg-[#0B0D13] flex flex-col items-center justify-center select-none overflow-hidden relative">
            <div
              ref={containerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUp}
              onWheel={handleWheel}
              style={{
                width: `${boxDimensions.width}px`,
                height: `${boxDimensions.height}px`,
              }}
              className="relative rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing border-2 border-orange-500 shadow-2xl flex items-center justify-center transition-all duration-200"
            >
              {/* Patrón de tablero sutil para transparencias */}
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage: `linear-gradient(45deg, #222 25%, transparent 25%), linear-gradient(-45deg, #222 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #222 75%), linear-gradient(-45deg, transparent 75%, #222 75%)`,
                  backgroundSize: `16px 16px`,
                  backgroundPosition: `0 0, 0 8px, 8px -8px, -8px 0px`,
                }}
              />

              {/* Imagen con tamaño base escalado correctamente */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSrc}
                alt="Para recortar"
                onLoad={handleImageLoad}
                draggable={false}
                style={{
                  width: `${baseDimensions.width}px`,
                  height: `${baseDimensions.height}px`,
                  transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                  transition: isDragging ? "none" : "transform 0.1s ease-out",
                  userSelect: "none",
                }}
                className="pointer-events-none select-none max-w-none origin-center shrink-0"
              />

              {/* Guía visual cuadrícula 3x3 */}
              <div className="absolute inset-0 pointer-events-none border border-white/20 rounded-2xl grid grid-cols-3 grid-rows-3">
                <div className="border-r border-b border-white/10" />
                <div className="border-r border-b border-white/10" />
                <div className="border-b border-white/10" />
                <div className="border-r border-b border-white/10" />
                <div className="border-r border-b border-white/10" />
                <div className="border-b border-white/10" />
                <div className="border-r border-white/10" />
                <div className="border-r border-white/10" />
                <div />
              </div>

              {/* Badge indicador de arrastre */}
              <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[10px] text-white/80 font-mono pointer-events-none flex items-center gap-1">
                <Move className="w-3 h-3 text-orange-400" />
                Arrastra para centrar
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mt-3 text-center">
              Arrastra con el ratón o usa la rueda para ajustar el encuadre exacto.
            </p>
          </div>

          {/* Controles de Zoom, Ajuste Rápido y Rotación */}
          <div className="p-4 border-t border-slate-100 dark:border-white/5 space-y-3 bg-slate-50/50 dark:bg-white/[0.02]">
            {/* Slider de Zoom */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.max(0.3, Number((prev - 0.1).toFixed(2))))}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="Alejar"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <input
                type="range"
                min="0.3"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-orange-500 cursor-pointer h-1.5 bg-slate-200 dark:bg-white/10 rounded-lg"
              />
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.min(3, Number((prev + 0.1).toFixed(2))))}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="Acercar"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300 w-12 text-right">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            {/* Botones de acción rápida: Ajustar completo vs Llenar vs Rotar */}
            <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleFit}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  title="Muestra toda la imagen completa dentro del cuadro"
                >
                  <Minimize2 className="w-3.5 h-3.5 text-orange-500" />
                  Ver completa (100%)
                </button>
                <button
                  type="button"
                  onClick={handleFill}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  title="Ajusta el zoom para llenar todo el cuadro sin bordes"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-indigo-500" />
                  Llenar encuadre
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((prev) => (prev + 90) % 360)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  90°
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Restablecer
                </button>
              </div>

              <div className="text-[11px] text-slate-400 font-mono">
                {naturalSize.width > 0 && `${naturalSize.width} × ${naturalSize.height} px`}
              </div>
            </div>
          </div>

          {/* Footer de Acciones */}
          <div className="p-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-2.5 bg-white dark:bg-[#0D0F16]">
            <AdminButton
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isProcessing}
            >
              Cancelar
            </AdminButton>
            <AdminButton
              size="sm"
              leftIcon={<Check className="w-4 h-4" />}
              onClick={handleCrop}
              isLoading={isProcessing}
            >
              Aplicar y guardar
            </AdminButton>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
