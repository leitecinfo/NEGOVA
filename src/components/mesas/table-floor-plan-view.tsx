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
  Receipt,
  LayoutGrid,
  Compass,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TableBlueprintIllustration } from "./table-blueprint-illustration";
import type {
  RestaurantTableWithOrder,
  TableShape,
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

interface TableFloorPlanViewProps {
  businessId: string;
  roomId: string;
  roomName: string;
  tables: RestaurantTableWithOrder[];
  canManageTables: boolean;
  onTableShapeChange?: (tableId: string, shape: TableShape) => void;
  onOpenCommandTicket?: (table: RestaurantTableWithOrder) => void;
}

export function TableFloorPlanView({
  businessId,
  roomId,
  roomName,
  tables,
  canManageTables,
  onTableShapeChange,
  onOpenCommandTicket,
}: TableFloorPlanViewProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [tablePositions, setTablePositions] = useState<Record<string, TableLayoutPosition>>({});
  const [workMode, setWorkMode] = useState<"view" | "move_tables">("view");
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  // Arrastre de mesas
  const [isDraggingTable, setIsDraggingTable] = useState(false);
  const [draggedTableId, setDraggedTableId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);

  // Carga de posiciones de mesas almacenadas por sala
  useEffect(() => {
    setIsMounted(true);
    const stored = getStoredRoomLayout(businessId, roomId);

    if (stored && stored.tables) {
      setTablePositions(stored.tables);
    } else {
      const initial = computeDefaultFloorPlan(tables, "rectangle");
      setTablePositions(initial.tables);
    }

    setSelectedTableId(null);
  }, [businessId, roomId]);

  // Sincronizar nuevas mesas sin sobreescribir las ya ubicadas
  useEffect(() => {
    if (!isMounted) return;
    setTablePositions((prev) => {
      let changed = false;
      const next = { ...prev };
      tables.forEach((t) => {
        if (!next[t.id]) {
          changed = true;
          next[t.id] = {
            x: 50,
            y: 50,
            shape: getStoredTableShape(businessId, t.id, t.capacity, t.name_or_number),
            rotation: 0,
          };
        }
      });
      return changed ? next : prev;
    });
  }, [tables, businessId, isMounted]);

  // Guardar ubicación de mesas
  const handleSaveLayout = useCallback(() => {
    const config: RoomFloorPlanConfig = {
      roomShapePreset: "rectangle",
      tables: tablePositions,
    };

    saveStoredRoomLayout(businessId, roomId, config);
    toast.success(`Ubicación de mesas en «${roomName}» guardada.`);
    setWorkMode("view");
  }, [businessId, roomId, roomName, tablePositions]);

  // Restablecer mesas en cuadrícula ordenada
  const handleResetTables = () => {
    const def = computeDefaultFloorPlan(tables, "rectangle");
    setTablePositions(def.tables);
    toast.info("Mesas reubicadas en cuadrícula.");
  };

  // Coordenadas porcentuales relativas al lienzo (0% a 100%)
  const getCanvasCoords = (clientX: number, clientY: number): Point2D | null => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const rawX = ((clientX - rect.left) / rect.width) * 100;
    const rawY = ((clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.max(6, Math.min(94, Math.round(rawX * 10) / 10)),
      y: Math.max(6, Math.min(94, Math.round(rawY * 10) / 10)),
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (workMode !== "move_tables" || !isDraggingTable || !draggedTableId) return;

    const coords = getCanvasCoords(e.clientX, e.clientY);
    if (!coords) return;

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
  };

  const handlePointerUp = () => {
    if (isDraggingTable) {
      setIsDraggingTable(false);
      setDraggedTableId(null);
    }
  };

  // Cambiar forma de la mesa seleccionada
  const handleChangeSelectedShape = (shape: TableShape) => {
    if (!selectedTableId) return;
    setTablePositions((prev) => ({
      ...prev,
      [selectedTableId]: {
        ...prev[selectedTableId],
        shape,
      },
    }));
    saveStoredTableShape(businessId, selectedTableId, shape);
    if (onTableShapeChange) {
      onTableShapeChange(selectedTableId, shape);
    }
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
      {/* BARRA SUPERIOR: IDENTIFICADOR DE SALA Y HERRAMIENTAS */}
      <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-3 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Identificador de sala */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center font-bold shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Plano Salón:
              </span>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>{roomName}</span>
                {tables.length > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-black/10 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                    {tables.length} {tables.length === 1 ? "mesa" : "mesas"}
                  </span>
                )}
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Visualización interactiva y estado de mesas en tiempo real.
            </p>
          </div>
        </div>

        {/* Acciones principales */}
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

              {/* Botón Guardar cambios al ubicar mesas */}
              {workMode === "move_tables" && (
                <>
                  <button
                    type="button"
                    onClick={handleResetTables}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                    title="Restablecer cuadrícula"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Cuadrícula</span>
                  </button>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveLayout}
                    className="gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Guardar Ubicaciones</span>
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* LIENZO DE PLANO DE SALÓN (BLUEPRINT 2D) */}
      <div className="relative w-full bg-[#07090E] border border-slate-800 rounded-3xl p-4 sm:p-8 overflow-hidden min-h-[500px] flex items-center justify-center select-none shadow-inner">
        {/* Cuadrícula arquitectónica milimétrica de fondo */}
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
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative w-full max-w-[850px] aspect-[4/3] rounded-3xl border-2 border-slate-700/80 bg-[#0B0E17]/95 shadow-2xl transition-all duration-75 overflow-hidden"
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: "center center",
          }}
        >
          {/* Marcador de Entrada Principal */}
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>ENTRADA PRINCIPAL</span>
          </div>

          {/* Renderizado de mesas sobre el plano */}
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

        {/* Banner flotante en modo ubicar mesas */}
        {workMode === "move_tables" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 px-4 py-2 rounded-2xl text-xs font-bold shadow-xl backdrop-blur-md flex items-center gap-2 pointer-events-none animate-in fade-in">
            <Move className="w-4 h-4" />
            <span>Arrastra las mesas para ubicarlas en la sala. Haz clic en «Guardar Ubicaciones» al terminar.</span>
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

          {/* Cambiar forma de mesa (en modo ubicar mesas) o botón comanda (modo operativo) */}
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
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              {selectedTable.status === "occupied" && selectedTable.activeOrder && (
                <div className="text-right mr-2">
                  <span className="text-[10px] text-slate-400 block font-medium">Total comanda</span>
                  <span className="font-bold font-mono text-sm text-red-600 dark:text-red-400">
                    {formatCOP(selectedTable.activeOrder.total)}
                  </span>
                </div>
              )}
              {selectedTable.status === "occupied" ? (
                <Button
                  variant="primary"
                  size="sm"
                  className="gap-2 cursor-pointer"
                  onClick={() => onOpenCommandTicket?.(selectedTable)}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Ver Comanda (Ticket)</span>
                </Button>
              ) : (
                <Link href={`/workspace/${businessId}/pos?tableId=${selectedTable.id}`}>
                  <Button variant="primary" size="sm" className="gap-2 cursor-pointer">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Abrir Comanda</span>
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
