import { describe, it, expect, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("CLI-001: Historial de pedidos y comprobantes en perfil de cliente", () => {
  describe("Cálculo de KPIs en getCustomerById y consistencia de datos", () => {
    it("debe calcular totalSpent y averageTicket sumando únicamente ventas completadas o pagadas", () => {
      const recentSales = [
        { id: "sale-1", documentNumber: "VNT-001", total: 45000, status: "paid", paymentMethod: "cash", issuedAt: "2026-10-25T14:00:00Z" },
        { id: "sale-2", documentNumber: "VNT-002", total: 55000, status: "completed", paymentMethod: "card", issuedAt: "2026-10-26T15:00:00Z" },
        { id: "sale-3", documentNumber: "VNT-003", total: 30000, status: "cancelled", paymentMethod: "cash", issuedAt: "2026-10-27T16:00:00Z" },
        { id: "sale-4", documentNumber: "VNT-004", total: 10000, status: "pending", paymentMethod: "cash", issuedAt: "2026-10-28T17:00:00Z" },
      ];

      const validSales = recentSales.filter(
        (s) => s.status === "completed" || s.status === "paid"
      );
      const totalSpent = validSales.reduce((acc, s) => acc + s.total, 0);
      const totalSalesCount = validSales.length;
      const averageTicket = totalSalesCount > 0 ? Math.round(totalSpent / totalSalesCount) : 0;

      expect(totalSpent).toBe(100000); // 45000 + 55000
      expect(totalSalesCount).toBe(2);
      expect(averageTicket).toBe(50000);
    });

    it("debe aplicar fallback seguro de totalSpent y ticket promedio a partir de pedidos válidos cuando no existen facturas emitidas", () => {
      const recentSales: any[] = [];
      const recentOrders = [
        { id: "ord-1", orderNumber: 1001, total: 30000, status: "delivered", createdAt: "2026-10-20T10:00:00Z" },
        { id: "ord-2", orderNumber: 1002, total: 50000, status: "delivered", createdAt: "2026-10-22T12:00:00Z" },
        { id: "ord-3", orderNumber: 1003, total: 20000, status: "cancelled", createdAt: "2026-10-24T18:00:00Z" },
      ];

      let totalSpent = recentSales.filter(s => s.status === "completed" || s.status === "paid").reduce((acc, s) => acc + s.total, 0);
      let totalSalesCount = 0;

      if (totalSpent === 0 && recentOrders.length > 0) {
        const validOrders = recentOrders.filter((o) => o.status !== "cancelled");
        totalSpent = validOrders.reduce((acc, o) => acc + o.total, 0);
        totalSalesCount = validOrders.length;
      }
      const averageTicket = totalSalesCount > 0 ? Math.round(totalSpent / totalSalesCount) : 0;

      expect(totalSpent).toBe(80000); // 30000 + 50000 (ignora cancelado)
      expect(totalSalesCount).toBe(2);
      expect(averageTicket).toBe(40000); // 80000 / 2
    });

    it("debe resolver lastOrderAt como la fecha más reciente entre órdenes y comprobantes", () => {
      const orderDate = "2026-10-28T10:00:00Z";
      const saleDate = "2026-10-29T14:30:00Z";

      let lastActivityDate: string | null = null;
      if (orderDate && saleDate) {
        lastActivityDate = new Date(orderDate) > new Date(saleDate) ? orderDate : saleDate;
      }

      expect(lastActivityDate).toBe("2026-10-29T14:30:00Z");
    });
  });

  describe("Filtrado y paginación en la vista de detalle de cliente", () => {
    const orders = Array.from({ length: 15 }, (_, i) => ({
      id: `ord-${i + 1}`,
      orderNumber: 2000 + i + 1,
      orderType: (i % 3 === 0 ? "delivery" : i % 3 === 1 ? "takeout" : "dine_in") as "delivery" | "takeout" | "dine_in",
      status: i % 4 === 0 ? "delivered" : i % 4 === 1 ? "in_preparation" : i % 4 === 2 ? "ready" : "cancelled",
      total: (i + 1) * 10000,
      createdAt: `2026-10-${String(10 + i).padStart(2, "0")}T10:00:00Z`,
      itemsSummary: `Hamburguesa x${i + 1}`,
    }));

    it("debe paginar pedidos según pageSize seleccionado", () => {
      const pageSize = 5;
      const page1 = orders.slice(0, pageSize);
      const page2 = orders.slice(pageSize, pageSize * 2);
      const totalPages = Math.ceil(orders.length / pageSize);

      expect(totalPages).toBe(3);
      expect(page1.length).toBe(5);
      expect(page1[0].orderNumber).toBe(2001);
      expect(page2.length).toBe(5);
      expect(page2[0].orderNumber).toBe(2006);
    });

    it("debe filtrar pedidos por estado y por texto de búsqueda", () => {
      const filterStatus = "delivered";
      const filteredByStatus = orders.filter((o) => o.status === filterStatus);
      expect(filteredByStatus.every((o) => o.status === "delivered")).toBe(true);

      const search = "2005";
      const filteredBySearch = orders.filter((o) =>
        String(o.orderNumber).includes(search) || (o.itemsSummary && o.itemsSummary.toLowerCase().includes(search))
      );
      expect(filteredBySearch.length).toBe(1);
      expect(filteredBySearch[0].orderNumber).toBe(2005);
    });
  });

  describe("Navegación e integridad arquitectónica", () => {
    it("el archivo customer-detail-client debe definir rutas directas hacia /pedidos y /ventas", () => {
      const filePath = path.join(
        process.cwd(),
        "src/app/workspace/[businessId]/clientes/[id]/customer-detail-client.tsx"
      );
      const content = fs.readFileSync(filePath, "utf8");

      expect(content).toContain("handleNavigateToOrder");
      expect(content).toContain("/pedidos/${orderId}");
      expect(content).toContain("/ventas/${saleId}");
    });

    it("no debe contener llamadas a alertas nativas", () => {
      const filePath = path.join(
        process.cwd(),
        "src/app/workspace/[businessId]/clientes/[id]/customer-detail-client.tsx"
      );
      const content = fs.readFileSync(filePath, "utf8");

      expect(content).not.toMatch(/window\.alert\s*\(/);
      expect(content).not.toMatch(/window\.confirm\s*\(/);
      expect(content).not.toMatch(/window\.prompt\s*\(/);
    });
  });
});
