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
import { checkPlanLimit } from "@/lib/subscriptions/plan-limits-service";

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
  generateElectronicInvoice?: boolean;
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
  cufe?: string;
  electronicNumber?: string;
  error?: string;
}> {
  // 1. Autorización multi-tenant y permiso RBAC sales.create
  const auth = await verifyWorkspaceAction(businessId, "sales.create");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "Acceso no autorizado" };
  }

  // Validación de límites de suscripción en servidor [SUB-001]
  const planLimit = await checkPlanLimit(businessId, "sales");
  if (!planLimit.allowed) {
    return { success: false, error: planLimit.error };
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

  // 5. Facturación Electrónica DIAN [DIAN-001]
  let cufe: string | undefined;
  let electronicNumber: string | undefined;

  const shouldGenerateDianInvoice = Boolean(input.generateElectronicInvoice);
  if (shouldGenerateDianInvoice) {
    try {
      const { generateElectronicInvoiceForSale } = await import("@/lib/dian/dian-service");
      const feRes = await generateElectronicInvoiceForSale(
        businessId,
        {
          id: result.document.id,
          documentNumber: result.document.documentNumber,
          customerName: result.document.customerName,
          customerId: result.document.customerId,
          customerEmail: result.document.customerEmail,
          subtotal: result.document.subtotal,
          taxTotal: result.document.taxTotal,
          discountTotal: result.document.discountTotal,
          total: result.document.total,
          items: result.document.items,
        },
        auth.context.userId
      );
      if (feRes.success && feRes.invoice) {
        cufe = feRes.invoice.cufe;
        electronicNumber = feRes.invoice.documentNumber;
      }
    } catch (dianErr) {
      console.warn("[createSaleAction] Error al emitir factura electrónica DIAN:", dianErr);
    }
  }

  revalidatePath(`/workspace/${businessId}`);
  revalidatePath(`/workspace/${businessId}/ventas`);

  return {
    success: true,
    documentId: result.document.id,
    documentNumber: result.document.documentNumber,
    cufe,
    electronicNumber,
  };
}

/**
 * Server Action: Anular un comprobante de venta (Transición de estado a 'cancelled')
 * Protegido con validación de PIN de autorización para operaciones sensibles [EMP-002 / POS-005].
 */
export async function cancelSaleAction(
  businessId: string,
  documentId: string,
  reason: string,
  pin?: string
): Promise<{
  success: boolean;
  authorizerName?: string;
  error?: string;
}> {
  // 1. Autorización multi-tenant y pertenencia al negocio (al menos sales.view)
  const auth = await verifyWorkspaceAction(businessId, "sales.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tiene acceso al módulo de ventas." };
  }

  const cleanReason = (reason || "").trim();
  if (cleanReason.length < 3) {
    return { success: false, error: "Debe especificar un motivo de cancelación de al menos 3 caracteres." };
  }

  // 2. Validación de PIN de autorización para operación sensible [EMP-002 / POS-005]
  const {
    verifyPinAuthorization,
    doesBusinessRequirePinForCancellation,
  } = await import("@/lib/security/pin-service");

  const cleanPin = (pin || "").trim();
  let authorizerName: string | undefined;
  let authorizerId: string | undefined;

  if (cleanPin.length > 0) {
    if (cleanPin.length < 4 || cleanPin.length > 6) {
      return {
        success: false,
        error: "Se requiere el PIN de 4 a 6 dígitos de un supervisor o colaborador autorizado para anular la venta.",
      };
    }

    const pinAuth = await verifyPinAuthorization(businessId, {
      pin: cleanPin,
      requiredPermission: "sales.cancel",
      action: "sale.cancel",
      entity: "sale_document",
      entityId: documentId,
      details: { reason: cleanReason },
      actorUserId: auth.context.userId,
    });

    if (!pinAuth.success || !pinAuth.authorized) {
      return {
        success: false,
        error: pinAuth.error || "PIN de autorización incorrecto o sin permisos de anulación.",
      };
    }

    authorizerName = pinAuth.authorizer?.fullName;
    authorizerId = pinAuth.authorizer?.id;
  } else {
    const requiresPin = await doesBusinessRequirePinForCancellation(businessId);
    if (requiresPin) {
      return {
        success: false,
        error: "Se requiere el PIN de 4 a 6 dígitos de un supervisor o colaborador autorizado para anular la venta.",
      };
    }

    // Si el negocio no tiene PIN configurado, validar que el usuario actual tenga permiso sales.cancel
    const cancelAuth = await verifyWorkspaceAction(businessId, "sales.cancel");
    if (!cancelAuth.success) {
      return {
        success: false,
        error: cancelAuth.error || "No cuenta con permisos para anular ventas.",
      };
    }
  }

  // 3. Invocar servicio comercial de cancelación (revierte stock, recetas, caja, crédito y audita)
  const formattedReason = authorizerName
    ? `${cleanReason} [Autorizado por: ${authorizerName}]`
    : cleanReason;

  const result = await cancelBusinessSaleDocument(businessId, documentId, {
    userId: auth.context.userId,
    authorizedBy: authorizerId || auth.context.userId,
    reason: formattedReason,
  });

  if (!result.success) {
    return { success: false, error: result.error || "No se pudo anular el documento." };
  }

  // 4. Si la venta tenía factura electrónica DIAN, emitir Nota Crédito [DIAN-001]
  try {
    const { getElectronicDocumentBySaleId, generateCreditNoteForSale } = await import("@/lib/dian/dian-service");
    const existingFe = await getElectronicDocumentBySaleId(businessId, documentId);
    if (existingFe && existingFe.status !== "cancelled") {
      await generateCreditNoteForSale(businessId, documentId, cleanReason, auth.context.userId);
    }
  } catch (ncErr) {
    console.warn("[cancelSaleAction] Error al emitir Nota Crédito DIAN:", ncErr);
  }

  revalidatePath(`/workspace/${businessId}`);
  revalidatePath(`/workspace/${businessId}/ventas`);
  revalidatePath(`/workspace/${businessId}/ventas/${documentId}`);

  return {
    success: true,
    authorizerName,
  };
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

/**
 * Server Action: Registrar el cobro o pago de un documento o comanda en Ventas
 * Protegido con sales.create o rol de owner.
 */
export async function registerSalePaymentAction(
  businessId: string,
  documentId: string,
  paymentMethod?: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "sales.create");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para registrar pagos en este negocio." };
  }

  const { registerBusinessDocumentPayment } = await import("@/lib/documents/document-service");
  const result = await registerBusinessDocumentPayment(businessId, documentId, {
    paymentMethod,
    userId: auth.context.userId,
  });

  if (result.success) {
    revalidatePath(`/workspace/${businessId}`);
    revalidatePath(`/workspace/${businessId}/ventas`);
    revalidatePath(`/workspace/${businessId}/ventas/${documentId}`);
    revalidatePath(`/workspace/${businessId}/pedidos`);
  }

  return { success: result.success, error: result.error };
}

