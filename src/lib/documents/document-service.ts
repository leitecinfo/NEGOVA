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
import { logAuditAction } from "@/lib/audit/audit-service";

function mapDbConfigToInterface(dbRow: any): BusinessDocumentConfig {
  return {
    businessId: dbRow.business_id,
    tradeName: dbRow.trade_name,
    legalName: dbRow.legal_name || undefined,
    taxId: dbRow.tax_id || undefined,
    phone: dbRow.phone || undefined,
    whatsapp: dbRow.whatsapp || undefined,
    email: dbRow.email || undefined,
    address: dbRow.address || undefined,
    city: dbRow.city || undefined,
    department: dbRow.department || undefined,
    postalCode: dbRow.postal_code || undefined,
    logoUrl: dbRow.logo_url || null,
    primaryColor: dbRow.primary_color || "#ED500A",
    documentTitleDefault: dbRow.document_title_default || "COMPROBANTE DE VENTA",
    headerText: dbRow.header_text || null,
    footerText: dbRow.footer_text || null,
    thankYouNote: dbRow.thank_you_note || null,
    documentObservations: dbRow.document_observations || null,
    termsAndConditions: dbRow.terms_conditions || null,
    termsConditions: dbRow.terms_conditions || null,
    returnPolicy: dbRow.return_policy || null,
    warrantyPolicy: dbRow.warranty_policy || null,
    updatedAt: dbRow.updated_at,
  } as any;
}

function mapInterfaceToDbConfig(config: Partial<BusinessDocumentConfig> & { termsConditions?: string | null }): any {
  const dbRow: any = {};
  if (config.businessId) dbRow.business_id = config.businessId;
  if (config.tradeName !== undefined) dbRow.trade_name = config.tradeName;
  if (config.legalName !== undefined) dbRow.legal_name = config.legalName || null;
  if (config.taxId !== undefined) dbRow.tax_id = config.taxId || null;
  if (config.phone !== undefined) dbRow.phone = config.phone || null;
  if (config.whatsapp !== undefined) dbRow.whatsapp = config.whatsapp || null;
  if (config.email !== undefined) dbRow.email = config.email || null;
  if (config.address !== undefined) dbRow.address = config.address || null;
  if (config.city !== undefined) dbRow.city = config.city || null;
  if (config.department !== undefined) dbRow.department = config.department || null;
  if (config.postalCode !== undefined) dbRow.postal_code = config.postalCode || null;
  if (config.logoUrl !== undefined) dbRow.logo_url = config.logoUrl || null;
  if (config.primaryColor !== undefined) dbRow.primary_color = config.primaryColor;
  if (config.documentTitleDefault !== undefined) dbRow.document_title_default = config.documentTitleDefault;
  if (config.headerText !== undefined) dbRow.header_text = config.headerText || null;
  if (config.footerText !== undefined) dbRow.footer_text = config.footerText || null;
  if (config.thankYouNote !== undefined) dbRow.thank_you_note = config.thankYouNote || null;
  if (config.documentObservations !== undefined) dbRow.document_observations = config.documentObservations || null;
  if (config.returnPolicy !== undefined) dbRow.return_policy = config.returnPolicy || null;
  if (config.warrantyPolicy !== undefined) dbRow.warranty_policy = config.warrantyPolicy || null;
  
  const terms = config.termsAndConditions !== undefined ? config.termsAndConditions : config.termsConditions;
  if (terms !== undefined) dbRow.terms_conditions = terms || null;
  
  dbRow.updated_at = new Date().toISOString();
  return dbRow;
}

function mapDbDocToInterface(row: any): BusinessSaleDocument {
  return {
    id: row.id,
    businessId: row.business_id,
    documentNumber: row.document_number,
    documentType: row.document_type,
    customerName: row.customer_name,
    customerId: row.customer_id || null,
    customerPhone: row.customer_phone || null,
    customerEmail: row.customer_email || null,
    customerAddress: row.customer_address || null,
    items: Array.isArray(row.items) ? row.items : [],
    subtotal: Number(row.subtotal || 0),
    discountTotal: Number(row.discount_total || 0),
    taxTotal: Number(row.tax_total || 0),
    total: Number(row.total || 0),
    currency: (row.currency as "COP") || "COP",
    paymentMethod: row.payment_method || "cash",
    status: row.status || "completed",
    issuedAt: row.issued_at,
    dueDate: row.due_date || null,
    notes: row.notes || null,
    pdfUrl: row.pdf_url || null,
    pdfStoragePath: row.pdf_storage_path || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInterfaceToDbDoc(doc: BusinessSaleDocument) {
  return {
    id: doc.id,
    business_id: doc.businessId,
    document_number: doc.documentNumber,
    document_type: doc.documentType,
    customer_name: doc.customerName,
    customer_id: doc.customerId || null,
    customer_phone: doc.customerPhone || null,
    customer_email: doc.customerEmail || null,
    customer_address: doc.customerAddress || null,
    items: doc.items,
    subtotal: doc.subtotal,
    discount_total: doc.discountTotal,
    tax_total: doc.taxTotal,
    total: doc.total,
    currency: doc.currency,
    payment_method: doc.paymentMethod,
    status: doc.status,
    issued_at: doc.issuedAt,
    notes: doc.notes || null,
    pdf_url: doc.pdfUrl || null,
    pdf_storage_path: doc.pdfStoragePath || null,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  };
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
 * 1. Obtiene la configuración visual del negocio directamente de PostgreSQL
 */
export async function getBusinessDocumentConfig(
  businessId: string
): Promise<BusinessDocumentConfig> {
  const admin = await getSupabaseAdminClient();
  const { data, error } = await admin
    .from("business_document_configs")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) {
    console.error("[getBusinessDocumentConfig] Error al consultar configuración en BD:", error);
    throw new Error(`Error al consultar configuración: ${error.message}`);
  }

  if (data) {
    return mapDbConfigToInterface(data);
  }

  // Si no existe registro en business_document_configs, inicializar con datos del comercio
  const { data: biz, error: bizErr } = await admin
    .from("businesses")
    .select("name, phone, email, address, city, logo_url")
    .eq("id", businessId)
    .maybeSingle();

  if (bizErr) {
    console.warn("[getBusinessDocumentConfig] Aviso al consultar datos de negocio para inicializar:", bizErr);
  }

  const defaultConfig: BusinessDocumentConfig = {
    businessId,
    tradeName: biz?.name || "Mi Negocio",
    legalName: biz?.name || undefined,
    taxId: undefined,
    phone: biz?.phone || undefined,
    email: biz?.email || undefined,
    address: biz?.address || undefined,
    city: biz?.city || undefined,
    logoUrl: biz?.logo_url || null,
    primaryColor: "#ED500A",
    documentTitleDefault: "DOCUMENTO DE VENTA",
    headerText: null,
    footerText: "Gracias por su compra. Conserve este documento.",
    thankYouNote: "¡Agradecemos su preferencia!",
    termsAndConditions: null,
    updatedAt: new Date().toISOString(),
  };

  const { data: inserted, error: insertError } = await admin
    .from("business_document_configs")
    .insert(mapInterfaceToDbConfig(defaultConfig))
    .select()
    .single();

  if (insertError) {
    console.error("[getBusinessDocumentConfig] Error al persistir configuración por defecto:", insertError);
    const { data: retry } = await admin
      .from("business_document_configs")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();
    if (retry) return mapDbConfigToInterface(retry);
    return defaultConfig;
  }

  return mapDbConfigToInterface(inserted);
}

/**
 * 2. Actualiza la configuración visual de documentos del negocio en PostgreSQL
 */
export async function saveBusinessDocumentConfig(
  businessId: string,
  config: Partial<BusinessDocumentConfig>
): Promise<{ success: boolean; config?: BusinessDocumentConfig; error?: string }> {
  try {
    const admin = await getSupabaseAdminClient();
    const current = await getBusinessDocumentConfig(businessId);
    const incomingTerms =
      config.termsAndConditions !== undefined
        ? config.termsAndConditions
        : (config as any).termsConditions !== undefined
        ? (config as any).termsConditions
        : current.termsAndConditions;

    const updated: BusinessDocumentConfig = {
      ...current,
      ...config,
      termsAndConditions: incomingTerms,
      businessId, // Garantizar inmutabilidad del tenant
      updatedAt: new Date().toISOString(),
    };

    const dbRow = mapInterfaceToDbConfig(updated);
    let { data, error } = await admin
      .from("business_document_configs")
      .upsert(dbRow, { onConflict: "business_id" })
      .select()
      .single();

    // Fallback de resiliencia si la base de datos aún no tiene aplicadas las columnas extendidas (PGRST204)
    if (error && (error.code === "PGRST204" || error.message?.includes("schema cache"))) {
      const coreRow: any = {
        business_id: dbRow.business_id,
        trade_name: dbRow.trade_name,
        legal_name: dbRow.legal_name,
        tax_id: dbRow.tax_id,
        phone: dbRow.phone,
        email: dbRow.email,
        address: dbRow.address,
        city: dbRow.city,
        logo_url: dbRow.logo_url,
        primary_color: dbRow.primary_color,
        document_title_default: dbRow.document_title_default,
        header_text: dbRow.header_text,
        footer_text: dbRow.footer_text,
        thank_you_note: dbRow.thank_you_note,
        terms_conditions: dbRow.terms_conditions,
        updated_at: dbRow.updated_at,
      };

      const retryRes = await admin
        .from("business_document_configs")
        .upsert(coreRow, { onConflict: "business_id" })
        .select()
        .single();

      if (!retryRes.error && retryRes.data) {
        data = retryRes.data;
        error = null;
      }
    }

    if (error) {
      console.error("[saveBusinessDocumentConfig] Error al persistir en Supabase:", error);
      return {
        success: false,
        error: "No fue posible guardar la configuración del negocio en la base de datos.",
      };
    }

    return { success: true, config: mapDbConfigToInterface(data) };
  } catch (err: any) {
    console.error("[saveBusinessDocumentConfig] Excepción al guardar configuración:", err);
    return { success: false, error: err?.message || "Error al guardar configuración." };
  }
}

/**
 * 3. Obtiene los documentos comerciales pertenecientes a un negocio desde public.business_sale_documents
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
  const {
    businessId,
    page = 1,
    pageSize = 10,
    search,
    status,
    type,
    paymentMethod,
    startDate,
    endDate,
  } = params;
  try {
    const admin = await getSupabaseAdminClient();
    let query = admin
      .from("business_sale_documents")
      .select("*", { count: "exact" })
      .eq("business_id", businessId);

    if (status && status !== "all") {
      if (status === "paid") {
        query = query.in("status", ["paid", "completed"]);
      } else {
        query = query.eq("status", status);
      }
    }

    if (type && type !== "all") {
      query = query.eq("document_type", type);
    }

    if (paymentMethod && paymentMethod !== "all") {
      if (paymentMethod === "card") {
        query = query.in("payment_method", ["card", "credit"]);
      } else {
        query = query.eq("payment_method", paymentMethod);
      }
    }

    if (startDate) {
      query = query.gte("issued_at", startDate);
    }

    if (endDate) {
      query = query.lte("issued_at", endDate);
    }

    if (search && search.trim()) {
      query = query.or(`document_number.ilike.%${search.trim()}%,customer_name.ilike.%${search.trim()}%`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await query
      .order("issued_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("[getBusinessDocumentsList] Error al consultar documentos:", error);
      return { documents: [], totalCount: 0, page, pageSize, totalPages: 1 };
    }

    const totalCount = count || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const documents = (data || []).map(mapDbDocToInterface);

    return {
      documents,
      totalCount,
      page,
      pageSize,
      totalPages,
    };
  } catch (err) {
    console.error(`[getBusinessDocumentsList] Error inesperado para el negocio ${businessId}:`, err);
    return { documents: [], totalCount: 0, page, pageSize, totalPages: 1 };
  }
}

/**
 * 3.1 Obtiene un documento comercial específico validando estrictamente su pertenencia al negocio.
 * Si el documento no existe o pertenece a otro negocio, retorna null de forma segura.
 */
export async function getBusinessDocumentById(
  businessId: string,
  documentId: string
): Promise<BusinessSaleDocument | null> {
  try {
    const admin = await getSupabaseAdminClient();
    const { data: row, error } = await admin
      .from("business_sale_documents")
      .select("*")
      .eq("id", documentId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (error || !row) {
      return null;
    }

    return mapDbDocToInterface(row);
  } catch (err) {
    console.error(`[getBusinessDocumentById] Error al consultar documento ${documentId}:`, err);
    return null;
  }
}

/**
 * Genera el siguiente número de documento comercial de forma concurrente y aislada por negocio y año.
 * 1. Intenta invocar la función RPC atómica de PostgreSQL `get_next_business_document_number`.
 * 2. Si la RPC no está disponible en la base de datos, consulta de forma determinista el número máximo
 *    persistido en `business_sale_documents` para ese negocio y año (evitando colisiones por saltos o eliminaciones).
 */
export async function generateNextDocumentNumber(
  admin: any,
  businessId: string,
  year: number = new Date().getFullYear()
): Promise<string> {
  // 1. Intento RPC atómico en PostgreSQL
  try {
    const { data: rpcNumber, error: rpcError } = await admin.rpc(
      "get_next_business_document_number",
      {
        p_business_id: businessId,
        p_year: year,
      }
    );

    if (!rpcError && rpcNumber && typeof rpcNumber === "string") {
      return rpcNumber;
    }
  } catch (rpcEx) {
    // Si la función RPC no está disponible aún en la base de datos, continuar con la estrategia de consulta MAX
  }

  // 2. Consulta de secuencia por máximo valor existente en business_sale_documents
  const prefix = `DOC-${year}-`;
  const { data: latestDocs, error: queryErr } = await admin
    .from("business_sale_documents")
    .select("document_number")
    .eq("business_id", businessId)
    .like("document_number", `${prefix}%`)
    .order("document_number", { ascending: false })
    .limit(1);

  let nextSeq = 1;
  if (!queryErr && latestDocs && latestDocs.length > 0) {
    const match = latestDocs[0].document_number.match(new RegExp(`^DOC-${year}-(\\d+)$`));
    if (match && match[1]) {
      nextSeq = parseInt(match[1], 10) + 1;
    }
  }

  return `DOC-${year}-${String(nextSeq).padStart(4, "0")}`;
}

/**
 * 4. Crea un nuevo documento comercial para el negocio en public.business_sale_documents
 * con correlativo concurrente seguro y auditoría no bloqueante vía logAuditAction.
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
    userId?: string | null;
  },
  options?: {
    userId?: string;
  }
): Promise<{ success: boolean; document?: BusinessSaleDocument; error?: string }> {
  try {
    const admin = await getSupabaseAdminClient();
    const currentYear = new Date().getFullYear();
    const operatorUserId = options?.userId || docData.userId || undefined;

    const subtotal = docData.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const discountTotal = docData.items.reduce((sum, item) => sum + (item.discount || 0), 0) + Math.max(0, Number((docData as any).discountTotal || 0));
    const taxTotal = Math.max(0, Number((docData as any).taxTotal || 0));
    const total = Math.max(0, subtotal - discountTotal + taxTotal);

    let insertedRow: any = null;
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const docNumber = await generateNextDocumentNumber(admin, businessId, currentYear);
      const rowId = `doc-${businessId.slice(0, 6)}-${Date.now()}-${attempt}`;

      const rowToInsert = {
        id: rowId,
        business_id: businessId,
        document_number: docNumber,
        document_type: docData.documentType || "sale",
        customer_name: docData.customerName.trim() || "Cliente General",
        customer_id: docData.customerId || null,
        customer_phone: docData.customerPhone || null,
        customer_email: docData.customerEmail || null,
        customer_address: docData.customerAddress || null,
        items: docData.items,
        subtotal,
        discount_total: discountTotal,
        tax_total: taxTotal,
        total,
        currency: "COP",
        payment_method: docData.paymentMethod || "cash",
        status: docData.status || "completed",
        issued_at: new Date().toISOString(),
        notes: docData.notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: inserted, error: insertErr } = await admin
        .from("business_sale_documents")
        .insert(rowToInsert)
        .select()
        .single();

      if (!insertErr && inserted) {
        insertedRow = inserted;
        break;
      }

      // Si el error es violación de restricción única (código 23505), reintentar con el siguiente correlativo
      if (insertErr && (insertErr.code === "23505" || insertErr.message?.includes("unique constraint"))) {
        console.warn(`[createBusinessSaleDocument] Colisión concurrente detectada en ${docNumber}. Reintentando (${attempt + 1}/${maxRetries})...`);
        continue;
      }

      console.error("[createBusinessSaleDocument] Error al registrar documento:", insertErr);
      return { success: false, error: "No se pudo registrar el documento en base de datos." };
    }

    if (!insertedRow) {
      return { success: false, error: "No se pudo asignar un correlativo único tras varios reintentos." };
    }

    const createdDoc = mapDbDocToInterface(insertedRow);

    // Auditoría centralizada no bloqueante
    try {
      await logAuditAction({
        action: "create",
        businessId,
        userId: operatorUserId,
        entityType: "business_sale_document",
        entityId: createdDoc.id,
        newData: {
          document_number: createdDoc.documentNumber,
          document_type: createdDoc.documentType,
          customer_name: createdDoc.customerName,
          total: createdDoc.total,
          subtotal: createdDoc.subtotal,
          payment_method: createdDoc.paymentMethod,
          status: createdDoc.status,
          currency: createdDoc.currency,
          item_count: createdDoc.items.length,
        },
        metadata: {
          original_action: "create_sale_document",
          document_number: createdDoc.documentNumber,
          document_type: createdDoc.documentType,
          payment_method: createdDoc.paymentMethod,
          total: createdDoc.total,
          customer_name: createdDoc.customerName,
          created_at: createdDoc.createdAt,
        },
      });
    } catch (auditErr) {
      console.warn("[createBusinessSaleDocument] Advertencia: Auditoría no bloqueante falló:", auditErr);
    }

    return { success: true, document: createdDoc };
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
    const admin = await getSupabaseAdminClient();
    const { data: docRow, error: docErr } = await admin
      .from("business_sale_documents")
      .select("*")
      .eq("id", documentId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (docErr || !docRow) {
      return { success: false, error: "Documento no encontrado o no pertenece a este negocio." };
    }

    const doc = mapDbDocToInterface(docRow);
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
      documentTitle: config.documentTitleDefault || "COMPROBANTE DE VENTA",
      businessId,
      tradeName: config.tradeName,
      legalName: config.legalName,
      taxId: config.taxId,
      phone: config.phone,
      whatsapp: config.whatsapp,
      email: config.email,
      address: config.address,
      city: config.city,
      department: config.department,
      postalCode: config.postalCode,
      primaryColor: config.primaryColor || "#ED500A",
      logoBase64,
      headerText: config.headerText,
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
      documentObservations: config.documentObservations,
      thankYouNote: config.thankYouNote,
      termsAndConditions: config.termsAndConditions,
      returnPolicy: config.returnPolicy,
      warrantyPolicy: config.warrantyPolicy,
      footerText: config.footerText,
    });

    // Subir a Storage en la carpeta aislada del negocio
    try {
      const storageRes = await uploadBusinessDocumentPdfBuffer(
        admin,
        businessId,
        doc.documentNumber,
        pdfResult.buffer
      );
      if (storageRes.url) {
        doc.pdfUrl = storageRes.url;
        doc.pdfStoragePath = storageRes.storagePath;

        // Actualizar URL en el registro del documento
        await admin
          .from("business_sale_documents")
          .update({
            pdf_url: storageRes.url,
            pdf_storage_path: storageRes.storagePath,
          })
          .eq("id", doc.id);
      }
    } catch (storageErr) {
      console.warn("Aviso al guardar buffer de PDF en Storage:", storageErr);
    }

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

/**
 * 6. Cancela / Anula comercialmente un documento de venta.
 * 
 * ARQUITECTURA COMERCIAL:
 * La anulación comercial ordinaria NO elimina físicamente el registro de la base de datos
 * para preservar de forma inmutable el historial fiscal y operativo del negocio.
 * Cambia el estado a 'cancelled' y registra la auditoría con logAuditAction.
 */
export async function cancelBusinessSaleDocument(
  businessId: string,
  documentId: string,
  options?: {
    userId?: string;
    reason?: string;
  }
): Promise<{ success: boolean; document?: BusinessSaleDocument; error?: string }> {
  try {
    const admin = await getSupabaseAdminClient();

    // 1. Validar aislamiento multi-tenant estricto
    const { data: existingDoc, error: fetchErr } = await admin
      .from("business_sale_documents")
      .select("*")
      .eq("id", documentId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (fetchErr || !existingDoc) {
      return { success: false, error: "Documento no encontrado o no pertenece a este negocio." };
    }

    if (existingDoc.status === "cancelled" || existingDoc.status === "annulled") {
      return { success: false, error: "El documento ya se encuentra cancelado." };
    }

    const previousStatus = existingDoc.status;
    const nowIso = new Date().toISOString();
    const reasonText = options?.reason?.trim();
    const updatedNotes = reasonText
      ? existingDoc.notes
        ? `${existingDoc.notes} | Cancelación: ${reasonText}`
        : `Cancelación: ${reasonText}`
      : existingDoc.notes;

    // 2. Transición comercial de estado a 'cancelled'
    const { data: updatedDoc, error: updateErr } = await admin
      .from("business_sale_documents")
      .update({
        status: "cancelled",
        notes: updatedNotes,
        updated_at: nowIso,
      })
      .eq("id", documentId)
      .eq("business_id", businessId)
      .select()
      .single();

    if (updateErr || !updatedDoc) {
      console.error("[cancelBusinessSaleDocument] Error al cancelar documento:", updateErr);
      return { success: false, error: "No se pudo actualizar el estado del documento a cancelado." };
    }

    const cancelledDoc = mapDbDocToInterface(updatedDoc);

    // 3. Auditoría de cancelación centralizada y no bloqueante
    try {
      await logAuditAction({
        action: "status_change",
        businessId,
        userId: options?.userId,
        entityType: "business_sale_document",
        entityId: documentId,
        oldData: {
          status: previousStatus,
          notes: existingDoc.notes,
        },
        newData: {
          status: "cancelled",
          notes: updatedNotes,
        },
        metadata: {
          original_action: "cancel_sale_document",
          document_number: existingDoc.document_number,
          previous_status: previousStatus,
          new_status: "cancelled",
          cancellation_reason: reasonText || "Sin motivo especificado",
          cancelled_at: nowIso,
        },
      });
    } catch (auditErr) {
      console.warn("[cancelBusinessSaleDocument] Advertencia: Auditoría de cancelación falló:", auditErr);
    }

    return { success: true, document: cancelledDoc };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al cancelar documento comercial" };
  }
}

/**
 * 7. Eliminación física técnica de un documento comercial.
 * 
 * RESTRICCIÓN DE ARQUITECTURA:
 * Esta función está ESTRICTAMENTE RESTRINGIDA a mantenimiento técnico y limpieza
 * de pruebas automatizadas (teardown).
 * En la operación comercial normal de NEGOVA está PROHIBIDO eliminar registros
 * físicamente; se debe invocar `cancelBusinessSaleDocument` para preservar
 * la inmutabilidad del historial contable y comercial.
 */
export async function deleteBusinessDocument(businessId: string, documentId: string) {
  try {
    const admin = await getSupabaseAdminClient();
    const { error } = await admin
      .from("business_sale_documents")
      .delete()
      .eq("id", documentId)
      .eq("business_id", businessId);

    if (error) {
      console.error("[deleteBusinessDocument] Error al eliminar documento:", error);
      return { success: false, error: "No se pudo eliminar el documento comercial." };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

/**
 * 7. Migración de datos legacy desde platform_settings a business_document_configs y business_sale_documents.
 * Elimina la duplicación en platform_settings una vez persistido en las tablas relacionales.
 */
export async function migrateDocumentConfigsToSql(): Promise<{
  success: boolean;
  migratedConfigs?: number;
  migratedDocs?: number;
  error?: string;
}> {
  try {
    const admin = await getSupabaseAdminClient();

    // 1. Migrar configuraciones documentales legacy
    const { data: legacyConfigs, error: cfgErr } = await admin
      .from("platform_settings")
      .select("key, value")
      .ilike("key", "business_doc_config:%");

    let migratedConfigsCount = 0;
    if (!cfgErr && legacyConfigs && legacyConfigs.length > 0) {
      for (const rec of legacyConfigs) {
        if (rec.value && typeof rec.value === "object" && (rec.value as any).businessId) {
          const cfg = rec.value as BusinessDocumentConfig;
          const dbRow = mapInterfaceToDbConfig(cfg);
          const { error: upsertErr } = await admin
            .from("business_document_configs")
            .upsert(dbRow, { onConflict: "business_id" });

          if (!upsertErr) {
            migratedConfigsCount++;
            // Eliminar duplicado en platform_settings
            await admin.from("platform_settings").delete().eq("key", rec.key);
          }
        }
      }
    }

    // 2. Migrar documentos de venta legacy si existen en platform_settings
    const { data: legacyDocs, error: docErr } = await admin
      .from("platform_settings")
      .select("key, value")
      .ilike("key", "business_documents:%");

    let migratedDocsCount = 0;
    if (!docErr && legacyDocs && legacyDocs.length > 0) {
      for (const rec of legacyDocs) {
        if (Array.isArray(rec.value)) {
          for (const item of rec.value) {
            if (item && item.businessId && item.documentNumber) {
              const row = mapInterfaceToDbDoc(item as BusinessSaleDocument);
              const { error: insErr } = await admin
                .from("business_sale_documents")
                .upsert(row, { onConflict: "id" });
              if (!insErr) {
                migratedDocsCount++;
              }
            }
          }
          // Eliminar duplicado en platform_settings
          await admin.from("platform_settings").delete().eq("key", rec.key);
        }
      }
    }

    return {
      success: true,
      migratedConfigs: migratedConfigsCount,
      migratedDocs: migratedDocsCount,
    };
  } catch (err: any) {
    console.error("[migrateDocumentConfigsToSql] Error:", err);
    return { success: false, error: err?.message || "Error en migración" };
  }
}

export interface WorkspaceDashboardData {
  todaySalesTotal: number;
  todaySalesCount: number;
  totalSalesCount: number;
  allTimeSalesTotal: number;
  recentDocuments: BusinessSaleDocument[];
  businessCurrency: string;
}

/**
 * 8. Obtiene métricas reales y documentos recientes para el Dashboard del Workspace
 */
export async function getWorkspaceDashboardData(
  businessId: string,
  timezone: string = "America/Bogota"
): Promise<WorkspaceDashboardData> {
  try {
    const admin = await getSupabaseAdminClient();

    // 1. Calcular el inicio del día en la zona horaria del negocio
    let startOfTodayIso: string;
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-CA", { timeZone: timezone || "America/Bogota" });
      const tzParts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone || "America/Bogota",
        timeZoneName: "longOffset",
      }).formatToParts(now);
      const rawOffset = tzParts.find((p) => p.type === "timeZoneName")?.value || "GMT-05:00";
      const offset = rawOffset.replace("GMT", "").trim() || "-05:00";
      startOfTodayIso = new Date(`${dateStr}T00:00:00${offset}`).toISOString();
    } catch {
      const fallback = new Date();
      fallback.setUTCHours(0, 0, 0, 0);
      startOfTodayIso = fallback.toISOString();
    }

    // 2. Ventas del día (filtradas por negocio, status no cancelado y fecha de hoy)
    const { data: todayRows, error: todayErr } = await admin
      .from("business_sale_documents")
      .select("total")
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .gte("issued_at", startOfTodayIso);

    if (todayErr) {
      console.error("[getWorkspaceDashboardData] Error al consultar ventas de hoy:", todayErr);
    }

    const todaySalesCount = todayRows?.length || 0;
    const todaySalesTotal = (todayRows || []).reduce((acc, row) => acc + Number(row.total || 0), 0);

    // 3. Documentos recientes y conteo total histórico
    const { data: recentRows, count: totalCount, error: recentErr } = await admin
      .from("business_sale_documents")
      .select("*", { count: "exact" })
      .eq("business_id", businessId)
      .order("issued_at", { ascending: false })
      .limit(8);

    if (recentErr) {
      console.error("[getWorkspaceDashboardData] Error al consultar documentos recientes:", recentErr);
    }

    // 4. Total histórico vendido (no cancelado)
    const { data: allActiveRows } = await admin
      .from("business_sale_documents")
      .select("total")
      .eq("business_id", businessId)
      .neq("status", "cancelled");

    const allTimeSalesTotal = (allActiveRows || []).reduce((acc, row) => acc + Number(row.total || 0), 0);

    const recentDocuments = (recentRows || []).map(mapDbDocToInterface);

    return {
      todaySalesTotal,
      todaySalesCount,
      totalSalesCount: totalCount || 0,
      allTimeSalesTotal,
      recentDocuments,
      businessCurrency: "COP",
    };
  } catch (err) {
    console.error("[getWorkspaceDashboardData] Excepción al obtener métricas del workspace:", err);
    return {
      todaySalesTotal: 0,
      todaySalesCount: 0,
      totalSalesCount: 0,
      allTimeSalesTotal: 0,
      recentDocuments: [],
      businessCurrency: "COP",
    };
  }
}


