import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  getLocalDateString,
  getInventoryReportData,
} from "@/lib/reports/reports-service";
import { generateInventoryReportPdf } from "@/lib/reports/inventory-report-pdf";
import { generateInventoryReportCsv } from "@/lib/reports/inventory-report-csv";
import {
  InventoryReportFilterParams,
  InventoryReportData,
} from "@/lib/reports/types";

// Mock de Supabase para pruebas unitarias deterministas
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

describe("[REP-004] Reporte Integral de Inventario, Existencias y Alertas", () => {
  const businessId = "biz-inv-rep-004";
  const timezone = "America/Bogota";

  const now = new Date();
  const todayStr = getLocalDateString(now, timezone);
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = getLocalDateString(yesterdayDate, timezone);

  // Mocks de Base de Datos
  const mockLocations = [
    { id: "loc-bodega", name: "Bodega Principal", type: "warehouse", is_active: true },
    { id: "loc-pos", name: "Punto de Venta Central", type: "point_of_sale", is_active: true },
  ];

  const mockCategories = [
    { id: "cat-carnes", name: "Carnes y Proteínas" },
    { id: "cat-bebidas", name: "Bebidas y Licores" },
  ];

  const mockProfiles = [
    { id: "user-1", full_name: "Admin Inventarios", email: "admin@negova.com" },
    { id: "user-2", full_name: "Cajero Turno", email: "cajero@negova.com" },
  ];

  const mockStock = [
    // 1. Stock Normal: Carne para Hamburguesa en Bodega
    {
      id: "stock-1",
      business_id: businessId,
      product_id: "prod-1",
      location_id: "loc-bodega",
      quantity: 50,
      min_stock: 20,
      cost: 5000,
      updated_at: `${todayStr}T10:00:00Z`,
      products: {
        id: "prod-1",
        name: "Carne para Hamburguesa",
        sku: "CAR-001",
        category_id: "cat-carnes",
        cost: 5000,
        price: 9000,
        is_active: true,
        metadata: { sku: "CAR-001" },
        categories: { id: "cat-carnes", name: "Carnes y Proteínas" },
      },
      locations: { id: "loc-bodega", name: "Bodega Principal", type: "warehouse", is_active: true },
    },
    // 2. Stock Bajo: Pan Brioche en Bodega (8 <= 25)
    {
      id: "stock-2",
      business_id: businessId,
      product_id: "prod-2",
      location_id: "loc-bodega",
      quantity: 8,
      min_stock: 25,
      cost: 1200,
      updated_at: `${todayStr}T11:00:00Z`,
      products: {
        id: "prod-2",
        name: "Pan Brioche",
        sku: "PAN-001",
        category_id: "cat-carnes",
        cost: 1200,
        price: 2500,
        is_active: true,
        metadata: { sku: "PAN-001" },
        categories: { id: "cat-carnes", name: "Carnes y Proteínas" },
      },
      locations: { id: "loc-bodega", name: "Bodega Principal", type: "warehouse", is_active: true },
    },
    // 3. Agotado: Cerveza Artesanal en POS (0 <= 10)
    {
      id: "stock-3",
      business_id: businessId,
      product_id: "prod-3",
      location_id: "loc-pos",
      quantity: 0,
      min_stock: 10,
      cost: 4500,
      updated_at: `${todayStr}T12:00:00Z`,
      products: {
        id: "prod-3",
        name: "Cerveza Artesanal",
        sku: "CER-001",
        category_id: "cat-bebidas",
        cost: 4500,
        price: 12000,
        is_active: true,
        metadata: { sku: "CER-001" },
        categories: { id: "cat-bebidas", name: "Bebidas y Licores" },
      },
      locations: { id: "loc-pos", name: "Punto de Venta Central", type: "point_of_sale", is_active: true },
    },
    // 4. Stock Normal: Gaseosa Cola en POS
    {
      id: "stock-4",
      business_id: businessId,
      product_id: "prod-4",
      location_id: "loc-pos",
      quantity: 30,
      min_stock: 15,
      cost: 2000,
      updated_at: `${todayStr}T13:00:00Z`,
      products: {
        id: "prod-4",
        name: "Gaseosa Cola",
        sku: "GAS-001",
        category_id: "cat-bebidas",
        cost: 2000,
        price: 4500,
        is_active: true,
        metadata: { sku: "GAS-001" },
        categories: { id: "cat-bebidas", name: "Bebidas y Licores" },
      },
      locations: { id: "loc-pos", name: "Punto de Venta Central", type: "point_of_sale", is_active: true },
    },
  ];

  const mockMovements = [
    // Movimiento 1: Entrada por Compra de proveedor
    {
      id: "mov-1",
      business_id: businessId,
      product_id: "prod-1",
      location_id: "loc-bodega",
      movement_type: "entry",
      quantity: 50,
      unit_cost: 5000,
      total_cost: 250000,
      reference_id: "pur-12345678-0000",
      reference_type: "purchase",
      notes: "Compra COM-101 - Fac. 9988",
      created_by: "user-1",
      created_at: `${todayStr}T09:00:00Z`,
      products: { id: "prod-1", name: "Carne para Hamburguesa", sku: "CAR-001", metadata: { sku: "CAR-001" } },
      locations: { id: "loc-bodega", name: "Bodega Principal" },
    },
    // Movimiento 2: Salida por Venta en POS
    {
      id: "mov-2",
      business_id: businessId,
      product_id: "prod-2",
      location_id: "loc-bodega",
      movement_type: "sale",
      quantity: -12,
      unit_cost: 1200,
      total_cost: 14400,
      reference_id: "ord-abcdef12-0000",
      reference_type: "sale",
      notes: "Venta POS #1024",
      created_by: "user-2",
      created_at: `${todayStr}T10:30:00Z`,
      products: { id: "prod-2", name: "Pan Brioche", sku: "PAN-001", metadata: { sku: "PAN-001" } },
      locations: { id: "loc-bodega", name: "Bodega Principal" },
    },
    // Movimiento 3: Ajuste de inventario físico
    {
      id: "mov-3",
      business_id: businessId,
      product_id: "prod-3",
      location_id: "loc-pos",
      movement_type: "adjustment",
      quantity: -2,
      unit_cost: 4500,
      total_cost: 9000,
      reference_id: null,
      reference_type: "adjustment",
      notes: "Arqueo físico mensual",
      created_by: "user-1",
      created_at: `${todayStr}T11:15:00Z`,
      products: { id: "prod-3", name: "Cerveza Artesanal", sku: "CER-001", metadata: { sku: "CER-001" } },
      locations: { id: "loc-pos", name: "Punto de Venta Central" },
    },
    // Movimiento 4: Transferencia entre almacenes
    {
      id: "mov-4",
      business_id: businessId,
      product_id: "prod-4",
      location_id: "loc-pos",
      movement_type: "transfer_in",
      quantity: 15,
      unit_cost: 2000,
      total_cost: 30000,
      reference_id: "trf-98765432-0000",
      reference_type: "transfer",
      notes: "Transferencia desde Bodega Principal",
      created_by: "user-2",
      created_at: `${todayStr}T12:00:00Z`,
      products: { id: "prod-4", name: "Gaseosa Cola", sku: "GAS-001", metadata: { sku: "GAS-001" } },
      locations: { id: "loc-pos", name: "Punto de Venta Central" },
    },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "inventory_stock") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: mockStock,
              error: null,
            }),
          };
        }
        if (table === "inventory_movements") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: mockMovements,
              error: null,
            }),
          };
        }
        if (table === "locations") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: mockLocations,
              error: null,
            }),
          };
        }
        if (table === "categories") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: mockCategories,
              error: null,
            }),
          };
        }
        if (table === "profiles") {
          return {
            select: vi.fn().mockResolvedValue({
              data: mockProfiles,
              error: null,
            }),
          };
        }
        if (table === "businesses") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: businessId, name: "Restaurante Gourmet SAS", commercial_name: "Gourmet NEGOVA" },
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }),
    };

    const { createClient } = await import("@/lib/supabase/server");
    (createClient as any).mockResolvedValue(mockSupabase);

    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    (createAdminClient as any).mockReturnValue(mockSupabase);
  });

  it("1. Criterio de Aceptación: Las existencias mostradas coinciden con inventory_stock", async () => {
    const report = await getInventoryReportData(businessId, {}, timezone);

    expect(report.stockRows).toHaveLength(4);

    const carne = report.stockRows.find((r) => r.productName === "Carne para Hamburguesa");
    expect(carne).toBeDefined();
    expect(carne?.quantity).toBe(50);
    expect(carne?.minStock).toBe(20);
    expect(carne?.cost).toBe(5000);
    expect(carne?.locationName).toBe("Bodega Principal");
    expect(carne?.categoryName).toBe("Carnes y Proteínas");

    const pan = report.stockRows.find((r) => r.productName === "Pan Brioche");
    expect(pan).toBeDefined();
    expect(pan?.quantity).toBe(8);
    expect(pan?.minStock).toBe(25);

    const cerveza = report.stockRows.find((r) => r.productName === "Cerveza Artesanal");
    expect(cerveza).toBeDefined();
    expect(cerveza?.quantity).toBe(0);
    expect(cerveza?.minStock).toBe(10);
  });

  it("2. Criterio de Aceptación: El valor total del inventario = Σ(quantity × cost) de todos los productos", async () => {
    const report = await getInventoryReportData(businessId, {}, timezone);

    // Cálculos esperados:
    // Carne: 50 * 5000 = 250.000
    // Pan: 8 * 1200 = 9.600
    // Cerveza: 0 * 4500 = 0
    // Gaseosa: 30 * 2000 = 60.000
    // Total Valor = 250.000 + 9.600 + 0 + 60.000 = 319.600 COP
    const expectedTotalValue = 50 * 5000 + 8 * 1200 + 0 * 4500 + 30 * 2000;
    expect(report.summary.totalInventoryValue).toBe(expectedTotalValue);
    expect(report.summary.totalInventoryValue).toBe(319600);

    // Suma de existencias
    expect(report.summary.totalItemsCount).toBe(88); // 50 + 8 + 0 + 30
    expect(report.summary.totalProductsCount).toBe(4);
  });

  it("3. Criterio de Aceptación: Los movimientos muestran referencia a la orden/compra/ajuste que los generó", async () => {
    const report = await getInventoryReportData(businessId, {}, timezone);

    expect(report.movementsRows).toHaveLength(4);

    // Movimiento 1 (Compra)
    const movCompra = report.movementsRows.find((m) => m.referenceType === "purchase");
    expect(movCompra).toBeDefined();
    expect(movCompra?.referenceLabel).toContain("Compra COM-101 - Fac. 9988");
    expect(movCompra?.createdByName).toBe("Admin Inventarios");
    expect(movCompra?.movementTypeLabel).toBe("Entrada de Stock");

    // Movimiento 2 (Venta)
    const movVenta = report.movementsRows.find((m) => m.referenceType === "sale");
    expect(movVenta).toBeDefined();
    expect(movVenta?.referenceLabel).toContain("Venta POS #1024");
    expect(movVenta?.createdByName).toBe("Cajero Turno");
    expect(movVenta?.movementTypeLabel).toBe("Venta");

    // Movimiento 3 (Ajuste)
    const movAjuste = report.movementsRows.find((m) => m.referenceType === "adjustment");
    expect(movAjuste).toBeDefined();
    expect(movAjuste?.referenceLabel).toContain("Ajuste: Arqueo físico mensual");
    expect(movAjuste?.movementTypeLabel).toBe("Ajuste de Inventario");

    // Movimiento 4 (Transferencia)
    const movTransfer = report.movementsRows.find((m) => m.referenceType === "transfer");
    expect(movTransfer).toBeDefined();
    expect(movTransfer?.referenceLabel).toContain("Transferencia desde Bodega Principal");
    expect(movTransfer?.movementTypeLabel).toBe("Transferencia (Entrada)");
  });

  it("4. Criterio de Aceptación: Productos bajo mínimo se destacan visualmente con badge de alerta y cálculo de déficit", async () => {
    const report = await getInventoryReportData(businessId, {}, timezone);

    expect(report.summary.lowStockCount).toBe(1); // Pan Brioche (8 <= 25)
    expect(report.summary.outOfStockCount).toBe(1); // Cerveza Artesanal (0 <= 10)
    expect(report.summary.normalStockCount).toBe(2);

    expect(report.lowStockRows).toHaveLength(2);

    const panBajo = report.lowStockRows.find((r) => r.productName === "Pan Brioche");
    expect(panBajo).toBeDefined();
    expect(panBajo?.status).toBe("low");
    expect(panBajo?.statusLabel).toBe("Stock Bajo");
    expect(panBajo?.quantity).toBe(8);
    expect(panBajo?.minStock).toBe(25);
    expect(panBajo?.deficit).toBe(17); // 25 - 8 = 17 unidades requeridas
    expect(panBajo?.replenishmentCost).toBe(17 * 1200); // 20.400 COP

    const cervezaAgotada = report.lowStockRows.find((r) => r.productName === "Cerveza Artesanal");
    expect(cervezaAgotada).toBeDefined();
    expect(cervezaAgotada?.status).toBe("out_of_stock");
    expect(cervezaAgotada?.statusLabel).toBe("Agotado");
    expect(cervezaAgotada?.quantity).toBe(0);
    expect(cervezaAgotada?.deficit).toBe(10);
    expect(cervezaAgotada?.replenishmentCost).toBe(10 * 4500); // 45.000 COP
  });

  it("5. Filtros: filtra existencias por ubicación y categoría correctamente", async () => {
    // Filtro por ubicación 'loc-pos' (Punto de Venta)
    const posReport = await getInventoryReportData(
      businessId,
      { locationId: "loc-pos" },
      timezone
    );
    expect(posReport.stockRows).toHaveLength(2); // Cerveza y Gaseosa
    posReport.stockRows.forEach((r) => {
      expect(r.locationId).toBe("loc-pos");
    });
    // Valor total en POS: Gaseosa (30 * 2000) = 60.000 COP
    expect(posReport.summary.totalInventoryValue).toBe(60000);

    // Filtro por categoría 'cat-carnes'
    const carnesReport = await getInventoryReportData(
      businessId,
      { categoryId: "cat-carnes" },
      timezone
    );
    expect(carnesReport.stockRows).toHaveLength(2); // Carne y Pan
    carnesReport.stockRows.forEach((r) => {
      expect(r.categoryId).toBe("cat-carnes");
    });
  });

  it("6. Filtros: búsqueda por texto en nombre de producto o SKU", async () => {
    const searchReport = await getInventoryReportData(
      businessId,
      { search: "pan" },
      timezone
    );
    expect(searchReport.stockRows).toHaveLength(1);
    expect(searchReport.stockRows[0].productName).toBe("Pan Brioche");

    const skuReport = await getInventoryReportData(
      businessId,
      { search: "GAS-001" },
      timezone
    );
    expect(skuReport.stockRows).toHaveLength(1);
    expect(skuReport.stockRows[0].productName).toBe("Gaseosa Cola");
  });

  it("7. Exportación a CSV con formato compatible Excel y BOM UTF-8", async () => {
    const reportData = await getInventoryReportData(businessId, {}, timezone);

    // Exportar Existencias
    const csvResult = generateInventoryReportCsv(reportData, "existencias");
    expect(csvResult.filename).toContain("reporte_inventario_existencias_");
    expect(csvResult.contentType).toContain("text/csv");
    expect(csvResult.content.startsWith("\uFEFF")).toBe(true); // Byte Order Mark para Excel
    expect(csvResult.content).toContain("Carne para Hamburguesa");
    expect(csvResult.content).toContain("Pan Brioche");
    expect(csvResult.content).toContain("TOTALES GENERALES");
    expect(csvResult.content).toContain("319600.00");

    // Exportar Movimientos
    const csvMov = generateInventoryReportCsv(reportData, "movimientos");
    expect(csvMov.filename).toContain("reporte_movimientos_inventario_");
    expect(csvMov.content).toContain("Compra COM-101 - Fac. 9988");
    expect(csvMov.content).toContain("Admin Inventarios");
    expect(csvMov.content).toContain("Venta POS #1024");

    // Exportar Stock Bajo
    const csvBajo = generateInventoryReportCsv(reportData, "bajo_stock");
    expect(csvBajo.filename).toContain("reporte_stock_bajo_");
    expect(csvBajo.content).toContain("Pan Brioche");
    expect(csvBajo.content).toContain("Cerveza Artesanal");
    expect(csvBajo.content).toContain("Stock Bajo");
    expect(csvBajo.content).toContain("Agotado");
  });

  it("8. Exportación a PDF formal con membrete institucional, tarjetas y paginación", async () => {
    const reportData = await getInventoryReportData(businessId, {}, timezone);

    const pdfResult = generateInventoryReportPdf({
      businessName: "Gourmet NEGOVA",
      businessNit: "900.123.456-7",
      businessAddress: "Calle 100 # 15-20",
      businessPhone: "3001234567",
      reportData,
      view: "existencias",
    });

    expect(pdfResult.filename).toContain("reporte_inventario_existencias_");
    expect(pdfResult.contentType).toBe("application/pdf");
    expect(pdfResult.base64).toBeDefined();
    expect(pdfResult.base64.length).toBeGreaterThan(500);

    // Comprobar decodificación binaria de PDF
    const decoded = Buffer.from(pdfResult.base64, "base64").toString("utf-8");
    expect(decoded.startsWith("%PDF-")).toBe(true);
  });

  it("9. Regla Global: Cero alertas nativas (window.alert, window.confirm, window.prompt, Alert.alert)", () => {
    const filesToCheck = [
      "src/lib/reports/types.ts",
      "src/lib/reports/reports-service.ts",
      "src/lib/reports/inventory-report-csv.ts",
      "src/lib/reports/inventory-report-pdf.ts",
      "src/app/workspace/[businessId]/reportes/inventario/actions.ts",
      "src/app/workspace/[businessId]/reportes/inventario/inventory-report-client.tsx",
      "src/app/workspace/[businessId]/reportes/inventario/page.tsx",
    ];

    const forbiddenPatterns = [
      "window.alert",
      "window.confirm",
      "window.prompt",
      "Alert.alert",
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.resolve(process.cwd(), relPath);
      expect(fs.existsSync(fullPath)).toBe(true);
      const content = fs.readFileSync(fullPath, "utf-8");

      for (const pattern of forbiddenPatterns) {
        expect(content).not.toContain(pattern);
      }
    }
  });
});
