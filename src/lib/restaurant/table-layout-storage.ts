import type { TableShape, RoomShapePreset, RoomFloorPlanConfig, TableLayoutPosition } from "./types";

const STORAGE_PREFIX = "negova_tables_layout_v1_";

/**
 * Infiere la forma más adecuada según el nombre y la capacidad si no se ha elegido una explícitamente.
 */
export function inferTableShape(capacity?: number | null, name?: string): TableShape {
  const cleanName = (name || "").toLowerCase();
  if (cleanName.includes("barra") || cleanName.includes("bar")) {
    return "bar";
  }
  const cap = capacity || 4;
  if (cap <= 2) return "square";
  if (cap === 4) return "round";
  if (cap >= 6) return "rectangle";
  return "square";
}

/**
 * Obtiene la configuración del plano de una sala almacenada.
 */
export function getStoredRoomLayout(
  businessId: string,
  roomId: string = "all"
): RoomFloorPlanConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${businessId}_${roomId}`);
    if (!raw) return null;
    return JSON.parse(raw) as RoomFloorPlanConfig;
  } catch {
    return null;
  }
}

/**
 * Guarda la configuración del plano de sala.
 */
export function saveStoredRoomLayout(
  businessId: string,
  roomId: string,
  config: RoomFloorPlanConfig
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${businessId}_${roomId}`,
      JSON.stringify(config)
    );
  } catch (err) {
    console.warn("[saveStoredRoomLayout] Error guardando layout:", err);
  }
}

/**
 * Obtiene o inicializa la posición y forma de cada mesa en el plano.
 */
export function computeDefaultFloorPlan(
  tables: Array<{ id: string; name_or_number: string; capacity?: number | null }>,
  roomPreset: RoomShapePreset = "rectangle"
): RoomFloorPlanConfig {
  const positions: Record<string, TableLayoutPosition> = {};

  // Distribución automática en cuadrícula limpia (columnas de 3 a 5 según cantidad)
  const cols = tables.length <= 4 ? 2 : tables.length <= 9 ? 3 : 4;
  const paddingX = 14;
  const paddingY = 16;
  const availableWidth = 100 - paddingX * 2;
  const availableHeight = 100 - paddingY * 2;

  tables.forEach((t, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const totalRows = Math.max(1, Math.ceil(tables.length / cols));

    const x = cols > 1 ? paddingX + (col / (cols - 1)) * availableWidth : 50;
    const y = totalRows > 1 ? paddingY + (row / (totalRows - 1)) * availableHeight : 50;

    positions[t.id] = {
      x: Math.round(x),
      y: Math.round(y),
      shape: inferTableShape(t.capacity, t.name_or_number),
      rotation: 0,
    };
  });

  return {
    roomShapePreset: roomPreset,
    tables: positions,
  };
}

/**
 * Obtiene la forma específica configurada para una mesa.
 */
export function getStoredTableShape(
  businessId: string,
  tableId: string,
  fallbackCapacity?: number | null,
  fallbackName?: string
): TableShape {
  if (typeof window === "undefined") {
    return inferTableShape(fallbackCapacity, fallbackName);
  }

  try {
    const key = `negova_table_shape_${businessId}_${tableId}`;
    const stored = localStorage.getItem(key);
    if (stored === "round" || stored === "square" || stored === "rectangle" || stored === "bar") {
      return stored as TableShape;
    }
  } catch {}

  return inferTableShape(fallbackCapacity, fallbackName);
}

/**
 * Guarda la forma de una mesa de manera persistente.
 */
export function saveStoredTableShape(
  businessId: string,
  tableId: string,
  shape: TableShape
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`negova_table_shape_${businessId}_${tableId}`, shape);
  } catch {}
}
