import { RecipeReportData, RecipeProductCostItem, IngredientConsumptionItem } from "./types";

export interface CsvGenerationResult {
  content: string;
  filename: string;
  contentType: string;
}

function escapeCSVField(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val).trim();
  if (/[",\n\r;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 30);
}

/**
 * [REP-008] Genera el reporte de costos de recetas y consumo de ingredientes en formato CSV
 * compatible con Microsoft Excel.
 * Incluye Byte Order Mark (BOM \uFEFF) para garantizar la correcta visualización de tildes y caracteres especiales.
 */
export function generateRecipeReportCsv(
  reportData: RecipeReportData,
  view: "costos" | "ingredientes" | "todo" = "todo"
): CsvGenerationResult {
  const BOM = "\uFEFF";
  const lines: string[] = [];
  const safeBizName = sanitizeFilename(reportData.businessName || "comercio");
  const currency = reportData.currency || "COP";

  // Metadatos y Resumen Ejecutivo
  lines.push(escapeCSVField(`REPORTE DE RECETAS, ESCANDALLOS Y COSTOS - ${reportData.businessName.toUpperCase()}`));
  lines.push(escapeCSVField(`Período: ${reportData.dateRange.startDate} al ${reportData.dateRange.endDate} (${reportData.dateRange.daysCount} días)`));
  lines.push(escapeCSVField(`Generado el: ${new Date().toLocaleString("es-CO")}`));
  lines.push("");

  // KPIs
  lines.push(escapeCSVField("RESUMEN EJECUTIVO"));
  lines.push(`Total Recetas Activas,${reportData.summary.totalRecipes}`);
  lines.push(`Margen Bruto Promedio,${reportData.summary.averageGrossMarginPercentage.toFixed(1)}%`);
  lines.push(`Productos con Margen < 30%,${reportData.summary.productsWithCriticalMarginCount}`);
  lines.push(`Productos con Margen Negativo (Pérdida),${reportData.summary.productsWithNegativeMarginCount}`);
  lines.push(`Costo Total Ingredientes Consumidos (${currency}),${reportData.summary.totalIngredientCostConsumed.toFixed(2)}`);
  lines.push(`Ingredientes en Riesgo de Agotamiento,${reportData.summary.ingredientsAtDepletionRiskCount}`);
  lines.push("");

  // Sección 1: Costos y Márgenes por Producto
  if (view === "costos" || view === "todo") {
    lines.push(escapeCSVField("COSTOS Y MÁRGENES POR PRODUCTO (ESCANDALLOS)"));
    const costHeaders = [
      "Producto",
      "Categoría",
      "Receta",
      "Porciones",
      `Costo Receta (${currency})`,
      `Precio Venta (${currency})`,
      `Margen Bruto ($)`,
      "Margen Bruto (%)",
      "Estado de Margen",
      "Nro Ingredientes",
    ];
    lines.push(costHeaders.map(escapeCSVField).join(","));

    for (const row of reportData.productCosts) {
      let statusLabel = "Saludable (>=30%)";
      if (row.marginStatus === "critical") statusLabel = "Crítico (Pérdida <0%)";
      else if (row.marginStatus === "warning") statusLabel = "Bajo (<30%)";

      const fields = [
        row.productName,
        row.categoryName,
        row.recipeName,
        row.portions,
        row.recipeCost.toFixed(2),
        row.salePrice.toFixed(2),
        row.grossMarginAmount.toFixed(2),
        `${row.grossMarginPercentage.toFixed(2)}%`,
        statusLabel,
        row.ingredientsCount,
      ];
      lines.push(fields.map(escapeCSVField).join(","));
    }
    lines.push("");
  }

  // Sección 2: Consumo y Proyección de Agotamiento de Ingredientes
  if (view === "ingredientes" || view === "todo") {
    lines.push(escapeCSVField("CONSUMO DE INGREDIENTES Y PROYECCIÓN DE AGOTAMIENTO"));
    const ingHeaders = [
      "Ingrediente",
      "Stock Actual",
      "Unidad",
      `Costo Unitario (${currency})`,
      "Consumo del Período",
      `Costo Total Consumido (${currency})`,
      "Ritmo Diario de Consumo",
      "Días para Agotarse",
      "Alerta de Agotamiento",
    ];
    lines.push(ingHeaders.map(escapeCSVField).join(","));

    for (const ing of reportData.ingredientConsumptions) {
      let alertLabel = "Consumo Estable";
      if (ing.depletionAlert === "depleted") alertLabel = "Agotado (0 stock)";
      else if (ing.depletionAlert === "critical") alertLabel = "Crítico (≤ 3 días)";
      else if (ing.depletionAlert === "warning") alertLabel = "Alerta (≤ 7 días)";
      else if (ing.depletionAlert === "no_consumption") alertLabel = "Sin consumo en período";

      const fields = [
        ing.ingredientName,
        ing.currentStock,
        ing.unit,
        ing.costPerUnit.toFixed(2),
        ing.periodConsumption.toFixed(3),
        ing.totalCostConsumed.toFixed(2),
        ing.dailyBurnRate.toFixed(3),
        ing.daysUntilDepleted !== null ? ing.daysUntilDepleted : "N/A",
        alertLabel,
      ];
      lines.push(fields.map(escapeCSVField).join(","));
    }
    lines.push("");
  }

  const filename = `reporte_recetas_costos_${safeBizName}_${Date.now()}.csv`;

  return {
    content: BOM + lines.join("\r\n"),
    filename,
    contentType: "text/csv; charset=utf-8",
  };
}
