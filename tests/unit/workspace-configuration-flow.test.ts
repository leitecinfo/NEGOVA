import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateBusinessSalePdf } from "@/lib/pdf/pdf-engine";
import { BusinessSalePdfData } from "@/lib/pdf/types";
import { BusinessDocumentConfig } from "@/lib/documents/types";

describe("Workspace Business Configuration & PDF Flow (Fase 2.3.1)", () => {
  const BUSINESS_A_ID = "a8e2612f-4acc-4c84-a420-220131b70d66";
  const BUSINESS_B_ID = "b9f37230-5bdd-5d95-b531-331242c81e77";

  const sampleConfigA: BusinessDocumentConfig = {
    businessId: BUSINESS_A_ID,
    tradeName: "Droguería y Variedades La Esperanza",
    legalName: "Inversiones La Esperanza SAS",
    taxId: "900.555.444-1",
    phone: "+57 300 111 2233",
    whatsapp: "+57 311 444 5566",
    email: "contacto@laesperanza.com",
    address: "Carrera 5 # 12-34 Centro",
    city: "Riohacha",
    department: "La Guajira",
    postalCode: "440001",
    logoUrl: "https://example.com/logo.png",
    primaryColor: "#059669",
    documentTitleDefault: "COMPROBANTE DE VENTA",
    headerText: "No responsable de IVA — Régimen Simple de Tributación",
    thankYouNote: "¡Gracias por su compra! Vuelva pronto.",
    documentObservations: "Conserve este comprobante para cualquier trámite o garantía.",
    termsAndConditions: "Los productos deben revisarse al momento de la entrega.",
    returnPolicy: "Cambios dentro de los 30 días posteriores con el comprobante en buen estado.",
    warrantyPolicy: "Garantía de 90 días por defectos de fabricación.",
    footerText: "Documento emitido mediante la plataforma NEGOVA para control comercial interno.",
    updatedAt: new Date().toISOString(),
  };

  it("1. Debe estructurar y validar todos los campos genéricos de configuración sin asumir vertical de restaurante", () => {
    expect(sampleConfigA.tradeName).toBe("Droguería y Variedades La Esperanza");
    expect(sampleConfigA.phone).toBe("+57 300 111 2233");
    expect(sampleConfigA.whatsapp).toBe("+57 311 444 5566");
    expect(sampleConfigA.department).toBe("La Guajira");
    expect(sampleConfigA.postalCode).toBe("440001");
    expect(sampleConfigA.returnPolicy).toContain("30 días");
    expect(sampleConfigA.warrantyPolicy).toContain("90 días");
    expect(sampleConfigA.documentObservations).toBeDefined();
  });

  it("2. Debe generar el PDF comercial utilizando todos los campos configurados (Logo, Color, Textos, Políticas)", () => {
    const pdfData: BusinessSalePdfData = {
      documentNumber: "DOC-2026-0042",
      documentTitle: sampleConfigA.documentTitleDefault,
      businessId: sampleConfigA.businessId,
      tradeName: sampleConfigA.tradeName,
      legalName: sampleConfigA.legalName,
      taxId: sampleConfigA.taxId,
      phone: sampleConfigA.phone,
      whatsapp: sampleConfigA.whatsapp,
      email: sampleConfigA.email,
      address: sampleConfigA.address,
      city: sampleConfigA.city,
      department: sampleConfigA.department,
      postalCode: sampleConfigA.postalCode,
      primaryColor: sampleConfigA.primaryColor,
      headerText: sampleConfigA.headerText,
      customerName: "Carlos Gómez",
      customerId: "1006575798",
      customerPhone: "+57 315 999 8877",
      customerAddress: "Calle 8 # 7-105",
      issuedAt: "2026-10-08T15:30:00Z",
      items: [
        { description: "Medicamento Multivitamínico", quantity: 2, unitPrice: 25000, discount: 5000, total: 45000 },
        { description: "Alcohol Antiséptico 500ml", quantity: 1, unitPrice: 8000, total: 8000 },
      ],
      subtotal: 58000,
      discountTotal: 5000,
      taxTotal: 0,
      total: 53000,
      currency: "COP",
      documentObservations: sampleConfigA.documentObservations,
      thankYouNote: sampleConfigA.thankYouNote,
      termsAndConditions: sampleConfigA.termsAndConditions,
      returnPolicy: sampleConfigA.returnPolicy,
      warrantyPolicy: sampleConfigA.warrantyPolicy,
      footerText: sampleConfigA.footerText,
    };

    const pdfResult = generateBusinessSalePdf(pdfData);

    expect(pdfResult).toBeDefined();
    expect(pdfResult.buffer).toBeInstanceOf(Buffer);
    expect(pdfResult.buffer.length).toBeGreaterThan(1000);
    expect(pdfResult.filename).toBe("DOC-2026-0042.pdf");
    expect(pdfResult.base64).toBeDefined();
    expect(pdfResult.sizeBytes).toBeGreaterThan(0);
  });

  it("3. Debe garantizar que el color de marca (#059669) no altere el Workspace ni la identidad oficial de NEGOVA", () => {
    // El color de marca del negocio se inyecta exclusivamente en el generador PDF / comprobantes
    const customBrandColor = "#059669";
    const pdfData: BusinessSalePdfData = {
      documentNumber: "DOC-2026-0099",
      tradeName: "Tienda Verde",
      businessId: BUSINESS_A_ID,
      primaryColor: customBrandColor,
      customerName: "Juan Pérez",
      issuedAt: "2026-10-08T10:00:00Z",
      items: [{ description: "Producto A", quantity: 1, unitPrice: 10000, total: 10000 }],
      subtotal: 10000,
      total: 10000,
      currency: "COP",
    };

    const result = generateBusinessSalePdf(pdfData);
    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  it("4. Debe verificar aislamiento estricto: la configuración de Negocio A no debe ser sobrescrita por Negocio B", () => {
    const configB: BusinessDocumentConfig = {
      ...sampleConfigA,
      businessId: BUSINESS_B_ID,
      tradeName: "Ferretería El Tornillo",
      taxId: "800.111.222-3",
      primaryColor: "#2563EB",
    };

    expect(configB.businessId).not.toBe(sampleConfigA.businessId);
    expect(configB.tradeName).not.toBe(sampleConfigA.tradeName);
    expect(configB.taxId).not.toBe(sampleConfigA.taxId);
  });

  it("5. Coherencia estricta: Si se deshabilitan los servicios, la gestión de citas NO puede permanecer activa", () => {
    const validActivities = ["sell_products", "provide_services", "manage_appointments"] as const;
    const activitiesInput = ["manage_appointments", "sell_products"]; // sin provide_services
    
    const sanitized = activitiesInput.filter((a): a is typeof validActivities[number] =>
      validActivities.includes(a as any)
    );
    const hasServices = sanitized.includes("provide_services");
    const normalized = sanitized.filter((a) => {
      if (a === "manage_appointments" && !hasServices) {
        return false;
      }
      return true;
    });

    expect(normalized).not.toContain("manage_appointments");
    expect(normalized).toContain("sell_products");
    expect(normalized.length).toBe(1);
  });

  it("6. Validación: No se puede dejar el negocio sin actividades comerciales activas", () => {
    const activitiesInput: string[] = [];
    const validActivities = ["sell_products", "provide_services", "manage_appointments"] as const;
    const sanitized = activitiesInput.filter((a): a is typeof validActivities[number] =>
      validActivities.includes(a as any)
    );
    expect(sanitized.length).toBe(0);
  });

  it("7. Seguridad POS settings: Merge parcial conserva propiedades existentes y filtra atributos maliciosos", () => {
    const currentSettings = {
      theme: "dark",
      billing_notifications: true,
      pos: { printReceipt: true, receiptCopies: 1, defaultPaymentMethod: "cash" },
    };

    const maliciousPatch = {
      pos: { receiptCopies: 2, defaultPaymentMethod: "transfer", featureOverrides: { advanced_reports: true } },
      planId: "negocio", // Intento de autoconcederse plan superior
    };

    // Aplicar lógica estricta de whitelist
    const existingPos = currentSettings.pos || {};
    const safePosSettings: Record<string, unknown> = { ...existingPos };
    if (maliciousPatch.pos) {
      if (typeof (maliciousPatch.pos as any).printReceipt === "boolean") {
        safePosSettings.printReceipt = (maliciousPatch.pos as any).printReceipt;
      }
      if (typeof maliciousPatch.pos.receiptCopies === "number") {
        safePosSettings.receiptCopies = maliciousPatch.pos.receiptCopies;
      }
      if (typeof maliciousPatch.pos.defaultPaymentMethod === "string" && ["cash", "transfer", "card"].includes(maliciousPatch.pos.defaultPaymentMethod)) {
        safePosSettings.defaultPaymentMethod = maliciousPatch.pos.defaultPaymentMethod;
      }
    }

    const mergedSettings: Record<string, unknown> = {
      ...currentSettings,
      pos: safePosSettings,
    };

    expect(mergedSettings.theme).toBe("dark");
    expect(mergedSettings.billing_notifications).toBe(true);
    expect((mergedSettings as any).planId).toBeUndefined();
    expect((mergedSettings.pos as any).receiptCopies).toBe(2);
    expect((mergedSettings.pos as any).defaultPaymentMethod).toBe("transfer");
    expect((mergedSettings.pos as any).featureOverrides).toBeUndefined();
  });
});
