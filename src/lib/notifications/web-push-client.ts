"use client";

/**
 * Cliente de Notificaciones Nativas Web Push API y Service Worker para NEGOVA.
 * 
 * Permite que los dispositivos móviles (Android Chrome, iOS Safari 16.4+ como PWA)
 * y computadores de escritorio reciban alertas nativas del sistema operativo
 * incluso si la pestaña está en segundo plano o minimizada.
 */

export interface NativeOrderNotificationData {
  orderId: string;
  orderNumber: number | string;
  orderType: string;
  customerName?: string | null;
  total: number;
  businessId: string;
}

let swRegistration: ServiceWorkerRegistration | null = null;
let permissionRequested = false;

/**
 * Registra el Service Worker de NEGOVA de manera segura en el navegador.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    swRegistration = reg;
    return reg;
  } catch (err) {
    console.warn("[WebPushClient] No se pudo registrar el Service Worker:", err);
    return null;
  }
}

/**
 * Solicita permisos de notificación del sistema operativo al operador.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }

  if (Notification.permission === "granted") {
    return "granted";
  }

  if (Notification.permission === "denied") {
    return "denied";
  }

  try {
    const permission = await Notification.requestPermission();
    permissionRequested = true;
    return permission;
  } catch (err) {
    console.warn("[WebPushClient] Error solicitando permiso de notificación:", err);
    return "default";
  }
}

/**
 * Dispara una alerta de notificación nativa del sistema operativo.
 * Utiliza el Service Worker prioritariamente para soporte móvil y de segundo plano.
 */
export async function showNativeOrderNotification(
  data: NativeOrderNotificationData
): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }

  // Si aún está en default y no se ha solicitado, pedirlo
  if (Notification.permission === "default" && !permissionRequested) {
    const perm = await requestNotificationPermission();
    if (perm !== "granted") return false;
  }

  if (Notification.permission !== "granted") {
    return false;
  }

  const orderNum = `#${data.orderNumber}`;
  const formattedTotal = `$${Number(data.total || 0).toLocaleString("es-CO")}`;
  let modality = "Consumo en mesa";
  if (data.orderType === "takeout") modality = "Para llevar";
  if (data.orderType === "delivery") modality = "A domicilio";
  if (data.orderType === "pickup") modality = "Para recoger";

  const clientText = data.customerName ? ` • ${data.customerName}` : "";
  const title = `¡Nuevo Pedido ${orderNum}!`;
  const body = `${modality} • Total: ${formattedTotal}${clientText}`;
  const targetUrl = `/workspace/${data.businessId}/pedidos/${data.orderId}`;

  // 1. Intentar mediante Service Worker (recomendado para PWA y segundo plano)
  try {
    if (!swRegistration && "serviceWorker" in navigator) {
      swRegistration = await navigator.serviceWorker.ready.catch(() => null);
    }

    if (swRegistration && "showNotification" in swRegistration) {
      await swRegistration.showNotification(title, {
        body,
        icon: "/isotipo.png",
        badge: "/isotipo.png",
        tag: `order-${data.orderId}`,
        data: {
          url: targetUrl,
          orderId: data.orderId,
        },
        vibrate: [250, 100, 250],
        renotify: true,
        requireInteraction: true,
      } as NotificationOptions);
      return true;
    }
  } catch (swErr) {
    console.warn("[WebPushClient] Fallback a Notification API estándar:", swErr);
  }

  // 2. Fallback a constructor nativo Notification
  try {
    const notif = new Notification(title, {
      body,
      icon: "/isotipo.png",
      badge: "/isotipo.png",
      tag: `order-${data.orderId}`,
      data: { url: targetUrl },
    });

    notif.onclick = () => {
      window.focus();
      window.location.href = targetUrl;
      notif.close();
    };

    return true;
  } catch (err) {
    console.warn("[WebPushClient] No fue posible disparar notificación nativa:", err);
    return false;
  }
}
