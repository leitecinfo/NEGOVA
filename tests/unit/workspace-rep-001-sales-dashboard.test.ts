import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  getLocalDateString,
  getSalesDashboardMetrics,
} from "@/lib/reports/reports-service";
import { ReportsDateRange } from "@/lib/reports/types";

// Mock de Supabase para pruebas unitarias deterministas
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

describe("[REP-001] Dashboard de KPIs de Ventas", () => {
  const businessId = "biz-test-123";
  const timezone = "America/Bogota";

  // Fechas de referencia
  const now = new Date();
  const todayStr = getLocalDateString(now, timezone);
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = getLocalDateString(yesterdayDate, timezone);

  // Documentos de venta simulados
  const mockDocs = [
    // 1. Venta de HOY - Mesa (Salón)
    {
      id: "doc-1",
      business_id: businessId,
      restaurant_order_id: "order-1",
      document_number: "POS-0001",
      total: 50000,
      subtotal: 45000,
      issued_at: `${todayStr}T12:00:00Z`,
      status: "completed",
      items: [
        { productId: "p-1", description: "Hamburguesa Doble", quantity: 2, total: 40000 },
        { productId: "p-2", description: "Gaseosa 400ml", quantity: 2, total: 10000 },
      ],
    },
    // 2. Venta de HOY - Domicilio WhatsApp
    {
      id: "doc-2",
      business_id: businessId,
      restaurant_order_id: "order-2",
      document_number: "POS-0002",
      total: 35000,
      subtotal: 30000,
      issued_at: `${todayStr}T13:30:00Z`,
      status: "completed",
      items: [
        { productId: "p-1", description: "Hamburguesa Doble", quantity: 1, total: 20000 },
        { productId: "p-3", description: "Papas Rústicas", quantity: 1, total: 15000 },
      ],
    },
    // 3. Venta de AYER - Menú Digital QR
    {
      id: "doc-3",
      business_id: businessId,
      restaurant_order_id: "order-3",
      document_number: "POS-0003",
      total: 60000,
      subtotal: 55000,
      issued_at: `${yesterdayStr}T19:00:00Z`,
      status: "completed",
      items: [
        { productId: "p-4", description: "Pizza Familiar", quantity: 1, total: 60000 },
      ],
    },
    // 4. Venta de AYER - Mostrador directo (sin comanda de restaurante)
    {
      id: "doc-4",
      business_id: businessId,
      restaurant_order_id: null,
      document_number: "POS-0004",
      total: 25000,
      subtotal: 25000,
      issued_at: `${yesterdayStr}T10:15:00Z`,
      status: "completed",
      items: [
        { productId: "p-2", description: "Gaseosa 400ml", quantity: 5, total: 25000 },
      ],
    },
    // 5. Documento cancelado (no debe sumarse a los KPIs)
    {
      id: "doc-cancelled",
      business_id: businessId,
      restaurant_order_id: null,
      document_number: "POS-0005",
      total: 100000,
      subtotal: 100000,
      issued_at: `${todayStr}T14:00:00Z`,
      status: "cancelled",
      items: [],
    },
  ];

  const mockOrders = [
    { id: "order-1", order_type: "dine_in", channel_origin: "in_person" },
    { id: "order-2", order_type: "delivery", channel_origin: "whatsapp" },
    { id: "order-3", order_type: "dine_in", channel_origin: "digital_menu" },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "business_sale_documents") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            neq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: mockDocs.filter((d) => d.status !== "cancelled"),
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

  it("1. Calcula correctamente los montos y transacciones del día, semana y mes", async () => {
    const data = await getSalesDashboardMetrics(businessId, { preset: "today" }, timezone);

    expect(data.kpis).toBeDefined();
    // Hoy: doc-1 ($50.000) + doc-2 ($35.000) = $85.000 (2 transacciones)
    expect(data.kpis.todaySalesAmount).toBe(85000);
    expect(data.kpis.todayTransactionsCount).toBe(2);

    // En el filtro 'today', el periodo refleja hoy
    expect(data.kpis.periodSalesAmount).toBe(85000);
    expect(data.kpis.periodTransactionsCount).toBe(2);
    expect(data.kpis.averageTicketAmount).toBe(42500); // 85000 / 2
    expect(data.isEmpty).toBe(false);
  });

  it("2. El gráfico de barras de 7 días y la tendencia de 30 días retornan series estructuradas", async () => {
    const data = await getSalesDashboardMetrics(businessId, { preset: "today" }, timezone);

    expect(data.last7DaysDailySales).toHaveLength(7);
    const todayItem = data.last7DaysDailySales.find((d) => d.date === todayStr);
    expect(todayItem).toBeDefined();
    expect(todayItem?.totalAmount).toBe(85000);
    expect(todayItem?.transactionsCount).toBe(2);

    const yesterdayItem = data.last7DaysDailySales.find((d) => d.date === yesterdayStr);
    expect(yesterdayItem).toBeDefined();
    expect(yesterdayItem?.totalAmount).toBe(85000); // doc-3 (60.000) + doc-4 (25.000)
    expect(yesterdayItem?.transactionsCount).toBe(2);

    // Serie acumulada de 30 días
    expect(data.last30DaysTrendSales).toHaveLength(30);
    const last30Today = data.last30DaysTrendSales.find((d) => d.date === todayStr);
    expect(last30Today).toBeDefined();
    expect(last30Today?.totalAmount).toBe(85000);
    expect(last30Today?.accumulatedAmount).toBeGreaterThanOrEqual(170000);
  });

  it("3. Cambiar el filtro a 'yesterday' actualiza las métricas y ticket promedio del periodo", async () => {
    const data = await getSalesDashboardMetrics(businessId, { preset: "yesterday" }, timezone);

    // Ayer: doc-3 (60.000) + doc-4 (25.000) = 85.000
    expect(data.kpis.periodSalesAmount).toBe(85000);
    expect(data.kpis.periodTransactionsCount).toBe(2);
    expect(data.kpis.averageTicketAmount).toBe(42500);

    // Las métricas fijas de hoy se preservan independientemente del filtro
    expect(data.kpis.todaySalesAmount).toBe(85000);
  });

  it("4. Desglosa las ventas por canal (mesa, domicilio, menú QR, mostrador) e identifica el canal líder", async () => {
    const data = await getSalesDashboardMetrics(businessId, { preset: "last_7_days" }, timezone);

    // Total analizado en los 7 días: 170.000
    expect(data.kpis.periodSalesAmount).toBe(170000);
    expect(data.channels).toHaveLength(4);

    const mesa = data.channels.find((c) => c.channel === "mesa");
    const domicilio = data.channels.find((c) => c.channel === "domicilio");
    const digitalMenu = data.channels.find((c) => c.channel === "digital_menu");
    const mostrador = data.channels.find((c) => c.channel === "mostrador");

    expect(mesa?.totalAmount).toBe(50000);
    expect(domicilio?.totalAmount).toBe(35000);
    expect(digitalMenu?.totalAmount).toBe(60000);
    expect(mostrador?.totalAmount).toBe(25000);

    // Canal líder en 7 días debe ser digital_menu (60.000)
    expect(data.kpis.topChannel).toBeDefined();
    expect(data.kpis.topChannel?.channel).toBe("digital_menu");
    expect(data.kpis.topChannel?.totalAmount).toBe(60000);
  });

  it("5. Ranking de productos más vendidos calcula cantidades e ingresos (Top 5)", async () => {
    const data = await getSalesDashboardMetrics(businessId, { preset: "last_7_days" }, timezone);

    expect(data.topProducts.length).toBeLessThanOrEqual(5);

    // Hamburguesa Doble: 2 de doc-1 (40.000) + 1 de doc-2 (20.000) = 3 unidades, $60.000
    // Pizza Familiar: 1 de doc-3 = 1 unidad, $60.000
    // Gaseosa 400ml: 2 de doc-1 (10.000) + 5 de doc-4 (25.000) = 7 unidades, $35.000
    // Papas Rústicas: 1 de doc-2 = 1 unidad, $15.000

    const topProductNames = data.topProducts.map((p) => p.productName);
    expect(topProductNames).toContain("Hamburguesa Doble");
    expect(topProductNames).toContain("Pizza Familiar");
    expect(topProductNames).toContain("Gaseosa 400ml");
    expect(topProductNames).toContain("Papas Rústicas");

    const gaseosa = data.topProducts.find((p) => p.productName === "Gaseosa 400ml");
    expect(gaseosa?.quantitySold).toBe(7);
    expect(gaseosa?.revenue).toBe(35000);
  });

  it("6. Rango de fecha personalizado ('custom') filtra adecuadamente", async () => {
    const customRange: ReportsDateRange = {
      preset: "custom",
      startDate: todayStr,
      endDate: todayStr,
    };

    const data = await getSalesDashboardMetrics(businessId, customRange, timezone);
    expect(data.kpis.periodSalesAmount).toBe(85000);
    expect(data.kpis.periodTransactionsCount).toBe(2);
  });

  it("7. Manejo de estado vacío cuando no existen ventas registradas", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as any).mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    });

    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    (createAdminClient as any).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    });

    const data = await getSalesDashboardMetrics(businessId, { preset: "today" }, timezone);

    expect(data.isEmpty).toBe(true);
    expect(data.kpis.todaySalesAmount).toBe(0);
    expect(data.kpis.todayTransactionsCount).toBe(0);
    expect(data.kpis.periodSalesAmount).toBe(0);
    expect(data.kpis.averageTicketAmount).toBe(0);
    expect(data.kpis.topChannel).toBeNull();
    expect(data.topProducts).toHaveLength(0);
  });

  it("8. Benchmark de rendimiento: procesa 1,000 documentos de venta en menos de 3,000 ms", async () => {
    const largeDocs = Array.from({ length: 1000 }).map((_, i) => ({
      id: `bulk-doc-${i}`,
      business_id: businessId,
      restaurant_order_id: i % 3 === 0 ? `ord-${i}` : null,
      document_number: `POS-BULK-${i}`,
      total: 25000 + (i % 5) * 5000,
      subtotal: 23000 + (i % 5) * 5000,
      issued_at: `${todayStr}T12:00:00Z`,
      status: "completed",
      items: [
        { productId: `p-${i % 10}`, description: `Producto ${i % 10}`, quantity: 2, total: 20000 },
      ],
    }));

    const mockSupabaseLarge = {
      from: vi.fn((table: string) => {
        if (table === "business_sale_documents") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            neq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: largeDocs, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }),
    };

    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    (createAdminClient as any).mockReturnValue(mockSupabaseLarge);

    const startTime = performance.now();
    const result = await getSalesDashboardMetrics(businessId, { preset: "today" }, timezone);
    const durationMs = performance.now() - startTime;

    expect(result.totalDocumentsAnalyzed).toBe(1000);
    expect(result.kpis.todayTransactionsCount).toBe(1000);
    expect(durationMs).toBeLessThan(3000); // Exige menos de 3 segundos
  });

  it("9. Regla Global: Prohibido uso de alertas nativas (window.alert, window.confirm, window.prompt, Alert.alert)", () => {
    const filesToCheck = [
      "src/lib/reports/types.ts",
      "src/lib/reports/reports-service.ts",
      "src/app/workspace/[businessId]/dashboard/actions.ts",
      "src/app/workspace/[businessId]/dashboard/sales-dashboard-client.tsx",
      "src/app/workspace/[businessId]/dashboard/page.tsx",
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
