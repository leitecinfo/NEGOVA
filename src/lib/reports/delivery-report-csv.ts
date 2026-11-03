import { DeliveryReportData } from "./types";

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
 * [REP-007] Genera el archivo CSV compatible con Microsoft Excel
 * para el reporte de domicilios, tiempos de entrega, desempeño por repartidor y zonas.
 */
export function generateDeliveryReportCsv(reportData: DeliveryReportData): CsvGenerationResult {
  const BOM = "\uFEFF";
  const lines: string[] = [];

  // Título y Resumen
  lines.push(escapeCSVField(`REPORTE DE DOMICILIOS Y DESPACHOS - ${reportData.businessName}`));
  lines.push(escapeCSVField(`Período: ${reportData.dateRange.startDate || "Inicio"} al ${reportData.dateRange.endDate || "Hoy"}`));
  lines.push("");

  // KPIs
  lines.push("RESUMEN DE ENTREGAS");
  lines.push(
    [
      "Total Entregas",
      "Entregas Exitosas",
      "Entregas Canceladas",
      "Entregas Rechazadas",
      "Tasa de Éxito (%)",
      "Tiempo Promedio (Min)",
      "Total Ventas Domicilios (COP)",
      "Total Tarifas Recaudadas (COP)",
      "Repartidor Líder",
      "Zona con Más Pedidos",
    ].map(escapeCSVField).join(",")
  );
  lines.push(
    [
      reportData.summary.totalDeliveries,
      reportData.summary.successfulDeliveries,
      reportData.summary.cancelledDeliveries,
      reportData.summary.rejectedDeliveries,
      `${reportData.summary.successRate}%`,
      `${reportData.summary.averageDeliveryTimeMinutes} min`,
      reportData.summary.totalRevenue.toFixed(2),
      reportData.summary.totalTariffs.toFixed(2),
      reportData.summary.topDriver ? `${reportData.summary.topDriver.driverName} (${reportData.summary.topDriver.completedCount})` : "N/A",
      reportData.summary.topZone ? `${reportData.summary.topZone.zoneName} (${reportData.summary.topZone.ordersCount})` : "N/A",
    ].map(escapeCSVField).join(",")
  );
  lines.push("");

  // TABLA 1: REPARTIDORES
  lines.push("DESEMPEÑO POR REPARTIDOR (Ordenado por Entregas Completadas)");
  const driverHeaders = [
    "Puesto",
    "Nombre del Repartidor",
    "Teléfono",
    "Entregas Completadas",
    "Total Asignados",
    "Tasa Cumplimiento (%)",
    "Cancelados",
    "Rechazados",
    "Tiempo Promedio (Min)",
    "Calificación Promedio",
    "Total Facturado (COP)",
    "Tarifas Generadas (COP)",
  ];
  lines.push(driverHeaders.map(escapeCSVField).join(","));

  reportData.drivers.forEach((d, idx) => {
    lines.push(
      [
        `#${idx + 1}`,
        d.driverName,
        d.driverPhone || "",
        d.completedDeliveries,
        d.totalAssigned,
        `${d.completionRate}%`,
        d.cancelledDeliveries,
        d.rejectedDeliveries,
        `${d.averageDeliveryTimeMinutes} min`,
        d.averageRating.toFixed(1),
        d.totalAmountCollected.toFixed(2),
        d.totalTariffsCollected.toFixed(2),
      ].map(escapeCSVField).join(",")
    );
  });
  lines.push("");

  // TABLA 2: ZONAS
  lines.push("ANÁLISIS POR ZONA DE ENTREGA");
  const zoneHeaders = [
    "Zona",
    "Tarifa Configurada (COP)",
    "Total Pedidos",
    "Pedidos Entregados",
    "Monto Total (COP)",
    "Tiempo Promedio (Min)",
  ];
  lines.push(zoneHeaders.map(escapeCSVField).join(","));

  reportData.zones.forEach((z) => {
    lines.push(
      [
        z.zoneName,
        z.tariff.toFixed(2),
        z.totalOrders,
        z.completedOrders,
        z.totalAmount.toFixed(2),
        `${z.averageDeliveryTimeMinutes} min`,
      ].map(escapeCSVField).join(",")
    );
  });
  lines.push("");

  // TABLA 3: DETALLE DE PEDIDOS
  lines.push("REGISTRO DETALLADO DE PEDIDOS");
  const orderHeaders = [
    "Pedido #",
    "Fecha y Hora",
    "Cliente",
    "Teléfono",
    "Dirección de Entrega",
    "Zona",
    "Repartidor",
    "Estado",
    "Subtotal (COP)",
    "Tarifa Envío (COP)",
    "Total (COP)",
    "Tiempo Entrega (Min)",
  ];
  lines.push(orderHeaders.map(escapeCSVField).join(","));

  reportData.orders.forEach((o) => {
    lines.push(
      [
        `#${o.orderNumber}`,
        o.formattedCreatedAt,
        o.customerName,
        o.customerPhone || "",
        o.deliveryAddress,
        o.zoneName,
        o.driverName,
        o.statusLabel,
        o.subtotal.toFixed(2),
        o.deliveryFee.toFixed(2),
        o.total.toFixed(2),
        `${o.deliveryDurationMinutes} min`,
      ].map(escapeCSVField).join(",")
    );
  });

  const filename = `reporte_domicilios_${sanitizeFilename(reportData.businessName)}_${reportData.dateRange.startDate || "inicio"}_${reportData.dateRange.endDate || "hoy"}.csv`;

  return {
    content: BOM + lines.join("\r\n"),
    filename,
    contentType: "text/csv; charset=utf-8",
  };
}

