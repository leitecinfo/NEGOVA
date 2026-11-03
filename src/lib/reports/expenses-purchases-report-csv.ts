import { ExpensesAndPurchasesReportData } from "./types";

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
 * [REP-005] Genera el reporte de gastos y compras en formato CSV con Byte Order Mark (BOM \uFEFF)
 * para apertura limpia e inmediata en Microsoft Excel (Windows y Mac) en español.
 */
export function generateExpensesAndPurchasesCsv(
  reportData: ExpensesAndPurchasesReportData,
  view: "gastos" | "compras" | "ambos" = "ambos"
): CsvGenerationResult {
  const BOM = "\uFEFF";
  const lines: string[] = [];

  const safeBizName = sanitizeFilename(reportData.businessName || "comercio");
  const dateSlug = new Date().toISOString().slice(0, 10);

  if (view === "gastos" || view === "ambos") {
    if (view === "ambos") {
      lines.push("=== REPORTE DE GASTOS OPERATIVOS Y DE PRODUCCIÓN ===");
    }

    const expenseHeaders = [
      "Fecha y Hora",
      "Categoría",
      "Proveedor",
      "Concepto",
      "Descripción",
      "Monto (COP)",
      "Medio de Pago",
      "# Recibo",
      "Tipo de Gasto",
      "Estado",
    ];

    lines.push(expenseHeaders.map(escapeCSVField).join(","));

    for (const exp of reportData.expenses.rows) {
      const row = [
        exp.formattedDate,
        exp.category,
        exp.supplierName,
        exp.concept,
        exp.description || "",
        exp.amount.toFixed(2),
        exp.paymentMethodLabel,
        exp.receiptNumber || "",
        exp.expenseType === "production" ? "Producción" : "Operativo",
        exp.statusLabel,
      ];
      lines.push(row.map(escapeCSVField).join(","));
    }

    // Fila de totales de gastos
    lines.push(
      [
        "TOTAL GASTOS",
        `${reportData.expenses.categoryDistribution.length} categorías`,
        "",
        "",
        `${reportData.expenses.summary.transactionsCount} registros`,
        reportData.expenses.summary.totalExpenses.toFixed(2),
        "",
        "",
        "",
        "",
      ]
        .map(escapeCSVField)
        .join(",")
    );

    if (view === "ambos") {
      lines.push(""); // Línea en blanco separadora
    }
  }

  if (view === "compras" || view === "ambos") {
    if (view === "ambos") {
      lines.push("=== REPORTE DE COMPRAS Y PROVEEDORES ===");
    }

    const purchaseHeaders = [
      "Fecha y Hora",
      "# Compra",
      "# Factura Proveedor",
      "Proveedor",
      "NIT / Cédula",
      "Productos e Insumos Comprados",
      "Subtotal (COP)",
      "Impuestos (COP)",
      "Total Neto (COP)",
      "Tipo de Pago",
      "Medio de Pago",
      "Estado",
    ];

    lines.push(purchaseHeaders.map(escapeCSVField).join(","));

    for (const pur of reportData.purchases.rows) {
      const itemsDetailed =
        pur.items.length > 0
          ? pur.items
              .map((it) => `${it.productName} (x${it.quantity} @ ${it.unitCost})`)
              .join("; ")
          : pur.itemsSummary;

      const row = [
        pur.formattedDate,
        pur.purchaseNumber,
        pur.invoiceNumber || "",
        pur.supplierName,
        pur.supplierTaxId || "",
        itemsDetailed,
        pur.subtotal.toFixed(2),
        pur.taxAmount.toFixed(2),
        pur.total.toFixed(2),
        pur.paymentType === "credit" ? "Crédito" : "Contado",
        pur.paymentMethod,
        pur.statusLabel,
      ];
      lines.push(row.map(escapeCSVField).join(","));
    }

    // Fila de totales de compras
    lines.push(
      [
        "TOTAL COMPRAS CONFIRMADAS",
        `${reportData.purchases.summary.confirmedPurchasesCount} compras`,
        "",
        "",
        `Cuentas por pagar pend: ${reportData.purchases.summary.pendingAccountsPayableAmount.toFixed(2)}`,
        "",
        "",
        "",
        reportData.purchases.summary.totalPurchases.toFixed(2),
        "",
        "",
        "",
      ]
        .map(escapeCSVField)
        .join(",")
    );
  }

  const prefix = view === "gastos" ? "gastos" : view === "compras" ? "compras" : "gastos_compras";
  const filename = `reporte_${prefix}_${safeBizName}_${dateSlug}.csv`;

  return {
    content: BOM + lines.join("\r\n"),
    filename,
    contentType: "text/csv; charset=utf-8",
  };
}

