import { jsPDF } from "jspdf";
import { SalesReportData, SalesReportRow } from "./types";
import { PdfGenerationResult } from "../pdf/types";

export interface SalesReportPdfParams {
  businessName: string;
  businessNit?: string | null;
  businessAddress?: string | null;
  businessPhone?: string | null;
  logoUrl?: string | null;
  reportData: SalesReportData;
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
 * [REP-002] Genera el reporte formal de ventas en formato PDF (A4 Landscape)
 * con membrete institucional del negocio, logotipo si existe, tabla de transacciones,
 * motivo de anulación para ventas canceladas y resumen financiero inferior.
 */
export function generateSalesReportPdf(params: SalesReportPdfParams): PdfGenerationResult {
  const {
    businessName,
    businessNit,
    businessAddress,
    businessPhone,
    logoUrl,
    reportData,
  } = params;

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();   // 297 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;          // 269 mm

  // Formatear período legible
  let periodText = "Período actual";
  if (reportData.dateRange.startDate && reportData.dateRange.endDate) {
    periodText = `${reportData.dateRange.startDate} al ${reportData.dateRange.endDate}`;
  } else if (reportData.dateRange.preset === "today") {
    periodText = "Ventas de Hoy";
  } else if (reportData.dateRange.preset === "yesterday") {
    periodText = "Ventas de Ayer";
  } else if (reportData.dateRange.preset === "last_7_days") {
    periodText = "Últimos 7 Días";
  } else if (reportData.dateRange.preset === "this_month") {
    periodText = "Este Mes";
  }

  const renderHeader = (isFirstPage: boolean) => {
    // Banner superior
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, pageWidth, isFirstPage ? 32 : 16, "F");

    // Acento naranja NEGOVA
    doc.setFillColor(237, 80, 10); // #ED500A
    doc.rect(0, isFirstPage ? 30.5 : 15, pageWidth, 1.5, "F");

    if (isFirstPage) {
      // Título
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("REPORTE DETALLADO DE VENTAS", margin, 13);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(203, 213, 225); // Slate 300
      doc.text(`PERÍODO: ${periodText.toUpperCase()}`, margin, 20);
      doc.text(`Generado: ${new Date().toLocaleString("es-CO")}`, margin, 26);

      // Datos a la derecha
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text(businessName.toUpperCase(), pageWidth - margin, 13, { align: "right" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225);

      const contactParts: string[] = [];
      if (businessNit) contactParts.push(`NIT: ${businessNit}`);
      if (businessPhone) contactParts.push(`Tel: ${businessPhone}`);
      if (contactParts.length > 0) {
        doc.text(contactParts.join(" | "), pageWidth - margin, 19, { align: "right" });
      }
      if (businessAddress) {
        doc.text(businessAddress, pageWidth - margin, 25, { align: "right" });
      }

      // Logotipo si se suministra en base64
      if (logoUrl && typeof logoUrl === "string" && logoUrl.startsWith("data:image/")) {
        try {
          doc.addImage(logoUrl, "PNG", margin + 110, 5, 22, 22);
        } catch {
          // Fallback silencioso si la imagen no se decodifica
        }
      }
    } else {
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(`REPORTE DE VENTAS — ${businessName.toUpperCase()}`, margin, 10);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225);
      doc.text(`Período: ${periodText}`, pageWidth - margin, 10, { align: "right" });
    }
  };

  // Render inicial de cabecera
  renderHeader(true);

  // 2. Tarjetas resumen superior
  let currentY = 38;

  const cardWidth = contentWidth / 5 - 2.5;
  const cardHeight = 14;

  const summaryCards = [
    { title: "TOTAL BRUTO", value: formatCOP(reportData.summary.totalGross), color: [241, 245, 249], textColor: [15, 23, 42] },
    { title: "TOTAL IMPUESTOS", value: formatCOP(reportData.summary.totalTax), color: [238, 242, 255], textColor: [79, 70, 229] },
    { title: "TOTAL DESCUENTOS", value: formatCOP(reportData.summary.totalDiscount), color: [254, 242, 242], textColor: [225, 29, 72] },
    { title: "TOTAL NETO", value: formatCOP(reportData.summary.totalNet), color: [236, 253, 245], textColor: [5, 150, 105] },
    { title: "TRANSACCIONES", value: `${reportData.summary.transactionCount} ventas`, color: [255, 247, 237], textColor: [194, 65, 12] },
  ];

  summaryCards.forEach((c, idx) => {
    const x = margin + idx * (cardWidth + 3.1);
    doc.setFillColor(c.color[0], c.color[1], c.color[2]);
    doc.roundedRect(x, currentY, cardWidth, cardHeight, 1.5, 1.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(c.title, x + 3, currentY + 4.5);

    doc.setFontSize(9);
    doc.setTextColor(c.textColor[0], c.textColor[1], c.textColor[2]);
    doc.text(c.value, x + 3, currentY + 10.5);
  });

  currentY += cardHeight + 6;

  // 3. Tabla de Datos
  // Columnas con anchos exactos sumando contentWidth (269mm)
  const columns = [
    { header: "FECHA / HORA", width: 28 },
    { header: "NO. DOC", width: 24 },
    { header: "CLIENTE", width: 38 },
    { header: "CANAL", width: 25 },
    { header: "MÉTODO PAGO", width: 25 },
    { header: "EMPLEADO", width: 28 },
    { header: "SUBTOTAL", width: 23, align: "right" as const },
    { header: "IVA", width: 18, align: "right" as const },
    { header: "DESCTO", width: 18, align: "right" as const },
    { header: "TOTAL", width: 23, align: "right" as const },
    { header: "ESTADO / MOTIVO", width: 19 },
  ];

  const renderTableHeader = (y: number) => {
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.rect(margin, y, contentWidth, 7, "F");
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 7, margin + contentWidth, y + 7);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);

    let curX = margin;
    for (const col of columns) {
      if (col.align === "right") {
        doc.text(col.header, curX + col.width - 2, y + 4.8, { align: "right" });
      } else {
        doc.text(col.header, curX + 1.5, y + 4.8);
      }
      curX += col.width;
    }
  };

  renderTableHeader(currentY);
  currentY += 7;

  // Renglones de ventas
  const rowHeight = 6.2;
  const maxY = pageHeight - 16;

  if (reportData.rows.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text("No se encontraron ventas para los filtros y fechas seleccionados.", margin + contentWidth / 2, currentY + 12, {
      align: "center",
    });
  } else {
    reportData.rows.forEach((row, index) => {
      // Si la fila supera el límite inferior, añadir nueva página
      if (currentY + rowHeight > maxY) {
        doc.addPage();
        renderHeader(false);
        currentY = 22;
        renderTableHeader(currentY);
        currentY += 7;
      }

      // Zebra striping
      if (index % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, contentWidth, rowHeight, "F");
      }

      // Línea horizontal sutil
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.2);
      doc.line(margin, currentY + rowHeight, margin + contentWidth, currentY + rowHeight);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(30, 41, 59);

      let curX = margin;

      // 1. Fecha
      doc.text(doc.splitTextToSize(row.formattedDate, columns[0].width - 2)[0] || "", curX + 1.5, currentY + 4.2);
      curX += columns[0].width;

      // 2. No. Doc
      doc.setFont("helvetica", "bold");
      doc.text(doc.splitTextToSize(row.documentNumber, columns[1].width - 2)[0] || "", curX + 1.5, currentY + 4.2);
      doc.setFont("helvetica", "normal");
      curX += columns[1].width;

      // 3. Cliente
      const clientTruncated = doc.splitTextToSize(row.customerName, columns[2].width - 2)[0] || "";
      doc.text(clientTruncated, curX + 1.5, currentY + 4.2);
      curX += columns[2].width;

      // 4. Canal
      doc.text(doc.splitTextToSize(row.channelLabel, columns[3].width - 2)[0] || "", curX + 1.5, currentY + 4.2);
      curX += columns[3].width;

      // 5. Método Pago
      doc.text(doc.splitTextToSize(row.paymentMethodLabel, columns[4].width - 2)[0] || "", curX + 1.5, currentY + 4.2);
      curX += columns[4].width;

      // 6. Empleado
      doc.text(doc.splitTextToSize(row.employeeName, columns[5].width - 2)[0] || "", curX + 1.5, currentY + 4.2);
      curX += columns[5].width;

      // 7. Subtotal
      doc.text(formatCOP(row.subtotal), curX + columns[6].width - 2, currentY + 4.2, { align: "right" });
      curX += columns[6].width;

      // 8. Impuestos
      doc.text(row.taxTotal > 0 ? formatCOP(row.taxTotal) : "$0", curX + columns[7].width - 2, currentY + 4.2, { align: "right" });
      curX += columns[7].width;

      // 9. Descuento
      doc.text(row.discountTotal > 0 ? `-${formatCOP(row.discountTotal)}` : "$0", curX + columns[8].width - 2, currentY + 4.2, { align: "right" });
      curX += columns[8].width;

      // 10. Total
      doc.setFont("helvetica", "bold");
      if (row.status === "cancelled") {
        doc.setTextColor(225, 29, 72); // Rose 600 si cancelada
      } else {
        doc.setTextColor(15, 23, 42);
      }
      doc.text(formatCOP(row.total), curX + columns[9].width - 2, currentY + 4.2, { align: "right" });
      doc.setFont("helvetica", "normal");
      curX += columns[9].width;

      // 11. Estado y motivo si anulada
      if (row.status === "cancelled") {
        doc.setTextColor(225, 29, 72);
        doc.setFont("helvetica", "bold");
        const statusText = row.cancellationReason ? `Anulada (${row.cancellationReason})` : "Anulada";
        doc.text(doc.splitTextToSize(statusText, columns[10].width - 2)[0] || "Anulada", curX + 1.5, currentY + 4.2);
      } else {
        doc.setTextColor(5, 150, 105); // Emerald 600
        doc.text(row.statusLabel, curX + 1.5, currentY + 4.2);
      }

      currentY += rowHeight;
    });
  }

  // 4. Numeración de páginas en el pie de página
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(
      `Página ${i} de ${totalPages} — Reporte oficial generado por NEGOVA`,
      margin,
      pageHeight - 6
    );
    doc.text(
      "Documento contable de supervisión comercial",
      pageWidth - margin,
      pageHeight - 6,
      { align: "right" }
    );
  }

  const dateSlug = new Date().toISOString().slice(0, 10);
  const filename = `reporte_ventas_${sanitizeFilename(businessName)}_${dateSlug}.pdf`;
  const buffer = Buffer.from(doc.output("arraybuffer"));

  return {
    buffer,
    base64: buffer.toString("base64"),
    filename,
    sizeBytes: buffer.byteLength,
  };
}
