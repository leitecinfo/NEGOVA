"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserAuthorization } from "@/lib/auth/authorization";
import { getBillingList, registerInvoicePayment } from "@/lib/billing/billing-service";
import { BillingFilterParams, InvoiceRecord } from "@/lib/billing/types";

export async function fetchBillingListAction(params: BillingFilterParams) {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    return { success: false, error: "Acceso no autorizado", data: null };
  }

  const result = await getBillingList(params);
  return { success: true, data: result };
}

export async function registerPaymentAction(
  invoiceId: string,
  data: {
    paymentMethod: InvoiceRecord["paymentMethod"];
    paymentReference: string;
    notes?: string;
  }
) {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    return { success: false, error: "Acceso no autorizado" };
  }

  const result = await registerInvoicePayment(invoiceId, {
    ...data,
    adminUserId: auth.userId,
  });

  if (result.success) {
    revalidatePath("/admin/facturacion");
    revalidatePath("/admin/suscripciones");
  }

  return result;
}

export async function generateInvoicePdfAction(invoiceId: string) {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    return { success: false, error: "Acceso no autorizado" };
  }

  const { generateInvoicePdf } = await import("@/lib/billing/billing-service");
  return await generateInvoicePdf(invoiceId);
}

export async function sendInvoiceEmailAction(invoiceId: string, recipientEmail?: string) {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    return { success: false, error: "Acceso no autorizado" };
  }

  const { sendInvoiceByEmail } = await import("@/lib/billing/billing-service");
  const result = await sendInvoiceByEmail(invoiceId, recipientEmail, auth.userId);

  if (result.success) {
    revalidatePath("/admin/facturacion");
  }

  return result;
}

export async function deleteInvoiceAction(invoiceId: string) {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    return { success: false, error: "Acceso no autorizado" };
  }

  const { deleteInvoice } = await import("@/lib/billing/billing-service");
  const result = await deleteInvoice(invoiceId, auth.userId);

  if (result.success) {
    revalidatePath("/admin/facturacion");
  }

  return result;
}

export async function editInvoiceAction(invoiceId: string, data: Partial<InvoiceRecord>) {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    return { success: false, error: "Acceso no autorizado" };
  }

  const { editInvoice } = await import("@/lib/billing/billing-service");
  const result = await editInvoice(invoiceId, data, auth.userId);

  if (result.success) {
    revalidatePath("/admin/facturacion");
  }

  return result;
}
