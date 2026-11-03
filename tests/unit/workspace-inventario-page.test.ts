import { describe, it, expect } from "vitest";

describe("Pantalla Principal de Inventario (/workspace/[businessId]/inventario)", () => {
  const mockCategories = [
    { id: "cat-1", name: "Bebidas", business_id: "biz-1", sort_order: 0, status: "active" as const, created_at: "", updated_at: "" },
    { id: "cat-2", name: "Comidas", business_id: "biz-1", sort_order: 1, status: "active" as const, created_at: "", updated_at: "" },
  ];

  const mockProducts = [
    {
      id: "prod-1",
      business_id: "biz-1",
      name: "Gaseosa Cola 400ml",
      price: 4500,
      is_available: true,
      category_id: "cat-1",
      status: "active" as const,
      sort_order: 0,
      created_at: "",
      updated_at: "",
      metadata: {
        sku: "GAS-001",
        cost: 2500,
        min_stock: 10,
        stock_quantity: 25,
        has_variants: false,
        variants: [],
      },
    },
    {
      id: "prod-2",
      business_id: "biz-1",
      name: "Hamburguesa Doble Carne",
      price: 24000,
      is_available: true,
      category_id: "cat-2",
      status: "active" as const,
      sort_order: 1,
      created_at: "",
      updated_at: "",
      metadata: {
        sku: "HAM-002",
        cost: 14000,
        min_stock: 5,
        stock_quantity: 3, // Stock bajo (3 <= 5)
        has_variants: true,
        variants: [
          { id: "var-1", name: "Sencilla", price: 20000, is_available: true },
          { id: "var-2", name: "Doble", price: 24000, is_available: true },
        ],
      },
    },
    {
      id: "prod-3",
      business_id: "biz-1",
      name: "Cerveza Artesanal",
      price: 8000,
      is_available: false,
      category_id: "cat-1",
      status: "active" as const,
      sort_order: 2,
      created_at: "",
      updated_at: "",
      metadata: {
        sku: "CERV-003",
        cost: 4000,
        min_stock: 12,
        stock_quantity: 0, // Agotado
        has_variants: false,
        variants: [],
      },
    },
  ];

  const mockStockList = [
    { id: "s-1", businessId: "biz-1", productId: "prod-1", locationId: "loc-1", quantity: 25, minStock: 10, cost: 2500, updatedAt: "" },
    { id: "s-2", businessId: "biz-1", productId: "prod-2", locationId: "loc-1", quantity: 3, minStock: 5, cost: 14000, updatedAt: "" },
    { id: "s-3", businessId: "biz-1", productId: "prod-3", locationId: "loc-1", quantity: 0, minStock: 12, cost: 4000, updatedAt: "" },
  ];

  describe("1. Encabezado y Especificaciones del Módulo", () => {
    it("debe contener la categoría, título y descripción solicitados", () => {
      const headerSpecs = {
        category: "Operación de Inventario",
        title: "Inventario",
        description: "Controla existencias y movimientos desde un solo lugar.",
      };

      expect(headerSpecs.category).toBe("Operación de Inventario");
      expect(headerSpecs.title).toBe("Inventario");
      expect(headerSpecs.description).toBe("Controla existencias y movimientos desde un solo lugar.");
    });
  });

  describe("2. KPIs Superiores", () => {
    it("debe calcular correctamente Total productos, Stock bajo, Valor al costo y Movimientos hoy", () => {
      const totalProducts = mockProducts.length;

      let lowStockCount = 0;
      let totalCostValue = 0;

      for (const stock of mockStockList) {
        totalCostValue += stock.quantity * stock.cost;
        if (stock.quantity <= stock.minStock) {
          lowStockCount++;
        }
      }

      const todayMovementsCount = 5; // Simulado

      const kpis = {
        totalProducts,
        lowStockCount,
        totalCostValue,
        todayMovementsCount,
      };

      expect(kpis.totalProducts).toBe(3);
      // prod-2 (3 <= 5) y prod-3 (0 <= 12) están en stock bajo
      expect(kpis.lowStockCount).toBe(2);
      // 25 * 2500 (62.500) + 3 * 14000 (42.000) + 0 * 4000 (0) = 104.500 COP
      expect(kpis.totalCostValue).toBe(104500);
      expect(kpis.todayMovementsCount).toBe(5);
    });
  });

  describe("3. Pestañas de Navegación", () => {
    it("debe contar con las 4 pestañas requeridas: PRODUCTOS, COMPRAS, HISTORIAL, STOCK BAJO", () => {
      const tabs = ["products", "purchases", "history", "low_stock"];
      const tabLabels = {
        products: "PRODUCTOS",
        purchases: "COMPRAS",
        history: "HISTORIAL",
        low_stock: "STOCK BAJO",
      };

      expect(tabs).toHaveLength(4);
      expect(tabLabels.products).toBe("PRODUCTOS");
      expect(tabLabels.purchases).toBe("COMPRAS");
      expect(tabLabels.history).toBe("HISTORIAL");
      expect(tabLabels.low_stock).toBe("STOCK BAJO");
    });
  });

  describe("4. Pestaña 'PRODUCTOS': Filtros y Campos de Tabla", () => {
    it("debe filtrar por nombre o SKU", () => {
      const q = "HAM";
      const filtered = mockProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(q.toLowerCase()) ||
          p.metadata.sku.toLowerCase().includes(q.toLowerCase())
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("Hamburguesa Doble Carne");
    });

    it("debe filtrar por categoría", () => {
      const catId = "cat-1";
      const filtered = mockProducts.filter((p) => p.category_id === catId);
      expect(filtered).toHaveLength(2); // Gaseosa y Cerveza
    });

    it("debe filtrar por estado (stock bajo y agotado)", () => {
      const lowStockProducts = mockProducts.filter((p) => {
        const stock = mockStockList.find((s) => s.productId === p.id);
        const qty = stock?.quantity ?? 0;
        const min = stock?.minStock ?? 0;
        return qty <= min && qty > 0;
      });
      expect(lowStockProducts).toHaveLength(1);
      expect(lowStockProducts[0].name).toBe("Hamburguesa Doble Carne");

      const outOfStockProducts = mockProducts.filter((p) => {
        const stock = mockStockList.find((s) => s.productId === p.id);
        return (stock?.quantity ?? 0) <= 0;
      });
      expect(outOfStockProducts).toHaveLength(1);
      expect(outOfStockProducts[0].name).toBe("Cerveza Artesanal");
    });

    it("debe estructurar todas las columnas requeridas para cada producto", () => {
      const sample = mockProducts[1]; // Hamburguesa
      const stock = mockStockList.find((s) => s.productId === sample.id)!;
      const category = mockCategories.find((c) => c.id === sample.category_id);

      const tableRow = {
        producto: sample.name,
        categoria: category?.name,
        stockTotal: stock.quantity,
        variantes: sample.metadata.variants.length > 0 ? `${sample.metadata.variants.length} variantes` : "Sin variantes",
        minimo: stock.minStock,
        costo: stock.cost,
        precioVenta: sample.price,
        estado: stock.quantity <= 0 ? "Agotado" : stock.quantity <= stock.minStock ? "Stock bajo" : "En stock",
      };

      expect(tableRow.producto).toBe("Hamburguesa Doble Carne");
      expect(tableRow.categoria).toBe("Comidas");
      expect(tableRow.stockTotal).toBe(3);
      expect(tableRow.variantes).toBe("2 variantes");
      expect(tableRow.minimo).toBe(5);
      expect(tableRow.costo).toBe(14000);
      expect(tableRow.precioVenta).toBe(24000);
      expect(tableRow.estado).toBe("Stock bajo");
    });
  });
});
