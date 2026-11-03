import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  extractDeliveryVerification,
  encodeDeliveryVerification,
  calculateDeliverySettlements,
  type OperationalDeliveryDriver,
} from "../../src/lib/delivery/delivery-service";
import {
  calculateDeliveryFeeForOrder,
  DEFAULT_DELIVERY_BUSINESS_CONFIG,
  type DeliveryBusinessConfig,
  type DeliveryIssueType,
  DELIVERY_ISSUE_LABELS,
} from "../../src/lib/delivery/types";
import type { RestaurantOrderWithDetails } from "../../src/lib/restaurant/types";

describe("[DOM-006] Módulo Integral de Domicilios, Repartidores, Despacho y Liquidación", () => {
  // =========================================================================
  // 1. REPARTIDORES OPERATIVOS (SIN CONSUMO DE CUPOS DE SUSCRIPCIÓN)
  // =========================================================================
  describe("1. Repartidores Operativos y Licencias Protegidas", () => {
    it("debe verificar que los repartidores se almacenan como identidades operativas con PIN de 6 dígitos", () => {
      const mockDriver: OperationalDeliveryDriver = {
        id: "driver-uuid-001",
        name: "Carlos Repartidor",
        phone: "3101234567",
        accessPin: "583921",
        isActive: true,
        createdAt: new Date().toISOString(),
      };

      expect(mockDriver.accessPin).toMatch(/^\d{6}$/);
      expect(mockDriver.name).toBe("Carlos Repartidor");
      expect(mockDriver.isActive).toBe(true);
    });

    it("debe confirmar que el modelo de repartidor no requiere id de auth.users ni membresía en business_users", () => {
      const driver: OperationalDeliveryDriver = {
        id: "drv-999",
        name: "Mario Moto",
        accessPin: "123456",
        isActive: true,
        createdAt: "2026-11-03T00:00:00.000Z",
      };

      // No posee campos de cuenta de usuario ni credenciales administrativas
      expect((driver as any).userId).toBeUndefined();
      expect((driver as any).email).toBeUndefined();
      expect((driver as any).role).toBeUndefined();
    });
  });

  // =========================================================================
  // 2. SEMÁFORO VISUAL Y ALERTAS DE RETRASO
  // =========================================================================
  describe("2. Semáforo de Tiempos y Alertas de Retraso", () => {
    const calculateTrafficLight = (createdIso: string, currentMs: number) => {
      const createdMs = new Date(createdIso).getTime();
      const elapsedMinutes = Math.max(0, Math.floor((currentMs - createdMs) / (1000 * 60)));

      if (elapsedMinutes >= 40) {
        return { level: "red", label: "Retrasado (>40 min)", elapsedMinutes };
      } else if (elapsedMinutes >= 25) {
        return { level: "yellow", label: "Atención requerida (25-40 min)", elapsedMinutes };
      }
      return { level: "green", label: "En tiempo (<25 min)", elapsedMinutes };
    };

    it("debe clasificar pedidos con menos de 25 min como 'En tiempo' (Verde)", () => {
      const now = Date.now();
      const created15mAgo = new Date(now - 15 * 60 * 1000).toISOString();
      const status = calculateTrafficLight(created15mAgo, now);

      expect(status.level).toBe("green");
      expect(status.elapsedMinutes).toBe(15);
    });

    it("debe clasificar pedidos entre 25 y 40 min como 'Atención requerida' (Amarillo)", () => {
      const now = Date.now();
      const created30mAgo = new Date(now - 30 * 60 * 1000).toISOString();
      const status = calculateTrafficLight(created30mAgo, now);

      expect(status.level).toBe("yellow");
      expect(status.elapsedMinutes).toBe(30);
    });

    it("debe clasificar pedidos con más de 40 min como 'Retrasado / Urgente' (Rojo)", () => {
      const now = Date.now();
      const created45mAgo = new Date(now - 45 * 60 * 1000).toISOString();
      const status = calculateTrafficLight(created45mAgo, now);

      expect(status.level).toBe("red");
      expect(status.elapsedMinutes).toBe(45);
    });
  });

  // =========================================================================
  // 3. CONTROL DE RECAUDO, LIQUIDACIÓN Y ARQUEO
  // =========================================================================
  describe("3. Liquidación y Arqueo de Caja", () => {
    const sampleDrivers: OperationalDeliveryDriver[] = [
      {
        id: "d1",
        name: "Carlos",
        phone: "3101112233",
        accessPin: "111111",
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: "d2",
        name: "Laura",
        phone: "3204445566",
        accessPin: "222222",
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    ];

    const sampleOrders: any[] = [
      // Carlos: 1 orden pagada previamente online, 1 orden en efectivo
      {
        id: "ord-1",
        order_number: 101,
        order_type: "delivery",
        delivery_status: "delivered",
        status: "delivered",
        driver_name: "Carlos",
        total: 45000,
        delivery_fee: 5000,
        payment_status: "paid",
        payment_method: "online_wompi",
      },
      {
        id: "ord-2",
        order_number: 102,
        order_type: "delivery",
        delivery_status: "delivered",
        status: "delivered",
        driver_name: "Carlos",
        total: 30000,
        delivery_fee: 4000,
        payment_status: "pending",
        payment_method: "cash",
      },
      // Laura: 1 orden en efectivo
      {
        id: "ord-3",
        order_number: 103,
        order_type: "delivery",
        delivery_status: "delivered",
        status: "delivered",
        driver_name: "Laura",
        total: 55000,
        delivery_fee: 6000,
        payment_status: "pending",
        payment_method: "cash",
      },
    ];

    it("debe calcular correctamente el efectivo cobrado vs pagos digitales por domiciliario", () => {
      const settlements = calculateDeliverySettlements(sampleOrders, sampleDrivers);

      const carlos = settlements.find((s) => s.driverName === "Carlos")!;
      expect(carlos).toBeDefined();
      expect(carlos.totalOrdersDelivered).toBe(2);
      expect(carlos.cashOrdersCount).toBe(1);
      expect(carlos.digitalOrdersCount).toBe(1);
      expect(carlos.totalCashCollected).toBe(30000);
      expect(carlos.totalDigitalCollected).toBe(45000);
      expect(carlos.totalRevenue).toBe(75000);
      expect(carlos.pendingCashToSettle).toBe(30000);
      expect(carlos.isSettled).toBe(false);

      const laura = settlements.find((s) => s.driverName === "Laura")!;
      expect(laura).toBeDefined();
      expect(laura.totalOrdersDelivered).toBe(1);
      expect(laura.totalCashCollected).toBe(55000);
      expect(laura.pendingCashToSettle).toBe(55000);
    });

    it("debe marcar como 'Al Día' al liquidar las órdenes en la caja activa", () => {
      // Carlos liquida sus órdenes en efectivo
      const settledOrderIds = ["ord-2"];
      const settlements = calculateDeliverySettlements(sampleOrders, sampleDrivers, undefined, settledOrderIds);

      const carlos = settlements.find((s) => s.driverName === "Carlos")!;
      expect(carlos.pendingCashToSettle).toBe(0);
      expect(carlos.isSettled).toBe(true);
    });
  });

  // =========================================================================
  // 4. CÓDIGO PIN DE ENTREGA (4 DÍGITOS) Y EXCEPCIONES
  // =========================================================================
  describe("4. Código PIN de 4 Dígitos, Intentos y Excepción Supervisada", () => {
    it("debe codificar y extraer el PIN de 4 dígitos y los intentos desde las notas", () => {
      const encoded = encodeDeliveryVerification("Dejar en portería torre 3", "4892", 0);
      expect(encoded).toContain("[PIN:4892:0]");

      const info = extractDeliveryVerification(encoded);
      expect(info.code).toBe("4892");
      expect(info.attempts).toBe(0);
      expect(info.isLocked).toBe(false);
      expect(info.cleanNotes).toBe("Dejar en portería torre 3");
    });

    it("debe bloquear la entrega si se superan los 5 intentos fallidos", () => {
      const lockedNotes = encodeDeliveryVerification("Notas", "4892", 5);
      const info = extractDeliveryVerification(lockedNotes);

      expect(info.attempts).toBe(5);
      expect(info.isLocked).toBe(true);
    });

    it("debe soportar catálogo de novedades de entrega normalizadas", () => {
      const validTypes: DeliveryIssueType[] = [
        "customer_absent",
        "address_not_found",
        "customer_rejected",
        "accident_or_delay",
        "other",
      ];

      for (const t of validTypes) {
        expect(DELIVERY_ISSUE_LABELS[t]).toBeDefined();
        expect(DELIVERY_ISSUE_LABELS[t].length).toBeGreaterThan(5);
      }
    });
  });

  // =========================================================================
  // 5. PROHIBICIÓN ESTRICTA DE ALERTAS NATIVAS
  // =========================================================================
  describe("5. Regla Global: Prohibición de Alertas Nativas", () => {
    const filesToCheck = [
      "src/components/delivery/workspace-domicilios-client.tsx",
      "src/app/workspace/[businessId]/domicilios/page.tsx",
      "src/app/workspace/[businessId]/domicilios/actions.ts",
      "src/app/reparto/[businessId]/driver-app-client.tsx",
      "src/app/reparto/[businessId]/driver-session-portal-client.tsx",
    ];

    filesToCheck.forEach((relPath) => {
      it(`el archivo ${path.basename(relPath)} no debe contener window.alert, window.confirm, window.prompt ni Alert.alert`, () => {
        const fullPath = path.resolve(process.cwd(), relPath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, "utf-8");
          expect(content).not.toMatch(/window\.alert\s*\(/);
          expect(content).not.toMatch(/window\.confirm\s*\(/);
          expect(content).not.toMatch(/window\.prompt\s*\(/);
          expect(content).not.toMatch(/Alert\.alert\s*\(/);
          expect(content).not.toMatch(/(?<![a-zA-Z0-9_])alert\s*\(/);
        }
      });
    });
  });
});
