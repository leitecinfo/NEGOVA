import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  openCashSession,
  closeCashSession,
  recordCashMovement,
  getCashSessionSummary,
  getActiveCashSession,
  getCashOverview,
  createCashRegister,
} from "@/lib/cash/cash-service";

const BUSINESS_ID = "33333333-3333-4333-a333-333333333333";
const REGISTER_1_ID = "44444444-4444-4444-a444-444444444441";
const REGISTER_2_ID = "44444444-4444-4444-a444-444444444442";
const USER_ID = "55555555-5555-4555-a555-555555555555";

let mockRegisters: any[] = [];
let mockSessions: any[] = [];
let mockMovements: any[] = [];

function createMockSupabase() {
  return {
    from: (table: string) => {
      const filters: Array<{ col: string; val: any; type?: string }> = [];
      let pendingInsert: any = null;
      let pendingUpdate: any = null;

      const applyFilters = (rows: any[]) =>
        rows.filter((r) =>
          filters.every((f) => {
            if (f.type === "in") {
              return Array.isArray(f.val) && f.val.includes(r[f.col]);
            }
            return r[f.col] === f.val;
          })
        );

      const getTableRows = () => {
        if (table === "cash_registers") return mockRegisters;
        if (table === "cash_sessions") return mockSessions;
        if (table === "cash_movements") return mockMovements;
        return [];
      };

      const builder: any = {
        select: () => builder,
        eq: (col: string, val: any) => {
          filters.push({ col, val });
          return builder;
        },
        in: (col: string, val: any[]) => {
          filters.push({ col, val, type: "in" });
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
              opened_at: now,
              ...pendingInsert,
            };
            target.push(created);
            return { data: created, error: null };
          }
          if (pendingUpdate) {
            const rows = applyFilters(target);
            if (!rows[0]) return { data: null, error: { message: "Not found" } };
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

describe("CAJ-002: UI de apertura y cierre de turno de caja", () => {
  beforeEach(() => {
    mockRegisters = [
      {
        id: REGISTER_1_ID,
        business_id: BUSINESS_ID,
        name: "Caja Principal",
        location_id: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: REGISTER_2_ID,
        business_id: BUSINESS_ID,
        name: "Caja Barra",
        location_id: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    mockSessions = [];
    mockMovements = [];
  });

  it("Criterio 1: Se puede abrir un turno con base de $200.000", async () => {
    const session = await openCashSession(
      BUSINESS_ID,
      {
        registerId: REGISTER_1_ID,
        initialAmount: 200000,
        notes: "Turno mañana con base de 200k",
      },
      USER_ID
    );

    expect(session).toBeDefined();
    expect(session.initialAmount).toBe(200000);
    expect(session.status).toBe("open");
    expect(session.registerId).toBe(REGISTER_1_ID);
    expect(session.notes).toContain("base de 200k");

    // Verificar que la sesión activa es recuperada correctamente
    const active = await getActiveCashSession(BUSINESS_ID, REGISTER_1_ID);
    expect(active).not.toBeNull();
    expect(active?.id).toBe(session.id);
  });

  it("Criterio 2: Se puede cerrar un turno: el sistema muestra el total del sistema vs total contado", async () => {
    // 1. Abrir turno con base de $200.000
    const session = await openCashSession(
      BUSINESS_ID,
      {
        registerId: REGISTER_1_ID,
        initialAmount: 200000,
      },
      USER_ID
    );

    // 2. Registrar movimientos del turno:
    // Venta efectivo: $50.000
    // Venta tarjeta: $80.000
    // Gasto caja (salida): $15.000
    await recordCashMovement(
      BUSINESS_ID,
      {
        sessionId: session.id,
        movementType: "sale_cash",
        amount: 50000,
        notes: "Venta orden #1",
      },
      USER_ID
    );

    await recordCashMovement(
      BUSINESS_ID,
      {
        sessionId: session.id,
        movementType: "sale_card",
        amount: 80000,
        notes: "Venta datáfono #2",
      },
      USER_ID
    );

    await recordCashMovement(
      BUSINESS_ID,
      {
        sessionId: session.id,
        movementType: "expense",
        amount: 15000,
        notes: "Compra insumos aseo",
      },
      USER_ID
    );

    // 3. Consultar resumen previo al cierre:
    // Total esperado en cajón = 200.000 (base) + 50.000 (efectivo) - 15.000 (gasto) = 235.000
    const summaryBeforeClose = await getCashSessionSummary(BUSINESS_ID, session.id);
    expect(summaryBeforeClose.initialAmount).toBe(200000);
    expect(summaryBeforeClose.totalSalesCash).toBe(50000);
    expect(summaryBeforeClose.totalSalesCard).toBe(80000);
    expect(summaryBeforeClose.totalExpenses).toBe(15000);
    expect(summaryBeforeClose.expectedCashInDrawer).toBe(235000);

    // 4. Cerrar turno con total contado exacto ($235.000)
    const closedSession = await closeCashSession(
      BUSINESS_ID,
      {
        sessionId: session.id,
        finalAmountCounted: 235000,
        notes: "Cierre de turno sin novedades",
      },
      USER_ID
    );

    expect(closedSession.status).toBe("closed");
    expect(closedSession.finalAmountCounted).toBe(235000);

    // 5. Verificar que el resumen refleja cuadre perfecto (diferencia = 0)
    const summaryAfterClose = await getCashSessionSummary(BUSINESS_ID, session.id);
    expect(summaryAfterClose.difference).toBe(0);
  });

  it("Criterio 3: Las diferencias (faltante y sobrante) se registran con notas", async () => {
    // Abrir turno con base $100.000
    const session = await openCashSession(
      BUSINESS_ID,
      {
        registerId: REGISTER_1_ID,
        initialAmount: 100000,
      },
      USER_ID
    );

    // Venta efectivo: $50.000 -> Esperado en cajón: $150.000
    await recordCashMovement(
      BUSINESS_ID,
      {
        sessionId: session.id,
        movementType: "sale_cash",
        amount: 50000,
      },
      USER_ID
    );

    // Caso A: Arqueo con faltante de $10.000 (contado $140.000 en vez de $150.000)
    const closedWithDiff = await closeCashSession(
      BUSINESS_ID,
      {
        sessionId: session.id,
        finalAmountCounted: 140000,
        notes: "Faltante de $10.000 justificado por cambio entregado de más en orden #45",
      },
      USER_ID
    );

    expect(closedWithDiff.status).toBe("closed");
    expect(closedWithDiff.finalAmountCounted).toBe(140000);
    expect(closedWithDiff.notes).toContain("Faltante de $10.000 justificado");

    // Verificar cálculo exacto de la diferencia negativa (-10000)
    const summary = await getCashSessionSummary(BUSINESS_ID, session.id);
    expect(summary.expectedCashInDrawer).toBe(150000);
    expect(summary.finalAmountCounted).toBe(140000);
    expect(summary.difference).toBe(-10000);
  });

  it("Criterio 4: No se puede abrir un segundo turno en la misma caja", async () => {
    // Abrir primer turno
    await openCashSession(
      BUSINESS_ID,
      {
        registerId: REGISTER_1_ID,
        initialAmount: 200000,
      },
      USER_ID
    );

    // Intentar abrir un segundo turno en la misma caja debe ser rechazado
    await expect(
      openCashSession(
        BUSINESS_ID,
        {
          registerId: REGISTER_1_ID,
          initialAmount: 100000,
        },
        USER_ID
      )
    ).rejects.toThrow(/Ya existe un turno abierto para esta caja/);
  });

  it("Criterio 5: getCashOverview consolida KPIs de turnos abiertos, efectivo en cajones y estado por caja", async () => {
    // Abrir turno en Caja 1 con base $200.000 y venta efectivo $50.000 (total en cajón $250.000)
    const session1 = await openCashSession(
      BUSINESS_ID,
      { registerId: REGISTER_1_ID, initialAmount: 200000 },
      USER_ID
    );
    await recordCashMovement(
      BUSINESS_ID,
      { sessionId: session1.id, movementType: "sale_cash", amount: 50000 },
      USER_ID
    );

    // Abrir turno en Caja 2 con base $150.000 y venta tarjeta $70.000
    const session2 = await openCashSession(
      BUSINESS_ID,
      { registerId: REGISTER_2_ID, initialAmount: 150000 },
      USER_ID
    );
    await recordCashMovement(
      BUSINESS_ID,
      { sessionId: session2.id, movementType: "sale_card", amount: 70000 },
      USER_ID
    );

    const overview = await getCashOverview(BUSINESS_ID);

    // KPIs globales consolidados
    expect(overview.kpis.openSessionsCount).toBe(2);
    expect(overview.kpis.totalRegistersCount).toBe(2);
    expect(overview.kpis.totalCashInDrawers).toBe(400000); // 250k (Caja 1) + 150k (Caja 2)
    expect(overview.kpis.totalSalesInOpenSessions).toBe(120000); // 50k + 70k

    // Detalle por caja
    const reg1Overview = overview.registers.find((r) => r.register.id === REGISTER_1_ID);
    expect(reg1Overview).toBeDefined();
    expect(reg1Overview?.activeSession).not.toBeNull();
    expect(reg1Overview?.sessionSummary?.expectedCashInDrawer).toBe(250000);

    const reg2Overview = overview.registers.find((r) => r.register.id === REGISTER_2_ID);
    expect(reg2Overview).toBeDefined();
    expect(reg2Overview?.activeSession).not.toBeNull();
    expect(reg2Overview?.sessionSummary?.totalSalesCard).toBe(70000);
  });

  it("Criterio 6: Regla de Oro - Cero uso de alertas nativas", () => {
    const cashFiles = [
      "src/components/cash/open-cash-shift-modal.tsx",
      "src/components/cash/close-cash-shift-modal.tsx",
      "src/components/cash/create-cash-register-modal.tsx",
      "src/components/cash/workspace-caja-client.tsx",
      "src/app/workspace/[businessId]/caja/page.tsx",
      "src/app/workspace/[businessId]/cajas/page.tsx",
    ];

    for (const relPath of cashFiles) {
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
