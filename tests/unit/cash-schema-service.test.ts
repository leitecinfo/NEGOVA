import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  CreateCashRegisterInputSchema,
  OpenSessionInputSchema,
  CloseSessionInputSchema,
  CreateCashMovementInputSchema,
  CashMovementTypeSchema,
} from "../../src/lib/cash/types";
import {
  getCashRegisters,
  ensureDefaultCashRegister,
  createCashRegister,
  getActiveCashSession,
  openCashSession,
  closeCashSession,
  recordCashMovement,
  getCashMovements,
  getCashSessionSummary,
} from "../../src/lib/cash/cash-service";

// ==============================================================================
// SIMULACIÓN MULTI-TENANT EN MEMORIA
// ==============================================================================

const BUSINESS_A = "11111111-aaaa-4aaa-aaaa-111111111111";
const BUSINESS_B = "22222222-bbbb-4bbb-bbbb-222222222222";

let inMemoryRegisters: any[] = [];
let inMemorySessions: any[] = [];
let inMemoryMovements: any[] = [];
let inMemoryLocations: any[] = [];

const mockSupabase = {
  from: (tableName: string) => {
    if (tableName === "cash_registers") {
      return {
        select: (cols: string = "*") => {
          let list = [...inMemoryRegisters];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            order: (col: string, opts?: any) => {
              list.sort((a, b) => {
                if (a[col] < b[col]) return opts?.ascending === false ? 1 : -1;
                if (a[col] > b[col]) return opts?.ascending === false ? -1 : 1;
                return 0;
              });
              return chain;
            },
            limit: (n: number) => {
              list = list.slice(0, n);
              return chain;
            },
            limit: (n: number) => {
              list = list.slice(0, n);
              return chain;
            },
            maybeSingle: () => Promise.resolve({ data: list[0] || null, error: null }),
            single: () => {
              if (list[0]) return Promise.resolve({ data: list[0], error: null });
              return Promise.resolve({ data: null, error: new Error("Register not found") });
            },
            then: (resolve: any, reject?: any) => {
              return Promise.resolve({ data: list, error: null }).then(resolve, reject);
            },
          };
          return chain;
        },
        insert: (data: any) => {
          const row = {
            id: data.id || crypto.randomUUID(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...data,
          };
          inMemoryRegisters.push(row);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: row, error: null }),
            }),
          };
        },
      };
    }

    if (tableName === "cash_sessions") {
      return {
        select: (cols: string = "*") => {
          let list = [...inMemorySessions];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            order: (col: string, opts?: any) => {
              list.sort((a, b) => {
                if (a[col] < b[col]) return opts?.ascending === false ? 1 : -1;
                if (a[col] > b[col]) return opts?.ascending === false ? -1 : 1;
                return 0;
              });
              return chain;
            },
            limit: (n: number) => {
              list = list.slice(0, n);
              return chain;
            },
            maybeSingle: () => Promise.resolve({ data: list[0] || null, error: null }),
            single: () => {
              if (list[0]) return Promise.resolve({ data: list[0], error: null });
              return Promise.resolve({ data: null, error: new Error("Session not found") });
            },
            then: (resolve: any, reject?: any) => {
              return Promise.resolve({ data: list, error: null }).then(resolve, reject);
            },
          };
          return chain;
        },
        insert: (data: any) => {
          // Emular restricción de índice único parcial (1 sesión abierta por caja)
          if (data.status === "open") {
            const alreadyOpen = inMemorySessions.find(
              (s) => s.register_id === data.register_id && s.status === "open"
            );
            if (alreadyOpen) {
              return {
                select: () => ({
                  single: () =>
                    Promise.resolve({
                      data: null,
                      error: new Error("duplicate key value violates unique constraint 'idx_cash_sessions_single_open_per_register'"),
                    }),
                }),
              };
            }
          }
          const row = {
            id: data.id || crypto.randomUUID(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...data,
          };
          inMemorySessions.push(row);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: row, error: null }),
            }),
          };
        },
        update: (data: any) => {
          const chain: any = {
            eq: (col1: string, val1: any) => ({
              eq: (col2: string, val2: any) => {
                const idx = inMemorySessions.findIndex((s) => s[col1] === val1 && s[col2] === val2);
                if (idx >= 0) {
                  inMemorySessions[idx] = {
                    ...inMemorySessions[idx],
                    ...data,
                    updated_at: new Date().toISOString(),
                  };
                  return {
                    select: () => ({
                      single: () => Promise.resolve({ data: inMemorySessions[idx], error: null }),
                    }),
                  };
                }
                return {
                  select: () => ({
                    single: () => Promise.resolve({ data: null, error: new Error("Session not found for update") }),
                  }),
                };
              },
            }),
          };
          return chain;
        },
      };
    }

    if (tableName === "cash_movements") {
      return {
        select: (cols: string = "*") => {
          let list = [...inMemoryMovements];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            order: (col: string, opts?: any) => {
              list.sort((a, b) => {
                if (a[col] < b[col]) return opts?.ascending === false ? 1 : -1;
                if (a[col] > b[col]) return opts?.ascending === false ? -1 : 1;
                return 0;
              });
              return chain;
            },
            limit: (n: number) => {
              list = list.slice(0, n);
              return chain;
            },
            then: (resolve: any, reject?: any) => {
              return Promise.resolve({ data: list, error: null }).then(resolve, reject);
            },
          };
          return chain;
        },
        insert: (data: any) => {
          const row = {
            id: data.id || crypto.randomUUID(),
            created_at: new Date().toISOString(),
            ...data,
          };
          inMemoryMovements.push(row);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: row, error: null }),
            }),
          };
        },
      };
    }

    if (tableName === "locations") {
      return {
        select: (cols: string = "*") => {
          let list = [...inMemoryLocations];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            order: (col: string, opts?: any) => chain,
            limit: (n: number) => {
              list = list.slice(0, n);
              return chain;
            },
            maybeSingle: () => Promise.resolve({ data: list[0] || null, error: null }),
          };
          return chain;
        },
      };
    }

    throw new Error(`Table not mocked: ${tableName}`);
  },
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabase),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabase),
}));

describe("CAJ-001: Esquema de Cajas, Turnos y Movimientos", () => {
  beforeEach(() => {
    inMemoryRegisters = [];
    inMemorySessions = [];
    inMemoryMovements = [];
    inMemoryLocations = [];
    vi.clearAllMocks();
  });

  describe("1. Validación de tipos y esquemas Zod", () => {
    it("valida tipos de movimiento permitidos", () => {
      const validTypes = [
        "sale_cash",
        "sale_card",
        "sale_digital",
        "expense",
        "entry",
        "withdrawal",
      ];
      validTypes.forEach((t) => {
        expect(CashMovementTypeSchema.safeParse(t).success).toBe(true);
      });
      expect(CashMovementTypeSchema.safeParse("invalid_type").success).toBe(false);
    });

    it("valida la creación de caja con parámetros correctos", () => {
      const res = CreateCashRegisterInputSchema.safeParse({
        name: "Caja Barra",
        locationId: "11111111-1111-4111-8111-111111111111",
        isActive: true,
      });
      expect(res.success).toBe(true);
    });

    it("rechaza la creación de caja con nombre vacío", () => {
      const res = CreateCashRegisterInputSchema.safeParse({
        name: "   ",
      });
      expect(res.success).toBe(false);
    });

    it("valida la apertura de turno con base inicial positiva o cero", () => {
      const res = OpenSessionInputSchema.safeParse({
        registerId: "11111111-1111-4111-8111-111111111111",
        initialAmount: 200000,
        notes: "Turno mañana",
      });
      expect(res.success).toBe(true);

      const invalid = OpenSessionInputSchema.safeParse({
        registerId: "11111111-1111-4111-8111-111111111111",
        initialAmount: -5000,
      });
      expect(invalid.success).toBe(false);
    });

    it("valida el cierre de turno con monto final contado", () => {
      const res = CloseSessionInputSchema.safeParse({
        sessionId: "11111111-1111-4111-8111-111111111111",
        finalAmountCounted: 350000,
        notes: "Cierre cuadrado",
      });
      expect(res.success).toBe(true);
    });
  });

  describe("2. Criterio de Aceptación: Un negocio puede tener múltiples cajas", () => {
    it("crea automáticamente la caja principal si no existe ninguna", async () => {
      const reg = await ensureDefaultCashRegister(BUSINESS_A);
      expect(reg).toBeDefined();
      expect(reg.businessId).toBe(BUSINESS_A);
      expect(reg.name).toBe("Caja Principal");
      expect(reg.isActive).toBe(true);

      // Idempotencia: segunda llamada retorna la existente
      const secondCall = await ensureDefaultCashRegister(BUSINESS_A);
      expect(secondCall.id).toBe(reg.id);
      expect(inMemoryRegisters.length).toBe(1);
    });

    it("permite registrar múltiples cajas en el mismo negocio", async () => {
      await ensureDefaultCashRegister(BUSINESS_A);
      const reg2 = await createCashRegister(BUSINESS_A, {
        name: "Caja Barra / Terraza",
        isActive: true,
      });
      const reg3 = await createCashRegister(BUSINESS_A, {
        name: "Caja Domicilios / Call",
        isActive: true,
      });

      const all = await getCashRegisters(BUSINESS_A);
      expect(all.length).toBe(3);
      expect(all.map((c) => c.name)).toContain("Caja Principal");
      expect(all.map((c) => c.name)).toContain("Caja Barra / Terraza");
      expect(all.map((c) => c.name)).toContain("Caja Domicilios / Call");
    });

    it("mantiene aislamiento multi-tenant estricto de cajas", async () => {
      await createCashRegister(BUSINESS_A, { name: "Caja Negocio A" });
      await createCashRegister(BUSINESS_B, { name: "Caja Negocio B" });

      const listA = await getCashRegisters(BUSINESS_A);
      const listB = await getCashRegisters(BUSINESS_B);

      expect(listA.length).toBe(1);
      expect(listA[0].name).toBe("Caja Negocio A");

      expect(listB.length).toBe(1);
      expect(listB[0].name).toBe("Caja Negocio B");
    });
  });

  describe("3. Criterio de Aceptación: Solo puede existir 1 sesión abierta por caja a la vez", () => {
    it("permite abrir una sesión en una caja libre", async () => {
      const reg = await ensureDefaultCashRegister(BUSINESS_A);
      const session = await openCashSession(
        BUSINESS_A,
        {
          registerId: reg.id,
          initialAmount: 150000,
          notes: "Apertura turno mañana",
        },
        "usr_cajero_1"
      );

      expect(session.id).toBeDefined();
      expect(session.status).toBe("open");
      expect(session.initialAmount).toBe(150000);
      expect(session.openedBy).toBe("usr_cajero_1");

      const active = await getActiveCashSession(BUSINESS_A, reg.id);
      expect(active?.id).toBe(session.id);
    });

    it("rechaza abrir una segunda sesión si ya existe una abierta en la misma caja", async () => {
      const reg = await ensureDefaultCashRegister(BUSINESS_A);
      await openCashSession(
        BUSINESS_A,
        {
          registerId: reg.id,
          initialAmount: 100000,
        },
        "usr_cajero_1"
      );

      // Intentar abrir otra sesión en la misma caja
      await expect(
        openCashSession(
          BUSINESS_A,
          {
            registerId: reg.id,
            initialAmount: 50000,
          },
          "usr_cajero_2"
        )
      ).rejects.toThrow("Ya existe un turno abierto para esta caja");
    });

    it("permite abrir una nueva sesión una vez cerrada la anterior", async () => {
      const reg = await ensureDefaultCashRegister(BUSINESS_A);
      const session1 = await openCashSession(
        BUSINESS_A,
        {
          registerId: reg.id,
          initialAmount: 100000,
        },
        "usr_cajero_1"
      );

      // Cerrar sesión 1
      const closedSession1 = await closeCashSession(
        BUSINESS_A,
        {
          sessionId: session1.id,
          finalAmountCounted: 280000,
          notes: "Cierre exitoso sin descuadres",
        },
        "usr_cajero_1"
      );

      expect(closedSession1.status).toBe("closed");
      expect(closedSession1.finalAmountCounted).toBe(280000);

      // Verificar que ya no hay sesión activa
      const activeAfterClose = await getActiveCashSession(BUSINESS_A, reg.id);
      expect(activeAfterClose).toBeNull();

      // Abrir sesión 2 debe ser permitido
      const session2 = await openCashSession(
        BUSINESS_A,
        {
          registerId: reg.id,
          initialAmount: 280000,
          notes: "Apertura turno noche",
        },
        "usr_cajero_2"
      );

      expect(session2.id).toBeDefined();
      expect(session2.status).toBe("open");
    });
  });

  describe("4. Criterio de Aceptación: Trazabilidad completa de movimientos", () => {
    it("registra movimientos de ventas, gastos, entradas y retiros y calcula el arqueo de caja", async () => {
      const reg = await ensureDefaultCashRegister(BUSINESS_A);
      const session = await openCashSession(
        BUSINESS_A,
        {
          registerId: reg.id,
          initialAmount: 100000, // Base inicial: 100.000
        },
        "usr_cajero_1"
      );

      const orderRef = crypto.randomUUID();

      // Venta en efectivo: +50.000
      await recordCashMovement(
        BUSINESS_A,
        {
          sessionId: session.id,
          movementType: "sale_cash",
          amount: 50000,
          referenceId: orderRef,
          referenceType: "order",
          notes: "Venta orden #101",
        },
        "usr_cajero_1"
      );

      // Venta con tarjeta: +30.000 (no afecta efectivo en cajón)
      await recordCashMovement(
        BUSINESS_A,
        {
          sessionId: session.id,
          movementType: "sale_card",
          amount: 30000,
          referenceType: "order",
          notes: "Venta datafono orden #102",
        },
        "usr_cajero_1"
      );

      // Gasto de caja: -15.000 (compra de hielo)
      await recordCashMovement(
        BUSINESS_A,
        {
          sessionId: session.id,
          movementType: "expense",
          amount: 15000,
          notes: "Compra de hielo de emergencia",
        },
        "usr_cajero_1"
      );

      // Retiro parcial: -20.000
      await recordCashMovement(
        BUSINESS_A,
        {
          sessionId: session.id,
          movementType: "withdrawal",
          amount: 20000,
          notes: "Retiro para consignación bancaria",
        },
        "usr_cajero_1"
      );

      const movements = await getCashMovements(BUSINESS_A, session.id);
      expect(movements.length).toBe(4);

      // Efectivo esperado = 100.000 + 50.000 - 15.000 - 20.000 = 115.000
      const summary = await getCashSessionSummary(BUSINESS_A, session.id);
      expect(summary.initialAmount).toBe(100000);
      expect(summary.totalSalesCash).toBe(50000);
      expect(summary.totalSalesCard).toBe(30000);
      expect(summary.totalExpenses).toBe(15000);
      expect(summary.totalWithdrawals).toBe(20000);
      expect(summary.expectedCashInDrawer).toBe(115000);

      // Al cerrar contando 115.000 la diferencia es 0
      await closeCashSession(
        BUSINESS_A,
        {
          sessionId: session.id,
          finalAmountCounted: 115000,
        },
        "usr_cajero_1"
      );

      const closedSummary = await getCashSessionSummary(BUSINESS_A, session.id);
      expect(closedSummary.difference).toBe(0);
    });

    it("impide registrar movimientos en una sesión cerrada", async () => {
      const reg = await ensureDefaultCashRegister(BUSINESS_A);
      const session = await openCashSession(
        BUSINESS_A,
        { registerId: reg.id, initialAmount: 50000 },
        "usr_cajero_1"
      );

      await closeCashSession(
        BUSINESS_A,
        { sessionId: session.id, finalAmountCounted: 50000 },
        "usr_cajero_1"
      );

      await expect(
        recordCashMovement(BUSINESS_A, {
          sessionId: session.id,
          movementType: "sale_cash",
          amount: 10000,
        })
      ).rejects.toThrow("No se pueden registrar movimientos en una sesión de caja cerrada");
    });
  });

  describe("5. Validación estática del archivo de migración SQL", () => {
    it("la migración SQL contiene las tablas, partial unique index, RLS y triggers requeridos", () => {
      const migrationPath = join(
        process.cwd(),
        "supabase/migrations/20261029190000_cash_registers_and_sessions_schema.sql"
      );
      const sqlContent = readFileSync(migrationPath, "utf-8");

      // Tablas requeridas
      expect(sqlContent).toContain("CREATE TABLE IF NOT EXISTS public.cash_registers");
      expect(sqlContent).toContain("CREATE TABLE IF NOT EXISTS public.cash_sessions");
      expect(sqlContent).toContain("CREATE TABLE IF NOT EXISTS public.cash_movements");

      // Criterio de aceptación crítico: Índice único parcial para 1 sesión abierta por caja
      expect(sqlContent).toContain("CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_sessions_single_open_per_register");
      expect(sqlContent).toContain("WHERE (status = 'open')");

      // Claves foráneas y tipos esperados
      expect(sqlContent).toContain("REFERENCES public.businesses(id)");
      expect(sqlContent).toContain("REFERENCES public.locations(id)");
      expect(sqlContent).toContain("REFERENCES public.cash_registers(id)");
      expect(sqlContent).toContain("REFERENCES public.business_users(id)");

      // RLS habilitado en todas las tablas
      expect(sqlContent).toContain("ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;");
      expect(sqlContent).toContain("ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;");
      expect(sqlContent).toContain("ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;");

      // Políticas RLS con filtro por business_id
      expect(sqlContent).toContain("tenant_cash_registers_read");
      expect(sqlContent).toContain("tenant_cash_sessions_read");
      expect(sqlContent).toContain("tenant_cash_movements_read");
      expect(sqlContent).toContain("WHERE bu.business_id = cash_registers.business_id");
      expect(sqlContent).toContain("WHERE bu.business_id = cash_sessions.business_id");
      expect(sqlContent).toContain("WHERE bu.business_id = cash_movements.business_id");

      // Trigger para creación automática de caja en nuevos comercios
      expect(sqlContent).toContain("CREATE OR REPLACE FUNCTION public.handle_new_business_default_cash_register()");
      expect(sqlContent).toContain("CREATE TRIGGER trg_business_default_cash_register");

      // Migración de datos idempotente para comercios existentes
      expect(sqlContent).toContain("WHERE NOT EXISTS");
      expect(sqlContent).toContain("FROM public.cash_registers cr WHERE cr.business_id = b.id");
    });
  });
});
