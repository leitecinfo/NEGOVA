import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createPurchase,
  getPurchases,
  getPurchaseKPIs,
  cancelPurchase,
  createSupplier,
  getSuppliers,
  generateNextPurchaseNumber,
} from "@/lib/purchases/purchases-service";
import { Purchase, Supplier } from "@/lib/purchases/types";

// Mock del cliente Supabase
let inMemorySuppliers: any[] = [];
let inMemoryPurchases: any[] = [];
let inMemoryPurchaseItems: any[] = [];
let inMemoryAccountsPayable: any[] = [];
let inMemoryStock: any[] = [];
let inMemoryProducts: any[] = [];
let inMemoryMovements: any[] = [];
let inMemoryLocations: any[] = [];

const TEST_BUSINESS_ID = "b1111111-1111-4111-8111-111111111111";
const OTHER_BUSINESS_ID = "b2222222-2222-4222-8222-222222222222";

const PROD_1 = "11111111-1111-4111-8111-111111111111"; // Café Espresso 250g
const LOC_1 = "22222222-2222-4222-8222-222222222222";  // Bodega Principal
const SUPP_1 = "33333333-3333-4333-8333-333333333333"; // Distribuidora Café

// Mock de Supabase Client & Server
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
        select: (cols: string = "*") => {
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
            maybeSingle: async () => ({
              data: list[0] || null,
              error: null,
            }),
            single: async () => ({
              data: list[0] || null,
              error: list[0] ? null : { message: "Not found" },
            }),
            then: (resolve: any, reject?: any) =>
              Promise.resolve({ data: list, error: null }).then(resolve, reject),
          };
          return chain;
        },
        insert: (payload: any) => {
          const row = {
            id: crypto.randomUUID(),
            ...payload,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          inMemorySuppliers.push(row);
          return {
            select: () => ({
              single: async () => ({ data: row, error: null }),
            }),
          };
        },
      };
    }

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
            single: async () => ({
              data: list[0] ? {
                ...list[0],
                purchase_items: inMemoryPurchaseItems.filter((i) => i.purchase_id === list[0].id),
                accounts_payable: inMemoryAccountsPayable.filter((a) => a.purchase_id === list[0].id),
              } : null,
              error: list[0] ? null : { message: "Not found" },
            }),
            then: (resolve: any, reject?: any) => {
              // Enriquecer con joins simulados
              const enriched = list.map((p) => {
                const supp = inMemorySuppliers.find((s) => s.id === p.supplier_id);
                const items = inMemoryPurchaseItems.filter((i) => i.purchase_id === p.id);
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
        update: (payload: any) => ({
          eq: (col1: string, val1: any) => ({
            eq: async (col2: string, val2: any) => {
              const idx = inMemoryPurchases.findIndex(
                (p) => p[col1] === val1 && p[col2] === val2
              );
              if (idx !== -1) {
                inMemoryPurchases[idx] = { ...inMemoryPurchases[idx], ...payload };
              }
              return { error: null };
            },
          }),
        }),
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
            data: inserted,
            error: null,
            select: () => Promise.resolve({ data: inserted, error: null }),
            then: (resolve: any, reject?: any) =>
              Promise.resolve({ data: inserted, error: null }).then(resolve, reject),
          };
        },
      };
    }

    if (table === "accounts_payable") {
      return {
        select: (cols: string = "*") => {
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
            id: crypto.randomUUID(),
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
        update: (payload: any) => ({
          eq: (col1: string, val1: any) => ({
            eq: async (col2: string, val2: any) => {
              const idx = inMemoryAccountsPayable.findIndex(
                (a) => a[col1] === val1 && a[col2] === val2
              );
              if (idx !== -1) {
                inMemoryAccountsPayable[idx] = { ...inMemoryAccountsPayable[idx], ...payload };
              }
              return { error: null };
            },
          }),
        }),
      };
    }

    if (table === "inventory_stock") {
      return {
        select: (cols: string = "*") => {
          let list = [...inMemoryStock];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            maybeSingle: async () => ({
              data: list[0] || null,
              error: null,
            }),
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
            inMemoryStock[idx] = { ...inMemoryStock[idx], ...payload, updated_at: new Date().toISOString() };
            row = inMemoryStock[idx];
          } else {
            row = {
              id: `stock-${Date.now()}`,
              ...payload,
              created_at: new Date().toISOString(),
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
        insert: (payload: any) => {
          const row = {
            id: `mov-${Date.now()}-${Math.random().toString(36).substring(7)}`,
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
        select: (cols: string = "*") => ({
          eq: (col1: string, val1: any) => ({
            eq: (col2: string, val2: any) => ({
              maybeSingle: async () => {
                const p = inMemoryProducts.find((r) => r[col1] === val1 && r[col2] === val2);
                return { data: p || null, error: null };
              },
            }),
          }),
        }),
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
        select: (cols: string = "*") => ({
          eq: (col1: string, val1: any) => ({
            eq: (col2: string, val2: any) => ({
              maybeSingle: async () => {
                const loc = inMemoryLocations.find(
                  (l) => l[col1] === val1 && l[col2] === val2
                );
                return { data: loc || null, error: null };
              },
            }),
          }),
        }),
      };
    }

    return {};
  },
};

describe("[PROV-002] Registro de Compras, Proveedores y Kardex", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    inMemorySuppliers = [
      {
        id: SUPP_1,
        business_id: TEST_BUSINESS_ID,
        name: "Distribuidora Café Colombia",
        tax_id: "900.123.456-1",
        payment_terms_days: 30,
        status: "active",
      },
    ];

    inMemoryProducts = [
      {
        id: PROD_1,
        business_id: TEST_BUSINESS_ID,
        name: "Café Espresso 250g",
        metadata: { sku: "CAF-01", cost: 10000, stock_quantity: 10 },
      },
    ];

    inMemoryLocations = [
      {
        id: LOC_1,
        business_id: TEST_BUSINESS_ID,
        name: "Bodega Principal",
        type: "warehouse",
      },
    ];

    inMemoryStock = [
      {
        id: "stock-1",
        business_id: TEST_BUSINESS_ID,
        product_id: PROD_1,
        location_id: LOC_1,
        quantity: 10,
        cost: 10000,
        min_stock: 5,
      },
    ];

    inMemoryPurchases = [];
    inMemoryPurchaseItems = [];
    inMemoryAccountsPayable = [];
    inMemoryMovements = [];
  });

  // ----------------------------------------------------------------------------
  // 1. Registro de compra inventariable y costo promedio ponderado
  // ----------------------------------------------------------------------------
  it("al registrar una compra inventariable: incrementa el stock, registra entrada en kardex y recalcula costo promedio", async () => {
    // Escenario: Teníamos 10 unidades a costo 10.000 ($100.000)
    // Compramos 10 unidades nuevas a costo 14.000 ($140.000)
    // Costo promedio ponderado resultante = ($100.000 + $140.000) / 20 = $240.000 / 20 = 12.000
    const purchase = await createPurchase(
      TEST_BUSINESS_ID,
      {
        supplierId: SUPP_1,
        invoiceNumber: "FAC-901",
        paymentType: "cash",
        paymentMethod: "transfer",
        items: [
          {
            productId: PROD_1,
            itemName: "Café Espresso 250g",
            quantity: 10,
            unitCost: 14000,
            locationId: LOC_1,
            isInventoryItem: true,
          },
        ],
      },
      "user-admin"
    );

    expect(purchase).toBeDefined();
    expect(purchase.purchaseNumber).toBe("COMP-00001");
    expect(purchase.subtotal).toBe(140000);
    expect(purchase.total).toBe(140000);
    expect(purchase.paymentType).toBe("cash");

    // Verificar stock incrementado en inventory_stock (10 anteriores + 10 nuevas = 20)
    const stockRow = inMemoryStock.find(
      (s) => s.product_id === PROD_1 && s.location_id === LOC_1
    );
    expect(stockRow?.quantity).toBe(20);

    // Verificar costo promedio recalculado (12.000)
    expect(stockRow?.cost).toBe(12000);

    // Verificar movimiento de inventario en kardex
    expect(inMemoryMovements.length).toBe(1);
    const mov = inMemoryMovements[0];
    expect(mov.movement_type).toBe("entry");
    expect(mov.quantity).toBe(10);
    expect(mov.unit_cost).toBe(14000);
    expect(mov.reference_type).toBe("purchase");
    expect(mov.reference_id).toBe(purchase.id);

    // Al ser de contado, NO debe generar cuenta por pagar
    expect(inMemoryAccountsPayable.length).toBe(0);
  });

  // ----------------------------------------------------------------------------
  // 2. Registro de compra con ítem libre (no inventariable)
  // ----------------------------------------------------------------------------
  it("al registrar un ítem libre: solo registra gasto/costo y no mueve inventario ni kardex", async () => {
    const purchase = await createPurchase(
      TEST_BUSINESS_ID,
      {
        paymentType: "cash",
        items: [
          {
            itemName: "Bolsas de empaque biodegradables (1000 un)",
            quantity: 2,
            unitCost: 25000,
            isInventoryItem: false,
          },
        ],
      },
      "user-admin"
    );

    expect(purchase.subtotal).toBe(50000);
    expect(purchase.total).toBe(50000);

    // No debe haber movimientos de inventario generados
    expect(inMemoryMovements.length).toBe(0);

    // El stock del producto PROD_1 no fue afectado
    const stockRow = inMemoryStock.find((s) => s.product_id === PROD_1);
    expect(stockRow?.quantity).toBe(10);
  });

  // ----------------------------------------------------------------------------
  // 3. Compra a crédito y creación automática de cuenta por pagar
  // ----------------------------------------------------------------------------
  it("al registrar una compra a crédito: genera automáticamente cuenta por pagar con fecha de vencimiento", async () => {
    const purchase = await createPurchase(
      TEST_BUSINESS_ID,
      {
        supplierId: SUPP_1,
        invoiceNumber: "FAC-CRED-01",
        paymentType: "credit",
        items: [
          {
            productId: PROD_1,
            itemName: "Café Espresso 250g",
            quantity: 5,
            unitCost: 10000,
            locationId: LOC_1,
            isInventoryItem: true,
          },
        ],
      },
      "user-admin"
    );

    expect(purchase.paymentType).toBe("credit");

    // Verificar cuenta por pagar creada
    expect(inMemoryAccountsPayable.length).toBe(1);
    const ap = inMemoryAccountsPayable[0];
    expect(ap.purchase_id).toBe(purchase.id);
    expect(ap.supplier_id).toBe(SUPP_1);
    expect(ap.total_amount).toBe(50000);
    expect(ap.balance).toBe(50000);
    expect(ap.status).toBe("pending");
    expect(ap.due_date).toBeDefined();
  });

  // ----------------------------------------------------------------------------
  // 4. Creación rápida inline de proveedores (PROV-001)
  // ----------------------------------------------------------------------------
  it("permite registrar un nuevo proveedor rápido inline", async () => {
    const supplier = await createSupplier(TEST_BUSINESS_ID, {
      name: "Lácteos del Campo S.A.S.",
      taxId: "901.888.777-2",
      phone: "+57 300 123 4567",
      paymentTermsDays: 15,
    });

    expect(supplier).toBeDefined();
    expect(supplier.name).toBe("Lácteos del Campo S.A.S.");
    expect(supplier.paymentTermsDays).toBe(15);
    expect(supplier.businessId).toBe(TEST_BUSINESS_ID);

    const list = await getSuppliers(TEST_BUSINESS_ID);
    expect(list.some((s) => s.name === "Lácteos del Campo S.A.S.")).toBe(true);
  });

  // ----------------------------------------------------------------------------
  // 5. Cálculo de KPIs Financieros de Compras
  // ----------------------------------------------------------------------------
  it("calcula correctamente los KPIs: total comprado, de contado, a crédito y por pagar", async () => {
    // 1 compra de contado de $80.000 con proveedor SUPP_1
    await createPurchase(TEST_BUSINESS_ID, {
      supplierId: SUPP_1,
      paymentType: "cash",
      items: [{ itemName: "Vaso biodegradable", quantity: 10, unitCost: 8000, isInventoryItem: false }],
    });

    // 1 compra a crédito de $120.000 vencida o por pagar hoy con proveedor SUPP_1
    const pastDueDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await createPurchase(TEST_BUSINESS_ID, {
      supplierId: SUPP_1,
      paymentType: "credit",
      dueDate: pastDueDate,
      items: [{ itemName: "Tapas para vaso", quantity: 10, unitCost: 12000, isInventoryItem: false }],
    });

    const kpis = await getPurchaseKPIs(TEST_BUSINESS_ID);
    expect(kpis.totalPurchased).toBe(200000);
    expect(kpis.totalCash).toBe(80000);
    expect(kpis.totalCredit).toBe(120000);
    expect(kpis.dueTodayOrOverdue).toBe(120000);
    expect(kpis.totalPurchasesCount).toBe(2);
    expect(kpis.uniqueSuppliersCount).toBe(1);
  });

  // ----------------------------------------------------------------------------
  // 6. Anulación de compra y reversión de inventario
  // ----------------------------------------------------------------------------
  it("al anular una compra: revierte el stock del inventario y cancela la cuenta por pagar", async () => {
    const purchase = await createPurchase(TEST_BUSINESS_ID, {
      paymentType: "credit",
      items: [
        {
          productId: PROD_1,
          itemName: "Café Espresso 250g",
          quantity: 5,
          unitCost: 10000,
          locationId: LOC_1,
          isInventoryItem: true,
        },
      ],
    });

    expect(inMemoryPurchases[0].status).toBe("confirmed");
    expect(inMemoryAccountsPayable[0].status).toBe("pending");

    // Anular compra
    await cancelPurchase(TEST_BUSINESS_ID, purchase.id, "user-admin");

    expect(inMemoryPurchases[0].status).toBe("cancelled");
    expect(inMemoryAccountsPayable[0].status).toBe("cancelled");

    // Se registró movimiento inverso de salida
    const exitMov = inMemoryMovements.find((m) => m.movement_type === "exit");
    expect(exitMov).toBeDefined();
    expect(exitMov?.quantity).toBe(5);
  });

  // ----------------------------------------------------------------------------
  // 7. Aislamiento Multi-Tenant
  // ----------------------------------------------------------------------------
  it("los datos de compras de un negocio no son visibles por otro negocio", async () => {
    await createPurchase(TEST_BUSINESS_ID, {
      paymentType: "cash",
      items: [{ itemName: "Item Negocio 1", quantity: 1, unitCost: 5000, isInventoryItem: false }],
    });

    const otherPurchases = await getPurchases(OTHER_BUSINESS_ID);
    expect(otherPurchases.length).toBe(0);

    const testPurchases = await getPurchases(TEST_BUSINESS_ID);
    expect(testPurchases.length).toBe(1);
  });
});
