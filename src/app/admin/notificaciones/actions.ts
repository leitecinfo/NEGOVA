"use server";

import { revalidatePath } from "next/cache";
import {
  getPlatformNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  createPlatformNotification,
  PlatformNotification,
} from "@/lib/notifications/notifications-service";

/**
 * 1. ACTION: Obtener notificaciones
 */
export async function getNotificationsAction(options?: {
  limit?: number;
  unreadOnly?: boolean;
}): Promise<{ success: boolean; data?: PlatformNotification[]; error?: string }> {
  try {
    const notifications = await getPlatformNotifications(options);
    return { success: true, data: notifications };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al obtener notificaciones." };
  }
}

/**
 * 2. ACTION: Marcar una como leída
 */
export async function markNotificationAsReadAction(id: string): Promise<{ success: boolean }> {
  try {
    await markNotificationAsRead(id);
    revalidatePath("/admin/notificaciones");
    return { success: true };
  } catch {
    return { success: false };
  }
}

/**
 * 3. ACTION: Marcar todas como leídas
 */
export async function markAllNotificationsAsReadAction(): Promise<{ success: boolean }> {
  try {
    await markAllNotificationsAsRead();
    revalidatePath("/admin/notificaciones");
    return { success: true };
  } catch {
    return { success: false };
  }
}
