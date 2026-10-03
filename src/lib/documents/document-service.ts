/**
 * SERVICIO DE DOCUMENTOS COMERCIALES Y CONFIGURACIÓN VISUAL PARA NEGOCIOS
 * 
 * Regla de Aislamiento Multi-Tenant:
 * Todas las operaciones requieren y validan explícitamente el `businessId`.
 * Un negocio jamás puede consultar ni modificar documentos de otro negocio.
 */

import {
  BusinessDocumentConfig,
  BusinessSaleDocument,
  BusinessDocumentFilterParams,
} from "./types";
import { generateBusinessSalePdf } from "@/lib/pdf/pdf-engine";
import { uploadBusinessDocumentPdfBuffer } from "@/lib/storage/supabase-storage";

const CONFIG_SETTINGS_PREFIX = "business_doc_config:";
const DOCS_SETTINGS_PREFIX = "business_documents:";

const inMemoryConfigs: Map<string, BusinessDocumentConfig> = new Map();
const inMemoryDocs: Map<string, BusinessSaleDocument[]> = new Map();

function mapDbConfigToInterface(dbRow: any): BusinessDocumentConfig {
  return {
    businessId: dbRow.business_id,
    tradeName: dbRow.trade_name,
    legalName: dbRow.legal_name || undefined,
    taxId: dbRow.tax_id || undefined,
    phone: dbRow.phone || undefined,
    email: dbRow.email || undefined,
    address: dbRow.address || undefined,
    city: dbRow.city || undefined,
    logoUrl: dbRow.logo_url || null,
    primaryColor: dbRow.primary_color,
    documentTitleDefault: dbRow.document_title_default,
    headerText: dbRow.header_text || null,
    footerText: dbRow.footer_text || null,
    thankYouNote: dbRow.thank_you_note || null,
    termsAndConditions: dbRow.terms_conditions || null,
    updatedAt: dbRow.updated_at,
  };
}

function mapInterfaceToDbConfig(config: Partial<BusinessDocumentConfig>): any {
  const dbRow: any = {};
  if (config.businessId) dbRow.business_id = config.businessId;
  if (config.tradeName !== undefined) dbRow.trade_name = config.tradeName;
  if (config.legalName !== undefined) dbRow.legal_name = config.legalName || null;
  if (config.taxId !== undefined) dbRow.tax_id = config.taxId || null;
  if (config.phone !== undefined) dbRow.phone = config.phone || null;
  if (config.email !== undefined) dbRow.email = config.email || null;
  if (config.address !== undefined) dbRow.address = config.address || null;
  if (config.city !== undefined) dbRow.city = config.city || null;
  if (config.logoUrl !== undefined) dbRow.logo_url = config.logoUrl || null;
  if (config.primaryColor !== undefined) dbRow.primary_color = config.primaryColor;
  if (config.documentTitleDefault !== undefined) dbRow.document_title_default = config.documentTitleDefault;
  if (config.headerText !== undefined) dbRow.header_text = config.headerText || null;
  if (config.footerText !== undefined) dbRow.footer_text = config.footerText || null;
  if (config.thankYouNote !== undefined) dbRow.thank_you_note = config.thankYouNote || null;
  if (config.termsAndConditions !== undefined) dbRow.terms_conditions = config.termsAndConditions || null;
  dbRow.updated_at = new Date().toISOString();
  return dbRow;
}

async function getSupabaseAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (serviceKey && supabaseUrl) {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    return createAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  const { createClient } = await import("@/lib/supabase/server");
  return await createClient();
}

/**
 * 1. Obtiene la configuración visual del negocio (o genera los valores por defecto)
 */
export async function getBusinessDocumentConfig(
  businessId: string
): Promise<BusinessDocumentConfig> {
  if (inMemoryConfigs.has(businessId)) {
    return inMemoryConfigs.get(businessId)!;
  }

  try {
    const admin = await getSupabaseAdminClient();
    const { data } = await admin
      .from("business_document_configs")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();

    if (data) {
      const config = mapDbConfigToInterface(data);
      inMemoryConfigs.set(businessId, config);
      return config;
    }

    // Si no existe, buscamos los datos básicos del negocio para inicializar
    let biz: any = null;
    try {
      const { getBusinessDetail } = await import("@/lib/businesses/businesses-service");
      const bizRes = await getBusinessDetail(businessId);
      biz = bizRes.business;
    } catch {}

    const defaultConfig: BusinessDocumentConfig = {
      businessId,
      tradeName: biz?.name || "Mi Negocio",
      legalName: biz?.name || undefined,
      taxId: undefined,
      phone: biz?.phone || biz?.owner?.phone || undefined,
      email: biz?.email || biz?.owner?.email || undefined,
      address: biz?.address || undefined,
      city: biz?.city || undefined,
      logoUrl: biz?.logoUrl || null,
      primaryColor: "#ED500A",
      documentTitleDefault: "DOCUMENTO DE VENTA",
      headerText: null,
      footerText: "Gracias por su compra. Conserve este documento.",
      thankYouNote: "¡Agradecemos su preferencia!",
      termsAndConditions: null,
      updatedAt: new Date().toISOString(),
    };

    // Guardar el defaultConfig en la BD automáticamente
    await admin.from("business_document_configs").insert(mapInterfaceToDbConfig(defaultConfig));
    inMemoryConfigs.set(businessId, defaultConfig);
    return defaultConfig;
  } catch (err) {
    const fallbackConfig: BusinessDocumentConfig = {
      businessId,
      tradeName: "Mi Negocio",
      primaryColor: "#ED500A",
      documentTitleDefault: "DOCUMENTO DE VENTA",
      updatedAt: new Date().toISOString(),
    };
    inMemoryConfigs.set(businessId, fallbackConfig);
    return fallbackConfig;
  }
}

/**
 * 2. Actualiza la configuración visual de documentos del negocio
 */
export async function saveBusinessDocumentConfig(
  businessId: string,
  config: Partial<BusinessDocumentConfig>
): Promise<{ success: boolean; config?: BusinessDocumentConfig; error?: string }> {
  try {
    const current = await getBusinessDocumentConfig(businessId);
    const updated: BusinessDocumentConfig = {
      ...current,
      ...config,
      businessId, // Garantizar inmutabilidad del tenant
      updatedAt: new Date().toISOString(),
    };

    inMemoryConfigs.set(businessId, updated);

    try {
      const admin = await getSupabaseAdminClient();
      const dbRow = mapInterfaceToDbConfig(updated);
      await admin.from("business_document_configs").upsert(dbRow, { onConflict: "business_id" });
    } catch {}

    return { success: true, config: updated };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al guardar configuración" };
  }
}

/**
 * 7. Elimina un documento comercial (Anulación lógica si se desea, aquí física por demo)
 */
export async function deleteBusinessDocument(businessId: string, documentId: string) {
  try {
    const listRes = await getBusinessDocumentsList({ businessId, pageSize: 1000 });
    const doc = listRes.documents.find((d) => d.id === documentId);
    if (!doc || doc.businessId !== businessId) return { success: false, error: "No autorizado." };
    
    let docs = inMemoryDocs.get(businessId) || [];
    docs = docs.filter(d => d.id !== documentId);
    inMemoryDocs.set(businessId, docs);
    
    const admin = await getSupabaseAdminClient();
    await admin.from("platform_settings").upsert({
      key: `${DOCS_SETTINGS_PREFIX}${businessId}`,
      value: docs,
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

/**
 * 8. Migración (JSON a SQL)
 */
export async function migrateDocumentConfigsToSql() {
  try {
    const admin = await getSupabaseAdminClient();
    // 1. Obtener todas las configs del JSON
    const { data: legacyConfigs, error: errGet } = await admin
      .from("platform_settings")
      .select("value, key")
      .ilike("key", "business_doc_config:%");
      
    if (errGet || !legacyConfigs) {
      return { success: false, error: "No se pudieron obtener configuraciones legacy." };
    }
    
    for (const record of legacyConfigs) {
      if (record.value && record.value.businessId) {
        const config = record.value as BusinessDocumentConfig;
        const dbRow = mapInterfaceToDbConfig(config);
        
        // 2. Insertar/Actualizar en la tabla SQL
        await admin
          .from("business_document_configs")
          .upsert(dbRow, { onConflict: "business_id" });
          
        // 3. Eliminar el registro antiguo (Opcional, lo dejaremos para asegurar)
        await admin
          .from("platform_settings")
          .delete()
          .eq("key", record.key);
      }
    }
    return { success: true, count: legacyConfigs.length };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

/**
 * 3. Obtiene los documentos comerciales pertenecientes a un negocio
 */
export async function getBusinessDocumentsList(
  params: BusinessDocumentFilterParams
): Promise<{
  documents: BusinessSaleDocument[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const { businessId, page = 1, pageSize = 10, search, status, type } = params;
  try {
    let docs: BusinessSaleDocument[] = inMemoryDocs.get(businessId) || [];

    if (docs.length === 0) {
      try {
        const admin = await getSupabaseAdminClient();
        const { data } = await admin
          .from("platform_settings")
          .select("value")
          .eq("key", `${DOCS_SETTINGS_PREFIX}${businessId}`)
          .maybeSingle();

        if (data && Array.isArray(data.value)) {
          docs = data.value as BusinessSaleDocument[];
          inMemoryDocs.set(businessId, docs);
        }
      } catch {}
    }

    if (status && status !== "all") {
      docs = docs.filter((d) => d.status === status);
    }

    if (type && type !== "all") {
      docs = docs.filter((d) => d.documentType === type);
    }

    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      docs = docs.filter(
        (d) =>
          d.documentNumber.toLowerCase().includes(q) ||
          d.customerName.toLowerCase().includes(q) ||
          (d.customerId && d.customerId.toLowerCase().includes(q))
      );
    }

    docs.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());

    const totalCount = docs.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const paginated = docs.slice((page - 1) * pageSize, page * pageSize);

    return {
      documents: paginated,
      totalCount,
      page,
      pageSize,
      totalPages,
    };
  } catch (err) {
    console.error(`Error al listar documentos del negocio ${businessId}:`, err);
    return { documents: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 1 };
  }
}

/**
 * 4. Crea un nuevo documento comercial para el negocio
 */
export async function createBusinessSaleDocument(
  businessId: string,
  docData: {
    customerName: string;
    customerId?: string | null;
    customerPhone?: string | null;
    customerEmail?: string | null;
    customerAddress?: string | null;
    documentType?: BusinessSaleDocument["documentType"];
    items: BusinessSaleDocument["items"];
    paymentMethod?: BusinessSaleDocument["paymentMethod"];
    status?: BusinessSaleDocument["status"];
    notes?: string | null;
  }
): Promise<{ success: boolean; document?: BusinessSaleDocument; error?: string }> {
  try {
    const listRes = await getBusinessDocumentsList({ businessId, pageSize: 1000 });
    const count = listRes.totalCount + 1;
    const docNumber = `DOC-2026-${String(count).padStart(4, "0")}`;

    const subtotal = docData.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const discountTotal = docData.items.reduce((sum, item) => sum + (item.discount || 0), 0);
    const total = subtotal - discountTotal;

    const newDoc: BusinessSaleDocument = {
      id: `doc-${businessId.slice(0, 6)}-${Date.now()}`,
      businessId,
      documentNumber: docNumber,
      documentType: docData.documentType || "sale",
      customerName: docData.customerName.trim() || "Cliente General",
      customerId: docData.customerId || null,
      customerPhone: docData.customerPhone || null,
      customerEmail: docData.customerEmail || null,
      customerAddress: docData.customerAddress || null,
      items: docData.items,
      subtotal,
      discountTotal,
      taxTotal: 0,
      total,
      currency: "COP",
      paymentMethod: docData.paymentMethod || "cash",
      status: docData.status || "completed",
      issuedAt: new Date().toISOString(),
      notes: docData.notes || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const allDocs = [...listRes.documents, newDoc];
    inMemoryDocs.set(businessId, allDocs);

    try {
      const admin = await getSupabaseAdminClient();
      await admin.from("platform_settings").upsert(
        {
          key: `${DOCS_SETTINGS_PREFIX}${businessId}`,
          value: allDocs,
          description: `Documentos comerciales emitidos por el negocio ${businessId}`,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );
    } catch {}

    return { success: true, document: newDoc };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al crear documento comercial" };
  }
}

/**
 * 5. Genera el PDF del documento comercial de un negocio respetando su configuración de marca
 */
export async function generateBusinessDocumentPdf(
  businessId: string,
  documentId: string
): Promise<{
  success: boolean;
  base64?: string;
  filename?: string;
  pdfUrl?: string | null;
  error?: string;
}> {
  try {
    const listRes = await getBusinessDocumentsList({ businessId, pageSize: 1000 });
    const doc = listRes.documents.find((d) => d.id === documentId);

    // Validación estricta de aislamiento multi-tenant
    if (!doc || doc.businessId !== businessId) {
      return { success: false, error: "Documento no encontrado o no pertenece a este negocio." };
    }

    const config = await getBusinessDocumentConfig(businessId);

    let logoBase64: string | undefined = undefined;
    if (config.logoUrl) {
      try {
        const imgRes = await fetch(config.logoUrl);
        if (imgRes.ok) {
          const arrayBuffer = await imgRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const mimeType = imgRes.headers.get("content-type") || "image/png";
          logoBase64 = `data:${mimeType};base64,${buffer.toString("base64")}`;
        }
      } catch (err) {
        console.warn("No se pudo cargar el logo del negocio para el PDF:", err);
      }
    }

    const pdfResult = generateBusinessSalePdf({
      documentNumber: doc.documentNumber,
      documentTitle: config.documentTitleDefault || "DOCUMENTO DE VENTA",
      businessId,
      tradeName: config.tradeName,
      legalName: config.legalName,
      taxId: config.taxId,
      phone: config.phone,
      email: config.email,
      address: config.address,
      city: config.city,
      primaryColor: config.primaryColor || "#ED500A",
      logoBase64,
      customerName: doc.customerName,
      customerId: doc.customerId || undefined,
      customerPhone: doc.customerPhone || undefined,
      customerEmail: doc.customerEmail || undefined,
      customerAddress: doc.customerAddress || undefined,
      issuedAt: doc.issuedAt,
      items: doc.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount,
        total: i.total,
      })),
      subtotal: doc.subtotal,
      discountTotal: doc.discountTotal,
      taxTotal: doc.taxTotal,
      total: doc.total,
      currency: "COP",
      notes: doc.notes,
      thankYouNote: config.thankYouNote,
      footerText: config.footerText,
    });

    // Subir a Storage en la carpeta aislada del negocio
    try {
      const admin = await getSupabaseAdminClient();
      const storageRes = await uploadBusinessDocumentPdfBuffer(
        admin,
        businessId,
        doc.documentNumber,
        pdfResult.buffer
      );
      if (storageRes.url) {
        doc.pdfUrl = storageRes.url;
        doc.pdfStoragePath = storageRes.storagePath;
      }
    } catch {}

    return {
      success: true,
      base64: pdfResult.base64,
      filename: pdfResult.filename,
      pdfUrl: doc.pdfUrl || null,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al renderizar PDF comercial" };
  }
}
