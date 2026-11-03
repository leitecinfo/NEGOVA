import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  getLocalDateString,
  getSalesReportData,
} from "@/lib/reports/reports-service";
import { generateSalesReportPdf } from "@/lib/reports/sales-report-pdf";
import { generateSalesReportCsv } from "@/lib/reports/sales-report-csv";
import { SalesReportFilterParams, BusinessReportInfo } from "@/lib/reports/types";

// Mock de Supabase para pruebas unitarias deterministas
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

describe("[REP-002] Reporte de Ventas con Exportación PDF y Excel", () => {
  const businessId = "biz-sales-rep-002";
  const timezone = "America/Bogota";

  const now = new Date();
  const todayStr = getLocalDateString(now, timezone);
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = getLocalDateString(yesterdayDate, timezone);

  const mockBusinessInfo: BusinessReportInfo = {
    id: businessId,
    name: "Restaurante Don Negova",
    nit: "900.123.456-7",
    address: "Cra 10 # 25-40, Bogotá",
    phone: "+57 300 123 4567",
    email: "admin@negova.test",
    currency: "COP",
    logoUrl: "https://negova.test/logo.png",
  };

  const mockDocs = [
    // 1. Venta de HOY - Mesa (efectivo)
    {
      id: "doc-1",
      business_id: businessId,
      restaurant_order_id: "order-1",
      document_number: "POS-001",
      total: 50000,
      subtotal: 42017,
      tax_total: 7983,
      discount_total: 0,
      payment_method: "cash",
      issued_at: `${todayStr}T11:00:00Z`,
      status: "completed",
      client_name: "Juan Pérez",
      client_tax_id: "1018223344",
      created_by: "user-cajero-1",
      notes: "Atención mesa 4",
    },
    // 2. Venta de HOY - Domicilio (tarjeta)
    {
      id: "doc-2",
      business_id: businessId,
      restaurant_order_id: "order-2",
      document_number: "POS-002",
      total: 35000,
      subtotal: 29412,
      tax_total: 5588,
      discount_total: 5000,
      payment_method: "card",
      issued_at: `${todayStr}T12:30:00Z`,
      status: "completed",
      client_name: "María Gómez",
      client_tax_id: "52889900",
      created_by: "user-cajero-2",
      notes: "Domicilio Zona Norte",
    },
    // 3. Venta de AYER - Mostrador (transferencia)
    {
      id: "doc-3",
      business_id: businessId,
      restaurant_order_id: null,
      document_number: "POS-003",
      total: 20000,
      subtotal: 16807,
      tax_total: 3193,
      discount_total: 0,
      payment_method: "transfer",
      issued_at: `${yesterdayStr}T16:00:00Z`,
      status: "completed",
      client_name: "Carlos Ruiz",
      client_tax_id: "79123456",
      created_by: "user-cajero-1",
      notes: null,
    },
    // 4. Venta ANULADA de HOY - Mesa (con motivo en notas)
    {
      id: "doc-cancelled-1",
      business_id: businessId,
      restaurant_order_id: "order-3",
      document_number: "POS-004-CANC",
      total: 80000,
      subtotal: 67227,
      tax_total: 12773,
      discount_total: 0,
      payment_method: "cash",
      issued_at: `${todayStr}T13:00:00Z`,
      status: "cancelled",
      client_name: "Pedro Cliente",
      client_tax_id: "10987654",
      created_by: "user-cajero-1",
      notes: "Cancelación: Error al digitar pedido duplicado por el mesero",
    },
  ];

  const mockOrders = [
    { id: "order-1", order_type: "dine_in", channel_origin: "in_person" },
    { id: "order-2", order_type: "delivery", channel_origin: "whatsapp" },
    { id: "order-3", order_type: "dine_in", channel_origin: "in_person" },
  ];

  const mockProfiles = [
    { id: "user-cajero-1", full_name: "Andrés Cajero Principal", email: "andres@negova.test" },
    { id: "user-cajero-2", full_name: "Beatriz Cajera Domicilios", email: "beatriz@negova.test" },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "businesses") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: businessId, name: "Restaurante Don Negova", commercial_name: "Don Negova" },
              error: null,
            }),
          };
        }
        if (table === "business_sale_documents") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: mockDocs,
              error: null,
            }),
          };
        }
        if (table === "restaurant_orders") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: mockOrders,
              error: null,
            }),
          };
        }
        if (table === "profiles") {
          const res = { data: mockProfiles, error: null };
          return {
            select: vi.fn().mockImplementation(() => ({
              then: (onfulfilled: any) => Promise.resolve(res).then(onfulfilled),
              in: vi.fn().mockResolvedValue(res),
            })),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }),
    };

    const { createClient } = await import("@/lib/supabase/server");
    (createClient as any).mockResolvedValue(mockSupabase);

    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    (createAdminClient as any).mockReturnValue(mockSupabase);
  });

  it("1. La consulta retorna todas las ventas del período seleccionado (preset today)", async () => {
    const filters: SalesReportFilterParams = {
      preset: "today",
      status: "completed",
    };

    const result = await getSalesReportData(businessId, filters, timezone);

    expect(result.rows).toHaveLength(2); // doc-1 y doc-2 de hoy
    const docNumbers = result.rows.map((r) => r.documentNumber);
    expect(docNumbers).toContain("POS-001");
    expect(docNumbers).toContain("POS-002");
    expect(result.summary.transactionCount).toBe(2);
  });

  it("2. Los totales del resumen coinciden con la suma de las filas visibles", async () => {
    const filters: SalesReportFilterParams = {
      preset: "last_7_days",
      status: "completed",
    };

    const result = await getSalesReportData(businessId, filters, timezone);

    // Filas: doc-1 (50000), doc-2 (35000), doc-3 (20000) = 105000
    const calculatedGross = result.rows.reduce((sum, r) => sum + r.subtotal, 0);
    const calculatedTax = result.rows.reduce((sum, r) => sum + r.taxTotal, 0);
    const calculatedDiscount = result.rows.reduce((sum, r) => sum + r.discountTotal, 0);
    const calculatedNet = result.rows.reduce((sum, r) => sum + r.total, 0);

    expect(result.summary.totalGross).toBe(calculatedGross);
    expect(result.summary.totalTax).toBe(calculatedTax);
    expect(result.summary.totalDiscount).toBe(calculatedDiscount);
    expect(result.summary.totalNet).toBe(calculatedNet);
    expect(result.summary.transactionCount).toBe(result.rows.length);
    expect(result.summary.totalNet).toBe(105000);
  });

  it("3. Filtrar por 'anuladas' muestra solo ventas canceladas con motivo", async () => {
    const filters: SalesReportFilterParams = {
      preset: "today",
      status: "cancelled",
    };

    const result = await getSalesReportData(businessId, filters, timezone);

    expect(result.rows).toHaveLength(1);
    const cancelledRow = result.rows[0];
    expect(cancelledRow.documentNumber).toBe("POS-004-CANC");
    expect(cancelledRow.status).toBe("cancelled");
    expect(cancelledRow.cancellationReason).toContain("Error al digitar pedido duplicado");
  });

  it("4. Filtra adecuadamente por canal de venta (domicilio)", async () => {
    const filters: SalesReportFilterParams = {
      preset: "last_7_days",
      channel: "domicilio",
      status: "all",
    };

    const result = await getSalesReportData(businessId, filters, timezone);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].documentNumber).toBe("POS-002");
    expect(result.rows[0].channel).toBe("domicilio");
    expect(result.rows[0].channelLabel).toBe("Domicilio");
  });

  it("5. Filtra por método de pago (cash) y empleado", async () => {
    const filters: SalesReportFilterParams = {
      preset: "last_7_days",
      paymentMethod: "cash",
      employeeId: "user-cajero-1",
      status: "completed",
    };

    const result = await getSalesReportData(businessId, filters, timezone);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].documentNumber).toBe("POS-001");
    expect(result.rows[0].employeeName).toBe("Andrés Cajero Principal");
  });

  it("6. El PDF se genera con el logo del negocio si existe y contiene membrete y resumen", async () => {
    const filters: SalesReportFilterParams = {
      preset: "today",
      status: "all",
    };

    const reportData = await getSalesReportData(businessId, filters, timezone);
    const pdfResult = generateSalesReportPdf({
      businessName: mockBusinessInfo.name,
      businessNit: mockBusinessInfo.nit,
      businessAddress: mockBusinessInfo.address,
      businessPhone: mockBusinessInfo.phone,
      logoUrl: mockBusinessInfo.logoUrl,
      reportData,
    });

    expect(pdfResult.buffer).toBeInstanceOf(Buffer);
    expect(pdfResult.buffer.length).toBeGreaterThan(1000); // Archivo PDF binario real

    // Comprobamos la firma mágica del encabezado PDF: %PDF-
    const pdfHeader = pdfResult.buffer.slice(0, 5).toString("utf-8");
    expect(pdfHeader).toBe("%PDF-");
  });

  it("7. El archivo Excel (CSV) contiene todas las columnas requeridas y filas sin truncar con BOM UTF-8", async () => {
    const filters: SalesReportFilterParams = {
      preset: "last_7_days",
      status: "all",
    };

    const reportData = await getSalesReportData(businessId, filters, timezone);
    const csvResult = generateSalesReportCsv(reportData);
    const csvContent = csvResult.content;

    // Debe incluir UTF-8 Byte Order Mark para correcta apertura en Excel
    expect(csvContent.charCodeAt(0)).toBe(0xfeff);

    // Verificar encabezados
    expect(csvContent).toContain("Fecha y Hora");
    expect(csvContent).toContain("No. Documento");
    expect(csvContent).toContain("Cliente");
    expect(csvContent).toContain("Canal de Venta");
    expect(csvContent).toContain("Método de Pago");
    expect(csvContent).toContain("Subtotal");
    expect(csvContent).toContain("Impuestos (IVA)");
    expect(csvContent).toContain("Descuento");
    expect(csvContent).toContain("Total Neto");
    expect(csvContent).toContain("Estado");
    expect(csvContent).toContain("Motivo de Anulación");

    // Verificar filas de datos
    expect(csvContent).toContain("POS-001");
    expect(csvContent).toContain("POS-002");
    expect(csvContent).toContain("POS-003");
    expect(csvContent).toContain("POS-004-CANC");
    expect(csvContent).toContain("Error al digitar pedido duplicado");

    // Verificar fila de resumen / totales
    expect(csvContent).toContain("TOTALES");
    expect(csvContent).toContain("4 transacciones");
  });

  it("8. Regla Global: Prohibido uso de alertas nativas (window.alert, window.confirm, window.prompt, Alert.alert)", () => {
    const filesToCheck = [
      "src/lib/reports/types.ts",
      "src/lib/reports/reports-service.ts",
      "src/lib/reports/sales-report-pdf.ts",
      "src/lib/reports/sales-report-csv.ts",
      "src/app/workspace/[businessId]/reportes/ventas/actions.ts",
      "src/app/workspace/[businessId]/reportes/ventas/sales-report-client.tsx",
      "src/app/workspace/[businessId]/reportes/ventas/page.tsx",
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
