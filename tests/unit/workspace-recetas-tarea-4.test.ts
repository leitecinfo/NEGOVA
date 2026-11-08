import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { computeRecipeCalculations } from "@/lib/recipes/recipe-service";
import {
  convertQuantity,
  calculateLineCostWithConversion,
  areUnitsCompatible,
  getCompatibleUnits,
} from "@/lib/recipes/unit-conversion";

describe("TAREA 4 — Rediseño del Módulo de Recetas y Relación con Ingredientes", () => {
  describe("Motor de Conversión de Unidades y Escandallo", () => {
    it("convierte unidades compatibles de masa, volumen y unidades discretas", () => {
      // Gramos a Kilogramos
      expect(convertQuantity(500, "g", "kg").convertedQuantity).toBe(0.5);
      // Litros a Mililitros
      expect(convertQuantity(1.5, "lt", "ml").convertedQuantity).toBe(1500);
      // Onzas a Gramos
      expect(convertQuantity(1, "oz", "g").convertedQuantity).toBeCloseTo(28.3495, 3);
      // Libras a Gramos
      expect(convertQuantity(1, "lb", "g").convertedQuantity).toBe(500);
      // Onzas fluidas a Mililitros
      expect(convertQuantity(2, "oz_fl", "ml").convertedQuantity).toBeCloseTo(59.147, 2);
    });

    it("calcula costos proporcionales exactos al cambiar de magnitud (ej. Carne a $20.000/kg usada en 120g)", () => {
      // 120g de carne comprada a $20.000 / kg -> Costo de la línea: $2.400
      const lineCost = calculateLineCostWithConversion({
        recipeQuantity: 120,
        recipeUnit: "g",
        ingredientStockUnit: "kg",
        ingredientUnitCost: 20000,
      });

      expect(lineCost.isCompatible).toBe(true);
      expect(lineCost.unitCostInRecipeUnit).toBe(20); // $20 por gramo
      expect(lineCost.subtotalCost).toBe(2400); // 120 * 20 = $2.400
      expect(lineCost.quantityInStockUnit).toBe(0.12); // 0.12 kg
    });

    it("evalúa compatibilidad de unidades y previene conversiones erróneas entre magnitudes incompatibles", () => {
      expect(areUnitsCompatible("kg", "g")).toBe(true);
      expect(areUnitsCompatible("lt", "ml")).toBe(true);
      expect(areUnitsCompatible("kg", "lt")).toBe(false); // Masa vs Volumen
      expect(areUnitsCompatible("unidad", "g")).toBe(false); // Discreta vs Masa

      // Si son incompatibles, isCompatible es false con explicación
      const invalidCost = calculateLineCostWithConversion({
        recipeQuantity: 100,
        recipeUnit: "g",
        ingredientStockUnit: "lt",
        ingredientUnitCost: 5000,
      });
      expect(invalidCost.isCompatible).toBe(false);
      expect(invalidCost.conversionExplanation).toContain("incompatibles");
    });

    it("calcula la capacidad de porciones y detecta el ingrediente cuello de botella (limiting ingredient)", () => {
      // Hamburguesa Sencilla:
      // - 120g Carne (Stock: 1.2 kg -> 10 porciones)
      // - 1 Pan (Stock: 15 unidades -> 15 porciones)
      // - 1 Tajada Queso (Stock: 8 unidades -> 8 porciones) -> CUELLO DE BOTELLA
      // - 20g Salsa (Stock: 1 kg -> 50 porciones)

      const mockRecipe = {
        id: "rec-burger",
        portions: 1,
        products: { price: 18000 },
      };

      const rawIngredients = [
        {
          id: "ri-carne",
          ingredient_id: "ing-carne",
          quantity: 120,
          unit: "g",
          is_optional: false,
        },
        {
          id: "ri-pan",
          ingredient_id: "ing-pan",
          quantity: 1,
          unit: "unidad",
          is_optional: false,
        },
        {
          id: "ri-queso",
          ingredient_id: "ing-queso",
          quantity: 1,
          unit: "tajada",
          is_optional: false,
        },
        {
          id: "ri-salsa",
          ingredient_id: "ing-salsa",
          quantity: 20,
          unit: "g",
          is_optional: false,
        },
      ];

      const prodDataMap = new Map<string, any>([
        [
          "ing-carne",
          { name: "Carne Molida", metadata: { unit: "kg", cost: 20000 } },
        ],
        [
          "ing-pan",
          { name: "Pan Hamburguesa", metadata: { unit: "unidad", cost: 1500 } },
        ],
        [
          "ing-queso",
          { name: "Queso Cheddar Tajada", metadata: { unit: "tajada", cost: 800 } },
        ],
        [
          "ing-salsa",
          { name: "Salsa de la Casa", metadata: { unit: "kg", cost: 12000 } },
        ],
      ]);

      const stockMap = new Map<string, number>([
        ["ing-carne", 1.2], // 1.2 kg = 1200g -> 10 porciones
        ["ing-pan", 15], // 15 panes -> 15 porciones
        ["ing-queso", 8], // 8 tajadas -> 8 porciones (cuello de botella)
        ["ing-salsa", 1], // 1 kg = 1000g -> 50 porciones
      ]);

      const costMap = new Map<string, number>([
        ["ing-carne", 20000],
        ["ing-pan", 1500],
        ["ing-queso", 800],
        ["ing-salsa", 12000],
      ]);

      const calculation = computeRecipeCalculations(
        mockRecipe,
        rawIngredients,
        prodDataMap,
        stockMap,
        costMap
      );

      // Costo total = Carne(2400) + Pan(1500) + Queso(800) + Salsa(240) = 4940
      expect(calculation.totalCost).toBe(4940);
      expect(calculation.costPerPortion).toBe(4940);
      expect(calculation.marginPercentage).toBeCloseTo(
        ((18000 - 4940) / 18000) * 100,
        2
      );

      // Capacidad máxima limitada por el Queso (8 porciones)
      expect(calculation.portionsAvailable).toBe(8);
      expect(calculation.limitingIngredient?.name).toBe("Queso Cheddar Tajada");
      expect(calculation.limitingIngredient?.availablePortions).toBe(8);
    });
  });

  describe("Cumplimiento de Reglas de Negocio y UI/UX (TAREA 4)", () => {
    it("valida que NO existan alertas nativas (window.alert/confirm/prompt) en el módulo de Recetas", () => {
      const modalFile = join(
        process.cwd(),
        "src/app/workspace/[businessId]/recetas/recipe-form-modal.tsx"
      );
      const tabFile = join(
        process.cwd(),
        "src/app/workspace/[businessId]/recetas/recipes-tab.tsx"
      );

      const modalContent = readFileSync(modalFile, "utf-8");
      const tabContent = readFileSync(tabFile, "utf-8");

      expect(modalContent).not.toMatch(/window\.alert/);
      expect(modalContent).not.toMatch(/window\.confirm/);
      expect(modalContent).not.toMatch(/window\.prompt/);

      expect(tabContent).not.toMatch(/window\.alert/);
      expect(tabContent).not.toMatch(/window\.confirm/);
      expect(tabContent).not.toMatch(/window\.prompt/);
    });

    it("contiene los 5 KPIs requeridos en la pantalla principal de Recetas", () => {
      const tabFile = join(
        process.cwd(),
        "src/app/workspace/[businessId]/recetas/recipes-tab.tsx"
      );
      const content = readFileSync(tabFile, "utf-8");

      // 1. Total Recetas
      expect(content).toContain("Total Recetas");
      // 2. Recetas Activas
      expect(content).toContain("Recetas Activas");
      // 3. Sin Ingredientes (incompletas)
      expect(content).toContain("Sin Ingredientes");
      // 4. Platos sin Receta
      expect(content).toContain("Platos sin Receta");
      // 5. Costo Promedio
      expect(content).toContain("Costo Promedio");
    });

    it("provee alternador de vistas de Tabla profesional y Tarjetas", () => {
      const tabFile = join(
        process.cwd(),
        "src/app/workspace/[businessId]/recetas/recipes-tab.tsx"
      );
      const content = readFileSync(tabFile, "utf-8");

      expect(content).toContain('viewMode === "table"');
      expect(content).toContain('viewMode === "cards"');
    });

    it("cuenta con modal de Ficha Técnica / Escandallo detallado", () => {
      const tabFile = join(
        process.cwd(),
        "src/app/workspace/[businessId]/recetas/recipes-tab.tsx"
      );
      const content = readFileSync(tabFile, "utf-8");

      expect(content).toContain("recipeToView");
      expect(content).toContain("Ficha técnica del producto preparado");
    });

    it("el formulario es un modal directo de pantalla única sin asistente de 3 pasos", () => {
      const modalFile = join(
        process.cwd(),
        "src/app/workspace/[businessId]/recetas/recipe-form-modal.tsx"
      );
      const content = readFileSync(modalFile, "utf-8");

      // No debe contener el wizard anterior con paso 1, paso 2, paso 3
      expect(content).not.toContain("currentStep === 1");
      expect(content).not.toContain("currentStep === 2");
      expect(content).not.toContain("currentStep === 3");
      expect(content).toContain("SearchSelect");
    });
  });
});
