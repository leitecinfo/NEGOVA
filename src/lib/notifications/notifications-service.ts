/**
 * Servicio Centralizado y Transversal de Notificaciones de NEGOVA
 * 
 * Soporta dos ámbitos (scopes):
 * 1. scope = "platform" -> Notificaciones internas para el equipo de NEGOVA (admin/super_admin).
 * 2. scope = "business" -> Notificaciones de Workspace de comercios clientes (bound to businessId).
 * 
 * Soporta dos destinatarios (audiences):
 * 1. audience = "global" -> Visible para todos los usuarios autorizados del ámbito correspondiente.
 * 2. audience = "user" -> Visible únicamente para el usuario específico (`recipientUserId`).
 */

import { createClient } from "@/lib/supabase/server";
import {
  AppNotification,
  PlatformNotification,
  NotificationScope,
  NotificationAudience,
  NotificationType,
  NotificationFilterOptions,
} from "./types";

export type {
  AppNotification,
  PlatformNotification,
  NotificationScope,
  NotificationAudience,
  NotificationType,
  NotificationFilterOptions,
};

const SETTINGS_NOTIFS_KEY = "platform:notifications_store";

// Respaldo en memoria persistente durante la ejecución del proceso
const IN_MEMORY_NOTIFICATIONS: AppNotification[] = [
  {
    id: "notif-init-1",
    scope: "platform",
    audience: "global",
    recipientUserId: null,
    businessId: null,
    type: "system",
    title: "Plataforma NEGOVA lista",
    message: "El sistema de auditoría, soporte y notificaciones está activo y supervisando eventos.",
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    read: false,
    isRead: false,
    entityType: "system",
    entityId: null,
    entityNumber: null,
    href: "/admin",
    link: "/admin",
    metadata: {},
  },
];

/**
 * Obtener cliente admin de Supabase con bypass RLS
 */
async function getAdminSupabaseClient() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    return createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return await createClient();
}

/**
 * Función auxiliar para entornos de pruebas
 */
export function _resetNotificationsStoreForTesting(initial?: AppNotification[]) {
  IN_MEMORY_NOTIFICATIONS.length = 0;
  if (initial && initial.length > 0) {
    IN_MEMORY_NOTIFICATIONS.push(...initial);
  }
}

/**
 * 1. CREAR NOTIFICACIÓN UNIVERSAL (Transversal)
 */
export async function createNotification(input: {
  scope: NotificationScope;
  audience: NotificationAudience;
  recipientUserId?: string | null;
  businessId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  entityNumber?: string | null;
  href?: string | null;
  link?: string | null;
  metadata?: Record<string, any>;
}): Promise<AppNotification> {
  const targetHref = input.href || input.link || null;
  const nowIso = new Date().toISOString();

  const newNotif: AppNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    scope: input.scope,
    audience: input.audience,
    recipientUserId: input.audience === "user" ? input.recipientUserId || null : null,
    businessId: input.scope === "business" ? input.businessId || null : null,
    type: input.type,
    title: input.title.trim(),
    message: input.message.trim(),
    createdAt: nowIso,
    read: false,
    isRead: false,
    entityType: input.entityType || null,
    entityId: input.entityId || null,
    entityNumber: input.entityNumber || null,
    href: targetHref,
    link: targetHref,
    metadata: input.metadata || {},
  };

  // 1. Guardar en memoria
  IN_MEMORY_NOTIFICATIONS.unshift(newNotif);
  if (IN_MEMORY_NOTIFICATIONS.length > 100) {
    IN_MEMORY_NOTIFICATIONS.pop();
  }

  // 2. Intentar guardar en Supabase (si existe tabla o en platform_settings)
  try {
    const supabase = await getAdminSupabaseClient();
    await supabase.from("platform_notifications").insert({
      id: newNotif.id,
      scope: newNotif.scope,
      audience: newNotif.audience,
      recipient_user_id: newNotif.recipientUserId,
      business_id: newNotif.businessId,
      type: newNotif.type,
      title: newNotif.title,
      message: newNotif.message,
      link: newNotif.href,
      metadata: {
        ...newNotif.metadata,
        entityType: newNotif.entityType,
        entityId: newNotif.entityId,
        entityNumber: newNotif.entityNumber,
      },
      is_read: false,
      created_at: newNotif.createdAt,
    });
  } catch {
    // Si la tabla no está creada, el respaldo en memoria garantiza el funcionamiento
  }

  return newNotif;
}

/**
 * Wrapper de compatibilidad hacia atrás para llamadas legacy
 */
export async function createPlatformNotification(input: {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
}): Promise<AppNotification> {
  return createNotification({
    scope: "platform",
    audience: "global",
    type: input.type,
    title: input.title,
    message: input.message,
    href: input.link,
    link: input.link,
    metadata: input.metadata,
  });
}

/**
 * 2. OBTENER NOTIFICACIONES CON REGLA DE AUDIENCIA ESTRICTA
 */
export async function getNotifications(
  options: NotificationFilterOptions = {}
): Promise<AppNotification[]> {
  const targetScope = options.scope || "platform";
  let pool = [...IN_MEMORY_NOTIFICATIONS];

  // 1. Intentar leer desde BD si está disponible
  try {
    const supabase = await getAdminSupabaseClient();
    let query = supabase
      .from("platform_notifications")
      .select("*")
      .order("created_at", { ascending: false });

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      pool = data.map((row: any) => ({
        id: row.id,
        scope: (row.scope as NotificationScope) || "platform",
        audience: (row.audience as NotificationAudience) || "global",
        recipientUserId: row.recipient_user_id || null,
        businessId: row.business_id || null,
        type: row.type as NotificationType,
        title: row.title,
        message: row.message,
        createdAt: row.created_at,
        read: Boolean(row.is_read),
        isRead: Boolean(row.is_read),
        entityType: row.metadata?.entityType || null,
        entityId: row.metadata?.entityId || null,
        entityNumber: row.metadata?.entityNumber || null,
        href: row.link || null,
        link: row.link || null,
        metadata: row.metadata || {},
      }));
    }
  } catch {
    // Fallback a memoria
  }

  // 2. Aplicar filtro estricto de Scope
  let filtered = pool.filter((n) => n.scope === targetScope);

  // 3. Si es de ámbito Business, filtrar estrictamente por businessId
  if (targetScope === "business") {
    if (!options.businessId) {
      return []; // Un usuario de workspace no puede ver notificaciones sin businessId
    }
    filtered = filtered.filter((n) => n.businessId === options.businessId);
  }

  // 4. Aplicar regla de Audiencia (Global vs User-targeted)
  if (options.currentUserId) {
    filtered = filtered.filter(
      (n) =>
        n.audience === "global" ||
        (n.audience === "user" && n.recipientUserId === options.currentUserId)
    );
  }

  // 5. Filtro de no leídas
  if (options.unreadOnly) {
    filtered = filtered.filter((n) => !n.read && !n.isRead);
  }

  // 6. Filtro por tipo
  if (options.type) {
    filtered = filtered.filter((n) => n.type === options.type);
  }

  // 7. Límite
  if (options.limit && options.limit > 0) {
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}

/**
 * Wrapper de compatibilidad hacia atrás
 */
export async function getPlatformNotifications(options?: {
  limit?: number;
  unreadOnly?: boolean;
  currentUserId?: string;
}): Promise<PlatformNotification[]> {
  return getNotifications({
    scope: "platform",
    limit: options?.limit,
    unreadOnly: options?.unreadOnly,
    currentUserId: options?.currentUserId,
    isPlatformUser: true,
  });
}

/**
 * 3. MARCAR NOTIFICACIÓN COMO LEÍDA
 */
export async function markNotificationAsRead(id: string): Promise<boolean> {
  const memNotif = IN_MEMORY_NOTIFICATIONS.find((n) => n.id === id);
  if (memNotif) {
    memNotif.read = true;
    memNotif.isRead = true;
  }

  try {
    const supabase = await getAdminSupabaseClient();
    await supabase.from("platform_notifications").update({ is_read: true }).eq("id", id);
  } catch {
    // Ignorar si no existe tabla
  }

  return true;
}

/**
 * 4. MARCAR TODAS LAS NOTIFICACIONES COMO LEÍDAS
 */
export async function markAllNotificationsAsRead(options?: {
  scope?: NotificationScope;
  currentUserId?: string;
  businessId?: string;
}): Promise<boolean> {
  const targetScope = options?.scope || "platform";

  IN_MEMORY_NOTIFICATIONS.forEach((n) => {
    if (n.scope === targetScope) {
      if (!options?.currentUserId || n.audience === "global" || n.recipientUserId === options.currentUserId) {
        if (targetScope !== "business" || n.businessId === options?.businessId) {
          n.read = true;
          n.isRead = true;
        }
      }
    }
  });

  try {
    const supabase = await getAdminSupabaseClient();
    await supabase.from("platform_notifications").update({ is_read: true }).eq("is_read", false);
  } catch {
    // Ignorar si no existe tabla
  }

  return true;
}
