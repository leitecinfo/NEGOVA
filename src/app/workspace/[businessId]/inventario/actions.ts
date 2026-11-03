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
} from "@/lib/inventory/inventory-service";
import type {
  CreateLocationInput,
  UpsertStockInput,
  RecordMovementInput,
  CreateMovementInput,
  InventoryMovementFilters,
  CreateTransferInput,
  TransferResult,
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
  const isAdjustment = input.movementType === "adjustment" || input.movementType === "spoilage";
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
