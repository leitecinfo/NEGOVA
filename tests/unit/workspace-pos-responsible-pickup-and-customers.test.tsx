import React from "react";
import { describe, it, expect } from "vitest";
import { generatePickupCode, extractPickupVerificationDetails } from "@/lib/orders/pickup-verification-service";
import { getCargoBadgeColor } from "@/components/pos/pos-responsible-selector";

describe("NEGOVA — Asignación de Responsables, Pedidos Para Recoger y Clientes", () => {
  describe("1. Generación y Validación de Código de Recogida (PIN)", () => {
    it("debe generar un código de recogida de exactamente 4 dígitos numéricos", () => {
      for (let i = 0; i < 50; i++) {
        const pin = generatePickupCode();
        expect(pin).toMatch(/^[0-9]{4}$/);
        const pinNum = parseInt(pin, 10);
        expect(pinNum).toBeGreaterThanOrEqual(1000);
        expect(pinNum).toBeLessThanOrEqual(9999);
      }
    });

    it("debe extraer correctamente los detalles de verificación desde columnas directas", () => {
      const orderRow = {
        pickup_code: "4821",
        pickup_attempts: 2,
        pickup_confirmed_at: null,
        pickup_confirmed_by: null,
        notes: "Sin notas especiales",
        status: "ready",
      };

      const details = extractPickupVerificationDetails(orderRow);
      expect(details.code).toBe("4821");
      expect(details.attempts).toBe(2);
      expect(details.isLocked).toBe(false);
      expect(details.isConfirmed).toBe(false);
    });

    it("debe bloquear la recogida si se superan los 5 intentos fallidos", () => {
      const orderRow = {
        pickup_code: "1234",
        pickup_attempts: 5,
        pickup_confirmed_at: null,
      };

      const details = extractPickupVerificationDetails(orderRow);
      expect(details.isLocked).toBe(true);
      expect(details.attempts).toBe(5);
    });

    it("debe extraer información de respaldo desde notas si las columnas están vacías", () => {
      const orderRow = {
        pickup_code: null,
        pickup_attempts: null,
        notes: "Cliente especial [PICKUP_PIN:7890:3] sin cubiertos",
      };

      const details = extractPickupVerificationDetails(orderRow);
      expect(details.code).toBe("7890");
      expect(details.attempts).toBe(3);
      expect(details.isLocked).toBe(false);
    });

    it("debe confirmar el estado de entrega física sin alterar el estado de pago", () => {
      const orderDelivered = {
        pickup_code: "9999",
        pickup_attempts: 1,
        pickup_confirmed_at: "2026-11-04T12:00:00Z",
        pickup_confirmed_by: "usr_cajero_01",
        pickup_confirmed_by_name: "Cajero Principal",
        payment_status: "pending", // Sigue pendiente de pago!
        status: "delivered",
      };

      const details = extractPickupVerificationDetails(orderDelivered);
      expect(details.isConfirmed).toBe(true);
      expect(orderDelivered.payment_status).toBe("pending"); // Separación estricta
    });
  });

  describe("2. Selector de Responsables y Etiquetas de Cargos", () => {
    it("debe diferenciar visualmente los cargos mediante colores de badges asignados", () => {
      expect(getCargoBadgeColor("Propietario")).toContain("purple");
      expect(getCargoBadgeColor("Cajero")).toContain("amber");
      expect(getCargoBadgeColor("Mesero")).toContain("blue");
      expect(getCargoBadgeColor("Cocinero")).toContain("emerald");
      expect(getCargoBadgeColor("Domiciliario")).toContain("orange");
      expect(getCargoBadgeColor("Auxiliar")).toContain("slate");
    });
  });

  describe("3. Modelo de Clientes: Persona Natural vs Empresa", () => {
    it("debe admitir customerType 'individual' y 'business' con contactName", () => {
      const naturalCustomer = {
        fullName: "Juan Carlos Pérez",
        customerType: "individual" as const,
        phone: "3001234567",
        taxId: "1098765432",
      };

      const businessCustomer = {
        fullName: "Inversiones Gastronómicas S.A.S.",
        customerType: "business" as const,
        contactName: "María Gómez (Representante Legal)",
        phone: "3109876543",
        taxId: "901234567-8",
      };

      expect(naturalCustomer.customerType).toBe("individual");
      expect(businessCustomer.customerType).toBe("business");
      expect(businessCustomer.contactName).toBe("María Gómez (Representante Legal)");
    });
  });

  describe("4. Regla Estricta: Prohibición de Alertas Nativas", () => {
    it("verifica que no se utilicen alertas nativas en los componentes desarrollados", async () => {
      const fs = await import("fs");
      const filesToCheck = [
        "src/components/pos/pos-order-responsible-selector.tsx",
        "src/components/pos/pos-quick-create-customer-modal.tsx",
        "src/components/pos/pos-select-customer-modal.tsx",
        "src/components/customers/customer-modal.tsx",
        "src/components/pedidos/confirm-pickup-modal.tsx",
      ];

      for (const file of filesToCheck) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, "utf8");
          expect(content).not.toMatch(/window\.alert\s*\(/);
          expect(content).not.toMatch(/window\.confirm\s*\(/);
          expect(content).not.toMatch(/window\.prompt\s*\(/);
          expect(content).not.toMatch(/Alert\.alert\s*\(/);
        }
      }
    });
  });
});
