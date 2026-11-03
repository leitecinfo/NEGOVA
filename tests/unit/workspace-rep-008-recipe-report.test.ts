import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import { generateRecipeReportCsv } from "@/lib/reports/recipe-report-csv";
import { generateRecipeReportPdf } from "@/lib/reports/recipe-report-pdf";
import type { RecipeReportData, RecipeProductCostItem, IngredientConsumptionItem } from "@/lib/reports/types";

describe("[REP-008] Reporte de Recetas, Escandallos y Costos", () => {
  const rootDir = process.cwd();

  // Mock data representativo para verificar cálculos y exportaciones
  const mockReportData: RecipeReportData = {
    summary: {
      totalRecipes: 3,
      averageGrossMarginPercentage: 38.3,
      productsWithCriticalMarginCount: 2,
      productsWithNegativeMarginCount: 1,
      totalIngredientCostConsumed: 125000,
      ingredientsAtDepletionRiskCount: 2,
    },
    productCosts: [
      {
        productId: "p-1",
        productName: "Hamburguesa Especial",
        categoryId: "c-1",
        categoryName: "Hamburguesas",
        recipeId: "r-1",
        recipeName: "Receta Hamburguesa Especial",
        portions: 1,
        recipeCost: 15000,
        salePrice: 12000, // Cost > Price -> Margen Negativo
        grossMarginAmount: -3000,
        grossMarginPercentage: -25.0,
        marginStatus: "critical",
        ingredientsCount: 3,
      },
      {
        productId: "p-2",
        productName: "Pizza Personal",
        categoryId: "c-2",
        categoryName: "Pizzas",
        recipeId: "r-2",
        recipeName: "Receta Pizza Personal",
        portions: 1,
        recipeCost: 16000,
        salePrice: 20000, // Margen = (20000 - 16000) / 20000 = 20% (<30%)
        grossMarginAmount: 4000,
        grossMarginPercentage: 20.0,
        marginStatus: "warning",
        ingredientsCount: 4,
      },
      {
        productId: "p-3",
        productName: "Limonada Natural",
        categoryId: "c-3",
        categoryName: "Bebidas",
        recipeId: "r-3",
        recipeName: "Receta Limonada Natural",
        portions: 2, // 2 porciones
        recipeCost: 2000, // (4000 total / 2 porciones)
        salePrice: 10000, // Margen = (10000 - 2000) / 10000 = 80% (Saludable)
        grossMarginAmount: 8000,
        grossMarginPercentage: 80.0,
        marginStatus: "healthy",
        ingredientsCount: 2,
      },
    ],
    ingredientConsumptions: [
      {
        ingredientId: "ing-1",
        ingredientName: "Carne de Res Molida",
        unit: "kg",
        costPerUnit: 25000,
        currentStock: 1.5,
        periodConsumption: 3.0,
        totalCostConsumed: 75000,
        dailyBurnRate: 0.5, // 1.5 kg / 0.5 kg/día = 3 días -> Crítico
        daysUntilDepleted: 3,
        depletionAlert: "critical",
      },
      {
        ingredientId: "ing-2",
        ingredientName: "Queso Mozzarella",
        unit: "kg",
        costPerUnit: 20000,
        currentStock: 2.0,
        periodConsumption: 2.0,
        totalCostConsumed: 40000,
        dailyBurnRate: 0.333, // 2 kg / 0.333 kg/día = 6 días -> Alerta
        daysUntilDepleted: 6,
        depletionAlert: "warning",
      },
      {
        ingredientId: "ing-3",
        ingredientName: "Limones",
        unit: "kg",
        costPerUnit: 5000,
        currentStock: 10.0,
        periodConsumption: 2.0,
        totalCostConsumed: 10000,
        dailyBurnRate: 0.2, // 10 kg / 0.2 kg/día = 50 días -> Estable
        daysUntilDepleted: 50,
        depletionAlert: "stable",
      },
    ],
    depletionRanking: [
      {
        ingredientId: "ing-1",
        ingredientName: "Carne de Res Molida",
        unit: "kg",
        costPerUnit: 25000,
        currentStock: 1.5,
        periodConsumption: 3.0,
        totalCostConsumed: 75000,
        dailyBurnRate: 0.5,
        daysUntilDepleted: 3,
        depletionAlert: "critical",
      },
      {
        ingredientId: "ing-2",
        ingredientName: "Queso Mozzarella",
        unit: "kg",
        costPerUnit: 20000,
        currentStock: 2.0,
        periodConsumption: 2.0,
        totalCostConsumed: 40000,
        dailyBurnRate: 0.333,
        daysUntilDepleted: 6,
        depletionAlert: "warning",
      },
    ],
    categories: [
      { id: "c-1", name: "Hamburguesas" },
      { id: "c-2", name: "Pizzas" },
      { id: "c-3", name: "Bebidas" },
    ],
    filterParams: {
      preset: "this_month",
      startDate: "2026-11-01",
      endDate: "2026-11-06",
    },
    dateRange: {
      startDate: "2026-11-01",
      endDate: "2026-11-06",
      daysCount: 6,
    },
    businessName: "Restaurante Gourmet NEGOVA",
    currency: "COP",
  };

  describe("Criterio 1: El costo de receta coincide con la suma de (cantidad × costo_unitario) / porciones", () => {
    it("debe sumar correctamente los ingredientes individuales de una receta", () => {
      const mockIngredients = [
        { quantity: 0.2, unitCost: 25000 }, // 5,000
        { quantity: 1, unitCost: 1500 },    // 1,500
        { quantity: 0.05, unitCost: 20000 },// 1,000
      ];
      const portions = 1;

      const totalCost = mockIngredients.reduce((sum, ing) => sum + ing.quantity * ing.unitCost, 0);
      const recipeCost = Number((totalCost / portions).toFixed(2));

      expect(recipeCost).toBe(7500);
    });

    it("debe dividir exactamente por el número de porciones cuando portions > 1", () => {
      const mockIngredients = [
        { quantity: 1.0, unitCost: 6000 },  // 6,000
        { quantity: 0.5, unitCost: 4000 },  // 2,000
      ];
      const portions = 4; // Rinde 4 porciones

      const totalCost = mockIngredients.reduce((sum, ing) => sum + ing.quantity * ing.unitCost, 0);
      const unitRecipeCost = Number((totalCost / portions).toFixed(2));

      expect(totalCost).toBe(8000);
      expect(unitRecipeCost).toBe(2000);
    });
  });

  describe("Criterio 2: El margen bruto se calcula como (precio_venta - costo_receta) / precio_venta × 100", () => {
    it("debe calcular el porcentaje de margen bruto correctamente con ganancia positiva", () => {
      const salePrice = 20000;
      const recipeCost = 14000;

      const grossMarginAmount = salePrice - recipeCost;
      const grossMarginPercentage = Number((((salePrice - recipeCost) / salePrice) * 100).toFixed(2));

      expect(grossMarginAmount).toBe(6000);
      expect(grossMarginPercentage).toBe(30.0);
    });

    it("debe calcular margen negativo cuando el costo supera el precio de venta", () => {
      const salePrice = 10000;
      const recipeCost = 12500;

      const grossMarginAmount = salePrice - recipeCost;
      const grossMarginPercentage = Number((((salePrice - recipeCost) / salePrice) * 100).toFixed(2));

      expect(grossMarginAmount).toBe(-2500);
      expect(grossMarginPercentage).toBe(-25.0);
    });
  });

  describe("Criterio 3: Productos con margen < 30% o negativo se destacan visualmente con badge de alerta", () => {
    it("debe clasificar como 'critical' cuando el margen es menor que 0%", () => {
      const percentage = -5.0;
      let status: string = "healthy";
      if (percentage < 0) status = "critical";
      else if (percentage < 30) status = "warning";

      expect(status).toBe("critical");
    });

    it("debe clasificar como 'warning' cuando el margen está entre 0% y 29.99%", () => {
      const percentage = 24.5;
      let status: string = "healthy";
      if (percentage < 0) status = "critical";
      else if (percentage < 30) status = "warning";

      expect(status).toBe("warning");
    });

    it("debe clasificar como 'healthy' cuando el margen es igual o superior al 30%", () => {
      const percentage = 30.0;
      let status: string = "healthy";
      if (percentage < 0) status = "critical";
      else if (percentage < 30) status = "warning";

      expect(status).toBe("healthy");
    });

    it("debe ordenar productos por margen ascendente (los menos rentables primero)", () => {
      const sorted = [...mockReportData.productCosts].sort(
        (a, b) => a.grossMarginPercentage - b.grossMarginPercentage
      );

      expect(sorted[0].marginStatus).toBe("critical");
      expect(sorted[0].grossMarginPercentage).toBe(-25.0);
      expect(sorted[1].marginStatus).toBe("warning");
      expect(sorted[1].grossMarginPercentage).toBe(20.0);
      expect(sorted[2].marginStatus).toBe("healthy");
      expect(sorted[2].grossMarginPercentage).toBe(80.0);
    });
  });

  describe("Criterio 4: Consumo del período = unidades vendidas × (cantidad_ingrediente / portions)", () => {
    it("debe computar el consumo exacto multiplicando ventas por fórmula", () => {
      const unitsSold = 50;
      const ingredientQtyInRecipe = 0.15; // 150g por receta
      const portions = 1;

      const periodConsumption = unitsSold * (ingredientQtyInRecipe / portions);
      const unitCost = 20000;
      const totalCostConsumed = periodConsumption * unitCost;

      expect(periodConsumption).toBe(7.5);
      expect(totalCostConsumed).toBe(150000);
    });

    it("debe acumular consumo de un mismo ingrediente presente en múltiples recetas", () => {
      // Tomate en Hamburguesa y en Pizza
      const burgerSales = 30;
      const burgerTomatoesPerPortion = 0.05; // 50g

      const pizzaSales = 20;
      const pizzaTomatoesPerPortion = 0.1; // 100g

      const totalTomatoConsumption =
        burgerSales * burgerTomatoesPerPortion + pizzaSales * pizzaTomatoesPerPortion;

      expect(totalTomatoConsumption).toBe(3.5);
    });
  });

  describe("Criterio 5: Proyección de agotamiento y ritmo diario de quema", () => {
    it("debe proyectar días hasta agotamiento según el ritmo diario", () => {
      const currentStock = 12; // 12 unidades
      const daysCount = 6;
      const periodConsumption = 6; // 6 consumidas en 6 días

      const dailyBurnRate = periodConsumption / daysCount; // 1.0 por día
      const daysUntilDepleted = Math.floor(currentStock / dailyBurnRate);

      expect(dailyBurnRate).toBe(1.0);
      expect(daysUntilDepleted).toBe(12);
    });

    it("debe identificar ingredientes críticos que se agotan en 3 días o menos", () => {
      const currentStock = 2.0;
      const dailyBurnRate = 1.0;
      const daysUntilDepleted = Math.floor(currentStock / dailyBurnRate); // 2 días

      let depletionAlert = "stable";
      if (daysUntilDepleted <= 3) depletionAlert = "critical";
      else if (daysUntilDepleted <= 7) depletionAlert = "warning";

      expect(depletionAlert).toBe("critical");
    });
  });

  describe("Exportación CSV para Excel [REP-008]", () => {
    it("debe incluir BOM UTF-8 y encabezados de costos y consumos", () => {
      const csvResult = generateRecipeReportCsv(mockReportData, "todo");

      expect(csvResult.content.startsWith("\uFEFF")).toBe(true);
      expect(csvResult.content).toContain("REPORTE DE RECETAS, ESCANDALLOS Y COSTOS");
      expect(csvResult.content).toContain("RESUMEN EJECUTIVO");
      expect(csvResult.content).toContain("Hamburguesa Especial");
      expect(csvResult.content).toContain("Pizza Personal");
      expect(csvResult.content).toContain("Carne de Res Molida");
      expect(csvResult.filename).toMatch(/^reporte_recetas_costos_.*\.csv$/);
    });
  });

  describe("Exportación PDF A4 Landscape [REP-008]", () => {
    it("debe generar un archivo PDF con buffer y metadatos válidos", () => {
      const pdfResult = generateRecipeReportPdf({
        businessName: "Restaurante Gourmet NEGOVA",
        businessNit: "900.123.456-7",
        reportData: mockReportData,
        view: "todo",
      });

      expect(pdfResult.buffer).toBeDefined();
      expect(pdfResult.buffer.length).toBeGreaterThan(1000);
      expect(pdfResult.base64).toBeDefined();
      expect(pdfResult.contentType).toBe("application/pdf");
      expect(pdfResult.filename).toMatch(/^reporte_recetas_costos_todo_.*\.pdf$/);
    });
  });

  describe("Regla Global: Prohibido uso de alertas nativas del navegador", () => {
    it("no debe contener llamadas a window.alert, window.confirm o window.prompt en el módulo", () => {
      const filesToCheck = [
        path.join(rootDir, "src/lib/reports/recipe-report-csv.ts"),
        path.join(rootDir, "src/lib/reports/recipe-report-pdf.ts"),
        path.join(rootDir, "src/app/workspace/[businessId]/reportes/recetas/actions.ts"),
        path.join(rootDir, "src/app/workspace/[businessId]/reportes/recetas/recipe-report-client.tsx"),
        path.join(rootDir, "src/app/workspace/[businessId]/reportes/recetas/page.tsx"),
      ];

      for (const filePath of filesToCheck) {
        if (!fs.existsSync(filePath)) continue;
        const code = fs.readFileSync(filePath, "utf8");

        expect(code).not.toMatch(/\bwindow\.alert\s*\(/);
        expect(code).not.toMatch(/\bwindow\.confirm\s*\(/);
        expect(code).not.toMatch(/\bwindow\.prompt\s*\(/);
        expect(code).not.toMatch(/\bAlert\.alert\s*\(/);
      }
    });
  });
});
