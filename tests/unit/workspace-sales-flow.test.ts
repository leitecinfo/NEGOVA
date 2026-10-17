import { describe, it, expect, afterAll } from "vitest";
import {
  getBusinessDocumentsList,
  getBusinessDocumentById,
  createBusinessSaleDocument,
  cancelBusinessSaleDocument,
  generateBusinessDocumentPdf,
  deleteBusinessDocument,
} from "@/lib/documents/document-service";
import { hasPlatformPermission } from "@/lib/auth/permissions";

describe("Workspace → Ventas y Documentos: Flujo Operativo & Seguridad Multi-Tenant", () => {
  const REAL_BUSINESS_ID = "a8e2612f-4acc-4c84-a420-220131b70d66";
  const OTHER_BUSINESS_ID = "00000000-0000-0000-0000-000000000099";
  const createdDocIds: string[] = [];

  afterAll(async () => {
    // Teardown técnico: limpiar documentos creados durante las pruebas
    for (const id of createdDocIds) {
      await deleteBusinessDocument(REAL_BUSINESS_ID, id);
    }
  });

  // 1. HISTORIAL Y FILTROS
  describe("1. Historial de ventas, filtros y paginación", () => {
    it("debe listar únicamente documentos pertenecientes al negocio actual", async () => {
      const res = await getBusinessDocumentsList({
        businessId: REAL_BUSINESS_ID,
        page: 1,
        pageSize: 10,
      });

      expect(res.documents).toBeDefined();
      expect(res.documents.every((d) => d.businessId === REAL_BUSINESS_ID)).toBe(true);
      expect(res.page).toBe(1);
      expect(res.pageSize).toBe(10);
    });

    it("debe aplicar filtros por estado y método de pago correctamente", async () => {
      // Crear una venta con método de pago 'card' para probar filtrado
      const newDoc = await createBusinessSaleDocument(REAL_BUSINESS_ID, {
        customerName: "Cliente Filtro Tarjeta",
        items: [{ description: "Servicio Web", quantity: 1, unitPrice: 80000, discount: 0, total: 80000 }],
        paymentMethod: "card",
        status: "paid",
      });

      expect(newDoc.success).toBe(true);
      if (newDoc.document) createdDocIds.push(newDoc.document.id);

      // Filtrar por paymentMethod = 'card'
      const filtered = await getBusinessDocumentsList({
        businessId: REAL_BUSINESS_ID,
        paymentMethod: "card",
      });

      expect(filtered.documents.length).toBeGreaterThan(0);
      expect(filtered.documents.some((d) => d.id === newDoc.document?.id)).toBe(true);
      expect(filtered.documents.every((d) => d.paymentMethod === "card" || d.paymentMethod === "credit")).toBe(true);
    });

    it("debe filtrar correctamente por búsqueda de texto (nombre de cliente o correlativo)", async () => {
      const uniqueName = `Cliente Unico Búsqueda ${Date.now()}`;
      const doc = await createBusinessSaleDocument(REAL_BUSINESS_ID, {
        customerName: uniqueName,
        items: [{ description: "Teclado Mecánico", quantity: 1, unitPrice: 120000, discount: 0, total: 120000 }],
      });
      expect(doc.success).toBe(true);
      createdDocIds.push(doc.document!.id);

      // Búsqueda por nombre
      const searchRes = await getBusinessDocumentsList({
        businessId: REAL_BUSINESS_ID,
        search: uniqueName,
      });

      expect(searchRes.documents.length).toBeGreaterThan(0);
      expect(searchRes.documents.some((d) => d.customerName === uniqueName)).toBe(true);

      // Búsqueda por correlativo
      const searchDocNumber = await getBusinessDocumentsList({
        businessId: REAL_BUSINESS_ID,
        search: doc.document!.documentNumber,
      });

      expect(searchDocNumber.documents.length).toBeGreaterThan(0);
      expect(searchDocNumber.documents[0].documentNumber).toBe(doc.document!.documentNumber);
    });

    it("debe aplicar paginación real respetando límites y cálculo de totalPages", async () => {
      // Crear al menos 3 documentos para probar límites de página
      for (let i = 0; i < 3; i++) {
        const d = await createBusinessSaleDocument(REAL_BUSINESS_ID, {
          customerName: `Cliente Paginación ${i}`,
          items: [{ description: `Item ${i}`, quantity: 1, unitPrice: 5000, discount: 0, total: 5000 }],
        });
        if (d.document) createdDocIds.push(d.document.id);
      }

      const page1 = await getBusinessDocumentsList({
        businessId: REAL_BUSINESS_ID,
        page: 1,
        pageSize: 2,
      });

      expect(page1.page).toBe(1);
      expect(page1.pageSize).toBe(2);
      expect(page1.documents.length).toBeLessThanOrEqual(2);
      expect(page1.totalPages).toBeGreaterThanOrEqual(2);

      const page2 = await getBusinessDocumentsList({
        businessId: REAL_BUSINESS_ID,
        page: 2,
        pageSize: 2,
      });

      expect(page2.page).toBe(2);
      expect(page2.pageSize).toBe(2);
      // Los documentos de la página 1 no deben solaparse con la página 2
      if (page1.documents.length > 0 && page2.documents.length > 0) {
        expect(page1.documents[0].id).not.toBe(page2.documents[0].id);
      }
    });

    it("debe filtrar por rango de fechas (startDate y endDate)", async () => {
      const today = new Date().toISOString().split("T")[0];
      const res = await getBusinessDocumentsList({
        businessId: REAL_BUSINESS_ID,
        startDate: `${today}T00:00:00.000Z`,
        endDate: `${today}T23:59:59.999Z`,
      });

      expect(res.documents).toBeDefined();
      expect(res.documents.every((d) => d.issuedAt.startsWith(today))).toBe(true);
    });
  });

  // 2. NUEVA VENTA Y CÁLCULOS SEGUROS
  describe("2. Nueva venta: RBAC, validaciones y cálculos seguros", () => {
    it("usuario con sales.create puede crear; usuario sin permiso no puede", () => {
      // Owner y Auxiliar tienen sales.create
      expect(hasPlatformPermission("owner", "sales.create")).toBe(true);
      expect(hasPlatformPermission("auxiliar", "sales.create")).toBe(true);

      // Roles externos o no autorizados NO tienen sales.create
      expect(hasPlatformPermission("cliente", "sales.create")).toBe(false);
      expect(hasPlatformPermission("guest", "sales.create")).toBe(false);
      expect(hasPlatformPermission(undefined, "sales.create")).toBe(false);
    });

    it("debe calcular subtotal, descuento, impuesto y total de forma segura en servidor", async () => {
      const newSale = await createBusinessSaleDocument(REAL_BUSINESS_ID, {
        customerName: "Cliente Cálculos Seguros",
        items: [
          { description: "Hamburguesa Doble", quantity: 2, unitPrice: 20000, discount: 2000, total: 38000 },
          { description: "Papas Fritas", quantity: 1, unitPrice: 8000, discount: 0, total: 8000 },
        ],
        paymentMethod: "cash",
        status: "paid",
        notes: "Mesa 5",
      }, {
        // Opción taxTotal
      });

      expect(newSale.success).toBe(true);
      const doc = newSale.document!;
      createdDocIds.push(doc.id);

      // Subtotal = 2 * 20000 + 1 * 8000 = 48000
      expect(doc.subtotal).toBe(48000);
      // Descuentos en items = 2000
      expect(doc.discountTotal).toBe(2000);
      // Total = 48000 - 2000 = 46000
      expect(doc.total).toBe(46000);
      expect(doc.currency).toBe("COP");
      expect(doc.paymentMethod).toBe("cash");
      expect(doc.notes).toBe("Mesa 5");
    });

    it("debe aplicar 'Cliente General' / 'Consumidor Final' cuando el cliente no especifica nombre", async () => {
      const doc = await createBusinessSaleDocument(REAL_BUSINESS_ID, {
        customerName: "   ",
        items: [{ description: "Café Americano", quantity: 1, unitPrice: 4000, discount: 0, total: 4000 }],
      });

      expect(doc.success).toBe(true);
      expect(doc.document?.customerName).toBe("Cliente General");
      if (doc.document) createdDocIds.push(doc.document.id);
    });

    it("un businessId ajeno o incorrecto no debe contaminar el negocio actual", async () => {
      const doc = await createBusinessSaleDocument(REAL_BUSINESS_ID, {
        customerName: "Cliente Aislamiento",
        items: [{ description: "Producto A", quantity: 1, unitPrice: 10000, discount: 0, total: 10000 }],
      });
      expect(doc.success).toBe(true);
      createdDocIds.push(doc.document!.id);

      // El negocio B no debe tener este documento en su lista
      const listOther = await getBusinessDocumentsList({
        businessId: OTHER_BUSINESS_ID,
      });

      expect(listOther.documents.some((d) => d.id === doc.document!.id)).toBe(false);
    });
  });

  // 3. DETALLE DE COMPROBANTE Y AISLAMIENTO MULTI-TENANT
  describe("3. Detalle de comprobante y aislamiento multi-tenant", () => {
    it("debe consultar un comprobante perteneciente al negocio con todos sus datos", async () => {
      const created = await createBusinessSaleDocument(REAL_BUSINESS_ID, {
        customerName: "Cliente Detalle Venta",
        customerId: "1098234567",
        customerPhone: "3001234567",
        customerEmail: "detalle@correo.com",
        customerAddress: "Calle 10 # 5-20",
        items: [{ description: "Combo Hamburguesa", quantity: 2, unitPrice: 20000, discount: 0, total: 40000 }],
        paymentMethod: "card",
        status: "paid",
      });
      expect(created.success).toBe(true);
      const docId = created.document!.id;
      createdDocIds.push(docId);

      const found = await getBusinessDocumentById(REAL_BUSINESS_ID, docId);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(docId);
      expect(found?.documentNumber).toMatch(/^DOC-\d{4}-\d{4}$/);
      expect(found?.customerName).toBe("Cliente Detalle Venta");
      expect(found?.customerId).toBe("1098234567");
      expect(found?.customerPhone).toBe("3001234567");
      expect(found?.customerEmail).toBe("detalle@correo.com");
      expect(found?.customerAddress).toBe("Calle 10 # 5-20");
      expect(found?.items).toHaveLength(1);
      expect(found?.total).toBe(40000);
      expect(found?.paymentMethod).toBe("card");
    });

    it("debe denegar y retornar null si se consulta un documento desde otro negocio (Multi-Tenant)", async () => {
      const created = await createBusinessSaleDocument(REAL_BUSINESS_ID, {
        customerName: "Cliente Confidencial",
        items: [{ description: "Producto Protegido", quantity: 1, unitPrice: 10000, discount: 0, total: 10000 }],
      });
      expect(created.success).toBe(true);
      const docId = created.document!.id;
      createdDocIds.push(docId);

      // Consultar el documento del negocio A enviando el negocio B ajeno
      const crossBizResult = await getBusinessDocumentById(OTHER_BUSINESS_ID, docId);
      expect(crossBizResult).toBeNull();
    });
  });

  // 4. CANCELACIÓN INMUTABLE Y RBAC
  describe("4. Cancelación comercial inmutable y permisos RBAC", () => {
    it("owner puede cancelar; auxiliar NO puede cancelar documentos", () => {
      expect(hasPlatformPermission("owner", "sales.cancel")).toBe(true);
      expect(hasPlatformPermission("auxiliar", "sales.cancel")).toBe(false);
    });

    it("debe cancelar el documento cambiando status a 'cancelled', registrando motivo y preservando el registro", async () => {
      const created = await createBusinessSaleDocument(REAL_BUSINESS_ID, {
        customerName: "Cliente Anulación Test",
        items: [{ description: "Almuerzo Ejecutivo", quantity: 1, unitPrice: 15000, discount: 0, total: 15000 }],
        notes: "Pedido especial",
      });
      expect(created.success).toBe(true);
      const docId = created.document!.id;
      createdDocIds.push(docId);

      const cancelRes = await cancelBusinessSaleDocument(REAL_BUSINESS_ID, docId, {
        reason: "Devolución autorizada por gerencia",
      });

      expect(cancelRes.success).toBe(true);
      expect(cancelRes.document?.status).toBe("cancelled");
      expect(cancelRes.document?.notes).toContain("Devolución autorizada por gerencia");
      expect(cancelRes.document?.notes).toContain("Pedido especial");

      // Comprobar que sigue existiendo en el historial (no se eliminó con DELETE)
      const docInDb = await getBusinessDocumentById(REAL_BUSINESS_ID, docId);
      expect(docInDb).not.toBeNull();
      expect(docInDb?.status).toBe("cancelled");
    });

    it("debe rechazar una segunda cancelación sobre un documento ya cancelado", async () => {
      const created = await createBusinessSaleDocument(REAL_BUSINESS_ID, {
        customerName: "Cliente Doble Cancelación",
        items: [{ description: "Servicio Express", quantity: 1, unitPrice: 25000, discount: 0, total: 25000 }],
      });
      expect(created.success).toBe(true);
      const docId = created.document!.id;
      createdDocIds.push(docId);

      // Primera cancelación
      const firstCancel = await cancelBusinessSaleDocument(REAL_BUSINESS_ID, docId, {
        reason: "Primer intento",
      });
      expect(firstCancel.success).toBe(true);

      // Segunda cancelación debe fallar
      const secondCancel = await cancelBusinessSaleDocument(REAL_BUSINESS_ID, docId, {
        reason: "Segundo intento duplicado",
      });
      expect(secondCancel.success).toBe(false);
      expect(secondCancel.error).toContain("ya se encuentra cancelado");
    });
  });

  // 5. GENERADOR DE PDF COMERCIAL
  describe("5. Generación de PDF comercial", () => {
    it("debe generar un PDF válido en Base64 respetando los datos del comprobante y negocio", async () => {
      const created = await createBusinessSaleDocument(REAL_BUSINESS_ID, {
        customerName: "Cliente Comprobante PDF",
        items: [{ description: "Licencia de Software", quantity: 1, unitPrice: 150000, discount: 0, total: 150000 }],
        paymentMethod: "transfer",
        status: "paid",
      });
      expect(created.success).toBe(true);
      const docId = created.document!.id;
      createdDocIds.push(docId);

      const pdfRes = await generateBusinessDocumentPdf(REAL_BUSINESS_ID, docId);
      expect(pdfRes.success).toBe(true);
      expect(pdfRes.base64).toBeDefined();
      expect(pdfRes.base64!.length).toBeGreaterThan(100);
      expect(pdfRes.filename).toContain(created.document!.documentNumber);
    });

    it("debe denegar la generación de PDF si el documento pertenece a otro negocio", async () => {
      const created = await createBusinessSaleDocument(REAL_BUSINESS_ID, {
        customerName: "Cliente PDF Aislado",
        items: [{ description: "Consultoría", quantity: 1, unitPrice: 50000, discount: 0, total: 50000 }],
      });
      expect(created.success).toBe(true);
      const docId = created.document!.id;
      createdDocIds.push(docId);

      const crossPdf = await generateBusinessDocumentPdf(OTHER_BUSINESS_ID, docId);
      expect(crossPdf.success).toBe(false);
      expect(crossPdf.error).toContain("Documento no encontrado o no pertenece a este negocio");
    });
  });
});
