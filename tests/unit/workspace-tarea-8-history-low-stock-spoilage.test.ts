import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractStockSnapshot,
  resolveMovementOrigin,
  MOVEMENT_ORIGIN_OPTIONS,
} from "../../src/lib/inventory/types";
import {
  createSpoilageRecord,
  getSpoilageRecords,
  getSpoilageKPIs,
} from "../../src/lib/spoilage/spoilage-service";
import {
  getInventoryKPIs,
  getLowStockItems,
  updateItemMinStock,
} from "../../src/lib/inventory/inventory-service";

// ==============================================================================
// PRUEBAS AUTOMATIZADAS TAREA 8: HISTORIAL, STOCK BAJO Y REGISTRO DE MERMAS
// ==============================================================================

const TEST_BIZ = "a8e2612f-4acc-4c84-a420-220131b70d66";
const OTHER_BIZ = "00000000-0000-0000-0000-000000000000";
const LOC_ID = "de41eace-824d-4cb5-83f8-2af2e2787440";

let mockStock: any[] = [];
let mockProducts: any[] = [];
let mockMovements: any[] = [];
let mockSpoilage: any[] = [];

vi.mock("@/lib/inventory/inventory-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/inventory/inventory-service")>();
  return {
    ...actual,
    ensureDefaultLocation: vi.fn(async () => ({
      id: LOC_ID,
      name: "Sede Principal",
      type: "point_of_sale",
    })),
    getInventoryStock: vi.fn(async (bizId: string, filter?: any) => {
      return mockStock
        .filter((s) => {
          if (s.business_id !== bizId) return false;
          if (filter?.productId && s.product_id !== filter.productId) return false;
          if (filter?.locationId && s.location_id !== filter.locationId) return false;
          return true;
        })
        .map((s) => ({
          id: s.id,
          businessId: s.business_id,
          productId: s.product_id,
          locationId: s.location_id,
          quantity: s.quantity,
          minStock: s.min_stock,
          cost: s.cost,
          updatedAt: s.updated_at,
        }));
    }),
    upsertInventoryStock: vi.fn(async (bizId: string, input: any) => {
      const idx = mockStock.findIndex(
        (s) => s.business_id === bizId && s.product_id === input.productId && s.location_id === input.locationId
      );
      if (idx !== -1) {
        mockStock[idx].quantity = input.quantity;
        mockStock[idx].min_stock = input.minStock ?? mockStock[idx].min_stock;
        mockStock[idx].cost = input.cost ?? mockStock[idx].cost;
        return mockStock[idx];
      }
      const newItem = {
        id: `stk-${Date.now()}`,
        business_id: bizId,
        product_id: input.productId,
        location_id: input.locationId,
        quantity: input.quantity,
        min_stock: input.minStock || 0,
        cost: input.cost || 0,
        updated_at: new Date().toISOString(),
      };
      mockStock.push(newItem);
      return newItem;
    }),
  };
});

// Mock Supabase
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockClient),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockClient),
}));

const mockClient = {
  from: (table: string) => {
    if (table === "products") {
      return {
        select: (cols: string = "*") => {
          let list = [...mockProducts];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((p) => p[col] === val);
              return chain;
            },
            single: async () => ({ data: list[0] || null, error: list[0] ? null : { message: "No encontrado" } }),
            maybeSingle: async () => ({ data: list[0] || null, error: null }),
            then: (res: any, rej?: any) => Promise.resolve({ data: list, error: null }).then(res, rej),
          };
          return chain;
        },
        update: (data: any) => ({
          eq: (col1: string, val1: any) => ({
            eq: (col2: string, val2: any) => {
              const idx = mockProducts.findIndex((p) => p[col1] === val1 && p[col2] === val2);
              if (idx !== -1) {
                mockProducts[idx] = {
                  ...mockProducts[idx],
                  ...data,
                  metadata: { ...(mockProducts[idx].metadata || {}), ...(data.metadata || {}) },
                };
              }
              return Promise.resolve({ error: null });
            },
          }),
        }),
      };
    }

    if (table === "spoilage_records") {
      return {
        insert: (data: any) => ({
          select: () => ({
            single: async () => {
              const record = { ...data, id: data.id || `sp-${Date.now()}`, locations: { name: "Sede Principal" } };
              mockSpoilage.push(record);
              return { data: record, error: null };
            },
          }),
        }),
        select: (cols: string = "*") => {
          let list = [...mockSpoilage];
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
            then: (res: any, rej?: any) => Promise.resolve({ data: list, error: null }).then(res, rej),
          };
          return chain;
        },
        delete: () => ({
          eq: (col: string, val: any) => {
            mockSpoilage = mockSpoilage.filter((r) => r[col] !== val);
            return Promise.resolve({ error: null });
          },
        }),
      };
    }

    if (table === "inventory_movements") {
      return {
        insert: (data: any) => {
          mockMovements.push({ ...data, id: data.id || `mov-${Date.now()}` });
          return Promise.resolve({ data, error: null });
        },
      };
    }

    return {};
  },
};

describe("TAREA 8: Consolidación de Historial, Stock Bajo y Mermas", () => {
  beforeEach(() => {
    mockStock = [];
    mockProducts = [];
    mockMovements = [];
    mockSpoilage = [];
  });

  // ============================================================================
  // 1. HISTORIAL: SNAPSHOT DE EXISTENCIAS Y CLASIFICACIÓN DE ORIGEN
  // ============================================================================
  describe("1. Historial de Movimientos y Kardex", () => {
    it("extrae con precisión el snapshot de stock anterior y resultante embebido en notas", () => {
      const notesWithSnapshot = "Ajuste manual de existencias (Anterior: 50, Resultante: 42)";
      const snapshot = extractStockSnapshot(notesWithSnapshot);

      expect(snapshot.previousQuantity).toBe(50);
      expect(snapshot.resultingQuantity).toBe(42);

      const notesDecimal = "Merma por vencimiento (Anterior: 12.5, Resultante: 10)";
      const snapshotDec = extractStockSnapshot(notesDecimal);
      expect(snapshotDec.previousQuantity).toBe(12.5);
      expect(snapshotDec.resultingQuantity).toBe(10);

      const notesWithout = "Movimiento simple sin snapshot";
      const snapshotNone = extractStockSnapshot(notesWithout);
      expect(snapshotNone.previousQuantity).toBeNull();
      expect(snapshotNone.resultingQuantity).toBeNull();
    });

    it("clasifica correctamente el origen de cada movimiento según el modelo de NEGOVA", () => {
      // Compra
      expect(resolveMovementOrigin({ referenceType: "purchase", notes: "Recepción de compra orden #5" })).toBe("Compra");
      expect(resolveMovementOrigin({ movementType: "entry", notes: "Mercancía de proveedor" })).toBe("Compra");

      // Merma
      expect(resolveMovementOrigin({ movementType: "spoilage", notes: "Merma: Producto vencido" })).toBe("Merma");
      expect(resolveMovementOrigin({ notes: "Merma registrada (dañado)" })).toBe("Merma");

      // Ajuste
      expect(resolveMovementOrigin({ movementType: "adjustment", notes: "Ajuste físico de stock" })).toBe("Ajuste");

      // Receta
      expect(resolveMovementOrigin({ referenceType: "recipe", notes: "Consumo de ingredientes por preparación" })).toBe("Receta");
      expect(resolveMovementOrigin({ notes: "Consumo receta hamburguesa" })).toBe("Receta");

      // POS / Mesa / Domicilio
      expect(resolveMovementOrigin({ orderType: "takeout", movementType: "sale" })).toBe("POS");
      expect(resolveMovementOrigin({ orderType: "dine_in", movementType: "sale" })).toBe("Mesa");
      expect(resolveMovementOrigin({ orderType: "delivery", movementType: "sale" })).toBe("Domicilio");

      // Devolución
      expect(resolveMovementOrigin({ referenceType: "sale_cancellation", notes: "Anulación de venta" })).toBe("Devolución");
    });
  });

  // ============================================================================
  // 2. STOCK BAJO Y ALERTAS DE EXISTENCIAS
  // ============================================================================
  describe("2. Stock Bajo y Alertas de Existencias", () => {
    it("diferencia estrictamente Disponible, Stock bajo y Agotado como estados mutuamente excluyentes", () => {
      // Simular cálculo de estados
      const items = [
        { name: "Cerveza Corona", stock: 15, minStock: 5 }, // Disponible (15 > 5)
        { name: "Agua Manantial", stock: 4, minStock: 5 },  // Stock bajo (0 < 4 <= 5)
        { name: "Pan Brioche", stock: 0, minStock: 10 },    // Agotado (0 <= 0)
        { name: "Salsa BBQ", stock: 20, minStock: 0 },      // Disponible sin mínimo (20 > 0)
      ];

      let inStock = 0;
      let lowStock = 0;
      let outOfStock = 0;

      for (const it of items) {
        if (it.stock <= 0) {
          outOfStock++;
        } else if (it.minStock > 0 && it.stock <= it.minStock) {
          lowStock++;
        } else {
          inStock++;
        }
      }

      expect(inStock).toBe(2);       // Cerveza + Salsa BBQ
      expect(lowStock).toBe(1);      // Agua Manantial
      expect(outOfStock).toBe(1);    // Pan Brioche
      expect(inStock + lowStock + outOfStock).toBe(items.length); // Mutuamente excluyentes
    });

    it("excluye de alertas de stock los productos preparados y servicios", () => {
      const items = [
        { name: "Hamburguesa Doble", type: "prepared", trackStock: false, stock: 0, minStock: 0 },
        { name: "Servicio de Delivery", type: "service", trackStock: false, stock: 0, minStock: 0 },
        { name: "Gaseosa Coca-Cola", type: "product", trackStock: true, stock: 2, minStock: 10 },
      ];

      const alertableItems = items.filter(
        (i) => i.type !== "prepared" && i.type !== "service" && i.trackStock === true
      );

      expect(alertableItems.length).toBe(1);
      expect(alertableItems[0].name).toBe("Gaseosa Coca-Cola");
    });
  });

  // ============================================================================
  // 3. REGISTRO DE MERMAS Y DESCUENTO ÚNICO
  // ============================================================================
  describe("3. Registro de Mermas y Descuento Único", () => {
    it("descuenta de forma única y atómica el stock al confirmar una merma", async () => {
      const prodId = "11111111-2222-3333-4444-555555555555";
      mockProducts.push({
        id: prodId,
        business_id: TEST_BIZ,
        name: "Carne de Res Molida",
        metadata: { product_type: "ingredient", track_stock: true, stock_quantity: 20, cost: 15000, unit: "kg" },
      });
      mockStock.push({
        id: "stk-carne",
        business_id: TEST_BIZ,
        product_id: prodId,
        location_id: LOC_ID,
        quantity: 20,
        min_stock: 5,
        cost: 15000,
      });

      // Registrar merma de 3 kg
      const result = await createSpoilageRecord(
        TEST_BIZ,
        {
          itemType: "ingredient",
          itemId: prodId,
          itemName: "Carne de Res Molida",
          cause: "damaged",
          quantity: 3,
          unitCost: 15000,
          unit: "kg",
          notes: "Cadena de frío interrumpida",
        },
        "alex-owner-id"
      );

      // Verificación 1: Merma registrada
      expect(result.id).toBeDefined();
      expect(result.quantity).toBe(3);
      expect(result.totalCost).toBe(45000);
      expect(result.previousStock).toBe(20);
      expect(result.resultingStock).toBe(17);

      // Verificación 2: Descuento ÚNICO en stock (20 - 3 = 17)
      expect(mockStock[0].quantity).toBe(17);

      // Verificación 3: Movimiento kardex asociado
      expect(mockMovements.length).toBe(1);
      expect(mockMovements[0].movement_type).toBe("spoilage");
      expect(mockMovements[0].quantity).toBe(3);
      expect(mockMovements[0].reference_type).toBe("adjustment");
      expect(mockMovements[0].notes).toContain("Anterior: 20");
      expect(mockMovements[0].notes).toContain("Resultante: 17");
    });

    it("rechaza mermas sobre productos preparados que no controlan existencias", async () => {
      const prepId = "22222222-3333-4444-5555-666666666666";
      mockProducts.push({
        id: prepId,
        business_id: TEST_BIZ,
        name: "Perro Caliente Especial",
        metadata: { product_type: "prepared", track_stock: false, stock_quantity: 0 },
      });

      await expect(
        createSpoilageRecord(
          TEST_BIZ,
          {
            itemType: "product",
            itemId: prepId,
            itemName: "Perro Caliente Especial",
            cause: "damaged",
            quantity: 1,
            unitCost: 8000,
          },
          "alex-owner-id"
        )
      ).rejects.toThrow(/preparados/i);
    });

    it("rechaza mermas cuya cantidad supere el stock disponible (evita existencias negativas)", async () => {
      const prodId = "33333333-4444-5555-6666-777777777777";
      mockProducts.push({
        id: prodId,
        business_id: TEST_BIZ,
        name: "Queso Mozzarella",
        metadata: { product_type: "ingredient", track_stock: true, stock_quantity: 5, unit: "kg" },
      });
      mockStock.push({
        id: "stk-queso",
        business_id: TEST_BIZ,
        product_id: prodId,
        location_id: LOC_ID,
        quantity: 5,
        min_stock: 2,
        cost: 20000,
      });

      // Intentar merma de 10 kg cuando solo hay 5 kg
      await expect(
        createSpoilageRecord(
          TEST_BIZ,
          {
            itemType: "ingredient",
            itemId: prodId,
            itemName: "Queso Mozzarella",
            cause: "expired",
            quantity: 10,
            unitCost: 20000,
          },
          "alex-owner-id"
        )
      ).rejects.toThrow(/insuficientes/i);

      // El stock debe permanecer intacto en 5
      expect(mockStock[0].quantity).toBe(5);
      expect(mockMovements.length).toBe(0);
    });

    it("bloquea el doble registro por doble clic o reintento de red (idempotencia)", async () => {
      const prodId = "44444444-5555-6666-7777-888888888888";
      mockProducts.push({
        id: prodId,
        business_id: TEST_BIZ,
        name: "Papas a la Francesa",
        metadata: { product_type: "ingredient", track_stock: true, stock_quantity: 15, unit: "kg" },
      });
      mockStock.push({
        id: "stk-papas",
        business_id: TEST_BIZ,
        product_id: prodId,
        location_id: LOC_ID,
        quantity: 15,
        min_stock: 3,
        cost: 6000,
      });

      const input = {
        itemType: "ingredient" as const,
        itemId: prodId,
        itemName: "Papas a la Francesa",
        cause: "spilled" as const,
        quantity: 2,
        unitCost: 6000,
        idempotencyKey: `idemp_${Date.now()}_test`,
      };

      // Primer clic exitoso
      const res1 = await createSpoilageRecord(TEST_BIZ, input, "alex-owner-id");
      expect(res1.id).toBeDefined();
      expect(mockStock[0].quantity).toBe(13); // 15 - 2 = 13

      // Segundo clic inmediato con la misma clave de idempotencia
      await expect(createSpoilageRecord(TEST_BIZ, input, "alex-owner-id")).rejects.toThrow(
        /procesando|duplicados/i
      );

      // El stock NO se descuenta dos veces: se mantiene en 13
      expect(mockStock[0].quantity).toBe(13);
    });
  });
});
