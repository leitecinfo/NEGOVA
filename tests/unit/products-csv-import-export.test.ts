import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateProductsCSV,
  parseCSVToRawRows,
  validateProductsCSV,
  importProductsBatch,
} from "../../src/lib/products/csv-service";
import { Product } from "../../src/lib/products/types";

// ==============================================================================
// MOCKS Y ESTADO EN MEMORIA
// ==============================================================================

const TEST_BUSINESS_ID = "biz-1111-2222-3333-444444444444";

let mockPlanCheckResult = {
  allowed: true,
  currentCount: 5,
  maxProducts: 20,
  planName: "Plan Pro",
  error: null as string | null,
};

let inMemoryCategories: Array<{ id: string; business_id: string; name: string }> = [];
let inMemoryProducts: Array<{
  id: string;
  business_id: string;
  name: string;
  price: number;
  description?: string | null;
  category_id?: string | null;
  is_available: boolean;
  metadata: any;
}> = [];
let inMemoryStockUpserts: any[] = [];

// Mock de productos-service
vi.mock("../../src/lib/products/products-service", () => ({
  checkProductPlanLimit: vi.fn(async () => mockPlanCheckResult),
  getCategories: vi.fn(async () => inMemoryCategories),
  createCategory: vi.fn(async (bizId: string, input: { name: string }) => {
    const newCat = {
      id: `cat-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      business_id: bizId,
      name: input.name,
    };
    inMemoryCategories.push(newCat);
    return newCat;
  }),
  getDbClient: vi.fn(async () => ({
    from: (table: string) => {
      if (table === "products") {
        return {
          select: (cols: string = "*") => ({
            eq: (col1: string, val1: any) => ({
              eq: (col2: string, val2: any) => ({
                single: async () => {
                  const found = inMemoryProducts.find(
                    (p: any) => p[col1] === val1 && p[col2] === val2
                  );
                  return { data: found || null, error: null };
                },
              }),
            }),
          }),
          insert: (data: any) => ({
            select: () => ({
              single: async () => {
                const inserted = {
                  ...data,
                  id: data.id || `prod-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                };
                inMemoryProducts.push(inserted);
                return { data: inserted, error: null };
              },
            }),
          }),
          update: (data: any) => ({
            eq: (col1: string, val1: any) => ({
              eq: async (col2: string, val2: any) => {
                const idx = inMemoryProducts.findIndex(
                  (p: any) => p[col1] === val1 && p[col2] === val2
                );
                if (idx !== -1) {
                  inMemoryProducts[idx] = { ...inMemoryProducts[idx], ...data };
                }
                return { error: null };
              },
            }),
          }),
        };
      }
      return {};
    },
  })),
}));

// Mock de inventory-service
vi.mock("@/lib/inventory/inventory-service", () => ({
  ensureDefaultLocation: vi.fn(async (bizId: string) => ({
    id: `loc-def-${bizId}`,
    name: "Punto de Venta Principal",
    type: "point_of_sale",
  })),
  upsertInventoryStock: vi.fn(async (bizId: string, input: any) => {
    inMemoryStockUpserts.push({ bizId, ...input });
    return { id: `stock-${Date.now()}`, ...input };
  }),
}));

describe("[CAT-006] Products CSV Import/Export Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inMemoryCategories = [
      { id: "cat-bebidas", business_id: TEST_BUSINESS_ID, name: "Bebidas" },
      { id: "cat-platos", business_id: TEST_BUSINESS_ID, name: "Platos Fuertes" },
    ];
    inMemoryProducts = [
      {
        id: "prod-1",
        business_id: TEST_BUSINESS_ID,
        name: "Limonada Natural",
        price: 3.5,
        description: "Bebida refrescante",
        category_id: "cat-bebidas",
        is_available: true,
        metadata: { sku: "BEB-001", cost: 1.0, stock_quantity: 25 },
      },
    ];
    inMemoryStockUpserts = [];
    mockPlanCheckResult = {
      allowed: true,
      currentCount: 5,
      maxProducts: 20,
      planName: "Plan Pro",
      error: null,
    };
  });

  // ----------------------------------------------------------------------------
  // 1. generateProductsCSV
  // ----------------------------------------------------------------------------
  describe("generateProductsCSV", () => {
    it("debe incluir UTF-8 BOM y cabeceras estándar en español", () => {
      const csv = generateProductsCSV([]);
      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toContain("Nombre,Categoría,Precio,Costo,SKU,Disponible,Descripción,Stock");
    });

    it("debe serializar productos existentes con sus atributos y escapar comas correctamente", () => {
      const mockProducts: Product[] = [
        {
          id: "p1",
          business_id: TEST_BUSINESS_ID,
          name: "Hamburguesa Clásica, con queso",
          description: 'Carne de res, "tocineta" y queso',
          price: 9.99,
          is_available: true,
          categories: { id: "cat-platos", name: "Hamburguesas", business_id: TEST_BUSINESS_ID, sort_order: 1 },
          metadata: { sku: "HAM-01", cost: 4.5, stock_quantity: 15 },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "p2",
          business_id: TEST_BUSINESS_ID,
          name: "Gaseosa 500ml",
          description: "",
          price: 2.0,
          is_available: false,
          categories: null,
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const csv = generateProductsCSV(mockProducts);

      // Producto 1 con coma en el nombre debe estar entrecomillado
      expect(csv).toContain('"Hamburguesa Clásica, con queso"');
      // Doble comilla escapada en la descripción
      expect(csv).toContain('""tocineta""');
      expect(csv).toContain("HAM-01");
      expect(csv).toContain("Sí");
      expect(csv).toContain("15");

      // Producto 2 sin categoría y no disponible ("No")
      expect(csv).toContain("Gaseosa 500ml");
      expect(csv).toContain("No");
    });
  });

  // ----------------------------------------------------------------------------
  // 2. parseCSVToRawRows
  // ----------------------------------------------------------------------------
  describe("parseCSVToRawRows", () => {
    it("debe parsear correctamente CSV delimitado por comas", () => {
      const rawCsv = `Nombre,Precio,SKU\nPizza,12.50,PIZ-01\nEnsalada,6.00,ENS-01`;
      const rows = parseCSVToRawRows(rawCsv);

      expect(rows.length).toBe(3);
      expect(rows[0]).toEqual(["Nombre", "Precio", "SKU"]);
      expect(rows[1]).toEqual(["Pizza", "12.50", "PIZ-01"]);
      expect(rows[2]).toEqual(["Ensalada", "6.00", "ENS-01"]);
    });

    it("debe autodetectar y parsear delimitador por punto y coma (;)", () => {
      const rawCsv = `Nombre;Precio;SKU\r\nCafé Americano;2,50;CAF-01\r\nTé Verde;3,00;TE-01`;
      const rows = parseCSVToRawRows(rawCsv);

      expect(rows.length).toBe(3);
      expect(rows[0]).toEqual(["Nombre", "Precio", "SKU"]);
      expect(rows[1]).toEqual(["Café Americano", "2,50", "CAF-01"]);
      expect(rows[2]).toEqual(["Té Verde", "3,00", "TE-01"]);
    });

    it("debe respetar comillas con delimitadores y saltos de línea internos", () => {
      const rawCsv = `Nombre,Descripción,Precio\n"Sandwich, Especial","Pan brioche,\nqueso derretido",8.50`;
      const rows = parseCSVToRawRows(rawCsv);

      expect(rows.length).toBe(2);
      expect(rows[1][0]).toBe("Sandwich, Especial");
      expect(rows[1][1]).toContain("Pan brioche,\nqueso derretido");
      expect(rows[1][2]).toBe("8.50");
    });

    it("debe ignorar Byte Order Mark (BOM) inicial", () => {
      const rawCsvWithBom = `\uFEFFNombre,Precio\nAgua,1.00`;
      const rows = parseCSVToRawRows(rawCsvWithBom);

      expect(rows[0][0]).toBe("Nombre");
    });
  });

  // ----------------------------------------------------------------------------
  // 3. validateProductsCSV
  // ----------------------------------------------------------------------------
  describe("validateProductsCSV", () => {
    const existingProductsList: Product[] = [
      {
        id: "prod-1",
        business_id: TEST_BUSINESS_ID,
        name: "Limonada Natural",
        price: 3.5,
        is_available: true,
        metadata: { sku: "BEB-001" },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    it("debe clasificar filas válidas e identificar actualizaciones por SKU existente", () => {
      const csv = `Nombre,Categoría,Precio,Costo,SKU,Disponible,Stock
Limonada Grande,Bebidas,4.50,1.20,BEB-001,Sí,30
Pizza Familiar,Pizzas,18.00,7.00,PIZ-100,Sí,10`;

      const result = validateProductsCSV(csv, existingProductsList);

      expect(result.totalRows).toBe(2);
      expect(result.validRows.length).toBe(2);
      expect(result.invalidRows.length).toBe(0);

      // Fila 1: BEB-001 ya existe -> action 'update'
      const row1 = result.validRows[0];
      expect(row1.action).toBe("update");
      expect(row1.existingProductId).toBe("prod-1");
      expect(row1.sku).toBe("BEB-001");
      expect(row1.price).toBe(4.5);

      // Fila 2: PIZ-100 no existe -> action 'create'
      const row2 = result.validRows[1];
      expect(row2.action).toBe("create");
      expect(row2.existingProductId).toBeUndefined();
      expect(row2.categoryName).toBe("Pizzas");

      expect(result.existingSkusCount).toBe(1);
    });

    it("debe reportar errores por fila sin invalidar filas correctas", () => {
      const csv = `Nombre,Precio,Costo,Stock
,10.00,5.00,20
Papas Fritas,-5.00,2.00,10
Costillas BBQ,25.00,-3.00,10
Cerveza Corona,4.00,1.50,-8
Tacos de Pollo,8.50,3.00,15`;

      const result = validateProductsCSV(csv, existingProductsList);

      expect(result.totalRows).toBe(5);
      expect(result.validRows.length).toBe(1); // Solo "Tacos de Pollo" es 100% válida
      expect(result.invalidRows.length).toBe(4);

      // Fila 2 (sin nombre)
      const errRow1 = result.invalidRows.find((r) => r.rowNumber === 2);
      expect(errRow1?.errors).toContain("El nombre del producto es obligatorio.");

      // Fila 3 (precio negativo)
      const errRow2 = result.invalidRows.find((r) => r.rowNumber === 3);
      expect(errRow2?.errors.some((e) => e.includes("precio"))).toBe(true);

      // Fila 4 (costo negativo)
      const errRow3 = result.invalidRows.find((r) => r.rowNumber === 4);
      expect(errRow3?.errors.some((e) => e.includes("costo"))).toBe(true);

      // Fila 5 (stock negativo)
      const errRow4 = result.invalidRows.find((r) => r.rowNumber === 5);
      expect(errRow4?.errors.some((e) => e.includes("stock"))).toBe(true);

      // Fila 6 (válida)
      expect(result.validRows[0].name).toBe("Tacos de Pollo");
      expect(result.validRows[0].price).toBe(8.5);
    });

    it("debe normalizar nombres de cabeceras en diferentes formatos (mayúsculas, acentos)", () => {
      const csv = `PRODUCTO,PRECIO,CODIGO,EXISTENCIAS,ESTADO
Arepa con queso,5.00,ARE-01,10,Activo`;

      const result = validateProductsCSV(csv);
      expect(result.validRows.length).toBe(1);
      const row = result.validRows[0];
      expect(row.name).toBe("Arepa con queso");
      expect(row.price).toBe(5.0);
      expect(row.sku).toBe("ARE-01");
      expect(row.stockQuantity).toBe(10);
      expect(row.isAvailable).toBe(true);
    });
  });

  // ----------------------------------------------------------------------------
  // 4. importProductsBatch
  // ----------------------------------------------------------------------------
  describe("importProductsBatch", () => {
    it("debe impedir la importación si la cantidad de nuevos productos supera el límite del plan", async () => {
      mockPlanCheckResult = {
        allowed: false,
        currentCount: 10,
        maxProducts: 10,
        planName: "Plan Gratuito",
        error: "Has alcanzado el límite máximo de 10 productos para tu plan.",
      };

      const validRows = [
        {
          rowNumber: 2,
          name: "Producto Excedente",
          price: 15,
          isAvailable: true,
          action: "create" as const,
          isValid: true,
          errors: [],
        },
      ];

      await expect(importProductsBatch(TEST_BUSINESS_ID, validRows)).rejects.toThrow(
        /límite máximo/i
      );
    });

    it("debe crear nuevas categorías automáticamente e importar productos nuevos y actualizados", async () => {
      const validRows = [
        {
          rowNumber: 2,
          name: "Limonada Natural Nueva",
          categoryName: "Bebidas", // Categoría existente
          price: 4.0,
          cost: 1.2,
          sku: "BEB-001",
          stockQuantity: 40,
          isAvailable: true,
          action: "update" as const,
          existingProductId: "prod-1",
          isValid: true,
          errors: [],
        },
        {
          rowNumber: 3,
          name: "Pastel de Chocolate",
          categoryName: "Postres Artesanales", // Categoría NO existente -> debe autocrearse
          price: 6.5,
          cost: 2.5,
          sku: "POS-001",
          stockQuantity: 12,
          isAvailable: true,
          action: "create" as const,
          isValid: true,
          errors: [],
        },
      ];

      const result = await importProductsBatch(TEST_BUSINESS_ID, validRows);

      expect(result.success).toBe(true);
      expect(result.createdCount).toBe(1);
      expect(result.updatedCount).toBe(1);
      expect(result.failedCount).toBe(0);

      // Verificar que se autocreó la categoría "Postres Artesanales"
      const createdCategory = inMemoryCategories.find((c) => c.name === "Postres Artesanales");
      expect(createdCategory).toBeDefined();

      // Verificar actualización en memoria de Limonada
      const updatedProd = inMemoryProducts.find((p) => p.id === "prod-1");
      expect(updatedProd?.name).toBe("Limonada Natural Nueva");
      expect(updatedProd?.price).toBe(4.0);
      expect(updatedProd?.metadata.stock_quantity).toBe(40);

      // Verificar inserción en memoria del Pastel
      const newProd = inMemoryProducts.find((p) => p.name === "Pastel de Chocolate");
      expect(newProd).toBeDefined();
      expect(newProd?.category_id).toBe(createdCategory?.id);

      // Verificar sincronización en inventory_stock (INV-001)
      expect(inMemoryStockUpserts.length).toBe(2);
      expect(inMemoryStockUpserts.some((s) => s.productId === "prod-1" && s.quantity === 40)).toBe(true);
    });

    it("no debe bloquear los registros correctos si una fila falla en base de datos", async () => {
      const validRows = [
        {
          rowNumber: 2,
          name: "Producto Que Fallará",
          price: 10,
          isAvailable: true,
          action: "create" as const,
          isValid: true,
          errors: [],
        },
        {
          rowNumber: 3,
          name: "Producto Exitoso",
          price: 20,
          isAvailable: true,
          action: "create" as const,
          isValid: true,
          errors: [],
        },
      ];

      // Simulamos que el primer producto falla al insertarse
      const originalProducts = [...inMemoryProducts];
      const productsService = await import("../../src/lib/products/products-service");
      let callCount = 0;
      vi.spyOn(productsService, "getDbClient").mockResolvedValueOnce({
        from: (table: string) => ({
          insert: (data: any) => ({
            select: () => ({
              single: async () => {
                callCount++;
                if (callCount === 1) {
                  return { data: null, error: { message: "Simulated DB constraint error" } };
                }
                const inserted = { ...data, id: "prod-success" };
                inMemoryProducts.push(inserted);
                return { data: inserted, error: null };
              },
            }),
          }),
        }),
      } as any);

      const result = await importProductsBatch(TEST_BUSINESS_ID, validRows);

      expect(result.createdCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].rowNumber).toBe(2);
      expect(result.errors[0].error).toContain("Simulated DB constraint error");
    });
  });
});
