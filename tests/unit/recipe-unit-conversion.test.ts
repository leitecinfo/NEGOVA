import { describe, it, expect } from "vitest";
import {
  areUnitsCompatible,
  getConversionFactor,
  convertQuantity,
  calculateLineCostWithConversion,
  getCompatibleUnits,
} from "@/lib/recipes/unit-conversion";

describe("[REC-004] Conversión de unidades de medida para recetas y escandallos", () => {
  describe("Compatibilidad de unidades", () => {
    it("debe reconocer que gramos y kilogramos son compatibles", () => {
      expect(areUnitsCompatible("g", "kg")).toBe(true);
      expect(areUnitsCompatible("kg", "gramos")).toBe(true);
      expect(areUnitsCompatible("kilo", "g")).toBe(true);
      expect(areUnitsCompatible("lb", "g")).toBe(true);
      expect(areUnitsCompatible("oz", "kg")).toBe(true);
    });

    it("debe reconocer que litros y mililitros son compatibles", () => {
      expect(areUnitsCompatible("lt", "ml")).toBe(true);
      expect(areUnitsCompatible("litros", "mililitros")).toBe(true);
      expect(areUnitsCompatible("l", "cc")).toBe(true);
      expect(areUnitsCompatible("fl oz", "ml")).toBe(true);
    });

    it("debe rechazar unidades de magnitudes incompatibles (peso vs volumen)", () => {
      expect(areUnitsCompatible("kg", "lt")).toBe(false);
      expect(areUnitsCompatible("g", "ml")).toBe(false);
      expect(areUnitsCompatible("unidad", "kg")).toBe(false);
      expect(areUnitsCompatible("porcion", "lt")).toBe(false);
    });

    it("debe aceptar unidades idénticas incluso si son personalizadas", () => {
      expect(areUnitsCompatible("caja", "caja")).toBe(true);
      expect(areUnitsCompatible("paquete", "paq")).toBe(true);
      expect(areUnitsCompatible("paq", "unidad")).toBe(true);
      expect(areUnitsCompatible("docena", "unidad")).toBe(true);
    });
  });

  describe("Factores de conversión", () => {
    it("debe calcular factores exactos de masa", () => {
      expect(getConversionFactor("g", "kg")).toBe(0.001);
      expect(getConversionFactor("kg", "g")).toBe(1000);
      expect(getConversionFactor("lb", "g")).toBe(500);
      expect(getConversionFactor("g", "lb")).toBe(1 / 500);
    });

    it("debe calcular factores exactos de volumen", () => {
      expect(getConversionFactor("ml", "lt")).toBe(0.001);
      expect(getConversionFactor("lt", "ml")).toBe(1000);
      expect(getConversionFactor("cc", "ml")).toBe(1);
    });

    it("debe devolver null para magnitudes incompatibles", () => {
      expect(getConversionFactor("kg", "ml")).toBeNull();
    });
  });

  describe("Cálculo de costo de línea con conversión", () => {
    it("ejemplo del enunciado: carne comprada en kg a $20.000 y usada en 120 g", () => {
      // 120 g con carne a $20.000/kg debe costar $2.400
      const res = calculateLineCostWithConversion({
        recipeQuantity: 120,
        recipeUnit: "g",
        ingredientStockUnit: "kg",
        ingredientUnitCost: 20000,
      });

      expect(res.isCompatible).toBe(true);
      expect(res.subtotalCost).toBe(2400);
      expect(res.unitCostInRecipeUnit).toBe(20); // $20 por gramo
      expect(res.quantityInStockUnit).toBe(0.12); // 0.12 kg
    });

    it("ejemplo del enunciado: queso comprado en tajadas a $500 y usado 1 tajada", () => {
      const res = calculateLineCostWithConversion({
        recipeQuantity: 1,
        recipeUnit: "tajada",
        ingredientStockUnit: "tajada",
        ingredientUnitCost: 500,
      });

      expect(res.isCompatible).toBe(true);
      expect(res.subtotalCost).toBe(500);
      expect(res.unitCostInRecipeUnit).toBe(500);
    });

    it("ejemplo salsa: comprada en litro a $10.000 y usada 15 ml", () => {
      // 15 ml con salsa a $10.000/lt -> 15 * 10 = $150
      const res = calculateLineCostWithConversion({
        recipeQuantity: 15,
        recipeUnit: "ml",
        ingredientStockUnit: "lt",
        ingredientUnitCost: 10000,
      });

      expect(res.isCompatible).toBe(true);
      expect(res.subtotalCost).toBe(150);
      expect(res.unitCostInRecipeUnit).toBe(10); // $10 por ml
      expect(res.quantityInStockUnit).toBe(0.015);
    });

    it("manejo seguro de cantidades decimales (ej. 0.5 unidades, 0.25 kg)", () => {
      const res = calculateLineCostWithConversion({
        recipeQuantity: 0.5,
        recipeUnit: "kg",
        ingredientStockUnit: "kg",
        ingredientUnitCost: 16000,
      });

      expect(res.subtotalCost).toBe(8000);
    });
  });

  describe("Opciones de unidades compatibles", () => {
    it("debe listar solo unidades de masa cuando se consulta 'kg'", () => {
      const units = getCompatibleUnits("kg");
      expect(units.map((u) => u.value)).toContain("kg");
      expect(units.map((u) => u.value)).toContain("g");
      expect(units.map((u) => u.value)).not.toContain("lt");
    });

    it("debe listar solo unidades de volumen cuando se consulta 'ml'", () => {
      const units = getCompatibleUnits("ml");
      expect(units.map((u) => u.value)).toContain("lt");
      expect(units.map((u) => u.value)).toContain("ml");
      expect(units.map((u) => u.value)).not.toContain("kg");
    });
  });

  describe("Conversión gastronómica realista (lechuga, papas, porciones)", () => {
    it("permite medir lechuga en gramos cuando se compró por unidad sin bloquear", () => {
      // Lechuga Batavia comprada a $6.000 / unidad. En receta se usan 50 gramos (base 500g/un)
      // 50g = 0.1 unidad -> costo = $600
      const res = calculateLineCostWithConversion({
        recipeQuantity: 50,
        recipeUnit: "g",
        ingredientStockUnit: "unidad",
        ingredientUnitCost: 6000,
      });

      expect(res.isCompatible).toBe(true);
      expect(res.subtotalCost).toBe(600);
      expect(res.quantityInStockUnit).toBe(0.1);
    });

    it("mantiene relación 1:1 entre unidad y porción cuando ambos son de conteo discreto (ej. 1 pan, 1 huevo)", () => {
      const res = calculateLineCostWithConversion({
        recipeQuantity: 1,
        recipeUnit: "porcion",
        ingredientStockUnit: "unidad",
        ingredientUnitCost: 1500,
      });

      expect(res.isCompatible).toBe(true);
      expect(res.subtotalCost).toBe(1500);
      expect(res.quantityInStockUnit).toBe(1);
    });

    it("permite medir papas en libras cuando se compraron en kilogramos", () => {
      // Papas compradas a $4.000 / kg. En receta se usan 0.5 libras (250g = 0.25 kg)
      // costo = 0.25 * 4000 = $1.000
      const res = calculateLineCostWithConversion({
        recipeQuantity: 0.5,
        recipeUnit: "lb",
        ingredientStockUnit: "kg",
        ingredientUnitCost: 4000,
      });

      expect(res.isCompatible).toBe(true);
      expect(res.subtotalCost).toBe(1000);
      expect(res.quantityInStockUnit).toBe(0.25);
    });

    it("permite medir papas por porción cuando se compraron en kg", () => {
      // 1 porción gastronómica = 100g = 0.1 kg. Papas a $4.000/kg -> $400
      const res = calculateLineCostWithConversion({
        recipeQuantity: 1,
        recipeUnit: "porcion",
        ingredientStockUnit: "kg",
        ingredientUnitCost: 4000,
      });

      expect(res.isCompatible).toBe(true);
      expect(res.subtotalCost).toBe(400);
      expect(res.quantityInStockUnit).toBe(0.1);
    });
  });
});

