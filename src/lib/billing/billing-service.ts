/**
 * DEUDA TÉCNICA DOCUMENTADA:
 * Actualmente la colección de comprobantes se persiste en JSON dentro de `platform_settings` (key: "platform:invoices").
 * En una etapa posterior, se migrará a una tabla relacional SQL dedicada `public.platform_invoices` con foreign keys a `businesses`.
 * El acceso a esta información está 100% centralizado en este servicio.
 */

import { InvoiceRecord, BillingFilterParams, BillingListResult, InvoiceStatus } from "./types";
import { getSubscriptionsList } from "@/lib/subscriptions/subscriptions-service";

const SETTINGS_KEY = "platform:invoices";

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

let cachedInvoices: InvoiceRecord[] = [];

async function getAllInvoices(): Promise<InvoiceRecord[]> {
  try {
    const admin = await getSupabaseAdminClient();
    const { data, error } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();

    if (!error && data && Array.isArray(data.value) && data.value.length > 0) {
      cachedInvoices = data.value as InvoiceRecord[];
      return cachedInvoices;
    }

    // Si no hay comprobantes en DB, generamos los cargos iniciales pendientes correspondientes a las suscripciones reales existentes
    const subsResult = await getSubscriptionsList({ pageSize: 100 });
    if (subsResult.subscriptions.length > 0) {
      const generated: InvoiceRecord[] = subsResult.subscriptions.map((sub, idx) => {
        const isTrial = sub.isTrial || sub.status === "trial";
        const issued = sub.startedAt || sub.currentPeriodStart || new Date().toISOString();
        const due = sub.currentPeriodEnd || new Date().toISOString();

        return {
          id: `inv-${sub.id.slice(0, 8)}-${idx + 1}`,
          invoiceNumber: `CMP-2026-${String(idx + 1).padStart(4, "0")}`,
          businessId: sub.businessId,
          businessName: sub.businessName,
          businessSlug: sub.businessSlug,
          planId: sub.planId,
          planName: sub.planName,
          billingInterval: sub.billingInterval,
          amount: isTrial ? 0 : sub.price,
          currency: "COP",
          // Regla fundamental: una suscripción activa NO equivale a un pago recibido.
          // El cargo nace como "pending" hasta que el superadmin registra el cobro manual (transferencia/efectivo).
          status: isTrial ? "paid" : "pending",
          paymentMethod: isTrial ? "manual" : "transfer",
          paymentReference: isTrial ? "PRUEBA-GRATUITA-30D" : null,
          issuedAt: issued,
          dueDate: due,
          paidAt: isTrial ? issued : null,
          notes: isTrial
            ? "Membresía inicial con 30 días de prueba gratuita (sin costo)."
            : `Cargo por suscripción comercial Plan ${sub.planName} (${sub.billingInterval === "annual" ? "Anual" : "Mensual"}). Pendiente de cobro manual.`,
        };
      });

      await saveAllInvoices(generated);
      return generated;
    }
  } catch (err) {
    console.error("Error al obtener comprobantes de cobro:", err);
  }

  return cachedInvoices;
}

async function saveAllInvoices(invoices: InvoiceRecord[]): Promise<boolean> {
  cachedInvoices = invoices;
  try {
    const admin = await getSupabaseAdminClient();
    const { error } = await admin.from("platform_settings").upsert(
      {
        key: SETTINGS_KEY,
        value: invoices,
        description: "Registro de comprobantes internos de cobro emitidos por NEGOVA a comercios clientes",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    return !error;
  } catch (err) {
    console.error("Error al persistir comprobantes:", err);
    return false;
  }
}

export async function getBillingList(params: BillingFilterParams = {}): Promise<BillingListResult> {
  const all = await getAllInvoices();
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize || 10));

  let filtered = [...all];

  if (params.status && params.status !== "all") {
    filtered = filtered.filter((i) => i.status === params.status);
  }

  if (params.planId && params.planId !== "all") {
    filtered = filtered.filter((i) => i.planId === params.planId);
  }

  if (params.businessId && params.businessId !== "all") {
    filtered = filtered.filter((i) => i.businessId === params.businessId);
  }

  if (params.search && params.search.trim()) {
    const q = params.search.toLowerCase().trim();
    filtered = filtered.filter(
      (i) =>
        i.invoiceNumber.toLowerCase().includes(q) ||
        i.businessName.toLowerCase().includes(q) ||
        i.businessSlug.toLowerCase().includes(q) ||
        (i.paymentReference && i.paymentReference.toLowerCase().includes(q))
    );
  }

  filtered.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = (page - 1) * pageSize;
  const paginated = filtered.slice(from, from + pageSize);

  const totalBilledCOP = all.reduce((sum, i) => (i.status !== "void" ? sum + i.amount : sum), 0);
  const totalPaidCOP = all.reduce((sum, i) => (i.status === "paid" ? sum + i.amount : sum), 0);
  const totalPendingCOP = all.reduce((sum, i) => (i.status === "pending" ? sum + i.amount : sum), 0);

  const stats = {
    totalBilledCOP,
    totalPaidCOP,
    totalPendingCOP,
    paidCount: all.filter((i) => i.status === "paid").length,
    pendingCount: all.filter((i) => i.status === "pending").length,
    voidCount: all.filter((i) => i.status === "void").length,
  };

  return {
    invoices: paginated,
    totalCount,
    page,
    pageSize,
    totalPages,
    stats,
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
    const all = await getAllInvoices();
    const idx = all.findIndex((i) => i.id === invoiceId);
    if (idx === -1) {
      return { success: false, error: "Comprobante no encontrado" };
    }

    all[idx] = {
      ...all[idx],
      status: "paid",
      paymentMethod: data.paymentMethod,
      paymentReference: data.paymentReference.trim(),
      paidAt: data.paidAt || new Date().toISOString(),
      notes: data.notes || all[idx].notes,
    };

    await saveAllInvoices(all);

    // Auditoría
    try {
      const admin = await getSupabaseAdminClient();
      await admin.from("audit_logs").insert({
        action: "register_payment_receipt",
        entity_type: "billing_receipt",
        entity_id: invoiceId,
        user_id: data.adminUserId || null,
        metadata: {
          receiptNumber: all[idx].invoiceNumber,
          businessName: all[idx].businessName,
          amount: all[idx].amount,
          method: data.paymentMethod,
          reference: data.paymentReference,
        },
      });
    } catch {}

    return { success: true, invoice: all[idx] };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al registrar el pago" };
  }
}

/**
 * Genera el PDF del comprobante de cobro, lo persiste en Supabase Storage y actualiza la referencia
 */
export async function generateInvoicePdf(invoiceId: string): Promise<{
  success: boolean;
  base64?: string;
  filename?: string;
  pdfUrl?: string | null;
  error?: string;
}> {
  try {
    const all = await getAllInvoices();
    const idx = all.findIndex((i) => i.id === invoiceId);
    if (idx === -1) {
      return { success: false, error: "Comprobante no encontrado" };
    }
    const inv = all[idx];

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
    } catch (e) {
      console.warn("No se pudo cargar el logo de Negova para el PDF", e);
    }

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

    // Subir a Storage
    try {
      const admin = await getSupabaseAdminClient();
      const storageRes = await uploadInvoicePdfBuffer(admin, inv.invoiceNumber, pdfResult.buffer);
      if (storageRes.url) {
        all[idx] = {
          ...all[idx],
          pdfUrl: storageRes.url,
          pdfStoragePath: storageRes.storagePath,
        };
        await saveAllInvoices(all);
      }
    } catch (storageErr) {
      console.warn("Aviso al persistir PDF en storage:", storageErr);
    }

    return {
      success: true,
      base64: pdfResult.base64,
      filename: pdfResult.filename,
      pdfUrl: all[idx].pdfUrl || null,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al generar PDF del comprobante" };
  }
}

/**
 * Envía el comprobante por correo electrónico con el PDF adjunto
 */
export async function sendInvoiceByEmail(
  invoiceId: string,
  recipientEmail?: string,
  adminUserId?: string
): Promise<{ success: boolean; sentTo?: string; error?: string }> {
  try {
    const all = await getAllInvoices();
    const idx = all.findIndex((i) => i.id === invoiceId);
    if (idx === -1) {
      return { success: false, error: "Comprobante no encontrado" };
    }
    const inv = all[idx];

    // Obtener correo del negocio si no fue especificado
    let targetEmail = recipientEmail?.trim();
    if (!targetEmail) {
      const { getBusinessDetail } = await import("@/lib/businesses/businesses-service");
      const bizRes = await getBusinessDetail(inv.businessId);
      if (bizRes.business?.owner?.email) {
        targetEmail = bizRes.business.owner.email;
      } else if (bizRes.business?.email) {
        targetEmail = bizRes.business.email;
      }
    }

    if (!targetEmail) {
      targetEmail = "soporte@negova.com";
    }

    // Generar PDF para adjuntar
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

    if (!emailRes.success) {
      return { success: false, error: emailRes.error || "Error al despachar el correo." };
    }

    // Actualizar registro con fecha y destinatario
    all[idx] = {
      ...all[idx],
      lastEmailSentAt: new Date().toISOString(),
      lastSentToEmail: targetEmail,
    };
    await saveAllInvoices(all);

    // Notificación transversal de plataforma
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

    // Auditoría
    try {
      const admin = await getSupabaseAdminClient();
      await admin.from("audit_logs").insert({
        action: "send_invoice_email",
        entity_type: "billing_receipt",
        entity_id: inv.id,
        user_id: adminUserId || null,
        metadata: {
          invoiceNumber: inv.invoiceNumber,
          businessName: inv.businessName,
          recipient: targetEmail,
          amount: inv.amount,
        },
      });
    } catch {}

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
    const all = await getAllInvoices();
    const idx = all.findIndex((i) => i.id === invoiceId);
    if (idx === -1) {
      return { success: false, error: "Comprobante no encontrado" };
    }

    const invoiceNumber = all[idx].invoiceNumber;
    
    // Eliminar del array
    all.splice(idx, 1);
    await saveAllInvoices(all);

    // Auditoría
    try {
      const admin = await getSupabaseAdminClient();
      await admin.from("audit_logs").insert({
        action: "delete_invoice",
        entity_type: "billing_receipt",
        entity_id: invoiceId,
        user_id: adminUserId || null,
        metadata: { invoiceNumber },
      });
    } catch {}

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
    const all = await getAllInvoices();
    const idx = all.findIndex((i) => i.id === invoiceId);
    if (idx === -1) {
      return { success: false, error: "Comprobante no encontrado" };
    }

    const current = all[idx];
    
    // Campos permitidos para edición
    const allowedUpdates = {
      amount: data.amount !== undefined ? data.amount : current.amount,
      status: data.status || current.status,
      paymentMethod: data.paymentMethod || current.paymentMethod,
      paymentReference: data.paymentReference !== undefined ? data.paymentReference : current.paymentReference,
      issuedAt: data.issuedAt || current.issuedAt,
      dueDate: data.dueDate || current.dueDate,
      paidAt: data.paidAt !== undefined ? data.paidAt : current.paidAt,
      notes: data.notes !== undefined ? data.notes : current.notes,
    };

    all[idx] = { ...current, ...allowedUpdates };
    await saveAllInvoices(all);

    // Auditoría
    try {
      const admin = await getSupabaseAdminClient();
      await admin.from("audit_logs").insert({
        action: "edit_invoice",
        entity_type: "billing_receipt",
        entity_id: invoiceId,
        user_id: adminUserId || null,
        metadata: {
          invoiceNumber: current.invoiceNumber,
          updates: allowedUpdates,
        },
      });
    } catch {}

    return { success: true, invoice: all[idx] };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al editar el comprobante" };
  }
}

