"use server";

import { getCurrentUserAuthorization } from "@/lib/auth/authorization";
import {
  requestAdminAccess,
  registerWhatsAppAccess,
  approveAdminAccess,
  rejectAdminAccess,
  revokeAdminAccess,
  getAdminAccessGrants,
  AdminGrantScope,
} from "@/lib/support/delegated-access-service";
import {
  getDiagnosticOrders,
  getDiagnosticSales,
  getDiagnosticInventory,
} from "@/lib/support/diagnostic-readers";

/**
 * Solicita acceso administrativo in-app para un ticket
 */
export async function requestAdminAccessAction(params: {
  ticketId: string;
  businessId: string;
  scope: AdminGrantScope;
  targetResourceType?: string;
  targetResourceId?: string | null;
  reason: string;
  durationHours?: number;
}) {
  const auth = await getCurrentUserAuthorization();
  if (!auth) {
    return { success: false, error: "No autenticado." };
  }

  if (!["super_admin", "admin", "soporte"].includes(auth.platformRole)) {
    return { success: false, error: "Permisos insuficientes en la plataforma." };
  }

  return await requestAdminAccess({
    ticketId: params.ticketId,
    businessId: params.businessId,
    requestedBy: auth.userId,
    scope: params.scope,
    targetResourceType: params.targetResourceType,
    targetResourceId: params.targetResourceId,
    reason: params.reason,
    durationHours: params.durationHours,
  });
}

/**
 * Registra una autorización recibida por WhatsApp
 */
export async function registerWhatsAppAccessAction(params: {
  ticketId: string;
  businessId: string;
  scope: AdminGrantScope;
  targetResourceType?: string;
  targetResourceId?: string | null;
  reason: string;
  whatsappEvidenceRef: string;
  verifiedPhone: string;
  durationHours?: number;
}) {
  const auth = await getCurrentUserAuthorization();
  if (!auth) {
    return { success: false, error: "No autenticado." };
  }

  if (!["super_admin", "admin", "soporte"].includes(auth.platformRole)) {
    return { success: false, error: "Permisos insuficientes en la plataforma." };
  }

  return await registerWhatsAppAccess({
    ticketId: params.ticketId,
    businessId: params.businessId,
    registeredBy: auth.userId,
    scope: params.scope,
    targetResourceType: params.targetResourceType,
    targetResourceId: params.targetResourceId,
    reason: params.reason,
    whatsappEvidenceRef: params.whatsappEvidenceRef,
    verifiedPhone: params.verifiedPhone,
    durationHours: params.durationHours,
  });
}

/**
 * Obtiene los grants vinculados a un ticket
 */
export async function getTicketGrantsAction(ticketId: string) {
  const auth = await getCurrentUserAuthorization();
  if (!auth) {
    return { success: false, error: "No autenticado.", grants: [] };
  }

  try {
    const grants = await getAdminAccessGrants({ ticketId });
    return { success: true, grants };
  } catch (err: any) {
    return { success: false, error: err?.message, grants: [] };
  }
}

/**
 * Revoca un acceso activo (Kill-switch)
 */
export async function revokeGrantAction(grantId: string, reason?: string) {
  const auth = await getCurrentUserAuthorization();
  if (!auth) {
    return { success: false, error: "No autenticado." };
  }

  return await revokeAdminAccess({
    grantId,
    revokedBy: auth.userId,
    reason: reason || "Revocado por el agente de soporte",
  });
}

/**
 * Ejecuta una consulta de diagnóstico de solo lectura protegida por grant
 */
export async function executeDiagnosticQueryAction(params: {
  grantId: string;
  businessId: string;
  resource: "orders" | "sales" | "inventory";
  recordId?: string;
  limit?: number;
}) {
  const auth = await getCurrentUserAuthorization();
  if (!auth) {
    return { success: false, error: "No autenticado." };
  }

  if (params.resource === "orders") {
    return await getDiagnosticOrders({
      grantId: params.grantId,
      businessId: params.businessId,
      adminUserId: auth.userId,
      orderId: params.recordId,
      limit: params.limit,
    });
  }

  if (params.resource === "sales") {
    return await getDiagnosticSales({
      grantId: params.grantId,
      businessId: params.businessId,
      adminUserId: auth.userId,
      saleId: params.recordId,
      limit: params.limit,
    });
  }

  if (params.resource === "inventory") {
    return await getDiagnosticInventory({
      grantId: params.grantId,
      businessId: params.businessId,
      adminUserId: auth.userId,
      productId: params.recordId,
      limit: params.limit,
    });
  }

  return { success: false, error: "Recurso de diagnóstico no soportado." };
}
