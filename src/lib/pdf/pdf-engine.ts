import { jsPDF } from "jspdf";
import {
  NegovaBillingPdfData,
  BusinessSalePdfData,
  PdfGenerationResult,
} from "./types";

/**
 * Formatea un número a moneda colombiana (COP)
 */
function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Convierte un color hex (#RRGGBB) a [r, g, b]
 */
function hexToRgb(hex: string): [number, number, number] {
  const cleanHex = hex.replace("#", "");
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return [r, g, b];
  }
  return [237, 80, 10]; // Color primario por defecto NEGOVA (#ED500A)
}

/**
 * 1. RENDERIZADOR INSTITUCIONAL: COMPROBANTE DE COBRO NEGOVA (Plataforma)
 */
export function generateNegovaBillingPdf(data: NegovaBillingPdfData): PdfGenerationResult {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;

  // Header Banner / Brand
  doc.setFillColor(11, 14, 20); // #0B0E14
  doc.rect(0, 0, pageWidth, 42, "F");

  if (data.logoBase64) {
    try {
      const imgType = data.logoBase64.includes("png") ? "PNG" : "JPEG";
      // El nuevo logo 1536x1024 tiene proporción 1.5. 36x24 = 1.5 ratio.
      doc.addImage(data.logoBase64, imgType, margin, 9, 36, 24);
    } catch (e) {
      doc.setFillColor(237, 80, 10); // #ED500A
      doc.roundedRect(margin, 12, 36, 12, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("NEGOVA", margin + 7, 20);
    }
  } else {
    // Logo Badge NEGOVA
    doc.setFillColor(237, 80, 10); // #ED500A
    doc.roundedRect(margin, 12, 36, 12, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("NEGOVA", margin + 7, 20);
  }

  // Subtítulo de la Plataforma
  doc.setTextColor(148, 163, 184); // #94A3B8
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("PLATAFORMA DE GESTIÓN SAAS", margin + 42, 17);
  doc.text("Comprobante Interno de Cobro", margin + 42, 22);

  // Número de comprobante a la derecha
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(data.invoiceNumber, pageWidth - margin, 18, { align: "right" });

  // Estado del comprobante
  let statusBg: [number, number, number] = [22, 163, 74]; // green
  let statusText = "PAGADO";
  if (data.status === "pending") {
    statusBg = [237, 80, 10]; // orange (brand color)
    statusText = "PENDIENTE DE PAGO";
  } else if (data.status === "void") {
    statusBg = [100, 116, 139]; // slate
    statusText = "ANULADO";
  } else if (data.status === "failed") {
    statusBg = [220, 38, 38]; // red
    statusText = "FALLIDO";
  }

  doc.setFillColor(statusBg[0], statusBg[1], statusBg[2]);
  doc.roundedRect(pageWidth - margin - 38, 24, 38, 7, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(statusText, pageWidth - margin - 19, 29, { align: "center" });

  let y = 54;

  // Bloque: Datos del Cliente (Negocio) vs Datos de Emisión
  doc.setDrawColor(226, 232, 240); // #E2E8F0
  doc.setFillColor(248, 250, 252); // #F8FAFC
  doc.roundedRect(margin, y, contentWidth, 36, 2, 2, "FD");

  // Columna Izquierda: Cliente
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("CLIENTE / COMERCIO AFILIADO", margin + 6, y + 8);

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(data.businessName, margin + 6, y + 15);

  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  let clientDetails = [];
  if (data.businessNit) clientDetails.push(`NIT: ${data.businessNit}`);
  if (data.businessEmail) clientDetails.push(data.businessEmail);
  if (data.businessCity) clientDetails.push(data.businessCity);
  doc.text(clientDetails.join(" • ") || "Comercio registrado en NEGOVA", margin + 6, y + 21);
  if (data.businessAddress) {
    doc.text(data.businessAddress, margin + 6, y + 27);
  }

  // Columna Derecha: Fechas
  const colRightX = margin + contentWidth - 65;
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("FECHA DE EMISIÓN:", colRightX, y + 8);
  doc.text("VENCIMIENTO:", colRightX, y + 16);
  doc.text("MÉTODO DE PAGO:", colRightX, y + 24);

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "normal");
  doc.text(data.issuedAt ? data.issuedAt.substring(0, 10) : "N/A", pageWidth - margin - 6, y + 8, { align: "right" });
  doc.text(data.dueDate ? data.dueDate.substring(0, 10) : "N/A", pageWidth - margin - 6, y + 16, { align: "right" });
  
  const paymentMethodLabels: Record<string, string> = {
    transfer: "Transferencia / Bancario",
    cash: "Efectivo",
    manual: "Cobro Administrativo",
  };
  doc.text(paymentMethodLabels[data.paymentMethod] || data.paymentMethod, pageWidth - margin - 6, y + 24, { align: "right" });

  y += 44;

  // Tabla de Conceptos / Detalle del Plan
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, y, contentWidth, 8, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("CONCEPTO / SERVICIO CONTRATADO", margin + 5, y + 5.5);
  doc.text("PERÍODO", margin + 95, y + 5.5);
  doc.text("IMPORTE (COP)", pageWidth - margin - 5, y + 5.5, { align: "right" });

  y += 8;

  // Fila del Plan
  doc.setDrawColor(241, 245, 249);
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, y, contentWidth, 18, "F");
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y + 18, margin + contentWidth, y + 18);

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(`Suscripción SaaS: Plan ${data.planName}`, margin + 5, y + 7);

  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Plataforma web de ventas, inventario, caja y gestión", margin + 5, y + 13);

  // Período
  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const intervalLabel = data.billingInterval === "yearly" ? "Anual" : "Mensual";
  doc.text(data.periodText || `${intervalLabel}`, margin + 95, y + 9);

  // Importe
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(formatCOP(data.amount), pageWidth - margin - 5, y + 9, { align: "right" });

  y += 24;

  // Bloque Total
  const totalBoxWidth = 80;
  const totalBoxX = pageWidth - margin - totalBoxWidth;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(totalBoxX, y, totalBoxWidth, 26, 2, 2, "FD");

  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Subtotal:", totalBoxX + 6, y + 8);
  doc.text(formatCOP(data.amount), pageWidth - margin - 6, y + 8, { align: "right" });

  doc.text("Impuestos (IVA 0% Régimen Simple):", totalBoxX + 6, y + 14);
  doc.text("$0 COP", pageWidth - margin - 6, y + 14, { align: "right" });

  doc.setDrawColor(203, 213, 225);
  doc.line(totalBoxX + 6, y + 17, pageWidth - margin - 6, y + 17);

  doc.setTextColor(237, 80, 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL:", totalBoxX + 6, y + 23);
  doc.text(formatCOP(data.amount), pageWidth - margin - 6, y + 23, { align: "right" });

  // Información de pago y notas a la izquierda
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("REFERENCIA Y NOTAS:", margin, y + 8);

  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(
    data.paymentReference
      ? `Referencia: ${data.paymentReference}`
      : "Referencia registrada administrativamente.",
    margin,
    y + 14,
    { maxWidth: totalBoxX - margin - 10 }
  );
  if (data.notes) {
    doc.text(`Observaciones: ${data.notes}`, margin, y + 20, { maxWidth: totalBoxX - margin - 10 });
  }

  // Footer Institucional
  const footerY = 270;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY, margin + contentWidth, footerY);

  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(
    "NEGOVA · Plataforma de Gestión para Pequeños Negocios y Comercios de Barrio",
    pageWidth / 2,
    footerY + 6,
    { align: "center" }
  );
  doc.text(
    "Este documento es un comprobante interno de cobro comercial para control de suscripción. No representa factura electrónica DIAN.",
    pageWidth / 2,
    footerY + 11,
    { align: "center" }
  );

  const arrayBuffer = doc.output("arraybuffer");
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");
  const filename = `comprobante-${data.invoiceNumber}.pdf`;

  return {
    buffer,
    base64,
    filename,
    sizeBytes: buffer.length,
  };
}

/**
 * 2. RENDERIZADOR UNIVERSAL PARA DOCUMENTOS DE NEGOCIOS CLIENTES (Workspace)
 */
export function generateBusinessSalePdf(data: BusinessSalePdfData): PdfGenerationResult {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;

  const brandRgb = hexToRgb(data.primaryColor || "#ED500A");

  // Header del Negocio
  doc.setFillColor(brandRgb[0], brandRgb[1], brandRgb[2]);
  doc.rect(0, 0, pageWidth, 36, "F");

  let textStartX = margin;
  if (data.logoBase64) {
    try {
      const imgType = data.logoBase64.includes("png") ? "PNG" : "JPEG";
      // Añadir el logo en la posición (margin, 8) con un tamaño de 20x20mm (ajustable)
      doc.addImage(data.logoBase64, imgType, margin, 8, 20, 20);
      textStartX = margin + 26; // Desplazar el texto a la derecha del logo
    } catch (e) {
      console.warn("No se pudo renderizar el logo en el PDF", e);
    }
  }

  // Nombre del Negocio
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(data.tradeName.toUpperCase(), textStartX, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const bizDetails = [];
  if (data.legalName && data.legalName !== data.tradeName) bizDetails.push(data.legalName);
  if (data.taxId) bizDetails.push(`NIT: ${data.taxId}`);
  if (data.phone) bizDetails.push(`Tel: ${data.phone}`);
  if (data.whatsapp && data.whatsapp !== data.phone) bizDetails.push(`WhatsApp: ${data.whatsapp}`);
  if (data.email) bizDetails.push(data.email);
  doc.text(bizDetails.join(" • ") || "Documento Comercial", textStartX, 23);
  const locParts = [data.address, data.city, data.department].filter(Boolean);
  const locDetails = locParts.join(", ");
  if (locDetails || data.headerText) {
    const secondLine = [locDetails, data.headerText].filter(Boolean).join(" · ");
    doc.text(secondLine, textStartX, 29);
  }

  // Título y Número del Documento
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(data.documentTitle || "COMPROBANTE DE VENTA", pageWidth - margin, 16, { align: "right" });
  doc.setFontSize(10);
  doc.text(data.documentNumber, pageWidth - margin, 23, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Fecha: ${data.issuedAt.substring(0, 10)}`, pageWidth - margin, 29, { align: "right" });

  let y = 46;

  // Datos del Cliente Receptor
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 22, 2, 2, "FD");

  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("CLIENTE:", margin + 5, y + 6);

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(data.customerName || "Cliente General", margin + 5, y + 12);

  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const custInfo = [];
  if (data.customerId) custInfo.push(`CC/NIT: ${data.customerId}`);
  if (data.customerPhone) custInfo.push(`Tel: ${data.customerPhone}`);
  if (data.customerAddress) custInfo.push(data.customerAddress);
  doc.text(custInfo.join(" • ") || "Venta de mostrador", margin + 5, y + 17);

  y += 28;

  // Cabecera Tabla de Productos / Servicios
  doc.setFillColor(30, 41, 59); // slate-800
  doc.roundedRect(margin, y, contentWidth, 8, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("DESCRIPCIÓN", margin + 5, y + 5.5);
  doc.text("CANT.", margin + 95, y + 5.5);
  doc.text("VR. UNITARIO", margin + 120, y + 5.5);
  doc.text("TOTAL (COP)", pageWidth - margin - 5, y + 5.5, { align: "right" });

  y += 8;

  // Filas de Items
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  data.items.forEach((item, index) => {
    const isEven = index % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(margin, y, contentWidth, 10, "F");
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y + 10, margin + contentWidth, y + 10);

    doc.setTextColor(15, 23, 42);
    doc.text(item.description, margin + 5, y + 6.5);
    doc.text(item.quantity.toString(), margin + 95, y + 6.5);
    doc.text(formatCOP(item.unitPrice), margin + 120, y + 6.5);
    doc.text(formatCOP(item.total), pageWidth - margin - 5, y + 6.5, { align: "right" });

    y += 10;
  });

  y += 6;

  // Cuadro de Totales
  const totalBoxWidth = 80;
  const totalBoxX = pageWidth - margin - totalBoxWidth;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(totalBoxX, y, totalBoxWidth, 24, 2, 2, "FD");

  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Subtotal:", totalBoxX + 5, y + 7);
  doc.text(formatCOP(data.subtotal), pageWidth - margin - 5, y + 7, { align: "right" });

  if (data.discountTotal && data.discountTotal > 0) {
    doc.text("Descuento:", totalBoxX + 5, y + 13);
    doc.text(`-${formatCOP(data.discountTotal)}`, pageWidth - margin - 5, y + 13, { align: "right" });
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(totalBoxX + 5, y + 16, pageWidth - margin - 5, y + 16);

  doc.setTextColor(brandRgb[0], brandRgb[1], brandRgb[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("TOTAL A PAGAR:", totalBoxX + 5, y + 21.5);
  doc.text(formatCOP(data.total), pageWidth - margin - 5, y + 21.5, { align: "right" });

  // Notas / Agradecimiento / Observaciones / Políticas y Términos
  let noteY = y + 7;
  const maxTermsWidth = totalBoxX - margin - 6;

  if (data.thankYouNote) {
    doc.setTextColor(brandRgb[0], brandRgb[1], brandRgb[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(data.thankYouNote, margin, noteY);
    noteY += 4.5;
  }

  const effectiveNotes = data.notes || data.documentObservations;
  if (effectiveNotes) {
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    const splitNotes = doc.splitTextToSize(`Obs: ${effectiveNotes}`, maxTermsWidth);
    doc.text(splitNotes, margin, noteY);
    noteY += Math.min(splitNotes.length * 3.5, 7);
  }

  if (data.returnPolicy) {
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const splitReturn = doc.splitTextToSize(`Cambios y devoluciones: ${data.returnPolicy}`, maxTermsWidth);
    doc.text(splitReturn, margin, noteY);
    noteY += Math.min(splitReturn.length * 3.2, 6.5);
  }

  if (data.warrantyPolicy) {
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const splitWarranty = doc.splitTextToSize(`Garantía: ${data.warrantyPolicy}`, maxTermsWidth);
    doc.text(splitWarranty, margin, noteY);
    noteY += Math.min(splitWarranty.length * 3.2, 6.5);
  }

  if (data.termsAndConditions) {
    doc.setTextColor(148, 163, 184);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const splitTerms = doc.splitTextToSize(`Términos y condiciones: ${data.termsAndConditions}`, maxTermsWidth);
    doc.text(splitTerms, margin, noteY);
  }

  // Footer del Documento Comercial
  const footerY = 270;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY, margin + contentWidth, footerY);

  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(
    data.footerText || "Generado con NEGOVA · Documento comercial de control interno.",
    pageWidth / 2,
    footerY + 6,
    { align: "center" }
  );

  const arrayBuffer = doc.output("arraybuffer");
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");
  const filename = `${data.documentNumber}.pdf`;

  return {
    buffer,
    base64,
    filename,
    sizeBytes: buffer.length,
  };
}
