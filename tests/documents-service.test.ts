import { describe, it, expect, vi } from "vitest";
import {
  getBusinessDocumentConfig,
  saveBusinessDocumentConfig,
  createBusinessSaleDocument,
  getBusinessDocumentsList,
} from "@/lib/documents/document-service";

describe("Documentos Comerciales y Aislamiento Multi-Tenant", () => {
  it("debe garantizar aislamiento estricto de configuración entre negocios", async () => {
    const bizA = "biz-empresa-aaa";
    const bizB = "biz-empresa-bbb";

    // Guardar config para Negocio A
    await saveBusinessDocumentConfig(bizA, {
      tradeName: "Restaurante El Guajiro",
      primaryColor: "#FF0000",
      documentTitleDefault: "CUENTA DE CONSUMO",
    });

    // Guardar config para Negocio B
    await saveBusinessDocumentConfig(bizB, {
      tradeName: "Ferretería El Tornillo",
      primaryColor: "#00FF00",
      documentTitleDefault: "ORDEN DE ENTREGA",
    });

    const configA = await getBusinessDocumentConfig(bizA);
    const configB = await getBusinessDocumentConfig(bizB);

    expect(configA.tradeName).toBe("Restaurante El Guajiro");
    expect(configA.primaryColor).toBe("#FF0000");
    expect(configA.documentTitleDefault).toBe("CUENTA DE CONSUMO");

    expect(configB.tradeName).toBe("Ferretería El Tornillo");
    expect(configB.primaryColor).toBe("#00FF00");
    expect(configB.documentTitleDefault).toBe("ORDEN DE ENTREGA");

    // Negocio A no puede modificar ni contaminar Negocio B
    expect(configA.businessId).not.toBe(configB.businessId);
  });

  it("debe crear un documento comercial y calcular subtotales correctamente", async () => {
    const bizId = "biz-tienda-ropa-123";

    const res = await createBusinessSaleDocument(bizId, {
      customerName: "María Pérez",
      customerId: "55443322",
      items: [
        { description: "Vestido de Noche", quantity: 1, unitPrice: 120000, discount: 10000, total: 110000 },
        { description: "Zapatos", quantity: 1, unitPrice: 80000, discount: 0, total: 80000 },
      ],
      paymentMethod: "cash",
      notes: "Venta presencial en tienda",
    });

    expect(res.success).toBe(true);
    expect(res.document).toBeDefined();
    expect(res.document?.documentNumber).toMatch(/^DOC-2026-\d{4}$/);
    expect(res.document?.subtotal).toBe(200000);
    expect(res.document?.discountTotal).toBe(10000);
    expect(res.document?.total).toBe(190000);
    expect(res.document?.currency).toBe("COP");
    expect(res.document?.businessId).toBe(bizId);

    // Listar documentos de este negocio
    const list = await getBusinessDocumentsList({ businessId: bizId });
    expect(list.documents.length).toBeGreaterThan(0);
    expect(list.documents.every((d) => d.businessId === bizId)).toBe(true);
  });
});
