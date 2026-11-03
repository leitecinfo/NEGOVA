import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createRecipe,
  getRecipes,
  getRecipeById,
  getRecipeByProductId,
  updateRecipe,
  deleteRecipe,
  computeRecipeCalculations,
} from "@/lib/recipes/recipe-service";
import { CreateRecipeInput } from "@/lib/recipes/types";

// Simulación de tablas en memoria
let inMemoryProducts: any[] = [];
let inMemoryLocations: any[] = [];
let inMemoryStock: any[] = [];
let inMemoryRecipes: any[] = [];
let inMemoryRecipeIngredients: any[] = [];

const BIZ_A = "11111111-1111-4111-8111-111111111111";
const BIZ_B = "22222222-2222-4222-8222-222222222222";

const LOC_A1 = "33333333-3333-4333-8333-333333333333";
const PROD_BURGER = "44444444-4444-4444-8444-444444444444";
const PROD_PIZZA = "55555555-5555-4555-8555-555555555555";

// Ingredientes
const ING_MEAT = "66666666-6666-4666-8666-666666666666";
const ING_BUN = "77777777-7777-4777-8777-777777777777";
const ING_SAUCE = "88888888-8888-4888-8888-888888888888";

const mockSupabaseClient: any = {
  from: (table: string) => {
    if (table === "recipes") {
      return {
        select: (cols: string = "*") => {
          let list = inMemoryRecipes.map((r) => {
            const product = inMemoryProducts.find((p) => p.id === r.product_id);
            const location = inMemoryLocations.find((l) => l.id === r.location_id);
            return {
              ...r,
              products: product
                ? {
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    metadata: product.metadata,
                  }
                : null,
              locations: location ? { id: location.id, name: location.name } : null,
            };
          });

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
              error: list[0] ? null : { message: "Receta no encontrada" },
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
          inMemoryRecipes.push(row);
          return {
            select: () => ({
              single: async () => ({ data: row, error: null }),
            }),
            then: (resolve: any) => resolve({ data: row, error: null }),
          };
        },
        update: (payload: any) => ({
          eq: (col1: string, val1: any) => ({
            eq: async (col2: string, val2: any) => {
              const match = inMemoryRecipes.find(
                (r) => r[col1] === val1 && r[col2] === val2
              );
              if (match) {
                Object.assign(match, payload);
              }
              return { data: match, error: null };
            },
          }),
        }),
        delete: () => ({
          eq: (col1: string, val1: any) => ({
            eq: async (col2: string, val2: any) => {
              const idx = inMemoryRecipes.findIndex(
                (r) => r[col1] === val1 && r[col2] === val2
              );
              if (idx >= 0) {
                inMemoryRecipes.splice(idx, 1);
              }
              return { error: null };
            },
          }),
        }),
      };
    }

    if (table === "recipe_ingredients") {
      return {
        select: (cols: string = "*") => {
          let list = [...inMemoryRecipeIngredients];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((ri) => ri[col] === val);
              return chain;
            },
            in: (col: string, vals: any[]) => {
              list = list.filter((ri) => vals.includes(ri[col]));
              return chain;
            },
            order: () => chain,
            then: (resolve: any, reject?: any) =>
              Promise.resolve({ data: list, error: null }).then(resolve, reject),
          };
          return chain;
        },
        insert: (payload: any) => {
          const rows = Array.isArray(payload) ? payload : [payload];
          const created = rows.map((r) => {
            const item = {
              id: r.id || crypto.randomUUID(),
              ...r,
              created_at: new Date().toISOString(),
            };
            inMemoryRecipeIngredients.push(item);
            return item;
          });
          return {
            select: () => ({
              then: (resolve: any) => resolve({ data: created, error: null }),
            }),
            then: (resolve: any) => resolve({ data: created, error: null }),
          };
        },
        delete: () => ({
          eq: async (col: string, val: any) => {
            inMemoryRecipeIngredients = inMemoryRecipeIngredients.filter(
              (ri) => ri[col] !== val
            );
            return { error: null };
          },
        }),
      };
    }

    if (table === "products") {
      return {
        select: (cols: string = "*") => {
          let list = [...inMemoryProducts];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((p) => p[col] === val);
              return chain;
            },
            in: (col: string, vals: any[]) => {
              list = list.filter((p) => vals.includes(p[col]));
              return chain;
            },
            maybeSingle: async () => ({
              data: list[0] || null,
              error: null,
            }),
            single: async () => ({
              data: list[0] || null,
              error: list[0] ? null : { message: "Producto no encontrado" },
            }),
            then: (resolve: any, reject?: any) =>
              Promise.resolve({ data: list, error: null }).then(resolve, reject),
          };
          return chain;
        },
      };
    }

    if (table === "inventory_stock") {
      return {
        select: (cols: string = "*") => {
          let list = [...inMemoryStock];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((s) => s[col] === val);
              return chain;
            },
            in: (col: string, vals: any[]) => {
              list = list.filter((s) => vals.includes(s[col]));
              return chain;
            },
            then: (resolve: any, reject?: any) =>
              Promise.resolve({ data: list, error: null }).then(resolve, reject),
          };
          return chain;
        },
      };
    }

    if (table === "locations") {
      return {
        select: (cols: string = "*") => {
          let list = [...inMemoryLocations];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((l) => l[col] === val);
              return chain;
            },
            then: (resolve: any) => resolve({ data: list, error: null }),
          };
          return chain;
        },
      };
    }

    return {};
  },
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}));

describe("[REC-002] Recetas vinculadas a productos y escandallo", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    inMemoryLocations = [
      {
        id: LOC_A1,
        business_id: BIZ_A,
        name: "Cocina Principal",
        type: "point_of_sale",
      },
    ];

    // Productos de carta (platos a la venta)
    inMemoryProducts = [
      {
        id: PROD_BURGER,
        business_id: BIZ_A,
        name: "Hamburguesa Doble Especial",
        price: 25000,
        product_type: "product",
        metadata: { sku: "HMB-001" },
      },
      {
        id: PROD_PIZZA,
        business_id: BIZ_A,
        name: "Pizza Artesanal Personal",
        price: 18000,
        product_type: "product",
        metadata: { sku: "PIZ-001" },
      },
      // Ingredientes (con product_type = 'ingredient')
      {
        id: ING_MEAT,
        business_id: BIZ_A,
        name: "Carne Molida Premium (g)",
        price: 0,
        product_type: "ingredient",
        metadata: { cost: 20, unit: "g" }, // $20 por gramo
      },
      {
        id: ING_BUN,
        business_id: BIZ_A,
        name: "Pan Brioche Artesanal",
        price: 0,
        product_type: "ingredient",
        metadata: { cost: 2500, unit: "unidad" }, // $2500 por pan
      },
      {
        id: ING_SAUCE,
        business_id: BIZ_A,
        name: "Salsa Secreta de la Casa",
        price: 0,
        product_type: "ingredient",
        metadata: { cost: 500, unit: "ml" }, // $500 por ml
      },
    ];

    // Stock de ingredientes:
    // Carne: 1000g disponible a $20/g
    // Pan: 6 unidades disponibles a $2500/un
    // Salsa: 0ml disponible (pero es opcional)
    inMemoryStock = [
      {
        id: crypto.randomUUID(),
        business_id: BIZ_A,
        product_id: ING_MEAT,
        location_id: LOC_A1,
        quantity: 1000,
        cost: 20,
      },
      {
        id: crypto.randomUUID(),
        business_id: BIZ_A,
        product_id: ING_BUN,
        location_id: LOC_A1,
        quantity: 6,
        cost: 2500,
      },
      {
        id: crypto.randomUUID(),
        business_id: BIZ_A,
        product_id: ING_SAUCE,
        location_id: LOC_A1,
        quantity: 0,
        cost: 500,
      },
    ];

    inMemoryRecipes = [];
    inMemoryRecipeIngredients = [];
  });

  it("calcula correctamente el costo por porción excluyendo ingredientes opcionales y evalúa ¿Cuánto me alcanza?", () => {
    // Escenario de prueba puro:
    // Receta para 2 porciones:
    // - Carne: 200g (costo: 200 * $20 = $4000)
    // - Pan: 2 unidades (costo: 2 * $2500 = $5000)
    // - Salsa: 30ml (costo: 30 * $500 = $15000, pero is_optional: true)
    // Costo Base Total = $4000 + $5000 = $9000 (salsa excluida del costo base)
    // Costo por Porción = $9000 / 2 = $4500
    //
    // Disponibilidad:
    // Carne en stock: 1000g / 200g = 5 preparaciones
    // Pan en stock: 6 un / 2 un = 3 preparaciones (cuello de botella)
    // Salsa en stock: 0ml (pero como es opcional, no bloquea)
    // Porciones Disponibles = min(5, 3) * 2 porciones = 6 porciones

    const mockRecipe = {
      portions: 2,
      product_price: 25000,
    };

    const rawIngredients = [
      { id: "ri-1", ingredient_id: ING_MEAT, quantity: 200, unit: "g", is_optional: false, sort_order: 1 },
      { id: "ri-2", ingredient_id: ING_BUN, quantity: 2, unit: "unidad", is_optional: false, sort_order: 2 },
      { id: "ri-3", ingredient_id: ING_SAUCE, quantity: 30, unit: "ml", is_optional: true, sort_order: 3 },
    ];

    const prodDataMap = new Map<string, any>([
      [ING_MEAT, { name: "Carne Molida", metadata: { cost: 20, unit: "g" } }],
      [ING_BUN, { name: "Pan Brioche", metadata: { cost: 2500, unit: "unidad" } }],
      [ING_SAUCE, { name: "Salsa Secreta", metadata: { cost: 500, unit: "ml" } }],
    ]);

    const stockMap = new Map<string, number>([
      [ING_MEAT, 1000],
      [ING_BUN, 6],
      [ING_SAUCE, 0], // Stock 0 de salsa
    ]);

    const costMap = new Map<string, number>([
      [ING_MEAT, 20],
      [ING_BUN, 2500],
      [ING_SAUCE, 500],
    ]);

    const calc = computeRecipeCalculations(mockRecipe, rawIngredients, prodDataMap, stockMap, costMap);

    // Verificaciones:
    expect(calc.totalCost).toBe(9000);
    expect(calc.costPerPortion).toBe(4500); // 9000 / 2
    expect(calc.marginPercentage).toBe(82); // (25000 - 4500) / 25000 = 82%
    expect(calc.portionsAvailable).toBe(6); // 3 batches * 2 portions
    expect(calc.limitingIngredient?.name).toBe("Pan Brioche");
    expect(calc.limitingIngredient?.availablePortions).toBe(6);
  });

  it("permite crear una receta vinculada a un producto con 3 ingredientes y 2 porciones", async () => {
    const input: CreateRecipeInput = {
      productId: PROD_BURGER,
      name: "Receta Hamburguesa Doble",
      portions: 2,
      prepTimeMinutes: 15,
      locationId: LOC_A1,
      ingredients: [
        {
          ingredientId: ING_MEAT,
          quantity: 200,
          unit: "g",
          isOptional: false,
        },
        {
          ingredientId: ING_BUN,
          quantity: 2,
          unit: "unidad",
          isOptional: false,
        },
        {
          ingredientId: ING_SAUCE,
          quantity: 30,
          unit: "ml",
          isOptional: true,
        },
      ],
    };

    const created = await createRecipe(BIZ_A, input);

    expect(created).toBeDefined();
    expect(created.productId).toBe(PROD_BURGER);
    expect(created.productName).toBe("Hamburguesa Doble Especial");
    expect(created.portions).toBe(2);
    expect(created.ingredients.length).toBe(3);
    expect(created.totalCost).toBe(9000);
    expect(created.costPerPortion).toBe(4500);
    expect(created.portionsAvailable).toBe(6);
    expect(created.status).toBe("active");
  });

  it("rechaza la creación de una segunda receta activa para el mismo producto (unicidad)", async () => {
    const input1: CreateRecipeInput = {
      productId: PROD_BURGER,
      name: "Receta Original",
      portions: 1,
      ingredients: [
        {
          ingredientId: ING_BUN,
          quantity: 1,
          unit: "unidad",
        },
      ],
    };

    await createRecipe(BIZ_A, input1);

    // Intento de crear una segunda receta activa para PROD_BURGER
    const input2: CreateRecipeInput = {
      productId: PROD_BURGER,
      name: "Receta Duplicada",
      portions: 1,
      ingredients: [
        {
          ingredientId: ING_MEAT,
          quantity: 150,
          unit: "g",
        },
      ],
    };

    await expect(createRecipe(BIZ_A, input2)).rejects.toThrow(
      /ya cuenta con una receta activa vinculada/
    );
  });

  it("consulta la receta activa de un producto con getRecipeByProductId", async () => {
    const input: CreateRecipeInput = {
      productId: PROD_PIZZA,
      name: "Ficha Técnica Pizza",
      portions: 1,
      ingredients: [
        {
          ingredientId: ING_MEAT,
          quantity: 100,
          unit: "g",
        },
      ],
    };

    await createRecipe(BIZ_A, input);

    const recipe = await getRecipeByProductId(BIZ_A, PROD_PIZZA);
    expect(recipe).toBeDefined();
    expect(recipe?.productId).toBe(PROD_PIZZA);
    expect(recipe?.name).toBe("Ficha Técnica Pizza");
    expect(recipe?.costPerPortion).toBe(2000); // 100g * $20
  });

  it("garantiza aislamiento multi-tenant: Negocio B no ve ni edita recetas del Negocio A", async () => {
    const input: CreateRecipeInput = {
      productId: PROD_BURGER,
      name: "Hamburguesa Negocio A",
      portions: 1,
      ingredients: [
        {
          ingredientId: ING_BUN,
          quantity: 1,
          unit: "unidad",
        },
      ],
    };

    const created = await createRecipe(BIZ_A, input);

    // Negocio B consulta recetas
    const recipesB = await getRecipes(BIZ_B);
    expect(recipesB.length).toBe(0);

    // Negocio B intenta obtener por ID
    const recipeB = await getRecipeById(BIZ_B, created.id);
    expect(recipeB).toBeNull();

    // Negocio B intenta editar
    await expect(
      updateRecipe(BIZ_B, created.id, { name: "Hackeada" })
    ).rejects.toThrow(/Receta no encontrada/);
  });

  it("actualiza una receta modificando porciones e ingredientes", async () => {
    const input: CreateRecipeInput = {
      productId: PROD_BURGER,
      name: "Hamburguesa Base",
      portions: 1,
      ingredients: [
        {
          ingredientId: ING_BUN,
          quantity: 1,
          unit: "unidad",
        },
      ],
    };

    const created = await createRecipe(BIZ_A, input);
    expect(created.costPerPortion).toBe(2500);

    // Actualizar: ahora rinde 2 porciones y lleva 2 panes
    const updated = await updateRecipe(BIZ_A, created.id, {
      portions: 2,
      ingredients: [
        {
          ingredientId: ING_BUN,
          quantity: 2,
          unit: "unidad",
        },
      ],
    });

    expect(updated.portions).toBe(2);
    expect(updated.totalCost).toBe(5000); // 2 * $2500
    expect(updated.costPerPortion).toBe(2500); // 5000 / 2
  });

  it("elimina una receta de producto correctamente", async () => {
    const input: CreateRecipeInput = {
      productId: PROD_BURGER,
      name: "Hamburguesa a Eliminar",
      portions: 1,
      ingredients: [
        {
          ingredientId: ING_BUN,
          quantity: 1,
          unit: "unidad",
        },
      ],
    };

    const created = await createRecipe(BIZ_A, input);
    expect(inMemoryRecipes.length).toBe(1);

    await deleteRecipe(BIZ_A, created.id);
    expect(inMemoryRecipes.length).toBe(0);

    const check = await getRecipeById(BIZ_A, created.id);
    expect(check).toBeNull();
  });
});

