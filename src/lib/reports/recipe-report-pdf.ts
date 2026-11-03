import { jsPDF } from "jspdf";
import { RecipeReportData, RecipeProductCostItem, IngredientConsumptionItem } from "./types";
import { PdfGenerationResult } from "../pdf/types";

export interface RecipeReportPdfParams {
  businessName: string;
  businessNit?: string | null;
  businessAddress?: string | null;
  businessPhone?: string | null;
  logoUrl?: string | null;
  reportData: RecipeReportData;
  view?: "costos" | "ingredientes" | "todo";
}

function formatCurrency(amount: number, currency: string = "COP"): string {
  if (currency === "COP") {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 30);
}

/**
 * [REP-008] Genera el reporte formal de recetas, escandallos y costos en formato PDF (A4 Landscape)
 * con membrete institucional, tarjetas de KPIs ejecutivos, tablas de escandallo con alertas de margen
 * y análisis de consumo/agotamiento proyectado de ingredientes.
 */
export function generateRecipeReportPdf(params: RecipeReportPdfParams): PdfGenerationResult {
  const {
    businessName,
    businessNit,
    businessAddress,
    businessPhone,
    reportData,
    view = "todo",
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
  const currency = reportData.currency || "COP";

  const periodText = `${reportData.dateRange.startDate} al ${reportData.dateRange.endDate} (${reportData.dateRange.daysCount} días)`;

  const renderHeader = (isFirstPage: boolean) => {
    // Banner superior Slate 900
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, isFirstPage ? 32 : 16, "F");

    // Acento naranja NEGOVA (#ED500A)
    doc.setFillColor(237, 80, 10);
    doc.rect(0, isFirstPage ? 30.5 : 15, pageWidth, 1.5, "F");

    if (isFirstPage) {
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("REPORTE DE RECETAS, ESCANDALLOS Y COSTOS", margin, 13);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text(
        `Período de análisis: ${periodText}  |  Emisión: ${new Date().toLocaleDateString("es-CO")}`,
        margin,
        20
      );

      // Datos de la empresa
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(businessName.toUpperCase(), pageWidth - margin, 12, { align: "right" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225);
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
      // Header páginas siguientes
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(`REPORTE DE RECETAS Y COSTOS — ${businessName.toUpperCase()}`, margin, 10);

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
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      "NEGOVA Cloud POS & ERP  |  Módulo de Costos y Recetas  |  Cálculos de Escandallo y Margen Bruto",
      margin,
      footerY + 2
    );

    const pageStr = `Página ${pageNo} de ${totalPages}`;
    doc.text(pageStr, pageWidth - margin, footerY + 2, { align: "right" });
  };

  // Render inicial
  renderHeader(true);
  let currentY = 38;

  // 1. Tarjetas de Resumen KPI
  const cardWidth = (contentWidth - 9) / 4;
  const cardHeight = 22;

  const kpis = [
    {
      title: "TOTAL RECETAS ACTIVAS",
      value: `${reportData.summary.totalRecipes}`,
      subtext: `${reportData.productCosts.length} productos analizados`,
      color: [59, 130, 246], // Blue
      bg: [239, 246, 255],
    },
    {
      title: "MARGEN BRUTO PROMEDIO",
      value: `${reportData.summary.averageGrossMarginPercentage.toFixed(1)}%`,
      subtext: "Promedio ponderado de escandallos",
      color: reportData.summary.averageGrossMarginPercentage >= 30 ? [16, 185, 129] : [245, 158, 11],
      bg: reportData.summary.averageGrossMarginPercentage >= 30 ? [240, 253, 244] : [254, 243, 199],
    },
    {
      title: "ALERTAS DE MARGEN (< 30%)",
      value: `${reportData.summary.productsWithCriticalMarginCount}`,
      subtext: `${reportData.summary.productsWithNegativeMarginCount} productos con margen negativo`,
      color: [239, 68, 68], // Red
      bg: [254, 242, 242],
    },
    {
      title: "COSTO CONSUMO PERÍODO",
      value: formatCurrency(reportData.summary.totalIngredientCostConsumed, currency),
      subtext: `${reportData.summary.ingredientsAtDepletionRiskCount} ingredientes en riesgo agotamiento`,
      color: [139, 92, 246], // Purple
      bg: [245, 243, 255],
    },
  ];

  kpis.forEach((kpi, idx) => {
    const cardX = margin + idx * (cardWidth + 3);

    doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
    doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 2, 2, "F");

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 2, 2, "S");

    doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.rect(cardX, currentY, 2.5, cardHeight, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(kpi.title, cardX + 5, currentY + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(kpi.value, cardX + 5, currentY + 13.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.subtext, cardX + 5, currentY + 18.5);
  });

  currentY += cardHeight + 8;

  // ==========================================
  // TABLA 1: COSTOS POR PRODUCTO (ESCANDALLOS)
  // ==========================================
  if (view === "costos" || view === "todo") {
    // Encabezado de sección
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("1. COSTOS Y MÁRGENES POR PRODUCTO (ESCANDALLOS)", margin, currentY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      "Ordenado por margen ascendente. Productos con margen inferior al 30% o negativo se destacan en alerta.",
      margin + 115,
      currentY
    );

    currentY += 4;

    const colWidths = [65, 40, 20, 28, 28, 28, 28, 32];
    const headers = [
      "Producto",
      "Categoría",
      "Porc.",
      "Costo Receta",
      "Precio Venta",
      "Margen ($)",
      "Margen (%)",
      "Estado",
    ];

    const drawCostTableHeader = (y: number) => {
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);

      let x = margin;
      headers.forEach((h, i) => {
        const align = i >= 2 && i <= 6 ? "right" : "left";
        const tx = align === "right" ? x + colWidths[i] - 2 : x + 2;
        doc.text(h, tx, y + 4.8, { align });
        x += colWidths[i];
      });
    };

    drawCostTableHeader(currentY);
    currentY += 7;

    for (const item of reportData.productCosts) {
      if (currentY > pageHeight - 20) {
        doc.addPage();
        renderHeader(false);
        currentY = 22;
        drawCostTableHeader(currentY);
        currentY += 7;
      }

      // Alerta de fondo para margen crítico
      if (item.marginStatus === "critical") {
        doc.setFillColor(254, 242, 242);
        doc.rect(margin, currentY, contentWidth, 6, "F");
      } else if (item.marginStatus === "warning") {
        doc.setFillColor(255, 251, 235);
        doc.rect(margin, currentY, contentWidth, 6, "F");
      }

      doc.setDrawColor(241, 245, 249);
      doc.line(margin, currentY + 6, margin + contentWidth, currentY + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(item.marginStatus === "critical" ? 185 : 30, item.marginStatus === "critical" ? 28 : 41, item.marginStatus === "critical" ? 28 : 59);

      let x = margin;
      // 0: Producto
      doc.text(doc.splitTextToSize(item.productName, colWidths[0] - 4)[0], x + 2, currentY + 4.2);
      x += colWidths[0];

      // 1: Categoría
      doc.setTextColor(100, 116, 139);
      doc.text(doc.splitTextToSize(item.categoryName, colWidths[1] - 4)[0], x + 2, currentY + 4.2);
      x += colWidths[1];

      // 2: Porciones
      doc.setTextColor(51, 65, 85);
      doc.text(`${item.portions}`, x + colWidths[2] - 2, currentY + 4.2, { align: "right" });
      x += colWidths[2];

      // 3: Costo Receta
      doc.text(formatCurrency(item.recipeCost, currency), x + colWidths[3] - 2, currentY + 4.2, { align: "right" });
      x += colWidths[3];

      // 4: Precio Venta
      doc.text(formatCurrency(item.salePrice, currency), x + colWidths[4] - 2, currentY + 4.2, { align: "right" });
      x += colWidths[4];

      // 5: Margen ($)
      if (item.grossMarginAmount < 0) {
        doc.setTextColor(220, 38, 38);
      } else {
        doc.setTextColor(16, 185, 129);
      }
      doc.text(formatCurrency(item.grossMarginAmount, currency), x + colWidths[5] - 2, currentY + 4.2, { align: "right" });
      x += colWidths[5];

      // 6: Margen (%)
      doc.setFont("helvetica", "bold");
      doc.text(`${item.grossMarginPercentage.toFixed(1)}%`, x + colWidths[6] - 2, currentY + 4.2, { align: "right" });
      x += colWidths[6];

      // 7: Estado
      let statusStr = "Saludable";
      if (item.marginStatus === "critical") {
        doc.setTextColor(220, 38, 38);
        statusStr = "Pérdida (<0%)";
      } else if (item.marginStatus === "warning") {
        doc.setTextColor(217, 119, 6);
        statusStr = "Alerta (<30%)";
      } else {
        doc.setTextColor(22, 163, 74);
      }
      doc.text(statusStr, x + 2, currentY + 4.2);

      currentY += 6;
    }

    currentY += 8;
  }

  // ==========================================
  // TABLA 2: CONSUMO Y AGOTAMIENTO DE INGREDIENTES
  // ==========================================
  if (view === "ingredientes" || view === "todo") {
    // Si queda poco espacio, pasar a nueva página
    if (currentY > pageHeight - 50) {
      doc.addPage();
      renderHeader(false);
      currentY = 22;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("2. CONSUMO DE INGREDIENTES Y RIESGO DE AGOTAMIENTO", margin, currentY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      "Consumo calculado a partir de ventas del período multiplicadas por escandallo. Días restantes proyectados.",
      margin + 120,
      currentY
    );

    currentY += 4;

    const ingColWidths = [65, 25, 22, 32, 32, 28, 28, 37];
    const ingHeaders = [
      "Ingrediente",
      "Stock Actual",
      "Unidad",
      "Consumo Período",
      "Costo Consumido",
      "Ritmo Diario",
      "Días Restantes",
      "Alerta Agotamiento",
    ];

    const drawIngTableHeader = (y: number) => {
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);

      let x = margin;
      ingHeaders.forEach((h, i) => {
        const align = i >= 1 && i <= 6 ? "right" : "left";
        const tx = align === "right" ? x + ingColWidths[i] - 2 : x + 2;
        doc.text(h, tx, y + 4.8, { align });
        x += ingColWidths[i];
      });
    };

    drawIngTableHeader(currentY);
    currentY += 7;

    for (const ing of reportData.ingredientConsumptions) {
      if (currentY > pageHeight - 20) {
        doc.addPage();
        renderHeader(false);
        currentY = 22;
        drawIngTableHeader(currentY);
        currentY += 7;
      }

      // Resaltar alertas
      if (ing.depletionAlert === "depleted" || ing.depletionAlert === "critical") {
        doc.setFillColor(254, 242, 242);
        doc.rect(margin, currentY, contentWidth, 6, "F");
      } else if (ing.depletionAlert === "warning") {
        doc.setFillColor(255, 251, 235);
        doc.rect(margin, currentY, contentWidth, 6, "F");
      }

      doc.setDrawColor(241, 245, 249);
      doc.line(margin, currentY + 6, margin + contentWidth, currentY + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);

      let x = margin;
      // 0: Ingrediente
      doc.text(doc.splitTextToSize(ing.ingredientName, ingColWidths[0] - 4)[0], x + 2, currentY + 4.2);
      x += ingColWidths[0];

      // 1: Stock Actual
      const stockStr = `${ing.currentStock.toLocaleString("es-CO")}`;
      doc.text(stockStr, x + ingColWidths[1] - 2, currentY + 4.2, { align: "right" });
      x += ingColWidths[1];

      // 2: Unidad
      doc.setTextColor(100, 116, 139);
      doc.text(ing.unit, x + ingColWidths[2] - 2, currentY + 4.2, { align: "right" });
      x += ingColWidths[2];

      // 3: Consumo Período
      doc.setTextColor(51, 65, 85);
      doc.text(`${ing.periodConsumption.toFixed(2)} ${ing.unit}`, x + ingColWidths[3] - 2, currentY + 4.2, { align: "right" });
      x += ingColWidths[3];

      // 4: Costo Consumido
      doc.text(formatCurrency(ing.totalCostConsumed, currency), x + ingColWidths[4] - 2, currentY + 4.2, { align: "right" });
      x += ingColWidths[4];

      // 5: Ritmo Diario
      doc.text(`${ing.dailyBurnRate.toFixed(2)} /día`, x + ingColWidths[5] - 2, currentY + 4.2, { align: "right" });
      x += ingColWidths[5];

      // 6: Días Restantes
      doc.setFont("helvetica", "bold");
      const daysStr = ing.daysUntilDepleted !== null ? `${ing.daysUntilDepleted} d` : "-";
      doc.text(daysStr, x + ingColWidths[6] - 2, currentY + 4.2, { align: "right" });
      x += ingColWidths[6];

      // 7: Alerta Agotamiento
      let alertLabel = "Estable";
      if (ing.depletionAlert === "depleted") {
        doc.setTextColor(220, 38, 38);
        alertLabel = "Agotado (0 stock)";
      } else if (ing.depletionAlert === "critical") {
        doc.setTextColor(220, 38, 38);
        alertLabel = "Crítico (≤ 3 días)";
      } else if (ing.depletionAlert === "warning") {
        doc.setTextColor(217, 119, 6);
        alertLabel = "Alerta (≤ 7 días)";
      } else if (ing.depletionAlert === "no_consumption") {
        doc.setTextColor(148, 163, 184);
        alertLabel = "Sin consumo";
      } else {
        doc.setTextColor(22, 163, 74);
      }
      doc.text(alertLabel, x + 2, currentY + 4.2);

      currentY += 6;
    }
  }

  // Paginación en todas las hojas
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    renderFooter(p, totalPages);
  }

  const safeBizName = sanitizeFilename(businessName || "comercio");
  const filename = `reporte_recetas_costos_${view}_${safeBizName}_${Date.now()}.pdf`;

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
