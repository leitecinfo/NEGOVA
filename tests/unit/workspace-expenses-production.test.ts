import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  isProductionCategory,
  inferExpenseType,
  createExpense,
  getExpensesList,
  getExpenseKPIs,
  updateExpense,
  deleteExpense,
} from "@/lib/expenses/expenses-service";
import {
  PRODUCTION_CATEGORIES,
  OPERATIONAL_CATEGORIES,
} from "@/lib/expenses/types";

// Mock del cliente Supabase en memoria
const memoryExpenses = new Map<string, any>();
const memoryProducts = new Map<string, any>();
const memorySales = new Map<string, any>();
const memorySuppliers = new Map<string, any>();

const mockSupabaseClient = {
  from: (table: string) => {
    let currentTable = table;
    let filters: Array<(row: any) => boolean> = [];
    let orderByField: string | null = null;
    let orderAscending = true;

    const builder: any = {
      select: vi.fn((_columns?: string) => builder),
      eq: vi.fn((field: string, val: any) => {
        filters.push((row: any) => row[field] === val);
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
      limit: vi.fn(() => builder),
      insert: vi.fn((payload: any) => {
        const id = payload.id || `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const record = {
          id,
          ...payload,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (currentTable === "expenses") {
          memoryExpenses.set(id, record);
        }
        return {
          data: record,
          error: null,
          select: () => ({
            single: async () => ({ data: record, error: null }),
          }),
        };
      }),
      update: vi.fn((payload: any) => {
        return {
          eq: (f1: string, v1: any) => ({
            eq: async (f2: string, v2: any) => {
              let targetRow: any = null;
              if (currentTable === "expenses") {
                for (const [id, row] of memoryExpenses.entries()) {
                  if (row[f1] === v1 && row[f2] === v2) {
                    const updated = { ...row, ...payload, updated_at: new Date().toISOString() };
                    memoryExpenses.set(id, updated);
                    targetRow = updated;
                  }
                }
              } else if (currentTable === "products") {
                for (const [id, row] of memoryProducts.entries()) {
                  if (row[f1] === v1 && row[f2] === v2) {
                    const updated = { ...row, ...payload, updated_at: new Date().toISOString() };
                    memoryProducts.set(id, updated);
                    targetRow = updated;
                  }
                }
              }
              return {
                data: targetRow,
                error: null,
                select: () => ({
                  single: async () => ({ data: targetRow, error: null }),
                }),
              };
            },
          }),
        };
      }),
      maybeSingle: async () => {
        let store: Map<string, any> = memoryExpenses;
        if (currentTable === "products") store = memoryProducts;
        if (currentTable === "suppliers") store = memorySuppliers;
        if (currentTable === "business_sale_documents") store = memorySales;

        const items = Array.from(store.values()).filter((r) =>
          filters.every((f) => f(r))
        );
        return { data: items[0] || null, error: null };
      },
      single: async () => {
        let store: Map<string, any> = memoryExpenses;
        if (currentTable === "products") store = memoryProducts;
        const items = Array.from(store.values()).filter((r) =>
          filters.every((f) => f(r))
        );
        return { data: items[0] || null, error: items[0] ? null : { message: "Not found" } };
      },
      then: (resolve: any) => {
        let store: Map<string, any> = memoryExpenses;
        if (currentTable === "products") store = memoryProducts;
        if (currentTable === "suppliers") store = memorySuppliers;
        if (currentTable === "business_sale_documents") store = memorySales;

        let items = Array.from(store.values()).filter((r) =>
          filters.every((f) => f(r))
        );
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

describe("[GAS-002] Gastos de producción y separación financiera", () => {
  const businessAId = "biz-gasto-prod-alpha";
  const businessBId = "biz-gasto-prod-beta";
  const userId = "user-admin-01";

  beforeEach(() => {
    memoryExpenses.clear();
    memoryProducts.clear();
    memorySales.clear();
    memorySuppliers.clear();

    // Mock producto base en Negocio A
    memoryProducts.set("prod-queso-01", {
      id: "prod-queso-01",
      business_id: businessAId,
      name: "Queso Campesino",
      cost: 6000,
      price: 15000,
      metadata: { unit: "kg", cost: 6000 },
    });

    // Mock ventas en Negocio A: $500.000
    memorySales.set("sale-01", {
      id: "sale-01",
      business_id: businessAId,
      total: 300000,
      status: "paid",
      issued_at: new Date().toISOString(),
    });
    memorySales.set("sale-02", {
      id: "sale-02",
      business_id: businessAId,
      total: 200000,
      status: "completed",
      issued_at: new Date().toISOString(),
    });
  });

  describe("Criterio 1: Clasificación de categorías de producción vs operativas", () => {
    it("debe identificar correctamente las categorías de producción estipuladas", () => {
      expect(isProductionCategory("Materia Prima")).toBe(true);
      expect(isProductionCategory("Ingredientes")).toBe(true);
      expect(isProductionCategory("Insumos de Producción")).toBe(true);
      expect(isProductionCategory("Envases y Empaques")).toBe(true);

      // Variantes con minúsculas/espacios
      expect(isProductionCategory("materia prima")).toBe(true);
      expect(isProductionCategory("  ingredientes  ")).toBe(true);
      expect(isProductionCategory("envases y empaques")).toBe(true);

      // Categorías operativas
      expect(isProductionCategory("Servicios Públicos")).toBe(false);
      expect(isProductionCategory("Arriendo")).toBe(false);
      expect(isProductionCategory("Marketing y Publicidad")).toBe(false);
      expect(isProductionCategory("Otros Operativos")).toBe(false);
    });

    it("inferExpenseType debe asignar 'production' automáticamente para categorías productivas", () => {
      expect(inferExpenseType("Materia Prima")).toBe("production");
      expect(inferExpenseType("Ingredientes")).toBe("production");
      expect(inferExpenseType("Arriendo")).toBe("operational");
      expect(inferExpenseType("Nómina y Honorarios")).toBe("operational");

      // Si se fuerza explícitamente, prevalece el tipo explícito
      expect(inferExpenseType("Otros", "production")).toBe("production");
      expect(inferExpenseType("Materia Prima", "operational")).toBe("operational");
    });
  });

  describe("Criterio 2: Registro de gasto de producción (ej. 'Compra de queso' -> $80.000 -> Materia Prima)", () => {
    it("debe registrar un gasto de producción clasificándolo con expense_type = 'production'", async () => {
      const res = await createExpense(
        businessAId,
        {
          concept: "Compra de queso campesino",
          amount: 80000,
          category: "Materia Prima",
          paymentMethod: "efectivo",
          notes: "10 bloques de queso para preparación",
        },
        userId
      );

      expect(res.success).toBe(true);
      expect(res.expense).toBeDefined();
      expect(res.expense?.concept).toBe("Compra de queso campesino");
      expect(res.expense?.amount).toBe(80000);
      expect(res.expense?.category).toBe("Materia Prima");
      expect(res.expense?.expenseType).toBe("production");
    });

    it("debe actualizar opcionalmente el costo del producto en el catálogo cuando updateProductCost es true", async () => {
      // Precio anterior en mock: $6.000
      const prevProd = memoryProducts.get("prod-queso-01");
      expect(prevProd.cost).toBe(6000);

      // Compra de 10 kg por $80.000 (costo unitario $8.000)
      const res = await createExpense(
        businessAId,
        {
          concept: "Compra de queso - nuevo lote",
          amount: 80000,
          category: "Materia Prima",
          productId: "prod-queso-01",
          quantity: 10,
          unitCost: 8000,
          updateProductCost: true,
        },
        userId
      );

      expect(res.success).toBe(true);
      expect(res.expense?.unitCost).toBe(8000);
      expect(res.expense?.updateProductCost).toBe(true);

      // El producto debe tener el nuevo costo actualizado a 8000
      const updatedProd = memoryProducts.get("prod-queso-01");
      expect(updatedProd.cost).toBe(8000);
      expect(updatedProd.metadata?.cost).toBe(8000);
      expect(updatedProd.metadata?.last_cost_source).toBe("production_expense");
    });

    it("no debe alterar el costo del producto si updateProductCost es false", async () => {
      const prevProd = memoryProducts.get("prod-queso-01");
      expect(prevProd.cost).toBe(6000);

      const res = await createExpense(
        businessAId,
        {
          concept: "Compra de queso sin alterar ficha técnica",
          amount: 80000,
          category: "Materia Prima",
          productId: "prod-queso-01",
          quantity: 10,
          unitCost: 8000,
          updateProductCost: false,
        },
        userId
      );

      expect(res.success).toBe(true);
      const prodAfter = memoryProducts.get("prod-queso-01");
      expect(prodAfter.cost).toBe(6000);
    });
  });

  describe("Criterio 3: Separación Operativo vs Producción en reporte y cálculo de márgenes", () => {
    it("debe calcular KPIs separando Operativos vs Producción y comparar contra ingresos por ventas", async () => {
      // 1. Gasto de producción: $80.000 (Materia Prima) + $20.000 (Envases) = $100.000
      await createExpense(businessAId, {
        concept: "Queso",
        amount: 80000,
        category: "Materia Prima",
      });
      await createExpense(businessAId, {
        concept: "Cajas pizza",
        amount: 20000,
        category: "Envases y Empaques",
      });

      // 2. Gasto operativo: $50.000 (Energía) + $70.000 (Arriendo) = $120.000
      await createExpense(businessAId, {
        concept: "Recibo de luz",
        amount: 50000,
        category: "Servicios Públicos",
      });
      await createExpense(businessAId, {
        concept: "Canon arriendo",
        amount: 70000,
        category: "Arriendo",
      });

      // Ventas mockeadas: $500.000
      const kpis = await getExpenseKPIs(businessAId);

      // Verificaciones de gastos
      expect(kpis.productionExpenses).toBe(100000); // 80.000 + 20.000
      expect(kpis.operationalExpenses).toBe(120000); // 50.000 + 70.000
      expect(kpis.totalExpenses).toBe(220000); // 100.000 + 120.000
      expect(kpis.totalSales).toBe(500000);

      // Margen Bruto / Producción:
      // Ventas ($500.000) - Producción ($100.000) = $400.000 (80.0%)
      expect(kpis.grossMarginAmount).toBe(400000);
      expect(kpis.grossMarginPercentage).toBe(80.0);

      // Margen Neto Final:
      // Ventas ($500.000) - Total Gastos ($220.000) = $280.000 (56.0%)
      expect(kpis.netMarginAmount).toBe(280000);
      expect(kpis.netMarginPercentage).toBe(56.0);

      // Desglose de categorías ordenado
      expect(kpis.categoryBreakdown.length).toBe(4);
      expect(kpis.categoryBreakdown[0].category).toBe("Materia Prima");
      expect(kpis.categoryBreakdown[0].amount).toBe(80000);
      expect(kpis.categoryBreakdown[0].expenseType).toBe("production");
    });
  });

  describe("Aislamiento Multi-Tenant", () => {
    it("el Negocio B no debe recibir gastos pertenecientes al Negocio A", async () => {
      await createExpense(businessAId, {
        concept: "Gasto exclusivo de Alpha",
        amount: 45000,
        category: "Servicios Públicos",
      });

      const listBizB = await getExpensesList({ businessId: businessBId });
      expect(listBizB.some((e) => e.businessId === businessAId)).toBe(false);
    });
  });

  describe("Regla de Oro: Cero Alertas Nativas", () => {
    it("ningún archivo del módulo de gastos debe invocar window.alert, window.confirm o window.prompt", () => {
      const filesToCheck = [
        path.join(process.cwd(), "src/lib/expenses/expenses-service.ts"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/gastos/actions.ts"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/gastos/page.tsx"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/gastos/expense-form-modal.tsx"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/gastos/workspace-gastos-client.tsx"),
      ];

      for (const file of filesToCheck) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, "utf8");
          expect(content).not.toMatch(/window\.alert\s*\(/);
          expect(content).not.toMatch(/window\.confirm\s*\(/);
          expect(content).not.toMatch(/window\.prompt\s*\(/);
        }
      }
    });
  });
});
