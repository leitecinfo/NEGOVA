import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  calculateVerificationDigit,
  computeDianCufe,
  computeDianCude,
  buildDianQrUrl,
  getDefaultDianConfig,
  getDianBillingConfig,
  saveDianBillingConfig,
  sendTestInvoiceToDian,
  generateElectronicInvoiceForSale,
  generateCreditNoteForSale,
  getElectronicDocumentsList,
  getElectronicDocumentBySaleId,
  memoryDianConfigs,
  memoryElectronicDocuments,
} from "@/lib/dian/dian-service";
import {
  getDianBillingConfigAction,
  saveDianBillingConfigAction,
  sendTestInvoiceToDianAction,
  getElectronicDocumentsListAction,
} from "@/app/workspace/[businessId]/configuracion/facturacion-electronica/actions";

// Mock de next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Mock de verificación de contexto y permisos de workspace para acciones de servidor
vi.mock("@/lib/auth/workspace-context", () => ({
  verifyWorkspaceAction: vi.fn().mockResolvedValue({
    success: true,
    context: {
      userId: "usr-mock-dian-admin",
      businessId: "biz-dian-alpha-001",
      role: "owner",
    },
  }),
}));

vi.mock("@/lib/auth/workspace-permission-guard", () => ({
  ensureWorkspacePermission: vi.fn().mockResolvedValue({
    authorized: true,
    userId: "usr-mock-dian-admin",
    businessId: "biz-dian-alpha-001",
    role: "owner",
  }),
}));

describe("[DIAN-001] Configurar facturación electrónica DIAN", () => {
  const businessId = "biz-dian-alpha-001";

  beforeEach(() => {
    memoryDianConfigs.clear();
    memoryElectronicDocuments.clear();
    vi.clearAllMocks();
  });

  describe("Criterio 1: Algoritmo oficial de Dígito de Verificación (DV) DIAN", () => {
    it("debe calcular correctamente el dígito de verificación con ponderación módulo 11", () => {
      // Casos de prueba conocidos de empresas y personas en Colombia
      // NIT 800197268 -> DV = 4
      expect(calculateVerificationDigit("800197268")).toBe("4");
      // NIT 900123456 -> DV = 8
      expect(calculateVerificationDigit("900123456")).toBe("8");
      // NIT con caracteres especiales o puntos
      expect(calculateVerificationDigit("900.123.456")).toBe("8");
      // NIT vacío
      expect(calculateVerificationDigit("")).toBe("0");
    });
  });

  describe("Criterio 2: Configuración de Emisor, Resolución y Conexión con Proveedor", () => {
    it("debe cargar la configuración por defecto si el comercio no ha configurado la DIAN", async () => {
      const config = await getDianBillingConfig(businessId);
      expect(config).toBeDefined();
      expect(config.businessId).toBe(businessId);
      expect(config.isConfigured).toBe(false);
      expect(config.isTestMode).toBe(true);
      expect(config.issuer.nit).toBeDefined();
      expect(config.resolution.prefix).toBe("FE");
      expect(config.providerConfig.provider).toBe("negova_dian");
    });

    it("permite guardar y actualizar los datos del emisor, resolución y credenciales", async () => {
      const result = await saveDianBillingConfig(
        businessId,
        {
          issuer: {
            nit: "901543210",
            dv: "8",
            legalName: "Inversiones Gastronómicas del Norte S.A.S.",
            tradeName: "Restaurante El Fuego",
            email: "facturacion@elfuego.com",
            phone: "3105559988",
            address: "Carrera 43A # 1Sur-100",
            city: "Medellín",
            cityCode: "05001",
            department: "Antioquia",
            departmentCode: "05",
            postalCode: "050021",
            taxRegime: "responsable_iva",
            fiscalResponsibility: "O-13",
          },
          resolution: {
            resolutionNumber: "187640099881",
            prefix: "SETP",
            fromNumber: 1,
            toNumber: 10000,
            currentNumber: 101,
            validFrom: "2026-01-01",
            validTo: "2027-01-01",
            technicalKey: "abcdef0123456789abcdef0123456789",
          },
          providerConfig: {
            provider: "negova_dian",
            environment: "test",
            apiKey: "key_sec_live_9988",
            softwareId: "soft-id-dian-2026",
            softwarePin: "54321",
            testSetId: "test-set-habilitacion-fe",
            isEnabled: true,
            autoSendOnSale: true,
          },
          isTestMode: true,
        },
        "user-admin-1"
      );

      expect(result.success).toBe(true);
      expect(result.config).toBeDefined();
      expect(result.config?.issuer.legalName).toBe("Inversiones Gastronómicas del Norte S.A.S.");
      expect(result.config?.resolution.prefix).toBe("SETP");
      expect(result.config?.resolution.currentNumber).toBe(101);
      expect(result.config?.isConfigured).toBe(true);

      // Verificación de persistencia en consulta subsiguiente
      const stored = await getDianBillingConfig(businessId);
      expect(stored.issuer.nit).toBe("901543210");
      expect(stored.resolution.prefix).toBe("SETP");
    });

    it("rechaza guardar configuraciones inválidas sin NIT o sin resolución", async () => {
      const emptyNit = await saveDianBillingConfig(businessId, {
        issuer: {
          nit: "",
          dv: "0",
          legalName: "Empresa Incompleta",
          tradeName: "Empresa",
          email: "test@mail.com",
          phone: "123",
          address: "Dir",
          city: "Med",
          cityCode: "05001",
          department: "Ant",
          departmentCode: "05",
          postalCode: "05001",
          taxRegime: "no_responsable_iva",
          fiscalResponsibility: "R-99-PN",
        },
      });
      expect(emptyNit.success).toBe(false);
      expect(emptyNit.error).toContain("NIT");

      const invalidRange = await saveDianBillingConfig(businessId, {
        issuer: {
          nit: "900111222",
          dv: "5",
          legalName: "Empresa Rango",
          tradeName: "Empresa",
          email: "test@mail.com",
          phone: "123",
          address: "Dir",
          city: "Med",
          cityCode: "05001",
          department: "Ant",
          departmentCode: "05",
          postalCode: "05001",
          taxRegime: "no_responsable_iva",
          fiscalResponsibility: "R-99-PN",
        },
        resolution: {
          resolutionNumber: "187640001",
          prefix: "FE",
          fromNumber: 500,
          toNumber: 100, // Menor que fromNumber
          currentNumber: 100,
          validFrom: "2026-01-01",
          validTo: "2027-01-01",
          technicalKey: "abc",
        },
      });
      expect(invalidRange.success).toBe(false);
      expect(invalidRange.error).toContain("rango");
    });
  });

  describe("Criterio 3: Envío de factura de prueba a DIAN en modo habilitación", () => {
    it("debe emitir una factura de prueba con CUFE SHA-384 y QR al catálogo de habilitación", async () => {
      const testRes = await sendTestInvoiceToDian(businessId, "user-admin-1");

      expect(testRes.success).toBe(true);
      expect(testRes.invoice).toBeDefined();

      const inv = testRes.invoice!;
      expect(inv.documentType).toBe("invoice");
      expect(inv.status).toBe("accepted");
      expect(inv.cufe).toHaveLength(96); // SHA-384 hex digest es de 96 caracteres
      expect(inv.qrUrl).toContain("catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey=");
      expect(inv.qrUrl).toContain(inv.cufe);
      expect(inv.total).toBe(119000);

      // El consecutivo de la resolución debe haberse incrementado
      const updatedConfig = await getDianBillingConfig(businessId);
      expect(updatedConfig.resolution.currentNumber).toBe(2);
    });
  });

  describe("Criterio 4: Generación de factura electrónica al confirmar una venta", () => {
    it("debe generar el CUFE y almacenar el registro electrónico vinculado a la venta", async () => {
      const saleData = {
        id: "sale-doc-fe-777",
        documentNumber: "FAC-00777",
        customerName: "Juan Pérez",
        customerId: "1020304050",
        customerEmail: "juan.perez@ejemplo.com",
        subtotal: 50000,
        taxTotal: 9500,
        total: 59500,
        items: [{ description: "Almuerzo Ejecutivo", quantity: 2, unitPrice: 25000, total: 50000 }],
      };

      const result = await generateElectronicInvoiceForSale(businessId, saleData, "user-cashier-1");

      expect(result.success).toBe(true);
      expect(result.invoice).toBeDefined();

      const invoice = result.invoice!;
      expect(invoice.saleDocumentId).toBe("sale-doc-fe-777");
      expect(invoice.documentNumber).toBe("FE-1");
      expect(invoice.cufe).toBeDefined();
      expect(invoice.cufe).toHaveLength(96);
      expect(invoice.customerIdentification).toBe("1020304050");
      expect(invoice.total).toBe(59500);

      // Consulta del documento emitido
      const queried = await getElectronicDocumentBySaleId(businessId, "sale-doc-fe-777");
      expect(queried).toBeDefined();
      expect(queried?.cufe).toBe(invoice.cufe);
      expect(queried?.documentNumber).toBe("FE-1");
    });
  });

  describe("Criterio 5: Emisión de Nota Crédito Electrónica (Anulación) hacia DIAN", () => {
    it("debe emitir Nota Crédito con CUDE referenciando el CUFE de la factura original", async () => {
      // 1. Emitir factura previa
      const saleId = "sale-to-cancel-999";
      const invoiceRes = await generateElectronicInvoiceForSale(
        businessId,
        {
          id: saleId,
          customerName: "Cliente a Anular",
          subtotal: 80000,
          taxTotal: 15200,
          total: 95200,
        },
        "user-cashier-1"
      );

      expect(invoiceRes.success).toBe(true);
      const originalCufe = invoiceRes.invoice!.cufe;

      // 2. Anular mediante Nota Crédito
      const ncRes = await generateCreditNoteForSale(
        businessId,
        saleId,
        "Error en digitación de pedido por el cajero",
        "user-supervisor-1"
      );

      expect(ncRes.success).toBe(true);
      expect(ncRes.creditNote).toBeDefined();

      const nc = ncRes.creditNote!;
      expect(nc.documentType).toBe("credit_note");
      expect(nc.documentNumber).toContain("NC-");
      expect(nc.cufe).toHaveLength(96); // CUDE es SHA-384
      expect(nc.cufe).not.toBe(originalCufe); // El CUDE es único y diferente al CUFE
      expect(nc.saleDocumentId).toBe(saleId);
      expect(nc.status).toBe("accepted");
    });
  });

  describe("Criterio 6: Consulta de documentos electrónicos e historial", () => {
    it("permite listar y filtrar documentos electrónicos del comercio", async () => {
      // Crear 2 facturas y 1 nota crédito
      await generateElectronicInvoiceForSale(businessId, {
        id: "sale-hist-1",
        customerName: "Carlos Gómez",
        subtotal: 30000,
        total: 35700,
      });

      await generateElectronicInvoiceForSale(businessId, {
        id: "sale-hist-2",
        customerName: "María López",
        subtotal: 40000,
        total: 47600,
      });

      await generateCreditNoteForSale(businessId, "sale-hist-1", "Devolución");

      const allDocs = await getElectronicDocumentsList(businessId);
      expect(allDocs.documents.length).toBeGreaterThanOrEqual(3);
      expect(allDocs.total).toBeGreaterThanOrEqual(3);

      const onlyInvoices = await getElectronicDocumentsList(businessId, { documentType: "invoice" });
      expect(onlyInvoices.documents.every((d) => d.documentType === "invoice")).toBe(true);

      const onlyCreditNotes = await getElectronicDocumentsList(businessId, { documentType: "credit_note" });
      expect(onlyCreditNotes.documents.every((d) => d.documentType === "credit_note")).toBe(true);

      const searchByName = await getElectronicDocumentsList(businessId, { search: "Carlos" });
      expect(searchByName.documents.length).toBeGreaterThanOrEqual(1);
      expect(searchByName.documents[0].customerName).toContain("Carlos");
    });
  });

  describe("Criterio 7: Server Actions del Workspace", () => {
    it("debe ejecutar las Server Actions con validación de permisos de negocio", async () => {
      // 1. Obtener config
      const getActionRes = await getDianBillingConfigAction(businessId);
      expect(getActionRes.success).toBe(true);
      expect(getActionRes.config).toBeDefined();

      // 2. Guardar config
      const saveActionRes = await saveDianBillingConfigAction(businessId, {
        issuer: {
          nit: "900999888",
          dv: "2",
          legalName: "Servicios Action S.A.S.",
          tradeName: "Action SAS",
          email: "action@negova.com",
          phone: "3000000000",
          address: "Calle 100 # 10-20",
          city: "Bogotá",
          cityCode: "11001",
          department: "Bogotá D.C.",
          departmentCode: "11",
          postalCode: "110111",
          taxRegime: "responsable_iva",
          fiscalResponsibility: "O-13",
        },
      });
      expect(saveActionRes.success).toBe(true);
      expect(saveActionRes.config?.issuer.legalName).toBe("Servicios Action S.A.S.");

      // 3. Enviar prueba
      const testActionRes = await sendTestInvoiceToDianAction(businessId);
      expect(testActionRes.success).toBe(true);
      expect(testActionRes.invoice?.cufe).toBeDefined();

      // 4. Listar documentos
      const listActionRes = await getElectronicDocumentsListAction(businessId);
      expect(listActionRes.success).toBe(true);
      expect(listActionRes.documents.length).toBeGreaterThan(0);
    });
  });

  describe("Criterio 8: Regla de Código Global — Cero Alertas Nativas", () => {
    it("no debe contener window.alert, window.confirm, window.prompt ni Alert.alert en los componentes de facturación", () => {
      const filesToCheck = [
        path.resolve(process.cwd(), "src/app/workspace/[businessId]/configuracion/facturacion-electronica/dian-config-client.tsx"),
        path.resolve(process.cwd(), "src/app/workspace/[businessId]/ventas/[id]/sale-detail-client.tsx"),
        path.resolve(process.cwd(), "src/app/workspace/[businessId]/ventas/sales-list-client.tsx"),
      ];

      const forbiddenPatterns = [
        /\bwindow\.alert\b/,
        /\bwindow\.confirm\b/,
        /\bwindow\.prompt\b/,
        /\bAlert\.alert\b/,
        /\balert\(/,
      ];

      for (const filePath of filesToCheck) {
        if (!fs.existsSync(filePath)) continue;
        const content = fs.readFileSync(filePath, "utf-8");

        for (const pattern of forbiddenPatterns) {
          const match = content.match(pattern);
          expect(
            match,
            `Se encontró alerta nativa '${pattern}' en el archivo ${filePath}`
          ).toBeNull();
        }
      }
    });
  });
});
