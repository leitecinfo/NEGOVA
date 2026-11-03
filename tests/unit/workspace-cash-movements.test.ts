import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  openCashSession,
  closeCashSession,
  recordCashMovement,
  getCashMovements,
  getCashSessionSummary,
  getCashOverview,
} from "@/lib/cash/cash-service";

// ==============================================================================
// SIMULACIÓN MULTI-TENANT EN MEMORIA PARA CAJA Y MOVIMIENTOS [CAJ-003]
// ==============================================================================

const BUSINESS_A = "11111111-aaaa-4aaa-aaaa-111111111111";
const USER_A = "22222222-aaaa-4aaa-aaaa-222222222222";
const REG_1 = "33333333-aaaa-4aaa-aaaa-333333333333";
const REG_2 = "44444444-aaaa-4aaa-aaaa-444444444444";

let inMemoryRegisters: any[] = [];
let inMemorySessions: any[] = [];
let inMemoryMovements: any[] = [];

const mockSupabase = {
  from: (tableName: string) => {
    if (tableName === "cash_registers") {
      return {
        select: (_cols: string = "*") => {
          let list = [...inMemoryRegisters];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            order: () => chain,
            maybeSingle: () => Promise.resolve({ data: list[0] || null, error: null }),
            single: () => Promise.resolve({ data: list[0] || null, error: null }),
            then: (resolve: any) => resolve({ data: list, error: null }),
          };
          return chain;
        },
        insert: (rowOrRows: any) => {
          const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
          const inserted = rows.map((r) => ({
            id: r.id || `reg-${Date.now()}`,
            ...r,
          }));
          inMemoryRegisters.push(...inserted);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: inserted[0], error: null }),
            }),
          };
        },
      };
    }

    if (tableName === "cash_sessions") {
      return {
        select: (_cols: string = "*") => {
          let list = [...inMemorySessions];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            order: () => chain,
            limit: () => chain,
            maybeSingle: () => Promise.resolve({ data: list[0] || null, error: null }),
            single: () => Promise.resolve({ data: list[0] || null, error: null }),
            then: (resolve: any) => resolve({ data: list, error: null }),
          };
          return chain;
        },
        insert: (rowOrRows: any) => {
          const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
          const inserted = rows.map((r) => ({
            id: r.id || `55555555-aaaa-4aaa-aaaa-${Math.floor(100000000000 + Math.random() * 900000000000)}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...r,
          }));
          inMemorySessions.push(...inserted);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: inserted[0], error: null }),
            }),
          };
        },
        update: (updates: any) => {
          return {
            eq: (col1: string, val1: any) => ({
              eq: (col2: string, val2: any) => {
                let updatedRow: any = null;
                inMemorySessions = inMemorySessions.map((r) => {
                  if (r[col1] === val1 && r[col2] === val2) {
                    updatedRow = { ...r, ...updates };
                    return updatedRow;
                  }
                  return r;
                });
                return {
                  select: () => ({
                    single: () => Promise.resolve({ data: updatedRow, error: null }),
                  }),
                  then: (resolve: any) => resolve({ data: updatedRow, error: null }),
                };
              },
            }),
          };
        },
      };
    }

    if (tableName === "cash_movements") {
      return {
        select: (_cols: string = "*") => {
          let list = [...inMemoryMovements];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            order: () => chain,
            then: (resolve: any) => resolve({ data: list, error: null }),
          };
          return chain;
        },
        insert: (rowOrRows: any) => {
          const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
          const inserted = rows.map((r) => ({
            id: r.id || `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            created_at: new Date().toISOString(),
            ...r,
          }));
          inMemoryMovements.push(...inserted);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: inserted[0], error: null }),
            }),
          };
        },
      };
    }

    return {
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          single: () => Promise.resolve({ data: null, error: null }),
          then: (resolve: any) => resolve({ data: [], error: null }),
        }),
      }),
    };
  },
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabase),
}));

// ==============================================================================
// PRUEBAS DE ACEPTACIÓN — [CAJ-003] MOVIMIENTOS DE EFECTIVO EN TURNO
// ==============================================================================

describe("[CAJ-003] Movimientos de efectivo en turno", () => {
  beforeEach(() => {
    inMemoryRegisters = [
      {
        id: REG_1,
        business_id: BUSINESS_A,
        name: "Caja Principal 01",
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ];
    inMemorySessions = [];
    inMemoryMovements = [];
  });

  it("1. Debe registrar una entrada manual de $100.000 con motivo 'Cambio'", async () => {
    // 1. Abrir turno con base $200.000
    const session = await openCashSession(
      BUSINESS_A,
      {
        registerId: REG_1,
        initialAmount: 200000,
        notes: "Apertura turno matutino",
      },
      USER_A
    );

    // 2. Registrar entrada manual de $100.000
    const movement = await recordCashMovement(
      BUSINESS_A,
      {
        sessionId: session.id,
        movementType: "entry",
        amount: 100000,
        notes: "Cambio",
      },
      USER_A
    );

    expect(movement).toBeDefined();
    expect(movement.movementType).toBe("entry");
    expect(movement.amount).toBe(100000);
    expect(movement.notes).toBe("Cambio");

    // 3. Verificar resumen de turno: expectedCash = 200.000 + 100.000 = 300.000
    const summary = await getCashSessionSummary(BUSINESS_A, session.id);
    expect(summary.initialAmount).toBe(200000);
    expect(summary.totalManualEntries).toBe(100000);
    expect(summary.expectedCashInDrawer).toBe(300000);
  });

  it("2. Debe registrar un retiro de $50.000 con motivo 'Pago a proveedor'", async () => {
    // 1. Abrir turno con base $200.000
    const session = await openCashSession(
      BUSINESS_A,
      {
        registerId: REG_1,
        initialAmount: 200000,
      },
      USER_A
    );

    // 2. Registrar retiro de $50.000 con motivo Pago a proveedor
    const movement = await recordCashMovement(
      BUSINESS_A,
      {
        sessionId: session.id,
        movementType: "withdrawal",
        amount: 50000,
        notes: "Pago a proveedor",
      },
      USER_A
    );

    expect(movement).toBeDefined();
    expect(movement.movementType).toBe("withdrawal");
    expect(movement.amount).toBe(50000);
    expect(movement.notes).toBe("Pago a proveedor");

    // 3. Verificar resumen de turno: expectedCash = 200.000 - 50.000 = 150.000
    const summary = await getCashSessionSummary(BUSINESS_A, session.id);
    expect(summary.totalWithdrawals).toBe(50000);
    expect(summary.expectedCashInDrawer).toBe(150000);
  });

  it("3. Debe calcular en tiempo real el saldo de efectivo según la fórmula exacta: base + ventas_efectivo + entradas - retiros - gastos", async () => {
    // 1. Base inicial: $200.000
    const session = await openCashSession(
      BUSINESS_A,
      {
        registerId: REG_1,
        initialAmount: 200000,
      },
      USER_A
    );

    // 2. Venta en efectivo: +$120.000
    await recordCashMovement(
      BUSINESS_A,
      {
        sessionId: session.id,
        movementType: "sale_cash",
        amount: 120000,
        notes: "Venta POS #101",
      },
      USER_A
    );

    // 3. Venta con tarjeta: +$80.000 (NO suma a efectivo físico del cajón)
    await recordCashMovement(
      BUSINESS_A,
      {
        sessionId: session.id,
        movementType: "sale_card",
        amount: 80000,
        notes: "Venta Tarjeta POS #102",
      },
      USER_A
    );

    // 4. Entrada manual (cambio): +$100.000
    await recordCashMovement(
      BUSINESS_A,
      {
        sessionId: session.id,
        movementType: "entry",
        amount: 100000,
        notes: "Cambio",
      },
      USER_A
    );

    // 5. Retiro (pago proveedor): -$50.000
    await recordCashMovement(
      BUSINESS_A,
      {
        sessionId: session.id,
        movementType: "withdrawal",
        amount: 50000,
        notes: "Pago a proveedor",
      },
      USER_A
    );

    // 6. Gasto operativo de caja: -$30.000
    await recordCashMovement(
      BUSINESS_A,
      {
        sessionId: session.id,
        movementType: "expense",
        amount: 30000,
        notes: "Gasto de limpieza en efectivo",
      },
      USER_A
    );

    // 7. Cálculo esperado:
    // 200.000 (base) + 120.000 (ventas efectivo) + 100.000 (entradas) - 50.000 (retiros) - 30.000 (gastos)
    // = 340.000
    const summary = await getCashSessionSummary(BUSINESS_A, session.id);
    expect(summary.initialAmount).toBe(200000);
    expect(summary.totalSalesCash).toBe(120000);
    expect(summary.totalSalesCard).toBe(80000);
    expect(summary.totalManualEntries).toBe(100000);
    expect(summary.totalWithdrawals).toBe(50000);
    expect(summary.totalExpenses).toBe(30000);
    expect(summary.expectedCashInDrawer).toBe(340000);
  });

  it("4. Debe consultar el historial cronológico completo de movimientos del turno", async () => {
    const session = await openCashSession(
      BUSINESS_A,
      {
        registerId: REG_1,
        initialAmount: 150000,
      },
      USER_A
    );

    await recordCashMovement(
      BUSINESS_A,
      {
        sessionId: session.id,
        movementType: "entry",
        amount: 100000,
        notes: "Cambio",
      },
      USER_A
    );

    await recordCashMovement(
      BUSINESS_A,
      {
        sessionId: session.id,
        movementType: "withdrawal",
        amount: 50000,
        notes: "Pago a proveedor",
      },
      USER_A
    );

    const movements = await getCashMovements(BUSINESS_A, session.id);
    expect(movements.length).toBe(2);
    expect(movements[0].movementType).toBe("entry");
    expect(movements[0].notes).toBe("Cambio");
    expect(movements[1].movementType).toBe("withdrawal");
    expect(movements[1].notes).toBe("Pago a proveedor");
  });

  it("5. Debe rechazar registrar movimientos en una sesión de caja ya cerrada", async () => {
    const session = await openCashSession(
      BUSINESS_A,
      {
        registerId: REG_1,
        initialAmount: 200000,
      },
      USER_A
    );

    await closeCashSession(
      BUSINESS_A,
      {
        sessionId: session.id,
        finalAmountCounted: 200000,
      },
      USER_A
    );

    await expect(
      recordCashMovement(
        BUSINESS_A,
        {
          sessionId: session.id,
          movementType: "entry",
          amount: 50000,
          notes: "Intento en sesión cerrada",
        },
        USER_A
      )
    ).rejects.toThrow("No se pueden registrar movimientos en una sesión de caja cerrada.");
  });

  it("6. CUMPLIMIENTO DE REGLA GLOBAL: Cero uso de alertas nativas (window.alert/confirm/prompt/Alert.alert)", () => {
    const filesToCheck = [
      "src/components/cash/cash-movement-modal.tsx",
      "src/components/cash/shift-movements-history-modal.tsx",
      "src/components/cash/workspace-caja-client.tsx",
      "src/app/workspace/[businessId]/cajas/actions.ts",
      "src/lib/cash/cash-service.ts",
    ];

    const forbiddenPatterns = [
      /window\.alert\(/,
      /window\.confirm\(/,
      /window\.prompt\(/,
      /Alert\.alert\(/,
    ];

    for (const file of filesToCheck) {
      const fullPath = path.resolve(process.cwd(), file);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        for (const pattern of forbiddenPatterns) {
          expect(
            pattern.test(content),
            `El archivo ${file} contiene una llamada a alerta nativa prohibida (${pattern})`
          ).toBe(false);
        }
      }
    }
  });
});
