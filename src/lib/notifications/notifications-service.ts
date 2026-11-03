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

// Dynamic import of createClient inside getAdminSupabaseClient to avoid next/headers leakage
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
  const { createClient } = await import("@/lib/supabase/server");
  return await createClient();
}

const IS_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(val?: string | null): boolean {
  return typeof val === "string" && IS_UUID_REGEX.test(val);
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

  const recipientUserId =
    input.audience === "user" && isValidUuid(input.recipientUserId)
      ? input.recipientUserId || null
      : null;

  const businessId =
    input.scope === "business" && isValidUuid(input.businessId)
      ? input.businessId || null
      : null;

  const newNotif: AppNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    scope: input.scope,
    audience: input.audience,
    recipientUserId,
    businessId,
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

  try {
    const supabase = await getAdminSupabaseClient();
    const { error } = await supabase.from("platform_notifications").insert({
      id: newNotif.id,
      scope: newNotif.scope,
      audience: newNotif.audience,
      recipient_user_id: newNotif.recipientUserId,
      business_id: newNotif.businessId,
      type: newNotif.type,
      title: newNotif.title,
      message: newNotif.message,
      link: newNotif.href,
      entity_type: newNotif.entityType,
      entity_id: newNotif.entityId,
      entity_number: newNotif.entityNumber,
      metadata: {
        ...newNotif.metadata,
        entityType: newNotif.entityType,
        entityId: newNotif.entityId,
        entityNumber: newNotif.entityNumber,
      },
      is_read: false,
      created_at: newNotif.createdAt,
    });
    
    if (error) throw error;
  } catch (err: any) {
    console.error("[NotificationsService Error] No se pudo guardar la notificación:", err);
    throw new Error(err.message || "Error al crear la notificación en la base de datos.");
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
 * 2. OBTENER NOTIFICACIONES CON REGLA DE AUDIENCIA Y AISLAMIENTO ESTRICTO
 */
export async function getNotifications(
  options: NotificationFilterOptions = {}
): Promise<AppNotification[]> {
  const targetScope = options.scope || "platform";

  // Regla de aislamiento: un usuario de workspace no puede ver notificaciones sin businessId
  if (targetScope === "business" && !options.businessId) {
    return [];
  }

  try {
    const supabase = await getAdminSupabaseClient();
    let query = supabase
      .from("platform_notifications")
      .select("*")
      .eq("scope", targetScope)
      .order("created_at", { ascending: false });

    // Filtrado por business_id
    if (targetScope === "business") {
      if (options.businessId && isValidUuid(options.businessId)) {
        query = query.eq("business_id", options.businessId);
      } else {
        return [];
      }
    }

    // Filtrado por audiencia / usuario
    if (options.currentUserId && isValidUuid(options.currentUserId)) {
      query = query.or(`audience.eq.global,and(audience.eq.user,recipient_user_id.eq.${options.currentUserId})`);
    } else {
      query = query.eq("audience", "global");
    }

    // Filtrado por no leídas
    if (options.unreadOnly) {
      query = query.eq("is_read", false);
    }

    // Filtrado por tipo
    if (options.type) {
      query = query.eq("type", options.type);
    }

    // Límite
    if (options.limit && options.limit > 0) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      return data.map((row: any) => ({
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
        entityType: row.entity_type || row.metadata?.entityType || null,
        entityId: row.entity_id || row.metadata?.entityId || null,
        entityNumber: row.entity_number || row.metadata?.entityNumber || null,
        href: row.link || null,
        link: row.link || null,
        metadata: row.metadata || {},
      }));
    }
    return [];
  } catch (err: any) {
    console.error("[NotificationsService Error] No se pudo obtener notificaciones:", err);
    throw new Error(err?.message || "Error al consultar las notificaciones desde la base de datos.");
  }
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
 * 3. MARCAR NOTIFICACIÓN COMO LEÍDA CON AISLAMIENTO DE CONTEXTO
 */
export async function markNotificationAsRead(
  id: string,
  options?: {
    scope?: NotificationScope;
    businessId?: string;
    currentUserId?: string;
  }
): Promise<boolean> {
  try {
    const supabase = await getAdminSupabaseClient();
    let query = supabase.from("platform_notifications").update({ is_read: true }).eq("id", id);
    
    if (options?.scope) {
      query = query.eq("scope", options.scope);
    }
    
    if (options?.scope === "business") {
      if (!options.businessId) {
        console.error("[NotificationsService Error] businessId requerido para scope business");
        return false;
      }
      query = query.eq("business_id", options.businessId);
    }
    
    if (options?.currentUserId && isValidUuid(options.currentUserId)) {
      query = query.or(`audience.eq.global,and(audience.eq.user,recipient_user_id.eq.${options.currentUserId})`);
    }

    const { data, error } = await query.select("id");
    if (error) throw error;
    return Boolean(data && data.length > 0);
  } catch (err: any) {
    console.error("[NotificationsService Error] Error al marcar como leída:", err);
    return false;
  }
}

/**
 * 4. MARCAR TODAS LAS NOTIFICACIONES COMO LEÍDAS CON AISLAMIENTO
 */
export async function markAllNotificationsAsRead(options?: {
  scope?: NotificationScope;
  currentUserId?: string;
  businessId?: string;
}): Promise<boolean> {
  const targetScope = options?.scope || "platform";

  if (targetScope === "business" && !options?.businessId) {
    console.error("[NotificationsService Error] businessId requerido para scope business");
    return false;
  }

  try {
    const supabase = await getAdminSupabaseClient();
    
    let query = supabase
      .from("platform_notifications")
      .update({ is_read: true })
      .eq("is_read", false)
      .eq("scope", targetScope);
      
    // Acotar según las reglas requeridas
    if (targetScope === "business" && options?.businessId) {
      query = query.eq("business_id", options.businessId);
    }
    
    if (options?.currentUserId && isValidUuid(options.currentUserId)) {
      query = query.or(`audience.eq.global,and(audience.eq.user,recipient_user_id.eq.${options.currentUserId})`);
    }

    const { error } = await query;
    if (error) throw error;
    return true;
  } catch (err: any) {
    console.error("[NotificationsService Error] Error al marcar todas como leídas:", err);
    return false;
  }
}

/**
 * 5. CREAR NOTIFICACIÓN DE NUEVO PEDIDO CON IDEMPOTENCIA ESTRICTA
 */
export async function createOrderNotification(order: {
  businessId: string;
  orderId: string;
  orderNumber: number;
  orderType: string;
  customerName?: string | null;
  total: number;
}): Promise<AppNotification | null> {
  if (!order.businessId || !order.orderId) return null;

  try {
    const supabase = await getAdminSupabaseClient();

    // Idempotencia: Verificar si ya existe una notificación para este pedido
    const { data: existing } = await supabase
      .from("platform_notifications")
      .select("id")
      .eq("business_id", order.businessId)
      .eq("entity_type", "restaurant_order")
      .eq("entity_id", order.orderId)
      .limit(1);

    if (existing && existing.length > 0) {
      return null;
    }

    const orderNumberFormatted = `#${order.orderNumber}`;
    const formattedTotal = `$${Number(order.total || 0).toLocaleString("es-CO")}`;

    let title = `Nuevo pedido ${orderNumberFormatted}`;
    let message = "";

    switch (order.orderType) {
      case "dine_in":
        title = `Nuevo pedido en mesa ${orderNumberFormatted}`;
        message = `Consumo en el establecimiento. Total: ${formattedTotal}`;
        break;
      case "takeout":
        title = `Nuevo pedido para llevar ${orderNumberFormatted}`;
        message = `Pedido para recoger${order.customerName ? ` de ${order.customerName}` : ""}. Total: ${formattedTotal}`;
        break;
      case "delivery":
        title = `Nuevo pedido a domicilio ${orderNumberFormatted}`;
        message = `Pedido para entrega a domicilio${order.customerName ? ` para ${order.customerName}` : ""}. Total: ${formattedTotal}`;
        break;
      default:
        message = `Nuevo pedido recibido. Total: ${formattedTotal}`;
        break;
    }

    const notif = await createNotification({
      scope: "business",
      audience: "global",
      businessId: order.businessId,
      type: "restaurant_order",
      title,
      message,
      entityType: "restaurant_order",
      entityId: order.orderId,
      entityNumber: orderNumberFormatted,
      href: `/workspace/${order.businessId}/pedidos/${order.orderId}`,
      link: `/workspace/${order.businessId}/pedidos/${order.orderId}`,
      metadata: {
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        orderType: order.orderType,
        customerName: order.customerName || null,
        total: order.total,
        entityType: "restaurant_order",
        entityId: order.orderId,
        entityNumber: orderNumberFormatted,
      },
    });

    return notif;
  } catch (err: any) {
    console.error("[NotificationsService Error] Error al crear notificación de pedido:", err);
    return null;
  }
}

/**
 * 6. ELIMINAR NOTIFICACIÓN CON AISLAMIENTO DE NEGOCIO
 */
export async function deleteNotification(
  id: string,
  options?: {
    scope?: NotificationScope;
    businessId?: string;
    currentUserId?: string;
  }
): Promise<boolean> {
  const targetScope = options?.scope || "platform";

  if (targetScope === "business" && !options?.businessId) {
    console.error("[NotificationsService Error] businessId requerido para scope business");
    return false;
  }

  try {
    const supabase = await getAdminSupabaseClient();
    let query = supabase
      .from("platform_notifications")
      .delete()
      .eq("id", id)
      .eq("scope", targetScope);

    if (targetScope === "business" && options?.businessId) {
      query = query.eq("business_id", options.businessId);
    }

    if (options?.currentUserId && isValidUuid(options.currentUserId)) {
      query = query.or(`audience.eq.global,and(audience.eq.user,recipient_user_id.eq.${options.currentUserId})`);
    }

    const { error } = await query;
    if (error) throw error;
    return true;
  } catch (err: any) {
    console.error("[NotificationsService Error] Error al eliminar notificación:", err);
    return false;
  }
}
