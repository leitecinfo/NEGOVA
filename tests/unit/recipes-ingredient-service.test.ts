import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createIngredient,
  getIngredients,
  getIngredientKPIs,
  updateIngredient,
  archiveIngredient,
} from "@/lib/recipes/recipe-service";
import {
  isProductAvailableInPos,
  isProductAvailableInQr,
  isProductAvailableOnline,
} from "@/lib/products/types";

// Simulación de tablas en memoria
let inMemoryProducts: any[] = [];
let inMemoryCategories: any[] = [];
let inMemoryLocations: any[] = [];
let inMemoryStock: any[] = [];
let inMemoryMovements: any[] = [];

const TEST_BUSINESS_ID = "b1111111-1111-4111-8111-111111111111";
const OTHER_BUSINESS_ID = "b2222222-2222-4222-8222-222222222222";

const LOC_1 = "11111111-1111-4111-8111-111111111111"; // Bodega Central
const CAT_1 = "22222222-2222-4222-8222-222222222222"; // Insumos e Ingredientes

const mockSupabaseClient: any = {
  from: (table: string) => {
    if (table === "categories") {
      return {
        select: (cols: string = "*") => {
          let list = [...inMemoryCategories];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            ilike: (col: string, pattern: string) => {
              const clean = pattern.replace(/%/g, "").toLowerCase();
              list = list.filter((r) => String(r[col]).toLowerCase().includes(clean));
              return chain;
            },
            limit: (n: number) => {
              list = list.slice(0, n);
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
        insert: (payload: any) => {
          const row = {
            id: payload.id || crypto.randomUUID(),
            ...payload,
            created_at: new Date().toISOString(),
          };
          inMemoryCategories.push(row);
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
        select: (cols: string = "*") => {
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
            id: payload.id || crypto.randomUUID(),
            ...payload,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          inMemoryProducts.push(row);
          return {
            select: () => ({
              single: async () => ({ data: row, error: null }),
            }),
          };
        },
        update: (payload: any) => ({
          eq: (col1: string, val1: any) => ({
            eq: (col2: string, val2: any) => {
              const idx = inMemoryProducts.findIndex(
                (p) => p[col1] === val1 && p[col2] === val2
              );
              let updatedRow: any = null;
              if (idx !== -1) {
                inMemoryProducts[idx] = {
                  ...inMemoryProducts[idx],
                  ...payload,
                  metadata: {
                    ...(inMemoryProducts[idx].metadata || {}),
                    ...(payload.metadata || {}),
                  },
                };
                updatedRow = inMemoryProducts[idx];
              }
              return {
                data: updatedRow,
                error: updatedRow ? null : { message: "Product not found" },
                select: () => ({
                  single: async () => ({ data: updatedRow, error: null }),
                }),
                then: (resolve: any, reject?: any) =>
                  Promise.resolve({ data: updatedRow, error: null }).then(resolve, reject),
              };
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
            in: (col: string, vals: any[]) => {
              list = list.filter((r) => vals.includes(r[col]));
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
            then: (resolve: any, reject?: any) => {
              const enriched = list.map((s) => {
                const loc = inMemoryLocations.find((l) => l.id === s.location_id);
                return {
                  ...s,
                  locations: loc ? { name: loc.name } : null,
                };
              });
              return Promise.resolve({ data: enriched, error: null }).then(resolve, reject);
            },
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
              id: crypto.randomUUID(),
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
        update: (payload: any) => ({
          eq: (col1: string, val1: any) => ({
            eq: async (col2: string, val2: any) => {
              const matches = inMemoryStock.filter(
                (s) => s[col1] === val1 && s[col2] === val2
              );
              matches.forEach((m) => {
                Object.assign(m, payload);
              });
              return { error: null };
            },
          }),
        }),
      };
    }

    if (table === "inventory_movements") {
      return {
        insert: (payload: any) => {
          const row = {
            id: crypto.randomUUID(),
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

    if (table === "locations") {
      return {
        select: (cols: string = "*") => {
          let list = [...inMemoryLocations];
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
      };
    }

    if (table === "notifications") {
      return {
        insert: (payload: any) => ({
          select: () => ({
            single: async () => ({ data: payload, error: null }),
          }),
          then: (resolve: any) => resolve({ data: payload, error: null }),
        }),
      };
    }

    return {};
  },
};

// Mock de Supabase Client & Server
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}));

// Mock de ensureDefaultLocation
vi.mock("@/lib/inventory/inventory-service", async () => {
  const actual = await vi.importActual<any>("@/lib/inventory/inventory-service");
  return {
    ...actual,
    ensureDefaultLocation: vi.fn(async (bId: string) => ({
      id: LOC_1,
      businessId: bId,
      name: "Bodega Central",
      type: "warehouse",
    })),
  };
});

describe("[REC-001] Modelo y Servicio de Ingredientes", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    inMemoryLocations = [
      {
        id: LOC_1,
        business_id: TEST_BUSINESS_ID,
        name: "Bodega Central",
        type: "warehouse",
      },
    ];

    inMemoryCategories = [
      {
        id: CAT_1,
        business_id: TEST_BUSINESS_ID,
        name: "Insumos e Ingredientes",
        status: "active",
      },
    ];

    inMemoryProducts = [];
    inMemoryStock = [];
    inMemoryMovements = [];
  });

  // ----------------------------------------------------------------------------
  // 1. Creación de Ingrediente con Stock Inicial y Kardex
  // ----------------------------------------------------------------------------
  it("permite crear un ingrediente con nombre, unidad, costo y stock inicial registrando kardex", async () => {
    const ingredient = await createIngredient(
      TEST_BUSINESS_ID,
      {
        name: "Queso Mozzarella Bloque",
        unit: "kg",
        costPerUnit: 24000,
        initialStock: 15,
        minStock: 5,
        maxStock: 50,
        locationId: LOC_1,
        notes: "Presentación bloque 2.5kg",
      },
      "user-admin"
    );

    expect(ingredient).toBeDefined();
    expect(ingredient.name).toBe("Queso Mozzarella Bloque");
    expect(ingredient.unit).toBe("kg");
    expect(ingredient.costPerUnit).toBe(24000);
    expect(ingredient.stockQuantity).toBe(15);
    expect(ingredient.minStock).toBe(5);
    expect(ingredient.maxStock).toBe(50);
    expect(ingredient.businessId).toBe(TEST_BUSINESS_ID);

    // Verificar en tabla products: product_type === 'ingredient' y precio = 0
    const rawProd = inMemoryProducts.find((p) => p.id === ingredient.id);
    expect(rawProd).toBeDefined();
    expect(rawProd.price).toBe(0);
    expect(rawProd.metadata.product_type).toBe("ingredient");
    expect(rawProd.metadata.unit).toBe("kg");

    // Verificar en inventory_stock
    const stockRow = inMemoryStock.find((s) => s.product_id === ingredient.id);
    expect(stockRow).toBeDefined();
    expect(stockRow.quantity).toBe(15);
    expect(stockRow.cost).toBe(24000);

    // Verificar movimiento de Kardex generado
    expect(inMemoryMovements.length).toBe(1);
    const mov = inMemoryMovements[0];
    expect(mov.product_id).toBe(ingredient.id);
    expect(mov.movement_type).toBe("entry");
    expect(mov.quantity).toBe(15);
    expect(mov.unit_cost).toBe(24000);
  });

  // ----------------------------------------------------------------------------
  // 2. Comportamiento con Stock Inicial Cero
  // ----------------------------------------------------------------------------
  it("crea un ingrediente con stock inicial cero sin registrar movimiento de entrada erróneo", async () => {
    const ingredient = await createIngredient(TEST_BUSINESS_ID, {
      name: "Levadura Seca",
      unit: "g",
      costPerUnit: 45,
      initialStock: 0,
      minStock: 500,
      locationId: LOC_1,
    });

    expect(ingredient.stockQuantity).toBe(0);

    // La fila de existencias se crea en 0
    const stockRow = inMemoryStock.find((s) => s.product_id === ingredient.id);
    expect(stockRow?.quantity).toBe(0);

    // No debe haber movimientos de entrada generados
    expect(inMemoryMovements.length).toBe(0);
  });

  // ----------------------------------------------------------------------------
  // 3. Regla de Canales: Oculto por defecto en POS y Menú QR
  // ----------------------------------------------------------------------------
  it("el ingrediente no aparece en el menú QR ni POS salvo configuración expresa", async () => {
    // Ingrediente estándar por defecto
    const ingNormal = await createIngredient(TEST_BUSINESS_ID, {
      name: "Salsa de Tomate Base",
      unit: "lt",
      costPerUnit: 12000,
      initialStock: 10,
      locationId: LOC_1,
    });

    // Validar helper de canales: por defecto false
    const rawProd = inMemoryProducts.find((p) => p.id === ingNormal.id);
    expect(isProductAvailableInPos(rawProd)).toBe(false);
    expect(isProductAvailableInQr(rawProd)).toBe(false);
    expect(isProductAvailableOnline(rawProd)).toBe(false);

    // Ingrediente con configuración expresa (por ejemplo, vendido como adición en POS)
    const ingExpreso = await createIngredient(TEST_BUSINESS_ID, {
      name: "Queso Parmesano Extra",
      unit: "g",
      costPerUnit: 80,
      initialStock: 1000,
      availableInPos: true,
      availableInQr: false,
    });

    const rawExpreso = inMemoryProducts.find((p) => p.id === ingExpreso.id);
    expect(isProductAvailableInPos(rawExpreso)).toBe(true);
    expect(isProductAvailableInQr(rawExpreso)).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // 4. Listado con Filtros por Estado de Stock y Unidad
  // ----------------------------------------------------------------------------
  it("permite filtrar ingredientes por texto, unidad y estado de stock", async () => {
    // 1. Harina: 50 kg (min 10) -> in_stock
    await createIngredient(TEST_BUSINESS_ID, {
      name: "Harina de Trigo",
      unit: "kg",
      costPerUnit: 3500,
      initialStock: 50,
      minStock: 10,
    });

    // 2. Mantequilla: 2 kg (min 5) -> low_stock
    await createIngredient(TEST_BUSINESS_ID, {
      name: "Mantequilla sin sal",
      unit: "kg",
      costPerUnit: 22000,
      initialStock: 2,
      minStock: 5,
    });

    // 3. Vainilla: 0 ml (min 100) -> out_of_stock
    await createIngredient(TEST_BUSINESS_ID, {
      name: "Extracto de Vainilla",
      unit: "ml",
      costPerUnit: 150,
      initialStock: 0,
      minStock: 100,
    });

    // Producto regular que NO es ingrediente (no debe aparecer)
    inMemoryProducts.push({
      id: crypto.randomUUID(),
      business_id: TEST_BUSINESS_ID,
      name: "Pizza Pepperoni Grande",
      price: 35000,
      metadata: { product_type: "product" },
      status: "active",
    });

    // Consultar todos los ingredientes
    const all = await getIngredients(TEST_BUSINESS_ID);
    expect(all.length).toBe(3);
    expect(all.some((i) => i.name === "Pizza Pepperoni Grande")).toBe(false);

    // Filtrar por stock bajo
    const lowStock = await getIngredients(TEST_BUSINESS_ID, { stockStatus: "low_stock" });
    expect(lowStock.length).toBe(1);
    expect(lowStock[0].name).toBe("Mantequilla sin sal");

    // Filtrar por agotados
    const outOfStock = await getIngredients(TEST_BUSINESS_ID, { stockStatus: "out_of_stock" });
    expect(outOfStock.length).toBe(1);
    expect(outOfStock[0].name).toBe("Extracto de Vainilla");

    // Filtrar por unidad 'kg'
    const kgList = await getIngredients(TEST_BUSINESS_ID, { unit: "kg" });
    expect(kgList.length).toBe(2);

    // Búsqueda por texto
    const searchRes = await getIngredients(TEST_BUSINESS_ID, { search: "vainilla" });
    expect(searchRes.length).toBe(1);
    expect(searchRes[0].name).toBe("Extracto de Vainilla");
  });

  // ----------------------------------------------------------------------------
  // 5. KPIs de Ingredientes
  // ----------------------------------------------------------------------------
  it("calcula los KPIs: total ingredientes, stock bajo, agotados y valoración al costo", async () => {
    // 10 kg a $5.000 = $50.000 (Óptimo)
    await createIngredient(TEST_BUSINESS_ID, {
      name: "Azúcar Blanca",
      unit: "kg",
      costPerUnit: 5000,
      initialStock: 10,
      minStock: 2,
    });

    // 2 kg a $20.000 = $40.000 (Bajo, min 5)
    await createIngredient(TEST_BUSINESS_ID, {
      name: "Cacao en Polvo",
      unit: "kg",
      costPerUnit: 20000,
      initialStock: 2,
      minStock: 5,
    });

    // 0 lt a $8.000 = $0 (Agotado)
    await createIngredient(TEST_BUSINESS_ID, {
      name: "Aceite de Oliva",
      unit: "lt",
      costPerUnit: 8000,
      initialStock: 0,
      minStock: 5,
    });

    const kpis = await getIngredientKPIs(TEST_BUSINESS_ID);
    expect(kpis.totalIngredients).toBe(3);
    expect(kpis.lowStockCount).toBe(1);
    expect(kpis.outOfStockCount).toBe(1);
    // Valoración total = $50.000 + $40.000 = $90.000
    expect(kpis.totalCostValuation).toBe(90000);
  });

  // ----------------------------------------------------------------------------
  // 6. Actualización y Archivo de Ingrediente
  // ----------------------------------------------------------------------------
  it("permite actualizar datos y costo de un ingrediente y archivarlo", async () => {
    const created = await createIngredient(TEST_BUSINESS_ID, {
      name: "Orégano Molido",
      unit: "g",
      costPerUnit: 30,
      initialStock: 100,
      minStock: 20,
    });

    // Actualizar costo y nombre
    const updated = await updateIngredient(TEST_BUSINESS_ID, created.id, {
      name: "Orégano Molido Premium",
      costPerUnit: 40,
      minStock: 25,
    });

    expect(updated.name).toBe("Orégano Molido Premium");
    expect(updated.costPerUnit).toBe(40);
    expect(updated.minStock).toBe(25);

    // Archivar
    await archiveIngredient(TEST_BUSINESS_ID, created.id);

    const list = await getIngredients(TEST_BUSINESS_ID);
    expect(list.some((i) => i.id === created.id)).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // 7. Aislamiento Multi-Tenant
  // ----------------------------------------------------------------------------
  it("los ingredientes de un negocio no son visibles por otro negocio", async () => {
    await createIngredient(TEST_BUSINESS_ID, {
      name: "Ingrediente Negocio 1",
      unit: "kg",
      costPerUnit: 1000,
    });

    const otherList = await getIngredients(OTHER_BUSINESS_ID);
    expect(otherList.length).toBe(0);

    const myIngredients = await getIngredients(TEST_BUSINESS_ID);
    expect(myIngredients.length).toBe(1);
  });
});
