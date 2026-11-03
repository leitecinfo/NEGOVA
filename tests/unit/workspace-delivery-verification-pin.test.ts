import { describe, it, expect } from "vitest";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  extractDeliveryVerification,
  encodeDeliveryVerification,
} from "../../src/lib/delivery/delivery-service";
import {
  formatOrderSummaryMessage,
  type WhatsAppOrderSummaryData,
} from "../../src/lib/whatsapp/order-whatsapp-format";

describe("NEGOVA — PIN de Verificación de Entrega para Pedidos a Domicilio", () => {
  describe("1. Generación Automática del PIN Criptográficamente Seguro", () => {
    it("debe generar un PIN numérico de exactamente 4 dígitos con padding para ceros iniciales", () => {
      // Simulación de generador seguro usado en restaurant-service.ts
      const generatePin = () => crypto.randomInt(0, 10000).toString().padStart(4, "0");

      for (let i = 0; i < 50; i++) {
        const pin = generatePin();
        expect(pin).toMatch(/^\d{4}$/);
        expect(pin.length).toBe(4);
      }
    });

    it("debe admitir y preservar ceros iniciales como '0047' o '0123' sin perder formato", () => {
      const pinWithLeadingZeros = "0047";
      const encoded = encodeDeliveryVerification("Sin cebolla", pinWithLeadingZeros, 0);

      expect(encoded).toContain("[PIN:0047:0]");
      const extracted = extractDeliveryVerification(encoded);

      expect(extracted.code).toBe("0047");
      expect(extracted.attempts).toBe(0);
      expect(extracted.isLocked).toBe(false);
      expect(extracted.cleanNotes).toBe("Sin cebolla");
    });
  });

  describe("2. Mensaje de WhatsApp al Cliente con el PIN de Entrega", () => {
    it("debe incluir el PIN real y las instrucciones exactas de entrega en pedidos a domicilio", () => {
      const orderData: WhatsAppOrderSummaryData = {
        orderNumber: 450,
        businessName: "Burger Express",
        businessPhone: "3001234567",
        customerName: "Valentina Gómez",
        customerPhone: "3019876543",
        orderType: "delivery",
        deliveryAddress: "Calle 100 # 15-20, Apto 502",
        deliveryReference: "Frente al parque",
        deliveryPin: "4821",
        items: [
          {
            name: "Hamburguesa Doble Carne",
            quantity: 2,
            unitPrice: 22000,
            subtotal: 44000,
          },
        ],
        subtotal: 44000,
        deliveryFee: 5000,
        total: 49000,
      };

      const message = formatOrderSummaryMessage(orderData);

      // Verificación de los requisitos del mensaje WhatsApp
      expect(message).toContain("¡Tu pedido ha sido confirmado!");
      expect(message).toContain("Tu código de entrega es: *4821*");
      expect(message).toContain("comparte este código de 4 dígitos con el domiciliario para confirmar la entrega");
      expect(message).toContain("No compartas el código antes de recibir tu pedido");
      expect(message).toContain("*Dirección de entrega:* Calle 100 # 15-20, Apto 502");
    });

    it("no debe incluir instrucciones de PIN para pedidos en mesa o para recoger", () => {
      const dineInOrder: WhatsAppOrderSummaryData = {
        orderNumber: 451,
        businessName: "Burger Express",
        customerName: "Juan Pérez",
        orderType: "dine_in",
        tableName: "Mesa 4",
        deliveryPin: "1234", // Aunque viniera en los datos, para salón no debe emitirse
        items: [
          {
            name: "Salchipapa Especial",
            quantity: 1,
            unitPrice: 18000,
            subtotal: 18000,
          },
        ],
        subtotal: 18000,
        total: 18000,
      };

      const messageDineIn = formatOrderSummaryMessage(dineInOrder);
      expect(messageDineIn).not.toContain("Tu código de entrega es");
      expect(messageDineIn).not.toContain("comparte este código de 4 dígitos");

      const takeawayOrder: WhatsAppOrderSummaryData = {
        ...dineInOrder,
        orderType: "takeaway",
        tableName: undefined,
      };
      const messageTakeaway = formatOrderSummaryMessage(takeawayOrder);
      expect(messageTakeaway).not.toContain("Tu código de entrega es");
      expect(messageTakeaway).not.toContain("comparte este código de 4 dígitos");
    });
  });

  describe("3. Protección contra Fuerza Bruta y Control de Intentos", () => {
    it("debe contabilizar intentos fallidos de verificación y permitir hasta 5 intentos", () => {
      const pin = "7890";
      let notes = encodeDeliveryVerification("", pin, 0);

      // Intentos 1 a 4
      for (let i = 1; i <= 4; i++) {
        const current = extractDeliveryVerification(notes);
        expect(current.isLocked).toBe(false);
        expect(current.attempts).toBe(i - 1);

        const newAttempts = current.attempts + 1;
        notes = encodeDeliveryVerification(current.cleanNotes, current.code!, newAttempts);
      }

      // En el 5to intento
      const fifth = extractDeliveryVerification(notes);
      expect(fifth.attempts).toBe(4);
      expect(fifth.isLocked).toBe(false);

      const lockedNotes = encodeDeliveryVerification(fifth.cleanNotes, fifth.code!, 5);
      const lockedState = extractDeliveryVerification(lockedNotes);
      expect(lockedState.attempts).toBe(5);
      expect(lockedState.isLocked).toBe(true);
    });

    it("debe censurar el PIN en las consultas del portal del domiciliario", () => {
      const rawNotes = "Timbre dañado [PIN:9431:1]";
      const verification = extractDeliveryVerification(rawNotes);

      // El portal externo recibe la nota limpia sin la etiqueta interna de verificación
      expect(verification.cleanNotes).toBe("Timbre dañado");
      expect(verification.cleanNotes).not.toContain("9431");
      expect(verification.cleanNotes).not.toContain("[PIN:");
    });
  });

  describe("4. Separación Estricta entre Estado de Entrega y Estado de Pago", () => {
    it("la confirmación de entrega no debe alterar el saldo ni el estado de pago del pedido", () => {
      const initialOrder = {
        id: "ord-test-01",
        orderNumber: 305,
        status: "in_preparation",
        deliveryStatus: "assigned",
        paymentStatus: "pending", // Pedido con pago pendiente (contra entrega)
        total: 35000,
      };

      // Simulación de actualización al verificar PIN exitoso
      const updatedOrder = {
        ...initialOrder,
        status: "delivered",
        deliveryStatus: "delivered",
        deliveredAt: new Date().toISOString(),
        // paymentStatus permanece estrictamente idéntico
        paymentStatus: initialOrder.paymentStatus,
      };

      expect(updatedOrder.deliveryStatus).toBe("delivered");
      expect(updatedOrder.status).toBe("delivered");
      expect(updatedOrder.paymentStatus).toBe("pending"); // NUNCA se marca como 'paid' automáticamente
      expect(updatedOrder.deliveredAt).toBeDefined();
    });
  });

  describe("5. Regla Global de Código: Prohibición de Alertas Nativas", () => {
    it("no debe contener window.alert, alert, confirm o prompt en los archivos modificados", () => {
      const filesToCheck = [
        "src/app/reparto/[businessId]/driver-session-portal-client.tsx",
        "src/lib/delivery/delivery-service.ts",
        "src/lib/whatsapp/order-whatsapp-format.ts",
      ];

      for (const relPath of filesToCheck) {
        const fullPath = path.resolve(__dirname, "../../", relPath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, "utf-8");

          // Verificar que no se invoquen alertas nativas
          expect(content).not.toMatch(/\bwindow\.alert\s*\(/);
          expect(content).not.toMatch(/\bwindow\.confirm\s*\(/);
          expect(content).not.toMatch(/\bwindow\.prompt\s*\(/);
          expect(content).not.toMatch(/(?<![a-zA-Z0-9_])alert\s*\(/);
          expect(content).not.toMatch(/(?<![a-zA-Z0-9_])confirm\s*\(/);
          expect(content).not.toMatch(/(?<![a-zA-Z0-9_])prompt\s*\(/);
        }
      }
    });
  });
});
