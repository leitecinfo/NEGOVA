import { describe, it, expect, vi } from "vitest";
import { Category, Product, CategorySchema, STANDARD_TAX_RATES } from "../../src/lib/products/types";

describe("Pestaña Categorías en /workspace/[id]/productos", () => {
  const mockCategories: Category[] = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      business_id: "00000000-0000-4000-8000-000000000000",
      name: "Bebidas",
      description: "Bebidas frías, calientes y jugos naturales",
      default_tax_rate: 8,
      sort_order: 10,
      status: "active",
      parent_category_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      business_id: "00000000-0000-4000-8000-000000000000",
      name: "Gaseosas",
      description: "Bebidas gaseosas y sodas",
      default_tax_rate: 19,
      sort_order: 20,
      status: "active",
      parent_category_id: "11111111-1111-4111-8111-111111111111",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      business_id: "00000000-0000-4000-8000-000000000000",
      name: "Comidas",
      description: "Platos fuertes y especialidades",
      default_tax_rate: null, // Sin impuesto por defecto
      sort_order: 30,
      status: "inactive",
      parent_category_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const mockProducts: Product[] = [
    {
      id: "44444444-4444-4444-8444-444444444444",
      business_id: "00000000-0000-4000-8000-000000000000",
      category_id: "11111111-1111-4111-8111-111111111111",
      name: "Jugo Natural",
      price: 7000,
      status: "active",
      is_available: true,
      sort_order: 1,
      metadata: {},
      created_at: "",
      updated_at: "",
    },
    {
      id: "55555555-5555-4555-8555-555555555555",
      business_id: "00000000-0000-4000-8000-000000000000",
      category_id: "22222222-2222-4222-8222-222222222222",
      name: "Coca-Cola 400ml",
      price: 5000,
      status: "active",
      is_available: true,
      sort_order: 2,
      metadata: {},
      created_at: "",
      updated_at: "",
    },
    {
      id: "66666666-6666-4666-8666-666666666666",
      business_id: "00000000-0000-4000-8000-000000000000",
      category_id: "22222222-2222-4222-8222-222222222222",
      name: "Sprite 400ml",
      price: 5000,
      status: "active",
      is_available: true,
      sort_order: 3,
      metadata: {},
      created_at: "",
      updated_at: "",
    },
  ];

  describe("1. Esquema y Tasas de Impuestos en Categorías", () => {
    it("debe validar el esquema de categorías con o sin impuesto por defecto", () => {
      const validWithTax = CategorySchema.safeParse(mockCategories[0]);
      expect(validWithTax.success).toBe(true);
      if (validWithTax.success) {
        expect(validWithTax.data.default_tax_rate).toBe(8);
      }

      const validWithoutTax = CategorySchema.safeParse(mockCategories[2]);
      expect(validWithoutTax.success).toBe(true);
      if (validWithoutTax.success) {
        expect(validWithoutTax.data.default_tax_rate).toBeNull();
      }
    });

    it("debe incluir las tasas estándar de impuestos de Colombia (0%, 5%, 8%, 19%)", () => {
      const rates = STANDARD_TAX_RATES.map((r) => r.value);
      expect(rates).toContain(0);
      expect(rates).toContain(5);
      expect(rates).toContain(8);
      expect(rates).toContain(19);
    });
  });

  describe("2. Tabla de Categorías: Conteo de Productos Asociados y Jerarquía", () => {
    it("debe calcular correctamente los productos asociados a cada categoría", () => {
      const countMap = new Map<string, number>();
      for (const p of mockProducts) {
        if (p.category_id) {
          countMap.set(p.category_id, (countMap.get(p.category_id) || 0) + 1);
        }
      }

      expect(countMap.get(mockCategories[0].id)).toBe(1); // Jugo Natural
      expect(countMap.get(mockCategories[1].id)).toBe(2); // Coca-Cola y Sprite
      expect(countMap.get(mockCategories[2].id) || 0).toBe(0); // Comidas (sin productos)
    });

    it("debe identificar categorías principales y subcategorías", () => {
      const roots = mockCategories.filter((c) => !c.parent_category_id);
      const subcats = mockCategories.filter((c) => Boolean(c.parent_category_id));

      expect(roots.map((c) => c.name)).toEqual(["Bebidas", "Comidas"]);
      expect(subcats.map((c) => c.name)).toEqual(["Gaseosas"]);
      expect(subcats[0].parent_category_id).toBe(mockCategories[0].id);
    });

    it("debe ordenar las categorías por sort_order", () => {
      const sorted = [...mockCategories].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      expect(sorted[0].name).toBe("Bebidas"); // 10
      expect(sorted[1].name).toBe("Gaseosas"); // 20
      expect(sorted[2].name).toBe("Comidas"); // 30
    });
  });

  describe("3. Herencia de Impuesto por Defecto al Crear Productos", () => {
    it("debe resolver la tasa impositiva por defecto de la categoría seleccionada", () => {
      const selectedCategory = mockCategories.find((c) => c.id === mockCategories[0].id);
      const defaultTax = selectedCategory?.default_tax_rate ?? null;
      expect(defaultTax).toBe(8);

      // Simular producto nuevo creado heredando impuesto
      const newProductTax = defaultTax !== null ? defaultTax : 0;
      expect(newProductTax).toBe(8);
    });

    it("si la categoría no tiene impuesto por defecto configurado, el producto inicia con 0%", () => {
      const selectedCategory = mockCategories.find((c) => c.id === mockCategories[2].id);
      const defaultTax = selectedCategory?.default_tax_rate ?? null;
      expect(defaultTax).toBeNull();

      const newProductTax = defaultTax !== null ? defaultTax : 0;
      expect(newProductTax).toBe(0);
    });
  });

  describe("4. Estados y Acciones de Categorías", () => {
    it("debe soportar estados activo e inactivo", () => {
      expect(mockCategories[0].status).toBe("active");
      expect(mockCategories[2].status).toBe("inactive");
    });

    it("la categoría padre no puede ser seleccionada si es ella misma", () => {
      const categoryToEdit = mockCategories[0];
      const availableParents = mockCategories.filter((c) => !c.parent_category_id && c.id !== categoryToEdit.id);
      expect(availableParents.some((c) => c.id === categoryToEdit.id)).toBe(false);
      expect(availableParents.map((c) => c.id)).toContain(mockCategories[2].id);
    });

    it("una categoría con subcategorías no debe poder convertirse en subcategoría (máximo 2 niveles)", () => {
      const hasSubcats = (catId: string) => mockCategories.some((c) => c.parent_category_id === catId);
      expect(hasSubcats(mockCategories[0].id)).toBe(true); // Bebidas tiene Gaseosas
      expect(hasSubcats(mockCategories[1].id)).toBe(false); // Gaseosas no tiene hijos
    });
  });
});
