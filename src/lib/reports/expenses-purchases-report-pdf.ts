import { jsPDF } from "jspdf";
import {
  ExpensesAndPurchasesReportData,
  ExpenseReportRow,
  PurchaseReportRow,
} from "./types";
import { PdfGenerationResult } from "../pdf/types";

export interface ExpensesPurchasesReportPdfParams {
  businessName: string;
  businessNit?: string | null;
  businessAddress?: string | null;
  businessPhone?: string | null;
  logoUrl?: string | null;
  reportData: ExpensesAndPurchasesReportData;
  view?: "gastos" | "compras" | "ambos";
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 30);
}

/**
 * [REP-005] Genera el reporte formal de Gastos y Compras en formato PDF (A4 Landscape)
 * con membrete comercial, detalle de productos comprados en compras,
 * desglose por categorías de gastos y paginación institucional.
 */
export function generateExpensesAndPurchasesPdf(
  params: ExpensesPurchasesReportPdfParams
): PdfGenerationResult {
  const {
    businessName,
    businessNit,
    businessAddress,
    businessPhone,
    logoUrl,
    reportData,
    view = "ambos",
  } = params;

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 269 mm

  // Formatear período legible
  let periodText = "Período actual";
  if (reportData.dateRange.startDate && reportData.dateRange.endDate) {
    periodText = `${reportData.dateRange.startDate} al ${reportData.dateRange.endDate}`;
  } else if (reportData.dateRange.preset === "today") {
    periodText = "Operaciones de Hoy";
  } else if (reportData.dateRange.preset === "yesterday") {
    periodText = "Operaciones de Ayer";
  } else if (reportData.dateRange.preset === "last_7_days") {
    periodText = "Últimos 7 Días";
  } else if (reportData.dateRange.preset === "this_month") {
    periodText = "Este Mes";
  }

  const renderHeader = (isFirstPage: boolean) => {
    // Banner superior
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, pageWidth, isFirstPage ? 32 : 16, "F");

    // Franja decorativa
    doc.setFillColor(237, 80, 10); // Negova Orange
    doc.rect(0, (isFirstPage ? 32 : 16) - 1.5, pageWidth, 1.5, "F");

    if (isFirstPage) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      const title =
        view === "gastos"
          ? "REPORTE DE GASTOS OPERATIVOS"
          : view === "compras"
          ? "REPORTE DE COMPRAS Y PROVEEDORES"
          : "REPORTE DE GASTOS Y COMPRAS";
      doc.text(title, margin, 13);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(203, 213, 225); // Slate 300
      doc.text(
        `Período analizado: ${periodText} — Emisión: ${new Date().toLocaleDateString("es-CO")}`,
        margin,
        20
      );

      // Membrete del negocio
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text(businessName.toUpperCase(), pageWidth - margin, 11, { align: "right" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // Slate 400

      let subInfo = [];
      if (businessNit) subInfo.push(`NIT: ${businessNit}`);
      if (businessPhone) subInfo.push(`Tel: ${businessPhone}`);
      if (businessAddress) subInfo.push(businessAddress);
      const subInfoText = subInfo.join("  |  ");
      if (subInfoText) {
        doc.text(subInfoText, pageWidth - margin, 17, { align: "right" });
      }
      doc.text("Sistema de Gestión Comercial NEGOVA", pageWidth - margin, 23, { align: "right" });
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text(
        `${businessName} — Reporte de Gastos y Compras (${periodText})`,
        margin,
        10
      );
    }
  };

  renderHeader(true);

  let currentY = 38;

  // 1. Tarjetas de Resumen
  const cardHeight = 15;
  const cardGap = 4;

  if (view === "gastos" || view === "ambos") {
    const kpisGastos = [
      {
        label: "TOTAL GASTOS",
        value: formatCOP(reportData.expenses.summary.totalExpenses),
        sub: `${reportData.expenses.summary.transactionsCount} registros analizados`,
      },
      {
        label: "PROMEDIO DIARIO",
        value: formatCOP(reportData.expenses.summary.dailyAverage),
        sub: "Cálculo según período",
      },
      {
        label: "CATEGORÍA PRINCIPAL",
        value: reportData.expenses.summary.mainCategory?.category || "N/A",
        sub: reportData.expenses.summary.mainCategory
          ? `${formatCOP(reportData.expenses.summary.mainCategory.amount)} (${reportData.expenses.summary.mainCategory.percentage}%)`
          : "Sin gastos en período",
      },
      {
        label: "DISTRIBUCIÓN CATEGORÍAS",
        value: `${reportData.expenses.categoryDistribution.length} categorías`,
        sub: "Totaliza 100% en período",
      },
    ];

    const cardWidth = (contentWidth - cardGap * (kpisGastos.length - 1)) / kpisGastos.length;

    kpisGastos.forEach((kpi, idx) => {
      const cardX = margin + idx * (cardWidth + cardGap);
      doc.setFillColor(248, 250, 252); // Slate 50
      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 1.5, 1.5, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text(kpi.label, cardX + 3, currentY + 4.5);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42); // Slate 900
      doc.text(kpi.value, cardX + 3, currentY + 9.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text(kpi.sub, cardX + 3, currentY + 13);
    });

    currentY += cardHeight + 5;
  }

  if (view === "compras" || view === "ambos") {
    const kpisCompras = [
      {
        label: "TOTAL COMPRAS CONFIRMADAS",
        value: formatCOP(reportData.purchases.summary.totalPurchases),
        sub: `${reportData.purchases.summary.confirmedPurchasesCount} órdenes confirmadas`,
      },
      {
        label: "CUENTAS POR PAGAR PENDIENTES",
        value: formatCOP(reportData.purchases.summary.pendingAccountsPayableAmount),
        sub: `${reportData.purchases.summary.pendingAccountsPayableCount} deudas a crédito`,
      },
      {
        label: "PROVEEDOR LÍDER",
        value: reportData.purchases.topSuppliers[0]?.supplierName || "N/A",
        sub: reportData.purchases.topSuppliers[0]
          ? `${formatCOP(reportData.purchases.topSuppliers[0].totalAmount)} (${reportData.purchases.topSuppliers[0].percentage}%)`
          : "Sin compras registradas",
      },
      {
        label: "PROVEEDORES ACTIVOS",
        value: `${reportData.purchases.topSuppliers.length} proveedores`,
        sub: "Top compras en período",
      },
    ];

    const cardWidth = (contentWidth - cardGap * (kpisCompras.length - 1)) / kpisCompras.length;

    kpisCompras.forEach((kpi, idx) => {
      const cardX = margin + idx * (cardWidth + cardGap);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 1.5, 1.5, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(kpi.label, cardX + 3, currentY + 4.5);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(kpi.value, cardX + 3, currentY + 9.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(148, 163, 184);
      doc.text(kpi.sub, cardX + 3, currentY + 13);
    });

    currentY += cardHeight + 6;
  }

  // -----------------------------------------------------------------
  // SECCIÓN 1: TABLA DE GASTOS
  // -----------------------------------------------------------------
  if (view === "gastos" || view === "ambos") {
    // Título de la sección
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("1. Detalle de Gastos Operativos y de Producción", margin, currentY);
    currentY += 4;

    const expenseColWidths = {
      date: 32,
      category: 38,
      supplier: 45,
      concept: 80,
      payment: 34,
      amount: 40,
    };

    const renderExpenseTableHeader = () => {
      doc.setFillColor(241, 245, 249); // Slate 100
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, currentY, contentWidth, 6.5, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);

      let x = margin + 2;
      doc.text("FECHA", x, currentY + 4.2);
      x += expenseColWidths.date;
      doc.text("CATEGORÍA", x, currentY + 4.2);
      x += expenseColWidths.category;
      doc.text("PROVEEDOR", x, currentY + 4.2);
      x += expenseColWidths.supplier;
      doc.text("CONCEPTO / DESCRIPCIÓN", x, currentY + 4.2);
      x += expenseColWidths.concept;
      doc.text("MÉTODO PAGO", x, currentY + 4.2);
      x += expenseColWidths.payment;
      doc.text("MONTO", x + expenseColWidths.amount - 4, currentY + 4.2, { align: "right" });

      currentY += 6.5;
    };

    renderExpenseTableHeader();

    const rowHeight = 6.2;
    const maxRows = reportData.expenses.rows.slice(0, 150);

    maxRows.forEach((row, i) => {
      if (currentY + rowHeight > pageHeight - 16) {
        doc.addPage();
        renderHeader(false);
        currentY = 22;
        renderExpenseTableHeader();
      }

      if (i % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, contentWidth, rowHeight, "F");
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(51, 65, 85);

      let x = margin + 2;
      doc.text(row.formattedDate.slice(0, 16), x, currentY + 4.2);
      x += expenseColWidths.date;

      doc.setFont("helvetica", "bold");
      doc.text(row.category.slice(0, 22), x, currentY + 4.2);
      x += expenseColWidths.category;

      doc.setFont("helvetica", "normal");
      doc.text(row.supplierName.slice(0, 26), x, currentY + 4.2);
      x += expenseColWidths.supplier;

      const desc = row.description ? `${row.concept} - ${row.description}` : row.concept;
      doc.text(desc.slice(0, 52), x, currentY + 4.2);
      x += expenseColWidths.concept;

      doc.text(row.paymentMethodLabel, x, currentY + 4.2);
      x += expenseColWidths.payment;

      doc.setFont("helvetica", "bold");
      if (row.status === "cancelled") {
        doc.setTextColor(220, 38, 38);
        doc.text(`[ANUL] ${formatCOP(row.amount)}`, x + expenseColWidths.amount - 4, currentY + 4.2, { align: "right" });
      } else {
        doc.setTextColor(15, 23, 42);
        doc.text(formatCOP(row.amount), x + expenseColWidths.amount - 4, currentY + 4.2, { align: "right" });
      }

      currentY += rowHeight;
    });

    currentY += 6;
  }

  // -----------------------------------------------------------------
  // SECCIÓN 2: TABLA DE COMPRAS CON DETALLE DE PRODUCTOS
  // -----------------------------------------------------------------
  if (view === "compras" || view === "ambos") {
    // Si estamos en "ambos" y queda poco espacio, añadir nueva página para compras
    if (view === "ambos" && currentY > pageHeight - 50) {
      doc.addPage();
      renderHeader(false);
      currentY = 22;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(
      view === "ambos"
        ? "2. Detalle de Compras a Proveedores (con Productos)"
        : "Detalle de Compras a Proveedores (con Productos)",
      margin,
      currentY
    );
    currentY += 4;

    const purchaseColWidths = {
      date: 24,
      docNum: 30,
      supplier: 40,
      products: 90, // Detalle de productos comprados
      subtotal: 26,
      tax: 23,
      total: 36,
    };

    const renderPurchaseTableHeader = () => {
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, currentY, contentWidth, 6.5, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);

      let x = margin + 2;
      doc.text("FECHA", x, currentY + 4.2);
      x += purchaseColWidths.date;
      doc.text("# DOCUMENTO", x, currentY + 4.2);
      x += purchaseColWidths.docNum;
      doc.text("PROVEEDOR", x, currentY + 4.2);
      x += purchaseColWidths.supplier;
      doc.text("PRODUCTOS / INSUMOS DETALLADOS", x, currentY + 4.2);
      x += purchaseColWidths.products;
      doc.text("SUBTOTAL", x + purchaseColWidths.subtotal - 3, currentY + 4.2, { align: "right" });
      x += purchaseColWidths.subtotal;
      doc.text("IMPUESTOS", x + purchaseColWidths.tax - 3, currentY + 4.2, { align: "right" });
      x += purchaseColWidths.tax;
      doc.text("TOTAL NETO", x + purchaseColWidths.total - 4, currentY + 4.2, { align: "right" });

      currentY += 6.5;
    };

    renderPurchaseTableHeader();

    const maxPurchases = reportData.purchases.rows.slice(0, 150);

    maxPurchases.forEach((pur, i) => {
      // Si la compra tiene items, listamos los productos
      const itemsText =
        pur.items.length > 0
          ? pur.items.map((it) => `${it.productName} (x${it.quantity} @ ${formatCOP(it.unitCost)})`).join(", ")
          : pur.itemsSummary;

      // Calcular altura requerida según la extensión del texto de productos
      const lines = doc.splitTextToSize(itemsText, purchaseColWidths.products - 4);
      const rowHeight = Math.max(7, lines.length * 3.4 + 3);

      if (currentY + rowHeight > pageHeight - 16) {
        doc.addPage();
        renderHeader(false);
        currentY = 22;
        renderPurchaseTableHeader();
      }

      if (i % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, contentWidth, rowHeight, "F");
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(51, 65, 85);

      let x = margin + 2;
      doc.text(pur.formattedDate.slice(0, 10), x, currentY + 4.2);
      x += purchaseColWidths.date;

      doc.setFont("helvetica", "bold");
      doc.text(pur.purchaseNumber, x, currentY + 4.2);
      if (pur.invoiceNumber) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Fac: ${pur.invoiceNumber}`, x, currentY + 7.5);
        doc.setFontSize(6.8);
        doc.setTextColor(51, 65, 85);
      }
      x += purchaseColWidths.docNum;

      doc.setFont("helvetica", "bold");
      doc.text(pur.supplierName.slice(0, 24), x, currentY + 4.2);
      x += purchaseColWidths.supplier;

      // Detalle de productos (Criterio de aceptación estricto)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.2);
      doc.setTextColor(71, 85, 105);
      doc.text(lines, x, currentY + 4);
      x += purchaseColWidths.products;

      doc.setFontSize(6.8);
      doc.text(formatCOP(pur.subtotal), x + purchaseColWidths.subtotal - 3, currentY + 4.2, { align: "right" });
      x += purchaseColWidths.subtotal;

      doc.text(formatCOP(pur.taxAmount), x + purchaseColWidths.tax - 3, currentY + 4.2, { align: "right" });
      x += purchaseColWidths.tax;

      doc.setFont("helvetica", "bold");
      if (pur.status === "cancelled") {
        doc.setTextColor(220, 38, 38);
        doc.text(`[ANUL] ${formatCOP(pur.total)}`, x + purchaseColWidths.total - 4, currentY + 4.2, { align: "right" });
      } else {
        doc.setTextColor(15, 23, 42);
        doc.text(formatCOP(pur.total), x + purchaseColWidths.total - 4, currentY + 4.2, { align: "right" });
      }

      currentY += rowHeight;
    });
  }

  // Numeración de páginas en el pie
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(
      `Página ${i} de ${totalPages} — Reporte oficial de gastos y compras generado por NEGOVA`,
      margin,
      pageHeight - 6
    );
    doc.text(
      "Documento contable de supervisión y control fiscal",
      pageWidth - margin,
      pageHeight - 6,
      { align: "right" }
    );
  }

  const dateSlug = new Date().toISOString().slice(0, 10);
  const prefix = view === "gastos" ? "gastos" : view === "compras" ? "compras" : "gastos_compras";
  const filename = `reporte_${prefix}_${sanitizeFilename(businessName)}_${dateSlug}.pdf`;
  const buffer = Buffer.from(doc.output("arraybuffer"));

  return {
    buffer,
    base64: buffer.toString("base64"),
    filename,
    sizeBytes: buffer.byteLength,
  };
}
