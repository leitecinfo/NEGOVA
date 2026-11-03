import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getDateRangeForPeriod,
  getPurchases,
  getPurchaseKPIs,
  createPurchase,
} from "@/lib/purchases/purchases-service";
import { PurchasePeriodPreset, PurchaseFilters } from "@/lib/purchases/types";

// Setup mocks para simular la base de datos
let inMemoryPurchases: any[] = [];
let inMemorySuppliers: any[] = [];
let inMemoryAccountsPayable: any[] = [];
let inMemoryItems: any[] = [];

const TEST_BUSINESS_ID = "b1111111-1111-4111-8111-111111111111";
const SUPP_ALQUERIA = "11111111-1111-4111-8111-111111111111";
const SUPP_COLANTA = "22222222-2222-4222-8222-222222222222";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}));

const mockSupabaseClient: any = {
  rpc: vi.fn(async (fnName: string, args: any) => {
    if (fnName === "get_next_purchase_number") {
      const count = inMemoryPurchases.length + 1;
      return { data: `COMP-${String(count).padStart(5, "0")}`, error: null };
    }
    return { data: null, error: new Error("RPC not found") };
  }),

  from: (table: string) => {
    if (table === "purchases") {
      return {
        select: (cols: string = "*") => {
          let list = [...inMemoryPurchases];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            gte: (col: string, val: any) => {
              list = list.filter((r) => r[col] >= val);
              return chain;
            },
            lte: (col: string, val: any) => {
              list = list.filter((r) => r[col] <= val);
              return chain;
            },
            order: () => chain,
            limit: (n: number) => {
              list = list.slice(0, n);
              return chain;
            },
            then: (resolve: any, reject?: any) => {
              const enriched = list.map((p) => {
                const supp = inMemorySuppliers.find((s) => s.id === p.supplier_id);
                const items = inMemoryItems.filter((i) => i.purchase_id === p.id);
                const ap = inMemoryAccountsPayable.filter((a) => a.purchase_id === p.id);
                return {
                  ...p,
                  suppliers: supp ? { id: supp.id, name: supp.name } : null,
                  purchase_items: items,
                  accounts_payable: ap,
                };
              });
              return Promise.resolve({ data: enriched, error: null }).then(resolve, reject);
            },
          };
          return chain;
        },
        insert: (payload: any) => {
          const row = {
            id: `purch-${inMemoryPurchases.length + 1}`,
            ...payload,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          inMemoryPurchases.push(row);
          return {
            select: () => ({
              single: async () => ({ data: row, error: null }),
            }),
          };
        },
      };
    }

    if (table === "purchase_items") {
      return {
        insert: (payload: any) => {
          const items = Array.isArray(payload) ? payload : [payload];
          for (const it of items) {
            inMemoryItems.push({
              id: `item-${inMemoryItems.length + 1}`,
              ...it,
              created_at: new Date().toISOString(),
            });
          }
          return {
            select: () => Promise.resolve({ data: inMemoryItems, error: null }),
          };
        },
      };
    }

    if (table === "suppliers") {
      return {
        select: () => {
          let list = [...inMemorySuppliers];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            maybeSingle: async () => ({ data: list[0] || null, error: null }),
          };
          return chain;
        },
      };
    }

    if (table === "accounts_payable") {
      return {
        select: () => {
          let list = [...inMemoryAccountsPayable];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            neq: (col: string, val: any) => {
              list = list.filter((r) => r[col] !== val);
              return chain;
            },
            then: (resolve: any, reject?: any) =>
              Promise.resolve({ data: list, error: null }).then(resolve, reject),
          };
          return chain;
        },
        insert: (payload: any) => {
          const row = {
            id: `ap-${inMemoryAccountsPayable.length + 1}`,
            ...payload,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          inMemoryAccountsPayable.push(row);
          return {
            select: () => ({
              single: async () => ({ data: row, error: null }),
            }),
          };
        },
      };
    }

    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    };
  },
};

describe("Pestaña Compras en /workspace/[businessId]/inventario", () => {
  beforeEach(() => {
    inMemoryPurchases = [];
    inMemorySuppliers = [
      { id: SUPP_ALQUERIA, business_id: TEST_BUSINESS_ID, name: "Alquería Lácteos" },
      { id: SUPP_COLANTA, business_id: TEST_BUSINESS_ID, name: "Colanta Cooperativa" },
    ];
    inMemoryAccountsPayable = [];
    inMemoryItems = [];
  });

  // ----------------------------------------------------------------------------
  // 1. Filtros de Periodo (Hoy, Ayer, 7 días, Esta semana, Este mes, Mes anterior, Todo el historial)
  // ----------------------------------------------------------------------------
  describe("Cálculo de rangos para Filtros de Período", () => {
    const fixedNow = new Date("2026-11-04T15:30:00.000Z"); // Miércoles 4 Nov 2026

    it("preset 'today': genera rango desde 00:00:00 hasta 23:59:59 del día de hoy", () => {
      const range = getDateRangeForPeriod("today", undefined, undefined, fixedNow);
      expect(range.from).toBeDefined();
      expect(range.to).toBeDefined();
      const fromDate = new Date(range.from!);
      const toDate = new Date(range.to!);
      expect(fromDate.getDate()).toBe(fixedNow.getDate());
      expect(fromDate.getHours()).toBe(0);
      expect(toDate.getHours()).toBe(23);
      expect(toDate.getMinutes()).toBe(59);
    });

    it("preset 'yesterday': genera rango del día anterior completo", () => {
      const range = getDateRangeForPeriod("yesterday", undefined, undefined, fixedNow);
      const fromDate = new Date(range.from!);
      const toDate = new Date(range.to!);
      expect(fromDate.getDate()).toBe(fixedNow.getDate() - 1);
      expect(fromDate.getHours()).toBe(0);
      expect(toDate.getDate()).toBe(fixedNow.getDate() - 1);
      expect(toDate.getHours()).toBe(23);
    });

    it("preset '7d': abarca los últimos 7 días", () => {
      const range = getDateRangeForPeriod("7d", undefined, undefined, fixedNow);
      const fromDate = new Date(range.from!);
      const diffMs = fixedNow.getTime() - fromDate.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(7);
    });

    it("preset 'this_week': inicia el lunes de la semana actual", () => {
      const range = getDateRangeForPeriod("this_week", undefined, undefined, fixedNow);
      const fromDate = new Date(range.from!);
      // Miércoles 4 -> Lunes debe ser 2 de noviembre
      expect(fromDate.getDay()).toBe(1); // 1 = Lunes
      expect(fromDate.getDate()).toBe(2);
    });

    it("preset 'this_month': inicia el 1 del mes en curso", () => {
      const range = getDateRangeForPeriod("this_month", undefined, undefined, fixedNow);
      const fromDate = new Date(range.from!);
      expect(fromDate.getDate()).toBe(1);
      expect(fromDate.getMonth()).toBe(fixedNow.getMonth());
    });

    it("preset 'last_month': cubre el mes anterior de inicio a fin", () => {
      const range = getDateRangeForPeriod("last_month", undefined, undefined, fixedNow);
      const fromDate = new Date(range.from!);
      const toDate = new Date(range.to!);
      expect(fromDate.getDate()).toBe(1);
      expect(fromDate.getMonth()).toBe(fixedNow.getMonth() - 1);
      expect(toDate.getMonth()).toBe(fixedNow.getMonth() - 1);
    });

    it("preset 'all': no impone límites de fecha", () => {
      const range = getDateRangeForPeriod("all", undefined, undefined, fixedNow);
      expect(range.from).toBeUndefined();
      expect(range.to).toBeUndefined();
    });

    it("rango de fechas personalizado (startDate y endDate)", () => {
      const range = getDateRangeForPeriod("custom", "2026-10-15", "2026-10-20", fixedNow);
      expect(range.from).toContain("2026-10-15T00:00:00");
      expect(range.to).toContain("2026-10-20T23:59:59");
    });
  });

  // ----------------------------------------------------------------------------
  // 2. KPIs de Compras (Comprado, De contado, A crédito, Por pagar hoy)
  // ----------------------------------------------------------------------------
  describe("KPIs consolidados de Compras", () => {
    it("calcula: total comprado, nº proveedores únicos, de contado, a crédito y por pagar hoy", async () => {
      // 1. Compra de contado con Alquería: $100.000
      await createPurchase(TEST_BUSINESS_ID, {
        supplierId: SUPP_ALQUERIA,
        paymentType: "cash",
        paymentMethod: "cash",
        items: [{ itemName: "Leche entera 1L x 12", quantity: 2, unitCost: 50000, isInventoryItem: false }],
      });

      // 2. Compra de contado con Colanta: $60.000
      await createPurchase(TEST_BUSINESS_ID, {
        supplierId: SUPP_COLANTA,
        paymentType: "cash",
        paymentMethod: "transfer",
        items: [{ itemName: "Queso campesino 1kg", quantity: 3, unitCost: 20000, isInventoryItem: false }],
      });

      // 3. Compra a crédito con Alquería (vencimiento hoy o atrasada): $150.000
      const pastDueDate = new Date(Date.now() - 3600 * 1000).toISOString();
      await createPurchase(TEST_BUSINESS_ID, {
        supplierId: SUPP_ALQUERIA,
        paymentType: "credit",
        dueDate: pastDueDate,
        items: [{ itemName: "Yogurt batido x 24", quantity: 5, unitCost: 30000, isInventoryItem: false }],
      });

      const kpis = await getPurchaseKPIs(TEST_BUSINESS_ID);

      // Total Comprado: 100.000 + 60.000 + 150.000 = 310.000
      expect(kpis.totalPurchased).toBe(310000);

      // Nº de proveedores únicos: Alquería y Colanta = 2 proveedores
      expect(kpis.uniqueSuppliersCount).toBe(2);

      // De contado: 100.000 + 60.000 = 160.000
      expect(kpis.totalCash).toBe(160000);

      // A crédito: 150.000
      expect(kpis.totalCredit).toBe(150000);

      // Por pagar hoy o vencidas: 150.000
      expect(kpis.dueTodayOrOverdue).toBe(150000);

      // Total compras confirmadas: 3
      expect(kpis.totalPurchasesCount).toBe(3);
    });
  });

  // ----------------------------------------------------------------------------
  // 3. Buscador: nº factura, proveedor o notas
  // ----------------------------------------------------------------------------
  describe("Buscador multifactorial (nº factura, proveedor, notas, código)", () => {
    beforeEach(async () => {
      await createPurchase(TEST_BUSINESS_ID, {
        supplierId: SUPP_ALQUERIA,
        invoiceNumber: "FAC-9988",
        notes: "Entrega urgente en bodega norte",
        paymentType: "cash",
        items: [{ itemName: "Mantequilla 500g", quantity: 4, unitCost: 15000, isInventoryItem: false }],
      });

      await createPurchase(TEST_BUSINESS_ID, {
        supplierId: SUPP_COLANTA,
        invoiceNumber: "FAC-1122",
        notes: "Pedido regular quincenal",
        paymentType: "credit",
        items: [{ itemName: "Arequipe 1kg", quantity: 2, unitCost: 18000, isInventoryItem: false }],
      });
    });

    it("encuentra compras buscando por número de factura", async () => {
      const results = await getPurchases(TEST_BUSINESS_ID, { search: "9988" });
      expect(results.length).toBe(1);
      expect(results[0].invoiceNumber).toBe("FAC-9988");
    });

    it("encuentra compras buscando por nombre de proveedor", async () => {
      const results = await getPurchases(TEST_BUSINESS_ID, { search: "colanta" });
      expect(results.length).toBe(1);
      expect(results[0].supplierName).toBe("Colanta Cooperativa");
    });

    it("encuentra compras buscando por contenido en las notas", async () => {
      const results = await getPurchases(TEST_BUSINESS_ID, { search: "bodega norte" });
      expect(results.length).toBe(1);
      expect(results[0].notes).toContain("bodega norte");
    });

    it("encuentra compras buscando por código correlativo", async () => {
      const results = await getPurchases(TEST_BUSINESS_ID, { search: "COMP-00001" });
      expect(results.length).toBe(1);
      expect(results[0].purchaseNumber).toBe("COMP-00001");
    });
  });

  // ----------------------------------------------------------------------------
  // 4. Filtros por estado de pago: Todas, De contado, A crédito, Por pagar, Vencidas
  // ----------------------------------------------------------------------------
  describe("Filtros por estado de pago (statusTab)", () => {
    beforeEach(async () => {
      // 1. De contado
      await createPurchase(TEST_BUSINESS_ID, {
        supplierId: SUPP_ALQUERIA,
        paymentType: "cash",
        items: [{ itemName: "Item 1", quantity: 1, unitCost: 10000, isInventoryItem: false }],
      });

      // 2. A crédito no vencida (vence en 30 días)
      const futureDueDate = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
      await createPurchase(TEST_BUSINESS_ID, {
        supplierId: SUPP_COLANTA,
        paymentType: "credit",
        dueDate: futureDueDate,
        items: [{ itemName: "Item 2", quantity: 1, unitCost: 20000, isInventoryItem: false }],
      });

      // 3. A crédito vencida (venció hace 5 días)
      const pastDueDate = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString();
      await createPurchase(TEST_BUSINESS_ID, {
        supplierId: SUPP_COLANTA,
        paymentType: "credit",
        dueDate: pastDueDate,
        items: [{ itemName: "Item 3", quantity: 1, unitCost: 30000, isInventoryItem: false }],
      });
    });

    it("statusTab = 'all': retorna todas las compras", async () => {
      const results = await getPurchases(TEST_BUSINESS_ID, { statusTab: "all" });
      expect(results.length).toBe(3);
    });

    it("statusTab = 'cash': solo retorna compras de contado", async () => {
      const results = await getPurchases(TEST_BUSINESS_ID, { statusTab: "cash" });
      expect(results.length).toBe(1);
      expect(results[0].paymentType).toBe("cash");
    });

    it("statusTab = 'credit': solo retorna compras a crédito", async () => {
      const results = await getPurchases(TEST_BUSINESS_ID, { statusTab: "credit" });
      expect(results.length).toBe(2);
      expect(results.every((p) => p.paymentType === "credit")).toBe(true);
    });

    it("statusTab = 'pending': retorna compras con saldo por pagar", async () => {
      const results = await getPurchases(TEST_BUSINESS_ID, { statusTab: "pending" });
      expect(results.length).toBe(2);
    });

    it("statusTab = 'overdue': solo retorna compras vencidas", async () => {
      const results = await getPurchases(TEST_BUSINESS_ID, { statusTab: "overdue" });
      expect(results.length).toBe(1);
      expect(results[0].total).toBe(30000);
    });
  });
});
