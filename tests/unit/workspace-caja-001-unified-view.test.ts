import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  getCashOverview,
  openCashSession,
  recordCashMovement,
  closeCashSession,
  getAllBusinessCashMovements,
  getBusinessCashSessionsHistory,
  getBusinessCashiers,
} from "@/lib/cash/cash-service";

const BUSINESS_ID = "b1111111-2222-4333-8444-555555555555";
const REGISTER_1_ID = "c1111111-1111-4111-8111-111111111111";
const REGISTER_2_ID = "c2222222-2222-4222-8222-222222222222";
const USER_1_ID = "a1111111-1111-4111-8111-111111111111";
const USER_2_ID = "a2222222-2222-4222-8222-222222222222";

let inMemoryRegisters: any[] = [];
let inMemorySessions: any[] = [];
let inMemoryMovements: any[] = [];
let inMemoryBusinessUsers: any[] = [];
let inMemoryUsers: any[] = [];

const mockSupabaseClient = {
  from: (table: string) => {
    let currentTable = table;
    let filters: Array<{ col: string; val: any; type?: string }> = [];
    let orderByField: string | null = null;
    let orderAscending = true;
    let limitCount: number | null = null;

    const getTableStore = () => {
      if (currentTable === "cash_registers") return inMemoryRegisters;
      if (currentTable === "cash_sessions") return inMemorySessions;
      if (currentTable === "cash_movements") return inMemoryMovements;
      if (currentTable === "business_users") return inMemoryBusinessUsers;
      if (currentTable === "users") return inMemoryUsers;
      return [];
    };

    const applyFilters = (rows: any[]) =>
      rows.filter((r) =>
        filters.every((f) => {
          if (f.type === "in") {
            return Array.isArray(f.val) && f.val.includes(r[f.col]);
          }
          return r[f.col] === f.val;
        })
      );

    const builder: any = {
      select: vi.fn((_cols?: string) => builder),
      eq: vi.fn((col: string, val: any) => {
        filters.push({ col, val });
        return builder;
      }),
      in: vi.fn((col: string, val: any[]) => {
        filters.push({ col, val, type: "in" });
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
      maybeSingle: vi.fn(async () => {
        const rows = applyFilters(getTableStore());
        return { data: rows[0] || null, error: null };
      }),
      single: vi.fn(async () => {
        const rows = applyFilters(getTableStore());
        if (!rows[0]) return { data: null, error: { message: "No rows found" } };
        return { data: rows[0], error: null };
      }),
      insert: vi.fn((payload: any) => {
        const store = getTableStore();
        const id = payload.id || crypto.randomUUID();
        const offset = store.length * 100;
        const now = new Date(Date.now() + offset).toISOString();
        const record = {
          id,
          updated_at: now,
          opened_at: now,
          ...payload,
          created_at: now,
        };
        store.push(record);
        return {
          data: record,
          error: null,
          select: () => ({
            single: async () => ({ data: record, error: null }),
          }),
        };
      }),
      update: vi.fn((payload: any) => {
        const updateChain: any = {
          eq: (col: string, val: any) => {
            filters.push({ col, val });
            return updateChain;
          },
          select: () => ({
            single: async () => {
              const store = getTableStore();
              const rows = applyFilters(store);
              for (const row of rows) {
                Object.assign(row, payload, { updated_at: new Date().toISOString() });
              }
              return { data: rows[0] || null, error: null };
            },
          }),
          single: async () => {
            const store = getTableStore();
            const rows = applyFilters(store);
            for (const row of rows) {
              Object.assign(row, payload, { updated_at: new Date().toISOString() });
            }
            return { data: rows[0] || null, error: null };
          },
          then: (resolve: any, reject?: any) => {
            const store = getTableStore();
            const rows = applyFilters(store);
            for (const row of rows) {
              Object.assign(row, payload, { updated_at: new Date().toISOString() });
            }
            return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
          },
        };
        return updateChain;
      }),
      then: (resolve: any, reject?: any) => {
        let rows = applyFilters(getTableStore());
        if (orderByField) {
          rows.sort((a, b) => {
            if (a[orderByField!] < b[orderByField!]) return orderAscending ? -1 : 1;
            if (a[orderByField!] > b[orderByField!]) return orderAscending ? 1 : -1;
            return 0;
          });
        }
        if (limitCount !== null) {
          rows = rows.slice(0, limitCount);
        }
        return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
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

describe("[CAJA-001] Módulo Cajas: Vista Unificada con KPIs, Tarjeta de Caja Activa y Pestañas", () => {
  beforeEach(() => {
    inMemoryRegisters = [
      {
        id: REGISTER_1_ID,
        business_id: BUSINESS_ID,
        name: "Caja Principal",
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: REGISTER_2_ID,
        business_id: BUSINESS_ID,
        name: "Caja Barra",
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ];
    inMemorySessions = [];
    inMemoryMovements = [];
    inMemoryBusinessUsers = [
      {
        id: "bu-1",
        business_id: BUSINESS_ID,
        user_id: USER_1_ID,
        role: "Cajero",
        status: "active",
        users: { id: USER_1_ID, name: "María González", email: "maria@negova.com" },
      },
      {
        id: "bu-2",
        business_id: BUSINESS_ID,
        user_id: USER_2_ID,
        role: "Administrador",
        status: "active",
        users: { id: USER_2_ID, name: "Carlos Dueño", email: "carlos@negova.com" },
      },
    ];
    inMemoryUsers = [
      { id: USER_1_ID, name: "María González", email: "maria@negova.com" },
      { id: USER_2_ID, name: "Carlos Dueño", email: "carlos@negova.com" },
    ];
  });

  describe("1. Inspección de Código y Criterios Visuales [CAJA-001]", () => {
    const clientPath = path.resolve(
      process.cwd(),
      "src/components/cash/workspace-caja-client.tsx"
    );

    it("el archivo del cliente unificado de cajas debe existir", () => {
      expect(fs.existsSync(clientPath)).toBe(true);
    });

    it("Regla de Oro: Prohibido estrictamente window.alert, window.confirm, window.prompt y Alert.alert", () => {
      const code = fs.readFileSync(clientPath, "utf-8");
      expect(code).not.toMatch(/\bwindow\.alert\b/);
      expect(code).not.toMatch(/\bwindow\.confirm\b/);
      expect(code).not.toMatch(/\bwindow\.prompt\b/);
      expect(code).not.toMatch(/\bAlert\.alert\b/);
      expect(code).toMatch(/toast/);
    });

    it("1. Encabezado y Acciones: Título 'Cajas', descripción y botones superiores requeridos", () => {
      const code = fs.readFileSync(clientPath, "utf-8");
      expect(code).toContain("Cajas");
      expect(code).toContain("Abre y cierra turnos, registra entradas y salidas de efectivo y mira cuánto debe haber en cada caja.");
      expect(code).toContain("Cierre diario");
      expect(code).toContain("Movimiento");
      expect(code).toContain("+ Nueva caja");
    });

    it("2. Métricas y KPIs: Cajas abiertas, Efectivo en cajas, Vendido en turnos abiertos, Entradas y salidas netas", () => {
      const code = fs.readFileSync(clientPath, "utf-8");
      expect(code).toContain("Cajas abiertas");
      expect(code).toContain("Efectivo en cajas");
      expect(code).toContain("Vendido en turnos");
      expect(code).toContain("Entradas / Salidas netas");
    });

    it("3. Tarjeta de Detalle de Caja Activa: Abierta, TU CAJA, menú contextual, desglose de arqueo y cajero", () => {
      const code = fs.readFileSync(clientPath, "utf-8");
      expect(code).toContain("Abierta");
      expect(code).toContain("TU CAJA");
      expect(code).toContain("Efectivo esperado en caja");
      expect(code).toContain("Desglose de Arqueo");
      expect(code).toContain("Base de apertura:");
      expect(code).toContain("+ Ventas en efectivo:");
      expect(code).toContain("- Salidas (Gastos/Retiros):");
      expect(code).toContain("Resumen de Ventas");
      expect(code).toContain("Cerrar caja");
    });

    it("4. Pestañas de Gestión: Movimientos, Historial de turnos y Cajeros", () => {
      const code = fs.readFileSync(clientPath, "utf-8");
      expect(code).toContain("Movimientos");
      expect(code).toContain("Historial de turnos");
      expect(code).toContain("Cajeros");
    });
  });

  describe("2. Lógica Reactiva de Arqueo y KPIs en Tiempo Real", () => {
    it("debe calcular reactivamente los KPIs globales de cajas abiertas, efectivo en cajón y ventas", async () => {
      // 1. Abrir turno en Caja 1 con base $150.000
      const session1 = await openCashSession(
        BUSINESS_ID,
        { registerId: REGISTER_1_ID, initialAmount: 150000 },
        USER_1_ID
      );

      // Venta en efectivo $80.000
      await recordCashMovement(
        BUSINESS_ID,
        { sessionId: session1.id, movementType: "sale_cash", amount: 80000 },
        USER_1_ID
      );

      // Entrada manual $30.000
      await recordCashMovement(
        BUSINESS_ID,
        { sessionId: session1.id, movementType: "entry", amount: 30000, notes: "Aporte sencillo" },
        USER_1_ID
      );

      // Gasto de caja $20.000
      await recordCashMovement(
        BUSINESS_ID,
        { sessionId: session1.id, movementType: "expense", amount: 20000, notes: "Compra de cinta" },
        USER_1_ID
      );

      const overview = await getCashOverview(BUSINESS_ID);

      // 1 caja abierta de 2
      expect(overview.kpis.openSessionsCount).toBe(1);
      expect(overview.kpis.totalRegistersCount).toBe(2);

      // Efectivo en cajón: 150k (base) + 80k (venta cash) + 30k (entrada) - 20k (gasto) = 240k
      expect(overview.kpis.totalCashInDrawers).toBe(240000);
      expect(overview.kpis.totalSalesInOpenSessions).toBe(80000);

      // Entradas netas: 30k (entrada) - 20k (salidas) = +10k
      expect(overview.kpis.netEntriesWithdrawals).toBe(10000);
    });

    it("debe listar cronológicamente los movimientos de caja para la Pestaña 1", async () => {
      const session = await openCashSession(
        BUSINESS_ID,
        { registerId: REGISTER_1_ID, initialAmount: 100000 },
        USER_1_ID
      );

      await recordCashMovement(
        BUSINESS_ID,
        { sessionId: session.id, movementType: "sale_cash", amount: 45000 },
        USER_1_ID
      );

      await recordCashMovement(
        BUSINESS_ID,
        { sessionId: session.id, movementType: "withdrawal", amount: 15000, notes: "Pago a domiciliario" },
        USER_1_ID
      );

      const movements = await getAllBusinessCashMovements(BUSINESS_ID);

      expect(movements.length).toBe(2);
      expect(movements[0].movementType).toBe("withdrawal");
      expect(movements[0].amount).toBe(15000);
      expect(movements[1].movementType).toBe("sale_cash");
      expect(movements[1].amount).toBe(45000);
    });

    it("debe devolver el historial de turnos con cálculo de diferencia (sobrante/faltante) para la Pestaña 2", async () => {
      // 1. Abrir y cerrar turno con faltante
      const session = await openCashSession(
        BUSINESS_ID,
        { registerId: REGISTER_1_ID, initialAmount: 100000 },
        USER_1_ID
      );

      await recordCashMovement(
        BUSINESS_ID,
        { sessionId: session.id, movementType: "sale_cash", amount: 50000 },
        USER_1_ID
      );

      // Esperado: 150.000. Contado: 148.000 -> Faltante de -2.000
      await closeCashSession(
        BUSINESS_ID,
        { sessionId: session.id, finalAmountCounted: 148000, notes: "Faltaron 2 mil" },
        USER_1_ID
      );

      const history = await getBusinessCashSessionsHistory(BUSINESS_ID);

      expect(history.length).toBe(1);
      expect(history[0].status).toBe("closed");
      expect(history[0].initialAmount).toBe(100000);
      expect(history[0].expectedCash).toBe(150000);
      expect(history[0].finalAmountCounted).toBe(148000);
      expect(history[0].difference).toBe(-2000);
    });

    it("debe listar los colaboradores de caja y mapear su terminal activa para la Pestaña 3", async () => {
      // Abrir sesión por USER_1_ID (bu-1)
      await openCashSession(
        BUSINESS_ID,
        { registerId: REGISTER_1_ID, initialAmount: 50000 },
        USER_1_ID
      );

      const cashiers = await getBusinessCashiers(BUSINESS_ID);

      expect(cashiers.length).toBe(2);
      const cashier1 = cashiers.find((c) => c.email === "maria@negova.com");
      expect(cashier1).toBeDefined();
      expect(cashier1?.role).toBe("Cajero");
      expect(cashier1?.isOnline).toBe(true);
      expect(cashier1?.activeRegisterName).toBe("Caja Principal");

      const cashier2 = cashiers.find((c) => c.email === "carlos@negova.com");
      expect(cashier2).toBeDefined();
      expect(cashier2?.activeRegisterName).toBeNull();
      expect(cashier2?.isOnline).toBe(false);
    });
  });
});
