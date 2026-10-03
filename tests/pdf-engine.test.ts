import { describe, it, expect } from "vitest";
import { generateNegovaBillingPdf, generateBusinessSalePdf } from "@/lib/pdf/pdf-engine";
import { NegovaBillingPdfData, BusinessSalePdfData } from "@/lib/pdf/types";

describe("Motor Universal de Renderizado de PDF", () => {
  it("debe generar un PDF institucional de cobro NEGOVA válido", () => {
    const data: NegovaBillingPdfData = {
      invoiceNumber: "CMP-2026-0001",
      businessName: "Comida Rapida AA",
      businessSlug: "comida-rapida-aa",
      businessNit: "901.234.567-8",
      businessEmail: "comidarapida@test.com",
      planId: "crece",
      planName: "Crece",
      billingInterval: "monthly",
      amount: 59900,
      currency: "COP",
      status: "pending",
      paymentMethod: "transfer",
      paymentReference: "TRF-TEST-123",
      issuedAt: "2026-09-01T00:00:00Z",
      dueDate: "2026-09-30T00:00:00Z",
      notes: "Cobro del período Septiembre 2026",
    };

    const result = generateNegovaBillingPdf(data);

    expect(result).toBeDefined();
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.length).toBeGreaterThan(500);
    expect(result.base64).toBeTypeOf("string");
    expect(result.base64.length).toBeGreaterThan(100);
    expect(result.filename).toBe("comprobante-CMP-2026-0001.pdf");
    expect(result.sizeBytes).toBeGreaterThan(500);
  });

  it("debe generar un PDF de documento comercial de negocio cliente con configuración de marca", () => {
    const data: BusinessSalePdfData = {
      documentNumber: "DOC-2026-0001",
      documentTitle: "DOCUMENTO DE VENTA",
      businessId: "biz-123",
      tradeName: "Boutique Elegance",
      legalName: "Elegance SAS",
      taxId: "900.888.777-1",
      phone: "3001234567",
      email: "ventas@elegance.com",
      address: "Calle 10 # 5-20",
      city: "Riohacha",
      primaryColor: "#0284C7",
      customerName: "Carlos Gómez",
      customerId: "1098765432",
      customerPhone: "3109876543",
      issuedAt: "2026-09-10T00:00:00Z",
      items: [
        { description: "Camisa Lino Blanca", quantity: 2, unitPrice: 70000, discount: 0, total: 140000 },
        { description: "Pantalón Casual", quantity: 1, unitPrice: 85000, discount: 5000, total: 80000 },
      ],
      subtotal: 225000,
      discountTotal: 5000,
      total: 220000,
      currency: "COP",
      thankYouNote: "¡Gracias por su compra en Boutique Elegance!",
      notes: "Garantía de 30 días con este documento.",
    };

    const result = generateBusinessSalePdf(data);

    expect(result).toBeDefined();
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.length).toBeGreaterThan(500);
    expect(result.filename).toBe("DOC-2026-0001.pdf");
    expect(result.sizeBytes).toBeGreaterThan(500);
  });
});
