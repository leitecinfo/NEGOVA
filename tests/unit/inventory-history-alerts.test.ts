import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getInventoryMovementsHistory,
  getLowStockItems,
  checkAndTriggerLowStockNotification,
  executeStockMovement,
} from "../../src/lib/inventory/inventory-service";
import { MovementType } from "../../src/lib/inventory/types";

// ==============================================================================
// SIMULACIÓN MULTI-TENANT EN MEMORIA
// ==============================================================================

const TEST_BUSINESS_ID = "11111111-2222-4333-8444-444444444444";
const OTHER_BUSINESS_ID = "99999999-8888-4777-8666-666666666666";

const LOC_POS = "a1111111-1111-4111-8111-111111111111";
const LOC_WH = "a2222222-2222-4222-8222-222222222222";

const PROD_1 = "b1111111-1111-4111-8111-111111111111";
const PROD_2 = "b2222222-2222-4222-8222-222222222222";
const PROD_3 = "b3333333-3333-4333-8333-333333333333";
const PROD_OTHER = "b9999999-9999-4999-8999-999999999999";

let inMemoryStock: any[] = [];
let inMemoryMovements: any[] = [];
let inMemoryProducts: any[] = [];
let inMemoryNotifications: any[] = [];

// Mock de notificaciones
vi.mock("@/lib/notifications/notifications-service", () => ({
  createNotification: vi.fn(async (input: any) => {
    const notif = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      ...input,
      created_at: new Date().toISOString(),
    };
    inMemoryNotifications.push(notif);
    return notif;
  }),
}));

// Mock de Supabase Client & Server
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}));

const mockSupabaseClient = {
  from: (table: string) => {
    if (table === "locations") {
      return {
        select: (cols: string = "*") => ({
          eq: (col1: string, val1: any) => ({
            eq: (col2: string, val2: any) => ({
              maybeSingle: async () => ({
                data: { id: val1, name: "Ubicación", is_active: true, business_id: val2 },
                error: null,
              }),
              single: async () => ({
                data: { id: val1, name: "Ubicación", is_active: true, business_id: val2 },
                error: null,
              }),
            }),
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
            maybeSingle: async () => ({ data: list[0] || null, error: null }),
            single: async () => ({ data: list[0] || null, error: null }),
            then: (resolve: any, reject?: any) =>
              Promise.resolve({ data: list, error: null }).then(resolve, reject),
          };
          return chain;
        },
        upsert: (data: any) => {
          const idx = inMemoryStock.findIndex(
            (s) =>
              s.business_id === data.business_id &&
              s.product_id === data.product_id &&
              s.location_id === data.location_id
          );
          if (idx !== -1) {
            inMemoryStock[idx] = { ...inMemoryStock[idx], ...data, updated_at: new Date().toISOString() };
          } else {
            inMemoryStock.push({ ...data, id: `stock-${Date.now()}`, updated_at: new Date().toISOString() });
          }
          return {
            select: () => ({
              single: async () => ({ data: data, error: null }),
            }),
          };
        },
      };
    }

    if (table === "inventory_movements") {
      return {
        insert: (data: any) => ({
          select: () => ({
            single: async () => {
              const inserted = {
                ...data,
                id: data.id || `mov-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                created_at: data.created_at || new Date().toISOString(),
              };
              inMemoryMovements.push(inserted);
              return { data: inserted, error: null };
            },
          }),
        }),
        select: (cols: string = "*") => {
          let list = inMemoryMovements.map((m) => {
            const prod = inMemoryProducts.find((p) => p.id === m.product_id);
            const locName = m.location_id === LOC_POS ? "Barra Principal" : "Bodega Central";
            return {
              ...m,
              products: prod ? { name: prod.name, metadata: prod.metadata } : null,
              locations: { name: locName },
            };
          });

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
            then: (resolve: any, reject?: any) =>
              Promise.resolve({ data: list, error: null }).then(resolve, reject),
          };
          return chain;
        },
      };
    }

    if (table === "products") {
      return {
        select: (cols: string = "*") => ({
          eq: (col1: string, val1: any) => ({
            eq: (col2: string, val2: any) => ({
              single: async () => {
                const found = inMemoryProducts.find(
                  (p: any) => p[col1] === val1 && p[col2] === val2
                );
                return { data: found || null, error: null };
              },
              maybeSingle: async () => {
                const found = inMemoryProducts.find(
                  (p: any) => p[col1] === val1 && p[col2] === val2
                );
                return { data: found || null, error: null };
              },
            }),
          }),
        }),
        update: (data: any) => ({
          eq: (col1: string, val1: any) => ({
            eq: async (col2: string, val2: any) => {
              const idx = inMemoryProducts.findIndex(
                (p: any) => p[col1] === val1 && p[col2] === val2
              );
              if (idx !== -1) {
                inMemoryProducts[idx] = {
                  ...inMemoryProducts[idx],
                  ...data,
                  metadata: {
                    ...(inMemoryProducts[idx].metadata || {}),
                    ...(data.metadata || {}),
                  },
                };
              }
              return { error: null };
            },
          }),
        }),
      };
    }

    return {};
  },
};

describe("[INV-004] Historial de Movimientos y Alertas de Stock Bajo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inMemoryNotifications = [];

    inMemoryProducts = [
      {
        id: PROD_1,
        business_id: TEST_BUSINESS_ID,
        name: "Café Espresso 250g",
        metadata: { sku: "CAF-01", cost: 8000, stock_quantity: 4, min_stock: 10 },
      },
      {
        id: PROD_2,
        business_id: TEST_BUSINESS_ID,
        name: "Leche Entera 1L",
        metadata: { sku: "LEC-02", cost: 3500, stock_quantity: 0, min_stock: 15 },
      },
      {
        id: PROD_3,
        business_id: TEST_BUSINESS_ID,
        name: "Pan Baguette",
        metadata: { sku: "PAN-03", cost: 2000, stock_quantity: 50, min_stock: 10 },
      },
      // Producto de otro negocio
      {
        id: PROD_OTHER,
        business_id: OTHER_BUSINESS_ID,
        name: "Producto Aislado",
        metadata: { sku: "AIS-99", cost: 1000, stock_quantity: 1, min_stock: 5 },
      },
    ];

    inMemoryStock = [
      // Café en Barra: 4 un. (min 10) -> Stock Bajo Crítico (Déficit 6)
      {
        id: "stock-1",
        business_id: TEST_BUSINESS_ID,
        product_id: PROD_1,
        location_id: LOC_POS,
        quantity: 4,
        min_stock: 10,
        cost: 8000,
        products: { name: "Café Espresso 250g", metadata: { sku: "CAF-01", cost: 8000 } },
        locations: { name: "Barra Principal" },
      },
      // Leche en Bodega: 0 un. (min 15) -> Agotado (Déficit 15)
      {
        id: "stock-2",
        business_id: TEST_BUSINESS_ID,
        product_id: PROD_2,
        location_id: LOC_WH,
        quantity: 0,
        min_stock: 15,
        cost: 3500,
        products: { name: "Leche Entera 1L", metadata: { sku: "LEC-02", cost: 3500 } },
        locations: { name: "Bodega Central" },
      },
      // Pan Baguette en Barra: 50 un. (min 10) -> Óptimo (No debe aparecer en alertas)
      {
        id: "stock-3",
        business_id: TEST_BUSINESS_ID,
        product_id: PROD_3,
        location_id: LOC_POS,
        quantity: 50,
        min_stock: 10,
        cost: 2000,
        products: { name: "Pan Baguette", metadata: { sku: "PAN-03", cost: 2000 } },
        locations: { name: "Barra Principal" },
      },
      // Stock de otro negocio
      {
        id: "stock-other",
        business_id: OTHER_BUSINESS_ID,
        product_id: PROD_OTHER,
        location_id: "a3333333-3333-4333-8333-333333333333",
        quantity: 1,
        min_stock: 5,
        cost: 1000,
        products: { name: "Producto Aislado", metadata: { sku: "AIS-99" } },
        locations: { name: "Otra Tienda" },
      },
    ];

    inMemoryMovements = [
      {
        id: "mov-1",
        business_id: TEST_BUSINESS_ID,
        product_id: PROD_1,
        location_id: LOC_POS,
        movement_type: "entry",
        quantity: 20,
        unit_cost: 8000,
        total_cost: 160000,
        notes: "Compra a proveedor",
        created_at: "2026-10-25T10:00:00Z",
      },
      {
        id: "mov-2",
        business_id: TEST_BUSINESS_ID,
        product_id: PROD_1,
        location_id: LOC_POS,
        movement_type: "sale",
        quantity: 16,
        unit_cost: 8000,
        total_cost: 128000,
        notes: "Ventas del fin de semana",
        created_at: "2026-10-28T18:00:00Z",
      },
      {
        id: "mov-3",
        business_id: TEST_BUSINESS_ID,
        product_id: PROD_2,
        location_id: LOC_WH,
        movement_type: "spoilage",
        quantity: 2,
        unit_cost: 3500,
        total_cost: 7000,
        notes: "Merma por vencimiento",
        created_at: "2026-10-29T09:00:00Z",
      },
      // Movimiento de otro negocio
      {
        id: "mov-other",
        business_id: OTHER_BUSINESS_ID,
        product_id: PROD_OTHER,
        location_id: "a3333333-3333-4333-8333-333333333333",
        movement_type: "entry",
        quantity: 10,
        created_at: "2026-10-29T10:00:00Z",
      },
    ];
  });

  // ----------------------------------------------------------------------------
  // 1. Historial de Movimientos con Filtros (INV-004)
  // ----------------------------------------------------------------------------
  describe("getInventoryMovementsHistory", () => {
    it("debe retornar el historial de movimientos ordenados por fecha y aislados por negocio", async () => {
      const history = await getInventoryMovementsHistory(TEST_BUSINESS_ID);

      expect(history.length).toBe(3);
      // El más reciente primero: mov-3 (2026-10-29)
      expect(history[0].id).toBe("mov-3");
      expect(history[0].productName).toBe("Leche Entera 1L");
      expect(history[0].movementType).toBe("spoilage");
      expect(history[0].locationName).toBe("Bodega Central");

      // No debe contener movimientos de otro negocio
      expect(history.some((m) => m.productId === PROD_OTHER)).toBe(false);
    });

    it("debe filtrar movimientos por ubicación y por tipo de movimiento", async () => {
      // Filtrar solo movimientos de la Barra Principal (LOC_POS)
      const posMovements = await getInventoryMovementsHistory(TEST_BUSINESS_ID, {
        locationId: LOC_POS,
      });
      expect(posMovements.length).toBe(2);
      expect(posMovements.every((m) => m.locationId === LOC_POS)).toBe(true);

      // Filtrar solo entradas (entry)
      const entries = await getInventoryMovementsHistory(TEST_BUSINESS_ID, {
        movementType: "entry",
      });
      expect(entries.length).toBe(1);
      expect(entries[0].movementType).toBe("entry");
      expect(entries[0].quantity).toBe(20);
    });
  });

  // ----------------------------------------------------------------------------
  // 2. Alertas de Stock Bajo (INV-004)
  // ----------------------------------------------------------------------------
  describe("getLowStockItems", () => {
    it("debe retornar únicamente productos con stock actual <= mínimo configurado", async () => {
      const lowStockList = await getLowStockItems(TEST_BUSINESS_ID);

      // De los 3 productos: PROD_1 (4 <= 10) y PROD_2 (0 <= 15) deben aparecer.
      // PROD_3 (50 > 10) NO debe aparecer.
      expect(lowStockList.length).toBe(2);

      // El producto agotado (Leche, déficit 15) debe ir primero
      const first = lowStockList[0];
      expect(first.productName).toBe("Leche Entera 1L");
      expect(first.status).toBe("out_of_stock");
      expect(first.deficit).toBe(15);

      // El segundo en estado crítico (Café, déficit 6)
      const second = lowStockList[1];
      expect(second.productName).toBe("Café Espresso 250g");
      expect(second.status).toBe("critical");
      expect(second.deficit).toBe(6);

      // Aislamiento: no incluye PROD_OTHER
      expect(lowStockList.some((i) => i.productId === PROD_OTHER)).toBe(false);
    });
  });

  // ----------------------------------------------------------------------------
  // 3. Notificación In-App de Stock Bajo (INV-004)
  // ----------------------------------------------------------------------------
  describe("checkAndTriggerLowStockNotification", () => {
    it("debe emitir una notificación in-app cuando las existencias bajan del mínimo", async () => {
      await checkAndTriggerLowStockNotification(TEST_BUSINESS_ID, PROD_1, LOC_POS);

      expect(inMemoryNotifications.length).toBe(1);
      const notif = inMemoryNotifications[0];
      expect(notif.scope).toBe("business");
      expect(notif.businessId).toBe(TEST_BUSINESS_ID);
      expect(notif.type).toBe("inventory");
      expect(notif.title).toContain("Alerta de Stock Bajo");
      expect(notif.message).toContain("Café Espresso 250g");
      expect(notif.metadata.minStock).toBe(10);
      expect(notif.metadata.quantity).toBe(4);
    });
  });

  // ----------------------------------------------------------------------------
  // 4. Ejecución de Movimientos y Reglas de Negocio (INV-003 / INV-004)
  // ----------------------------------------------------------------------------
  describe("executeStockMovement", () => {
    it("debe incrementar el stock en una entrada y registrar el kardex", async () => {
      const result = await executeStockMovement(
        TEST_BUSINESS_ID,
        {
          productId: PROD_1,
          locationId: LOC_POS,
          movementType: "entry",
          quantity: 10,
          unitCost: 8000,
          notes: "Reabastecimiento recibido",
        },
        "user-admin"
      );

      // Stock anterior: 4 + 10 = 14
      expect(result.newQuantity).toBe(14);

      // Verificar persistencia en inventory_stock
      const stock = inMemoryStock.find(
        (s) => s.product_id === PROD_1 && s.location_id === LOC_POS
      );
      expect(stock?.quantity).toBe(14);

      // Verificar persistencia en products.metadata
      const prod = inMemoryProducts.find((p) => p.id === PROD_1);
      expect(prod?.metadata.stock_quantity).toBe(14);

      // Verificar movimiento creado
      expect(result.movement.movementType).toBe("entry");
      expect(result.movement.quantity).toBe(10);
      expect(result.movement.totalCost).toBe(80000);
    });

    it("debe rechazar una salida que supere el stock disponible (evita stock negativo)", async () => {
      // Stock actual de PROD_1 es 4 unidades. Intentar retirar 10 debe fallar
      await expect(
        executeStockMovement(TEST_BUSINESS_ID, {
          productId: PROD_1,
          locationId: LOC_POS,
          movementType: "exit",
          quantity: 10,
        })
      ).rejects.toThrow(/stock disponible/i);
    });

    it("debe permitir un ajuste directo y disparar alerta si el nuevo stock queda <= mínimo", async () => {
      inMemoryNotifications = [];
      // Ajustar PROD_3 (que tenía 50) a 2 unidades (su mínimo es 10)
      const result = await executeStockMovement(TEST_BUSINESS_ID, {
        productId: PROD_3,
        locationId: LOC_POS,
        movementType: "adjustment",
        quantity: 2,
        notes: "Auditoría física por merma no reportada",
      });

      expect(result.newQuantity).toBe(2);

      // Al quedar 2 <= min_stock (10), debe dispararse la notificación de alerta in-app
      expect(inMemoryNotifications.length).toBe(1);
      expect(inMemoryNotifications[0].message).toContain("Pan Baguette");
    });
  });
});
