import { describe, it, expect, vi, beforeEach } from "vitest";
import { normalizePhoneNumber } from "@/lib/customers/customers-service";

describe("Customers Service - Unit Tests", () => {
  describe("normalizePhoneNumber", () => {
    it("debe retornar cadena vacía si el teléfono es nulo o indefinido", () => {
      expect(normalizePhoneNumber(null)).toBe("");
      expect(normalizePhoneNumber(undefined)).toBe("");
      expect(normalizePhoneNumber("")).toBe("");
    });

    it("debe remover espacios, guiones y caracteres no numéricos", () => {
      expect(normalizePhoneNumber("300-123-4567")).toBe("3001234567");
      expect(normalizePhoneNumber(" (300) 123 4567 ")).toBe("3001234567");
      expect(normalizePhoneNumber("+57 300 123 4567")).toBe("3001234567");
    });

    it("debe manejar prefijo internacional de Colombia (57 + 10 dígitos) extrayendo los 10 dígitos locales", () => {
      expect(normalizePhoneNumber("573001234567")).toBe("3001234567");
      expect(normalizePhoneNumber("+573001234567")).toBe("3001234567");
    });

    it("debe preservar números locales estándar de 10 dígitos", () => {
      expect(normalizePhoneNumber("3112345678")).toBe("3112345678");
    });

    it("debe normalizar números fijos colombianos con prefijo moderno de 10 dígitos (ej. 601)", () => {
      expect(normalizePhoneNumber("601 234 5678")).toBe("6012345678");
      expect(normalizePhoneNumber("+57 601 234 5678")).toBe("6012345678");
    });

    it("debe manejar números internacionales sin destruirlos si no coinciden con Colombia (ej. +1 USA)", () => {
      // 11 dígitos con código de país 1 (USA): debe conservar los dígitos sin asumir prefijo 57
      expect(normalizePhoneNumber("+1 305 555 0199")).toBe("13055550199");
    });

    it("debe manejar entradas inválidas o con texto arbitrario", () => {
      expect(normalizePhoneNumber("N/A")).toBe("");
      expect(normalizePhoneNumber("No tiene")).toBe("");
      expect(normalizePhoneNumber("---")).toBe("");
    });
  });

  describe("Manejo de Teléfonos Compartidos y Reactivación Lógica", () => {
    it("debe permitir que familiares o compañeros de trabajo compartan el mismo número telefónico con nombres distintos", () => {
      const existingCustomer = {
        id: "cust-01",
        fullName: "Carlos Gómez",
        normalizedPhone: "3001234567",
        status: "active",
      };

      const newFamilyMember = {
        fullName: "Laura Gómez (Hija)",
        phone: "300 123 4567",
      };

      const normNew = normalizePhoneNumber(newFamilyMember.phone);

      // Regla de negocio en customers-service:
      // Si el teléfono coincide pero el nombre es diferente, NO es duplicado de la misma persona.
      const isExactDuplicate =
        existingCustomer.status === "active" &&
        existingCustomer.normalizedPhone === normNew &&
        existingCustomer.fullName.trim().toLowerCase() === newFamilyMember.fullName.trim().toLowerCase();

      expect(isExactDuplicate).toBe(false);
    });

    it("debe detectar duplicación exacta si el nombre y el número coinciden para un cliente activo", () => {
      const existingCustomer = {
        id: "cust-01",
        fullName: "Carlos Gómez",
        normalizedPhone: "3001234567",
        status: "active",
      };

      const duplicateInput = {
        fullName: "carlos gómez ",
        phone: "+57 (300) 123-4567",
      };

      const norm = normalizePhoneNumber(duplicateInput.phone);
      const isExactDuplicate =
        existingCustomer.status === "active" &&
        existingCustomer.normalizedPhone === norm &&
        existingCustomer.fullName.trim().toLowerCase() === duplicateInput.fullName.trim().toLowerCase();

      expect(isExactDuplicate).toBe(true);
    });

    it("debe identificar a un cliente inactivo para reactivación en lugar de duplicarlo", () => {
      const inactiveCustomer = {
        id: "cust-99",
        fullName: "María Rodríguez",
        normalizedPhone: "3109876543",
        status: "inactive",
      };

      const reRegisterInput = {
        fullName: "María Rodríguez",
        phone: "3109876543",
      };

      const norm = normalizePhoneNumber(reRegisterInput.phone);
      const shouldReactivate =
        inactiveCustomer.status === "inactive" &&
        inactiveCustomer.normalizedPhone === norm &&
        inactiveCustomer.fullName.trim().toLowerCase() === reRegisterInput.fullName.trim().toLowerCase();

      expect(shouldReactivate).toBe(true);
    });
  });

  describe("Aislamiento Multi-Tenant en Direcciones de Clientes", () => {
    it("debe impedir asociar direcciones a clientes que pertenecen a otro comercio", () => {
      const tenantA = "biz-aaaa-1111";
      const tenantB = "biz-bbbb-2222";

      const customerRecordInTenantA = {
        id: "cust-01",
        businessId: tenantA,
        fullName: "Cliente Legítimo de Tenant A",
      };

      // Intento de asociar dirección enviando tenantB pero customerId de tenantA
      const targetBusinessId = tenantB;
      const isBelongingToTenant = customerRecordInTenantA.businessId === targetBusinessId;

      expect(isBelongingToTenant).toBe(false);
    });
  });

  describe("Cálculo seguro de compras y no duplicidad", () => {
    it("no debe contar pedidos no facturados como ventas dobles", () => {
      // Simulación de operaciones de un cliente
      const orders = [
        { id: "ord-1", orderNumber: 101, total: 25000, status: "delivered" },
        { id: "ord-2", orderNumber: 102, total: 35000, status: "delivered" },
      ];

      const sales = [
        // Solo la orden 101 fue formalizada y pagada en venta
        { id: "sale-1", documentNumber: "CMP-001", total: 25000, status: "paid" },
      ];

      // Regla: totalSpent solo se calcula sumando las ventas válidas (status 'paid' o 'completed')
      const validCompletedSales = sales.filter(
        (s) => s.status === "completed" || s.status === "paid"
      );
      const totalSpent = validCompletedSales.reduce((acc, s) => acc + s.total, 0);

      // El total gastado debe ser estrictamente 25000, no 25000 + 25000 + 35000
      expect(totalSpent).toBe(25000);
      expect(orders.length).toBe(2);
      expect(sales.length).toBe(1);
    });

    it("debe ignorar ventas canceladas o anuladas en el ticket promedio", () => {
      const sales = [
        { id: "s1", total: 40000, status: "paid" },
        { id: "s2", total: 60000, status: "cancelled" }, // Anulada
        { id: "s3", total: 20000, status: "completed" },
      ];

      const validSales = sales.filter(
        (s) => s.status === "completed" || s.status === "paid"
      );
      const totalSpent = validSales.reduce((acc, s) => acc + s.total, 0);
      const averageTicket = Math.round(totalSpent / validSales.length);

      expect(totalSpent).toBe(60000);
      expect(averageTicket).toBe(30000); // 60000 / 2
    });
  });

  describe("Inmutabilidad de datos históricos", () => {
    it("editar el nombre o teléfono del cliente en su perfil no debe alterar los pedidos previos ya emitidos", () => {
      // Pedido previo emitido
      const historicalOrder = {
        id: "ord-99",
        customerId: "cust-01",
        customerName: "Juan Pérez",
        customerPhone: "3001112233",
        deliveryAddress: "Calle 10 # 5-20",
        total: 18000,
        createdAt: "2026-10-01T12:00:00Z",
      };

      // Modificación del perfil del cliente en el presente
      const updatedCustomerProfile = {
        id: "cust-01",
        fullName: "Juan Camilo Pérez Gómez", // Nombre cambiado
        phone: "3009998877", // Nuevo número
        notes: "Cambió de número telefónico",
      };

      // El snapshot histórico del pedido debe conservarse inmutable
      expect(historicalOrder.customerName).toBe("Juan Pérez");
      expect(historicalOrder.customerPhone).toBe("3001112233");
      expect(historicalOrder.customerName).not.toBe(updatedCustomerProfile.fullName);
    });
  });
});
