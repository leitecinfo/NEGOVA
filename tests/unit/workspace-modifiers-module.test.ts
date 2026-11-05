import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CreateModifierGroupInput,
  ModifierGroup,
  ModifierGroupKPIs,
  ModifierGroupSchema,
  ModifierOptionSchema,
} from "../../src/lib/modifiers/types";
import {
  getModifierGroupKPIs,
  createModifierGroup,
  updateModifierGroup,
  getModifierGroups,
  addModifierOption,
  updateModifierOption,
  deleteModifierOption,
  toggleModifierGroupStatus,
  deleteModifierGroup,
} from "../../src/lib/modifiers/modifiers-service";

const BIZ_1 = "11111111-1111-4111-8111-111111111111";
const BIZ_2 = "22222222-2222-4222-8222-222222222222";

process.env.SUPABASE_SERVICE_ROLE_KEY = "mock_key";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";

let inMemoryGroups: any[] = [];
let inMemoryOptions: any[] = [];
let inMemoryLinks: any[] = [];
let inMemoryProducts: any[] = [];

// Mock de @supabase/supabase-js
vi.mock("@supabase/supabase-js", () => {
  return {
    createClient: vi.fn(() => ({
      from: vi.fn((table: string) => {
        if (table === "product_option_groups") {
          return {
            select: vi.fn(() => {
              let filterBiz: string | null = null;
              const builder: any = {
                eq: vi.fn((col: string, val: string) => {
                  if (col === "business_id") filterBiz = val;
                  return builder;
                }),
                order: vi.fn(() => builder),
                then: (resolve: any, reject: any) => {
                  const filtered = inMemoryGroups.filter(
                    (g) => !filterBiz || g.business_id === filterBiz
                  );
                  return Promise.resolve({ data: filtered, error: null }).then(resolve, reject);
                },
              };
              return builder;
            }),
            insert: vi.fn((rows: any) => {
              const payload = Array.isArray(rows) ? rows[0] : rows;
              const newG = {
                id: payload.id || `grp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                business_id: payload.business_id,
                name: payload.name,
                required: payload.required ?? false,
                min_selections: payload.min_selections ?? 0,
                max_selections: payload.max_selections ?? 1,
                sort_order: payload.sort_order ?? 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              inMemoryGroups.push(newG);
              const builder: any = {
                select: vi.fn(() => builder),
                single: vi.fn(() => Promise.resolve({ data: newG, error: null })),
              };
              return builder;
            }),
            update: vi.fn((updates: any) => {
              let targetId: string | null = null;
              let targetBiz: string | null = null;
              const builder: any = {
                eq: vi.fn((col: string, val: string) => {
                  if (col === "id") targetId = val;
                  if (col === "business_id") targetBiz = val;
                  return builder;
                }),
                then: (resolve: any, reject: any) => {
                  const idx = inMemoryGroups.findIndex(
                    (g) => g.id === targetId && (!targetBiz || g.business_id === targetBiz)
                  );
                  if (idx !== -1) {
                    inMemoryGroups[idx] = { ...inMemoryGroups[idx], ...updates };
                  }
                  return Promise.resolve({ data: inMemoryGroups[idx] || null, error: null }).then(
                    resolve,
                    reject
                  );
                },
              };
              return builder;
            }),
            delete: vi.fn(() => {
              let targetId: string | null = null;
              let targetBiz: string | null = null;
              const builder: any = {
                eq: vi.fn((col: string, val: string) => {
                  if (col === "id") targetId = val;
                  if (col === "business_id") targetBiz = val;
                  return builder;
                }),
                then: (resolve: any, reject: any) => {
                  inMemoryGroups = inMemoryGroups.filter(
                    (g) => !(g.id === targetId && (!targetBiz || g.business_id === targetBiz))
                  );
                  return Promise.resolve({ data: null, error: null }).then(resolve, reject);
                },
              };
              return builder;
            }),
          };
        }

        if (table === "product_options") {
          return {
            select: vi.fn((cols?: string) => {
              let filterBiz: string | null = null;
              let filterGroupIds: string[] = [];
              let filterId: string | null = null;
              const builder: any = {
                eq: vi.fn((col: string, val: string) => {
                  if (col === "business_id") filterBiz = val;
                  if (col === "id") filterId = val;
                  return builder;
                }),
                in: vi.fn((col: string, vals: string[]) => {
                  if (col === "option_group_id") filterGroupIds = vals;
                  return builder;
                }),
                order: vi.fn(() => builder),
                single: vi.fn(() => {
                  const found = inMemoryOptions.find((o) => o.id === filterId);
                  return Promise.resolve({ data: found || null, error: null });
                }),
                then: (resolve: any, reject: any) => {
                  let res = inMemoryOptions;
                  if (filterBiz) res = res.filter((o) => o.business_id === filterBiz);
                  if (filterGroupIds.length > 0)
                    res = res.filter((o) => filterGroupIds.includes(o.option_group_id));
                  return Promise.resolve({ data: res, error: null }).then(resolve, reject);
                },
              };
              return builder;
            }),
            insert: vi.fn((rows: any) => {
              const list = Array.isArray(rows) ? rows : [rows];
              const created: any[] = [];
              for (const r of list) {
                const newOpt = {
                  id: r.id || `opt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  business_id: r.business_id,
                  option_group_id: r.option_group_id,
                  name: r.name,
                  additional_price: r.additional_price ?? 0,
                  status: r.status || "active",
                  sort_order: r.sort_order ?? 0,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };
                inMemoryOptions.push(newOpt);
                created.push(newOpt);
              }
              const builder: any = {
                select: vi.fn(() => builder),
                single: vi.fn(() => Promise.resolve({ data: created[0], error: null })),
                then: (resolve: any, reject: any) =>
                  Promise.resolve({ data: created, error: null }).then(resolve, reject),
              };
              return builder;
            }),
            update: vi.fn((updates: any) => {
              let filterId: string | null = null;
              let filterGroupId: string | null = null;
              const builder: any = {
                eq: vi.fn((col: string, val: string) => {
                  if (col === "id") filterId = val;
                  if (col === "option_group_id") filterGroupId = val;
                  return builder;
                }),
                then: (resolve: any, reject: any) => {
                  inMemoryOptions.forEach((o, idx) => {
                    if (filterId && o.id === filterId) {
                      inMemoryOptions[idx] = { ...o, ...updates };
                    }
                    if (filterGroupId && o.option_group_id === filterGroupId) {
                      inMemoryOptions[idx] = { ...o, ...updates };
                    }
                  });
                  return Promise.resolve({ data: null, error: null }).then(resolve, reject);
                },
              };
              return builder;
            }),
            delete: vi.fn(() => {
              let filterId: string | null = null;
              let filterGroupId: string | null = null;
              let filterIds: string[] = [];
              const builder: any = {
                eq: vi.fn((col: string, val: string) => {
                  if (col === "id") filterId = val;
                  if (col === "option_group_id") filterGroupId = val;
                  return builder;
                }),
                in: vi.fn((col: string, vals: string[]) => {
                  if (col === "id") filterIds = vals;
                  return builder;
                }),
                then: (resolve: any, reject: any) => {
                  inMemoryOptions = inMemoryOptions.filter((o) => {
                    if (filterId && o.id === filterId) return false;
                    if (filterGroupId && o.option_group_id === filterGroupId) return false;
                    if (filterIds.length > 0 && filterIds.includes(o.id)) return false;
                    return true;
                  });
                  return Promise.resolve({ data: null, error: null }).then(resolve, reject);
                },
              };
              return builder;
            }),
          };
        }

        if (table === "product_option_groups_products") {
          return {
            select: vi.fn(() => {
              let filterBiz: string | null = null;
              let filterGroupIds: string[] = [];
              let filterGroupId: string | null = null;
              const builder: any = {
                eq: vi.fn((col: string, val: string) => {
                  if (col === "business_id") filterBiz = val;
                  if (col === "option_group_id") filterGroupId = val;
                  return builder;
                }),
                in: vi.fn((col: string, vals: string[]) => {
                  if (col === "option_group_id") filterGroupIds = vals;
                  return builder;
                }),
                then: (resolve: any, reject: any) => {
                  let res = inMemoryLinks;
                  if (filterBiz) res = res.filter((l) => l.business_id === filterBiz);
                  if (filterGroupId) res = res.filter((l) => l.option_group_id === filterGroupId);
                  if (filterGroupIds.length > 0)
                    res = res.filter((l) => filterGroupIds.includes(l.option_group_id));
                  return Promise.resolve({ data: res, error: null }).then(resolve, reject);
                },
              };
              return builder;
            }),
            insert: vi.fn((rows: any) => {
              const list = Array.isArray(rows) ? rows : [rows];
              for (const r of list) {
                inMemoryLinks.push(r);
              }
              return Promise.resolve({ data: list, error: null });
            }),
            delete: vi.fn(() => {
              let filterGroupId: string | null = null;
              const builder: any = {
                eq: vi.fn((col: string, val: string) => {
                  if (col === "option_group_id") filterGroupId = val;
                  return builder;
                }),
                then: (resolve: any, reject: any) => {
                  inMemoryLinks = inMemoryLinks.filter(
                    (l) => !filterGroupId || l.option_group_id !== filterGroupId
                  );
                  return Promise.resolve({ data: null, error: null }).then(resolve, reject);
                },
              };
              return builder;
            }),
          };
        }

        if (table === "products") {
          return {
            select: vi.fn(() => {
              let filterBiz: string | null = null;
              let filterId: string | null = null;
              const builder: any = {
                eq: vi.fn((col: string, val: string) => {
                  if (col === "business_id") filterBiz = val;
                  if (col === "id") filterId = val;
                  return builder;
                }),
                maybeSingle: vi.fn(() => {
                  const p = inMemoryProducts.find((item) => item.id === filterId);
                  return Promise.resolve({ data: p || null, error: null });
                }),
                then: (resolve: any, reject: any) => {
                  const list = inMemoryProducts.filter(
                    (p) => !filterBiz || p.business_id === filterBiz
                  );
                  return Promise.resolve({ data: list, error: null }).then(resolve, reject);
                },
              };
              return builder;
            }),
            update: vi.fn((updates: any) => {
              let filterId: string | null = null;
              const builder: any = {
                eq: vi.fn((col: string, val: string) => {
                  if (col === "id") filterId = val;
                  return builder;
                }),
                then: (resolve: any, reject: any) => {
                  const idx = inMemoryProducts.findIndex((p) => p.id === filterId);
                  if (idx !== -1) {
                    inMemoryProducts[idx] = { ...inMemoryProducts[idx], ...updates };
                  }
                  return Promise.resolve({ data: inMemoryProducts[idx], error: null }).then(
                    resolve,
                    reject
                  );
                },
              };
              return builder;
            }),
          };
        }

        return { select: vi.fn().mockReturnThis() };
      }),
    })),
  };
});

vi.mock("../../src/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    const { createClient } = await import("@supabase/supabase-js");
    return createClient("https://mock.supabase.co", "mock_key");
  }),
}));

describe("Módulo Completo de Grupos de Modificadores y Opciones", () => {
  beforeEach(() => {
    inMemoryGroups = [];
    inMemoryOptions = [];
    inMemoryLinks = [];
    inMemoryProducts = [
      {
        id: "prod-hamburguesa",
        business_id: BIZ_1,
        name: "Hamburguesa Clásica",
        metadata: {},
      },
      {
        id: "prod-perro",
        business_id: BIZ_1,
        name: "Perro Caliente Especial",
        metadata: {},
      },
      {
        id: "prod-salchipapa",
        business_id: BIZ_1,
        name: "Salchipapa Gigante",
        metadata: {},
      },
    ];
  });

  describe("1. Validaciones de Esquema (Zod)", () => {
    it("debe validar un grupo con selección única (Radio, Máx 1)", () => {
      const input = {
        name: "Término de la carne",
        required: true,
        selection_type: "single" as const,
        min_select: 1,
        max_select: 1,
        options: [
          { name: "Término Medio", price: 0, status: "active" as const },
          { name: "Tres Cuartos", price: 0, status: "active" as const },
          { name: "Bien Asado", price: 0, status: "active" as const },
        ],
      };

      const parsed = ModifierGroupSchema.parse(input);
      expect(parsed.name).toBe("Término de la carne");
      expect(parsed.selection_type).toBe("single");
      expect(parsed.max_select).toBe(1);
      expect(parsed.required).toBe(true);
      expect(parsed.options).toHaveLength(3);
    });

    it("debe rechazar selección múltiple donde min_select > max_select", () => {
      const input = {
        name: "Salsas",
        required: true,
        selection_type: "multiple" as const,
        min_select: 4,
        max_select: 2,
        options: [{ name: "Tártara", price: 0 }],
      };

      expect(() => ModifierGroupSchema.parse(input)).toThrow(
        /La selección mínima no puede ser mayor que la máxima/
      );
    });

    it("debe rechazar opciones con precio negativo", () => {
      const invalidOption = {
        name: "Extra Tocineta",
        price: -1500,
      };

      expect(() => ModifierOptionSchema.parse(invalidOption)).toThrow(
        /El precio adicional debe ser mayor o igual a 0/
      );
    });
  });

  describe("2. Cálculo de KPIs", () => {
    it("debe calcular correctamente los KPIs de grupos, opciones activas y productos vinculados", () => {
      const mockGroups: ModifierGroup[] = [
        {
          id: "grp-1",
          business_id: BIZ_1,
          name: "Salsas",
          required: false,
          selection_type: "multiple",
          min_select: 0,
          max_select: 3,
          sort_order: 0,
          status: "active",
          applied_product_ids: ["prod-hamburguesa", "prod-perro"],
          options: [
            { id: "o-1", option_group_id: "grp-1", name: "Tártara", price: 0, status: "active", sort_order: 0 },
            { id: "o-2", option_group_id: "grp-1", name: "Rosada", price: 0, status: "active", sort_order: 1 },
            { id: "o-3", option_group_id: "grp-1", name: "Ajo", price: 500, status: "inactive", sort_order: 2 },
          ],
        },
        {
          id: "grp-2",
          business_id: BIZ_1,
          name: "Término",
          required: true,
          selection_type: "single",
          min_select: 1,
          max_select: 1,
          sort_order: 1,
          status: "active",
          applied_product_ids: ["prod-hamburguesa"], // prod-hamburguesa repetido
          options: [
            { id: "o-4", option_group_id: "grp-2", name: "Medio", price: 0, status: "active", sort_order: 0 },
            { id: "o-5", option_group_id: "grp-2", name: "Bien Cocido", price: 0, status: "active", sort_order: 1 },
          ],
        },
      ];

      const kpis = getModifierGroupKPIs(mockGroups);

      // Total grupos: 2
      expect(kpis.totalGroups).toBe(2);
      // Opciones activas: 2 (de grp-1) + 2 (de grp-2) = 4 (o-3 está inactiva)
      expect(kpis.activeOptions).toBe(4);
      // Productos vinculados únicos: 'prod-hamburguesa' y 'prod-perro' = 2
      expect(kpis.linkedProductsCount).toBe(2);
    });
  });

  describe("3. Ciclo de Vida del Servicio de Modificadores (CRUD & Sincronización)", () => {
    it("debe crear un grupo con opciones y vincularlo a productos", async () => {
      const payload: CreateModifierGroupInput = {
        name: "Acompañamiento",
        required: true,
        selection_type: "single",
        min_select: 1,
        max_select: 1,
        sort_order: 0,
        status: "active",
        options: [
          { name: "Papas Francesas", price: 0, status: "active", sort_order: 0 },
          { name: "Aros de Cebolla", price: 2500, status: "active", sort_order: 1 },
        ],
        product_ids: ["prod-hamburguesa", "prod-salchipapa"],
      };

      const created = await createModifierGroup(BIZ_1, payload);

      expect(created.id).toBeDefined();
      expect(created.name).toBe("Acompañamiento");
      expect(created.required).toBe(true);
      expect(created.selection_type).toBe("single");
      expect(created.options).toHaveLength(2);
      expect(created.applied_product_ids).toContain("prod-hamburguesa");
      expect(created.applied_product_ids).toContain("prod-salchipapa");

      // Verificar sincronización en metadata del producto
      const burger = inMemoryProducts.find((p) => p.id === "prod-hamburguesa");
      expect(burger.metadata.modifier_groups).toBeDefined();
      expect(burger.metadata.modifier_groups).toHaveLength(1);
      expect(burger.metadata.modifier_groups[0].name).toBe("Acompañamiento");
    });

    it("debe agregar una nueva opción al grupo y reflejarla", async () => {
      const group = await createModifierGroup(BIZ_1, {
        name: "Adicionales",
        required: false,
        selection_type: "multiple",
        min_select: 0,
        max_select: 5,
        options: [{ name: "Extra Queso", price: 2500, status: "active" }],
        product_ids: ["prod-hamburguesa"],
      });

      const newOption = await addModifierOption(BIZ_1, group.id, {
        name: "Tocineta Crujiente",
        price: 3500,
        status: "active",
      });

      expect(newOption.id).toBeDefined();
      expect(newOption.name).toBe("Tocineta Crujiente");
      expect(newOption.price).toBe(3500);

      const all = await getModifierGroups(BIZ_1);
      const found = all.find((g) => g.id === group.id);
      expect(found?.options).toHaveLength(2);
    });

    it("debe alternar el estado de un grupo de modificadores", async () => {
      const group = await createModifierGroup(BIZ_1, {
        name: "Bebidas del combo",
        required: true,
        selection_type: "single",
        options: [
          { name: "Coca-Cola", price: 0, status: "active" },
          { name: "Sprite", price: 0, status: "active" },
        ],
        product_ids: ["prod-hamburguesa"],
      });

      // Pausar todo el grupo
      await toggleModifierGroupStatus(BIZ_1, group.id, "inactive");

      const all = await getModifierGroups(BIZ_1);
      const found = all.find((g) => g.id === group.id);
      expect(found?.options.every((o) => o.status === "inactive")).toBe(true);
      expect(found?.status).toBe("inactive");
    });

    it("debe eliminar un grupo y desvincularlo de los productos asociados", async () => {
      const group = await createModifierGroup(BIZ_1, {
        name: "Salsas Temporales",
        required: false,
        selection_type: "multiple",
        options: [{ name: "Guacamole", price: 1500, status: "active" }],
        product_ids: ["prod-hamburguesa"],
      });

      await deleteModifierGroup(BIZ_1, group.id);

      const all = await getModifierGroups(BIZ_1);
      expect(all.find((g) => g.id === group.id)).toBeUndefined();

      // Verificar que el producto ya no tiene ese grupo en su metadata
      const burger = inMemoryProducts.find((p) => p.id === "prod-hamburguesa");
      const remainingGroups = burger.metadata.modifier_groups || [];
      expect(remainingGroups.find((g: any) => g.name === "Salsas Temporales")).toBeUndefined();
    });

    it("debe crear un modificador individual independiente y reflejarlo en el producto", async () => {
      // Simula el flujo de «Nuevo modificador»
      const singleModifier = await createModifierGroup(BIZ_1, {
        name: "Queso mozzarella extra",
        commercial_type: "additional",
        required: false,
        selection_type: "single",
        min_select: 0,
        max_select: 1,
        status: "active",
        options: [
          {
            name: "Queso mozzarella extra",
            price: 3500,
            status: "active",
            sort_order: 0,
          },
        ],
        product_ids: ["prod-hamburguesa"],
      });

      expect(singleModifier.name).toBe("Queso mozzarella extra");
      expect(singleModifier.options).toHaveLength(1);
      expect(singleModifier.options[0].price).toBe(3500);
      expect(singleModifier.max_select).toBe(1);
      expect(singleModifier.required).toBe(false);

      // Snapshot sincronizado en el producto
      const burger = inMemoryProducts.find((p) => p.id === "prod-hamburguesa");
      const snapshotGroup = burger.metadata.modifier_groups.find(
        (g: any) => g.name === "Queso mozzarella extra"
      );
      expect(snapshotGroup).toBeDefined();
      expect(snapshotGroup.options[0].price).toBe(3500);
      expect(snapshotGroup.commercial_type).toBe("additional");
    });

    it("debe actualizar un modificador individual y permitir convertirlo a grupo múltiple", async () => {
      // Crear modificador individual
      const single = await createModifierGroup(BIZ_1, {
        name: "Tocineta",
        commercial_type: "additional",
        required: false,
        selection_type: "single",
        min_select: 0,
        max_select: 1,
        status: "active",
        options: [{ name: "Tocineta", price: 4000, status: "active" }],
        product_ids: ["prod-hamburguesa"],
      });

      // Convertir a grupo con múltiples opciones (ej. Tocineta regular y Tocineta ahumada premium)
      const converted = await updateModifierGroup(BIZ_1, single.id, {
        name: "Selección de Tocinetas",
        selection_type: "multiple",
        required: false,
        min_select: 0,
        max_select: 2,
        options: [
          { id: single.options[0].id, name: "Tocineta Tradicional", price: 4000, status: "active" },
          { name: "Tocineta Ahumada en Madera", price: 5500, status: "active" },
        ],
        product_ids: ["prod-hamburguesa"],
      });

      expect(converted.name).toBe("Selección de Tocinetas");
      expect(converted.options).toHaveLength(2);
      expect(converted.max_select).toBe(2);

      // Verificar snapshot en producto
      const burger = inMemoryProducts.find((p) => p.id === "prod-hamburguesa");
      const synced = burger.metadata.modifier_groups.find((g: any) => g.name === "Selección de Tocinetas");
      expect(synced).toBeDefined();
      expect(synced.options).toHaveLength(2);
    });
    it("debe permitir crear un modificador sin asignar a ningún producto (0 productos)", async () => {
      const independentMod = await createModifierGroup(BIZ_1, {
        name: "Queso Costeño Extra",
        commercial_type: "additional",
        required: false,
        selection_type: "single",
        min_select: 0,
        max_select: 1,
        status: "active",
        options: [{ name: "Queso Costeño Extra", price: 3000, status: "active" }],
        product_ids: [],
      });

      expect(independentMod).toBeDefined();
      expect(independentMod.name).toBe("Queso Costeño Extra");
      expect(independentMod.applied_product_ids).toEqual([]);

      // Verificar que aparece en el listado de grupos del negocio
      const allGroups = await getModifierGroups(BIZ_1);
      const found = allGroups.find((g) => g.name === "Queso Costeño Extra");
      expect(found).toBeDefined();
      expect(found?.applied_product_ids).toHaveLength(0);

      // Verificar que ningún producto tiene este modificador en su metadata snapshot
      for (const prod of inMemoryProducts.filter((p) => p.business_id === BIZ_1)) {
        const hasIt = (prod.metadata?.modifier_groups || []).some(
          (g) => g.name === "Queso Costeño Extra"
        );
        expect(hasIt).toBe(false);
      }
    });
  });
});
