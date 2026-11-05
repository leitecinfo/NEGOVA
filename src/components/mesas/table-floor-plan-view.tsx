"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  Check,
  Save,
  ShoppingBag,
  Clock,
  User,
  Users,
  Layers,
  Sparkles,
  Info,
  Maximize2,
  Lock,
  Unlock,
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
} from "@/lib/restaurant/types";
import {
  getStoredRoomLayout,
  saveStoredRoomLayout,
  computeDefaultFloorPlan,
  getStoredTableShape,
  saveStoredTableShape,
} from "@/lib/restaurant/table-layout-storage";

interface TableFloorPlanViewProps {
  businessId: string;
  roomId: string;
  roomName: string;
  tables: RestaurantTableWithOrder[];
  canManageTables: boolean;
  onTableShapeChange?: (tableId: string, shape: TableShape) => void;
}

export function TableFloorPlanView({
  businessId,
  roomId,
  roomName,
  tables,
  canManageTables,
  onTableShapeChange,
}: TableFloorPlanViewProps) {
  const [roomPreset, setRoomPreset] = useState<RoomShapePreset>("rectangle");
  const [tablePositions, setTablePositions] = useState<Record<string, TableLayoutPosition>>({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedTableId, setDraggedTableId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);

  // Cargar layout existente o inicializar
  useEffect(() => {
    const stored = getStoredRoomLayout(businessId, roomId);
    if (stored && stored.tables) {
      setRoomPreset(stored.roomShapePreset || "rectangle");

      // Completar mesas nuevas que no tengan coordenadas
      const updated: Record<string, TableLayoutPosition> = { ...stored.tables };
      const fallback = computeDefaultFloorPlan(tables, stored.roomShapePreset || "rectangle");

      tables.forEach((t) => {
        if (!updated[t.id]) {
          updated[t.id] = fallback.tables[t.id] || {
            x: 50,
            y: 50,
            shape: getStoredTableShape(businessId, t.id, t.capacity, t.name_or_number),
            rotation: 0,
          };
        } else {
          // Asegurar forma actualizada
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
      // Inicializar layout predeterminado
      const initial = computeDefaultFloorPlan(tables, "rectangle");
      // Asignar formas almacenadas
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
  }, [businessId, roomId, tables]);

  // Guardar plano
  const handleSaveLayout = () => {
    const config: RoomFloorPlanConfig = {
      roomShapePreset: roomPreset,
      tables: tablePositions,
    };
    saveStoredRoomLayout(businessId, roomId, config);
    toast.success("Plano de sala guardado correctamente");
    setIsEditMode(false);
  };

  // Restablecer distribución automática
  const handleResetLayout = () => {
    const def = computeDefaultFloorPlan(tables, roomPreset);
    setTablePositions(def.tables);
    toast.info("Distribución restablecida en cuadrícula");
  };

  // Manejar arrastre de mesa (mouse y touch)
  const handleStartDrag = (tableId: string, e: React.MouseEvent | React.TouchEvent) => {
    if (!isEditMode) {
      setSelectedTableId(tableId);
      return;
    }
    e.stopPropagation();
    setIsDragging(true);
    setDraggedTableId(tableId);
    setSelectedTableId(tableId);
  };

  const updateTableCoordFromClient = (clientX: number, clientY: number) => {
    if (!canvasRef.current || !draggedTableId) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const rawX = ((clientX - rect.left) / rect.width) * 100;
    const rawY = ((clientY - rect.top) / rect.height) * 100;

    // Límites y snap al 2.5%
    const snap = 2.5;
    const clampedX = Math.max(8, Math.min(92, Math.round(rawX / snap) * snap));
    const clampedY = Math.max(8, Math.min(92, Math.round(rawY / snap) * snap));

    setTablePositions((prev) => ({
      ...prev,
      [draggedTableId]: {
        ...prev[draggedTableId],
        x: clampedX,
        y: clampedY,
      },
    }));
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !draggedTableId) return;
    updateTableCoordFromClient(e.clientX, e.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !draggedTableId || e.touches.length === 0) return;
    updateTableCoordFromClient(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleEndDrag = () => {
    if (isDragging) {
      setIsDragging(false);
      setDraggedTableId(null);
    }
  };

  // Cambiar forma de la mesa seleccionada
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

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const selectedTable = useMemo(
    () => tables.find((t) => t.id === selectedTableId),
    [tables, selectedTableId]
  );

  return (
    <div className="space-y-4">
      {/* BARRA SUPERIOR DE HERRAMIENTAS DEL PLANO */}
      <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-3 sm:p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Selector de Presets de Sala */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-semibold text-slate-400 mr-1 hidden sm:inline">
            Forma de sala:
          </span>
          {[
            { id: "rectangle", label: "Rectangular", icon: "▱" },
            { id: "square", label: "Cuadrada", icon: "◻" },
            { id: "l_shape", label: "En L", icon: "⅃" },
            { id: "terrace", label: "Terraza", icon: "🌿" },
          ].map((preset) => {
            const isSel = roomPreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setRoomPreset(preset.id as RoomShapePreset)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                  isSel
                    ? "bg-[#ED500A] text-white shadow-xs"
                    : "bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-400 hover:bg-slate-200/60"
                }`}
              >
                <span>{preset.icon}</span>
                <span>{preset.label}</span>
              </button>
            );
          })}
        </div>

        {/* Acciones del Plano */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Zoom */}
          <div className="flex items-center bg-slate-100 dark:bg-white/[0.06] rounded-xl p-1 gap-1 text-slate-600 dark:text-slate-300">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.15))}
              className="p-1 rounded-lg hover:bg-white dark:hover:bg-white/10 transition-colors"
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
              className="p-1 rounded-lg hover:bg-white dark:hover:bg-white/10 transition-colors"
              title="Aumentar zoom"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(1)}
              className="p-1 rounded-lg hover:bg-white dark:hover:bg-white/10 transition-colors text-slate-400 hover:text-slate-600"
              title="Restablecer zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Alternar Modo Edición / Operativo */}
          {canManageTables && (
            <button
              type="button"
              onClick={() => setIsEditMode(!isEditMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isEditMode
                  ? "bg-amber-500 text-white shadow-xs animate-pulse"
                  : "bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 hover:bg-slate-200/60"
              }`}
            >
              {isEditMode ? (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Moviendo Mesas</span>
                </>
              ) : (
                <>
                  <Move className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Ubicar Mesas</span>
                  <span className="sm:hidden">Mover</span>
                </>
              )}
            </button>
          )}

          {isEditMode && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetLayout}
                title="Restablecer a cuadrícula"
              >
                Auto-ordenar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveLayout}
                className="gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Guardar Plano</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* LIENZO / CANVAS ARQUITECTÓNICO 2D */}
      <div className="relative w-full bg-[#07090E] rounded-3xl border border-slate-800 shadow-2xl overflow-hidden p-2 sm:p-6 min-h-[460px] sm:min-h-[580px] flex items-center justify-center select-none">
        {/* Fondo con cuadrícula arquitectónica milimétrica */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, #ffffff 1px, transparent 1px),
              linear-gradient(to bottom, #ffffff 1px, transparent 1px)
            `,
            backgroundSize: "32px 32px",
          }}
        />

        {/* Zona escalable con zoom */}
        <div
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onTouchMove={handleTouchMove}
          onMouseUp={handleEndDrag}
          onTouchEnd={handleEndDrag}
          className="relative w-full max-w-[850px] aspect-[4/3] rounded-2xl border-4 transition-all duration-75"
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: "center center",
            borderColor: roomPreset === "terrace" ? "#10B981" : "#334155",
            borderStyle: roomPreset === "terrace" ? "dashed" : "solid",
            backgroundColor: "#0B0E17",
          }}
        >
          {/* PARED EN L (Si es preset L) */}
          {roomPreset === "l_shape" && (
            <div
              className="absolute top-0 right-0 w-[42%] h-[46%] bg-[#07090E] border-b-4 border-l-4 border-slate-700 pointer-events-none rounded-bl-2xl flex items-center justify-center"
            >
              <span className="text-[11px] font-mono text-slate-500 uppercase tracking-widest">
                Zona de Cocina / Barra
              </span>
            </div>
          )}

          {/* PUERTA DE ENTRADA ARQUITECTÓNICA */}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#0B0E17] px-6 py-0.5 border-t-2 border-emerald-500/80 text-[10px] font-mono text-emerald-400 font-bold tracking-wider uppercase flex items-center gap-1.5 shadow-lg">
            <span>Entrada Principal</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          </div>

          {/* RENDERIZADO DE MESAS SOBRE EL PLANO */}
          {tables.map((table) => {
            const pos = tablePositions[table.id] || { x: 50, y: 50, shape: "square" };
            const isSelected = selectedTableId === table.id;
            const isOccupied = table.status === "occupied";
            const shape = pos.shape || getStoredTableShape(businessId, table.id, table.capacity, table.name_or_number);

            return (
              <div
                key={table.id}
                onMouseDown={(e) => handleStartDrag(table.id, e)}
                onTouchStart={(e) => handleStartDrag(table.id, e)}
                onClick={() => setSelectedTableId(table.id)}
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: `translate(-50%, -50%) scale(${isSelected ? 1.08 : 1})`,
                }}
                className={`absolute z-10 cursor-pointer transition-transform duration-100 group ${
                  isEditMode ? "cursor-grab active:cursor-grabbing" : ""
                }`}
              >
                {/* Dibujo arquitectónico vectorial de la mesa */}
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

                  {/* Badge flotante de estado / total comanda */}
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

        {/* MODO EDICIÓN ACTIVO: BANNER DE INSTRUCCIONES */}
        {isEditMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500/90 text-slate-950 px-4 py-2 rounded-2xl text-xs font-bold shadow-xl backdrop-blur-md flex items-center gap-2 pointer-events-none">
            <Move className="w-4 h-4" />
            <span>Arrastra las mesas para ubicarlas en la sala. Haz clic en Guardar al terminar.</span>
          </div>
        )}
      </div>

      {/* DETALLE / ACCIÓN RÁPIDA DE LA MESA SELECCIONADA */}
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

          {/* Si está en modo edición: selector de forma para la mesa */}
          {isEditMode ? (
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/[0.04] p-1.5 rounded-xl">
              <span className="text-xs font-semibold text-slate-400 mr-1">Cambiar Forma:</span>
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
            /* Modo operativo: Botón a comanda */
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
