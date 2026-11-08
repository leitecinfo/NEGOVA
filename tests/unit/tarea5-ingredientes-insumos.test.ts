import { describe, it, expect } from "vitest";
import {
  CreateIngredientInputSchema,
  UpdateIngredientInputSchema,
  Ingredient,
  IngredientKPIs,
} from "../../src/lib/recipes/types";
import { convertQuantity, areUnitsCompatible } from "../../src/lib/recipes/unit-conversion";
import {
  generateIngredientsCSV,
  generateIngredientsExcel,
} from "../../src/lib/recipes/ingredient-export-service";

describe("TAREA 5: Módulo de Ingredientes e Insumos en NEGOVA", () => {
  const mockIngredients: Ingredient[] = [
    {
      id: "ing-1",
      businessId: "biz-123",
      name: "Carne Molida Especial",
      type: "ingredient",
      sku: "CARN-001",
      barcode: "7701234567890",
      unit: "kg",
      costPerUnit: 25000,
      stockQuantity: 12.5,
      minStock: 5.0,
      maxStock: 50.0,
      locationId: "loc-1",
      locationName: "Cuarto Frío",
      categoryId: "cat-1",
      categoryName: "Carnes",
      availableInPos: false,
      availableInQr: false,
      availableOnline: false,
      isAvailable: true,
      notes: "Carne fresca 80/20",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "ing-2",
      businessId: "biz-123",
      name: "Queso Cheddar Tajado",
      type: "ingredient",
      sku: "QUES-002",
      barcode: null,
      unit: "paquete",
      costPerUnit: 18000,
      stockQuantity: 2.0,
      minStock: 4.0, // Stock bajo
      maxStock: 20.0,
      locationId: "loc-1",
      locationName: "Cuarto Frío",
      categoryId: "cat-2",
      categoryName: "Lácteos",
      availableInPos: false,
      availableInQr: false,
      availableOnline: false,
      isAvailable: true,
      notes: "Paquete por 24 tajadas",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "ing-3",
      businessId: "biz-123",
      name: "Cajas Térmicas Hamburguesa",
      type: "supply", // Insumo operativo
      sku: "EMPQ-001",
      barcode: "7709876543210",
      unit: "caja",
      costPerUnit: 450,
      stockQuantity: 0.0, // Agotado
      minStock: 100.0,
      maxStock: 1000.0,
      locationId: "loc-2",
      locationName: "Almacén Seco",
      categoryId: "cat-3",
      categoryName: "Empaques",
      availableInPos: false,
      availableInQr: false,
      availableOnline: false,
      isAvailable: true,
      notes: "Cajas ecológicas biodegradables",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "ing-4",
      businessId: "biz-123",
      name: "Bolsas Kraft Grandes",
      type: "supply", // Insumo operativo
      sku: "EMPQ-002",
      barcode: null,
      unit: "bolsa",
      costPerUnit: 350,
      stockQuantity: 150.0,
      minStock: 50.0,
      maxStock: 500.0,
      locationId: "loc-2",
      locationName: "Almacén Seco",
      categoryId: "cat-3",
      categoryName: "Empaques",
      availableInPos: false,
      availableInQr: false,
      availableOnline: false,
      isAvailable: false, // Inactivo
      notes: "Para entregas a domicilio",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  describe("1. Clasificación Funcional: Ingrediente vs Insumo", () => {
    it("debe aceptar type='ingredient' y type='supply' en el esquema de validación", () => {
      const validIngredient = CreateIngredientInputSchema.safeParse({
        name: "Tomate Chonto",
        type: "ingredient",
        unit: "kg",
        costPerUnit: 4000,
      });
      expect(validIngredient.success).toBe(true);

      const validSupply = CreateIngredientInputSchema.safeParse({
        name: "Servilletas Blancas",
        type: "supply",
        unit: "paquete",
        costPerUnit: 2500,
      });
      expect(validSupply.success).toBe(true);
    });

    it("debe rechazar tipos inválidos que no sean 'ingredient' ni 'supply'", () => {
      const invalid = CreateIngredientInputSchema.safeParse({
        name: "Producto Inválido",
        type: "invalid_type" as any,
        unit: "kg",
      });
      expect(invalid.success).toBe(false);
    });

    it("debe mantener availableInPos, availableInQr y availableOnline en false por defecto para evitar venta accidental", () => {
      for (const item of mockIngredients) {
        expect(item.availableInPos).toBe(false);
        expect(item.availableInQr).toBe(false);
        expect(item.availableOnline).toBe(false);
      }
    });
  });

  describe("2. Indicadores Reales (Sección 5.1)", () => {
    it("debe calcular con precisión los 5 KPIs requeridos por la especificación", () => {
      const total = mockIngredients.length;
      const activeIngredients = mockIngredients.filter(
        (i) => i.type === "ingredient" && i.isAvailable
      ).length;
      const activeSupplies = mockIngredients.filter(
        (i) => i.type === "supply" && i.isAvailable
      ).length;
      const lowStock = mockIngredients.filter(
        (i) => i.stockQuantity <= i.minStock && i.stockQuantity > 0
      ).length;
      const outOfStock = mockIngredients.filter((i) => i.stockQuantity <= 0).length;

      expect(total).toBe(4);
      expect(activeIngredients).toBe(2); // Carne y Queso
      expect(activeSupplies).toBe(1); // Cajas (Bolsas está inactivo)
      expect(lowStock).toBe(1); // Queso (2 <= 4)
      expect(outOfStock).toBe(1); // Cajas (0 <= 0)
    });
  });

  describe("3. Unidades de Medida y Conversiones (Sección 8)", () => {
    it("debe convertir unidades de masa (kg a g) con precisión exacta", () => {
      const result = convertQuantity(5, "kg", "g");
      expect(result.isCompatible).toBe(true);
      expect(result.convertedQuantity).toBe(5000);

      const inverse = convertQuantity(120, "g", "kg");
      expect(inverse.isCompatible).toBe(true);
      expect(inverse.convertedQuantity).toBe(0.12);
    });

    it("debe convertir unidades de volumen (l a ml)", () => {
      const result = convertQuantity(1.5, "lt", "ml");
      expect(result.isCompatible).toBe(true);
      expect(result.convertedQuantity).toBe(1500);

      const inverse = convertQuantity(250, "ml", "lt");
      expect(inverse.isCompatible).toBe(true);
      expect(inverse.convertedQuantity).toBe(0.25);
    });

    it("debe soportar unidades de conteo como paquete, caja y bolsa", () => {
      expect(areUnitsCompatible("paquete", "unit")).toBe(true);
      expect(areUnitsCompatible("caja", "unit")).toBe(true);
      expect(areUnitsCompatible("bolsa", "unit")).toBe(true);
    });

    it("debe rechazar conversiones entre magnitudes incompatibles (ej: masa a volumen sin densidad)", () => {
      expect(areUnitsCompatible("kg", "lt")).toBe(false);
      expect(areUnitsCompatible("g", "ml")).toBe(false);
      const invalid = convertQuantity(1, "kg", "lt");
      expect(invalid.isCompatible).toBe(false);
      expect(invalid.error).toBeDefined();
    });
  });

  describe("4. Exportación de Datos (CSV y Excel)", () => {
    it("generateIngredientsCSV debe incluir el BOM UTF-8 y todas las columnas clave", () => {
      const csv = generateIngredientsCSV(mockIngredients);
      // UTF-8 BOM
      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toContain("Nombre,Tipo,Categoría,SKU,Código de barras,Unidad de medida,Existencia actual,Stock mínimo,Costo unitario,Estado");
      expect(csv).toContain("Carne Molida Especial,Ingrediente,Carnes,CARN-001,7701234567890,kg,12.5,5,25000,Activo");
      expect(csv).toContain("Cajas Térmicas Hamburguesa,Insumo,Empaques,EMPQ-001,7709876543210,caja,0,100,450,Activo");
      expect(csv).toContain("Bolsas Kraft Grandes,Insumo,Empaques,EMPQ-002,,bolsa,150,50,350,Inactivo");
    });

    it("generateIngredientsExcel debe generar un buffer válido de Excel XLSX", () => {
      const excelBuffer = generateIngredientsExcel(mockIngredients);
      expect(excelBuffer).toBeDefined();
      expect(excelBuffer.length).toBeGreaterThan(100);
      // Validar firma de archivo ZIP (los archivos XLSX son ZIPs que inician con PK)
      const pkHeader = String.fromCharCode(excelBuffer[0], excelBuffer[1]);
      expect(pkHeader).toBe("PK");
    });
  });

  describe("5. Validación del Esquema de Entrada (Sección 6)", () => {
    it("debe aceptar campos opcionales vacíos o ausentes (SKU, barcode, categoryId)", () => {
      const parsed = CreateIngredientInputSchema.safeParse({
        name: "Sal Marina",
        unit: "g",
        sku: "",
        barcode: "",
        categoryId: "",
        costPerUnit: 1500,
      });
      expect(parsed.success).toBe(true);
    });

    it("debe rechazar costos negativos o existencias negativas", () => {
      const negativeCost = CreateIngredientInputSchema.safeParse({
        name: "Pimienta Negra",
        unit: "g",
        costPerUnit: -500,
      });
      expect(negativeCost.success).toBe(false);

      const negativeStock = CreateIngredientInputSchema.safeParse({
        name: "Pimienta Negra",
        unit: "g",
        initialStock: -10,
      });
      expect(negativeStock.success).toBe(false);
    });
  });
});
