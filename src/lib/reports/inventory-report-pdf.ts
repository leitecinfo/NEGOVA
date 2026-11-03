import { jsPDF } from "jspdf";
import { InventoryReportData, InventoryStockReportRow } from "./types";
import { PdfGenerationResult } from "../pdf/types";

export interface InventoryReportPdfParams {
  businessName: string;
  businessNit?: string | null;
  businessAddress?: string | null;
  businessPhone?: string | null;
  logoUrl?: string | null;
  reportData: InventoryReportData;
  view?: "existencias" | "movimientos" | "bajo_stock";
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
 * [REP-004] Genera el reporte formal de inventario en formato PDF (A4 Landscape)
 * con membrete institucional del negocio, resumen consolidado de existencias,
 * indicadores de stock crítico y tablas formateadas con paginación limpia.
 */
export function generateInventoryReportPdf(params: InventoryReportPdfParams): PdfGenerationResult {
  const {
    businessName,
    businessNit,
    businessAddress,
    businessPhone,
    logoUrl,
    reportData,
    view = "existencias",
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
    periodText = "Movimientos de Hoy";
  } else if (reportData.dateRange.preset === "yesterday") {
    periodText = "Movimientos de Ayer";
  } else if (reportData.dateRange.preset === "last_7_days") {
    periodText = "Últimos 7 Días";
  } else if (reportData.dateRange.preset === "this_month") {
    periodText = "Este Mes";
  }

  const renderHeader = (isFirstPage: boolean) => {
    // Banner superior Slate 900
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, isFirstPage ? 32 : 16, "F");

    // Acento naranja NEGOVA (#ED500A)
    doc.setFillColor(237, 80, 10);
    doc.rect(0, isFirstPage ? 30.5 : 15, pageWidth, 1.5, "F");

    if (isFirstPage) {
      // Título
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      let title = "REPORTE CONSOLIDADO DE INVENTARIO Y EXISTENCIAS";
      if (view === "movimientos") {
        title = "REPORTE DE MOVIMIENTOS Y KARDEX DE INVENTARIO";
      } else if (view === "bajo_stock") {
        title = "REPORTE DE PRODUCTOS CON STOCK BAJO Y REPOSICIÓN";
      }
      doc.text(title, margin, 13);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text(`Período de análisis: ${periodText}  |  Fecha de emisión: ${new Date().toLocaleDateString("es-CO")}`, margin, 20);

      // Datos de la empresa a la derecha
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(businessName.toUpperCase(), pageWidth - margin, 12, { align: "right" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225); // Slate 300
      let contactLine = "";
      if (businessNit) contactLine += `NIT: ${businessNit}  `;
      if (businessPhone) contactLine += `Tel: ${businessPhone}  `;
      if (contactLine) {
        doc.text(contactLine, pageWidth - margin, 18, { align: "right" });
      }
      if (businessAddress) {
        doc.text(businessAddress, pageWidth - margin, 24, { align: "right" });
      }
    } else {
      // Header reducido para páginas 2+
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(`REPORTE DE INVENTARIO — ${businessName.toUpperCase()}`, margin, 10);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225);
      doc.text(`Período: ${periodText}`, pageWidth - margin, 10, { align: "right" });
    }
  };

  const renderFooter = (pageNo: number, totalPages: number) => {
    const footerY = pageHeight - 8;
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 2, pageWidth - margin, footerY - 2);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text("NEGOVA Cloud POS & ERP  |  Módulo de Reportes de Inventario  |  Aislamiento Multi-tenant Certificado", margin, footerY + 2);

    const pageStr = `Página ${pageNo} de ${totalPages}`;
    doc.text(pageStr, pageWidth - margin, footerY + 2, { align: "right" });
  };

  // Renderizar encabezado primera página
  renderHeader(true);

  let currentY = 40;

  // 1. Tarjetas de Resumen KPI (solo en la primera página)
  const cardWidth = (contentWidth - 9) / 4;
  const cardHeight = 22;

  const kpis = [
    {
      title: "VALOR TOTAL INVENTARIO",
      value: formatCOP(reportData.summary.totalInventoryValue),
      subtext: `${reportData.summary.totalItemsCount.toLocaleString("es-CO")} unidades en stock`,
      color: [16, 185, 129], // Emerald
      bg: [240, 253, 244],
    },
    {
      title: "TOTAL REGISTROS MONITOREADOS",
      value: `${reportData.summary.totalProductsCount}`,
      subtext: `${reportData.stockRows.length} existencias listadas`,
      color: [59, 130, 246], // Blue
      bg: [239, 246, 255],
    },
    {
      title: "STOCK BAJO (ALERTA)",
      value: `${reportData.summary.lowStockCount}`,
      subtext: "Por debajo o igual al mínimo",
      color: [245, 158, 11], // Amber
      bg: [254, 243, 199],
    },
    {
      title: "SIN STOCK (AGOTADOS)",
      value: `${reportData.summary.outOfStockCount}`,
      subtext: "Existencia agotada (0 o negativa)",
      color: [239, 68, 68], // Red
      bg: [254, 242, 242],
    },
  ];

  kpis.forEach((kpi, idx) => {
    const cardX = margin + idx * (cardWidth + 3);

    // Fondo de la tarjeta
    doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
    doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 2, 2, "F");

    // Borde fino
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 2, 2, "S");

    // Indicador de color lateral
    doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.rect(cardX, currentY, 2.5, cardHeight, "F");

    // Título
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105); // Slate 600
    doc.text(kpi.title, cardX + 5, currentY + 6);

    // Valor Principal
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.text(kpi.value, cardX + 5, currentY + 13.5);

    // Subtexto
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text(kpi.subtext, cardX + 5, currentY + 18.5);
  });

  currentY += cardHeight + 8;

  // 2. Tabla de Datos
  // Anchos y columnas según vista
  let colHeaders: string[] = [];
  let colWidths: number[] = [];
  let colAligns: ("left" | "right" | "center")[] = [];

  if (view === "movimientos") {
    colHeaders = ["Fecha", "Producto", "Ubicación", "Tipo", "Cant.", "Costo Unit.", "Referencia / Motivo", "Usuario"];
    colWidths = [32, 58, 35, 34, 18, 26, 42, 24];
    colAligns = ["left", "left", "left", "left", "right", "right", "left", "left"];
  } else if (view === "bajo_stock") {
    colHeaders = ["Producto", "Categoría", "Ubicación", "Stock Actual", "Stock Mín.", "Déficit", "Costo Reposición", "Estado"];
    colWidths = [60, 38, 35, 24, 24, 24, 34, 30];
    colAligns = ["left", "left", "left", "right", "right", "right", "right", "center"];
  } else {
    // existencias
    colHeaders = ["Producto", "Categoría", "Ubicación", "Cantidad", "Stock Mín.", "Costo Unit.", "Valor Total", "Estado"];
    colWidths = [62, 38, 35, 24, 24, 28, 30, 28];
    colAligns = ["left", "left", "left", "right", "right", "right", "right", "center"];
  }

  const renderTableHeader = (y: number) => {
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(margin, y, contentWidth, 7, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);

    let xCursor = margin;
    colHeaders.forEach((hdr, idx) => {
      const w = colWidths[idx];
      const align = colAligns[idx];
      if (align === "right") {
        doc.text(hdr, xCursor + w - 2, y + 5, { align: "right" });
      } else if (align === "center") {
        doc.text(hdr, xCursor + w / 2, y + 5, { align: "center" });
      } else {
        doc.text(hdr, xCursor + 2, y + 5);
      }
      xCursor += w;
    });
  };

  renderTableHeader(currentY);
  currentY += 7;

  const rowHeight = 6.2;
  const bottomLimit = pageHeight - 16;

  // Renderizado de filas
  const renderRow = (cells: string[], statusColor?: [number, number, number], isEven = false) => {
    if (currentY + rowHeight > bottomLimit) {
      doc.addPage("a4", "landscape");
      renderHeader(false);
      currentY = 22;
      renderTableHeader(currentY);
      currentY += 7;
    }

    if (isEven) {
      doc.setFillColor(248, 250, 252); // Slate 50
      doc.rect(margin, currentY, contentWidth, rowHeight, "F");
    }

    // Línea divisoria inferior
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(margin, currentY + rowHeight, margin + contentWidth, currentY + rowHeight);

    let xCursor = margin;
    cells.forEach((cellText, idx) => {
      const w = colWidths[idx];
      const align = colAligns[idx];

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42); // Slate 900

      // Si es la última columna (Estado) con color especial
      if (idx === cells.length - 1 && statusColor) {
        doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
        doc.setFont("helvetica", "bold");
      }

      // Truncar si excede
      const maxWidth = w - 4;
      let printText = cellText;
      if (doc.getTextWidth(printText) > maxWidth) {
        while (doc.getTextWidth(printText + "...") > maxWidth && printText.length > 2) {
          printText = printText.slice(0, -1);
        }
        printText += "...";
      }

      if (align === "right") {
        doc.text(printText, xCursor + w - 2, currentY + 4.2, { align: "right" });
      } else if (align === "center") {
        doc.text(printText, xCursor + w / 2, currentY + 4.2, { align: "center" });
      } else {
        doc.text(printText, xCursor + 2, currentY + 4.2);
      }

      xCursor += w;
    });

    currentY += rowHeight;
  };

  if (view === "movimientos") {
    reportData.movementsRows.forEach((row, i) => {
      const cells = [
        row.formattedDate,
        row.productName,
        row.locationName,
        row.movementTypeLabel,
        String(row.quantity),
        row.unitCost !== null ? formatCOP(row.unitCost) : "-",
        row.referenceLabel,
        row.createdByName,
      ];
      renderRow(cells, undefined, i % 2 === 1);
    });
  } else if (view === "bajo_stock") {
    reportData.lowStockRows.forEach((row, i) => {
      const statusColor: [number, number, number] = row.status === "out_of_stock" ? [220, 38, 38] : [217, 119, 6];
      const cells = [
        row.productName,
        row.categoryName,
        row.locationName,
        String(row.quantity),
        String(row.minStock),
        String(row.deficit),
        formatCOP(row.replenishmentCost),
        row.statusLabel,
      ];
      renderRow(cells, statusColor, i % 2 === 1);
    });
  } else {
    // existencias
    reportData.stockRows.forEach((row, i) => {
      let statusColor: [number, number, number] = [22, 101, 52]; // Verde normal
      if (row.status === "out_of_stock") {
        statusColor = [220, 38, 38]; // Rojo
      } else if (row.status === "low") {
        statusColor = [217, 119, 6]; // Amarillo
      }
      const cells = [
        row.productName,
        row.categoryName,
        row.locationName,
        String(row.quantity),
        String(row.minStock),
        formatCOP(row.cost),
        formatCOP(row.totalValue),
        row.statusLabel,
      ];
      renderRow(cells, statusColor, i % 2 === 1);
    });
  }

  // Si no hay filas
  const totalCount =
    view === "movimientos"
      ? reportData.movementsRows.length
      : view === "bajo_stock"
      ? reportData.lowStockRows.length
      : reportData.stockRows.length;

  if (totalCount === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text("No se encontraron registros de inventario con los filtros seleccionados.", pageWidth / 2, currentY + 10, { align: "center" });
    currentY += 16;
  }

  // Fila de Totales al final (solo en vista de existencias)
  if (view === "existencias" && reportData.stockRows.length > 0) {
    if (currentY + 8 > bottomLimit) {
      doc.addPage("a4", "landscape");
      renderHeader(false);
      currentY = 22;
    }
    doc.setFillColor(241, 245, 249); // Slate 100
    doc.rect(margin, currentY, contentWidth, 7, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text("TOTAL GENERAL:", margin + 4, currentY + 4.8);

    doc.text(
      `${reportData.summary.totalItemsCount.toLocaleString("es-CO")} uds.`,
      margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] - 2,
      currentY + 4.8,
      { align: "right" }
    );

    doc.text(
      formatCOP(reportData.summary.totalInventoryValue),
      margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6] - 2,
      currentY + 4.8,
      { align: "right" }
    );

    currentY += 9;
  }

  // Agregar número de páginas en todas las hojas
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    renderFooter(p, totalPages);
  }

  const safeBizName = sanitizeFilename(businessName || "comercio");
  const filename = `reporte_inventario_${view}_${safeBizName}_${Date.now()}.pdf`;

  const pdfOutput = doc.output("arraybuffer");
  const buffer = Buffer.from(pdfOutput);
  const base64 = buffer.toString("base64");

  return {
    buffer,
    base64,
    filename,
    contentType: "application/pdf",
    sizeBytes: buffer.byteLength,
  };
}
