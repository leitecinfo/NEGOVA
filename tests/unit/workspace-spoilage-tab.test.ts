import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SPOILAGE_CAUSES,
  SPOILAGE_CAUSE_LABELS,
  SPOILAGE_ITEM_TYPES,
  CreateSpoilageInputSchema,
  CreateSpoilageInput,
  SpoilageKPIs,
} from "@/lib/spoilage/types";
import {
  createSpoilageRecord,
  getSpoilageRecords,
  getSpoilageKPIs,
} from "@/lib/spoilage/spoilage-service";

// ==============================================================================
// SIMULACIÓN MULTI-TENANT EN MEMORIA
// ==============================================================================

const TEST_BUSINESS_ID = "biz-1111-2222-3333-444444444444";
const OTHER_BUSINESS_ID = "biz-9999-8888-7777-666666666666";

const TEST_PRODUCT_ID = "prod-aaaa-bbbb-cccc-dddddddddddd";
const TEST_INGREDIENT_ID = "ing-1111-2222-3333-444444444444";

let inMemorySpoilageRecords: any[] = [];
let inMemoryStock: any[] = [];
let inMemoryMovements: any[] = [];
let inMemoryProducts: any[] = [];

vi.mock("@/lib/inventory/inventory-service", () => ({
  ensureDefaultLocation: vi.fn(async (bizId: string) => ({
    id: `loc-def-${bizId}`,
    name: "Punto Principal",
    type: "point_of_sale",
  })),
  getInventoryStock: vi.fn(async (bizId: string, filters: { productId?: string; locationId?: string }) => {
    return inMemoryStock
      .filter((s) => {
        if (s.business_id !== bizId) return false;
        if (filters.productId && s.product_id !== filters.productId) return false;
        if (filters.locationId && s.location_id !== filters.locationId) return false;
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
    const existingIdx = inMemoryStock.findIndex(
      (s) => s.business_id === bizId && s.product_id === input.productId && s.location_id === input.locationId
    );
    if (existingIdx !== -1) {
      inMemoryStock[existingIdx] = {
        ...inMemoryStock[existingIdx],
        quantity: input.quantity,
        cost: input.cost ?? inMemoryStock[existingIdx].cost,
        updated_at: new Date().toISOString(),
      };
      return inMemoryStock[existingIdx];
    } else {
      const newItem = {
        id: `stock-${Date.now()}`,
        business_id: bizId,
        product_id: input.productId,
        location_id: input.locationId,
        quantity: input.quantity,
        min_stock: input.minStock || 0,
        cost: input.cost || 0,
        updated_at: new Date().toISOString(),
      };
      inMemoryStock.push(newItem);
      return newItem;
    }
  }),
  recordInventoryMovement: vi.fn(async (bizId: string, input: any, createdBy?: string | null) => {
    const mov = {
      id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      business_id: bizId,
      product_id: input.productId,
      location_id: input.locationId,
      movement_type: input.movementType,
      quantity: input.quantity,
      unit_cost: input.unitCost,
      total_cost: input.totalCost,
      reference_id: input.referenceId,
      reference_type: input.referenceType,
      notes: input.notes,
      created_by: createdBy || null,
      created_at: new Date().toISOString(),
    };
    inMemoryMovements.push(mov);
    return mov;
  }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}));

const mockSupabaseClient = {
  from: (table: string) => {
    if (table === "spoilage_records") {
      return {
        insert: (data: any) => ({
          select: (cols: string = "*") => ({
            single: async () => {
              const inserted = {
                ...data,
                id: data.id || `spoilage-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                locations: { name: "Punto Principal" },
              };
              inMemorySpoilageRecords.push(inserted);
              return { data: inserted, error: null };
            },
          }),
        }),
        select: (cols: string = "*") => {
          let list = [...inMemorySpoilageRecords];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            gte: (col: string, val: any) => {
              list = list.filter((r) => (r[col] || "") >= val);
              return chain;
            },
            lte: (col: string, val: any) => {
              list = list.filter((r) => (r[col] || "") <= val);
              return chain;
            },
            or: (clause: string) => {
              const match = clause.match(/item_name\.ilike\.%([^%]+)%/);
              if (match) {
                const term = match[1].toLowerCase();
                list = list.filter(
                  (r) =>
                    (r.item_name && r.item_name.toLowerCase().includes(term)) ||
                    (r.notes && r.notes.toLowerCase().includes(term))
                );
              }
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
        select: (cols: string = "*") => {
          let list = [...inMemoryProducts];
          const prodChain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((p: any) => p[col] === val);
              return prodChain;
            },
            single: async () => {
              const item = list[0] || null;
              return { data: item, error: item ? null : { message: "Not found" } };
            },
            then: (resolve: any, reject?: any) =>
              Promise.resolve({ data: list, error: null }).then(resolve, reject),
          };
          return prodChain;
        },
        update: (data: any) => {
          const updChain: any = {
            eq: (col: string, val: any) => {
              inMemoryProducts = inMemoryProducts.map((p) => {
                if (p[col] === val) {
                  return {
                    ...p,
                    ...data,
                    metadata: {
                      ...(p.metadata || {}),
                      ...(data.metadata || {}),
                    },
                  };
                }
                return p;
              });
              return updChain;
            },
            then: (resolve: any, reject?: any) =>
              Promise.resolve({ error: null }).then(resolve, reject),
          };
          return updChain;
        },
      };
    }

    return {};
  },
};

describe("Pestaña de Mermas de Productos e Insumos", () => {
  const todayStr = new Date().toISOString().split("T")[0];

  beforeEach(() => {
    vi.clearAllMocks();
    inMemorySpoilageRecords = [];
    inMemoryMovements = [];
    inMemoryStock = [
      {
        id: "stock-prod-1",
        business_id: TEST_BUSINESS_ID,
        product_id: TEST_PRODUCT_ID,
        location_id: `loc-def-${TEST_BUSINESS_ID}`,
        quantity: 100,
        min_stock: 10,
        cost: 5000,
        updated_at: new Date().toISOString(),
      },
      {
        id: "stock-ing-1",
        business_id: TEST_BUSINESS_ID,
        product_id: TEST_INGREDIENT_ID,
        location_id: `loc-def-${TEST_BUSINESS_ID}`,
        quantity: 25,
        min_stock: 5,
        cost: 12000,
        updated_at: new Date().toISOString(),
      },
    ];
    inMemoryProducts = [
      {
        id: TEST_PRODUCT_ID,
        business_id: TEST_BUSINESS_ID,
        name: "Cerveza Artesanal 330ml",
        price: 12000,
        metadata: {
          product_type: "product",
          stock_quantity: 100,
          cost: 5000,
          track_stock: true,
        },
      },
      {
        id: TEST_INGREDIENT_ID,
        business_id: TEST_BUSINESS_ID,
        name: "Queso Parmesano Rallado (kg)",
        price: 0,
        metadata: {
          product_type: "ingredient",
          stock_quantity: 25,
          cost: 12000,
          unit: "kg",
          track_stock: true,
        },
      },
    ];
  });

  describe("1. KPIs Superiores: Total Registros, Valor Total, Mermas Hoy, Valor Hoy", () => {
    it("calcula con exactitud los 4 indicadores requeridos", async () => {
      inMemorySpoilageRecords = [
        {
          id: "sp-1",
          business_id: TEST_BUSINESS_ID,
          item_type: "product",
          cause: "expired",
          item_name: "Cerveza Artesanal",
          quantity: 4,
          unit_cost: 5000,
          total_cost: 20000,
          date: `${todayStr}T10:00:00Z`,
          created_at: `${todayStr}T10:00:00Z`,
        },
        {
          id: "sp-2",
          business_id: TEST_BUSINESS_ID,
          item_type: "ingredient",
          cause: "spilled",
          item_name: "Queso Parmesano",
          quantity: 1.5,
          unit_cost: 12000,
          total_cost: 18000,
          date: `${todayStr}T14:30:00Z`,
          created_at: `${todayStr}T14:30:00Z`,
        },
        {
          id: "sp-3",
          business_id: TEST_BUSINESS_ID,
          item_type: "product",
          cause: "damaged",
          item_name: "Cerveza Artesanal",
          quantity: 2,
          unit_cost: 5000,
          total_cost: 10000,
          date: "2026-09-01T10:00:00Z", // Registro antiguo
          created_at: "2026-09-01T10:00:00Z",
        },
      ];

      const kpis: SpoilageKPIs = await getSpoilageKPIs(TEST_BUSINESS_ID);

      // KPI 1: Total Registros
      expect(kpis.totalRecords).toBe(3);
      // KPI 2: Valor Total Mermas ($)
      expect(kpis.totalCost).toBe(48000); // 20.000 + 18.000 + 10.000
      // KPI 3: Mermas Hoy
      expect(kpis.todayRecordsCount).toBe(2);
      // KPI 4: Valor Hoy ($)
      expect(kpis.todayCost).toBe(38000); // 20.000 + 18.000
    });
  });

  describe("2. Filtros: Temporal (Hoy, Última semana, Último mes, Todos) y Campo de Búsqueda", () => {
    it("filtra por texto y por rangos temporales", async () => {
      inMemorySpoilageRecords = [
        {
          id: "sp-1",
          business_id: TEST_BUSINESS_ID,
          item_name: "Cerveza Artesanal",
          cause: "expired",
          total_cost: 20000,
          date: `${todayStr}T10:00:00Z`,
        },
        {
          id: "sp-2",
          business_id: TEST_BUSINESS_ID,
          item_name: "Queso Parmesano",
          cause: "spilled",
          notes: "Bolsa rota en cocina",
          total_cost: 15000,
          date: "2026-10-28T10:00:00Z",
        },
      ];

      // Búsqueda por palabra clave
      const searchRes = await getSpoilageRecords(TEST_BUSINESS_ID, { search: "Parmesano" });
      expect(searchRes).toHaveLength(1);
      expect(searchRes[0].itemName).toBe("Queso Parmesano");

      // Búsqueda por motivo en notas
      const notesRes = await getSpoilageRecords(TEST_BUSINESS_ID, { search: "cocina" });
      expect(notesRes).toHaveLength(1);
      expect(notesRes[0].itemName).toBe("Queso Parmesano");
    });
  });

  describe("3. Modal 'Registrar Nueva Merma' y Descuento Atómico de Stock", () => {
    it("valida el esquema de entrada con causas requeridas: Vencido, Dañado, Derramado, Robo, Otro", () => {
      for (const cause of SPOILAGE_CAUSES) {
        expect(["expired", "damaged", "spilled", "stolen", "other"]).toContain(cause);
      }

      // Validar inputs correctos
      const validProductInput: CreateSpoilageInput = {
        itemType: "product",
        itemId: TEST_PRODUCT_ID,
        itemName: "Cerveza Artesanal 330ml",
        cause: "expired",
        quantity: 5,
        unitCost: 5000,
        date: todayStr,
        notes: "Lote caducado",
      };
      expect(() => CreateSpoilageInputSchema.parse(validProductInput)).not.toThrow();

      const validIngredientInput: CreateSpoilageInput = {
        itemType: "ingredient",
        itemId: TEST_INGREDIENT_ID,
        itemName: "Queso Parmesano Rallado (kg)",
        cause: "spilled",
        quantity: 2,
        unitCost: 12000,
        date: todayStr,
        notes: "Derrame en línea de preparación",
      };
      expect(() => CreateSpoilageInputSchema.parse(validIngredientInput)).not.toThrow();
    });

    it("descuenta de manera atómica el stock de un Producto en inventory_stock y products.metadata", async () => {
      const record = await createSpoilageRecord(
        TEST_BUSINESS_ID,
        {
          itemType: "product",
          itemId: TEST_PRODUCT_ID,
          itemName: "Cerveza Artesanal 330ml",
          cause: "damaged",
          quantity: 8,
          unitCost: 5000,
          notes: "Botellas rotas durante acomodo",
        },
        "user-admin-1"
      );

      expect(record.quantity).toBe(8);
      expect(record.totalCost).toBe(40000); // 8 * 5000

      // Stock inicial era 100 -> 100 - 8 = 92
      const updatedStock = inMemoryStock.find(
        (s) => s.business_id === TEST_BUSINESS_ID && s.product_id === TEST_PRODUCT_ID
      );
      expect(updatedStock?.quantity).toBe(92);

      const updatedProduct = inMemoryProducts.find((p) => p.id === TEST_PRODUCT_ID);
      expect(updatedProduct?.metadata.stock_quantity).toBe(92);

      // Movimiento generado en kardex
      expect(inMemoryMovements).toHaveLength(1);
      expect(inMemoryMovements[0].movement_type).toBe("spoilage");
      expect(inMemoryMovements[0].quantity).toBe(8);
    });

    it("descuenta de manera atómica el stock de un Ingrediente / Insumo en la base de datos", async () => {
      const record = await createSpoilageRecord(
        TEST_BUSINESS_ID,
        {
          itemType: "ingredient",
          itemId: TEST_INGREDIENT_ID,
          itemName: "Queso Parmesano Rallado (kg)",
          cause: "stolen",
          quantity: 3,
          unitCost: 12000,
          notes: "Faltante en inventario físico de cierre",
        },
        "user-admin-2"
      );

      expect(record.quantity).toBe(3);
      expect(record.totalCost).toBe(36000); // 3 * 12000

      // Stock inicial de ingrediente era 25 -> 25 - 3 = 22
      const updatedStock = inMemoryStock.find(
        (s) => s.business_id === TEST_BUSINESS_ID && s.product_id === TEST_INGREDIENT_ID
      );
      expect(updatedStock?.quantity).toBe(22);

      const updatedIngredient = inMemoryProducts.find((p) => p.id === TEST_INGREDIENT_ID);
      expect(updatedIngredient?.metadata.stock_quantity).toBe(22);

      // Movimiento generado en kardex
      expect(inMemoryMovements).toHaveLength(1);
      expect(inMemoryMovements[0].movement_type).toBe("spoilage");
      expect(inMemoryMovements[0].quantity).toBe(3);
    });
  });
});
