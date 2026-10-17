import { InvoiceRecord, BillingFilterParams, BillingListResult, InvoiceStatus } from "./types";

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
 * Normaliza el registro de base de datos a InvoiceRecord
 */
function mapToInvoiceRecord(row: any): InvoiceRecord {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    businessId: row.business_id,
    businessName: row.business_name,
    businessSlug: row.business_slug,
    planId: row.plan_id,
    planName: row.plan_name,
    billingInterval: row.billing_interval,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    paymentMethod: row.payment_method,
    paymentReference: row.payment_reference,
    issuedAt: row.issued_at,
    dueDate: row.due_date,
    paidAt: row.paid_at,
    notes: row.notes,
    pdfUrl: row.pdf_url,
    pdfStoragePath: row.pdf_storage_path,
    lastEmailSentAt: row.last_email_sent_at,
    lastSentToEmail: row.last_sent_to_email,
  };
}

export async function getBillingList(params: BillingFilterParams = {}): Promise<BillingListResult> {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize || 10));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const admin = await getSupabaseAdminClient();
  let query = admin.from("platform_invoices").select("*", { count: "exact" });

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  if (params.planId && params.planId !== "all") {
    query = query.eq("plan_id", params.planId);
  }

  if (params.businessId && params.businessId !== "all") {
    query = query.eq("business_id", params.businessId);
  }

  if (params.search && params.search.trim()) {
    const q = params.search.toLowerCase().trim();
    // Use or for invoice_number, business_name, business_slug, payment_reference
    query = query.or(`invoice_number.ilike.%${q}%,business_name.ilike.%${q}%,business_slug.ilike.%${q}%,payment_reference.ilike.%${q}%`);
  }

  // Obtenemos los registros paginados
  query = query.order("issued_at", { ascending: false }).range(from, to);
  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching billing list:", error);
    throw new Error("No se pudo obtener el listado de comprobantes");
  }

  const invoices = (data || []).map(mapToInvoiceRecord);
  const totalCount = count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Para KPIs necesitamos hacer consultas de agregación separadas, dado que PostgREST no agrupa fácilmente aquí.
  // Como simplificación según requerimientos actuales, calcularemos las sumas globales
  let totalBilledCOP = 0;
  let totalPaidCOP = 0;
  let totalPendingCOP = 0;
  let paidCount = 0;
  let pendingCount = 0;
  let voidCount = 0;

  try {
    const { data: statsData } = await admin.from("platform_invoices").select("amount, status");
    if (statsData) {
      statsData.forEach(row => {
        if (row.status !== "void") totalBilledCOP += row.amount;
        if (row.status === "paid") { totalPaidCOP += row.amount; paidCount++; }
        if (row.status === "pending") { totalPendingCOP += row.amount; pendingCount++; }
        if (row.status === "void") voidCount++;
      });
    }
  } catch(e) {}

  return {
    invoices,
    totalCount,
    page,
    pageSize,
    totalPages,
    stats: {
      totalBilledCOP,
      totalPaidCOP,
      totalPendingCOP,
      paidCount,
      pendingCount,
      voidCount,
    },
  };
}

export async function registerInvoicePayment(
  invoiceId: string,
  data: {
    paymentMethod: InvoiceRecord["paymentMethod"];
    paymentReference: string;
    paidAt?: string;
    notes?: string;
    adminUserId?: string;
  }
): Promise<{ success: boolean; invoice?: InvoiceRecord; error?: string }> {
  try {
    const admin = await getSupabaseAdminClient();
    
    const { data: current, error: getErr } = await admin
      .from("platform_invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (getErr || !current) return { success: false, error: "Comprobante no encontrado" };

    const updates = {
      status: "paid",
      payment_method: data.paymentMethod,
      payment_reference: data.paymentReference.trim(),
      paid_at: data.paidAt || new Date().toISOString(),
      notes: data.notes || current.notes,
      updated_at: new Date().toISOString()
    };

    const { data: updatedData, error: upErr } = await admin
      .from("platform_invoices")
      .update(updates)
      .eq("id", invoiceId)
      .select()
      .single();

    if (upErr) return { success: false, error: upErr.message };

    // Auditoría (Asociado al negocio correspondente: current.business_id)
    const { logAuditAction } = await import("@/lib/audit/audit-service");
    await logAuditAction({
      businessId: current.business_id || null,
      userId: data.adminUserId || null,
      action: "update",
      entityType: "billing_receipt",
      entityId: invoiceId,
      metadata: {
        original_action: "register_payment_receipt",
        receiptNumber: current.invoice_number,
        businessName: current.business_name,
        amount: current.amount,
        method: data.paymentMethod,
        reference: data.paymentReference,
      },
    });

    return { success: true, invoice: mapToInvoiceRecord(updatedData) };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al registrar el pago" };
  }
}

export async function generateInvoicePdf(invoiceId: string): Promise<{
  success: boolean;
  base64?: string;
  filename?: string;
  pdfUrl?: string | null;
  error?: string;
}> {
  try {
    const admin = await getSupabaseAdminClient();
    const { data: current, error: getErr } = await admin
      .from("platform_invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (getErr || !current) return { success: false, error: "Comprobante no encontrado" };

    const inv = mapToInvoiceRecord(current);

    const { generateNegovaBillingPdf } = await import("@/lib/pdf/pdf-engine");
    const { uploadInvoicePdfBuffer } = await import("@/lib/storage/supabase-storage");

    let logoBase64: string | undefined = undefined;
    try {
      const fs = await import("fs");
      const path = await import("path");
      const logoPath = path.default.join(process.cwd(), "public/imagotipo texto blanco.png");
      if (fs.default.existsSync(logoPath)) {
        const logoBuffer = fs.default.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;
      }
    } catch (e) {}

    const pdfResult = generateNegovaBillingPdf({
      invoiceNumber: inv.invoiceNumber,
      businessName: inv.businessName,
      businessSlug: inv.businessSlug,
      planId: inv.planId,
      planName: inv.planName,
      billingInterval: inv.billingInterval === "annual" ? "yearly" : "monthly",
      amount: inv.amount,
      currency: "COP",
      status: inv.status,
      paymentMethod: inv.paymentMethod,
      paymentReference: inv.paymentReference,
      issuedAt: inv.issuedAt,
      dueDate: inv.dueDate,
      paidAt: inv.paidAt,
      notes: inv.notes,
      logoBase64,
    });

    let newPdfUrl = inv.pdfUrl;
    try {
      const storageRes = await uploadInvoicePdfBuffer(admin, inv.invoiceNumber, pdfResult.buffer);
      if (storageRes.url) {
        newPdfUrl = storageRes.url;
        await admin.from("platform_invoices").update({
          pdf_url: storageRes.url,
          pdf_storage_path: storageRes.storagePath,
          updated_at: new Date().toISOString()
        }).eq("id", invoiceId);
      }
    } catch (storageErr) {}

    return {
      success: true,
      base64: pdfResult.base64,
      filename: pdfResult.filename,
      pdfUrl: newPdfUrl || null,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al generar PDF del comprobante" };
  }
}

export async function sendInvoiceByEmail(
  invoiceId: string,
  recipientEmail?: string,
  adminUserId?: string
): Promise<{ success: boolean; sentTo?: string; error?: string }> {
  try {
    const admin = await getSupabaseAdminClient();
    const { data: current, error: getErr } = await admin
      .from("platform_invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (getErr || !current) return { success: false, error: "Comprobante no encontrado" };
    const inv = mapToInvoiceRecord(current);

    let targetEmail = recipientEmail?.trim();
    if (!targetEmail) {
      const { getBusinessDetail } = await import("@/lib/businesses/businesses-service");
      const bizRes = await getBusinessDetail(inv.businessId);
      if (bizRes.business?.owner?.email) targetEmail = bizRes.business.owner.email;
      else if (bizRes.business?.email) targetEmail = bizRes.business.email;
    }
    if (!targetEmail) targetEmail = "soporte@negova.com";

    const pdfRes = await generateInvoicePdf(invoiceId);
    if (!pdfRes.success || !pdfRes.base64) {
      return { success: false, error: pdfRes.error || "No se pudo generar el PDF para adjuntar." };
    }

    const { sendInvoiceEmail } = await import("@/lib/email/resend");
    const intervalLabel = inv.billingInterval === "annual" ? "Anual" : "Mensual";

    const emailRes = await sendInvoiceEmail({
      to: targetEmail,
      businessName: inv.businessName,
      planName: `Plan ${inv.planName}`,
      periodText: `Período ${intervalLabel} (${inv.issuedAt.substring(0, 10)} al ${inv.dueDate.substring(0, 10)})`,
      amountCop: inv.amount,
      invoiceNumber: inv.invoiceNumber,
      pdfBase64: pdfRes.base64,
      pdfFilename: pdfRes.filename,
    });

    if (!emailRes.success) return { success: false, error: emailRes.error || "Error al despachar el correo." };

    await admin.from("platform_invoices").update({
      last_email_sent_at: new Date().toISOString(),
      last_sent_to_email: targetEmail,
      updated_at: new Date().toISOString()
    }).eq("id", invoiceId);

    try {
      const { createNotification } = await import("@/lib/notifications/notifications-service");
      await createNotification({
        scope: "platform",
        audience: "global",
        type: "billing",
        title: `Comprobante ${inv.invoiceNumber} enviado`,
        message: `Se envió el comprobante ${inv.invoiceNumber} ($${inv.amount.toLocaleString("es-CO")} COP) al comercio ${inv.businessName} (${targetEmail}).`,
        entityType: "billing_invoice",
        entityId: inv.id,
        entityNumber: inv.invoiceNumber,
        href: `/admin/billing?id=${inv.id}`,
      });
    } catch {}

    const { logAuditAction } = await import("@/lib/audit/audit-service");
    await logAuditAction({
      businessId: inv.businessId || null,
      userId: adminUserId || null,
      action: "other",
      entityType: "billing_receipt",
      entityId: inv.id,
      metadata: { original_action: "send_invoice_email", invoiceNumber: inv.invoiceNumber, businessName: inv.businessName, recipient: targetEmail, amount: inv.amount },
    });

    return { success: true, sentTo: targetEmail };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al enviar el comprobante por correo" };
  }
}

export async function deleteInvoice(
  invoiceId: string,
  adminUserId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await getSupabaseAdminClient();
    const { data: current, error: getErr } = await admin
      .from("platform_invoices")
      .select("invoice_number, business_id")
      .eq("id", invoiceId)
      .single();

    if (getErr || !current) return { success: false, error: "Comprobante no encontrado" };

    const { error: delErr } = await admin.from("platform_invoices").delete().eq("id", invoiceId);
    if (delErr) return { success: false, error: delErr.message };

    const { logAuditAction } = await import("@/lib/audit/audit-service");
    await logAuditAction({
      businessId: current.business_id || null,
      userId: adminUserId || null,
      action: "delete",
      entityType: "billing_receipt",
      entityId: invoiceId,
      metadata: { original_action: "delete_invoice", invoiceNumber: current.invoice_number },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al eliminar el comprobante" };
  }
}

export async function editInvoice(
  invoiceId: string,
  data: Partial<InvoiceRecord>,
  adminUserId?: string
): Promise<{ success: boolean; error?: string; invoice?: InvoiceRecord }> {
  try {
    const admin = await getSupabaseAdminClient();
    const { data: current, error: getErr } = await admin
      .from("platform_invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (getErr || !current) return { success: false, error: "Comprobante no encontrado" };

    const updates: any = { updated_at: new Date().toISOString() };
    if (data.amount !== undefined) updates.amount = data.amount;
    if (data.status) updates.status = data.status;
    if (data.paymentMethod) updates.payment_method = data.paymentMethod;
    if (data.paymentReference !== undefined) updates.payment_reference = data.paymentReference;
    if (data.issuedAt) updates.issued_at = data.issuedAt;
    if (data.dueDate) updates.due_date = data.dueDate;
    if (data.paidAt !== undefined) updates.paid_at = data.paidAt;
    if (data.notes !== undefined) updates.notes = data.notes;

    const { data: updatedData, error: upErr } = await admin
      .from("platform_invoices")
      .update(updates)
      .eq("id", invoiceId)
      .select()
      .single();

    if (upErr) return { success: false, error: upErr.message };

    const { logAuditAction } = await import("@/lib/audit/audit-service");
    await logAuditAction({
      businessId: current.business_id || null,
      userId: adminUserId || null,
      action: "update",
      entityType: "billing_receipt",
      entityId: invoiceId,
      metadata: { original_action: "edit_invoice", invoiceNumber: current.invoice_number, updates },
    });

    return { success: true, invoice: mapToInvoiceRecord(updatedData) };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al editar el comprobante" };
  }
}

/**
 * Función central para generar automáticamente una factura según el ciclo de vida de la suscripción.
 * Esta función es invocada por `subscriptions-service.ts`.
 */
export async function createInvoiceForSubscription(params: {
  subscriptionId: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  planId: string;
  planName: string;
  billingInterval: string;
  amount: number;
  isTrial: boolean;
  issuedAt: string;
  dueDate: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await getSupabaseAdminClient();
    const billingPeriod = params.issuedAt.substring(0, 7); // Formato YYYY-MM
    const id = `inv-${params.subscriptionId.slice(0, 8)}-${Date.now().toString().slice(-4)}`;
    
    // Obtener el último número de factura para autoincrementar (Aprox)
    const { data: lastInv } = await admin
      .from("platform_invoices")
      .select("invoice_number")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextNumber = 1;
    if (lastInv && lastInv.invoice_number) {
      const match = lastInv.invoice_number.match(/CMP-\d{4}-(\d+)/);
      if (match && match[1]) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    const invoiceNumber = `CMP-${new Date().getFullYear()}-${String(nextNumber).padStart(4, "0")}`;

    const payload = {
      id,
      invoice_number: invoiceNumber,
      business_id: params.businessId,
      business_name: params.businessName,
      business_slug: params.businessSlug,
      subscription_id: params.subscriptionId,
      plan_id: params.planId,
      plan_name: params.planName,
      billing_interval: params.billingInterval,
      amount: params.isTrial ? 0 : params.amount,
      currency: "COP",
      status: params.isTrial ? "paid" : "pending",
      payment_method: params.isTrial ? "manual" : "transfer",
      payment_reference: params.isTrial ? "PRUEBA-GRATUITA" : null,
      issued_at: params.issuedAt,
      due_date: params.dueDate,
      paid_at: params.isTrial ? params.issuedAt : null,
      notes: params.isTrial
        ? "Membresía inicial con prueba gratuita (sin costo)."
        : `Cargo por suscripción comercial Plan ${params.planName} (${params.billingInterval === "annual" ? "Anual" : "Mensual"}).`,
      billing_period: billingPeriod,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await admin.from("platform_invoices").insert(payload);

    if (error) {
      if (error.code === '23505') {
        // Ignorar si ya existe factura para este periodo (idempotencia)
        return { success: true };
      }
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
