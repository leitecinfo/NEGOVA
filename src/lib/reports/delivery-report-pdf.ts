import { jsPDF } from "jspdf";
import { DeliveryReportData } from "./types";
import { PdfGenerationResult } from "../pdf/types";

export interface DeliveryReportPdfParams {
  businessName: string;
  businessNit?: string | null;
  businessAddress?: string | null;
  businessPhone?: string | null;
  logoUrl?: string | null;
  reportData: DeliveryReportData;
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
 * [REP-007] Genera el reporte formal de domicilios y entregas en formato PDF (A4 Landscape)
 * con membrete institucional, tarjetas de KPIs consolidados, tabla de repartidores ordenada por entregas completadas,
 * y distribución por zonas de cobertura.
 */
export function generateDeliveryReportPdf(params: DeliveryReportPdfParams): PdfGenerationResult {
  const {
    businessName,
    businessNit,
    businessAddress,
    businessPhone,
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
    periodText = "Domicilios de Hoy";
  } else if (reportData.dateRange.preset === "yesterday") {
    periodText = "Domicilios de Ayer";
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
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("REPORTE DE DOMICILIOS Y DESPACHOS", margin, 13);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(203, 213, 225);
      doc.text(`Período de análisis: ${periodText}`, margin, 19);

      const generatedAt = new Date().toLocaleString("es-CO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      doc.text(`Generado: ${generatedAt}`, margin, 25);

      // Datos del negocio alineados a la derecha
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text(businessName.toUpperCase(), pageWidth - margin, 12, { align: "right" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225);
      let bizY = 17;
      if (businessNit) {
        doc.text(`NIT: ${businessNit}`, pageWidth - margin, bizY, { align: "right" });
        bizY += 4.5;
      }
      if (businessAddress || businessPhone) {
        const contactStr = [businessAddress, businessPhone].filter(Boolean).join(" • ");
        doc.text(contactStr.slice(0, 50), pageWidth - margin, bizY, { align: "right" });
      }
    } else {
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("REPORTE DE DOMICILIOS Y REPARTO", margin, 10);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225);
      doc.text(`${businessName} • ${periodText}`, pageWidth - margin, 10, { align: "right" });
    }
  };

  const renderFooter = (pageNumber: number, totalPages: number) => {
    const footerY = pageHeight - 8;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, footerY - 2, pageWidth - margin, footerY - 2);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text("NEGOVA SaaS — Módulo de Reportes & Trazabilidad de Domicilios", margin, footerY + 2);
    doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - margin, footerY + 2, { align: "right" });
  };

  renderHeader(true);

  // 1. Tarjetas de Resumen y KPIs Superiores
  let yPos = 38;
  const kpis = [
    {
      title: "Total Entregas",
      val: String(reportData.summary.totalDeliveries),
      sub: `${reportData.summary.successfulDeliveries} exitosas (${reportData.summary.successRate}%)`,
    },
    {
      title: "Tiempo Promedio",
      val: `${reportData.summary.averageDeliveryTimeMinutes} min`,
      sub: "Aceptación -> Entrega",
    },
    {
      title: "Ventas Domicilio",
      val: formatCOP(reportData.summary.totalRevenue),
      sub: `Tarifas: ${formatCOP(reportData.summary.totalTariffs)}`,
    },
    {
      title: "Repartidor Líder",
      val: reportData.summary.topDriver?.driverName || "N/A",
      sub: reportData.summary.topDriver ? `${reportData.summary.topDriver.completedCount} entregas` : "Sin entregas",
    },
  ];

  const cardWidth = (contentWidth - 9) / 4;
  kpis.forEach((kpi, idx) => {
    const cardX = margin + idx * (cardWidth + 3);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(cardX, yPos, cardWidth, 18, 2, 2, "F");
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cardX, yPos, cardWidth, 18, 2, 2, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.title.toUpperCase(), cardX + 3.5, yPos + 4.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(kpi.val, cardX + 3.5, yPos + 10.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.sub, cardX + 3.5, yPos + 15);
  });

  yPos += 24;

  // 2. Tabla de Desempeño por Repartidor
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("DESEMPEÑO POR REPARTIDOR (Ordenado por Entregas Completadas)", margin, yPos);
  yPos += 4.5;

  const colWidths = [12, 50, 25, 25, 25, 30, 25, 35, 42];
  const headers = [
    "#",
    "Repartidor",
    "Completadas",
    "Asignadas",
    "Éxito %",
    "Tiempo Prom.",
    "Calificación",
    "Tarifas (COP)",
    "Total Vendido (COP)",
  ];

  // Render header tabla
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, yPos, contentWidth, 6.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);

  let curX = margin;
  headers.forEach((h, i) => {
    const align = i >= 2 ? "right" : "left";
    const xPos = align === "right" ? curX + colWidths[i] - 2 : curX + 2;
    doc.text(h, xPos, yPos + 4.5, { align });
    curX += colWidths[i];
  });

  yPos += 7;

  // Filas de repartidores
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);

  if (reportData.drivers.length === 0) {
    doc.setTextColor(148, 163, 184);
    doc.text("No se registraron entregas en el período seleccionado.", margin + 2, yPos + 5);
    yPos += 10;
  } else {
    reportData.drivers.forEach((driver, idx) => {
      if (yPos > pageHeight - 20) {
        doc.addPage();
        renderHeader(false);
        yPos = 24;
      }

      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, yPos, contentWidth, 5.5, "F");
      }

      doc.setTextColor(15, 23, 42);
      let rX = margin;

      // Puesto #
      doc.setFont("helvetica", "bold");
      doc.text(`#${idx + 1}`, rX + 2, yPos + 4);
      rX += colWidths[0];

      // Nombre
      doc.setFont("helvetica", "normal");
      doc.text(driver.driverName.slice(0, 26), rX + 2, yPos + 4);
      rX += colWidths[1];

      // Completadas
      doc.setFont("helvetica", "bold");
      doc.setTextColor(16, 185, 129); // Emerald
      doc.text(String(driver.completedDeliveries), rX + colWidths[2] - 2, yPos + 4, { align: "right" });
      rX += colWidths[2];

      // Asignadas
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(String(driver.totalAssigned), rX + colWidths[3] - 2, yPos + 4, { align: "right" });
      rX += colWidths[3];

      // Tasa de éxito
      doc.text(`${driver.completionRate}%`, rX + colWidths[4] - 2, yPos + 4, { align: "right" });
      rX += colWidths[4];

      // Tiempo Promedio
      doc.text(`${driver.averageDeliveryTimeMinutes} min`, rX + colWidths[5] - 2, yPos + 4, { align: "right" });
      rX += colWidths[5];

      // Calificación
      doc.text(`★ ${driver.averageRating.toFixed(1)}`, rX + colWidths[6] - 2, yPos + 4, { align: "right" });
      rX += colWidths[6];

      // Tarifas
      doc.text(formatCOP(driver.totalTariffsCollected), rX + colWidths[7] - 2, yPos + 4, { align: "right" });
      rX += colWidths[7];

      // Total vendido
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(formatCOP(driver.totalAmountCollected), rX + colWidths[8] - 2, yPos + 4, { align: "right" });

      yPos += 5.5;
    });
  }

  yPos += 8;

  // 3. Tabla de Zonas de Entrega
  if (yPos > pageHeight - 35) {
    doc.addPage();
    renderHeader(false);
    yPos = 24;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("ANÁLISIS POR ZONA DE ENTREGA", margin, yPos);
  yPos += 4.5;

  const zoneColWidths = [65, 45, 35, 35, 44, 45];
  const zoneHeaders = [
    "Zona",
    "Tarifa Configurada",
    "Total Pedidos",
    "Entregados",
    "Tiempo Promedio",
    "Total Vendido (COP)",
  ];

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, yPos, contentWidth, 6.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);

  let zHeadX = margin;
  zoneHeaders.forEach((zh, i) => {
    const align = i >= 1 ? "right" : "left";
    const xPos = align === "right" ? zHeadX + zoneColWidths[i] - 2 : zHeadX + 2;
    doc.text(zh, xPos, yPos + 4.5, { align });
    zHeadX += zoneColWidths[i];
  });

  yPos += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);

  if (reportData.zones.length === 0) {
    doc.setTextColor(148, 163, 184);
    doc.text("No se registraron zonas de entrega en este período.", margin + 2, yPos + 5);
  } else {
    reportData.zones.forEach((zone, idx) => {
      if (yPos > pageHeight - 20) {
        doc.addPage();
        renderHeader(false);
        yPos = 24;
      }

      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, yPos, contentWidth, 5.5, "F");
      }

      let zRowX = margin;

      // Nombre Zona
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(zone.zoneName.slice(0, 32), zRowX + 2, yPos + 4);
      zRowX += zoneColWidths[0];

      // Tarifa
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(formatCOP(zone.tariff), zRowX + zoneColWidths[1] - 2, yPos + 4, { align: "right" });
      zRowX += zoneColWidths[1];

      // Total Pedidos
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(String(zone.totalOrders), zRowX + zoneColWidths[2] - 2, yPos + 4, { align: "right" });
      zRowX += zoneColWidths[2];

      // Completados
      doc.setTextColor(16, 185, 129);
      doc.text(String(zone.completedOrders), zRowX + zoneColWidths[3] - 2, yPos + 4, { align: "right" });
      zRowX += zoneColWidths[3];

      // Tiempo Promedio
      doc.setTextColor(71, 85, 105);
      doc.text(`${zone.averageDeliveryTimeMinutes} min`, zRowX + zoneColWidths[4] - 2, yPos + 4, { align: "right" });
      zRowX += zoneColWidths[4];

      // Total Vendido
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(formatCOP(zone.totalAmount), zRowX + zoneColWidths[5] - 2, yPos + 4, { align: "right" });

      yPos += 5.5;
    });
  }

  // Paginación en pie de página
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    renderFooter(p, totalPages);
  }

  const filename = `reporte_domicilios_${sanitizeFilename(businessName)}_${reportData.dateRange.startDate || "inicio"}_${reportData.dateRange.endDate || "hoy"}.pdf`;
  const base64 = doc.output("datauristring").split(",")[1];
  const buffer = Buffer.from(base64, "base64");

  return {
    buffer,
    base64,
    filename,
    sizeBytes: buffer.length,
    contentType: "application/pdf",
  };
}
