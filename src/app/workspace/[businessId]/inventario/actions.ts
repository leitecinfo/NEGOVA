"use server";

import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import {
  getBusinessLocations,
  ensureDefaultLocation,
  createLocation,
  getInventoryStock,
  upsertInventoryStock,
  recordInventoryMovement,
  recordInventoryMovementsBatch,
  getInventoryMovementsHistory,
  transferInventory,
  getInventoryKPIs,
  getLowStockItems,
  executeStockAdjustment,
  getProductMovementHistory,
  updateItemMinStock,
} from "@/lib/inventory/inventory-service";
import {
  getSpoilageRecords,
  getSpoilageKPIs,
  createSpoilageRecord,
  updateSpoilageRecord,
  cancelSpoilageRecord,
} from "@/lib/spoilage/spoilage-service";
import type {
  CreateSpoilageInput,
  UpdateSpoilageInput,
  CancelSpoilageInput,
  SpoilageFilterOptions,
  SpoilageRecord,
  SpoilageKPIs,
} from "@/lib/spoilage/types";
import type {
  CreateLocationInput,
  UpsertStockInput,
  RecordMovementInput,
  CreateMovementInput,
  InventoryMovementFilters,
  CreateTransferInput,
  TransferResult,
  StockAdjustmentInput,
  StockAdjustmentResult,
  LowStockItem,
} from "@/lib/inventory/types";
import { revalidatePath } from "next/cache";

/**
 * Consulta las ubicaciones físicas o almacenes del comercio.
 * Permiso requerido: inventory.view
 */
export async function getBusinessLocationsAction(businessId: string) {
  const auth = await verifyWorkspaceAction(businessId, "inventory.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ver ubicaciones.", data: [] };
  }

  try {
    const locations = await getBusinessLocations(businessId);
    return { success: true, data: locations };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar ubicaciones de inventario.", data: [] };
  }
}

/**
 * Crea una nueva ubicación física o bodega en el negocio.
 * Permiso requerido: inventory.update
 */
export async function createLocationAction(
  businessId: string,
  input: CreateLocationInput
) {
  const auth = await verifyWorkspaceAction(businessId, "inventory.update");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para crear ubicaciones de inventario." };
  }

  try {
    const location = await createLocation(businessId, input);
    revalidatePath(`/workspace/${businessId}/inventario`);
    return { success: true, data: location };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al crear la ubicación de inventario." };
  }
}

/**
 * Consulta el stock de productos e insumos por ubicación.
 * Permiso requerido: inventory.view
 */
export async function getInventoryStockAction(
  businessId: string,
  filter?: { locationId?: string; productId?: string; lowStockOnly?: boolean }
) {
  const auth = await verifyWorkspaceAction(businessId, "inventory.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para consultar el inventario.", data: [] };
  }

  try {
    const stock = await getInventoryStock(businessId, filter);
    return { success: true, data: stock };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar existencias de inventario.", data: [] };
  }
}

/**
 * Actualiza o define el stock y umbrales mínimos de un producto en una ubicación.
 * Permiso requerido: inventory.update
 */
export async function upsertInventoryStockAction(
  businessId: string,
  input: UpsertStockInput
) {
  const auth = await verifyWorkspaceAction(businessId, "inventory.update");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para modificar niveles de stock." };
  }

  try {
    const stock = await upsertInventoryStock(businessId, input);
    revalidatePath(`/workspace/${businessId}/inventario`);
    return { success: true, data: stock };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al actualizar existencias de stock." };
  }
}

/**
 * Registra un movimiento de inventario (entrada, salida, ajuste, venta o merma).
 * Permiso requerido:
 * - Para ajustes y mermas: inventory.adjust
 * - Para entradas regulares: inventory.create
 */
export async function recordInventoryMovementAction(
  businessId: string,
  input: RecordMovementInput
) {
  // Protección contra doble descuento: Las mermas deben canalizarse exclusivamente vía createSpoilageRecordAction
  if (input.movementType === "spoilage") {
    return {
      success: false,
      error: "Para registrar mermas utiliza la función oficial de mermas (createSpoilageRecordAction) para garantizar el descuento único y trazabilidad en Kardex.",
    };
  }

  const isAdjustment = input.movementType === "adjustment";
  const requiredPermission = isAdjustment ? "inventory.adjust" : "inventory.create";

  const auth = await verifyWorkspaceAction(businessId, requiredPermission);
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || `No tienes autorización (${requiredPermission}) para registrar este movimiento.` };
  }

  try {
    const movement = await recordInventoryMovement(businessId, input, auth.context.userId);
    revalidatePath(`/workspace/${businessId}/inventario`);
    return { success: true, data: movement };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al registrar el movimiento de inventario." };
  }
}

/**
 * Realiza la transferencia de existencias entre dos ubicaciones distintas [INV-005].
 * Permite tanto transferencias simples como múltiples productos en un solo lote.
 * Permiso requerido: inventory.transfer
 */
export async function transferStockAction(
  businessId: string,
  input:
    | CreateTransferInput
    | {
        productId: string;
        fromLocationId: string;
        toLocationId: string;
        quantity: number;
        notes?: string;
      }
) {
  const auth = await verifyWorkspaceAction(businessId, "inventory.transfer");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para realizar transferencias de stock." };
  }

  try {
    let payload: CreateTransferInput;

    if ("fromLocationId" in input) {
      payload = {
        sourceLocationId: input.fromLocationId,
        destinationLocationId: input.toLocationId,
        items: [
          {
            productId: input.productId,
            quantity: input.quantity,
          },
        ],
        notes: input.notes || null,
      };
    } else {
      payload = input;
    }

    const result = await transferInventory(businessId, payload, auth.context.userId);

    revalidatePath(`/workspace/${businessId}/inventario`);
    revalidatePath(`/workspace/${businessId}/productos`);
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al realizar la transferencia de inventario." };
  }
}

/**
 * Registra múltiples movimientos de inventario en lote (batch).
 * Permiso requerido:
 * - Para lotes con ajustes: inventory.adjust
 * - Para lotes de entradas/salidas regulares: inventory.create
 */
export async function recordInventoryMovementsBatchAction(
  businessId: string,
  items: CreateMovementInput[]
) {
  const hasAdjustment = (items || []).some(
    (it) => it.movementType === "adjustment" || it.movementType === "spoilage"
  );
  const requiredPermission = hasAdjustment ? "inventory.adjust" : "inventory.create";

  const auth = await verifyWorkspaceAction(businessId, requiredPermission);
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || `No tienes autorización (${requiredPermission}) para registrar estos movimientos.`,
    };
  }

  try {
    const movements = await recordInventoryMovementsBatch(businessId, items, auth.context.userId);
    revalidatePath(`/workspace/${businessId}/inventario`);
    revalidatePath(`/workspace/${businessId}/productos`);
    return { success: true, data: movements };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al registrar la lista de movimientos." };
  }
}

/**
 * Consulta el historial de movimientos de inventario con filtros y paginación.
 * Permiso requerido: inventory.view
 */
export async function getInventoryMovementsHistoryAction(
  businessId: string,
  filters?: InventoryMovementFilters
) {
  const auth = await verifyWorkspaceAction(businessId, "inventory.view");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para consultar el historial de movimientos.",
      data: [],
    };
  }

  try {
    const movements = await getInventoryMovementsHistory(businessId, filters);
    return { success: true, data: movements };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Error al consultar historial de movimientos de inventario.",
      data: [],
    };
  }
}

/**
 * Consulta los KPIs consolidados de inventario [TAREA-03].
 * Permiso: inventory.view
 */
export async function getInventoryKPIsAction(businessId: string) {
  const auth = await verifyWorkspaceAction(businessId, "inventory.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para consultar KPIs.", data: null };
  }

  try {
    const kpis = await getInventoryKPIs(businessId);
    return { success: true, data: kpis };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al calcular indicadores de inventario.", data: null };
  }
}

/**
 * Consulta la lista de artículos inventariables con existencias bajas o agotadas [TAREA-03].
 * Permiso: inventory.view
 */
export async function getLowStockItemsAction(businessId: string) {
  const auth = await verifyWorkspaceAction(businessId, "inventory.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para consultar alertas de stock.", data: [] };
  }

  try {
    const items = await getLowStockItems(businessId);
    return { success: true, data: items };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar alertas de stock bajo.", data: [] };
  }
}

/**
 * Ejecuta un ajuste manual de inventario con trazabilidad estricta y fuente única de verdad [TAREA-03].
 * Permiso: inventory.adjust
 */
export async function executeStockAdjustmentAction(
  businessId: string,
  input: StockAdjustmentInput
) {
  const auth = await verifyWorkspaceAction(businessId, "inventory.adjust");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ajustar existencias de inventario." };
  }

  try {
    const result = await executeStockAdjustment(businessId, input, auth.context.userId);
    revalidatePath(`/workspace/${businessId}/inventario`);
    revalidatePath(`/workspace/${businessId}/productos`);
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al ejecutar el ajuste de inventario." };
  }
}

/**
 * Consulta los movimientos recientes exclusivos de un producto para el modal de detalle [TAREA-03].
 * Permiso: inventory.view
 */
export async function getProductMovementHistoryAction(
  businessId: string,
  productId: string,
  limit = 20
) {
  const auth = await verifyWorkspaceAction(businessId, "inventory.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para consultar el historial.", data: [] };
  }

  try {
    const movements = await getProductMovementHistory(businessId, productId, limit);
    return { success: true, data: movements };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar movimientos del artículo.", data: [] };
  }
}

/** Alias para compatibilidad de importaciones existentes */
export const getInventoryLocationsAction = getBusinessLocationsAction;

/**
 * Actualiza el stock mínimo de un artículo [TAREA-08].
 * Permiso: inventory.update
 */
export async function updateItemMinStockAction(
  businessId: string,
  productId: string,
  minStock: number
): Promise<{ success: boolean; minStock?: number; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "inventory.update");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para modificar niveles de stock mínimo." };
  }

  try {
    const res = await updateItemMinStock(businessId, productId, minStock, auth.context.userId);
    revalidatePath(`/workspace/${businessId}/inventario`);
    revalidatePath(`/workspace/${businessId}/productos`);
    return { success: true, minStock: res.minStock };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al actualizar stock mínimo." };
  }
}

/**
 * Consulta registros de mermas y pérdidas [TAREA-08].
 * Permiso: inventory.view
 */
export async function getSpoilageRecordsAction(
  businessId: string,
  options?: SpoilageFilterOptions
): Promise<{ success: boolean; data?: SpoilageRecord[]; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "inventory.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ver mermas.", data: [] };
  }

  try {
    const records = await getSpoilageRecords(businessId, options);
    return { success: true, data: records };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar registros de mermas.", data: [] };
  }
}

/**
 * Consulta los KPIs de mermas y pérdidas del negocio [TAREA-08].
 * Permiso: inventory.view
 */
export async function getSpoilageKPIsAction(
  businessId: string
): Promise<{ success: boolean; data?: SpoilageKPIs | null; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "inventory.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ver estadísticas de mermas.", data: null };
  }

  try {
    const kpis = await getSpoilageKPIs(businessId);
    return { success: true, data: kpis };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al calcular indicadores de mermas.", data: null };
  }
}

/**
 * Registra una merma de inventario con descuento único y trazabilidad garantizada [TAREA-08].
 * Permiso: inventory.adjust
 */
export async function createSpoilageRecordAction(
  businessId: string,
  input: CreateSpoilageInput
): Promise<{ success: boolean; data?: SpoilageRecord; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "inventory.adjust");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para registrar mermas de inventario." };
  }

  try {
    const res = await createSpoilageRecord(businessId, input, auth.context.userId);
    revalidatePath(`/workspace/${businessId}/inventario`);
    revalidatePath(`/workspace/${businessId}/productos`);
    return { success: true, data: res.spoilage };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al registrar la merma." };
  }
}

/**
 * Edita una merma existente recalculando el impacto de existencias y actualizando el Kardex.
 * Permiso: inventory.adjust
 */
export async function updateSpoilageRecordAction(
  businessId: string,
  input: UpdateSpoilageInput
): Promise<{ success: boolean; data?: SpoilageRecord; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "inventory.adjust");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para editar mermas de inventario." };
  }

  try {
    const data = await updateSpoilageRecord(businessId, input, auth.context.userId);
    revalidatePath(`/workspace/${businessId}/inventario`);
    revalidatePath(`/workspace/${businessId}/productos`);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al actualizar la merma." };
  }
}

/**
 * Anula una merma registrada, revirtiendo el descuento de existencias y dejando trazabilidad.
 * Permiso: inventory.adjust
 */
export async function cancelSpoilageRecordAction(
  businessId: string,
  input: CancelSpoilageInput
): Promise<{ success: boolean; data?: SpoilageRecord; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "inventory.adjust");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para anular mermas de inventario." };
  }

  try {
    const data = await cancelSpoilageRecord(businessId, input, auth.context.userId);
    revalidatePath(`/workspace/${businessId}/inventario`);
    revalidatePath(`/workspace/${businessId}/productos`);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al anular la merma." };
  }
}


