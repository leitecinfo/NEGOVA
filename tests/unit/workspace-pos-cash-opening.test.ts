import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPosCashContext,
  openCashSession,
  recordCashMovement,
  getCashSessionSummary,
  getActiveCashSession,
} from "@/lib/cash/cash-service";

const mockRegisters: any[] = [];
const mockSessions: any[] = [];
const mockMovements: any[] = [];

function createMockSupabase() {
  return {
    from: (table: string) => {
      const filters: Array<{ col: string; val: any }> = [];
      let pendingInsert: any = null;
      let pendingUpdate: any = null;

      const applyFilters = (rows: any[]) =>
        rows.filter((r) => filters.every((f) => r[f.col] === f.val));

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
              id: crypto.randomUUID(),
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
        then: (resolve: any) => {
          const rows = applyFilters(getTableRows());
          return Promise.resolve({ data: rows, error: null }).then(resolve);
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

describe("[POS-001] Integración de apertura de caja y movimientos en flujo POS", () => {
  const businessId = "11111111-1111-4111-8111-111111111111";
  const registerId = "22222222-2222-4222-8222-222222222222";
  const userId = "33333333-3333-4333-8333-333333333333";

  beforeEach(() => {
    mockRegisters.length = 0;
    mockSessions.length = 0;
    mockMovements.length = 0;

    mockRegisters.push({
      id: registerId,
      business_id: businessId,
      name: "Caja Principal",
      location_id: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  it("1. Si no hay caja abierta al entrar al POS, getPosCashContext retorna activeSession = null", async () => {
    const context = await getPosCashContext(businessId, userId);

    expect(context.registers).toHaveLength(1);
    expect(context.registers[0].name).toBe("Caja Principal");
    expect(context.activeSession).toBeNull();
    expect(context.currentCashBalance).toBe(0);
  });

  it("2. Tras abrir la caja con base $200.000, el turno queda activo con status = 'open' e initial_amount = 200000", async () => {
    const opened = await openCashSession(
      businessId,
      {
        registerId,
        initialAmount: 200000,
        notes: "Apertura de turno POS",
      },
      userId
    );

    expect(opened.status).toBe("open");
    expect(opened.initialAmount).toBe(200000);
    expect(opened.openedBy).toBe(userId);
    expect(opened.registerId).toBe(registerId);

    const active = await getActiveCashSession(businessId, undefined, userId);
    expect(active).not.toBeNull();
    expect(active?.id).toBe(opened.id);
    expect(active?.initialAmount).toBe(200000);
  });

  it("3. Cada venta en efectivo incrementa el saldo del turno y registra cash_movements por método de pago", async () => {
    const session = await openCashSession(
      businessId,
      {
        registerId,
        initialAmount: 200000,
      },
      userId
    );

    // Venta 1 en efectivo por $45.000
    await recordCashMovement(
      businessId,
      {
        sessionId: session.id,
        movementType: "sale_cash",
        amount: 45000,
        referenceType: "order",
        notes: "Pedido #101 (cash)",
      },
      userId
    );

    // Venta 2 con tarjeta por $80.000 (registra movimiento pero no suma al cajón de efectivo físico)
    await recordCashMovement(
      businessId,
      {
        sessionId: session.id,
        movementType: "sale_card",
        amount: 80000,
        referenceType: "order",
        notes: "Pedido #102 (card)",
      },
      userId
    );

    // Venta 3 en efectivo por $35.000
    await recordCashMovement(
      businessId,
      {
        sessionId: session.id,
        movementType: "sale_cash",
        amount: 35000,
        referenceType: "order",
        notes: "Pedido #103 (cash)",
      },
      userId
    );

    const summary = await getCashSessionSummary(businessId, session.id);
    expect(summary.initialAmount).toBe(200000);
    expect(summary.totalSalesCash).toBe(80000);
    expect(summary.totalSalesCard).toBe(80000);
    expect(summary.expectedCashInDrawer).toBe(280000);
    expect(summary.movementsCount).toBe(3);
  });

  it("4. El turno activo y su saldo actualizado persisten al recargar la página del POS", async () => {
    const session = await openCashSession(
      businessId,
      {
        registerId,
        initialAmount: 200000,
      },
      userId
    );

    await recordCashMovement(
      businessId,
      {
        sessionId: session.id,
        movementType: "sale_cash",
        amount: 50000,
        referenceType: "order",
        notes: "Pedido #104 (cash)",
      },
      userId
    );

    // Simular recarga de /workspace/[businessId]/pos en el servidor
    const reloadedContext = await getPosCashContext(businessId, userId);

    expect(reloadedContext.activeSession).not.toBeNull();
    expect(reloadedContext.activeSession?.id).toBe(session.id);
    expect(reloadedContext.activeSession?.status).toBe("open");
    expect(reloadedContext.currentCashBalance).toBe(250000);
  });
});
