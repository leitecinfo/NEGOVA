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
  BusinessDocumentItem,
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
    paperWidth: dbRow.paper_width || dbRow.paperWidth || "80mm",
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
  if (config.paperWidth !== undefined) dbRow.paper_width = config.paperWidth;
  
  const terms = config.termsAndConditions !== undefined ? config.termsAndConditions : config.termsConditions;
  if (terms !== undefined) dbRow.terms_conditions = terms || null;
  
  dbRow.updated_at = new Date().toISOString();
  return dbRow;
}

function mapDbDocToInterface(row: any): BusinessSaleDocument {
  return {
    id: row.id,
    businessId: row.business_id,
    restaurantOrderId: row.restaurant_order_id || null,
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

export function mapRestaurantOrderToDocument(
  order: any,
  items: any[] = []
): BusinessSaleDocument {
  const mappedItems: BusinessDocumentItem[] = items.map((it: any) => ({
    id: it.id,
    productId: it.product_id || undefined,
    description: it.product_name,
    quantity: Number(it.quantity || 1),
    unitPrice: Number(it.unit_price || 0),
    discount: 0,
    total: Number(it.subtotal || 0),
  }));

  // Respetar estado comercial y financiero real
  let docStatus: BusinessSaleDocument["status"] = "pending";
  if (order.status === "cancelled") {
    docStatus = "cancelled";
  } else if (order.payment_status === "paid") {
    docStatus = "paid";
  } else {
    docStatus = "pending";
  }

  return {
    id: order.id,
    businessId: order.business_id,
    documentNumber: `ORD-${order.order_number}`,
    documentType: "order",
    customerName: order.customer_name || "Cliente mostrador",
    customerId: null,
    customerPhone: order.customer_phone || null,
    customerEmail: null,
    customerAddress: order.delivery_address || null,
    items: mappedItems,
    subtotal: Number(order.subtotal || 0),
    discountTotal: 0,
    taxTotal: Number(order.tax_total || 0),
    total: Number(order.total || 0),
    currency: "COP",
    paymentMethod: "cash",
    status: docStatus,
    issuedAt: order.created_at,
    dueDate: null,
    notes: order.notes || null,
    pdfUrl: null,
    pdfStoragePath: null,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}

function mapInterfaceToDbDoc(doc: BusinessSaleDocument) {
  return {
    id: doc.id,
    business_id: doc.businessId,
    restaurant_order_id: doc.restaurantOrderId || null,
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
    const mapped = mapDbConfigToInterface(data);
    if (!data.paper_width) {
      const { data: bData } = await admin.from("businesses").select("settings").eq("id", businessId).maybeSingle();
      if (bData?.settings?.paperWidth) {
        mapped.paperWidth = bData.settings.paperWidth;
      }
    }
    return mapped;
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
    paperWidth: "80mm",
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

    if (config.paperWidth) {
      try {
        const { data: bData } = await admin.from("businesses").select("settings").eq("id", businessId).maybeSingle();
        const existingSettings = bData?.settings || {};
        await admin.from("businesses").update({
          settings: { ...existingSettings, paperWidth: config.paperWidth },
          updated_at: new Date().toISOString(),
        }).eq("id", businessId);
      } catch (settingsErr) {
        console.warn("[saveBusinessDocumentConfig] Aviso al sincronizar paperWidth en settings:", settingsErr);
      }
    }

    const finalConfig = mapDbConfigToInterface(data);
    if (config.paperWidth) {
      finalConfig.paperWidth = config.paperWidth;
    }
    return { success: true, config: finalConfig };
  } catch (err: any) {
    console.error("[saveBusinessDocumentConfig] Excepción al guardar configuración:", err);
    return { success: false, error: err?.message || "Error al guardar configuración." };
  }
}

/**
export function mapRestaurantOrderToDocument(order: any, items: any[] = []): BusinessSaleDocument {
  const normalizedItems = (items || []).map((it: any) => ({
    description: it.product_name + (it.notes ? ` (${it.notes})` : ""),
    quantity: Number(it.quantity || 1),
    unitPrice: Number(it.unit_price || 0),
    discount: 0,
    total: Number(it.subtotal || 0),
  }));

  if (Number(order.delivery_fee || 0) > 0) {
    normalizedItems.push({
      description: "Servicio de Domicilio",
      quantity: 1,
      unitPrice: Number(order.delivery_fee),
      discount: 0,
      total: Number(order.delivery_fee),
    });
  }

  const subtotal = Number(order.subtotal || 0);
  const total = Number(order.total || 0);

  let docStatus: BusinessSaleDocument["status"] = "pending";
  if (order.status === "cancelled") {
    docStatus = "cancelled";
  } else if (order.payment_status === "paid") {
    docStatus = "paid";
  } else {
    docStatus = "pending";
  }

  return {
    id: order.id,
    businessId: order.business_id,
    documentNumber: `ORD-${order.order_number}`,
    documentType: "order",
    customerName: order.customer_name || "Consumidor Final",
    customerId: null,
    customerPhone: order.customer_phone || null,
    customerEmail: null,
    customerAddress: order.delivery_address || null,
    items: normalizedItems,
    subtotal,
    discountTotal: 0,
    taxTotal: Number(order.tax_total || 0),
    total,
    currency: "COP",
    paymentMethod: "cash",
    status: docStatus,
    issuedAt: order.created_at,
    dueDate: null,
    notes: order.notes || (order.order_type === "dine_in" ? "Consumo en mesa" : null),
    pdfUrl: null,
    pdfStoragePath: null,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}

/**
 * 3. Obtiene los documentos comerciales pertenecientes a un negocio unificando
 * facturas tradicionales (public.business_sale_documents) y pedidos entregados/cerrados
 * (public.restaurant_orders) sin duplicar datos en base de datos.
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
    const shouldQueryBsd = !type || type === "all" || ["sale", "service", "receipt", "order"].includes(type);
    const shouldQueryOrders = !type || type === "all" || type === "order";

    let bsdPromise: PromiseLike<any> = Promise.resolve({ data: [] as any[], count: 0, error: null as any });
    const fetchLimit = Math.max(100, page * pageSize * 3);

    if (shouldQueryBsd) {
      let bsdQuery = admin
        .from("business_sale_documents")
        .select("*", { count: "exact" })
        .eq("business_id", businessId);

      if (status && status !== "all") {
        if (status === "paid") {
          bsdQuery = bsdQuery.in("status", ["paid", "completed"]);
        } else {
          bsdQuery = bsdQuery.eq("status", status);
        }
      }

      if (type && type !== "all") {
        bsdQuery = bsdQuery.eq("document_type", type);
      }

      if (paymentMethod && paymentMethod !== "all") {
        if (paymentMethod === "card") {
          bsdQuery = bsdQuery.in("payment_method", ["card", "credit"]);
        } else {
          bsdQuery = bsdQuery.eq("payment_method", paymentMethod);
        }
      }

      if (startDate) {
        bsdQuery = bsdQuery.gte("issued_at", startDate);
      }

      if (endDate) {
        bsdQuery = bsdQuery.lte("issued_at", endDate);
      }

      if (search && search.trim()) {
        bsdQuery = bsdQuery.or(`document_number.ilike.%${search.trim()}%,customer_name.ilike.%${search.trim()}%`);
      }

      bsdPromise = bsdQuery
        .order("issued_at", { ascending: false })
        .limit(fetchLimit);
    }

    let orderPromise: PromiseLike<any> = Promise.resolve({ data: [] as any[], count: 0, error: null as any });

    if (shouldQueryOrders) {
      // Los pedidos que constituyen ventas comerciales son aquellos entregados ('delivered')
      // o cancelados ('cancelled' si se consulta explícitamente dicho estado o todos).
      // Se proyectan solo los campos necesarios para reducir radicalmente la carga de red.
      let orderQuery = admin
        .from("restaurant_orders")
        .select(
          "id, business_id, order_number, total, subtotal, delivery_fee, tax_total, status, payment_status, created_at, updated_at, customer_name, customer_phone, delivery_address, notes, order_type, restaurant_order_items(product_name, notes, quantity, unit_price, subtotal)",
          { count: "exact" }
        )
        .eq("business_id", businessId);

      if (status && status !== "all") {
        if (status === "paid" || status === "completed") {
          orderQuery = orderQuery.eq("status", "delivered").eq("payment_status", "paid");
        } else if (status === "pending") {
          orderQuery = orderQuery.eq("status", "delivered").neq("payment_status", "paid");
        } else if (status === "cancelled") {
          orderQuery = orderQuery.eq("status", "cancelled");
        } else {
          // Estados no aplicables a ventas de comandas
          orderQuery = orderQuery.eq("id", "00000000-0000-0000-0000-000000000000");
        }
      } else {
        orderQuery = orderQuery.in("status", ["delivered", "cancelled"]);
      }

      if (paymentMethod && paymentMethod !== "all") {
        if (paymentMethod !== "cash") {
          // Por defecto las comandas en el modelo base se liquidan en efectivo
          orderQuery = orderQuery.eq("id", "00000000-0000-0000-0000-000000000000");
        }
      }

      if (startDate) {
        orderQuery = orderQuery.gte("created_at", `${startDate.split("T")[0]}T00:00:00.000Z`);
      }

      if (endDate) {
        orderQuery = orderQuery.lte("created_at", `${endDate.split("T")[0]}T23:59:59.999Z`);
      }

      if (search && search.trim()) {
        const cleanSearch = search.trim();
        const numericSearch = cleanSearch.replace(/^#|^ORD-|^DOC-ORD-/, "");
        if (/^\d+$/.test(numericSearch)) {
          orderQuery = orderQuery.or(`order_number.eq.${numericSearch},customer_name.ilike.%${cleanSearch}%`);
        } else {
          orderQuery = orderQuery.ilike("customer_name", `%${cleanSearch}%`);
        }
      }

      orderPromise = orderQuery
        .order("created_at", { ascending: false })
        .limit(fetchLimit);
    }

    // Ejecutar ambas consultas en paralelo en la base de datos
    const [bsdRes, orderRes] = await Promise.all([bsdPromise, orderPromise]);

    let bsdDocuments: BusinessSaleDocument[] = [];
    let bsdCount = 0;
    if (!bsdRes.error && bsdRes.data) {
      bsdDocuments = bsdRes.data.map(mapDbDocToInterface);
      bsdCount = bsdRes.count || bsdDocuments.length;
    }

    let orderDocuments: BusinessSaleDocument[] = [];
    let orderCount = 0;
    if (!orderRes.error && orderRes.data) {
      orderDocuments = orderRes.data.map((o: any) =>
        mapRestaurantOrderToDocument(o, o.restaurant_order_items || [])
      );
      orderCount = orderRes.count || orderDocuments.length;
    }

    // Unificar evitando duplicados por ID de documento o restaurant_order_id
    const seenIds = new Set<string>();
    const allDocuments: BusinessSaleDocument[] = [];

    for (const doc of bsdDocuments) {
      seenIds.add(doc.id);
      if (doc.restaurantOrderId) {
        seenIds.add(doc.restaurantOrderId);
      }
      allDocuments.push(doc);
    }

    for (const orderDoc of orderDocuments) {
      if (!seenIds.has(orderDoc.id)) {
        seenIds.add(orderDoc.id);
        allDocuments.push(orderDoc);
      }
    }

    // Ordenar cronológicamente descendente con desempate determinista por ID
    allDocuments.sort((a, b) => {
      const timeDiff = new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.id.localeCompare(a.id);
    });

    const totalCount = allDocuments.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const from = (page - 1) * pageSize;
    const paginatedDocuments = allDocuments.slice(from, from + pageSize);

    return {
      documents: paginatedDocuments,
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
 * Consulta tanto business_sale_documents como restaurant_orders (multi-tenant).
 */
export async function getBusinessDocumentById(
  businessId: string,
  documentId: string
): Promise<BusinessSaleDocument | null> {
  try {
    const admin = await getSupabaseAdminClient();
    
    // 1. Consultar comprobantes tradicionales (por id de documento o restaurant_order_id)
    let row: any = null;
    try {
      const { data: r, error: qErr } = await admin
        .from("business_sale_documents")
        .select("*")
        .eq("business_id", businessId)
        .or(`id.eq.${documentId},restaurant_order_id.eq.${documentId}`)
        .maybeSingle();

      if (!qErr) {
        row = r;
      } else {
        const { data: fallbackRow } = await admin
          .from("business_sale_documents")
          .select("*")
          .eq("id", documentId)
          .eq("business_id", businessId)
          .maybeSingle();
        row = fallbackRow;
      }
    } catch {
      const { data: fallbackRow } = await admin
        .from("business_sale_documents")
        .select("*")
        .eq("id", documentId)
        .eq("business_id", businessId)
        .maybeSingle();
      row = fallbackRow;
    }

    if (row) {
      return mapDbDocToInterface(row);
    }

    // 2. Si no existe en comprobantes directos, buscar en restaurant_orders
    const { data: orderRow } = await admin
      .from("restaurant_orders")
      .select("*, restaurant_order_items(*)")
      .eq("id", documentId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (orderRow) {
      return mapRestaurantOrderToDocument(orderRow, orderRow.restaurant_order_items || []);
    }

    return null;
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
    discountTotal?: number;
    taxTotal?: number;
    total?: number;
    paymentMethod?: BusinessSaleDocument["paymentMethod"];
    status?: BusinessSaleDocument["status"];
    notes?: string | null;
    userId?: string | null;
    restaurantOrderId?: string | null;
  },
  options?: {
    userId?: string;
  }
): Promise<{ success: boolean; document?: BusinessSaleDocument; error?: string }> {
  try {
    const admin = await getSupabaseAdminClient();

    // Idempotencia: si proviene de un restaurant_order_id, verificar si ya existe un documento para este pedido
    if (docData.restaurantOrderId) {
      try {
        const { data: existingDoc } = await admin
          .from("business_sale_documents")
          .select("*")
          .eq("business_id", businessId)
          .eq("restaurant_order_id", docData.restaurantOrderId)
          .maybeSingle();

        if (existingDoc) {
          return { success: true, document: mapDbDocToInterface(existingDoc) };
        }
      } catch {
        // Ignorar si columna aún no está en cache de BD
      }
    }

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
      const randSuffix = Math.random().toString(36).slice(2, 6);
      const rowId = `doc-${businessId.slice(0, 6)}-${Date.now()}-${randSuffix}-${attempt}`;

      const rowToInsert: Record<string, any> = {
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

      if (docData.restaurantOrderId) {
        rowToInsert.restaurant_order_id = docData.restaurantOrderId;
      }

      const { data: inserted, error: insertErr } = await admin
        .from("business_sale_documents")
        .insert(rowToInsert)
        .select()
        .single();

      if (!insertErr && inserted) {
        insertedRow = inserted;
        break;
      }

      // Si el error es falta de columna en BD remota aún no migrada, reintentar sin restaurant_order_id
      if (insertErr && (insertErr.code === "PGRST204" || insertErr.message?.includes("restaurant_order_id"))) {
        delete rowToInsert.restaurant_order_id;
        const { data: retryInserted, error: retryErr } = await admin
          .from("business_sale_documents")
          .insert(rowToInsert)
          .select()
          .single();

        if (!retryErr && retryInserted) {
          insertedRow = retryInserted;
          break;
        }
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

    // Registrar movimiento de caja automáticamente si la venta directa nace pagada/completada y no viene de una orden de restaurante
    if (
      !docData.restaurantOrderId &&
      (createdDoc.status === "paid" || createdDoc.status === "completed") &&
      createdDoc.total > 0 &&
      createdDoc.paymentMethod !== "credit"
    ) {
      try {
        const { getActiveCashSession, recordCashMovement } = await import("@/lib/cash/cash-service");
        const activeSession = await getActiveCashSession(businessId, undefined, operatorUserId);
        if (activeSession) {
          const pm = String(createdDoc.paymentMethod || "cash").toLowerCase();
          const movType =
            pm === "cash" || pm === "efectivo"
              ? "sale_cash"
              : pm === "card" || pm === "tarjeta" || pm === "datáfono"
              ? "sale_card"
              : "sale_digital";

          await recordCashMovement(
            businessId,
            {
              sessionId: activeSession.id,
              movementType: movType,
              amount: createdDoc.total,
              referenceId: createdDoc.id,
              referenceType: "sale_document",
              notes: `Venta ${createdDoc.documentNumber} (${createdDoc.paymentMethod})`,
            },
            operatorUserId || null
          );
        }
      } catch (cashErr) {
        console.warn("[createBusinessSaleDocument] Aviso al registrar movimiento en turno de caja:", cashErr);
      }
    }

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
    const doc = await getBusinessDocumentById(businessId, documentId);

    if (!doc) {
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

        // Si es comprobante directo de business_sale_documents, actualizar registro
        await admin
          .from("business_sale_documents")
          .update({
            pdf_url: storageRes.url,
            pdf_storage_path: storageRes.storagePath,
          })
          .eq("id", doc.id)
          .eq("business_id", businessId);
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
/**
 * [POS-005] Revierte de forma integral los efectos de una venta al ser anulada:
 * 1. Devuelve el stock de productos inventariables a `inventory_stock` y `products.metadata.stock_quantity`, registrando `inventory_movements`.
 * 2. Devuelve los ingredientes obligatorios de recetas activas al inventario proporcionalmente.
 * 3. Revierte los movimientos de caja (`cash_movements`) vinculados a la venta/pedido.
 * 4. Si la venta fue a crédito, reduce `credit_used` del cliente y marca `accounts_receivable` como `cancelled`.
 * 5. Registra el evento en `audit_logs` con quién anuló, cuándo y el motivo.
 */
export async function reverseSaleEffectsOnCancel(
  admin: any,
  businessId: string,
  params: {
    documentId: string;
    documentNumber: string;
    restaurantOrderId?: string | null;
    linkedSaleDocId?: string | null;
    items: Array<any>;
    total: number;
    paymentMethod?: string | null;
    paymentStatus?: string | null;
    customerId?: string | null;
    userId?: string | null;
    authorizedBy?: string | null;
    reason?: string | null;
    previousStatus?: string;
    nowIso: string;
  }
): Promise<void> {
  const {
    documentId,
    documentNumber,
    restaurantOrderId,
    linkedSaleDocId,
    total,
    paymentMethod,
    paymentStatus,
    customerId,
    userId,
    authorizedBy,
    reason,
    previousStatus,
    nowIso,
  } = params;

  const refIds = Array.from(
    new Set([documentId, restaurantOrderId, linkedSaleDocId].filter(Boolean))
  ) as string[];

  // 1. Determinar líneas de ítems a revertir (priorizando restaurant_order_items si hay orden vinculada)
  let effectiveItems: Array<any> = Array.isArray(params.items) ? params.items : [];
  if (restaurantOrderId) {
    try {
      const { data: orderItems } = await admin
        .from("restaurant_order_items")
        .select("*")
        .eq("order_id", restaurantOrderId);
      if (Array.isArray(orderItems) && orderItems.length > 0) {
        effectiveItems = orderItems;
      }
    } catch {
      // Continuar con params.items
    }
  }

  // 2. Revertir Stock de Productos e Ingredientes de Recetas
  if (effectiveItems.length > 0) {
    try {
      const [{ data: businessProducts }, { data: locationsData }] = await Promise.all([
        admin.from("products").select("*").eq("business_id", businessId),
        admin.from("locations").select("*").eq("business_id", businessId),
      ]);

      const productsList: Array<any> = Array.isArray(businessProducts) ? businessProducts : [];
      const locationsList: Array<any> = Array.isArray(locationsData) ? locationsData : [];
      const defaultLoc =
        locationsList.find((l: any) => l.is_default && l.is_active !== false) ||
        locationsList.find((l: any) => l.is_active !== false) ||
        locationsList[0] ||
        null;
      const defaultLocationId: string | null = defaultLoc?.id || null;

      for (const item of effectiveItems) {
        const qty = Number(item.quantity || 0);
        if (qty <= 0) continue;

        const rawItemProdId = item.product_id || item.productId || item.id || null;
        const rawItemName = String(item.description || item.product_name || item.name || "").trim();
        const cleanItemName = rawItemName.replace(/\s*\(.*\)\s*$/, "").trim().toLowerCase();

        // Ignorar cargos de domicilio
        if (
          String(rawItemProdId || "").startsWith("fee-") ||
          cleanItemName === "costo de domicilio / envío"
        ) {
          continue;
        }

        const matchedProduct =
          productsList.find((p: any) => rawItemProdId && p.id === rawItemProdId) ||
          productsList.find(
            (p: any) =>
              rawItemName &&
              String(p.name || "").trim().toLowerCase() === rawItemName.toLowerCase()
          ) ||
          productsList.find(
            (p: any) =>
              cleanItemName &&
              String(p.name || "").trim().toLowerCase() === cleanItemName
          ) ||
          null;

        const targetProductId = matchedProduct?.id || rawItemProdId;
        if (!targetProductId) continue;

        // Verificar si el producto tiene una receta activa
        let activeRecipe: any = null;
        try {
          const { data: recipeRow } = await admin
            .from("recipes")
            .select("*")
            .eq("business_id", businessId)
            .eq("product_id", targetProductId)
            .eq("status", "active")
            .maybeSingle();
          activeRecipe = recipeRow || null;
        } catch {
          activeRecipe = null;
        }

        if (activeRecipe) {
          // 2A. Devolver ingredientes obligatorios de la receta al inventario
          const { data: ingredients } = await admin
            .from("recipe_ingredients")
            .select("*")
            .eq("recipe_id", activeRecipe.id);

          const mandatoryIngredients = (ingredients || []).filter((ri: any) => !ri.is_optional);
          const portions = Math.max(1, Number(activeRecipe.portions || 1));
          const targetLocId = activeRecipe.location_id || defaultLocationId;

          for (const ri of mandatoryIngredients) {
            const returnQty = Number(((qty * Number(ri.quantity || 0)) / portions).toFixed(4));
            if (returnQty <= 0) continue;

            const { data: stockRows } = await admin
              .from("inventory_stock")
              .select("*")
              .eq("business_id", businessId)
              .eq("product_id", ri.product_id);

            const stockList = Array.isArray(stockRows) ? stockRows : [];
            const stockRow =
              stockList.find((s: any) => targetLocId && s.location_id === targetLocId) ||
              stockList[0] ||
              null;

            if (stockRow) {
              const newStockQty = Number((Number(stockRow.quantity || 0) + returnQty).toFixed(4));
              await admin
                .from("inventory_stock")
                .update({ quantity: newStockQty, updated_at: nowIso })
                .eq("id", stockRow.id)
                .eq("business_id", businessId);
              stockRow.quantity = newStockQty;
            } else if (targetLocId) {
              await admin.from("inventory_stock").insert({
                business_id: businessId,
                product_id: ri.product_id,
                location_id: targetLocId,
                quantity: returnQty,
                min_stock: 0,
                max_stock: null,
                cost: 0,
                updated_at: nowIso,
              });
            }

            const ingProduct = productsList.find((p: any) => p.id === ri.product_id);
            if (ingProduct) {
              const prevMeta =
                typeof ingProduct.metadata === "object" && ingProduct.metadata !== null
                  ? ingProduct.metadata
                  : {};
              const baseStock =
                prevMeta.stock_quantity !== undefined
                  ? Number(prevMeta.stock_quantity)
                  : Number(ingProduct.stock ?? 0);
              const nextMetaStock = Number((baseStock + returnQty).toFixed(4));
              const updatedMeta = { ...prevMeta, stock_quantity: nextMetaStock };

              await admin
                .from("products")
                .update({ metadata: updatedMeta, updated_at: nowIso })
                .eq("id", ri.product_id)
                .eq("business_id", businessId);
              ingProduct.metadata = updatedMeta;
            }

            await admin.from("inventory_movements").insert({
              business_id: businessId,
              product_id: ri.product_id,
              location_id: stockRow?.location_id || targetLocId,
              movement_type: "entry",
              quantity: returnQty,
              cost_per_unit: Number(stockRow?.cost || 0),
              reference_id: documentId,
              reference_type: "sale_cancellation",
              notes: `Devolución de ingrediente por anulación de venta ${documentNumber}`,
              created_by: userId || null,
              created_at: nowIso,
            });
          }
        } else {
          // 2B. Devolver stock directo del producto al inventario
          const { data: stockRows } = await admin
            .from("inventory_stock")
            .select("*")
            .eq("business_id", businessId)
            .eq("product_id", targetProductId);

          const stockList = Array.isArray(stockRows) ? stockRows : [];
          const stockRow =
            stockList.find((s: any) => defaultLocationId && s.location_id === defaultLocationId) ||
            stockList[0] ||
            null;

          if (stockRow) {
            const newStockQty = Number((Number(stockRow.quantity || 0) + qty).toFixed(4));
            await admin
              .from("inventory_stock")
              .update({ quantity: newStockQty, updated_at: nowIso })
              .eq("id", stockRow.id)
              .eq("business_id", businessId);
            stockRow.quantity = newStockQty;
          } else if (defaultLocationId) {
            await admin.from("inventory_stock").insert({
              business_id: businessId,
              product_id: targetProductId,
              location_id: defaultLocationId,
              quantity: qty,
              min_stock: 0,
              max_stock: null,
              cost: 0,
              updated_at: nowIso,
            });
          }

          if (matchedProduct) {
            const prevMeta =
              typeof matchedProduct.metadata === "object" && matchedProduct.metadata !== null
                ? matchedProduct.metadata
                : {};
            const baseStock =
              prevMeta.stock_quantity !== undefined
                ? Number(prevMeta.stock_quantity)
                : Number(matchedProduct.stock ?? 0);
            const nextMetaStock = Number((baseStock + qty).toFixed(4));
            const updatedMeta = { ...prevMeta, stock_quantity: nextMetaStock };

            await admin
              .from("products")
              .update({ metadata: updatedMeta, updated_at: nowIso })
              .eq("id", matchedProduct.id)
              .eq("business_id", businessId);
            matchedProduct.metadata = updatedMeta;
          }

          await admin.from("inventory_movements").insert({
            business_id: businessId,
            product_id: targetProductId,
            location_id: stockRow?.location_id || defaultLocationId,
            movement_type: "entry",
            quantity: qty,
            cost_per_unit: Number(stockRow?.cost || 0),
            reference_id: documentId,
            reference_type: "sale_cancellation",
            notes: `Devolución de stock por anulación de venta ${documentNumber}`,
            created_by: userId || null,
            created_at: nowIso,
          });
        }
      }
    } catch (stockErr) {
      console.warn("[reverseSaleEffectsOnCancel] Aviso al revertir stock/recetas:", stockErr);
    }
  }

  // 3. Revertir movimientos de caja (cash_movements) vinculados a la venta o comanda
  for (const refId of refIds) {
    try {
      await admin
        .from("cash_movements")
        .delete()
        .eq("business_id", businessId)
        .eq("reference_id", refId);
    } catch (cashErr) {
      console.warn("[reverseSaleEffectsOnCancel] Aviso al revertir cash_movements:", cashErr);
    }
  }

  // 4. Revertir crédito de cliente (customers.credit_used y accounts_receivable)
  try {
    let creditDecremented = false;
    const { data: arRows } = await admin
      .from("accounts_receivable")
      .select("*")
      .eq("business_id", businessId);

    const matchingAr = (arRows || []).filter(
      (ar: any) =>
        ar.status !== "cancelled" &&
        (refIds.includes(ar.order_id) ||
          refIds.includes(ar.sale_document_id) ||
          refIds.includes(ar.id))
    );

    for (const ar of matchingAr) {
      const amountToRelease = Number(ar.balance ?? ar.amount ?? total ?? 0);
      await admin
        .from("accounts_receivable")
        .update({
          status: "cancelled",
          balance: 0,
          updated_at: nowIso,
        })
        .eq("id", ar.id)
        .eq("business_id", businessId);

      if (ar.customer_id && amountToRelease > 0) {
        const { data: cust } = await admin
          .from("customers")
          .select("*")
          .eq("id", ar.customer_id)
          .eq("business_id", businessId)
          .maybeSingle();

        if (cust) {
          const newCreditUsed = Math.max(
            0,
            Number((Number(cust.credit_used || 0) - amountToRelease).toFixed(2))
          );
          await admin
            .from("customers")
            .update({
              credit_used: newCreditUsed,
              updated_at: nowIso,
            })
            .eq("id", cust.id)
            .eq("business_id", businessId);
          creditDecremented = true;
        }
      }
    }

    const isCreditSale =
      String(paymentMethod || "").toLowerCase() === "credit" ||
      String(paymentStatus || "").toLowerCase() === "credit";

    if (!creditDecremented && isCreditSale && customerId && total > 0) {
      const { data: cust } = await admin
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .eq("business_id", businessId)
        .maybeSingle();

      if (cust) {
        const newCreditUsed = Math.max(
          0,
          Number((Number(cust.credit_used || 0) - Number(total)).toFixed(2))
        );
        await admin
          .from("customers")
          .update({
            credit_used: newCreditUsed,
            updated_at: nowIso,
          })
          .eq("id", cust.id)
          .eq("business_id", businessId);
      }
    }
  } catch (creditErr) {
    console.warn("[reverseSaleEffectsOnCancel] Aviso al revertir crédito de cliente:", creditErr);
  }

  // 5. Registrar en audit_logs quién anuló, cuándo y el motivo
  try {
    await admin.from("audit_logs").insert({
      business_id: businessId,
      user_id: userId || null,
      authorized_by: authorizedBy || userId || null,
      action: "sale.cancelled",
      entity: "sale_document",
      entity_type: "business_sale_document",
      entity_id: documentId,
      details: {
        reason: reason || "Sin motivo especificado",
        cancelled_at: nowIso,
        cancelled_by: userId || null,
        document_number: documentNumber,
        total,
        previous_status: previousStatus || "paid",
        new_status: "cancelled",
      },
      metadata: {
        original_action: "cancel_sale_document",
        document_number: documentNumber,
        previous_status: previousStatus || "paid",
        new_status: "cancelled",
        cancellation_reason: reason || "Sin motivo especificado",
        reason: reason || "Sin motivo especificado",
        cancelled_at: nowIso,
        cancelled_by: userId || null,
      },
      created_at: nowIso,
    });
  } catch (auditInsertErr) {
    console.warn("[reverseSaleEffectsOnCancel] Aviso al insertar en audit_logs:", auditInsertErr);
  }
}

export async function cancelBusinessSaleDocument(
  businessId: string,
  documentId: string,
  options?: {
    userId?: string;
    authorizedBy?: string;
    reason?: string;
  }
): Promise<{ success: boolean; document?: BusinessSaleDocument; error?: string }> {
  try {
    const admin = await getSupabaseAdminClient();
    const nowIso = new Date().toISOString();

    if (options?.reason !== undefined && options.reason.trim().length < 3) {
      return {
        success: false,
        error: "Debe especificar un motivo de anulación de al menos 3 caracteres.",
      };
    }

    // 1. Validar aislamiento multi-tenant estricto en business_sale_documents
    const { data: existingDoc, error: fetchErr } = await admin
      .from("business_sale_documents")
      .select("*")
      .eq("id", documentId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (fetchErr || !existingDoc) {
      // Verificar si es un pedido de restaurante consultado en Ventas
      const { data: orderRow } = await admin
        .from("restaurant_orders")
        .select("*, restaurant_order_items(*)")
        .eq("id", documentId)
        .eq("business_id", businessId)
        .maybeSingle();

      if (orderRow) {
        if (orderRow.status === "cancelled") {
          return { success: false, error: "El pedido ya se encuentra cancelado." };
        }
        const reasonText = options?.reason?.trim();
        const updatedNotes = reasonText
          ? orderRow.notes
            ? `${orderRow.notes} | Cancelación: ${reasonText}`
            : `Cancelación: ${reasonText}`
          : orderRow.notes;

        const { data: updatedOrder, error: orderUpdateErr } = await admin
          .from("restaurant_orders")
          .update({
            status: "cancelled",
            notes: updatedNotes,
            updated_at: nowIso,
          })
          .eq("id", documentId)
          .eq("business_id", businessId)
          .select("*, restaurant_order_items(*)")
          .single();

        if (orderUpdateErr || !updatedOrder) {
          return { success: false, error: "No se pudo cancelar el pedido." };
        }

        // Sincronizar también documento comercial vinculado si existe
        let linkedSaleDocId: string | null = null;
        try {
          const { data: linkedBsd } = await admin
            .from("business_sale_documents")
            .select("id, status, notes")
            .eq("business_id", businessId)
            .eq("restaurant_order_id", documentId)
            .maybeSingle();

          if (linkedBsd && linkedBsd.status !== "cancelled") {
            linkedSaleDocId = linkedBsd.id;
            const bsdNotes = reasonText
              ? linkedBsd.notes
                ? `${linkedBsd.notes} | Cancelación: ${reasonText}`
                : `Cancelación: ${reasonText}`
              : linkedBsd.notes;
            await admin
              .from("business_sale_documents")
              .update({
                status: "cancelled",
                notes: bsdNotes,
                updated_at: nowIso,
              })
              .eq("id", linkedBsd.id)
              .eq("business_id", businessId);
          }
        } catch {
          // Ignorar si no existe
        }

        if (updatedOrder.table_id) {
          try {
            // Verificar si existen otros pedidos activos en la misma mesa antes de liberarla
            const { data: remainingOrders } = await admin
              .from("restaurant_orders")
              .select("id, status, payment_status")
              .eq("table_id", updatedOrder.table_id)
              .eq("business_id", businessId)
              .neq("id", updatedOrder.id)
              .neq("status", "cancelled");

            const hasActiveOrders = (remainingOrders || []).some(
              (o) => o.status !== "delivered" || o.payment_status !== "paid"
            );

            if (!hasActiveOrders) {
              await admin
                .from("restaurant_tables")
                .update({ status: "available", current_order_id: null, updated_at: nowIso })
                .eq("id", updatedOrder.table_id)
                .eq("business_id", businessId);
            } else {
              // Si la mesa sigue teniendo pedidos activos, reasignar current_order_id
              const nextActive = remainingOrders?.find((o) => o.status !== "cancelled");
              if (nextActive) {
                await admin
                  .from("restaurant_tables")
                  .update({ current_order_id: nextActive.id, updated_at: nowIso })
                  .eq("id", updatedOrder.table_id)
                  .eq("business_id", businessId);
              }
            }
          } catch (tblErr) {
            console.warn("[cancelBusinessSaleDocument] Aviso al verificar estado de mesa:", tblErr);
          }
        }

        const mapped = mapRestaurantOrderToDocument(updatedOrder, updatedOrder.restaurant_order_items || []);

        await reverseSaleEffectsOnCancel(admin, businessId, {
          documentId,
          documentNumber: mapped.documentNumber,
          restaurantOrderId: documentId,
          linkedSaleDocId,
          items: updatedOrder.restaurant_order_items || [],
          total: Number(updatedOrder.total || 0),
          paymentMethod: mapped.paymentMethod,
          paymentStatus: orderRow.payment_status,
          customerId: orderRow.customer_id,
          userId: options?.userId,
          authorizedBy: options?.authorizedBy,
          reason: reasonText,
          previousStatus: orderRow.status,
          nowIso,
        });

        return { success: true, document: mapped };
      }

      return { success: false, error: "Documento no encontrado o no pertenece a este negocio." };
    }

    const previousStatus = existingDoc.status;
    if (existingDoc.status === "cancelled" || existingDoc.status === "annulled") {
      return { success: false, error: "El documento ya se encuentra cancelado." };
    }

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

    // Si el documento está vinculado a un pedido de restaurante, sincronizar su cancelación
    if (existingDoc.restaurant_order_id) {
      try {
        await admin
          .from("restaurant_orders")
          .update({
            status: "cancelled",
            notes: updatedNotes,
            updated_at: nowIso,
          })
          .eq("id", existingDoc.restaurant_order_id)
          .eq("business_id", businessId);
      } catch (roErr) {
        console.warn("[cancelBusinessSaleDocument] Aviso al sincronizar cancelación de pedido:", roErr);
      }
    }

    // 3. Revertir stock, ingredientes de recetas, movimientos de caja, crédito y registrar en audit_logs [POS-005]
    await reverseSaleEffectsOnCancel(admin, businessId, {
      documentId,
      documentNumber: existingDoc.document_number,
      restaurantOrderId: existingDoc.restaurant_order_id || null,
      items: Array.isArray(existingDoc.items) ? existingDoc.items : [],
      total: Number(existingDoc.total || 0),
      paymentMethod: existingDoc.payment_method,
      paymentStatus: existingDoc.status,
      customerId: existingDoc.customer_id,
      userId: options?.userId,
      authorizedBy: options?.authorizedBy,
      reason: reasonText,
      previousStatus,
      nowIso,
    });

    // 4. Auditoría de cancelación centralizada y no bloqueante
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

// Cache en memoria para determinar si la columna restaurant_order_id existe en business_sale_documents
let _hasBsdRestaurantOrderIdCol: boolean | null = null;

async function fetchBsdSalesSummary(
  admin: any,
  businessId: string,
  minIssuedAt?: string
): Promise<Array<{ id: string; total: number; status: string; restaurant_order_id?: string | null }>> {
  const selectFields = _hasBsdRestaurantOrderIdCol === false
    ? "id, total, status"
    : "id, total, status, restaurant_order_id";

  let query = admin
    .from("business_sale_documents")
    .select(selectFields)
    .eq("business_id", businessId)
    .neq("status", "cancelled");

  if (minIssuedAt) {
    query = query.gte("issued_at", minIssuedAt);
  }

  const res = await query;
  if (res.error) {
    if (res.error.code === "42703" || res.error.message?.includes("restaurant_order_id")) {
      _hasBsdRestaurantOrderIdCol = false;
      let fallbackQuery = admin
        .from("business_sale_documents")
        .select("id, total, status")
        .eq("business_id", businessId)
        .neq("status", "cancelled");
      if (minIssuedAt) {
        fallbackQuery = fallbackQuery.gte("issued_at", minIssuedAt);
      }
      const fallbackRes = await fallbackQuery;
      return (fallbackRes.data as any) || [];
    }
    console.warn("[getWorkspaceDashboardData] Aviso al consultar BSD:", res.error.message);
    return [];
  }

  if (_hasBsdRestaurantOrderIdCol === null) {
    _hasBsdRestaurantOrderIdCol = true;
  }
  return (res.data as any) || [];
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
    const [todayBsdRows, { data: todayOrderRows, error: todayOrderErr }] = await Promise.all([
      fetchBsdSalesSummary(admin, businessId, startOfTodayIso),
      admin
        .from("restaurant_orders")
        .select("id, total, status")
        .eq("business_id", businessId)
        .eq("status", "delivered")
        .gte("created_at", startOfTodayIso),
    ]);

    if (todayOrderErr) {
      console.warn("[getWorkspaceDashboardData] Aviso al consultar comandas de hoy:", todayOrderErr.message);
    }

    const seenTodayIds = new Set<string>();
    let todaySalesTotal = 0;
    let todaySalesCount = 0;

    for (const row of todayBsdRows || []) {
      if ((row as any).status === "cancelled" || (row as any).status === "annulled") continue;
      seenTodayIds.add(row.id);
      if ((row as any).restaurant_order_id) {
        seenTodayIds.add((row as any).restaurant_order_id);
      }
      todaySalesTotal += Number(row.total || 0);
      todaySalesCount++;
    }

    for (const row of todayOrderRows || []) {
      if ((row as any).status === "cancelled" || (row as any).status === "annulled") continue;
      if (!seenTodayIds.has(row.id)) {
        seenTodayIds.add(row.id);
        todaySalesTotal += Number(row.total || 0);
        todaySalesCount++;
      }
    }

    // 3. Documentos recientes y conteo total histórico
    const [{ data: recentRows, count: totalCount, error: recentErr }, { data: recentOrderRows, count: orderTotalCount }] = await Promise.all([
      admin
        .from("business_sale_documents")
        .select("*", { count: "exact" })
        .eq("business_id", businessId)
        .order("issued_at", { ascending: false })
        .limit(8),
      admin
        .from("restaurant_orders")
        .select("*, restaurant_order_items(*)", { count: "exact" })
        .eq("business_id", businessId)
        .in("status", ["delivered", "cancelled"])
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    if (recentErr) {
      console.error("[getWorkspaceDashboardData] Error al consultar documentos recientes:", recentErr);
    }

    const mappedBsdRecent = (recentRows || []).map(mapDbDocToInterface);
    const mappedOrdersRecent = (recentOrderRows || []).map((o: any) =>
      mapRestaurantOrderToDocument(o, o.restaurant_order_items || [])
    );

    const seenRecentIds = new Set<string>();
    const unifiedRecent: BusinessSaleDocument[] = [];
    for (const d of mappedBsdRecent) {
      seenRecentIds.add(d.id);
      unifiedRecent.push(d);
    }
    for (const od of mappedOrdersRecent) {
      if (!seenRecentIds.has(od.id)) {
        seenRecentIds.add(od.id);
        unifiedRecent.push(od);
      }
    }
    unifiedRecent.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
    const recentDocuments = unifiedRecent.slice(0, 8);

    // 4. Total histórico vendido (no cancelado)
    const [allActiveRows, { data: allActiveOrderRows }] = await Promise.all([
      fetchBsdSalesSummary(admin, businessId),
      admin
        .from("restaurant_orders")
        .select("id, total, status")
        .eq("business_id", businessId)
        .eq("status", "delivered"),
    ]);

    const seenAllTimeIds = new Set<string>();
    let allTimeSalesTotal = 0;
    let totalSalesCount = 0;

    for (const row of allActiveRows || []) {
      if ((row as any).status === "cancelled" || (row as any).status === "annulled") continue;
      seenAllTimeIds.add(row.id);
      if ((row as any).restaurant_order_id) {
        seenAllTimeIds.add((row as any).restaurant_order_id);
      }
      allTimeSalesTotal += Number(row.total || 0);
      totalSalesCount++;
    }

    for (const row of allActiveOrderRows || []) {
      if ((row as any).status === "cancelled" || (row as any).status === "annulled") continue;
      if (!seenAllTimeIds.has(row.id)) {
        seenAllTimeIds.add(row.id);
        allTimeSalesTotal += Number(row.total || 0);
        totalSalesCount++;
      }
    }

    return {
      todaySalesTotal,
      todaySalesCount,
      totalSalesCount,
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

/**
 * Registra el pago financiero de un documento o pedido en Ventas/Caja.
 * Soporta tanto comprobantes de business_sale_documents como pedidos de restaurant_orders.
 * Es idempotente y registra evento de auditoría contable.
 */
export async function registerBusinessDocumentPayment(
  businessId: string,
  documentId: string,
  paymentData?: { paymentMethod?: string; notes?: string; userId?: string }
): Promise<{ success: boolean; document?: BusinessSaleDocument; error?: string }> {
  try {
    const admin = await getSupabaseAdminClient();
    const nowIso = new Date().toISOString();

    // 1. Revisar business_sale_documents
    const { data: bsd } = await admin
      .from("business_sale_documents")
      .select("*")
      .eq("id", documentId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (bsd) {
      if (bsd.status === "cancelled") {
        return { success: false, error: "No se puede registrar pago para un documento cancelado." };
      }
      // Idempotencia: si ya está pagado o completado, retornar el comprobante existente
      if (bsd.status === "paid" || bsd.status === "completed") {
        return { success: true, document: mapDbDocToInterface(bsd) };
      }

      const effectivePaymentMethod = paymentData?.paymentMethod || bsd.payment_method || "cash";
      const { data: updatedBsd, error: bsdErr } = await admin
        .from("business_sale_documents")
        .update({
          status: "paid",
          payment_method: effectivePaymentMethod,
          updated_at: nowIso,
        })
        .eq("id", documentId)
        .eq("business_id", businessId)
        .select()
        .single();

      if (bsdErr || !updatedBsd) {
        return { success: false, error: "Error al registrar el pago." };
      }

      if (!bsd.restaurant_order_id && Number(bsd.total || 0) > 0 && effectivePaymentMethod !== "credit") {
        try {
          const { getActiveCashSession, recordCashMovement } = await import("@/lib/cash/cash-service");
          const activeSession = await getActiveCashSession(businessId, undefined, paymentData?.userId);
          if (activeSession) {
            const pm = String(effectivePaymentMethod || "cash").toLowerCase();
            const movType =
              pm === "cash" || pm === "efectivo"
                ? "sale_cash"
                : pm === "card" || pm === "tarjeta" || pm === "datáfono"
                ? "sale_card"
                : "sale_digital";

            await recordCashMovement(
              businessId,
              {
                sessionId: activeSession.id,
                movementType: movType,
                amount: Number(bsd.total),
                referenceId: documentId,
                referenceType: "sale_document",
                notes: `Pago de documento ${bsd.document_number} (${effectivePaymentMethod})`,
              },
              paymentData?.userId || null
            );
          }
        } catch (cashErr) {
          console.warn("[registerBusinessDocumentPayment] Aviso al registrar movimiento en turno de caja:", cashErr);
        }
      }

      try {
        await logAuditAction({
          action: "payment_registered",
          businessId,
          userId: paymentData?.userId,
          entityType: "business_sale_document",
          entityId: documentId,
          oldData: { status: bsd.status, payment_method: bsd.payment_method },
          newData: { status: "paid", payment_method: effectivePaymentMethod },
          metadata: {
            document_number: bsd.document_number,
            payment_method: effectivePaymentMethod,
            amount: bsd.total,
            notes: paymentData?.notes,
            paid_at: nowIso,
          },
        });
      } catch (auditErr) {
        console.warn("[registerBusinessDocumentPayment] Aviso de auditoría:", auditErr);
      }

      return { success: true, document: mapDbDocToInterface(updatedBsd) };
    }

    // 2. Revisar restaurant_orders
    const { data: order } = await admin
      .from("restaurant_orders")
      .select("*, restaurant_order_items(*)")
      .eq("id", documentId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (order) {
      if (order.status === "cancelled") {
        return { success: false, error: "No se puede registrar pago para un pedido cancelado." };
      }
      // Idempotencia: si ya está pagado, retornar sin duplicar
      if (order.payment_status === "paid") {
        return {
          success: true,
          document: mapRestaurantOrderToDocument(order, order.restaurant_order_items || []),
        };
      }

      const { data: updatedOrder, error: orderErr } = await admin
        .from("restaurant_orders")
        .update({
          payment_status: "paid",
          updated_at: nowIso,
        })
        .eq("id", documentId)
        .eq("business_id", businessId)
        .select("*, restaurant_order_items(*)")
        .single();

      if (orderErr || !updatedOrder) {
        return { success: false, error: "Error al registrar el pago del pedido." };
      }

      try {
        await logAuditAction({
          action: "payment_registered",
          businessId,
          userId: paymentData?.userId,
          entityType: "restaurant_order",
          entityId: documentId,
          oldData: { payment_status: order.payment_status },
          newData: { payment_status: "paid" },
          metadata: {
            order_number: order.order_number,
            payment_method: paymentData?.paymentMethod || "cash",
            amount: order.total,
            notes: paymentData?.notes,
            paid_at: nowIso,
          },
        });
      } catch (auditErr) {
        console.warn("[registerBusinessDocumentPayment] Aviso de auditoría:", auditErr);
      }

      return {
        success: true,
        document: mapRestaurantOrderToDocument(updatedOrder, updatedOrder.restaurant_order_items || []),
      };
    }

    return { success: false, error: "Documento no encontrado o no pertenece a este negocio." };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al registrar pago." };
  }
}



