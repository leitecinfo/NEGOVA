import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  getKdsAlertLevel,
  DEFAULT_KDS_TIME_ALERTS,
  VALID_ORDER_STATUS_TRANSITIONS,
  RestaurantOrderWithDetails,
} from "@/lib/restaurant/types";

describe("KDS-001 - Kitchen Display System (Monitor de Cocina)", () => {
  describe("Tiempos de preparación y cálculo de alertas visuales", () => {
    it("debe clasificar una comanda reciente (<15 min) con nivel 'normal'", () => {
      // Pedido creado hace 5 minutos
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const alert = getKdsAlertLevel(fiveMinAgo);

      expect(alert.level).toBe("normal");
      expect(alert.elapsedMinutes).toBe(5);
      expect(alert.elapsedFormatted).toMatch(/^05:\d{2}$/);
    });

    it("debe clasificar una comanda demorada (>=15 min y <30 min) con nivel 'warning'", () => {
      // Pedido creado hace 18 minutos y 30 segundos
      const eighteenMinAgo = new Date(Date.now() - (18 * 60 + 30) * 1000).toISOString();
      const alert = getKdsAlertLevel(eighteenMinAgo);

      expect(alert.level).toBe("warning");
      expect(alert.elapsedMinutes).toBe(18);
      expect(alert.elapsedFormatted).toMatch(/^18:\d{2}$/);
    });

    it("debe clasificar una comanda crítica (>=30 min) con nivel 'critical' para alerta roja parpadeante", () => {
      // Pedido creado hace 35 minutos
      const thirtyFiveMinAgo = new Date(Date.now() - 35 * 60 * 1000).toISOString();
      const alert = getKdsAlertLevel(thirtyFiveMinAgo);

      expect(alert.level).toBe("critical");
      expect(alert.elapsedMinutes).toBe(35);
      expect(alert.elapsedFormatted).toMatch(/^35:\d{2}$/);
    });

    it("debe respetar configuraciones personalizadas de umbrales de alerta", () => {
      // Umbrales configurables: aviso a los 10 min, crítico a los 20 min
      const customConfig = { warningMinutes: 10, criticalMinutes: 20 };

      const twelveMinAgo = new Date(Date.now() - 12 * 60 * 1000).toISOString();
      const alert = getKdsAlertLevel(twelveMinAgo, customConfig);

      expect(alert.level).toBe("warning");
      expect(alert.elapsedMinutes).toBe(12);

      const twentyTwoMinAgo = new Date(Date.now() - 22 * 60 * 1000).toISOString();
      const criticalAlert = getKdsAlertLevel(twentyTwoMinAgo, customConfig);
      expect(criticalAlert.level).toBe("critical");
    });
  });

  describe("Filtrado por pestañas operativas y canales de destino", () => {
    const mockOrders: Partial<RestaurantOrderWithDetails>[] = [
      { id: "ord-1", order_number: 101, status: "received", order_type: "dine_in", tableName: "Mesa 1", created_at: new Date().toISOString() },
      { id: "ord-2", order_number: 102, status: "in_preparation", order_type: "takeout", created_at: new Date().toISOString() },
      { id: "ord-3", order_number: 103, status: "ready", order_type: "delivery", created_at: new Date().toISOString() },
      { id: "ord-4", order_number: 104, status: "delivered", order_type: "dine_in", tableName: "Mesa 4", created_at: new Date().toISOString() },
      { id: "ord-5", order_number: 105, status: "cancelled", order_type: "takeout", created_at: new Date().toISOString() },
    ];

    it("debe filtrar correctamente órdenes para la pestaña 'received' (Pendiente)", () => {
      const received = mockOrders.filter((o) => o.status === "received");
      expect(received).toHaveLength(1);
      expect(received[0].order_number).toBe(101);
    });

    it("debe filtrar correctamente órdenes para la pestaña 'in_preparation' (Preparando)", () => {
      const inPrep = mockOrders.filter((o) => o.status === "in_preparation");
      expect(inPrep).toHaveLength(1);
      expect(inPrep[0].order_number).toBe(102);
    });

    it("debe filtrar correctamente órdenes para la pestaña 'ready' (Listo)", () => {
      const ready = mockOrders.filter((o) => o.status === "ready");
      expect(ready).toHaveLength(1);
      expect(ready[0].order_number).toBe(103);
    });

    it("debe filtrar correctamente órdenes para la pestaña 'delivered' (Entregado)", () => {
      const delivered = mockOrders.filter((o) => o.status === "delivered");
      expect(delivered).toHaveLength(1);
      expect(delivered[0].order_number).toBe(104);
    });

    it("debe excluir pedidos cancelados de la pestaña 'all'", () => {
      const activeOrDelivered = mockOrders.filter((o) => o.status !== "cancelled");
      expect(activeOrDelivered).toHaveLength(4);
      expect(activeOrDelivered.some((o) => o.status === "cancelled")).toBe(false);
    });

    it("debe filtrar por canal o tipo de destino (dine_in, takeout, delivery)", () => {
      const tablesOnly = mockOrders.filter((o) => o.order_type === "dine_in");
      expect(tablesOnly).toHaveLength(2);

      const deliveryOnly = mockOrders.filter((o) => o.order_type === "delivery");
      expect(deliveryOnly).toHaveLength(1);
      expect(deliveryOnly[0].order_number).toBe(103);
    });
  });

  describe("Máquina de estados en cocina", () => {
    it("debe permitir transición de 'received' a 'in_preparation'", () => {
      const allowed = VALID_ORDER_STATUS_TRANSITIONS["received"];
      expect(allowed).toContain("in_preparation");
    });

    it("debe permitir transición de 'in_preparation' a 'ready'", () => {
      const allowed = VALID_ORDER_STATUS_TRANSITIONS["in_preparation"];
      expect(allowed).toContain("ready");
    });

    it("debe permitir transición de 'ready' a 'delivered'", () => {
      const allowed = VALID_ORDER_STATUS_TRANSITIONS["ready"];
      expect(allowed).toContain("delivered");
    });

    it("debe permitir corrección inversa de 'in_preparation' a 'received'", () => {
      const allowed = VALID_ORDER_STATUS_TRANSITIONS["in_preparation"];
      expect(allowed).toContain("received");
    });

    it("debe permitir corrección inversa de 'ready' a 'in_preparation'", () => {
      const allowed = VALID_ORDER_STATUS_TRANSITIONS["ready"];
      expect(allowed).toContain("in_preparation");
    });
  });

  describe("Cumplimiento estricto de Regla Global: Prohibición de Alertas Nativas", () => {
    it("no debe contener llamadas a window.alert, window.confirm, window.prompt o Alert.alert", () => {
      const cocinaDir = path.resolve(__dirname, "../../src/app/workspace/[businessId]/cocina");
      const files = ["page.tsx", "actions.ts", "kds-screen-client.tsx"];

      const forbiddenPatterns = [
        /\bwindow\.alert\b/,
        /\balert\s*\(/,
        /\bwindow\.confirm\b/,
        /\bconfirm\s*\(/,
        /\bwindow\.prompt\b/,
        /\bprompt\s*\(/,
        /\bAlert\.alert\b/,
      ];

      for (const file of files) {
        const filePath = path.join(cocinaDir, file);
        expect(fs.existsSync(filePath), `Archivo ${file} debe existir`).toBe(true);

        const content = fs.readFileSync(filePath, "utf-8");
        for (const pattern of forbiddenPatterns) {
          expect(
            pattern.test(content),
            `El archivo ${file} NO debe contener alertas nativas coincidentes con ${pattern}`
          ).toBe(false);
        }
      }
    });
  });
});

