import { z } from "zod";

// ==========================================
// UBICACIONES (LOCATIONS)
// ==========================================

export const LocationTypeSchema = z.enum(["point_of_sale", "warehouse", "branch"]);
export type LocationType = z.infer<typeof LocationTypeSchema>;

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  point_of_sale: "Punto de Venta",
  warehouse: "Bodega / Almacén",
  branch: "Sucursal",
};

export interface Location {
  id: string;
  businessId: string;
  name: string;
  type: LocationType;
  address?: string | null;
  isVisibleInMenu: boolean;
  isActive: boolean;
  createdAt: string;
}

export const CreateLocationInputSchema = z.object({
  name: z.string().trim().min(1, "El nombre de la ubicación es obligatorio"),
  type: LocationTypeSchema.default("point_of_sale"),
  address: z.string().trim().nullable().optional(),
  isVisibleInMenu: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type CreateLocationInput = z.infer<typeof CreateLocationInputSchema>;

// ==========================================
// STOCK POR UBICACIÓN (INVENTORY_STOCK)
// ==========================================

export interface InventoryStock {
  id: string;
  businessId: string;
  productId: string;
  locationId: string;
  quantity: number;
  minStock: number;
  cost: number;
  updatedAt: string;
}

export const UpsertStockInputSchema = z.object({
  productId: z.string().uuid("ID de producto inválido"),
  locationId: z.string().uuid("ID de ubicación inválido"),
  quantity: z.coerce.number().min(0, "La cantidad no puede ser negativa"),
  minStock: z.coerce.number().min(0, "El stock mínimo no puede ser negativo").optional(),
  cost: z.coerce.number().min(0, "El costo unitario no puede ser negativo").optional(),
});

export type UpsertStockInput = z.infer<typeof UpsertStockInputSchema>;

// ==========================================
// MOVIMIENTOS DE INVENTARIO (INVENTORY_MOVEMENTS)
// ==========================================

export const MovementTypeSchema = z.enum([
  "entry",
  "exit",
  "adjustment",
  "transfer_in",
  "transfer_out",
  "sale",
  "spoilage",
]);

export type MovementType = z.infer<typeof MovementTypeSchema>;

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  entry: "Entrada de Stock",
  exit: "Salida de Stock",
  adjustment: "Ajuste de Inventario",
  transfer_in: "Transferencia (Entrada)",
  transfer_out: "Transferencia (Salida)",
  sale: "Venta",
  spoilage: "Merma / Pérdida",
};

export const ReferenceTypeSchema = z.enum(["sale", "purchase", "adjustment", "transfer", "spoilage"]).nullable().optional();
export type ReferenceType = z.infer<typeof ReferenceTypeSchema>;

export interface InventoryMovement {
  id: string;
  businessId: string;
  productId: string;
  locationId: string;
  movementType: MovementType;
  quantity: number;
  unitCost?: number | null;
  totalCost?: number | null;
  referenceId?: string | null;
  referenceType?: ReferenceType;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

export const CreateMovementInputSchema = z
  .object({
    productId: z.string().uuid("ID de producto inválido"),
    locationId: z.string().uuid("ID de ubicación inválido"),
    movementType: MovementTypeSchema,
    quantity: z.coerce.number().min(0, "La cantidad no puede ser negativa"),
    unitCost: z.coerce.number().min(0).nullable().optional(),
    totalCost: z.coerce.number().min(0).nullable().optional(),
    referenceId: z.string().uuid().nullable().optional(),
    referenceType: ReferenceTypeSchema,
    notes: z.string().trim().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.movementType !== "adjustment" && data.quantity <= 0) {
        return false;
      }
      return true;
    },
    {
      message: "Para entradas y salidas la cantidad debe ser mayor a 0",
      path: ["quantity"],
    }
  );

export type CreateMovementInput = z.infer<typeof CreateMovementInputSchema>;
export type RecordMovementInput = CreateMovementInput;

export interface InventoryMovementWithDetails extends InventoryMovement {
  productName: string;
  productSku?: string | null;
  locationName: string;
  createdByName?: string | null;
}

export interface InventoryMovementsFilterParams {
  businessId: string;
  locationId?: string;
  productId?: string;
  movementType?: MovementType | "all";
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface InventoryMovementsListResult {
  movements: InventoryMovementWithDetails[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

// ==========================================
// KPIS Y MATRIZ DE STOCK POR UBICACIÓN [INV-002]
// ==========================================

export interface InventoryKPIs {
  totalProducts: number;
  totalItems?: number;
  inStockCount?: number;
  lowStockCount: number;
  outOfStockCount?: number;
  totalCostValue: number;
  todayMovementsCount: number;
}

export interface ProductStockMatrixRow {
  productId: string;
  productName: string;
  categoryName?: string | null;
  sku?: string | null;
  cost: number;
  price: number;
  trackStock: boolean;
  totalStock: number;
  isLowStock: boolean;
  stockByLocation: Record<
    string,
    {
      quantity: number;
      minStock: number;
      cost: number;
      isLow: boolean;
    }
  >;
}

export interface ProductStockMatrixResult {
  locations: Location[];
  rows: ProductStockMatrixRow[];
}

// ==========================================
// HISTORIAL DE MOVIMIENTOS Y ALERTAS DE STOCK BAJO [INV-004]
// ==========================================

export type MovementOrigin =
  | "Compra"
  | "Merma"
  | "Ajuste"
  | "Receta"
  | "POS"
  | "Mesa"
  | "Domicilio"
  | "Devolución"
  | "Otro";

export const MOVEMENT_ORIGIN_OPTIONS: { value: MovementOrigin | "all"; label: string }[] = [
  { value: "all", label: "Todos los orígenes" },
  { value: "Compra", label: "Recepción de Compra" },
  { value: "Merma", label: "Merma / Pérdida" },
  { value: "Ajuste", label: "Ajuste de Inventario" },
  { value: "Receta", label: "Consumo por Receta" },
  { value: "POS", label: "Venta en POS / Caja" },
  { value: "Mesa", label: "Consumo en Mesa" },
  { value: "Domicilio", label: "Despacho Domicilio" },
  { value: "Devolución", label: "Devolución / Anulación" },
  { value: "Otro", label: "Otro" },
];

/**
 * Extrae de forma confiable la existencia anterior y resultante a partir de los metadatos o notas del movimiento.
 */
export function extractStockSnapshot(notes?: string | null): {
  previousQuantity: number | null;
  resultingQuantity: number | null;
} {
  if (!notes) return { previousQuantity: null, resultingQuantity: null };

  // Formato estándar: (Anterior: 10, Resultante: 8) o (Anterior: 10, Dif: -2, Resultante: 8)
  const prevMatch = notes.match(/Anterior:\s*(-?[\d.]+)/i);
  const resultMatch = notes.match(/Resultante:\s*(-?[\d.]+)/i);

  const prev = prevMatch ? Number(prevMatch[1]) : null;
  const res = resultMatch ? Number(resultMatch[1]) : null;

  return {
    previousQuantity: prev !== null && !isNaN(prev) ? prev : null,
    resultingQuantity: res !== null && !isNaN(res) ? res : null,
  };
}

/**
 * Resuelve el canal/origen operativo del movimiento de inventario:
 * - Compra: Recepción de mercancía por orden de compra
 * - Merma: Pérdida, desperdicio, daño o descomposición
 * - Ajuste: Ajuste físico o corrección manual de stock
 * - Receta: Consumo de insumos/ingredientes por preparación
 * - POS: Ventas en mostrador, para llevar o directas en caja
 * - Mesa: Consumo en salón / pedidos en mesa (dine_in)
 * - Domicilio: Pedidos de delivery / despacho a domicilio
 * - Devolución: Anulaciones de ventas, notas de crédito o reingreso de stock
 * - Otro: Transferencias u operaciones no catalogadas
 */
export function resolveMovementOrigin(movement: {
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;
  movementType?: string | null;
  orderType?: string | null;
  docType?: string | null;
}): MovementOrigin {
  const notes = (movement.notes || "").toLowerCase();
  const refType = (movement.referenceType || "").toLowerCase();
  const movType = (movement.movementType || "").toLowerCase();
  const orderType = (movement.orderType || "").toLowerCase();
  const docType = (movement.docType || "").toLowerCase();

  // 1. Merma (pérdida, desperdicio, daño, vencimiento)
  if (
    movType === "spoilage" ||
    refType === "spoilage" ||
    notes.includes("merma") ||
    notes.includes("desperdicio") ||
    notes.includes("descomposic") ||
    notes.includes("vencid") ||
    notes.includes("dañad") ||
    notes.includes("manipulación")
  ) {
    return "Merma";
  }

  // 2. Compra (recepción de mercancía por compra con proveedor)
  if (
    refType === "purchase" ||
    notes.includes("compra") ||
    notes.includes("proveedor") ||
    notes.includes("recepción de compra") ||
    notes.includes("recepcion de compra") ||
    notes.includes("abastecimiento") ||
    notes.startsWith("compra ")
  ) {
    return "Compra";
  }

  // 3. Devolución (anulaciones de ventas, notas de crédito, reintegros)
  if (
    docType === "credit_note" ||
    refType === "sale_cancellation" ||
    refType === "credit_note" ||
    refType === "return" ||
    movType === "return" ||
    notes.includes("devolución") ||
    notes.includes("devolucion") ||
    notes.includes("anulación") ||
    notes.includes("anulacion") ||
    notes.includes("reintegro") ||
    notes.includes("nota de crédito") ||
    notes.includes("nota de credito") ||
    notes.includes("nc-")
  ) {
    return "Devolución";
  }

  // 4. Consumo de ingredientes/insumos por receta
  if (
    refType === "recipe" ||
    refType === "production" ||
    movType === "recipe" ||
    notes.includes("receta") ||
    notes.includes("descuento por receta") ||
    notes.includes("consumo por receta")
  ) {
    return "Receta";
  }

  // 5. Ajuste manual de inventario (conteo físico o corrección)
  if (
    movType === "adjustment" ||
    refType === "adjustment" ||
    notes.includes("ajuste") ||
    notes.includes("conteo físico") ||
    notes.includes("conteo fisico") ||
    notes.includes("inventario inicial")
  ) {
    return "Ajuste";
  }

  // 6. Domicilio (delivery, repartidores, despachos)
  if (
    orderType === "delivery" ||
    refType === "delivery" ||
    notes.includes("domicilio") ||
    notes.includes("delivery") ||
    notes.includes("reparto") ||
    notes.includes("rappi") ||
    notes.includes("justo")
  ) {
    return "Domicilio";
  }

  // 7. Mesa (dine_in, consumo en salón, comanda de mesa)
  if (
    orderType === "dine_in" ||
    notes.includes("mesa") ||
    notes.includes("salon") ||
    notes.includes("salón") ||
    notes.includes("dine_in") ||
    (refType === "restaurant_order" && notes.includes("comanda"))
  ) {
    return "Mesa";
  }

  // 8. POS (ventas en caja, mostrador, para llevar, ticket directo)
  if (
    orderType === "takeout" ||
    refType === "sale" ||
    movType === "sale" ||
    notes.includes("pos") ||
    notes.includes("caja") ||
    notes.includes("mostrador") ||
    notes.includes("para llevar") ||
    notes.includes("takeout") ||
    notes.includes("ticket") ||
    notes.includes("venta #")
  ) {
    return "POS";
  }

  return "Otro";
}

/**
 * Formatea fechas de movimientos al estándar requerido: D/M/AAAA HH:mm
 */
export function formatMovementDate(isoString: string): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return isoString;
  }
}

export interface InventoryMovementWithDetails {
  id: string;
  businessId: string;
  productId: string;
  productName: string;
  productSku?: string | null;
  unit?: string | null;
  locationId: string;
  locationName: string;
  movementType: MovementType;
  quantity: number;
  previousQuantity?: number | null;
  resultingQuantity?: number | null;
  unitCost?: number | null;
  totalCost?: number | null;
  referenceId?: string | null;
  referenceType?: ReferenceType;
  notes?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
  origin?: MovementOrigin;
  createdAt: string;
}

export interface LowStockItem {
  productId: string;
  productName: string;
  categoryName?: string | null;
  sku?: string | null;
  unit?: string | null;
  locationId: string;
  locationName: string;
  quantity: number;
  minStock: number;
  cost: number;
  deficit: number;
  status: "critical" | "out_of_stock";
}

export interface InventoryMovementFilters {
  locationId?: string;
  productId?: string;
  movementType?: MovementType | "all";
  origin?: MovementOrigin | "all";
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
}

// ==========================================
// TRANSFERENCIAS ENTRE UBICACIONES [INV-005]
// ==========================================

export const TransferItemInputSchema = z.object({
  productId: z.string().uuid("ID de producto inválido"),
  quantity: z.coerce.number().positive("La cantidad a transferir debe ser mayor a 0"),
});

export type TransferItemInput = z.infer<typeof TransferItemInputSchema>;

export const CreateTransferInputSchema = z
  .object({
    sourceLocationId: z.string().uuid("ID de ubicación origen inválido"),
    destinationLocationId: z.string().uuid("ID de ubicación destino inválido"),
    items: z.array(TransferItemInputSchema).min(1, "Debe agregar al menos un producto a transferir"),
    notes: z.string().trim().nullable().optional(),
  })
  .refine((data) => data.sourceLocationId !== data.destinationLocationId, {
    message: "La ubicación origen y destino no pueden ser iguales",
    path: ["destinationLocationId"],
  });

export type CreateTransferInput = z.infer<typeof CreateTransferInputSchema>;

export interface TransferResult {
  transferId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  sourceLocationName: string;
  destinationLocationName: string;
  movements: InventoryMovement[];
}

// ==========================================
// ARTÍCULOS INVENTARIABLES Y AJUSTES MANUALES [TAREA-03]
// ==========================================

export type InventariableItemType = "product" | "ingredient";
export type InventariableControlType = "direct" | "recipe";

export interface RecipeIngredientDetail {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  stockQuantity: number;
  requiredPerPortion: number;
  availablePortions: number;
  isLimiting: boolean;
}

export interface InventariableItem {
  id: string;
  name: string;
  itemType: InventariableItemType;
  controlType: InventariableControlType;
  categoryId?: string | null;
  categoryName?: string | null;
  sku?: string | null;
  barcode?: string | null;
  imageUrl?: string | null;
  unit: string;
  currentStock: number;
  minStock: number;
  cost: number;
  price: number;
  totalValue: number;
  status: "in_stock" | "low_stock" | "out_of_stock" | "pending_recipe";
  hasVariants: boolean;
  variants: any[];
  trackStock: boolean;
  isAvailable: boolean;
  updatedAt?: string;

  // Atributos de productos preparados por receta [TAREA-03]
  recipeId?: string | null;
  recipeName?: string | null;
  recipeStatus?: "active" | "inactive" | "none";
  portionsAvailable?: number | null;
  exactPortionsAvailable?: number | null;
  limitingIngredient?: {
    ingredientId: string;
    name: string;
    currentStock: number;
    requiredPerPortion: number;
    unit: string;
    availablePortions: number;
  } | null;
  recipeIngredients?: RecipeIngredientDetail[];
}

export const AdjustmentReasonSchema = z.enum([
  "physical_count",
  "initial_inventory",
  "correction",
  "return",
  "internal_use",
  "sample",
  "damage",
  "expiration",
  "loss",
  "other",
]);

export type AdjustmentReason = z.infer<typeof AdjustmentReasonSchema>;

export const ADJUSTMENT_REASON_LABELS: Record<AdjustmentReason, string> = {
  initial_inventory: "Inventario inicial",
  correction: "Corrección por error de registro",
  physical_count: "Diferencia de conteo físico",
  return: "Devolución a proveedor",
  internal_use: "Consumo interno",
  sample: "Uso como muestra",
  damage: "Daño / Rotura",
  expiration: "Vencimiento / Caducidad",
  loss: "Pérdida / Descuadre",
  other: "Otro motivo",
};

export const ADJUSTMENT_UI_REASONS: AdjustmentReason[] = [
  "initial_inventory",
  "correction",
  "physical_count",
  "return",
  "internal_use",
  "sample",
  "other",
];

export const StockAdjustmentInputSchema = z.object({
  productId: z.string().uuid("ID de artículo inválido"),
  targetQuantity: z.coerce.number().min(0, "La cantidad física no puede ser negativa"),
  reason: AdjustmentReasonSchema,
  unitCost: z.coerce.number().min(0, "El costo no puede ser negativo").optional(),
  notes: z.string().trim().max(500, "Las observaciones no pueden superar 500 caracteres").optional(),
});

export type StockAdjustmentInput = z.infer<typeof StockAdjustmentInputSchema>;

export interface StockAdjustmentResult {
  movement: InventoryMovement;
  previousQuantity: number;
  newQuantity: number;
  difference: number;
  reason: AdjustmentReason;
  notes?: string | null;
}




