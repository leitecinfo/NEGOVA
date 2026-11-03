import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { calculateDateRangeClosure } from "@/lib/cash/cash-service";
import { generateDateRangeClosurePdf } from "@/lib/cash/daily-closure-pdf";

const BUSINESS_ID = "88888888-8888-4888-a888-888888888888";

let mockDailyClosures: any[] = [];
let mockOrders: any[] = [];
let mockMovements: any[] = [];

function createMockSupabase() {
  return {
    from: (table: string) => {
      const filters: Array<{ col: string; val: any; op?: string }> = [];

      const applyFilters = (rows: any[]) =>
        rows.filter((r) =>
          filters.every((f) => {
            if (f.op === "gte") return r[f.col] >= f.val;
            if (f.op === "lte") return r[f.col] <= f.val;
            if (f.op === "neq") return r[f.col] !== f.val;
            return r[f.col] === f.val;
          })
        );

      const getTableRows = () => {
        if (table === "daily_cash_closures") return mockDailyClosures;
        if (table === "restaurant_orders") return mockOrders;
        if (table === "cash_movements") return mockMovements;
        return [];
      };

      const builder: any = {
        select: () => builder,
        eq: (col: string, val: any) => {
          filters.push({ col, val });
          return builder;
        },
        gte: (col: string, val: any) => {
          filters.push({ col, val, op: "gte" });
          return builder;
        },
        lte: (col: string, val: any) => {
          filters.push({ col, val, op: "lte" });
          return builder;
        },
        neq: (col: string, val: any) => {
          filters.push({ col, val, op: "neq" });
          return builder;
        },
        order: () => builder,
        limit: () => builder,
        maybeSingle: async () => {
          const rows = applyFilters(getTableRows());
          return { data: rows[0] || null, error: null };
        },
        single: async () => {
          const rows = applyFilters(getTableRows());
          if (!rows[0]) return { data: null, error: { message: "Not found" } };
          return { data: rows[0], error: null };
        },
        then: (resolve: any, reject?: any) => {
          const rows = applyFilters(getTableRows());
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
        },
      };

      return builder;
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => createMockSupabase()),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => createMockSupabase()),
}));

describe("CAJ-005: Cierre por rango de fechas", () => {
  beforeEach(() => {
    mockDailyClosures = [];
    mockOrders = [];
    mockMovements = [];

    // Día 1 (2026-10-01): Cierre Z guardado e inmutable en base de datos
    mockDailyClosures.push({
      id: "closure-day-1",
      business_id: BUSINESS_ID,
      closure_date: "2026-10-01",
      total_sales: 200000,
      counter_sales: 100000,
      tables_sales: 50000,
      delivery_sales: 30000,
      online_sales: 20000,
      total_system: 200000,
      total_counted: 198000,
      total_difference: -2000,
      payment_methods_summary: [
        { method: "cash", label: "Efectivo", systemTotal: 100000, countedTotal: 98000, difference: -2000 },
        { method: "card", label: "Tarjeta (Datáfono)", systemTotal: 60000, countedTotal: 60000, difference: 0 },
        { method: "digital", label: "Transferencias / Digital", systemTotal: 40000, countedTotal: 40000, difference: 0 },
      ],
      observations: "Cierre día 1 con faltante de $2.000",
      closed_by_name: "Ana Supervisor",
      is_locked: true,
      created_at: "2026-10-01T23:00:00.000Z",
      updated_at: "2026-10-01T23:00:00.000Z",
    });

    // Día 3 (2026-10-03): Pedidos en vivo (aún sin cierre Z guardado)
    mockOrders.push(
      {
        id: "ord-day3-1",
        business_id: BUSINESS_ID,
        total: 150000,
        status: "delivered",
        payment_status: "paid",
        order_type: "takeaway",
        channel_origin: "pos",
        created_at: "2026-10-03T13:00:00.000Z",
      },
      {
        id: "ord-day3-2",
        business_id: BUSINESS_ID,
        total: 90000,
        status: "delivered",
        payment_status: "paid",
        order_type: "dine_in",
        channel_origin: "tables",
        created_at: "2026-10-03T15:00:00.000Z",
      },
      {
        id: "ord-day3-3",
        business_id: BUSINESS_ID,
        total: 60000,
        status: "delivered",
        payment_status: "paid",
        order_type: "delivery",
        channel_origin: "delivery",
        created_at: "2026-10-03T19:00:00.000Z",
      }
    );

    mockMovements.push(
      {
        movement_type: "sale_cash",
        amount: 150000,
        business_id: BUSINESS_ID,
        created_at: "2026-10-03T13:05:00.000Z",
      },
      {
        movement_type: "sale_card",
        amount: 90000,
        business_id: BUSINESS_ID,
        created_at: "2026-10-03T15:05:00.000Z",
      },
      {
        movement_type: "sale_digital",
        amount: 60000,
        business_id: BUSINESS_ID,
        created_at: "2026-10-03T19:05:00.000Z",
      }
    );
  });

  it("Criterio 1: Se puede generar un cierre de 7 días con totales consolidados", async () => {
    const result = await calculateDateRangeClosure(
      BUSINESS_ID,
      "2026-10-01",
      "2026-10-07"
    );

    expect(result).toBeDefined();
    expect(result.startDate).toBe("2026-10-01");
    expect(result.endDate).toBe("2026-10-07");
    expect(result.daysCount).toBe(7);
    expect(result.daysBreakdown).toHaveLength(7);

    // Consolidado de ventas: Día 1 (200.000) + Día 3 (150k + 90k + 60k = 300.000) = 500.000
    expect(result.metrics.totalSales).toBe(500000);
    expect(result.metrics.counterSales).toBe(250000); // 100k + 150k
    expect(result.metrics.tablesSales).toBe(140000); // 50k + 90k
    expect(result.metrics.deliverySales).toBe(90000); // 30k + 60k
    expect(result.metrics.onlineSales).toBe(20000); // 20k + 0

    // Consolidado por método de pago:
    // Sistema: 200.000 + 300.000 = 500.000
    // Contado: 198.000 (día 1 cerrado) + 300.000 (día 3 prellenado del sistema) = 498.000
    // Diferencia: -2.000
    expect(result.totalSystem).toBe(500000);
    expect(result.totalCounted).toBe(498000);
    expect(result.totalDifference).toBe(-2000);

    const cashRow = result.reconciliation.find((r) => r.method === "cash");
    expect(cashRow?.systemTotal).toBe(250000);
    expect(cashRow?.countedTotal).toBe(248000);
    expect(cashRow?.difference).toBe(-2000);

    const cardRow = result.reconciliation.find((r) => r.method === "card");
    expect(cardRow?.systemTotal).toBe(150000);
    expect(cardRow?.countedTotal).toBe(150000);
    expect(cardRow?.difference).toBe(0);

    // Verificar estado de días en el desglose
    const day1 = result.daysBreakdown.find((d) => d.date === "2026-10-01");
    expect(day1?.isSaved).toBe(true);
    expect(day1?.totalSales).toBe(200000);

    const day3 = result.daysBreakdown.find((d) => d.date === "2026-10-03");
    expect(day3?.isSaved).toBe(false);
    expect(day3?.totalSales).toBe(300000);
  });

  it("Criterio 2: El rango máximo es 30 días y muestra error si se supera o si las fechas son inválidas", async () => {
    // Caso 1: 31 días (1 al 31 de octubre) -> Rechazar
    await expect(
      calculateDateRangeClosure(BUSINESS_ID, "2026-10-01", "2026-10-31")
    ).rejects.toThrow(/El rango máximo permitido es de 30 días/i);

    // Caso 2: 45 días -> Rechazar
    await expect(
      calculateDateRangeClosure(BUSINESS_ID, "2026-09-01", "2026-10-15")
    ).rejects.toThrow(/El rango máximo permitido es de 30 días/i);

    // Caso 3: Fecha inicial mayor que fecha final -> Rechazar
    await expect(
      calculateDateRangeClosure(BUSINESS_ID, "2026-10-15", "2026-10-05")
    ).rejects.toThrow(/La fecha inicial no puede ser posterior a la fecha final/i);

    // Caso 4: Exactamente 30 días (1 al 30 de octubre) -> Permitir
    const valid30Days = await calculateDateRangeClosure(
      BUSINESS_ID,
      "2026-10-01",
      "2026-10-30"
    );
    expect(valid30Days.daysCount).toBe(30);
    expect(valid30Days.daysBreakdown).toHaveLength(30);
  });

  it("Criterio 3: El PDF incluye todo el desglose del rango", async () => {
    const closureRange = await calculateDateRangeClosure(
      BUSINESS_ID,
      "2026-10-01",
      "2026-10-07"
    );

    const pdf = generateDateRangeClosurePdf({
      businessName: "NEGOVA Gastro Bar",
      businessNit: "901.555.888-1",
      businessAddress: "Av. El Dorado # 68B-85",
      businessPhone: "3109876543",
      rangeClosure: closureRange,
    });

    expect(pdf).toBeDefined();
    expect(pdf.filename).toBe("Cierre_Rango_2026-10-01_al_2026-10-07.pdf");
    expect(pdf.base64).toBeDefined();
    expect(pdf.base64.length).toBeGreaterThan(500);
    expect(pdf.sizeBytes).toBeGreaterThan(1500);
  });

  it("Regla de código: Cero uso de alertas nativas en componentes y servicios de CAJ-005", () => {
    const filesToCheck = [
      "src/lib/cash/cash-service.ts",
      "src/lib/cash/daily-closure-pdf.ts",
      "src/app/workspace/[businessId]/cajas/actions.ts",
      "src/components/cash/date-range-closure-panel.tsx",
      "src/components/cash/workspace-caja-client.tsx",
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.resolve(process.cwd(), relPath);
      const content = fs.readFileSync(fullPath, "utf-8");
      expect(content).not.toMatch(/window\.alert\s*\(/);
      expect(content).not.toMatch(/window\.confirm\s*\(/);
      expect(content).not.toMatch(/window\.prompt\s*\(/);
      expect(content).not.toMatch(/Alert\.alert\s*\(/);
    }
  });
});
