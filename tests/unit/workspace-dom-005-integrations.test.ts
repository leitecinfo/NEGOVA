import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  calculateFinancialComparison,
  generateWebhookUrl,
  getIntegrationGuideSteps,
  getDefaultProviderConfig,
  ingestExternalDeliveryOrder,
  simulateDeliveryWebhook,
} from "@/lib/delivery/delivery-integrations-service";

// Mock Supabase
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();

const mockSupabase = {
  from: vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  })),
};

vi.mock("@/lib/restaurant/restaurant-service", () => ({
  getDbClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

vi.mock("@/lib/audit/audit-service", () => ({
  logAuditAction: vi.fn(() => Promise.resolve()),
}));

describe("[DOM-005] Integraciones de Delivery Externo (Rappi / Justo)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      order: mockOrder,
      maybeSingle: mockMaybeSingle,
      single: mockSingle,
    });
    mockOrder.mockReturnValue({
      limit: mockLimit,
    });
    mockLimit.mockReturnValue({
      maybeSingle: mockMaybeSingle,
    });
    mockInsert.mockReturnValue({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { id: "order-test-uuid", order_number: 105 },
          error: null,
        }),
      })),
      error: null,
    });
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
  });

  describe("1. Evaluación Financiera y Comparador de Rentabilidad", () => {
    it("debe calcular correctamente las comisiones, IVA y ganancia neta para NEGOVA, Justo y Rappi", () => {
      const ticket = 50000;
      const cogsRate = 0.35; // 35% de costo de materia prima ($17.500)
      const results = calculateFinancialComparison(ticket, cogsRate);

      expect(results).toHaveLength(3);

      const [negova, justo, rappi] = results;

      // NEGOVA Directo (0% comisión)
      expect(negova.channel).toBe("negova_direct");
      expect(negova.commissionRate).toBe(0);
      expect(negova.commissionAmount).toBe(0);
      expect(negova.commissionVat).toBe(0);
      expect(negova.cogsAmount).toBe(17500);
      expect(negova.netProfit).toBe(32500);
      expect(negova.netMarginPercent).toBe(65.0);
      expect(negova.customerDataOwnership).toContain("100% Negocio");

      // Justo (10% comisión + 19% IVA)
      expect(justo.channel).toBe("justo");
      expect(justo.commissionRate).toBe(0.10);
      expect(justo.commissionAmount).toBe(5000);
      expect(justo.commissionVat).toBe(950);
      expect(justo.netProfit).toBe(26550);
      expect(justo.netMarginPercent).toBe(53.1);
      expect(justo.customerDataOwnership).toContain("100% Negocio");

      // Rappi (20% comisión + 19% IVA)
      expect(rappi.channel).toBe("rappi");
      expect(rappi.commissionRate).toBe(0.20);
      expect(rappi.commissionAmount).toBe(10000);
      expect(rappi.commissionVat).toBe(1900);
      expect(rappi.netProfit).toBe(20600);
      expect(rappi.netMarginPercent).toBe(41.2);
      expect(rappi.customerDataOwnership).toContain("0% Plataforma");

      // Verificación de ganancia superior de canal directo
      expect(negova.netProfit).toBeGreaterThan(justo.netProfit);
      expect(justo.netProfit).toBeGreaterThan(rappi.netProfit);
      expect(negova.netProfit - rappi.netProfit).toBe(11900); // $11.900 COP extra por pedido retenidos
    });

    it("debe manejar límites mínimos y porcentajes de COGS extremos sin desbordarse", () => {
      const resultsMin = calculateFinancialComparison(0, 0.05); // ticket mínimo se fija en 1000, cogs mínimo en 10%
      expect(resultsMin[0].sampleTicket).toBe(1000);
      expect(resultsMin[0].cogsRate).toBe(0.10);
      expect(resultsMin[0].netProfit).toBe(900);
    });
  });

  describe("2. Generación de URLs de Webhook por Tenant", () => {
    it("debe generar URLs consistentes y aisladas por businessId", () => {
      const bizId = "biz-restaurant-alpha-123";
      const rappiUrl = generateWebhookUrl(bizId, "rappi");
      const justoUrl = generateWebhookUrl(bizId, "justo");

      expect(rappiUrl).toContain("/api/integrations/delivery/webhook/rappi");
      expect(rappiUrl).toContain(`businessId=${encodeURIComponent(bizId)}`);

      expect(justoUrl).toContain("/api/integrations/delivery/webhook/justo");
      expect(justoUrl).toContain(`businessId=${encodeURIComponent(bizId)}`);
    });

    it("debe retornar la configuración por defecto para un nuevo comercio", () => {
      const config = getDefaultProviderConfig("biz-456", "rappi");
      expect(config.provider).toBe("rappi");
      expect(config.enabled).toBe(false);
      expect(config.status).toBe("not_configured");
      expect(config.commissionPercent).toBe(20);
      expect(config.autoAcceptOrders).toBe(true);
      expect(config.credentials.environment).toBe("sandbox");
    });
  });

  describe("3. Guías Paso a Paso de Integración", () => {
    it("debe proporcionar los 5 pasos técnicos y comerciales para Rappi", () => {
      const steps = getIntegrationGuideSteps("rappi");
      expect(steps).toHaveLength(5);
      expect(steps[0].title).toContain("Paso 1");
      expect(steps[0].docLink).toBe("https://developers.rappi.com");
      expect(steps[1].title).toContain("OAuth 2.0");
      expect(steps[2].description).toContain("Webhook");
    });

    it("debe proporcionar los 5 pasos estructurados para Justo", () => {
      const steps = getIntegrationGuideSteps("justo");
      expect(steps).toHaveLength(5);
      expect(steps[0].title).toContain("Paso 1");
      expect(steps[0].docLink).toBe("https://developers.getjusto.com");
      expect(steps[1].description).toContain("API Key");
    });
  });

  describe("4. Ingesta y Simulación de Pedidos Webhook", () => {
    it("debe procesar e insertar un pedido externo en restaurant_orders con canal correspondiente", async () => {
      mockMaybeSingle.mockResolvedValueOnce({ order_number: 104 }); // Última orden

      const payload = {
        provider: "rappi" as const,
        externalOrderId: "RAPPI-9988",
        customerName: "Juan Pérez",
        customerPhone: "+573001112233",
        deliveryAddress: "Calle 100 # 19-61, Of 502",
        items: [
          {
            name: "Pizza Napolitana Familiar",
            quantity: 1,
            unitPrice: 42000,
            subtotal: 42000,
          },
        ],
        subtotal: 42000,
        deliveryFee: 6000,
        total: 48000,
      };

      const result = await ingestExternalDeliveryOrder("biz-test-1", payload);

      expect(result.success).toBe(true);
      expect(result.orderNumber).toBe(105);
      expect(mockSupabase.from).toHaveBeenCalledWith("restaurant_orders");
    });

    it("debe ejecutar la simulación de pedido entrante para Rappi", async () => {
      mockMaybeSingle.mockResolvedValueOnce({ order_number: 200 });

      const result = await simulateDeliveryWebhook("biz-test-1", "rappi");

      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith("restaurant_orders");
    });
  });

  describe("5. Reglas Globales: Prohibición de Alertas Nativas", () => {
    it("el componente delivery-integrations-tab.tsx no debe contener llamadas a alertas nativas", () => {
      const filePath = path.resolve(
        process.cwd(),
        "src/components/delivery/delivery-integrations-tab.tsx"
      );
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).not.toMatch(/\bwindow\.alert\s*\(/);
      expect(content).not.toMatch(/\bwindow\.confirm\s*\(/);
      expect(content).not.toMatch(/\bwindow\.prompt\s*\(/);
      expect(content).not.toMatch(/\bAlert\.alert\s*\(/);
    });
  });
});
