import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

// Mock de Supabase Client (admin y server)
const mockFrom = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/workspace/11111111-1111-4111-8111-111111111111/reportes/horas-pico"),
}));

// Mock de auth & verifyWorkspaceAction
const mockVerifyWorkspaceAction = vi.fn();
vi.mock("@/lib/auth/workspace-context", () => ({
  verifyWorkspaceAction: (...args: any[]) => mockVerifyWorkspaceAction(...args),
  requireWorkspaceSession: vi.fn(async () => ({
    user: { id: "user-123" },
    business: { id: "11111111-1111-4111-8111-111111111111" },
    businessTimezone: "America/Bogota",
  })),
}));

import { getPeakHoursReportData } from "@/lib/reports/reports-service";
import { getPeakHoursReportAction } from "@/app/workspace/[businessId]/reportes/horas-pico/actions";

describe("[REP-006] Análisis de Horas Pico y Mapa de Calor (Heatmap)", () => {
  const businessId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyWorkspaceAction.mockResolvedValue({
      success: true,
      context: { businessId, businessType: "America/Bogota" },
    });
  });

  it("1. Genera una matriz exacta de 7 días x 18 horas (126 celdas) con datos reales", async () => {
    // 2026-11-06 es Viernes (UTC-5)
    // 2026-11-07 es Sábado (UTC-5)
    mockFrom.mockImplementation((table: string) => {
      if (table === "business_sale_documents") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              neq: vi.fn().mockReturnValue({
                neq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [
                      // Viernes a las 20:15 (8:15 PM) -> 50.000 COP
                      {
                        id: "doc-1",
                        restaurant_order_id: "ord-1",
                        total: 50000,
                        issued_at: "2026-11-06T20:15:00-05:00",
                        status: "completed",
                      },
                      // Viernes a las 20:45 (8:45 PM) -> 70.000 COP
                      {
                        id: "doc-2",
                        restaurant_order_id: "ord-2",
                        total: 70000,
                        issued_at: "2026-11-06T20:45:00-05:00",
                        status: "completed",
                      },
                      // Sábado a las 13:30 (1:30 PM) -> 40.000 COP
                      {
                        id: "doc-3",
                        restaurant_order_id: "ord-3",
                        total: 40000,
                        issued_at: "2026-11-07T13:30:00-05:00",
                        status: "completed",
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "restaurant_orders") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: "ord-1", order_type: "dine_in", channel_origin: "pos" },
                { id: "ord-2", order_type: "dine_in", channel_origin: "pos" },
                { id: "ord-3", order_type: "takeout", channel_origin: "pos" },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === "businesses") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { name: "Restaurante Gourmet" },
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error(`Tabla no mockeada: ${table}`);
    });

    const report = await getPeakHoursReportData(businessId, {
      preset: "custom",
      startDate: "2026-11-01",
      endDate: "2026-11-10",
    });

    // 7 días (filas) x 18 horas (columnas) = 126 celdas
    expect(report.heatmapMatrix.length).toBe(7);
    report.heatmapMatrix.forEach((dayRow) => {
      expect(dayRow.length).toBe(18);
    });
    expect(report.cellsFlat.length).toBe(126);

    // Viernes (índice 4): a las 20:00 (hora 20 -> índice 20 - 6 = 14) debe tener 2 ventas y 120.000 COP
    const fridayRow = report.heatmapMatrix[4];
    expect(fridayRow[0].dayName).toBe("Viernes");
    const cellViernes20 = fridayRow.find((c) => c.hour === 20);
    expect(cellViernes20).toBeDefined();
    expect(cellViernes20?.salesCount).toBe(2);
    expect(cellViernes20?.totalAmount).toBe(120000);
    expect(cellViernes20?.averageTicket).toBe(60000);

    // Sábado (índice 5): a las 13:00 (1 PM) debe tener 1 venta y 40.000 COP
    const saturdayRow = report.heatmapMatrix[5];
    expect(saturdayRow[0].dayName).toBe("Sábado");
    const cellSabado13 = saturdayRow.find((c) => c.hour === 13);
    expect(cellSabado13).toBeDefined();
    expect(cellSabado13?.salesCount).toBe(1);
    expect(cellSabado13?.totalAmount).toBe(40000);
  });

  it("2. La celda con mayor intensidad corresponde a la hora/día con más ventas (Pico Global)", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "business_sale_documents") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              neq: vi.fn().mockReturnValue({
                neq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [
                      // 3 ventas el Viernes a las 20:00
                      { id: "1", total: 30000, issued_at: "2026-11-06T20:00:00-05:00" },
                      { id: "2", total: 40000, issued_at: "2026-11-06T20:20:00-05:00" },
                      { id: "3", total: 50000, issued_at: "2026-11-06T20:40:00-05:00" },
                      // 1 venta el Miércoles a las 12:00
                      { id: "4", total: 25000, issued_at: "2026-11-04T12:00:00-05:00" },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "restaurant_orders") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      if (table === "businesses") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { name: "Test" }, error: null }),
            }),
          }),
        };
      }
      throw new Error(`Tabla no mockeada: ${table}`);
    });

    const report = await getPeakHoursReportData(businessId, {
      preset: "custom",
      startDate: "2026-11-01",
      endDate: "2026-11-10",
    });

    const fridayRow = report.heatmapMatrix[4];
    const peakCell = fridayRow.find((c) => c.hour === 20);

    // Celda máxima debe tener intensidad 1.0 (100%)
    expect(peakCell?.salesCount).toBe(3);
    expect(peakCell?.countIntensity).toBe(1.0);
    expect(peakCell?.amountIntensity).toBe(1.0);

    // Resumen Global
    expect(report.globalSummary.globalPeakHour).toBe(20);
    expect(report.globalSummary.globalPeakHourLabel).toBe("8 PM");
    expect(report.globalSummary.globalPeakDayName).toBe("Viernes");
    expect(report.globalSummary.globalPeakSalesCount).toBe(3);
    expect(report.globalSummary.busiestDayOfWeek).toBe("Viernes");
    expect(report.globalSummary.hasData).toBe(true);
  });

  it("3. Sin datos para un período: retorna matriz vacía y hasData=false", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "business_sale_documents") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              neq: vi.fn().mockReturnValue({
                neq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "restaurant_orders") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      if (table === "businesses") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { name: "Test" }, error: null }),
            }),
          }),
        };
      }
      throw new Error(`Tabla no mockeada: ${table}`);
    });

    const report = await getPeakHoursReportData(businessId, {
      preset: "custom",
      startDate: "2026-11-01",
      endDate: "2026-11-10",
    });

    expect(report.globalSummary.hasData).toBe(false);
    expect(report.globalSummary.totalPeriodSalesCount).toBe(0);
    expect(report.globalSummary.totalPeriodAmount).toBe(0);

    // La matriz sigue conteniendo exactamente 126 celdas disponibles para renderizar sin romperse
    expect(report.cellsFlat.length).toBe(126);
    expect(report.cellsFlat.every((c) => c.salesCount === 0)).toBe(true);
  });

  it("4. Filtra ventas por canal de origen correctamente", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "business_sale_documents") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              neq: vi.fn().mockReturnValue({
                neq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [
                      // Venta de salón / mesa
                      {
                        id: "d1",
                        restaurant_order_id: "o1",
                        total: 30000,
                        issued_at: "2026-11-06T14:00:00-05:00",
                      },
                      // Venta de domicilio
                      {
                        id: "d2",
                        restaurant_order_id: "o2",
                        total: 45000,
                        issued_at: "2026-11-06T14:00:00-05:00",
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "restaurant_orders") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: "o1", order_type: "dine_in", channel_origin: "pos" },
                { id: "o2", order_type: "delivery", channel_origin: "whatsapp" },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === "businesses") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { name: "Test" }, error: null }),
            }),
          }),
        };
      }
      throw new Error(`Tabla no mockeada: ${table}`);
    });

    // Filtro únicamente domicilios
    const reportDelivery = await getPeakHoursReportData(businessId, {
      preset: "custom",
      startDate: "2026-11-01",
      endDate: "2026-11-10",
      channel: "domicilio",
    });

    expect(reportDelivery.globalSummary.totalPeriodSalesCount).toBe(1);
    expect(reportDelivery.globalSummary.totalPeriodAmount).toBe(45000);

    // Filtro únicamente mesas
    const reportMesa = await getPeakHoursReportData(businessId, {
      preset: "custom",
      startDate: "2026-11-01",
      endDate: "2026-11-10",
      channel: "mesa",
    });

    expect(reportMesa.globalSummary.totalPeriodSalesCount).toBe(1);
    expect(reportMesa.globalSummary.totalPeriodAmount).toBe(30000);
  });

  it("5. Server Action verifica permisos de acceso multi-tenant", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "business_sale_documents") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              neq: vi.fn().mockReturnValue({
                neq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "restaurant_orders") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      if (table === "businesses") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { name: "Test" }, error: null }),
            }),
          }),
        };
      }
      throw new Error(`Tabla no mockeada: ${table}`);
    });

    const resSuccess = await getPeakHoursReportAction(businessId);
    expect(resSuccess.success).toBe(true);
    expect(resSuccess.data?.heatmapMatrix.length).toBe(7);

    // Denegado
    mockVerifyWorkspaceAction.mockResolvedValueOnce({
      success: false,
      error: "Acceso no autorizado a reportes",
    });
    mockVerifyWorkspaceAction.mockResolvedValueOnce({
      success: false,
      error: "Acceso no autorizado a reportes",
    });

    const resDenied = await getPeakHoursReportAction(businessId);
    expect(resDenied.success).toBe(false);
    expect(resDenied.error?.toLowerCase()).toContain("no autorizado");
  });

  it("6. Renderiza estáticamente la interfaz de usuario de Horas Pico (Heatmap y Tabla)", async () => {
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { PeakHoursClient } = await import(
      "@/app/workspace/[businessId]/reportes/horas-pico/peak-hours-client"
    );

    // Mock initial data
    const mockHeatmapMatrix = Array.from({ length: 7 }, (_, dayIdx) =>
      Array.from({ length: 18 }, (_, hIdx) => {
        const hour = hIdx + 6;
        const dayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
        const dayShorts = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
        return {
          dayIndex: dayIdx,
          dayName: dayNames[dayIdx],
          dayShort: dayShorts[dayIdx],
          hour,
          hourLabel: `${hour}:00`,
          salesCount: dayIdx === 4 && hour === 20 ? 8 : 1,
          totalAmount: dayIdx === 4 && hour === 20 ? 240000 : 30000,
          averageTicket: 30000,
          countIntensity: dayIdx === 4 && hour === 20 ? 1.0 : 0.125,
          amountIntensity: dayIdx === 4 && hour === 20 ? 1.0 : 0.125,
        };
      })
    );

    const mockReportData = {
      heatmapMatrix: mockHeatmapMatrix,
      cellsFlat: mockHeatmapMatrix.flat(),
      daySummaries: mockHeatmapMatrix.map((row) => ({
        dayIndex: row[0].dayIndex,
        dayName: row[0].dayName,
        dayShort: row[0].dayShort,
        peakHour: 20,
        peakHourLabel: "8 PM",
        peakSalesCount: 8,
        peakTotalAmount: 240000,
        totalDaySalesCount: 25,
        totalDayAmount: 750000,
      })),
      globalSummary: {
        globalPeakHour: 20,
        globalPeakHourLabel: "8 PM",
        globalPeakDayIndex: 4,
        globalPeakDayName: "Viernes",
        globalPeakSalesCount: 8,
        globalPeakAmount: 240000,
        busiestDayOfWeek: "Viernes",
        busiestDayIndex: 4,
        busiestDaySalesCount: 25,
        busiestDayAmount: 750000,
        totalPeriodSalesCount: 150,
        totalPeriodAmount: 4500000,
        averageHourlySalesCount: 1.2,
        averageHourlyAmount: 35700,
        hasData: true,
      },
      filterParams: { preset: "last_30_days" as const },
      businessName: "Restaurante Gourmet",
    };

    const html = renderToStaticMarkup(
      React.createElement(PeakHoursClient, {
        businessId,
        initialData: mockReportData,
      })
    );

    // Verifica elementos clave del heatmap
    expect(html).toContain("Mapa de Calor de Concurrencia (7 × 18)");
    expect(html).toContain("Hora Pico Global");
    expect(html).toContain("Día Más Frecuentado");
    expect(html).toContain("Volumen del Período");
    expect(html).toContain("Resumen de Horas Pico por Día de la Semana");
    expect(html).toContain("Viernes");
    expect(html).toContain("Sábado");
    expect(html).toContain("Lun");
  });

  it("7. Regla de Oro: Prohibido uso de alertas nativas en módulo de horas pico", () => {
    const horasPicoDir = path.resolve(
      process.cwd(),
      "src/app/workspace/[businessId]/reportes/horas-pico"
    );

    const scanFiles = (dir: string): string[] => {
      const results: string[] = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const full = path.join(dir, file);
        const stat = fs.statSync(full);
        if (stat && stat.isDirectory()) {
          results.push(...scanFiles(full));
        } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
          results.push(full);
        }
      });
      return results;
    };

    const allFiles = scanFiles(horasPicoDir);
    expect(allFiles.length).toBeGreaterThan(0);

    const alertRegex = /\b(window\.)?alert\(|\b(window\.)?confirm\(|\b(window\.)?prompt\(/;

    for (const filePath of allFiles) {
      const content = fs.readFileSync(filePath, "utf-8");
      const hasNativeAlert = alertRegex.test(content);
      if (hasNativeAlert) {
        throw new Error(`Alerta nativa encontrada en: ${filePath}`);
      }
      expect(hasNativeAlert).toBe(false);
    }
  });
});
