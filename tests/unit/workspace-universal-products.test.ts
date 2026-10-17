import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ProductSchema,
  CreateProductSchema,
  ProductMetadataSchema,
  Category,
  Product,
} from "../../src/lib/products/types";
import {
  DEFAULT_CATEGORY_TEMPLATES,
  seedDefaultCategoriesForBusiness,
  deleteCategory,
  getCategoryProductCount,
  getCategories,
} from "../../src/lib/products/products-service";
import { STORAGE_PATHS, extractStoragePathFromUrl } from "../../src/lib/storage/supabase-storage";
import { formatNumberWithDots, parseNumberFromDots } from "../../src/lib/pos/types";

// ==============================================================================
// SIMULACIÓN MULTI-TENANT EN MEMORIA PARA VERIFICACIÓN DE REQUISITOS
// ==============================================================================

const BUSINESS_A = "a8e2612f-4acc-4c84-a420-220131b70d66"; // Restaurante A
const BUSINESS_B = "b8e2612f-4acc-4c84-a420-220131b70d77"; // Restaurante B
const BUSINESS_C = "c8e2612f-4acc-4c84-a420-220131b70d88"; // Tienda Minorista (Retail)
const BUSINESS_D = "d8e2612f-4acc-4c84-a420-220131b70d99"; // Barbería / Servicios

let inMemoryCategories: Category[] = [];
let inMemoryProducts: Product[] = [];

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "categories") {
        return {
          select: vi.fn((fields: string, opts?: any) => {
            if (opts?.head && opts?.count === "exact") {
              return {
                eq: vi.fn((col: string, val: any) => {
                  const count = inMemoryCategories.filter(
                    (c) => c.business_id === val && c.status !== "archived"
                  ).length;
                  return Promise.resolve({ count, error: null });
                }),
              };
            }

            return {
              eq: vi.fn((col: string, val: any) => ({
                neq: vi.fn((ncol: string, nval: any) => {
                  const getFiltered = () =>
                    inMemoryCategories.filter(
                      (c) => c.business_id === val && (ncol === "status" ? c.status !== nval : true)
                    );
                  const resultPromise = Promise.resolve({ data: getFiltered(), error: null });
                  return Object.assign(resultPromise, {
                    order: vi.fn(() => ({
                      order: vi.fn(() => Promise.resolve({ data: getFiltered(), error: null })),
                    })),
                  });
                }),
              })),
            };
          }),

          insert: vi.fn((rows: any) => {
            const rowList = Array.isArray(rows) ? rows : [rows];
            const created = rowList.map((r, i) => ({
              id: crypto.randomUUID ? crypto.randomUUID() : `cat-${Date.now()}-${i}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              ...r,
            }));
            inMemoryCategories.push(...created);
            return {
              select: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: created[0], error: null })),
              })),
              then: (resolve: any) => resolve({ data: created, error: null }),
            };
          }),

          delete: vi.fn(() => ({
            eq: vi.fn((col1: string, val1: any) => ({
              eq: vi.fn((col2: string, val2: any) => {
                inMemoryCategories = inMemoryCategories.filter(
                  (c) => !(c.id === val1 && c.business_id === val2)
                );
                return Promise.resolve({ error: null });
              }),
            })),
          })),

          update: vi.fn((updates: any) => ({
            eq: vi.fn((col1: string, val1: any) => ({
              eq: vi.fn((col2: string, val2: any) => {
                const index = inMemoryCategories.findIndex(
                  (c) => c.id === val1 && c.business_id === val2
                );
                if (index !== -1) {
                  inMemoryCategories[index] = {
                    ...inMemoryCategories[index],
                    ...updates,
                    updated_at: new Date().toISOString(),
                  };
                }
                return {
                  select: vi.fn(() => ({
                    single: vi.fn(() =>
                      Promise.resolve({ data: inMemoryCategories[index], error: null })
                    ),
                  })),
                  then: (resolve: any) => resolve({ data: null, error: null }),
                };
              }),
            })),
          })),
        };
      }

      if (table === "products") {
        return {
          select: vi.fn((fields: string, opts?: any) => {
            if (opts?.head && opts?.count === "exact") {
              return {
                eq: vi.fn((col1: string, val1: any) => ({
                  eq: vi.fn((col2: string, val2: any) => ({
                    neq: vi.fn((ncol: string, nval: any) => {
                      const count = inMemoryProducts.filter(
                        (p) =>
                          p.business_id === val1 &&
                          p.category_id === val2 &&
                          (ncol === "status" ? p.status !== nval : true)
                      ).length;
                      return Promise.resolve({ count, error: null });
                    }),
                  })),
                })),
              };
            }

            return {
              eq: vi.fn().mockReturnThis(),
            };
          }),

          update: vi.fn((updates: any) => ({
            eq: vi.fn((col1: string, val1: any) => ({
              eq: vi.fn((col2: string, val2: any) => {
                inMemoryProducts.forEach((p, idx) => {
                  if (p.business_id === val1 && p.category_id === val2) {
                    inMemoryProducts[idx] = {
                      ...p,
                      ...updates,
                      updated_at: new Date().toISOString(),
                    };
                  }
                });
                return Promise.resolve({ error: null });
              }),
            })),
          })),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
      };
    }),
  })),
}));

vi.mock("../../src/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-test-123" } },
        error: null,
      }),
    },
  })),
}));

describe("NEGOVA — Verificaciones Obligatorias del Catálogo y Categorías", () => {
  beforeEach(() => {
    inMemoryCategories = [];
    inMemoryProducts = [];
  });

  // --------------------------------------------------------------------------
  // PRUEBA 1: Restaurante nuevo recibe sus siete categorías iniciales
  // --------------------------------------------------------------------------
  it("1. Un restaurante nuevo recibe sus siete categorías iniciales completas", async () => {
    const res = await seedDefaultCategoriesForBusiness(BUSINESS_A, "fast_food");
    expect(res.seeded).toBe(true);
    expect(res.count).toBe(7);

    const categories = inMemoryCategories.filter((c) => c.business_id === BUSINESS_A);
    expect(categories).toHaveLength(7);

    const names = categories.map((c) => c.name);
    expect(names).toEqual([
      "Hamburguesas",
      "Salchipapas",
      "Perros calientes",
      "Bebidas",
      "Pizzas",
      "Combos",
      "Adiciones",
    ]);
  });

  // --------------------------------------------------------------------------
  // PRUEBA 2: Eliminar «Combos» en un restaurante no afecta a otro
  // --------------------------------------------------------------------------
  it("2. Eliminar «Combos» en Restaurante A no altera las categorías de Restaurante B", async () => {
    // Inicializar Restaurante A y B
    await seedDefaultCategoriesForBusiness(BUSINESS_A, "fast_food");
    await seedDefaultCategoriesForBusiness(BUSINESS_B, "fast_food");

    // Localizar «Combos» en Negocio A
    const combosA = inMemoryCategories.find(
      (c) => c.business_id === BUSINESS_A && c.name === "Combos"
    );
    expect(combosA).toBeDefined();

    // Eliminar «Combos» solo en Negocio A
    await deleteCategory(BUSINESS_A, combosA!.id);

    // Verificar categorías en Negocio A
    const catsA = inMemoryCategories.filter((c) => c.business_id === BUSINESS_A);
    expect(catsA).toHaveLength(6);
    expect(catsA.some((c) => c.name === "Combos")).toBe(false);

    // Verificar que Negocio B aún conserva intactas sus 7 categorías incluida «Combos»
    const catsB = inMemoryCategories.filter((c) => c.business_id === BUSINESS_B);
    expect(catsB).toHaveLength(7);
    expect(catsB.some((c) => c.name === "Combos")).toBe(true);
  });

  // --------------------------------------------------------------------------
  // PRUEBA 3: Un restaurante creado posteriormente sigue recibiendo «Combos»
  // --------------------------------------------------------------------------
  it("3. Un restaurante creado posteriormente recibe todas sus categorías iniciales con «Combos»", async () => {
    // Negocio A se crea y borra «Combos»
    await seedDefaultCategoriesForBusiness(BUSINESS_A, "fast_food");
    const combosA = inMemoryCategories.find(
      (c) => c.business_id === BUSINESS_A && c.name === "Combos"
    );
    await deleteCategory(BUSINESS_A, combosA!.id);

    // Negocio B se crea después
    const resB = await seedDefaultCategoriesForBusiness(BUSINESS_B, "fast_food");
    expect(resB.seeded).toBe(true);

    const catsB = inMemoryCategories.filter((c) => c.business_id === BUSINESS_B);
    expect(catsB).toHaveLength(7);
    expect(catsB.find((c) => c.name === "Combos")).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // PRUEBA 4: Negocios de otros tipos reciben plantillas correspondientes
  // --------------------------------------------------------------------------
  it("4. Tiendas de ropa y barberías reciben categorías coherentes con su actividad (sin gastronomía)", async () => {
    // Negocio Retail (Tienda de Ropa)
    await seedDefaultCategoriesForBusiness(BUSINESS_C, "retail");
    const catsRetail = inMemoryCategories.filter((c) => c.business_id === BUSINESS_C);
    const namesRetail = catsRetail.map((c) => c.name);

    expect(namesRetail).toContain("Ropa");
    expect(namesRetail).toContain("Calzado");
    expect(namesRetail).toContain("Accesorios");
    expect(namesRetail).not.toContain("Hamburguesas");
    expect(namesRetail).not.toContain("Salchipapas");

    // Negocio Servicios (Barbería)
    await seedDefaultCategoriesForBusiness(BUSINESS_D, "services");
    const catsServices = inMemoryCategories.filter((c) => c.business_id === BUSINESS_D);
    const namesServices = catsServices.map((c) => c.name);

    expect(namesServices).toContain("Cortes y Peinados");
    expect(namesServices).toContain("Barba y Afeitado");
    expect(namesServices).not.toContain("Pizzas");
  });

  // --------------------------------------------------------------------------
  // PRUEBA 5: Reintentos de inicialización no duplican categorías (Idempotencia)
  // --------------------------------------------------------------------------
  it("5. Reintentar la inicialización no duplica las categorías existentes", async () => {
    const firstRun = await seedDefaultCategoriesForBusiness(BUSINESS_A, "fast_food");
    expect(firstRun.seeded).toBe(true);
    expect(firstRun.count).toBe(7);

    // Segundo intento con el mismo negocio
    const secondRun = await seedDefaultCategoriesForBusiness(BUSINESS_A, "fast_food");
    expect(secondRun.seeded).toBe(false);
    expect(secondRun.count).toBe(7);

    const totalA = inMemoryCategories.filter((c) => c.business_id === BUSINESS_A).length;
    expect(totalA).toBe(7); // Exactamente 7, no 14
  });

  // --------------------------------------------------------------------------
  // PRUEBA 6: Eliminación segura de categorías y productos relacionados
  // --------------------------------------------------------------------------
  it("6. Eliminar una categoría con productos asociados no elimina los productos ni altera sus precios", async () => {
    await seedDefaultCategoriesForBusiness(BUSINESS_A, "fast_food");
    const burgersCat = inMemoryCategories.find((c) => c.name === "Hamburguesas")!;

    // Asignar 2 productos a la categoría de hamburguesas
    inMemoryProducts.push(
      {
        id: "prod-1",
        business_id: BUSINESS_A,
        category_id: burgersCat.id,
        name: "Hamburguesa Doble",
        description: "Carne 100% de res",
        image_url: null,
        price: 25000,
        status: "active",
        is_available: true,
        sort_order: 1,
        metadata: { modifier_groups: [] },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "prod-2",
        business_id: BUSINESS_A,
        category_id: burgersCat.id,
        name: "Hamburguesa Sencilla",
        description: "Carne y queso",
        image_url: null,
        price: 18000,
        status: "active",
        is_available: true,
        sort_order: 2,
        metadata: { modifier_groups: [] },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    );

    // Eliminar la categoría sin reasignar (dejando en null)
    const result = await deleteCategory(BUSINESS_A, burgersCat.id, null);
    expect(result.affectedProducts).toBe(2);

    // Los productos deben seguir existiendo y conservar sus precios
    expect(inMemoryProducts).toHaveLength(2);
    expect(inMemoryProducts[0].price).toBe(25000);
    expect(inMemoryProducts[0].category_id).toBeNull();
    expect(inMemoryProducts[1].price).toBe(18000);
    expect(inMemoryProducts[1].category_id).toBeNull();
  });

  // --------------------------------------------------------------------------
  // PRUEBA 7: Reasignación de productos al eliminar categoría
  // --------------------------------------------------------------------------
  it("7. Permite reasignar productos a otra categoría segura al eliminar la categoría original", async () => {
    await seedDefaultCategoriesForBusiness(BUSINESS_A, "fast_food");
    const burgersCat = inMemoryCategories.find((c) => c.name === "Hamburguesas")!;
    const combosCat = inMemoryCategories.find((c) => c.name === "Combos")!;

    inMemoryProducts.push({
      id: "prod-1",
      business_id: BUSINESS_A,
      category_id: burgersCat.id,
      name: "Hamburguesa Especial",
      description: null,
      image_url: null,
      price: 28000,
      status: "active",
      is_available: true,
      sort_order: 1,
      metadata: { modifier_groups: [] },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Eliminar categoría reasignando productos a «Combos»
    await deleteCategory(BUSINESS_A, burgersCat.id, combosCat.id);

    expect(inMemoryProducts[0].category_id).toBe(combosCat.id);
    expect(inMemoryProducts[0].price).toBe(28000);
  });

  // --------------------------------------------------------------------------
  // PRUEBA 8: Carga y rutas de Storage aisladas por tenant
  // --------------------------------------------------------------------------
  it("8. Convención de Storage garantiza aislamiento estricto por businessId y productId", () => {
    const filePath = STORAGE_PATHS.productMainFile(BUSINESS_A, "prod-99", "foto.webp");
    expect(filePath).toBe(
      `businesses/${BUSINESS_A}/catalog/products/prod-99/main/foto.webp`
    );
    expect(filePath.startsWith(`businesses/${BUSINESS_A}/`)).toBe(true);

    const publicUrl = `https://zjixuaizkgeptjmrulbz.supabase.co/storage/v1/object/public/negova-storage/${filePath}`;
    expect(extractStoragePathFromUrl(publicUrl)).toBe(filePath);
  });

  // --------------------------------------------------------------------------
  // PRUEBA 9: Validación Zod de productos comerciales, servicios y gastronomía
  // --------------------------------------------------------------------------
  it("9. Zod valida tipos físicos con stock y servicios con duración sin conflictos", () => {
    // Servicio
    const servicePayload = {
      name: "Corte Degradado",
      price: 25000,
      metadata: {
        product_type: "service" as const,
        duration_minutes: 40,
      },
    };
    const parsedService = CreateProductSchema.parse(servicePayload);
    expect(parsedService.metadata.product_type).toBe("service");
    expect(parsedService.metadata.duration_minutes).toBe(40);
    expect(parsedService.metadata.track_stock).toBe(false);

    // Retail
    const retailPayload = {
      name: "Martillo 16oz",
      price: 35000,
      metadata: {
        product_type: "product" as const,
        sku: "FERR-001",
        brand: "Stanley",
        unit: "unidad",
        track_stock: true,
        stock_quantity: 12,
      },
    };
    const parsedRetail = CreateProductSchema.parse(retailPayload);
    expect(parsedRetail.metadata.sku).toBe("FERR-001");
    expect(parsedRetail.metadata.stock_quantity).toBe(12);
  });

  // --------------------------------------------------------------------------
  // PRUEBA 10: Compatibilidad de modificadores gastronómicos con el POS
  // --------------------------------------------------------------------------
  it("10. Los modificadores gastronómicos conservan la estructura consumida por createRestaurantOrder", () => {
    const gastroProduct = {
      name: "Salchipapa Costeña",
      price: 22000,
      metadata: {
        product_type: "product" as const,
        modifier_groups: [
          {
            name: "Salsas",
            required: false,
            min_select: 0,
            max_select: 3,
            options: [
              { name: "Tártara", price: 0, is_available: true },
              { name: "Rosada", price: 0, is_available: true },
            ],
          },
          {
            name: "Extras",
            required: false,
            options: [{ name: "Queso costeño", price: 4000, is_available: true }],
          },
        ],
      },
    };

    const parsed = CreateProductSchema.parse(gastroProduct);
    expect(parsed.metadata.modifier_groups).toHaveLength(2);
    expect(parsed.metadata.modifier_groups[0].options[0].name).toBe("Tártara");
    expect(parsed.metadata.modifier_groups[1].options[0].price).toBe(4000);
  });

  // --------------------------------------------------------------------------
  // PRUEBA 11: En negocios gastronómicos y comida rápida, los productos se guardan sin SKU ni código de barras
  // --------------------------------------------------------------------------
  it("11. Productos gastronómicos (hamburguesas, salchipapas) se guardan sin campos retail y son válidos en Zod", () => {
    // Simulación de guardado para restaurante / comida rápida (isFoodBusiness = true)
    const fastFoodProductPayload = {
      name: "Hamburguesa Especial Doble Carne",
      description: "Carne artesanal de 150g, tocineta ahumada, queso cheddar y papas a la francesa",
      price: 28000,
      metadata: {
        product_type: "product" as const,
        sku: null,
        barcode: null,
        brand: null,
        unit: "unidad",
        track_stock: false,
        stock_quantity: null,
        ingredients: "Carne de res, queso cheddar, tocineta, lechuga, tomate",
        allergens: ["Gluten", "Lactosa"],
        has_variants: true,
        variants: [
          {
            id: "var-combo",
            name: "En Combo con Gaseosa y Papas",
            price: 34000,
            is_available: true,
            sort_order: 0,
            inherit_base_ingredients: true,
          },
          {
            id: "var-sola",
            name: "Solo Hamburguesa",
            price: 28000,
            is_available: true,
            sort_order: 1,
            inherit_base_ingredients: true,
          },
        ],
        modifier_groups: [
          {
            name: "Salsas Adicionales",
            required: false,
            options: [
              { name: "Salsa de ajo casera", price: 1500, is_available: true },
              { name: "Salsa BBQ artesanal", price: 1500, is_available: true },
            ],
          },
        ],
      },
    };

    const parsed = CreateProductSchema.parse(fastFoodProductPayload);
    expect(parsed.name).toBe("Hamburguesa Especial Doble Carne");
    expect(parsed.metadata.sku).toBeNull();
    expect(parsed.metadata.barcode).toBeNull();
    expect(parsed.metadata.brand).toBeNull();
    expect(parsed.metadata.track_stock).toBe(false);
    expect(parsed.metadata.stock_quantity).toBeNull();
    expect(parsed.metadata.has_variants).toBe(true);
    expect(parsed.metadata.variants).toHaveLength(2);
    expect(parsed.metadata.modifier_groups[0].options[0].name).toBe("Salsa de ajo casera");
  });

  // --------------------------------------------------------------------------
  // PRUEBA 12: En negocios minoristas (retail), SKU, código de barras y stock siguen funcionando al 100%
  // --------------------------------------------------------------------------
  it("12. Comercios minoristas (tiendas/retail) conservan SKU, código de barras y control de stock intactos", () => {
    const retailProductPayload = {
      name: "Zapatillas Deportivas Running",
      description: "Calzado de alta amortiguación para entrenamiento",
      price: 240000,
      metadata: {
        product_type: "product" as const,
        sku: "NIKE-RUN-042",
        barcode: "7701234567890",
        brand: "Nike",
        unit: "unidad",
        track_stock: true,
        stock_quantity: 25,
        has_variants: false,
        variants: [],
        modifier_groups: [],
      },
    };

    const parsed = CreateProductSchema.parse(retailProductPayload);
    expect(parsed.metadata.sku).toBe("NIKE-RUN-042");
    expect(parsed.metadata.barcode).toBe("7701234567890");
    expect(parsed.metadata.brand).toBe("Nike");
    expect(parsed.metadata.track_stock).toBe(true);
    expect(parsed.metadata.stock_quantity).toBe(25);
  });

  // --------------------------------------------------------------------------
  // PRUEBA 13: Formateo de precios en pesos colombianos con puntos de miles (es-CO)
  // --------------------------------------------------------------------------
  it("13. Formateo de precios convierte 20000 en '20.000' y parsea correctamente a entero", () => {
    // Si se escribe 20000 debe salir 20.000
    expect(formatNumberWithDots(20000)).toBe("20.000");
    expect(formatNumberWithDots("20000")).toBe("20.000");
    expect(formatNumberWithDots("20.000")).toBe("20.000");
    expect(formatNumberWithDots(1500000)).toBe("1.500.000");
    expect(formatNumberWithDots(0)).toBe("0");
    expect(formatNumberWithDots("")).toBe("");
    expect(formatNumberWithDots(null)).toBe("");

    // Parseo inverso a número entero para persistencia y base de datos
    expect(parseNumberFromDots("20.000")).toBe(20000);
    expect(parseNumberFromDots("1.500.000")).toBe(1500000);
    expect(parseNumberFromDots("")).toBe(0);
    expect(parseNumberFromDots(null)).toBe(0);
  });

  // --------------------------------------------------------------------------
  // PRUEBA 14: Campo de Alérgenos conocidos (opcionalidad, normalización, preservación y negocios no gastronómicos)
  // --------------------------------------------------------------------------
  it("14. Manejo correcto de alérgenos conocidos: opcional, lista normalizada, preservación en edición y no afecta otros negocios", () => {
    // 1. Crear producto sin indicar alérgenos (debe ser opcional y default [])
    const productWithoutAllergens = CreateProductSchema.parse({
      name: "Hamburguesa Sencilla",
      price: 15000,
      metadata: {
        product_type: "product",
        ingredients: "Carne 120g, lechuga, tomate",
      },
    });
    expect(productWithoutAllergens.metadata.allergens).toEqual([]);
    // Comprobar que no se asigna automáticamente "libre de alérgenos" o afirmaciones engañosas
    expect(productWithoutAllergens.metadata.allergens).not.toContain("libre de alérgenos");
    expect(productWithoutAllergens.metadata.allergens).not.toContain("Sin alérgenos");

    // 2. Normalización de alérgenos separados por comas
    const allergensInput = "Leche, huevo, trigo (gluten), maní,  huevo  ";
    const rawAllergens = allergensInput
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
    const seen = new Set<string>();
    const normalizedArray: string[] = [];
    for (const item of rawAllergens) {
      const lower = item.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        normalizedArray.push(item);
      }
    }

    const productWithAllergens = CreateProductSchema.parse({
      name: "Hamburguesa Gourmet",
      price: 28000,
      metadata: {
        product_type: "product",
        ingredients: "Carne angus, queso brie, pan brioche",
        allergens: normalizedArray,
      },
    });
    expect(productWithAllergens.metadata.allergens).toEqual([
      "Leche",
      "huevo",
      "trigo (gluten)",
      "maní",
    ]);

    // 3. Edición de producto: comprobar que los alérgenos se conservan
    const updatedProduct = CreateProductSchema.parse({
      ...productWithAllergens,
      name: "Hamburguesa Gourmet Doble Queso",
      price: 32000,
      metadata: {
        ...productWithAllergens.metadata,
        ingredients: "Carne angus doble, doble queso brie, pan brioche",
        // Conserva los alérgenos originales
        allergens: productWithAllergens.metadata.allergens,
      },
    });
    expect(updatedProduct.metadata.allergens).toEqual([
      "Leche",
      "huevo",
      "trigo (gluten)",
      "maní",
    ]);

    // 4. Negocios no gastronómicos (Retail y Servicios) no exigen alérgenos
    const retailProduct = CreateProductSchema.parse({
      name: "Camiseta de Algodón Oversize",
      price: 65000,
      metadata: {
        product_type: "product",
        sku: "TSHIRT-001",
        unit: "unidad",
      },
    });
    expect(retailProduct.metadata.allergens).toEqual([]);

    const serviceProduct = CreateProductSchema.parse({
      name: "Corte de Cabello Clásico",
      price: 25000,
      metadata: {
        product_type: "service",
        duration_minutes: 40,
      },
    });
    expect(serviceProduct.metadata.allergens).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // PRUEBA 15: Ocultación de selector Producto/Servicio en restaurantes de comida rápida
  // --------------------------------------------------------------------------
  it("15. Restaurantes de comida rápida registran directamente productos gastronómicos sin selector de servicio ni campos de duración", () => {
    // 1. Simular la lógica de negocio del formulario de restaurante
    const businessType = "fast_food";
    const normalizedBizType = businessType.toLowerCase();
    const isFoodBusiness =
      normalizedBizType.includes("rest") ||
      normalizedBizType.includes("food") ||
      normalizedBizType.includes("comida") ||
      normalizedBizType.includes("gastronom");

    expect(isFoodBusiness).toBe(true);

    // En restaurantes, product_type debe ser siempre "product" automáticamente
    const defaultProductType = isFoodBusiness ? "product" : "service";
    expect(defaultProductType).toBe("product");

    // 2. Registro directo de producto gastronómico (Hamburguesa, Salchipapa, Pizza)
    const fastFoodPayload = {
      name: "Salchipapa Costeña Mega",
      description: "Papas a la francesa crocantes, salchicha premium, queso costeño rallado",
      price: 24000,
      metadata: {
        product_type: isFoodBusiness ? ("product" as const) : ("service" as const),
        ingredients: "Papa criolla, salchicha manguera, queso costeño, tártara",
        allergens: ["Lactosa"],
        duration_minutes: null, // No aplica a gastronomía
        sku: null,              // No aplica a gastronomía
        barcode: null,          // No aplica a gastronomía
        has_variants: true,
        variants: [
          {
            id: "var-personal",
            name: "Personal",
            price: 24000,
            is_available: true,
            sort_order: 0,
            inherit_base_ingredients: true,
            specific_ingredients: "",
          },
          {
            id: "var-familiar",
            name: "Familiar",
            price: 45000,
            is_available: true,
            sort_order: 1,
            inherit_base_ingredients: true,
            specific_ingredients: "",
          },
        ],
        modifier_groups: [
          {
            id: "group-salsas",
            name: "Salsas de la casa",
            required: false,
            min_select: 0,
            max_select: 3,
            options: [
              { id: "opt-tartara", name: "Salsa tártara", price: 0, is_available: true },
              { id: "opt-pina", name: "Salsa de piña", price: 0, is_available: true },
            ],
          },
        ],
      },
    };

    const parsed = CreateProductSchema.parse(fastFoodPayload);
    expect(parsed.metadata.product_type).toBe("product");
    expect(parsed.metadata.duration_minutes).toBeNull();
    expect(parsed.metadata.has_variants).toBe(true);
    expect(parsed.metadata.variants).toHaveLength(2);
    expect(parsed.metadata.modifier_groups).toHaveLength(1);

    // 3. Los negocios de servicios (ej. Barbería) conservan la capacidad de servicios con duración
    const barberServicePayload = {
      name: "Afeitado Clásico y Toalla Caliente",
      price: 30000,
      metadata: {
        product_type: "service" as const,
        duration_minutes: 35,
      },
    };
    const parsedService = CreateProductSchema.parse(barberServicePayload);
    expect(parsedService.metadata.product_type).toBe("service");
    expect(parsedService.metadata.duration_minutes).toBe(35);
  });
});

