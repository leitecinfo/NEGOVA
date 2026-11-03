"use server";

import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import {
  getBusinessLocations,
  ensureDefaultLocation,
  createLocation,
  getInventoryKPIs,
  getProductStockMatrix,
  upsertInventoryStock,
} from "@/lib/inventory/inventory-service";
import type {
  CreateLocationInput,
  UpsertStockInput,
  InventoryKPIs,
  Location,
  ProductStockMatrixResult,
} from "@/lib/inventory/types";
import { revalidatePath } from "next/cache";

/**
 * Consulta las ubicaciones físicas o almacenes del negocio.
 * Permiso: inventory.view
 */
export async function getInventoryLocationsAction(
  businessId: string
): Promise<{ success: boolean; data?: Location[]; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "inventory.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ver ubicaciones." };
  }

  try {
    let locations = await getBusinessLocations(businessId);
    if (!locations || locations.length === 0) {
      await ensureDefaultLocation(businessId);
      locations = await getBusinessLocations(businessId);
    }
    return { success: true, data: locations };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar ubicaciones." };
  }
}

/**
 * Crea una nueva ubicación física o bodega en el negocio.
 * Permiso: inventory.update
 */
export async function createLocationAction(
  businessId: string,
  input: CreateLocationInput
): Promise<{ success: boolean; data?: Location; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "inventory.update");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para crear ubicaciones." };
  }

  try {
    const location = await createLocation(businessId, input);
    revalidatePath(`/workspace/${businessId}/productos`);
    revalidatePath(`/workspace/${businessId}/inventario`);
    return { success: true, data: location };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al crear la ubicación." };
  }
}

/**
 * Consulta los KPIs consolidados de inventario.
 * Permiso: inventory.view
 */
export async function getInventoryKPIsAction(
  businessId: string
): Promise<{ success: boolean; data?: InventoryKPIs; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "inventory.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para consultar KPIs de inventario." };
  }

  try {
    const kpis = await getInventoryKPIs(businessId);
    return { success: true, data: kpis };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al calcular indicadores de inventario." };
  }
}

/**
 * Consulta la matriz de stock de productos por ubicación física.
 * Permiso: inventory.view
 */
export async function getInventoryStockMatrixAction(
  businessId: string,
  filters?: { search?: string; categoryId?: string; lowStockOnly?: boolean }
): Promise<{ success: boolean; data?: ProductStockMatrixResult; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "inventory.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para consultar el inventario." };
  }

  try {
    const matrix = await getProductStockMatrix(businessId, filters);
    return { success: true, data: matrix };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar existencias por ubicación." };
  }
}

/**
 * Ajusta o actualiza las existencias de un producto en una ubicación física.
 * Permiso: inventory.update
 */
export async function updateProductStockAction(
  businessId: string,
  input: UpsertStockInput
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "inventory.update");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para actualizar el stock." };
  }

  try {
    await upsertInventoryStock(businessId, input);
    revalidatePath(`/workspace/${businessId}/productos`);
    revalidatePath(`/workspace/${businessId}/inventario`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al actualizar existencias." };
  }
}

// ==========================================
// HISTORIAL DE MOVIMIENTOS Y ALERTAS [INV-004]
// ==========================================

/**
 * Consulta el historial de movimientos de inventario con datos de producto y ubicación.
 * Permiso: inventory.view
 */
export async function getInventoryMovementsHistoryAction(
  businessId: string,
  filters?: import("@/lib/inventory/types").InventoryMovementFilters
): Promise<{
  success: boolean;
  data?: import("@/lib/inventory/types").InventoryMovementWithDetails[];
  error?: string;
}> {
  const auth = await verifyWorkspaceAction(businessId, "inventory.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ver el historial." };
  }

  try {
    const { getInventoryMovementsHistory } = await import("@/lib/inventory/inventory-service");
    const history = await getInventoryMovementsHistory(businessId, filters);
    return { success: true, data: history };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar historial de movimientos." };
  }
}

/**
 * Consulta los productos que están en nivel crítico o agotados.
 * Permiso: inventory.view
 */
export async function getLowStockItemsAction(
  businessId: string
): Promise<{
  success: boolean;
  data?: import("@/lib/inventory/types").LowStockItem[];
  error?: string;
}> {
  const auth = await verifyWorkspaceAction(businessId, "inventory.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ver alertas de stock." };
  }

  try {
    const { getLowStockItems } = await import("@/lib/inventory/inventory-service");
    const items = await getLowStockItems(businessId);
    return { success: true, data: items };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar alertas de stock bajo." };
  }
}

/**
 * Registra una entrada, salida o ajuste manual de inventario.
 * Permiso: inventory.update
 */
export async function executeStockMovementAction(
  businessId: string,
  input: {
    productId: string;
    locationId: string;
    movementType: "entry" | "exit" | "adjustment";
    quantity: number;
    unitCost?: number;
    notes?: string;
  }
): Promise<{
  success: boolean;
  data?: { movement: import("@/lib/inventory/types").InventoryMovement; newQuantity: number };
  error?: string;
}> {
  const auth = await verifyWorkspaceAction(businessId, "inventory.update");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para registrar movimientos." };
  }

  try {
    const { executeStockMovement } = await import("@/lib/inventory/inventory-service");
    const result = await executeStockMovement(businessId, input, auth.context.userId);

    revalidatePath(`/workspace/${businessId}/productos`);
    revalidatePath(`/workspace/${businessId}/inventario`);
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al registrar el movimiento." };
  }
}

/**
 * Transfiere existencias entre dos ubicaciones distintas [INV-005].
 */
export async function transferStockAction(
  businessId: string,
  input: import("@/lib/inventory/types").CreateTransferInput
) {
  const { transferStockAction: transferAction } = await import("../inventario/actions");
  return transferAction(businessId, input);
}


