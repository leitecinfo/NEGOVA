import { describe, it, expect } from "vitest";
import { getWorkspaceDashboardData } from "@/lib/documents/document-service";

describe("Workspace Dashboard Service & Multi-Tenant Sales Isolation", () => {
  const REAL_BUSINESS_ID = "a8e2612f-4acc-4c84-a420-220131b70d66";
  const EMPTY_BUSINESS_ID = "00000000-0000-0000-0000-000000000999";

  it("debe retornar métricas reales del negocio activo respetando zona horaria", async () => {
    const data = await getWorkspaceDashboardData(REAL_BUSINESS_ID, "America/Bogota");

    expect(data).toBeDefined();
    expect(typeof data.todaySalesTotal).toBe("number");
    expect(typeof data.todaySalesCount).toBe("number");
    expect(typeof data.totalSalesCount).toBe("number");
    expect(typeof data.allTimeSalesTotal).toBe("number");
    expect(data.todaySalesTotal).toBeGreaterThanOrEqual(0);
    expect(data.todaySalesCount).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(data.recentDocuments)).toBe(true);

    // Todos los documentos devueltos deben pertenecer estrictamente al negocio solicitado
    if (data.recentDocuments.length > 0) {
      expect(data.recentDocuments.every((d) => d.businessId === REAL_BUSINESS_ID)).toBe(true);
    }
  });

  it("negocio sin ventas debe retornar estado vacío con ceros y sin filtrar ventas de otros", async () => {
    const data = await getWorkspaceDashboardData(EMPTY_BUSINESS_ID, "America/Bogota");

    expect(data.todaySalesTotal).toBe(0);
    expect(data.todaySalesCount).toBe(0);
    expect(data.totalSalesCount).toBe(0);
    expect(data.allTimeSalesTotal).toBe(0);
    expect(data.recentDocuments).toHaveLength(0);
  });
});
