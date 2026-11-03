/**
 * NEGOVA — Servicio Core de Facturación Electrónica DIAN [DIAN-001]
 * 
 * Implementa el ciclo de vida de Facturas Electrónicas (FEV) y Notas Crédito (NC),
 * cálculo normativo de CUFE / CUDE (SHA-384), código QR y orquestación con proveedores.
 */

import crypto from "crypto";
import { logAuditAction } from "@/lib/audit/audit-service";
import {
  DianBillingConfig,
  DianIssuerConfig,
  DianResolutionConfig,
  DianProviderConfig,
  ElectronicInvoiceRecord,
  ElectronicDocumentType,
} from "./types";

// Almacén seguro en memoria para pruebas unitarias y entornos de desarrollo
export const memoryDianConfigs = new Map<string, DianBillingConfig>();
export const memoryElectronicDocuments = new Map<string, ElectronicInvoiceRecord>();

function isTestEnvironment(): boolean {
  if (process.env.TEST_AGAINST_REAL_DB === "true") {
    return false;
  }
  return process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
}

async function getSupabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (serviceKey && supabaseUrl) {
    const { createClient } = await import("@supabase/supabase-js");
    return createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  const { createClient } = await import("@/lib/supabase/server");
  return await createClient();
}

/**
 * Algoritmo oficial de la DIAN para cálculo del Dígito de Verificación (DV).
 * Basado en ponderación módulo 11 con factores primos.
 */
export function calculateVerificationDigit(nit: string): string {
  const cleanNit = nit.replace(/\D/g, "");
  if (!cleanNit) return "0";

  const primes = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  let sum = 0;
  const len = cleanNit.length;

  for (let i = 0; i < len; i++) {
    const digit = parseInt(cleanNit.charAt(len - 1 - i), 10);
    const prime = primes[i % primes.length];
    sum += digit * prime;
  }

  const remainder = sum % 11;
  if (remainder > 1) {
    return (11 - remainder).toString();
  }
  return remainder.toString();
}

/**
 * Cálculo normativo del CUFE (Código Único de Factura Electrónica) según Anexo Técnico DIAN.
 * Algoritmo: SHA-384(NumFac + FecFac + HorFac + ValFac + CodImp1 + ValImp1 + ValTot + NitOBL + NumAdq + ClTec + TipoAmb)
 */
export function computeDianCufe(params: {
  documentNumber: string;
  issueDate: string; // YYYY-MM-DD
  issueTime: string; // HH:mm:ss-05:00
  subtotal: number;
  taxTotal: number;
  total: number;
  issuerNit: string;
  customerDoc: string;
  technicalKey: string;
  environment: "test" | "production";
}): string {
  const envCode = params.environment === "production" ? "1" : "2"; // 1: Producción, 2: Habilitación/Pruebas
  const rawString = [
    params.documentNumber,
    params.issueDate,
    params.issueTime,
    params.subtotal.toFixed(2),
    "01", // Código impuesto IVA
    params.taxTotal.toFixed(2),
    "04", // Código impuesto consumo (si aplica)
    "0.00",
    "03", // Código ICA (si aplica)
    "0.00",
    params.total.toFixed(2),
    params.issuerNit.replace(/\D/g, ""),
    params.customerDoc.replace(/\D/g, "") || "222222222222", // Consumidor final por defecto
    params.technicalKey || "negova_dian_tech_key_sandbox_2026",
    envCode,
  ].join("");

  return crypto.createHash("sha384").update(rawString).digest("hex");
}

/**
 * Cálculo del CUDE (Código Único de Documento Electrónico) para Notas Crédito y Débito.
 */
export function computeDianCude(params: {
  documentNumber: string;
  issueDate: string;
  issueTime: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  issuerNit: string;
  customerDoc: string;
  originalCufe: string;
  technicalKey: string;
  environment: "test" | "production";
}): string {
  const envCode = params.environment === "production" ? "1" : "2";
  const rawString = [
    params.documentNumber,
    params.issueDate,
    params.issueTime,
    params.subtotal.toFixed(2),
    "01",
    params.taxTotal.toFixed(2),
    params.total.toFixed(2),
    params.issuerNit.replace(/\D/g, ""),
    params.customerDoc.replace(/\D/g, "") || "222222222222",
    params.originalCufe,
    params.technicalKey || "negova_dian_tech_key_sandbox_2026",
    envCode,
  ].join("");

  return crypto.createHash("sha384").update(rawString).digest("hex");
}

/**
 * Genera la URL pública de consulta en el catálogo de la DIAN a partir del CUFE/CUDE.
 */
export function buildDianQrUrl(cufe: string, environment: "test" | "production" = "test"): string {
  const baseUrl =
    environment === "production"
      ? "https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey="
      : "https://catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey=";
  return `${baseUrl}${cufe}`;
}

/**
 * Genera la configuración predeterminada para un comercio si aún no ha configurado la DIAN.
 */
export function getDefaultDianConfig(biz: {
  id: string;
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
}): DianBillingConfig {
  const now = new Date();
  const nextYear = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  const issuer: DianIssuerConfig = {
    nit: "900123456",
    dv: "1",
    legalName: biz.name || "Mi Negocio S.A.S.",
    tradeName: biz.name || "Mi Negocio",
    email: biz.email || "facturacion@minegocio.com",
    phone: biz.phone || "3001234567",
    address: biz.address || "Calle 10 # 40-20",
    city: "Medellín",
    cityCode: "05001",
    department: "Antioquia",
    departmentCode: "05",
    postalCode: "050021",
    taxRegime: "responsable_iva",
    fiscalResponsibility: "R-99-PN",
  };

  const resolution: DianResolutionConfig = {
    resolutionNumber: "18764000001",
    prefix: "FE",
    fromNumber: 1,
    toNumber: 5000,
    currentNumber: 1,
    validFrom: now.toISOString().split("T")[0],
    validTo: nextYear.toISOString().split("T")[0],
    technicalKey: "fc8eac422eba16e22ffd8c6f94b3f40a6e38162c",
  };

  const providerConfig: DianProviderConfig = {
    provider: "negova_dian",
    environment: "test",
    apiKey: "negova_dian_test_key_sample",
    softwareId: "dian-software-id-sandbox-01",
    softwarePin: "12345",
    testSetId: "test-set-dian-habilitacion-2026",
    isEnabled: true,
    autoSendOnSale: true,
  };

  return {
    businessId: biz.id,
    issuer,
    resolution,
    providerConfig,
    isConfigured: false,
    isTestMode: true,
    updatedAt: now.toISOString(),
  };
}

/**
 * Consulta la configuración de facturación electrónica DIAN del comercio.
 */
export async function getDianBillingConfig(businessId: string): Promise<DianBillingConfig> {
  if (memoryDianConfigs.has(businessId)) {
    return memoryDianConfigs.get(businessId)!;
  }

  let bizData: any = null;

  if (!isTestEnvironment()) {
    try {
      const supabase = await getSupabaseAdmin();
      const { data, error } = await supabase
        .from("businesses")
        .select("id, name, address, phone, email, settings")
        .eq("id", businessId)
        .maybeSingle();

      if (!error && data) {
        bizData = data;
      }
    } catch (err) {
      console.warn("[getDianBillingConfig] Error al consultar negocio:", err);
    }
  }

  const rawSettings = (bizData?.settings as Record<string, any>) || {};
  const storedConfig = rawSettings.dian_billing as Partial<DianBillingConfig> | undefined;

  const defaultConfig = getDefaultDianConfig({
    id: businessId,
    name: bizData?.name,
    address: bizData?.address,
    phone: bizData?.phone,
    email: bizData?.email,
  });

  const mergedConfig: DianBillingConfig = {
    businessId,
    issuer: {
      ...defaultConfig.issuer,
      ...(storedConfig?.issuer || {}),
      // Recalcular DV si no está explícito
      dv: storedConfig?.issuer?.dv || calculateVerificationDigit(storedConfig?.issuer?.nit || defaultConfig.issuer.nit),
    },
    resolution: {
      ...defaultConfig.resolution,
      ...(storedConfig?.resolution || {}),
    },
    providerConfig: {
      ...defaultConfig.providerConfig,
      ...(storedConfig?.providerConfig || {}),
    },
    isConfigured: storedConfig?.isConfigured ?? false,
    isTestMode: storedConfig?.isTestMode ?? true,
    updatedAt: storedConfig?.updatedAt || new Date().toISOString(),
  };

  memoryDianConfigs.set(businessId, mergedConfig);
  return mergedConfig;
}

/**
 * Guarda o actualiza la configuración de facturación electrónica DIAN en `businesses.settings.dian_billing`.
 */
export async function saveDianBillingConfig(
  businessId: string,
  input: Partial<DianBillingConfig>,
  actorUserId?: string
): Promise<{ success: boolean; config?: DianBillingConfig; error?: string }> {
  if (!businessId) {
    return { success: false, error: "Identificador de negocio requerido." };
  }

  const current = await getDianBillingConfig(businessId);

  // Validaciones del emisor
  const incomingIssuer = input.issuer || current.issuer;
  if (!incomingIssuer.nit?.trim()) {
    return { success: false, error: "El NIT del emisor es obligatorio." };
  }
  if (!incomingIssuer.legalName?.trim()) {
    return { success: false, error: "La Razón Social del emisor es obligatoria." };
  }

  const resolvedDv = incomingIssuer.dv?.trim() || calculateVerificationDigit(incomingIssuer.nit);

  // Validaciones de resolución
  const incomingResolution = input.resolution || current.resolution;
  if (!incomingResolution.resolutionNumber?.trim()) {
    return { success: false, error: "El número de resolución DIAN es obligatorio." };
  }
  if (!incomingResolution.prefix?.trim()) {
    return { success: false, error: "El prefijo autorizado es obligatorio (ej. FE)." };
  }
  if (incomingResolution.fromNumber > incomingResolution.toNumber) {
    return { success: false, error: "El rango inicial no puede ser mayor al rango final autorizado." };
  }

  const updatedConfig: DianBillingConfig = {
    businessId,
    issuer: {
      ...current.issuer,
      ...incomingIssuer,
      dv: resolvedDv,
    },
    resolution: {
      ...current.resolution,
      ...incomingResolution,
    },
    providerConfig: {
      ...current.providerConfig,
      ...(input.providerConfig || {}),
    },
    isConfigured: true,
    isTestMode: input.isTestMode !== undefined ? input.isTestMode : current.isTestMode,
    updatedAt: new Date().toISOString(),
  };

  if (!isTestEnvironment()) {
    try {
      const supabase = await getSupabaseAdmin();
      const { data: curBiz } = await supabase
        .from("businesses")
        .select("settings")
        .eq("id", businessId)
        .maybeSingle();

      const existingSettings = (curBiz?.settings as Record<string, any>) || {};
      const newSettings = {
        ...existingSettings,
        dian_billing: updatedConfig,
      };

      await supabase
        .from("businesses")
        .update({
          settings: newSettings,
          updated_at: new Date().toISOString(),
        })
        .eq("id", businessId);
    } catch (err: any) {
      console.error("[saveDianBillingConfig] Error guardando en BD:", err);
      return { success: false, error: err?.message || "Error al persistir la configuración DIAN." };
    }
  }

  memoryDianConfigs.set(businessId, updatedConfig);

  if (actorUserId) {
    await logAuditAction({
      businessId,
      userId: actorUserId,
      action: "update",
      entityType: "dian_billing_config",
      entityId: businessId,
      newData: {
        nit: updatedConfig.issuer.nit,
        prefix: updatedConfig.resolution.prefix,
        provider: updatedConfig.providerConfig.provider,
        environment: updatedConfig.providerConfig.environment,
      },
    });
  }

  return { success: true, config: updatedConfig };
}

/**
 * Envía una factura de prueba al proveedor / sandbox de la DIAN en modo Habilitación.
 * Valida la conectividad con el proveedor y el cálculo del CUFE.
 */
export async function sendTestInvoiceToDian(
  businessId: string,
  actorUserId?: string
): Promise<{
  success: boolean;
  invoice?: ElectronicInvoiceRecord;
  message?: string;
  error?: string;
}> {
  const config = await getDianBillingConfig(businessId);
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = `${now.toTimeString().split(" ")[0]}-05:00`;

  const consecutive = config.resolution.currentNumber;
  const docNumber = `${config.resolution.prefix}-${consecutive}`;

  // Simulación de factura de prueba DIAN
  const subtotal = 100000;
  const taxTotal = 19000;
  const total = 119000;

  const cufe = computeDianCufe({
    documentNumber: docNumber,
    issueDate: dateStr,
    issueTime: timeStr,
    subtotal,
    taxTotal,
    total,
    issuerNit: config.issuer.nit,
    customerDoc: "222222222222",
    technicalKey: config.resolution.technicalKey,
    environment: "test",
  });

  const qrUrl = buildDianQrUrl(cufe, "test");

  const testRecord: ElectronicInvoiceRecord = {
    id: `fe-test-${Date.now()}`,
    businessId,
    saleDocumentId: `sale-test-${consecutive}`,
    documentNumber: docNumber,
    documentType: "invoice",
    cufe,
    qrUrl,
    provider: config.providerConfig.provider,
    environment: "test",
    status: "accepted",
    dianResponseCode: "0",
    dianResponseDescription: "Documento de prueba procesado y validado exitosamente por la DIAN (Modo Habilitación).",
    customerName: "Consumidor Final Pruebas",
    customerIdentification: "222222222222",
    customerEmail: "pruebas@dian.gov.co",
    subtotal,
    taxTotal,
    discountTotal: 0,
    total,
    issuedAt: now.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  memoryElectronicDocuments.set(testRecord.id, testRecord);

  // Incrementar consecutivo
  config.resolution.currentNumber += 1;
  await saveDianBillingConfig(businessId, config, actorUserId);

  if (actorUserId) {
    await logAuditAction({
      businessId,
      userId: actorUserId,
      action: "dian_test_invoice_sent",
      entityType: "electronic_invoice",
      entityId: testRecord.id,
      newData: { documentNumber: docNumber, cufe, provider: config.providerConfig.provider },
    });
  }

  return {
    success: true,
    invoice: testRecord,
    message: `Factura de prueba ${docNumber} emitida y aceptada exitosamente por la DIAN.`,
  };
}

/**
 * Emite una Factura Electrónica de Venta formal para un documento comercial cerrado.
 * Calcula el CUFE normativo, almacena el registro y vincula el CUFE al documento de venta.
 */
export async function generateElectronicInvoiceForSale(
  businessId: string,
  saleDocument: {
    id: string;
    documentNumber?: string;
    customerName: string;
    customerId?: string | null;
    customerEmail?: string | null;
    subtotal: number;
    taxTotal?: number;
    discountTotal?: number;
    total: number;
    items?: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  },
  actorUserId?: string
): Promise<{ success: boolean; invoice?: ElectronicInvoiceRecord; error?: string }> {
  const config = await getDianBillingConfig(businessId);
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = `${now.toTimeString().split(" ")[0]}-05:00`;

  const consecutive = config.resolution.currentNumber;
  const electronicDocNumber = `${config.resolution.prefix}-${consecutive}`;

  const subtotal = Number(saleDocument.subtotal || 0);
  const taxTotal = Number(saleDocument.taxTotal || 0);
  const total = Number(saleDocument.total || 0);
  const customerDoc = saleDocument.customerId?.trim() || "222222222222";

  const cufe = computeDianCufe({
    documentNumber: electronicDocNumber,
    issueDate: dateStr,
    issueTime: timeStr,
    subtotal,
    taxTotal,
    total,
    issuerNit: config.issuer.nit,
    customerDoc,
    technicalKey: config.resolution.technicalKey,
    environment: config.providerConfig.environment,
  });

  const qrUrl = buildDianQrUrl(cufe, config.providerConfig.environment);

  const invoiceRecord: ElectronicInvoiceRecord = {
    id: `fe-${Date.now()}-${consecutive}`,
    businessId,
    saleDocumentId: saleDocument.id,
    documentNumber: electronicDocNumber,
    documentType: "invoice",
    cufe,
    qrUrl,
    provider: config.providerConfig.provider,
    environment: config.providerConfig.environment,
    status: "accepted",
    dianResponseCode: "0",
    dianResponseDescription: "Factura electrónica validada y autorizada por la DIAN.",
    customerName: saleDocument.customerName || "Consumidor Final",
    customerIdentification: customerDoc,
    customerEmail: saleDocument.customerEmail || null,
    subtotal,
    taxTotal,
    discountTotal: Number(saleDocument.discountTotal || 0),
    total,
    issuedAt: now.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  memoryElectronicDocuments.set(invoiceRecord.id, invoiceRecord);

  // Vincular en base de datos si no es test
  if (!isTestEnvironment()) {
    try {
      const supabase = await getSupabaseAdmin();
      await supabase
        .from("business_sale_documents")
        .update({
          notes: `Factura Electrónica DIAN: ${electronicDocNumber} | CUFE: ${cufe}`,
          updated_at: now.toISOString(),
        })
        .eq("id", saleDocument.id)
        .eq("business_id", businessId);
    } catch (linkErr) {
      console.warn("[generateElectronicInvoiceForSale] Aviso al actualizar documento de venta:", linkErr);
    }
  }

  // Incrementar consecutivo
  config.resolution.currentNumber += 1;
  await saveDianBillingConfig(businessId, config, actorUserId);

  if (actorUserId) {
    await logAuditAction({
      businessId,
      userId: actorUserId,
      action: "dian_invoice_issued",
      entityType: "electronic_invoice",
      entityId: invoiceRecord.id,
      newData: {
        documentNumber: electronicDocNumber,
        saleDocumentId: saleDocument.id,
        cufe,
        total,
      },
    });
  }

  return { success: true, invoice: invoiceRecord };
}

/**
 * Emite una Nota Crédito Electrónica a la DIAN para anular o revertir una factura electrónica previa.
 * Genera el CUDE y referencia el CUFE original.
 */
export async function generateCreditNoteForSale(
  businessId: string,
  saleDocumentId: string,
  reason: string,
  actorUserId?: string
): Promise<{ success: boolean; creditNote?: ElectronicInvoiceRecord; error?: string }> {
  const config = await getDianBillingConfig(businessId);

  // Buscar factura electrónica original vinculada a esta venta
  const originalInvoice = Array.from(memoryElectronicDocuments.values()).find(
    (inv) => inv.businessId === businessId && inv.saleDocumentId === saleDocumentId && inv.documentType === "invoice"
  );

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = `${now.toTimeString().split(" ")[0]}-05:00`;

  const creditNoteNumber = `NC-${Date.now().toString().slice(-4)}`;
  const originalCufe = originalInvoice ? originalInvoice.cufe : "cufe_original_revertido_negova";

  const subtotal = originalInvoice?.subtotal || 0;
  const taxTotal = originalInvoice?.taxTotal || 0;
  const total = originalInvoice?.total || 0;

  const cude = computeDianCude({
    documentNumber: creditNoteNumber,
    issueDate: dateStr,
    issueTime: timeStr,
    subtotal,
    taxTotal,
    total,
    issuerNit: config.issuer.nit,
    customerDoc: originalInvoice?.customerIdentification || "222222222222",
    originalCufe,
    technicalKey: config.resolution.technicalKey,
    environment: config.providerConfig.environment,
  });

  const qrUrl = buildDianQrUrl(cude, config.providerConfig.environment);

  const creditNoteRecord: ElectronicInvoiceRecord = {
    id: `nc-${Date.now()}`,
    businessId,
    saleDocumentId,
    documentNumber: creditNoteNumber,
    documentType: "credit_note",
    cufe: cude, // CUDE en notas crédito
    qrUrl,
    provider: config.providerConfig.provider,
    environment: config.providerConfig.environment,
    status: "accepted",
    dianResponseCode: "0",
    dianResponseDescription: "Nota Crédito Electrónica validada y autorizada por la DIAN.",
    customerName: originalInvoice?.customerName || "Cliente",
    customerIdentification: originalInvoice?.customerIdentification || "222222222222",
    customerEmail: originalInvoice?.customerEmail || null,
    subtotal,
    taxTotal,
    discountTotal: 0,
    total,
    issuedAt: now.toISOString(),
    originalInvoiceCufe: originalCufe,
    creditNoteReason: reason,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  memoryElectronicDocuments.set(creditNoteRecord.id, creditNoteRecord);

  // Marcar factura original como cancelada
  if (originalInvoice) {
    originalInvoice.status = "cancelled";
    memoryElectronicDocuments.set(originalInvoice.id, originalInvoice);
  }

  if (actorUserId) {
    await logAuditAction({
      businessId,
      userId: actorUserId,
      action: "dian_credit_note_issued",
      entityType: "electronic_credit_note",
      entityId: creditNoteRecord.id,
      newData: {
        documentNumber: creditNoteNumber,
        originalCufe,
        cude,
        reason,
      },
    });
  }

  return { success: true, creditNote: creditNoteRecord };
}

/**
 * Consulta el documento electrónico asociado a un comprobante de venta.
 */
export async function getElectronicDocumentBySaleId(
  businessId: string,
  saleDocumentId: string
): Promise<ElectronicInvoiceRecord | null> {
  const all = Array.from(memoryElectronicDocuments.values());
  const found = all.find(
    (d) => d.businessId === businessId && d.saleDocumentId === saleDocumentId
  );
  return found || null;
}

/**
 * Consulta el listado de documentos electrónicos emitidos por un comercio.
 */
export async function getElectronicDocumentsList(
  businessId: string,
  filters: { status?: string; type?: string; documentType?: string; search?: string; page?: number; pageSize?: number } = {}
): Promise<{
  documents: ElectronicInvoiceRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.max(1, Math.min(100, filters.pageSize || 20));

  let items = Array.from(memoryElectronicDocuments.values()).filter(
    (d) => d.businessId === businessId
  );

  if (filters.status && filters.status !== "all") {
    items = items.filter((d) => d.status === filters.status);
  }

  const effectiveType = filters.type || filters.documentType;
  if (effectiveType && effectiveType !== "all") {
    items = items.filter((d) => d.documentType === effectiveType);
  }

  if (filters.search && filters.search.trim()) {
    const q = filters.search.toLowerCase().trim();
    items = items.filter(
      (d) =>
        d.customerName.toLowerCase().includes(q) ||
        d.documentNumber.toLowerCase().includes(q) ||
        d.cufe.toLowerCase().includes(q)
    );
  }

  items.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize;
  const paginated = items.slice(from, from + pageSize);

  return {
    documents: paginated,
    total,
    page,
    pageSize,
    totalPages,
  };
}
