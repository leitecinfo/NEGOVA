import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CategorySchema,
  ProductSchema,
  CreateProductSchema,
  ProductModifierGroupSchema,
  ProductModifierOptionSchema,
  Product,
  Category,
} from "../../src/lib/products/types";
import {
  PLAN_PRODUCT_LIMITS,
  checkProductPlanLimit,
  getBusinessProductCount,
  getCategories,
  createCategory,
  updateCategory,
  archiveCategory,
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  toggleProductAvailability,
  archiveProduct,
} from "../../src/lib/products/products-service";

// ==============================================================================
// SIMULACIÓN IN-MEMORY DE BASE DE DATOS MULTI-TENANT PARA PRUEBAS FUNCIONALES
// ==============================================================================

const BUSINESS_A = "a8e2612f-4acc-4c84-a420-220131b70d66"; // Negocio Gastronómico (Comidas Rápidas)
const BUSINESS_B = "b8e2612f-4acc-4c84-a420-220131b70d77"; // Negocio Ajeno / Retail

let inMemoryCategories: Category[] = [];
let inMemoryProducts: Product[] = [];
let inMemorySubscriptions: Record<string, { plan_id: string; planName: string }> = {
  [BUSINESS_A]: { plan_id: "inicio", planName: "Inicio" },
  [BUSINESS_B]: { plan_id: "crece", planName: "Crece" },
};

// Mock de @supabase/supabase-js para products-service
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "categories") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((col: string, val: any) => ({
              neq: vi.fn((ncol: string, nval: any) => {
                const getFiltered = () =>
                  inMemoryCategories.filter(
                    (c) => c.business_id === val && (ncol === "status" ? c.status !== nval : true)
                  );
                const resPromise = Promise.resolve({ data: getFiltered(), error: null });
                return Object.assign(resPromise, {
                  order: vi.fn(() => ({
                    order: vi.fn(() => Promise.resolve({ data: getFiltered(), error: null })),
                  })),
                });
              }),
            })),
          })),
          insert: vi.fn((row: any) => ({
            select: vi.fn(() => ({
              single: vi.fn(() => {
                const newCat: Category = {
                  id: crypto.randomUUID ? crypto.randomUUID() : "a0000000-0000-4000-8000-000000000001",
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  ...row,
                };
                inMemoryCategories.push(newCat);
                return Promise.resolve({ data: newCat, error: null });
              }),
            })),
          })),
          update: vi.fn((updates: any) => ({
            eq: vi.fn((col1: string, val1: any) => ({
              eq: vi.fn((col2: string, val2: any) => ({
                select: vi.fn(() => ({
                  single: vi.fn(() => {
                    const index = inMemoryCategories.findIndex(
                      (c) => c.id === val1 && c.business_id === val2
                    );
                    if (index === -1) {
                      return Promise.resolve({ data: null, error: new Error("Categoría no encontrada") });
                    }
                    inMemoryCategories[index] = {
                      ...inMemoryCategories[index],
                      ...updates,
                      updated_at: new Date().toISOString(),
                    };
                    return Promise.resolve({ data: inMemoryCategories[index], error: null });
                  }),
                })),
                then: (resolve: any) => {
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
                  return resolve({ data: null, error: null });
                },
              })),
            })),
          })),
        };
      }

      if (table === "products") {
        return {
          select: vi.fn((fields: string, opts?: any) => {
            if (opts?.head && opts?.count === "exact") {
              // Count query para checkProductPlanLimit
              return {
                eq: vi.fn((col: string, val: any) => ({
                  neq: vi.fn((ncol: string, nval: any) => {
                    const count = inMemoryProducts.filter(
                      (p) => p.business_id === val && (ncol === "status" ? p.status !== nval : true)
                    ).length;
                    return Promise.resolve({ count, error: null });
                  }),
                })),
              };
            }

            return {
              eq: vi.fn((col: string, val: any) => ({
                neq: vi.fn((ncol: string, nval: any) => ({
                  order: vi.fn(() => ({
                    order: vi.fn(() => ({
                      order: vi.fn(() => {
                        const filtered = inMemoryProducts.filter(
                          (p) => p.business_id === val && (ncol === "status" ? p.status !== nval : true)
                        );
                        return Promise.resolve({ data: filtered, error: null });
                      }),
                    })),
                  })),
                })),
                // Para getProductById: .eq("id", productId).eq("business_id", businessId).maybeSingle()
                eq: vi.fn((col2: string, val2: any) => ({
                  maybeSingle: vi.fn(() => {
                    const prod = inMemoryProducts.find(
                      (p) => p.id === val && p.business_id === val2
                    );
                    return Promise.resolve({ data: prod || null, error: null });
                  }),
                })),
              })),
            };
          }),
          insert: vi.fn((row: any) => ({
            select: vi.fn(() => ({
              single: vi.fn(() => {
                const newProd: Product = {
                  id: crypto.randomUUID ? crypto.randomUUID() : "b0000000-0000-4000-8000-000000000001",
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  ...row,
                };
                inMemoryProducts.push(newProd);
                return Promise.resolve({ data: newProd, error: null });
              }),
            })),
          })),

          update: vi.fn((updates: any) => ({
            eq: vi.fn((col1: string, val1: any) => ({
              eq: vi.fn((col2: string, val2: any) => ({
                select: vi.fn(() => ({
                  single: vi.fn(() => {
                    const index = inMemoryProducts.findIndex(
                      (p) => p.id === val1 && p.business_id === val2
                    );
                    if (index === -1) {
                      return Promise.resolve({ data: null, error: new Error("Producto no encontrado") });
                    }
                    inMemoryProducts[index] = {
                      ...inMemoryProducts[index],
                      ...updates,
                      updated_at: new Date().toISOString(),
                    };
                    return Promise.resolve({ data: inMemoryProducts[index], error: null });
                  }),
                })),
                then: (resolve: any) => {
                  const index = inMemoryProducts.findIndex(
                    (p) => p.id === val1 && p.business_id === val2
                  );
                  if (index !== -1) {
                    inMemoryProducts[index] = {
                      ...inMemoryProducts[index],
                      ...updates,
                      updated_at: new Date().toISOString(),
                    };
                  }
                  return resolve({ data: null, error: null });
                },
              })),
            })),
          })),
        };
      }

      if (table === "subscriptions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((col: string, val: string) => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn(() => {
                    const sub = inMemorySubscriptions[val];
                    if (sub) {
                      return Promise.resolve({
                        data: {
                          plan_id: sub.plan_id,
                          status: "active",
                          plans: { code: sub.plan_id, name: sub.planName },
                        },
                        error: null,
                      });
                    }
                    return Promise.resolve({ data: null, error: null });
                  }),
                })),
              })),
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

// Mock de @/lib/supabase/server
vi.mock("../../src/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-owner-123", email: "owner@negova.com" } },
        error: null,
      }),
    },
  })),
}));

describe("NEGOVA — ETAPA 1: Catálogo de Productos y Modificadores Gastronómicos", () => {
  beforeEach(() => {
    inMemoryCategories = [];
    inMemoryProducts = [];
    inMemorySubscriptions = {
      [BUSINESS_A]: { plan_id: "inicio", planName: "Inicio" },
      [BUSINESS_B]: { plan_id: "crece", planName: "Crece" },
    };
  });

  // --------------------------------------------------------------------------
  // 1. CREAR CATEGORÍA «COMIDAS RÁPIDAS»
  // --------------------------------------------------------------------------
  it("1. Debe crear la categoría «Comidas rápidas» con aislamiento por business_id", async () => {
    const category = await createCategory(BUSINESS_A, {
      name: "Comidas rápidas",
      description: "Platos preparados de servicio ágil",
    });

    expect(category.id).toBeDefined();
    expect(category.name).toBe("Comidas rápidas");
    expect(category.business_id).toBe(BUSINESS_A);
    expect(category.status).toBe("active");

    const categories = await getCategories(BUSINESS_A);
    expect(categories.length).toBe(1);
    expect(categories[0].name).toBe("Comidas rápidas");
  });

  // --------------------------------------------------------------------------
  // 2, 3 & 4. CREAR «SALCHIPAPA ESPECIAL» POR $18.000 COP CON SALSAS Y QUESO COSTEÑO
  // --------------------------------------------------------------------------
  it("2, 3 & 4. Debe crear «Salchipapa especial» por $18.000 COP con salsas a $0 COP y queso costeño a $4.000 COP", async () => {
    const cat = await createCategory(BUSINESS_A, { name: "Comidas rápidas" });

    const payload = {
      name: "Salchipapa especial",
      description: "Papas a la francesa crocantes con salchicha manguera, queso fundido y ripio",
      price: 18000,
      category_id: cat.id,
      is_available: true,
      image_url: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90",
      status: "active" as const,
      sort_order: 1,
      metadata: {
        modifier_groups: [
          {
            id: "grp-salsas",
            name: "Salsas de la casa",
            required: false,
            min_select: 0,
            max_select: 3,
            options: [
              { id: "opt-tartara", name: "Tártara", price: 0, is_available: true },
              { id: "opt-rosada", name: "Rosada", price: 0, is_available: true },
              { id: "opt-pina", name: "Piña", price: 0, is_available: true },
            ],
          },
          {
            id: "grp-extras",
            name: "Adicionales",
            required: false,
            min_select: 0,
            max_select: 5,
            options: [
              { id: "opt-queso", name: "Queso costeño", price: 4000, is_available: true },
            ],
          },
        ],
      },
    };

    // Validar esquema Zod
    const parsed = CreateProductSchema.parse(payload);
    expect(parsed.price).toBe(18000);
    expect(parsed.metadata.modifier_groups).toHaveLength(2);

    // Guardar vía servicio
    const product = await createProduct(BUSINESS_A, parsed);

    expect(product.id).toBeDefined();
    expect(product.business_id).toBe(BUSINESS_A);
    expect(product.name).toBe("Salchipapa especial");
    expect(product.price).toBe(18000);
    expect(product.is_available).toBe(true);

    // Verificar estructura de complementos
    const groups = product.metadata.modifier_groups || [];
    expect(groups).toHaveLength(2);

    const salsas = groups.find((g) => g.name === "Salsas de la casa");
    expect(salsas).toBeDefined();
    expect(salsas?.options).toHaveLength(3);
    expect(salsas?.options[0].name).toBe("Tártara");
    expect(salsas?.options[0].price).toBe(0);
    expect(salsas?.options[1].name).toBe("Rosada");
    expect(salsas?.options[1].price).toBe(0);
    expect(salsas?.options[2].name).toBe("Piña");
    expect(salsas?.options[2].price).toBe(0);

    const extras = groups.find((g) => g.name === "Adicionales");
    expect(extras).toBeDefined();
    expect(extras?.options).toHaveLength(1);
    expect(extras?.options[0].name).toBe("Queso costeño");
    expect(extras?.options[0].price).toBe(4000);
  });

  // --------------------------------------------------------------------------
  // 5. EDITAR EL PRECIO A $20.000 COP Y VERIFICAR PERSISTENCIA
  // --------------------------------------------------------------------------
  it("5. Debe editar el precio del producto a $20.000 COP y persistirlo correctamente", async () => {
    const created = await createProduct(BUSINESS_A, {
      name: "Salchipapa especial",
      price: 18000,
      is_available: true,
      status: "active",
      sort_order: 0,
      metadata: {},
    });

    const updated = await updateProduct(BUSINESS_A, created.id, {
      price: 20000,
    });

    expect(updated.price).toBe(20000);

    const fetched = await getProductById(BUSINESS_A, created.id);
    expect(fetched?.price).toBe(20000);
  });

  // --------------------------------------------------------------------------
  // 6. MARCAR EL PRODUCTO COMO AGOTADO Y VERIFICAR PERSISTENCIA
  // --------------------------------------------------------------------------
  it("6. Debe marcar el producto como agotado (is_available = false) y conservar el estado", async () => {
    const created = await createProduct(BUSINESS_A, {
      name: "Salchipapa especial",
      price: 20000,
      is_available: true,
      status: "active",
      sort_order: 0,
      metadata: {},
    });

    expect(created.is_available).toBe(true);

    // Cambiar a agotado
    await toggleProductAvailability(BUSINESS_A, created.id, false);

    const fetched = await getProductById(BUSINESS_A, created.id);
    expect(fetched?.is_available).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 7. EDITAR EL PRODUCTO Y COMPROBAR QUE SUS COMPLEMENTOS SE CONSERVEN
  // --------------------------------------------------------------------------
  it("7. Debe editar campos del producto sin perder ni mutar sus modificadores", async () => {
    const created = await createProduct(BUSINESS_A, {
      name: "Salchipapa especial",
      price: 20000,
      is_available: false,
      status: "active",
      sort_order: 0,
      metadata: {
        modifier_groups: [
          {
            name: "Salsas",
            required: false,
            options: [
              { name: "Tártara", price: 0, is_available: true },
              { name: "Rosada", price: 0, is_available: true },
            ],
          },
          {
            name: "Adicionales",
            required: false,
            options: [{ name: "Queso costeño", price: 4000, is_available: true }],
          },
        ],
      },
    });

    // Actualizar únicamente nombre y disponibilidad
    const updated = await updateProduct(BUSINESS_A, created.id, {
      name: "Salchipapa Especial Gigante",
      is_available: true,
      metadata: created.metadata, // Conserva metadata
    });

    expect(updated.name).toBe("Salchipapa Especial Gigante");
    expect(updated.is_available).toBe(true);

    const fetched = await getProductById(BUSINESS_A, created.id);
    const groups = fetched?.metadata.modifier_groups || [];
    expect(groups).toHaveLength(2);
    expect(groups[0].name).toBe("Salsas");
    expect(groups[1].options[0].name).toBe("Queso costeño");
    expect(groups[1].options[0].price).toBe(4000);
  });

  // --------------------------------------------------------------------------
  // 8. PRODUCTO GENÉRICO SIN COMPLEMENTOS (NO GASTRONÓMICO)
  // --------------------------------------------------------------------------
  it("8. Debe crear y gestionar productos genéricos para negocios no gastronómicos sin exigir complementos", async () => {
    const genericProductPayload = {
      name: "Martillo de Uña 16oz Mango Fibra",
      description: "Herramienta manual para carpintería y construcción",
      price: 35000,
      is_available: true,
      status: "active" as const,
      sort_order: 0,
      metadata: {}, // Sin modificadores ni requerimientos de comida
    };

    const parsed = CreateProductSchema.parse(genericProductPayload);
    expect(parsed.name).toBe("Martillo de Uña 16oz Mango Fibra");
    expect(parsed.metadata.modifier_groups).toEqual([]);

    const created = await createProduct(BUSINESS_A, parsed);
    expect(created.id).toBeDefined();
    expect(created.name).toBe("Martillo de Uña 16oz Mango Fibra");
    expect(created.price).toBe(35000);
    expect(created.metadata.modifier_groups).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // 9. LÍMITES DEL PLAN Y TRATAMIENTO DE ARCHIVADO
  // --------------------------------------------------------------------------
  describe("9. Límites del plan y consistencia comercial", () => {
    it("debe validar el límite de 50 productos en el Plan Inicio", async () => {
      // Simular que el negocio ya tiene 50 productos activos
      for (let i = 0; i < 50; i++) {
        inMemoryProducts.push({
          id: `prod-lim-${i}`,
          business_id: BUSINESS_A,
          category_id: null,
          name: `Producto de prueba ${i + 1}`,
          description: null,
          image_url: null,
          price: 5000,
          status: "active",
          is_available: true,
          sort_order: i,
          metadata: { modifier_groups: [] },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      // Verificar capacidad
      const limit = await checkProductPlanLimit(BUSINESS_A);
      expect(limit.allowed).toBe(false);
      expect(limit.currentCount).toBe(50);
      expect(limit.maxProducts).toBe(50);
      expect(limit.planName).toBe("Inicio");

      // Intentar crear el producto #51 debe arrojar excepción
      await expect(
        createProduct(BUSINESS_A, {
          name: "Producto 51 Excedente",
          price: 10000,
          is_available: true,
          status: "active",
          sort_order: 51,
          metadata: {},
        })
      ).rejects.toThrow(/Has alcanzado el límite máximo de 50 productos/);
    });

    it("archivar un producto debe liberar capacidad en el plan comercial", async () => {
      // Poblar 50 productos en Negocio A
      for (let i = 0; i < 50; i++) {
        inMemoryProducts.push({
          id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
          business_id: BUSINESS_A,
          category_id: null,
          name: `Producto Límite ${i + 1}`,
          description: null,
          image_url: null,
          price: 5000,
          status: "active",
          is_available: true,
          sort_order: i,
          metadata: { modifier_groups: [] },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      // De los 50 productos, archivar el primero
      const prodToArchive = inMemoryProducts[0];
      await archiveProduct(BUSINESS_A, prodToArchive.id);

      expect(inMemoryProducts[0].status).toBe("archived");

      // Ahora el conteo activo debe ser 49
      const activeCount = await getBusinessProductCount(BUSINESS_A);
      expect(activeCount).toBe(49);


      // checkProductPlanLimit debe permitir crear uno nuevo
      const limit = await checkProductPlanLimit(BUSINESS_A);
      expect(limit.allowed).toBe(true);

      const newProd = await createProduct(BUSINESS_A, {
        name: "Nuevo Producto Reemplazo",
        price: 12000,
        is_available: true,
        status: "active",
        sort_order: 0,
        metadata: {},
      });

      expect(newProd.id).toBeDefined();
    });

    it("el Plan Crece debe permitir hasta 200 productos", async () => {
      const limit = await checkProductPlanLimit(BUSINESS_B);
      expect(limit.maxProducts).toBe(200);
      expect(limit.planName).toBe("Crece");
      expect(limit.allowed).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 10. AISLAMIENTO MULTI-TENANT
  // --------------------------------------------------------------------------
  describe("10. Aislamiento Multi-Tenant", () => {
    it("un negocio no debe poder listar productos de otro comercio", async () => {
      // Producto en Negocio A
      await createProduct(BUSINESS_A, {
        name: "Producto Exclusivo Negocio A",
        price: 15000,
        is_available: true,
        status: "active",
        sort_order: 0,
        metadata: {},
      });

      // Producto en Negocio B
      await createProduct(BUSINESS_B, {
        name: "Producto Exclusivo Negocio B",
        price: 25000,
        is_available: true,
        status: "active",
        sort_order: 0,
        metadata: {},
      });

      // Negocio A solo ve sus productos
      const prodsA = await getProducts(BUSINESS_A);
      expect(prodsA.every((p) => p.business_id === BUSINESS_A)).toBe(true);
      expect(prodsA.some((p) => p.name === "Producto Exclusivo Negocio A")).toBe(true);
      expect(prodsA.some((p) => p.name === "Producto Exclusivo Negocio B")).toBe(false);

      // Negocio B solo ve sus productos
      const prodsB = await getProducts(BUSINESS_B);
      expect(prodsB.every((p) => p.business_id === BUSINESS_B)).toBe(true);
      expect(prodsB.some((p) => p.name === "Producto Exclusivo Negocio B")).toBe(true);
      expect(prodsB.some((p) => p.name === "Producto Exclusivo Negocio A")).toBe(false);
    });

    it("getProductById debe retornar null si se consulta con un business_id no propietario", async () => {
      const prodA = await createProduct(BUSINESS_A, {
        name: "Hamburguesa Doble A",
        price: 22000,
        is_available: true,
        status: "active",
        sort_order: 0,
        metadata: {},
      });

      // Consultar con el business_id legítimo retorna el producto
      const legitimate = await getProductById(BUSINESS_A, prodA.id);
      expect(legitimate?.id).toBe(prodA.id);

      // Consultar con otro business_id debe retornar null (aislamiento)
      const hijacked = await getProductById(BUSINESS_B, prodA.id);
      expect(hijacked).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // VALIDACIONES ADICIONALES DE ESQUEMA (PRECIOS NEGATIVOS, LIMITES DE SELECCION)
  // --------------------------------------------------------------------------
  describe("Validaciones de Esquema y Reglas de Negocio", () => {
    it("debe rechazar precios negativos en el producto base", () => {
      expect(() =>
        CreateProductSchema.parse({
          name: "Producto Inválido",
          price: -500,
        })
      ).toThrow(/El precio no puede ser negativo/);
    });

    it("debe rechazar precios negativos en opciones de modificadores", () => {
      expect(() =>
        ProductModifierOptionSchema.parse({
          name: "Opción Inválida",
          price: -1000,
        })
      ).toThrow(/El precio adicional no puede ser negativo/);
    });

    it("debe rechazar grupos donde min_select sea mayor que max_select", () => {
      expect(() =>
        ProductModifierGroupSchema.parse({
          name: "Grupo Inválido",
          min_select: 3,
          max_select: 1,
          options: [],
        })
      ).toThrow(/La cantidad mínima no puede ser mayor que la cantidad máxima/);
    });
  });
});
