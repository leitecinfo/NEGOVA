import { SalesReportData, SalesReportRow } from "./types";

export interface CsvGenerationResult {
  content: string;
  filename: string;
  contentType: string;
}

function escapeCSVField(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val).trim();
  // Si contiene comas, comillas dobles, saltos de línea o punto y coma, envolver en comillas dobles y duplicar comillas
  if (/[",\n\r;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 30);
}

/**
 * [REP-002] Genera el reporte de ventas en formato CSV compatible con Microsoft Excel.
 * Incluye Byte Order Mark (BOM \uFEFF) para garantizar la correcta codificación UTF-8
 * de caracteres en español (tildes, eñes) y símbolo de moneda.
 */
export function generateSalesReportCsv(reportData: SalesReportData): CsvGenerationResult {
  const headers = [
    "Fecha y Hora",
    "No. Documento",
    "Cliente",
    "Canal de Venta",
    "Método de Pago",
    "Empleado / Cajero",
    "Subtotal",
    "Impuestos (IVA)",
    "Descuento",
    "Total Neto",
    "Estado",
    "Motivo de Anulación",
  ];

  const lines: string[] = [];

  // BOM UTF-8 para apertura directa en Microsoft Excel
  const BOM = "\uFEFF";

  // Fila de encabezados
  lines.push(headers.map(escapeCSVField).join(","));

  // Filas de datos
  for (const row of reportData.rows) {
    const fields = [
      row.formattedDate,
      row.documentNumber,
      row.customerName,
      row.channelLabel,
      row.paymentMethodLabel,
      row.employeeName,
      row.subtotal.toFixed(2),
      row.taxTotal.toFixed(2),
      row.discountTotal.toFixed(2),
      row.total.toFixed(2),
      row.statusLabel,
      row.cancellationReason || "",
    ];

    lines.push(fields.map(escapeCSVField).join(","));
  }

  // Fila de resumen total al final
  const summaryFields = [
    "TOTALES",
    "",
    "",
    "",
    "",
    `${reportData.summary.transactionCount} transacciones`,
    reportData.summary.totalGross.toFixed(2),
    reportData.summary.totalTax.toFixed(2),
    reportData.summary.totalDiscount.toFixed(2),
    reportData.summary.totalNet.toFixed(2),
    "",
    "",
  ];
  lines.push(summaryFields.map(escapeCSVField).join(","));

  const content = BOM + lines.join("\r\n");
  const dateSlug = new Date().toISOString().slice(0, 10);
  const filename = `reporte_ventas_${sanitizeFilename(reportData.businessName)}_${dateSlug}.csv`;

  return {
    content,
    filename,
    contentType: "text/csv; charset=utf-8",
  };
}
