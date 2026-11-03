"use server";

import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import {
  createQuotation,
  getQuotations,
  getQuotationById,
  convertQuotationToSale,
  cancelQuotation,
  getQuotationsKPIs,
} from "@/lib/quotations/quotations-service";
import type {
  CreateQuotationInput,
  Quotation,
  QuotationFilterParams,
  QuotationKPIs,
} from "@/lib/quotations/types";
import { revalidatePath } from "next/cache";

/**
 * Server Action: Crear una nueva cotización comercial desde el POS.
 * Valida sesión multi-tenant y permiso sales.create o orders.create.
 */
export async function createQuotationAction(
  businessId: string,
  input: CreateQuotationInput
): Promise<{
  success: boolean;
  quotation?: Quotation;
  error?: string;
}> {
  let auth = await verifyWorkspaceAction(businessId, "sales.create");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "orders.create");
  }

  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes permisos para emitir cotizaciones." };
  }

  try {
    const quotation = await createQuotation(businessId, input, auth.context.userId);
    revalidatePath(`/workspace/${businessId}/ventas`);
    revalidatePath(`/workspace/${businessId}/pos`);

    return { success: true, quotation };
  } catch (err: any) {
    console.error("[createQuotationAction] Error al crear cotización:", err);
    return { success: false, error: err?.message || "Error al crear la cotización." };
  }
}

/**
 * Server Action: Consultar listado paginado de cotizaciones.
 */
export async function getQuotationsAction(
  businessId: string,
  params: Omit<QuotationFilterParams, "businessId">
): Promise<{
  success: boolean;
  quotations?: Quotation[];
  totalCount?: number;
  totalPages?: number;
  currentPage?: number;
  pageSize?: number;
  error?: string;
}> {
  let auth = await verifyWorkspaceAction(businessId, "sales.view");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "orders.view");
  }

  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes permisos para ver cotizaciones." };
  }

  try {
    const res = await getQuotations({
      ...params,
      businessId,
    });

    return {
      success: true,
      quotations: res.quotations,
      totalCount: res.totalCount,
      totalPages: res.totalPages,
      currentPage: res.currentPage,
      pageSize: res.pageSize,
    };
  } catch (err: any) {
    console.error("[getQuotationsAction] Error al consultar cotizaciones:", err);
    return { success: false, error: err?.message || "Error al consultar cotizaciones." };
  }
}

/**
 * Server Action: Consultar detalle de una cotización específica.
 */
export async function getQuotationByIdAction(
  businessId: string,
  quotationId: string
): Promise<{
  success: boolean;
  quotation?: Quotation | null;
  error?: string;
}> {
  let auth = await verifyWorkspaceAction(businessId, "sales.view");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "orders.view");
  }

  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes permisos para ver cotizaciones." };
  }

  try {
    const quotation = await getQuotationById(businessId, quotationId);
    return { success: true, quotation };
  } catch (err: any) {
    console.error("[getQuotationByIdAction] Error al consultar cotización:", err);
    return { success: false, error: err?.message || "Error al consultar cotización." };
  }
}

/**
 * Server Action: Marcar cotización como convertida a venta real.
 */
export async function convertQuotationToSaleAction(
  businessId: string,
  quotationId: string,
  orderId?: string | null
): Promise<{
  success: boolean;
  error?: string;
}> {
  let auth = await verifyWorkspaceAction(businessId, "sales.create");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "orders.create");
  }

  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes permisos para convertir cotizaciones." };
  }

  try {
    const res = await convertQuotationToSale(businessId, quotationId, orderId);
    if (res.success) {
      revalidatePath(`/workspace/${businessId}/ventas`);
      revalidatePath(`/workspace/${businessId}/pos`);
    }
    return res;
  } catch (err: any) {
    console.error("[convertQuotationToSaleAction] Error al convertir cotización:", err);
    return { success: false, error: err?.message || "Error al convertir cotización." };
  }
}

/**
 * Server Action: Cancelar / anular una cotización.
 */
export async function cancelQuotationAction(
  businessId: string,
  quotationId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  let auth = await verifyWorkspaceAction(businessId, "sales.cancel");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "sales.create");
  }

  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes permisos para cancelar cotizaciones." };
  }

  try {
    const res = await cancelQuotation(businessId, quotationId);
    if (res.success) {
      revalidatePath(`/workspace/${businessId}/ventas`);
      revalidatePath(`/workspace/${businessId}/pos`);
    }
    return res;
  } catch (err: any) {
    console.error("[cancelQuotationAction] Error al cancelar cotización:", err);
    return { success: false, error: err?.message || "Error al cancelar cotización." };
  }
}

/**
 * Server Action: Obtener métricas y KPIs de cotizaciones del negocio.
 */
export async function getQuotationsKPIsAction(
  businessId: string
): Promise<{
  success: boolean;
  kpis?: QuotationKPIs;
  error?: string;
}> {
  let auth = await verifyWorkspaceAction(businessId, "sales.view");
  if (!auth.success) {
    auth = await verifyWorkspaceAction(businessId, "orders.view");
  }

  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes permisos para ver métricas." };
  }

  try {
    const kpis = await getQuotationsKPIs(businessId);
    return { success: true, kpis };
  } catch (err: any) {
    console.error("[getQuotationsKPIsAction] Error al obtener KPIs:", err);
    return { success: false, error: err?.message || "Error al obtener KPIs." };
  }
}
