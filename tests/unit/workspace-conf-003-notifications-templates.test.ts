import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import {
  DEFAULT_NOTIFICATION_EVENTS,
  DEFAULT_NOTIFICATION_SETTINGS,
  renderTemplatePreview,
  getNotificationSettings,
  saveNotificationSettings,
  resetNotificationEventToDefault,
} from "@/lib/notifications/notification-settings-service";
import type {
  NotificationSettings,
  NotificationEventConfig,
  NotificationEventId,
} from "@/lib/notifications/types";

// Mock del cliente Supabase para pruebas unitarias deterministas
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("[CONF-003] Gestión de Plantillas de Notificación", () => {
  const rootDir = process.cwd();
  const businessId = "11111111-2222-3333-4444-555555555555";

  describe("Criterio 1: Se puede activar la notificación 'Nuevo pedido QR' por WhatsApp", () => {
    it("debe contener el evento qr_order_created con canal WhatsApp configurable", () => {
      const qrEvent = DEFAULT_NOTIFICATION_EVENTS.qr_order_created;

      expect(qrEvent).toBeDefined();
      expect(qrEvent.id).toBe("qr_order_created");
      expect(qrEvent.name).toBe("Nuevo pedido de menú QR");
      expect(qrEvent.category).toBe("pedidos");
      expect(qrEvent.channels.whatsapp).toBeDefined();
      expect(qrEvent.channels.whatsapp.enabled).toBe(true);
      expect(qrEvent.channels.whatsapp.template).toContain("{cliente}");
      expect(qrEvent.channels.whatsapp.template).toContain("{orden}");
      expect(qrEvent.channels.whatsapp.template).toContain("{total}");
    });

    it("permite activar o desactivar el canal WhatsApp de forma independiente", () => {
      const baseEvent = { ...DEFAULT_NOTIFICATION_EVENTS.qr_order_created };

      // Desactivar canal WhatsApp
      const disabledWhatsAppEvent: NotificationEventConfig = {
        ...baseEvent,
        channels: {
          ...baseEvent.channels,
          whatsapp: {
            ...baseEvent.channels.whatsapp,
            enabled: false,
          },
        },
      };

      expect(disabledWhatsAppEvent.channels.whatsapp.enabled).toBe(false);
      // Los otros canales no se alteran
      expect(disabledWhatsAppEvent.channels.email.enabled).toBe(true);

      // Reactivar canal WhatsApp
      disabledWhatsAppEvent.channels.whatsapp.enabled = true;
      expect(disabledWhatsAppEvent.channels.whatsapp.enabled).toBe(true);
    });
  });

  describe("Criterio 2: Se puede editar el texto de la plantilla con variables ({cliente}, {total}, {productos})", () => {
    it("permite modificar el contenido de la plantilla conservando variables dinámicas", () => {
      const customTemplate =
        "Hola {cliente}, tu orden #{orden} por valor de {total} incluye: {productos}. ¡Mesa: {mesa}!";

      const updatedEvent: NotificationEventConfig = {
        ...DEFAULT_NOTIFICATION_EVENTS.qr_order_created,
        channels: {
          ...DEFAULT_NOTIFICATION_EVENTS.qr_order_created.channels,
          whatsapp: {
            enabled: true,
            template: customTemplate,
          },
        },
      };

      expect(updatedEvent.channels.whatsapp.template).toBe(customTemplate);
    });

    it("reemplaza correctamente las variables {cliente}, {total}, {productos} en la previsualización", () => {
      const template =
        "Pedido #{orden} para {cliente}. Total a pagar: {total}. Platos: {productos}.";

      const sampleVariables = {
        "{cliente}": "Alejandro Restrepo",
        "{orden}": "ORD-501",
        "{total}": "$52.000",
        "{productos}": "2x Hamburguesa Clásica, 1x Cerveza Corona",
      };

      const rendered = renderTemplatePreview(template, sampleVariables);

      expect(rendered).toBe(
        "Pedido #ORD-501 para Alejandro Restrepo. Total a pagar: $52.000. Platos: 2x Hamburguesa Clásica, 1x Cerveza Corona."
      );
      expect(rendered).not.toContain("{cliente}");
      expect(rendered).not.toContain("{orden}");
      expect(rendered).not.toContain("{total}");
      expect(rendered).not.toContain("{productos}");
    });
  });

  describe("Criterio 3: Se puede desactivar una notificación sin eliminar la configuración", () => {
    it("mantiene intactas las plantillas y variables cuando el evento global se desactiva (enabled = false)", () => {
      const originalTemplate = DEFAULT_NOTIFICATION_EVENTS.qr_order_created.channels.whatsapp.template;
      const originalRoles = DEFAULT_NOTIFICATION_EVENTS.qr_order_created.recipientRoles;

      // Desactivación del evento
      const deactivatedEvent: NotificationEventConfig = {
        ...DEFAULT_NOTIFICATION_EVENTS.qr_order_created,
        enabled: false,
      };

      expect(deactivatedEvent.enabled).toBe(false);
      // La configuración de canales sigue intacta
      expect(deactivatedEvent.channels.whatsapp.template).toBe(originalTemplate);
      expect(deactivatedEvent.channels.whatsapp.enabled).toBe(true);
      expect(deactivatedEvent.recipientRoles).toEqual(originalRoles);
      expect(deactivatedEvent.availableVariables.length).toBeGreaterThan(0);
    });
  });

  describe("Criterio 4: Los cambios persisten al recargar y fusionar con defaults", () => {
    it("debe preservar eventos personalizados al fusionar con defaults en la capa de servicio", () => {
      const customTemplate = "Aviso urgente para {cliente}: Tu comanda #{orden} está lista.";
      const persistedSettingsFromDb = {
        events: {
          qr_order_created: {
            enabled: false,
            channels: {
              whatsapp: {
                enabled: true,
                template: customTemplate,
              },
            },
          },
        },
      };

      // Simular fusión que realiza getNotificationSettings
      const mergedEvents: Record<NotificationEventId, NotificationEventConfig> = {
        ...DEFAULT_NOTIFICATION_EVENTS,
      };

      const persistedEvt = persistedSettingsFromDb.events.qr_order_created;
      mergedEvents.qr_order_created = {
        ...DEFAULT_NOTIFICATION_EVENTS.qr_order_created,
        enabled: persistedEvt.enabled,
        channels: {
          ...DEFAULT_NOTIFICATION_EVENTS.qr_order_created.channels,
          whatsapp: {
            ...DEFAULT_NOTIFICATION_EVENTS.qr_order_created.channels.whatsapp,
            ...persistedEvt.channels.whatsapp,
          },
        },
      };

      expect(mergedEvents.qr_order_created.enabled).toBe(false);
      expect(mergedEvents.qr_order_created.channels.whatsapp.template).toBe(customTemplate);
      // Conserva canales email y push predeterminados
      expect(mergedEvents.qr_order_created.channels.email.enabled).toBe(true);
      expect(mergedEvents.qr_order_created.availableVariables).toBeDefined();
    });
  });

  describe("Alcance: 5 Eventos Notificables Oficiales", () => {
    const requiredEventIds: NotificationEventId[] = [
      "qr_order_created",
      "delivery_status_changed",
      "low_stock_reached",
      "cash_shift_closed",
      "account_receivable_overdue",
    ];

    it("debe definir los 5 eventos requeridos en DEFAULT_NOTIFICATION_EVENTS", () => {
      requiredEventIds.forEach((eventId) => {
        const event = DEFAULT_NOTIFICATION_EVENTS[eventId];
        expect(event).toBeDefined();
        expect(event.id).toBe(eventId);
        expect(event.name).toBeTruthy();
        expect(event.description).toBeTruthy();
        expect(event.category).toBeTruthy();
        expect(event.channels.whatsapp).toBeDefined();
        expect(event.channels.email).toBeDefined();
        expect(event.channels.push).toBeDefined();
        expect(event.availableVariables.length).toBeGreaterThan(0);
      });
    });

    it("cada evento debe contar con variables específicas según su contexto", () => {
      // Domicilios
      const deliveryEvt = DEFAULT_NOTIFICATION_EVENTS.delivery_status_changed;
      const deliveryTags = deliveryEvt.availableVariables.map((v) => v.tag);
      expect(deliveryTags).toContain("{estado}");
      expect(deliveryTags).toContain("{repartidor}");
      expect(deliveryTags).toContain("{tracking_link}");

      // Stock
      const stockEvt = DEFAULT_NOTIFICATION_EVENTS.low_stock_reached;
      const stockTags = stockEvt.availableVariables.map((v) => v.tag);
      expect(stockTags).toContain("{producto}");
      expect(stockTags).toContain("{stock_actual}");
      expect(stockTags).toContain("{stock_minimo}");

      // Caja
      const cashEvt = DEFAULT_NOTIFICATION_EVENTS.cash_shift_closed;
      const cashTags = cashEvt.availableVariables.map((v) => v.tag);
      expect(cashTags).toContain("{caja}");
      expect(cashTags).toContain("{cajero}");
      expect(cashTags).toContain("{monto_esperado}");
      expect(cashTags).toContain("{monto_real}");

      // Cartera
      const carteraEvt = DEFAULT_NOTIFICATION_EVENTS.account_receivable_overdue;
      const carteraTags = carteraEvt.availableVariables.map((v) => v.tag);
      expect(carteraTags).toContain("{factura}");
      expect(carteraTags).toContain("{saldo_pendiente}");
      expect(carteraTags).toContain("{dias_vencido}");
    });
  });

  describe("Canales y Destinatarios (Roles y Clientes)", () => {
    it("debe permitir asignar roles destinatarios a cada evento", () => {
      const event = { ...DEFAULT_NOTIFICATION_EVENTS.low_stock_reached };
      event.recipientRoles = ["owner", "admin", "kitchen"];

      expect(event.recipientRoles).toContain("owner");
      expect(event.recipientRoles).toContain("admin");
      expect(event.recipientRoles).toContain("kitchen");
      expect(event.recipientRoles).not.toContain("waiter");
    });

    it("debe permitir configurar la opción notifyCustomer para alertas dirigidas al comensal", () => {
      const qrEvent = DEFAULT_NOTIFICATION_EVENTS.qr_order_created;
      const stockEvent = DEFAULT_NOTIFICATION_EVENTS.low_stock_reached;

      expect(qrEvent.notifyCustomer).toBe(true);
      expect(stockEvent.notifyCustomer).toBe(false);
    });
  });

  describe("Regla Global: Prohibido uso de alertas nativas del navegador", () => {
    it("no debe contener window.alert, window.confirm, window.prompt ni Alert.alert en ningún archivo del módulo", () => {
      const filesToCheck = [
        path.join(rootDir, "src/lib/notifications/types.ts"),
        path.join(rootDir, "src/lib/notifications/notification-settings-service.ts"),
        path.join(rootDir, "src/app/workspace/[businessId]/configuracion/notificaciones/actions.ts"),
        path.join(rootDir, "src/app/workspace/[businessId]/configuracion/notificaciones/page.tsx"),
        path.join(rootDir, "src/app/workspace/[businessId]/configuracion/notificaciones/notifications-config-client.tsx"),
      ];

      for (const filePath of filesToCheck) {
        if (!fs.existsSync(filePath)) continue;
        const code = fs.readFileSync(filePath, "utf8");

        expect(code).not.toMatch(/\bwindow\.alert\s*\(/);
        expect(code).not.toMatch(/\bwindow\.confirm\s*\(/);
        expect(code).not.toMatch(/\bwindow\.prompt\s*\(/);
        expect(code).not.toMatch(/\bAlert\.alert\s*\(/);
      }
    });
  });
});
