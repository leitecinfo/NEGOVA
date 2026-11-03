import { createClient } from "@/lib/supabase/server";
import {
  Quotation,
  QuotationStatus,
  CreateQuotationInput,
  CreateQuotationInputSchema,
  QuotationFilterParams,
  QuotationKPIs,
} from "./types";
import { calculateCartSummary, formatCOP } from "../pos/types";

// ==============================================================================
// SERVICIO DE COTIZACIONES — NEGOVA POS [POS-004]
// ==============================================================================

async function getDbClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (serviceKey && supabaseUrl) {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    return createAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return await createClient();
}

/**
 * Mapea una fila de PostgreSQL a la interfaz Quotation evaluando vigencia dinámica.
 */
function mapDbRowToQuotation(row: any): Quotation {
  const now = new Date();
  const validUntil = new Date(row.valid_until);
  const diffTime = validUntil.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const isExpired = row.status === "pending" && diffTime < 0;

  // Si está vencida en tiempo real y el estado sigue en "pending", se presenta como expired
  let computedStatus: QuotationStatus = row.status;
  if (isExpired && row.status === "pending") {
    computedStatus = "expired";
  }

  return {
    id: row.id,
    businessId: row.business_id,
    quotationNumber: row.quotation_number,
    customerId: row.customer_id || null,
    customerName: row.customer_name || "Cliente General",
    customerPhone: row.customer_phone || null,
    customerEmail: row.customer_email || null,
    items: Array.isArray(row.items) ? row.items : [],
    subtotal: Number(row.subtotal || 0),
    discountTotal: Number(row.discount_total || 0),
    taxTotal: Number(row.tax_total || 0),
    total: Number(row.total || 0),
    currency: "COP",
    validUntil: row.valid_until,
    status: computedStatus,
    isExpired,
    daysRemaining,
    convertedOrderId: row.converted_order_id || null,
    convertedAt: row.converted_at || null,
    notes: row.notes || null,
    createdBy: row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Genera el siguiente número correlativo para la cotización del negocio.
 * Prefijo: COT-YYYY-XXXX (independiente de facturación y comandas).
 */
export async function getNextQuotationNumber(
  businessId: string,
  year: number = new Date().getFullYear()
): Promise<string> {
  const supabase = await getDbClient();

  try {
    const { data, error } = await (supabase as any).rpc("get_next_quotation_number", {
      p_business_id: businessId,
      p_year: year,
    });

    if (!error && data) {
      return data as string;
    }
  } catch (rpcErr) {
    // Fallback defensivo si el RPC no está presente o falla en mocks
  }

  // Fallback: consulta la secuencia o el máximo existente en public.quotations
  try {
    const { data: seqData } = await supabase
      .from("quotation_sequences")
      .select("current_number")
      .eq("business_id", businessId)
      .eq("year", year)
      .maybeSingle();

    let nextNumber = (seqData?.current_number || 0) + 1;

    // Verificar contra las cotizaciones existentes
    const { data: maxDoc } = await supabase
      .from("quotations")
      .select("quotation_number")
      .eq("business_id", businessId)
      .ilike("quotation_number", `COT-${year}-%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxDoc?.quotation_number) {
      const match = maxDoc.quotation_number.match(/^COT-\d{4}-(\d+)$/);
      if (match && parseInt(match[1], 10) >= nextNumber) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    await supabase.from("quotation_sequences").upsert({
      business_id: businessId,
      year,
      current_number: nextNumber,
      updated_at: new Date().toISOString(),
    });

    return `COT-${year}-${String(nextNumber).padStart(4, "0")}`;
  } catch {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `COT-${year}-${randomSuffix}`;
  }
}

/**
 * Crea una nueva cotización comercial a partir de los productos en carrito.
 * Invariante P1 [POS-004]: NO afecta inventario (0 movimientos de stock)
 *                         y NO afecta caja (0 movimientos de dinero).
 */
export async function createQuotation(
  businessId: string,
  rawInput: CreateQuotationInput,
  userId?: string | null
): Promise<Quotation> {
  if (!businessId) throw new Error("businessId es requerido.");

  const input = CreateQuotationInputSchema.parse(rawInput);
  const supabase = await getDbClient();

  // 1. Recalcular valores exactos del carrito
  const summary = calculateCartSummary(input.items);
  const now = new Date();
  const currentYear = now.getFullYear();

  // 2. Determinar fecha de expiración
  let validUntilDate: Date;
  if (input.validUntilDate) {
    validUntilDate = new Date(input.validUntilDate);
    // Establecer al final del día
    validUntilDate.setHours(23, 59, 59, 999);
  } else {
    validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + (input.validDays || 7));
    validUntilDate.setHours(23, 59, 59, 999);
  }

  // 3. Generar número correlativo atómico
  const quotationNumber = await getNextQuotationNumber(businessId, currentYear);

  // 4. Si se seleccionó cliente registrado y no vino nombre, completar datos desde BD
  let customerName = input.customerName || "Cliente General";
  let customerPhone = input.customerPhone || null;
  let customerEmail = input.customerEmail || null;

  if (input.customerId) {
    const { data: customer } = await supabase
      .from("customers")
      .select("name, phone, email")
      .eq("business_id", businessId)
      .eq("id", input.customerId)
      .maybeSingle();

    if (customer) {
      customerName = customer.name;
      if (!customerPhone && customer.phone) customerPhone = customer.phone;
      if (!customerEmail && customer.email) customerEmail = customer.email;
    }
  }

  // 5. Inserción atómica en base de datos
  const newRow = {
    business_id: businessId,
    quotation_number: quotationNumber,
    customer_id: input.customerId || null,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: customerEmail,
    items: input.items,
    subtotal: summary.subtotal,
    discount_total: summary.discount,
    tax_total: summary.tax,
    total: summary.total,
    currency: "COP",
    valid_until: validUntilDate.toISOString(),
    status: "pending",
    notes: input.notes || null,
    created_by: userId || null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  const { data: inserted, error } = await supabase
    .from("quotations")
    .insert(newRow)
    .select()
    .single();

  if (error || !inserted) {
    throw new Error(`Error al persistir la cotización: ${error?.message || "Sin datos retornados"}`);
  }

  return mapDbRowToQuotation(inserted);
}

/**
 * Consulta el listado paginado y filtrado de cotizaciones de un negocio.
 */
export async function getQuotations(params: QuotationFilterParams): Promise<{
  quotations: Quotation[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}> {
  const {
    businessId,
    search,
    status = "all",
    customerId,
    startDate,
    endDate,
    page = 1,
    pageSize = 10,
  } = params;

  if (!businessId) throw new Error("businessId es requerido.");

  const supabase = await getDbClient();
  let query = supabase
    .from("quotations")
    .select("*", { count: "exact" })
    .eq("business_id", businessId);

  // Filtro por cliente
  if (customerId) {
    query = query.eq("customer_id", customerId);
  }

  // Filtro por estado
  const nowIso = new Date().toISOString();
  if (status && status !== "all") {
    if (status === "expired") {
      // Expiradas: estado pending y fecha de vigencia vencida
      query = query.eq("status", "pending").lt("valid_until", nowIso);
    } else if (status === "pending") {
      // Pendientes vigentes: estado pending y fecha de vigencia >= hoy
      query = query.eq("status", "pending").gte("valid_until", nowIso);
    } else {
      query = query.eq("status", status);
    }
  }

  // Filtro por fecha de creación
  if (startDate) {
    query = query.gte("created_at", startDate);
  }
  if (endDate) {
    query = query.lte("created_at", endDate);
  }

  // Búsqueda de texto
  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    query = query.or(`quotation_number.ilike.${q},customer_name.ilike.${q},customer_phone.ilike.${q}`);
  }

  // Orden cronológico descendente
  query = query.order("created_at", { ascending: false });

  // Paginación
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    throw new Error(`Error al consultar cotizaciones: ${error.message}`);
  }

  const quotations = (data || []).map(mapDbRowToQuotation);
  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return {
    quotations,
    totalCount,
    totalPages,
    currentPage: page,
    pageSize,
  };
}

/**
 * Obtiene el detalle de una cotización específica de un comercio.
 */
export async function getQuotationById(
  businessId: string,
  quotationId: string
): Promise<Quotation | null> {
  const supabase = await getDbClient();

  const { data, error } = await supabase
    .from("quotations")
    .select("*")
    .eq("business_id", businessId)
    .eq("id", quotationId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapDbRowToQuotation(data);
}

/**
 * Marca una cotización como convertida a venta real asociando el ID del pedido generado.
 */
export async function convertQuotationToSale(
  businessId: string,
  quotationId: string,
  orderId?: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getDbClient();

  const { error } = await supabase
    .from("quotations")
    .update({
      status: "converted",
      converted_order_id: orderId || null,
      converted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId)
    .eq("id", quotationId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Anula una cotización activa.
 */
export async function cancelQuotation(
  businessId: string,
  quotationId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getDbClient();

  const { error } = await supabase
    .from("quotations")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId)
    .eq("id", quotationId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Retorna las métricas y KPIs de cotizaciones del negocio.
 */
export async function getQuotationsKPIs(businessId: string): Promise<QuotationKPIs> {
  const supabase = await getDbClient();

  const { data, error } = await supabase
    .from("quotations")
    .select("status, total, valid_until")
    .eq("business_id", businessId);

  if (error || !data) {
    return {
      totalCount: 0,
      pendingCount: 0,
      pendingTotalAmount: 0,
      convertedCount: 0,
      convertedTotalAmount: 0,
      expiredCount: 0,
      conversionRatePercentage: 0,
    };
  }

  const now = new Date();
  let pendingCount = 0;
  let pendingTotalAmount = 0;
  let convertedCount = 0;
  let convertedTotalAmount = 0;
  let expiredCount = 0;

  for (const row of data) {
    const total = Number(row.total || 0);
    const validUntil = new Date(row.valid_until);
    const isExpired = row.status === "pending" && validUntil < now;

    if (row.status === "converted") {
      convertedCount++;
      convertedTotalAmount += total;
    } else if (isExpired) {
      expiredCount++;
    } else if (row.status === "pending") {
      pendingCount++;
      pendingTotalAmount += total;
    }
  }

  const totalCount = data.length;
  const closedQuotations = convertedCount + expiredCount;
  const conversionRatePercentage = closedQuotations > 0
    ? Math.round((convertedCount / (totalCount || 1)) * 100)
    : 0;

  return {
    totalCount,
    pendingCount,
    pendingTotalAmount,
    convertedCount,
    convertedTotalAmount,
    expiredCount,
    conversionRatePercentage,
  };
}
