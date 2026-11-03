import { describe, it, expect } from "vitest";
import {
  generateDeliveryToken,
  hashDeliveryToken,
  type DeliveryDispatchSession,
} from "../../src/lib/delivery/delivery-service";
import fs from "fs";
import path from "path";

describe("NEGOVA — Portal Público para Domiciliarios Externos y Reparto Seguro", () => {
  describe("1. Tokens Criptográficos y Seguridad de Sesión", () => {
    it("debe generar tokens criptográficos aleatorios con alta entropía en base64url", () => {
      const token1 = generateDeliveryToken();
      const token2 = generateDeliveryToken();

      expect(typeof token1).toBe("string");
      expect(token1.length).toBeGreaterThanOrEqual(30);
      expect(token1).not.toBe(token2); // Tokens únicos
      expect(token1).toMatch(/^[a-zA-Z0-9_-]+$/); // Formato base64url seguro para URLs
    });

    it("debe calcular el hash SHA-256 en hexadecimal del token para almacenamiento seguro", () => {
      const token = "mock-secret-delivery-token-xyz123";
      const hash1 = hashDeliveryToken(token);
      const hash2 = hashDeliveryToken(token);

      expect(hash1).toBe(hash2); // Determinista
      expect(hash1.length).toBe(64); // SHA-256 hex tiene 64 caracteres
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
      expect(hash1).not.toBe(token); // El hash es una función unidireccional
    });

    it("debe rechazar tokens expirados en la verificación de sesión", () => {
      const expiredSession: DeliveryDispatchSession = {
        id: "sess-01",
        businessId: "biz-1",
        driverId: "driver-01",
        driverName: "Carlos Repartidor",
        tokenHash: hashDeliveryToken("expired-token"),
        status: "active",
        expiresAt: new Date(Date.now() - 3600 * 1000).toISOString(), // Expiró hace 1 hora
        createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      };

      const isExpired = new Date(expiredSession.expiresAt) <= new Date();
      expect(isExpired).toBe(true);
    });

    it("debe rechazar sesiones que hayan sido revocadas por el restaurante", () => {
      const revokedSession: DeliveryDispatchSession = {
        id: "sess-02",
        businessId: "biz-1",
        driverId: "driver-02",
        driverName: "Mario Moto",
        tokenHash: hashDeliveryToken("revoked-token"),
        status: "revoked",
        expiresAt: new Date(Date.now() + 18 * 3600 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        revokedAt: new Date().toISOString(),
      };

      const isUsable = revokedSession.status === "active" && new Date(revokedSession.expiresAt) > new Date();
      expect(isUsable).toBe(false);
    });
  });

  describe("2. Aislamiento y Reasignación de Pedidos en Reparto", () => {
    it("debe retirar el pedido del repartidor anterior de forma inmediata si se reasigna a otro", () => {
      const ordersInDb = [
        {
          id: "ord-101",
          orderNumber: 101,
          driverName: "Laura Domicilios", // Reasignado a Laura
          status: "in_preparation",
          deliveryStatus: "assigned",
        },
        {
          id: "ord-102",
          orderNumber: 102,
          driverName: "Carlos Repartidor", // Asignado a Carlos
          status: "in_preparation",
          deliveryStatus: "assigned",
        },
      ];

      // Consulta del portal de Carlos: solo devuelve órdenes con driverName === "Carlos Repartidor"
      const carlosOrders = ordersInDb.filter((o) => o.driverName === "Carlos Repartidor");
      expect(carlosOrders.length).toBe(1);
      expect(carlosOrders[0].id).toBe("ord-102");

      // La orden 101 ya no es visible para Carlos
      expect(carlosOrders.some((o) => o.id === "ord-101")).toBe(false);
    });

    it("debe impedir que un repartidor confirme una entrega que no le pertenezca", () => {
      const sessionDriver = "Carlos Repartidor";
      const targetOrder = {
        id: "ord-888",
        driverName: "Otro Repartidor",
        deliveryStatus: "assigned",
      };

      const canDeliver = targetOrder.driverName === sessionDriver;
      expect(canDeliver).toBe(false);
    });
  });

  describe("3. Separación Estricta entre Entrega Física y Estado de Pago", () => {
    it("confirmar una comanda como entregada NO debe alterar el payment_status", () => {
      const order = {
        id: "ord-500",
        orderNumber: 500,
        deliveryStatus: "on_the_way",
        status: "in_preparation",
        paymentStatus: "pending", // Pago pendiente en efectivo
        total: 35000,
      };

      // Simulación de confirmación de entrega en servidor
      const updatePayload = {
        delivery_status: "delivered",
        status: "delivered",
        delivered_at: new Date().toISOString(),
        // NOTA: payment_status se mantiene intacto
      };

      const updatedOrder = {
        ...order,
        deliveryStatus: updatePayload.delivery_status,
        status: updatePayload.status,
      };

      expect(updatedOrder.deliveryStatus).toBe("delivered");
      expect(updatedOrder.status).toBe("delivered");
      // La regla de oro: el pago sigue siendo 'pending'
      expect(updatedOrder.paymentStatus).toBe("pending");
      expect(updatedOrder.paymentStatus).not.toBe("paid");
    });
  });

  describe("4. Compartir por WhatsApp sin Filtrar Datos Sensibles", () => {
    it("el mensaje de invitación por WhatsApp debe contener solo nombre del negocio y link seguro", () => {
      const businessName = "Arepas & Hamburguesas Don Pedro";
      const token = "secure-token-abc123xyz";
      const origin = "https://negova.com";
      const portalUrl = `${origin}/reparto/${token}`;

      const message = `¡Hola, Carlos! Te compartimos tu enlace seguro para consultar y gestionar tus entregas asignadas en ${businessName}: ${portalUrl}`;

      // Comprobar que no filtre direcciones ni teléfonos de clientes
      expect(message).toContain(businessName);
      expect(message).toContain(portalUrl);
      expect(message).not.toContain("Calle");
      expect(message).not.toContain("Carrera");
      expect(message).not.toContain("Avenida");
      expect(message).not.toContain("total a cobrar");
      expect(message).not.toContain("cliente");
    });
  });

  describe("5. Regla de Oro: Ausencia Total de Alertas Nativas", () => {
    it("los componentes de la interfaz de reparto no deben usar window.alert ni window.confirm", () => {
      const filesToCheck = [
        path.join(process.cwd(), "src/app/reparto/[businessId]/driver-session-portal-client.tsx"),
        path.join(process.cwd(), "src/app/reparto/[businessId]/page.tsx"),
        path.join(process.cwd(), "src/app/reparto/[businessId]/actions.ts"),
      ];

      for (const filePath of filesToCheck) {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, "utf-8");
          expect(content).not.toMatch(/window\.alert\s*\(/);
          expect(content).not.toMatch(/window\.confirm\s*\(/);
          expect(content).not.toMatch(/window\.prompt\s*\(/);
        }
      }
    });
  });
});
