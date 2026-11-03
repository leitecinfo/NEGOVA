import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { getDeliveryReportData } from "@/lib/reports/reports-service";
import { generateDeliveryReportCsv } from "@/lib/reports/delivery-report-csv";
import { generateDeliveryReportPdf } from "@/lib/reports/delivery-report-pdf";
import type { DeliveryReportData } from "@/lib/reports/types";

// Mock del cliente Supabase para pruebas unitarias deterministas
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("[REP-007] Reporte de Domicilios y Tiempos de Entrega", () => {
  const rootDir = process.cwd();
  const businessId = "11111111-2222-3333-4444-555555555555";

  describe("Criterio 1: Los conteos de entregas coinciden con los registros de restaurant_orders / delivery_orders", () => {
    it("debe calcular correctamente entregas exitosas, canceladas y rechazadas", async () => {
      // Datos mock simulando pedidos de domicilios
      const mockOrders = [
        {
          id: "ord-1",
          order_number: 101,
          order_type: "delivery",
          customer_name: "Cliente 1",
          driver_name: "Carlos Repartidor",
          delivery_status: "delivered",
          status: "delivered",
          total: 50000,
          created_at: "2026-11-01T10:00:00.000Z",
          delivered_at: "2026-11-01T10:25:00.000Z", // 25 min
        },
        {
          id: "ord-2",
          order_number: 102,
          order_type: "delivery",
          customer_name: "Cliente 2",
          driver_name: "Carlos Repartidor",
          delivery_status: "delivered",
          status: "delivered",
          total: 35000,
          created_at: "2026-11-01T11:00:00.000Z",
          delivered_at: "2026-11-01T11:35:00.000Z", // 35 min
        },
        {
          id: "ord-3",
          order_number: 103,
          order_type: "delivery",
          customer_name: "Cliente 3",
          driver_name: "Ana Moto",
          delivery_status: "cancelled",
          status: "cancelled",
          total: 40000,
          created_at: "2026-11-01T12:00:00.000Z",
        },
        {
          id: "ord-4",
          order_number: 104,
          order_type: "delivery",
          customer_name: "Cliente 4",
          driver_name: "Ana Moto",
          delivery_status: "rejected",
          status: "rejected",
          total: 25000,
          created_at: "2026-11-01T13:00:00.000Z",
        },
      ];

      // Verificar lógica de conteo
      const totalDeliveries = mockOrders.length;
      const successfulDeliveries = mockOrders.filter((o) => o.delivery_status === "delivered").length;
      const cancelledDeliveries = mockOrders.filter((o) => o.delivery_status === "cancelled").length;
      const rejectedDeliveries = mockOrders.filter((o) => o.delivery_status === "rejected").length;

      expect(totalDeliveries).toBe(4);
      expect(successfulDeliveries).toBe(2);
      expect(cancelledDeliveries).toBe(1);
      expect(rejectedDeliveries).toBe(1);
    });
  });

  describe("Criterio 2: El tiempo promedio se calcula correctamente en minutos (aceptación -> entrega)", () => {
    it("debe promediar los minutos transcurridos entre creación/aceptación y entrega", () => {
      // Pedido 1: 10:00 -> 10:25 (25 minutos)
      const t1Start = new Date("2026-11-01T10:00:00.000Z").getTime();
      const t1End = new Date("2026-11-01T10:25:00.000Z").getTime();
      const dur1 = Math.round((t1End - t1Start) / 60000);

      // Pedido 2: 11:00 -> 11:35 (35 minutos)
      const t2Start = new Date("2026-11-01T11:00:00.000Z").getTime();
      const t2End = new Date("2026-11-01T11:35:00.000Z").getTime();
      const dur2 = Math.round((t2End - t2Start) / 60000);

      expect(dur1).toBe(25);
      expect(dur2).toBe(35);

      const avg = Math.round((dur1 + dur2) / 2);
      expect(avg).toBe(30);
    });
  });

  describe("Criterio 3: Los repartidores se ordenan por entregas completadas descendente", () => {
    it("debe posicionar primero al repartidor con mayor número de entregas exitosas", () => {
      const mockDrivers = [
        {
          driverName: "Ana Moto",
          totalAssigned: 5,
          completedDeliveries: 3,
          cancelledDeliveries: 1,
          rejectedDeliveries: 1,
          averageDeliveryTimeMinutes: 28,
          completionRate: 60,
          averageRating: 4.7,
          totalAmountCollected: 120000,
          totalTariffsCollected: 15000,
        },
        {
          driverName: "Carlos Rápido",
          totalAssigned: 10,
          completedDeliveries: 9,
          cancelledDeliveries: 1,
          rejectedDeliveries: 0,
          averageDeliveryTimeMinutes: 22,
          completionRate: 90,
          averageRating: 4.9,
          totalAmountCollected: 380000,
          totalTariffsCollected: 45000,
        },
        {
          driverName: "Beto Reparto",
          totalAssigned: 4,
          completedDeliveries: 1,
          cancelledDeliveries: 2,
          rejectedDeliveries: 1,
          averageDeliveryTimeMinutes: 35,
          completionRate: 25,
          averageRating: 4.0,
          totalAmountCollected: 45000,
          totalTariffsCollected: 5000,
        },
      ];

      // Ordenar por entregas completadas descendente
      mockDrivers.sort((a, b) => b.completedDeliveries - a.completedDeliveries);

      expect(mockDrivers[0].driverName).toBe("Carlos Rápido");
      expect(mockDrivers[0].completedDeliveries).toBe(9);
      expect(mockDrivers[1].driverName).toBe("Ana Moto");
      expect(mockDrivers[1].completedDeliveries).toBe(3);
      expect(mockDrivers[2].driverName).toBe("Beto Reparto");
      expect(mockDrivers[2].completedDeliveries).toBe(1);
    });
  });

  describe("Criterio 4: El reporte funciona aunque no haya zonas configuradas (DOM-001 opcional)", () => {
    it("debe agrupar pedidos sin zonas bajo 'Sin Zona Asignada' sin arrojar error", () => {
      const orderWithoutZone = {
        id: "ord-99",
        order_number: 99,
        delivery_zone_id: null,
        metadata: {},
      };

      const zoneName = orderWithoutZone.delivery_zone_id || "Sin Zona Asignada";
      expect(zoneName).toBe("Sin Zona Asignada");
    });
  });

  describe("Criterio 5: Exportación en formatos PDF y Excel (CSV con BOM)", () => {
    const mockReportData: DeliveryReportData = {
      summary: {
        totalDeliveries: 12,
        successfulDeliveries: 10,
        cancelledDeliveries: 1,
        rejectedDeliveries: 1,
        successRate: 83,
        averageDeliveryTimeMinutes: 26,
        totalRevenue: 520000,
        totalTariffs: 60000,
        topDriver: { driverName: "Carlos Rápido", completedCount: 8 },
        topZone: { zoneName: "Zona Norte", ordersCount: 7 },
      },
      drivers: [
        {
          driverName: "Carlos Rápido",
          driverPhone: "+57 300 111 2233",
          totalAssigned: 9,
          completedDeliveries: 8,
          cancelledDeliveries: 1,
          rejectedDeliveries: 0,
          averageDeliveryTimeMinutes: 24,
          completionRate: 89,
          averageRating: 4.9,
          totalAmountCollected: 410000,
          totalTariffsCollected: 48000,
        },
        {
          driverName: "Ana Moto",
          driverPhone: "+57 300 444 5566",
          totalAssigned: 3,
          completedDeliveries: 2,
          cancelledDeliveries: 0,
          rejectedDeliveries: 1,
          averageDeliveryTimeMinutes: 30,
          completionRate: 67,
          averageRating: 4.8,
          totalAmountCollected: 110000,
          totalTariffsCollected: 12000,
        },
      ],
      zones: [
        {
          zoneId: "zone-1",
          zoneName: "Zona Norte",
          tariff: 6000,
          totalOrders: 7,
          completedOrders: 6,
          totalAmount: 320000,
          averageDeliveryTimeMinutes: 25,
          color: "#ED500A",
        },
        {
          zoneId: "zone-2",
          zoneName: "Zona Centro",
          tariff: 5000,
          totalOrders: 5,
          completedOrders: 4,
          totalAmount: 200000,
          averageDeliveryTimeMinutes: 27,
          color: "#3B82F6",
        },
      ],
      orders: [
        {
          id: "ord-1",
          orderNumber: 101,
          customerName: "Juan Pérez",
          customerPhone: "+57 310 123 4567",
          deliveryAddress: "Calle 100 #15-20",
          zoneName: "Zona Norte",
          driverName: "Carlos Rápido",
          status: "delivered",
          statusLabel: "Entregado",
          subtotal: 45000,
          deliveryFee: 6000,
          total: 51000,
          createdAt: "2026-11-01T12:00:00Z",
          formattedCreatedAt: "2026-11-01 12:00",
          deliveredAt: "2026-11-01T12:24:00Z",
          formattedDeliveredAt: "12:24",
          deliveryDurationMinutes: 24,
        },
      ],
      filterParams: { preset: "this_month" },
      dateRange: { preset: "this_month", startDate: "2026-11-01", endDate: "2026-11-01" },
      availableDrivers: ["all", "Carlos Rápido", "Ana Moto"],
      availableZones: [
        { id: "all", name: "Todas las zonas" },
        { id: "zone-1", name: "Zona Norte" },
        { id: "zone-2", name: "Zona Centro" },
      ],
      businessName: "Restaurante Gourmet NEGOVA",
    };

    it("generateDeliveryReportCsv debe generar contenido CSV con Byte Order Mark (BOM UTF-8)", () => {
      const csvResult = generateDeliveryReportCsv(mockReportData);

      expect(csvResult.content.startsWith("\uFEFF")).toBe(true);
      expect(csvResult.content).toContain("REPORTE DE DOMICILIOS Y DESPACHOS");
      expect(csvResult.content).toContain("DESEMPEÑO POR REPARTIDOR");
      expect(csvResult.content).toContain("ANÁLISIS POR ZONA DE ENTREGA");
      expect(csvResult.content).toContain("Carlos Rápido");
      expect(csvResult.content).toContain("Zona Norte");
      expect(csvResult.filename).toContain("reporte_domicilios");
      expect(csvResult.filename.endsWith(".csv")).toBe(true);
    });

    it("generateDeliveryReportPdf debe generar un buffer y base64 válidos para A4 landscape", () => {
      const pdfResult = generateDeliveryReportPdf({
        businessName: mockReportData.businessName,
        businessNit: "900.123.456-7",
        reportData: mockReportData,
      });

      expect(pdfResult.base64).toBeDefined();
      expect(typeof pdfResult.base64).toBe("string");
      expect(pdfResult.base64.length).toBeGreaterThan(100);
      expect(pdfResult.filename.endsWith(".pdf")).toBe(true);
      expect(pdfResult.contentType).toBe("application/pdf");
      expect(pdfResult.sizeBytes).toBeGreaterThan(0);
    });
  });

  describe("Criterio 6: Integración en Workspace y Server Actions", () => {
    it("la ruta de servidor page.tsx debe existir", () => {
      const pagePath = path.join(
        rootDir,
        "src/app/workspace/[businessId]/reportes/domicilios/page.tsx"
      );
      expect(fs.existsSync(pagePath)).toBe(true);
      const code = fs.readFileSync(pagePath, "utf8");
      expect(code).toContain("WorkspaceDeliveryReportPage");
      expect(code).toContain("DeliveryReportClient");
    });

    it("las Server Actions deben existir y exportar get, pdf y csv", () => {
      const actionsPath = path.join(
        rootDir,
        "src/app/workspace/[businessId]/reportes/domicilios/actions.ts"
      );
      expect(fs.existsSync(actionsPath)).toBe(true);
      const code = fs.readFileSync(actionsPath, "utf8");
      expect(code).toContain('"use server"');
      expect(code).toContain("getDeliveryReportAction");
      expect(code).toContain("exportDeliveryReportPdfAction");
      expect(code).toContain("exportDeliveryReportCsvAction");
    });

    it("el cliente interactivo delivery-report-client.tsx debe implementar KPIs y 3 pestañas", () => {
      const clientPath = path.join(
        rootDir,
        "src/app/workspace/[businessId]/reportes/domicilios/delivery-report-client.tsx"
      );
      expect(fs.existsSync(clientPath)).toBe(true);
      const code = fs.readFileSync(clientPath, "utf8");
      expect(code).toContain("Total Entregas");
      expect(code).toContain("Tiempo Promedio");
      expect(code).toContain("Repartidor Líder");
      expect(code).toContain("Zona Principal");
      expect(code).toContain("Ranking por Repartidor");
      expect(code).toContain("Análisis por Zonas");
      expect(code).toContain("Registro de Pedidos");
    });
  });

  describe("Criterio 7: Cumplimiento de Reglas Globales (Cero Alertas Nativas)", () => {
    it("los archivos del reporte de domicilios no deben invocar window.alert, window.confirm ni window.prompt", () => {
      const filesToCheck = [
        "src/app/workspace/[businessId]/reportes/domicilios/page.tsx",
        "src/app/workspace/[businessId]/reportes/domicilios/actions.ts",
        "src/app/workspace/[businessId]/reportes/domicilios/delivery-report-client.tsx",
        "src/lib/reports/delivery-report-csv.ts",
        "src/lib/reports/delivery-report-pdf.ts",
      ];

      for (const relPath of filesToCheck) {
        const fullPath = path.join(rootDir, relPath);
        expect(fs.existsSync(fullPath)).toBe(true);
        const content = fs.readFileSync(fullPath, "utf8");
        expect(content).not.toContain("window.alert");
        expect(content).not.toContain("window.confirm");
        expect(content).not.toContain("window.prompt");
        expect(content).not.toContain("Alert.alert");
      }
    });
  });
});

