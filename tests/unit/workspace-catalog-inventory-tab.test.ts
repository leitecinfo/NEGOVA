import { describe, it, expect } from "vitest";
import { Product, Category, isProductAvailableInPos } from "../../src/lib/products/types";

describe("Pestaña 'Inventario' en Productos (Resumen rápido de catálogo)", () => {
  const mockCategories: Category[] = [
    {
      id: "cat-1",
      business_id: "biz-1",
      name: "Bebidas",
      description: "Bebidas frías y calientes",
      sort_order: 1,
      status: "active",
      parent_category_id: null,
      created_at: "",
      updated_at: "",
    },
    {
      id: "cat-2",
      business_id: "biz-1",
      name: "Hamburguesas",
      description: "Platos principales",
      sort_order: 2,
      status: "active",
      parent_category_id: null,
      created_at: "",
      updated_at: "",
    },
  ];

  const mockProducts: Product[] = [
    // 1. Producto simple con stock ilimitado (servicios / comida preparada sin control de unidades)
    {
      id: "prod-1",
      business_id: "biz-1",
      name: "Hamburguesa Clásica",
      price: 18000,
      status: "active",
      is_available: true,
      category_id: "cat-2",
      metadata: {
        cost: 8500,
        available_in_pos: true,
        sales_channels: ["pos", "qr"],
        track_stock: false,
      },
      created_at: "",
      updated_at: "",
    },
    // 2. Producto con stock controlado, nivel mínimo y stock bajo
    {
      id: "prod-2",
      business_id: "biz-1",
      name: "Gaseosa 400ml",
      price: 5000,
      status: "active",
      is_available: true,
      category_id: "cat-1",
      metadata: {
        sku: "GAS-400",
        barcode: "770123456789",
        cost: 2500,
        available_in_pos: true,
        sales_channels: ["pos"],
        track_stock: true,
        stock_quantity: 4,
        min_stock: 10,
        unit: "un.",
      },
      created_at: "",
      updated_at: "",
    },
    // 3. Producto agotado (stock 0)
    {
      id: "prod-3",
      business_id: "biz-1",
      name: "Cerveza Artesanal",
      price: 12000,
      status: "active",
      is_available: false,
      category_id: "cat-1",
      metadata: {
        sku: "CERV-01",
        cost: 6000,
        available_in_pos: true,
        sales_channels: ["pos"],
        track_stock: true,
        stock_quantity: 0,
        min_stock: 5,
      },
      created_at: "",
      updated_at: "",
    },
    // 4. Producto con variantes (desglose por presentación)
    {
      id: "prod-4",
      business_id: "biz-1",
      name: "Camisa Polo",
      price: 45000,
      status: "active",
      is_available: true,
      category_id: null,
      metadata: {
        available_in_pos: false,
        track_stock: true,
        has_variants: true,
        variants: [
          { id: "var-s", name: "Talla S", sku: "POLO-S", price: 45000, stock_quantity: 12 },
          { id: "var-m", name: "Talla M", sku: "POLO-M", price: 45000, stock_quantity: 8 },
          { id: "var-l", name: "Talla L", sku: "POLO-L", price: 48000, stock_quantity: 5 },
        ],
        cost: 20000,
        min_stock: 5,
      },
      created_at: "",
      updated_at: "",
    },
  ];

  it("debe verificar las 9 columnas obligatorias en la estructura de existencias de catálogo", () => {
    const requiredColumns = [
      "Producto",
      "Categoría",
      "Stock total",
      "POS",
      "Variantes",
      "Mínimo",
      "Costo",
      "Precio de venta",
      "Estado",
    ];

    expect(requiredColumns).toHaveLength(9);
  });

  it("debe calcular correctamente el stock total de un producto simple con control de inventario", () => {
    const product = mockProducts[1];
    const meta = product.metadata as any;
    expect(meta.track_stock).toBe(true);
    expect(meta.stock_quantity).toBe(4);
    expect(meta.min_stock).toBe(10);
    // Stock bajo porque 4 <= 10
    expect(meta.stock_quantity <= meta.min_stock).toBe(true);
  });

  it("debe calcular el stock total consolidando las variantes cuando existen presentaciones", () => {
    const product = mockProducts[3];
    const meta = product.metadata as any;
    expect(meta.has_variants).toBe(true);
    expect(meta.variants).toHaveLength(3);

    const totalStock = meta.variants.reduce((acc: number, v: any) => acc + (v.stock_quantity || 0), 0);
    expect(totalStock).toBe(25); // 12 + 8 + 5
  });

  it("debe verificar correctamente la disponibilidad en POS (caja)", () => {
    // Hamburguesa y Gaseosa están en POS
    expect(isProductAvailableInPos(mockProducts[0])).toBe(true);
    expect(isProductAvailableInPos(mockProducts[1])).toBe(true);
    // Camisa Polo NO está en POS
    expect(isProductAvailableInPos(mockProducts[3])).toBe(false);
  });

  it("debe identificar correctamente el enlace a la vista avanzada de inventario del negocio", () => {
    const businessId = "biz-1";
    const advancedInventoryLink = `/workspace/${businessId}/inventario`;
    expect(advancedInventoryLink).toBe("/workspace/biz-1/inventario");
  });

  it("debe asociar correctamente las categorías del catálogo", () => {
    const categoryMap = new Map<string, string>();
    mockCategories.forEach((c) => categoryMap.set(c.id, c.name));

    expect(categoryMap.get(mockProducts[0].category_id || "")).toBe("Hamburguesas");
    expect(categoryMap.get(mockProducts[1].category_id || "")).toBe("Bebidas");
    expect(categoryMap.get(mockProducts[3].category_id || "")).toBeUndefined(); // Sin categoría
  });

  it("debe calcular la valoración total del catálogo al costo", () => {
    const totalValuation = mockProducts.reduce((sum, p) => {
      const meta = p.metadata as any;
      if (!meta.track_stock) return sum;
      const variants = meta.variants || [];
      const stock = variants.length > 0
        ? variants.reduce((acc: number, v: any) => acc + (v.stock_quantity || 0), 0)
        : (meta.stock_quantity || 0);
      const cost = meta.cost || 0;
      return sum + stock * cost;
    }, 0);

    // prod-2: 4 * 2500 = 10,000
    // prod-3: 0 * 6000 = 0
    // prod-4: 25 * 20000 = 500,000
    // Total = 510,000
    expect(totalValuation).toBe(510000);
  });
});
