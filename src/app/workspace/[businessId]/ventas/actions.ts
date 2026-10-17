"use server";

import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import {
  createBusinessSaleDocument,
  cancelBusinessSaleDocument,
  generateBusinessDocumentPdf,
} from "@/lib/documents/document-service";
import type {
  BusinessDocumentType,
  BusinessPaymentMethod,
  BusinessDocumentItem,
} from "@/lib/documents/types";
import { revalidatePath } from "next/cache";

export interface CreateSaleItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
}

export interface CreateSaleActionInput {
  customerName: string;
  customerId?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  documentType?: BusinessDocumentType;
  paymentMethod: BusinessPaymentMethod;
  notes?: string | null;
  items: CreateSaleItemInput[];
  discountTotal?: number;
  taxTotal?: number;
}

/**
 * Server Action: Registrar una nueva venta en el Workspace
 * Valida sesión, pertenencia de negocio, permiso sales.create y calcula totales en servidor.
 */
export async function createSaleAction(
  businessId: string,
  input: CreateSaleActionInput
): Promise<{
  success: boolean;
  documentId?: string;
  documentNumber?: string;
  error?: string;
}> {
  // 1. Autorización multi-tenant y permiso RBAC sales.create
  const auth = await verifyWorkspaceAction(businessId, "sales.create");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "Acceso no autorizado" };
  }

  // 2. Validaciones de negocio
  const cleanCustomerName = (input.customerName || "Consumidor Final").trim();
  if (!cleanCustomerName) {
    return { success: false, error: "El nombre del cliente no puede estar vacío." };
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { success: false, error: "Debe agregar al menos un producto o servicio a la venta." };
  }

  // 3. Validar y normalizar cada línea de item en servidor
  const normalizedItems: BusinessDocumentItem[] = [];
  for (let i = 0; i < input.items.length; i++) {
    const item = input.items[i];
    const desc = (item.description || "").trim();
    if (!desc) {
      return { success: false, error: `La línea ${i + 1} requiere una descripción o nombre del producto.` };
    }
    const qty = Number(item.quantity);
    if (isNaN(qty) || qty <= 0) {
      return { success: false, error: `La cantidad en la línea ${i + 1} ("${desc}") debe ser mayor a 0.` };
    }
    const price = Number(item.unitPrice);
    if (isNaN(price) || price < 0) {
      return { success: false, error: `El precio unitario en la línea ${i + 1} no puede ser negativo.` };
    }
    const disc = Math.max(0, Number(item.discount || 0));
    const lineTotal = Math.max(0, qty * price - disc);

    normalizedItems.push({
      description: desc,
      quantity: qty,
      unitPrice: price,
      discount: disc,
      total: lineTotal,
    });
  }

  const tax = Math.max(0, Number(input.taxTotal || 0));
  const discount = Math.max(0, Number(input.discountTotal || 0));

  // 4. Invocar servicio central de documentos
  const result = await createBusinessSaleDocument(
    businessId,
    {
      customerName: cleanCustomerName,
      customerId: input.customerId?.trim() || null,
      customerPhone: input.customerPhone?.trim() || null,
      customerEmail: input.customerEmail?.trim() || null,
      customerAddress: input.customerAddress?.trim() || null,
      documentType: input.documentType || "sale",
      paymentMethod: input.paymentMethod || "cash",
      status: "paid",
      notes: input.notes?.trim() || null,
      items: normalizedItems,
      discountTotal: discount,
      taxTotal: tax,
      userId: auth.context.userId,
    } as any
  );

  if (!result.success || !result.document) {
    return { success: false, error: result.error || "No se pudo registrar la venta." };
  }

  revalidatePath(`/workspace/${businessId}`);
  revalidatePath(`/workspace/${businessId}/ventas`);

  return {
    success: true,
    documentId: result.document.id,
    documentNumber: result.document.documentNumber,
  };
}

/**
 * Server Action: Anular un comprobante de venta (Transición de estado a 'cancelled')
 * Protegido con permiso sales.cancel (owner).
 */
export async function cancelSaleAction(
  businessId: string,
  documentId: string,
  reason: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  // 1. Autorización multi-tenant y permiso RBAC sales.cancel (owner)
  const auth = await verifyWorkspaceAction(businessId, "sales.cancel");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tiene permisos para anular documentos de venta." };
  }

  const cleanReason = (reason || "").trim();
  if (cleanReason.length < 3) {
    return { success: false, error: "Debe especificar un motivo de cancelación de al menos 3 caracteres." };
  }

  // 2. Invocar servicio comercial de cancelación
  const result = await cancelBusinessSaleDocument(businessId, documentId, {
    userId: auth.context.userId,
    reason: cleanReason,
  });

  if (!result.success) {
    return { success: false, error: result.error || "No se pudo anular el documento." };
  }

  revalidatePath(`/workspace/${businessId}`);
  revalidatePath(`/workspace/${businessId}/ventas`);
  revalidatePath(`/workspace/${businessId}/ventas/${documentId}`);

  return { success: true };
}

/**
 * Server Action: Generar/Descargar el PDF de un comprobante de venta
 * Protegido con sales.view.
 */
export async function downloadSalePdfAction(
  businessId: string,
  documentId: string
): Promise<{
  success: boolean;
  base64?: string;
  filename?: string;
  pdfUrl?: string | null;
  error?: string;
}> {
  // 1. Autorización multi-tenant y permiso sales.view
  const auth = await verifyWorkspaceAction(businessId, "sales.view");
  if (!auth.success) {
    return { success: false, error: auth.error || "Acceso no autorizado para descargar comprobante." };
  }

  // 2. Generar PDF respetando la configuración comercial del negocio
  const result = await generateBusinessDocumentPdf(businessId, documentId);
  return result;
}
