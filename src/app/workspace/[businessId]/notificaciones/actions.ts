"use server";

import { revalidatePath } from "next/cache";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  createOrderNotification,
} from "@/lib/notifications/notifications-service";
import { AppNotification, NotificationType } from "@/lib/notifications/types";
import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";

/**
 * 1. ACTION: Obtener notificaciones del negocio para el usuario actual
 */
export async function getWorkspaceNotificationsAction(
  businessId: string,
  options?: {
    limit?: number;
    unreadOnly?: boolean;
    type?: NotificationType;
  }
): Promise<{ success: boolean; data?: AppNotification[]; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "none");
    if (!auth.success || !auth.context) {
      return { success: false, error: auth.error || "No autorizado para consultar notificaciones." };
    }

    const notifications = await getNotifications({
      scope: "business",
      businessId,
      currentUserId: auth.context.userId,
      limit: options?.limit,
      unreadOnly: options?.unreadOnly,
      type: options?.type,
    });

    return { success: true, data: notifications };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al obtener notificaciones del comercio." };
  }
}

/**
 * 2. ACTION: Obtener el conteo de notificaciones no leídas
 */
export async function getWorkspaceUnreadCountAction(
  businessId: string
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "none");
    if (!auth.success || !auth.context) {
      return { success: false, error: auth.error || "No autorizado." };
    }

    const unread = await getNotifications({
      scope: "business",
      businessId,
      currentUserId: auth.context.userId,
      unreadOnly: true,
    });

    return { success: true, count: unread.length };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al obtener contador de no leídas." };
  }
}

/**
 * 3. ACTION: Marcar una notificación como leída
 */
export async function markWorkspaceNotificationAsReadAction(
  businessId: string,
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "none");
    if (!auth.success || !auth.context) {
      return { success: false, error: auth.error || "No autorizado para marcar la notificación." };
    }

    const updated = await markNotificationAsRead(notificationId, {
      scope: "business",
      businessId,
      currentUserId: auth.context.userId,
    });

    if (!updated) {
      return { success: false, error: "No se encontró la notificación o no tienes permiso para marcarla." };
    }

    revalidatePath(`/workspace/${businessId}/notificaciones`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al actualizar estado de la notificación." };
  }
}

/**
 * 4. ACTION: Marcar todas las notificaciones autorizadas del negocio como leídas
 */
export async function markAllWorkspaceNotificationsAsReadAction(
  businessId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "none");
    if (!auth.success || !auth.context) {
      return { success: false, error: auth.error || "No autorizado para actualizar notificaciones." };
    }

    const updated = await markAllNotificationsAsRead({
      scope: "business",
      businessId,
      currentUserId: auth.context.userId,
    });

    if (!updated) {
      return { success: false, error: "No fue posible marcar todas las notificaciones como leídas." };
    }

    revalidatePath(`/workspace/${businessId}/notificaciones`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al procesar la acción masiva." };
  }
}

/**
 * 5. ACTION: Eliminar una notificación del negocio
 */
export async function deleteWorkspaceNotificationAction(
  businessId: string,
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "none");
    if (!auth.success || !auth.context) {
      return { success: false, error: auth.error || "No autorizado para eliminar la notificación." };
    }

    const deleted = await deleteNotification(notificationId, {
      scope: "business",
      businessId,
      currentUserId: auth.context.userId,
    });

    if (!deleted) {
      return { success: false, error: "No se encontró la notificación o no tienes permiso para eliminarla." };
    }

    revalidatePath(`/workspace/${businessId}/notificaciones`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al eliminar la notificación." };
  }
}

/**
 * 6. ACTION: Sincronizar / persistir notificación de pedido detectado por Realtime
 */
export async function syncOrderNotificationAction(
  businessId: string,
  orderData: {
    orderId: string;
    orderNumber: number;
    orderType: string;
    customerName?: string | null;
    total: number;
  }
): Promise<{ success: boolean; notification?: AppNotification | null; error?: string }> {
  try {
    const auth = await verifyWorkspaceAction(businessId, "none");
    if (!auth.success || !auth.context) {
      return { success: false, error: "No autorizado." };
    }

    const notif = await createOrderNotification({
      businessId,
      orderId: orderData.orderId,
      orderNumber: orderData.orderNumber,
      orderType: orderData.orderType,
      customerName: orderData.customerName,
      total: orderData.total,
    });

    return { success: true, notification: notif };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al sincronizar notificación." };
  }
}

