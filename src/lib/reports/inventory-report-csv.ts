import { InventoryReportData, InventoryStockReportRow } from "./types";

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
 * [REP-004] Genera el reporte de inventario en formato CSV compatible con Microsoft Excel.
 * Incluye Byte Order Mark (BOM \uFEFF) para garantizar la correcta codificación UTF-8
 * de caracteres en español (tildes, eñes) y símbolo de moneda.
 */
export function generateInventoryReportCsv(
  reportData: InventoryReportData,
  view: "existencias" | "movimientos" | "bajo_stock" = "existencias"
): CsvGenerationResult {
  const BOM = "\uFEFF";
  const lines: string[] = [];

  const safeBizName = sanitizeFilename(reportData.businessName || "comercio");

  if (view === "movimientos") {
    const headers = [
      "Fecha y Hora",
      "Producto",
      "SKU",
      "Ubicación",
      "Tipo de Movimiento",
      "Cantidad",
      "Costo Unitario (COP)",
      "Costo Total (COP)",
      "Referencia / Motivo",
      "Notas",
      "Usuario Responsable",
    ];

    lines.push(headers.map(escapeCSVField).join(","));

    for (const row of reportData.movementsRows) {
      const fields = [
        row.formattedDate,
        row.productName,
        row.productSku || "",
        row.locationName,
        row.movementTypeLabel,
        row.quantity,
        row.unitCost !== null ? row.unitCost.toFixed(2) : "",
        row.totalCost !== null ? row.totalCost.toFixed(2) : "",
        row.referenceLabel,
        row.notes || "",
        row.createdByName,
      ];
      lines.push(fields.map(escapeCSVField).join(","));
    }

    return {
      content: BOM + lines.join("\r\n"),
      filename: `reporte_movimientos_inventario_${safeBizName}_${Date.now()}.csv`,
      contentType: "text/csv; charset=utf-8",
    };
  }

  if (view === "bajo_stock") {
    const headers = [
      "Producto",
      "SKU",
      "Categoría",
      "Ubicación",
      "Stock Actual",
      "Stock Mínimo",
      "Déficit para Mínimo",
      "Costo Unitario (COP)",
      "Costo de Reposición (COP)",
      "Estado de Alerta",
    ];

    lines.push(headers.map(escapeCSVField).join(","));

    for (const row of reportData.lowStockRows) {
      const fields = [
        row.productName,
        row.productSku || "",
        row.categoryName,
        row.locationName,
        row.quantity,
        row.minStock,
        row.deficit,
        row.cost.toFixed(2),
        row.replenishmentCost.toFixed(2),
        row.statusLabel,
      ];
      lines.push(fields.map(escapeCSVField).join(","));
    }

    return {
      content: BOM + lines.join("\r\n"),
      filename: `reporte_stock_bajo_${safeBizName}_${Date.now()}.csv`,
      contentType: "text/csv; charset=utf-8",
    };
  }

  // Vista por defecto: Existencias actuales
  const headers = [
    "Producto",
    "SKU",
    "Categoría",
    "Ubicación",
    "Cantidad en Stock",
    "Stock Mínimo",
    "Estado",
    "Costo Unitario (COP)",
    "Valor Total (COP)",
  ];

  lines.push(headers.map(escapeCSVField).join(","));

  for (const row of reportData.stockRows) {
    const fields = [
      row.productName,
      row.productSku || "",
      row.categoryName,
      row.locationName,
      row.quantity,
      row.minStock,
      row.statusLabel,
      row.cost.toFixed(2),
      row.totalValue.toFixed(2),
    ];
    lines.push(fields.map(escapeCSVField).join(","));
  }

  // Fila resumen total
  const summaryFields = [
    "TOTALES GENERALES",
    "",
    "",
    `${reportData.summary.totalProductsCount} productos monitoreados`,
    reportData.summary.totalItemsCount,
    "",
    `${reportData.summary.outOfStockCount} agotados, ${reportData.summary.lowStockCount} bajos`,
    "",
    reportData.summary.totalInventoryValue.toFixed(2),
  ];
  lines.push(summaryFields.map(escapeCSVField).join(","));

  return {
    content: BOM + lines.join("\r\n"),
    filename: `reporte_inventario_existencias_${safeBizName}_${Date.now()}.csv`,
    contentType: "text/csv; charset=utf-8",
  };
}

