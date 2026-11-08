"use server";

import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import { revalidatePath } from "next/cache";
import {
  createPurchase,
  getPurchases,
  getPurchaseById,
  getPurchaseKPIs,
  cancelPurchase,
  getSuppliers,
  createSupplier,
  getAccountsPayable,
  getAccountsPayableKPIs,
  registerAccountPayablePayment,
  getAccountPayableDetails,
} from "@/lib/purchases/purchases-service";
import {
  CreatePurchaseInput,
  PurchaseFilters,
  CreateSupplierInput,
  Purchase,
  PurchaseKPIs,
  Supplier,
  AccountsPayableWithDetails,
  AccountsPayableKPIs,
  AccountsPayableFilters,
  RegisterPaymentInput,
  AccountPayablePayment,
  AccountsPayable,
} from "@/lib/purchases/types";

/**
 * Consulta el historial de compras a proveedores con filtros.
 * Permiso requerido: purchases.view
 */
export async function getPurchasesAction(
  businessId: string,
  filters: PurchaseFilters = {}
): Promise<{ success: boolean; data?: Purchase[]; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "purchases.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ver compras." };
  }

  try {
    const data = await getPurchases(businessId, filters);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar compras." };
  }
}

/**
 * Consulta los KPIs consolidados de compras y cuentas por pagar,
 * respetando el período y los filtros aplicados cuando corresponda.
 * Permiso requerido: purchases.view
 */
export async function getPurchaseKPIsAction(
  businessId: string,
  filters: PurchaseFilters = {}
): Promise<{ success: boolean; data?: PurchaseKPIs; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "purchases.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ver KPIs de compras." };
  }

  try {
    const data = await getPurchaseKPIs(businessId, filters);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al calcular métricas de compras." };
  }
}

/**
 * Consulta el detalle completo de una compra por su ID.
 * Permiso requerido: purchases.view
 */
export async function getPurchaseByIdAction(
  businessId: string,
  purchaseId: string
): Promise<{ success: boolean; data?: Purchase; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "purchases.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ver compras." };
  }

  try {
    const data = await getPurchaseById(businessId, purchaseId);
    if (!data) {
      return { success: false, error: "La compra no existe o fue eliminada." };
    }
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar la compra." };
  }
}

/**
 * Registra una nueva compra a proveedor (actualiza stock, costo promedio y cuentas por pagar).
 * Permiso requerido: purchases.create
 */
export async function createPurchaseAction(
  businessId: string,
  input: CreatePurchaseInput
): Promise<{ success: boolean; data?: Purchase; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "purchases.create");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para registrar compras." };
  }

  try {
    const data = await createPurchase(businessId, input, auth.context.userId);
    revalidatePath(`/workspace/${businessId}/compras`);
    revalidatePath(`/workspace/${businessId}/inventario`);
    revalidatePath(`/workspace/${businessId}/productos`);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al registrar la compra." };
  }
}

/**
 * Anula una compra registrada revirtiendo movimientos de inventario y cuentas por pagar.
 * Permiso requerido: purchases.cancel (exclusivo de Dueño / Admin)
 */
export async function cancelPurchaseAction(
  businessId: string,
  purchaseId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "purchases.cancel");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para anular compras." };
  }

  try {
    await cancelPurchase(businessId, purchaseId, auth.context.userId, reason);
    revalidatePath(`/workspace/${businessId}/compras`);
    revalidatePath(`/workspace/${businessId}/inventario`);
    revalidatePath(`/workspace/${businessId}/productos`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al anular la compra." };
  }
}

/**
 * Consulta la lista de proveedores activos del comercio.
 * Permiso requerido: suppliers.view
 */
export async function getSuppliersAction(
  businessId: string
): Promise<{ success: boolean; data?: Supplier[]; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "suppliers.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ver proveedores." };
  }

  try {
    const data = await getSuppliers(businessId);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar proveedores." };
  }
}

/**
 * Registra un nuevo proveedor de forma rápida (inline) durante la compra.
 * Permiso requerido: suppliers.create
 */
export async function createQuickSupplierAction(
  businessId: string,
  input: CreateSupplierInput
): Promise<{ success: boolean; data?: Supplier; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "suppliers.create");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para crear proveedores." };
  }

  try {
    const data = await createSupplier(businessId, input);
    revalidatePath(`/workspace/${businessId}/proveedores`);
    revalidatePath(`/workspace/${businessId}/compras`);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al crear proveedor." };
  }
}

// ==============================================================================
// SERVER ACTIONS: CUENTAS POR PAGAR (PROV-003)
// ==============================================================================

/**
 * Consulta la lista de cuentas por pagar a proveedores con filtros de estado y vencimiento.
 * Permiso requerido: purchases.view
 */
export async function getAccountsPayableAction(
  businessId: string,
  filters: AccountsPayableFilters = {}
): Promise<{ success: boolean; data?: AccountsPayableWithDetails[]; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "purchases.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ver cuentas por pagar." };
  }

  try {
    const data = await getAccountsPayable(businessId, filters);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar cuentas por pagar." };
  }
}

/**
 * Consulta los KPIs consolidados de cuentas por pagar (Total por pagar, Vencido, Próximo a vencer).
 * Permiso requerido: purchases.view
 */
export async function getAccountsPayableKPIsAction(
  businessId: string
): Promise<{ success: boolean; data?: AccountsPayableKPIs; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "purchases.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para ver métricas de cuentas por pagar." };
  }

  try {
    const data = await getAccountsPayableKPIs(businessId);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al calcular indicadores de cuentas por pagar." };
  }
}

/**
 * Registra un abono parcial o total a una cuenta por pagar a proveedor.
 * Permiso requerido: purchases.create
 */
export async function registerAccountPayablePaymentAction(
  businessId: string,
  input: RegisterPaymentInput
): Promise<{
  success: boolean;
  data?: { payment: AccountPayablePayment; updatedAccount: AccountsPayable };
  error?: string;
}> {
  const auth = await verifyWorkspaceAction(businessId, "purchases.create");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para registrar pagos a proveedores." };
  }

  try {
    const result = await registerAccountPayablePayment(businessId, input, auth.context.userId);
    revalidatePath(`/workspace/${businessId}/compras`);
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al registrar el pago a proveedor." };
  }
}

/**
 * Consulta los detalles de una cuenta por pagar y su historial completo de abonos.
 * Permiso requerido: purchases.view
 */
export async function getAccountPayableDetailsAction(
  businessId: string,
  accountPayableId: string
): Promise<{ success: boolean; data?: AccountsPayableWithDetails; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "purchases.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No tienes autorización para consultar la cuenta por pagar." };
  }

  try {
    const data = await getAccountPayableDetails(businessId, accountPayableId);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al consultar detalles de la cuenta por pagar." };
  }
}

