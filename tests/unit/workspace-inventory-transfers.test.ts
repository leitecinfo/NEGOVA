import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  transferInventory,
  getInventoryMovementsHistory,
} from "../../src/lib/inventory/inventory-service";
import { CreateTransferInput } from "../../src/lib/inventory/types";

// ==============================================================================
// BASE DE DATOS EN MEMORIA AISLADA POR TENANT
// ==============================================================================

const TEST_BUSINESS_ID = "11111111-1111-4111-a111-111111111111";
const OTHER_BUSINESS_ID = "22222222-2222-4222-a222-222222222222";

const LOC_A_ORIGIN = "33333333-3333-4333-a333-333333333333";
const LOC_B_DEST = "44444444-4444-4444-a444-444444444444";
const OTHER_LOCATION = "55555555-5555-4555-a555-555555555555";

const PROD_1 = "66666666-6666-4666-a666-666666666666";
const PROD_2 = "77777777-7777-4777-a777-777777777777";
const OTHER_PROD = "88888888-8888-4888-a888-888888888888";

const USER_ID = "99999999-9999-4999-a999-999999999999";

let inMemoryLocations: any[] = [];
let inMemoryProducts: any[] = [];
let inMemoryStock: any[] = [];
let inMemoryMovements: any[] = [];
let inMemoryUsers: any[] = [];
let inMemoryNotifications: any[] = [];

// Mock de Supabase Client & Server
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}));

vi.mock("@/lib/notifications/notifications-service", () => ({
  createNotification: vi.fn(async (notif: any) => {
    inMemoryNotifications.push({ id: `notif-${Date.now()}`, ...notif });
    return { success: true };
  }),
}));

const mockSupabaseClient = {
  from: (table: string) => {
    return {
      select: (cols: string = "*") => {
        let currentList = (
          table === "locations"
            ? inMemoryLocations
            : table === "products"
            ? inMemoryProducts
            : table === "inventory_stock"
            ? inMemoryStock.map((s) => ({
                ...s,
                products: inMemoryProducts.find((p) => p.id === s.product_id) || { name: "Producto" },
                locations: inMemoryLocations.find((l) => l.id === s.location_id) || { name: "Ubicación" },
              }))
            : table === "inventory_movements"
            ? inMemoryMovements
            : table === "users"
            ? inMemoryUsers
            : []
        );

        const createChain = (list: any[]) => {
          let filtered = [...list];

          const chain: any = {
            data: filtered,
            error: null,
            eq: (col: string, val: any) => {
              filtered = filtered.filter((item: any) => item[col] === val);
              return createChain(filtered);
            },
            in: (col: string, values: any[]) => {
              filtered = filtered.filter((item: any) => values.includes(item[col]));
              return createChain(filtered);
            },
            neq: (col: string, val: any) => {
              filtered = filtered.filter((item: any) => item[col] !== val);
              return createChain(filtered);
            },
            order: (orderField: string, orderOpts?: any) => {
              const ascending = orderOpts?.ascending ?? true;
              filtered.sort((a, b) => {
                if (a[orderField] < b[orderField]) return ascending ? -1 : 1;
                if (a[orderField] > b[orderField]) return ascending ? 1 : -1;
                return 0;
              });
              return createChain(filtered);
            },
            limit: (n: number) => {
              return createChain(filtered.slice(0, n));
            },
            maybeSingle: async () => ({
              data: filtered[0] || null,
              error: null,
            }),
            single: async () => ({
              data: filtered[0] || null,
              error: filtered[0] ? null : { message: "No rows found" },
            }),
          };

          chain.then = (resolve: any, reject?: any) => {
            return Promise.resolve({ data: filtered, error: null }).then(resolve, reject);
          };

          return chain;
        };

        return createChain(currentList);
      },
      insert: (recordOrList: any) => {
        const records = Array.isArray(recordOrList) ? recordOrList : [recordOrList];
        const insertedList = records.map((r: any) => ({
          ...r,
          id: r.id || `gen-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          created_at: r.created_at || new Date().toISOString(),
        }));

        if (table === "inventory_movements") {
          inMemoryMovements.push(...insertedList);
        } else if (table === "inventory_stock") {
          inMemoryStock.push(...insertedList);
        }

        return {
          select: () => ({
            single: async () => ({
              data: insertedList[0],
              error: null,
            }),
          }),
        };
      },
      upsert: (record: any) => {
        if (table === "inventory_stock") {
          const idx = inMemoryStock.findIndex(
            (s) =>
              s.business_id === record.business_id &&
              s.product_id === record.product_id &&
              s.location_id === record.location_id
          );
          if (idx !== -1) {
            inMemoryStock[idx] = {
              ...inMemoryStock[idx],
              quantity: record.quantity,
              cost: record.cost ?? inMemoryStock[idx].cost,
              min_stock: record.min_stock ?? inMemoryStock[idx].min_stock,
              updated_at: new Date().toISOString(),
            };
            return {
              select: () => ({
                single: async () => ({ data: inMemoryStock[idx], error: null }),
              }),
            };
          } else {
            const newStock = {
              ...record,
              id: record.id || `stock-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              updated_at: new Date().toISOString(),
            };
            inMemoryStock.push(newStock);
            return {
              select: () => ({
                single: async () => ({ data: newStock, error: null }),
              }),
            };
          }
        }
        return {
          select: () => ({
            single: async () => ({ data: record, error: null }),
          }),
        };
      },
      update: (updates: any) => ({
        eq: (f1: string, v1: any) => ({
          eq: async (f2: string, v2: any) => {
            if (table === "products") {
              const p = inMemoryProducts.find((item) => item[f1] === v1 && item[f2] === v2);
              if (p) {
                Object.assign(p, updates);
              }
            }
            return { data: null, error: null };
          },
        }),
      }),
    };
  },
};

describe("[INV-005] Transferencias entre Ubicaciones de Inventario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inMemoryNotifications = [];

    // Ubicaciones de prueba
    inMemoryLocations = [
      {
        id: LOC_A_ORIGIN,
        business_id: TEST_BUSINESS_ID,
        name: "Bodega Principal (Origen)",
        type: "warehouse",
        is_active: true,
      },
      {
        id: LOC_B_DEST,
        business_id: TEST_BUSINESS_ID,
        name: "Barra Punto de Venta (Destino)",
        type: "point_of_sale",
        is_active: true,
      },
      {
        id: OTHER_LOCATION,
        business_id: OTHER_BUSINESS_ID,
        name: "Bodega Negocio Ajeno",
        type: "warehouse",
        is_active: true,
      },
    ];

    // Productos de prueba
    inMemoryProducts = [
      {
        id: PROD_1,
        business_id: TEST_BUSINESS_ID,
        name: "Café Especial Huila 500g",
        metadata: {
          track_stock: true,
          stock_quantity: 25,
          cost: 15000,
        },
      },
      {
        id: PROD_2,
        business_id: TEST_BUSINESS_ID,
        name: "Leche Entera 1L",
        metadata: {
          track_stock: true,
          stock_quantity: 30,
          cost: 4000,
        },
      },
      {
        id: OTHER_PROD,
        business_id: OTHER_BUSINESS_ID,
        name: "Producto Ajeno",
        metadata: {
          track_stock: true,
          stock_quantity: 100,
        },
      },
    ];

    // Existencias por ubicación:
    // PROD_1 en Origen: 20 un. (min: 5, cost: 15000)
    // PROD_1 en Destino: 5 un. (min: 2, cost: 15000)
    // Total consolidado = 25 un.
    inMemoryStock = [
      {
        id: "stock-1",
        business_id: TEST_BUSINESS_ID,
        product_id: PROD_1,
        location_id: LOC_A_ORIGIN,
        quantity: 20,
        min_stock: 5,
        cost: 15000,
        updated_at: new Date().toISOString(),
      },
      {
        id: "stock-2",
        business_id: TEST_BUSINESS_ID,
        product_id: PROD_1,
        location_id: LOC_B_DEST,
        quantity: 5,
        min_stock: 2,
        cost: 15000,
        updated_at: new Date().toISOString(),
      },
      // PROD_2 en Origen: 30 un. (no existe aún en Destino)
      {
        id: "stock-3",
        business_id: TEST_BUSINESS_ID,
        product_id: PROD_2,
        location_id: LOC_A_ORIGIN,
        quantity: 30,
        min_stock: 10,
        cost: 4000,
        updated_at: new Date().toISOString(),
      },
    ];

    inMemoryMovements = [];
    inMemoryUsers = [
      {
        id: USER_ID,
        full_name: "Administrador de Bodega",
        email: "admin@negova.co",
      },
    ];
  });

  // --------------------------------------------------------------------------
  // Criterio 1: Transferencia de 5 unidades de A a B (A tiene -5 y B tiene +5)
  // --------------------------------------------------------------------------
  describe("Criterio 1: Descuento en origen e incremento en destino", () => {
    it("al transferir 5 unidades de Ubicación A a B: A tiene -5 (de 20 a 15) y B tiene +5 (de 5 a 10)", async () => {
      const input: CreateTransferInput = {
        sourceLocationId: LOC_A_ORIGIN,
        destinationLocationId: LOC_B_DEST,
        items: [{ productId: PROD_1, quantity: 5 }],
        notes: "Reabastecimiento para turno de la tarde",
      };

      const result = await transferInventory(TEST_BUSINESS_ID, input, USER_ID);

      expect(result.transferId).toBeDefined();
      expect(result.sourceLocationName).toContain("Origen");
      expect(result.destinationLocationName).toContain("Destino");

      // 1. Stock en origen: 20 - 5 = 15
      const originStock = inMemoryStock.find(
        (s) => s.product_id === PROD_1 && s.location_id === LOC_A_ORIGIN
      );
      expect(originStock?.quantity).toBe(15);

      // 2. Stock en destino: 5 + 5 = 10
      const destStock = inMemoryStock.find(
        (s) => s.product_id === PROD_1 && s.location_id === LOC_B_DEST
      );
      expect(destStock?.quantity).toBe(10);

      // 3. El stock consolidado total en catálogo debe mantenerse constante (25)
      const prod = inMemoryProducts.find((p) => p.id === PROD_1);
      expect(prod?.metadata.stock_quantity).toBe(25);
    });
  });

  // --------------------------------------------------------------------------
  // Criterio 2: El historial muestra ambos movimientos vinculados atómicamente
  // --------------------------------------------------------------------------
  describe("Criterio 2: Movimientos vinculados en Kardex", () => {
    it("genera 2 movimientos: transfer_out en origen y transfer_in en destino con el mismo reference_id", async () => {
      const input: CreateTransferInput = {
        sourceLocationId: LOC_A_ORIGIN,
        destinationLocationId: LOC_B_DEST,
        items: [{ productId: PROD_1, quantity: 8 }],
        notes: "Traspaso de bultos",
      };

      const result = await transferInventory(TEST_BUSINESS_ID, input, USER_ID);

      // Debe generar exactamente 2 movimientos en la transferencia
      expect(result.movements).toHaveLength(2);

      const outMov = result.movements.find((m) => m.movementType === "transfer_out");
      const inMov = result.movements.find((m) => m.movementType === "transfer_in");

      expect(outMov).toBeDefined();
      expect(inMov).toBeDefined();

      // Ambos movimientos comparten el mismo reference_id y reference_type
      expect(outMov?.referenceId).toBe(result.transferId);
      expect(inMov?.referenceId).toBe(result.transferId);
      expect(outMov?.referenceType).toBe("transfer");
      expect(inMov?.referenceType).toBe("transfer");

      // Verificación de cantidades y costos
      expect(outMov?.quantity).toBe(8);
      expect(inMov?.quantity).toBe(8);
      expect(outMov?.locationId).toBe(LOC_A_ORIGIN);
      expect(inMov?.locationId).toBe(LOC_B_DEST);
      expect(outMov?.totalCost).toBe(120000); // 8 * 15000
      expect(inMov?.totalCost).toBe(120000);

      // Ambos guardan el autor created_by
      expect(outMov?.createdBy).toBe(USER_ID);
      expect(inMov?.createdBy).toBe(USER_ID);

      // Verificación en el Kardex in-memory
      expect(inMemoryMovements).toHaveLength(2);
    });
  });

  // --------------------------------------------------------------------------
  // Criterio 3: Validación contra stock insuficiente en origen
  // --------------------------------------------------------------------------
  describe("Criterio 3: Rechazo si origen no tiene stock suficiente", () => {
    it("si origen tiene 20 unidades e intentan transferir 25, la transferencia se rechaza y no modifica stock", async () => {
      const input: CreateTransferInput = {
        sourceLocationId: LOC_A_ORIGIN,
        destinationLocationId: LOC_B_DEST,
        items: [{ productId: PROD_1, quantity: 25 }],
      };

      await expect(transferInventory(TEST_BUSINESS_ID, input, USER_ID)).rejects.toThrow(
        /Existencias insuficientes/i
      );

      // Verificar que el stock de origen NO fue modificado
      const originStock = inMemoryStock.find(
        (s) => s.product_id === PROD_1 && s.location_id === LOC_A_ORIGIN
      );
      expect(originStock?.quantity).toBe(20);

      // Verificar que el stock de destino NO fue modificado
      const destStock = inMemoryStock.find(
        (s) => s.product_id === PROD_1 && s.location_id === LOC_B_DEST
      );
      expect(destStock?.quantity).toBe(5);

      // Ningún movimiento debe haber sido insertado
      expect(inMemoryMovements).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // Criterio 4: No se puede transferir a la misma ubicación
  // --------------------------------------------------------------------------
  describe("Criterio 4: Rechazo si origen y destino son iguales", () => {
    it("rechaza la operación si sourceLocationId === destinationLocationId", async () => {
      const input: any = {
        sourceLocationId: LOC_A_ORIGIN,
        destinationLocationId: LOC_A_ORIGIN,
        items: [{ productId: PROD_1, quantity: 2 }],
      };

      await expect(transferInventory(TEST_BUSINESS_ID, input, USER_ID)).rejects.toThrow(
        /origen y destino no pueden ser iguales/i
      );

      expect(inMemoryMovements).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // Criterio 5: Aislamiento Multi-Tenant estricto
  // --------------------------------------------------------------------------
  describe("Criterio 5: Aislamiento Multi-Tenant", () => {
    it("rechaza la transferencia si la ubicación origen pertenece a otro negocio", async () => {
      const input: CreateTransferInput = {
        sourceLocationId: OTHER_LOCATION,
        destinationLocationId: LOC_B_DEST,
        items: [{ productId: PROD_1, quantity: 1 }],
      };

      await expect(transferInventory(TEST_BUSINESS_ID, input, USER_ID)).rejects.toThrow(
        /La ubicación origen no existe o no pertenece a este comercio/i
      );
    });

    it("rechaza la transferencia si la ubicación destino pertenece a otro negocio", async () => {
      const input: CreateTransferInput = {
        sourceLocationId: LOC_A_ORIGIN,
        destinationLocationId: OTHER_LOCATION,
        items: [{ productId: PROD_1, quantity: 1 }],
      };

      await expect(transferInventory(TEST_BUSINESS_ID, input, USER_ID)).rejects.toThrow(
        /La ubicación destino no existe o no pertenece a este comercio/i
      );
    });

    it("rechaza la transferencia si un producto pertenece a otro negocio", async () => {
      const input: CreateTransferInput = {
        sourceLocationId: LOC_A_ORIGIN,
        destinationLocationId: LOC_B_DEST,
        items: [{ productId: OTHER_PROD, quantity: 1 }],
      };

      await expect(transferInventory(TEST_BUSINESS_ID, input, USER_ID)).rejects.toThrow(
        /Uno o más productos no pertenecen a este comercio/i
      );
    });
  });

  // --------------------------------------------------------------------------
  // Criterio 6: Transferencia de múltiples productos en lote atómico
  // --------------------------------------------------------------------------
  describe("Criterio 6: Transferencias de múltiples productos en un solo lote", () => {
    it("transfiere múltiples productos atómicamente y crea existencias en destino si no existían", async () => {
      // PROD_1 tiene 20 en origen y 5 en destino.
      // PROD_2 tiene 30 en origen y NO existía en destino.
      const input: CreateTransferInput = {
        sourceLocationId: LOC_A_ORIGIN,
        destinationLocationId: LOC_B_DEST,
        items: [
          { productId: PROD_1, quantity: 10 },
          { productId: PROD_2, quantity: 15 },
        ],
        notes: "Transferencia masiva de apertura",
      };

      const result = await transferInventory(TEST_BUSINESS_ID, input, USER_ID);

      // 4 movimientos en total: 2 transfer_out y 2 transfer_in
      expect(result.movements).toHaveLength(4);
      expect(result.movements.every((m) => m.referenceId === result.transferId)).toBe(true);

      // PROD_1: origen 20 - 10 = 10; destino 5 + 10 = 15
      const p1Origin = inMemoryStock.find((s) => s.product_id === PROD_1 && s.location_id === LOC_A_ORIGIN);
      const p1Dest = inMemoryStock.find((s) => s.product_id === PROD_1 && s.location_id === LOC_B_DEST);
      expect(p1Origin?.quantity).toBe(10);
      expect(p1Dest?.quantity).toBe(15);

      // PROD_2: origen 30 - 15 = 15; destino 0 + 15 = 15 (fila creada)
      const p2Origin = inMemoryStock.find((s) => s.product_id === PROD_2 && s.location_id === LOC_A_ORIGIN);
      const p2Dest = inMemoryStock.find((s) => s.product_id === PROD_2 && s.location_id === LOC_B_DEST);
      expect(p2Origin?.quantity).toBe(15);
      expect(p2Dest).toBeDefined();
      expect(p2Dest?.quantity).toBe(15);
    });

    it("si uno de los productos en lote no tiene stock, rechaza la operación completa antes de alterar existencias", async () => {
      // PROD_1 pide 5 (tiene 20, suficiente), pero PROD_2 pide 50 (tiene 30, insuficiente)
      const input: CreateTransferInput = {
        sourceLocationId: LOC_A_ORIGIN,
        destinationLocationId: LOC_B_DEST,
        items: [
          { productId: PROD_1, quantity: 5 },
          { productId: PROD_2, quantity: 50 },
        ],
      };

      await expect(transferInventory(TEST_BUSINESS_ID, input, USER_ID)).rejects.toThrow(
        /Existencias insuficientes para «Leche Entera 1L»/i
      );

      // Ningún stock debe haber cambiado
      const p1Origin = inMemoryStock.find((s) => s.product_id === PROD_1 && s.location_id === LOC_A_ORIGIN);
      expect(p1Origin?.quantity).toBe(20);
      expect(inMemoryMovements).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // Criterio 7: Alerta in-app si el stock remanente en origen queda <= min_stock
  // --------------------------------------------------------------------------
  describe("Criterio 7: Notificación de stock bajo en origen", () => {
    it("dispara notificación in-app si el stock resultante en origen queda <= minStock", async () => {
      // PROD_1 tiene 20 en origen con minStock = 5.
      // Al transferir 16 unidades, el remanente es 4 <= 5.
      const input: CreateTransferInput = {
        sourceLocationId: LOC_A_ORIGIN,
        destinationLocationId: LOC_B_DEST,
        items: [{ productId: PROD_1, quantity: 16 }],
      };

      await transferInventory(TEST_BUSINESS_ID, input, USER_ID);

      expect(inMemoryNotifications.length).toBe(1);
      expect(inMemoryNotifications[0].scope).toBe("business");
      expect(inMemoryNotifications[0].title).toContain("Alerta de Stock Bajo");
      expect(inMemoryNotifications[0].message).toContain("Café Especial Huila");
    });
  });
});
