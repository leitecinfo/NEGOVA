/**
 * SERVICIO DE CONFIGURACIÓN Y GESTIÓN DE PLANTILLAS DE NOTIFICACIÓN [CONF-003]
 * 
 * Reglas de Arquitectura:
 * - Aislamiento multi-tenant estricto por `business_id`.
 * - Persistencia de configuración en `businesses.settings.notifications`.
 * - Plantillas profesionales por defecto para eventos críticos (QR, Domicilios, Stock, Caja, Cartera).
 * - Interpolación dinámica de variables y previsualización en tiempo real.
 */

// Dynamic import of createClient inside server methods to avoid pulling next/headers into client bundles
import {
  NotificationSettings,
  NotificationEventConfig,
  NotificationEventId,
} from "./types";
import { renderTemplatePreview } from "./template-preview";

export { renderTemplatePreview };

export const DEFAULT_NOTIFICATION_EVENTS: Record<NotificationEventId, NotificationEventConfig> = {
  qr_order_created: {
    id: "qr_order_created",
    name: "Nuevo pedido de menú QR",
    description: "Se dispara en tiempo real cuando un comensal o mesa confirma un pedido desde el menú QR digital.",
    category: "pedidos",
    enabled: true,
    notifyCustomer: true,
    recipientRoles: ["owner", "admin", "waiter", "kitchen"],
    channels: {
      whatsapp: {
        enabled: true,
        template: "👋 ¡Hola {cliente}! Hemos recibido tu pedido #{orden} en {negocio} por un total de {total}.\n\n📋 *Detalle del pedido:*\n{productos}\n\n📍 Mesa: {mesa}\n⏱️ Ya estamos preparando tus platos con el mayor esmero. ¡Muchas gracias por tu visita!",
      },
      email: {
        enabled: true,
        subject: "Nuevo pedido #{orden} recibido - {negocio}",
        template: "Hola {cliente},\n\nConfirmamos la recepción de tu orden #{orden} en {negocio}.\n\nMesa: {mesa}\nTotal: {total}\nFecha: {fecha}\n\nDetalle:\n{productos}\n\nGracias por tu preferencia.",
      },
      push: {
        enabled: true,
        template: "Nuevo pedido #{orden} ({mesa}) de {cliente} por {total}.",
      },
    },
    availableVariables: [
      { tag: "{cliente}", description: "Nombre del cliente", sampleValue: "Alejandro Restrepo" },
      { tag: "{negocio}", description: "Nombre comercial del negocio", sampleValue: "Restaurante Gourmet" },
      { tag: "{orden}", description: "Número de orden o comanda", sampleValue: "ORD-1042" },
      { tag: "{total}", description: "Monto total del pedido formateado", sampleValue: "$45.000" },
      { tag: "{productos}", description: "Lista resumida de productos", sampleValue: "1x Hamburguesa Especial, 1x Papas Rústicas, 1x Limonada" },
      { tag: "{mesa}", description: "Nombre o número de mesa", sampleValue: "Mesa 4" },
      { tag: "{fecha}", description: "Fecha y hora del pedido", sampleValue: "01 Nov, 12:45 PM" },
    ],
  },

  delivery_status_changed: {
    id: "delivery_status_changed",
    name: "Pedido de domicilio en camino / entregado",
    description: "Notifica al cliente y al equipo cuando un domicilio es aceptado, despachado en camino o completado.",
    category: "domicilios",
    enabled: true,
    notifyCustomer: true,
    recipientRoles: ["owner", "admin", "driver", "cashier"],
    channels: {
      whatsapp: {
        enabled: true,
        template: "🛵 ¡Tu pedido #{orden} está {estado}! Repartidor: {repartidor}.\n\n🏠 Dirección de entrega: {direccion}\n⏱️ Tiempo estimado: {tiempo_estimado}\n\nSigue tu pedido en vivo aquí:\n{tracking_link}\n\n¡Gracias por elegir {negocio}!",
      },
      email: {
        enabled: true,
        subject: "Tu pedido #{orden} está {estado} - {negocio}",
        template: "Hola {cliente},\n\nTu domicilio #{orden} se encuentra {estado}.\nRepartidor asignado: {repartidor}\nDirección: {direccion}\nTiempo estimado: {tiempo_estimado}\n\nEnlace de seguimiento: {tracking_link}",
      },
      push: {
        enabled: true,
        template: "Domicilio #{orden} ({cliente}) está {estado}.",
      },
    },
    availableVariables: [
      { tag: "{cliente}", description: "Nombre del cliente", sampleValue: "Carolina Gómez" },
      { tag: "{negocio}", description: "Nombre comercial del negocio", sampleValue: "Restaurante Gourmet" },
      { tag: "{orden}", description: "Número del pedido", sampleValue: "DOM-028" },
      { tag: "{estado}", description: "Estado actual (Aceptado, En camino, Entregado)", sampleValue: "en camino" },
      { tag: "{repartidor}", description: "Nombre del repartidor", sampleValue: "Carlos Repartidor" },
      { tag: "{tiempo_estimado}", description: "Tiempo estimado de entrega", sampleValue: "25-35 min" },
      { tag: "{direccion}", description: "Dirección de destino", sampleValue: "Cra 43A # 12-40" },
      { tag: "{tracking_link}", description: "Enlace web de seguimiento", sampleValue: "https://negova.com/seguimiento/TRK-98214" },
      { tag: "{total}", description: "Valor total del pedido", sampleValue: "$38.500" },
    ],
  },

  low_stock_reached: {
    id: "low_stock_reached",
    name: "Stock bajo alcanzado",
    description: "Alerta crítica cuando las existencias de un insumo o producto caen por debajo del nivel mínimo establecido.",
    category: "inventario",
    enabled: true,
    notifyCustomer: false,
    recipientRoles: ["owner", "admin"],
    channels: {
      whatsapp: {
        enabled: true,
        template: "⚠️ *ALERTA DE STOCK BAJO* en {negocio}:\n\nEl producto/insumo *{producto}* ha alcanzado su nivel crítico.\n\n📦 Stock actual: {stock_actual} {unidad}\n📉 Mínimo requerido: {stock_minimo} {unidad}\n📍 Almacén: {ubicacion}\n\nSe recomienda emitir orden de compra para reabastecimiento.",
      },
      email: {
        enabled: true,
        subject: "Alerta de Stock Crítico: {producto} - {negocio}",
        template: "Estimado equipo,\n\nLe informamos que el insumo o producto {producto} ha caído por debajo de su umbral mínimo de seguridad en {negocio}.\n\nStock actual: {stock_actual} {unidad}\nStock mínimo: {stock_minimo} {unidad}\nUbicación: {ubicacion}\n\nPor favor revise el módulo de compras e inventario.",
      },
      push: {
        enabled: true,
        template: "Stock bajo: {producto} ({stock_actual} / {stock_minimo}).",
      },
    },
    availableVariables: [
      { tag: "{negocio}", description: "Nombre comercial del negocio", sampleValue: "Restaurante Gourmet" },
      { tag: "{producto}", description: "Nombre del insumo o producto", sampleValue: "Carne de Res Molida" },
      { tag: "{stock_actual}", description: "Cantidad física disponible", sampleValue: "1.5" },
      { tag: "{stock_minimo}", description: "Cantidad mínima requerida", sampleValue: "5.0" },
      { tag: "{unidad}", description: "Unidad de medida", sampleValue: "kg" },
      { tag: "{ubicacion}", description: "Almacén o ubicación física", sampleValue: "Cocina Principal" },
    ],
  },

  cash_shift_closed: {
    id: "cash_shift_closed",
    name: "Turno de caja cerrado",
    description: "Resumen de arqueo y balance de caja al finalizar el turno o jornada operativa.",
    category: "caja",
    enabled: true,
    notifyCustomer: false,
    recipientRoles: ["owner", "admin"],
    channels: {
      whatsapp: {
        enabled: true,
        template: "🔒 *CIERRE DE CAJA #{caja}* en {negocio}\n\n👤 Cajero: {cajero}\n📅 Fecha de cierre: {fecha_cierre}\n\n💵 Esperado en sistema: {monto_esperado}\n🪙 Total contado: {monto_real}\n📊 Diferencia: {diferencia}\n\nTotal ventas en turno: {total_ventas}.",
      },
      email: {
        enabled: true,
        subject: "Cierre de Turno de Caja #{caja} - {negocio}",
        template: "Reporte de Cierre de Caja #{caja}\nNegocio: {negocio}\nCajero: {cajero}\nFecha: {fecha_cierre}\n\nEsperado: {monto_esperado}\nArqueo Real: {monto_real}\nDiferencia: {diferencia}\nTotal Ventas: {total_ventas}",
      },
      push: {
        enabled: true,
        template: "Cierre de caja #{caja} por {cajero}. Diferencia: {diferencia}.",
      },
    },
    availableVariables: [
      { tag: "{negocio}", description: "Nombre comercial del negocio", sampleValue: "Restaurante Gourmet" },
      { tag: "{caja}", description: "Nombre o número de caja", sampleValue: "Caja 1 - Principal" },
      { tag: "{cajero}", description: "Nombre del cajero responsable", sampleValue: "Mariana López" },
      { tag: "{fecha_cierre}", description: "Hora y fecha de cierre", sampleValue: "01 Nov, 10:30 PM" },
      { tag: "{monto_esperado}", description: "Dinero esperado según sistema", sampleValue: "$850.000" },
      { tag: "{monto_real}", description: "Dinero físico contado", sampleValue: "$850.000" },
      { tag: "{diferencia}", description: "Diferencia o descuadre", sampleValue: "$0" },
      { tag: "{total_ventas}", description: "Monto total de ventas", sampleValue: "$1.420.000" },
    ],
  },

  account_receivable_overdue: {
    id: "account_receivable_overdue",
    name: "Cuenta por cobrar vencida",
    description: "Alerta de cartera cuando un crédito otorgado a un cliente supera la fecha límite acordada.",
    category: "cartera",
    enabled: true,
    notifyCustomer: true,
    recipientRoles: ["owner", "admin", "cashier"],
    channels: {
      whatsapp: {
        enabled: true,
        template: "Estimado/a {cliente}, le saludamos cordialmente de {negocio}.\n\nLe recordamos amablemente que la factura #{factura} por saldo de *{saldo_pendiente}* venció el día {fecha_vencimiento} ({dias_vencido} días en mora).\n\nAgradecemos regularizar su pago a la brevedad. Cualquier duda estamos a su servicio.",
      },
      email: {
        enabled: true,
        subject: "Recordatorio de saldo pendiente Factura #{factura} - {negocio}",
        template: "Estimado/a {cliente},\n\nLe informamos que la factura #{factura} emitida por {negocio} por valor de {saldo_pendiente} presenta un retraso de {dias_vencido} días desde su fecha de vencimiento ({fecha_vencimiento}).\n\nPor favor comuníquese con nosotros para conciliar el pago.",
      },
      push: {
        enabled: true,
        template: "Cartera vencida: Factura #{factura} de {cliente} por {saldo_pendiente}.",
      },
    },
    availableVariables: [
      { tag: "{cliente}", description: "Nombre del cliente deudor", sampleValue: "Empresas Aliadas S.A.S." },
      { tag: "{negocio}", description: "Nombre del comercio", sampleValue: "Restaurante Gourmet" },
      { tag: "{factura}", description: "Número de factura o documento", sampleValue: "FAC-0045" },
      { tag: "{saldo_pendiente}", description: "Saldo adeudado", sampleValue: "$350.000" },
      { tag: "{fecha_vencimiento}", description: "Fecha límite acordada", sampleValue: "25 Oct 2026" },
      { tag: "{dias_vencido}", description: "Días transcurridos en mora", sampleValue: "7" },
    ],
  },
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  events: DEFAULT_NOTIFICATION_EVENTS,
  generalWhatsAppEnabled: true,
  generalEmailEnabled: true,
  generalPushEnabled: true,
  defaultWhatsAppSenderPhone: null,
  updatedAt: new Date().toISOString(),
};


/**
 * Obtiene el cliente Supabase para operaciones administrativas o de contexto.
 */
async function getSupabaseClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (serviceKey && supabaseUrl) {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    return createAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  const { createClient } = await import("@/lib/supabase/server");
  return await createClient();
}

/**
 * [CONF-003] Consulta y recupera la configuración de plantillas y eventos de notificación.
 * Si no existen configuraciones previas, inicializa con las plantillas estándar oficiales.
 */
export async function getNotificationSettings(businessId: string): Promise<NotificationSettings> {
  const supabase = await getSupabaseClient();

  try {
    const { data: biz, error } = await supabase
      .from("businesses")
      .select("settings")
      .eq("id", businessId)
      .maybeSingle();

    if (error) {
      console.warn("[getNotificationSettings] Error al consultar settings del comercio:", error);
      return DEFAULT_NOTIFICATION_SETTINGS;
    }

    const currentSettings = (biz?.settings as Record<string, unknown>) || {};
    const rawNotifications = currentSettings.notifications as Record<string, unknown> | undefined;

    if (!rawNotifications || typeof rawNotifications !== "object") {
      return DEFAULT_NOTIFICATION_SETTINGS;
    }

    // Fusionar eventos persistidos con los valores por defecto
    const persistedEvents = (rawNotifications.events || {}) as Record<string, any>;
    const mergedEvents: Record<NotificationEventId, NotificationEventConfig> = { ...DEFAULT_NOTIFICATION_EVENTS };

    (Object.keys(DEFAULT_NOTIFICATION_EVENTS) as NotificationEventId[]).forEach((eventId) => {
      const defaultEvt = DEFAULT_NOTIFICATION_EVENTS[eventId];
      const persistedEvt = persistedEvents[eventId];

      if (persistedEvt && typeof persistedEvt === "object") {
        mergedEvents[eventId] = {
          ...defaultEvt,
          ...persistedEvt,
          channels: {
            whatsapp: {
              ...defaultEvt.channels.whatsapp,
              ...(persistedEvt.channels?.whatsapp || {}),
            },
            email: {
              ...defaultEvt.channels.email,
              ...(persistedEvt.channels?.email || {}),
            },
            push: {
              ...defaultEvt.channels.push,
              ...(persistedEvt.channels?.push || {}),
            },
          },
          // Mantener metadatos de variables oficiales
          availableVariables: defaultEvt.availableVariables,
        };
      }
    });

    return {
      events: mergedEvents,
      generalWhatsAppEnabled:
        typeof rawNotifications.generalWhatsAppEnabled === "boolean"
          ? rawNotifications.generalWhatsAppEnabled
          : true,
      generalEmailEnabled:
        typeof rawNotifications.generalEmailEnabled === "boolean"
          ? rawNotifications.generalEmailEnabled
          : true,
      generalPushEnabled:
        typeof rawNotifications.generalPushEnabled === "boolean"
          ? rawNotifications.generalPushEnabled
          : true,
      defaultWhatsAppSenderPhone: (rawNotifications.defaultWhatsAppSenderPhone as string) || null,
      updatedAt: (rawNotifications.updatedAt as string) || new Date().toISOString(),
    };
  } catch (err) {
    console.warn("[getNotificationSettings] Excepción al procesar configuración:", err);
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

/**
 * [CONF-003] Guarda y actualiza la configuración de notificaciones en `businesses.settings.notifications`.
 * Garantiza persistencia sin sobreescribir otros ajustes del comercio.
 */
export async function saveNotificationSettings(
  businessId: string,
  updatedSettings: Partial<NotificationSettings>
): Promise<{ success: boolean; settings?: NotificationSettings; error?: string }> {
  const supabase = await getSupabaseClient();

  try {
    const { data: curBiz, error: fetchErr } = await supabase
      .from("businesses")
      .select("settings")
      .eq("id", businessId)
      .maybeSingle();

    if (fetchErr) {
      return { success: false, error: `Error al consultar negocio: ${fetchErr.message}` };
    }

    const currentSettings = (curBiz?.settings as Record<string, unknown>) || {};
    const existingNotifications = (currentSettings.notifications as Record<string, unknown>) || {};

    const existingEvents = (existingNotifications.events as Record<string, any>) || {};
    const updatedEvents = updatedSettings.events || {};

    // Fusionar eventos
    const mergedEvents: Record<NotificationEventId, NotificationEventConfig> = {
      ...DEFAULT_NOTIFICATION_EVENTS,
      ...existingEvents,
      ...updatedEvents,
    };

    const finalSettings: NotificationSettings = {
      events: mergedEvents,
      generalWhatsAppEnabled:
        updatedSettings.generalWhatsAppEnabled !== undefined
          ? updatedSettings.generalWhatsAppEnabled
          : existingNotifications.generalWhatsAppEnabled !== undefined
          ? (existingNotifications.generalWhatsAppEnabled as boolean)
          : true,
      generalEmailEnabled:
        updatedSettings.generalEmailEnabled !== undefined
          ? updatedSettings.generalEmailEnabled
          : existingNotifications.generalEmailEnabled !== undefined
          ? (existingNotifications.generalEmailEnabled as boolean)
          : true,
      generalPushEnabled:
        updatedSettings.generalPushEnabled !== undefined
          ? updatedSettings.generalPushEnabled
          : existingNotifications.generalPushEnabled !== undefined
          ? (existingNotifications.generalPushEnabled as boolean)
          : true,
      defaultWhatsAppSenderPhone:
        updatedSettings.defaultWhatsAppSenderPhone !== undefined
          ? updatedSettings.defaultWhatsAppSenderPhone
          : (existingNotifications.defaultWhatsAppSenderPhone as string) || null,
      updatedAt: new Date().toISOString(),
    };

    const newSettings = {
      ...currentSettings,
      notifications: finalSettings,
    };

    const { error: updateErr } = await supabase
      .from("businesses")
      .update({
        settings: newSettings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", businessId);

    if (updateErr) {
      return { success: false, error: `No fue posible guardar la configuración de notificaciones: ${updateErr.message}` };
    }

    return { success: true, settings: finalSettings };
  } catch (err: any) {
    console.error("[saveNotificationSettings] Error inesperado:", err);
    return { success: false, error: err?.message || "Error al guardar la configuración de notificaciones." };
  }
}

/**
 * [CONF-003] Restablece la plantilla y configuración de un evento específico a su valor de fábrica.
 */
export async function resetNotificationEventToDefault(
  businessId: string,
  eventId: NotificationEventId
): Promise<{ success: boolean; eventConfig?: NotificationEventConfig; error?: string }> {
  const defaultEvent = DEFAULT_NOTIFICATION_EVENTS[eventId];
  if (!defaultEvent) {
    return { success: false, error: `Evento ${eventId} no reconocido.` };
  }

  const current = await getNotificationSettings(businessId);
  const updatedEvents = {
    ...current.events,
    [eventId]: defaultEvent,
  };

  const res = await saveNotificationSettings(businessId, { events: updatedEvents });
  if (res.success && res.settings) {
    return { success: true, eventConfig: res.settings.events[eventId] };
  }
  return { success: false, error: res.error || "No fue posible restablecer el evento." };
}
