import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  calculateDailyClosure,
  saveDailyClosure,
  getDailyClosureByDate,
  getDailyClosuresHistory,
} from "@/lib/cash/cash-service";
import { generateDailyClosurePdf } from "@/lib/cash/daily-closure-pdf";

const BUSINESS_ID = "66666666-6666-4666-a666-666666666666";
const CLOSURE_DATE = "2026-10-30";
const USER_ID = "77777777-7777-4777-a777-777777777777";

let mockDailyClosures: any[] = [];
let mockOrders: any[] = [];
let mockMovements: any[] = [];

function createMockSupabase() {
  return {
    from: (table: string) => {
      const filters: Array<{ col: string; val: any; op?: string }> = [];
      let pendingInsert: any = null;
      let pendingUpdate: any = null;

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
        insert: (payload: any) => {
          pendingInsert = payload;
          return builder;
        },
        update: (payload: any) => {
          pendingUpdate = payload;
          return builder;
        },
        maybeSingle: async () => {
          const rows = applyFilters(getTableRows());
          return { data: rows[0] || null, error: null };
        },
        single: async () => {
          const target = getTableRows();
          if (pendingInsert) {
            const now = new Date().toISOString();
            const created = {
              id: pendingInsert.id || crypto.randomUUID(),
              created_at: now,
              updated_at: now,
              ...pendingInsert,
            };
            target.push(created);
            return { data: created, error: null };
          }
          if (pendingUpdate) {
            const rows = applyFilters(target);
            if (!rows[0]) return { data: null, error: { message: "Not found" } };
            // Simular inmutabilidad si is_locked === true
            if (rows[0].is_locked) {
              return { data: null, error: { message: "Registro inmutable. No puede modificarse." } };
            }
            Object.assign(rows[0], pendingUpdate);
            return { data: rows[0], error: null };
          }
          const rows = applyFilters(target);
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

describe("CAJ-004: Cierre del día con reconciliación", () => {
  beforeEach(() => {
    mockDailyClosures = [];

    // Sembrar pedidos del día por diferentes canales:
    mockOrders = [
      {
        id: "ord-1",
        business_id: BUSINESS_ID,
        total: 100000,
        status: "delivered",
        payment_status: "paid",
        order_type: "takeaway",
        channel_origin: "pos",
        created_at: `${CLOSURE_DATE}T10:00:00.000Z`,
      },
      {
        id: "ord-2",
        business_id: BUSINESS_ID,
        total: 80000,
        status: "delivered",
        payment_status: "paid",
        order_type: "dine_in",
        channel_origin: "tables",
        created_at: `${CLOSURE_DATE}T12:30:00.000Z`,
      },
      {
        id: "ord-3",
        business_id: BUSINESS_ID,
        total: 60000,
        status: "delivered",
        payment_status: "paid",
        order_type: "delivery",
        channel_origin: "delivery",
        created_at: `${CLOSURE_DATE}T14:15:00.000Z`,
      },
      {
        id: "ord-4",
        business_id: BUSINESS_ID,
        total: 40000,
        status: "delivered",
        payment_status: "paid",
        order_type: "takeaway",
        channel_origin: "qr_menu",
        created_at: `${CLOSURE_DATE}T18:00:00.000Z`,
      },
      {
        id: "ord-cancelled",
        business_id: BUSINESS_ID,
        total: 50000,
        status: "cancelled", // No debe sumar
        payment_status: "cancelled",
        order_type: "takeaway",
        channel_origin: "pos",
        created_at: `${CLOSURE_DATE}T11:00:00.000Z`,
      },
    ];

    // Sembrar movimientos de caja registrados por métodos de pago:
    mockMovements = [
      {
        movement_type: "sale_cash",
        amount: 120000,
        business_id: BUSINESS_ID,
        created_at: `${CLOSURE_DATE}T10:05:00.000Z`,
      },
      {
        movement_type: "sale_card",
        amount: 100000,
        business_id: BUSINESS_ID,
        created_at: `${CLOSURE_DATE}T12:35:00.000Z`,
      },
      {
        movement_type: "sale_digital",
        amount: 60000,
        business_id: BUSINESS_ID,
        created_at: `${CLOSURE_DATE}T18:05:00.000Z`,
      },
    ];
  });

  it("Criterio 1: Se puede generar el cierre del día con todos los totales correctos por canal", async () => {
    const calc = await calculateDailyClosure(BUSINESS_ID, CLOSURE_DATE);

    expect(calc).toBeDefined();
    expect(calc.isSaved).toBe(false);
    expect(calc.closureDate).toBe(CLOSURE_DATE);

    // Total ventas sin anuladas = 100k + 80k + 60k + 40k = 280k
    expect(calc.metrics.totalSales).toBe(280000);
    expect(calc.metrics.counterSales).toBe(100000);
    expect(calc.metrics.tablesSales).toBe(80000);
    expect(calc.metrics.deliverySales).toBe(60000);
    expect(calc.metrics.onlineSales).toBe(40000);

    // Totales del sistema por método de pago:
    // Efectivo: 120.000, Tarjeta: 100.000, Digital: 60.000 (Total = 280.000)
    expect(calc.totalSystem).toBe(280000);
  });

  it("Criterio 2: La diferencia entre sistema y contado se calcula automáticamente por método", async () => {
    // Simular que el cajero cuenta:
    // Efectivo: 115.000 (Faltante 5.000)
    // Tarjeta: 100.000 (Cuadrado 0)
    // Digital: 62.000 (Sobrante 2.000)
    const countedInput = {
      cash: 115000,
      card: 100000,
      digital: 62000,
      credit: 0,
    };

    const calc = await calculateDailyClosure(BUSINESS_ID, CLOSURE_DATE, countedInput);

    expect(calc.totalSystem).toBe(280000);
    expect(calc.totalCounted).toBe(277000);
    expect(calc.totalDifference).toBe(-3000); // Faltante neto total: -$3.000

    const cashReconciliation = calc.reconciliation.find((r) => r.method === "cash");
    expect(cashReconciliation?.difference).toBe(-5000);

    const cardReconciliation = calc.reconciliation.find((r) => r.method === "card");
    expect(cardReconciliation?.difference).toBe(0);

    const digitalReconciliation = calc.reconciliation.find((r) => r.method === "digital");
    expect(digitalReconciliation?.difference).toBe(2000);
  });

  it("Criterio 3: El cierre se puede exportar como PDF", () => {
    const dummyClosure = {
      id: "closure-uuid-1111",
      businessId: BUSINESS_ID,
      closureDate: CLOSURE_DATE,
      totalSales: 280000,
      counterSales: 100000,
      tablesSales: 80000,
      deliverySales: 60000,
      onlineSales: 40000,
      totalSystem: 280000,
      totalCounted: 277000,
      totalDifference: -3000,
      paymentMethodsSummary: [
        { method: "cash", label: "Efectivo", systemTotal: 120000, countedTotal: 115000, difference: -5000 },
        { method: "card", label: "Tarjeta", systemTotal: 100000, countedTotal: 100000, difference: 0 },
        { method: "digital", label: "Digital", systemTotal: 60000, countedTotal: 62000, difference: 2000 },
      ],
      observations: "Faltante en efectivo justificado por vueltas incorrectas en turno tarde",
      closedByName: "Carlos Supervisor",
      isLocked: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const pdfResult = generateDailyClosurePdf({
      businessName: "Restaurante El Gourmet",
      businessNit: "900.123.456-7",
      businessAddress: "Calle 100 # 15-20",
      businessPhone: "3001234567",
      closure: dummyClosure,
    });

    expect(pdfResult).toBeDefined();
    expect(pdfResult.filename).toContain(`Cierre_Z_${CLOSURE_DATE}`);
    expect(pdfResult.base64).toBeDefined();
    expect(pdfResult.sizeBytes).toBeGreaterThan(1000);
  });

  it("Criterio 4: Un cierre guardado no puede modificarse (inmutabilidad estricta)", async () => {
    // 1. Guardar cierre por primera vez
    const saved = await saveDailyClosure(
      BUSINESS_ID,
      {
        closureDate: CLOSURE_DATE,
        countedByMethod: { cash: 120000, card: 100000, digital: 60000 },
        observations: "Cierre exitoso y conciliado",
      },
      USER_ID,
      "Administrador"
    );

    expect(saved).toBeDefined();
    expect(saved.isLocked).toBe(true);
    expect(saved.closureDate).toBe(CLOSURE_DATE);

    // 2. Intentar guardar nuevamente para la misma fecha debe ser rechazado
    await expect(
      saveDailyClosure(
        BUSINESS_ID,
        {
          closureDate: CLOSURE_DATE,
          countedByMethod: { cash: 130000, card: 100000, digital: 60000 },
        },
        USER_ID
      )
    ).rejects.toThrow(/ya fue guardado previamente y es un registro inmutable/);

    // 3. Consultar por fecha debe retornar el registro bloqueado
    const fetched = await getDailyClosureByDate(BUSINESS_ID, CLOSURE_DATE);
    expect(fetched).not.toBeNull();
    expect(fetched?.isLocked).toBe(true);
  });

  it("Criterio 5: Regla de Oro - Cero uso de alertas nativas", () => {
    const files = [
      "src/components/cash/daily-closure-panel.tsx",
      "src/lib/cash/daily-closure-pdf.ts",
      "src/app/workspace/[businessId]/cajas/actions.ts",
    ];

    for (const relPath of files) {
      const fullPath = path.resolve(process.cwd(), relPath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        expect(content).not.toMatch(/window\.alert\s*\(/);
        expect(content).not.toMatch(/window\.confirm\s*\(/);
        expect(content).not.toMatch(/window\.prompt\s*\(/);
        expect(content).not.toMatch(/Alert\.alert\s*\(/);
      }
    }
  });
});

