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
  lowStockCount: number;
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

export type MovementOrigin = "POS" | "Mesa" | "Domicilio" | "Devolución" | "Otro";

export const MOVEMENT_ORIGIN_OPTIONS: { value: MovementOrigin | "all"; label: string }[] = [
  { value: "all", label: "Todos los orígenes" },
  { value: "POS", label: "POS" },
  { value: "Mesa", label: "Mesa" },
  { value: "Domicilio", label: "Domicilio" },
  { value: "Devolución", label: "Devolución" },
  { value: "Otro", label: "Otro" },
];

/**
 * Resuelve el canal/origen operativo del movimiento de inventario:
 * - POS: Ventas en mostrador, para llevar o directas en caja
 * - Mesa: Consumo en salón / pedidos en mesa (dine_in)
 * - Domicilio: Pedidos de delivery / despacho a domicilio
 * - Devolución: Anulaciones de ventas, notas de crédito o reingreso de stock
 * - Otro: Compras, traslados entre bodegas, ajustes físicos, mermas
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

  // 1. Devolución (anulación de ventas, notas de crédito, reintegro de existencias)
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

  // 2. Domicilio (delivery, repartidores, despachos)
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

  // 3. Mesa (dine_in, consumo en salón, comanda de mesa)
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

  // 4. POS (ventas en caja, mostrador, para llevar, recetas de venta directa)
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
    notes.includes("receta (pedido") ||
    notes.includes("venta #")
  ) {
    return "POS";
  }

  // 5. Otro (compras, ajustes de inventario, traslados entre bodegas, mermas, stock inicial)
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
  locationId: string;
  locationName: string;
  movementType: MovementType;
  quantity: number;
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



