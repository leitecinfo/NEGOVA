import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  recordInventoryMovement,
  recordInventoryMovementsBatch,
  getInventoryMovementsHistory,
} from "../../src/lib/inventory/inventory-service";
import { CreateMovementInput } from "../../src/lib/inventory/types";

// ==============================================================================
// BASE DE DATOS EN MEMORIA AISLADA POR TENANT
// ==============================================================================

const TEST_BUSINESS_ID = "11111111-1111-4111-a111-111111111111";
const OTHER_BUSINESS_ID = "22222222-2222-4222-a222-222222222222";

const TEST_LOCATION_ID = "33333333-3333-4333-a333-333333333333";
const OTHER_LOCATION_ID = "44444444-4444-4444-a444-444444444444";

const TEST_PRODUCT_ID = "55555555-5555-4555-a555-555555555555";
const OTHER_PRODUCT_ID = "66666666-6666-4666-a666-666666666666";

const USER_ID = "77777777-7777-4777-a777-777777777777";

let inMemoryLocations: any[] = [];
let inMemoryProducts: any[] = [];
let inMemoryStock: any[] = [];
let inMemoryMovements: any[] = [];
let inMemoryUsers: any[] = [];

// Mock de Supabase Client & Server
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}));

vi.mock("@/lib/notifications/notifications-service", () => ({
  createNotification: vi.fn(async () => ({ success: true })),
}));

const mockSupabaseClient = {
  from: (table: string) => {
    return {
      select: (cols: string = "*", opts?: any) => {
        return {
          eq: (field1: string, val1: any) => {
            let filtered = (table === "locations"
              ? inMemoryLocations
              : table === "products"
              ? inMemoryProducts
              : table === "inventory_stock"
              ? inMemoryStock
              : table === "inventory_movements"
              ? inMemoryMovements
              : table === "users"
              ? inMemoryUsers
              : []
            ).filter((item: any) => item[field1] === val1);

            const chain = {
              eq: (field2: string, val2: any) => {
                filtered = filtered.filter((item: any) => item[field2] === val2);
                const subchain: any = {
                  data: filtered,
                  error: null,
                  eq: (field3: string, val3: any) => {
                    filtered = filtered.filter((item: any) => item[field3] === val3);
                    const subsubchain: any = {
                      data: filtered,
                      error: null,
                      maybeSingle: async () => ({
                        data: filtered[0] || null,
                        error: null,
                      }),
                      single: async () => ({
                        data: filtered[0] || null,
                        error: filtered[0] ? null : { message: "No rows found" },
                      }),
                    };
                    subsubchain.then = (resolve: any) => resolve({ data: filtered, error: null });
                    return subsubchain;
                  },
                  maybeSingle: async () => ({
                    data: filtered[0] || null,
                    error: null,
                  }),
                  single: async () => ({
                    data: filtered[0] || null,
                    error: filtered[0] ? null : { message: "No rows found" },
                  }),
                  order: () => subchain,
                };
                subchain.then = (resolve: any) => resolve({ data: filtered, error: null });
                return subchain;
              },
              in: (fieldIn: string, values: any[]) => {
                filtered = filtered.filter((item: any) => values.includes(item[fieldIn]));
                return Promise.resolve({ data: filtered, error: null });
              },
              order: (orderField: string, orderOpts?: any) => {
                const ascending = orderOpts?.ascending ?? true;
                filtered.sort((a, b) => {
                  if (a[orderField] < b[orderField]) return ascending ? -1 : 1;
                  if (a[orderField] > b[orderField]) return ascending ? 1 : -1;
                  return 0;
                });
                return {
                  limit: (n: number) => ({
                    maybeSingle: async () => ({
                      data: filtered[0] || null,
                      error: null,
                    }),
                    data: filtered.slice(0, n),
                    error: null,
                  }),
                  data: filtered,
                  error: null,
                };
              },
              maybeSingle: async () => ({
                data: filtered[0] || null,
                error: null,
              }),
              single: async () => ({
                data: filtered[0] || null,
                error: filtered[0] ? null : { message: "No rows found" },
              }),
              limit: (n: number) => Promise.resolve({ data: filtered.slice(0, n), error: null }),
            };

            // Para queries directas que terminan en then/await
            (chain as any).then = (resolve: any) => resolve({ data: filtered, error: null });

            return chain;
          },
          in: (field: string, values: any[]) => {
            const list = (table === "users" ? inMemoryUsers : []).filter((item: any) =>
              values.includes(item[field])
            );
            return Promise.resolve({ data: list, error: null });
          },
        };
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
              id: record.id || `stock-${Date.now()}`,
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

describe("[INV-003] Movimientos de Inventario (Entradas, Salidas y Ajustes)", () => {
  beforeEach(() => {
    inMemoryLocations = [
      {
        id: TEST_LOCATION_ID,
        business_id: TEST_BUSINESS_ID,
        name: "Bodega Principal",
        type: "warehouse",
        is_active: true,
      },
      {
        id: OTHER_LOCATION_ID,
        business_id: OTHER_BUSINESS_ID,
        name: "Bodega Negocio Ajeno",
        type: "warehouse",
        is_active: true,
      },
    ];

    inMemoryProducts = [
      {
        id: TEST_PRODUCT_ID,
        business_id: TEST_BUSINESS_ID,
        name: "Café Especial Huila 500g",
        metadata: {
          track_stock: true,
          stock_quantity: 20,
          cost: 15000,
        },
      },
      {
        id: OTHER_PRODUCT_ID,
        business_id: OTHER_BUSINESS_ID,
        name: "Producto Negocio Ajeno",
        metadata: {
          track_stock: true,
          stock_quantity: 50,
        },
      },
    ];

    inMemoryStock = [
      {
        id: "stock-1",
        business_id: TEST_BUSINESS_ID,
        product_id: TEST_PRODUCT_ID,
        location_id: TEST_LOCATION_ID,
        quantity: 20,
        min_stock: 5,
        cost: 15000,
        updated_at: new Date().toISOString(),
      },
    ];

    inMemoryMovements = [];

    inMemoryUsers = [
      {
        id: USER_ID,
        name: "Carlos Bodeguero",
        email: "carlos@negova.com",
      },
    ];
  });

  describe("Criterio 1: Entrada de inventario (entry)", () => {
    it("al registrar una entrada de 10 unidades, el stock se incrementa en 10", async () => {
      const input: CreateMovementInput = {
        productId: TEST_PRODUCT_ID,
        locationId: TEST_LOCATION_ID,
        movementType: "entry",
        quantity: 10,
        unitCost: 16000,
        notes: "Recepción de pedido a proveedor",
      };

      const mov = await recordInventoryMovement(TEST_BUSINESS_ID, input, USER_ID);

      expect(mov).toBeDefined();
      expect(mov.movementType).toBe("entry");
      expect(mov.quantity).toBe(10);
      expect(mov.createdBy).toBe(USER_ID);

      // Verificar que el stock en esa ubicación subió de 20 a 30
      const stock = inMemoryStock.find(
        (s) => s.business_id === TEST_BUSINESS_ID && s.product_id === TEST_PRODUCT_ID && s.location_id === TEST_LOCATION_ID
      );
      expect(stock?.quantity).toBe(30);

      // Verificar que la metadata del producto se sincronizó a 30
      const prod = inMemoryProducts.find((p) => p.id === TEST_PRODUCT_ID);
      expect(prod?.metadata.stock_quantity).toBe(30);
    });
  });

  describe("Criterio 2: Salida de inventario (exit)", () => {
    it("al registrar una salida de 5 unidades, el stock se reduce en 5", async () => {
      const input: CreateMovementInput = {
        productId: TEST_PRODUCT_ID,
        locationId: TEST_LOCATION_ID,
        movementType: "exit",
        quantity: 5,
        notes: "Despacho a evento corporativo",
      };

      const mov = await recordInventoryMovement(TEST_BUSINESS_ID, input, USER_ID);

      expect(mov).toBeDefined();
      expect(mov.movementType).toBe("exit");
      expect(mov.quantity).toBe(5);

      // Verificar que el stock bajó de 20 a 15
      const stock = inMemoryStock.find(
        (s) => s.business_id === TEST_BUSINESS_ID && s.product_id === TEST_PRODUCT_ID && s.location_id === TEST_LOCATION_ID
      );
      expect(stock?.quantity).toBe(15);

      // Verificar que la metadata consolidada bajó a 15
      const prod = inMemoryProducts.find((p) => p.id === TEST_PRODUCT_ID);
      expect(prod?.metadata.stock_quantity).toBe(15);
    });
  });

  describe("Criterio 3: Validación contra stock negativo", () => {
    it("al intentar una salida mayor al stock disponible (ej. 25 cuando hay 20), muestra error y no modifica existencias", async () => {
      const input: CreateMovementInput = {
        productId: TEST_PRODUCT_ID,
        locationId: TEST_LOCATION_ID,
        movementType: "exit",
        quantity: 25, // Disponible: 20
        notes: "Salida excesiva",
      };

      await expect(
        recordInventoryMovement(TEST_BUSINESS_ID, input, USER_ID)
      ).rejects.toThrow(/Existencias insuficientes/);

      // Confirmar que el stock permanece en 20 intacto
      const stock = inMemoryStock.find(
        (s) => s.business_id === TEST_BUSINESS_ID && s.product_id === TEST_PRODUCT_ID && s.location_id === TEST_LOCATION_ID
      );
      expect(stock?.quantity).toBe(20);

      // No debe haberse insertado ningún movimiento erróneo
      expect(inMemoryMovements).toHaveLength(0);
    });
  });

  describe("Criterio 4: Ajuste físico de inventario (adjustment)", () => {
    it("el ajuste establece el stock exactamente al valor indicado (no suma/resta)", async () => {
      // Había 20. El conteo físico da 12.
      const input: CreateMovementInput = {
        productId: TEST_PRODUCT_ID,
        locationId: TEST_LOCATION_ID,
        movementType: "adjustment",
        quantity: 12,
        notes: "Ajuste tras conteo físico mensual",
      };

      const mov = await recordInventoryMovement(TEST_BUSINESS_ID, input, USER_ID);

      expect(mov.movementType).toBe("adjustment");
      expect(mov.quantity).toBe(12);

      // El stock debe quedar exactamente en 12 (no 20 + 12 ni 20 - 12)
      const stock = inMemoryStock.find(
        (s) => s.business_id === TEST_BUSINESS_ID && s.product_id === TEST_PRODUCT_ID && s.location_id === TEST_LOCATION_ID
      );
      expect(stock?.quantity).toBe(12);

      const prod = inMemoryProducts.find((p) => p.id === TEST_PRODUCT_ID);
      expect(prod?.metadata.stock_quantity).toBe(12);
    });

    it("el ajuste permite fijar stock en 0 si no hay existencias", async () => {
      const input: CreateMovementInput = {
        productId: TEST_PRODUCT_ID,
        locationId: TEST_LOCATION_ID,
        movementType: "adjustment",
        quantity: 0,
        notes: "Agotamiento verificado",
      };

      await recordInventoryMovement(TEST_BUSINESS_ID, input, USER_ID);

      const stock = inMemoryStock.find(
        (s) => s.business_id === TEST_BUSINESS_ID && s.product_id === TEST_PRODUCT_ID && s.location_id === TEST_LOCATION_ID
      );
      expect(stock?.quantity).toBe(0);
    });
  });

  describe("Criterio 5 y 6: Auditoría inmutable y created_by", () => {
    it("cada movimiento almacena created_by y permanece inmutable en el historial", async () => {
      const input: CreateMovementInput = {
        productId: TEST_PRODUCT_ID,
        locationId: TEST_LOCATION_ID,
        movementType: "entry",
        quantity: 8,
        unitCost: 15500,
        notes: "Lote de prueba de auditoría",
      };

      const mov = await recordInventoryMovement(TEST_BUSINESS_ID, input, USER_ID);

      expect(mov.createdBy).toBe(USER_ID);
      expect(mov.totalCost).toBe(15500 * 8);

      // Inmutabilidad: el registro existe en inventory_movements
      expect(inMemoryMovements).toHaveLength(1);
      expect(inMemoryMovements[0].created_by).toBe(USER_ID);
      expect(inMemoryMovements[0].movement_type).toBe("entry");
    });
  });

  describe("Criterio 7: Aislamiento estricto Multi-Tenant", () => {
    it("rechaza el movimiento si la ubicación pertenece a otro negocio", async () => {
      const input: CreateMovementInput = {
        productId: TEST_PRODUCT_ID,
        locationId: OTHER_LOCATION_ID, // Ubicación de OTHER_BUSINESS_ID
        movementType: "entry",
        quantity: 10,
      };

      await expect(
        recordInventoryMovement(TEST_BUSINESS_ID, input, USER_ID)
      ).rejects.toThrow(/La ubicación indicada no pertenece a este comercio/);
    });

    it("rechaza el movimiento si el producto pertenece a otro negocio", async () => {
      const input: CreateMovementInput = {
        productId: OTHER_PRODUCT_ID, // Producto de OTHER_BUSINESS_ID
        locationId: TEST_LOCATION_ID,
        movementType: "entry",
        quantity: 10,
      };

      await expect(
        recordInventoryMovement(TEST_BUSINESS_ID, input, USER_ID)
      ).rejects.toThrow(/El producto indicado no pertenece a este comercio/);
    });
  });

  describe("Operaciones en Lote (recordInventoryMovementsBatch)", () => {
    it("registra múltiples movimientos en una sola llamada y actualiza cada existencias", async () => {
      // Agregamos un segundo producto de prueba
      const PRODUCT_2_ID = "88888888-1111-4111-a111-222222222222";
      inMemoryProducts.push({
        id: PRODUCT_2_ID,
        business_id: TEST_BUSINESS_ID,
        name: "Té Verde Matcha",
        metadata: { track_stock: true, stock_quantity: 10 },
      });
      inMemoryStock.push({
        id: "stock-2",
        business_id: TEST_BUSINESS_ID,
        product_id: PRODUCT_2_ID,
        location_id: TEST_LOCATION_ID,
        quantity: 10,
        min_stock: 2,
        cost: 8000,
        updated_at: new Date().toISOString(),
      });

      const batchItems: CreateMovementInput[] = [
        {
          productId: TEST_PRODUCT_ID,
          locationId: TEST_LOCATION_ID,
          movementType: "entry",
          quantity: 10,
        },
        {
          productId: PRODUCT_2_ID,
          locationId: TEST_LOCATION_ID,
          movementType: "exit",
          quantity: 4,
        },
      ];

      const results = await recordInventoryMovementsBatch(TEST_BUSINESS_ID, batchItems, USER_ID);

      expect(results).toHaveLength(2);
      expect(results[0].movementType).toBe("entry");
      expect(results[1].movementType).toBe("exit");

      // Primer producto: 20 + 10 = 30
      const stock1 = inMemoryStock.find((s) => s.product_id === TEST_PRODUCT_ID);
      expect(stock1?.quantity).toBe(30);

      // Segundo producto: 10 - 4 = 6
      const stock2 = inMemoryStock.find((s) => s.product_id === PRODUCT_2_ID);
      expect(stock2?.quantity).toBe(6);
    });
  });

  describe("Historial enriquecido de movimientos (getInventoryMovementsHistory)", () => {
    it("el historial muestra las operaciones registradas con todos sus metadatos y autor", async () => {
      // Registrar un movimiento
      await recordInventoryMovement(
        TEST_BUSINESS_ID,
        {
          productId: TEST_PRODUCT_ID,
          locationId: TEST_LOCATION_ID,
          movementType: "entry",
          quantity: 15,
          unitCost: 14000,
          notes: "Entrada para verificación de historial",
        },
        USER_ID
      );

      // Adaptar el mock de inMemoryMovements para incluir join simulado
      inMemoryMovements[0].products = {
        name: "Café Especial Huila 500g",
        metadata: { sku: "CAF-001" },
      };
      inMemoryMovements[0].locations = {
        name: "Bodega Principal",
      };

      const history = await getInventoryMovementsHistory(TEST_BUSINESS_ID);

      expect(history).toHaveLength(1);
      const item = history[0];
      expect(item.productName).toBe("Café Especial Huila 500g");
      expect(item.productSku).toBe("CAF-001");
      expect(item.locationName).toBe("Bodega Principal");
      expect(item.movementType).toBe("entry");
      expect(item.quantity).toBe(15);
      expect(item.unitCost).toBe(14000);
      expect(item.totalCost).toBe(14000 * 15);
      expect(item.notes).toBe("Entrada para verificación de historial");
      expect(item.createdByName).toBe("Carlos Bodeguero");
    });
  });
});
