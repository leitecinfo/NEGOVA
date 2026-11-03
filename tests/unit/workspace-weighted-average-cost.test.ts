import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  calculateWeightedAverageCost,
  createPurchase,
} from "@/lib/purchases/purchases-service";
import {
  getInventoryKPIs,
  getProductStockMatrix,
} from "@/lib/inventory/inventory-service";

let inMemorySuppliers: any[] = [];
let inMemoryPurchases: any[] = [];
let inMemoryPurchaseItems: any[] = [];
let inMemoryAccountsPayable: any[] = [];
let inMemoryStock: any[] = [];
let inMemoryProducts: any[] = [];
let inMemoryMovements: any[] = [];
let inMemoryLocations: any[] = [];

const BIZ_ID = "b1111111-1111-4111-8111-111111111111";
const PROD_1 = "11111111-1111-4111-8111-111111111111";
const PROD_2 = "11111111-1111-4111-8111-222222222222";
const LOC_1 = "22222222-2222-4222-8222-222222222222";
const SUPP_1 = "33333333-3333-4333-8333-333333333333";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}));

const mockSupabaseClient: any = {
  rpc: vi.fn(async (fnName: string, args: any) => {
    if (fnName === "get_next_purchase_number") {
      const bId = args?.p_business_id;
      const count = inMemoryPurchases.filter((p) => p.business_id === bId).length + 1;
      return { data: `COMP-${String(count).padStart(5, "0")}`, error: null };
    }
    return { data: null, error: new Error("RPC not found") };
  }),

  from: (table: string) => {
    if (table === "suppliers") {
      return {
        select: () => {
          let list = [...inMemorySuppliers];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            neq: (col: string, val: any) => {
              list = list.filter((r) => r[col] !== val);
              return chain;
            },
            order: () => chain,
            maybeSingle: async () => ({ data: list[0] || null, error: null }),
            single: async () => ({
              data: list[0] || null,
              error: list[0] ? null : { message: "Not found" },
            }),
            then: (resolve: any, reject?: any) =>
              Promise.resolve({ data: list, error: null }).then(resolve, reject),
          };
          return chain;
        },
      };
    }

    if (table === "purchases") {
      return {
        insert: (payload: any) => {
          const row = {
            id: crypto.randomUUID(),
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
          const inserted = items.map((it) => {
            const row = {
              id: crypto.randomUUID(),
              ...it,
              created_at: new Date().toISOString(),
            };
            inMemoryPurchaseItems.push(row);
            return row;
          });
          return {
            select: () => Promise.resolve({ data: inserted, error: null }),
            then: (resolve: any, reject?: any) =>
              Promise.resolve({ data: inserted, error: null }).then(resolve, reject),
          };
        },
      };
    }

    if (table === "inventory_stock") {
      return {
        select: () => {
          let list = [...inMemoryStock];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            maybeSingle: async () => ({ data: list[0] || null, error: null }),
            single: async () => ({
              data: list[0] || null,
              error: list[0] ? null : { message: "Not found" },
            }),
            then: (resolve: any, reject?: any) =>
              Promise.resolve({ data: list, error: null }).then(resolve, reject),
          };
          return chain;
        },
        upsert: (payload: any) => {
          const idx = inMemoryStock.findIndex(
            (s) =>
              s.business_id === payload.business_id &&
              s.product_id === payload.product_id &&
              s.location_id === payload.location_id
          );
          let row: any;
          if (idx !== -1) {
            inMemoryStock[idx] = {
              ...inMemoryStock[idx],
              ...payload,
              updated_at: new Date().toISOString(),
            };
            row = inMemoryStock[idx];
          } else {
            row = {
              id: `stock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              ...payload,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            inMemoryStock.push(row);
          }
          return {
            select: () => ({
              single: async () => ({ data: row, error: null }),
            }),
            then: (resolve: any, reject?: any) =>
              Promise.resolve({ data: row, error: null }).then(resolve, reject),
          };
        },
      };
    }

    if (table === "inventory_movements") {
      return {
        select: (_cols: string = "*", opts?: any) => {
          let list = [...inMemoryMovements];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            gte: (col: string, val: any) => {
              list = list.filter((r) => r[col] >= val);
              return chain;
            },
            then: (resolve: any, reject?: any) =>
              Promise.resolve({
                data: opts?.head ? null : list,
                count: list.length,
                error: null,
              }).then(resolve, reject),
          };
          return chain;
        },
        insert: (payload: any) => {
          const row = {
            id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...payload,
            created_at: new Date().toISOString(),
          };
          inMemoryMovements.push(row);
          return {
            select: () => ({
              single: async () => ({ data: row, error: null }),
            }),
          };
        },
      };
    }

    if (table === "products") {
      return {
        select: (_cols: string = "*", opts?: any) => {
          let list = [...inMemoryProducts];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            neq: (col: string, val: any) => {
              list = list.filter((r) => r[col] !== val);
              return chain;
            },
            order: () => chain,
            maybeSingle: async () => ({ data: list[0] || null, error: null }),
            single: async () => ({
              data: list[0] || null,
              error: list[0] ? null : { message: "Not found" },
            }),
            then: (resolve: any, reject?: any) =>
              Promise.resolve({
                data: opts?.head ? null : list,
                count: list.length,
                error: null,
              }).then(resolve, reject),
          };
          return chain;
        },
        update: (payload: any) => ({
          eq: (col1: string, val1: any) => ({
            eq: async (col2: string, val2: any) => {
              const idx = inMemoryProducts.findIndex(
                (p) => p[col1] === val1 && p[col2] === val2
              );
              if (idx !== -1) {
                inMemoryProducts[idx] = {
                  ...inMemoryProducts[idx],
                  ...payload,
                  metadata: {
                    ...(inMemoryProducts[idx].metadata || {}),
                    ...(payload.metadata || {}),
                  },
                };
              }
              return { error: null };
            },
          }),
        }),
      };
    }

    if (table === "locations") {
      return {
        select: () => {
          let list = [...inMemoryLocations];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            order: () => chain,
            maybeSingle: async () => ({ data: list[0] || null, error: null }),
            single: async () => ({
              data: list[0] || null,
              error: list[0] ? null : { message: "Not found" },
            }),
            then: (resolve: any, reject?: any) =>
              Promise.resolve({ data: list, error: null }).then(resolve, reject),
          };
          return chain;
        },
      };
    }

    return {};
  },
};

describe("PROV-004: Costo Promedio Ponderado en Compras e Inventario", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    inMemorySuppliers = [
      {
        id: SUPP_1,
        business_id: BIZ_ID,
        name: "Proveedor Central",
        status: "active",
      },
    ];

    inMemoryLocations = [
      {
        id: LOC_1,
        business_id: BIZ_ID,
        name: "Bodega Principal",
        type: "warehouse",
        is_active: true,
        is_visible_in_menu: false,
        created_at: new Date().toISOString(),
      },
    ];

    inMemoryProducts = [
      {
        id: PROD_1,
        business_id: BIZ_ID,
        name: "Gaseosa 400ml",
        price: 3500,
        status: "active",
        metadata: {
          sku: "GAS-400",
          track_stock: true,
          stock_quantity: 10,
          min_stock: 5,
          cost: 800,
        },
      },
      {
        id: PROD_2,
        business_id: BIZ_ID,
        name: "Agua con Gas",
        price: 3000,
        status: "active",
        metadata: {
          sku: "AGU-01",
          track_stock: true,
          stock_quantity: 0,
          min_stock: 2,
          cost: 0,
        },
      },
    ];

    inMemoryStock = [
      {
        id: "stock-1",
        business_id: BIZ_ID,
        product_id: PROD_1,
        location_id: LOC_1,
        quantity: 10,
        cost: 800,
        min_stock: 5,
      },
    ];

    inMemoryPurchases = [];
    inMemoryPurchaseItems = [];
    inMemoryAccountsPayable = [];
    inMemoryMovements = [];
  });

  it("1. Criterio de aceptación exacto: al comprar 10 unidades a $1.000 cuando hay 10 unidades a $800, el nuevo costo promedio es $900", () => {
    const newCost = calculateWeightedAverageCost(10, 800, 10, 1000);
    expect(newCost).toBe(900);
  });

  it("2. Si el stock actual es 0, el costo promedio adopta el costo de compra", () => {
    expect(calculateWeightedAverageCost(0, 0, 15, 1250)).toBe(1250);
  });

  it("3. Al confirmar una compra actualiza inventory_stock.cost y sincroniza products.metadata.cost con $900", async () => {
    await createPurchase(
      BIZ_ID,
      {
        supplierId: SUPP_1,
        invoiceNumber: "FAC-100",
        paymentType: "cash",
        paymentMethod: "cash",
        items: [
          {
            productId: PROD_1,
            itemName: "Gaseosa 400ml",
            quantity: 10,
            unitCost: 1000,
            locationId: LOC_1,
            isInventoryItem: true,
          },
        ],
      },
      "user-1"
    );

    const updatedStock = inMemoryStock.find(
      (s) => s.product_id === PROD_1 && s.location_id === LOC_1
    );
    expect(updatedStock).toBeDefined();
    expect(updatedStock.quantity).toBe(20);
    expect(updatedStock.cost).toBe(900);

    const updatedProduct = inMemoryProducts.find((p) => p.id === PROD_1);
    expect(updatedProduct.metadata.cost).toBe(900);
    expect(updatedProduct.metadata.average_cost).toBe(900);
    expect(updatedProduct.metadata.stock_quantity).toBe(20);
  });

  it("4. El costo promedio se muestra correctamente en la matriz de inventario y se usa para calcular el valor total del inventario", async () => {
    // Ejecutamos la compra que lleva PROD_1 a 20 unidades con costo promedio $900 ($18.000 total)
    await createPurchase(
      BIZ_ID,
      {
        supplierId: SUPP_1,
        invoiceNumber: "FAC-101",
        paymentType: "cash",
        paymentMethod: "cash",
        items: [
          {
            productId: PROD_1,
            itemName: "Gaseosa 400ml",
            quantity: 10,
            unitCost: 1000,
            locationId: LOC_1,
            isInventoryItem: true,
          },
          {
            productId: PROD_2,
            itemName: "Agua con Gas",
            quantity: 5,
            unitCost: 600,
            locationId: LOC_1,
            isInventoryItem: true,
          },
        ],
      },
      "user-1"
    );

    // 1. Verificar tabla/matriz de inventario
    const matrix = await getProductStockMatrix(BIZ_ID);
    const prod1Row = matrix.rows.find((r) => r.productId === PROD_1);
    const prod2Row = matrix.rows.find((r) => r.productId === PROD_2);

    expect(prod1Row).toBeDefined();
    expect(prod1Row!.totalStock).toBe(20);
    expect(prod1Row!.cost).toBe(900);
    expect(prod1Row!.stockByLocation[LOC_1].cost).toBe(900);

    expect(prod2Row).toBeDefined();
    expect(prod2Row!.totalStock).toBe(5);
    expect(prod2Row!.cost).toBe(600);

    // 2. Verificar que getInventoryKPIs calcula el valor total del inventario usando el costo promedio:
    // (20 * 900) + (5 * 600) = 18.000 + 3.000 = 21.000
    const kpis = await getInventoryKPIs(BIZ_ID);
    expect(kpis.totalCostValue).toBe(21000);
  });
});
