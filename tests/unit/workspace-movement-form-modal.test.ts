import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  createUnifiedMovement,
} from "@/lib/expenses/expenses-service";
import {
  CreateMovementInput,
  OPERATIONAL_CATEGORIES,
  PRODUCTION_CATEGORIES,
  INCOME_TYPES,
  INCOME_CATEGORIES,
} from "@/lib/expenses/types";

// In-memory data store for mocking Supabase
const memoryExpenses = new Map<string, any>();
const memoryCashSessions = new Map<string, any>();
const memoryCashMovements = new Map<string, any>();

const TEST_BIZ_ID = "b1111111-2222-4333-8444-555555555555";
const TEST_SESSION_ID = "sess-active-001";
const TEST_USER_ID = "u1111111-1111-4111-8111-111111111111";

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
        default:
          return new Map<string, any>();
      }
    };

    const builder: any = {
      select: vi.fn((_columns?: string) => builder),
      eq: vi.fn((field: string, val: any) => {
        filters.push((row: any) => row[field] === val);
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
        const store = getTableStore();
        let rows = Array.from(store.values()).filter((r) =>
          filters.every((f) => f(r))
        );
        if (orderByField) {
          rows.sort((a, b) => {
            if (a[orderByField!] < b[orderByField!]) return orderAscending ? -1 : 1;
            if (a[orderByField!] > b[orderByField!]) return orderAscending ? 1 : -1;
            return 0;
          });
        }
        return { data: rows[0] || null, error: null };
      }),
      single: vi.fn(async () => {
        const store = getTableStore();
        const rows = Array.from(store.values()).filter((r) =>
          filters.every((f) => f(r))
        );
        return { data: rows[0] || null, error: null };
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

describe("Formulario Modal para Registrar Ingresos y Egresos con impacto en caja activa", () => {
  beforeEach(() => {
    memoryExpenses.clear();
    memoryCashSessions.clear();
    memoryCashMovements.clear();

    // Crear sesión de caja abierta activa
    memoryCashSessions.set(TEST_SESSION_ID, {
      id: TEST_SESSION_ID,
      business_id: TEST_BIZ_ID,
      register_id: "reg-main-1",
      status: "open",
      opened_at: new Date().toISOString(),
      cash_registers: { name: "Caja Principal" },
    });
  });

  describe("1. Inspección Estática del Archivo y Reglas Globales", () => {
    const modalPath = path.resolve(
      process.cwd(),
      "src/app/workspace/[businessId]/gastos/movement-form-modal.tsx"
    );

    it("el archivo del modal debe existir en la ruta correcta", () => {
      expect(fs.existsSync(modalPath)).toBe(true);
    });

    it("está estrictamente PROHIBIDO el uso de alertas nativas (window.alert, confirm, prompt, Alert.alert)", () => {
      const code = fs.readFileSync(modalPath, "utf-8");
      expect(code).not.toMatch(/\bwindow\.alert\b/);
      expect(code).not.toMatch(/\bwindow\.confirm\b/);
      expect(code).not.toMatch(/\bwindow\.prompt\b/);
      expect(code).not.toMatch(/\bAlert\.alert\b/);
      expect(code).toMatch(/ModalPortal/);
      expect(code).toMatch(/toast/);
    });

    it("debe contener las pestañas destacadas [ 🔴 Registrar Egreso / Gasto ] vs [ 🟢 Registrar Ingreso Vario ]", () => {
      const code = fs.readFileSync(modalPath, "utf-8");
      expect(code).toContain("Registrar Egreso / Gasto");
      expect(code).toContain("Registrar Ingreso Vario");
    });

    it("en egreso debe contemplar Tipo de Gasto Operativo vs Producción", () => {
      const code = fs.readFileSync(modalPath, "utf-8");
      expect(code).toContain("Gasto Operativo");
      expect(code).toContain("Costo de Producción");
      expect(code).toContain("operational");
      expect(code).toContain("production");
    });

    it("debe incluir botón '+' para crear categorías al vuelo", () => {
      const code = fs.readFileSync(modalPath, "utf-8");
      expect(code).toMatch(/Nueva categoría al vuelo|Crear categoría al vuelo/i);
      expect(code).toMatch(/isCreatingCategory/);
      expect(code).toMatch(/handleAddCustomCategory/);
    });

    it("en ingreso debe contemplar los 5 tipos requeridos", () => {
      const code = fs.readFileSync(modalPath, "utf-8");
      expect(code).toContain("Aporte de capital");
      expect(code).toContain("Préstamo");
      expect(code).toContain("Venta extraordinaria (ej. aceite reciclado/chatarra)");
      expect(code).toContain("Devolución de proveedor");
      expect(code).toContain("Otro ingreso");
    });

    it("en ingreso debe permitir elegir destino: Efectivo vs Cuenta bancaria / Transferencia", () => {
      const code = fs.readFileSync(modalPath, "utf-8");
      expect(code).toContain("Efectivo (Caja Física)");
      expect(code).toContain("Cuenta Bancaria / Transferencia");
      expect(code).toContain("Suma automáticamente al saldo físico de la caja activa");
    });

    it("debe mostrar el Resumen al pie y los botones 'Cancelar' y 'Registrar movimiento'", () => {
      const code = fs.readFileSync(modalPath, "utf-8");
      expect(code).toContain("Resumen del Movimiento:");
      expect(code).toContain("Impacto en Caja Activa:");
      expect(code).toContain("Cancelar");
      expect(code).toContain("Registrar movimiento");
    });
  });

  describe("2. Procesamiento de Egreso con Impacto en Caja Activa", () => {
    it("debe registrar un egreso operativo en efectivo y descontar automáticamente de la caja activa", async () => {
      const input: CreateMovementInput = {
        flow: "expense",
        concept: "Pago de servicios públicos sede principal",
        description: "Pago de servicios públicos sede principal",
        amount: 180000,
        category: "Servicios Públicos",
        expenseType: "operational",
        date: new Date().toISOString(),
        paymentMethod: "efectivo",
        receiptNumber: "EPM-99412",
        thirdPartyName: "Empresas Públicas",
        deductFromCashRegister: true,
      };

      const result = await createUnifiedMovement(TEST_BIZ_ID, input, TEST_USER_ID);

      expect(result.success).toBe(true);
      expect(result.movement).toBeDefined();
      expect(result.movement?.amount).toBe(180000);
      expect(result.movement?.flow).toBe("expense");
      expect(result.movement?.category).toBe("Servicios Públicos");
      expect(result.movement?.expenseType).toBe("operational");

      // Verificar que se registró en cash_movements como gasto (descuento para arqueo)
      const cashMovements = Array.from(memoryCashMovements.values());
      expect(cashMovements.length).toBe(1);
      const cm = cashMovements[0];
      expect(cm.session_id).toBe(TEST_SESSION_ID);
      expect(cm.movement_type).toBe("expense");
      expect(cm.amount).toBe(180000);
      expect(cm.reference_type).toBe("expense");
      expect(cm.notes).toContain("Gasto: Pago de servicios públicos sede principal");
    });

    it("debe registrar un costo de producción pagado por transferencia sin afectar caja física", async () => {
      const input: CreateMovementInput = {
        flow: "expense",
        concept: "Compra de cilantro y verduras menores de urgencia",
        description: "Compra de cilantro y verduras menores de urgencia",
        amount: 45000,
        category: "Insumos Menores",
        expenseType: "production",
        date: new Date().toISOString(),
        paymentMethod: "transferencia",
        receiptNumber: "FAC-552",
        thirdPartyName: "Plaza Mayorista",
        deductFromCashRegister: false,
      };

      const result = await createUnifiedMovement(TEST_BIZ_ID, input, TEST_USER_ID);

      expect(result.success).toBe(true);
      expect(result.movement?.expenseType).toBe("production");
      expect(result.movement?.cajaBadge).toBe("Transferencia Bancaria");

      // No debe existir movimiento en la caja registradora física
      const cashMovements = Array.from(memoryCashMovements.values());
      expect(cashMovements.length).toBe(0);
    });
  });

  describe("3. Procesamiento de Ingreso con Impacto en Caja Activa", () => {
    it("debe registrar un ingreso vario en efectivo (ej. aporte de capital) y sumar a la caja activa", async () => {
      const input: CreateMovementInput = {
        flow: "income",
        concept: "Aporte extraordinario de socio para caja menor",
        description: "Aporte extraordinario de socio para caja menor",
        amount: 250000,
        category: "Aportes de Capital",
        incomeType: "Aporte de capital",
        date: new Date().toISOString(),
        paymentMethod: "efectivo",
        thirdPartyName: "Socio Juan Pablo",
        receiptNumber: "APORTE-001",
        deductFromCashRegister: true, // Indica que debe ingresar a la caja física
      };

      const result = await createUnifiedMovement(TEST_BIZ_ID, input, TEST_USER_ID);

      expect(result.success).toBe(true);
      expect(result.movement).toBeDefined();
      expect(result.movement?.flow).toBe("income");
      expect(result.movement?.amount).toBe(250000);
      expect(result.movement?.notes).toContain("[INGRESO]");
      expect(result.movement?.notes).toContain("[Tipo: Aporte de capital]");

      // Verificar que se registró en cash_movements como entrada ('entry')
      const cashMovements = Array.from(memoryCashMovements.values());
      expect(cashMovements.length).toBe(1);
      const cm = cashMovements[0];
      expect(cm.session_id).toBe(TEST_SESSION_ID);
      expect(cm.movement_type).toBe("entry");
      expect(cm.amount).toBe(250000);
      expect(cm.notes).toContain("Ingreso: Aporte extraordinario de socio");
    });

    it("debe registrar un ingreso por venta de reciclaje/chatarra a cuenta bancaria sin alterar caja física", async () => {
      const input: CreateMovementInput = {
        flow: "income",
        concept: "Venta de 10 canecas de aceite usado de cocina",
        description: "Venta de 10 canecas de aceite usado de cocina",
        amount: 150000,
        category: "Venta Extraordinaria / Reciclaje",
        incomeType: "Venta extraordinaria (ej. aceite reciclado/chatarra)",
        date: new Date().toISOString(),
        paymentMethod: "transferencia",
        thirdPartyName: "Biorreciclaje Colombia",
        receiptNumber: "REC-7788",
        deductFromCashRegister: false,
      };

      const result = await createUnifiedMovement(TEST_BIZ_ID, input, TEST_USER_ID);

      expect(result.success).toBe(true);
      expect(result.movement?.flow).toBe("income");
      expect(result.movement?.amount).toBe(150000);
      expect(result.movement?.cajaBadge).toBe("Transferencia Bancaria");

      // No debe afectar el efectivo de la caja física
      const cashMovements = Array.from(memoryCashMovements.values());
      expect(cashMovements.length).toBe(0);
    });
  });
});
