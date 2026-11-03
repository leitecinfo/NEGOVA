import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  computeRecipeCalculations,
  calculateRecipeAvailability,
  getProductRecipeAvailability,
  getProductsRecipeAvailabilityMap,
  enrichProductsWithRecipeAvailability,
} from "@/lib/recipes/recipe-service";
import { RecipeWithDetails } from "@/lib/recipes/types";

// ==============================================================================
// BASE DE DATOS EN MEMORIA MULTI-TENANT PARA RECETAS Y DISPONIBILIDAD
// ==============================================================================

const TEST_BIZ = "11111111-1111-4111-8111-111111111111";
const OTHER_BIZ = "22222222-2222-4222-8222-222222222222";

const PROD_PANQUEQUE = "33333333-3333-4333-8333-333333333333";
const PROD_WAFFLE = "44444444-4444-4444-8444-444444444444";
const PROD_CAFE = "55555555-5555-4555-8555-555555555555";

const ING_HARINA = "66666666-6666-4666-8666-666666666666";
const ING_HUEVOS = "77777777-7777-4777-8777-777777777777";
const ING_MIEL = "88888888-8888-4888-8888-888888888888"; // Opcional

let inMemoryProducts: any[] = [];
let inMemoryRecipes: any[] = [];
let inMemoryRecipeIngredients: any[] = [];
let inMemoryStock: any[] = [];

const mockSupabaseClient: any = {
  from: (table: string) => {
    if (table === "recipes") {
      return {
        select: (cols: string = "*") => {
          let list = inMemoryRecipes.map((r) => {
            const product = inMemoryProducts.find((p) => p.id === r.product_id);
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
            neq: (col: string, val: any) => {
              list = list.filter((p) => p[col] !== val);
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

    return {};
  },
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}));

describe("[REC-004] Calcular costo por porción y disponibilidad", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    inMemoryProducts = [
      {
        id: PROD_PANQUEQUE,
        business_id: TEST_BIZ,
        name: "Panqueques Clásicos",
        price: 15000,
        product_type: "product",
        is_available: true,
        metadata: { sku: "PAN-001" },
      },
      {
        id: PROD_WAFFLE,
        business_id: TEST_BIZ,
        name: "Waffle Belga",
        price: 18000,
        product_type: "product",
        is_available: true,
        metadata: { sku: "WAF-001" },
      },
      {
        id: PROD_CAFE,
        business_id: TEST_BIZ,
        name: "Café Americano",
        price: 5000,
        product_type: "product",
        is_available: true,
        metadata: { sku: "CAF-001" }, // Sin receta
      },
      // Ingredientes
      {
        id: ING_HARINA,
        business_id: TEST_BIZ,
        name: "Harina de Trigo",
        price: 0,
        product_type: "ingredient",
        metadata: { cost: 4000, unit: "kg" },
      },
      {
        id: ING_HUEVOS,
        business_id: TEST_BIZ,
        name: "Huevos",
        price: 0,
        product_type: "ingredient",
        metadata: { cost: 800, unit: "unidad" },
      },
      {
        id: ING_MIEL,
        business_id: TEST_BIZ,
        name: "Miel de Maple",
        price: 0,
        product_type: "ingredient",
        metadata: { cost: 1500, unit: "ml" },
      },
    ];

    inMemoryStock = [];
    inMemoryRecipes = [];
    inMemoryRecipeIngredients = [];
  });

  // --------------------------------------------------------------------------
  // Criterio de Aceptación 1: Cálculo exacto y truncado al entero
  // --------------------------------------------------------------------------
  describe("Criterio de Aceptación 1: Cálculo de porciones y truncado al entero", () => {
    it("con 2kg de harina (usa 0.5kg/porción) y 3 huevos (usa 2/porción), disponibilidad = 1.5 → 1 porción disponible", () => {
      // Receta rinde 1 porción
      const mockRecipe = {
        id: "rec-1",
        business_id: TEST_BIZ,
        portions: 1,
        product_price: 15000,
      };

      const rawIngredients = [
        {
          id: "ri-1",
          recipe_id: "rec-1",
          ingredient_id: ING_HARINA,
          quantity: 0.5, // 0.5 kg por porción
          unit: "kg",
          is_optional: false,
          sort_order: 1,
        },
        {
          id: "ri-2",
          recipe_id: "rec-1",
          ingredient_id: ING_HUEVOS,
          quantity: 2, // 2 huevos por porción
          unit: "unidad",
          is_optional: false,
          sort_order: 2,
        },
      ];

      const prodDataMap = new Map<string, any>([
        [ING_HARINA, { name: "Harina de Trigo", metadata: { unit: "kg", cost: 4000 } }],
        [ING_HUEVOS, { name: "Huevos", metadata: { unit: "unidad", cost: 800 } }],
      ]);

      // Stock disponible: 2kg harina y 3 huevos
      const stockMap = new Map<string, number>([
        [ING_HARINA, 2],
        [ING_HUEVOS, 3],
      ]);

      const costMap = new Map<string, number>([
        [ING_HARINA, 4000],
        [ING_HUEVOS, 800],
      ]);

      const calc = computeRecipeCalculations(
        mockRecipe,
        rawIngredients,
        prodDataMap,
        stockMap,
        costMap
      );

      // Verificación de porciones:
      // Harina: 2 / 0.5 = 4 porciones
      // Huevos: 3 / 2 = 1.5 porciones
      // Menor rendimiento: 1.5
      expect(calc.exactPortionsAvailable).toBe(1.5);
      // Truncado al entero según criterio de aceptación:
      expect(calc.portionsAvailable).toBe(1);

      // Costos: 0.5 * 4000 = 2000; 2 * 800 = 1600; Total = 3600
      expect(calc.totalCost).toBe(3600);
      expect(calc.costPerPortion).toBe(3600);
      // Margen: (15000 - 3600) / 15000 = 76%
      expect(calc.marginPercentage).toBe(76);
    });
  });

  // --------------------------------------------------------------------------
  // Criterio de Aceptación 2: Identificación del Cuello de Botella
  // --------------------------------------------------------------------------
  describe("Criterio de Aceptación 2: Identificación del ingrediente cuello de botella", () => {
    it("el cuello de botella se identifica como 'Huevos (alcanza para 1.5 porciones)'", () => {
      const mockRecipe = {
        id: "rec-1",
        business_id: TEST_BIZ,
        portions: 1,
        product_price: 15000,
      };

      const rawIngredients = [
        {
          id: "ri-1",
          recipe_id: "rec-1",
          ingredient_id: ING_HARINA,
          quantity: 0.5,
          unit: "kg",
          is_optional: false,
        },
        {
          id: "ri-2",
          recipe_id: "rec-1",
          ingredient_id: ING_HUEVOS,
          quantity: 2,
          unit: "unidad",
          is_optional: false,
        },
      ];

      const prodDataMap = new Map<string, any>([
        [ING_HARINA, { name: "Harina de Trigo", metadata: { unit: "kg", cost: 4000 } }],
        [ING_HUEVOS, { name: "Huevos", metadata: { unit: "unidad", cost: 800 } }],
      ]);

      const stockMap = new Map<string, number>([
        [ING_HARINA, 2],
        [ING_HUEVOS, 3],
      ]);

      const costMap = new Map<string, number>([
        [ING_HARINA, 4000],
        [ING_HUEVOS, 800],
      ]);

      const calc = computeRecipeCalculations(
        mockRecipe,
        rawIngredients,
        prodDataMap,
        stockMap,
        costMap
      );

      expect(calc.limitingIngredient).toBeDefined();
      expect(calc.limitingIngredient?.name).toBe("Huevos");
      expect(calc.limitingIngredient?.availablePortions).toBe(1.5);
      expect(calc.limitingIngredient?.displayText).toBe("Huevos (alcanza para 1.5 porciones)");
      expect(calc.limitingIngredient?.currentStock).toBe(3);
      expect(calc.limitingIngredient?.requiredPerPortion).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // Criterio de Aceptación 3: Stock restante proyectado
  // --------------------------------------------------------------------------
  describe("Criterio de Aceptación 3: Stock restante proyectado", () => {
    it("calcula el stock restante proyectado para cada ingrediente tras preparar 1 porción", () => {
      const mockRecipe: RecipeWithDetails = {
        id: "rec-1",
        businessId: TEST_BIZ,
        productId: PROD_PANQUEQUE,
        productName: "Panqueques Clásicos",
        productPrice: 15000,
        name: "Receta Panqueques",
        description: null,
        portions: 1,
        prepTimeMinutes: 10,
        locationId: null,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        totalCost: 3600,
        costPerPortion: 3600,
        marginPercentage: 76,
        portionsAvailable: 1,
        exactPortionsAvailable: 1.5,
        limitingIngredient: {
          ingredientId: ING_HUEVOS,
          name: "Huevos",
          currentStock: 3,
          requiredPerPortion: 2,
          unit: "unidad",
          availablePortions: 1.5,
          displayText: "Huevos (alcanza para 1.5 porciones)",
        },
        ingredients: [
          {
            id: "ri-1",
            recipeId: "rec-1",
            ingredientId: ING_HARINA,
            ingredientName: "Harina de Trigo",
            quantity: 0.5,
            unit: "kg",
            unitCost: 4000,
            subtotalCost: 2000,
            isOptional: false,
            sortOrder: 1,
            stockQuantity: 2,
            requiredPerPortion: 0.5,
            availablePortions: 4,
            projectedRemainingStock: 1.5, // 2 - (0.5 * 1) = 1.5
          },
          {
            id: "ri-2",
            recipeId: "rec-1",
            ingredientId: ING_HUEVOS,
            ingredientName: "Huevos",
            quantity: 2,
            unit: "unidad",
            unitCost: 800,
            subtotalCost: 1600,
            isOptional: false,
            sortOrder: 2,
            stockQuantity: 3,
            requiredPerPortion: 2,
            availablePortions: 1.5,
            projectedRemainingStock: 1, // 3 - (2 * 1) = 1
          },
        ],
      };

      const availability = calculateRecipeAvailability(mockRecipe);

      expect(availability.portionsAvailable).toBe(1);
      expect(availability.exactPortionsAvailable).toBe(1.5);
      expect(availability.isOutOfStock).toBe(false);

      const harina = availability.ingredients.find((i) => i.ingredientId === ING_HARINA);
      expect(harina).toBeDefined();
      expect(harina?.currentStock).toBe(2);
      expect(harina?.requiredPerPortion).toBe(0.5);
      expect(harina?.availablePortions).toBe(4);
      expect(harina?.projectedRemainingStock).toBe(1.5); // 2 - 0.5 = 1.5 kg
      expect(harina?.isLimiting).toBe(false);

      const huevos = availability.ingredients.find((i) => i.ingredientId === ING_HUEVOS);
      expect(huevos).toBeDefined();
      expect(huevos?.currentStock).toBe(3);
      expect(huevos?.requiredPerPortion).toBe(2);
      expect(huevos?.availablePortions).toBe(1.5);
      expect(huevos?.projectedRemainingStock).toBe(1); // 3 - 2 = 1 huevo
      expect(huevos?.isLimiting).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Criterio de Aceptación 4: Producto con cuello de botella en 0 aparece 'Agotado' en el POS
  // --------------------------------------------------------------------------
  describe("Criterio de Aceptación 4: Marcado automático como 'Agotado' cuando disponibilidad = 0", () => {
    it("un producto cuyo cuello de botella es 0 porciones aparece como 'Agotado' (is_available = false) en el catálogo y POS", async () => {
      // 1. Receta de Waffle en base de datos en memoria
      inMemoryRecipes = [
        {
          id: "rec-waffle-1",
          business_id: TEST_BIZ,
          product_id: PROD_WAFFLE,
          name: "Receta Waffle Belga",
          portions: 1,
          status: "active",
        },
      ];

      inMemoryRecipeIngredients = [
        {
          id: "ri-waf-1",
          recipe_id: "rec-waffle-1",
          ingredient_id: ING_HARINA,
          quantity: 0.3,
          unit: "kg",
          is_optional: false,
        },
        {
          id: "ri-waf-2",
          recipe_id: "rec-waffle-1",
          ingredient_id: ING_HUEVOS,
          quantity: 2,
          unit: "unidad",
          is_optional: false,
        },
      ];

      // Harina hay 5kg, pero Huevos tiene stock 0 (cuello de botella = 0)
      inMemoryStock = [
        { business_id: TEST_BIZ, product_id: ING_HARINA, quantity: 5 },
        { business_id: TEST_BIZ, product_id: ING_HUEVOS, quantity: 0 },
      ];

      const rawProducts = [
        {
          id: PROD_WAFFLE,
          name: "Waffle Belga",
          is_available: true, // Inicialmente estaba marcado disponible
          metadata: {},
        },
        {
          id: PROD_CAFE,
          name: "Café Americano",
          is_available: true, // Sin receta, debe mantenerse disponible
          metadata: {},
        },
      ];

      const enriched = await enrichProductsWithRecipeAvailability(TEST_BIZ, rawProducts);

      const waffleEnriched = enriched.find((p) => p.id === PROD_WAFFLE);
      expect(waffleEnriched).toBeDefined();
      // Verificación clave: marcado como agotado
      expect(waffleEnriched?.is_available).toBe(false);
      expect(waffleEnriched?.metadata?.has_recipe).toBe(true);
      expect(waffleEnriched?.metadata?.recipe_portions_available).toBe(0);
      expect(waffleEnriched?.metadata?.recipe_is_out_of_stock).toBe(true);
      expect(waffleEnriched?.metadata?.recipe_limiting_ingredient?.name).toBe("Huevos");

      // El café no tiene receta y conserva su disponibilidad
      const cafeEnriched = enriched.find((p) => p.id === PROD_CAFE);
      expect(cafeEnriched?.is_available).toBe(true);
      expect(cafeEnriched?.metadata?.has_recipe).toBeUndefined();
    });

    it("cuando los huevos se reabastecen a 10 unidades, el producto pasa a estar disponible en el POS", async () => {
      inMemoryRecipes = [
        {
          id: "rec-waffle-1",
          business_id: TEST_BIZ,
          product_id: PROD_WAFFLE,
          name: "Receta Waffle Belga",
          portions: 1,
          status: "active",
        },
      ];

      inMemoryRecipeIngredients = [
        {
          id: "ri-waf-1",
          recipe_id: "rec-waffle-1",
          ingredient_id: ING_HARINA,
          quantity: 0.3, // 5kg / 0.3kg = 16.66 porciones
          unit: "kg",
          is_optional: false,
        },
        {
          id: "ri-waf-2",
          recipe_id: "rec-waffle-1",
          ingredient_id: ING_HUEVOS,
          quantity: 2, // 10 / 2 = 5 porciones
          unit: "unidad",
          is_optional: false,
        },
      ];

      // Reabastecido: 5kg harina, 10 huevos
      inMemoryStock = [
        { business_id: TEST_BIZ, product_id: ING_HARINA, quantity: 5 },
        { business_id: TEST_BIZ, product_id: ING_HUEVOS, quantity: 10 },
      ];

      const rawProducts = [
        {
          id: PROD_WAFFLE,
          name: "Waffle Belga",
          is_available: true,
          metadata: {},
        },
      ];

      const enriched = await enrichProductsWithRecipeAvailability(TEST_BIZ, rawProducts);
      const waffle = enriched[0];

      expect(waffle.is_available).toBe(true);
      expect(waffle.metadata.recipe_portions_available).toBe(5);
      expect(waffle.metadata.recipe_limiting_ingredient.name).toBe("Huevos");
      expect(waffle.metadata.recipe_is_out_of_stock).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Criterio de Aceptación 5: Los ingredientes opcionales NO restringen disponibilidad
  // --------------------------------------------------------------------------
  describe("Criterio de Aceptación 5: Ingredientes opcionales no bloquean la receta", () => {
    it("si la miel opcional tiene stock 0, la receta sigue disponible basada en ingredientes obligatorios", () => {
      const mockRecipe = {
        id: "rec-pancakes-opt",
        business_id: TEST_BIZ,
        portions: 1,
        product_price: 15000,
      };

      const rawIngredients = [
        {
          id: "ri-1",
          recipe_id: "rec-pancakes-opt",
          ingredient_id: ING_HARINA,
          quantity: 0.5,
          unit: "kg",
          is_optional: false,
        },
        {
          id: "ri-2",
          recipe_id: "rec-pancakes-opt",
          ingredient_id: ING_HUEVOS,
          quantity: 2,
          unit: "unidad",
          is_optional: false,
        },
        {
          id: "ri-3",
          recipe_id: "rec-pancakes-opt",
          ingredient_id: ING_MIEL,
          quantity: 50,
          unit: "ml",
          is_optional: true, // Opcional
        },
      ];

      const prodDataMap = new Map<string, any>([
        [ING_HARINA, { name: "Harina de Trigo", metadata: { unit: "kg", cost: 4000 } }],
        [ING_HUEVOS, { name: "Huevos", metadata: { unit: "unidad", cost: 800 } }],
        [ING_MIEL, { name: "Miel de Maple", metadata: { unit: "ml", cost: 1500 } }],
      ]);

      // Miel tiene stock 0
      const stockMap = new Map<string, number>([
        [ING_HARINA, 2], // 4 porciones
        [ING_HUEVOS, 4], // 2 porciones
        [ING_MIEL, 0], // Stock 0
      ]);

      const costMap = new Map<string, number>([
        [ING_HARINA, 4000],
        [ING_HUEVOS, 800],
        [ING_MIEL, 1500],
      ]);

      const calc = computeRecipeCalculations(
        mockRecipe,
        rawIngredients,
        prodDataMap,
        stockMap,
        costMap
      );

      // La miel opcional con stock 0 NO limita la disponibilidad ni se selecciona como cuello de botella
      expect(calc.portionsAvailable).toBe(2);
      expect(calc.limitingIngredient?.name).toBe("Huevos");
      expect(calc.limitingIngredient?.availablePortions).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // Criterio de Aceptación 6: Receta con rendimiento de múltiples porciones
  // --------------------------------------------------------------------------
  describe("Criterio de Aceptación 6: Recetas que rinden N porciones en cabecera", () => {
    it("si la receta rinde 4 porciones y usa 1kg harina (0.25kg/porc), calcula el rendimiento individual", () => {
      const mockRecipe = {
        id: "rec-batch-4",
        business_id: TEST_BIZ,
        portions: 4, // Rinde 4 porciones
        product_price: 20000,
      };

      const rawIngredients = [
        {
          id: "ri-b1",
          recipe_id: "rec-batch-4",
          ingredient_id: ING_HARINA,
          quantity: 1, // 1kg para 4 porciones -> 0.25kg por porción
          unit: "kg",
          is_optional: false,
        },
        {
          id: "ri-b2",
          recipe_id: "rec-batch-4",
          ingredient_id: ING_HUEVOS,
          quantity: 4, // 4 huevos para 4 porciones -> 1 huevo por porción
          unit: "unidad",
          is_optional: false,
        },
      ];

      const prodDataMap = new Map<string, any>([
        [ING_HARINA, { name: "Harina de Trigo", metadata: { unit: "kg", cost: 4000 } }],
        [ING_HUEVOS, { name: "Huevos", metadata: { unit: "unidad", cost: 800 } }],
      ]);

      // Stock: 1.5kg de harina (1.5 / 0.25 = 6 porciones) y 5 huevos (5 / 1 = 5 porciones)
      const stockMap = new Map<string, number>([
        [ING_HARINA, 1.5],
        [ING_HUEVOS, 5],
      ]);

      const costMap = new Map<string, number>([
        [ING_HARINA, 4000],
        [ING_HUEVOS, 800],
      ]);

      const calc = computeRecipeCalculations(
        mockRecipe,
        rawIngredients,
        prodDataMap,
        stockMap,
        costMap
      );

      expect(calc.limitingIngredient?.name).toBe("Huevos");
      expect(calc.limitingIngredient?.availablePortions).toBe(5);
      expect(calc.portionsAvailable).toBe(5);
    });
  });

  // --------------------------------------------------------------------------
  // Criterio de Aceptación 7: Simulación de porciones personalizadas
  // --------------------------------------------------------------------------
  describe("Criterio de Aceptación 7: Simulación de stock proyectado para N porciones deseadas", () => {
    it("proyecta el stock restante cuando se simula preparar 2 porciones", () => {
      const mockRecipe: RecipeWithDetails = {
        id: "rec-sim",
        businessId: TEST_BIZ,
        productId: PROD_PANQUEQUE,
        productName: "Panqueques Clásicos",
        productPrice: 15000,
        name: "Receta Panqueques",
        description: null,
        portions: 1,
        prepTimeMinutes: 10,
        locationId: null,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        totalCost: 3600,
        costPerPortion: 3600,
        marginPercentage: 76,
        portionsAvailable: 1,
        limitingIngredient: null,
        ingredients: [
          {
            id: "ri-1",
            recipeId: "rec-sim",
            ingredientId: ING_HARINA,
            ingredientName: "Harina de Trigo",
            quantity: 0.5,
            unit: "kg",
            unitCost: 4000,
            subtotalCost: 2000,
            isOptional: false,
            sortOrder: 1,
            stockQuantity: 2,
            requiredPerPortion: 0.5,
          },
          {
            id: "ri-2",
            recipeId: "rec-sim",
            ingredientId: ING_HUEVOS,
            ingredientName: "Huevos",
            quantity: 2,
            unit: "unidad",
            unitCost: 800,
            subtotalCost: 1600,
            isOptional: false,
            sortOrder: 2,
            stockQuantity: 3,
            requiredPerPortion: 2,
          },
        ],
      };

      // Simular preparación de 1 porción:
      const sim1 = calculateRecipeAvailability(mockRecipe, 1);
      const h1 = sim1.ingredients.find((i) => i.ingredientId === ING_HARINA);
      const e1 = sim1.ingredients.find((i) => i.ingredientId === ING_HUEVOS);
      expect(h1?.projectedRemainingStock).toBe(1.5); // 2 - 0.5 = 1.5
      expect(e1?.projectedRemainingStock).toBe(1); // 3 - 2 = 1

      // Simular preparación de 2 porciones:
      const sim2 = calculateRecipeAvailability(mockRecipe, 2);
      const h2 = sim2.ingredients.find((i) => i.ingredientId === ING_HARINA);
      const e2 = sim2.ingredients.find((i) => i.ingredientId === ING_HUEVOS);
      expect(h2?.projectedRemainingStock).toBe(1); // 2 - (0.5 * 2) = 1
      expect(e2?.projectedRemainingStock).toBe(0); // 3 - (2 * 2) = -1 -> acotado a 0
    });
  });

  // --------------------------------------------------------------------------
  // Criterio de Aceptación 8: getProductRecipeAvailability para la Ficha de Producto
  // --------------------------------------------------------------------------
  describe("Criterio de Aceptación 8: Consulta de disponibilidad para la Ficha de Producto", () => {
    it("retorna el cálculo completo para la ficha del producto vinculado", async () => {
      inMemoryRecipes = [
        {
          id: "rec-panq-detail",
          business_id: TEST_BIZ,
          product_id: PROD_PANQUEQUE,
          name: "Receta Panqueques Especiales",
          portions: 1,
          status: "active",
        },
      ];

      inMemoryRecipeIngredients = [
        {
          id: "ri-1",
          recipe_id: "rec-panq-detail",
          ingredient_id: ING_HARINA,
          quantity: 0.5,
          unit: "kg",
          is_optional: false,
        },
        {
          id: "ri-2",
          recipe_id: "rec-panq-detail",
          ingredient_id: ING_HUEVOS,
          quantity: 2,
          unit: "unidad",
          is_optional: false,
        },
      ];

      inMemoryStock = [
        { business_id: TEST_BIZ, product_id: ING_HARINA, quantity: 2 },
        { business_id: TEST_BIZ, product_id: ING_HUEVOS, quantity: 3 },
      ];

      const result = await getProductRecipeAvailability(TEST_BIZ, PROD_PANQUEQUE);

      expect(result).toBeDefined();
      expect(result?.productId).toBe(PROD_PANQUEQUE);
      expect(result?.portionsAvailable).toBe(1);
      expect(result?.exactPortionsAvailable).toBe(1.5);
      expect(result?.isOutOfStock).toBe(false);
      expect(result?.limitingIngredient?.name).toBe("Huevos");
      expect(result?.limitingIngredient?.displayText).toBe("Huevos (alcanza para 1.5 porciones)");
      expect(result?.ingredients).toHaveLength(2);
    });

    it("retorna null si el producto no tiene receta activa", async () => {
      const result = await getProductRecipeAvailability(TEST_BIZ, PROD_CAFE);
      expect(result).toBeNull();
    });
  });
});
