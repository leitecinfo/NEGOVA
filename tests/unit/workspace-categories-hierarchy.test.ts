import { describe, it, expect, vi, beforeEach } from "vitest";
import { Category, Product } from "../../src/lib/products/types";
import {
  getCategories,
  createCategory,
  updateCategory,
} from "../../src/lib/products/products-service";
import {
  filterMenuProducts,
  groupMenuProducts,
  getMenuCategoryPills,
} from "../../src/lib/menu/category-grouping";

const BIZ_1 = "11111111-1111-4111-8111-111111111111";
const BIZ_2 = "22222222-2222-4222-8222-222222222222";

let inMemoryCategories: Category[] = [];

// Mock @supabase/supabase-js
vi.mock("@supabase/supabase-js", () => {
  const createQueryBuilder = (initialData: () => Category[]) => {
    let filters: ((item: any) => boolean)[] = [];
    const builder: any = {
      select: vi.fn(() => builder),
      eq: vi.fn((col: string, val: any) => {
        filters.push((item) => item[col] === val);
        return builder;
      }),
      neq: vi.fn((col: string, val: any) => {
        filters.push((item) => item[col] !== val);
        return builder;
      }),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      maybeSingle: vi.fn(() => {
        const filtered = initialData().filter((item) => filters.every((f) => f(item)));
        return Promise.resolve({ data: filtered[0] || null, error: null });
      }),
      single: vi.fn(() => {
        const filtered = initialData().filter((item) => filters.every((f) => f(item)));
        return Promise.resolve({ data: filtered[0] || null, error: null });
      }),
      then: (resolve: any, reject: any) => {
        const filtered = initialData().filter((item) => filters.every((f) => f(item)));
        return Promise.resolve({ data: filtered, error: null }).then(resolve, reject);
      },
    };
    return builder;
  };

  return {
    createClient: vi.fn(() => ({
      from: vi.fn((table: string) => {
        if (table === "categories") {
          return {
            select: vi.fn(() => createQueryBuilder(() => inMemoryCategories)),
            insert: vi.fn((rows: any) => {
              const payload = Array.isArray(rows) ? rows[0] : rows;
              const newCat: Category = {
                id: payload.id || `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                business_id: payload.business_id,
                name: payload.name,
                description: payload.description || null,
                parent_category_id: payload.parent_category_id || null,
                sort_order: payload.sort_order ?? 0,
                status: payload.status || "active",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              inMemoryCategories.push(newCat);
              const insertBuilder: any = {
                select: vi.fn(() => insertBuilder),
                single: vi.fn(() => Promise.resolve({ data: newCat, error: null })),
                then: (resolve: any, reject: any) =>
                  Promise.resolve({ data: newCat, error: null }).then(resolve, reject),
              };
              return insertBuilder;
            }),
            update: vi.fn((updates: any) => {
              let targetIdx = -1;
              const updateBuilder: any = {
                eq: vi.fn((col: string, val: any) => {
                  targetIdx = inMemoryCategories.findIndex((c: any) => c[col] === val);
                  if (targetIdx !== -1) {
                    inMemoryCategories[targetIdx] = {
                      ...inMemoryCategories[targetIdx],
                      ...updates,
                      updated_at: new Date().toISOString(),
                    };
                  }
                  return updateBuilder;
                }),
                select: vi.fn(() => updateBuilder),
                single: vi.fn(() => {
                  if (targetIdx !== -1) {
                    return Promise.resolve({ data: inMemoryCategories[targetIdx], error: null });
                  }
                  return Promise.resolve({ data: null, error: { message: "Not found" } });
                }),
                then: (resolve: any, reject: any) => {
                  if (targetIdx !== -1) {
                    return Promise.resolve({ data: inMemoryCategories[targetIdx], error: null }).then(
                      resolve,
                      reject
                    );
                  }
                  return Promise.resolve({ data: null, error: { message: "Not found" } }).then(
                    resolve,
                    reject
                  );
                },
              };
              return updateBuilder;
            }),
          };
        }
        return {};
      }),
    })),
  };
});

describe("[CAT-001] Jerarquía de Subcategorías (Máximo 2 niveles)", () => {
  beforeEach(() => {
    inMemoryCategories = [];
  });

  describe("Reglas de Negocio en products-service", () => {
    it("permite crear una categoría raíz sin padre (Nivel 1)", async () => {
      const cat = await createCategory(BIZ_1, {
        name: "Comidas Rápidas",
        parent_category_id: null,
      });

      expect(cat).toBeDefined();
      expect(cat.name).toBe("Comidas Rápidas");
      expect(cat.parent_category_id).toBeNull();
    });

    it("permite crear una subcategoría con una categoría raíz como padre (Nivel 2)", async () => {
      const root = await createCategory(BIZ_1, {
        name: "Hamburguesas",
        parent_category_id: null,
      });

      const sub = await createCategory(BIZ_1, {
        name: "Hamburguesas Clásicas",
        parent_category_id: root.id,
      });

      expect(sub).toBeDefined();
      expect(sub.parent_category_id).toBe(root.id);
    });

    it("RECHAZA crear una subcategoría si el padre ya es subcategoría (Restricción máx 2 niveles)", async () => {
      const root = await createCategory(BIZ_1, { name: "Bebidas" });
      const sub = await createCategory(BIZ_1, {
        name: "Gaseosas",
        parent_category_id: root.id,
      });

      // Intento de Nivel 3 (hijo de 'Gaseosas')
      await expect(
        createCategory(BIZ_1, {
          name: "Gaseosas Zero",
          parent_category_id: sub.id,
        })
      ).rejects.toThrow(/2 niveles/i);
    });

    it("RECHAZA que una categoría sea su propio padre al actualizar", async () => {
      const cat = await createCategory(BIZ_1, { name: "Pizzas" });

      await expect(
        updateCategory(BIZ_1, cat.id, {
          parent_category_id: cat.id,
        })
      ).rejects.toThrow(/propio padre/i);
    });

    it("RECHAZA convertir una categoría que ya tiene hijos en subcategoría (para evitar Nivel 3)", async () => {
      const rootA = await createCategory(BIZ_1, { name: "Carnes" });
      const rootB = await createCategory(BIZ_1, { name: "Parrilla" });

      // Carnes tiene un hijo
      await createCategory(BIZ_1, {
        name: "Cortes Finos",
        parent_category_id: rootA.id,
      });

      // Intentar convertir Carnes en hijo de Parrilla
      await expect(
        updateCategory(BIZ_1, rootA.id, {
          parent_category_id: rootB.id,
        })
      ).rejects.toThrow(/ya tiene subcategorías asociadas/i);
    });

    it("RECHAZA asignar como padre una categoría de otro negocio (multi-tenant safety)", async () => {
      // Categoría en BIZ_2
      const foreign = await createCategory(BIZ_2, { name: "Menú Empresa B" });

      // Intento de usarla como padre en BIZ_1
      await expect(
        createCategory(BIZ_1, {
          name: "Combo Intruso",
          parent_category_id: foreign.id,
        })
      ).rejects.toThrow(/no existe o no pertenece a este comercio/i);
    });

    it("getCategories adjunta correctamente el objeto parent", async () => {
      const root = await createCategory(BIZ_1, { name: "Postres" });
      await createCategory(BIZ_1, {
        name: "Helados",
        parent_category_id: root.id,
      });

      const list = await getCategories(BIZ_1);
      const child = list.find((c) => c.name === "Helados");

      expect(child).toBeDefined();
      expect(child?.parent).toBeDefined();
      expect(child?.parent?.name).toBe("Postres");
    });
  });

  describe("Filtrado y Agrupación en el Menú QR (category-grouping)", () => {
    const rootCat: Category = {
      id: "cat_root_1",
      business_id: BIZ_1,
      name: "Hamburguesas",
      parent_category_id: null,
      sort_order: 10,
      status: "active",
      created_at: "",
      updated_at: "",
    };

    const subCat1: Category = {
      id: "cat_sub_1",
      business_id: BIZ_1,
      name: "Smash",
      parent_category_id: "cat_root_1",
      sort_order: 11,
      status: "active",
      created_at: "",
      updated_at: "",
    };

    const subCat2: Category = {
      id: "cat_sub_2",
      business_id: BIZ_1,
      name: "Artesanales",
      parent_category_id: "cat_root_1",
      sort_order: 12,
      status: "active",
      created_at: "",
      updated_at: "",
    };

    const beveragesCat: Category = {
      id: "cat_root_2",
      business_id: BIZ_1,
      name: "Bebidas",
      parent_category_id: null,
      sort_order: 20,
      status: "active",
      created_at: "",
      updated_at: "",
    };

    const categoriesList = [rootCat, subCat1, subCat2, beveragesCat];

    const pDirectRoot: Product = {
      id: "prod_1",
      business_id: BIZ_1,
      name: "Hamburguesa Tradicional",
      category_id: "cat_root_1",
      price: 18000,
      is_available: true,
      status: "active",
      sort_order: 1,
      created_at: "",
      updated_at: "",
    };

    const pSmash: Product = {
      id: "prod_2",
      business_id: BIZ_1,
      name: "Smash Doble Bacon",
      category_id: "cat_sub_1",
      price: 24000,
      is_available: true,
      status: "active",
      sort_order: 2,
      created_at: "",
      updated_at: "",
    };

    const pArtesanal: Product = {
      id: "prod_3",
      business_id: BIZ_1,
      name: "Artesanal Angus 200g",
      category_id: "cat_sub_2",
      price: 32000,
      is_available: true,
      status: "active",
      sort_order: 3,
      created_at: "",
      updated_at: "",
    };

    const pBeverage: Product = {
      id: "prod_4",
      business_id: BIZ_1,
      name: "Limonada Natural",
      category_id: "cat_root_2",
      price: 6000,
      is_available: true,
      status: "active",
      sort_order: 4,
      created_at: "",
      updated_at: "",
    };

    const allProducts = [pDirectRoot, pSmash, pArtesanal, pBeverage];

    it("filterMenuProducts: al seleccionar categoría padre, incluye productos directos Y de sus subcategorías", () => {
      const result = filterMenuProducts(allProducts, categoriesList, "", "cat_root_1");

      // Debe incluir Hamburguesa Tradicional, Smash Doble Bacon y Artesanal Angus
      expect(result.length).toBe(3);
      expect(result.map((p) => p.id)).toEqual(["prod_1", "prod_2", "prod_3"]);
      expect(result.some((p) => p.id === "prod_4")).toBe(false);
    });

    it("filterMenuProducts: al seleccionar subcategoría específica, filtra solo sus productos", () => {
      const result = filterMenuProducts(allProducts, categoriesList, "", "cat_sub_1");

      expect(result.length).toBe(1);
      expect(result[0].id).toBe("prod_2");
      expect(result[0].name).toBe("Smash Doble Bacon");
    });

    it("groupMenuProducts: al ver 'all', agrupa por Padre y Padre › Hijo", () => {
      const filtered = filterMenuProducts(allProducts, categoriesList, "", "all");
      const groups = groupMenuProducts(filtered, categoriesList, "all", "");

      // Grupos esperados:
      // 1. Hamburguesas (directo)
      // 2. Hamburguesas › Smash
      // 3. Hamburguesas › Artesanales
      // 4. Bebidas
      expect(groups.length).toBe(4);
      expect(groups[0].categoryName).toBe("Hamburguesas");
      expect(groups[1].categoryName).toBe("Hamburguesas › Smash");
      expect(groups[2].categoryName).toBe("Hamburguesas › Artesanales");
      expect(groups[3].categoryName).toBe("Bebidas");
    });

    it("groupMenuProducts: al seleccionar categoría padre con subcategorías, desglosa por subcategoría", () => {
      const filtered = filterMenuProducts(allProducts, categoriesList, "", "cat_root_1");
      const groups = groupMenuProducts(filtered, categoriesList, "cat_root_1", "");

      expect(groups.length).toBe(3);
      expect(groups[0].categoryName).toBe("Hamburguesas");
      expect(groups[1].categoryName).toBe("Hamburguesas › Smash");
      expect(groups[2].categoryName).toBe("Hamburguesas › Artesanales");
    });

    it("getMenuCategoryPills: calcula total acumulado para el padre e individual para los hijos", () => {
      const pills = getMenuCategoryPills(categoriesList, allProducts);

      const rootPill = pills.find((p) => p.id === "cat_root_1");
      const smashPill = pills.find((p) => p.id === "cat_sub_1");
      const beveragePill = pills.find((p) => p.id === "cat_root_2");

      expect(rootPill?.count).toBe(3); // 1 directo + 1 smash + 1 artesanal
      expect(rootPill?.displayName).toBe("Hamburguesas");

      expect(smashPill?.count).toBe(1);
      expect(smashPill?.displayName).toBe("Hamburguesas › Smash");

      expect(beveragePill?.count).toBe(1);
    });
  });
});
