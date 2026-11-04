// Service Worker de NEGOVA para Notificaciones Push Nativas y Alertas en Móviles / PWA
const SW_VERSION = "negova-sw-v1.0.0";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// 1. Escuchar eventos PUSH provenientes del servidor (Web Push API)
self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: "Nuevo pedido en NEGOVA", body: event.data.text() };
    }
  }

  const title = data.title || "Nuevo Pedido — NEGOVA";
  const options = {
    body: data.body || "Tienes un nuevo pedido pendiente de atención en cocina.",
    icon: data.icon || "/isotipo.png",
    badge: data.badge || "/isotipo.png",
    tag: data.tag || `order-${data.orderId || Date.now()}`,
    data: {
      url: data.url || "/workspace",
      orderId: data.orderId,
    },
    vibrate: [200, 100, 200, 100, 300],
    renotify: true,
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 2. Escuchar mensajes del cliente (para disparar notificación nativa desde Realtime en primer o segundo plano)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "TRIGGER_ORDER_NOTIFICATION") {
    const payload = event.data.payload || {};
    const title = payload.title || "Nuevo Pedido — NEGOVA";
    const options = {
      body: payload.body || "Nueva comanda registrada para despacho.",
      icon: payload.icon || "/isotipo.png",
      badge: payload.badge || "/isotipo.png",
      tag: payload.tag || `order-${payload.orderId || Date.now()}`,
      data: {
        url: payload.url || "/workspace",
        orderId: payload.orderId,
      },
      vibrate: [250, 100, 250],
      renotify: true,
      requireInteraction: true,
    };

    event.waitUntil(self.registration.showNotification(title, options));
  }
});

// 3. Manejar clic en la notificación del sistema operativo
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/workspace";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Si hay una pestaña abierta de NEGOVA, enfocarla y navegar
        for (const client of clientList) {
          if (client.url && "focus" in client) {
            client.focus();
            if ("navigate" in client) {
              return client.navigate(targetUrl);
            }
            return client;
          }
        }
        // Si no hay pestañas abiertas, abrir una nueva ventana
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

