import { jsPDF } from "jspdf";
import { DailyCashClosure, DateRangeClosureResult } from "./types";
import { PdfGenerationResult } from "../pdf/types";

interface DailyClosurePdfParams {
  businessName: string;
  businessNit?: string | null;
  businessAddress?: string | null;
  businessPhone?: string | null;
  closure: DailyCashClosure;
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function generateDailyClosurePdf(params: DailyClosurePdfParams): PdfGenerationResult {
  const { businessName, businessNit, businessAddress, businessPhone, closure } = params;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  // 1. BANNER SUPERIOR DE MARCA
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 36, "F");

  // Barra de acento naranja NEGOVA
  doc.setFillColor(237, 80, 10); // #ED500A
  doc.rect(0, 34, pageWidth, 2, "F");

  // Título e Identificación
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("INFORME DE CIERRE DEL DÍA (Z)", margin, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225); // Slate 300
  doc.text("RECONCILIACIÓN FISCAL Y CUADRE OPERATIVO DE CAJA", margin, 21);

  // Fecha del informe y folio a la derecha
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(`FECHA: ${closure.closureDate}`, pageWidth - margin, 15, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Folio ID: ${closure.id.slice(0, 8).toUpperCase()}`, pageWidth - margin, 21, { align: "right" });
  doc.text(
    closure.isLocked ? "REGISTRO INMUTABLE Y CONCILIADO" : "BORRADOR PREVIO",
    pageWidth - margin,
    27,
    { align: "right" }
  );

  // 2. DATOS DEL COMERCIO Y OPERADOR
  let currentY = 46;

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(businessName.toUpperCase(), margin, currentY);

  currentY += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  const infoLines: string[] = [];
  if (businessNit) infoLines.push(`NIT/RUT: ${businessNit}`);
  if (businessAddress) infoLines.push(`Dirección: ${businessAddress}`);
  if (businessPhone) infoLines.push(`Tel: ${businessPhone}`);
  if (infoLines.length > 0) {
    doc.text(infoLines.join(" | "), margin, currentY);
    currentY += 5;
  }

  doc.text(
    `Responsable de Cierre: ${closure.closedByName || "Supervisor Autorizado"} | Emisión: ${new Date(
      closure.createdAt
    ).toLocaleString("es-CO")}`,
    margin,
    currentY
  );

  // Línea divisoria
  currentY += 6;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  // 3. MÉTRICAS DE VENTAS POR CANAL
  currentY += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text("1. DESGLOSE DE VENTAS POR CANAL / ORIGEN", margin, currentY);

  currentY += 5;
  const colW = contentWidth / 5;

  const channels = [
    { label: "TOTAL VENTAS", amount: closure.totalSales, isHighlight: true },
    { label: "MOSTRADOR (POS)", amount: closure.counterSales, isHighlight: false },
    { label: "MESAS (SALÓN)", amount: closure.tablesSales, isHighlight: false },
    { label: "DOMICILIOS", amount: closure.deliverySales, isHighlight: false },
    { label: "ONLINE / QR", amount: closure.onlineSales, isHighlight: false },
  ];

  channels.forEach((ch, idx) => {
    const boxX = margin + idx * colW;
    const boxY = currentY;
    const boxHeight = 16;

    if (ch.isHighlight) {
      doc.setFillColor(254, 242, 242); // Warm orange tint
      doc.setDrawColor(251, 146, 60);
    } else {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
    }

    doc.roundedRect(boxX, boxY, colW - 2, boxHeight, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(ch.label, boxX + 3, boxY + 5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(ch.isHighlight ? 194 : 15, ch.isHighlight ? 65 : 23, ch.isHighlight ? 12 : 42);
    doc.text(formatCOP(ch.amount), boxX + 3, boxY + 12);
  });

  currentY += 24;

  // 4. TABLA DE RECONCILIACIÓN POR MÉTODO DE PAGO
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text("2. CUADRE Y CONCILIACIÓN POR MÉTODO DE PAGO", margin, currentY);

  currentY += 5;

  // Header de la tabla
  const tableHeaders = [
    { name: "MÉTODO DE PAGO", width: 60, align: "left" },
    { name: "TOTAL SISTEMA", width: 40, align: "right" },
    { name: "TOTAL CONTADO", width: 40, align: "right" },
    { name: "DIFERENCIA", width: 38, align: "right" },
  ];

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, currentY, contentWidth, 7, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  let headerX = margin;
  tableHeaders.forEach((th) => {
    const textX = th.align === "right" ? headerX + th.width - 2 : headerX + 2;
    doc.text(th.name, textX, currentY + 4.8, { align: th.align as any });
    headerX += th.width;
  });

  currentY += 7;

  // Filas de métodos de pago
  const methods = closure.paymentMethodsSummary || [];

  methods.forEach((m, idx) => {
    const rowY = currentY;
    const rowH = 7.5;

    // Fondo alternado
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, rowY, contentWidth, rowH, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);

    let rowX = margin;

    // Nombre método
    doc.text(m.label, rowX + 2, rowY + 5.2);
    rowX += tableHeaders[0].width;

    // Sistema
    doc.text(formatCOP(m.systemTotal), rowX + tableHeaders[1].width - 2, rowY + 5.2, {
      align: "right",
    });
    rowX += tableHeaders[1].width;

    // Contado
    doc.text(formatCOP(m.countedTotal), rowX + tableHeaders[2].width - 2, rowY + 5.2, {
      align: "right",
    });
    rowX += tableHeaders[2].width;

    // Diferencia
    const diff = m.difference;
    if (diff === 0) {
      doc.setTextColor(16, 185, 129); // Verde
      doc.text("$ 0 (Cuadrado)", rowX + tableHeaders[3].width - 2, rowY + 5.2, {
        align: "right",
      });
    } else if (diff > 0) {
      doc.setTextColor(37, 99, 235); // Azul sobrante
      doc.text(`+${formatCOP(diff)}`, rowX + tableHeaders[3].width - 2, rowY + 5.2, {
        align: "right",
      });
    } else {
      doc.setTextColor(220, 38, 38); // Rojo faltante
      doc.text(`${formatCOP(diff)}`, rowX + tableHeaders[3].width - 2, rowY + 5.2, {
        align: "right",
      });
    }

    currentY += rowH;
  });

  // Fila Totalizadora
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, currentY, contentWidth, 8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);

  let totX = margin;
  doc.text("TOTAL GENERAL DE CONCILIACIÓN", totX + 2, currentY + 5.5);
  totX += tableHeaders[0].width;

  doc.text(formatCOP(closure.totalSystem), totX + tableHeaders[1].width - 2, currentY + 5.5, {
    align: "right",
  });
  totX += tableHeaders[1].width;

  doc.text(formatCOP(closure.totalCounted), totX + tableHeaders[2].width - 2, currentY + 5.5, {
    align: "right",
  });
  totX += tableHeaders[2].width;

  const totalDiff = closure.totalDifference;
  if (totalDiff === 0) {
    doc.setTextColor(16, 185, 129);
    doc.text("$ 0", totX + tableHeaders[3].width - 2, currentY + 5.5, { align: "right" });
  } else if (totalDiff > 0) {
    doc.setTextColor(37, 99, 235);
    doc.text(`+${formatCOP(totalDiff)}`, totX + tableHeaders[3].width - 2, currentY + 5.5, {
      align: "right",
    });
  } else {
    doc.setTextColor(220, 38, 38);
    doc.text(`${formatCOP(totalDiff)}`, totX + tableHeaders[3].width - 2, currentY + 5.5, {
      align: "right",
    });
  }

  currentY += 15;

  // 5. OBSERVACIONES Y NOTAS
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text("3. OBSERVACIONES Y NOVEDADES REGISTRADAS", margin, currentY);

  currentY += 4;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, contentWidth, 20, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  const obsText = closure.observations?.trim() || "Sin observaciones ni incidencias reportadas en este cierre.";
  const splitObs = doc.splitTextToSize(obsText, contentWidth - 6);
  doc.text(splitObs, margin + 3, currentY + 5.5);

  currentY += 28;

  // 6. FIRMAS DE RESPONSABILIDAD
  const sigBoxW = (contentWidth - 10) / 2;

  // Firma 1: Cajero
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  doc.line(margin + 5, currentY + 12, margin + sigBoxW - 5, currentY + 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(closure.closedByName || "FIRMA DEL RESPONSABLE / CAJERO", margin + sigBoxW / 2, currentY + 16, {
    align: "center",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Arqueo y Entrega de Turno", margin + sigBoxW / 2, currentY + 20, { align: "center" });

  // Firma 2: Supervisor / Admin
  const sig2X = margin + sigBoxW + 10;
  doc.line(sig2X + 5, currentY + 12, sig2X + sigBoxW - 5, currentY + 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("SUPERVISIÓN Y CONTROL FINANCIERO", sig2X + sigBoxW / 2, currentY + 16, {
    align: "center",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Aprobación y Verificación de Cierre", sig2X + sigBoxW / 2, currentY + 20, {
    align: "center",
  });

  // 7. FOOTER INSTITUCIONAL
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Documento generado electrónicamente por NEGOVA SaaS — Constancia oficial de auditoría e inmutabilidad contable.",
    pageWidth / 2,
    pageHeight - 8,
    { align: "center" }
  );

  const arrayBuffer = doc.output("arraybuffer");
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");
  const filename = `Cierre_Z_${closure.closureDate}_${closure.id.slice(0, 6)}.pdf`;

  return {
    buffer,
    base64,
    filename,
    sizeBytes: buffer.length,
  };
}

export interface DateRangeClosurePdfParams {
  businessName: string;
  businessNit?: string | null;
  businessAddress?: string | null;
  businessPhone?: string | null;
  rangeClosure: DateRangeClosureResult;
}

/**
 * Genera el documento PDF oficial consolidado para un rango de fechas [CAJ-005].
 * Incluye: Resumen general, métricas por canal, cuadre por método de pago y desglose día por día.
 */
export function generateDateRangeClosurePdf(params: DateRangeClosurePdfParams): PdfGenerationResult {
  const { businessName, businessNit, businessAddress, businessPhone, rangeClosure } = params;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  // 1. BANNER SUPERIOR DE MARCA
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 36, "F");

  // Barra de acento naranja NEGOVA
  doc.setFillColor(237, 80, 10); // #ED500A
  doc.rect(0, 34, pageWidth, 2, "F");

  // Título e Identificación
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("INFORME DE CIERRE CONSOLIDADO", margin, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Rango: ${rangeClosure.startDate} al ${rangeClosure.endDate} (${rangeClosure.daysCount} días)`,
    margin,
    22
  );
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Generado el: ${new Date().toLocaleString("es-CO")}`,
    margin,
    29
  );

  // Datos del Negocio (Alineados a la derecha)
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(businessName.toUpperCase(), pageWidth - margin, 14, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  if (businessNit) {
    doc.text(`NIT: ${businessNit}`, pageWidth - margin, 20, { align: "right" });
  }
  if (businessAddress || businessPhone) {
    doc.text(
      `${businessAddress || ""}${businessAddress && businessPhone ? " · " : ""}${businessPhone || ""}`,
      pageWidth - margin,
      26,
      { align: "right" }
    );
  }

  let currentY = 44;

  // 2. RESUMEN EJECUTIVO (KPIs principales en tarjeta)
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, currentY, contentWidth, 22, 3, 3, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, contentWidth, 22, 3, 3, "S");

  const colWidth = contentWidth / 4;

  // Total Facturado
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("TOTAL FACTURADO", margin + 6, currentY + 7);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(formatCOP(rangeClosure.metrics.totalSales), margin + 6, currentY + 16);

  // Total Sistema
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7.5);
  doc.text("TOTAL SISTEMA", margin + colWidth + 6, currentY + 7);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(formatCOP(rangeClosure.totalSystem), margin + colWidth + 6, currentY + 16);

  // Total Contado
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7.5);
  doc.text("TOTAL CONTADO", margin + colWidth * 2 + 6, currentY + 7);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(formatCOP(rangeClosure.totalCounted), margin + colWidth * 2 + 6, currentY + 16);

  // Diferencia Neta
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7.5);
  doc.text("DIFERENCIA NETA", margin + colWidth * 3 + 6, currentY + 7);
  if (rangeClosure.totalDifference === 0) {
    doc.setTextColor(16, 185, 129); // Verde
  } else if (rangeClosure.totalDifference > 0) {
    doc.setTextColor(37, 99, 235); // Azul
  } else {
    doc.setTextColor(225, 29, 72); // Rojo
  }
  doc.setFontSize(11);
  const diffSign = rangeClosure.totalDifference > 0 ? "+" : "";
  doc.text(`${diffSign}${formatCOP(rangeClosure.totalDifference)}`, margin + colWidth * 3 + 6, currentY + 16);

  currentY += 28;

  // 3. DESGLOSE DE VENTAS POR CANAL COMERCIAL
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("1. DESGLOSE CONSOLIDADO POR CANAL DE VENTA", margin, currentY);

  currentY += 5;

  const channelTableW = contentWidth;
  const channelItemW = channelTableW / 4;

  const channels = [
    { label: "Mostrador / POS", amt: rangeClosure.metrics.counterSales },
    { label: "Consumo en Mesas", amt: rangeClosure.metrics.tablesSales },
    { label: "Domicilios / Despacho", amt: rangeClosure.metrics.deliverySales },
    { label: "Canal Digital / QR", amt: rangeClosure.metrics.onlineSales },
  ];

  channels.forEach((ch, idx) => {
    const x = margin + idx * channelItemW;
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(x + 1, currentY, channelItemW - 2, 14, 2, 2, "F");
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(ch.label.toUpperCase(), x + 4, currentY + 5);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.text(formatCOP(ch.amt), x + 4, currentY + 11);
  });

  currentY += 20;

  // 4. RECONCILIACIÓN POR MÉTODO DE PAGO
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("2. CUADRE Y CONCILIACIÓN POR MÉTODO DE PAGO", margin, currentY);

  currentY += 5;

  // Cabecera tabla de métodos
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, currentY, contentWidth, 7, "F");
  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("MÉTODO DE PAGO", margin + 4, currentY + 5);
  doc.text("TOTAL SISTEMA", margin + 65, currentY + 5, { align: "right" });
  doc.text("TOTAL CONTADO", margin + 115, currentY + 5, { align: "right" });
  doc.text("DIFERENCIA", margin + contentWidth - 4, currentY + 5, { align: "right" });

  currentY += 7;

  for (const recon of rangeClosure.reconciliation) {
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, currentY + 6, margin + contentWidth, currentY + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(recon.label, margin + 4, currentY + 4.5);

    doc.setFont("helvetica", "bold");
    doc.text(formatCOP(recon.systemTotal), margin + 65, currentY + 4.5, { align: "right" });
    doc.text(formatCOP(recon.countedTotal), margin + 115, currentY + 4.5, { align: "right" });

    if (recon.difference === 0) {
      doc.setTextColor(16, 185, 129);
      doc.text("Exacto ($0)", margin + contentWidth - 4, currentY + 4.5, { align: "right" });
    } else if (recon.difference > 0) {
      doc.setTextColor(37, 99, 235);
      doc.text(`+${formatCOP(recon.difference)}`, margin + contentWidth - 4, currentY + 4.5, { align: "right" });
    } else {
      doc.setTextColor(225, 29, 72);
      doc.text(formatCOP(recon.difference), margin + contentWidth - 4, currentY + 4.5, { align: "right" });
    }

    currentY += 6.5;
  }

  currentY += 8;

  // 5. DESGLOSE DÍA POR DÍA DENTRO DEL RANGO
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("3. DESGLOSE CRONOLÓGICO DÍA POR DÍA", margin, currentY);

  currentY += 5;

  // Cabecera tabla de días
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, currentY, contentWidth, 7, "F");
  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("FECHA / DÍA", margin + 4, currentY + 5);
  doc.text("TOTAL VENTAS", margin + 55, currentY + 5, { align: "right" });
  doc.text("MOSTRADOR", margin + 85, currentY + 5, { align: "right" });
  doc.text("MESAS", margin + 115, currentY + 5, { align: "right" });
  doc.text("DOMICILIOS", margin + 145, currentY + 5, { align: "right" });
  doc.text("ESTADO", margin + contentWidth - 4, currentY + 5, { align: "right" });

  currentY += 7;

  for (const day of rangeClosure.daysBreakdown) {
    if (currentY > pageHeight - 25) {
      doc.addPage();
      currentY = 20;
    }

    doc.setDrawColor(241, 245, 249);
    doc.line(margin, currentY + 6, margin + contentWidth, currentY + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`${day.date} (${day.dayLabel})`, margin + 4, currentY + 4.5);

    doc.setFont("helvetica", "bold");
    doc.text(formatCOP(day.totalSales), margin + 55, currentY + 4.5, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(formatCOP(day.counterSales), margin + 85, currentY + 4.5, { align: "right" });
    doc.text(formatCOP(day.tablesSales), margin + 115, currentY + 4.5, { align: "right" });
    doc.text(formatCOP(day.deliverySales), margin + 145, currentY + 4.5, { align: "right" });

    if (day.isSaved) {
      doc.setTextColor(16, 185, 129);
      doc.text("Cerrado Z", margin + contentWidth - 4, currentY + 4.5, { align: "right" });
    } else {
      doc.setTextColor(100, 116, 139);
      doc.text("Abierto/Estimado", margin + contentWidth - 4, currentY + 4.5, { align: "right" });
    }

    currentY += 6.5;
  }

  // FOOTER INSTITUCIONAL
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Documento consolidado generado electrónicamente por NEGOVA SaaS — Válido para auditoría y control de gestión.",
    pageWidth / 2,
    pageHeight - 8,
    { align: "center" }
  );

  const arrayBuffer = doc.output("arraybuffer");
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");
  const filename = `Cierre_Rango_${rangeClosure.startDate}_al_${rangeClosure.endDate}.pdf`;

  return {
    buffer,
    base64,
    filename,
    sizeBytes: buffer.length,
  };
}

