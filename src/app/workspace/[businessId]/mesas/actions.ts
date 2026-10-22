"use server";

import { revalidatePath } from "next/cache";
import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import {
  getRestaurantTablesWithOrders,
  getRestaurantTablesSummary,
  createRestaurantTable,
  updateRestaurantTable,
  deleteRestaurantTable,
  releaseRestaurantTable,
} from "@/lib/restaurant/restaurant-service";
import type {
  RestaurantTableWithOrder,
  RestaurantTablesSummary,
  CreateTableInput,
  UpdateTableInput,
} from "@/lib/restaurant/types";

/**
 * Server Action: Consulta las mesas de un negocio con sus comandas activas y resumen.
 */
export async function getRestaurantTablesWithOrdersAction(
  businessId: string
): Promise<{
  success: boolean;
  data?: {
    tables: RestaurantTableWithOrder[];
    summary: RestaurantTablesSummary;
  };
  error?: string;
}> {
  let auth = await verifyWorkspaceAction(businessId, "tables.view");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "orders.view");
  }

  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para consultar las mesas de este negocio.",
    };
  }

  try {
    const [tables, summary] = await Promise.all([
      getRestaurantTablesWithOrders(businessId),
      getRestaurantTablesSummary(businessId),
    ]);

    return {
      success: true,
      data: {
        tables,
        summary,
      },
    };
  } catch (err: any) {
    console.error("[getRestaurantTablesWithOrdersAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Error al cargar la información de las mesas.",
    };
  }
}

/**
 * Server Action: Registra una nueva mesa física en el salón.
 */
export async function createRestaurantTableAction(
  businessId: string,
  input: CreateTableInput
): Promise<{ success: boolean; error?: string }> {
  let auth = await verifyWorkspaceAction(businessId, "tables.create");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "tables.manage");
  }
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "orders.manage");
  }

  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para crear mesas en este comercio.",
    };
  }

  const res = await createRestaurantTable(businessId, input);

  if (res.success) {
    revalidatePath(`/workspace/${businessId}/mesas`);
    revalidatePath(`/workspace/${businessId}/pos`);
  }

  return { success: res.success, error: res.error };
}

/**
 * Server Action: Actualiza los datos administrativos de una mesa (nombre, capacidad, orden).
 */
export async function updateRestaurantTableAction(
  businessId: string,
  tableId: string,
  input: UpdateTableInput
): Promise<{ success: boolean; error?: string }> {
  let auth = await verifyWorkspaceAction(businessId, "tables.update");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "tables.manage");
  }
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "orders.manage");
  }

  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para modificar mesas en este comercio.",
    };
  }

  const res = await updateRestaurantTable(businessId, tableId, input);

  if (res.success) {
    revalidatePath(`/workspace/${businessId}/mesas`);
    revalidatePath(`/workspace/${businessId}/pos`);
  }

  return { success: res.success, error: res.error };
}

/**
 * Server Action: Elimina una mesa física si y solo si no está ocupada y carece de historial.
 */
export async function deleteRestaurantTableAction(
  businessId: string,
  tableId: string
): Promise<{ success: boolean; error?: string }> {
  let auth = await verifyWorkspaceAction(businessId, "tables.delete");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "tables.manage");
  }
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "orders.manage");
  }

  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para eliminar mesas en este comercio.",
    };
  }

  const res = await deleteRestaurantTable(businessId, tableId);

  if (res.success) {
    revalidatePath(`/workspace/${businessId}/mesas`);
    revalidatePath(`/workspace/${businessId}/pos`);
  }

  return res;
}

/**
 * Server Action: Libera operativamente una mesa ocupada, validando el cierre de la comanda.
 */
export async function releaseRestaurantTableAction(
  businessId: string,
  tableId: string
): Promise<{ success: boolean; error?: string }> {
  let auth = await verifyWorkspaceAction(businessId, "tables.update");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "orders.update");
  }
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "tables.manage");
  }

  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para liberar mesas en este comercio.",
    };
  }

  const res = await releaseRestaurantTable(businessId, tableId);

  if (res.success) {
    revalidatePath(`/workspace/${businessId}/mesas`);
    revalidatePath(`/workspace/${businessId}/pos`);
    revalidatePath(`/workspace/${businessId}/pedidos`);
  }

  return res;
}

/**
 * Server Action: Obtiene el token seguro y enlace del menú para el QR de una mesa.
 */
export async function getTableQrDataAction(
  businessId: string,
  tableId: string
): Promise<{
  success: boolean;
  token?: string;
  qrVersion?: number;
  qrIsActive?: boolean;
  error?: string;
}> {
  let auth = await verifyWorkspaceAction(businessId, "tables.view");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "orders.view");
  }

  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No autorizado para consultar mesas." };
  }

  try {
    const { getRestaurantTables } = await import("@/lib/restaurant/restaurant-service");
    const { generateTableQrToken } = await import("@/lib/restaurant/table-qr-service");

    const tables = await getRestaurantTables(businessId);
    const table = tables.find((t) => t.id === tableId);
    if (!table) {
      return { success: false, error: "Mesa no encontrada." };
    }

    const version = (table as any).qr_version || 1;
    const isActive = (table as any).qr_is_active !== false;
    const token = generateTableQrToken(businessId, tableId, version);

    return {
      success: true,
      token,
      qrVersion: version,
      qrIsActive: isActive,
    };
  } catch (err: any) {
    console.error("[getTableQrDataAction] Error:", err);
    return { success: false, error: err?.message || "Error al generar enlace QR." };
  }
}

/**
 * Server Action: Regenera el código QR de una mesa incrementando su versión criptográfica.
 */
export async function regenerateTableQrAction(
  businessId: string,
  tableId: string
): Promise<{ success: boolean; newVersion?: number; error?: string }> {
  let auth = await verifyWorkspaceAction(businessId, "tables.update");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "tables.manage");
  }

  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No autorizado para regenerar QR." };
  }

  const { regenerateTableQr } = await import("@/lib/restaurant/restaurant-service");
  const res = await regenerateTableQr(businessId, tableId);

  if (res.success) {
    revalidatePath(`/workspace/${businessId}/mesas`);
  }

  return res;
}

/**
 * Server Action: Activa o desactiva el acceso QR de una mesa.
 */
export async function toggleTableQrActiveAction(
  businessId: string,
  tableId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  let auth = await verifyWorkspaceAction(businessId, "tables.update");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "tables.manage");
  }

  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No autorizado para modificar estado del QR." };
  }

  const { toggleTableQrActive } = await import("@/lib/restaurant/restaurant-service");
  const res = await toggleTableQrActive(businessId, tableId, isActive);

  if (res.success) {
    revalidatePath(`/workspace/${businessId}/mesas`);
  }

  return res;
}

