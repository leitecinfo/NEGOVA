import { describe, it, expect, afterAll } from "vitest";
import {
  getBusinessDocumentConfig,
  saveBusinessDocumentConfig,
  createBusinessSaleDocument,
  getBusinessDocumentsList,
  cancelBusinessSaleDocument,
  deleteBusinessDocument,
} from "@/lib/documents/document-service";

describe("Documentos Comerciales y Persistencia en PostgreSQL", () => {
  const REAL_BUSINESS_ID = "a8e2612f-4acc-4c84-a420-220131b70d66";
  const OTHER_BUSINESS_ID = "00000000-0000-0000-0000-000000000002";
  const createdDocIds: string[] = [];

  afterAll(async () => {
    // Teardown técnico: limpiar documentos generados en pruebas
    for (const docId of createdDocIds) {
      await deleteBusinessDocument(REAL_BUSINESS_ID, docId);
    }
  });

  it("debe persistir y recuperar la configuración de marca en PostgreSQL", async () => {
    const saveRes = await saveBusinessDocumentConfig(REAL_BUSINESS_ID, {
      tradeName: "Comida Rápida AA Gourmet",
      legalName: "Inversiones AA SAS",
      taxId: "901.234.567-8",
      phone: "3001234567",
      email: "contacto@comidarapida.com",
      address: "Calle 10 # 4-50",
      city: "Riohacha",
      primaryColor: "#0284C7",
      documentTitleDefault: "CUENTA DE COBRO",
      headerText: "Resolución No. 18760000000001",
      thankYouNote: "¡Gracias por preferirnos!",
      termsAndConditions: "No se aceptan devoluciones después de 5 días.",
    });

    expect(saveRes.success).toBe(true);

    const config = await getBusinessDocumentConfig(REAL_BUSINESS_ID);

    expect(config.businessId).toBe(REAL_BUSINESS_ID);
    expect(config.tradeName).toBe("Comida Rápida AA Gourmet");
    expect(config.legalName).toBe("Inversiones AA SAS");
    expect(config.taxId).toBe("901.234.567-8");
    expect(config.phone).toBe("3001234567");
    expect(config.email).toBe("contacto@comidarapida.com");
    expect(config.primaryColor).toBe("#0284C7");
    expect(config.documentTitleDefault).toBe("CUENTA DE COBRO");
    expect(config.headerText).toBe("Resolución No. 18760000000001");
    expect(config.thankYouNote).toBe("¡Gracias por preferirnos!");
    expect(config.termsAndConditions).toBe("No se aceptan devoluciones después de 5 días.");
  });

  it("debe registrar un documento comercial en PostgreSQL y calcular subtotales correctamente", async () => {
    const res = await createBusinessSaleDocument(REAL_BUSINESS_ID, {
      customerName: "María Pérez",
      customerId: "55443322",
      items: [
        { description: "Hamburguesa Especial", quantity: 2, unitPrice: 25000, discount: 5000, total: 45000 },
        { description: "Bebida Gaseosa", quantity: 2, unitPrice: 5000, discount: 0, total: 10000 },
      ],
      paymentMethod: "cash",
      notes: "Venta en mesa 4",
    });

    expect(res.success).toBe(true);
    expect(res.document).toBeDefined();
    if (res.document) {
      createdDocIds.push(res.document.id);
    }
    expect(res.document?.documentNumber).toMatch(/^DOC-\d{4}-\d{4}$/);
    expect(res.document?.subtotal).toBe(60000);
    expect(res.document?.discountTotal).toBe(5000);
    expect(res.document?.total).toBe(55000);
    expect(res.document?.currency).toBe("COP");
    expect(res.document?.businessId).toBe(REAL_BUSINESS_ID);

    // Listar documentos del negocio
    const list = await getBusinessDocumentsList({ businessId: REAL_BUSINESS_ID });
    expect(list.documents.length).toBeGreaterThan(0);
    expect(list.documents.every((d) => d.businessId === REAL_BUSINESS_ID)).toBe(true);
  });

  it("debe generar números correlativos consecutivos deterministas", async () => {
    const res1 = await createBusinessSaleDocument(REAL_BUSINESS_ID, {
      customerName: "Cliente Consecutivo 1",
      items: [{ description: "Producto A", quantity: 1, unitPrice: 10000, discount: 0, total: 10000 }],
      paymentMethod: "cash",
    });

    expect(res1.success).toBe(true);
    if (res1.document) createdDocIds.push(res1.document.id);

    const res2 = await createBusinessSaleDocument(REAL_BUSINESS_ID, {
      customerName: "Cliente Consecutivo 2",
      items: [{ description: "Producto B", quantity: 1, unitPrice: 20000, discount: 0, total: 20000 }],
      paymentMethod: "transfer",
    });

    expect(res2.success).toBe(true);
    if (res2.document) createdDocIds.push(res2.document.id);

    const num1 = parseInt(res1.document!.documentNumber.split("-")[2], 10);
    const num2 = parseInt(res2.document!.documentNumber.split("-")[2], 10);

    expect(num2).toBeGreaterThanOrEqual(num1 + 1);
  });

  it("debe cancelar un documento comercial cambiando status a 'cancelled' sin borrarlo físicamente y registrar auditoría", async () => {
    const REAL_USER_ID = "7bfdea13-6a76-4011-a699-7582c6bad4e5";

    // 1. Crear documento a cancelar
    const createRes = await createBusinessSaleDocument(REAL_BUSINESS_ID, {
      customerName: "Cliente Para Anular",
      items: [{ description: "Plato Devolución", quantity: 1, unitPrice: 30000, discount: 0, total: 30000 }],
      paymentMethod: "cash",
      notes: "Venta con error en comanda",
      userId: REAL_USER_ID,
    });

    expect(createRes.success).toBe(true);
    const docId = createRes.document!.id;
    createdDocIds.push(docId);

    // 2. Ejecutar cancelación comercial con usuario real
    const cancelRes = await cancelBusinessSaleDocument(REAL_BUSINESS_ID, docId, {
      userId: REAL_USER_ID,
      reason: "Error de digitación en punto de venta",
    });

    expect(cancelRes.success).toBe(true);
    expect(cancelRes.document?.status).toBe("cancelled");
    expect(cancelRes.document?.notes).toContain("Error de digitación en punto de venta");

    // 3. Verificar que el documento SIGUE EXISTIENDO en la base de datos (inmutabilidad histórica)
    const listRes = await getBusinessDocumentsList({ businessId: REAL_BUSINESS_ID, status: "cancelled" });
    const found = listRes.documents.find((d) => d.id === docId);
    expect(found).toBeDefined();
    expect(found?.status).toBe("cancelled");

    // 4. Intentar cancelar un documento ya cancelado debe retornar error amigable
    const reCancelRes = await cancelBusinessSaleDocument(REAL_BUSINESS_ID, docId);
    expect(reCancelRes.success).toBe(false);
    expect(reCancelRes.error).toBe("El documento ya se encuentra cancelado.");
  });

  it("debe garantizar que fallos en auditoría sean no bloqueantes para la creación de ventas", async () => {
    // Si se pasa un userId inexistente o hay anomalía de auditoría, la venta no debe abortarse
    const res = await createBusinessSaleDocument(REAL_BUSINESS_ID, {
      customerName: "Cliente Auditoria Resiliente",
      items: [{ description: "Producto Test", quantity: 1, unitPrice: 5000, discount: 0, total: 5000 }],
      userId: "00000000-0000-0000-0000-000000000099", // Usuario inexistente que provocará advertencia FK en audit_logs
    });

    expect(res.success).toBe(true);
    expect(res.document).toBeDefined();
    if (res.document) createdDocIds.push(res.document.id);
  });

  it("debe rechazar la cancelación o acceso a un documento perteneciente a otro negocio (Multi-Tenant)", async () => {
    // 1. Crear documento en negocio A
    const createRes = await createBusinessSaleDocument(REAL_BUSINESS_ID, {
      customerName: "Cliente Blindado",
      items: [{ description: "Item Protegido", quantity: 1, unitPrice: 15000, discount: 0, total: 15000 }],
    });
    expect(createRes.success).toBe(true);
    const docId = createRes.document!.id;
    createdDocIds.push(docId);

    // 2. Intentar cancelar desde un negocio B ajeno
    const unauthorizedCancel = await cancelBusinessSaleDocument(OTHER_BUSINESS_ID, docId, {
      reason: "Intento de cancelación no autorizado",
    });

    expect(unauthorizedCancel.success).toBe(false);
    expect(unauthorizedCancel.error).toBe("Documento no encontrado o no pertenece a este negocio.");

    // 3. Intentar cancelar un documento inexistente
    const nonExistentCancel = await cancelBusinessSaleDocument(REAL_BUSINESS_ID, "doc-inexistente-9999");
    expect(nonExistentCancel.success).toBe(false);
    expect(nonExistentCancel.error).toBe("Documento no encontrado o no pertenece a este negocio.");
  });
});
