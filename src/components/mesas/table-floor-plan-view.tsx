"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  Save,
  ShoppingBag,
  Users,
  PenTool,
  Wand2,
  DoorOpen,
  Sparkles,
  LayoutGrid,
  Info,
  Check,
  X,
  Undo2,
  Trash2,
  Layers,
  MapPin,
  Compass,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TableBlueprintIllustration } from "./table-blueprint-illustration";
import type {
  RestaurantTableWithOrder,
  TableShape,
  RoomShapePreset,
  RoomFloorPlanConfig,
  TableLayoutPosition,
  Point2D,
} from "@/lib/restaurant/types";
import {
  getStoredRoomLayout,
  saveStoredRoomLayout,
  computeDefaultFloorPlan,
  getStoredTableShape,
  saveStoredTableShape,
  inferTableShape,
} from "@/lib/restaurant/table-layout-storage";
import {
  processHandDrawnStroke,
  getPresetPolygon,
  snapToOrthogonalAngle,
  snapToGrid,
  distance,
} from "@/lib/restaurant/floor-plan-geometry";

interface TableFloorPlanViewProps {
  businessId: string;
  roomId: string;
  roomName: string;
  tables: RestaurantTableWithOrder[];
  canManageTables: boolean;
  onTableShapeChange?: (tableId: string, shape: TableShape) => void;
}

type DesignTool = "smart_draw" | "point_by_point" | "adjust_nodes" | "place_door";

export function TableFloorPlanView({
  businessId,
  roomId,
  roomName,
  tables,
  canManageTables,
  onTableShapeChange,
}: TableFloorPlanViewProps) {
  // Estado de la sala activa
  const [isMounted, setIsMounted] = useState(false);
  const [roomPreset, setRoomPreset] = useState<RoomShapePreset>("rectangle");
  const [polygon, setPolygon] = useState<Point2D[]>(() => getPresetPolygon("rectangle"));
  const [doorPos, setDoorPos] = useState<Point2D>({ x: 50, y: 90 });
  const [tablePositions, setTablePositions] = useState<Record<string, TableLayoutPosition>>({});

  // Modos de trabajo: "view" (operativo) | "move_tables" (ubicar mesas) | "design_room" (diseñar sala)
  const [workMode, setWorkMode] = useState<"view" | "move_tables" | "design_room">("view");
  const [designTool, setDesignTool] = useState<DesignTool>("smart_draw");

  // Zoom y visualización
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  // Arrastre de mesas
  const [isDraggingTable, setIsDraggingTable] = useState(false);
  const [draggedTableId, setDraggedTableId] = useState<string | null>(null);

  // Dibujo libre inteligente (Smart Drawing)
  const [isDrawingStroke, setIsDrawingStroke] = useState(false);
  const [rawStroke, setRawStroke] = useState<Point2D[]>([]);

  // Dibujo punto a punto
  const [p2pPoints, setP2pPoints] = useState<Point2D[]>([]);
  const [hoverCursor, setHoverCursor] = useState<Point2D | null>(null);

  // Arrastre de nodos / vértices
  const [draggedNodeIndex, setDraggedNodeIndex] = useState<number | null>(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);

  // =========================================================================
  // CARGA INDEPENDIENTE DEL PLANO POR SALA (businessId + roomId)
  // =========================================================================
  useEffect(() => {
    setIsMounted(true);
    const stored = getStoredRoomLayout(businessId, roomId);

    if (stored) {
      const preset = stored.roomShapePreset || "rectangle";
      setRoomPreset(preset);

      if (stored.customPolygon && stored.customPolygon.length >= 3) {
        setPolygon(stored.customPolygon);
      } else {
        setPolygon(getPresetPolygon(preset));
      }

      if (stored.entrance) {
        setDoorPos(stored.entrance);
      } else {
        setDoorPos({ x: 50, y: 90 });
      }

      // Sincronizar mesas
      const updated: Record<string, TableLayoutPosition> = { ...(stored.tables || {}) };
      const fallback = computeDefaultFloorPlan(tables, preset);

      tables.forEach((t) => {
        if (!updated[t.id]) {
          updated[t.id] = fallback.tables[t.id] || {
            x: 50,
            y: 50,
            shape: getStoredTableShape(businessId, t.id, t.capacity, t.name_or_number),
            rotation: 0,
          };
        } else {
          updated[t.id].shape = getStoredTableShape(
            businessId,
            t.id,
            t.capacity,
            t.name_or_number
          );
        }
      });

      setTablePositions(updated);
    } else {
      // Inicializar sala nueva
      const preset: RoomShapePreset = "rectangle";
      setRoomPreset(preset);
      setPolygon(getPresetPolygon(preset));
      setDoorPos({ x: 50, y: 90 });

      const initial = computeDefaultFloorPlan(tables, preset);
      tables.forEach((t) => {
        if (initial.tables[t.id]) {
          initial.tables[t.id].shape = getStoredTableShape(
            businessId,
            t.id,
            t.capacity,
            t.name_or_number
          );
        }
      });
      setTablePositions(initial.tables);
    }

    // Resetear estados de dibujo al cambiar de sala
    setRawStroke([]);
    setP2pPoints([]);
    setDraggedNodeIndex(null);
    setSelectedTableId(null);
  }, [businessId, roomId, tables]);

  // =========================================================================
  // GUARDAR PLANO ESPECÍFICO DE ESTA SALA
  // =========================================================================
  const handleSaveLayout = useCallback(() => {
    const config: RoomFloorPlanConfig = {
      roomShapePreset: roomPreset,
      customPolygon: polygon,
      entrance: doorPos,
      tables: tablePositions,
    };

    saveStoredRoomLayout(businessId, roomId, config);
    toast.success(`Plano de «${roomName}» guardado correctamente.`);
    setWorkMode("view");
  }, [businessId, roomId, roomName, roomPreset, polygon, doorPos, tablePositions]);

  // Selección de Preset de sala
  const handleSelectPreset = (preset: RoomShapePreset) => {
    setRoomPreset(preset);
    if (preset !== "custom") {
      const newPoly = getPresetPolygon(preset);
      setPolygon(newPoly);
      const config: RoomFloorPlanConfig = {
        roomShapePreset: preset,
        customPolygon: newPoly,
        entrance: doorPos,
        tables: tablePositions,
      };
      saveStoredRoomLayout(businessId, roomId, config);
      toast.success(`Sala cambiada a diseño ${preset}.`);
    }
  };

  // Restablecer distribución automática de mesas
  const handleResetTables = () => {
    const def = computeDefaultFloorPlan(tables, roomPreset);
    setTablePositions(def.tables);
    toast.info("Mesas reubicadas en cuadrícula.");
  };

  // =========================================================================
  // COORDENADAS RELATIVAS AL CANVAS (0% a 100%)
  // =========================================================================
  const getCanvasCoords = (clientX: number, clientY: number): Point2D | null => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const rawX = ((clientX - rect.left) / rect.width) * 100;
    const rawY = ((clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.max(2, Math.min(98, Math.round(rawX * 10) / 10)),
      y: Math.max(2, Math.min(98, Math.round(rawY * 10) / 10)),
    };
  };

  // =========================================================================
  // DIBUJO LIBRE INTELIGENTE (AUTO-CORRECCIÓN A LÍNEAS RECTAS)
  // =========================================================================
  const handlePointerDown = (e: React.PointerEvent) => {
    if (workMode !== "design_room") return;

    const coords = getCanvasCoords(e.clientX, e.clientY);
    if (!coords) return;

    if (designTool === "smart_draw") {
      setIsDrawingStroke(true);
      setRawStroke([coords]);
    } else if (designTool === "point_by_point") {
      // Modo punto a punto: agregar vértice
      if (p2pPoints.length >= 3 && distance(coords, p2pPoints[0]) < 8) {
        // Cerrar polígono
        setPolygon(p2pPoints);
        setRoomPreset("custom");
        setP2pPoints([]);
        toast.success("¡Salón cerrado y completado!");
      } else {
        const snapped = p2pPoints.length > 0
          ? snapToOrthogonalAngle(p2pPoints[p2pPoints.length - 1], coords)
          : coords;
        setP2pPoints((prev) => [...prev, snapToGrid(snapped)]);
      }
    } else if (designTool === "place_door") {
      setDoorPos(snapToGrid(coords));
      toast.success("Ubicación de la entrada principal actualizada.");
      setDesignTool("adjust_nodes");
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const coords = getCanvasCoords(e.clientX, e.clientY);
    if (!coords) return;

    setHoverCursor(coords);

    // 1. Arrastre de trazo libre
    if (workMode === "design_room" && designTool === "smart_draw" && isDrawingStroke) {
      setRawStroke((prev) => {
        const last = prev[prev.length - 1];
        if (!last || distance(last, coords) >= 1.5) {
          return [...prev, coords];
        }
        return prev;
      });
    }

    // 2. Arrastre de nodo / vértice existente
    if (workMode === "design_room" && draggedNodeIndex !== null) {
      const snapped = snapToGrid(coords);
      setPolygon((prev) => {
        const next = [...prev];
        next[draggedNodeIndex] = snapped;
        return next;
      });
    }

    // 3. Arrastre de mesa
    if (workMode === "move_tables" && isDraggingTable && draggedTableId) {
      const snap = 2.5;
      const clampedX = Math.max(6, Math.min(94, Math.round(coords.x / snap) * snap));
      const clampedY = Math.max(6, Math.min(94, Math.round(coords.y / snap) * snap));

      setTablePositions((prev) => ({
        ...prev,
        [draggedTableId]: {
          ...prev[draggedTableId],
          x: clampedX,
          y: clampedY,
        },
      }));
    }
  };

  const handlePointerUp = () => {
    // Finalizar trazo inteligente y aplicar corrección a línea recta
    if (isDrawingStroke && rawStroke.length >= 3) {
      setIsDrawingStroke(false);
      const straightened = processHandDrawnStroke(rawStroke);

      if (straightened.length >= 3) {
        setPolygon(straightened);
        setRoomPreset("custom");
        toast.success("¡Paredes enderezadas y sala dibujada con líneas rectas!");
      } else {
        toast.error("El trazo fue muy corto. Dibuja el contorno completo de las paredes.");
      }
      setRawStroke([]);
    } else if (isDrawingStroke) {
      setIsDrawingStroke(false);
      setRawStroke([]);
    }

    if (draggedNodeIndex !== null) {
      setDraggedNodeIndex(null);
    }

    if (isDraggingTable) {
      setIsDraggingTable(false);
      setDraggedTableId(null);
    }
  };

  // Agregar nuevo vértice en una arista del polígono
  const handleAddNodeOnEdge = (index: number) => {
    setPolygon((prev) => {
      const p1 = prev[index];
      const p2 = prev[(index + 1) % prev.length];
      const mid: Point2D = snapToGrid({
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2,
      });
      const next = [...prev];
      next.splice(index + 1, 0, mid);
      return next;
    });
    toast.info("Nueva esquina agregada a la pared.");
  };

  // Eliminar vértice
  const handleRemoveNode = (index: number) => {
    if (polygon.length <= 3) {
      toast.warning("Una sala debe tener al menos 3 esquinas.");
      return;
    }
    setPolygon((prev) => prev.filter((_, i) => i !== index));
    toast.info("Esquina eliminada.");
  };

  // Convertir polígono actual a string de puntos SVG
  const svgPointsString = useMemo(() => {
    return polygon.map((p) => `${p.x * 10},${p.y * 7.5}`).join(" ");
  }, [polygon]);

  // Cambiar forma de mesa seleccionada
  const handleChangeSelectedShape = (shape: TableShape) => {
    if (!selectedTableId) return;
    saveStoredTableShape(businessId, selectedTableId, shape);
    setTablePositions((prev) => ({
      ...prev,
      [selectedTableId]: {
        ...prev[selectedTableId],
        shape,
      },
    }));
    onTableShapeChange?.(selectedTableId, shape);
    toast.success(`Forma de la mesa actualizada a ${shape}`);
  };

  const selectedTable = useMemo(
    () => tables.find((t) => t.id === selectedTableId),
    [tables, selectedTableId]
  );

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  return (
    <div className="space-y-4">
      {/* 1. BARRA SUPERIOR DE CONTEXTO DE SALA Y MODO */}
      <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-3 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Identificador de sala */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center font-bold shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Plano del Salón: {roomName}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20">
                {roomPreset === "custom" ? "Paredes Dibujadas" : roomPreset.toUpperCase()}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {roomId === "all"
                ? "Vista global. Para diseñar una sala en particular, selecciona su pestaña arriba."
                : `Diseño arquitectónico exclusivo para «${roomName}».`}
            </p>
          </div>
        </div>

        {/* Botones de acción principales */}
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* Zoom */}
          <div className="flex items-center bg-slate-100 dark:bg-white/[0.06] rounded-xl p-1 gap-1 text-slate-600 dark:text-slate-300">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.15))}
              className="p-1 rounded-lg hover:bg-white dark:hover:bg-white/10 transition-colors cursor-pointer"
              title="Reducir zoom"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-2xs font-mono px-1 font-bold">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(1.5, z + 0.15))}
              className="p-1 rounded-lg hover:bg-white dark:hover:bg-white/10 transition-colors cursor-pointer"
              title="Aumentar zoom"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(1)}
              className="p-1 rounded-lg hover:bg-white dark:hover:bg-white/10 transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Restablecer zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {canManageTables && (
            <>
              {/* Botón: Diseñar Sala */}
              <button
                type="button"
                onClick={() => setWorkMode((m) => (m === "design_room" ? "view" : "design_room"))}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  workMode === "design_room"
                    ? "bg-[#ED500A] text-white shadow-md shadow-[#ED500A]/20"
                    : "bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 hover:bg-slate-200/60"
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>{workMode === "design_room" ? "Editando Paredes" : "Diseñar Sala"}</span>
              </button>

              {/* Botón: Ubicar Mesas */}
              <button
                type="button"
                onClick={() => setWorkMode((m) => (m === "move_tables" ? "view" : "move_tables"))}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  workMode === "move_tables"
                    ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                    : "bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 hover:bg-slate-200/60"
                }`}
              >
                <Move className="w-3.5 h-3.5" />
                <span>{workMode === "move_tables" ? "Moviendo Mesas" : "Ubicar Mesas"}</span>
              </button>

              {/* Botón Guardar cambios */}
              {(workMode === "design_room" || workMode === "move_tables") && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveLayout}
                  className="gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar Plano</span>
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 2. BARRA DE HERRAMIENTAS DE DISEÑO DE SALA (VISIBLE SOLO EN MODO DISEÑO) */}
      {workMode === "design_room" && (
        <div className="bg-slate-50 dark:bg-[#121620] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-3 shadow-xs space-y-3 animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Herramientas de trazado */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1">
                Herramienta:
              </span>

              <button
                type="button"
                onClick={() => setDesignTool("smart_draw")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                  designTool === "smart_draw"
                    ? "bg-[#ED500A] text-white shadow-xs"
                    : "bg-white dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08]"
                }`}
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Trazo Inteligente (Auto-recta)</span>
              </button>

              <button
                type="button"
                onClick={() => setDesignTool("point_by_point")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                  designTool === "point_by_point"
                    ? "bg-[#ED500A] text-white shadow-xs"
                    : "bg-white dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08]"
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Punto a Punto</span>
              </button>

              <button
                type="button"
                onClick={() => setDesignTool("adjust_nodes")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                  designTool === "adjust_nodes"
                    ? "bg-[#ED500A] text-white shadow-xs"
                    : "bg-white dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08]"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Mover Esquinas</span>
              </button>

              <button
                type="button"
                onClick={() => setDesignTool("place_door")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                  designTool === "place_door"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-white dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08]"
                }`}
              >
                <DoorOpen className="w-3.5 h-3.5" />
                <span>Mover Entrada</span>
              </button>
            </div>

            {/* Presets de figuras predeterminadas */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-slate-400 mr-1 hidden lg:inline">
                Plantillas:
              </span>
              {[
                { id: "rectangle", label: "Rectangular" },
                { id: "square", label: "Cuadrada" },
                { id: "l_shape", label: "En L" },
                { id: "terrace", label: "Terraza" },
              ].map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.id as RoomShapePreset)}
                  className="px-2.5 py-1 rounded-lg text-2xs font-semibold bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:border-[#ED500A] cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ayuda contextual interactiva */}
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 bg-white/60 dark:bg-white/[0.02] p-2 rounded-xl border border-slate-200/50 dark:border-white/[0.04]">
            <Info className="w-4 h-4 text-[#ED500A] shrink-0" />
            {designTool === "smart_draw" && (
              <span>
                <strong>Modo Trazo Inteligente:</strong> Dibuja libremente las paredes con el mouse o dedo. Si el trazo te queda torcido, se auto-corregirá automáticamente a líneas rectas perfectas y ángulos a 90°.
              </span>
            )}
            {designTool === "point_by_point" && (
              <span>
                <strong>Modo Punto a Punto:</strong> Haz clic en el lienzo para colocar cada esquina de la sala. Haz clic cerca del primer punto para cerrar el salón.
              </span>
            )}
            {designTool === "adjust_nodes" && (
              <span>
                <strong>Mover Esquinas:</strong> Arrastra los círculos naranjas de las esquinas para ensanchar o amoldar el salón. Haz clic en el símbolo (+) en una pared para añadir una esquina.
              </span>
            )}
            {designTool === "place_door" && (
              <span>
                <strong>Mover Entrada:</strong> Haz clic en cualquier pared del contorno para situar la puerta de entrada principal.
              </span>
            )}
          </div>
        </div>
      )}

      {/* 3. LIENZO / CANVAS ARQUITECTÓNICO 2D */}
      <div className="relative w-full bg-[#07090E] rounded-3xl border border-slate-800 shadow-2xl overflow-hidden p-2 sm:p-6 min-h-[480px] sm:min-h-[620px] flex items-center justify-center select-none">
        {/* Fondo con cuadrícula arquitectónica milimétrica */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, #ffffff 1px, transparent 1px),
              linear-gradient(to bottom, #ffffff 1px, transparent 1px)
            `,
            backgroundSize: "30px 30px",
          }}
        />

        {/* Zona escalable con zoom */}
        <div
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`relative w-full max-w-[850px] aspect-[4/3] rounded-2xl transition-all duration-75 ${
            workMode === "design_room" && designTool === "smart_draw"
              ? "cursor-crosshair"
              : workMode === "design_room" && designTool === "point_by_point"
              ? "cursor-cell"
              : ""
          }`}
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: "center center",
          }}
        >
          {/* SVG DE PAREDES ARQUITECTÓNICAS Y SALÓN */}
          <svg
            viewBox="0 0 1000 750"
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            <defs>
              <pattern
                id="terracePattern"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="2" cy="2" r="1" fill="#10B981" opacity="0.3" />
              </pattern>
            </defs>

            {/* Suelo del Salón */}
            <polygon
              points={svgPointsString}
              fill={roomPreset === "terrace" ? "url(#terracePattern)" : "#0B0E17"}
              fillOpacity={roomPreset === "terrace" ? 1 : 0.95}
              stroke={roomPreset === "terrace" ? "#10B981" : workMode === "design_room" ? "#ED500A" : "#38455B"}
              strokeWidth="6"
              strokeDasharray={roomPreset === "terrace" ? "12 8" : "none"}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Trazo en progreso cuando se dibuja a mano alzada */}
            {isDrawingStroke && rawStroke.length > 1 && (
              <polyline
                points={rawStroke.map((p) => `${p.x * 10},${p.y * 7.5}`).join(" ")}
                fill="none"
                stroke="#ED500A"
                strokeWidth="4"
                strokeDasharray="6 4"
                strokeLinecap="round"
              />
            )}

            {/* Polígono punto a punto en construcción */}
            {p2pPoints.length > 0 && (
              <polyline
                points={
                  p2pPoints.map((p) => `${p.x * 10},${p.y * 7.5}`).join(" ") +
                  (hoverCursor ? ` ${hoverCursor.x * 10},${hoverCursor.y * 7.5}` : "")
                }
                fill="none"
                stroke="#3B82F6"
                strokeWidth="4"
                strokeDasharray="4 4"
                strokeLinecap="round"
              />
            )}

            {/* Puerta de Entrada Arquitectónica */}
            <g transform={`translate(${doorPos.x * 10}, ${doorPos.y * 7.5})`}>
              <circle r="12" fill="#10B981" fillOpacity="0.2" stroke="#10B981" strokeWidth="2" />
              <line x1="-18" y1="0" x2="18" y2="0" stroke="#10B981" strokeWidth="4" />
              <path
                d="M -18 0 A 18 18 0 0 1 0 -18"
                fill="none"
                stroke="#10B981"
                strokeWidth="2"
                strokeDasharray="3 3"
              />
              <text
                x="0"
                y="18"
                textAnchor="middle"
                fill="#10B981"
                fontSize="10"
                fontFamily="monospace"
                fontWeight="bold"
              >
                ENTRADA
              </text>
            </g>
          </svg>

          {/* VÉRTICES / ESQUINAS ARRASTRABLES (MODO DISEÑO) */}
          {workMode === "design_room" && designTool === "adjust_nodes" && (
            <div className="absolute inset-0 pointer-events-auto">
              {polygon.map((node, idx) => (
                <div
                  key={idx}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setDraggedNodeIndex(idx);
                  }}
                  onDoubleClick={() => handleRemoveNode(idx)}
                  style={{
                    left: `${node.x}%`,
                    top: `${node.y}%`,
                  }}
                  className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ED500A] text-white border-2 border-white shadow-lg cursor-grab active:cursor-grabbing hover:scale-125 transition-transform flex items-center justify-center text-[9px] font-bold z-30"
                  title="Arrastra para mover esquina. Doble clic para eliminar."
                >
                  {idx + 1}
                </div>
              ))}

              {/* Botones (+) en medio de cada pared para agregar vértices */}
              {polygon.map((p1, idx) => {
                const p2 = polygon[(idx + 1) % polygon.length];
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                return (
                  <button
                    key={`edge-${idx}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddNodeOnEdge(idx);
                    }}
                    style={{
                      left: `${midX}%`,
                      top: `${midY}%`,
                    }}
                    className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500 text-white hover:bg-blue-600 shadow-md flex items-center justify-center text-[11px] font-bold z-20 cursor-pointer hover:scale-125 transition-transform"
                    title="Añadir una esquina en esta pared"
                  >
                    +
                  </button>
                );
              })}
            </div>
          )}

          {/* RENDERIZADO DE MESAS SOBRE EL PLANO (Únicamente tras montar en cliente) */}
          {isMounted &&
            tables.map((table) => {
              const pos = tablePositions[table.id] || { x: 50, y: 50, shape: "square" };
              const isSelected = selectedTableId === table.id;
              const isOccupied = table.status === "occupied";
              const shape = pos.shape || inferTableShape(table.capacity, table.name_or_number);

            return (
              <div
                key={table.id}
                onPointerDown={(e) => {
                  if (workMode === "move_tables") {
                    e.stopPropagation();
                    setIsDraggingTable(true);
                    setDraggedTableId(table.id);
                    setSelectedTableId(table.id);
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedTableId(table.id);
                }}
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: `translate(-50%, -50%) scale(${isSelected ? 1.08 : 1})`,
                }}
                className={`absolute z-10 cursor-pointer transition-transform duration-100 group ${
                  workMode === "move_tables" ? "cursor-grab active:cursor-grabbing" : ""
                }`}
              >
                {/* Ilustración de la mesa con sillas */}
                <div className="relative">
                  <TableBlueprintIllustration
                    shape={shape}
                    capacity={table.capacity || 4}
                    status={table.status}
                    tableNumber={table.name_or_number}
                    size="md"
                  />

                  {/* Halo de selección */}
                  {isSelected && (
                    <div className="absolute -inset-2 rounded-full border-2 border-[#ED500A] pointer-events-none animate-pulse" />
                  )}

                  {/* Total comanda si ocupada */}
                  {isOccupied && table.activeOrder && (
                    <div className="absolute -top-2 -right-2 bg-red-600 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg border border-white/20 whitespace-nowrap">
                      {formatCOP(table.activeOrder.total)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* BANNER FLOTANTE DE INDICACIÓN */}
        {workMode === "design_room" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#ED500A] text-white px-4 py-2 rounded-2xl text-xs font-bold shadow-xl backdrop-blur-md flex items-center gap-2 pointer-events-none animate-in fade-in">
            <Sparkles className="w-4 h-4" />
            <span>
              {designTool === "smart_draw"
                ? "Dibuja el contorno con el mouse. Al soltar se corregirá a líneas rectas."
                : designTool === "point_by_point"
                ? "Haz clic en cada esquina de la sala para trazar las paredes."
                : designTool === "adjust_nodes"
                ? "Arrastra los círculos numerados para ajustar las medidas."
                : "Haz clic en una pared para colocar la puerta de entrada."}
            </span>
          </div>
        )}

        {workMode === "move_tables" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 px-4 py-2 rounded-2xl text-xs font-bold shadow-xl backdrop-blur-md flex items-center gap-2 pointer-events-none animate-in fade-in">
            <Move className="w-4 h-4" />
            <span>Arrastra las mesas para ubicarlas dentro de la sala. Clic en Guardar al terminar.</span>
          </div>
        )}
      </div>

      {/* 4. DETALLE / ACCIÓN RÁPIDA DE LA MESA SELECCIONADA */}
      {selectedTable && (
        <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-3">
            <TableBlueprintIllustration
              shape={tablePositions[selectedTable.id]?.shape || "square"}
              capacity={selectedTable.capacity || 4}
              status={selectedTable.status}
              tableNumber={selectedTable.name_or_number}
              size="sm"
            />
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  {selectedTable.name_or_number}
                </h4>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    selectedTable.status === "occupied"
                      ? "bg-red-500/10 text-red-500 border border-red-500/20"
                      : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  }`}
                >
                  {selectedTable.status === "occupied" ? "Ocupada" : "Libre"}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Capacidad: {selectedTable.capacity || 4} comensales · Sala: {roomName}
              </p>
            </div>
          </div>

          {/* Cambiar forma de la mesa */}
          {workMode === "move_tables" ? (
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/[0.04] p-1.5 rounded-xl">
              <span className="text-xs font-semibold text-slate-400 mr-1">Forma de Mesa:</span>
              {[
                { id: "square", label: "Cuadrada" },
                { id: "round", label: "Redonda" },
                { id: "rectangle", label: "Rectangular" },
                { id: "bar", label: "Barra" },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleChangeSelectedShape(s.id as TableShape)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    (tablePositions[selectedTable.id]?.shape || "square") === s.id
                      ? "bg-[#ED500A] text-white"
                      : "hover:bg-slate-200/60 dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          ) : (
            /* Modo operativo: Botón comanda */
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              {selectedTable.status === "occupied" && selectedTable.activeOrder && (
                <div className="text-right mr-2">
                  <span className="text-[10px] text-slate-400 block font-medium">Total comanda</span>
                  <span className="font-bold font-mono text-sm text-red-600 dark:text-red-400">
                    {formatCOP(selectedTable.activeOrder.total)}
                  </span>
                </div>
              )}
              <Link href={`/workspace/${businessId}/pos?tableId=${selectedTable.id}`}>
                <Button variant="primary" size="sm" className="gap-2">
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>
                    {selectedTable.status === "occupied" ? "Ver Comanda en POS" : "Abrir Comanda"}
                  </span>
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
