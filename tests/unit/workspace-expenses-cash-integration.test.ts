import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  createExpense,
  deleteExpense,
  getFinancialReport,
} from "@/lib/expenses/expenses-service";
import {
  getCashSessionSummary,
} from "@/lib/cash/cash-service";

// In-memory data store for mocking Supabase
const memoryExpenses = new Map<string, any>();
const memoryCashSessions = new Map<string, any>();
const memoryCashMovements = new Map<string, any>();
const memorySaleDocs = new Map<string, any>();
const memoryRestaurantOrders = new Map<string, any>();
const memorySuppliers = new Map<string, any>();
const memoryProducts = new Map<string, any>();

function matchesFilter(row: any, field: string, val: any): boolean {
  return row[field] === val;
}

const mockSupabaseClient = {
  from: (table: string) => {
    let currentTable = table;
    let filters: Array<(row: any) => boolean> = [];
    let orderByField: string | null = null;
    let orderAscending = true;
    let limitCount: number | null = null;

    const getTableStore = () => {
      switch (currentTable) {
        case "expenses":
          return memoryExpenses;
        case "cash_sessions":
          return memoryCashSessions;
        case "cash_movements":
          return memoryCashMovements;
        case "business_sale_documents":
          return memorySaleDocs;
        case "restaurant_orders":
          return memoryRestaurantOrders;
        case "suppliers":
          return memorySuppliers;
        case "products":
          return memoryProducts;
        default:
          return new Map<string, any>();
      }
    };

    const builder: any = {
      select: vi.fn((_columns?: string) => builder),
      eq: vi.fn((field: string, val: any) => {
        filters.push((row: any) => matchesFilter(row, field, val));
        return builder;
      }),
      neq: vi.fn((field: string, val: any) => {
        filters.push((row: any) => row[field] !== val);
        return builder;
      }),
      in: vi.fn((field: string, vals: any[]) => {
        filters.push((row: any) => vals.includes(row[field]));
        return builder;
      }),
      gte: vi.fn((field: string, val: any) => {
        filters.push((row: any) => row[field] >= val);
        return builder;
      }),
      lte: vi.fn((field: string, val: any) => {
        filters.push((row: any) => row[field] <= val);
        return builder;
      }),
      order: vi.fn((field: string, opts?: { ascending?: boolean }) => {
        orderByField = field;
        orderAscending = opts?.ascending !== false;
        return builder;
      }),
      limit: vi.fn((n: number) => {
        limitCount = n;
        return builder;
      }),
      insert: vi.fn((payload: any) => {
        const store = getTableStore();
        const id = payload.id || `gen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const record = {
          id,
          ...payload,
          created_at: payload.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        store.set(id, record);
        return {
          data: record,
          error: null,
          select: () => ({
            single: async () => ({ data: record, error: null }),
          }),
        };
      }),
      update: vi.fn((payload: any) => {
        const store = getTableStore();
        return {
          eq: (f1: string, v1: any) => {
            const executeUpdate = async (f2?: string, v2?: any) => {
              let updatedRow: any = null;
              for (const [id, row] of store.entries()) {
                if (row[f1] === v1 && (!f2 || row[f2] === v2)) {
                  const updated = { ...row, ...payload, updated_at: new Date().toISOString() };
                  store.set(id, updated);
                  updatedRow = updated;
                }
              }
              return {
                data: updatedRow,
                error: null,
                select: () => ({
                  single: async () => ({ data: updatedRow, error: null }),
                }),
              };
            };
            return {
              eq: (f2: string, v2: any) => executeUpdate(f2, v2),
              select: () => ({
                single: async () => executeUpdate(),
              }),
              then: (resolve: any) => executeUpdate().then(resolve),
            };
          },
        };
      }),
      delete: vi.fn(() => {
        const store = getTableStore();
        const deleteConditions: Array<{ field: string; val: any }> = [];
        const deleteBuilder: any = {
          eq: (f: string, v: any) => {
            deleteConditions.push({ field: f, val: v });
            return deleteBuilder;
          },
          then: (resolve: any) => {
            for (const [id, row] of store.entries()) {
              const match = deleteConditions.every((c) => row[c.field] === c.val);
              if (match) {
                store.delete(id);
              }
            }
            resolve({ data: null, error: null });
          },
        };
        return deleteBuilder;
      }),
      maybeSingle: async () => {
        const store = getTableStore();
        let items = Array.from(store.values()).filter((r) => filters.every((f) => f(r)));
        if (orderByField) {
          items.sort((a, b) => {
            const valA = a[orderByField!];
            const valB = b[orderByField!];
            if (valA < valB) return orderAscending ? -1 : 1;
            if (valA > valB) return orderAscending ? 1 : -1;
            return 0;
          });
        }
        return { data: items[0] || null, error: null };
      },
      single: async () => {
        const store = getTableStore();
        const items = Array.from(store.values()).filter((r) => filters.every((f) => f(r)));
        return {
          data: items[0] || null,
          error: items[0] ? null : { message: "No rows found" },
        };
      },
      then: (resolve: any) => {
        const store = getTableStore();
        let items = Array.from(store.values()).filter((r) => filters.every((f) => f(r)));
        if (orderByField) {
          items.sort((a, b) => {
            const valA = a[orderByField!];
            const valB = b[orderByField!];
            if (valA < valB) return orderAscending ? -1 : 1;
            if (valA > valB) return orderAscending ? 1 : -1;
            return 0;
          });
        }
        if (limitCount !== null) {
          items = items.slice(0, limitCount);
        }
        resolve({ data: items, error: null });
      },
    };

    return builder;
  },
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}));

vi.mock("@/lib/supabase/client", () => ({
  getDbClient: vi.fn(async () => mockSupabaseClient),
}));

describe("[GAS-003] Integración de Gastos con Caja y Reportes Financieros", () => {
  const businessId = "biz-test-gas003";
  const registerId = "reg-caja-principal";
  const openSessionId = "session-shift-01";

  beforeEach(() => {
    memoryExpenses.clear();
    memoryCashSessions.clear();
    memoryCashMovements.clear();
    memorySaleDocs.clear();
    memoryRestaurantOrders.clear();
    memorySuppliers.clear();
    memoryProducts.clear();

    // Sesión de caja abierta con $100.000 de base inicial
    memoryCashSessions.set(openSessionId, {
      id: openSessionId,
      business_id: businessId,
      register_id: registerId,
      status: "open",
      opened_at: new Date().toISOString(),
      initial_amount: 100000,
      notes: "Turno mañana",
    });
  });

  it("Un gasto en efectivo de $50.000 reduce el efectivo del turno de caja activo en $50.000", async () => {
    // 1. Verificar estado inicial de caja
    const summaryBefore = await getCashSessionSummary(businessId, openSessionId);
    expect(summaryBefore.initialAmount).toBe(100000);
    expect(summaryBefore.totalExpenses).toBe(0);
    expect(summaryBefore.expectedCashInDrawer).toBe(100000);

    // 2. Registrar un gasto de $50.000 en Efectivo
    const result = await createExpense(
      businessId,
      {
        concept: "Compra urgente de insumos de aseo",
        amount: 50000,
        category: "Servicios y Mantenimiento",
        paymentMethod: "Efectivo",
        notes: "Gasto de caja menor",
      },
      "user-cashier-1"
    );

    expect(result.success).toBe(true);
    expect(result.expense).toBeDefined();

    // 3. Validar que se creó el movimiento de caja correspondiente tipo 'expense'
    const movements = Array.from(memoryCashMovements.values()).filter(
      (m) => m.session_id === openSessionId && m.business_id === businessId
    );
    expect(movements.length).toBe(1);
    expect(movements[0].movement_type).toBe("expense");
    expect(Number(movements[0].amount)).toBe(50000);
    expect(movements[0].reference_type).toBe("expense");
    expect(movements[0].reference_id).toBe(result.expense?.id);

    // 4. Validar el resumen de caja: el totalExpenses es $50.000 y el efectivo esperado se redujo exactamente a $50.000
    const summaryAfter = await getCashSessionSummary(businessId, openSessionId);
    expect(summaryAfter.totalExpenses).toBe(50000);
    expect(summaryAfter.expectedCashInDrawer).toBe(50000); // 100.000 - 50.000 = 50.000
  });

  it("Un gasto con método de pago distinto a Efectivo (ej. Transferencia) NO genera movimiento de caja", async () => {
    const result = await createExpense(
      businessId,
      {
        concept: "Pago de internet vía bancaria",
        amount: 80000,
        category: "Servicios Públicos",
        paymentMethod: "Transferencia",
      },
      "user-admin"
    );

    expect(result.success).toBe(true);

    // No debe crearse ningún registro en cash_movements
    const movements = Array.from(memoryCashMovements.values());
    expect(movements.length).toBe(0);

    const summary = await getCashSessionSummary(businessId, openSessionId);
    expect(summary.totalExpenses).toBe(0);
    expect(summary.expectedCashInDrawer).toBe(100000);
  });

  it("Si no hay turno de caja abierto, el gasto en efectivo se registra sin lanzar excepción no controlada", async () => {
    // Cerrar la sesión de caja
    memoryCashSessions.set(openSessionId, {
      ...memoryCashSessions.get(openSessionId),
      status: "closed",
    });

    const result = await createExpense(
      businessId,
      {
        concept: "Gasto fuera de turno",
        amount: 25000,
        category: "Transporte y Logística",
        paymentMethod: "Efectivo",
      },
      "user-cashier-1"
    );

    expect(result.success).toBe(true);
    expect(result.expense?.amount).toBe(25000);
    expect(Array.from(memoryCashMovements.values()).length).toBe(0);
  });

  it("Al anular/eliminar un gasto en efectivo, el movimiento de caja se elimina y se restaura el saldo en caja", async () => {
    // 1. Registrar gasto en efectivo
    const createRes = await createExpense(
      businessId,
      {
        concept: "Gasto accidental",
        amount: 30000,
        category: "Otros Operativos",
        paymentMethod: "Efectivo",
      },
      "user-cashier-1"
    );
    expect(createRes.success).toBe(true);

    let summary = await getCashSessionSummary(businessId, openSessionId);
    expect(summary.totalExpenses).toBe(30000);
    expect(summary.expectedCashInDrawer).toBe(70000);

    // 2. Anular el gasto
    const deleteRes = await deleteExpense(businessId, createRes.expense!.id);
    expect(deleteRes.success).toBe(true);

    // 3. El movimiento de caja debió eliminarse y el saldo esperado vuelve a $100.000
    summary = await getCashSessionSummary(businessId, openSessionId);
    expect(summary.totalExpenses).toBe(0);
    expect(summary.expectedCashInDrawer).toBe(100000);
  });

  it("En el reporte financiero, los gastos se restan de los ingresos (Ingresos - Gastos = Resultado)", async () => {
    // 1. Simular ventas por $300.000
    memorySaleDocs.set("sale-doc-1", {
      id: "sale-doc-1",
      business_id: businessId,
      total: 300000,
      status: "paid",
      issued_at: new Date().toISOString(),
    });

    // 2. Registrar gastos: uno operativo de $50.000 y uno de producción de $70.000 (Total gastos = $120.000)
    await createExpense(
      businessId,
      {
        concept: "Pago de luz",
        amount: 50000,
        category: "Servicios Públicos",
        paymentMethod: "Efectivo",
      },
      "user-admin"
    );

    await createExpense(
      businessId,
      {
        concept: "Materia prima carne",
        amount: 70000,
        category: "Materia Prima",
        paymentMethod: "Transferencia",
      },
      "user-admin"
    );

    // 3. Consultar reporte financiero
    const report = await getFinancialReport(businessId);

    expect(report.income.totalSales).toBe(300000);
    expect(report.expenses.totalExpenses).toBe(120000);
    expect(report.expenses.operationalExpenses).toBe(50000);
    expect(report.expenses.productionExpenses).toBe(70000);

    // Ecuación de aceptación: Ingresos - Gastos = Resultado
    // $300.000 - $120.000 = $180.000
    expect(report.netIncome).toBe(180000);
    expect(report.isProfitable).toBe(true);
    expect(report.netMarginPercentage).toBe(60); // 180000 / 300000 * 100 = 60%
  });

  it("Verificación de Regla de Usuario: Prohibido uso de alertas nativas en archivos relacionados a gastos y cajas", () => {
    const filesToCheck = [
      path.join(process.cwd(), "src/lib/expenses/expenses-service.ts"),
      path.join(process.cwd(), "src/lib/cash/cash-service.ts"),
      path.join(process.cwd(), "src/app/workspace/[businessId]/gastos/actions.ts"),
      path.join(process.cwd(), "src/app/workspace/[businessId]/gastos/expense-form-modal.tsx"),
      path.join(process.cwd(), "src/app/workspace/[businessId]/gastos/workspace-gastos-client.tsx"),
    ];

    for (const filePath of filesToCheck) {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        expect(content).not.toMatch(/\bwindow\.alert\b/);
        expect(content).not.toMatch(/\bwindow\.confirm\b/);
        expect(content).not.toMatch(/\bwindow\.prompt\b/);
        expect(content).not.toMatch(/\bAlert\.alert\b/);
      }
    }
  });
});
