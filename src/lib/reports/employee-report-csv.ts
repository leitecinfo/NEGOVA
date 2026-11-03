import { EmployeeReportData, EmployeeReportMetricItem } from "./types";

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
 * [REP-003] Genera el reporte de empleados y métricas de desempeño en formato CSV compatible con Microsoft Excel.
 * Incluye Byte Order Mark (BOM \uFEFF) para garantizar la correcta codificación UTF-8
 * de caracteres en español (tildes, eñes) y símbolo de moneda.
 */
export function generateEmployeeReportCsv(reportData: EmployeeReportData): CsvGenerationResult {
  const headers = [
    "Puesto Ranking",
    "Colaborador",
    "Correo Electrónico",
    "Rol",
    "Ventas Realizadas (Cant.)",
    "Total Vendido (COP)",
    "% Participación en Ventas",
    "Ticket Promedio (COP)",
    "Turnos de Caja",
    "Horas Totales Laboradas",
    "Propinas Recibidas (COP)",
    "Ubicaciones",
    "Estado",
  ];

  const lines: string[] = [];

  // BOM UTF-8 para apertura directa en Microsoft Excel en español/Windows
  const BOM = "\uFEFF";

  // Fila de encabezados
  lines.push(headers.map(escapeCSVField).join(","));

  // Filas de colaboradores
  for (const emp of reportData.employees) {
    const fields = [
      `#${emp.rank}`,
      emp.name,
      emp.email || "",
      emp.roleName,
      emp.salesCount,
      emp.totalSalesAmount.toFixed(2),
      `${emp.salesPercentage}%`,
      emp.averageTicketAmount.toFixed(2),
      emp.shiftsCount,
      emp.totalHoursWorked.toFixed(1),
      emp.totalTipsAmount.toFixed(2),
      emp.locations.join(" / ") || "General",
      emp.status === "active" ? "Activo" : "Inactivo",
    ];

    lines.push(fields.map(escapeCSVField).join(","));
  }

  // Fila de resumen total al final
  const summaryFields = [
    "TOTALES DEL EQUIPO",
    `${reportData.summary.activeEmployeesCount} activos de ${reportData.summary.totalEmployees}`,
    "",
    "",
    reportData.summary.totalTeamSalesCount,
    reportData.summary.totalTeamSalesAmount.toFixed(2),
    "100%",
    reportData.summary.averageTeamTicketAmount.toFixed(2),
    reportData.summary.totalShiftsWorked,
    reportData.summary.totalHoursWorked.toFixed(1),
    reportData.summary.totalTipsAmount.toFixed(2),
    "",
    "",
  ];

  lines.push(summaryFields.map(escapeCSVField).join(","));

  const safeBizName = sanitizeFilename(reportData.businessName || "comercio");
  const filename = `reporte_empleados_${safeBizName}_${Date.now()}.csv`;

  return {
    content: BOM + lines.join("\r\n"),
    filename,
    contentType: "text/csv; charset=utf-8",
  };
}

