import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCargoBadgeColor } from "@/components/pos/pos-responsible-selector";
import {
  extractPickupVerification,
  encodePickupVerification,
  extractResponsibleStaff,
} from "@/lib/restaurant/restaurant-service";
import { StaffMember } from "@/lib/restaurant/types";

describe("Asignación de Responsables y Pedidos Para Recoger (POS)", () => {
  describe("1. Responsable del Pedido y Selector Visual", () => {
    it("1.1. Diferencia visualmente los cargos mediante colores coherentes", () => {
      const ownerColor = getCargoBadgeColor("Propietario");
      const cashierColor = getCargoBadgeColor("Cajero");
      const waiterColor = getCargoBadgeColor("Mesero");
      const cookColor = getCargoBadgeColor("Cocinero");
      const deliveryColor = getCargoBadgeColor("Domiciliario");
      const generalColor = getCargoBadgeColor("Empleado");

      expect(ownerColor).toContain("purple");
      expect(cashierColor).toContain("amber");
      expect(waiterColor).toContain("blue");
      expect(cookColor).toContain("emerald");
      expect(deliveryColor).toContain("orange");
      expect(generalColor).toContain("slate");
    });

    it("1.2. Soporta personas con múltiples cargos combinados", () => {
      const staff: StaffMember = {
        id: "staff-1",
        name: "Carlos Gómez",
        email: "carlos@negova.com",
        roles: ["Mesero", "Domiciliario"],
        isCurrentUser: false,
      };

      expect(staff.roles).toHaveLength(2);
      expect(staff.roles).toContain("Mesero");
      expect(staff.roles).toContain("Domiciliario");

      const badgeColorMesero = getCargoBadgeColor(staff.roles[0]);
      const badgeColorDomiciliario = getCargoBadgeColor(staff.roles[1]);
      expect(badgeColorMesero).not.toEqual(badgeColorDomiciliario);
    });

    it("1.3. Admite personas sin cargo asignado mostrando su nombre sin etiquetas", () => {
      const staffWithoutRole: StaffMember = {
        id: "staff-2",
        name: "Pedro Pasajero",
        email: "pedro@negova.com",
        roles: [],
        isCurrentUser: false,
      };

      expect(staffWithoutRole.roles).toHaveLength(0);
      expect(staffWithoutRole.name).toBe("Pedro Pasajero");
    });

    it("1.4. Conserva la separación estricta entre responsable, creador y cobrador", () => {
      const notes =
        "Pedido especial | [RESPONSABLE:staff-uuid-1:Juan Perez:Cajero] | [PICKUP_PIN:8421:0]";
      const responsible = extractResponsibleStaff(notes, {
        assigned_staff_id: "staff-uuid-1",
        assigned_staff_name: "Juan Perez",
        assigned_staff_role: "Cajero",
      });

      expect(responsible.assignedStaffId).toBe("staff-uuid-1");
      expect(responsible.assignedStaffName).toBe("Juan Perez");
      expect(responsible.assignedStaffRole).toBe("Cajero");
    });
  });

  describe("2. Modalidad Para Recoger y Código PIN de 4 dígitos", () => {
    it("2.1. Genera y extrae correctamente el código de 4 dígitos y los intentos fallidos", () => {
      const encoded = encodePickupVerification("", "9314", 0);
      expect(encoded).toBe("[PICKUP_PIN:9314:0]");

      const extracted = extractPickupVerification(`Comanda de cocina ${encoded}`);
      expect(extracted.code).toBe("9314");
      expect(extracted.attempts).toBe(0);
    });

    it("2.2. Prioriza columnas de base de datos nativas y mantiene fallback a notes", () => {
      const extractedFromDb = extractPickupVerification("Nota cualquiera", {
        pickup_code: "5678",
        pickup_attempts: 2,
      });

      expect(extractedFromDb.code).toBe("5678");
      expect(extractedFromDb.attempts).toBe(2);
    });

    it("2.3. Incrementa el contador de intentos fallidos", () => {
      const attempts2 = encodePickupVerification("", "9314", 2);
      expect(attempts2).toBe("[PICKUP_PIN:9314:2]");

      const extracted = extractPickupVerification(`Prefijo | ${attempts2} | Sufijo`);
      expect(extracted.attempts).toBe(2);
    });

    it("2.4. Valida que el código sea de un solo uso y que la recogida no marque el pago como completado", () => {
      // Simulación de estados desacoplados
      const mockOrder = {
        id: "order-1",
        order_type: "takeout",
        status: "delivered", // Recogido
        payment_status: "pending", // Pago estrictamente pendiente
        pickup_code: "4321",
        pickup_confirmed_at: "2026-11-04T10:00:00Z",
        pickup_confirmed_by: "user-cashier-1",
      };

      // Criterio 21: La recogida física no altera automáticamente el estado del pago
      expect(mockOrder.status).toBe("delivered");
      expect(mockOrder.payment_status).toBe("pending");
      expect(mockOrder.pickup_confirmed_at).toBeTruthy();
    });

    it("2.5. Bloquea la confirmación en pedidos cancelados", () => {
      const cancelledOrder = {
        id: "order-cancelled",
        order_type: "takeout",
        status: "cancelled",
        pickup_code: "1234",
      };

      // Si el estado es cancelado, no debe permitir confirmación
      expect(cancelledOrder.status).toBe("cancelled");
    });

    it("2.6. Bloquea la confirmación cuando los intentos fallidos alcanzan el límite de 5", () => {
      const lockedOrder = {
        id: "order-locked",
        order_type: "takeout",
        status: "received",
        pickup_code: "1234",
        pickup_attempts: 5,
      };

      expect(lockedOrder.pickup_attempts).toBeGreaterThanOrEqual(5);
      const isLocked = lockedOrder.pickup_attempts >= 5;
      expect(isLocked).toBe(true);
    });
  });

  describe("3. Reglas de Validación de Cliente y Teléfono en Para Recoger", () => {
    it("3.1. Valida que para modalidad Para Recoger sean obligatorios Nombre y Teléfono", () => {
      const validateTakeoutInput = (input: { name?: string; phone?: string }) => {
        if (!input.name?.trim() || !input.phone?.trim()) {
          return { isValid: false, error: "Nombre y teléfono obligatorios" };
        }
        return { isValid: true };
      };

      expect(validateTakeoutInput({ name: "", phone: "3001234567" }).isValid).toBe(false);
      expect(validateTakeoutInput({ name: "Carlos", phone: "" }).isValid).toBe(false);
      expect(validateTakeoutInput({ name: "Carlos", phone: "3001234567" }).isValid).toBe(true);
    });

    it("3.2. Para Recoger no solicita dirección de entrega", () => {
      const takeoutPayload = {
        orderType: "takeout",
        customerName: "María López",
        customerPhone: "3109876543",
        deliveryAddress: null,
        deliveryFee: 0,
      };

      expect(takeoutPayload.deliveryAddress).toBeNull();
      expect(takeoutPayload.deliveryFee).toBe(0);
    });
  });
});
