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
  transferRestaurantTable,
  getRestaurantRooms,
  getRestaurantRoomsWithTables,
  createRestaurantRoom,
  updateRestaurantRoom,
  deleteRestaurantRoom,
  getRestaurantTableTransfersHistory,
  closeTableOrderWithPayment,
  getRestaurantOrderWithDetails,
  getTableSalesAndTipsReport,
} from "@/lib/restaurant/restaurant-service";
import type {
  RestaurantTable,
  RestaurantTableWithOrder,
  RestaurantTablesSummary,
  CreateTableInput,
  UpdateTableInput,
  RestaurantRoom,
  RestaurantRoomWithTables,
  CreateRestaurantRoomInput,
  ProcessOrderPaymentInput,
  RestaurantOrderWithDetails,
  TableSalesAndTipsReport,
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
): Promise<{ success: boolean; table?: RestaurantTable; error?: string }> {
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

  return { success: res.success, table: res.table, error: res.error };
}

/**
 * Server Action: Actualiza los datos administrativos de una mesa (nombre, capacidad, sala, orden).
 */
export async function updateRestaurantTableAction(
  businessId: string,
  tableId: string,
  input: UpdateTableInput
): Promise<{ success: boolean; table?: RestaurantTable; error?: string }> {
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

  return { success: res.success, table: res.table, error: res.error };
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
 * Server Action: Traslada el pedido activo de una mesa ocupada a otra mesa disponible [MES-002].
 */
export async function transferRestaurantTableAction(
  businessId: string,
  sourceTableId: string,
  targetTableId: string,
  notes?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  let auth = await verifyWorkspaceAction(businessId, "tables.update");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "orders.update");
  }
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "tables.manage");
  }
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "orders.create");
  }

  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para trasladar mesas en este comercio.",
    };
  }

  const res = await transferRestaurantTable(businessId, sourceTableId, targetTableId, {
    userId: auth.context.userId,
    notes,
  });

  if (res.success) {
    revalidatePath(`/workspace/${businessId}/mesas`);
    revalidatePath(`/workspace/${businessId}/pos`);
    revalidatePath(`/workspace/${businessId}/pedidos`);
  }

  return {
    success: res.success,
    error: res.error,
  };
}

/**
 * Server Action: Consulta las salas del restaurante [MES-001].
 */
export async function getRestaurantRoomsAction(businessId: string): Promise<{
  success: boolean;
  data: RestaurantRoom[];
  error?: string;
}> {
  let auth = await verifyWorkspaceAction(businessId, "tables.view");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "orders.view");
  }

  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No autorizado para consultar salas.",
      data: [],
    };
  }

  try {
    const rooms = await getRestaurantRooms(businessId);
    return { success: true, data: rooms };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar salas.", data: [] };
  }
}

/**
 * Server Action: Consulta las salas enriquecidas con métricas de ocupación [MES-001].
 */
export async function getRestaurantRoomsWithTablesAction(businessId: string): Promise<{
  success: boolean;
  data: RestaurantRoomWithTables[];
  error?: string;
}> {
  let auth = await verifyWorkspaceAction(businessId, "tables.view");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "orders.view");
  }

  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No autorizado para consultar salas.",
      data: [],
    };
  }

  try {
    const rooms = await getRestaurantRoomsWithTables(businessId);
    return { success: true, data: rooms };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar salas con mesas.", data: [] };
  }
}

/**
 * Server Action: Crea una nueva sala o ambiente de restaurante [MES-001].
 */
export async function createRestaurantRoomAction(
  businessId: string,
  input: CreateRestaurantRoomInput
): Promise<{ success: boolean; room?: RestaurantRoom; error?: string }> {
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
      error: auth.error || "No tienes autorización para crear salas.",
    };
  }

  try {
    const res = await createRestaurantRoom(businessId, input);
    if (res.success) {
      revalidatePath(`/workspace/${businessId}/mesas`);
      revalidatePath(`/workspace/${businessId}/pos`);
    }
    return res;
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al crear sala." };
  }
}

/**
 * Server Action: Actualiza los datos de una sala o su estado activo/inactivo.
 */
export async function updateRestaurantRoomAction(
  businessId: string,
  roomId: string,
  input: { name?: string; description?: string; status?: "active" | "inactive" }
): Promise<{ success: boolean; room?: RestaurantRoom; error?: string }> {
  let auth = await verifyWorkspaceAction(businessId, "tables.update");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "tables.manage");
  }

  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No autorizado para modificar salas." };
  }

  const res = await updateRestaurantRoom(businessId, roomId, input);
  if (res.success) {
    revalidatePath(`/workspace/${businessId}/mesas`);
    revalidatePath(`/workspace/${businessId}/pos`);
  }
  return res;
}

/**
 * Server Action: Elimina una sala si no tiene mesas asignadas.
 */
export async function deleteRestaurantRoomAction(
  businessId: string,
  roomId: string
): Promise<{ success: boolean; error?: string }> {
  let auth = await verifyWorkspaceAction(businessId, "tables.delete");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "tables.manage");
  }

  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No autorizado para eliminar salas." };
  }

  const res = await deleteRestaurantRoom(businessId, roomId);
  if (res.success) {
    revalidatePath(`/workspace/${businessId}/mesas`);
    revalidatePath(`/workspace/${businessId}/pos`);
  }
  return res;
}

/**
 * Server Action: Consulta el historial de traslados entre mesas.
 */
export async function getRestaurantTableTransfersHistoryAction(
  businessId: string
): Promise<{
  success: boolean;
  data: Array<{
    id: string;
    sourceTableName: string;
    targetTableName: string;
    orderNumber?: number;
    userName?: string;
    transferredAt: string;
    notes?: string;
  }>;
  error?: string;
}> {
  let auth = await verifyWorkspaceAction(businessId, "tables.view");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "orders.view");
  }

  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No autorizado para consultar traslados.", data: [] };
  }

  const data = await getRestaurantTableTransfersHistory(businessId);
  return { success: true, data };
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

/**
 * Server Action: Obtiene el detalle completo de un pedido activo de mesa (ítems, subtotales, etc.) [MES-003].
 */
export async function getTableActiveOrderDetailsAction(
  businessId: string,
  orderId: string
): Promise<{
  success: boolean;
  order?: RestaurantOrderWithDetails | null;
  error?: string;
}> {
  let auth = await verifyWorkspaceAction(businessId, "tables.view");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "orders.view");
  }

  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No autorizado para consultar la comanda." };
  }

  try {
    const order = await getRestaurantOrderWithDetails(businessId, orderId);
    return { success: true, order };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar detalle de la comanda." };
  }
}

/**
 * Server Action: Completa el cobro de una mesa (descuentos preestablecidos, propinas, pago único o mixto)
 * y libera automáticamente la mesa [MES-003].
 */
export async function closeTableOrderWithPaymentAction(
  businessId: string,
  tableId: string,
  paymentInput: ProcessOrderPaymentInput
): Promise<{
  success: boolean;
  error?: string;
  order?: RestaurantOrderWithDetails;
  summary?: {
    subtotal: number;
    discountAmount: number;
    netSaleTotal: number;
    tipAmount: number;
    totalCollected: number;
  };
}> {
  let auth = await verifyWorkspaceAction(businessId, "orders.update");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "sales.create");
  }
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "tables.update");
  }
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "cash.manage");
  }

  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para cobrar y cerrar órdenes de mesa.",
    };
  }

  const res = await closeTableOrderWithPayment(
    businessId,
    tableId,
    paymentInput,
    auth.context.userId
  );

  if (res.success) {
    revalidatePath(`/workspace/${businessId}/mesas`);
    revalidatePath(`/workspace/${businessId}/pos`);
    revalidatePath(`/workspace/${businessId}/pedidos`);
    revalidatePath(`/workspace/${businessId}/ventas`);
    revalidatePath(`/workspace/${businessId}/caja`);
    revalidatePath(`/workspace/${businessId}/cajas`);
  }

  return {
    success: res.success,
    error: res.error,
    order: res.order,
    summary: res.summary,
  };
}

/**
 * Server Action: Obtiene el reporte de ventas y propinas separadas [MES-003].
 */
export async function getTableSalesAndTipsReportAction(
  businessId: string,
  startDate?: string,
  endDate?: string
): Promise<{
  success: boolean;
  data?: TableSalesAndTipsReport;
  error?: string;
}> {
  let auth = await verifyWorkspaceAction(businessId, "reports.view");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "sales.view");
  }
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "tables.view");
  }

  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No autorizado para consultar reportes." };
  }

  try {
    const data = await getTableSalesAndTipsReport(businessId, startDate, endDate);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al generar reporte de propinas." };
  }
}

