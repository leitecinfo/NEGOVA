import { jsPDF } from "jspdf";
import { EmployeeReportData, EmployeeReportMetricItem } from "./types";
import { PdfGenerationResult } from "../pdf/types";

export interface EmployeeReportPdfParams {
  businessName: string;
  businessNit?: string | null;
  businessAddress?: string | null;
  businessPhone?: string | null;
  logoUrl?: string | null;
  reportData: EmployeeReportData;
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
 * [REP-003] Genera el reporte formal de empleados y rendimiento en formato PDF (A4 Landscape)
 * con membrete institucional del negocio, resumen consolidado de totales, período y tabla de ranking.
 * 
 * Criterio de Aceptación:
 * - El PDF incluye período y resumen de totales.
 * - Lista de empleados ordenada de mayor a menor según el ranking de ventas.
 */
export function generateEmployeeReportPdf(params: EmployeeReportPdfParams): PdfGenerationResult {
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
      doc.text("REPORTE DE RENDIMIENTO POR EMPLEADO", margin, 13);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(203, 213, 225); // Slate 300
      doc.text(`Período de análisis: ${periodText}`, margin, 19);

      // Metadatos de generación
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
      // Cabecera compacta para páginas subsiguientes
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("REPORTE DE EMPLEADOS", margin, 10);

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
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text("NEGOVA SaaS — Módulo de Reportes & Analítica Laboral", margin, footerY + 2);
    doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - margin, footerY + 2, { align: "right" });
  };

  // Render inicial de cabecera
  renderHeader(true);

  // 1. Resumen de Totales y KPIs Superiores
  let yPos = 38;

  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.roundedRect(margin, yPos, contentWidth, 23, 2, 2, "FD");

  const colWidth = contentWidth / 6;

  // Caja 1: Total Ventas del Equipo
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL VENTAS EQUIPO", margin + 4, yPos + 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(formatCOP(reportData.summary.totalTeamSalesAmount), margin + 4, yPos + 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`${reportData.summary.totalTeamSalesCount} transacciones`, margin + 4, yPos + 18.5);

  // Caja 2: Ticket Promedio
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("TICKET PROMEDIO", margin + colWidth + 4, yPos + 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(formatCOP(reportData.summary.averageTeamTicketAmount), margin + colWidth + 4, yPos + 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("promedio por venta", margin + colWidth + 4, yPos + 18.5);

  // Caja 3: Turnos y Horas
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("TURNOS Y HORAS", margin + colWidth * 2 + 4, yPos + 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`${reportData.summary.totalShiftsWorked} turnos`, margin + colWidth * 2 + 4, yPos + 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`${reportData.summary.totalHoursWorked} hrs laboradas`, margin + colWidth * 2 + 4, yPos + 18.5);

  // Caja 4: Propinas Totales
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("PROPINAS REGISTRADAS", margin + colWidth * 3 + 4, yPos + 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(16, 185, 129); // Emerald 600
  doc.text(formatCOP(reportData.summary.totalTipsAmount), margin + colWidth * 3 + 4, yPos + 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("recaudo del período", margin + colWidth * 3 + 4, yPos + 18.5);

  // Caja 5: Colaboradores Activos
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("EQUIPO ACTIVO", margin + colWidth * 4 + 4, yPos + 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`${reportData.summary.activeEmployeesCount} activos`, margin + colWidth * 4 + 4, yPos + 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`de ${reportData.summary.totalEmployees} colaboradores`, margin + colWidth * 4 + 4, yPos + 18.5);

  // Caja 6: Top Vendedor
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("LÍDER EN VENTAS", margin + colWidth * 5 + 4, yPos + 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(237, 80, 10); // NEGOVA Orange
  const topName = reportData.summary.topPerformerName || "Sin ventas";
  doc.text(topName.slice(0, 18), margin + colWidth * 5 + 4, yPos + 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(formatCOP(reportData.summary.topPerformerSalesAmount), margin + colWidth * 5 + 4, yPos + 18.5);

  // 2. Tabla Detallada por Empleado
  yPos += 28;

  // Definición de columnas de la tabla
  const columns = [
    { title: "POS", width: 14, align: "center" as const },
    { title: "COLABORADOR", width: 56, align: "left" as const },
    { title: "ROL", width: 32, align: "left" as const },
    { title: "VENTAS", width: 20, align: "right" as const },
    { title: "TOTAL VENDIDO", width: 34, align: "right" as const },
    { title: "% VTA", width: 18, align: "right" as const },
    { title: "TICKET PROM.", width: 32, align: "right" as const },
    { title: "TURNOS", width: 18, align: "center" as const },
    { title: "HORAS", width: 18, align: "right" as const },
    { title: "PROPINAS", width: 27, align: "right" as const },
  ];

  const renderTableHeaders = (currentY: number) => {
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(margin, currentY, contentWidth, 7.5, "F");

    let x = margin;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);

    for (const col of columns) {
      if (col.align === "right") {
        doc.text(col.title, x + col.width - 2, currentY + 5.2, { align: "right" });
      } else if (col.align === "center") {
        doc.text(col.title, x + col.width / 2, currentY + 5.2, { align: "center" });
      } else {
        doc.text(col.title, x + 2, currentY + 5.2);
      }
      x += col.width;
    }
  };

  renderTableHeaders(yPos);
  yPos += 7.5;

  const rowHeight = 7.5;
  const bottomLimit = pageHeight - 16;

  // Renderizar filas
  reportData.employees.forEach((emp, index) => {
    // Si se pasa del límite inferior, crear nueva página
    if (yPos + rowHeight > bottomLimit) {
      doc.addPage();
      renderHeader(false);
      yPos = 22;
      renderTableHeaders(yPos);
      yPos += 7.5;
    }

    // Fondo alternado
    if (index % 2 === 0) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(248, 250, 252);
    }
    doc.rect(margin, yPos, contentWidth, rowHeight, "F");

    // Borde inferior sutil
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, yPos + rowHeight, margin + contentWidth, yPos + rowHeight);

    let x = margin;
    doc.setFontSize(7.5);

    // 1. Posición / Ranking
    if (emp.rank === 1) {
      doc.setFillColor(254, 240, 138); // Yellow 200 (Oro)
      doc.roundedRect(x + 2, yPos + 1.2, 10, 5, 1, 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setTextColor(161, 98, 7); // Yellow 800
      doc.text("#1", x + 7, yPos + 4.8, { align: "center" });
    } else if (emp.rank === 2) {
      doc.setFillColor(226, 232, 240); // Slate 200 (Plata)
      doc.roundedRect(x + 2, yPos + 1.2, 10, 5, 1, 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setTextColor(71, 85, 105);
      doc.text("#2", x + 7, yPos + 4.8, { align: "center" });
    } else if (emp.rank === 3) {
      doc.setFillColor(254, 215, 170); // Orange 200 (Bronce)
      doc.roundedRect(x + 2, yPos + 1.2, 10, 5, 1, 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setTextColor(154, 52, 18);
      doc.text("#3", x + 7, yPos + 4.8, { align: "center" });
    } else {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`#${emp.rank}`, x + 7, yPos + 5, { align: "center" });
    }
    x += columns[0].width;

    // 2. Colaborador
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(emp.name.slice(0, 28), x + 2, yPos + 4.8);
    x += columns[1].width;

    // 3. Rol
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(emp.roleName.slice(0, 18), x + 2, yPos + 4.8);
    x += columns[2].width;

    // 4. Ventas
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(String(emp.salesCount), x + columns[3].width - 2, yPos + 4.8, { align: "right" });
    x += columns[3].width;

    // 5. Total Vendido
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(formatCOP(emp.totalSalesAmount), x + columns[4].width - 2, yPos + 4.8, { align: "right" });
    x += columns[4].width;

    // 6. % Venta
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`${emp.salesPercentage}%`, x + columns[5].width - 2, yPos + 4.8, { align: "right" });
    x += columns[5].width;

    // 7. Ticket Promedio
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.text(formatCOP(emp.averageTicketAmount), x + columns[6].width - 2, yPos + 4.8, { align: "right" });
    x += columns[6].width;

    // 8. Turnos
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.text(String(emp.shiftsCount), x + columns[7].width / 2, yPos + 4.8, { align: "center" });
    x += columns[7].width;

    // 9. Horas
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.text(`${emp.totalHoursWorked} h`, x + columns[8].width - 2, yPos + 4.8, { align: "right" });
    x += columns[8].width;

    // 10. Propinas
    doc.setFont("helvetica", emp.totalTipsAmount > 0 ? "bold" : "normal");
    doc.setTextColor(emp.totalTipsAmount > 0 ? 16 : 100, emp.totalTipsAmount > 0 ? 185 : 116, emp.totalTipsAmount > 0 ? 129 : 139);
    doc.text(formatCOP(emp.totalTipsAmount), x + columns[9].width - 2, yPos + 4.8, { align: "right" });

    yPos += rowHeight;
  });

  // Fila de Totales al final de la tabla
  if (yPos + 8.5 > bottomLimit) {
    doc.addPage();
    renderHeader(false);
    yPos = 22;
  }

  doc.setFillColor(241, 245, 249); // Slate 100
  doc.rect(margin, yPos, contentWidth, 8.5, "F");
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, yPos, margin + contentWidth, yPos);
  doc.line(margin, yPos + 8.5, margin + contentWidth, yPos + 8.5);

  let tx = margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);

  // Label Totales
  doc.text("TOTALES DEL EQUIPO", tx + 16, yPos + 5.5);
  tx += columns[0].width + columns[1].width + columns[2].width;

  // Total Ventas
  doc.text(String(reportData.summary.totalTeamSalesCount), tx + columns[3].width - 2, yPos + 5.5, { align: "right" });
  tx += columns[3].width;

  // Monto Total Vendido
  doc.text(formatCOP(reportData.summary.totalTeamSalesAmount), tx + columns[4].width - 2, yPos + 5.5, { align: "right" });
  tx += columns[4].width;

  // % 100%
  doc.text("100%", tx + columns[5].width - 2, yPos + 5.5, { align: "right" });
  tx += columns[5].width;

  // Ticket Promedio
  doc.text(formatCOP(reportData.summary.averageTeamTicketAmount), tx + columns[6].width - 2, yPos + 5.5, { align: "right" });
  tx += columns[6].width;

  // Turnos Totales
  doc.text(String(reportData.summary.totalShiftsWorked), tx + columns[7].width / 2, yPos + 5.5, { align: "center" });
  tx += columns[7].width;

  // Horas Totales
  doc.text(`${reportData.summary.totalHoursWorked} h`, tx + columns[8].width - 2, yPos + 5.5, { align: "right" });
  tx += columns[8].width;

  // Propinas Totales
  doc.setTextColor(16, 185, 129);
  doc.text(formatCOP(reportData.summary.totalTipsAmount), tx + columns[9].width - 2, yPos + 5.5, { align: "right" });

  // Numeración de páginas
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    renderFooter(i, totalPages);
  }

  const safeBizName = sanitizeFilename(businessName || "comercio");
  const filename = `reporte_empleados_${safeBizName}_${Date.now()}.pdf`;

  const pdfOutput = doc.output("arraybuffer");
  const buffer = Buffer.from(pdfOutput);

  return {
    buffer,
    base64: buffer.toString("base64"),
    filename,
    contentType: "application/pdf",
    sizeBytes: buffer.byteLength,
  };
}

