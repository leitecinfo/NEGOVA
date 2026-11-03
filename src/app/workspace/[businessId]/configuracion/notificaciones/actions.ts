"use server";

import { revalidatePath } from "next/cache";
import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import { logAuditAction } from "@/lib/audit/audit-service";
import {
  getNotificationSettings,
  saveNotificationSettings,
  resetNotificationEventToDefault,
} from "@/lib/notifications/notification-settings-service";
import {
  NotificationSettings,
  NotificationEventConfig,
  NotificationEventId,
} from "@/lib/notifications/types";

/**
 * Server Action: Consulta la configuración de notificaciones del comercio [CONF-003].
 */
export async function getNotificationSettingsAction(
  businessId: string
): Promise<{ success: boolean; data?: NotificationSettings; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "business_settings.view");
  if (!auth.success) {
    return { success: false, error: auth.error || "No autorizado para consultar la configuración de notificaciones." };
  }

  try {
    const data = await getNotificationSettings(businessId);
    return { success: true, data };
  } catch (err: any) {
    console.error("[getNotificationSettingsAction] Error:", err);
    return { success: false, error: err?.message || "Error al obtener la configuración de notificaciones." };
  }
}

/**
 * Server Action: Actualiza un evento de notificación específico (activar/desactivar, canales, plantilla) [CONF-003].
 */
export async function updateNotificationEventAction(
  businessId: string,
  eventId: NotificationEventId,
  eventConfig: Partial<NotificationEventConfig>
): Promise<{ success: boolean; data?: NotificationEventConfig; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "business_settings.update");
  if (!auth.success) {
    return { success: false, error: auth.error || "No autorizado para modificar la configuración de notificaciones." };
  }

  try {
    const current = await getNotificationSettings(businessId);
    const existingEvt = current.events[eventId];

    if (!existingEvt) {
      return { success: false, error: `Evento de notificación ${eventId} no encontrado.` };
    }

    const mergedEvt: NotificationEventConfig = {
      ...existingEvt,
      ...eventConfig,
      channels: {
        whatsapp: {
          ...existingEvt.channels.whatsapp,
          ...(eventConfig.channels?.whatsapp || {}),
        },
        email: {
          ...existingEvt.channels.email,
          ...(eventConfig.channels?.email || {}),
        },
        push: {
          ...existingEvt.channels.push,
          ...(eventConfig.channels?.push || {}),
        },
      },
      availableVariables: existingEvt.availableVariables,
    };

    const updatedEvents = {
      ...current.events,
      [eventId]: mergedEvt,
    };

    const res = await saveNotificationSettings(businessId, { events: updatedEvents });
    if (!res.success) {
      return { success: false, error: res.error || "No se pudo actualizar el evento." };
    }

    // Auditoría
    try {
      await logAuditAction({
        userId: auth.context?.userId,
        action: "update",
        entityType: "notification_settings",
        entityId: eventId,
        businessId,
        businessName: auth.context?.businessName,
        metadata: {
          eventId,
          enabled: mergedEvt.enabled,
          whatsappEnabled: mergedEvt.channels.whatsapp.enabled,
          emailEnabled: mergedEvt.channels.email.enabled,
          pushEnabled: mergedEvt.channels.push.enabled,
        },
      });
    } catch {
      // Non-blocking
    }

    revalidatePath(`/workspace/${businessId}/configuracion/notificaciones`);
    return { success: true, data: mergedEvt };
  } catch (err: any) {
    console.error("[updateNotificationEventAction] Error:", err);
    return { success: false, error: err?.message || "Error al actualizar el evento de notificación." };
  }
}

/**
 * Server Action: Guarda la configuración completa de notificaciones del comercio [CONF-003].
 */
export async function saveAllNotificationSettingsAction(
  businessId: string,
  settings: Partial<NotificationSettings>
): Promise<{ success: boolean; data?: NotificationSettings; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "business_settings.update");
  if (!auth.success) {
    return { success: false, error: auth.error || "No autorizado para guardar la configuración de notificaciones." };
  }

  try {
    const res = await saveNotificationSettings(businessId, settings);
    if (!res.success || !res.settings) {
      return { success: false, error: res.error || "No se pudo guardar la configuración." };
    }

    // Auditoría
    try {
      await logAuditAction({
        userId: auth.context?.userId,
        action: "update",
        entityType: "notification_settings",
        entityId: businessId,
        businessId,
        businessName: auth.context?.businessName,
        metadata: {
          generalWhatsAppEnabled: res.settings.generalWhatsAppEnabled,
          generalEmailEnabled: res.settings.generalEmailEnabled,
          generalPushEnabled: res.settings.generalPushEnabled,
          eventsCount: Object.keys(res.settings.events).length,
        },
      });
    } catch {
      // Non-blocking
    }

    revalidatePath(`/workspace/${businessId}/configuracion/notificaciones`);
    return { success: true, data: res.settings };
  } catch (err: any) {
    console.error("[saveAllNotificationSettingsAction] Error:", err);
    return { success: false, error: err?.message || "Error al guardar la configuración de notificaciones." };
  }
}

/**
 * Server Action: Restaura la plantilla y configuración de un evento a los valores de fábrica [CONF-003].
 */
export async function resetNotificationEventAction(
  businessId: string,
  eventId: NotificationEventId
): Promise<{ success: boolean; data?: NotificationEventConfig; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "business_settings.update");
  if (!auth.success) {
    return { success: false, error: auth.error || "No autorizado para restablecer plantillas." };
  }

  try {
    const res = await resetNotificationEventToDefault(businessId, eventId);
    if (!res.success || !res.eventConfig) {
      return { success: false, error: res.error || "No fue posible restablecer el evento." };
    }

    revalidatePath(`/workspace/${businessId}/configuracion/notificaciones`);
    return { success: true, data: res.eventConfig };
  } catch (err: any) {
    console.error("[resetNotificationEventAction] Error:", err);
    return { success: false, error: err?.message || "Error al restablecer la plantilla." };
  }
}
