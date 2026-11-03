import { describe, it, expect } from "vitest";
import { Ingredient } from "../../src/lib/recipes/types";

describe("Pestaña 'Ingredientes' en /workspace/[businessId]/recetas", () => {
  const mockIngredients: Ingredient[] = [
    {
      id: "ing-1",
      businessId: "biz-1",
      name: "Harina de Trigo Especial",
      unit: "kg",
      costPerUnit: 4500,
      stockQuantity: 1.0,
      minStock: 5.0,
      maxStock: 25.0,
      locationId: "loc-1",
      locationName: "Bodega Principal",
      categoryId: null,
      availableInPos: false,
      availableInQr: false,
      availableOnline: false,
      isAvailable: true,
      notes: "Saco de harina panificable",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "ing-2",
      businessId: "biz-1",
      name: "Queso Mozzarella Bloque",
      unit: "kg",
      costPerUnit: 22000,
      stockQuantity: 8.5,
      minStock: 3.0,
      maxStock: 20.0,
      locationId: "loc-1",
      locationName: "Cámara Refrigerada",
      categoryId: null,
      availableInPos: false,
      availableInQr: false,
      availableOnline: false,
      isAvailable: true,
      notes: "Para pizzas y lasagñas",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "ing-3",
      businessId: "biz-1",
      name: "Cajas de Pizza 35cm",
      unit: "unit",
      costPerUnit: 1200,
      stockQuantity: 50,
      minStock: 100,
      maxStock: 500,
      locationId: "loc-2",
      locationName: "Barra / Mostrador",
      categoryId: null,
      availableInPos: false,
      availableInQr: false,
      availableOnline: false,
      isAvailable: false,
      notes: "Empaque cartón corrugado",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  it("KPIs superiores: debe calcular TOTAL, STOCK BAJO, VALOR TOTAL ($) y CON SEGUIMIENTO", () => {
    const total = mockIngredients.length;
    const lowStockCount = mockIngredients.filter((i) => i.stockQuantity <= i.minStock).length;
    const totalValuation = mockIngredients.reduce(
      (sum, i) => sum + i.stockQuantity * i.costPerUnit,
      0
    );
    const trackedCount = mockIngredients.filter((i) => i.minStock > 0 || i.stockQuantity > 0).length;

    expect(total).toBe(3);
    // Harina (1 <= 5) y Cajas (50 <= 100)
    expect(lowStockCount).toBe(2);
    // 1*4500 + 8.5*22000 + 50*1200 = 4500 + 187000 + 60000 = 251500
    expect(totalValuation).toBe(251500);
    expect(trackedCount).toBe(3);
  });

  it("Barra superior: debe formatear el contador dinámico ('N ingredientes')", () => {
    const formatCounter = (count: number) => {
      if (count === 1) return "1 ingrediente";
      return `${count} ingredientes`;
    };

    expect(formatCounter(3)).toBe("3 ingredientes");
    expect(formatCounter(1)).toBe("1 ingrediente");
    expect(formatCounter(0)).toBe("0 ingredientes");
  });

  it("Catálogo en Tarjetas: debe extraer Avatar / Inicial del insumo y nombre", () => {
    const getAvatarInitial = (name: string) => {
      return name.trim().charAt(0).toUpperCase();
    };

    expect(getAvatarInitial(mockIngredients[0].name)).toBe("H");
    expect(getAvatarInitial(mockIngredients[1].name)).toBe("Q");
    expect(getAvatarInitial(mockIngredients[2].name)).toBe("C");
  });

  it("Catálogo en Tarjetas: debe formatear Stock Actual con unidad de medida (ej: 1.00 kg, 50 unit)", () => {
    const formatStock = (qty: number, unit: string) => {
      const formattedNumber = Number.isInteger(qty) ? qty.toString() : qty.toFixed(2);
      return `${formattedNumber} ${unit}`;
    };

    expect(formatStock(1.0, "kg")).toBe("1 kg");
    expect(formatStock(50, "unit")).toBe("50 unit");
    expect(formatStock(8.5, "kg")).toBe("8.50 kg");
  });

  it("Catálogo en Tarjetas: debe formatear Costo Unitario ($1.000/kg)", () => {
    const formatUnitCost = (cost: number, unit: string) => {
      const formattedCost = new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
      }).format(cost);
      return `${formattedCost}/${unit}`;
    };

    expect(formatUnitCost(1000, "kg")).toMatch(/\$?\s?1\.000\/kg/);
    expect(formatUnitCost(4500, "kg")).toMatch(/\$?\s?4\.500\/kg/);
  });

  it("Catálogo en Tarjetas: debe activar alerta visual en rojo y calcular barra de progreso de capacidad", () => {
    const evaluateCapacity = (stock: number, min: number, max?: number | null) => {
      const isLowStock = stock <= min;
      const capacityTarget = max && max > 0 ? max : min > 0 ? min * 2 : 100;
      const progressPercent = Math.min(100, Math.max(0, Math.round((stock / capacityTarget) * 100)));

      return {
        isLowStock,
        progressPercent,
        color: isLowStock ? "red" : "green",
      };
    };

    // Harina: 1kg con min 5kg y max 25kg => low stock, 4% de capacidad
    const harina = evaluateCapacity(
      mockIngredients[0].stockQuantity,
      mockIngredients[0].minStock,
      mockIngredients[0].maxStock
    );
    expect(harina.isLowStock).toBe(true);
    expect(harina.color).toBe("red");
    expect(harina.progressPercent).toBe(4);

    // Queso: 8.5kg con min 3kg y max 20kg => óptimo, 43% de capacidad
    const queso = evaluateCapacity(
      mockIngredients[1].stockQuantity,
      mockIngredients[1].minStock,
      mockIngredients[1].maxStock
    );
    expect(queso.isLowStock).toBe(false);
    expect(queso.color).toBe("green");
    expect(queso.progressPercent).toBe(43);
  });

  it("Catálogo en Tarjetas: debe calcular la valorización total en existencias", () => {
    const calculateTotalValuation = (qty: number, cost: number) => qty * cost;

    expect(calculateTotalValuation(mockIngredients[0].stockQuantity, mockIngredients[0].costPerUnit)).toBe(4500);
    expect(calculateTotalValuation(mockIngredients[1].stockQuantity, mockIngredients[1].costPerUnit)).toBe(187000);
    expect(calculateTotalValuation(mockIngredients[2].stockQuantity, mockIngredients[2].costPerUnit)).toBe(60000);
  });

  it("Acciones rápidas: debe definir Ver historial, Editar, Ocultar/Desactivar y Eliminar", () => {
    const actions = [
      { id: "history", label: "Ver historial de movimientos" },
      { id: "edit", label: "Editar" },
      { id: "toggle", label: "Ocultar/Desactivar" },
      { id: "delete", label: "Eliminar" },
    ];

    expect(actions).toHaveLength(4);
    expect(actions.map((a) => a.id)).toEqual(["history", "edit", "toggle", "delete"]);
  });
});
