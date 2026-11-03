"use server";

import { revalidatePath } from "next/cache";
import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import {
  getReservations,
  getReservationById,
  createReservation,
  updateReservation,
  assignReservationTable,
  updateReservationStatus,
  deleteReservation,
  getReservationMetrics,
} from "@/lib/reservations/reservations-service";
import { getRestaurantRooms, getRestaurantTablesWithOrders } from "@/lib/restaurant/restaurant-service";
import type {
  ReservationWithDetails,
  CreateReservationInput,
  UpdateReservationInput,
  AssignReservationTableInput,
  ReservationStatus,
  ReservationMetrics,
} from "@/lib/reservations/types";
import type { RestaurantRoom, RestaurantTableWithOrder } from "@/lib/restaurant/types";

/**
 * Server Action: Consulta reservas del negocio con filtros opcionales.
 */
export async function getReservationsAction(
  businessId: string,
  filters?: {
    date?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    roomId?: string;
    tableId?: string;
    search?: string;
  }
): Promise<{
  success: boolean;
  data?: ReservationWithDetails[];
  error?: string;
}> {
  try {
    let auth = await verifyWorkspaceAction(businessId, "orders.view");
    if (!auth.success) {
      auth = await verifyWorkspaceAction(businessId, "tables.view");
    }
    if (!auth.success) {
      return { success: false, error: auth.error || "No autorizado para consultar reservas." };
    }

    const data = await getReservations(businessId, filters);
    return { success: true, data };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Error al consultar las reservas.",
    };
  }
}

/**
 * Server Action: Consulta métricas y KPIs de reservas para un día específico.
 */
export async function getReservationMetricsAction(
  businessId: string,
  targetDate?: string
): Promise<{
  success: boolean;
  data?: ReservationMetrics;
  error?: string;
}> {
  try {
    let auth = await verifyWorkspaceAction(businessId, "orders.view");
    if (!auth.success) {
      auth = await verifyWorkspaceAction(businessId, "tables.view");
    }
    if (!auth.success) {
      return { success: false, error: auth.error || "No autorizado para consultar métricas." };
    }

    const data = await getReservationMetrics(businessId, targetDate);
    return { success: true, data };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Error al calcular métricas de reservas.",
    };
  }
}

/**
 * Server Action: Crea una nueva reserva.
 */
export async function createReservationAction(
  businessId: string,
  input: CreateReservationInput
): Promise<{
  success: boolean;
  data?: ReservationWithDetails;
  error?: string;
}> {
  try {
    let auth = await verifyWorkspaceAction(businessId, "orders.create");
    if (!auth.success) {
      auth = await verifyWorkspaceAction(businessId, "tables.manage");
    }
    if (!auth.success) {
      return { success: false, error: auth.error || "No tienes permisos para crear reservas." };
    }

    const created = await createReservation(businessId, input);
    revalidatePath(`/workspace/${businessId}/reservas`);
    revalidatePath(`/workspace/${businessId}/mesas`);

    return { success: true, data: created };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Error al crear la reserva.",
    };
  }
}

/**
 * Server Action: Modifica una reserva existente.
 */
export async function updateReservationAction(
  businessId: string,
  reservationId: string,
  input: UpdateReservationInput
): Promise<{
  success: boolean;
  data?: ReservationWithDetails;
  error?: string;
}> {
  try {
    let auth = await verifyWorkspaceAction(businessId, "orders.update");
    if (!auth.success) {
      auth = await verifyWorkspaceAction(businessId, "tables.manage");
    }
    if (!auth.success) {
      return { success: false, error: auth.error || "No tienes permisos para modificar reservas." };
    }

    const updated = await updateReservation(businessId, reservationId, input);
    revalidatePath(`/workspace/${businessId}/reservas`);
    revalidatePath(`/workspace/${businessId}/mesas`);

    return { success: true, data: updated };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Error al actualizar la reserva.",
    };
  }
}

/**
 * Server Action: Asigna una mesa a una reserva.
 */
export async function assignReservationTableAction(
  businessId: string,
  input: AssignReservationTableInput
): Promise<{
  success: boolean;
  data?: ReservationWithDetails;
  error?: string;
}> {
  try {
    let auth = await verifyWorkspaceAction(businessId, "orders.update");
    if (!auth.success) {
      auth = await verifyWorkspaceAction(businessId, "tables.manage");
    }
    if (!auth.success) {
      return { success: false, error: auth.error || "No tienes permisos para asignar mesas." };
    }

    const updated = await assignReservationTable(businessId, input);
    revalidatePath(`/workspace/${businessId}/reservas`);
    revalidatePath(`/workspace/${businessId}/mesas`);

    return { success: true, data: updated };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Error al asignar la mesa a la reserva.",
    };
  }
}

/**
 * Server Action: Actualiza el estado de una reserva (ej: checked_in, seated, cancelled, no_show).
 */
export async function updateReservationStatusAction(
  businessId: string,
  reservationId: string,
  status: ReservationStatus,
  tableId?: string | null
): Promise<{
  success: boolean;
  data?: ReservationWithDetails;
  error?: string;
}> {
  try {
    let auth = await verifyWorkspaceAction(businessId, "orders.update");
    if (!auth.success) {
      auth = await verifyWorkspaceAction(businessId, "tables.manage");
    }
    if (!auth.success) {
      return { success: false, error: auth.error || "No tienes permisos para cambiar el estado de la reserva." };
    }

    const updated = await updateReservationStatus(businessId, reservationId, status, tableId);
    revalidatePath(`/workspace/${businessId}/reservas`);
    revalidatePath(`/workspace/${businessId}/mesas`);

    return { success: true, data: updated };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Error al actualizar el estado de la reserva.",
    };
  }
}

/**
 * Server Action: Elimina o cancela una reserva.
 */
export async function deleteReservationAction(
  businessId: string,
  reservationId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    let auth = await verifyWorkspaceAction(businessId, "orders.cancel");
    if (!auth.success) {
      auth = await verifyWorkspaceAction(businessId, "tables.manage");
    }
    if (!auth.success) {
      return { success: false, error: auth.error || "No tienes permisos para eliminar reservas." };
    }

    await deleteReservation(businessId, reservationId);
    revalidatePath(`/workspace/${businessId}/reservas`);
    revalidatePath(`/workspace/${businessId}/mesas`);

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Error al eliminar la reserva.",
    };
  }
}

/**
 * Server Action: Obtiene las salas y mesas del restaurante para los modales de reserva y asignación.
 */
export async function getRestaurantRoomsAndTablesAction(businessId: string): Promise<{
  success: boolean;
  rooms: RestaurantRoom[];
  tables: RestaurantTableWithOrder[];
  error?: string;
}> {
  try {
    const [rooms, tablesRes] = await Promise.all([
      getRestaurantRooms(businessId),
      getRestaurantTablesWithOrders(businessId),
    ]);

    return {
      success: true,
      rooms,
      tables: tablesRes,
    };
  } catch (err: any) {
    return {
      success: false,
      rooms: [],
      tables: [],
      error: err.message || "Error al cargar salas y mesas.",
    };
  }
}
