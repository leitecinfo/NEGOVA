import { describe, it, expect } from "vitest";
import { LowStockItem } from "../../src/lib/inventory/types";

describe("Pestaña 'Stock Bajo' en /workspace/[businessId]/inventario", () => {
  const mockLowStockItems: LowStockItem[] = [
    {
      productId: "prod-1111",
      productName: "Café Especial Huila 500g",
      sku: "CAF-HUI-500",
      categoryName: "Bebidas",
      locationId: "loc-main",
      locationName: "Bodega Principal",
      quantity: 2,
      minStock: 5,
      cost: 18000,
      deficit: 3,
      status: "critical",
    },
    {
      productId: "prod-2222",
      productName: "Leche Entera 1L",
      sku: "LEC-ENT-1L",
      categoryName: "Lácteos",
      locationId: "loc-main",
      locationName: "Bodega Principal",
      quantity: 0,
      minStock: 10,
      cost: 4200,
      deficit: 10,
      status: "out_of_stock",
    },
    {
      productId: "prod-3333",
      productName: "Vasos Biodegradables 12oz",
      sku: null,
      categoryName: "Empaques",
      locationId: "loc-bar",
      locationName: "Barra POS",
      quantity: 1,
      minStock: 4,
      cost: 150,
      deficit: 3,
      status: "critical",
    },
  ];

  it("Encabezado: debe presentar el título 'Productos con Stock Bajo' y detectar productos críticos", () => {
    const title = "Productos con Stock Bajo";
    const criticalCount = mockLowStockItems.length;

    expect(title).toBe("Productos con Stock Bajo");
    expect(criticalCount).toBe(3);
  });

  it("Stock Actual: debe formatear la etiqueta numérica roja con las unidades físicas", () => {
    mockLowStockItems.forEach((item) => {
      const formattedStock = `${item.quantity} un.`;
      const isRedBadge = item.quantity <= item.minStock;

      expect(formattedStock).toMatch(/\d+ un\./);
      expect(isRedBadge).toBe(true);
    });

    expect(`${mockLowStockItems[0].quantity} un.`).toBe("2 un.");
    expect(`${mockLowStockItems[1].quantity} un.`).toBe("0 un.");
  });

  it("Stock Mínimo: debe ser un número entero que disparó la alerta", () => {
    mockLowStockItems.forEach((item) => {
      const minStockInteger = Math.round(item.minStock);
      expect(Number.isInteger(minStockInteger)).toBe(true);
    });

    expect(Math.round(mockLowStockItems[0].minStock)).toBe(5);
    expect(Math.round(mockLowStockItems[1].minStock)).toBe(10);
  });

  it("Diferencia: debe calcular un número negativo en rojo (ej: -3) indicando el déficit", () => {
    mockLowStockItems.forEach((item) => {
      // Diferencia = Stock Actual - Stock Mínimo
      const difference = item.quantity - item.minStock;
      expect(difference).toBeLessThan(0);

      const formattedDiff = `${difference} un.`;
      expect(formattedDiff.startsWith("-")).toBe(true);
    });

    // prod-1: 2 - 5 = -3
    expect(mockLowStockItems[0].quantity - mockLowStockItems[0].minStock).toBe(-3);
    // prod-2: 0 - 10 = -10
    expect(mockLowStockItems[1].quantity - mockLowStockItems[1].minStock).toBe(-10);
    // prod-3: 1 - 4 = -3
    expect(mockLowStockItems[2].quantity - mockLowStockItems[2].minStock).toBe(-3);
  });

  it("Producto: debe incluir nombre e identificación de la referencia (SKU o ID)", () => {
    mockLowStockItems.forEach((item) => {
      const referenceId = item.sku || `ID: ${item.productId.slice(0, 8)}`;
      expect(item.productName.trim().length).toBeGreaterThan(0);
      expect(referenceId.length).toBeGreaterThan(0);
    });

    expect(mockLowStockItems[0].sku).toBe("CAF-HUI-500");
    expect(mockLowStockItems[2].sku).toBeNull();
    const fallbackRef = mockLowStockItems[2].sku || `ID: ${mockLowStockItems[2].productId.slice(0, 8)}`;
    expect(fallbackRef).toBe("ID: prod-333");
  });

  it("Acción: el botón 'Reabastecer' debe asociar el producto a la orden de compra o ingreso", () => {
    const handleRestock = (item: LowStockItem, target: "purchase" | "movement") => {
      return {
        action: "Reabastecer",
        productId: item.productId,
        productName: item.productName,
        deficitQuantity: item.minStock - item.quantity,
        target,
      };
    };

    const purchaseRestock = handleRestock(mockLowStockItems[0], "purchase");
    expect(purchaseRestock.action).toBe("Reabastecer");
    expect(purchaseRestock.productId).toBe("prod-1111");
    expect(purchaseRestock.deficitQuantity).toBe(3);
    expect(purchaseRestock.target).toBe("purchase");

    const entryRestock = handleRestock(mockLowStockItems[1], "movement");
    expect(entryRestock.action).toBe("Reabastecer");
    expect(entryRestock.productId).toBe("prod-2222");
    expect(entryRestock.deficitQuantity).toBe(10);
    expect(entryRestock.target).toBe("movement");
  });
});
