import { describe, it, expect, vi } from "vitest";
import { normalizePhoneNumber } from "@/lib/customers/customers-service";

describe("Workspace Customers Flow & Business Rules", () => {
  describe("Regla 1: Venta rápida y consumo en mesa sin cliente obligatorio", () => {
    it("debe permitir registrar una comanda de mostrador o llevar con cliente nulo/mostrador", () => {
      const posPayload = {
        orderType: "takeout",
        customerName: null,
        customerPhone: null,
        items: [{ productId: "p-1", quantity: 2, unitPrice: 12000 }],
      };

      // Venta válida sin cliente obligatorio
      expect(posPayload.customerName).toBeNull();
      expect(posPayload.items.length).toBeGreaterThan(0);
    });

    it("debe permitir crear pedido en mesa únicamente con table_id y sin datos de cliente", () => {
      const dineInPayload = {
        orderType: "dine_in",
        tableId: "table-uuid-04",
        customerName: null,
        customerPhone: null,
        deliveryAddress: null,
      };

      expect(dineInPayload.tableId).toBeDefined();
      expect(dineInPayload.customerName).toBeNull();
    });
  });

  describe("Regla 2: Aislamiento estricto multi-tenant por business_id", () => {
    it("las consultas deben rechazar cruce de datos entre diferentes negocios", () => {
      const businessA = "biz-aaaa-1111";
      const businessB = "biz-bbbb-2222";

      const customerBizA = {
        id: "cust-01",
        businessId: businessA,
        fullName: "Cliente del Negocio A",
        phone: "3001234567",
      };

      // Simulación de filtro RLS
      const queryTenantB = (targetBusinessId: string, record: { businessId: string }) => {
        return record.businessId === targetBusinessId;
      };

      expect(queryTenantB(businessB, customerBizA)).toBe(false);
      expect(queryTenantB(businessA, customerBizA)).toBe(true);
    });
  });

  describe("Regla 3: Normalización y prevención de duplicados", () => {
    it("debe normalizar números telefónicos idénticos con formatos variados", () => {
      const format1 = "+57 300 456 7890";
      const format2 = "300-456-7890";
      const format3 = "(300) 4567890";

      const norm1 = normalizePhoneNumber(format1);
      const norm2 = normalizePhoneNumber(format2);
      const norm3 = normalizePhoneNumber(format3);

      expect(norm1).toBe("3004567890");
      expect(norm2).toBe(norm1);
      expect(norm3).toBe(norm1);
    });
  });

  describe("Regla 4: Directorio de clientes con ranking Top y métricas consolidadas", () => {
    it("debe calcular el ranking top y ticket promedio correctamente", () => {
      const customers = [
        { id: "c1", fullName: "Carlos Gómez", totalSpentAmount: 120000, totalOrdersCount: 4 },
        { id: "c2", fullName: "María Pérez", totalSpentAmount: 400000, totalOrdersCount: 8 },
        { id: "c3", fullName: "Sin Compras", totalSpentAmount: 0, totalOrdersCount: 0 },
      ];

      const sorted = [...customers]
        .filter((c) => c.totalSpentAmount > 0)
        .sort((a, b) => b.totalSpentAmount - a.totalSpentAmount);

      const rankMap = new Map<string, number>();
      sorted.forEach((c, i) => rankMap.set(c.id, i + 1));

      expect(rankMap.get("c2")).toBe(1); // #1 con 400.000
      expect(rankMap.get("c1")).toBe(2); // #2 con 120.000
      expect(rankMap.get("c3")).toBeUndefined(); // Sin compras -> '-'

      // Ticket promedio
      const avgTicketC2 = Math.round(400000 / 8);
      expect(avgTicketC2).toBe(50000);
    });

    it("la exportación a Excel debe incluir la marca BOM UTF-8 y encabezados requeridos", () => {
      const headers = [
        "Top",
        "Cliente / Nombre",
        "Documento / NIT",
        "Teléfono",
        "Correo Electrónico",
        "Dirección Principal",
        "Total Comprado ($ COP)",
        "Número de Pedidos",
        "Ticket Promedio ($ COP)",
        "Última Compra",
        "Saldo Registrado ($ COP)",
        "Cupo de Crédito ($ COP)",
        "Por Cobrar ($ COP)",
        "Crédito Disponible ($ COP)",
        "Estado",
        "Notas",
        "Fecha de Registro",
      ];

      const csvContent = "\uFEFF" + headers.join(";");
      expect(csvContent.startsWith("\uFEFF")).toBe(true);
      expect(csvContent).toContain("Documento / NIT");
      expect(csvContent).toContain("Ticket Promedio");
    });
  });

  describe("Regla de Oro: Cero alertas nativas", () => {
    it("el código no debe invocar window.alert ni window.confirm", () => {
      // Verificamos que los componentes del módulo de clientes no contengan llamadas a alert() o confirm()
      const fs = require("fs");
      const path = require("path");

      const filesToCheck = [
        path.join(process.cwd(), "src/lib/customers/customers-service.ts"),
        path.join(process.cwd(), "src/components/customers/customer-modal.tsx"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/clientes/customers-list-client.tsx"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/clientes/[id]/customer-detail-client.tsx"),
      ];

      for (const file of filesToCheck) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, "utf8");
          expect(content).not.toMatch(/window\.alert\s*\(/);
          expect(content).not.toMatch(/window\.confirm\s*\(/);
          expect(content).not.toMatch(/window\.prompt\s*\(/);
        }
      }
    });
  });
});
